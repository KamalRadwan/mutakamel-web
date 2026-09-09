# Application Catalogue — Admin Frontend track

Current source checkpoint: 2026-09-09. Status: source integration in progress; current checks are coordinated by task13.

The canonical source removes commercial version negotiation and legacy evidence/fallbacks. Addon owner availability gates its real dependent actions. Subscription directory/detail and invoice purpose-based detail retain full prices; initial tenant creation and first-subscription seed use explicit reviewed quotes with nested Addon selections. Quote requests never refresh-replay; seed retains exact original body/key recovery. Existing-subscription aggregate preparation, preview/apply, operation recovery and original receipt lookup are now mounted; the scalar command path is removed. Governed definition adoption remains unavailable pending its actual producer. See [the current contract](../api/application-addons-target.md), [subscriptions](../api/subscriptions.md), [invoices](../api/invoices.md) and [tenants](../api/tenants.md).

Integration task 13 verified the mounted ordinary aggregate packet: final full TypeScript, billing/commercial ESLint, RTL guard (zero physical-direction utilities), docs (282 routes, 80 Markdown files), and production build passed. Next 16.3.3 compiled all 48 static pages plus dynamic routes. Existing billing evidence is four passing suites plus a passing corrected panel/evidence rerun (15/15 cases), not a claimed single full rerun. The latest quote-owner reset separately passed two existing wizard suites (16/16) and exact lint. No new test cases, app/server startup, database writes, runtime QA or package adoption were performed by this Admin delivery. Build evidence does not establish authenticated runtime acceptance.

## Historical evidence before the canonical contract change

The following sections preserve the dated2026-09-07/08 implementation and QA record, including superseded negotiation and unmounted-workspace descriptions. They are historical evidence only; current behavior and boundaries are documented above.

## Scope and ownership

This fork owns Admin Portal FE-01–04 and the Admin portions of FE-08/FE-11.
It does not change backend files, packages, or Tenant clients,
the shared acceptance ledger, current databases, or shared Docker services.
Existing user changes are preserved; `main` was verified before edits.

User scope amendment: Mobile and Partner implementation/tests are excluded
from the current task and are not release blockers. Their files remain intact.
Only Backend, Admin Portal and Tenant Portal are active consumer scope.

## Contract review before implementation

Reviewed the development plan, current implementation record, ownership record,
Admin instructions/integration and catalogue documentation, and actual Gateway
`core-addon.route-contracts.ts`, Core Addons controller/DTO/service/OpenAPI and
Addon pricing controller/DTO/types. Browser routes remain
`/api/admin/core/v1/applications/:applicationKey/addons` with explicit
`x-commercial-contract-version: 2`. Singleton data and write bodies use
`contractVersion: 2`; lists use the negotiated response header and canonical
envelope `data` array plus `meta`. GET and DELETE are bodyless.

Addon RBAC uses `admin.applications.*`, not the existing Tier/Feature
`admin.catalog.*` permissions. Critical writes require ALL update + critical;
deletion requires ALL delete + critical. Actor-bound UUIDv7 keys are retained
for exact ambiguous retries. Stale revisions require an explicit reload and
new confirmation; they are never automatically overwritten.

Definition draft, published snapshot and operational state remain separate.
Publishing does not imply tenant adoption, readiness or assignment. Price
ladders have independent MONTHLY/ANNUAL revisions; unconfigured revision `0`
is unavailable, not free. Prices and revisions stay strings. The user example
10/9/8 is test data only. No public Admin sample-quote route exists in the
accepted Addon family, so no fabricated server quote or authoritative browser
calculation will be introduced.

Commercial track confirms the current Admin V2 read shapes remain authoritative
in `subscription-read-v2.contract.ts`; public preparation/preview/apply routes
are not yet frozen. Their new write actions stay gated until source contracts
are delivered and reviewed.

## Work sequence

1. Add closed, owner-bound V2 read adapters, typed DTOs and contract tests.
2. Add an Application-owned workspace for list/detail, draft editing,
   compatibility/grants/bindings/schema references, immutable history/audit and
   reasoned lifecycle commands.
3. Add dynamic graduated per-user ladders using the existing compact editing
   interaction, explicit cycle/revision and safe post-write refresh.
4. Review subscription/invoice source contracts and upgrade affected read
   projections without flattening addon seats into base allowance. Integrate
   commercial writes only when the owning track supplies implemented routes.
5. Verify focused tests, types/lint/docs, RTL/LTR and themes, then coordinate
   authenticated browser use with the parent. Report source and runtime
   acceptance separately.

## UI and verification decisions

