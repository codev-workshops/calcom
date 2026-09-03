/**
 * dependency-cruiser configuration for the Cal.com monorepo.
 *
 * Usage (see docs/dependency-analysis.md):
 *   yarn depcruise --config .dependency-cruiser.cjs --output-type json \
 *     --output-to /tmp/depcruise.json packages apps/web
 *   node scripts/analyze-deps.mjs /tmp/depcruise.json
 *
 * `@calcom/*` specifiers are resolved through the yarn workspace symlinks in
 * node_modules (which dependency-cruiser dereferences to their real
 * `packages/...` path), plus the tsconfig `paths` aliases used by apps/web.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "warn",
      comment: "Circular dependencies between modules (value imports only).",
      from: {},
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "/\\.next/", "/dist/", "/build/"],
    },
    exclude: {
      path: [
        "node_modules",
        "\\.next/",
        "/dist/",
        "/build/",
        "\\.generated\\.",
        "\\.d\\.ts$",
        "packages/prisma/(client|generated|zod)/",
        "packages/prisma/migrations/",
        "\\.(json|css|scss|svg|png|jpe?g|gif|webp|ico|md|mdx|html|txt|yml|yaml|hbs)$",
      ],
    },
    includeOnly: {
      path: ["^packages/", "^apps/web/"],
    },
    moduleSystems: ["es6", "cjs", "tsd"],
    tsPreCompilationDeps: "specify",
    tsConfig: {
      fileName: "tsconfig.depcruise.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
      extensions: [".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
    skipAnalysisNotInRules: true,
    reporterOptions: {
      dot: { collapsePattern: "^(packages/[^/]+|apps/[^/]+)" },
    },
  },
};
