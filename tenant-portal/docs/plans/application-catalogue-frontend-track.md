# Tenant Application Catalogue / Addons — execution record

Date: 2026-09-07. Status: implementation in progress; no live acceptance claim.

## Current canonical integration — 2026-09-09

[Canonical delivery](../api/catalogue-canonical-delivery.md) records the current source and supersedes older negotiation/unmounted-seat claims in the dated records below. The canonical subscription, offers, invoice and scoped adapters omit commercial version fields/headers; retained commercial pricing requires complete real evidence. Assignment/removal panels are mounted after exact Core/Gateway registration. Company Application/Addon activation and Branch override controls are now mounted after their actual source/module/Gateway/verifier/Realtime handoffs. Narrow-grant package adoption and runtime acceptance remain pending. No Addon purchase, configuration writer or authenticated runtime success is inferred.

Task 13 ran the existing Access packet: 425 tests in 21 files, 423 passed and two obsolete header assertions failed (145.53s). Those existing assertions were corrected to reject the obsolete body discriminator; both affected files passed 36/36 (2.99s). The existing subscription/billing packet passed 202/204 in 15 files (71.31s); two locale assertions pinned the removed absent-price-evidence table state and were corrected without changing other assertions. That file then passed 3/3 (12.39s). These runs do not verify the later new scoped packet. Final source TypeScript/lint and generated documentation checks remain coordinated by task 13. No new tests/cases, apps, database actions or package changes were performed by Tenant task 11.

Scope: FE05–08 and Tenant portions of FE11/FE13. Initial tenant creation (FE12) remains Admin-owned; this task does not create a tenant through the Tenant Portal. Work only in this repository on the verified shared `main` checkout. Existing design/CRM/Leads changes remain preserved.

Latest checks: task 13 full Tenant TypeScript and scoped ESLint **PASS**, exit0, including the mounted scoped controls, final denial recovery/receipt display and AR/EN dictionaries (`13-tenant-diagnostic-typecheck.log`, `13-tenant-scoped-eslint.log`). Further design/generated-document/called-route gates await final public route closure; new scoped behavior and runtime acceptance remain unverified.

Purchase codec follow-on: five pure unmounted files now validate the actual request/operation/preview/apply contracts without HTTP calls or a UI switch. Fresh full Tenant TypeScript and exact five-file ESLint **PASS**, exit0 (`13-tenant-purchase-codecs-correction.log`, `13-tenant-purchase-codecs-eslint.log`), after correcting a missing parenthesis and removing an unreachable duplicate adoption comparison. The initial exact operation guard still rejects adoption from an ADD/CHANGE/REMOVE preview. No new test cases or runtime acceptance; durable operation and public route cutover remain prerequisites.

User scope reduction accepted: Backend, Admin Portal and Tenant Portal only. Mobile and Partner implementation/tests are excluded; their readiness is not a release blocker. No such projects or existing shared security checks are deleted.

Read-only receipt/status follow-on, **2026-09-09**: actual 25/04/09 reader/controller/Gateway closure now permits the mounted Tenant operation and saved-receipt deep links. Verified COMMITTED status supplies the exact preview and preparation pins to the unchanged nine-field receipt reader. The UI distinguishes original financial/PENDING facts from current saved operation progress; it does not reconstruct a preview or mount a purchase write. The outer financial cap remains 4 MiB, with a separate 65,536-byte receipt-data check. The new hooks, pages, canonical transports, parser refactor, translated copy and narrow navigation admission await task 13's next static packet. Earlier five-file PASS predates this source delta.

## Delivery sequence

1. Verify canonical Gateway, controller/guard and closed response contracts. Implement negotiated five-singleton scoped read adapters and hostile-response tests first. Keep Company, Branch, Application and qualified Addon identities explicit and tied to the requested target.
2. Build the scope-management read workspace using the existing design-system barrel, exact Arabic/English dictionaries, loading/denied/not-found/unavailable states and scope-fenced hooks. Preserve revision `"0"` only when returned for an absent exact resource. Activation is an observation, never an operational-use grant.
3. Consume source-backed assignment/list/activation/configuration mutations as Access track freezes them. No guessed list routes, arbitrary JSON configuration editor, hidden scope escalation or optimistic use grant.
4. Adopt actual Tenant V2 subscription/items/offers and then prepare/preview/apply/status/adoption contracts from Commercial track. Preserve current V1 owner-only self-service until its negotiated successor is actually available. Display exact server monetary strings and bracket breakdowns; never calculate financial truth in the browser.
5. Finish navigation, state invalidation and permission gates; run scoped validators/hook/component tests, typecheck/lint/RTL/docs/build gates and coordinated authenticated browser checks. Report backend-dependent gaps rather than fake completion.

