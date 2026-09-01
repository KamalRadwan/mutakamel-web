# Admin Authentication API

Status: **[Verified]**

Last source verification: **2026-08-31**

Verified against the current Core controller, DTOs, cookie helpers, and gateway
route contracts.

Browser prefix: `/api/admin/core/v1/auth`

Core upstream prefix: `/api/v1/admin/auth`

Email/password is the only enabled interactive login method. This contract does
not add Google, social, OIDC, or another third-party identity-provider login.

## Browser cookie mode

The Admin Portal should use cookie mode:

```http
credentials: include
```

Core infers the browser channel from the trusted origin/fetch metadata. The
browser must not select cookie/token response mode through a request header.

In local development, the Admin Portal remains browser-same-origin on
`http://localhost:5001` and Next.js rewrites `/api/*` to the Gateway on port
`9000`. Gateway and Core accept that cross-port upstream hop only when the
exact fixed Admin origin is explicitly allowlisted; production continues to
require the external Origin and Host to match exactly.

- Core returns only non-secret expiry and token-type metadata in JSON.
- Core stores both the short-lived access token and reusable session credential in
  HttpOnly cookies.
- Core also sets a non-HttpOnly, session-bound
  `__Host-mutakamel-admin-csrf` proof in the secure profile, or
  `mutakamel-http-admin-csrf` with `AUTH_COOKIE_SECURE=false`. The shared client copies its decoded
  value to `x-csrf-token` on unsafe cookie-authenticated requests; feature code
  must not read or log it independently.
- Browser JavaScript stores only non-secret session timing, the user's
  remember-session preference, and validated profile metadata. The Gateway
  promotes the access-token cookie to the upstream `Authorization` header for
  authenticated admin routes.
- `x-auth-remember: 1` or `true` on login gives all three auth cookies
  persistent `maxAge`; every other value uses browser-session cookies. Core
  stores that decision on the Auth Session, and refresh always reapplies the
  stored policy rather than trusting a per-tab override. Remember-me never
  changes the 30-minute idle or 12-hour absolute deadline, and safe response
  JSON omits the stored flag.
- Do not read, copy, or persist the refresh token in frontend JavaScript.

The selected HTTP deployment uses `AUTH_COOKIE_SECURE=false` in Gateway and
Core, in every environment. Its credentials use distinct
`mutakamel-http-admin-access` and `mutakamel-http-admin-session` HttpOnly
cookies. The shared CSRF reader prefers the HTTP cookie on HTTP pages and the
`__Host-` cookie on HTTPS pages, falling back only when the preferred readable
profile is absent. The default `true` profile remains secure; frontend code
does not choose the server's cookie policy. Existing Web Locks and the Admin
Portal's cross-tab fallback coordination are unchanged. HTTP exposes passwords
and cookies to network interception even when credentials are sent in a POST
body rather than the URL.

Login credentials are sent as a JSON POST body through the shared auth client,
never as URL parameters. Login, forgot-password, invitation, and password-reset
forms also declare native `method="post"`: if JavaScript has not hydrated, the
browser still cannot serialize credentials into a GET URL. This is a privacy
safeguard; the normal API flow still requires the client submit handler.

Cookie-mode token response:

