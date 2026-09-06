# File Architecture

Status: **Specification**

Written: **2026-08-27**. Screen module shape corrected **2026-08-28** to
match what all 10 converted screens actually shipped — see
[Q13 in OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md#q13--features-layer-specified-but-not-followed--resolved-2026-08-28)
for why the original `features/` layer described here never happened.

## The tree

Every file in `src/` belongs to exactly one of these layers. If you cannot say
which layer a new file belongs to, that is a design problem, not a naming
problem.

```text
src/
  app/                          Next App Router — routes AND screen logic
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
        leads/                  page.tsx + hooks/ + components/ — see below
        customer-profiles/
        opportunities/
        ...
      core/
      unavailable/

  design-system/                THE design system — see docs/design/
    index.ts                    public barrel; the ONLY import path for screens
    lib/                        cn.ts, variants.ts
    primitives/                 21 files
    patterns/                   12 directories
    views/                      board/ card/ table/ ViewSwitcher
    shell/                      AppShell, GlobalNav, PageActionBar, NavSheet, nav-config
    feedback/                   ToastProvider, useToast, AppToast

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

There is no `src/features/` layer. Every screen's hooks, types, and
screen-only components live colocated under its own route folder in
`app/(tenant)/`, not in a separate domain-logic tree — see "Screen module
shape" below.

## Dependency direction

Enforced by ESLint `no-restricted-imports`. These are not conventions.

```text
ALLOWED
  app          → design-system, lib, i18n, context, its own files
  app/crm/X    → a narrow, named type/enum from app/crm/Y, when X and Y
                 share the same backend resource (e.g. leads importing
                 LeadStageFlag from lead-stages) — precedent, not a rule to
                 stretch: reuse a shared vocabulary, never a whole hook,
                 component, or unrelated export
  design-system→ lib/format, i18n
  lib          → nothing in this app except other lib

FORBIDDEN
  lib          → app, design-system
  design-system→ app
  app/crm/X    → app/crm/Y's hooks, components, or anything beyond a shared
                 type/enum — a component used by two screens moves to
                 design-system/ instead
  anything     → ../backend/**
```

The rule that matters most: **`lib/` is the spine and imports nothing upward.**
It is currently clean — 0 wrong-direction imports — and it must stay that way.
That property is what makes the spine survivable across a full UI rewrite.

## The barrel

Screen code imports design-system pieces **only** from `@/design-system`:

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

Directory names are always `kebab-case`, including route segments under
`app/(tenant)/`.

## Screen module shape

Every screen directory is colocated under its route segment — hooks, types,
and screen-only components live beside the `page.tsx` that renders them, not
in a separate domain-logic tree. A build agent should never have to invent a
layout.

```text
app/(tenant)/crm/leads/
  page.tsx                 the screen: composition, markup, classNames — or,
                            for a screen too large for one file (~300 lines),
                            a thin wrapper rendering components/<screen>-
                            workspace.tsx instead. Both shapes are correct;
                            which one depends on the screen's size, not the
                            module's identity.
  hooks/
    useLeads.ts             state, effects, handlers, capabilities, request
                             functions, and runtime response validation —
                             together in one file per concern, not split
                             into separate api.ts/schema.ts/types.ts modules.
    useLeads.test.ts        tests beside subject.
  components/
    CreateLeadsModal.tsx    pieces used ONLY by this screen.
    DeleteLeadsConfirmModal.tsx
```

A larger screen (opportunities, customer-profiles) has more than one
`hooks/use*.ts` file — one per distinct data source/concern — and a
`components/<screen>-workspace.tsx` composition file that `page.tsx` renders,
once the screen no longer fits in one file. The shape does not change; only
how many files it takes.

Rules:

- **A `hooks/use*.ts` file owns everything for its concern**: request
  functions (import `axiosClient`, never call `fetch` directly), runtime
  response validation, view-model types, and the React state/effects/handlers
  a component consumes. Splitting these into separate `api.ts`/`schema.ts`
  files was specified once and never followed by a single shipped screen —
  see [Q13](../build/OPEN-QUESTIONS.md#q13--features-layer-specified-but-not-followed--resolved-2026-08-28).
- **The hook is the only place state lives.** Components receive props.
- **Components hold markup and classNames.** State, effects, handlers and API
  calls belong in the hook. This is the existing house rule and it stays.
- A `components/` file used by a second screen moves to `design-system/` —
  there is no intermediate "shared between two screens" tier.
- A screen may import one narrow, named type/enum from a sibling screen that
  owns the same backend resource (see Dependency direction above) — never a
  hook, a component, or a whole module.

## Route files

`page.tsx` **is** the screen for anything that fits in ~300 lines — most of
them. It may hold API clients (via hooks), permission logic, DTO validation,
and stateful composition; there is no separate "feature entry point" it
delegates to.

```tsx
// app/(tenant)/crm/lead-stages/page.tsx — this is most of the file
import { useLeadStages } from "./hooks/useLeadStages";

export default function LeadStagesPage() {
  const { items, isLoading, ... } = useLeadStages();
  return ( /* PageHeader, DataTable, modals */ );
}
```

Only once a screen's composition genuinely outgrows one file does `page.tsx`
become a thin wrapper:

```tsx
// app/(tenant)/crm/opportunities/page.tsx — this is the whole file
import { OpportunitiesWorkspace } from "./components/opportunities-workspace";