## Source-verified first packet

Verified 2026-09-07 from Gateway `core-addon.route-contracts.ts` / route resolver and Core `tenant/application-access/application-access-read.{controller,contract,transport,swagger}.ts` (service validation continues with implementation).

Five canonical GETs, all `x-commercial-contract-version: 2`, no body/query or Company/Branch selector headers:

- `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey`
- `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey`
- `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey`
- The Company and Branch Addon paths above with `/configuration` suffix.

Read authority is explicit ANY of `applications.activation.read/manage` or `applications.configuration.read/manage`, plus actual current tenant/exact-scope checks and the current owner administrative exception. A Branch grant does not imply Company-wide authority. Responses are Core envelopes containing `contractVersion:2`, `scope`, `target`, `resource`, `source`, and `operationalUse:"NOT_EVALUATED"`. The response version header must match. Canonical scope identifiers may be existing UUIDv4/v7; new intent IDs remain UUIDv7. Qualified Addon ownership is validated independently from the base-key64 grammar.

The safe configuration registry is currently empty. `NOT_CONFIGURED` with null current version is the supported success. A configured definition without an installed typed projector returns503; no unregistered keys/values are displayed.

## Coordination / dependencies

- Access & RBAC chat `01a07d2e-6b4a-7163-a563-03626f53b637` is implementing first lists and exact management receipts. No such mutation is assumed available yet.
- Commercial APIs & Billing chat `01a07d2e-682c-7672-b159-9bf37089c96f` prioritizes real Tenant V2 current selection/offer reads, then public commands. Existing Admin shape is not proof of Tenant authority.
- Coordinator `01a0793f-1c93-7ae2-ae43-92bc9e8d21f3` owns shared deployment and browser scheduling. Tenant Portal remains port5002, existing cookie transport only.
- UI/UX Pro Max generic design-system result suggested marketing/glass patterns that do not fit the established product. Existing repository design tokens, density, no-glass rules and accessibility contract remain authoritative; no token/font/theme replacement is planned.

## Verification

First packet: closed request/response schemas, negotiated Core response reader and five exact read adapters implemented. `pnpm exec vitest run 'src/app/(tenant)/core/application-access/application-access-contract.test.ts'`: **51/51 passed**, 10.19s. These are isolated frontend contract tests, not live server acceptance.

Scoped deep-link detail, identity-fenced read hook and bilingual read-only state display are in progress. `PermissionGate.denied` is additive so an actual403 overrides advisory `/auth/me` permissions. There is no list-discovery/mutation claim. Access track froze first lists but has not yet handed over enabled source-backed transports.

Initial typecheck found the repository targets pre-ES2020 syntax; bigint literal replaced by `BigInt(string)` without loss of precision. Recheck pending. No source in backend or the frozen `axiosClient.ts` transport was changed.

### First read packet checkpoint

- Full scoped contract/hook/deep-link/PermissionGate and static route-reader tests: **85/85 passed**; standalone TypeScript check passed. Scoped lint and RTL passed; no arbitrary physical direction utilities in1255files.
- `pnpm build`: **exit0**, Next16.2.11 webpack compile55s, TypeScript35.8s,95static pages, dynamic `/core/application-access/[...target]` included. Build slot released to coordinator. No authenticated browser acceptance.
- `pnpm build:budget`: passed; shared526.6/600kB, largest1402.5/1500kB,total5810.8/6144kB; no feature code in shared chunks.
- Route generator repaired using bounded static AST interpretation for imported route arrays, spreads,Object.freeze and literal tuple map functions. Backend code is never executed. Transitive source hashes are included. Generated613Tenant routes; generated API references, DTO and errors updated only through scripts. Static-reader hostile fixtures are tested.
- `docs:check` subgates passed through anchors; final metadata checker initially rejected target page's missing explicit source-date marker, then passed after the narrow five-read date was recorded. `docs:verify-called-routes` initially could not resolve composed suffixes; five explicit canonical templates preserve identical requests and now all195called paths are contracted/documented,0fabricated. Static reader's reserved local name was renamed; scoped lint passed.
- `pnpm knip`: **not green** from8pre-existing unused exports/types in CRM Lead/contact and shared audit files. None are this track's new scoped files; unrelated user work is preserved. Existing config hints are also reported. This is not a clean full `pnpm verify` claim.
- After the build, only semantically identical API template spelling and static-script local naming were corrected; targeted gates cover them. No second production build launched.

