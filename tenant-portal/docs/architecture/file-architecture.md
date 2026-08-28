# File Architecture

Status: **Specification**

Written: **2026-08-27**

## The tree

Every file in `src/` belongs to exactly one of these layers. If you cannot say
which layer a new file belongs to, that is a design problem, not a naming
problem.

```text
src/
  app/                          Next App Router — routes only
    layout.tsx                  <html>, fonts, theme bootstrap script
    globals.css                 TOKEN SOURCE OF TRUTH
    fonts.ts                    next/font declarations
    proxy.ts                    route allowlist → /unavailable
    (auth)/                     public routes, no shell
      login/
    (tenant)/                   authenticated routes, inside AppShell
      layout.tsx                host admission + providers + shell
      page.tsx                  workspace home
      crm/
        leads/page.tsx          thin: renders the feature workspace
        customer-profiles/
        opportunities/
        ...
      core/
      unavailable/

  design-system/                THE design system — see docs/design/
    index.ts                    public barrel; the ONLY import path for features
    lib/                        cn.ts, variants.ts
    primitives/                 21 files
    patterns/                   12 directories
    views/                      board/ card/ table/ ViewSwitcher
    shell/                      AppShell, Sidebar, Topbar, MobileNav, nav-config
    feedback/                   ToastProvider, useToast, AppToast

  features/                     domain logic, one directory per bounded area
    crm/
      leads/
        api.ts                  typed request functions
        schema.ts               runtime response validation
        types.ts                view models
        useLeads.ts             the screen's hook
        LeadsWorkspace.tsx      composition
        components/             pieces used only by this feature
      customer-profiles/
      opportunities/
      shared/                   used by 2+ CRM features only
    core/
      authentication/
      notifications/

  lib/                          business-neutral infrastructure
    api/axiosClient.ts          transport — the ONLY place fetch is called
    auth/                       session coordination, refresh, errors
    notifications/              realtime notification runtime
    navigation/tenant-routes.ts route allowlist + permission mapping
    format/                     number, date, currency formatters
    safeStorage.ts
    uuid.ts

  i18n/                         dictionaries, provider, direction bridge
  context/                      AuthContext, TenantRealtimeProvider
  shared/tenancy/               server-only host admission
  hooks/                        cross-feature hooks only
```

## Dependency direction

Enforced by ESLint `no-restricted-imports`. These are not conventions.

```text
ALLOWED
  app          → features, design-system, lib, i18n, context
  features     → design-system, lib, i18n, context, its own files
  design-system→ lib/format, lib/utils, i18n
  lib          → nothing in this app except other lib

FORBIDDEN
  lib          → features, app, design-system
  design-system→ features, app
  features/crm/X → features/crm/Y internals   (go through features/crm/shared)
  features/crm   → features/core internals
  anything     → ../backend/**
```

The rule that matters most: **`lib/` is the spine and imports nothing upward.**
It is currently clean — 0 wrong-direction imports — and it must stay that way.
That property is what makes the spine survivable across a full UI rewrite.

## The barrel

Feature code imports design-system pieces **only** from `@/design-system`:

```ts
// ✅
import { Button, DataTable, PageHeader } from "@/design-system";

// ❌ — lint error
import { Button } from "@/design-system/primitives/Button";
```

That single indirection is what lets a primitive move, merge or get rewritten
without touching call sites. Inside `src/design-system/`, deep relative imports
are correct and expected — the barrel is for consumers.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `LeadsWorkspace.tsx` |
| Hook file | `useThing.ts` | `useLeads.ts` |
| Non-component module | `kebab-case.ts` | `tenant-routes.ts` |
| Test | `<subject>.test.ts(x)` beside subject | `useLeads.test.ts` |
| Route file | Next's names, lowercase | `page.tsx`, `layout.tsx` |
| Route segment | `kebab-case` | `customer-profiles` |
| Type / interface | `PascalCase`, no `I` prefix | `LeadListItem` |
| Enum-like union | `PascalCase` type, `SCREAMING` values | `type LeadStatus = "OPEN"` |
| Boolean | `is` / `has` / `can` prefix | `isLoading`, `canCreate` |
| Handler prop | `on<Event>` | `onSelect` |
| Handler impl | `handle<Event>` | `handleSelect` |

