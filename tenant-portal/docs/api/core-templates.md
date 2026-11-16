# Core — Template Platform

Status: **current API source baseline; complete MVP implementation pending**

UI source and authenticated live boundary rechecked: **2026-11-04**.
The 41-route catalogue below remains the current contract; new target contracts are documented separately until implemented.

Last source verification: **2026-10-17** (publish concurrency controller and
service contract).

Owning app: **core-app**

Canonical prefix: `/api/tenant/core/v1/templates`

> **Upstream path note.** The three controllers are mounted on `templates`, not
> `tenant/templates` — the upstream is `/api/v1/templates/...`. Only the
> canonical browser path matters to the portal, but this trips anyone reading
> core-app source expecting the `tenant/` prefix.

Portal status: **management source exists; full editor and approved complete MVP are not implemented**. Historical Phase 7 task numbers below are trace references, not completion evidence. The authenticated route currently displays the subscription unavailable boundary.

Source inspected:
`core-app/src/tenant/template-platform/template-platform.controller.ts`,
`core-app/src/tenant/template-platform/template-platform.errors.ts`,
`core-app/src/tenant/template-platform/dto/`,
`core-app/src/tenant/template-platform/pagination/template-cursor-codec.service.ts`,
`core-app/src/common/decorators/requires-feature.decorator.ts`.

**41 routes** — the largest single surface in Core, larger than all of
organization + users + roles combined.

---

## Two gates before any of this renders

**1. Entitlement.** Both authenticated controllers carry
`@RequiresFeature('core.template_designer')`. A tenant without that feature gets
**403**, and the correct surface is the entitlement-blocked page (task 4.28) —
not an empty list, and not a permission error.

**2. Permission.** Nine distinct permissions across the 41 routes:

```text
templates.read     templates.create    templates.update
templates.publish  templates.archive   templates.restore
templates.preview  templates.assets.manage  templates.assignments.manage
```

Two routes need **two** permissions (AND):
`GET /templates/:id/draft` needs `templates.read` **and** `templates.update` —
reading the editable draft is an authoring action, not a read.
`GET /templates/creation-scopes` needs `templates.read` **and**
`templates.create`.

---

## The lifecycle — read this before designing the editor

```text
definition ──> draft ──(validate)──> validation run ──(publish)──> version ──> assignment
                 ^                                                    │
                 └──────────────── restore ───────────────────────────┘
```

A **definition** owns metadata and exactly one mutable **draft**. Publishing
freezes the draft into an immutable **version**. An **assignment** points a
scope at a version with a priority and an effective window. Nothing renders to
an end user except through a resolved assignment.

### Publishing has three preconditions, all pinned

`POST /templates/:templateId/publish` requires:

1. the **definition revision** (`definitionRevision` in the body),
2. the **draft revision** (`draftRevision` in the body, with
   `currentDraft.etag` echoed verbatim in `If-Match`), and
3. a **passed validation run id** for that exact draft revision.

Definition and draft revisions advance independently. A metadata-only rename
can advance the definition revision, while a draft save advances the draft
revision. Publishing works when these revisions differ; a stale draft ETag
still returns `CORE.TEMPLATE.CONCURRENCY.STALE_REVISION` (409).

For Sales Quotation, a valid restored text edit for the current saved draft
blocks Publish until the operator saves or discards it. A save requires
validation of the new draft revision. After an uncertain response, a same-tab
reload can recover the original UUIDv7 for an explicit retry of the same
validated draft, ETag and Publish body under the same authorized session.
The browser retains the retry for 30 minutes. When recovery cannot be
confirmed, the Portal asks the operator to check Versions and review the
current draft before publishing again. The Portal checks the validation run
and requires the `Location` on the HTTP 201 response to identify the exact
immutable version in the body before automatically opening it. A missing,
mismatched, or repeated `Location` leaves the original retry key available.
Verified in focused Portal fixtures on 2026-11-13.

Change one character of the draft after validating and the run no longer
applies. **Surface all three states before enabling the button** (task 7.15) —
a publish button that fails on click is the thing this design is preventing.