Next packet: Access lists have frozen service/DTO source, but Gateway/controller acceptance is pending. Commercial Tenant V2 detail/items passed realPg10/10 according to owner handoff; Gateway negotiation is being integrated by coordinator. Implement parser/UI locally but keep actual client cutover separate until that handoff. Offers, mutations, assignments and adoption remain future packets, not complete.

### Coherent nine-GET packet — accepted source, wired UI

The previous next-packet dependencies for two scope lists and two Tenant subscription reads are now resolved by source handoff. All seven Company/Branch reads and both negotiated subscription reads are wired. Company/Branch scope discovery uses existing session identities, with an exact owner exception confined to this navigation item; inherited Branch base rows never link to a Company management route. Subscription detail/items must agree in identity, revision and collections before any financial display. Confirmed Application and Addon charges, independent base allowance, legacy evidence and recorded operational observations remain separate.

- Targeted contract, lifecycle, navigation, presentation and static-reader suites: **166/166 passed**,13files,23.95s. Includes12directory lifecycle/pagination cases and3legacy-plan admission cases. Arabic/English presentation verifies retained revoked evidence and four-place unit prices.
- TypeScript and scoped ESLint passed for the production packet. RTL clean1272files; design census clean1273files. The same8unrelated pre-existing CRM/audit knip findings remain; none belongs to this track. No full repository verify claim.
- `docs:check` passed all subgates and metadata;197called paths all contracted/documented,0fabricated. Generated Tenant route inventory615at that checkpoint. Source inventory can advance as other tracks land routes.
- Coordinated next `pnpm build`: **exit0**, compile59s,TypeScript36.5s,96static pages; root/catchall Application-access routes included. `build:budget` passed: shared526.6/600kB,largest1402.6/1500kB,total5846.8/6144kB,no feature code in shared chunks. Slot released to coordinator and Admin. Only additional tests were added during this build, no production source changes.
- No authenticated browser acceptance. No new financial or scope-management write calls. Existing supported V1 base-only increase is disabled for any Addon-bearing selection, collection hold or unsupported lifecycle; the hook also refuses requests when that admission disappears.

### Next bounded packet — published offer explorer

Read the real Commercial offers contract, controller, service, transport, query and normalized ladder validator. Target is a read-only, owner-gated published Application/Tier and Addon explorer with pagination, an optional source-backed Application/Tier filter, exact independent MONTHLY/ANNUAL ladders and explicit preparation-required/unavailable/incompatible/parent-required explanation. Configured zero is valid; missing prices never become free. There is no browser-generated quote, purchase action or implied readiness. Prepare parser and hostile tests first; wire the canonical GET only after coordinator's Gateway acceptance handshake. Later assignment/activation/configuration commands and adoption remain separate unfinished dependencies.

### Ten-GET source freeze — published offers mounted

Coordinator accepted exact offers Gateway source after135focused tests, source/strict TypeScript and lint; Commercial final35pure/actual-HTTP tests and Core module/bootstrap hooks were accepted. The tested explorer is now mounted at `/core/subscription/catalogue`, linked in owner-only billing navigation and the Subscription page. Q25's discovery gap is resolved, not its prepared purchase workflow. The existing V1 adapter is still limited to its supported base-only increase; no purchase/adoption writes were enabled.

- **261/261 tests passed**,22files,42.38s: catalogue packet plus prior reads and existing Tenant route/title/NavMenu regressions. The two actual Branch table render tests prove inherited Company base facts have no Company detail link and actual denial reveals no rows. Offer tests cover dynamic non-example values, missing vs zero, exact filters, owner/session races and bilingual render.
- TypeScript and scoped lint passed; manual callback wrappers causing React Compiler dependency diagnostics were removed, without disabling a rule. RTL/identifier/sibling-key/design-census gates passed. `knip` still reports only the same8unrelated pre-existing exports/types.
- `docs:check` and called-route verification passed after actual source generator refresh:617routes,198called paths all contracted/documented,0fabricated. The new617th backend route is the separate assignment read, not yet called by this portal.
- Next approved production build completed **exit0**: webpack44s,TypeScript26.9s,97static pages, `/core/subscription/catalogue` included. Budget passed shared526.6/600kB,largest1404.9/1500kB,total5873.6/6144kB,no feature code in shared chunks. No source edits during build; slot released to coordinator/Admin. No authenticated Tenant acceptance.
- UI/UX skill's targeted web search supported complete status text and visible keyboard access; native disclosures and wrapping source/status text use the repository's existing tokens. No new design language or hardcoded product data.

### Next assignment-read packet — design before source

Access source eighth GET is accepted after46actual PostgreSQL/HTTP tests; final Gateway handshake is pending. The actual16-field per-user read has been inspected in controller/service/Swagger/transport. Preserve existing canonical parent/user UUIDs, UUIDv7 assignment/Addon/selection/definition IDs, exact positive revision strings and selected-local-definition semantics. Only live local assignments are returned, not prices, quantities, other users, profile data or an operational grant. Inactive existing targets remain readable for cleanup.