Use existing design-system primitives and hook/view separation, not a visual
redesign. The UI/UX skill reinforces focusable form error summaries linked to
invalid inputs; errors also retain inline descriptions and correlation IDs.
Cover permission denial (not empty), unsupported/malformed V2, cross-owner
responses, decimal/revision fidelity, ladder continuity/open end, exact retries,
stale revisions, selection races, immutable version history and bilingual UI.

## Evidence

- Initial contract and instructions review completed; no acceptance claim yet.
- Source adapters, Addon workspace/forms/pricing and accepted subscription
  read projection are implemented. The first focused run passed 22 files / 201
  tests, with typecheck and scoped lint passing; later changes require rerun.
- Authenticated Admin browser QA created only `crm.qa_addons_0907`, named
  `QA Addons 2026-09-07`, with an explicit non-production/do-not-publish
  description. Creation receipt and list readback succeeded as DRAFT,
  unpublished. No subscription, money, permission or publication was changed.
  The detail read failed `CORE_VALIDATION_FAILED`, correlation
  `01a07d59-ba58-79f5-9aa6-f724c482a246`. The backend coordinator received the
  empty-query DTO/global `forbidUnknownValues` reproduction; this browser gate
  is not treated as a successful detail/pricing test.
- Cancellation review amendment: the actual Admin controller retains ALL
  `admin.subscriptions.cancel` + `admin.subscriptions.critical`, bodyless POST
  and UUIDv7 receipt replay. The actual accepted-billing lifecycle integration
  suite covers immediate/scheduled parent cancellation with Addon history,
  no future child charges and failed projection. Preserve that existing
  whole-subscription action; only new plan/purchase/adoption commands remain
  gated. No live cancellation is authorized by this QA check.
- UI feedback correction: an actively submitting request must not be called
  recovered or ambiguous. Show recovery instructions only after submission
  settles without a definitive outcome.
  Navigating away during retry preparation must retain the existing ambiguous
  journal; an undispatched retry cannot resolve a previously dispatched command.
- Pending-draft read handoff verified in Core `applications.service.ts`,
  `application-pending-draft.schema.ts` and the actual list/detail HTTP tests:
  `ApplicationView.hasPendingDraft:boolean` is additive and independent of
  publication/lifecycle/revisions. Older servers can omit it; treat omission
  as unknown, not false and not a revision heuristic. The Admin rail/dialog
  will offer independently permissioned republish only for explicit true,
  retaining existing publication/readiness/activation gates.
- Pricing refresh must retain the selected billing cycle. A saved ANNUAL ladder
  cannot silently switch the editor to MONTHLY when its new revision remounts
  the form; cycle selection belongs to the selected Addon workspace.
- Responsive browser QA at390px exposed existing parent-page overflow from the
  PageHeader unbounded action slot and the manifest/policy grid's implicit
  min-content width. Bound the shared action slot to its parent and give this
  page explicit shrinkable grid tracks. Addon tabs must scroll horizontally
  without an unintended vertical scrollbar. No navigation/action is removed.
- Latest focused command: `npm run test -- src/features/admin/applications
  src/features/admin/tenant-workspace/billing scripts/docs/route-contract-reader.test.mjs`
  passed25files /229tests. This includes actual23route AST discovery, explicit
  pending true/false/absent evidence, whole-subscription cancellation guards,
  accepted-price/base allowance UI, RBAC revocation, closed V2 transport and
  retained annual-cycle refresh. Tests do not execute real commercial actions.
- `npm run typecheck`, scoped ESLint, `npm run docs:routes`, `npm run docs:check`
  (278routes,80Markdown files) and `npm run design:rtl` (0physical utilities)
  passed. Global test/build remains coordinated behind the Tenant build to
  avoid parallel heavy processes; further edits require a final rerun.

## Authenticated QA after the coordinated Core repair

The same `crm.qa_addons_0907` fixture was retried after the coordinator fixed
the real empty-query and raw-number DTO validation defects and verified the
running service. Detail read now succeeded: catalogue, operational and draft
definition revisions1, lifecycle DRAFT, no published snapshot/history.

MONTHLY price request used `contractVersion:2`, `expectedLadderRevision:"0"`,
brackets `(1..10,"10"),(11..25,"9"),(26..null,"8")` and reason
`QA only 2026-09-07: verify dynamic graduated monthly ladder on unpublished draft; no subscription charges.`
Authoritative refetch returned configured revision1 and exact decimal strings
`10.0000,9.0000,8.0000`. ANNUAL remained independently unavailable revision0
with a blank price; no monthly multiplication was inferred.

ANNUAL request used `contractVersion:2`, `expectedLadderRevision:"0"`, bracket
`(1..null,"73.1250")`, reason
`QA only 2026-09-07: independent arbitrary fractional annual price; unpublished draft, no subscription charges.`
Its authoritative refetch returned configured revision1 and `73.1250`, with
ANNUAL still selected after the saved-revision remount. A subsequent language
reload re-read the unchanged MONTHLY revision1/three brackets.