---

## Routes

### Definitions and discovery

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates` | `templates.read` | Cursor-paginated |
| POST | `/api/tenant/core/v1/templates/search` | `templates.read` | **200**, `@ReadLikeOperation()` — the read-like POST for filter sets too large for a query string |
| POST | `/api/tenant/core/v1/templates` | `templates.create` | **201**, idempotency-required |
| GET | `/api/tenant/core/v1/templates/starters` | `templates.create` | Filtered by the exact doc/output/adapter/locale/schema tuple |
| GET | `/api/tenant/core/v1/templates/creation-scopes` | `templates.read` + `templates.create` | Scopes the user may create in |
| GET | `/api/tenant/core/v1/templates/data-sources` | `templates.read` | Registered adapters for the exact registry scope |
| GET | `/api/tenant/core/v1/templates/data-sources/:adapterKey/schema` | `templates.read` | The adapter's supported schema |
| GET | `/api/tenant/core/v1/templates/:templateId` | `templates.read` | Definition + draft + `ETag` |
| PATCH | `/api/tenant/core/v1/templates/:templateId` | `templates.update` | `If-Match` + idempotency |
| POST | `/api/tenant/core/v1/templates/:templateId/duplicate` | `templates.create` | **201.** Never copies assignments |
| POST | `/api/tenant/core/v1/templates/:templateId/archive` | `templates.archive` | **200**, **no body**, `If-Match` |
| POST | `/api/tenant/core/v1/templates/:templateId/restore` | `templates.archive` | **200**, **no body**, `If-Match` |
| DELETE | `/api/tenant/core/v1/templates/:templateId` | `templates.archive` | **204**, `If-Match`. Published or assigned is refused |

A **direction change** on `PATCH` additionally requires the draft revision in
the body — changing LTR/RTL rewrites the draft, so it cannot be done against the
definition revision alone.

### Draft and recovery

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/:templateId/draft` | `templates.read` + `templates.update` |
| PATCH | `/api/tenant/core/v1/templates/:templateId/draft` | `templates.update` |
| GET | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots` | `templates.read` + `templates.update` |
| POST | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots/:snapshotId/restore` | `templates.restore` + `templates.update` |

Draft transport source verified **2026-11-09**. GET returns the draft directly in the Core envelope's `data`. PATCH returns `data.draft` and nullable `data.migrationRecovery`. The editor uses the nested draft and leaves recovery metadata with the owner.

The draft ETag is a strong quoted numeric revision such as `"4"`. Send it unchanged as `If-Match` and preserve the original document, ETag and UUIDv7 `x-idempotency-key` when replaying an uncertain save. Core returns the stored draft on replay and marks it with `Idempotency-Replayed: true`.

Draft reads are `no-store, private` and carry `ETag`. **Autosave is an
`If-Match` write** — so a second tab, or a slow save racing a fast edit, is a
409 in the middle of typing. That is the conflict path task 7.13 has to design,
not an edge case to ignore.

Restoring a snapshot requires a **reason** and an explicit
**discard-acknowledgement** in the body, and the snapshot is checksum-pinned.
The UI must collect both; they are not optional fields to default.

### Validation and versions

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/templates/:templateId/validate` | `templates.update` | **200**, `If-Match` + idempotency. Validates against **exactly two** renderer targets |
| GET | `/api/tenant/core/v1/templates/:templateId/validation-runs/:validationRunId` | `templates.update` | One persisted run |
| POST | `/api/tenant/core/v1/templates/:templateId/publish` | `templates.publish` | **201.** Three pinned preconditions |
| GET | `/api/tenant/core/v1/templates/:templateId/versions` | `templates.read` | Cursor page |
| GET | `/api/tenant/core/v1/templates/:templateId/versions/:versionId` | `templates.read` | |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/restore` | `templates.restore` + `templates.update` | Replaces the draft. **Records an operator reason** |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/retire` | `templates.publish` | **200**, **no body**, `If-Match` |

### Preview — two synchronous, one asynchronous

| Method | Canonical path | Status | Shape |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/html` | **200** | Synchronous |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/email` | **200** | Synchronous — HTML **and** text |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/pdf` | **202** | **Async job**, idempotency-required |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId` | 200 | Job status, `no-store` |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId/artifact` | 200 | `application/pdf`, `private, no-store` |

