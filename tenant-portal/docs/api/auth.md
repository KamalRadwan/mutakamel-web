# Tenant authentication API

Email/password is the only enabled interactive login method. This contract does
not add Google, social, OIDC, or another third-party identity-provider login.

> **Contract status:** Accepted direct-cutover session contract
> **Last verified:** 2026-08-10
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/auth`
> **Controller-relative prefix:** `/tenant/auth` (mounted by Core under `/api/v1`)
> **Tenant Portal status:** Source-integrated; authenticated runtime verification remains open.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Canonical path resolver: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts`
- Controller: `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.controller.ts`
- DTOs and service: `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/dto` and `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.service.ts`
- Host guard: `../backend/mutakamel-apps/core-app/src/common/fqdn/fqdn-tenant-resolver.guard.ts`
- Current Portal client: `src/context/AuthContext.tsx`,
  `src/lib/api/axiosClient.ts`, `src/lib/auth/sessionCoordinator.ts`, and
  `src/lib/auth/sessionApi.ts`
- Consolidated migration/reference client:
  `../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/tenant-api-client.ts`
  and its shared Auth foundations; that workspace is absent from the current
  checkout and is not current runtime authority.

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

The `path` member above is Core's upstream error-envelope value after Gateway
mapping. It does not change the browser contract: the request URL remains
`/api/tenant/core/v1/auth/login`, and clients must not construct routes from
the error-envelope path.

Core globally strips unknown fields and rejects them with `400`; DTO transforms then validate the accepted fields.

## Routes

| Method and canonical browser path | Access | Rate limit | Body | Result |
|---|---|---:|---|---|
| `POST /api/tenant/core/v1/auth/login` | Public, valid tenant host | 5/min | `LoginDto` | `200`, safe cookie-session metadata |
| `POST /api/tenant/core/v1/auth/refresh` | Public, valid tenant host | 20/min | no body | `200`, refreshed access/session metadata |
| `POST /api/tenant/core/v1/auth/accept-invite` | Public, valid tenant host | 5/min | `AcceptInviteDto` | `200`, activates user and returns safe cookie-session metadata |
| `POST /api/tenant/core/v1/auth/forgot-password` | Public, valid tenant host | 5/min | `ForgotPasswordDto` | `204`; deliberately identical for known/unknown email |
| `POST /api/tenant/core/v1/auth/reset-password` | Public, valid tenant host | 5/min | `ResetPasswordDto` | `204`; changes password and revokes sessions |
| `POST /api/tenant/core/v1/auth/logout` | Public; session-cookie possession is sufficient | 20/min | no body | `204` |
| `POST /api/tenant/core/v1/auth/logout-all` | Authenticated tenant user | Gateway authenticated class | no body | `204` |
| `GET /api/tenant/core/v1/auth/me` | Authenticated tenant user | Gateway authenticated class | none | `200`, current tenant identity/access view |
| `GET /api/tenant/core/v1/auth/sessions` | Authenticated tenant user | Gateway authenticated class | none | `200`, safe self-session list |
| `POST /api/tenant/core/v1/auth/activity` | Authenticated tenant user | Gateway authenticated class | no body | `204`, bounded trusted-human idle checkpoint |
| `DELETE /api/tenant/core/v1/auth/sessions/:sessionId` | Authenticated tenant user | Gateway authenticated class | none | `204`, revoke one owned session |

Controller-relative paths are the same suffixes under `/tenant/auth`.

## Validation

| DTO | Exact accepted fields |
|---|---|
| `LoginDto` | `email`: trimmed/lowercased email, maximum 255; `password`: string, 1–128 |
| `AcceptInviteDto` | `token`: string, 16–512; `newPassword`: string, 12–128 and password policy |
| `ForgotPasswordDto` | `email`: trimmed/lowercased email, maximum 255 |
| `ResetPasswordDto` | `token`: string, 16–512; `newPassword`: string, 12–128 and password policy |

The password policy requires at least one lowercase letter, uppercase letter, number, and symbol. The wire fields are `token` and `newPassword`; `inviteToken`, `resetToken`, and `password` are not accepted for invitation/reset.

Safe login example:

```http
POST /api/tenant/core/v1/auth/login
Content-Type: application/json
x-auth-remember: 1

{"email":"owner@example.test","password":"Example-only-7!Pass"}
```

The web request sends `credentials: include`. Core infers the browser channel
from trusted origin/fetch metadata and returns no readable access or refresh
token. The cookie response is:

```ts
interface TenantWebAuthResponse {
  tokenType: "Bearer";
  expiresIn: number;
  sessionExpiresIn: number;
  session: {
    id: string;
    clientId: string;
    clientType: string;
    createdAt: string;
    lastRefreshAt: string | null;
    lastUserActivityAt: string | null;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
    refreshUseCount: string;
    accessIssueCount: string;
    credentialVersion: number;
    authorizationVersion: number;
    profileVersion: number;
  };
}
```