Audit read returned exactly the three expected events for Platform Admin:

| Event | Operation ID | Occurred at UTC |
| --- | --- | --- |
| ADDON_CREATED | 01a07d59-b943-7781-addd-eaa74f4a46e8 | 2026-09-07T19:30:27.421Z |
| ADDON_PRICE_LADDER_REPLACED (MONTHLY) | 01a07d67-9a73-7262-b887-f7985ac1f35f | 2026-09-07T19:45:36.944Z |
| ADDON_PRICE_LADDER_REPLACED (ANNUAL) | 01a07d68-3fc5-712b-b430-ada7badec7cd | 2026-09-07T19:46:19.231Z |

Arabic/light and English/dark layouts were visually inspected. At390px the
parent page initially overflowed to582px; after the action-slot/grid fixes,
the actual populated English/dark page and Addon audit had375px client width
and375px scroll width (scrollbar excluded). Horizontal scrolling remains local
to bounded tabs/audit tables. Original Arabic/light/default viewport restored;
browser slot released. One transient upstream-unavailable read was explicitly
shown and recovered with the existing Retry action, not hidden as empty.

The fixture is deliberately retained unpublished for coordinator inspection.
No App/Addon publication, activation, subscription, charge, refund or permission
change was performed. These checks do not establish real purchase, adoption,
invoice V2, tenant runtime readiness or the full plan's acceptance.

## Final packet verification and handoff

`npm run docs:routes` followed by `npm run verify` completed with exit0:

- TypeScript `--noEmit`: passed.
- Whole Admin ESLint: passed.
- RTL guard: 0 physical direction utilities, passed.
- Documentation: generated278 Admin Core routes, checked80 Markdown files.
- Whole Vitest:276 files /2001 tests passed,79.97 seconds. This includes the
  new unknown-command retry/unmount preservation test; counts overlap the
  focused runs above and must not be added together.
- Next16.3.3 production build: compiled8.8 seconds, TypeScript16.3 seconds,
  generated48 static pages, exit0; dynamic Application detail route included.
- `git diff --check -- .`: exit0 (line-ending notices only).

The heavy build slot is released. No production source was edited during this
build; the final documentation-only receipt does not change the tested source.
No backend/package/lockfile/Docker source was changed by this Admin track.
Existing user AuthContext, confirmation-dialog and other unrelated changes
were preserved. No commit, branch change, reset or dependency publication.

Owned source groups at that checkpoint: closed `shared/api/commercial-contract.ts` (subsequently renamed); new Addon API,
contract/copy/presentation, six hooks and four workspace/form components;
Application detail mounting and pending-draft rail/dialog/type/dictionary
updates; accepted subscription V2 reader/card and existing billing integration;
static route-contract reader/generator; their focused tests. The responsive
fix also bounds the Admin PageHeader action slot and this page's manifest grid.
Docs update catalogue/subscriptions, explicit target/live boundaries,
integration/known-gap/capability guidance, generated route inventory and this
receipt. Invoice business readers remain unchanged pending public V2 delivery.

Remaining dependency gates (not claimed complete): FE-01 aggregate command
schemas; FE-02 full operational-blocker and governed lifecycle runtime matrix;
FE-03 public authoritative sample-quote breakdown; FE-04 directory, invoices,
aggregate preview/apply and durable operational recovery; Admin FE-12 initial
nested quote/create and FE-13 adoption after actual backend handoff. FE-11
full cross-surface acceptance follows those integrations. Missing contracts
are not replaced with frontend-only pricing or permissive unknown schemas.

## Invoice-detail V2 follow-on packet (prepared; image handshake held)

Commercial delivered the frozen retained-invoice reader, controller,
authorization, bounded closed contract and OpenAPI after the verification
packet above. Admin now owns a strict detail parser and read-only accepted
line evidence UI. Distinguish retained line quantity from accepted seats,
pricing-evidence availability from line-evidence availability, and omitted
FX metadata from a stored null. Do not reinterpret history using catalogue
lookups. Preserve existing list/write DTOs, permissions and idempotency.
Enable negotiated GET only after coordinator Core/Gateway handshake; report
focused source tests separately from the earlier full2001-test build and
from authenticated runtime proof. No invoice financial mutation is part of QA.

Implemented and verified:

- Closed22-field retained header and discriminated complete/legacy lines,
  at most200; base/addon limits100 each, unique identities, matching parent,
  child seats not above parent. Canonical four-decimal retained money and
  legacy two-decimal quantity use BigInt half-up verification. No current
  catalogue or inferred description identity is consulted.