The two synchronous previews render from a **pinned source** — either a draft
revision or a published version — never "whatever is current". Pass the
revision explicitly.

The PDF path is the async-job pattern: **202**, poll the job, then fetch the
artifact. The artifact **expires**, so "succeeded but the download is gone" is a
real fifth state alongside queued/running/succeeded/failed. Use the
`AsyncJobState` pattern (task 1.32).

Portal monitoring behavior verified **2026-10-18**: after 60 pending (`PENDING`
or `RETRYING`) status responses, monitoring pauses with an explicit recovery
message instead of continuing to display an active pending indicator. This is
a monitoring timeout, not a render failure. **Resume status checks** starts
another bounded polling window using the retained job ID and existing status
GET; it never requests another render. A completed response then exposes the
same job's artifact through the normal download action.

### Assets

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/assets` | `templates.read` | Cursor page |
| POST | `/api/tenant/core/v1/templates/assets` | `templates.assets.manage` | **201.** Multipart, idempotency-required |
| GET | `/api/tenant/core/v1/templates/assets/:assetId` | `templates.read` | Projection + `ETag`, `private, no-store` |
| GET | `/api/tenant/core/v1/templates/assets/:assetId/content` | `templates.read` | Re-authorised, checksum-verified bytes |
| DELETE | `/api/tenant/core/v1/templates/assets/:assetId` | `templates.assets.manage` | **204**, `If-Match`. Unreferenced only |
| GET | `/api/tenant/core/v1/templates/public-assets/:assetId` | **`@Public()`** | `public, max-age=300`. Tenant resolves from the host |

The upload multipart is **exactly two parts and nothing else**: a `metadata`
JSON part (≤16 384 bytes) and a `file` part (≤5 MiB, PNG or JPEG). The
interceptor caps `files: 1, fields: 1, parts: 2` — a third part is rejected
outright, so do not add a stray hidden input.

Source-verified **2026-11-13**. Core authorizes a supplied `definitionId` against
`templates.assets.manage` and the definition's write entitlement. The ordinary
Sales Quotation Flow and Hybrid design screen requires the enabled Core detail
capability `manageAssets` and the current definition scope. It uploads `IMAGE`
assets as `PRIVATE_ONLY` and adds the confirmed asset to the editor's available
images. If the upload outcome is unknown, an explicit retry first reads the
asset by the original request's UUIDv7, then reuses the same key and file only
after Core confirms that the asset is missing.

**`EMAIL_PUBLIC` requires explicit confirmation.** Marking an asset public means
it is served without authentication while the asset and endpoint remain available under the backend retention contract; it is not a promise of eternal availability. That is a
deliberate, irreversible-feeling decision and needs its own confirmation step
(task 7.18) — not a checkbox in a form.

### Assignments

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/assignments` | `templates.read` | Cursor page |
| POST | `/api/tenant/core/v1/templates/assignments` | `templates.assignments.manage` | **201**, idempotency |
| POST | `/api/tenant/core/v1/templates/assignments/resolve` | `templates.read` | **200**, `@ReadLikeOperation()`, `no-store` |
| GET | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.read` | + `ETag` |
| PATCH | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | `If-Match` + idempotency |
| DELETE | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | **204.** Deactivates, preserving history |

Sales Quotation deactivation retains the original request key, assignment UUID
and `If-Match` while the same session and scope are active. After a lost reply,
Retry reads the exact assignment and sends the original DELETE only if the
target and revision still match. A Core replay or a coherent read of the
inactive assignment confirms the result. A changed target requires a reload.

`resolve` answers "which template actually renders for this selector at this
instant". Priority and effective windows can overlap; the server picks. **Give
the user a resolve preview** rather than letting them reason about precedence
themselves — overlapping-window bugs are otherwise invisible until a document
renders wrong.

`PATCH` revalidates compatibility, overlap, priority and scope, so an edit can
fail for a reason unrelated to the field the user changed. Say which.

---

## Pagination here is unlike the rest of Core

Template Platform uses **HMAC-signed cursors**, not page/limit:

- signed with the auth token pepper, **15-minute TTL**, fingerprint-bound,
  max 2048 characters;
- `CursorQueryDto` is `cursor` + `limit` (1–100, default 20).

**Preserve the cursor byte-for-byte.** Do not parse it, do not re-encode it, do
not persist it across a page reload — an expired or re-fingerprinted cursor is
rejected, and the correct UI response is to restart the list, not to retry.

Version and recovery history pagination updated **2026-10-18**: each panel
retains its own cursor metadata and in-memory cursor trail, with Previous/Next
controls and at most 25 records displayed at once. Switching definitions
clears both trails and their rows. Superseded requests cannot update rows,
errors or loading completion. An invalid cursor restarts only the affected
history and displays the existing bilingual restart notice. Older versions
retain their view, restore and retire actions; older snapshots retain their
checksum-pinned restore action and explicit discard acknowledgement.

Sorting is also its own dialect: definitions use `sortBy` + `sortDirection`
(**lowercase** `asc`/`desc`), and assets use a combined token like
`createdAt:desc`. This is the `sortDir` divergence recorded as gap G13 and task
3.37 — the shared `PaginationQueryDto` convention does **not** apply here.

---

## Concurrency

`ApiIfMatchHeader()` documents `^(?:W/)?"?[1-9][0-9]*"?$`, but that is only the
Swagger annotation. **The parser is stricter than the annotation** —
`parseRevisionEtag` in `template-platform.errors.ts` matches `^"([1-9][0-9]*)"$`,
so a weak tag or a bare integer is a `CORE.TEMPLATE.CONCURRENCY.STALE_REVISION`
**409**, and a missing header is
`CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED` **428**. Asset routes take a
namespaced form instead: `"asset:<assetId>:<revision>"`. Echo the server's own
`etag` field verbatim and neither shape can be got wrong — recorded as
[Q60](../build/OPEN-QUESTIONS.md#q60--apiifmatchheader-documents-a-looser-etag-than-parserevisionetag-accepts).

Idempotent commands additionally read
`x-mutakamel-idempotency-fingerprint` (`v1:sha256:<64 hex>`) alongside
`x-idempotency-key`. Replays return the stored response with
`Idempotency-Replayed: true`. Domain idempotency here is retained for
**seven years**, with a 2.5 MB cap on the stored response.

---

## Quotation visual draft editor

Source-integrated **2026-11-04**: the definition detail exposes a centred visual
editor for `QUOTATION` / `PRINT` / `HYBRID_DOCUMENT` with `templates.update`.
`GET /templates/:templateId/draft` supplies the complete schema-v1 document and
its draft ETag; `PATCH` sends `{editorDocument, clientMutationId}` and that exact
`If-Match`. The client mutation UUID is also the idempotency key. An unknown
response fences further editing and replays the same document, ETag and key.
The Sales Quotation draft read checks the raw GET response before unwrapping it
for initial load, reload, and conflict review. It checks the HTTP 200, exact
transport target, template identity and quoted revision, and matches any
supplied `ETag` header to the draft body. Source verified **2026-11-13**.
A client deadline can happen after dispatch. The portal transport reports it
as `504 CLIENT_REQUEST_TIMEOUT`, which is an uncertain write outcome just
like a connection loss. Recover the original intent without changing the
document, ETag or UUIDv7 key. The shared write outcome policy also preserves
the intent on an ambiguous 5xx or a recognized in-flight idempotency response.
A confirmed stale-revision 409 or 412 leaves authored changes in place and
requires conflict resolution before another save.

The draft editor retains the original request after Core answers
`409 CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT`. If a replay is refused by
`429 GW.RATE.LIMIT_EXCEEDED`, the first attempt is still unresolved. A
subsequent recovery sends the same body, key and If-Match on the same
template and signed-in session. An unconfirmed 409 or 412 on a Sales Quotation
save retains the original intent, including on the first attempt. The editor
waits for the current template draft to load before dispatch and ignores a save completion from
an earlier template or authority. A replay rejected before admission by
Gateway rate limiting (including a status-only 429) or the exact
`403 GW.AUTH.FORBIDDEN` leaves the original write unresolved. Recovery is
explicit and reuses the original body, key and ETag. A first attempt refused
at admission follows the ordinary failure path.

The editor also observes authoritative session transitions. A late result
can release only its own busy state. If the browser temporarily reports a
different session, the editor hides the old draft and refuses dispatch.
If the same rendered authority returns without a session event, any fenced
save is offered as the original unresolved intent. An observed session or
identity transition creates a fresh authority boundary.

An Axios-generated local session fence is not a server receipt, even when
the rendered owner matches the original again by the time the hook handles
the error. The transport tags the error at its point of construction.
A confirmed stale receipt must be an HTTP 409 or 412 with Core's exact
stale-revision code and coherent status and code fields from the exact draft
PATCH. A present success marker must be false. A present instance must name
that same public draft route. A present path must name that public route or
its exact Core upstream route. These fields stay optional because the shared
Core envelope and Gateway Problem Details have different optional fields.
The Fetch response must report no redirect. If Fetch supplies a final URL,
it must be the exact same-origin draft endpoint with no query or fragment.
The origin and response metadata come from the transport, never JSON. Contradictory wire
evidence and other unconfirmed results keep an unknown write pending. A Sales
Quotation save or replay can acknowledge only the exact successor of its
original `If-Match` revision. A separate GET can observe a later current
revision. Recovery is explicit, and the editor's reload action stays blocked
while a save is in flight or unresolved.
A stale-revision rejection keeps the authored document until explicit reload.

After a full browser refresh, Sales Quotation can check an uncertain save using
tab-scoped command metadata. The record is bound to the current session, actor,
template and scope. It stores the draft ID, original revision, mutation UUID and
canonical request digest. The editor only sends the original key and `If-Match`
when a fresh draft GET returns the same draft at the exact successor and its
document reconstructs the original request digest. It requires
`Idempotency-Replayed: true` and the matching draft receipt to confirm the save.
Otherwise the outcome stays unresolved. The user can check again or explicitly
use the latest saved draft. The Sales Quotation designer retains changed plain text
for existing editable nodes in the same tab. It applies the text as an unsaved edit
only for the matching session, actor, scope, authorization version and exact saved
draft. When a save is unresolved, restore waits for its exact replay and final
readback. Choosing the saved draft or signing out clears the retained text.

The editor preserves unedited schema properties and graph relationships. Its
controls insert text, dividers, registered scalar bindings, authorized active
image assets, repeating tables and totals; edit text, table/totals labels,
font size, colour, alignment, page orientation/margins and theme accent; and
support sibling ordering, protected subtree deletion and bounded undo/redo.
Bindings and sample fixture keys come from
`GET /data-sources/:adapterKey/schema?scopeType=...&schemaVersion=1`, with the
definition's exact scope. No caller-supplied asset URL or fabricated field path
is substituted for the registered contract.

The canvas displays document structure and binding placeholders. The saved
draft's exact revision is previewed separately through `POST /:id/preview/html`
using a discovered synthetic fixture, locale and time zone in a sandboxed
iframe. It is labelled sample data; saving does not publish. Existing
validation/publish panels retain the definition/draft/validation-run pins.
Other layout modes and full schema authoring tools remain MVP targets below.

`POST /:templateId/duplicate`, `GET /data-sources`, and
`GET /templates/:templateId/validation-runs/:validationRunId` still have no
portal caller. Public asset delivery remains intended for mail clients.


## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/templates` list | 7.10 | built |
| Create from starter | 7.11 | built |
| `/core/templates/[id]` definition screen | 7.12 | built; scoped quotation visual draft editor source-integrated |
| Draft recovery snapshots | 7.13 | restore built; autosave not — see above |
| Validation runs | 7.14 | built |
| Publish | 7.15 | built, all three preconditions surfaced |
| Versions | 7.16 | built |
| Preview HTML / email / PDF | 7.17 | built |
| `/core/templates/assets` | 7.18 | built |
| `/core/templates/assignments` | 7.19 | built, with the resolve preview |


