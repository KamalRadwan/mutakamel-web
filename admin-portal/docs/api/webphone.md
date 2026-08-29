# Admin WebPhone API

Status: **[Verified]**

Last source verification: **2026-08-29**

Owner: **Core**

Canonical browser prefix: `/api/admin/webphone/v1`

WebPhone is a library mounted into `core-app`, but it is its own Gateway
namespace — not a section of `core`. Its routes therefore live in
`webphone.route-contracts.ts` and do not appear in the
[generated Core inventory](../generated/admin-core-api-routes.md), whose stated
scope is Core Admin routes only.

Unlike the tenant surface, admin access is **never entitlement-gated**: support
staff must be able to diagnose a customer's telephony without a subscription
check standing in the way. Admin extensions carry no seat limit and no price.

The previous implementation stored per-user SIP state as `webphone_*` columns on
`admin_users` and `tenant_users`. Those columns, the
`public.admin_webphone_call_logs` table, and the 22 `asterisk.*` settings keys
are all removed. See [users.md](users.md), [tenant-users.md](tenant-users.md),
and [system-settings.md](system-settings.md).

## Self-service route matrix

Authorization is holding an extension, not a permission: these carry no
`admin.webphone.*` requirement and are guarded by `WebphoneExtensionOwnerGuard`.

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/me` | Extension owner | `200` | `DONE` |
| `GET /api/admin/webphone/v1/me/call-logs` | Extension owner | `200` | `DONE` |
| `POST /api/admin/webphone/v1/me/call-logs` | Extension owner | `201` | `DONE` |

Call the `/me` read on widget mount and re-fetch about 60 seconds before
`turnCredentials.expiresAt`.

## Platform configuration route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/config` | `admin.webphone.read` | `200` | `DONE` |
| `PATCH /api/admin/webphone/v1/config` | `admin.webphone.update` | `200` | `DONE` |
| `GET /api/admin/webphone/v1/config/endpoints` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/config/endpoints` | `admin.webphone.update` | `201` | `DONE` |
| `PATCH /api/admin/webphone/v1/config/endpoints/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/config/endpoints/:id` | `admin.webphone.update` | `204` | `DONE` |
| `GET /api/admin/webphone/v1/config/ice-servers` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/config/ice-servers` | `admin.webphone.update` | `201` | `DONE` |
| `PATCH /api/admin/webphone/v1/config/ice-servers/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/config/ice-servers/:id` | `admin.webphone.update` | `204` | `DONE` |

Endpoint priority is unique; a duplicate returns `409`, not `500`.

## Admin extension route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/extensions` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/extensions` | `admin.webphone.update` | `201` | `DONE` |
| `PATCH /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `204` | `DONE` |

## Cross-tenant and fleet route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/tenants/:tenantId/config` | `admin.webphone.read` | `200` | `DONE` |
| `PATCH /api/admin/webphone/v1/tenants/:tenantId/config` | `admin.webphone.update` + `admin.webphone.critical` | `200` | `DONE` |
| `GET /api/admin/webphone/v1/tenants/:tenantId/extensions` | `admin.webphone.read` | `200` | `DONE` |
| `GET /api/admin/webphone/v1/fleet/seats` | `admin.webphone.read` | `200` | `DONE` |

Paired permissions use ALL semantics. Writing another tenant's configuration is
the one command here that additionally requires `critical`; cross-tenant reads
are audited.

## Idempotency and state

Gateway write-sensitive routes require UUIDv7 intent keys. Disable duplicate
submissions and retain the original key for an exact retry. Call-log create is
the exception and takes no key: a duplicate suppressed by key would silently
lose a real second call.

Responses carry `Cache-Control: no-store` from a controller-level interceptor,
because the `/me` payload contains minted TURN credentials.

## Current frontend evidence

- `src/app/settings/webphone/hooks/useWebphoneSettings.ts`
- `src/app/settings/webphone/components/`
- `src/components/layout/WebRTCPhoneWidget.tsx`
- `src/components/layout/hooks/useWebRTCPhone.ts`
- Shared client: `@mutakamel/webphone` (`packages/webphone`)

## Source map

- `../backend/mutakamel-apps/core-app/src/webphone/admin/admin-webphone.controller.ts`
- `../backend/mutakamel-apps/core-app/src/webphone/admin/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/webphone.route-contracts.ts`
- `../backend/mutakamel-apps/shared-libs/packages/webphone`

## AI implementation rules

- Never persist, log, or forward `turnCredentials`; they are short-lived secret
  material and the responses are `no-store` for that reason.
- Re-fetch `/fleet/seats` after a tenant extension mutation rather than adjusting
  a local count; the authoritative check runs inside the create transaction.
