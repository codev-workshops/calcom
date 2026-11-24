# Dependency Analysis — Cal.com Monorepo

_Analysis of `packages/` ↔ `apps/web` relationships, generated 2026-11-24._

## Methodology

- **Nodes**: all 141 workspace packages under `packages/` and `apps/` (including
  `packages/app-store/*`, `packages/features/*`, `packages/embeds/*`, `packages/platform/*`).
- **Edges**: actual `@calcom/*` import statements (`import`/`export … from`/`require`/`import()`)
  scanned across ~6,700 source files — not just `package.json` declarations. Declared deps alone
  massively understate real coupling because Yarn workspaces hoist every package into the root
  `node_modules`, so **any package can import any other package whether or not it is declared**.
- **Scale**: 510 package-level edges; ~15,000 file-level `@calcom/*` imports.

## Key findings at a glance

| Finding | Severity |
| --- | --- |
| The 18 core packages form a single strongly-connected component (one giant cycle) | Critical |
| `@calcom/web` — the application — is imported by 13 other packages | High |
| `@calcom/features` is the gravitational center: fan-out 16, fan-in 32 | High |
| 109 of 141 packages import `@calcom/*` packages they never declare in `package.json` | High |
| `platform-enums ↔ platform-types` 2-package cycle | **Fixed in this change** |
| `prisma`, `lib`, `ui`, `types` all import "upward" into higher layers | Medium |

---

## 1. Dependency matrix (core packages)

Cell = number of files in the **row** package that import from the **column** package.
Blank = no dependency. Non-core app-store apps are excluded (nearly all share the same
shape: depend on `app-store`, `lib`, `prisma`, `types`).

| importer ↓ / imported → | web | features | ee | feat-auth | lib | types | prisma | trpc | app-store | ui | emails | atoms | rout-forms | embed-core | plat-libs | plat-types | plat-enums | plat-const | plat-utils | dayjs | kysely | api-v2 | api |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **web** | — | 1214 | 8 | 6 | 1348 | 84 | 453 | 523 | 194 | 1936 | 6 | 43 | 2 | 19 |  | 11 |  | 14 |  | 99 |  |  |  |
| **features** | 129 | — | 13 |  | 620 | 122 | 703 | 61 | 179 | 126 | 24 | 9 | 4 | 7 |  | 2 |  |  |  | 116 | 1 |  |  |
| **ee** | 19 | 254 | — |  | 219 | 15 | 269 | 29 | 39 | 15 | 19 |  | 1 |  |  |  |  |  |  | 26 | 1 |  |  |
| **feature-auth** | 1 | 43 | 3 | — | 61 | 2 | 40 | 2 | 3 | 3 | 2 |  |  |  |  |  |  |  |  | 4 |  |  |  |
| **lib** | 2 | 3 | 2 |  | — | 27 | 70 |  |  |  | 2 | 1 | 1 | 4 |  |  |  |  |  | 28 |  |  |  |
| **types** |  | 1 |  |  | 2 | — | 13 |  | 2 | 1 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| **prisma** |  |  |  |  | 2 |  | — |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| **trpc** |  | 643 | 28 |  | 275 | 15 | 530 | — | 73 | 2 | 12 |  | 6 |  |  |  |  |  |  | 16 | 3 |  |  |
| **app-store** | 2 | 31 |  |  | 57 | 29 | 63 |  | — | 23 | 1 | 1 | 1 |  |  |  |  |  |  |  |  |  |  |
| **ui** |  | 3 |  |  | 48 | 4 | 3 |  |  | — |  |  |  | 1 |  |  |  |  |  |  | 1 |  |  |
| **emails** | 2 | 5 |  |  | 128 | 39 | 13 |  | 3 |  | — |  |  |  |  |  |  |  |  | 6 |  |  |  |
| **atoms** | 82 | 111 |  |  | 51 | 8 | 15 | 22 | 13 | 65 |  | — |  | 2 | 2 | 85 |  | 79 |  | 5 |  |  |  |
| **routing-forms** | 4 | 24 |  |  | 32 | 3 | 41 |  | 13 | 19 | 3 |  | — |  |  |  |  |  |  | 1 |  |  |  |
| **embed-core** | 10 |  |  |  | 1 |  | 2 |  |  |  |  |  |  | — |  |  |  |  |  |  |  |  |  |
| **platform-libraries** |  | 97 |  |  | 19 | 4 | 9 | 24 | 17 |  | 14 |  |  |  | — |  |  |  |  |  |  |  |  |
| **platform-types** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — | 8 | 17 |  |  |  |  |  |
| **platform-enums** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ~~1~~ 0 | — | 1 |  |  |  |  |  |
| **platform-constants** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — |  |  |  |  |  |
| **platform-utils** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ~~1~~ 0 |  | 2 | — |  |  |  |  |
| **dayjs** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — |  |  |  |
| **kysely** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — |  |  |
| **api-v2** |  | 2 |  |  | 1 |  | 227 | 1 |  |  |  |  |  |  |  | 220 | 236 | 19 | 301 | 1 |  | — | 2 |
| **api** |  | 43 | 3 |  | 243 | 6 | 198 | 10 | 6 |  |  |  |  |  |  |  |  |  |  | 4 |  |  | — |