## Complete MVP acceptance — source versus target

The approved [Template Platform MVP specification](../design/specs/template-platform-mvp.md) includes all 123 image cases, ten source families, all three print layouts, Email Flow, free movement and resizing, groups, explicit pages, static and repeating tables, typed calculations, versioned reusable functions, asset workflows, authorized source preview, save/replay/conflict/recovery and 30 starters in 60 localized entries. These requirements all belong to MVP.

They remain targets until their shared schema, Core and owner APIs, database, compiler, Worker and portal consumers are implemented together. Current frontend constants admit two document types, two layouts and four adapters. Creation omits Print page configuration; legacy HTML/email preview panels use textareas. The quotation editor above adds draft read/save and sandboxed sample HTML, but does not establish acceptance for fixed canvas, every schema node, free resizing, formulas or all source families. Execute actual PDF downloads and reference comparisons before claiming live completion. The table above reports source surfaces, not current live acceptance.

Authenticated browser and read-only database evidence identify a separate base-Core entitlement dependency. The tenant has FULL subscription access but lacks core.template_designer; Core is a non-billable internal system application with no tier. Provision the feature through its authoritative platform policy contract. Do not manufacture a paid Core subscription or bypass authorization in the UI.


## Private R6 coherent draft receipt proposal — 2026-11-10

