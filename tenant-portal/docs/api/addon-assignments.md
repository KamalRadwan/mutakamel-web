# Core — Exact-user Addon assignments

Status: **source-verified; reads and assignment/removal UI mounted; no authenticated acceptance**.

Last source verification: **2026-09-09**. Owning backend app: **core-app**. The [current canonical delivery record](catalogue-canonical-delivery.md) supersedes earlier dated preparation sections below: the exact Core and Gateway assignment/removal routes are registered, the seat command panel is mounted, and all current shapes omit commercial version negotiation.

## Accepted route and authority

`GET /api/tenant/core/v1/users/:userId/addon-assignments` requires genuine TENANT ANY `applications.addon_seats.read` / `applications.addon_seats.manage`, or the actual current tenant owner. A Company/Branch grant is insufficient. A user-profile permission is neither sufficient nor additionally required by this standalone read. The exact existing target may be inactive for cleanup; the server rechecks current actor, tenant placement and target authority.

Verified source order: Gateway `core-addon.route-contracts.ts` exact read rows and `core-addon-assignment-write.route-contracts.ts` exact write rows; Core `application-addon-assignment-read.controller.ts`, guards/shared list transport, `.service.ts`, `application-access-read.swagger.ts`, list contract and the registered assign/remove controllers. Prior test counts apply to their original snapshots; current verification is recorded in the linked delivery page.

Only path userId and page/limit query are sent on the read. Existing canonical UUID versions1–8 are valid targets. Page defaults1(max1000000); limit20(max100). No commercial version header, payload discriminator, request body, organization selector or read idempotency key. Response transport is bounded to1MiB, private/no-store, with the existing cookie client.

## Exact local projection

The current ASSIGN command body and its original-intent context accept `addonSelectionId` as the owner's canonical lowercase RFC-variant UUID versions1–8. It is a stored subscription selection reference, preserved unchanged through submission and recovery. Both list/options projections use the same grammar for stored `addonId`, `addonSelectionId` and `selectedDefinitionVersionId`, matching the corrected owning read services. New command/idempotency keys, Addon assignment IDs, allowance IDs and receipt/resource identities still require UUIDv7. No stored record is rewritten or assigned a replacement key. These corrections follow actual `application-access-command.contract.ts`, `application-addon-assignment-read.service.ts` and `application-addon-assignment-options.service.ts`; fresh executable and authenticated runtime verification remain separate.

The closed Core paginated envelope has success=true,data[],meta,correlationId,timestamp; at most100rows. Meta has exactly page,limit,total,totalPages,hasNext,hasPrev. Request pagination, item count and exact target match are checked before display. Duplicate assignments/Addons, unexpected fields, noncanonical money-like additions and invalid identity/revision shapes fail closed.

Each row has exactly fifteen fields:

| Fields | Meaning |
| --- | --- |
| userId | Exact requested user |
| assignmentId,assignmentRevision | Current live allocation and its positive signed-bigint revision |
| applicationId,applicationKey,addonId,addonKey | Parent identity and qualified owned Addon key |
| addonSelectionId,allowanceRevision | Current local allowance source, not a price or quantity |
| parentAssignmentId,parentAssignmentRevision | Existing base assignment; its historical canonical UUID need not be v7 |
| selectedDefinitionVersionId | Current local allowance selection, **not necessarily the original assigned definition** |
| assignedAt | Stored UTC timestamp |
| observation=LOCAL_PROJECTION,operationalUse=NOT_EVALUATED | Read facts, never a paid-use grant |

Assignment IDs require UUIDv7 as enforced by the owner. Stored Addon, selection and selected-definition IDs, as well as User, Application and historical parent-assignment IDs, use the owner's canonical lowercase RFC-variant UUID versions1–8. Revisions remain exact positive strings through signed-bigint maximum. The response contains no user profile, other users, history of removed seats, prices or quantities.

## Portal and freshness

`/core/application-access/addon-seats` shows the authenticated account's exact assignments under the independent administrative seat-read gate. `/core/application-access/addon-seats/:userId` supports an explicit existing target without forcing user-profile read permission. Existing authorized User detail links into that standalone screen when the independent seat pair/current-owner check permits it. The optional Browse users link separately requires the actual `users.user.read` permission; no new user-list route or made-up user metadata is used.