_(The struck-through `1`s in the `platform-*` rows are the edges removed by the fix below.)_

---

## 2. Circular dependencies

### 2.1 The core tangle — 18-package SCC

These packages are mutually reachable — every one can (transitively) import every other:

```
web, features, ee, feature-auth, lib, types, prisma, trpc, app-store, ui,
emails, atoms, routing-forms, embed-core, embed-react, embed-snippet,
paypal, platform-libraries
```

129 intra-SCC edges. The cycle is driven by three kinds of back-edges:

| Back-edge (lower layer → higher) | Files | Example |
| --- | --- | --- |
| packages → `apps/web` | ~237 total | `atoms → web/modules` (82), `features → web` (129, mostly `playwright`/`test` fixtures), `ee → web` (19), `lib/hooks/useLocale → web/app/*I18nProvider` |
| `features ↔ trpc` | 643 + 61 | trpc routers import feature services; `features` imports trpc server-side helpers |
| `features ↔ ee` | 254 + 13 | `ee` is mounted *inside* `features/` yet imports back into its parent |
| `lib → ee / atoms / web / emails / features` | 8 | `lib` (meant to be near the bottom) imports `ee/organizations/lib/orgDomains`, `atoms/hooks/useAtomsContext`, web i18n contexts |
| `prisma → lib` | 2 | `prisma/zod-utils.ts` re-exports `eventTypeLocations`, `eventTypeSlug` from `@calcom/lib/zod/eventType` — the DB layer importing the utility layer |
| `types → app-store / features / ui / prisma` | 6 | e.g. `types/Calendar.d.ts` imports `bookingResponse` from `features/bookings`; `types/data-table.d.ts` imports `IconName` from `ui` |
| `ui → features` | 3 | `ui/components/calendar-switch` imports `ICalendarSwitchProps` from `features`; `UserAvatarGroup*` imports `getBookerBaseUrlSync` |
| `platform-libraries → features / trpc / app-store / emails` | 162 | platform "libraries" reach deep into product code (97 files → `features`, 24 → `trpc`) |

### 2.2 `platform-enums ↔ platform-types` — **fixed**

The platform packages had a clean 2-cycle:

