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

### A handle the server returns once still has to survive a reload

The same marker answers a rarer problem: a command whose *completion*, not its
retry, needs a handle the server hands back once and will not hand back again.
A safe credential rotation returns the rotation record's id, then makes the
operator wait out a grace window of one to twenty-four hours before the revoke
that finishes it — and Core has no route that reads rotations back. Held in
component state, that handle is gone at the first reload, and the rotation
cannot be completed from the portal at all.

Persist it the same way: the record's identity and lifecycle, never the body
that created it, scoped to the resource, retired the moment the command
completes, discarded after a bounded retention. Unlike a replay marker this one
cannot fail closed — the command already succeeded on the server — so when the
browser refuses to store it, say so on the card and fall back to the old rule
of finishing before leaving the page. `rotation-receipt.ts` is the case in the
portal. Treat the missing read projection as the gap it is: this is a stopgap
for a server projection, never a substitute for one.

### Bodyless commands own the state they act on

Rule 3 says reuse only with the same body — which decides nothing for a command
whose body is empty. A command that acts on server-held state, and sends none of
it, must fold that state's identity into its own retry key, or the Gateway will
answer a retry with a stored result for whatever the state used to be.

`POST /system-settings/email/verify-connection` is the case in the portal: it is
write-sensitive and idempotent at the Gateway, and its request carries no body
and no revision. Its intent key is therefore keyed by the saved configuration's
`revision` and `updatedAt` (`useSmtpSettings.ts`). An ambiguous probe of one
revision keeps its key, so retrying reconciles that same probe; saving a new
revision retires it, so the next probe is a real probe and cannot render an
older configuration's `{verified:true}` as a result for the one on screen.

### A redacted body still has to distinguish two secrets

A fingerprint built from the request body must never contain a secret and must
still tell two different secrets apart. Replacing every secret with one constant
marker satisfies the first and breaks the second: two different values look like
one intent, so a retry after an ambiguous save reuses the previous value's key,
and the Gateway — which hashes the real body — answers `GW.IDEM.MISMATCH`.

Digest the secret instead. `useWebphoneSettings.ts` fingerprints a TURN
credential as SHA-256 over a per-page-load random salt and the value: stable for
an exact retry, different for a different credential, and worthless without the
salt, which never leaves the module and is never sent, stored, or logged.

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
- A reconciling refetch is a refresh, never a load. Keep the two apart in the
  hook and gate the route's loading frame on the load alone.

Use [Operational UX](../design-system/operational-ux.md#mutation-lifecycle) for
the corresponding visible pending, reconciliation, ambiguous, and result
surfaces.

### A refetch must not unmount the surface that is waiting for the result

The mutation helper awaits its reconciling refetch before it hands the command
result back, so anything that refetch tears down is torn down *before* the
caller can render what the command answered. A route that renders a loading
frame whenever its detail hook reports `isLoading` therefore destroys the dialog
that issued the command: the receipt is assigned to an unmounted instance, and
the replacement mounts with its state reset. Commands that report per-item
outcomes rather than throwing — the application database binding's per-server
report is the sharp case — lose their only surface this way even when the
command fully succeeded, and any unsaved input in other open dialogs goes with
it.

So a detail hook distinguishes the first read of a resource, which owns
`isLoading` because there is nothing to show yet, from a re-read over a snapshot
already displayed, which reports `isRefreshing` and leaves the tree mounted. A
failed re-read keeps the last good snapshot and reports through the toast rather
than replacing the page with an error frame — the operator keeps whatever the
open dialog was showing them. Both paths stay inside the existing owner-token
and generation fences, so a response for a resource the route has moved off is
still discarded. `useApplication` is the reference implementation.

## Source map

- `src/lib/auth/rbac.ts`
- `src/components/auth/RequirePermission.tsx`
- `src/lib/api/axiosClient.ts`
- `src/app/tenants/[id]/hooks/useTenantDetail.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