Directory names are always `kebab-case`, including inside `features/`.

## Feature module shape

Every feature directory has the same six-part shape. A build agent should never
have to invent a layout.

```text
features/crm/leads/
  api.ts              request functions. Import axiosClient. No React.
  schema.ts           runtime validation of responses. No React.
  types.ts            view models the UI consumes.
  useLeads.ts         the hook: state, effects, handlers, capabilities.
  LeadsWorkspace.tsx  composition: header, filters, switcher, views.
  components/         pieces used ONLY here.
  useLeads.test.ts    tests beside subject.
```

Rules:

- **`api.ts` never imports React.** It is testable without a renderer.
- **`schema.ts` never imports React** and never imports `api.ts` — validation
  is independent of transport.
- **The hook is the only place state lives.** Components receive props.
- **Components hold markup and classNames.** State, effects, handlers and API
  calls belong in the hook. This is the existing house rule and it stays.
- A `components/` file used by a second feature moves to `features/crm/shared/`.
  A file used by a third feature or by `app/` moves to `design-system/`.

## Route files are thin

```tsx
// app/(tenant)/crm/leads/page.tsx — this is the whole file
import { LeadsWorkspace } from "@/features/crm/leads/LeadsWorkspace";

export default function LeadsPage() {
  return <LeadsWorkspace />;
}
```

A route file may: parse route params, run server-only admission, choose a
feature entry point, and declare metadata. It may **not** hold API clients,
permission logic, DTO validation, or stateful feature components.

## Where a new thing goes

| You are adding | It goes in |
| --- | --- |
| A new screen | `app/(tenant)/<module>/<segment>/page.tsx` + `features/<module>/<feature>/` |
| A reusable button/input/dialog | `design-system/primitives/` |
| A reusable table/drawer/header | `design-system/patterns/` |
| Something two CRM features share | `features/crm/shared/` |
| A pure helper with no domain meaning | `lib/` |
| A formatter | `lib/format/` |
| A user-visible string | `i18n/dictionaries/{en,ar}.ts` — **both** |
| A color, size, or radius | `app/globals.css` as a token — never inline |
| A permission-gated route | `lib/navigation/tenant-routes.ts` allowlist |

## Cleanliness rules

These are the "no garbage" requirements, stated concretely so they can be
checked:

- **No unused anything.** No unused imports, variables, constants, types,
  props, exports, or files. `knip` runs in CI to catch unreferenced exports and
  files that nothing imports.
- **No commented-out code.** Git has it. Delete it.
- **No TODO without an owner and a linked question** in
  [build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md).
- **No dead branches.** If a prop only ever receives one value, remove the prop.
- **No duplicated logic.** Two implementations of the same thing means one
  moves up a layer. Formatting, validation and permission checks are especially
  prone to this.
- **No barrel re-export of a single file** just to shorten an import.
- **No `any`.** `unknown` plus a validator at the boundary.
- **No default exports** except Next's required `page`/`layout`/`error` files.
  Named exports are greppable and rename-safe.
- **Files stay under ~300 lines.** Past that, split by responsibility — a
  1,000-line hook is three hooks.

## Comments

Comment **why**, never **what**.

```ts
// ❌
// Loop over the leads and filter by branch
// ✅
// Branch filtering is advisory only — the server re-filters by the actor's
// accessible branches, so an empty result here is not proof of no access.
```

Every non-obvious constant carries its source:

```ts
// Core rejects a refresh older than its idle window
// (core-app/src/tenant/tenant-auth/tenant-auth.service.ts).
const REFRESH_SKEW_MS = 30_000;
```