The table shows parent/Application/Addon identifiers, exact assignment revision, current selected local definition and assignment date. It explains tenant-wide authority and inactive-target cleanup. The mounted command panel exposes assignment/removal only under current management authority; no operational-ready badge is inferred. Changing actor,session,target,page,permissions,owner state or refresh hides old allocations immediately; requests are aborted and late completions ignored. Actual403 is denial, not an empty allocation table. Arabic/English labels and existing design primitives preserve theme/RTL behavior.

Earlier wire/transport and scope-list results are recorded in [the track receipt](../plans/application-catalogue-frontend-track.md). They are not authenticated Tenant browser evidence. Current canonical tests and mounted command status appear in the delivery record.

## Assignment precondition options — accepted read-only follow-on

Last source verification for this addition: **2026-09-09**. Core's separate
`GET /api/tenant/core/v1/users/:userId/addon-assignment-options` contract is
source-backed in `application-addon-assignment-options.{controller,service}.ts`
and `application-access-read.swagger.ts`. Its existing browser read is retained
as the independent options tab, with the mounted command panel consuming its
exact observed pins. Earlier owner/HTTP/Gateway totals describe their original
source snapshots; no current deployment claim is made.

The same exact-user TENANT ANY addon_seats pair/current-owner authority,
page/limit, private1MiB boundary and closed pagination apply. Fifteen
fields return `userId,targetActive,applicationId,applicationKey,
addonId,addonKey,addonSelectionId,allowanceId,allowanceRevision,
selectedDefinitionVersionId,parentAssignment,assignment,localState,observation,
operationalUse`. Each assignment pin is genuinely null or exactly `{id,revision}`;
an existing child requires an existing parent. Missing pins never become revision0/1.

`localState` contains exactly `parentReadiness,addonReadiness,parentDenied,
addonDenied,adoptionPending,capacityChangePending`; readiness values are READY,
NOT_READY or BLOCKED and **not an eligibility grant**. Inactive targets and
denied/unready retained candidates remain diagnostic. Membership is retained
positive local child seats or this exact user's live child assignment, but no
quantity, price, profile data or operational permission is exposed. Identity
rules match the existing list: User/Application/parent pin and stored
Addon/selection/definition references use canonical UUID1–8; allowance/child
pin IDs remain UUIDv7; revisions remain exact positive bigint strings.

Canonical parsing keeps this read separate from the accepted live-assignment
list and refuses cross-user rows, partial pins, extra fields, duplicate allowance
identities and mixed target-active observations. Assignment commands remain
independently authorized and must recheck current state at execution.

The existing Addon-seat workspace gains separate Assigned seats / Assignment
preconditions tabs. Only the selected panel mounts its read, preserving the
current-assignment default and independent pagination. Current auth/actor/session,
permissions/owner state, exact target and refresh fence every options response;
actual403 is a denial and not an empty list. Retained pins and six diagnostics
are presented in bilingual cards. The command panel consumes observed pins
under its separate management gate; diagnostics never authorize the command.
No profile lookup, price, quantity or operational eligibility is introduced.

Options follow-on verification:212/212Access tests passed, with TypeScript,
scoped lint, design/RTL, docs and200called-route checks. The coordinated
production build and bundle budget passed after invoice handoff. Full receipts
are recorded in the linked track page; authenticated Tenant browser acceptance
and write commands remain separate outstanding work.

## Historical assignment command receipts — response-only preparation

The following sections preserve the earlier response-only, command and composition handoffs. Their unmounted status, version fields and verification totals describe those historical snapshots. Current source uses the mounted canonical contract in [the delivery record](catalogue-canonical-delivery.md); do not implement the superseded negotiation or use these old totals as current acceptance.

The coordinator authorized a pure response codec and interaction design, not
network writes or mounted actions. Canonical LLD43 section8.0.3 and Core's
`application-access-command.{contract,receipts,swagger}.ts`, assignment ASSIGN
and REMOVE controllers/services were read; Access confirmed the same boundary.
Those command controllers remain unregistered. No request DTO, route admission,
eligibility endpoint or extra response field is introduced by this preparation.

