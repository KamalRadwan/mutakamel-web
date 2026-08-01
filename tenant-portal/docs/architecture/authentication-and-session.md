# Authentication and Session Architecture

Status: **Verified backend and old-web behavior; new portal pending**

Last verified: **2026-07-25**

Backend owner: **Core through API Gateway**

## Authentication flows

Core owns:

- login;
- refresh-token rotation;
- invitation acceptance;
- forgot/reset password;
- logout;
- logout-all;
- current identity/profile projection.

Exact routes, DTOs, and response fields are documented in
[Auth API](../api/auth.md).

## Session authority

Session acceptance is database-authoritative in the owning backend.

- The signed JWT includes identity, tenant, audience, and session version.
- Gateway validates signature/audience and can reject a token when a Redis
  watermark is greater than the token version.
- A missing or lower Redis value does not grant access.
- Core, CRM, and Trade verify current database identity/session state.
- Logout-all and security-sensitive identity changes advance the session
  version so older tokens are rejected.

## Browser replacement requirements

The current old-web implementation uses generation-scoped tenant records,
cross-tab coordination, proactive refresh, and stale-response rejection. The
new portal must preserve these security properties even if its storage format
changes.

Required behavior:

1. A successful login creates a new random session generation.
2. Each tab adopts a generation and binds requests to it.
3. Concurrent refresh callers elect one refresh operation.
4. Rotated tokens replace only the generation that requested them.
5. Logout writes a tombstone/removes the generation before navigation.
6. Storage events invalidate other tabs.
7. A response from an older generation is rejected even when its HTTP status is
   successful.
8. A failed refresh clears only the matching session and returns to login.
9. Login/logout races use an intent counter so a delayed request cannot replace
   a newer account.

## Storage rules

- Do not put access or refresh tokens in URLs, query strings, error messages,
  analytics, or logs.
- Do not expose token material to server-rendered HTML.
- Prefer the narrowest browser storage consistent with the current Core
  contract; document any persistence choice and its XSS implications.
- Never copy the Admin Portal cookie-mode contract into tenant auth without
  verifying tenant controller support.
- Public action tokens should be read, submitted once, and removed from visible
  browser history where practical.

## Refresh policy

- Refresh proactively near access-token expiry when token metadata supports it.
- Retry an ordinary protected request at most once after a coordinated refresh.
- Do not refresh for login, refresh, logout, invite, or password-reset paths.
- Do not retry a write blindly unless its idempotency contract makes the exact
  replay safe.
- An in-flight request remains bound to its original generation after refresh.

## Authorization bootstrap

After authentication:

- load `/auth/me`;
- verify the returned tenant identity matches the host/session;
- treat permissions, roles, branch/company scopes, and module state as
  server-authoritative;
- do not reveal protected navigation or data while bootstrap is unresolved;
- distinguish unauthenticated, forbidden, tenant-inactive, and service
  unavailable states.

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/
../backend/mutakamel-apps/core-app/src/common/guards/session-version.guard.ts
../backend/mutakamel-apps/api-gateway-app/src/auth/gateway-jwt.guard.ts
../backend/mutakamel-apps/api-gateway-app/src/auth/session-version.guard.ts
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/tenant-session.ts
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/tenant-refresh-coordinator.ts
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/tenant-api-client.ts
```
