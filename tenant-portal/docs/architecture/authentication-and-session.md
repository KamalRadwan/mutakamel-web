# Authentication and Session Architecture

Status: **Accepted session architecture; Tenant Portal source-integrated**

Last verified: **2026-08-26**

Backend owner: **Core through API Gateway**

## Authentication flows

Core owns:

- login;
- reusable server-side session refresh;
- invitation acceptance;
- forgot/reset password;
- logout;
- logout-all;
- current identity/profile projection.

Exact routes, DTOs, and response fields are documented in
[Auth API](../api/auth.md).

## Session authority

Session acceptance is database-authoritative in the owning backend.

- The short-lived signed access JWT includes identity, tenant, audience, the
  exact server session, and security/authorization/profile/session epochs.
- Gateway validates signature/audience and can reject a token when a Redis
  watermark is greater than the token version.
- A missing or lower Redis value does not grant access.
- Core, CRM, and Trade verify current database identity/session state.
- Logout-all and security-sensitive identity changes terminate the applicable
  sessions. RBAC/profile changes stale only the access projection.

## Browser replacement requirements

The Tenant Portal uses HttpOnly access/session cookies and server-authoritative
bootstrap. A tab never treats browser storage as evidence of authentication.

Required behavior:

1. Every cold/new tab bootstraps through `/auth/me`.
2. One browser cookie jar shares one server `sid`; another browser/device login
   receives another `sid`.
3. Web Locks elect one refresh where supported; a non-secret
   BroadcastChannel/storage event lets waiters recheck after the lock.
4. The reusable credential makes duplicate cross-tab refreshes safe when those
   browser coordination APIs are unavailable.
5. Logout and exact-session revoke publish a terminal tombstone only after
   durable server success (or an explicit terminal error), then navigate.
6. Non-replayable writes may repair authentication but are never resubmitted.
7. Safe mutation replay requires a verified caller-owned UUIDv7 intent key (or
   an explicitly documented naturally idempotent route) and preserves the
   exact original body.
8. A post-refresh replay is allowed only when the cross-tab event remains bound
   to the same `sid`; a login in another tab fails the old request closed.
9. Successful requests and `/auth/me` bootstrap commits are generation-fenced;
   a newer login or exact-session tombstone cancels or rejects stale work.

## Storage rules

- Do not put access or refresh tokens in URLs, query strings, error messages,
  analytics, or logs.
- Do not expose token material to server-rendered HTML.
- Access and session credentials exist only in Secure HttpOnly cookies.
- Session storage contains only non-secret expiry/session/epoch metadata.
- Local storage contains only the remember-session preference plus the
  non-secret event ID, session ID, event kind, and timestamp used by the
  BroadcastChannel/storage fallback.
- Remember-session is selected only at login. Core stores the cookie-
  persistence policy on the Auth Session and reapplies it on refresh; the local
  preference cannot override that row or extend idle/absolute deadlines.
- Public action tokens should be read, submitted once, and removed from visible
  browser history where practical.

## Refresh policy

- Refresh proactively before access expiry while the tab is visible and
  online, and reactively on an eligible non-terminal `401`. Focus,
  `visibilitychange`, `pageshow`, and `online` only wake the scheduler; they do
  not count as activity or extend idle/absolute deadlines.
- Keep refresh single-flight in the tab and use Web Locks across tabs where
  available. Transient failures retry with a bounded backoff; only explicit
  terminal session codes publish an exact-`sid` tombstone.
- Retry an ordinary protected request at most once after a coordinated refresh.
- Do not refresh for login, refresh, logout, invite, or password-reset paths.
- Do not retry a write blindly unless its idempotency contract makes the exact
  replay safe.
- An in-flight request remains bound to its original `sid` across refresh.

## Human activity and WSS

- Only trusted pointer, keyboard, or touch events in a visible tab may produce
  `x-auth-user-activity: 1`; synthetic DOM events are ignored.
- A trusted visible input starts a leading, bounded Core
  `POST /auth/activity` checkpoint. Activity-marked CRM or Trade requests also
  piggyback this checkpoint when one is due. One in-flight call plus bounded
  success/retry windows coalesce later inputs, so Core remains the only
  session-idle writer. Checkpoint failures retain auth and log only a safe
  status/code category.
- Refresh, polling, timers, hidden tabs, and WSS traffic never extend the idle
  deadline. WSS employee-duration accounting is a separate clock and data
  flow, not an auth-session TTL.
- Realtime credential refresh uses the same HTTP refresh coordinator. A socket
  permanent-stop reason clears socket-owned state but cannot end the REST
  session until `/auth/me` returns a definitive terminal session code.

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
src/lib/auth/sessionApi.ts
src/lib/auth/sessionCoordinator.ts
src/lib/auth/sessionRefresh.ts
src/lib/api/axiosClient.ts
src/shared/api/tenant-api-client.ts
```

Earlier documentation referenced auth files under the consolidated
`../backend/mutakamel-apps/mutakamel-web-app` path. That workspace is absent
from the current checkout as of 2026-08-10; those paths are historical design
context only and cannot establish current source or runtime behavior.