The closed success envelope is exactly `success,data,correlationId,timestamp`;
correlationId is at most36characters and timestamp a date-time of at most30.
It requires response `x-commercial-contract-version:2`. The exact nine data
fields are `contractVersion,operationId,operationRevision,state,operationKind,
changed,resourceId,resourceRevision,completedAt`. Version is2, state COMMITTED,
both IDs are canonical UUIDv7, and both revisions are positive canonical
signed-bigint strings. The current receipt writer starts operationRevision at1;
the frozen response schema permits positive revisions, not only literal1.
completedAt is the original canonical UTC millisecond timestamp, preserved on
replay. The envelope timestamp can change independently. No additional byte
limit is invented here; future transport must retain its existing bounds.

ASSIGN_ADDON requires HTTP201, including an originally persisted no-op;
UNASSIGN_ADDON requires HTTP200 and matches the independently captured target
assignmentId. A new ASSIGN resourceId is not known before its result: selection
and allowance IDs must never stand in for the assignment. The response does not
identify the user or intent key; a future command hook must fence the captured
actor/session/target and original intent itself. Never copy a returned ID into
its own expected context. Cross-operation responses and unknown fields fail
closed; invalid response errors expose no server values.

operationId identifies the stored receipt, not the caller's idempotency key.
changed=false means that the original command committed without changing its
resource, not that this response is a replay. A replay of changed=true stays
true and retains its original IDs, revisions and completedAt. These are
historical terminal facts, never current assignment state, a new CAS pin,
current authority or an operational-use grant.

### Interaction design held behind command acceptance

1. Admit a future action only under the genuine TENANT
   `applications.addon_seats.manage` permission or documented current-owner
   administrative exception. The read/manage ANY pair is read admission only.
   Company/Branch/profile/billing grants and options diagnostics confer no
   write authority. The server must freshly authorize every attempt and replay.
2. Use existing bilingual, themed design-system dialogs with keyboard focus,
   labelled confirmation, cancel and visible loading feedback. Show the exact
   user and Addon from already authorized context, without a profile lookup.
   Removal explicitly retains the purchased subscription, parent assignment
   and history; assignment does not purchase seats or assign its parent.
3. Capture a distinct UUIDv7 intent and the exact original target/input only
   after explicit confirmation. Genuine options pins may supply source-backed
   preconditions but never eligibility. Do not manufacture absent revisions,
   enable inactive-target new assignment, or prevent inactive-target cleanup
   just because the options diagnostics are not ready.
4. While submitting, disable duplicate submission and make no optimistic seat
   grant/removal. A valid receipt confirms that original command's outcome,
   with separate no-change wording. Refresh the authorized current reads before
   any subsequent independently confirmed command; do not use a historical
   receipt revision as the latest revision.
5. A lost response or malformed success is an uncertain outcome, not proof of
   rollback. Never retry automatically with a new key or altered body. Any
   permitted retry retains the exact original intent/input and rechecks current
   context; no recovery/status endpoint is invented. A confirmed stale-CAS
   rejection requires refreshing and a new explicit decision, not automatic
   rebasing or silent retries.
6. Actual403 clears visible context and renders denial. Switching actor,
   session or target retires old visible results and ignores late completions;
   never rebind an old intent to a new target. A previous receipt cannot bypass
   revoked permission. Dialog dismissal does not establish that an in-flight
   operation was rolled back.

The UI/UX skill informed explicit confirmation, keyboard-accessible dialogs and
brief result feedback only; existing repository tokens/components govern the
design. No markup, dictionary keys, command transport, request DTO or live
mutation is mounted by this response-only work. Restricted-principal database
proofs, rollback/replay tests, actual HTTP/Gateway registration and deployment
acceptance remain coordinator-owned prerequisites before enabling commands.

Response-only verification:92new receipt cases plus73existing assignment/options
cases passed (165total), followed by the complete scoped Access regression:
**304/304tests across15files**,13.74s. TypeScript, scoped ESLint, full docs checks
(618routes,307anchors),200called-route verification and scoped diff checks passed.
The eight pre-existing unrelated CRM/audit knip findings remain unchanged, with
no new findings in this packet. No production build, authenticated browser test,
command transport or database operation occurred.

## ASSIGN/REMOVE command UI — unmounted implementation packet