Plan: reuse bounded closed pagination and request/response fencing; add a standalone exact-user read under Application access and an independently permission-gated link from existing User detail. Its route must not require user-profile permission in addition to the actual addon_seats ANY pair/current owner. Discovery can use the signed-in user and already-authorized User navigation; do not invent a user-list route or display metadata the response does not contain. No assignment/removal button until the actual command and receipt handoff is accepted. Mount only after coordinator's Gateway acceptance, after this build finishes.

### Eleven-GET source packet — exact-user allocation read mounted

Coordinator accepted the assignment Gateway row after144focused tests, source/strict TypeScript and lint, including source route parity. Its existing-user UUID1–8 grammar, closed pagination and16-field projection remain unchanged. After the previous build was released, the frontend added:

- `/core/application-access/addon-seats` for the authenticated account's exact local assignment read and `/core/application-access/addon-seats/:userId` for an explicit existing target.
- Independent Addon seat navigation requiring the exact addon_seats ANY pair or current owner, plus a separately gated link from existing User detail. No user-profile permission is required by the standalone screen; Browse users is separately gated by users.user.read.
- Shared identical Access page-envelope/pagination validation reused by both scope lists and allocations. Existing list15tests passed after extraction. No changes to the frozen cookie transport or backend.
- Allocation wire/transport21tests, dedicated lifecycle9tests, additional nav1test and actual bilingual render3tests passed. Entire Access group144tests passed before the3new renders. TypeScript, scoped lint, RTL1298files, identifier1298, sibling-key687, design-census1299 and palette contrast passed.
- Generated617-route inventory and all documentation checks passed;199called paths are contracted/documented,0fabricated. `knip` still reports only the same8unrelated pre-existing CRM/audit exports/types. Current full Tenant regression is running; a new production build has been requested, not yet claimed.

Full regression checkpoint: **2937/2938 tests passed across277files**,393.27s. The only failure was the old exact owner-menu expectation with three entries; it was updated to include the accepted owner-only Catalogue entry while preserving exact ownership checks. No production code changed for that failure. The complete affected read/navigation/Core-settings regression then passed **300/300tests across26files**,52.02s, followed by TypeScript, lint and docs/199called-route checks. This is the full-run result plus its verified correction, not a claim that a second full run occurred.

Approved eleven-GET `pnpm build` completed **exit0**: webpack46s,TypeScript33.1s,98static pages, both Addon-seat routes included. Budget passed shared526.6/600kB,largest1404.9/1500kB,total5887.0/6144kB,no feature code in shared chunks. No production source edits during build; slot released to coordinator and Admin for its upcoming invoice packet. Current Tenant invoice V2 is not accepted and was not enabled. Authenticated browser acceptance remains pending a genuine authorized Tenant session and fresh Core/Gateway deployment.

No assignment/removal, activation/configuration, prepared purchase/apply or adoption writes are enabled. All eleven reads are source-backed, not a live authenticated Tenant acceptance. The remaining FE05–08/11/13 command work depends on those accepted owner contracts; the current read checkpoint does not close whole plan tasks.

First-assignment dependency is explicit: the live child list cannot provide absent-child allowance/parent compare-and-set preconditions. Root approved a separate exact-user options read, still source/transport pending. Never substitute activation revisions, invent revisions0/1, silently expand the frozen sixteen-field list or treat stored local readiness as an operational grant. Await the actual options/command acceptance before client implementation or action enablement.

### Tenant invoice follow-on — preparation only, 2026-09-08

Coordinator approved preparation of the exact shared InvoiceReadV2 parser and read-only presentation. The existing Tenant invoice GET continues its current V1 request: explicit2 is **held** until Commercial real-PostgreSQL acceptance and coordinator Gateway/image handoff. This does not change invoice payment routes, payment DTOs or collection authority.

Read the actual Gateway row, Tenant controller/guards/service/transport, shared retained invoice contract/OpenAPI, accepted invoice source, quantity rounding and accepted price validators. Implement in this order: this documentation, closed envelope/header/line validation with exact target and decimal consistency, reusable bilingual retained evidence presentation, hostile contract and real component tests. No database or backend changes belong to this track.

COMPLETE invoices retain separate Application/Addon identities and accepted user counts; quantity1 is an invoice-line quantity, not a user count. Historical nested pricing may remain LEGACY_UNAVAILABLE even when identity evidence is COMPLETE. Wholly legacy/manual invoices retain null identities and no invented catalogue labels or current-price reconstruction. Original invoice currency, USD settlement amounts and amounts paid must remain distinct; V2 does not return an outstanding amount and the browser must not manufacture one.

