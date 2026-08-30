# Permissions, Idempotency, and Data State

Status: **[Verified]**

Last source verification: **2026-08-12**

## Permission semantics

A permission list joined with `+` requires ALL permissions. The FQDN validation
route is the single explicit ANY-permission route in the current 240-route
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

Current source has `adminCan`, `adminCanAll`, and `adminCanAny`.
`RequirePermission` accepts one exclusive requirement shape: `permission`,
`allOf`, or `anyOf`, and fails closed for empty/invalid policies.

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
ownership. The settled production Admin Portal does not rely on that fallback:
a TypeScript AST scan found 151 Axios write calls and 0 bare/implicit-policy
calls. Idempotent operations pass caller-owned keys; Gateway non-idempotent
operations explicitly use `skipAutoIdempotency` and `nonReplayable`.

For reload-sensitive high-impact commands, persist only a route-specific,
tab-scoped recovery marker before the POST: key, canonical route, a SHA-256
intent digest, safe resource identity, and timestamp. Never persist the DTO,
secret, audit reason, confirmation text, or tenant PII. Reuse requires an exact
digest match; a changed intent or unavailable browser storage fails closed.
Where a command cannot be safely reconstructed, use authoritative read-only
status recovery and block replay instead of persisting its sensitive body.

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

The shared presentation and recovery requirements for these states are defined
in [Operational UX](../design-system/operational-ux.md). Domain guides remain
authoritative for permission strings, enums, polling cadence, freshness
thresholds, and terminal behavior.

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

Use [Operational UX](../design-system/operational-ux.md#mutation-lifecycle) for
the corresponding visible pending, reconciliation, ambiguous, and result
surfaces.

## Source map

- `src/lib/auth/rbac.ts`
- `src/components/auth/RequirePermission.tsx`
- `src/lib/api/axiosClient.ts`
- `src/app/tenants/[id]/hooks/useTenantDetail.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