- Shared accepted-price reader/validator extracted unchanged from subscription
  V2 for invoice reuse; accepted seat/pricing arithmetic and source-specific
  revision identities retain the existing subscription regression coverage.
- `getRetainedInvoiceDetail` prepares exact V2 header-only GET through the
  shared cookie-auth client, bound4MiB success envelope, preserved correlation,
  exact invoice selector and required response acknowledgement. It is NOT yet
  mounted as `invoicesApi.get`; existing GET and all money commands stay V1.
- Bilingual read-only evidence card separates quantity from accepted seats,
  attribution from pricing availability, and omitted FX/translation fields
  from recorded values. Responsive cards and locally scrolling, labelled
  native disclosure tables follow the targeted UI/UX skill guidance.
- Invoice hook now fences same-permission actor changes and late command
  results; command double-clicks are synchronously latched. A confirmed
  existing command on V2 evidence triggers retained detail refresh. A rejected
  command is never converted into success. Manual-edit, issue, void and payment
  permission/body contracts are unchanged.

Full `npm run verify` exit0: TypeScript, whole ESLint, RTL0, docs278routes /
80Markdown files,278 Vitest files /2043 tests (80.71s), Next16.3.3 compile7.5s,
TypeScript7.7s and48 static pages. `/invoices/[id]` is included. Production
source remained unchanged during verification; final receipt changes are
documentation-only. `git diff --check -- admin-portal` exit0, with only
line-ending notices. No backend, package, lockfile, Docker, DB or browser
mutation in this invoice follow-on packet. The heavy build slot is released.

Coordinator explicitly holds negotiated GET until the intermediate Core/
Gateway image handshake. On receipt, mount the prepared helper, update the
old detail GET expectation, run delta verification/build and use only existing
invoice data for authenticated read-only QA. No invented invoice or configured
money fixture is authorized. This packet completes neither the whole plan
nor its remaining commercial commands, directory, initial-purchase/adoption
or integrated runtime gates.

## Initial quote/seed response staging (2026-09-08, source verified)

Commercial froze `subscription-initial-quote.contract.ts/.openapi.ts` and
`subscription-initial-seed.openapi.ts`, matched to the Financial owner's
`initial-subscription-seed-receipt.ts`. Main reviewed these, request identity/
quantity rules and source tests. Public subscription-v1 controller still
dispatches existing V1 quote and seed, so Admin stages pure closed response
readers/tests only. No new transport route, enabled request, UI flow, retry
mutation or adapter to current subscription state. Quote4MiB and receipt256KiB
envelope bounds remain distinct. Initial quote/seed V2 transport remains held.

Added `features/admin/subscriptions/initial-commercial-readers.ts` and50tests.
Closed11-field quote requires COMPLETE source-specific pricing, exact retained
graduated arithmetic, purpose/target relation,50/100App bounds,100aggregate
children, globally unique selection keys/Addon IDs and exact15-minute expiry.
Closed15-field seed receipt accepts only originalTRIAL/revision1, canonical
trial timestamps and exact duration, original totals and100+100 mappings;
correlation keys and server-generated row identities must be disjoint. Both
adapters require explicit2 acknowledgement and bind response purpose/target or
tenant/quote to caller scope, preserving correlation on malformed responses.
No private requestHash/pricingRevision/provisioningIntent accepted. No current
subscription-state adapter, browser request, seed/purchase flow or financial
mutation added. Shape validation is not row provenance or authorization.

## Invoice GET enablement delta (2026-09-08)

Root supplied explicit FINAL Admin invoice image handshake: Core/Gateway
images adopted both retained invoice readers, unauthenticated privacy checks
passed, and the Gateway was healthy. Existing `invoicesApi.get` now delegates
to `getRetainedInvoiceDetail`, with explicit version2 header and exact closed
reader; original list and money command paths/DTOs remain unchanged. Existing
detail GET test now expects the V2 legacy-evidence envelope. This supersedes
the09-07 preparation hold above. Current CP has no invoice records; no invented
invoice/financial fixture or authenticated real-invoice200 claim.
Admin invoice delta runs first, Tenant invoice delta second, after Runtime
performance probe exit. No heavy test/build burst started before that signal.

After the explicit probe-exit signal, the delta passed full `npm run typecheck`,
targeted ESLint,10files/147Vitest tests (7.18s;97invoice/shared regressions and
50staged initial quote/seed cases), refreshed docs278routes/80Markdown files,
then actual `npm run build` exit0. Next16.3.3 compile7.4s, TypeScript7.0s,
48static pages; `/invoices/[id]` included. No production source edits during
build. `git diff --check -- admin-portal` exit0, line-ending notices only.
The complete2043-test suite above was not rerun for this bounded delta.
Build slot released directly to Tenant immediately after actual process exit.