The prepared parser/components may initially be referenced only by tests while the explicit read switch is held; this is a temporary acceptance boundary, not a live or complete billing migration. Targeted tests are authorized. No broad build, authenticated browser or all-plan completion claim is made.

Preparation checkpoint: **96/96 targeted tests passed across4files**,61.59s, including64new invoice cases and32previous accepted-price/subscription regressions. TypeScript and scoped ESLint passed after replacing an unproved translation key with a new bilingual key. RTL1303files, identifier1303, sibling-key689, design-census1304, scoped diff check, documentation metadata/anchors and199called-route verification passed. No new live API call was added. Two additional precision/bounds cases and stronger balanced duplicate fixtures are being checked next.

Commercial's later handoff reports **17/17 actual PostgreSQL tests passed**,21.440s, including current owner/session, original reads, retained V1/V2, foreign-tenant404 and owner transfer. This resolves the real-Pg prerequisite only; coordinator Gateway/image handoff and authenticated Tenant browser acceptance remain outstanding. The source packet remains unmounted and no production build was started.

Final preparation regression: **98/98 tests passed across4files**,12.03s. Added the exact200/201line bound and maximum numeric(18,4) precision, and strengthened duplicate identity cases so their totals remain balanced. Scoped test lint and documentation metadata/anchors passed again. No additional production code changes after the successful TypeScript/markup checks. Ready for coordinated read cutover; current live GET and payment mutations remain unchanged.

### Assignment options parser — preparation, 2026-09-08

Access handed over53owner-proof/3actual-HTTP acceptance and the ninth Core GET registration. Gateway row/deployment remains pending. Read the actual controller/guards, options service, closed Swagger, installed pagination and source tests. Prepare only the distinct sixteen-field options parser and hostile tests: genuine nullable parent/child CAS pins, exact allowance revisions, inactive targets and six non-authoritative diagnostics. No live request, new route/navigation, assignment action, permission invention, backend edit or production build. This preserves the frozen live-assignment list and avoids guessed first-assignment revisions. Coordinator has been notified of this bounded preparatory work while invoice read cutover remains held.

Options preparation passed **122/122 tests across3files**,2.27s:50new options cases plus72existing live-assignment/scoped contract regressions. TypeScript, scoped ESLint, documentation metadata/anchors,199called-route verification and scoped diff-check passed. The identical positive revision schema is reused by both assignment parsers through the existing Access schema export; live requests/shapes are unchanged. No new endpoint call, build or authenticated test occurred. Parser/types are intentionally preparation-only until the coordinator's route/deployment handshake, as with the invoice evidence packet above.

### Invoice enable handoff — accepted, 2026-09-08

Coordinator accepted new live Core/Gateway images, native Tenant invoice owner/header hooks, Tenant17actual-Pg/26HTTP, root195Gateway and six unauthenticated alias/privacy checks. Invoice GET explicit2 may now be enabled; Options adapter remains held. Plan: existing fetch cutover, no V1 fallback, actor/session/owner/target/refresh-fenced hook, retained card and unchanged payment DTOs. Payment subtree mounts only behind a valid invoice/owner boundary and is keyed across sessions/targets. No independent tenantId exists in AuthContext: root confirmed exact invoice selector plus authenticated host/session/actor and backend tenant-owner isolation; never echo a response ID into its own expected value. Optional independently known tenant matching stays supported.

Runtime probe has exited and released the CPU hold. Admin invoice build is first, Tenant second; direct queue handoff is required. Current control plane has zero tenants, so automated checks are not authenticated Tenant browser proof.

Invoice mounted checkpoint: **142/142 targeted tests across8files passed**,19.15s, covering all Billing tests plus existing subscription/accepted-price regressions. Exact V2 cookie adapter, no-fallback/invalid-selector cases,16owner/session/target/lifecycle cases and5workspace admission cases passed. TypeScript and scoped ESLint passed; the hook permanently retires a previous snapshot on context change, including A→B→A. Existing payment DTOs and quote/intent/status logic are unchanged; currency-picker state moved into its existing hook and the payment section mounts only after invoice validation. The superseded InvoiceLinesTable source was removed because retained detail now owns both historical and complete line rendering; recoverable from Git history, no user records removed.

RTL1308, identifier1308, sibling-key691, design-census1309 and palette contrast passed. Generated route/API/DTO/error references were refreshed from actual source:618routes(Core207). Admin explicitly released its successful build slot; Tenant production build is next after final docs gates. No source edits are permitted during that build. Options read has also received root204Gateway acceptance but will mount after this invoice handoff to avoid delaying it; no assignment writes are accepted yet.