The private R6 draft-save proposal validates one coherent raw HTTP receipt before Core
envelope unwrapping and before canonical draft parsing. The same receipt classifier
decides whether an HTTP error is a confirmed stale result. It requires transport-owned
same-origin PATCH identity and final target, the actual draft-save HTTP 200 for
acknowledgements, consistent supplied success/status/route signals, a valid draft revision
and body ETag, and agreement with a supplied representation ETag header. A contradictory
acknowledgement remains unknown and retains its original serialized document, quoted ETag
and mutation key. A failed or malformed 200 envelope never becomes an implicit stale
conflict.

Current Core saveDraft emits http(200, {draft,migrationRecovery}, {ETag}) and the shared
ResponseEnvelopeInterceptor adds success:true, data, correlationId and timestamp. R6
preserves raw handler bodies and legacy data wrappers as well as the current wrapped form.
Correlation, timestamp, meta, migrationRecovery and replay headers remain harmless
metadata. Error/code/Problem Details signals cannot coexist with a successful
acknowledgement. Error responses use the raw Core ErrorResponseDto or Gateway Problem
Details aliases before normalization. Supplied status and route aliases must agree; a
success-marked error or an error carrying an acknowledgement cannot settle the pending
request.

The draft helper uses corePatchResponse to retain the raw payload, HTTP status, headers
and transport provenance. Other Core callers keep their existing unwrapped corePatch
result. The existing opt-in target guard remains; successful guarded responses now carry
transport-owned target evidence to the classifier. Missing ETag headers remain compatible
with legacy callers, while a supplied header must equal the body strong quoted revision
ETag. The bound hook checks canonical template and draft identity before applying an
acknowledgement. For Sales Quotation, the classifier checks the exact next revision.