```ts
interface AdminAuthCookieResponse {
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

Core currently accepts only this Web channel. Native issuance remains closed
until its proof-of-possession admission is implemented; a browser can never
select a credential-bearing response shape.

## POST `/api/admin/core/v1/auth/login`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `200`.

```ts
interface LoginDto {
  email: string; // @IsEmail, @MaxLength(255), trim + lowercase
  password: string; // @IsString, @MinLength(1), @MaxLength(128)
}
```

Send `x-auth-remember: 1 | 0` and include credentials. After receiving the
cookie response, call `/auth/me` before considering login complete.

## POST `/api/admin/core/v1/auth/refresh`

Public. Rate limit: 20 requests per 60 seconds. Returns HTTP `200`.

Send no request body and let Core read the HttpOnly credential. A normal
refresh reuses that credential. Every accepted refresh endpoint call, including
an exact retry, increments `refreshUseCount`; issuing its new access JWT
increments `accessIssueCount` independently. Logout/revocation validation does
not increment `refreshUseCount`, and ordinary refresh never advances
`credentialVersion`. Only explicit credential replacement or a forward HMAC-key
migration changes that version. The response contains fresh safe session
metadata but does not replace the credential.
Only an explicit terminal session/security code ends local auth. Permission
`403`, rate limits, network failures, and `5xx` do not clear the session.

The shared client refreshes proactively and retains one reactive `401` repair
as a fallback. The proactive timer runs before access expiry with an adaptive
20% lead (bounded to 10–60 seconds for normal lifetimes) and up to five seconds
of early jitter. A protected request also performs the same coordinated check
before it is sent, covering throttled background-tab timers. Focus, visibility,
page-show, and online events re-evaluate the schedule without changing the
visible authenticated state. An authenticated visible tab separately maintains
bounded presence through the dedicated presence route described below.

Web Locks plus a non-secret BroadcastChannel/storage epoch and safe expiry
snapshot reduce duplicate cross-tab refreshes; correctness does not depend on
those APIs because the server credential is reusable. A cold tab still proves
authentication through `/auth/me` and obtains its own server-issued session
binding; storage timing is only a scheduling hint. Background network, `429`,
`403`, `5xx`, and unknown/non-terminal `401` refresh failures retain the user
and retry at `1s`, `2s`, `4s`, `8s`, `16s`, then `30s`. Only an explicit
terminal session code ends the browser session. Each protected request remains
bound to the session id captured before it is sent. A different login arriving
while refresh or the business response is pending rejects the old work with
`AUTH_SESSION_CHANGED`; it is never replayed or returned under the new session.
If a stale refresh response has already overwritten cookies before its returned
session id reveals a no-Web-Locks race, the portal clears readable auth state,
publishes `ENDED`, and performs a bounded, binding-exempt logout to invalidate
the overwritten cookie before requiring a new login. This prevents cookie
identity and visible profile identity from diverging. If that cleanup is
temporarily unavailable, a non-secret cross-tab quarantine survives reloads,
blocks `/auth/me`, refresh, and protected work, and can be cleared only by a
confirmed logout response or a newly committed login. Quarantined bootstrap and
business traffic never launches a background `Clear-Cookie` response. Cleanup
runs only while the auth mutex is already held by the failed auth mutation or by
the explicit login that will replace the cookie; Web Lock ownership therefore
lasts through the complete response rather than depending on a JavaScript
timeout. Generation-scoped, abortable cleanup leases are a secondary fallback
coordination signal and orphaned records retire without becoming the response
ordering boundary. Browsers without Web Locks use the same storage-and-cookie
coordination channel as a serialized auth mutex plus a monotonic auth-intent
fence. Every cookie-mutating auth route, including current-session revocation,
verifies that fence before dispatch and after response/body settlement; an
overtaken or truncated response is quarantined and invalidated instead of being
committed under a newer login.

A non-replayable write may repair auth but is never resubmitted. A safe write
reuses its exact body and original caller-owned UUIDv7 when replayed once.
Naturally replay-safe POST routes opt in explicitly and omit an idempotency
header. Unsafe methods without either proof fail closed after authentication
repair instead of being replayed automatically.

When the access cookie has already expired and refresh encounters a transient
network, `429`, `5xx`, or non-terminal `401`/`403`, a replay-safe request remains
pending while the shared refresh path retries at `1s`, `2s`, `4s`, `8s`, `16s`,
then three `30s` intervals (121 seconds of backoff). A shared refresh or Web-Lock
wait has a 30-second hard deadline, and each caller's wait for an attempt is
bounded at 35 seconds or ends immediately on its own abort signal; aborting one
caller does not cancel a refresh still needed by another. The business request
is still sent at most once after repair, or replayed once only when its earlier
response was the pre-handler auth `401`. The tenant quote submission supplies an abort signal
so leaving the page cannot later resume tenant creation.

If the single replay is also non-terminal `401`, or bounded repair is exhausted,
the client retains the session, enters `DEGRADED`, and surfaces one retryable
operation error. It never loops or silently swallows the failure. Explicit
terminal `401`/`403` codes enter `ENDED`; an ordinary business permission `403`
emits one Access Denied notification and is never treated as refresh failure.

If `/auth/me` bootstrap, including its reactive refresh, fails because of a
network error, `429`, or `5xx`, the browser retains the cookie session and
retries the safe bootstrap after `1s`, `2s`, `4s`, `8s`, `16s`, and then every
`30s`. Only one bootstrap attempt and one retry timer may exist at a time. A
manual retry cancels the pending timer and runs immediately. Recovery or a
terminal auth result cancels the schedule and resets its delay. Repairing the
access cookie does not make a cold tab authenticated by itself: the protected
tree remains pending until the replayed `/auth/me` has validated and hydrated
the user profile.

## POST `/api/admin/core/v1/auth/accept-invite`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `200`.

```ts
interface AcceptInviteDto {
  token: string; // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string; // @IsString, @MinLength(12), @MaxLength(128), strong-password policy
}
```

Use cookie mode. Invite acceptance activates the account and issues an auth
session. The Admin Portal route is `/admin/accept-invite#token=...`; it reads
the one-time token from the fragment, removes the fragment from browser
history, applies the exact Core password policy, and calls this endpoint
through the shared auth-mutation lock without automatic replay or an
idempotency key.