Invoice production build **exit0**: webpack35.1s,TypeScript27.8s,98static pages. Budget passed shared526.6/600kB,largest1404.9/1500kB,total5882.7/6144kB,no feature code in shared chunks. No source edits occurred during the build. Slot was released to coordinator/Admin. All docs checks and199called-route checks passed before build; knip remains only the same8unrelated CRM/audit findings. No authenticated Tenant browser or full-suite/whole-plan completion claim.

### Options read mount — accepted follow-on

After the invoice build handoff, mount the accepted ninth scoped GET (root204Gateway,53owner/3HTTP) as a read-only tab inside the existing Addon-seat workspace. Read and verified the actual Gateway exact options row. Reuse the prepared sixteen-field parser, canonical cookie adapter, bounded page data, source-specific UUID/revision rules and current actor/session/permissions/target/refresh fencing. Existing assignments remain the default tab; the options read mounts only when selected, with independent pagination and no extra profile requirement. Existing Radix design-system tabs supply focus/keyboard/RTL behavior. The UI shows genuine nullable pins and inactive/denied/unready/pending local diagnostics without implying ELIGIBLE or accepting a write. No ASSIGN/REMOVE button or fabricated revision.

Options mount verification: **212/212 tests across14Access files passed**,40.33s. Includes52options parser/transport tests,9new options lifecycle cases and4bilingual/tab/admission renders alongside existing scoped/assignment regressions. TypeScript and scoped ESLint passed. RTL1314,identifier1314,sibling-key695,design-census1315,docs metadata/anchors,diffcheck and200called-route checks passed. Both existing Addon-seat routes now use the tab workspace; no new route or profile permission was added. The native tabs test verifies that an unopened options panel makes no read and switching away unmounts it. A fresh options production-build slot has been requested; the prior invoice build remains separately verified.

Approved options production build **exit0**: webpack31.4s,TypeScript27.4s,98static pages. Budget **passed**: shared526.6/600kB,largest1404.9/1500kB,total5888.8/6144kB,no feature code in shared chunks. No source edits during build; build and budget slot released after both exited. Full docs checks passed with618routes and307anchors before build; knip still has only the same8pre-existing unrelated CRM/audit findings. No new all-portal full-suite, authenticated Tenant browser or complete-plan claim. Thirteen source-backed read integrations are now mounted; all new assignment/removal, activation/configuration, prepared commercial and adoption writes remain gated pending their accepted contracts.

### ASSIGN/REMOVE receipts — response-only preparation

Coordinator authorized the frozen LLD43 section8.0.3 nine-field response codec,
hostile tests and interaction design only. Read exact Core contract, receipt
owner, per-route Swagger/controllers and both services; Access independently
confirmed POST201/ASSIGN_ADDON and DELETE200/UNASSIGN_ADDON. Documentation is
updated first in [Addon assignments](../api/addon-assignments.md).

Implement a pure parser with exact envelope/data keys, explicit2, per-kind
status, UUIDv7 IDs, positive bigint revisions and original canonical UTC time.
REMOVE matches an independently known assignment target; ASSIGN does not invent
one from selection/allowance. Preserve historical no-op/replay facts without
treating them as current state or authority. Interaction design uses existing
manage/current-owner gates, explicit confirmation and unchanged original intent
on uncertain outcomes. No write adapter, request DTO, mounted button, eligibility
contract, production build or backend mutation is authorized in this packet.

Completed response-only checkpoint: **304/304Access tests across15files passed**,
13.74s, including92new hostile receipt cases. Initial165targeted tests passed
before the full scoped regression. TypeScript and scoped ESLint passed; full
docs618routes/307anchors and200called paths passed. Scoped diff-check passed.
Knip remains only the same8pre-existing unrelated CRM/audit findings; the new
codec/tests add none. Original terminal receipts are frozen, have exactly9fields,
and reject prototype/accessor/unknown-field payloads before consuming them.
No write DTO/transport, new button, eligibility inference, backend mutation,
production build or authenticated Tenant claim was introduced. All processes
exited; no build slot or browser ownership is held.

### ASSIGN/REMOVE production UI preparation — resumed by coordinator

Implement actual command adapters, reusable row-context dialog/panel, hooks,
bilingual copy and focused tests under Tenant only. Access confirmed the exact
four-field POST body, two-field bodyless DELETE query, version2/original UUIDv7
key,201/200 receipts and current-authorized original-intent replay semantics.
The API page documents the source contracts before code. Existing reads remain
unchanged. New write entry points stay unmounted until root's Core/Gateway/
permit-invalidation acceptance; no generic feature flags or unavailable live
networking. Production build remains unscheduled. Preserve original intent
through existing refresh/reauthentication, with no credentials or authority in
client recovery state and no automatic new-key retry after uncertainty.

