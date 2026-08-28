# Duplication Discovery Report — Admin Portal Frontend

Status: **[Discovery only — no fixes applied]**

Last source verification: **2026-08-27**

Owner: **Admin Portal**

- Repo: `C:\mutakamel.ai\frontend\admin-portal`
- Branch: `feat/design-system`
- Scope: 16 feature directories under `src/features/admin/*` (applications, auth,
  backup, control-plane-audit, database-servers, invoices, logging,
  notifications, provisioning-fleet, provisioning-governance,
  provisioning-publisher-keys, provisioning-releases, reports,
  storage-servers, subscriptions, tenant-workspace), cross-referenced against
  `src/design-system/patterns/*` (15 dirs) and `src/design-system/primitives/*`
  (26 components). Route-level `src/app/**` files are read only to trace how a
  feature hook/type is actually consumed by its screen — they are not
  independently audited.
- Excluded: the 117 "unused exported types" already tracked by a prior knip
  pass (dead-code cleanup, separate task) — this report only lists types that
  are actively used *and* duplicated; `node_modules`, `.next`, test files,
  generated API docs.
- Baseline: `npx tsc --noEmit` → pass (0 errors) on `feat/design-system` at the
  time of this scan. No files were edited to produce this report.
- Methodology reference: `C:\mutakamel.ai\backend\mutakamel-apps\core-app\.code-simplifier\discover-report.md`
  (finding/severity/fix-plan format, adapted for frontend concerns —
  bilingual AR/RTL and dark/light rendering risk in place of the backend's
  security/contract risk).

## Summary

| Category | Findings | High | Medium | Low |
|---|---:|---:|---:|---:|
| Duplicate UI pattern (design-system under-adoption) | 5 | 1 | 3 | 1 |
| Duplicate hooks/logic | 2 | 0 | 1 | 1 |
| Duplicate types | 2 | 0 | 1 | 1 |
| Duplicate API-client pattern | 1 | 0 | 1 | 0 |
| **Total** | **10** | **1** | **6** | **3** |

Behavior-risk breakdown: **none** — 3 findings (F-FE-001, F-FE-007, F-FE-009
partially); **low** — 2 findings; **needs-approval** — 5 findings (anything
touching rendered markup, badge tone/color, or dialog copy).

## Findings

### F-FE-001: One screen shell reaches past the `@/design-system` barrel
- Category: duplicate UI pattern / import hygiene
- Severity: low
- Location: `src/app/(shell)/layout.tsx:2`
- Evidence: `import { AppShell } from "@/design-system/shell/AppShell";` — a
  deep import into `design-system/shell/AppShell` instead of
  `import { AppShell } from "@/design-system"`. `AppShell` is already
  re-exported at `src/design-system/index.ts:65`. A repo-wide grep for
  `from ["']@/design-system/(primitives|patterns|shell|feedback|lib)` across
  `src/app` and `src/features` returned exactly this one hit — every other
  call site in scope already imports correctly through the barrel, including
  all 16 feature directories audited (`grep -rn "from [\"']@/design-system/"
  src/app src/features` → 1 result).
- Confidence: high — single unambiguous match, barrel export confirmed at
  `src/design-system/index.ts:65`.
- Impact: cosmetic today (it still resolves to the same module), but it is
  exactly the pattern AGENTS.md's "Design system imports" rule (line 78-82)
  exists to prevent — it defeats the indirection that lets `AppShell` move or
  be renamed later without a call-site edit, and it is the one place a future
  contributor will copy from if they don't already know the rule.
- Recommendation: change the import to `import { AppShell } from "@/design-system";`.
- Behavior risk: **none** — same module, same export, no markup/prop change.

