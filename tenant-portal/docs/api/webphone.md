# Tenant WebPhone API

> **Contract status:** Current
> **Last verified:** 2026-09-03 against `core-app/src/webphone/tenant/tenant-webphone.controller.ts`
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/webphone/v1`
> **Controller-relative prefix:** `/tenant/webphone`
> **Tenant Portal status:** Live. `src/app/(tenant)/core/settings/webphone`.
> **Documentation:** Hand-written and source-verified; not generated.

WebPhone is a library mounted into `core-app`, but it is its own Gateway
namespace — not a section of `core`. Its routes are therefore absent from
`core.route-contracts.ts`, and its canonical prefix is
`/api/tenant/webphone/v1`, not `/api/tenant/core/v1/webphone`.

The previous implementation stored per-user SIP state as `webphone_*` columns on
`tenant_users` and served it from `/api/tenant/core/v1/users/me/webphone`. That
surface is deleted; those paths now return 404. See
[core-identity.md](core-identity.md#users--22-routes), which absorbed the
former `users.md`.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/webphone.route-contracts.ts`
- Controller: `../backend/mutakamel-apps/core-app/src/webphone/tenant/tenant-webphone.controller.ts`
- Services/DTOs: `../backend/mutakamel-apps/core-app/src/webphone`
- Shared library: `../backend/mutakamel-apps/shared-libs/packages/webphone`

## Module gate

Every route below is behind `@RequireWebphoneModule()`. A tenant without the
module receives `403 WEBPHONE_MODULE_NOT_PURCHASED`; a tenant whose subscription
has lapsed receives `403 WEBPHONE_MODULE_INACTIVE`.

**Both are expected outcomes on a read, not failures.** The portal renders them
as "not subscribed" rather than as an error banner —
`WebphoneUnavailableNotice.tsx` is that state.

Responses carry `Cache-Control: no-store` from a controller-level interceptor,
because the `/me` payload contains minted TURN credentials.

## Self-service routes

Authorization here is holding an extension, not a permission: these require no
WebPhone permission and are guarded by `WebphoneExtensionOwnerGuard`. A caller
with no extension is rejected by that guard.

| Method and canonical browser path | Access | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/me` | Extension owner | Own extension, resolved runtime configuration, minted TURN credentials |
| `GET /api/tenant/webphone/v1/me/call-logs` | Extension owner | Own recent call history |
| `POST /api/tenant/webphone/v1/me/call-logs` | Extension owner | Store one call log for the caller |

Call the `/me` read on widget mount and refresh it before
`turnCredentials.expiresAt`.

Call-log create fields:

- `type`: `IN_ANS|IN_NOANS|OUT`.
- `phoneNumber`: required/non-empty, maximum 80.
- `displayName`: optional/nullable, maximum 120.
- `startedAt`, `answeredAt`, `endedAt`: optional/nullable ISO date strings.
- `durationSeconds`: optional/nullable integer 0–86,400.
- `cause`: optional/nullable, maximum 120. **Truncated on write, never rejected.**

Call-log create is the one write here that does not take an idempotency key: a
duplicate suppressed by key would silently lose a real second call.

## Seat usage

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/seats` | `webphone.settings.read` | Purchased seats, seats in use, and the tier ceiling |

The enforced limit is the **lower** of the purchased seat count and the tier's
`maxExtensions` ceiling. A tier that grants no `webphone.extensions` ceiling
yields zero seats, not unlimited ones.

## Scope state

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/config` | `webphone.settings.read` | `{ tenantId, enabled }` — nothing else |

**Read-only, and that is the whole contract.** The scope has no stored settings
row: `enabled` is **derived**, true when the tenant holds an enabled server
carrying both a SIP domain and a WebSocket URL. There is therefore no
`PATCH .../config` — the route and its Gateway contract are both gone, and a
call to it returns `404 GW.ROUTE.UNKNOWN`. WebPhone is switched on by giving
the tenant a working server, not by writing a flag.

TURN REST minting lost its stored on/off and TTL in the same change. It runs
when `ASTERISK_TURN_SHARED_SECRET` is set in the environment and the scope has
enabled TURN entries; it is an operator concern, not a tenant setting.

## Server routes

A scope owns an ordered failover chain, and each server owns its own SIP fields
and its own ICE set — a relay is only reachable inside the network its server
lives in, so one shared ICE list would hand other servers candidates that
cannot work. The former `/config/endpoints` and `/config/ice-servers` families
are gone; these replaced them.

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/servers` | `webphone.settings.read` | The chain, lowest priority first, ICE nested |
| `POST /api/tenant/webphone/v1/servers` | `webphone.settings.update` | Append a server; an untested server never takes live traffic |
| `PUT /api/tenant/webphone/v1/servers/order` | `webphone.settings.update` | Renumber the whole chain; the body names every server once |
| `PATCH /api/tenant/webphone/v1/servers/:id` | `webphone.settings.update` | Update a server; `priority` is not editable here |
| `DELETE /api/tenant/webphone/v1/servers/:id` | `webphone.settings.update` | Remove a server; survivors are renumbered |
| `GET /api/tenant/webphone/v1/servers/:serverId/ice-servers` | `webphone.settings.read` | ICE for one server; credentials never returned |
| `POST /api/tenant/webphone/v1/servers/:serverId/ice-servers` | `webphone.settings.update` | Add an ICE server |
| `PATCH /api/tenant/webphone/v1/servers/:serverId/ice-servers/:id` | `webphone.settings.update` | Update an ICE server; `null` clears a credential |
| `DELETE /api/tenant/webphone/v1/servers/:serverId/ice-servers/:id` | `webphone.settings.update` | Remove an ICE server |

`priority` is contiguous from 1 and unique per scope, and the reorder route is
the only thing that writes it: a move renumbers every row between the two
positions, so no sequence of single-row writes stays valid in between.

## Extension routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/extensions` | `webphone.extensions.read` | Paginated extension list |
| `POST /api/tenant/webphone/v1/extensions` | `webphone.extensions.manage` | Create an extension; consumes a seat |
| `GET /api/tenant/webphone/v1/extensions/:id/servers` | `webphone.extensions.read` | This user's chain, in failover order |
| `PUT /api/tenant/webphone/v1/extensions/:id/servers` | `webphone.extensions.manage` | Replace that chain wholesale, in the given order |
| `PATCH /api/tenant/webphone/v1/extensions/:id` | `webphone.extensions.manage` | Update or enable/disable an extension |
| `DELETE /api/tenant/webphone/v1/extensions/:id` | `webphone.extensions.manage` | Remove an extension; frees its seat |

## Idempotency

Every write above except call-log create is `WRITE_SENSITIVE` and requires an
`X-Idempotency-Key` UUIDv7 through Gateway/Core. Reuse a key only for an
identical payload.

## Expected errors

- Module: `WEBPHONE_MODULE_NOT_PURCHASED`, `WEBPHONE_MODULE_INACTIVE` — render as "not subscribed".
- Seats: `WEBPHONE_SEAT_LIMIT_REACHED` (422) on create when the tenant is at its limit.
- Not found: `WEBPHONE_EXTENSION_NOT_FOUND`.

## AI implementation rules

- Never persist, log, or forward `turnCredentials`; they are short-lived secret
  material and the responses are `no-store` for that reason.
- Treat a 403 module code on a read as a render state, not an error banner.
- Re-read `/seats` after any extension create or delete; the seat counter is
  authoritative only from the server, and the enforcing check happens inside the
  create transaction.
