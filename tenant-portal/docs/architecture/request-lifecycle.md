# HTTP Request Lifecycle

Status: **Verified current backend; frontend target documented**

Last verified: **2026-07-25**

## Protected request

1. A feature calls the shared Tenant Portal API client with a canonical path.
2. The client binds the request to the current tenant-session generation.
3. The same-origin Next API boundary forwards the method, query, body, accepted
   headers, original host, and protocol to API Gateway.
4. It strips browser-supplied internal and forwarding headers.
5. Gateway parses `/api/tenant/{app}/v1/*` and resolves a typed route contract.
6. Gateway verifies that the JWT audience is `tenant`.
7. Gateway rejects a token when the Redis session watermark proves it stale;
   Redis never grants a session by itself.
8. Gateway applies route class, permission metadata, rate limiting,
   idempotency, body-size, and timeout policy.
9. Gateway strips identity/context headers again and injects signed/verified
   tenant, actor, session, company, branch, and service context as applicable.
10. The owning application applies its own global guards and resolves the tenant
    database.
11. The controller validates DTOs and delegates to domain services.
12. The response/error is normalized and returned with a correlation ID.
13. The frontend discards the response if its auth generation is no longer
    current.

## Public request

Public does not mean tenant-free.

- Host status is public and explicitly skips ordinary tenant resolution so it
  can validate the supplied host.
- Tenant login, refresh, invite, password-reset, logout, and public branding
  still require a valid tenant host context.
- Gateway skips JWT validation only for an exact public route registry entry.
- Unknown paths that merely resemble auth paths are not public.

## Response contracts

The owning app determines ordinary success parsing:

| App | Current behavior |
| --- | --- |
| Core | `{success:true,data,meta?,correlationId,timestamp}` |
| CRM | Raw controller/service projection; no global success wrapper |
| Trade | `{success:true,data,correlationId,timestamp}`; domain pagination stays under `data` |

A `204` has no body, and explicit streams/files bypass JSON parsing.

Gateway-originated/transport failures use Problem Details. Core and CRM use the
shared application error envelope; Trade currently returns its exception/Nest
error bodies. The Gateway preserves upstream application status/body. The
shared client selects parsing from the canonical app namespace and normalizes
errors without dropping stable codes, correlation IDs, or relevant headers.

## Idempotency

- Generate a cryptographically random UUIDv7 for a new write intent when the
  Gateway route requires one.
- Preserve the same key for an exact retry after an unknown result.
- Never reuse a key for changed input, a different actor, or a new user action.
- Do not automatically retry a transport-ambiguous write when the route
  contract disables transport retries.
- Record replay headers when the feature needs to distinguish a replay.

## Caching

- Authentication, authorization, financial, provisioning, update, and
  operation-status reads default to `no-store` unless a contract proves a safe
  cache policy.
- Browser caching must not override backend concurrency controls such as ETag
  or version pins.
- Host resolution may use backend Redis caching; the frontend must still fail
  closed when resolution is unavailable.

## Upload and download

- Preserve multipart bodies; do not JSON-stringify `FormData`.
- Enforce client size hints for usability, while Gateway/backend limits remain
  authoritative.
- Stream large bodies where the Next/Gateway handler supports it.
- Treat `Content-Disposition` filenames as untrusted display/download input.
- Never render downloaded HTML or SVG as trusted active content.

## Source evidence

```text
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/gateway-route-handler.ts
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/tenant-api-client.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/
../backend/mutakamel-apps/api-gateway-app/src/auth/
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts
```
