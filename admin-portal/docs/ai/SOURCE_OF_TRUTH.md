# Source of Truth

Last source verification: **2026-07-30**

## Verification order

### 1. Gateway browser contract

Read:

```text
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts
```

It proves method, stored path pattern, route key/class, idempotency, transport
policy, and Gateway permission metadata. Admin Portal canonicalizes
`/api/v1/core/admin/<relative>` to:

```text
/api/admin/core/v1/<relative>
```

Use the [generated route inventory](../generated/admin-core-api-routes.md) for
exhaustive indexing, then verify the current source before implementing.

### 2. Controller and guards

Read the matching controller under:

```text
../backend/mutakamel-apps/core-app/src/admin/
```

It proves controller-relative paths, request DTOs, permissions, explicit status
codes, streaming, and delegation. Read global/module guards as well.

### 3. DTOs and wire values

Follow imported DTOs and nested validators. Verify:

- whitelisted fields and unknown-field rejection;
- optional versus nullable behavior;
- UUID version, string patterns, decimal formats, ranges, and array limits;
- exact enum values;
- query transforms;
- optimistic concurrency or expected revision fields.

Never infer writable fields from entities or frontend forms.

### 4. Service, contracts, and tests

Read enough implementation to prove safe response projections, lifecycle
transitions, pagination, stable errors, idempotency, asynchronous operation
state, and secret redaction.

### 5. Current frontend

Inspect:

```text
src/lib/api/axiosClient.ts
src/context/AuthContext.tsx
src/lib/auth/rbac.ts
src/components/auth/RequirePermission.tsx
src/app/
```

API strings in a hook prove an attempted call, not correctness. Mock objects,
local transitions, timers, redirects, and success toasts are not backend
evidence.

## Drift-prone claims

Always recheck:

- route count/existence and canonical method/path;
- permission mode and critical permission pairs;
- DTO fields and enums;
- response envelope and projection;
- idempotency mode and retry policy;
- default-off flags and release/runtime readiness;
- current frontend live/mock state;
- test, lint, build, authentication, and deployment evidence.

## Backend gap rule

When a safe route/projection is absent or gated:

1. mark the frontend area `GATED` or `PARTIAL`;
2. record the exact missing contract or release evidence;
3. do not invent a request, field, or local success;
4. do not edit backend without a separately authorized backend task.
