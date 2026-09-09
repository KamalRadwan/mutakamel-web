# Core — Scoped Application and Addon reads

Status: **source-verified; frontend read slice implemented; no authenticated acceptance**

Last source verification: **2026-09-09**. Owning app: **core-app**. See [current canonical delivery](catalogue-canonical-delivery.md) for mounted seat commands and Company Application/Addon activation plus Branch INHERIT/DISABLED commands. Their exact Core/Gateway source and verified-event dependencies are wired. The verified native browser public entry is adopted, and the mounted continuation consumer passed coordinated TypeScript, lint, existing tests, design/docs checks and production build. Authenticated runtime acceptance remains separate. Broader purchase and adoption behavior remains in [the target contract](application-addons-target.md).

## Verified routes

| Method | Canonical browser path | Explicit ANY permission pair |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/activation-commands/:commandId` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey` | `applications.activation.read` / `applications.activation.manage` |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration` | `applications.configuration.read` / `applications.configuration.manage` |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration-commands/:commandId` | `applications.configuration.read` / `applications.configuration.manage` |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey/configuration` | `applications.configuration.read` / `applications.configuration.manage` |

There is **no Branch base Application singleton**. Every route uses one closed canonical shape without a commercial version header or payload discriminator. No body or `x-mutakamel-company-id` / `x-mutakamel-branch-id` selector headers are sent. Singletons accept no query; the two lists accept only page(default1,max1000000) and limit(default20,max100). Requests use the existing cookie client through `readCoreResponse`; no transport-spine edits or direct service calls.

Verified in order: Gateway `core-addon.route-contracts.ts` scoped-read rows; Core `tenant/application-access/application-access-read.controller.ts`, transport/guards; `.contract.ts`, `.swagger.ts`, `.service.ts` and owning local/source validation. Current exact-scope/session authorization remains backend-owned. Owner administrative admission does not allocate an operational seat. Core permission keys are exact, not CRM suffix-matched; neither organization-discovery permissions nor Company appearance in `/auth/me` substitute for authority.

## Closed read boundary

Stored definition references use the owner's canonical lowercase RFC-variant UUID versions1–8 in both reads and activation/configuration command bodies. The command builders preserve those exact stored IDs instead of treating them as newly generated UUIDv7 identities. Command/idempotency keys and generated binding, configuration-history and receipt identities remain UUIDv7. This follows the actual `application-access-command.contract.ts` stored-ID correction; no route, permission, native status grammar or recovery payload changes. Current execution and authenticated runtime evidence for this narrow correction is recorded separately from the earlier continuation packet.

The Core success envelope is exactly `{success:true,data,correlationId,timestamp}`. Resource-singleton data is exactly `{scope,target,resource,source,operationalUse}`; command status has its dedicated shape below. Every structural object is closed. UUIDs preserve historical versions accepted by the owner; new intent IDs elsewhere still require UUIDv7. Scope, Application key, qualified Addon ownership and expected resource kind must match the requested route. String revisions remain exact through signed bigint maximum; absence is only server-issued `"0"` with null identifiers/state. Configuration accepts absence or a stored `NOT_CONFIGURED`/null version, and the actual stored `CONFIGURED` form with exact `currentVersion:{id,revision,definitionVersionId,schemaRef,configHash,values}`. Safe projected values are bounded plain JSON: 64 KiB, depth 10, finite numbers, no prototype/getter/function fields. Their business semantics remain the registered owner's responsibility. Missing owner projectors still return unavailable, never arbitrary raw values.

The current configured view displays saved version/definition/schema metadata and translated state, without interpreting safe output as editable fields. Binding generation (`resource.revision`, used as `expectedConfigRevision`) remains distinct from the immutable configuration history revision (`currentVersion.revision`). Task 13 passed full Tenant TypeScript, scoped ESLint and the three affected existing reader suites (115/115 tests) for the typed form/rank packet. The subsequent purchase/secret-free recovery packet passed full TypeScript, scoped lint and four existing suites (118/118); no new secrecy-specific case or live acceptance is claimed.

## Typed configuration authoring — source integration

Source verified **2026-09-09** from the actual 28 controllers/services, 08 input descriptor/registry/module/privacy/classifier and 09 Gateway rows. Both scopes use `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration` or the equivalent `branches/:branchId` path. PATCH uses ALL `applications.configuration.manage`, one original UUIDv7 key, no query/organization selectors, 256 KiB JSON, and the exact five-field body `{expectedConfigRevision,definitionVersionId,schemaRef,values,reason}`. `schemaRef` is `{key,version,checksum}`. Committed success is200 with the unchanged eight-field historical binding receipt and operation kind SET_COMPANY_CONFIGURATION or SET_BRANCH_CONFIGURATION. Company PATCH can instead return the actual202 continuation described below; Branch PATCH remains synchronous. Exact replay still rechecks current authority; it does not repeat audit/history/invalidation effects. Missing business registrations remain unavailable.

GET those paths plus `/input-schema` uses the independent ANY configuration.read/manage authority, no body/query/idempotency/organization selectors, and exactly `{scope,target,definitionVersionId,schemaRef,inputSchema}` inside the normal Core envelope. The outer response budget is 1 MiB; descriptor JSON is at most 64 KiB. This input descriptor is separate from safe configured values and carries no defaults or eligibility flags. Its exact scope, target and definition/schema must match the current configuration observation before a fresh review. Current binding CAS still comes only from the configuration GET.

`ConfigurationForm` is mounted only on the two configuration singleton pages. Its renderer uses the exact allowlisted object/array/string/number/integer/boolean vocabulary, required fields, enum labels, declared bounds and AR/EN UI labels/help. It rejects unknown schema keywords, code, patterns, references and unsupported shapes. Limits are 200 schema nodes, value depth 10, 100 properties per object and 100 array items; complete submitted values remain bounded plain JSON at 64 KiB. Arrays/objects and scalar values require explicit entry; no initial default or required false is synthesized. `writeOnly` strings use password input; their supplied values are hidden in review and safe read values never initialize inputs. Whole-value replacement and omission of optional fields are stated before confirmation.

The hook keeps reason, field validation and mutation handlers outside markup, binds review to both current snapshots, and retires drafts across actor/session/permission/target/read changes. Before dispatch it saves only actor/target/schema/binding CAS/original key and a SHA256 digest of the complete canonical command. Configuration values and the free-text reason never enter the journal, including nested password fields. The full command exists only in scoped memory. For an unknown outcome without a verified continuation reference, remount recovery requires the exact matching definition/schema form and full original values/reason re-entry matching the digest before same-key replay. A verified continuation instead uses its actual status GET without secret re-entry. No redacted body or replacement key is sent. Earlier same-actor/target local entries migrate to digest metadata without populating inputs or dispatching; corrupt payloads are scrubbed to an unavailable marker that blocks replacement. Receipt completion or verified retained202 clears secret-bearing state. Task 10 independently reviewed the earlier journal correction; task 13 passed that earlier TypeScript/lint and regression packet without adding secrecy-specific cases. These results predate the continuation consumer delta.

A definitive first-attempt ADDON_REVISION_STALE requires a fresh review; uncertain/restored outcomes keep the original intent. Current denial blocks submission while a separate recheck remains available. Historical changed/no-change receipt facts are separate from refreshed current configuration. No new tests, business schema registration, database action or authenticated runtime proof is included in this source packet.

## Company command continuation — mounted source

Company Addon activation and Company configuration PATCH now consume exactly200/COMMITTED or202/PENDING through the actual installed `@mutakamel/core-app-contracts/public/application-access` entry. Task13 verified native0.0.23 JavaScript/declaration bytes against its immutable npm archive and matching lock integrity;11 made no package/lock change. The dedicated activation and configuration parsers remain separate, and their shared committed receipt decoder replaces the two local receipt schemas. Company Application activation and Branch commands remain synchronous200.

Actual202 data has exactly `commandId,revision,state,operationKind,progress,operationalUse`, with PENDING, the correct SET_ADDON_ACTIVATION or SET_COMPANY_CONFIGURATION kind, progress `{pageNumber,validatedBranchCount}` as exact decimal strings, and NOT_EVALUATED. It does not confirm a change. Only this verified original reference enables the corresponding status GET listed above. A separate bounded browser record holds actor, original target/key/resource reference and last verified pending projection; no values or request reason enter it. An unknown PATCH without this reference still requires its unchanged original command for recovery.

Status GET requires the original actor, exact Company/Application/Addon and current ANY `applications.activation.read` / `applications.activation.manage` or the separate ANY `applications.configuration.read` / `applications.configuration.manage`. The current reader session may differ from the original execution session. Reads send no body, query, organization selectors or idempotency key, use private/no-store and a1MiB outer bound, and validate the shared16KiB data bound. Returned command IDs and known resource IDs are pinned; nonterminal revision/progress cannot regress. GET200 means a valid status: PENDING, REJECTED with a closed reason replacing progress, or the original eight-field COMMITTED receipt. Receipt operationId remains distinct from commandId. No current resource snapshot is treated as completion.

Manual status controls and original receipts sit outside mutation gates and singleton read denial, while retaining their own current ANY admission and actual403 denial. Actor/session/target changes retire observations and abort late requests. Status failures preserve the original. A rejection must have a strictly greater command revision than the verified pending observation, matching both actual owner writers; equal-revision rejection is inconsistent and cannot clear the journal. Actual rejection then resolves it and requires current read/review before another command. Confirmed commit clears the original journal and displays the historical receipt, whose operation revision is a separate identity. There is no automatic polling/retry, branch continuation route, secret re-entry for known pending status, or fresh key for an unresolved request.

Task10 independently reviewed the final corrected continuation boundary and found no additional concrete defect in its bounded review. Task13 verified this mounted packet with whole Tenant TypeScript, scoped Access/dictionaries lint, all428 existing Access/PermissionGate tests across22 suites (42.04s), RTL/identifier/sibling-key guards, official documentation checks and all210 called API paths. The production build exited0, including99/99 generated pages; all71 captured source/dictionary files remained unchanged through verification. Logs are `13-tenant-company-status-*`; these overlapping existing-suite counts are not added to earlier totals. No new cases, authenticated browser session, database action or live operational acceptance is claimed.

The frontend imposes a1MiB transport bound before JSON parsing for this compact current packet. Schema/header mismatches produce a safe unavailable boundary, not partly rendered data, a zero allowance or a grant. The error never incorporates unexpected keys/values. Actual403 renders `PermissionGate` even if session permissions said the read was allowed.404 is a distinct unavailable-target explanation. Other failures have an explicit retry.

## Read workspace and freshness

`/core/application-access` is now linked in Core navigation for the explicit activation ANY pair or the documented owner exception. It offers scopes already returned by `/auth/me`; those identifiers are discovery, not authority. It does not impose organization read permission or invent names. Existing authorized Company/Branch detail screens also link into `/core/application-access/companies/:id` or `/branches/:id`. Those directory screens page the exact list API and link to the existing singleton details. Configuration-read links require their independent advisory permission pair. Direct targets remain backend-authorized even when absent from current discovery.

List replies are closed paginated envelopes with `data[]` and exactly six `meta` fields(page,limit,total,totalPages,hasNext,hasPrev). Items have exactly scope,target,resourceScope,resource,observation,operationalUse. Membership is positive local allowances or retained bindings, not a fresh commercial/eligibility promise. Branch base rows are inherited Company activation with `resourceScope:COMPANY` inside the requested Branch scope; they are display-only and **never link to a Company singleton/mutation**. Branch Addons use Branch overrides. There is no client-side sorting or invented empty fallback; response pagination and target identities are validated before display.

The detail screen uses `/core/application-access/` followed by the exact singleton path target. It shows explicit identities, recorded binding, configuration metadata and source facts, never operational usability. Current scoped activation and typed configuration controls use their source-verified owners; no arbitrary JSON editor is exposed. Earlier Core seven-GET handoff passed 34 actual PostgreSQL cases for its original read snapshot. Deployed and authenticated checks for the current mutation packet remain separate and pending.

The hook fences results by exact target, actor, session generation, permissions, owner state and refresh attempt. Changing any fence hides previous facts before a replacement response is accepted. Unmount/scope changes abort pending reads; late responses cannot overwrite new scope facts. Manual refresh clears previous facts while loading.

Arabic/English labels use existing design-system primitives, logical layout and established themes. `PermissionGate.denied` is additive and overrides advisory grants only when its caller has an actual denial or lacks admission. Existing callers remain unchanged.

## Evidence

`pnpm exec vitest run 'src/app/(tenant)/core/application-access' src/design-system/patterns/permission-gate/PermissionGate.test.tsx`: **77 tests passed**, four files,23.83s on2026-09-07. Covers all five resources/absent and stored variants, exact paths/version headers, hostile shapes/revisions/scope substitutions, independent permissions, owner administration,403, session/scope switches, late completions and additive denied rendering. Typecheck passed before these new tests; final gates are recorded in [the track receipt](../plans/application-catalogue-frontend-track.md).

This is unit/contract evidence, not a real authenticated browser session. Current development scope is Backend, Admin Portal and Tenant Portal only; no Mobile or Partner acceptance is required by this task.

## Historical FE07 — local Branch restriction confirmation

The following dated packet predates the canonical command/recovery implementation described in [current delivery](catalogue-canonical-delivery.md). Its test totals are historical. The later implementation is now mounted after the actual scoped owner and Gateway source handoff; this earlier callback-only packet does not define the current transport.

Verified2026-09-08 with the Access owner and the unregistered
`branch-addon-restriction.service.ts` / existing command codec. This is local
confirmation preparation only: no new network adapter, DTO, Gateway route,
navigation or live page import. The callback receives the accepted Branch view
and a user-entered reason; it does not send that view as a command body or claim
a successful mutation. Existing scoped singleton reads remain unchanged on wire.

Only the existing exact Branch `BRANCH_OVERRIDE` read can seed this confirmation.
Current `applications.activation.manage` or owner admission is advisory; the
server still rechecks the exact Branch/applicable Company/Tenant authority,
current user/session and active scope. Discovery or a read-only permission is
not write authority. An observed `DISABLED` restriction exposes no restoration
or redundant fresh-action affordance. This component never offers `INHERIT`,
Company activation, configuration editing or tenant-wide widening.

Restriction can only reduce access. Existing definition/configuration/adoption
pins are preserved; first creation takes the retained Company definition and
does not copy its configuration/adoption pointers. Company-enabled booleans,
source readiness and pending adoption are not client eligibility gates. In
particular, the Branch read cannot prove the required retained allowances and
both Company parent bindings exist. Confirmation is provisional, not permission.

The observed compare-and-swap input is exactly `resource.revision`: explicit
server-issued `"0"` for `NOT_CREATED`, or the stored positive decimal string.
Never substitute a definition/configuration/allowance revision. The existing
owner requires a trimmed3..500-character reason with no control characters;
collect it from the user, never invent one. A generic409 `ADDON_REVISION_STALE`
requires a new accepted read and explicit reconfirmation, without diagnosing
which hidden pin changed. Unknown callback outcomes cannot be retried here or
reported as success; eventual integration must retain the original immutable
command/key and use the authoritative recovery contract.

Private requested/snapshot keys from the existing read hook fence local dialog
context; they are not DTO additions. Scope/session/actor/permission/read refresh
retires a prior review; same-session auth refresh suspends interactive submission.
No second read owner, operational grant, fake receipt or background retry is added.

Preparation evidence: full scoped Access suite **426/426tests in21files passed**
on2026-09-08, including39new restriction/read-retirement cases. Strict TypeScript,
scoped ESLint, RTL/identifier guards1331,sibling-key703,census1332 and both-theme
contrast passed. New component import inspection reaches tests only; the seven
existing scoped GETs/pages have no write entry. After the coordinator accepted
the parallel source-metadata changes, the official route/reference generators
refreshed derived documents. Reference route rows were unchanged:207Core,
160CRM,231Trade, each with zero row differences. Full docs checks now pass
618routes/307anchors. Called-route verification remains separately red at
201source paths/200registered: the earlier prepared assignment DELETE is still
absent; FE07 adds no route. No production build or authenticated UI claim.