Coordinator now authorizes reusable production adapters, command hooks/dialogs,
translations and focused tests. This supersedes the response-only preparation
scope above, but **does not authorize mounted entry points or live writes**.
Existing thirteen reads and both workspace tabs remain intact. No generic flag,
mock backend, Mobile/Partner work, database edit or broad build is introduced.

Verified Core controller/transport/closed command codec and Access handoff:

- Prepared canonical POST `/api/tenant/core/v1/users/:userId/addon-assignments`
  sends exactly `{contractVersion:2,addonSelectionId,expectedAllowanceRevision,
  expectedParentAssignmentRevision}` as JSON, without query parameters.
- Prepared canonical DELETE
  `/api/tenant/core/v1/users/:userId/addon-assignments/:assignmentId` sends exactly
  `expectedAssignmentRevision` and `expectedAllowanceRevision` in its query,
  with no body or contractVersion query field.
- Both send one explicit version2 and one original UUIDv7 idempotency header,
  no Company/Branch selector. User and stored selection IDs retain supported
  canonical UUID1–8; child/intent IDs remain UUIDv7. All CAS values are exact positive
  signed-bigint strings from verified reads, never0/1 placeholders.
- Source status, nine-field receipt and authorization rules above are unchanged.
  409 ADDON_ASSIGNMENT_REVISION_STALE requires new observation and explicit
  review;409 ADDON_OPERATION_UNCERTAIN keeps the original unresolved intent.
  422 SEAT_LIMIT_REACHED and IDEMPOTENCY_BODY_MISMATCH,404 ASSIGNMENT_NOT_FOUND,
  401 AUTH_AUTHORIZATION_STALE and current403 maintenance/permission denial
  use existing normalized errorCode parsing, never server message matching.

Self-assignment/removal can advance authorization even when the command already
committed. Retain the exact original intent through existing refresh or
reauthentication; no token/epoch/session is fabricated. A current-authorized
retry must preserve the original target/key/body/query even if its original
assignment was subsequently removed or current options changed. A refresh
failure after a valid COMMITTED receipt does not undo that confirmed outcome.
Generic503, a lost response and malformed success do not prove rollback.

Implement the component with explicit row context and existing dialog/buttons,
Arabic/English labels, loading and inline uncertain-result evidence. Admission
requires current manage/current-owner authority; absent parent/inactive target
prevents a new allocation submission, while local readiness/denial diagnostics
never become an ELIGIBLE predicate and do not block retained-child cleanup.
Actor/session/target changes fence all late completions and hide old results.
The entry component is imported by focused tests only until coordinator release.

### Local original-intent recovery and integration boundary

The approved feature-local `sessionStorage` record contains exactly
`actorId,userId,addonSelectionId,command`; command is the closed original
POST body or DELETE query/path plus its UUIDv7 key and operation kind. Its origin
is the current browser tab's real origin; the existing auth profile supplies no
independent tenantId, so none is invented. Store no credentials, cookies,
permissions, prices, company configuration or confirmed server history. The
4096character bound is only a local recovery-record safeguard, not an HTTP DTO.

Reads are SSR-safe. Corrupt, copied, unavailable and quota-limited storage fail
explicitly before a new send, including verified readback after persistence.
A failed read is not absence and cannot overwrite an unknown original intent.
No automatic expiry or retry replaces an unresolved request. Each retry is
explicitly reviewed under current actor/session/manage admission and sent through
the existing cookie/CSRF transport with its original key and inputs. Session
refresh keeps the same intent; a different actor/target cannot use its record.

A valid receipt permits clearing only its exact stored command. A stale success
from a replaced UI/session cannot clear original recovery evidence or update
the new view. Current403 hides target/receipt details and retains the unknown
intent; fresh-session/review remains separate from actual server authority.
Confirmed receipts survive local refresh failure without a rollback claim.

One coordinator-approved exception is a **genuinely first, never-uncertain
attempt** returning normalized409 plus exact `ADDON_ASSIGNMENT_REVISION_STALE`.
That is a definite pre-commit rejection: clear only that exact rejected intent,
require explicit refresh and a newly observed row, then allow review of a new
key. The same error after a restored or earlier uncertain attempt never gets
this exception. HTTP status alone cannot resolve an unknown outcome.

