# Code Simplification — Discovery Report

- Repo: C:\mutakamel.ai\frontend\tenant-portal
- Scope: `src/**`, `scripts/**`, `package.json`, `next.config.ts`, `tsconfig.json`, and read-only contract evidence under `docs/**` / Excluded: `node_modules/**`, `.next/**`, generated documentation, build/cache artifacts, `admin-portal`, `partner-portal`, `packages/**`, backend code, and all lockfile edits during discovery
- Date: 2026-08-24
- Baseline: `pnpm run typecheck` → pass; `pnpm run test` → pass (4 files, 35 tests); `pnpm run lint` → fail (80 errors, 231 warnings); `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → fail with 227 verified unused diagnostics (218 in `src`, 9 in `scripts`)

## Summary

| Category | Findings | High | Medium | Low |
|---|---|---|---|---|
| Dead / unused code | 3 | 0 | 1 | 2 |
| Duplication | 2 | 1 | 1 | 0 |
| Needless abstraction | 2 | 1 | 1 | 0 |
| Vulnerabilities (flagged only) | 3 | 3 | 0 | 0 |

## Findings

### F-001: Unreachable dashboard and organization source files
- Status: Partially fixed and runtime-contained — every listed source file except the already-dirty 34-line `tenant-api-client.ts` wrapper is deleted; the wrapper has zero imports and is absent from the production route graph.
- Category: dead-code
- Severity: medium
- Location: removed `src/features/crm/dashboards/api/dashboard-api.ts`; dependent dirty wrapper retained at `src/shared/api/tenant-api-client.ts:7`
- Evidence: A TypeScript import/export/dynamic-import graph over all 549 source TS/TSX files found zero inbound imports for the eight listed source files, excluding Next route entry points and tests. Repo-wide exact-symbol searches across `C:\mutakamel.ai` (excluding generated/vendor trees) found one match—the definition—for `CreateOrganizationModal`, `DeleteOrganizationConfirmModal`, `DashboardView`, `DashboardShareDialog`, `WidgetBuilderDialog`, `WidgetDeleteDialog`, `WidgetDuplicateDialog`, and `listDashboardNavigation`; no DI, registry, string-token, or dynamic-import reference was found. The eight unreachable files contain 2,131 nonblank lines. `tenantApiFetch` is referenced only by the unreachable dashboard API, so its 34-line wrapper becomes dead after that module is removed.
- Confidence: high — both graph reachability and repo-wide symbol/string searches agree; the private app has no external export surface.
- Impact: The unreachable alternate dashboard API and its non-canonical `/crm/*` paths are removed. The final 34-line wrapper deletion remains isolated behind a pre-existing concurrent transport/type edit.
- Recommendation: Delete the two organization modals, the five superseded dashboard components, and the dashboard API; then re-Grep and delete `tenant-api-client.ts` if it still has no consumer.
- Behavior risk: none — none of the files is reachable from a route, test, registry, or dynamic import.

### F-002: One-off AI repair scripts and a frozen compiler dump are tracked
- Status: Fixed — all five unreachable artifacts are removed.
- Category: dead-code
- Severity: low
- Location: `scripts/fix-scope-errors.ts:1`; `scripts/fix-tsc-errors.ts:1`; `scripts/fix-tsc.js:1`; `scripts/i18n-crm-codemod.ts:1`; `typecheck_errors.txt:1`
- Evidence: Repo-wide searches for every filename returned no caller, package script, CI entry, documentation command, import, or dynamic invocation. `package.json` exposes only runtime/build/lint/test/typecheck/docs scripts. The four scripts contain 357 nonblank lines and themselves account for 9 no-unused diagnostics; `typecheck_errors.txt` is a tracked 92 KB stale snapshot while the current normal typecheck passes.
- Confidence: high — the files are tracked but have zero execution entry points or references.
- Impact: Remove obsolete repair machinery and a second, stale representation of compiler state; stop linting tools that are not part of the product workflow.
- Recommendation: Delete all five artifacts and rely on reproducible `typecheck`, `lint`, and codemod commands that are actually declared in `package.json`.
- Behavior risk: none — no command or source path invokes them.

### F-003: Generated scaffolds left 227 unused declarations and commented-out code
- Status: Fixed for compiler-proven declarations — strict unused checks for the audited source scope are clean; later route containment is recorded under F-004.
- Category: dead-code
- Severity: low
- Location: representative examples `src/app/(tenant)/core/activities/page.tsx:9`; `src/app/(tenant)/crm/acquisition-sources/page.tsx:9-16`; `src/app/(tenant)/trade/inventory/page.tsx:9-16`; `src/components/layout/hooks/useWebRTCPhone.ts:3-111`; `src/features/crm/dashboards/data/mega-demo-dashboard.ts:2`; `scripts/i18n-crm-codemod.ts:1-61`
- Evidence: TypeScript with `noUnusedLocals` and `noUnusedParameters` reports 227 declarations: 218 in source and 9 in scripts. The ordinary strict typecheck passes only because unused checks are not enabled. A separate repo search found 16 identical commented-out `const { t } = useI18n();` statements in CRM route pages, alongside imports that remain live only as lint warnings. These are lexical declarations, not decorators, DI tokens, serialization names, or dynamic references.
- Confidence: high — compiler-backed unused analysis plus direct per-file verification; exported reachability is handled separately in F-001.
- Impact: Reduce noise in almost every generated route, make future lint failures actionable, and remove misleading half-completed localization remnants.
- Recommendation: Remove unused imports/locals and commented-out statements in small Core, CRM, Trade, and shared-component batches; enable unused checks only after the cleanup is green.
- Behavior risk: none — remove only compiler-proven unused declarations and comments.

### F-004: A mock CRUD/detail factory was copied across capability folders
- Status: Runtime-contained with dirty source residue — supported CRM cohorts use canonical server contracts, clean unsupported cohorts/detail trees were removed, and a server `proxy.ts` exact allowlist prevents all remaining unsupported module pages from rendering. Forty-five unsupported page entry points remain only because each carries pre-existing user changes that this task must preserve.
- Category: duplication
- Severity: high
- Location: `src/app/(tenant)/core/**`; `src/app/(tenant)/crm/**`; `src/app/(tenant)/trade/**`; representative flow `src/app/(tenant)/core/activities/hooks/useActivities.ts:16-63`, `src/app/(tenant)/core/activities/page.tsx:14-112`, and `src/app/(tenant)/core/activities/[id]/{layout,general,history,settings}/**`; contract status `docs/app/capability-map.md:7-77`
- Evidence: The original structural scan found the copied local `items/searchQuery/isCreateOpen/handleCreate/handleDelete` state machine, create/delete wrappers, `DetailTabsLayout`, local `toast.saved()` forms, hard-coded history, and inert settings across the route tree with no network calls. The fix removed the clean unsupported cohorts plus 154 detail-route files and 13 clean source/route entry points. For the dirty residue, `proxy.ts` matches `/core/**`, `/crm/**`, and `/trade/**` before Server rendering: exact supported paths proceed, unsupported GET/HEAD requests receive a sanitized 307 to `/unavailable?module=...`, and unsupported mutation methods receive 405 with `Allow` and `no-store`.
- Confidence: high — file counts and structural predicates were checked across the entire route tree; representative blocks differ primarily in names, literals, and columns.
- Impact: Nearly half the source tree presents speculative local state as business resources, creates multiple sources of truth beside backend contracts, and multiplies every future auth/error/loading fix across dozens of copies.
- Recommendation: Do not add a generic abstraction that preserves fake CRUD. Process one documented capability at a time: verify Gateway/controller/DTO contracts, replace the whole mock list/create/detail cohort with one server-backed feature boundary, or remove/disable the route when the capability is not release scope. Inline `ConfirmModal` only when a cohort will remain.
- Behavior risk: needs-approval — removing or replacing reachable mock routes changes visible behavior and must preserve intentional route compatibility.

### F-005: The tenant WebPhone stack is an inert 909-line call chain
- Status: Runtime-fixed with dirty source residue — the trigger, widget, popup, and fabricated API are removed. The already-dirty hook and workspace dependency remain unreferenced and unbundled pending ownership resolution.
- Category: needless-abstraction
- Severity: high
- Location: `src/components/layout/Navbar.tsx:8-9,114,132`; `src/components/layout/WebPhoneTrigger.tsx:6-27`; `src/components/layout/WebRTCPhoneWidget.tsx:95-100`; `src/components/layout/hooks/useWebRTCPhone.ts:65-111,274-286`; `src/components/layout/webphone/api.ts:8-54`; read-only shared predicate `../packages/webphone/src/config.ts:41-52`
- Evidence: `Navbar` renders `WebPhoneTrigger` without props, so the shared hook's optional `onToggle` is absent while its default connection indicator is always true. The 316-line tenant hook declares `settings` and `webphone`, but `setSettings` and `setWebphone` occur only at their declarations; four loader/log functions are imported but never called; no code assigns `uaRef` or the lifecycle implementation. Consequently `isWebphoneReady(undefined, undefined)` is always false and `WebRTCPhoneWidget` always returns `null`. TypeScript reports 28 unused declarations in this hook. Repo-wide searches show the remaining WebPhone component/API files are reachable only through this inert chain.
- Confidence: high — all state writers, loader calls, ref assignments, and consumers were searched repo-wide; readiness is provably false in current code.
- Impact: The inert toolbar control and unreachable widget/fabricated API are no longer shipped. The dirty hook and tenant-only dependency declarations still need a clean-owner follow-up before they can be removed safely.
- Recommendation: Decide whether WebPhone is in the tenant release scope. If not, remove the trigger, widget, hook, API module, dependent popup, and tenant dependencies. If it is required, treat restoration as a separately verified feature implementation rather than retaining this partial abstraction.
- Behavior risk: needs-approval — the trigger is visible and the product may intend telephony even though the current widget cannot render.

### F-006: Production builds deliberately bypass TypeScript validation
- Status: Fixed — the bypass is removed and the production build runs TypeScript.
- Category: needless-abstraction
- Severity: medium
- Location: `next.config.ts:7-9`
- Evidence: `typescript.ignoreBuildErrors` is set to `true` with a development-memory comment. The installed Next.js 16.2.11 guide states that the option completely skips production-build type checking and defaults to `false`. The explicit `pnpm run typecheck` baseline is green, so the bypass currently adds risk without unblocking the app.
- Confidence: high — configuration semantics were verified against the installed framework documentation and the current compiler baseline.
- Impact: Restore one trustworthy production gate and remove environment-specific policy from app code.
- Recommendation: Remove the override (or set it to `false`) and make `typecheck` a mandatory build/CI predecessor.
- Behavior risk: none — runtime output is unchanged; invalid future builds will fail as intended.

### F-007: npm and pnpm lockfiles define the same dependency graph twice
- Status: Fixed — pnpm is the sole dependency authority and the app-local npm lock is removed.
- Category: duplication
- Severity: medium
- Location: `package-lock.json:1`; `../pnpm-lock.yaml:1`; `../pnpm-workspace.yaml:1`
- Evidence: Both lockfiles are tracked. `package-lock.json` is npm lockfile v3 for `tenant-portal`, while the root pnpm lock has a `tenant-portal` workspace importer and all documented commands use pnpm. This is two mutable sources for exact dependency resolution; the repository already has dirty root-lock changes, so discovery intentionally did not edit either.
- Confidence: high — Git tracking, lockfile metadata, workspace importers, and README command examples were checked directly.
- Impact: Prevent npm/pnpm resolution drift and remove a 267 KB redundant lockfile.
- Recommendation: Confirm pnpm as the workspace package manager, remove the portal-local npm lock, declare the package-manager policy at the workspace root, and regenerate only the root pnpm lock with the approved toolchain.
- Behavior risk: low — install resolution can change if the two locks have already diverged; review the generated pnpm diff.

### F-008: Protected rendering has no server-side tenant-host admission
- Status: Fixed — host admission now runs at the root server boundary before client providers and fails closed.
- Category: vulnerability
- Severity: high
- Location: `src/app/layout.tsx:20-27`; `src/components/auth/TenantAuthGuard.tsx:8-25,53-54`; required contract `docs/ai/START_HERE.md:24-42` and `docs/app/application-architecture.md:16-31`
- Evidence: The root layout mounts client providers and a client-only auth guard. The guard admits `/login` solely by pathname and redirects other routes only after hydration. Repo-wide searches found no `middleware.ts`, `proxy.ts`, route handler, `headers()`/`cookies()` admission, host resolver, or tenant-host API call. The governing contract requires unknown/unverified hosts to fail before UI rendering and permits only exact pre-auth behavior for suspended tenants.
- Confidence: high — all framework admission entry points and host-resolution symbols were searched; none exists.
- Impact: Prevent tenant content/auth surfaces from being served before original-host verification and restore the documented tenant-isolation boundary.
- Recommendation: Implement database-backed original-host admission at a server boundary before providers/rendering, with explicit active/suspended/unknown/unavailable outcomes and tests; retain the client guard only for session UX.
- Behavior risk: needs-approval — security behavior and public-route availability change; verify Gateway/Core host contracts first.

### F-009: CRM reads and writes swallow failures and keep divergent mock state
- Status: Fixed for the released Leads/Pipeline surface — reads and mutations are canonical server-backed flows with explicit failure handling.
- Category: vulnerability
- Severity: high
- Location: `src/app/(tenant)/crm/leads/hooks/useLeads.ts:52-68,78-106,111-143`; `src/features/crm/pipeline/hooks/usePipelineWorkspace.ts:43-63,65-132,191-214`
- Evidence: Seven catch paths convert API failures into `console.warn` messages. Lead and pipeline reads replace unauthenticated, forbidden, not-found, or unavailable outcomes with mock records. Create/delete/stage/importance mutations update client state before the request and retain that state when the request fails; there is no rollback, error state, authoritative re-read, or distinction among `401`, `403`, `409`, and `503`. The behavior is directly observable in both hooks and contradicts the documented failure-state contract.
- Confidence: high — every catch and the preceding local state mutation was inspected; no outer boundary reverses or surfaces the failures.
- Impact: Stop presenting failed or unauthorized operations as successful and eliminate a second resource truth that can diverge from CRM.
- Recommendation: Remove production mock fallbacks, model explicit query/mutation states, apply optimistic changes only with rollback/concurrency evidence, and reconcile from the server response or re-read.
- Behavior risk: needs-approval — error and offline behavior changes; endpoint/DTO/status contracts must be verified first.

### F-010: CSV export permits spreadsheet formula injection
- Status: Fixed — formula/control-prefixed cells are neutralized by one tested serializer before quoting.
- Category: vulnerability
- Severity: high
- Location: `src/features/crm/dashboards/utils/export-utils.ts:3-29`; consumers `src/features/crm/dashboards/components/renderers/TableRenderer.tsx:39` and `src/features/crm/dashboards/components/dashboard-drilldown-panel.tsx:65`
- Evidence: Backend/dashboard values are stringified and CSV quotes are escaped, but cells beginning with spreadsheet formula markers (`=`, `+`, `-`, `@`, tabs, or carriage returns) are not neutralized before a downloadable CSV is created. Quoting alone does not prevent spreadsheet applications from evaluating formulas when the user opens the export.
- Confidence: high — both export call sites pass resource-derived records and the only transformation is quote escaping.
- Impact: Prevent attacker-controlled CRM/dashboard text from executing spreadsheet formulas or exfiltrating data when exported files are opened.
- Recommendation: Add a typed CSV cell serializer that neutralizes formula-leading values before RFC-compatible quoting, and test malicious prefixes plus commas/quotes/newlines.
- Behavior risk: needs-approval — exported cell text changes for dangerous prefixes; this is an intentional security correction.

## Fix Plan

Phases ordered lowest-risk first. Each task is tiny and independently verifiable:
one edit, one check. Map every task to its finding ID.

### Phase 1: Delete verified dead code (risk: none/low)
- [x] T-1.1 Delete the two unreachable organization modal files — `src/app/(tenant)/core/organization/components/` — finding: F-001 — verify: `rg -n "CreateOrganizationModal|DeleteOrganizationConfirmModal" C:\mutakamel.ai -g '!**/node_modules/**' -g '!**/.next/**' && pnpm run typecheck`
- [ ] T-1.2 Delete the unreachable dashboard API module, re-Grep `tenantApiFetch`, then delete its now-unreferenced wrapper — `src/features/crm/dashboards/api/dashboard-api.ts`, `src/shared/api/tenant-api-client.ts` — finding: F-001 — dashboard API done; dirty wrapper retained — verify: `pnpm run typecheck && pnpm run test` — BLOCKED: the zero-reference wrapper contains a pre-existing user hunk and is absent from the production graph
- [x] T-1.3 Delete the five unreachable legacy dashboard components — `src/features/crm/dashboards/components/` — finding: F-001 — verify: `pnpm run typecheck`
- [x] T-1.4 Delete the four unreferenced repair/codemod scripts and `typecheck_errors.txt` — `scripts/`, repo root — finding: F-002 — verify: `pnpm run typecheck && pnpm run lint`
- [x] T-1.5 Remove compiler-proven unused declarations from Core routes only — `src/app/(tenant)/core/**` — finding: F-003 — verify: `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [x] T-1.6 Remove compiler-proven unused declarations and the 16 commented `useI18n` statements from CRM routes only — `src/app/(tenant)/crm/**` — finding: F-003 — verify: `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [x] T-1.7 Remove compiler-proven unused declarations from Trade routes only — `src/app/(tenant)/trade/**` — finding: F-003 — verify: `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [x] T-1.8 Remove remaining compiler-proven unused declarations from live shared/features code — `src/components/**`, `src/features/**`, `src/i18n/**` — finding: F-003 — verify: `pnpm run typecheck && pnpm run lint`

### Phase 2: Remove duplicate sources of truth (risk: low)
- [x] T-2.1 Confirm pnpm ownership, remove only the tenant-local npm lock, and regenerate the root lock with the pinned workspace toolchain — `package-lock.json`, `../pnpm-lock.yaml` — finding: F-007 — verify: `pnpm --filter tenant-portal typecheck && pnpm --filter tenant-portal test`
- [ ] T-2.2 Inventory one Core scaffold capability against Gateway/controller/DTO evidence, then either replace or remove that single list/create/detail cohort before moving to the next capability — `src/app/(tenant)/core/<capability>/**` — finding: F-004 — BLOCKED: remaining entry points contain pre-existing user hunks and are unsupported/server-blocked before render
- [ ] T-2.3 Repeat the same one-capability-at-a-time replacement for CRM — `src/app/(tenant)/crm/<capability>/**` — finding: F-004 — released cohorts done; BLOCKED: remaining dirty unsupported entry points are server-blocked before render
- [ ] T-2.4 Repeat the same one-capability-at-a-time replacement for Trade — `src/app/(tenant)/trade/<capability>/**` — finding: F-004 — BLOCKED: remaining dirty unsupported entry points are server-blocked before render

### Phase 3: Collapse needless configuration and inert layers (risk: low/needs-approval)
- [x] T-3.1 Remove `typescript.ignoreBuildErrors` and require the green explicit typecheck before production build — `next.config.ts` — finding: F-006 — verify: `pnpm run typecheck && pnpm run build`
- [ ] T-3.2 Remove the inert tenant WebPhone surface, then remove the dirty residual hook/dependencies only when their concurrent owner is resolved — `src/components/layout/**`, `package.json` — finding: F-005 — runtime surface fully removed; verify: `pnpm run typecheck && pnpm run lint && pnpm run build` — BLOCKED: the zero-reference hook and dependency declarations contain pre-existing user hunks and are not bundled

### Phase 4: Correct behavior-sensitive and security boundaries (risk: needs-approval)
- [x] T-4.1 Add server-side tenant-host admission before the root provider tree, preserving exact suspended pre-auth behavior — `src/app/layout.tsx` plus the minimal server boundary — finding: F-008 — verify: host-admission integration tests, `pnpm run typecheck`, and `pnpm run build` — APPROVAL REQUIRED
- [x] T-4.2 Remove lead mock fallback and add explicit server/error/rollback handling — `src/app/(tenant)/crm/leads/hooks/useLeads.ts` — finding: F-009 — verify: focused lead hook/contract tests and `pnpm run typecheck` — APPROVAL REQUIRED
- [x] T-4.3 Remove pipeline mock fallback and add explicit server/error/rollback handling — `src/features/crm/pipeline/hooks/usePipelineWorkspace.ts` — finding: F-009 — verify: focused pipeline hook/contract tests and `pnpm run typecheck` — APPROVAL REQUIRED
- [x] T-4.4 Neutralize formula-leading CSV cells with focused malicious-input tests — `src/features/crm/dashboards/utils/export-utils.ts` — finding: F-010 — verify: focused export tests, `pnpm run typecheck`, and `pnpm run lint` — APPROVAL REQUIRED

### Phase 5: Enforce the truthful released route boundary (risk: security-sensitive)
- [x] T-5.1 Add one server exact-allowlist boundary for Core/CRM/Trade paths; scrub unsupported redirect queries and reject non-GET/HEAD methods — `src/proxy.ts`, `src/lib/navigation/tenant-routes.ts` — finding: F-004 — verify: focused proxy/route tests and production build
- [x] T-5.2 Remove clean unsupported route entry points and prevent navigation to unavailable capabilities; retain only dirty unreachable residue — route tree and navbar helpers — finding: F-004 — verify: full lint, typecheck, tests, and build

## Execution Log

(filled by fix mode — one line per task)
- 2026-08-24 T-1.1 done — repo-wide symbol recheck returned no references after deleting both clean, unreachable modal files; `pnpm run typecheck` passed.
- 2026-08-25 T-1.2 partial — deleted the clean unreachable 1,657-line dashboard API after a repo-wide reference check; `tenantApiFetch` now has no consumers, but its wrapper is preserved because it carries a concurrent `any`→`unknown` and transport change.
- 2026-08-25 T-1.3 done — repo-wide exact-symbol recheck found definitions only before deletion and no references after deleting the five clean legacy dashboard components; `pnpm run typecheck` passed.
- 2026-08-25 T-1.4 done — removed four unreferenced repair/codemod scripts and the tracked UTF-16 compiler dump; `pnpm run typecheck` passed and lint debt fell from 311 problems (80 errors/231 warnings) to 277 problems (60 errors/217 warnings), so the pre-existing lint gate remains red but improved by 34 diagnostics.
- 2026-08-25 T-1.5 done — removed all 50 compiler-reported unused Core-route bindings across clean files; the strict unused pass now reports zero Core-route diagnostics and the normal typecheck remains green.
- 2026-08-25 T-1.6 done — removed all 53 compiler-reported unused CRM-route bindings, including the 16 inert commented `useI18n` statements; the strict unused pass now reports zero CRM-route diagnostics and the normal typecheck remains green.
- 2026-08-25 T-1.7 done — removed all 65 compiler-reported unused Trade-route bindings across clean files; the strict unused pass now reports zero Trade-route diagnostics and the normal typecheck remains green.
- 2026-08-25 T-1.8 done — removed all 44 remaining compiler-reported unused shared/feature/i18n bindings, preserving the concurrent ConfirmModal behavior while narrowing its React import; strict unused diagnostics for the task scope are zero. The phase gate passed typecheck, 35/35 tests, and production build; lint improved from 311 problems (80 errors/231 warnings) to 63 problems (59 errors/4 warnings) but remains red on pre-existing behavior/type rules outside this dead-binding task.
- 2026-08-25 T-2.1 done — confirmed pnpm workspace ownership (five projects, root lockfile, pnpm 11.21.0), removed only the clean tenant-local npm lock, and verified the already-current root lock with frozen/offline lockfile-only install; filtered typecheck and all 35 tests passed.
- 2026-08-25 T-3.1 done — removed the production-build type-check bypass from the clean Next.js config; explicit typecheck passed and Next.js 16.2.11 production build completed all 67 static pages with its own `Running TypeScript` gate enabled.
- 2026-08-25 T-4.4 done — extracted a pure CSV serializer, quoted headers and cells, neutralized formula/control-prefixed string headers and values without coercing negative numbers, preserved zero/false, and revoked download object URLs; 3 malicious-input/edge-case tests, focused ESLint, and full typecheck passed.
- 2026-08-25 T-4.1 done — added a root server admission boundary that normalizes one DNS Host, calls only the configured server-side Gateway origin with the canonical Core contract, preserves Host without trusting caller forwarding headers, uses no-store/no-redirect and a 2s deadline, and fails closed on every transport/schema/state error. ACTIVE proceeds; SUSPENDED keeps login plus a notice but blocks protected content. Sixteen focused cases, scoped ESLint, full typecheck, 54/54 tests, and the type-checking production build passed; every route is now intentionally dynamic/server-rendered so admission runs per request.
- 2026-08-25 T-4.2 done — replaced the lead mock/read-shape fallback with the canonical branch-scoped Leads and tenant lead-stage contracts; removed fabricated ids, scores, sources, owners, and hard-coded stages; create/delete/move now mutate the server first and retain visible retryable errors on failure. Four focused contract cases, full lint/typecheck, 62/62 tests, and production build passed.
- 2026-08-25 T-4.3 done — removed `getMockBoard`, the invalid `/pipelines/default` request, and the independent mock Pipeline/Branch selectors; the hook now selects an accessible real pipeline and authenticated primary branch, parses canonical board decimal/summary contracts, sends `reason`/`lostReason` correctly, and performs stage/importance mutations server-first. Four focused contract cases, full lint/typecheck, 62/62 tests, and production build passed.
- 2026-08-25 T-3.2 partial — removed the clean always-visible WebPhone trigger, unreachable widget, and fabricated tenant WebPhone API from the production tree. The already-dirty inert hook was deliberately retained rather than overwriting concurrent work. Full lint, typecheck, 62/62 tests, and the 67-route production build passed.
- 2026-08-25 Phase 2 wave 1 done — removed 48 scaffold files plus six now-unused navigation/i18n entries for utility/developer-document cohorts that had no CRUD contract. Root tenant-host admission and backend documentation remain intact; repo-wide slug/symbol searches are empty. Lint, explicit typecheck, 62/62 tests, and the type-checking production build pass; the route count fell from 67 to 61.
- 2026-08-25 T-2.3 CRM static-data cohort done — replaced the local mock CRUD with the sole canonical `GET /api/tenant/crm/v1/static-data` contract, strict raw-CRM parsing, a bounded no-store read, explicit failure/retry state, and a read-only searchable projection. Removed six unsupported create/delete/detail/history/settings files and the invented Core sync path. Focused lint and 3/3 contract tests, full lint/typecheck, 65/65 tests, and the 61-route production build passed.
- 2026-08-25 T-5.1–T-5.2 done — introduced the exact server route boundary, removed clean unsupported entry points/detail trees, and limited navigation to verified released routes. Unsupported GET/HEAD requests redirect with a scrubbed query; other methods fail 405/no-store before page rendering. The final integrated gate passes lint, typecheck, 20 test files / 125 tests, and the Next.js production build with 56 generated pages.

## Final local verification (2026-08-25)

- `pnpm run lint` → pass
- `pnpm run typecheck` → pass before and after the production build
- `pnpm run test` → 20 files / 125 tests pass
- `pnpm run build` → pass; 56 pages generated and the framework reports `ƒ Proxy`
- Dirty-worktree containment → 45 unsupported page entry points and the zero-reference WebPhone/API helpers remain preserved, but none can render through the server route boundary

## Tenant cohort execution — CRM acquisition sources

- Status: implemented and focused-tested. Every route in the final CRM allowlist now uses a canonical server-backed cohort or the truthful CRM module entry; the broader T-2.3 remains open only for the preserved dirty unsupported entry points that the server boundary prevents from rendering.
- Contract: verified against the canonical Gateway entries and CRM controller/DTO/service/guards. CRM JSON is raw, not `{ success, data }`; the source projection is exactly `id`, `nameAr`, `nameEn`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`, and authorized `iconUrl`.
- Simplification: removed the local mock array, timestamp-generated IDs, fabricated channel/conversion/count fields, and four unsupported detail/history/UTM route files. The remaining page reads the bounded catalogue and performs server-first bilingual create/delete with explicit loading, empty, failure, retry, pending, and authoritative re-read behavior.
- Safety: uses only `/api/tenant/crm/v1/acquisition-sources`, validates UUIDv7 item paths, bounds raw responses, rejects fabricated envelopes and noncanonical icon URLs, disables implicit mutation replay, and leaves backend permission/tenant/in-use checks authoritative.
- Documentation: corrected the actual dense `1..12` provisioning order, 500-source bound, raw projection, icon MIME normalization, runtime idempotency/OpenAPI drift, and current partial frontend status without overwriting the pre-existing historical-frontend hunk.
- Verification: focused ESLint and 4/4 acquisition contract tests passed at cohort completion. The final integrated gate supersedes that snapshot: full ESLint and strict typecheck pass, `pnpm run test` passes 20 files / 125 tests, the generated route inventory is current, the 56-page production build passes, direct documentation validation passes for 111 Markdown files, and `git diff --check` passes.
- Remaining product surface: update, reorder, and icon management are verified backend capabilities but intentionally not exposed by this minimal UI; no mock placeholder was retained for them.
