# Trade API Safe Examples

> Contract status: source-verified illustrative request patterns
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: hand-written examples checked against controller DTOs
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`
> Tenant Portal status: replacement Trade API helpers are not implemented; names such as `tenantTradeApi` and `createUuidV7` below are proposed abstractions, not existing imports.

All identifiers and payload data are illustrative. Obtain real company, branch, resource, version, and ETag values from authorized server responses. Never paste real tokens, tenant database names, secrets, signed URLs, or customer data into fixtures or documentation.

## Shared request assumptions

The examples assume a same-origin authenticated client:

```ts
type TradeRequest = {
  method?: "GET" | "POST" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

declare const tenantTradeApi: {
  request<T>(path: string, request?: TradeRequest): Promise<{
    status: number;
    headers: Headers;
    body: T;
  }>;
  upload<T>(
    path: string,
    request: { headers: Record<string, string>; body: FormData },
  ): Promise<{ status: number; headers: Headers; body: T }>;
};

declare function createUuidV7(): string;
```

The shared client should add JSON `Content-Type` only when a JSON body exists, preserve response headers, distinguish success envelopes from both upstream Trade/Nest errors and Gateway Problem Details, and use the portal's established authentication mechanism. It must reject non-canonical Trade paths.

Use a new UUIDv7 per command intent:

```ts
const companyId = "019f7000-0000-7000-8000-000000000001";
const branchId = "019f7000-0000-7000-8000-000000000002";
const commandKey = createUuidV7(); // retain this value for retries of this intent
```

Do not use `crypto.randomUUID()` for this header: it produces UUIDv4, while Trade requires UUIDv7.

## Read a company-scoped item page

```ts
const response = await tenantTradeApi.request(
  "/api/tenant/trade/v1/items?page=1&limit=25&status=ACTIVE",
  {
    method: "GET",
    headers: {
      "X-Mutakamel-Company-Id": companyId,
    },
  },
);
```

The list DTO defaults `page` to 1 and `limit` to 25; the limit maximum is 100. Do not send unknown query parameters.

## Create a tenant-master item

`POST /items` is tenant-scoped, so do not add company/branch headers merely because the subsequent profile routes need them.

```ts
const response = await tenantTradeApi.request(
  "/api/tenant/trade/v1/items",
  {
    method: "POST",
    headers: {
      "X-Idempotency-Key": commandKey,
    },
    body: {
      canonicalCode: "SKU-100",
      itemKind: "PRODUCT",
      localizedNames: {
        en: "Sample item",
        ar: "صنف تجريبي",
      },
      baseUomId: "019f7000-0000-7000-8000-000000000003",
    },
  },
);
```

Optional extension values are accepted only with DTO fields `extensionProfileVersionId` and `extensionValues: [{ fieldKey, value }]`. Do not spread a returned item entity into the create/update body.

## Update with an ETag

Read the resource first and preserve its response `ETag`, for example `"3"`.

```ts
const updateKey = createUuidV7();

await tenantTradeApi.request(
  "/api/tenant/trade/v1/channels/019f7000-0000-7000-8000-000000000004",
  {
    method: "PATCH",
    headers: {
      "X-Mutakamel-Company-Id": companyId,
      "X-Idempotency-Key": updateKey,
      "If-Match": '"3"',
    },
    body: {
      name: "Wholesale channel",
    },
  },
);
```

On a stale-version conflict, refetch and reconcile. Never retry with a newer `If-Match` while silently retaining an old body.

## Record an opening balance

Decimal quantities stay JSON strings and all IDs/operation keys are UUIDv7:

```ts
await tenantTradeApi.request(
  "/api/tenant/trade/v1/inventory/opening-balances",
  {
    method: "POST",
    headers: {
      "X-Mutakamel-Company-Id": companyId,
      "X-Mutakamel-Branch-Id": branchId,
      "X-Idempotency-Key": createUuidV7(),
    },
    body: {
      nodeId: "019f7000-0000-7000-8000-000000000005",
      itemId: "019f7000-0000-7000-8000-000000000006",
      uomId: "019f7000-0000-7000-8000-000000000007",
      quantity: "12.500",
      itemProfileVersion: 2,
      businessEffectiveAt: "2026-07-25T09:30:00.000Z",
      operationKey: "019f7000-0000-7000-8000-000000000008",
      tracking: {},
    },
  },
);
```

The idempotency key and `operationKey` are separate contracts; both are required.

## Confirm a sales order with 200/202 handling

Confirmation can complete synchronously or create an orchestration attempt:

```ts
const result = await tenantTradeApi.request<{
  success: true;
  data: unknown;
  correlationId: string | null;
  timestamp: string;
}>(
  "/api/tenant/trade/v1/sales-orders/019f7000-0000-7000-8000-000000000009/confirm",
  {
    method: "POST",
    headers: {
      "X-Mutakamel-Company-Id": companyId,
      "X-Mutakamel-Branch-Id": branchId,
      "X-Idempotency-Key": createUuidV7(),
      "If-Match": '"4"',
    },
    body: {},
  },
);

if (result.status === 202) {
  const statusPath = result.headers.get("Location");
  const retryAfterSeconds = Number(result.headers.get("Retry-After") ?? "2");
  // Validate that statusPath begins with /api/tenant/trade/v1/ before polling.
  // Schedule cancellable polling; do not treat acceptance as confirmation.
}
```

The Gateway canonicalizes the upstream `Location`. Poll `GET /sales-orders/:id/confirmation-attempts/:attemptId` and keep the same company/branch context.

## Create and poll an invoice PDF render job

The body `purpose` must match the route family:

```ts
const created = await tenantTradeApi.request(
  "/api/tenant/trade/v1/invoices/019f7000-0000-7000-8000-000000000010/render-pdf",
  {
    method: "POST",
    headers: {
      "X-Mutakamel-Company-Id": companyId,
      "X-Mutakamel-Branch-Id": branchId,
      "X-Idempotency-Key": createUuidV7(),
    },
    body: {
      sourceVersion: 3,
      purpose: "INVOICE",
      locale: "en",
      timeZone: "Africa/Cairo",
    },
  },
);

if (created.status !== 202) throw new Error("PDF job was not accepted");
const location = created.headers.get("Location");
if (!location?.startsWith("/api/tenant/trade/v1/")) {
  throw new Error("Unexpected PDF status location");
}
```

Poll the returned path with the same branch scope. Respect `Retry-After` when present. Never persist or telemetry-log a completed private artifact URL.

## Upload an import source

Use one `file` part, no form fields, and let the browser generate the multipart boundary:

```ts
const form = new FormData();
form.append("file", selectedFile, selectedFile.name);

const response = await tenantTradeApi.upload(
  "/api/tenant/trade/v1/imports/sources",
  {
    headers: {
      "X-Mutakamel-Company-Id": companyId,
      "X-Idempotency-Key": createUuidV7(),
      // Do not set Content-Type here.
    },
    body: form,
  },
);
```

Accepted content is UTF-8 CSV or XLSX and is capped at 50 MiB. Use the returned source/file ID for `POST /imports/preview`; never send a browser-created object reference, hash, media type, or file-size claim.

## Success and error parsing

Typical Trade success:

```json
{
  "success": true,
  "data": {},
  "correlationId": "safe-trace-id",
  "timestamp": "2026-07-25T09:30:00.000Z"
}
```

Trade-originated validation or domain errors remain raw Nest exception bodies when they pass through the Gateway:

```json
{
  "code": "TRADE.VALIDATION_FAILED",
  "message": [
    {
      "property": "canonicalCode",
      "constraints": {
        "minLength": "canonicalCode must be longer than or equal to 1 characters"
      }
    }
  ]
}
```

Constraint text above is illustrative. A generic Nest failure can instead resemble:

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

A failure created by the Gateway, rather than returned by Trade, uses Problem Details:

```json
{
  "type": "https://errors.mutakamel.example/UPSTREAM_UNAVAILABLE",
  "title": "Trade service is unavailable",
  "status": 503,
  "code": "UPSTREAM_UNAVAILABLE",
  "instance": "/api/tenant/trade/v1/items",
  "correlationId": "safe-trace-id"
}
```

The Problem Details `type` host and title are illustrative. Normalize status from the HTTP response. If the error body has the Gateway Problem Details fields, retain its `code` and `correlationId`; otherwise treat it as a raw Trade/Nest error and retain a stable `code` only when present. Do not expose raw validation objects or stack traces.

## Retry decision table

| Situation | Safe client action |
|---|---|
| Read request failed before a response | Retry according to shared Gateway policy and cancellation/backoff rules. |
| Domain command outcome is unknown | Retry the exact request with the same UUIDv7 idempotency key. |
| Payload or scope changed | Start a new intent with a new key. |
| 202 accepted | Poll the returned/documented status resource; do not replay create continuously. |
| 409 stale version | Refetch and reconcile; do not overwrite. |
| 422 idempotency mismatch | Stop; the key was reused for a different request. |
| 401 session invalidated | Re-enter the established authentication flow. |
| 403 seat/feature/permission/scope denied | Do not retry automatically; refresh entitlement/context only through authorized Core flows. |
| 429/503 | Honor `Retry-After` when supplied and use bounded backoff. |