### F-FE-002: Three features hand-roll the same debounced-search timer, and it double-fires under `FilterBar`
- Category: duplicate hooks/logic (compounds into a real UX bug)
- Severity: **high**
- Location:
  - `src/features/admin/applications/hooks/useApplications.ts:30` (state),
    `:46-53` (300 ms `setTimeout` debounce block)
  - `src/features/admin/database-servers/hooks/useDatabaseServers.ts:35`
    (state), `:71-77` (500 ms `setTimeout` debounce block)
  - `src/features/admin/storage-servers/hooks/useStorageServers.ts:29`
    (state), `:41-47` (350 ms `window.setTimeout` debounce block)
  - Consuming screens that *also* wire the design-system `FilterBar` on top:
    `src/app/(shell)/applications-catalogue/page.tsx:232` (`<FilterBar>`
    around line 232, feeding `useApplications`'s `setSearch`),
    `src/app/(shell)/database-servers/page.tsx` (`<FilterBar>` wired to
    `useDatabaseServers`'s `setSearch`), and
    `src/features/admin/storage-servers/screens/StorageServersScreen.tsx:148`
    (`<FilterBar>` wired to `useStorageServers`'s `setSearch`).
  - The pattern the three hooks reimplement already exists at
    `src/design-system/patterns/filter-bar/useFilterBar.ts:20-63`, which
    debounces the search field internally at 300 ms (line 58-60) before ever
    calling the caller's `onChange`.
- Evidence: each hook keeps its own `search`/`debouncedSearch` state pair and
  a `useEffect` + `setTimeout` that copies `search` into `debouncedSearch`
  after a hook-specific delay, then resets `page` to 1. Every one of the three
  consuming screens passes that hook's `setSearch` as the `onChange` handler
  for `FilterBar`'s `search` field — but `FilterBar` (via `useFilterBar`) has
  *already* debounced the keystroke by 300 ms before calling `onChange`. The
  result is two independent timers stacked in series per keystroke: ~600 ms
  (applications), ~650 ms (database-servers), ~650 ms (storage-servers)
  before a search actually fires, plus two live timers, two cancel paths, and
  two mental models to keep in sync per screen.
- Confidence: high — both ends of the double-debounce were read directly
  (`useFilterBar.ts` internals and each hook's own timer), and the
  `<FilterBar ... onChange={...setSearch}>` wiring was confirmed in all three
  consuming files.
- Impact: user-visible search latency is roughly double what any single
  layer intends, for no correctness benefit; three near-identical
  implementations must each be remembered and kept in sync if the intended
  debounce window ever changes; new list screens copying "how storage-servers
  did it" will keep reproducing the double timer instead of using
  `FilterBar`'s built-in one.
- Recommendation: pick one layer to own debouncing — the design-system
  `FilterBar`/`useFilterBar` is the natural owner since it is already shared
  across the three consuming screens. Have `useApplications`,
  `useDatabaseServers`, and `useStorageServers` accept the *already-debounced*
  search value from their screen (drop `search`/`debouncedSearch` and the
  `setTimeout` block; `setSearch` becomes a direct passthrough that also
  resets `page`). This removes ~24 lines of duplicated timer logic across the
  three hooks with no behavior change to the final debounce delay other than
  making all three consistently 300 ms.
- Behavior risk: **needs-approval** — collapsing to one 300 ms delay changes
  the search-to-results latency users currently experience (from
  300/500/350 ms *effective-but-stacked* to a single, faster 300 ms window);
  worth a quick manual check on all three screens in both languages since
  RTL search fields sit at the opposite edge and any layout assumption tied
  to the old timing should be re-verified, though none was found in this scan.

### F-FE-003: Three provisioning features each hand-build a destructive-confirmation dialog instead of `ConfirmActionModal`
- Category: duplicate UI pattern
- Severity: medium
- Location:
  - `src/features/admin/provisioning-fleet/shared.tsx:282-328`
    (`FleetConfirmDialog`)
  - `src/features/admin/provisioning-governance/ProvisioningGovernanceScreen.tsx:869-900`
    (inline `<AlertDialog>` block gated on `confirming`)
  - `src/features/admin/provisioning-publisher-keys/PublisherKeysScreen.tsx:586-652`
    (`ConfirmationDialog`)
  - The shared equivalent already exists at
    `src/design-system/patterns/confirm-action/ConfirmActionModal.tsx:62-198`,
    including the "type the exact value to confirm" flow
    (`requiredConfirmationText`, lines 73/88-89/119-140) that both the
    governance screen (a literal `"RUN"` token field, `:875-884`) and the
    publisher-keys screen re-derive by hand.
- Evidence: all three components independently import the raw `AlertDialog*`
  primitives (all three files list `AlertDialog, AlertDialogAction,
  AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle` in their import block) and reproduce the same shape:
  title, body/description, an optional embedded code/value block, a Cancel
  button, and a destructive Confirm button that shows a spinner while
  pending. `ConfirmActionModal` already covers this exact shape plus
  bilingual title/description props, an icon, a close (X) button, and the
  typed-confirmation flow — none of the three call sites use it.
- Confidence: high — full text of `ConfirmActionModal.tsx` and all three
  call sites was read; the shape overlap (and the governance/publisher-keys
  duplication of the "type to confirm" feature specifically) is exact, not
  inferred.
- Impact: three parallel places to keep visually and behaviorally consistent
  (focus trap, Radix a11y wiring, RTL icon/button order, dark-mode colors);
  `ConfirmActionModal` already solves this once and is the barrel-exported,
  documented pattern (`docs/components/confirm-action-modal.md` per its
  header comment) other converted screens use.
- Recommendation: replace `FleetConfirmDialog`, the governance inline block,
  and `ConfirmationDialog` with `ConfirmActionModal`, using
  `requiredConfirmationText` for the governance "RUN" token and the
  publisher-keys register/revoke confirmation instead of their own input
  state machines.
- Behavior risk: **needs-approval** — `ConfirmActionModal` renders a
  different visual chrome (icon badge, close button, footer layout) than the
  three hand-built dialogs; this changes visible markup on three screens and
  should go through the same canary-screenshot check the migration used for
  earlier phases (`docs/design-system/migration.md`'s Phase 0 safety net).

### F-FE-004: Two features reimplement `StatusBadge`'s tone lookup locally — and neither one localizes to Arabic
- Category: duplicate UI pattern
- Severity: **high**
- Location:
  - `src/features/admin/invoices/components/invoice-shared.tsx:347-361`
    (`InvoiceStatusBadge`)
  - `src/features/admin/backup/components/BackupStatusBadge.tsx:7-32`
    (`BackupStatusBadge`, tone sets at lines 7-10)
  - The shared pattern already exists at
    `src/design-system/patterns/status-badge/StatusBadge.tsx:19-44`, backed by
    `src/design-system/patterns/status-badge/tone-map.ts`'s `STATUS_ENTRIES`
    table (from line 54), which already contains `PAID` (line 56, tone
    `success`), `RUNNING` (line 63, tone `progress`), `PARTIALLY_PAID`
    (line 65, tone `progress`), `FAILED` (line 87, tone `danger`),
    `COMPLETED` (line 94, tone `success`), and `VOID` (line 102, tone
    `neutral`) — the exact statuses both local components branch on.
- Evidence: `InvoiceStatusBadge` hand-derives a `"brand" | "neutral" | "warn"
  | "danger"` tone from `status` with a ternary chain and renders the raw
  English enum string (`{status}`) regardless of `lang` — there is no Arabic
  label path at all. `BackupStatusBadge` does the same with four `Set`s
  (`positiveStatuses`, `activeStatuses`, `negativeStatuses`,
  `warningStatuses`) and renders `normalized.replaceAll("_", " ")` — again
  always in English. `StatusBadge`/`tone-map.ts` already solve both the tone
  lookup *and* the bilingual label (`labelEn`/`labelAr` per entry,
  `StatusBadge.tsx:28` picks the right one from `lang`) for the same status
  vocabulary, including the "in-progress gets motion, not a hue" treatment
  (`tone-map.ts` header comment, lines 1-7) that `BackupStatusBadge`
  re-derives by hand as a manually-added pulsing dot (line 28) instead of
  the shared `progress` tone's dashed border + pulse.
- Confidence: high — read both local components in full and the shared
  tone-map's exact `STATUS_ENTRIES` for the overlapping statuses side by
  side.
- Impact: this is not just duplicated code — it is a bilingual-support gap
  (AGENTS.md's "Bilingual and Theme Support" rule, and this app's stated
  strict AR/RTL requirement) on two screens that render raw English status
  enums (`"PAID"`, `"COMPLETED_WITH_ERRORS"`) to Arabic-language users, while
  every other converted screen using `StatusBadge` already gets the Arabic
  label for free. It also means a future addition to `tone-map.ts` (a new
  status value) has to be separately taught to these two local components or
  they silently fall through to a default tone.
- Recommendation: replace `InvoiceStatusBadge` and `BackupStatusBadge` with
  direct `StatusBadge` usage (`<StatusBadge status={status} />`), adding any
  missing enum values (e.g. backup's `VERIFIED`, `PROMOTED`, `READY`,
  `ROTATING`, `BLOCKED`, `DEFERRED`, `DUE` if not already in `tone-map.ts` —
  confirm before removing) to `STATUS_ENTRIES` rather than keeping a second
  table.
- Behavior risk: **needs-approval** — this changes visible copy (adds Arabic
  labels where there were none, may change casing/spacing of the English
  label too since `StatusBadge` uses `tone.labelEn` rather than the raw enum
  string) and badge color for any status whose local tone differs from
  `tone-map.ts`'s (spot-checked: `COMPLETED` is `success`/green in
  `tone-map.ts` but resolves to the `positiveStatuses` branch → `"brand"` in
  `BackupStatusBadge`, which may already render the same color family, but
  this should be confirmed pixel-for-pixel before merging, not assumed).

### F-FE-005: A tenant-billing panel hand-rolls its own loading/empty/forbidden/error branches instead of the shared state patterns
- Category: duplicate UI pattern
- Severity: low
- Location: `src/features/admin/tenant-workspace/billing/components/TenantBillingPanel.tsx:720-749`
  (ledger section: loading at `:722-725`, error at `:726-728`, forbidden at
  `:729-731`, empty at `:732-734`, ready/`DataTable` at `:735-749`) and the
  parallel payments section further down the same file (`noPayments` copy at
  `:882`, `:1505`, `:1629`).
- Evidence: four sibling `{condition ? <p>...</p> : null}` branches render
  plain paragraphs for loading/forbidden/empty text instead of using the
  barrel's `EmptyState`/`ErrorState` patterns (already imported and used
  elsewhere in this same feature area, e.g.
  `src/features/admin/tenant-workspace/storage/components/tenant-storage-migration-panel.tsx`
  uses `ErrorState`).
- Confidence: medium — the state machine (`ledgerState` five-way branch) is a
  reasonable design choice for a panel with more granularity than
  `DataTable`'s single `emptyState` prop covers, so this is weaker evidence
  of "duplication" than F-FE-003/F-FE-004 and more a case of under-using the
  available `EmptyState`/`ErrorState` primitives for the empty/forbidden
  branches specifically.
- Impact: minor visual/copy drift risk (no icon, no consistent spacing
  against `EmptyState`'s look) and a missed opportunity to centralize the
  "forbidden" treatment, which AGENTS.md calls out explicitly ("`403` is not
  an empty state" — this panel currently renders both forbidden and empty as
  the same plain `<p>` shape, which under-differentiates them visually).
- Recommendation: swap the empty (`:732-734`) and forbidden (`:729-731`)
  branches for `EmptyState`/`PermissionGate`-style treatments; leave the
  loading/error branches as-is if a skeleton/`ErrorState` swap is out of
  scope for this pass.
- Behavior risk: **needs-approval** — changes rendered markup for four
  states across two sections of one screen.

### F-FE-006: `PaginationMeta` is redefined byte-for-byte in three feature `types.ts` files instead of imported
- Category: duplicate types
- Severity: medium
- Location:
  - `src/features/admin/provisioning-governance/types.ts:35-42` (exported
    `PaginationMeta`)
  - `src/features/admin/tenant-workspace/billing/types.ts:11-18`
    (module-local `PaginationMeta`)
  - `src/features/admin/tenant-workspace/provisioning/types.ts:158-165`
    (exported `PaginationMeta`)
  - Canonical shared type: `src/shared/api/core-envelope.ts:1-8`, already
    re-exported at `src/types/common.ts:1`
    (`export type { SuccessResponse, PaginationMeta } from "../shared/api/core-envelope";`).
- Evidence: all three local interfaces are field-for-field identical to the
  shared one — `{ page: number; limit: number; total: number; totalPages:
  number; hasNext: boolean; hasPrev: boolean; }` — same field names, same
  types, same order.
- Confidence: high — all four declarations were read in full and compared
  character-by-character; they match exactly.
- Impact: three copies of the same contract with no compile-time link to the
  canonical one — a future change to the Core envelope's pagination shape
  (e.g. adding a `nextCursor` field) would need to be hunted down in three
  extra places that look unrelated to `src/shared/api`.
- Recommendation: delete all three local interfaces and
  `import type { PaginationMeta } from "@/types/common";` in each file.
- Behavior risk: **none** — the shapes are structurally identical, so this is
  a type-only, erased-at-runtime change with zero effect on rendered output;
  `tsc --noEmit` is sufficient to verify.

### F-FE-007: Eight more feature `types.ts` files inline the same pagination fields into a list-page wrapper type
- Category: duplicate types
- Severity: low
- Location (each defines an `{ items: T[]; ...same six pagination fields }`
  shape under its own name):
  - `src/features/admin/applications/types/index.ts:433-439`
    (`CatalogueAuditPageView`; 4-field variant, no `hasNext`/`hasPrev`)
  - `src/features/admin/control-plane-audit/types/control-plane-audit.ts:61-69`
    (`ControlPlaneAuditPage`)
  - `src/features/admin/invoices/types/invoices.ts:75-83` (`InvoicePage`)
  - `src/features/admin/provisioning-fleet/types.ts:173-183` (`FleetPage<T>`,
    plus non-pagination `correlationId`/`timestamp` fields)
  - `src/features/admin/reports/types/reports.ts:65-73` (`TenantReportPage`)
  - `src/features/admin/storage-servers/types.ts:98-104` (`StorageServerList`;
    4-field variant, no `hasNext`/`hasPrev`)
  - `src/features/admin/subscriptions/types.ts:80-90` (`SubscriptionPage`,
    plus `correlationId`/`timestamp`)
  - `src/features/admin/tenant-workspace/access/types.ts:96-104`
    (`PageResult<T>`)
- Evidence: each interface embeds the same `total`/`page`/`limit`/
  `totalPages` (plus `hasNext`/`hasPrev` in six of the eight) fields directly
  alongside an `items` array, rather than composing `{ items: T[]; meta:
  PaginationMeta }` — which is exactly the shape two *other* features already
  use correctly (`tenant-workspace/billing/types.ts:20-23`'s `PageView<T>`
  and `tenant-workspace/provisioning/types.ts:167-170`'s `ProvisioningPage<T>`
  both do `{ items: T[]; meta: PaginationMeta }`, even though their own local
  `PaginationMeta` is itself the F-FE-006 duplicate).
- Confidence: high for the field-shape overlap; medium for "this should be
  one generic type" since 2 of the 8 (`CatalogueAuditPageView`,
  `StorageServerList`) are the shorter 4-field variant and `FleetPage`/
  `SubscriptionPage` carry two extra non-pagination fields, so a single
  generic wouldn't fit all eight without a variant or an intersection type.
- Impact: lower than F-FE-006 since no single import fixes all eight, but the
  repeated inlining is exactly the kind of copy-paste the task description's
  example (`PaginationMeta`/`SortDirection` redefined instead of shared) is
  pointing at, and it is the reason F-FE-006's three exact duplicates exist
  in the first place — once local `types.ts` authors reach for "copy the
  shape from the file next door" instead of `@/types/common`, both problems
  compound.
- Recommendation: introduce one generic `PageResult<T> = { items: T[] } &
  PaginationMeta` in `src/types/common.ts` (name TBD — `tenant-workspace/
  access/types.ts:96` already calls its local version exactly this) and
  migrate the six 6-field variants onto it; leave the two 4-field variants
  and the two extra-field variants as local extensions/intersections rather
  than forcing every caller into one shape.
- Behavior risk: **none** for the type consolidation itself (erased at
  runtime); only relevant if a follow-up also renames the wrapper types
  themselves, which would be a larger, separate refactor.

### F-FE-008: `SortDirection` is redefined identically in three feature `types.ts` files
- Category: duplicate types
- Severity: low
- Location:
  - `src/features/admin/invoices/types/invoices.ts:33`
    (`type SortDirection = "ASC" | "DESC";`)
  - `src/features/admin/subscriptions/types.ts:20` (same)
  - `src/features/admin/tenant-workspace/access/types.ts:21` (same)
  - No canonical `SortDirection` currently exists in `src/types/common.ts`.
- Evidence: identical two-value union type, module-local (not exported) in
  all three files, each used to type a local `sortDir` field a few lines
  later (e.g. `invoices.ts:96,166`; `subscriptions/types.ts:98,105`;
  `tenant-workspace/access/types.ts:118`). These are legitimately in-use
  (not part of the separate 117-unused-exported-types knip backlog) since
  they are module-local, not exported.
- Confidence: high — trivial two-value union, exact match confirmed in all
  three files.
- Impact: negligible on its own (a 2-value string union is cheap to
  duplicate), but it is the literal example the task brief calls out, and
  several *other* feature `types.ts` files (`applications/types/index.ts:235`,
  `database-servers/types/index.ts:268`, `storage-servers/types.ts:112`,
  `provisioning-governance/types.ts:97,108`,
  `tenant-workspace/provisioning/types.ts:514,522,534,545,557`) inline the
  same `"ASC" | "DESC"` literal without even naming it, so a shared type
  would remove the literal from eleven call sites total, not just three.
- Recommendation: add `export type SortDirection = "ASC" | "DESC";` to
  `src/types/common.ts` and have the three named local aliases import it;
  optionally point the eleven inline-literal sites at it too in a later pass.
- Behavior risk: **none** — type-only, erased at runtime.

### F-FE-009: Three different idioms unwrap the same Core success envelope
- Category: duplicate API-client pattern
- Severity: medium
- Location:
  - Idiom A — shared helpers: `src/shared/api/core-envelope.ts:18-24`
    (`extractCoreData`, `extractCoreMeta`), consumed by
    `src/features/admin/applications/api/applications.api.ts` (13 call
    sites, e.g. lines 65-66, 72, 77, 84, 97…), and also by
    `src/features/admin/backup/api/backup-database-access.api.ts`,
    `src/features/admin/database-servers/api/database-servers.api.ts`, and
    `src/features/admin/tenant-workspace/core/api/tenant-core.api.ts`.
  - Idiom B — a second shared helper with slightly different semantics:
    `src/lib/api/axiosClient.ts:306-309` (`unwrapCoreData`, works on
    `unknown` payload and checks `"data" in root` rather than assuming the
    envelope shape), consumed only by
    `src/features/admin/notifications/api.ts` (7 call sites: lines 43, 53,
    63, 73, 84, 95, 114, e.g. `unwrapCoreData(response.data)`).
  - Idiom C — manual inline unwrap, no helper at all: 29 occurrences of
    `response.data.data` / `outer.data.data` across
    `src/features/admin/storage-servers/api/storage-servers.api.ts` (9 call
    sites, e.g. lines 35, 43, 52, 65, 74…),
    `src/features/admin/tenant-workspace/provisioning/api/tenant-provisioning.api.ts`
    (13 call sites, e.g. lines 74, 90, 104, 122, 135…),
    `src/features/admin/tenant-workspace/storage/api.ts` (lines 39, 46), and
    `src/features/admin/provisioning-fleet/contracts.ts:790`.
- Evidence: three functionally-equivalent ways to pull the inner `data` field
  out of `{ success, data, meta?, correlationId, timestamp }` coexist in the
  same codebase, none universally adopted; a fourth-ish variant
  (`readProvisioningPage(response.data.data, response.data.meta, ...)` in
  `tenant-provisioning.api.ts`) additionally hand-threads `meta` alongside
  the manual unwrap rather than using `extractCoreMeta`.
- Confidence: high — exact call counts obtained via `grep -c` per file; all
  three helper definitions were read in full.
- Impact: AGENTS.md's "Shared HTTP Behavior" rule asks for one consistent
  path so that `correlationId` and error/meta handling aren't silently
  dropped by a one-off inline unwrap; today a reviewer has to check three
  different idioms to confirm a given `api.ts` file isn't quietly discarding
  `correlationId` or `meta` on some endpoints (`tenant-provisioning.api.ts`'s
  several endpoints that call `read*(response.data.data)` with no second
  argument do appear to drop `meta`/`correlationId` for those specific
  responses — worth a follow-up check on whether that's intentional per
  endpoint).
- Recommendation: standardize new and touched `api.ts` files on
  `extractCoreData`/`extractCoreMeta` (Idiom A, already the most-adopted of
  the three) and fold `unwrapCoreData`'s "look, don't assume" defensiveness
  into `extractCoreData` if that behavior is actually needed, rather than
  keeping it as a second named export from a different module
  (`axiosClient.ts` vs `core-envelope.ts`).
- Behavior risk: **low** — purely internal call-site refactor with identical
  output *if* verified endpoint-by-endpoint that the manual-unwrap sites
  weren't quietly dropping `meta`/`correlationId`; do not batch this across
  all four files in one change without that per-endpoint check.

### F-FE-010: Two tenant-workspace hooks each reimplement "poll while status is pending"
- Category: duplicate hooks/logic
- Severity: medium
- Location:
  - `src/features/admin/tenant-workspace/core/hooks/useTenantCoreWorkspace.ts:40-41`
    (`DEFAULT_POLL_INTERVAL_MS = 3_000`, `DEFAULT_MAX_PROVISIONING_POLLS = 40`),
    `:84-85` (`pollAttempts`/`pollExhausted` state), `:201-242` (recursive
    `window.setTimeout` poll loop with an attempts counter and an exhaustion
    flag, gated on `currentTenant?.status === "PROVISIONING"`)
  - `src/features/admin/tenant-workspace/provisioning/hooks/useTenantProvisioning.ts:105`
    (`pollIntervalMs` default `3_000`), `:142` (`pollInFlight` ref guard),
    `:353-369` (`polling` derived from whether any operation/prerequisite is
    non-terminal), `:371-395` (`window.setInterval` poll loop with an
    in-flight guard covering parallel `loadOperations`/`loadSelectedOperation`/
    `loadPrerequisites` calls)
- Evidence: both hooks live in the same feature (`tenant-workspace`, different
  subdirectories) and solve the same problem — "keep refetching on an
  interval while some tracked status is still pending, stop when it
  resolves" — with the same default interval (3000 ms) but two different
  mechanics: one is a self-rescheduling `setTimeout` chain with a hard
  attempt cap and an `pollExhausted` flag the caller can render around; the
  other is a `setInterval` with an in-flight boolean ref so overlapping
  fetches don't stack, no attempt cap.
- Confidence: medium — the intent overlap (poll-while-pending, same default
  interval, same feature area) is clear and directly read from source; the
  mechanics differ enough (attempt-capped recursive timeout vs.
  uncapped interval + in-flight guard) that a literal shared implementation
  isn't a drop-in — this is "two people solved the same problem differently
  in the same feature," not "one was copy-pasted from the other."
- Impact: two subtly different reconnection/backoff behaviors for what a
  user experiences as the same kind of "waiting for the backend to finish
  something" screen state; a bug fix to one (e.g. adding jitter, or an
  attempt cap to the `setInterval` version, which currently has none) won't
  propagate to the other without someone remembering both exist.
- Recommendation: extract a small shared `usePollWhile(predicate, task,
  { intervalMs, maxAttempts? })` hook (candidate location:
  `src/features/admin/tenant-workspace/` shared utils, or promote to a
  cross-feature location like `src/hooks/` if a third consumer shows up)
  that supports both the attempt-capped and uncapped modes via the optional
  `maxAttempts`, and have both hooks call into it.
- Behavior risk: **low** — polling timing/backoff is easy to get subtly
  wrong when consolidating (attempt counting, in-flight de-duplication,
  cleanup-on-unmount); needs a focused test pass on both hooks' existing
  tests (`useTenantCoreWorkspace.test.tsx`, `useTenantProvisioning.test.tsx`
  both already exist per the feature's test files) before and after, not a
  markup/copy change so it does not need the bilingual/RTL canary check.

### F-FE-011 (minor / low-confidence): Two single-field search inputs built by hand instead of a single-field `FilterBar`
- Category: duplicate UI pattern
- Severity: low
- Location:
  - `src/features/admin/database-servers/components/tabs/DatabaseServerApplicationBindingsTab.tsx:170-174`
    (`<Input placeholder={d.searchPlaceholder} ...>`)
  - `src/features/admin/tenant-workspace/access/components/tenant-access-panel.tsx:210-214`
    (`<Input type="search" placeholder={copy.search} ...>`)
- Evidence: both render a bare `<Input>` wired to local `search` state with
  no debounce, rather than the barrel's `FilterBar` (even a `FilterBar` with
  a single `search`-type field).
- Confidence: low — a single, undebounced search box over an
  already-in-memory list (both of these filter client-side data already
  loaded onto the page, not a paginated server query) is plausibly the
  *correct*, simpler choice, not a gap. Flagging for awareness, not
  recommending action without confirming neither list is large enough to
  need the debounce/URL-sync behavior `FilterBar` provides.
- Impact: minor, if any.
- Recommendation: no action unless one of these lists grows into a
  server-paginated query, at which point it should adopt `FilterBar` from
  the start rather than growing its own debounce (see F-FE-002).
- Behavior risk: **none** (no change recommended at this time).

## Cross-reference: what the design-system migration already tracks

- **`docs/design-system/census.baseline.json`**'s `handRolledTables` metric
  is currently `3`, matching the two files this scan independently found:
  `src/features/admin/logging/LoggingScreen.tsx:838` (a live-scrolling log
  table with a sticky header — a real case where `DataTable`'s pagination-
  oriented API may not fit) and
  `src/features/admin/tenant-workspace/provisioning/components/TenantProvisioningWorkspaceView.tsx:328,456`
  (two static step/component tables that look like plausible `DataTable`
  candidates). This is not a new finding — it is already gated by
  `scripts/design/census.mjs --check` — but it is called out here because it
  is duplication of the same `<table>` markup shape `DataTable` centralizes,
  and it was in scope for this scan's category 1. No line-item finding
  number assigned since it is already tracked; treat this as a pointer, not
  a new task.
- No other census-tracked metric (color families, font weight, `rounded-2xl`,
  RTL violations, navbar sites) surfaced anything new in the 16 feature
  directories scanned — `npx tsc --noEmit` also passed clean, so nothing
  above requires a type-level fix beyond what each finding states.
- The reach-in check in F-FE-001 is the only violation of AGENTS.md's
  "Design system imports" rule found anywhere in `src/app` or
  `src/features`; every one of the 16 feature directories' many `DataTable`/
  `Pagination`/`FilterBar`/`StatusBadge`/`ErrorState`/`DegradedBanner`/
  `AmbiguousOutcomePanel` call sites already import correctly through
  `@/design-system`.

## Fix Plan

Phases ordered lowest-risk first, matching this app's own migration
discipline (`docs/design-system/migration.md`'s verification gate: `npx tsc
--noEmit`, `pnpm build`, `pnpm lint`, `pnpm test`, `census.mjs --check`,
`rtl-guard.mjs`). Each task is independently verifiable and maps to one
finding.

### Phase 1: Type-only and import-only changes (risk: none)
- [ ] T-1.1 Fix the one barrel reach-in — `src/app/(shell)/layout.tsx:2` —
  finding: F-FE-001 — verify: `npx tsc --noEmit`, visual smoke check of the
  shell (no markup change expected)
- [ ] T-1.2 Delete the three duplicate `PaginationMeta` interfaces and import
  from `@/types/common` instead —
  `src/features/admin/provisioning-governance/types.ts:35-42`,
  `src/features/admin/tenant-workspace/billing/types.ts:11-18`,
  `src/features/admin/tenant-workspace/provisioning/types.ts:158-165` —
  finding: F-FE-006 — verify: `npx tsc --noEmit`
- [ ] T-1.3 Add `SortDirection` to `src/types/common.ts` and point the three
  named local aliases at it — `src/features/admin/invoices/types/invoices.ts:33`,
  `src/features/admin/subscriptions/types.ts:20`,
  `src/features/admin/tenant-workspace/access/types.ts:21` — finding:
  F-FE-008 — verify: `npx tsc --noEmit`

### Phase 2: Internal logic refactors with no rendered-output change (risk: none/low)
- [ ] T-2.1 Remove the hand-rolled debounce from `useApplications`,
  `useDatabaseServers`, `useStorageServers` and let their screens' `FilterBar`
  own debouncing — finding: F-FE-002 — verify: existing hook tests plus a
  manual timing check (typed search should resolve once, at ~300 ms, on all
  three screens, in both `en` and `ar`) — **approval needed for the visible
  latency change**, but the code change itself is internal
- [ ] T-2.2 Introduce a generic `PageResult<T>`/similar wrapper in
  `src/types/common.ts` and migrate the six 6-field wrapper types (leave the
  two 4-field and two extra-field variants alone) — finding: F-FE-007 —
  verify: `npx tsc --noEmit`
- [ ] T-2.3 Characterize each of the 29 manual `.data.data` call sites'
  `meta`/`correlationId` handling before consolidating onto
  `extractCoreData`/`extractCoreMeta` — finding: F-FE-009 — verify: per-file
  diff review confirming no endpoint silently drops `meta`/`correlationId`
  it previously threaded through
- [ ] T-2.4 Extract a shared `usePollWhile`-style hook from
  `useTenantCoreWorkspace.ts` and `useTenantProvisioning.ts`'s poll loops —
  finding: F-FE-010 — verify: both hooks' existing test suites
  (`useTenantCoreWorkspace.test.tsx`, `useTenantProvisioning.test.tsx`) stay
  green before and after

### Phase 3: Rendered-markup consolidation (risk: needs-approval)
- [ ] T-3.1 Replace `InvoiceStatusBadge` and `BackupStatusBadge` with
  `StatusBadge`, extending `tone-map.ts`'s `STATUS_ENTRIES` with any missing
  enum values first — finding: F-FE-004 — verify: canary screenshots of both
  screens in `en`/`ar` × light/dark (4 combinations minimum), confirm no
  tone/color regression for any status value in either feature's vocabulary
  — **APPROVAL REQUIRED**
- [ ] T-3.2 Replace `FleetConfirmDialog`, the inline governance confirm
  block, and `ConfirmationDialog` with `ConfirmActionModal` — finding:
  F-FE-003 — verify: canary screenshots of all three confirm flows in
  `en`/`ar` × light/dark, confirm the typed-confirmation flow (governance's
  `"RUN"` token, publisher-keys register/revoke) still gates the destructive
  action correctly — **APPROVAL REQUIRED**
- [ ] T-3.3 Swap `TenantBillingPanel`'s hand-rolled empty/forbidden
  paragraphs for `EmptyState`/a permission-aware treatment — finding:
  F-FE-005 — verify: canary screenshot of the ledger and payments sections
  in both empty and forbidden states — **APPROVAL REQUIRED**

## Notes on confidence and what was not pursued

- F-FE-002's double-debounce and F-FE-004's missing-Arabic-label finding are
  the two highest-confidence, highest-impact items in this report because
  both were verified end-to-end (hook timer → screen wiring for F-FE-002;
  local tone logic → shared tone-map's actual entries for F-FE-004) rather
  than inferred from a single grep hit.
- F-FE-010 and F-FE-011 are flagged at lower confidence deliberately — the
  brief asked to look for hook/logic duplication "shaped the same way," and
  both are genuine candidates, but neither is a copy-paste-identical
  implementation, so a consolidation there carries more design judgment than
  a mechanical extraction.
- Not pursued: a full census.mjs-style diff of raw-palette-color usage
  inside the 16 feature directories — that is Phase 20/21/25 territory
  already tracked in `docs/design-system/migration.md` and out of this
  report's duplication-specific scope.
- Not pursued: CSV/export-helper duplication (explicitly suggested as an
  example category in the task brief) — a repo-wide search for
  `csv|CSV|exportTo|downloadFile|Blob(` across all 16 feature directories
  returned zero matches, so this category has no findings to report, not an
  unexamined gap.
