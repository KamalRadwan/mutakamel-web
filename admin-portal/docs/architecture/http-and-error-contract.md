# HTTP and Error Contract

Status: **Verified current transport contract**

Last source verification: **2026-07-30**

Owner: **API Gateway and Core**

## Browser transport

Protected calls use the shared authenticated client:

```ts
credentials: "include";
"x-auth-cookie-mode": "1";
```

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
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
  source: "CORE" | "GATEWAY" | "TRANSPORT";
}
```

Normalize `errorCode` from Core and `code` from Gateway. Preserve
`correlationId`. Never collapse `403`, `404`, `409`, `422`, unavailable, and
transport failures into one empty state.

## Current frontend gap

`src/lib/api/axiosClient.ts` partially normalizes the two error shapes, but it
still exposes broad `any` types and does not yet return the exact
`NormalizedApiError` contract. Its generic mutation interceptor also generates
keys too late to own exact user intent; callers must be refactored as described
in [permissions-idempotency-and-state.md](permissions-idempotency-and-state.md).

## Source map

- `src/lib/api/axiosClient.ts`
- `src/context/AuthContext.tsx`
- `../backend/mutakamel-apps/api-gateway-app/src/common/problem-details.exception.ts`
- `../backend/mutakamel-apps/core-app/src/common/`