Invoice V2 is enabled in Admin source; initial quote/seed remain staged only.
Current CP is empty of invoices, so no authenticated real-invoice200/browser
proof, artificial financial fixture, money mutation or broader plan-completion
claim. All backend/package/lockfile/Docker/DB files remain outside this track.

## Addon lifecycle matrix and post-commit error focus (2026-09-08)

Root first authorized a tests-only packet against the real workspace/hooks and
closed source fixtures. The new 21-case lifecycle suite covers DRAFT, ACTIVE,
DEPRECATED and DISABLED action rendering; independent ALL permission pairs;
revoked publication/no draft; separate draft/published evidence; read revocation;
and stale successful/failed responses after switching Addons. These fixtures
are not evidence of live registration, publication or operational readiness.

The first run had 17 passes and four failures. Two were test-selector mistakes
(implicit table-header roles and inline label whitespace), corrected only in
the tests. The repeated frozen 21-case run then had 19 passes and two genuine
failures. The five-file regression run had 64 passes and those same two failures
out of 66 tests (9.93 seconds). First authoritative publication refusals
`ADDON_OWNER_REGISTRATION_UNAVAILABLE` (422) and
`ADDON_CATALOGUE_REVISION_STALE` (409) rendered the correlated error summary but
left focus in the reason textarea. The async failure microtask ran before React
committed the conditionally mounted error summary.

After explicit root approval, the only production change was to focus the
rendered `mutation.error` summary in a post-commit effect in
`useAddonDefinitionDialog.ts`, removing the premature async-failure microtask.
Local field validation, reason values, DTO/revision fences, current permissions,
exact error code/correlation and the combined Application publish/activate
workflow remain unchanged. The targeted UI/UX skill's Focusable Error Summary
guidance informed this correction; no visual redesign was introduced.

The original 21 cases remain unskipped and unchanged by the production fix.
One additional test proves that a late rejection after critical permission
removes the dialog cannot reopen it or steal focus from the current search
field. Final acceptance: all 67 tests across the new lifecycle file and existing
`ApplicationAddonsWorkspace.test.tsx`, `AddonForms.test.tsx`,
`application-publish-flow.test.tsx` and `useAddonMutation.test.tsx` passed in
9.03 seconds, exit 0. Full Admin `npm run typecheck`, scoped ESLint of the two
changed files (no warnings), and `npm run design:rtl` (0 physical utilities)
passed. No extra production build, browser operation, database mutation,
publication, activation, package or Docker change was performed. Whole FE-02,
FE-11 and authenticated publication acceptance remain open.

Frozen file-byte SHA-256 values for independent review:

| Path relative to Admin Portal | SHA-256 |
| --- | --- |
| `src/features/admin/applications/hooks/useAddonDefinitionDialog.ts` | `569f5b11d581f9c4f7721c25bb95b272fb5b79509ed94741e7d03e77b19bc10f` |
| `src/features/admin/applications/components/AddonWorkspace.lifecycle.test.tsx` | `064bf564fee7909c9c3a2ad5dff4b33bf3749c3f1421be21a64644867b28e4e0` |

Only this documentation receipt was edited after hashing; the two code files
remain frozen for root review. This bounded source verification is not a new
whole-plan task completion or runtime sign-off.

## Initial commercial interaction packet (2026-09-08, source verified; unmounted)

Root authorized isolated production components/hooks and prepared V2 transport
under `src/features/admin/subscriptions/initial-commercial/`, reusing the
staged closed quote/seed readers. Commercial independently confirmed that the
actual mixed controller/module still delegates initial commands to V1; V2
guards/owners remain unregistered. No new workspace is imported by a route,
and no current V1 wizard, navigation or live initial command is changed.

Both quote purposes use the existing subscription quote address, without an
idempotency key. INITIAL_SEED alone includes its target in the quote body;
seed consumption uses that tenant path and exact quote/terms plus a UUIDv7 key,
not a purpose/target body field. Quote evidence expires after 15 minutes and
does not establish provisioning readiness. The original seed receipt is not a
current subscription view. Complete TENANT_CREATION submission remains the
separate identity/placement owner boundary; no provisioning intent is invented.

The initial owner-selected-only limitation was superseded by Commercial/API
Docs' frozen create-options3/12/4/7-field source in43 section7.0. The new closed
reader and explicit-load prepared GET/picker use only tenant-create authority,
with genuine published labels, sealed definition IDs, compatible active Tier
IDs, closed diagnostics and exact source ordering. No broad catalogue permission,
fake prices, ready/selectionAllowed/canApply or provisioning intent is added.
All quoted prices remain source-issued COMPLETE evidence; parent and child
quantities and recurring totals remain distinct. Empty local editing is allowed,
not an empty quote request. Tier changes require explicit remove/re-add.

