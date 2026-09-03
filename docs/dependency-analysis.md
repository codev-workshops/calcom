# Monorepo Dependency Analysis

Scope: workspace packages under `packages/` and their relationship to `apps/web`
(`@calcom/web`). `apps/api/v2` (`@calcom/api-proxy` workspace) is included in the
matrix for context only.

## Method

The graph is built from actual `import`/`export ... from`/`require()` statements
(`.ts`, `.tsx`, `.js`, `.mjs`; `node_modules`, `dist`, `.next` excluded) rather than
from `package.json`, because most cross-package imports in this repo are **not
declared** in `package.json` (see [Undeclared dependencies](#undeclared-dependencies)).
An import specifier is attributed to the longest matching workspace name
(`@calcom/features/ee/...` -> `@calcom/features`; `@calcom/ee/...` -> `packages/features/ee`,
which is a nested workspace inside `@calcom/features` and is folded into it below
except where noted).

"Imports" = number of import statements; "files" = number of distinct source files
in the importing package that touch the target; "modules" = number of distinct target
files imported (a proxy for how wide the consumed surface is).

## Package inventory

| Package | Path | Role |
| --- | --- | --- |
| `@calcom/web` | `apps/web` | Next.js application |
| `@calcom/features` | `packages/features` | Feature/business logic (+ nested `@calcom/ee`) |
| `@calcom/trpc` | `packages/trpc` | tRPC routers |
| `@calcom/lib` | `packages/lib` | Shared utilities |
| `@calcom/ui` | `packages/ui` | Shared UI components |
| `@calcom/app-store` | `packages/app-store` | Third-party integrations |
| `@calcom/prisma` | `packages/prisma` | Schema, client, zod schemas |
| `@calcom/emails` | `packages/emails` | Email templates/services |
| `@calcom/atoms` | `packages/platform/atoms` | Platform embeddable React atoms |
| `@calcom/platform-libraries` | `packages/platform/libraries` | Re-export facade for `apps/api/v2` |
| `@calcom/platform-types` / `-constants` / `-enums` / `-utils` | `packages/platform/*` | Platform API contracts |
| `@calcom/embed-core` / `-react` / `-snippet` | `packages/embeds/*` | Embed SDK |
| `@calcom/dayjs`, `@calcom/types`, `@calcom/kysely`, `@calcom/config`, `@calcom/tsconfig`, `@coss/ui` | `packages/*` | Leaf/support packages |

## Dependency matrix

Rows import from columns. Cell = number of import statements. Blank = no imports.
Cells marked `*` are **back-edges** (a lower layer importing a higher layer) and are
the source of every cycle in the graph.

| from \ to | web | features | trpc | lib | ui | app-store | prisma | emails | atoms | embed-core | types | dayjs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **web** | | 1214 | 523 | 1348 | 1936 | 194 | 453 | 6 | 43 | 19 | 84 | 99 |
| **features** | 149\* | | 92\* | 924 | 144\* | 222\* | 1034 | 49 | 9\* | 7 | 138 | 148 |
| **trpc** | | 643 | | 275 | 2\* | 73 | 530 | 12 | | | 15 | 16 |
| **lib** | 2\* | 3\* | | | | | 70 | 2\* | 1\* | 4\* | 27 | 28 |
| **ui** | | 3\* | | 48 | | | 3 | | | 1\* | 4 | 1 |
| **app-store** | 11\* | 101\* | | 478 | 128 | | 244 | 6\* | 1\* | | 231 | 14 |
| **prisma** | | | | 2\* | | | | | | | | |
| **emails** | 2\* | 5\* | | 128 | | 3\* | 13 | | | | 39 | 6 |
| **atoms** | 82\* | 111 | 22 | 51 | 65 | 13 | 15 | | | 2 | 8 | 5 |
| **platform-libraries** | | 97 | 24 | 19 | | 17 | 9 | 14 | | | 4 | |
| **embed-core** | 10\* | | | 1 | | | 2\* | | | | | |
| **embed-react** | 1\* | | | | | | | | | 4 | | |
| **api-proxy** (`apps/api/v2`) | | 45 | 11 | 244 | | 6 | 425 | | | | 6 | 4 |

Notes:

* `features -> web` is 149 statements, but **144 are test scaffolding**
  (`@calcom/web/test/utils/bookingScenario/*`, `@calcom/web/test/fixtures/fixtures`,
  `@calcom/web/playwright/lib/fixtures`). Only 5 production files import from
  `apps/web` (listed under [Hotspot 3](#hotspot-3-packages-importing-from-appsweb)).
* `atoms -> web` (82) is entirely production code: atoms wrap the event-type editor
  tabs that live in `apps/web/modules/event-types/**`.
* `ui -> features` / `lib -> features` / `prisma -> lib` are numerically tiny but
  architecturally significant because `ui`, `lib` and `prisma` are the packages
  everything else is supposed to sit on.

## Fan-out / fan-in

| Package | Fan-out (packages imported) | Fan-in (packages importing it) | Import statements |
| --- | --- | --- | --- |
| `@calcom/web` | 15 | 7\* | 5953 |
| `@calcom/features` | 16 | 11 | 2977 |
| `@calcom/atoms` | 13 | 4 | 540 |
| `@calcom/trpc` | 11 | 5 | 1598 |
| `@calcom/lib` | 10 | 12 | 141 |
| `@calcom/app-store` | 9 | 7 | 1214 |
| `@calcom/platform-libraries` | 8 | 2 | 185 |
| `@calcom/emails` | 7 | 6 | 196 |
| `@calcom/ui` | 6 | 5 | 60 |
| `@calcom/embed-core` | 3 | 7 | 13 |
| `@calcom/prisma` | 1 | 13 | 2 |
| `@calcom/dayjs`, `@calcom/types`, `@calcom/config`, `@calcom/kysely` | 0 | 4-13 | 0 |

\* An application should have fan-in 0. `apps/web` is imported by `features`, `lib`,
`app-store`, `emails`, `atoms`, `embed-core` and `embed-react`.

### Excessive fan-out

1. **`@calcom/features` (16/16 possible)** — imports *every* other package including
   `web`, `trpc`, `ui`, `atoms`, `embed-core`, `embed-react`, `emails`, `app-store`.
   It is simultaneously the widest consumer and the second-widest provider, which
   makes it the hub of almost every cycle. `features -> lib` alone touches **132
   distinct `lib` modules**; `features -> app-store` touches 60.
2. **`@calcom/atoms` (13)** — a publishable package (`@calcom/atoms` on npm) that
   reaches into `web`, `trpc`, `features`, `app-store`, `embed-core`. Its build has to
   bundle a large slice of the private monorepo; any refactor in `apps/web/modules`
   can break the published SDK.
3. **`@calcom/lib` (10)** — supposed to be a leaf utility package but imports from
   `features`, `web`, `emails`, `atoms`, `embed-core`, `ee`. Each of these is a
   handful of files (`hooks/useLocale.ts`, `hooks/useTheme.ts`, `getBrandColours.tsx`,
   `browser/browser.utils.ts`, `sdk-event.ts`, `formbricks.ts`, `formatCalendarEvent.ts`,
   `domainManager/organization.ts`, `test/builder.ts`), which is why they are
   good quick wins.
4. **`@calcom/trpc` (11)** — expected to be wide (it is the API layer) but
   `trpc -> features` consumes **195 distinct modules**, i.e. routers reach into
   feature internals rather than a service surface.

## Circular dependencies

A DFS over the import graph finds **301 simple cycles of length <= 4** among the
20 packages. They all decompose into a small number of back-edges:

| # | Back-edge | Prod imports | What creates it | Severity |
| --- | --- | --- | --- | --- |
| C1 | `prisma -> lib` | 2 | `packages/prisma/zod-utils.ts` re-exports `eventTypeLocations`, `EventTypeLocation`, `eventTypeSlug` from `@calcom/lib/zod/eventType` "for backwards compatibility". `lib -> prisma` has 70 imports, so `lib <-> prisma` is a 2-cycle at the very bottom of the stack. The generated `packages/prisma/zod/modelSchema/EventTypeSchema.ts` imports these symbols from `zod-utils`, so the fix needs a zod-prisma generator config change, not just a source edit. | High |
| C2 | `lib -> web` | 2 | `packages/lib/hooks/useLocale.ts` imports `AppRouterI18nContext` / `CustomI18nContext` from `apps/web/app/*`. | High — `lib` is imported by 12 packages |
| C3 | `lib -> atoms` | 1 | Same file, `useAtomsContext` from `@calcom/atoms/hooks/useAtomsContext`. | High |
| C4 | `lib -> embed-core` | 4 | `useTheme.ts`, `getBrandColours.tsx`, `browser.utils.ts`, `sdk-event.ts` import `@calcom/embed-core/embed-iframe`. | Medium |
| C5 | `lib -> features` / `lib -> ee` / `lib -> emails` | 3 / 2 / 2 | `formatCalendarEvent.ts` (type), `domainManager/organization.ts` (`subdomainSuffix`), `formbricks.ts` (type), `test/builder.ts`. Mostly type-only. | Medium (types) |
| C6 | `ui -> features` | 3 (2 after this PR) | `UserAvatarGroup*.tsx` import `getBookerBaseUrlSync`; `CalendarSwitch.tsx` imported the `ICalendarSwitchProps` type (**moved into `ui` in this PR**). `ui -> embed-core` via `useIsEmbed`. | Medium |
| C7 | `features <-> trpc` | 92 / 643 | `features` imports `trpc` client hooks (`@calcom/trpc/react`) in UI components; `trpc` imports feature services. | High (structural) |
| C8 | `features <-> ui` | 144 / 3 | see C6 | Medium |
| C9 | `features <-> app-store` | 222 / 101 | `app-store` apps import feature components/services; `features` imports app metadata, locations, credentials helpers. | High (structural) |
| C10 | `features <-> emails` | 49 / 5 | `emails/email-manager.ts` and `templates/_base-email.ts` import `FeaturesRepository`, `getEventName`, `OrganizationSettingsRepository`. | Medium |
| C11 | `features -> web` (prod) | 5 | `calendars/weeklyview/index.tsx`, `users/lib/UserListTableUtils.ts`, `pbac/lib/team-member-permissions.ts`, `auth/signup/handlers/calcomHandler.ts`, `ee/event-tracking/lib/posthog/provider.tsx`. | High |
| C12 | `atoms <-> web` / `atoms <-> features` | 82 / 43 ; 111 / 9 | atoms wrap `apps/web/modules/event-types/**` tabs; `web` renders atoms; `features` imports atoms hooks. | High |
| C13 | `app-store -> web` / `emails -> web` / `embed-core -> web` | 1 / 0 / 0 (rest tests) | Test fixtures from `apps/web/test` and `apps/web/playwright`. | Low (test-only) |
| C14 | `platform-enums <-> platform-types` | 1 / 8 | `platform-enums` imports a type from `platform-types`. | Low |

## Coupling hotspots

### Hotspot 1: `@calcom/features` is a "god package"

* 2977 outgoing imports, 16 targets; 11 packages import it back.
* `trpc -> features` = 643 imports across 195 distinct modules; `web -> features` =
  1214 imports across **299 distinct modules**. There is effectively no interface:
  consumers import repositories, services, hooks, React components and zod schemas
  by deep path.
* Contains a nested workspace (`packages/features/ee`, name `@calcom/ee`) that is
  imported via two different specifiers (`@calcom/ee/*` — 91 imports, and
  `@calcom/features/ee/*`) for the same files.

### Hotspot 2: `@calcom/lib` and `@calcom/prisma` are not leaves

`lib` is imported by 12 packages and `prisma` by 13, so any import *out of* them
drags the whole graph into a cycle. `prisma -> lib` and the 9 files in
`lib` listed under C2–C5 are the entire problem; none of them is large.

### Hotspot 3: packages importing from `apps/web`

Production imports of `@calcom/web/*` from packages:

| Importer | Target in `apps/web` |
| --- | --- |
| `packages/platform/atoms/**` (30 files, 40 modules) | `modules/event-types/components/**` (EventSetupTab, EventLimitsTab, EventAvailabilityTab, EventAdvancedTab, EventRecurringTab, EventTeamAssignmentTab, AddMembersWithSwitch, EventType), `app/*Provider`, locale JSON |
| `packages/lib/hooks/useLocale.ts` | `app/AppRouterI18nProvider`, `app/CustomI18nProvider` |
| `packages/features/calendars/weeklyview/index.tsx` | `modules/calendars/weeklyview/components/Calendar` |
| `packages/features/users/lib/UserListTableUtils.ts`, `packages/features/pbac/lib/team-member-permissions.ts` | `modules/users/components/UserTable/types` |
| `packages/features/auth/signup/handlers/calcomHandler.ts` | `lib/buildLegacyCtx` |
| `packages/features/ee/event-tracking/lib/posthog/provider.tsx` | `app/GeoContext` |

Test-only imports (`apps/web/test/**`, `apps/web/playwright/**`) account for a
further ~150 statements from `features`, `app-store`, `emails`, `embed-core`.

### Hotspot 4: `@calcom/atoms` bundles the monorepo

`atoms` (fan-out 13, 540 imports) is the public platform SDK, yet it depends on
`web`, `trpc`, `features` and `app-store` — none of which are designed to be
published. The `packages/platform/libraries` facade (185 re-exports, 8 targets)
exists for the same reason on the server side; both are symptoms of missing public
surfaces in `features`.

### Hotspot 5: `@calcom/emails` depends on feature services

`emails` should be a rendering layer, but `email-manager.ts` and
`templates/_base-email.ts` resolve feature flags and org settings themselves
(`FeaturesRepository`, `OrganizationSettingsRepository`, `getEventName`), and
`features -> emails` is 49 imports, so email logic and booking logic are mutually
dependent.

### Undeclared dependencies

Workspace packages imported without a matching `package.json` entry (Yarn hoisting
hides this today, and it is why the graph above is import-based):

| Package | Imports without declaration |
| --- | --- |
| `@calcom/features` | `app-store`, `config`, `emails`, `embed-core`, `embed-react`, `kysely`, `platform-types`, `prisma`, `types`, `web` |
| `@calcom/trpc` | `app-store`, `config`, `dayjs`, `emails`, `features`, `kysely`, `lib`, `prisma`, `types`, `ui` |
| `@calcom/atoms` | all 13 of its targets |
| `@calcom/lib` | `atoms`, `emails`, `embed-core`, `features`, `prisma`, `web` |
| `@calcom/ui` | `dayjs`, `embed-core`, `features`, `prisma`, `types` |
| `@calcom/emails` | `app-store`, `features`, `prisma`, `web` |
| `@calcom/app-store` | `atoms`, `emails`, `prisma`, `web` |
| `@calcom/web` | `atoms`, `emails`, `platform-constants` |

Conversely `@calcom/web` declares `@calcom/app-store-cli`, `@calcom/embed-react`,
`@calcom/embed-snippet`, `@calcom/platform-enums`, `@coss/ui` and never imports them.

## Target layering

```
apps/web, apps/api/v2, packages/platform/atoms          (applications / SDK)
        |
packages/trpc, packages/platform/libraries              (API surface)
        |
packages/features (+ee), packages/app-store, packages/emails   (domain)
        |
packages/ui                                             (presentation primitives)
        |
packages/lib, packages/embed-core                       (utilities, no domain)
        |
packages/prisma, packages/kysely, packages/dayjs, packages/types, packages/config  (leaves)
```

Every `*` cell in the matrix is an edge pointing *up* this diagram.

## Prioritized recommendations

Ordered by (cycles removed) / (effort).

### P0 — quick wins (single-session, <10 files each)

1. **Move `ICalendarSwitchProps` down into `ui`** (C6). *Done in this PR*: the
   type now lives in `packages/ui/components/calendar-switch/CalendarSwitch.tsx`
   (re-exported from the package's `calendar-switch` entry); `features` and
   `atoms` import it from there. Removes one of the three `ui -> features`
   imports and the `atoms -> features` import for this type. Zero runtime change.
2. **Remove `prisma -> lib`** (C1). Attempted here and reverted: the generated
   zod schemas (`packages/prisma/zod/modelSchema/*.ts`) import `eventTypeSlug`
   and `eventTypeLocations` from `../../zod-utils`, so the re-exports must stay
   until the `zod-prisma` generator is pointed at `@calcom/lib/zod/eventType`
   (or the schemas move into `prisma`). Once done, `@calcom/prisma` has fan-out
   0 and every cycle through `prisma` (~40 of the 301) disappears.
3. **Move i18n context objects out of `apps/web`** (C2, C3). Create
   `packages/lib/i18n/contexts.ts` exporting `AppRouterI18nContext` and
   `CustomI18nContext` (they are plain `createContext` calls), have
   `apps/web/app/*Provider.tsx` import them from there, and inject the atoms
   context via a `useLocale` provider option instead of importing
   `@calcom/atoms/hooks/useAtomsContext` from `lib`. Removes `lib -> web` and
   `lib -> atoms`.
4. **Move `getBookerBaseUrlSync` down** (C6, remainder). The URL helper is pure
   string logic and belongs in `packages/lib`. Removes the last `ui -> features`
   imports.
5. **Type-only back-edges in `lib`** (C5): move `ExtendedCalendarEvent`
   (`formatCalendarEvent.ts`) and `Feedback` (`formbricks.ts`) types to
   `packages/types` or define them locally; move `subdomainSuffix` to `lib`.
6. **Break `platform-enums -> platform-types`** (C14) by moving the single shared
   type into `platform-enums` or `platform-constants`.

### P1 — medium (1–2 sessions each)

7. **Stop packages importing test fixtures from `apps/web`** (C11, C13). Move
   `apps/web/test/utils/bookingScenario/*`, `apps/web/test/fixtures/fixtures.ts`
   and `apps/web/playwright/lib/{fixtures,testUtils}.ts` into a
   `packages/testing` (or `@calcom/test-utils`) workspace. ~150 import sites, all
   mechanical.
8. **Move the 5 production `features -> web` imports** into `features`
   (`weeklyview/Calendar`, `UserTable/types`, `buildLegacyCtx`, `GeoContext`).
   After 6 and 7, `apps/web` has fan-in only from `atoms`.
9. **Split `@calcom/embed-core/embed-iframe` hooks** used by `lib`/`ui`
   (`useIsEmbed`, `useEmbedTheme`, `useBrandColors`, `sdkActionManager`) into a
   tiny, dependency-free `embed-iframe` entry or into `lib`, so `embed-core` is
   a leaf and `lib`/`ui` no longer depend on the embed SDK.
10. **Decouple `emails` from `features`** (C10): pass resolved feature-flag and
   org-setting values into `BaseEmail`/`email-manager` from the caller instead of
   resolving repositories inside the email layer.

### P2 — structural (multi-session, needs design agreement)

10. **Move the event-type editor from `apps/web/modules/event-types` into
    `packages/features/eventtypes/components`** so `atoms` (and `web`) consume it
    from `features`. This is the only way to remove `atoms -> web` (82 imports)
    and make the published SDK independent of the Next.js app.
11. **Define a public surface for `@calcom/features`**: group the 299 modules
    consumed by `web` and 195 consumed by `trpc` behind per-feature entry points
    (`@calcom/features/bookings/server`, `@calcom/features/bookings/client`, ...)
    and enforce with Biome `noRestrictedImports` / a dependency-cruiser config in
    CI. This is what makes `platform-libraries` unnecessary over time.
12. **Split `features` client/server** so `trpc` (server) never imports React
    components and `features` client code never imports `@calcom/trpc/react`
    directly (inject the tRPC client through a provider). Removes C7.
13. **Collapse `@calcom/ee` into `@calcom/features/ee`** (single specifier,
    delete the nested workspace) — 91 import sites, purely mechanical, but it
    clarifies the graph and the licence boundary.
14. **Declare workspace dependencies** in every `package.json` (table above) and
    add a CI check so the graph stays honest once the cycles are removed.

## Reproducing the numbers

The matrix was produced by a ~60-line script that walks `packages/` and `apps/`,
extracts `@calcom/*` / `@coss/*` import specifiers, maps them to workspace names and
counts statements/files/modules per (source, target) pair, then runs a bounded DFS
for cycles. Re-run it after each P0/P1 item to confirm the corresponding `*` cell
drops to zero.