The standalone R6 source and its portable test correction were independently reviewed,
applied under exact source leases, and accepted by root as unweighted source only. The
canonical proposal composes those receipt controls with (template,canMutate), exact Branch
permission context, session and busy ownership, and explicit same-intent recovery without
automatic retry or a second effect.
The canonical UI03 workspace and original designer source exit remain separately held.
Controlled source tests and an actual shared response-interceptor fixture do not establish
an authenticated backend, browser, native or final UI result.


## Private canonical UI03 composition — 2026-11-10

The source proposal implements the original route/ribbon/lazy adapter and authored-command boundary. The complete stored document and immutable source tuple remain separate from selection/zoom/pan. Gesture begin/update/commit/cancel creates one undo entry and restores the original on cancellation. Exact R6 raw receipt admission is composed with canonical read/write authority and explicit recovery. Native schema/measurement adoption and snapshot-body read remain unavailable where not installed/mounted; no invented content or automatic retry is supplied. Independent source review, authenticated route/native/visual acceptance and dependent geometry/table/formula features are separate gates.


## Private canonical UI03 R2 correction - 2026-11-10

Ordinary candidate tests carry their own required DOM environment directives and inline the non-secret synthetic Gateway controls; no private wire path is required at collection. Escape cancels active hand pan to its starting offset, clears its pointer session and releases capture before leaving Hand mode. A coherent Save of the same authored document marks the acknowledged saved baseline while preserving the freshest independent zoom, pan, valid selection and Hand state, including navigation during the in-flight request and same-identity parent refresh. The prior Save history boundary is retained; genuine source/scope/session/document replacement still resets navigation. Raw R6 receipt/provenance/request-byte admission is unchanged.