Concrete preparation now includes exact closed command transport, feature-local
original-intent storage/draft codec, fenced command hook, native dialog and an
independent per-user local recovery section. Recovery has no dependency on a
current server row, so an original removed child can still be retried. Root
approved schema-validated non-secret sessionStorage and the narrow first-definite
stale-CAS rejection exception; all restored/previously uncertain attempts retain
their original request through denial or expiry. Failed storage reads are not
absence and never overwrite an unresolved original.

First expanded verification: **63/63tests across4new files passed**,35.71s,
including real browser-tab storage and real bilingual/light-dark component trees
with the actual request/receipt codec. TypeScript and scoped ESLint passed after
correcting hostile-test fixture discriminant typing; no production type failures
or disabled checks. Additional session-refresh/unmount/race cases and the full
scoped Access regression are next. No write entry point or production build has
been enabled; thirteen existing reads/workspace tabs are unchanged.

Final preparation receipt: **371/371Access tests across19files passed**,17.05s;
67new cases cover exact transport, real sessionStorage failure/corruption/isolation,
current manage/owner/session gates, original-intent retry, first-definite409 vs
prior-uncertain409, cancellation/focus, bilingual/light-dark component trees,
malformed2xx, no-op, self-refresh failure, stale responses, unmount and recovery
of the original removed child without current-row membership. Final TypeScript
and scoped ESLint passed. RTL/identifier1326,sibling-key699,census1327,contrast
and scoped diff-check passed. Knip remains only the same8unrelated existing
CRM/audit findings; no new ones.

Full docs checks passed618routes/307anchors. Called-route verification is
**not green**:201source paths,200registered/documented and the unmounted DELETE
assignment path absent from Gateway. Its exact dependency is recorded in Q136;
the POST method is held too despite sharing the existing GET path. Neither
checker nor backend was modified to bypass the coordinator's integration gate.
Import inspection confirms both command entry components are only reached by
their preparation tests/internal composition, not a live workspace or page.

Owned packet files under `src/app/(tenant)/core/application-access/`:

- `application-addon-assignment-command.ts` and `.test.ts`.
- `application-addon-assignment-intent.ts` and `.test.ts`.
- `hooks/useAddonAssignmentCommand.ts` and `.test.tsx`.
- `hooks/useAddonAssignmentRecovery.ts`.
- `components/AddonAssignmentCommand.tsx` and `.test.tsx`.
- `components/AddonAssignmentRecovery.tsx`.

Additive `src/i18n/dictionaries/{ar,en}.ts` copy and the three own API/plan/Q136
documents complete this packet. Existing receipt/options/list contracts and
thirteen live GET integrations are unchanged. No production build was run or
requested; no authenticated Tenant, full-portal or whole-plan completion claim.
All processes exited and no build/browser/DB slot is held. Ready for root's
actual write integration release and scheduled final verification.

### Bounded read-state composition preparation

Root received the371-test packet and authorized only an unmounted feature-local
read-state composition adapter and genuinely missing integration tests. Inspect
the existing AddonSeatWorkspace and both exact-user read hooks; reuse their
current state and prepared command/recovery components without another fetch
owner or state machine. Document private requested-user/snapshot identity,
view-only/manage split, stale selection/empty-target binding, and inaccessible
versus restored local recovery before implementation.

Two bounded correctness fixes belong to this composition: the assignment read
gets the options hook's existing permanent A→B→A retirement guard, and temporary
same-session refresh no longer unmounts a pending local-recovery command owner.
Its interactive command UI/submission remains suspended until current authentication;
real actor/session/target replacement still retires it. Existing thirteen wire
contracts, live pages/imports/routes and unmounted-write release gate are intact.

Implemented `AddonSeatCommandPanel` using only the accepted read result and
prepared commands. New accepted snapshots also rescan original local recovery
records without rebinding an existing recovery command owner. The validated
current-context receipt now raises the existing bilingual success toast before
read refresh can retire its row. No-op copy describes the original command;
stale/malformed responses cannot report success. This follows the existing
design-system feedback contract and UI/UX Pro Max interaction guidance, without
introducing another state machine or feedback component.

