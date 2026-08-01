# Tenant host-status API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser path:** `/api/tenant/core/v1/public/tenant-host/status`
> **Controller-relative path:** `/tenant/host-status` (mounted under `/api/v1`)
> **Tenant Portal status:** Planned. The legacy server-side gate is live in `../backend/mutakamel-apps/mutakamel-web-app`; the replacement must preserve server-before-render validation.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contract: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/service: `../backend/mutakamel-apps/core-app/src/tenant/tenant-host/tenant-host-status.controller.ts` and `../backend/mutakamel-apps/core-app/src/tenant/tenant-host/tenant-host-status.service.ts`
- Resolver guard: `../backend/mutakamel-apps/core-app/src/common/fqdn/fqdn-tenant-resolver.guard.ts`
- Platform validation controller/service: `../backend/mutakamel-apps/core-app/src/admin/tenants/fqdn-validation.controller.ts` and `../backend/mutakamel-apps/core-app/src/admin/tenants/fqdn-validation.service.ts`
- Legacy server client/gate: `../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/tenant-host-status.ts` and `../backend/mutakamel-apps/mutakamel-web-app/src/app/layout.tsx`

## Contract

`GET /api/tenant/core/v1/public/tenant-host/status` is public and accepts no query or body. Core takes the first value of `x-forwarded-host`, falling back to `Host`, removes a port/trailing dot, lowercases it, and validates DNS label syntax. IP literals, malformed names, unverified FQDN rows, and inactive/missing tenants are rejected.

Success is intentionally non-identifying:

Safe response example:

```json
{
  "success": true,
  "data": {"status":"ACTIVE"},
  "correlationId": "019f9871-fd40-7680-bfbb-fd535b5880c8",
  "timestamp": "2026-07-25T12:00:00.000Z"
}
```

`status` is exactly `ACTIVE` or `SUSPENDED`. The endpoint does not return tenant IDs, subscription data, or branding.

Unknown, malformed, unverified, or inactive hosts return `404` with `TENANT_HOST_NOT_FOUND`. The indistinguishable response prevents tenant enumeration.

## Portal integration and security

Run this check from a server component/layout before rendering login:

1. Let the browser/server proxy preserve the real request host.
2. Call the same-origin canonical path; do not manufacture `x-forwarded-host`.
3. Render login for `ACTIVE`.
4. Render the suspension state plus login for `SUSPENDED`; tenant-owner login remains allowed.
5. Return a real `404` for every host-status `404`.

Gateway strips client-supplied trusted headers before forwarding. The endpoint bypasses the normal tenant resolver only so it can perform this bootstrap lookup itself. Treat it as `no-store`; host state can change and must not be cached across requests or tenants. It has no idempotency behavior.

## Platform-only FQDN validation callback

| Method and exact canonical browser path | Portal use |
|---|---|
| `GET /api/tenant/core/v1/public/fqdn-validation/:token` | **DO_NOT_CALL** |

This public, idempotent callback is used by the backend domain-ownership probe, not by Tenant Portal UI. Core skips tenant resolution, validates an opaque token of 1–96 characters matching `^[A-Za-z0-9_-]+$`, binds it to the actual request host, consumes it through the validation service, and returns `{valid:boolean}` in the normal envelope. It is throttled to 5 calls per 60 seconds.

The token is secret validation material. The portal must not request, display, store, log, prefetch, cache, or retry this callback. Domain setup is driven through the owning admin/control-plane workflow.

Errors use the standard Core error envelope. Both public host routes are synchronous; neither returns a client-polled asynchronous job.
