#!/usr/bin/env node
/**
 * Aggregates a dependency-cruiser JSON output into a package-level report for
 * the Cal.com monorepo (see docs/dependency-analysis.md).
 *
 *   yarn depcruise --config .dependency-cruiser.cjs --output-type json \
 *     --output-to /tmp/depcruise.json --no-progress packages apps/web
 *   node scripts/analyze-deps.mjs /tmp/depcruise.json [--json]
 *
 * "Package" here means a top-level workspace directory: `packages/<name>` (nested
 * workspaces such as packages/app-store/* or packages/platform/* are folded into
 * their parent) or `apps/<name>`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [, , inputPath = "/tmp/depcruise.json", ...flags] = process.argv;
const asJson = flags.includes("--json");
const root = process.cwd();

const TEST_PATH_RE =
  /(\.(test|spec|integration-test|e2e|e2e-test)\.[cm]?[jt]sx?$)|\/(__tests__|__mocks__|test|tests|playwright|e2e)\/|\/vitest\.|\/setupVitest|\.fixture\.|\/__fixtures__\//;

function packageOf(file) {
  const parts = file.split("/");
  if (parts[0] === "packages") return `packages/${parts[1]}`;
  if (parts[0] === "apps") return `apps/${parts[1]}`;
  return null;
}

function isTestFile(file) {
  return TEST_PATH_RE.test(`/${file}`);
}

const cruise = JSON.parse(fs.readFileSync(inputPath, "utf8"));

/** @type {Map<string, {files: Set<string>, imports: number, typeOnlyImports: number, valueImports: number, prodValueImports: number, testOnly: boolean, prodValueFiles: Set<string>, samples: string[]}>} */
const edges = new Map();
const filesPerPackage = new Map();

for (const mod of cruise.modules) {
  const fromPkg = packageOf(mod.source);
  if (!fromPkg) continue;
  filesPerPackage.set(fromPkg, (filesPerPackage.get(fromPkg) ?? 0) + 1);
  const fromIsTest = isTestFile(mod.source);

  // Group dependency entries by resolved file so that a file that has both a
  // value import and a type-only import of the same module counts as a value edge.
  const perTarget = new Map();
  for (const dep of mod.dependencies) {
    const toPkg = packageOf(dep.resolved);
    if (!toPkg || toPkg === fromPkg) continue;
    const typeOnly = dep.dependencyTypes.includes("type-only");
    const cur = perTarget.get(dep.resolved) ?? { toPkg, typeOnly: true, count: 0 };
    cur.typeOnly = cur.typeOnly && typeOnly;
    cur.count += 1;
    perTarget.set(dep.resolved, cur);
  }

  for (const [resolved, info] of perTarget) {
    const key = `${fromPkg}->${info.toPkg}`;
    const e = edges.get(key) ?? {
      from: fromPkg,
      to: info.toPkg,
      files: new Set(),
      imports: 0,
      typeOnlyImports: 0,
      valueImports: 0,
      prodValueImports: 0,
      prodValueFiles: new Set(),
      samples: [],
    };
    e.files.add(mod.source);
    e.imports += info.count;
    if (info.typeOnly) e.typeOnlyImports += info.count;
    else {
      e.valueImports += info.count;
      if (!fromIsTest) {
        e.prodValueImports += info.count;
        e.prodValueFiles.add(mod.source);
      }
    }
    if (e.samples.length < 5)
      e.samples.push(`${mod.source} -> ${resolved}${info.typeOnly ? " (type-only)" : ""}`);
    edges.set(key, e);
  }
}

const packages = [...new Set([...filesPerPackage.keys(), ...[...edges.values()].map((e) => e.to)])].sort();

// --- fan-out / fan-in ------------------------------------------------------
const fanOut = new Map();
const fanIn = new Map();
for (const e of edges.values()) {
  fanOut.set(e.from, (fanOut.get(e.from) ?? []).concat(e));
  fanIn.set(e.to, (fanIn.get(e.to) ?? []).concat(e));
}

// --- package-level cycles (pairs) ------------------------------------------
const pairCycles = [];
const seenPairs = new Set();
for (const e of edges.values()) {
  const back = edges.get(`${e.to}->${e.from}`);
  if (!back) continue;
  const id = [e.from, e.to].sort().join("<->");
  if (seenPairs.has(id)) continue;
  seenPairs.add(id);
  const [a, b] = [e, back].sort((x, y) => x.from.localeCompare(y.from));
  const classify = (x) =>
    x.prodValueImports > 0
      ? "runtime (production)"
      : x.valueImports > 0
        ? "runtime (test-only)"
        : "type-only";
  pairCycles.push({ a, b, aKind: classify(a), bKind: classify(b) });
}

// --- undeclared @calcom/* deps ---------------------------------------------
function readWorkspaceNames() {
  /** dir -> workspace name, and dir -> declared @calcom deps */
  const dirToName = new Map();
  const declared = new Map();
  const walk = (dir, depth) => {
    const pkgJson = path.join(root, dir, "package.json");
    if (fs.existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
        if (pkg.name) dirToName.set(dir, pkg.name);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
        declared.set(dir, new Set(Object.keys(deps).filter((n) => n.startsWith("@calcom/"))));
      } catch {
        /* ignore */
      }
    }
    if (depth === 0) return;
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(`${dir}/${entry.name}`, depth - 1);
    }
  };
  for (const p of packages) walk(p, 1);
  return { dirToName, declared };
}
const { dirToName, declared } = readWorkspaceNames();