The actual native package-adoption source proposal uses the existing @mutakamel/template-schema/browser-safe and @mutakamel/template-layout public entries. It is staged separately from the executable 37-path candidate because Portal has no direct qualified/linked browser-safe schema or measurement package. Proposed source/dependency metadata is not a package install, type shim, source alias, mounted capability or acceptance. Original native semantic/measurement, backend-mode, UI01, CO07, runtime and visual/PDF gates remain unchanged.


## PO02 portal authorization qualification — 2026-11-09

Template actions require the matching session permission and a successful guarded template read for the active view. A policy denial is separate from an unavailable or stale policy, an invalid response, and a successful empty page. Pending and superseded reads expose no gated action. A zero-item tenant can be admitted by the exact current Core base grant without adding a paid item, tier, seat or organization scope. The portal continues to send the owner-defined scope and routes through the cookie client.

## Original PO02 source exit — 2026-11-10

The original PO02 source exit is qualified with policies generated by the accepted PO01 host materializer. Retained eligibility changes use the critical catalogue feature CAS, audit and transactional invalidation, then the existing owner reconcile path. Identical current-revision retries have no further effects. Reversal compares the observed successor feature revision, clears eligibility through the same owner and reconciles again. The guard refuses a warmed view while the CP tuple is fenced and refuses a rebuilt revoked grant. The existing fence and rebuild consume distinct monotone policy revisions. A source result does not admit native packages or a live tenant entitlement.


## PO02 read-response admission repair — 2026-11-10

A template GET list or read-like POST search must pass raw HTTP/envelope admission before Core data unwrapping and cursor validation. The current successful Core envelope and the supported raw cursor body remain valid. If present, success must be true and numeric status/statusCode aliases must agree with HTTP 200; Core error fields and Gateway Problem Details fields cannot authorize a page, even beside otherwise valid nested cursor data. Harmless success metadata remains allowed. Contradictory HTTP-200 input is an invalid/unavailable response, not an authoritative HTTP 403. Actual HTTP 403 and 503 responses retain their existing distinctions. These contradictions are synthetic regression inputs, not evidence that the backend emitted them.

The repair uses raw GET/POST response accessors beside the current Core raw PATCH accessor and leaves cursor validation in the template owner. It does not use the draft PATCH receipt validator for list data. Create still requires a successful page plus the current action permission; refresh, session and exact scope changes immediately retire authorization, and superseded responses cannot re-admit it.


## T04 Gateway and Portal source successor — 2026-11-10

This is a staged source contract, pending exact manager merge leases and T03's genuine Core function owner. It does not change the live availability statement above.

The Gateway adds the thirteen function-owner routes under `/api/tenant/core/v1/templates/functions`: list/create, detail/replace, validate/publish, versions list/detail, archive/restore, usage, impact and apply-to-drafts. Their upstream prefix is `/api/v1/templates/functions`; UUIDv7 function/version parameters cannot absorb literal catalogue paths. GET requires `templates.functions.read`; mutation permissions and ALL semantics are copied from the genuine Core controller. Mutations never replay a protected edge response. Core reauthorizes the current tenant, session, feature entitlement and exact company/source scope.

