# HTTP and Error Contract

Status: **[Verified]**

Last source verification: **2026-07-30**

Owner: **API Gateway and Core**

## Browser transport

Protected calls use the shared authenticated client:

```ts
credentials: "include";
```

The server infers the browser channel from trusted origin/fetch metadata; the
client must not select an authentication mode with a request header.

JWT access and refresh tokens belong only in HttpOnly cookies. Browser-readable
storage may not retain them.

## Core success

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}
```

Rows are in `data`; pagination totals use `meta.total`. `DELETE 204` has no
response body.

## Core failure

```ts
interface CoreErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  path: string;
}
```

## Gateway Problem Details

```ts
interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  correlationId: string;
  errors?: Record<string, string[]>;
}
```

## Required frontend normalization

```ts
interface NormalizedApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId?: string;
  source: "CORE" | "GATEWAY" | "TRANSPORT";
}
```

Normalize `errorCode` from Core and `code` from Gateway. Preserve
`correlationId`. Never collapse `403`, `404`, `409`, `422`, unavailable, and
transport failures into one empty state.

The mapping from normalized errors to inline, summary, toast, banner,
permission, degraded, and ambiguous-outcome surfaces is defined in
[Operational UX](../design-system/operational-ux.md#feedback-hierarchy).

## Current frontend gap

`src/lib/api/axiosClient.ts` partially normalizes the two error shapes, but it
still exposes broad `any` types and does not yet return the exact
`NormalizedApiError` contract.

The older implicit-idempotency-callsite gap is closed: the later verified
[permissions/idempotency contract](permissions-idempotency-and-state.md#stable-uuidv7-intent)
records 151 Axios writes and zero bare/implicit-policy calls. The transport
fallback remains a safety net, not intent ownership.

## Source map

- `src/lib/api/axiosClient.ts`
- `src/context/AuthContext.tsx`
- `../backend/mutakamel-apps/api-gateway-app/src/common/problem-details.exception.ts`
- `../backend/mutakamel-apps/core-app/src/common/`