// Workspace names that live under a package directory (e.g. packages/platform
// hosts @calcom/atoms, @calcom/platform-libraries, ...). Individual app-store
// apps are folded into @calcom/app-store.
function namesForPackage(pkgDir) {
  const names = new Set();
  for (const [dir, n] of dirToName) {
    if (dir === pkgDir) names.add(n);
    else if (dir.startsWith(`${pkgDir}/`) && pkgDir !== "packages/app-store") names.add(n);
  }
  return names;
}
// Only the top-level workspace's package.json counts as "declared" for the group.
function declaredForPackage(pkgDir) {
  return declared.get(pkgDir) ?? new Set();
}

const undeclared = [];
for (const pkg of packages) {
  const decl = declaredForPackage(pkg);
  const outs = fanOut.get(pkg) ?? [];
  for (const e of outs) {
    const targetNames = namesForPackage(e.to);
    const isDeclared = [...targetNames].some((n) => decl.has(n));
    if (!isDeclared) undeclared.push({ from: pkg, to: e.to, targetNames: [...targetNames], edge: e });
  }
}

// --- output -----------------------------------------------------------------
const short = (p) => p.replace(/^packages\//, "").replace(/^apps\//, "apps/");

if (asJson) {
  const plain = (e) => ({
    from: e.from,
    to: e.to,
    files: e.files.size,
    imports: e.imports,
    valueImports: e.valueImports,
    typeOnlyImports: e.typeOnlyImports,
    prodValueImports: e.prodValueImports,
    prodValueFiles: e.prodValueFiles.size,
    samples: e.samples,
  });
  console.log(
    JSON.stringify(
      {
        packages: packages.map((p) => ({ package: p, files: filesPerPackage.get(p) ?? 0 })),
        edges: [...edges.values()].map(plain),
        cycles: pairCycles.map((c) => ({ a: plain(c.a), aKind: c.aKind, b: plain(c.b), bKind: c.bKind })),
        undeclared: undeclared.map((u) => ({ from: u.from, to: u.to, ...plain(u.edge) })),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const out = [];
out.push(
  `# Package dependency summary (${cruise.summary.totalCruised} modules, ${cruise.summary.totalDependenciesCruised} dependencies)`
);
out.push("");
out.push("## Matrix (importing files / import statements, value+type)");
out.push("");
const sources = packages.filter((p) => (fanOut.get(p) ?? []).length > 0);
const targets = packages.filter((p) => (fanIn.get(p) ?? []).length > 0);
out.push(`| from \\ to | ${targets.map(short).join(" | ")} |`);
out.push(`|---|${targets.map(() => "---").join("|")}|`);
for (const s of sources) {
  const row = targets.map((t) => {
    const e = edges.get(`${s}->${t}`);
    return e ? `${e.files.size}/${e.imports}` : "";
  });
  out.push(`| **${short(s)}** | ${row.join(" | ")} |`);
}
out.push("");
out.push("## Fan-out (distinct packages imported, value imports only)");
out.push("");
out.push("| package | fan-out | targets (files/imports) |");
out.push("|---|---|---|");
for (const p of [...sources].sort((a, b) => (fanOut.get(b)?.length ?? 0) - (fanOut.get(a)?.length ?? 0))) {
  const outs = (fanOut.get(p) ?? []).filter((e) => e.valueImports > 0).sort((a, b) => b.imports - a.imports);
  out.push(
    `| ${short(p)} | ${outs.length} | ${outs.map((e) => `${short(e.to)} (${e.files.size}/${e.imports})`).join(", ")} |`
  );
}
out.push("");
out.push("## Fan-in (distinct packages importing this one)");
out.push("");
out.push("| package | fan-in | importers |");
out.push("|---|---|---|");
for (const p of [...targets].sort((a, b) => (fanIn.get(b)?.length ?? 0) - (fanIn.get(a)?.length ?? 0))) {
  const ins = (fanIn.get(p) ?? []).sort((a, b) => b.imports - a.imports);
  out.push(
    `| ${short(p)} | ${ins.length} | ${ins.map((e) => `${short(e.from)} (${e.files.size}/${e.imports})`).join(", ")} |`
  );
}
out.push("");
out.push("## Package-level cycles");
out.push("");
out.push("| A | B | A -> B (files/imports, value, type-only, prod-value) | kind | B -> A | kind |");
out.push("|---|---|---|---|---|---|");
for (const c of pairCycles.sort((x, y) => x.a.from.localeCompare(y.a.from))) {
  const f = (e) =>
    `${e.files.size}/${e.imports} (v ${e.valueImports}, t ${e.typeOnlyImports}, pv ${e.prodValueImports})`;
  out.push(`| ${short(c.a.from)} | ${short(c.a.to)} | ${f(c.a)} | ${c.aKind} | ${f(c.b)} | ${c.bKind} |`);
}
out.push("");
out.push("### Cycle edge samples");
for (const c of pairCycles) {
  for (const e of [c.a, c.b]) {
    if (e.files.size <= 12) {
      out.push(`\n**${short(e.from)} -> ${short(e.to)}** (${e.files.size} files)`);
      for (const f of [...e.files].sort()) out.push(`- ${f}${isTestFile(f) ? " (test)" : ""}`);
    }
  }
}
out.push("");
out.push("## Undeclared @calcom/* dependencies (imported but not in any package.json of the importer)");
out.push("");
out.push("| package | undeclared target | files/imports | value imports | prod value imports |");
out.push("|---|---|---|---|---|");
for (const u of undeclared.sort((x, y) => x.from.localeCompare(y.from) || y.edge.imports - x.edge.imports)) {
  out.push(
    `| ${short(u.from)} | ${short(u.to)} (${u.targetNames.join(", ") || "n/a"}) | ${u.edge.files.size}/${u.edge.imports} | ${u.edge.valueImports} | ${u.edge.prodValueImports} |`
  );
}
console.log(out.join("\n"));