## POST `/api/admin/core/v1/auth/forgot-password`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `204` with no body.

```ts
interface ForgotPasswordDto {
  email: string; // @IsEmail, @MaxLength(255), trim + lowercase
}
```

Always display the same confirmation message. The endpoint intentionally does
not reveal whether the account exists or can reset its password.

The current frontend forgot-password modal calls this enumeration-safe
endpoint and displays the same confirmation regardless of account existence.

## POST `/api/admin/core/v1/auth/reset-password`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `204` with no body.

```ts
interface ResetPasswordDto {
  token: string; // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string; // @IsString, @MinLength(12), @MaxLength(128), strong-password policy
}
```

On success, existing sessions are invalidated and auth cookies are cleared.
Send the admin to login. The Admin Portal route is
`/admin/reset-password#token=...`; it removes the one-time fragment from
browser history and submits the exact DTO without automatic replay or an
idempotency key.

## POST `/api/admin/core/v1/auth/logout`

Public. Rate limit: 20 requests per 60 seconds. Returns HTTP `204`.

Send no request body. Clear local state and notify sibling tabs only after Core
durably ends the session (or after an explicit terminal session code). A
permission, network, rate-limit, or `5xx` failure retains the current browser
state, reports that sign-out failed, and allows an exact retry; JavaScript
cannot truthfully sign out while the HttpOnly session cookies remain valid.

## POST `/api/admin/core/v1/auth/logout-all`

Protected by `AdminGuard`. Returns HTTP `204`.

Invalidates every admin session by advancing the account security epoch and
ending the server session rows. Clear the current frontend session after
success.

## POST `/api/admin/core/v1/auth-invalidation-outbox/replay`

Protected by `AdminGuard` and the exact
`admin.auth_invalidation_outbox.replay` permission. This is an operator-only
security-recovery command for explicit failed, unpublished Admin or Tenant
session-invalidation outbox rows. It returns HTTP `200` and `Cache-Control:
no-store`.

Send a fresh canonical UUIDv7 `x-idempotency-key` for each changed intent and
this closed body:

```ts
interface ReplayAuthInvalidationOutboxCommand {
  target: "CONTROL_PLANE" | "TENANT";
  tenantId?: string; // required UUIDv7 only when target is TENANT
  mode: "DRY_RUN" | "APPLY";
  eventIds: string[]; // 1-25 unique canonical UUIDv7 values
  reason: string; // trimmed, 8-500 characters
}

interface ReplayAuthInvalidationOutboxResult {
  commandId: string;
  target: "CONTROL_PLANE" | "TENANT";
  tenantId: string | null;
  mode: "DRY_RUN" | "APPLY";
  eventIds: string[];
  eligibleEventCount: number;
  replayedEventCount: number;
  outcome: "DRY_RUN_VALIDATED" | "REPLAY_SCHEDULED";
}
```