Production packet ownership stays inside
`src/features/admin/subscriptions/initial-commercial/`, reusing the original
`initial-commercial-readers.ts` unchanged. It contains closed request builders,
prepared options/quote/seed transport, interaction/recovery owner, EN/AR views
and source fixtures used only by tests. Workspace and picker state/effects are
separated into local hooks. No route, navigation, current V1 tenants/new source,
backend, package/lockfile, Docker or database file was changed for this packet.

Actor/context/terms changes invalidate quote ownership; journal-ready also binds
to the exact owner. Target, intent, observed subscription/revision and permission
changes cannot admit old requests/results. First seed uses the reviewed quote
and original optional-trial omission. Pending seed disables selection and
re-quote; exact retries retain original body/key, including after quote expiry.
In-flight copy does not imply an uncertain outcome before the request settles.
Remounts retain only minimal journal metadata and fail closed when the original
request is unavailable. No fake status endpoint, body persistence or synthetic
reconstruction is introduced. The accepted receipt is labeled immutable/original
and never adopted as current subscription/readiness. Complete creation remains
the separate identity/placement/Worker owner integration.

UI/UX Focusable Error Summary guidance resulted in post-commit summary focus,
field-linked validation and inline errors. Targeted UI tests exposed a same-tick
input/journal-reset race, corrected by exact-owner journal readiness; tests now
cover loading/uncertain copy, correlated failures, Arabic semantics and immutable
receipt display. These are component/jsdom checks, not new browser layout,
light/dark or authenticated financial-operation evidence.

Final bounded verification:16files/220tests passed in7.39seconds, including the
50unchanged staged response-reader cases,114new request/options/transport/hook/UI
cases, and56unchanged V1 tenants/new regressions. Full Admin typecheck passed;
scoped initial-commercial ESLint and RTL guard (0physical utilities) passed.
Docs checks passed for278routes/80Markdown files. A named same-tick owner-change
regression verifies that old journal readiness cannot dispatch a request.
The final suite also verifies explicit local parent/child removal, empty-request
validation, restoration and a retained command refusing quantity mutation.
No broad build was started; root requested a source-only freeze with exact hashes.
Root still owns independent acceptance and the actual initial V2 route/image
handshake. This receipt completes no whole FE-12 or overall release task.

Frozen initial-commercial source/test SHA-256 values (Admin-relative paths):

