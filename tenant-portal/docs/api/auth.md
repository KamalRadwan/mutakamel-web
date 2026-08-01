# Tenant authentication API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/auth`
> **Controller-relative prefix:** `/tenant/auth` (mounted by Core under `/api/v1`)
> **Tenant Portal status:** Planned; no auth client exists yet in `tenant-portal`. The legacy implementation is live in `../backend/mutakamel-apps/mutakamel-web-app` and is the behavior to replace, not a path contract to copy.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Canonical path resolver: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts`
- Controller: `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.controller.ts`
- DTOs and service: `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/dto` and `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.service.ts`
- Host guard: `../backend/mutakamel-apps/core-app/src/common/fqdn/fqdn-tenant-resolver.guard.ts`
- Legacy clients: `../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/tenant-api-client.ts`, `../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/public-auth-route-registry.ts`, and `../backend/mutakamel-apps/mutakamel-web-app/src/features/auth/public-auth-flows.tsx`

## Trust and response contract

The browser must call the same-origin canonical URL. Gateway resolves the tenant from the forwarded browser host; the client must never send tenant, actor, company, branch, or internal-routing headers. All authenticated calls use an access token whose `aud` is `tenant`. The resolved host tenant and the token tenant must match.

Normal JSON success:

```json
{
  "success": true,
  "data": {},
  "correlationId": "019f9871-fd40-7680-bfbb-fd535b5880c8",
  "timestamp": "2026-07-25T12:00:00.000Z"
}
```

These objects are the standard Core success/error envelopes; `204` routes return no body.

Normal JSON error:

```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "INVALID_CREDENTIALS",
  "errorCategory": "AUTHENTICATION",
  "message": "Invalid credentials.",
  "correlationId": "019f9871-fd40-7680-bfbb-fd535b5880c8",
  "timestamp": "2026-07-25T12:00:00.000Z",
  "path": "/api/v1/tenant/auth/login"
}
```

Core globally strips unknown fields and rejects them with `400`; DTO transforms then validate the accepted fields.

## Routes

| Method and canonical browser path | Access | Rate limit | Body | Result |
|---|---|---:|---|---|
| `POST /api/tenant/core/v1/auth/login` | Public, valid tenant host | 5/min | `LoginDto` | `200`, token pair |
| `POST /api/tenant/core/v1/auth/refresh` | Public, valid tenant host | 20/min | `RefreshTokenDto` | `200`, rotated token pair |
| `POST /api/tenant/core/v1/auth/accept-invite` | Public, valid tenant host | 5/min | `AcceptInviteDto` | `200`, activates user and returns token pair |
| `POST /api/tenant/core/v1/auth/forgot-password` | Public, valid tenant host | 5/min | `ForgotPasswordDto` | `204`; deliberately identical for known/unknown email |
| `POST /api/tenant/core/v1/auth/reset-password` | Public, valid tenant host | 5/min | `ResetPasswordDto` | `204`; changes password and revokes sessions |
| `POST /api/tenant/core/v1/auth/logout` | Public; refresh-token possession is sufficient | 20/min | `RefreshTokenDto` | `204` |
| `POST /api/tenant/core/v1/auth/logout-all` | Authenticated tenant user | Gateway authenticated class | no body | `204` |
| `GET /api/tenant/core/v1/auth/me` | Authenticated tenant user | Gateway authenticated class | none | `200`, current tenant identity/access view |

Controller-relative paths are the same suffixes under `/tenant/auth`.

## Validation

| DTO | Exact accepted fields |
|---|---|
| `LoginDto` | `email`: trimmed/lowercased email, maximum 255; `password`: string, 1–128 |
| `RefreshTokenDto` | `refreshToken`: string, 16–512 |
| `AcceptInviteDto` | `token`: string, 16–512; `newPassword`: string, 12–128 and password policy |
| `ForgotPasswordDto` | `email`: trimmed/lowercased email, maximum 255 |
| `ResetPasswordDto` | `token`: string, 16–512; `newPassword`: string, 12–128 and password policy |

The password policy requires at least one lowercase letter, uppercase letter, number, and symbol. The wire fields are `token` and `newPassword`; `inviteToken`, `resetToken`, and `password` are not accepted for invitation/reset.

Safe login example:

```http
POST /api/tenant/core/v1/auth/login
Content-Type: application/json

{"email":"owner@example.test","password":"Example-only-7!Pass"}
```

Token responses include `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, and `refreshExpiresIn`. Store refresh tokens only in the server-managed session mechanism selected by the portal; do not persist them in readable browser storage.

## Session semantics, security, errors, caching, and async behavior

- Refresh tokens rotate and are single-use. Reuse detection revokes the token family and returns `TOKEN_REUSE_DETECTED`.
- Password reset and logout-all increment the session version, invalidating existing access sessions; reset also revokes refresh tokens.
- Forgot-password is enumeration-safe and always returns `204`.
- Expected auth errors include `INVALID_CREDENTIALS`, `ACCOUNT_NOT_ACTIVE`, `INVALID_REFRESH_TOKEN`, `INVALID_ACTION_TOKEN`, `TOKEN_REUSE_DETECTED`, `WEAK_PASSWORD`, and `SUBSCRIPTION_PAST_DUE`.
- Host failures can return `MISSING_HOST_HEADER`, `UNKNOWN_TENANT_HOST`, `FQDN_NOT_VERIFIED`, `TENANT_HOST_MISMATCH`, or `TENANT_INACTIVE`.
- Suspended tenants may still use the public auth routes listed above, but normal authenticated tenant APIs remain blocked.
- Auth responses are sensitive and must not be cached. No auth command uses client idempotency keys.
- No auth route returns a client-polled asynchronous job. Email delivery may continue behind the request, but the portal follows only the documented HTTP result.