The portal requires a successful `DRY_RUN` for the exact normalized target,
tenant, event list, and reason before enabling `APPLY`. Any input change
invalidates that evidence. Gateway transport retry is `NEVER`; the browser does
not automatically replay the write. On an ambiguous network, `5xx`, or
`GW.IDEM.IN_FLIGHT` result, the portal retains the exact body and key and offers
only an explicit operator retry. Deterministic failures discard the key.

Core preserves event identity, routing, and payload and records same-target
append-only audit evidence. `APPLY` only requeues the selected eligible rows; it
does not reconstruct, replace, or broadly scan event payloads.

## POST `/api/admin/core/v1/auth/activity`

Protected by `AdminGuard`; returns HTTP `204`. The shared client emits the
exact `x-auth-user-activity: 1` marker only after trusted pointer, keyboard, or
touch input in a visible tab. A qualifying event checkpoints this route
immediately; successful checkpoints coalesce further input for one minute,
while a failed attempt may retry after five seconds. Polling, access refresh,
focus/visibility, synthetic DOM events, hidden tabs, and Realtime traffic never
claim human activity.

Core owns the bounded idle-deadline touch. Core business requests still carry
the same recent-input marker, and an activity-marked Worker request waits for
the shared Core checkpoint before dispatch. The checkpoint has a five-second
deadline, uses the same session-id/epoch fence as protected work, and never
blocks UI work or logs out for network, rate-limit, `5xx`, or permission/CSRF
failure. Only an explicit terminal session/security code for the still-bound
session may end local authentication. WSS employee-duration accounting remains
independent.

## POST `/api/admin/core/v1/auth/presence`

Protected by `AdminGuard` and the normal Web CSRF channel; returns HTTP `200`.
This is the explicit non-human presence contract for an authenticated Admin
Portal tab. It extends only the current session's idle deadline, bounded by the
absolute deadline, and does not change `lastUserActivityAt`, refresh-use, or
access-issue counters. The client sends no request body and never adds
`x-auth-user-activity`.

The response is server-authoritative and session-fenced:

```json
{
  "sessionId": "uuid-v7",
  "sessionExpiresIn": 1800,
  "idleExpiresAt": "2026-08-26T14:30:00.000Z",
  "absoluteExpiresAt": "2026-08-27T01:00:00.000Z"
}
```

The scheduler starts from the remaining auth metadata deadline, then uses each
presence response without changing the stored access-token timing. It normally
runs halfway through the current remaining window, capped at five minutes; a
fresh five-minute Core minimum therefore schedules after 150 seconds. A stale
or shorter positive remainder is never clamped beyond its deadline. Transient
failures use bounded exponential retry, and a refresh/session timing update
cannot replace an already earlier retry.

Restoring visibility, focus, page-show, or connectivity performs an immediate
checkpoint. Hiding the tab cancels future presence work, and a closed tab has
no browser work, so hidden/closed sessions still expire under the idle policy.
When Core reports `idleExpiresAt === absoluteExpiresAt`, the scheduler stops
because no further presence can extend the session. Core remains authoritative
for terminal idle and absolute expiry.

## GET `/api/admin/core/v1/auth/me`

Protected by `AdminGuard`. Returns HTTP `200`.

```ts
interface AdminMe {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tier: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  permissions: string[];
}
```

`roles` is **not** part of the current `/auth/me` response. Use
`permissions` for shell navigation and action gates. Role details belong to
the admin-user/role management APIs.

Call `/auth/me` after login and when bootstrapping an access token for which no
validated local profile exists.

Every cold load and newly opened tab calls `/auth/me`. Browser storage is never
used as proof that a session exists.

## GET `/api/admin/core/v1/auth/sessions`

Authenticated self-service route. Returns the caller's sessions as
`{ items: [...] }`. Each item contains only safe session metadata:
`id`, `clientId`, `clientType`, optional `deviceLabel`, timestamps, terminal evidence,
decimal-string refresh/access counters, `credentialVersion`, `sessionEpoch`,
and `current`. It never returns cookie or credential material.

## DELETE `/api/admin/core/v1/auth/sessions/:sessionId`