| File | SHA-256 |
| --- | --- |
| `src/features/admin/subscriptions/initial-commercial-readers.test.ts` | `aa5765e44c2276dd8f001273d742729621c0a7351fa50fcb7717ae2408439e2e` |
| `src/features/admin/subscriptions/initial-commercial-readers.ts` | `119493533b227cd999a27d1c51ea60d837436d7ae7f7fd0d5737440d33b3d6af` |
| `src/features/admin/subscriptions/initial-commercial/hooks/useInitialCommercial.ts` | `944d366e058991dee1262b66ab4d090843996cba30d4bf70f530b6adc8d7a961` |
| `src/features/admin/subscriptions/initial-commercial/hooks/useInitialCommercialSelection.ts` | `17d3d65b3752554dd6b6f0025c3e2176df19c054be7f8c49faf405fe34b56f8f` |
| `src/features/admin/subscriptions/initial-commercial/hooks/useInitialCommercialWorkspace.ts` | `4ec4438e93ab70327f8bcabc200322d9547d1277ce081ee3fe55c09c442ef44f` |
| `src/features/admin/subscriptions/initial-commercial/hooks/useInitialCreateOptions.test.tsx` | `e0db0ace64f079bf46be0b0d490cdc2d71be977e98fbd3fbca9e436588fb9c3b` |
| `src/features/admin/subscriptions/initial-commercial/hooks/useInitialCreateOptions.ts` | `d06f70097a406839ca7b5d46750ba3a218a9cc0be0e95dd9e1cf5122b249a22f` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial-copy.ts` | `e0eb5e23b3b19751158cd2a4f1fed0cde4e0d41796d266670c628bbea91e4a45` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial-request.test.ts` | `e82453043d2d8069245ff1a2c1372513f384bd3c74a4e6dcdae8ee8ae7f8fc56` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial-request.ts` | `dd86160d5daee2b86ccf448feb637a9ffd2cdf0c4dd62a653c7b52f3a264bfb9` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial.api.test.ts` | `3edc2dc1ac17e9db389ca1ed54339fdc7983ad39a70480b41de2865edc3e03ec` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial.api.ts` | `00cc04166e7084ed609e839e700f5a1757008f271a0088a6f0bebf59eedd11a9` |
| `src/features/admin/subscriptions/initial-commercial/initial-commercial.fixture.ts` | `bfead9e8b618395584e6dc0aa12c9cf40cdf6431a3194fb218ffeb1f870b5d8c` |
| `src/features/admin/subscriptions/initial-commercial/initial-create-options.fixture.ts` | `891bee8e231b8823c1f705f20d74b47e252eb9884a9eeac673786d1d1687fe28` |
| `src/features/admin/subscriptions/initial-commercial/initial-create-options.test.ts` | `2383e3c15824488bb6c0e09f114bb047a6c550c639c62e0a6abfcf06429a03b1` |
| `src/features/admin/subscriptions/initial-commercial/initial-create-options.ts` | `43a859179bd8b0656900ebde2c6da9636d120bea08ba800a2f0478eb43274b79` |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialQuote.tsx` | `97fb35eecb72d20f8694c477cb00bb17b5e93725187b3709d4f287dcd8844c22` |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialSelection.tsx` | `e2d9da9763bbbc1c33d07a2581809667ffd4005d21aa6f299a04790ce119ce0c` |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.test.tsx` | `193b0c26755d5c6366379771c73cf3d764fcd9f81ed7edcd483091324e7ab1f8` |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.tsx` | `015cc803b636119dce10f90a997e3c6c826c704522fff55f97f4b1f1558535ec` |
| `src/features/admin/subscriptions/initial-commercial/InitialCreateOptions.tsx` | `118ffbdfa44a18062d0fb075adc37b0a227b4f7ed5853898251b22a953291e61` |
| `src/features/admin/subscriptions/initial-commercial/useInitialCommercial.test.tsx` | `d604f0c11d781eb1c12ae1fd66456eba9a38fbdacf0714b2dd613131706d2188` |

## Initial commercial keyboard/status acceptance delta (2026-09-08)

Root requested only missing accessibility cases against the frozen production
packet, without live mounting or a broad build. The220-case baseline already
covered field-linked focused validation summaries, correlated options/seed
failure focus, different in-flight/uncertain copy, exact original-key retry and
the immutable receipt warning. Those behaviors were not duplicated.

Five missing cases were added in
`InitialCommercialWorkspace.accessibility.test.tsx`: real Radix Arrow/End/Enter
selection and Escape focus return under the installed DirectionBridge in each
of English/LTR and Arabic/RTL; contextual quote-refresh status and busy control
semantics without stealing focus; and stale quote success/failure after a local
selection change preserving the current field's focus. The existing pending/
uncertain recovery case gained explicit status-role, busy/disabled control and
native retry-button semantics assertions, retaining its original key checks.

The exact two-file delta passed16tests in12.05seconds. Full Admin typecheck and
scoped ESLint passed without warnings. No production code, API, route, navigation,
backend, database, Docker, package, broad build or live financial/browser action
changed. Byte-hash comparison verified21of22baseline source/test files unchanged;
only the existing workspace test changed and one test file was added. The full
220baseline suite was not rerun for this tests-only delta.

The UI/UX Focusable Error Summary and contextual-status guidance informed the
coverage audit. Tests execute real production/Radix handlers in jsdom; the only
added platform shim is its missing scrollIntoView layout primitive. No synthetic
focus/activation behavior or mocked design-system component replaces them.
Native browser Tab/Enter default activation, actual screen-reader announcement
delivery, visual focus visibility and authenticated mounted acceptance remain
separate browser checks; this delta makes no such claim.

The existing22-file table remains the220-test historical checkpoint. Its
`InitialCommercialWorkspace.test.tsx` hash is superseded only by the row below;
all production hashes remain frozen. Exact tests-only delta SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.accessibility.test.tsx` | `a74cb02bc114107da8f062eae925199b1a91ddf2a02ba1d247c9e8127a4376c8` |
| `src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.test.tsx` | `7cb4f708fd98dba56da03af492e8f1cd4b62579af64805bc8743f32bc654ffb1` |

## Existing wizard V2 read-only reference preparation (2026-09-08)

Root reported actual Core existing-GET V1/V2 source registration and139actual
controller/Swagger/V1/error tests; Gateway ingress source acceptance remained
pending at this handoff. This is not a deployed browser handshake. Admin was
authorized only to prepare an independent reference display, never to mount
the incomplete quote/seed workflow or alter current wizard submission authority.

