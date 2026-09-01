# Data Layer

Status: **verified against current source**

Last source verification: **2026-08-31**

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
- **Relative-origin assertion** — a request to an absolute or protocol-relative
  URL throws rather than leaking credentials off-origin.
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

```ts
interface TenantApiRequestConfig extends RequestInit {
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