`AddonAssignmentCommand` accepts verified options/live-assignment context;
`AddonAssignmentRecovery` independently lists only this actor and exact user's
validated original local intent identities. Thus a removed assignment can be
retried by its original child ID even when it disappears from both current
server reads. Recovery records cannot construct a new command, fetch a profile,
invent an Addon label or assert server history. Existing source-backed CAS is
never replaced with today's values under the original key.

The command dialog uses existing themed primitives, labelled exact identity and
revisions, visible keyboard focus, cancel, loading/duplicate suppression, original
key review and localized inline outcome feedback. The skill's confirmation and
focus guidance informs this use of existing primitives only. Both prepared
components remain absent from route/workspace imports. At integration, mount row
actions only beneath the matching current validated read boundary and keep the
per-user recovery section independent of current-row membership; a read refresh
retires stale row action instances. No broad build or authenticated acceptance is
claimed by component tests.

Final unmounted command packet: **371/371scoped Access tests across19files
passed**,17.05s, including67new command/storage/hook/real-component cases. Final
TypeScript and scoped ESLint passed. RTL/identifier guards passed1326files,
sibling-key699,design census1327 and both-theme palette contrast passed.
Full docs checks passed with618routes/307anchors; scoped diff-check passed.
Knip remains the same8unrelated pre-existing CRM/audit findings, with no new
findings in this packet. The called-route gate intentionally remains a release
dependency, not a claimed pass:201paths,200registered and the prepared bodyless
DELETE path absent from Gateway. Q136 records the exact missing registration.
No checker is weakened; no build, browser session, database operation or mounted
write action is part of this handoff.

## Read-state composition — unmounted integration preparation

Coordinator authorized a feature-local composition adapter, not public mounting.
`AddonSeatCommandPanel` consumes the existing exact-user assignments or options
hook result, including its private requested-user/snapshot identity. These two
hook-local fields are client context, not additions to either frozen wire DTO.
The panel performs no request and owns no parallel state machine. Existing
workspace tabs, page imports, navigation and canonical read calls stay unchanged.

View-only admission exposes no mutation/recovery entry. Current manage or the
actual owner exception may compose the prepared commands beneath exact current
read rows. Loading, errors and retired snapshots remove row actions; a mismatched
requested user or row user fails closed, including an old empty page that could
otherwise be attached to a new target. A read403/401/404 prevents target recovery
display. Non-authoritative local intent recovery is separate from current-row
membership; a transient unavailable read is not reclassified as proof of denial
or proof the original command rolled back. Every explicit retry still reaches
the current-authorized owner and preserves original inputs.

Composition inspection also aligns live-assignment snapshot retirement with the
existing options hook, preventing A→B→A resurrection before a fresh read. During
temporary same-session authentication refresh, the local recovery list keeps
its command owner mounted while interactive command UI/submission is suspended.
It must not abort its own authorized replay merely because its
access token is being refreshed. Actor/session/target replacement still retires
the old owner and ignores its late results. No positive authority is cached.

A current-context, validated committed receipt raises the existing localized
success toast before refreshing reads. This confirmation survives removal of
the originating row during refresh; it describes the original command, including
no-change receipts, rather than asserting current assignment state. Stale or
unreadable responses never raise success. Uncertain originals remain in-body
and in the existing recovery storage, not only in a transient notification.

For the same non-retired command owner, a validated historical receipt may
arrive while authentication is still `REFRESHING`: terminal success feedback
and the retained receipt are preserved, but opening/submitting a command stays
disabled until authentication is ready. This feedback reports a completed
command, not new admission or current operational access. Actor/session/target
retirement still suppresses a late success toast entirely.

Accepted read-snapshot changes rescan existing local recovery records without
becoming a new command-owner key. This discovers originals retained by a row
that was retired during refresh, while keeping an already mounted replay alive.
The adapter remains imported only by its composition test; no live read owner
or page imports it.

Final composition verification: **387/387 scoped Access tests across20files
passed**,18.64s, including16new composition/retirement cases above the371-test
packet. TypeScript and scoped ESLint passed. RTL/identifier guards passed1328
files, sibling-key701, census1329 and both-theme contrast passed. Full docs
checks passed618routes/307anchors. Called-route verification remains explicitly
blocked at201paths/200registered by the same unmounted DELETE registration
dependency in Q136. No production build or authenticated Tenant claim.