- `platform-types` imports `platform-enums` in 8 files (class-validator enums in NestJS DTOs — legitimate).
- `platform-enums/permissions.ts` imported `type PLATFORM_PERMISSION` from `platform-types` — the only reverse edge, and an *undeclared* dependency (`enums/package.json` didn't list `platform-types`).

`PLATFORM_PERMISSION` was defined as `(typeof PERMISSIONS)[number]` where `PERMISSIONS`
already lives in `@calcom/platform-constants` — a package both sides already depend on.

**Fix applied**: moved the type to `platform-constants/permissions.ts`, kept
`platform-types/permissions.ts` as a re-export for API compatibility, and repointed the
two consumers (`enums/permissions.ts`, `utils/permissions.ts`) at `platform-constants`.
Also dropped the now-unused `@calcom/platform-types` dependency from
`platform-utils/package.json`. The platform layer is now acyclic:

```
platform-constants ← platform-enums ← platform-types
                  ↖ platform-utils
```

> Note: type-check couldn't be executed here (no Node toolchain in this environment);
> the change is type-only and keeps `platform-types`' public API identical.

---

## 3. Excessive fan-out

Packages importing the most distinct `@calcom/*` packages (actual imports, not just declared):

| Package | Fan-out | Fan-in | Notes |
| --- | --- | --- | --- |
| `@calcom/web` | 17 | 13 | The app imports everything (expected) — but is *also* imported by 13 packages (not expected) |
| `@calcom/features` | 16 | 32 | The monolith inside the monorepo; see §4 |
| `@calcom/atoms` | 13 | 5 | Pulls in `web`, `trpc`, `features`, `platform-*`, `ui` — an embeddable widget pkg that drags the whole app along |
| `@calcom/trpc` | 13 | 8 | API layer reaching into features/ee/emails/paypal/routing-forms directly |
| `@calcom/feature-auth` | 12 | 1 | Auth feature reaches across almost every layer incl. `web` |
| `@calcom/ee` | 12 | 7 | Nested inside `features/` but is its own package — circular by construction |
| `@calcom/lib` | 11 | 65 | "Shared utilities" that know about `ee`, `atoms`, `web`, `emails` |
| `@calcom/api-v2` | 11 | 1 | NestJS app; legitimate consumer, depends on the platform-* stack |
| `@calcom/app-store` | 9 | 82 | Registry for ~100 app packages — high fan-in is by design |

### Fan-in leaders (most-depended-upon)

`types` (120) → `app-store` (82) → `lib` (65) → `prisma` (59) → `ui` (39) → `features` (32) → `dayjs` (22).

`@calcom/types` being imported by 120 packages while itself importing
`app-store`/`features`/`ui`/`prisma` means the "bottom" of the graph isn't a bottom —
it participates in the cycle.

---

## 4. Coupling hotspots

1. **`web ↔ features`** — the single heaviest channel in the repo: 1,214 files in `web` import
   `features`; 129 files in `features` import `web` (mostly `playwright`/`test` fixtures, but also
   real code like `calendars/weeklyview`, `posthog/provider`, `UserListTableUtils`,
   `pbac/lib/team-member-permissions`).
2. **`trpc ↔ features`** — 643 files one way, 61 the other. The API layer and feature layer have
   no boundary; routers call feature internals directly and features reach back into trpc.
3. **`features ↔ ee`** — 254 + 13 edges *between a package and a package nested inside it*.
4. **`atoms → web`** — 82 files: the platform atoms (embeddable booking UI) reuse components and
   modules straight out of the Next.js app (`web/modules/*`). This makes atoms unbuildable
   without the app and is the main reason `web` is inside the SCC.
5. **`platform-libraries → features/trpc/emails`** — the platform SDK layer wraps product code
   instead of the other way around; 97 files into `features` alone.
6. **`emails → web/lib/features`** — an email template package reaching into the app and
   feature code (e.g., for shared i18n/copy).

### The undeclared-dependency problem

109/141 packages import `@calcom/*` packages absent from their `package.json`. Worst offenders
by missing count: `trpc` (13), `atoms` (13), `features` (11), `ee` (10), `feature-auth` (8),
`billing` (8), `lib` (8), `platform-libraries` (6). This "works" only because of hoisted
`node_modules`. Consequences: builds can't be isolated per-package, Docker layer caching and
`turbo` graph pruning are inaccurate, and the declared dependency graph is fiction.

---

## 5. Prioritized refactoring recommendations

### P0 — Stop the bleeding (guardrails)

- **Add a dependency-boundary check in CI** (`dependency-cruiser` or eslint
  `import/no-restricted-paths`) with a frozen allowed-edge list, so new violations
  (packages → `apps/web`, `prisma → lib`, `ui → features`, `types → *`) fail the build.
  Ratchet: freeze today's edge list, forbid new ones.
- **Keep `platform-*` acyclic** — now true after the `enums ↔ types` fix; protect it with the
  boundary check.

### P1 — Break the app-into-package back-edges (removes `web` from the SCC)

- **Extract shared test fixtures**: most `features → web` (129 files) and all
  `embed-core → web` edges are Playwright/test fixtures. Move `apps/web/playwright/lib/*`
  into a `@calcom/test-utils` package. Removes the majority of `packages → web` edges at once.
- **Move shared modules out of `apps/web/modules`**: `atoms → web/modules` (82 files) and the
  handful of real `features → web` imports (`buildLegacyCtx`, `UserTable/types`, weeklyview
  `Calendar`, i18n providers imported by `lib/hooks/useLocale`) should live in `features/` or
  `ui/` so the dependency direction is `web → packages`, never `packages → web`.
- **Fix `lib`'s upward edges** (8 files): inline `subdomainSuffix` or move it to
  `lib/` (it's just a constant-ish helper); extract an `I18nContext` interface for `useLocale`
  instead of importing web's providers; move `Feedback` type into `types/`.

### P2 — Clarify layer boundaries

- **`trpc ↔ features`**: introduce a service-interfaces package (`features/*/contracts` or a
  `@calcom/contracts` pkg). tRPC routers may import contracts + thin handlers; feature code may
  never import `@calcom/trpc`. Then enforce with the boundary check.
- **`ee` inside `features`**: either fold `ee` back into `features` (one package, no fake
  boundary) or lift it to a true top-level package with `features` importing it via an explicit
  interface. Today it's circular by construction.
- **`types` as a real bottom**: remove `types → app-store/features/ui/prisma` edges —
  `bookingResponse` (Calendar.d.ts), `Tag` (App.d.ts), `IconName` (data-table.d.ts),
  dailyvideo zod schemas should live with their owners; `types/` should contain only leaf types
  (or be dissolved into `prisma`/`lib` type exports).
- **`ui → features`**: move `ICalendarSwitchProps` and `getBookerBaseUrlSync` into `ui/` or a
  config/env package — a component library shouldn't know about feature code.
- **`platform-libraries`**: invert — product code should consume platform libraries via a
  narrow interface rather than `platform-libraries` importing 97 `features` files. Likely needs
  a thin `platform-libraries/product-adapter` seam.

### P3 — Structural cleanup

- **Generate `package.json` deps from the import graph**: add a lint/script that diffs actual
  `@calcom/*` imports vs declared deps; fix the 109 packages (also enables accurate turbo/pruning).
- **Split `features` into bounded contexts** (bookings, event-types, workflows, calendars, auth…).
  With fan-in 32 and 703 edges to `prisma`, `features` is the monolith-inside-the-monorepo;
  carving out `bookings` first gives the best return.
- **Delete dead code**: `packages/platform/enums/permissions.ts` is an exact duplicate of
  `platform/utils/permissions.ts` and isn't exported from the enums index — candidate for removal.

---

## 6. Quick win implemented

**Broke the `@calcom/platform-enums ↔ @calcom/platform-types` cycle** by moving the
`PLATFORM_PERMISSION` type to where its source const already lives:

| File | Change |
| --- | --- |
| `packages/platform/constants/permissions.ts` | Added `export type PLATFORM_PERMISSION = (typeof PERMISSIONS)[number];` |
| `packages/platform/types/permissions.ts` | Now re-exports the type from `@calcom/platform-constants` (API unchanged) |
| `packages/platform/enums/permissions.ts` | Imports the type from `platform-constants` (also fixes an undeclared dep — `enums` never declared `platform-types`) |
| `packages/platform/utils/permissions.ts` | Imports the type from `platform-constants` |
| `packages/platform/utils/package.json` | Removed unused `@calcom/platform-types` dependency |

All consumers of `@calcom/platform-types`' `PLATFORM_PERMISSION` keep working through the
re-export; `platform-types → platform-enums` remains (legitimate: enums feed class-validator
decorators in DTOs), but `platform-enums` no longer depends on `platform-types`, and
`platform-utils` dropped the edge entirely.