The browser rejects any cookie-mode response that contains `accessToken` or
`refreshToken` rather than persisting or forwarding it. Core sets the access
JWT in `__Host-mutakamel-tenant-access` and the reusable credential in
`__Host-mutakamel-tenant-session`; both are host-only, `Secure`, `HttpOnly`,
`SameSite=Lax`, `Path=/`, and have no `Domain`.

`x-auth-remember` is a login-only preference: `1` or `true` requests
persistent cookies; every other value requests browser-session cookies. Core
stores the result on the Auth Session, and every later refresh reapplies that
server value regardless of any per-tab/header value. Remember-me never changes
the two-hour idle or 24-hour absolute deadline. Safe response JSON deliberately
omits the persistence flag; the locally retained non-secret preference is UI
and coordination state, not authority.

Core also sets `__Host-mutakamel-tenant-csrf` as a host-only, `Secure`,
`SameSite=Lax`, `Path=/`, no-`Domain`, non-HttpOnly session-bound proof. The
shared client copies its decoded value to `x-csrf-token` on unsafe cookie-
authenticated requests, including refresh, logout, and session revoke. Feature
code must never persist or log this proof. Every auth-cookie set or clear
response remains `Cache-Control: no-store`, `Pragma: no-cache`, and `Expires: 0`.

Refresh and logout carry no body: the reusable credential is read only from
the HttpOnly cookie. Local logout/tombstone notification occurs only after a
durable `204` or an explicit terminal session error. A permission, network,
rate-limit, or `5xx` failure leaves the session intact and visible as
authenticated/degraded so the user can retry.

## Session semantics, security, errors, caching, and async behavior

- A normal refresh reuses one opaque HttpOnly session credential. Concurrent
  refreshes are valid and every accepted refresh endpoint call, including an
  exact retry, increments `refreshUseCount` atomically; logout/revocation
  validation does not. Issuing an access token increments `accessIssueCount`
  independently. Ordinary refresh does not rotate the credential or advance
  `credentialVersion`; only explicit replacement or a forward HMAC-key
  migration advances that version.
- RBAC/profile changes make access metadata stale and require refresh plus
  `/auth/me`; they do not replace the session credential.
- Password reset, identity security changes, and logout-all invalidate the
  applicable server sessions.
- The client emits `x-auth-user-activity: 1` only after a trusted input event in
  a visible tab. Core requests touch there directly; before CRM/Trade requests,
  the client calls `POST /auth/activity`. Refresh, polling, timers, hidden tabs,
  and synthetic events do not extend idle time, and WSS employee-duration
  accounting is independent.
- Forgot-password is enumeration-safe and always returns `204`.
- Expected terminal session errors include `AUTH_SESSION_ENDED`,
  `AUTH_SESSION_IDLE_EXPIRED`, `AUTH_SESSION_ABSOLUTE_EXPIRED`,
  `AUTH_SECURITY_STALE`, `AUTH_SESSION_STALE`,
  `SESSION_IDENTITY_INACTIVE`, and `INVALID_REFRESH_TOKEN`.
- `AUTH_AUTHORIZATION_STALE`, `AUTH_PROFILE_STALE`, and access-token expiry
  trigger one refresh. Permission `403` never triggers refresh. `429`, network
  failures, and `5xx` retain local auth in a degraded state.
- Host failures can return `MISSING_HOST_HEADER`, `UNKNOWN_TENANT_HOST`, `FQDN_NOT_VERIFIED`, `TENANT_HOST_MISMATCH`, or `TENANT_INACTIVE`.
- Suspended tenants may still use the public auth routes listed above, but normal authenticated tenant APIs remain blocked.
- Auth responses are sensitive and must not be cached. The activity checkpoint
  is never transport-retried; its UUIDv7 header is diagnostic intent evidence,
  not permission to replay it.
- No auth route returns a client-polled asynchronous job. Email delivery may continue behind the request, but the portal follows only the documented HTTP result.

## Session list and revoke projection

`GET /auth/sessions` returns:

```ts
{
  items: Array<{
    id: string;
    clientId: string;
    clientType: string;
    deviceLabel: string | null;
    createdAt: string;
    lastRefreshAt: string | null;
    lastAccessIssuedAt: string;
    lastUserActivityAt: string | null;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
    endedAt: string | null;
    endReason: string | null;
    refreshUseCount: string;
    accessIssueCount: string;
    credentialVersion: number;
    sessionEpoch: number;
    current: boolean;
  }>;
}
```

`DELETE /auth/sessions/:sessionId` is naturally idempotent, uses no UUIDv7
idempotency key, and is safe for one access-refresh replay. It returns `204`
for an already-ended owned session and normalized `404` for an unknown or
never-owned identifier. Revoking `current: true` clears cookies and ends the
browser state.