Final bounded receipt: **387/387 scoped Access tests in20files passed**,18.64s;
16new composition/read-retirement cases supplement the371-test command packet.
They cover view-only/manage/current owner, exact removal CAS, stale selection
before and during send, old empty-target binding, read401/403/404 versus503,
restored empty-list recovery, self-assignment/removal refresh ownership and
success feedback after row retirement. Final TypeScript/scoped ESLint passed;
RTL/identifier1328,sibling-key701,census1329,contrast and scoped diff-check passed.
Docs checks passed618routes/307anchors. The same called-route dependency stays
red:201paths,200registered, prepared DELETE absent. No live workspace/page
imports the adapter. No build, backend/database/browser mutation or authenticated
acceptance is included. Ready for the coordinator's exact write-enable handoff.

Final Knip rerun remains the same8pre-existing unrelated CRM/audit findings
(3exports,5exported types); none is in this owned composition/command packet.
No gate was suppressed and all verification processes exited.

Coordinator's final composition review accepts historical success feedback for
the same non-retired owner while authentication is still `REFRESHING`. Clarify
interactive UI/submission suspension, not suspension of terminal feedback. The
existing refresh test now resolves the valid request during that state and
checks one success toast, no new open/send, and the same retained receipt after
authentication resumes. Existing retired-context no-toast assertions remain.
No production behavior or pending-toast state is changed by this clarification.

Clarification verification: the scoped command-hook file passes23/23tests,
13.31s; strict TypeScript (`tsc --noEmit --strict`), exact-file ESLint and scoped
diff-check pass. One existing test was strengthened, so the suite inventory
stays387; the whole Access suite was not rerun for this test/docs-only follow-on.
This composition packet is frozen pending the coordinator's integration release.

### FE07 — Branch DISABLED confirmation preparation

Root authorized a separate small unmounted restriction-only UI while assignment
write mounting remains gated. Access owner confirmed exact Branch scoped
activation.manage/current DB-owner authority, observed override revision only,
required real reason, hidden parent-binding prerequisites and narrowing through
deny/adoption without altering retained pins. Document these boundaries before
implementing a feature-local dialog/callback over the existing accepted Branch
read. No suitable restriction dialog exists in this workspace; compose existing
Dialog/Field/Identifier/Button primitives, not a new generic modal framework.
Keep network DTOs/endpoints, INHERIT/restoration, live page imports and all other
portals out of scope. Verify EN/AR, light/dark, cancel/focus, exact context,
read-only/manage, stale409 reread/reconfirm and stale callback retirement.

Implemented `components/BranchAddonRestriction.tsx`, its EN/AR/light-dark DOM
tests and `hooks/useBranchAddonRestriction.ts`. These consume the existing
read hook result plus a local callback, not a command body or transport. A real
reason is collected and validated without silent trimming. Scope identifiers
and exact observed override revision are visible in the native dialog; its
provisional copy explains hidden parent-binding/current-authority checks and
preservation of existing pins. Read-only callers get no write UI; observed
DISABLED gets no restoration/fresh-action control. Source/readiness/adoption
diagnostics do not create positive or negative eligibility claims.

Private read request/snapshot context and permanent A→B→A retirement prevent an
old scope from being reused before a new read. Local confirmation owners retire
on actual context replacement; current same-session readiness additionally
guards handlers without rebinding an in-flight local handoff. Pending actions
block duplicates/dismissal. Generic stale409 requires reread/reconfirmation and
a newly entered reason. Unknown callback outcomes expose no retry/replacement
control; eventual authoritative integration must retain immutable original
commands separately. No applied-success toast or fake receipt is emitted.

Verification: **426/426 scoped Access tests across21files passed** on2026-09-08,
39new cases over387. Initial focused43/43 passed16.26s; expanded scoped run passed
19.28s. Strict TypeScript and scoped ESLint passed. RTL/identifier1331,
sibling-key703,census1332,contrast and scoped diff-check passed; standalone
anchors307 passed. Knip remains the same8unrelated CRM/audit findings. The latest
`docs:check` was **not green at that point**: it stopped because the shared generated route
inventory became stale during parallel backend/Gateway work. The coordinator
was notified; no generated route or source check was altered for FE07. No build,
live import, browser/database/Docker operation or authenticated completion claim.

Final handler-guard regression rerun:426/426tests in21files passed16.60s; strict
TypeScript and exact-hook ESLint passed. No verification process remains running.

The coordinator then authorized the official route generator against accepted
Gateway read metadata only. It generated the same618route inventory. The
downstream reference generator reads only that accepted inventory; refreshing
its three pages changed zero route rows (Core207,CRM160,Trade231 unchanged).
Final full docs checks pass618routes/307anchors. Called-route verification is
separate and remains red201source/200registered with exactly the earlier held
assignment DELETE path; no command was registered, no route omitted and no
checker exempted. The FE07 source/copy/docs packet is frozen for independent
review; it remains unmounted and callback-only.