Portal list/search, definition detail, starters, creation scopes, recovery metadata, versions and preview reads retain raw transport evidence until exact HTTP status and coherent Core wrapping are checked. Error signals in either layer cannot authorize a page. A successful current guarded list plus action permission is required for Create; session, scope and refresh changes retire the old response. The function catalogue reader carries the exact company and opaque cursor and validates summaries. Function lifecycle and working-body UI integration belongs to T05.

Edge JSON bounds are 900,000 bytes normally, 3,000,000 bytes for complete draft receipts and 5,000,000 for synchronous HTML/email preview. Binary asset responses are bounded at 5,242,880 bytes and PDF at 26,214,400 bytes, matching the current Core asset and Worker PDF owners. JSON/error bodies on binary routes remain buffered and bounded. Template JSON routes cannot switch to an unbounded event stream. PDF accepts application/pdf; assets accept only the current PNG/JPEG/WebP media types.

Template response headers use an explicit allowlist, retain strong ETags and replay markers, force private no-store and nosniff, and omit upstream cookies/private headers. Only an exact relative template/function create Location is translated to a canonical browser path; absolute, queried, fragmented and mismatched Locations are withheld. Arabic and English function error messages are added to the existing Core operations error dictionaries.

Selection extension, command-receipt lookup and thumbnail endpoints remain unavailable because no genuine current controller/provider was present in the inspected source or owner checkpoint. Existing assignment resolution, draft receipt validation and preview artifact delivery remain distinct supported contracts. Their missing extensions must be supplied by their Core owners before Gateway or Portal activation. No financial posting, settlement or other accounting command route is added.

Native verification uses the ordinary checked-in Vitest/Jest configuration with only a task-local physical dependency closure, exact installed packages and no custom resolver or environment override. The R2 read test declares its own jsdom environment because it uses document.cookie. Runtime rebuild and authenticated browser acceptance are pending the authorized integration gate.


## T04 starter transport alignment — 2026-11-10

The staged Portal contract admits the six Trade Print adapters, three CRM Email adapters, and the Core-local Letter Print adapter. Letter supports Hybrid, Flow and Fixed authoring when the current scoped catalogue returns it. Selection and blank creation use the existing Templates routes and require an authorized Tenant or Company destination. Verified against the staged Core authoring source on 2026-11-15.

Core's current data-source catalogue and schema endpoints advertise allowedOutputChannels, allowedLayoutModes and supportedLocales. Portal validates the actual arrays as nonempty unique subsets of each installed owner's finite contract, verifies the exact adapter/document family, schema version and checksum, and preserves their advertised order. The creation drawer offers only current server-advertised choices and sends the exact compatible starter tuple. A narrower schema is honored; global layout knowledge never restores modes the server omitted. Print/email cross-family tuples are rejected by starter/detail parsers.

Starter discovery can include `defaultPage` on an admitted Print descriptor. The page contract was verified against Core authoring source on 2026-11-15. It carries a preset page, its orientation and four numeric `marginMm` values. Selection initializes the explicit Create page while the user has left page settings untouched. Blank creation and descriptors without a page retain the standard form defaults. Manual page edits persist when the starter changes. The PDF panel requires Core's enabled `previewPdf` capability for Flow and Fixed quotations. A Fixed draft with explicit `canvasPages` stays unavailable for this ordinary PDF route.

Session, permission-scope and company changes retire creation-scope, source and starter replies. A source HTTP denial is separate from an empty catalogue; errors do not produce a fabricated source or starter. T01's draft read/save/receipt functions are unchanged; only schema metadata is added to the existing field/fixture projection. Existing UI03 R2 source fields, canonical source identity and authored document contents are retained.

These are staged source changes pending the coordinated T08 registry plus T03 DTO/entitlement mapping lease and runtime qualification. Trade and CRM fixture metadata comes from installed owner exports. Letter fixture metadata comes from the sealed Core-local registration.
