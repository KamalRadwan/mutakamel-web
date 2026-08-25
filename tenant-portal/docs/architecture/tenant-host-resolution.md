# Tenant Host Resolution

Status: **Verified current backend; frontend replacement pending**

Last verified: **2026-07-25**

Backend owner: **Core through API Gateway**

## Invariant

Tenant UI may render only when the request host maps to a non-deleted tenant
FQDN with:

- validation status `VALID`;
- a non-null verification timestamp;
- tenant status accepted for the requested route.

DNS presence or a matching hostname pattern is not authorization.

## Pre-render admission

The Tenant Portal root/server boundary must:

1. read the original `Host` or trusted `X-Forwarded-Host`;
2. preserve exactly one normalized host value;
3. call the Gateway-exposed Core host-status route with `cache: "no-store"`;
4. continue only for `ACTIVE` or recognized `SUSPENDED`;
5. render not-found for unknown, invalid, unverified, malformed, or unavailable
   resolution;
6. exempt only independently recognized non-tenant application hosts if this
   standalone portal ever serves them. It currently should not.

Do not perform this check only in client JavaScript or middleware matchers that
can miss `/login`. The root server layout is the final application boundary.

## Host normalization

Current Core behavior:

- lowercases the host;
- removes a trailing dot;
- removes a valid port;
- accepts bracketed IPv6 parsing but database tenant lookup still requires a
  stored matching value;
- rejects comma-separated forwarded hosts;
- limits host length and validates DNS-label syntax.

The proxy trust setting controls whether Core reads `X-Forwarded-Host`.
Tenant Portal must not let the browser select a different forwarded host.

## Tenant states

| State | General tenant routes | Approved pre-auth routes |
| --- | --- | --- |
| `ACTIVE` | Allowed subject to other guards | Allowed |
| `SUSPENDED` | Rejected with `TENANT_INACTIVE` | Allowed |
| Other lifecycle states | Rejected | Rejected unless source explicitly changes |

For a suspended tenant, current Core permits:

- `GET` public branding;
- `POST` login;
- `POST` refresh;
- `POST` forgot password;
- `POST` reset password;
- `POST` accept invite;
- `POST` logout.

The login page must display suspension state without removing the form because
a tenant administrator still needs pre-authentication access.

## Authenticated host binding

For an authenticated request, the token tenant ID must match the host-resolved
tenant ID. A mismatch returns `TENANT_HOST_MISMATCH`.

Changing only the URL host cannot move a token into another tenant.

## Failure behavior

| Failure | Expected application behavior |
| --- | --- |
| Missing/malformed host | Not-found before tenant UI |
| Unknown host | Not-found |
| Unverified FQDN | Not-found or unavailable without tenant disclosure |
| Suspended tenant on login | Render login with suspension notice |
| Suspended tenant on protected route | Show unavailable/suspended boundary |
| Token tenant differs from host | Clear/stop session and require correct host |
| Gateway/Core unavailable during admission | Fail closed; do not render tenant data |

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/tenant/tenant-host/
../backend/mutakamel-apps/core-app/src/common/fqdn/fqdn-tenant-resolver.guard.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts
```

The following paths are retained from the dated 2026-07-25 consolidated-
frontend inventory. Their workspace is absent from the current checkout, so
they are historical design context only and do not prove a current host gate:

```text
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/tenant-host-status.ts
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/tenant-host-status.server.ts
../backend/mutakamel-apps/mutakamel-web-app/src/app/layout.tsx
../backend/mutakamel-apps/mutakamel-web-app/src/app/login/page.tsx
```