Authenticated self-service route. Returns `204`. The operation is naturally
idempotent and uses no Gateway idempotency key. It may be replayed once after a
successful access refresh. Deleting the current `sid` clears cookies and moves
the browser to `ENDED`; deleting another owned session leaves the current one
active. An unknown or never-owned identifier returns a normalized `404`.

## Auth error state machine

RBAC mutations advance `authorizationVersion`; profile fields represented by
the access JWT or `/auth/me` advance `profileVersion`. Neither change deletes or
rotates the reusable session credential. The next stale protected request
triggers one refresh, receives a new access cookie, and reloads `/auth/me`.
Security compromise, password/status changes, and logout-all are deliberately
terminal instead and end the affected sessions.

- `COMMON.AUTH.TOKEN_EXPIRED`, `AUTH_AUTHORIZATION_STALE`, and
  `AUTH_PROFILE_STALE`: refresh once, then reload `/auth/me`.
- `AUTH_SESSION_ENDED`, `AUTH_SESSION_IDLE_EXPIRED`,
  `AUTH_SESSION_ABSOLUTE_EXPIRED`, `AUTH_SECURITY_STALE`,
  `AUTH_SESSION_STALE`, `SESSION_IDENTITY_INACTIVE`, and
  `INVALID_REFRESH_TOKEN`: clear local metadata and enter `ENDED`.
- permission `403`: never refresh and never log out.
- `429`, network failure, and `5xx`: retain the session and expose a degraded
  state rather than converting availability failure into logout.

## Current frontend status

Implemented in `src/context/AuthContext.tsx` and
`src/lib/api/axiosClient.ts`:

- login;
- `/me` hydration;
- reactive reusable-credential refresh;
- proactive pre-expiry refresh with adaptive timing, wake-up checks, and
  bounded invisible retry;
- protected-request preflight refresh inside the expiry lead;
- one coordinated refresh retry after protected `401`;
- logout;
- server-authoritative bootstrap in every tab;
- non-secret BroadcastChannel plus storage-event synchronization;
- same-session cross-tab expiry-timing adoption without treating browser
  storage as authentication proof;
- exact-body/UUIDv7 safe replay and non-replayable-write separation;
- same-session binding before any post-refresh replay and before accepting a
  settled business response;
- abortable callers plus bounded shared refresh/Web-Lock execution;
- explicit terminal, permission-denied, and retained-repair error provenance;
- bounded single-flight recovery after transient bootstrap/refresh failures;
- pending-route protection until post-refresh `/auth/me` hydration completes;
- trusted visible-input idle activity plus a separate adaptive, session-fenced
  visible-presence checkpoint; presence never claims human activity or changes
  access-token timing, while Worker activity retains its bounded Core
  checkpoint;
- public accept-invite and reset-password routes with exact DTO validation,
  one-time fragment handling, bilingual copy, and accessible error states;
- current-session list and revoke controls under Authentication settings;
- confirmation-gated logout-all under Authentication settings, using the
  shared cookie/session coordinator and no Gateway idempotency key;
- permission- and confirmation-gated invalidation-outbox recovery under
  Authentication settings, with exact target/UUIDv7/reason validation,
  `DRY_RUN`-before-`APPLY`, caller-owned UUIDv7 idempotency, bilingual copy,
  accessible evidence/error states, and no automatic transport replay.

Forgot-password is integrated with the enumeration-safe endpoint.


## DTOs (Migrated from dtos.md)

### `LoginDto`
```typescript
{
  email: string;        // @IsEmail, @MaxLength(255), auto-trim & lowercase
  password: string;     // @IsString, @MinLength(1), @MaxLength(128)
}
```

### `ForgotPasswordDto`
```typescript
{
  email: string;        // @IsEmail, @MaxLength(255), auto-trim & lowercase
}
```

### `ResetPasswordDto`
```typescript
{
  token: string;        // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string;  // @IsString, @MinLength(12), @MaxLength(128), @IsStrongPassword(PASSWORD_POLICY)
}
```

### `AcceptInviteDto`
```typescript
{
  token: string;        // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string;  // @IsString, @MinLength(12), @MaxLength(128), @IsStrongPassword(PASSWORD_POLICY)
}
```

---