export default function OpportunitiesPage() {
  return <OpportunitiesWorkspace />;
}
```

Both are correct. Reach for the thin form when the composition itself (not
just the hooks) would push `page.tsx` past the ~300-line split threshold —
not by default, and not to mimic a "route files are always thin" rule this
codebase does not follow.

## Where a new thing goes

| You are adding | It goes in |
| --- | --- |
| A new screen | `app/(tenant)/<module>/<segment>/{page.tsx,hooks/,components/}` |
| A reusable button/input/dialog | `design-system/primitives/` |
| A reusable table/drawer/header | `design-system/patterns/` |
| Something two screens share | `design-system/` — components, patterns, or `lib/format/`, whichever fits |
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
- **Files holding logic or markup stay under ~300 lines.** Past that, split by
  responsibility — a 1,000-line hook is three hooks. Three narrow exemptions
  below.

### The ~300-line rule and its three exemptions

Sixteen files in `src/` exceed 300 lines today. Planning around a rule the
codebase already breaks is how a rule stops meaning anything, so each of those
files is either **exempt for a stated reason** or **has a scheduled split** —
MASTER-PLAN task 3.39.

**Exempt, because the rule's purpose does not apply:**

| Category | Files | Why |
| --- | --- | --- |
| **Dictionaries** | `src/i18n/dictionaries/ar.ts`, `en.ts` | Flat key–value data, one key per line, no control flow. The rule exists so a reader can hold a file's *behaviour* in their head; these have none. Splitting by namespace would also break the `Dictionary` type's single-source shape, which is what makes a missing Arabic key a compile error |
| **The Tier-1 spine** | `src/lib/api/axiosClient.ts`, `src/lib/notifications/tenant-notification-runtime.ts`, `src/context/AuthContext.tsx`, `src/context/TenantRealtimeProvider.tsx` | [HANDOFF.md](../build/HANDOFF.md#tier-1--the-spine-do-not-touch) freezes these. A split is a rewrite of exactly the code the freeze protects, and it buys nothing a reader needs |
| **The navigation map** | `src/design-system/shell/nav-config.ts` | ~930 lines of object literals — one per nav item, in the order the nav renders them — and the only logic is each item's one-line `hasAccess` predicate, carried verbatim from `lib/navigation/tenant-routes.ts`. Same standing as the dictionaries: length tracks the number of screens, not behaviour, and splitting it would hide the one property `nav-config.test.ts` exists to assert — that every section belongs to exactly one app. It was already past 300 lines before the two-bar shell added `menuLabelKey`; this row records what was previously unstated |
| **Exhaustive response contracts** | `core/contracts/user-contract.ts`, `role-contract.ts`, `organization-contract.ts` | One validator per DTO field, in declaration order. Length tracks the DTO's field count, not complexity; splitting one contract across files makes it *harder* to check against the source DTO |

**Scheduled splits — genuinely oversized logic:**

| File | Lines | Split into |
| --- | ---: | --- |
| `crm/opportunities/hooks/usePipelineWorkspace.ts` | ~1,080 | Response parsing/validation · board projection and stage-move mutation · the workspace state machine. It is three hooks wearing one name |
| `crm/leads/hooks/useLeads.ts` | ~730 | Lead + capabilities parsing · list/filter state · the create/update/delete mutations |
| `crm/customer-profiles/hooks/useCustomerProfiles.ts` | ~440 | Parsing out of the hook, as above |
| `crm/opportunities/components/opportunities-workspace.tsx` | ~330 | Column definitions out of the component, the way the other list screens already do it |
| ~~`crm/custom-fields/hooks/useCrmCustomFields.ts`~~ | — | **Done in Phase 8 (8.19).** Parsing and constants moved to `crm/custom-fields/custom-field-contract.ts`, matching the `<entity>-contract.ts` shape the other catalogue screens use; the hook keeps state and mutations |
| ~~`crm/lead-stages/hooks/useLeadStages.ts`~~ | — | **Done in Phase 8 (8.17).** The four mutations moved to `hooks/useLeadStageMutations.ts`; the hook keeps list, filter and dialog state |
| `core/organization/components/OrganizationLevelWorkspace.tsx` | ~310 | Marginal. Split when next edited, not as its own task |

These are scheduled **with the phase that next touches the file** — Phase 8 for
the CRM hooks, Phase 4 for the organization workspace — not as a standalone
refactor pass. Splitting a working hook nobody is changing is churn with a
regression risk and no reader.

The two hard numbers stay: a **new** file over ~300 lines is a review failure,
and nothing joins the exempt table without a row explaining why.

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
