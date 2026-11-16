# Data Layer

Status: **verified against current source**

Last source verification: **2026-08-31**. Tenant endpoint boundary verified **2026-10-30**. Core paginated envelope contract verified **2026-11-01**.

## What already exists and must not be rewritten

`src/lib/api/axiosClient.ts` (1,132 lines) and `src/lib/auth/*` are the most
carefully built code in this repository. They are covered by tests and they
handle failure modes that are expensive to rediscover:

- **Auth-generation fencing** — a request captures the session generation it
  was issued under, and is rejected on return if the generation moved. A
  delayed response cannot revive a logged-out session.
- **Single-flight refresh** — concurrent 401s coordinate one refresh, not N.
- **Cross-tab session sync** — logout or account replacement in one tab
  invalidates in-flight work in others.
- **UUIDv7 idempotency keys** auto-attached to unsafe methods.
- **Double-submit CSRF** from `mutakamel-http-tenant-csrf` for HTTP or
  `__Host-mutakamel-tenant-csrf` for the secure cookie profile.
- **Auth mutation serialization** uses browser Web Locks when available and
  an abortable per-tab queue otherwise. Cross-tab session events and generation
  fences remain active; the queue does not provide cross-tab mutual exclusion.
- **Tenant endpoint assertion** — only same-origin paths starting with
  `/api/tenant/` are accepted. Absolute URLs (including the current origin),
  protocol-relative URLs, backslashes, whitespace/control characters and paths
  that normalize outside that namespace raise local status 400 with
  `INVALID_TENANT_ENDPOINT` before fetch or CSRF header preparation.
- **Response byte bounds**.