The exact current read callsite is
`src/app/(shell)/tenants/new/api/tenant-registration.api.ts:62`
(`listCandidateApplications`), called from `hooks/useRegisterTenant.ts:300`.
Its V1 closed parser requires `selectionAllowed`. That permit controls retained
selection at hook316, evidence fingerprint379, toggle398,
`lib/tenant-registration.ts:115` subscription-line construction, and
`components/TenantApplicationsStep.tsx:188` checkbox/ready-state rendering.
V2 deliberately has no permit; it also adds root quoteRequired and nested
Addons and supports signed ranks/legacy publication UUIDs. Changing only the
GET header, casting the projection or deriving permission from empty diagnostics
would therefore break or weaken actual wizard decisions.

The exact V2 read adapter already exists as `initialCommercialApi.options`;
no duplicate request/parser was introduced. A genuinely missing pure
`InitialOptionsReference.tsx` now displays already verified/current V2 options
as published labels, Tier compatibility, sealed definitions and diagnostic
codes only. It has no API calls, setters, selection controls, prices, permit
projection, quote/seed actions or callbacks. It uses existing semantic colors,
13px-or-larger text, native details/summary and EN/AR direction, and expressly
states that it cannot alter the current tenant-creation request. The UI/UX
search had no exact disclosure-specific match; layout uses the current design
system and the skill's general keyboard/focus defaults, not a claimed new
design recommendation.

Minimal later integration task, after explicit root ingress/image acceptance:

1. Add a separate actor/permission/generation-fenced, abortable V2 reference read
   owner using the existing options adapter and `admin.tenants.create`. Its
   loading/error/empty state must not replace V1 candidates or their error state.
2. Compose the reference beside the current `TenantApplicationsStep` at
   `src/app/(shell)/tenants/new/page.tsx:850`. Pass only its verified current
   V2 result; expose a separately correlated read failure instead of converting
   it to empty V1 data or falling back between versions.
3. Leave V1 listCandidateApplications, selections, selectionAllowed, evidence
   fingerprint, line construction, placement/provisioning preview and quote/
   create/recovery byte identities unchanged. No Addon enters the legacy DTO.
4. Verify authenticated read-only V2 GET and independent stale/error/permission
   behavior in the actual browser. This is not authorization to enable the
   incomplete initial-commercial purchase/creator flow.

The new composition suite tests both true/false actual V1 checkbox and
subscription-line decisions while V2 diagnostics are empty, rejects passing V2
through the legacy reader, preserves immutable display data, has no controls
for revoked Addons, and handles Arabic/empty source data. New5cases plus the
unchanged V1 API/reader/hook regressions passed36tests across4files in5.17seconds.
Full Admin typecheck, scoped ESLint and RTL guard0passed. No active wizard,
frozen commercial owner, API, route/navigation, backend or build was changed.

All23preceding packet source/test hashes were independently compared and remain
unchanged. Exact new unmounted reference/display-test SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `src/features/admin/subscriptions/initial-commercial/InitialOptionsReference.test.tsx` | `d9f22b5bcb87cbefbfe964304724b6c738fb8118d01ec6879625d446c07b647e` |
| `src/features/admin/subscriptions/initial-commercial/InitialOptionsReference.tsx` | `65d29361701652c4a039a4aaa2ebd82fd7275615a60b846f71a2bee435a76319` |

Final docs verification note: the standalone80-Markdown checker passed, but
`docs:check` stopped at a stale generated route inventory during this handoff.
No inventory was regenerated while root owns active Gateway metadata changes;
final route-inventory synchronization remains required. No route currently
imports the new reference view. This does not alter the successful36-test
packet or imply that the full docs command passed.

## Official Admin route-inventory synchronization (2026-09-08)

After root reported final acceptance of the existing create-options Gateway
metadata and no further row edits, the existing official `pnpm run docs:routes`
generator was run without modification. It updated only the two owned generated
Admin JSON/Markdown inventories. All278route rows, method counts, route classes
and23domains remained identical; there were no changed, added or removed
emitted routes. The generated source hash for `core.route-contracts.ts` changed
from `4f318d5eabeba76f88c6f350d3c784b2bed1721d67f07eb53ae6abe589011974`
to `e5aa0a9bf31e598af0079ac41c3a27a30394e39fcbc2395b1462d181b0e0a909`.
The Addon-route and canonical-path source hashes stayed unchanged. Metadata/
generation timestamps were refreshed; the generator's own SHA-256 was compared
before/after and remained unchanged.

Actual final `pnpm run docs:check` passed:278routes current and80Markdown files
validated. This supersedes only the stale-inventory gate in the previous
handoff. It does not claim that generated route columns expose every negotiated
metadata field or that a V2 browser/image handshake occurred. No method check,
missing-call rule or exception was changed, no active UI request was mounted,
and no Gateway/root/tenant documentation or code was edited. Tenant's separately
reported prepared-DELETE201/200 mismatch was neither modified nor exempted;
this result is limited to the official Admin checks.
