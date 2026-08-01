# Error Handling

Status: **verified current Gateway, Core, CRM, and Trade distinctions**

Last verified: **2026-07-25**

## Current error families

The Gateway proxies owning-app status, headers, and bodies. It does not convert
every upstream application error into one edge format.

### Gateway Problem Details

Failures originating at the Gateway or its upstream transport use Problem
Details:

```ts
type GatewayProblem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  correlationId?: string;
  errors?: unknown;
};
```

### Core and CRM application errors

Core and CRM install the shared exception filter:

```ts
type CoreOrCrmError = {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  errorCategory:
    | "VALIDATION"
    | "AUTH"
    | "AUTHORIZATION"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMIT"
    | "SERVER_ERROR";
  path: string;
};
```

### Trade application errors

Trade wraps successes but does not install the shared exception filter.
Current Trade exceptions use Nest/exception response bodies. Many expose a
stable `code` and a `message`, while framework fields and validation-message
structure depend on the thrown exception.

Do not require `success:false`, `errorCode`, or `errorCategory` to recognize a
non-2xx Trade error. HTTP status is authoritative; preserve a string `code`
when present and map unknown structures to a safe generic error.

## Normalized frontend model

Normalize the three wire families only after retaining the original status and
safe evidence:

```ts
type NormalizedApiError = {
  app: "gateway" | "core" | "crm" | "trade";
  status: number;
  code?: string;
  category?: string;
  message: string;
  fields: Record<string, string[]>;
  correlationId?: string;
  retryAfterSeconds?: number;
};
```

Do not invent a code/category absent from the wire response, and do not expose
raw class-validator objects, stack traces, provider payloads, or database
messages.

## Behavior by status

| Status | Client behavior |
| --- | --- |
| `400`/`422` | Map only safe, recognized field details and show a form summary |
| `401` | Coordinate one allowed refresh for an ordinary protected request; otherwise clear that session generation |
| `403` | Show forbidden/capability state; never convert it to empty data |
| `404` | Show not found; the domain can intentionally conceal unauthorized resources |
| `409` | Re-read authoritative state and explain conflict/in-flight duplicate |
| `412` | Refresh ETag/version evidence before permitting a new intent |
| `413` | Show size-limit failure; do not retry the same payload |
| `415` | Reject unsupported content type/file without fallback conversion |
| `423` | Show the documented locked/suspended/provisioning state |
| `428` | Obtain the required precondition; do not fabricate it |
| `429` | Respect a bounded `Retry-After` and stop request storms |
| `500` | Show generic safe failure and correlation ID |
| `502`/`503`/`504` | Show dependency unavailable/timeout and route-specific retry policy |

## Field errors

- Core/CRM `details` keys can be nested field paths.
- Trade validation uses code `TRADE.VALIDATION_FAILED`; its message can contain
  validator objects rather than a ready-to-display field map.
- Gateway `errors` is edge-contract-specific.
- Map only paths present in the current form schema.
- Unknown/general errors go to a form summary, never an invented field.
- Clear a server field error only after the related input changes or a later
  submission succeeds.

## Correlation IDs

- Preserve a correlation ID from body and/or headers.
- Show/copy it in support details when safe.
- Log the ID, route key, status, and stable code—not secrets or full bodies.
- A missing correlation ID must not prevent safe error handling.

## Retry policy

Safe automatic retry depends on:

- HTTP method;
- Gateway transport retry mode;
- current session/scope generation;
- retained idempotency key and request fingerprint;
- whether a response was received or the outcome is ambiguous;
- owner-app domain state and preconditions.

Never retry every `5xx`, every GET, or every `idempotent:true` route blindly.

## Display message safety

Safe priority:

1. localized Portal copy keyed by a verified stable code;
2. a backend message explicitly classified as safe;
3. category/status fallback;
4. correlation ID for support.

Trade validator objects and unknown Gateway/upstream details must not be
stringified into the page.

## Source evidence

```text
../backend/mutakamel-apps/api-gateway-app/src/common/filters/problem-details.filter.ts
../backend/mutakamel-apps/api-gateway-app/src/common/problem-details.exception.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-client.service.ts
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/filters/all-exceptions.filter.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/dtos/error-response.dto.ts
../backend/mutakamel-apps/trade-app/src/main.ts
../backend/mutakamel-apps/trade-app/src/common/common.module.ts
```