**Do not rewrite this file during the design-system rebuild.** It is the
non-negotiable boundary. Two narrow, listed changes are permitted — see
[the fixes](#permitted-changes) at the end.

## Canonical paths

```text
/api/tenant/core/v1/*
/api/tenant/crm/v1/*
/api/tenant/trade/v1/*
```

Same-origin, always. In development `next.config.ts` rewrites `/api/*` to
`DEV_API_TARGET` (default `http://localhost:9000`); in production the
deployment ingress owns the namespace and the rewrite is disabled.

Never construct a Gateway URL in a component. Never call `fetch` outside
`axiosClient.ts`.

## Request options

Verified **2026-10-17** (CXPORTAL-SHELL-114): ordinary requests have a 30-second
total deadline. Callers can set `timeoutMs` to a positive integer up to
2,147,483,647 milliseconds. The deadline includes headers, body consumption,
activity checkpoints and auth recovery; a replay shares the original deadline.
Caller cancellation remains an AbortError. Timers and caller listeners are
removed on settlement. Timeout does not trigger a replay.

Timeout raises the client-only `CLIENT_REQUEST_TIMEOUT` outcome (local status
504), with Arabic/English recovery copy. Writes are potentially committed;
their exact outgoing `idempotencyKey` is retained in the error and normalized
error, including automatically generated keys. Reconcile by refreshing before
saving again; an explicit retry of the same intent must reuse that key and
the same body. Existing `runIdempotentWrite` callers retain their attempt and
classify this outcome as ambiguous.

```ts
interface TenantApiRequestConfig extends RequestInit {
  timeoutMs?: number;            // total deadline; default 30,000 ms
  skipAuthRefresh?: boolean;      // do not attempt refresh on 401
  nonReplayable?: boolean;        // repair session, but NEVER replay this request
  replayAfterRefresh?: boolean;   // allow one replay for a naturally idempotent write
  skipAutoIdempotency?: boolean;  // suppress the automatic x-idempotency-key
  maxResponseBytes?: number;      // 1..10,485,760
}
```

Choosing between them is a correctness decision, not a style one:

| Route character | Options |
| --- | --- |
| GET / HEAD | defaults — safe methods replay automatically |
| Write with a caller-supplied idempotency key | defaults — the key makes replay safe |
| Naturally idempotent write (PUT of a full resource) | `replayAfterRefresh: true` |
| Write where a duplicate would double-charge or double-send | `nonReplayable: true` |
| Session revoke, logout | `skipAutoIdempotency: true` |
| Public auth (login, refresh, forgot, reset) | handled automatically |

A Gateway route marked `WRITE_SENSITIVE` **and** `idempotent: true` requires an
`x-idempotency-key`. The client attaches a UUIDv7 automatically; supply your
own only when retrying the *same user intent*, and then reuse the exact key.

## Screen API calls and validation

Request functions and their validators live together in the screen's own
`hooks/use<Name>.ts` — see
[file-architecture.md#screen-module-shape](file-architecture.md#screen-module-shape)
for why this codebase never split them into separate `api.ts`/`schema.ts`
modules despite an earlier draft of that spec saying it would.

```ts
// app/(tenant)/crm/leads/hooks/useLeads.ts

function parseLead(value: unknown): LeadItem {
  const lead = record(value);
  if (!lead) throw new Error("Invalid leads response.");
  // ... field-by-field validation, exactly as it arrives on the wire
  return { id: requiredUuidV7(lead, "id", "leads"), /* ... */ };
}

export function parseLeadsResponse(payload: unknown, expectedBranchId: string): LeadsPage {
  // ... validates the envelope, maps each item through parseLead
}

export function useLeads() {
  const fetchLeads = useCallback(async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `/api/tenant/crm/v1/leads?${query.toString()}`,
      { signal, cache: "no-store" },
    );
    const page = parseLeadsResponse(response.data, branchId);   // always validate
    // ...
  }, [/* ... */]);
  // ...
}
```

Rules:

- **Every response passes through a validator before it reaches the UI** —
  no exception.
- The parse functions (`parseLead`, `parseLeadsResponse`, …) are exported
  named functions, independently testable and tested beside the hook
  (`useLeads.test.ts`) without rendering anything.
- One request function per endpoint the hook calls, named for the operation.
- Query strings built with `URLSearchParams` — never string concatenation of
  user input.

## Runtime response validation

Non-negotiable. A backend response is untrusted input — see the `parseLead`
example above.

Two acceptable styles, both already present in the codebase:

- **Hand-written guards** — `lib/auth/sessionApi.ts` is the reference. Zero
  dependency, explicit, fast.
- **Zod** — `lib/notifications/tenant-notification-runtime.ts` is the
  reference. Better for large nested shapes.

Pick per module; do not mix within one module. Either way:

- **Unknown enum values stay recoverable.** Do not throw on an unrecognised
  status — surface it via the fallback label. Throwing means one new backend
  value takes the whole screen down.
- **Preserve exact strings** for IDs, decimals, cursors, ETags.
- Validation failure raises a normalized error; it never returns partial data.

## Decimals

Money and quantity arrive as **exact decimal strings**.

```ts
// ❌ silently loses precision, rounds trailing digits
const total = Number(opportunity.amount);

// ✅ keep the string; format for display only
const display = formatCurrency(opportunity.amount, currency, locale);
```

Never sum a column in the browser. Column totals come from the server or they
do not exist. This is a correctness rule, not a preference — see
[../design/views.md](../design/views.md#opportunities-pipeline).

## Response envelopes

The three apps do not agree, and the client must not pretend they do.

| App | Success | Failure |
| --- | --- | --- |
| Core | `{ success, data, meta?, correlationId }` | `errorCode` |
| CRM | Raw payload, or a paginated `{ items, meta }` | `CRM_VALIDATION_FAILED` |
| Trade | Envelope | `TRADE.VALIDATION_FAILED` |
| Gateway | — | Problem Details with `code` |

`unwrapCoreData<T>()` handles the Core envelope. CRM lists return
`{ items, meta }` directly — do not unwrap them through the Core helper.

For Core routes in feature code, use `src/lib/api/envelope.ts`: singleton reads
use `readCoreData` (or `src/app/(tenant)/core/core-api.ts` `coreGet` when
response headers such as strong `ETag` revisions are required), whereas
paginated Core list endpoints (`data: T[]` plus
`meta: { page, limit, total, totalPages, hasNext, hasPrev }`) MUST use
`readCorePage` paired with `parseCorePage` / `parseCorePageMeta` in
`src/app/(tenant)/core/contracts/core-page.ts` — see
[Core settings envelope](../api/core-settings.md#paginated-response-envelope-and-empty-list-metadata).

Normalize both failure shapes without discarding `correlationId`; it is the
only way to trace a report back to a server log.

## Pagination

CRM list endpoints inherit `PaginationQueryDto`:

```ts
{ page?: number; limit?: number; sortBy?: string; sortDir?: "ASC" | "DESC" }
```

Plus a **required** `branchId` on every CRM list — `BranchListQueryDto`
declares it `@IsUUID('7')` and non-optional. A CRM list request without it is a
422, so the branch selector must resolve before the first fetch.

Pagination is server-side. `DataTable` never slices a client array.

## Hook shape

```ts
export function useLeads() {
  // URL state: page, filters, sort, view, branchId
  // Server state: items, pageInfo, isLoading, error
  // Capabilities: from the capabilities endpoint, not from /auth/me guessing
  // Handlers: create, update, delete, moveStage — each optimistic where safe
  return { /* ... */ };
}
```

- The hook owns all state. Components take props.
- Filters, page, sort, view and branch live in the **URL**.
- Requests are cancelled on unmount and on parameter change — pass the
  `AbortSignal` through.
- Optimistic updates roll back on failure and surface the error.
- Never store a permission decision; re-derive from the current capabilities.

## Errors

```ts
interface NormalizedApiError {
  status: number;
  code?: string;
  message?: string;
  correlationId?: string;
  fieldErrors?: Record<string, string[]>;
}
```

Branch on **status and code**, never on message text — the backend localizes
messages by request language.

| Status | Handling |
| --- | --- |
| 400 | DTO validation. CRM: map `fieldErrors` onto `Field`s, never a toast. Core has no real field breakdown — see [errors.md](../reference/errors.md#normalized-shape) |
| 401 | Transport handles refresh. Feature code does nothing |
| 403 | **Transport already raises a toast** — do not raise a second |
| 404 | In-body not-found, with a route back |
| 409 | Toast via `errorFromApi`; refetch to show current state |
| 422 | One specific business-rule code, not a field-error bag — toast via `errorFromApi` unless it names one field |
| 5xx / network | `ErrorState` with retry |
| Timeout on a write | **Ambiguous** — persist the evidence in-body |

See [../design/patterns.md](../design/patterns.md#where-a-result-belongs) and
[../reference/errors.md](../reference/errors.md).

## Draft save receipt provenance

The tenant transport labels its own errors as originating in an HTTP
response or in the client. Routed HTTP errors carry the request method and endpoint.
The request's origin and Fetch response URL and redirect flag are also
recorded for HTTP failures. The label is set at construction and is not
derived from the response JSON. Errors built by other callers default to
unknown provenance. The draft save boundary uses the label to keep local
session fences separate from coherent Core conflict receipts. Request,
refresh and retry behavior and the normalized error shape are unchanged.

## Permitted changes

Exactly two, both narrow:

1. **Localize `dispatchForbiddenToast()`.** It currently hard-codes English
   `"Access Denied"` / `"You do not have permission to perform this action."`
   It must read from the dictionary. This is the only i18n defect inside the
   transport.
2. **Update the CSRF cookie name** if deployment changes it. Otherwise leave it.

Anything else in `axiosClient.ts` or `lib/auth/` is out of scope for the
design-system rebuild. If a screen seems to need a transport change, it almost
certainly needs a different request option instead — re-read
[Request options](#request-options).


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
ETag. Canonical template/draft identity and strictly advancing revision are still checked
by the parser and bound hook acknowledgement boundary.

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


## Private UI04 interaction proposal - 2026-11-10

UI04 depends on unchanged UI03 and accepted SC03. This cumulative private source preparation adds the app interaction boundary for selection, screen-to-mm mapping, manipulation, arrangement, clipboard and atomic overflow repair. Geometry and graph candidates must use the actual SC03 browser-safe commands and full document validation before entering the canonical UI03 store. All pointer, numeric and keyboard paths share those rules. A gesture derives from its initial full-precision source and produces one undo entry; cancellation, scope loss and session/recovery fences restore or clear it. Selection, hover, handles, snap guides and library screen pixels are ephemeral.

Approved react-moveable 0.56.0 and a qualified @mutakamel/template-schema browser-safe entry remain package-adoption prerequisites: neither is directly declared/installed in Portal. This proposal does not install, alias backend source, invent a library implementation, activate Fixed authoring, or claim mounted package qualification. Mandatory provider contracts accept real native/browser exports and actual handles only after independent qualification. Missing providers render an unavailable boundary. Current mounted Core source/layout restrictions, snapshot-body unavailability and UI03 review gates remain unchanged.

Source tests may execute actual read-only SC03 source in an external, private in-memory qualification harness; this does not add backend imports or module shims to Portal. Source case matrices and original approved image hashes prepare later controlled Playwright work. No live source/docs/control/config/package writes, builds/install, browser, PG or runtime actions are performed or authorized here. Actual persisted reload and authenticated RTL/LTR light/dark image acceptance remain downstream gates.


Scope: template-only source integration. Accounting, ledger, tax, settlement and foundation modules are excluded. Existing document-owner APIs may be consumed; missing owner APIs remain external prerequisites. No progress-basis recalculation or activation is authorized.
