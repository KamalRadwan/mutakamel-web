# Permissions, Idempotency, and Data State

Status: **[Verified]**

Last source verification: **2026-07-30**

## Permission semantics

A permission list joined with `+` requires ALL permissions. The FQDN validation
route is the single explicit ANY-permission route in the current 232-route
Admin Core inventory.

```ts
type PermissionRequirement =
  | { mode: "ONE"; permission: string }
  | { mode: "ALL"; permissions: string[] }
  | { mode: "ANY"; permissions: string[] };
```

The frontend foundation must expose `adminCan`, `adminCanAll`, and
`adminCanAny`, and apply requirements to navigation, routes, tabs, queries,
buttons, lifecycle/destructive actions, notification actions, and async
controls.

Current source has `adminCan` and `adminCanAll`; it lacks `adminCanAny`, and
`RequirePermission` accepts only one key.

## Stable UUIDv7 intent

For a write-sensitive mutation:

1. Generate one UUIDv7 for one exact user intent.
2. Retain it while pending and for exact retries.
3. Reuse only with the same actor, method, path, query, and body.
4. Create a new key after any payload or intent change.
5. Treat `GW.IDEM.IN_FLIGHT` as still processing; reconcile/refetch.
6. Treat `GW.IDEM.MISMATCH` and `IDEMPOTENCY_KEY_REUSED` as client-command
   defects.
7. Disable duplicate submission even where the route does not require a key.

The current shared interceptor auto-generates a new key for a mutation that
does not supply one. That is a transport safety net, not sufficient intent
ownership.

## Required API states

Each query owns:

- initial loading;
- background refresh;
- loaded data;
- loaded empty;
- forbidden;
- unavailable;
- validation failure;
- conflict;
- stale optimistic concurrency;
- transport failure;
- replay/in-flight state;
- terminal asynchronous failure.

Tenant tabs load independently. A missing permission or failed nested request
must not be hidden by `Promise.allSettled`.

## Decimal and byte rules

Keep money, FX, quota, and capacity values as decimal strings. Use decimal-safe
formatting. Use `BigInt` only for integer byte-string arithmetic. Do not use
`parseFloat` for authoritative financial calculations.

## Mutation reconciliation

- Report success only after an authoritative response.
- For `202`, surface the operation and poll/reconcile it.
- For `204`, update local state only after the request succeeds.
- Refetch after lifecycle/destructive changes where the authoritative
  projection can change.

## Source map

- `src/lib/auth/rbac.ts`
- `src/components/auth/RequirePermission.tsx`
- `src/lib/api/axiosClient.ts`
- `src/app/tenants/[id]/hooks/useTenantDetail.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
