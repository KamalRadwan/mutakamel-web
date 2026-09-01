# Tenant WebPhone API

> **Contract status:** Current
> **Last verified:** 2026-08-29
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

## Server configuration routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/config` | `webphone.settings.read` | SIP server configuration |
| `PATCH /api/tenant/webphone/v1/config` | `webphone.settings.update` | Update SIP server configuration |
| `GET /api/tenant/webphone/v1/config/endpoints` | `webphone.settings.read` | Endpoint list, by priority |
| `POST /api/tenant/webphone/v1/config/endpoints` | `webphone.settings.update` | Add an endpoint |
| `PATCH /api/tenant/webphone/v1/config/endpoints/:id` | `webphone.settings.update` | Update an endpoint |
| `DELETE /api/tenant/webphone/v1/config/endpoints/:id` | `webphone.settings.update` | Remove an endpoint |
| `GET /api/tenant/webphone/v1/config/ice-servers` | `webphone.settings.read` | ICE server list |
| `POST /api/tenant/webphone/v1/config/ice-servers` | `webphone.settings.update` | Add an ICE server |
| `PATCH /api/tenant/webphone/v1/config/ice-servers/:id` | `webphone.settings.update` | Update an ICE server |
| `DELETE /api/tenant/webphone/v1/config/ice-servers/:id` | `webphone.settings.update` | Remove an ICE server |

Endpoint priority is unique within a tenant; a duplicate returns `409`.

## Extension routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/webphone/v1/extensions` | `webphone.extensions.read` | Paginated extension list |
| `POST /api/tenant/webphone/v1/extensions` | `webphone.extensions.manage` | Create an extension; consumes a seat |
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
