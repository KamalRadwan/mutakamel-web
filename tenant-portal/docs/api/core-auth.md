# Core — Authentication & Session

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefix: `/api/tenant/core/v1/auth`

Upstream: `/tenant/auth` (`@Controller('tenant/auth')`)

Portal status: **partial** — login, bootstrap, refresh, logout, cross-tab
coordination, session list and revoke are all built.

The **unauthenticated** half is genuinely verified against the running app:
the login screen renders, a wrong password is refused, the forgot-password
dialog's own field reaches the request body, `branding/public` answers 200
pre-auth and `auth/me` answers 401. The **authenticated** half is not — P4 is
blocked, so no session has ever been established. See
[README.md](README.md#two-different-questions-two-different-words).

Source inspected:
`core-app/src/tenant/tenant-auth/tenant-auth.controller.ts`,
`tenant-auth.service.ts`, `tenant-auth.cookies.ts`,
`repo/tenant-auth-sessions.repository.ts`, `dto/*.dto.ts`.

## Routes

| Method | Canonical path | Access | Status |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/auth/login` | public | 200 |
| POST | `/api/tenant/core/v1/auth/refresh` | public | 200 |
| POST | `/api/tenant/core/v1/auth/accept-invite` | public | 200 |
| POST | `/api/tenant/core/v1/auth/forgot-password` | public | **204** |
| POST | `/api/tenant/core/v1/auth/reset-password` | public | **204** |
| POST | `/api/tenant/core/v1/auth/logout` | public | **204** |
| POST | `/api/tenant/core/v1/auth/logout-all` | authenticated | **204** |
| POST | `/api/tenant/core/v1/auth/activity` | authenticated | **204** |
| GET | `/api/tenant/core/v1/auth/sessions` | authenticated | 200 |
| DELETE | `/api/tenant/core/v1/auth/sessions/:sessionId` | authenticated | **204** |
| GET | `/api/tenant/core/v1/auth/me` | authenticated | 200 |

`logout` is `@Public()` deliberately — logging out with an already-expired
access token must still clear cookies rather than 401.

## The invite and reset links carry their token in the **fragment**

`TenantPublicUrlService.buildTenantActionUrl` builds
`https://<tenant-host>/tenant/accept-invite#token=…` — `url.hash`, not
`url.searchParams`, and the portal path is `/tenant/accept-invite`, **not**
`/accept-invite`. Both details are load-bearing:

- A fragment is never sent to a server, so the single-use token cannot land in
  an access log or a `Referer` header. The screens read it once and then clear it
  with `history.replaceState`, so a shared screenshot or a back-button revisit
  does not carry a live credential.
- The `/tenant` prefix is what the email actually links to. A screen at
  `/accept-invite` would never be reached.

Both posts go out `nonReplayable`: the token is single-use, and replaying it
after a refresh would spend a credential the first attempt may already have
consumed.

**Every rejection is one code.** `findUsableActionToken` answers
`400 INVALID_ACTION_TOKEN` for not-found, already-used and expired alike, so the
UI cannot tell a user which of the three happened — see Q20.

## Cookies, not bearer tokens

Session material is HttpOnly cookies set by Core. The browser never reads or
attaches a JWT. Every request goes out with `credentials: "include"`.

CSRF is double-submit: `axiosClient` reads the
`mutakamel-http-tenant-csrf` cookie for the HTTP profile or
`__Host-mutakamel-tenant-csrf` for the secure profile and echoes it as
`x-csrf-token` on every unsafe method. The reader prefers the page's transport
profile and accepts the other readable profile when the preferred one is
absent, including secure-default localhost use. Gateway and Core must agree on
`AUTH_COOKIE_SECURE`: `false` enables the HTTP profile in every environment;
`true` remains the secure default. JavaScript does not select that setting.

**Never** put a token in `localStorage`, a URL, a log, or analytics.

## GET /auth/me

Bootstrap first checks for the readable HTTP or secure CSRF cookie. Core issues
that proof with the HttpOnly session cookie and the same lifetime. Without a
usable proof, the portal settles as signed out, drops stale local metadata,
and sends neither `/auth/me` nor a scheduled refresh. A proof only permits the
server check: saved metadata or a cookie alone never authenticates the user.
Existing cookie sessions still load `/auth/me`, with the normal coordinated
refresh path when access expires. Selectively deleting only the CSRF cookie
requires signing in again; the portal never inspects HttpOnly credentials to
guess whether a partial cookie set is usable.

The identity and permission bootstrap. Response shape as validated by
`AuthContext.readTenantUserProfile`:

```ts
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isTenantOwner: boolean;
  status: string;
  accessibleBranches: string[];    // drives TenantBranchSelect
  accessibleCompanies: string[];
  accessibleBranchCompanies?: { branchId: string; companyId: string }[];
  permissions: string[];           // drives route admission
  teamMemberships: TenantTeamMembership[];
}
```

`accessibleBranches` is what the branch selector offers, and every CRM list
requires one of them as `branchId`. `permissions` drives **route** admission;
**action** admission uses the CRM capabilities endpoints instead — see
[README.md](README.md#capabilities-endpoints).

Core supplies `accessibleBranchCompanies` from the same scoped branch query as
`accessibleBranches`. The portal uses these explicit ownership pairs to build
organization headers, including for owners or role grants without team
memberships. Pair IDs must be UUIDv7, reference an accessible branch and company,
and cannot assign one branch to conflicting companies. If Core declares
`accessScope.companiesTruncated: true`, mapped companies may fall outside the
bounded company projection without invalidating the session, but a request
still needs its selected company in `accessibleCompanies`. Older Core responses
may omit the map and use branch-specific team memberships; an empty or invalid
map never permits that fallback or a guess from company order.

## GET /auth/sessions

Returns `{ items: [...] }` — self-owned sessions only.

Each item is validated field-by-field in `lib/auth/sessionApi.ts`. Fields that
matter:

| Field | Type | Note |
| --- | --- | --- |
| `id` | string | |
| `clientType` | `WEB` \| `IOS` \| `ANDROID` \| `DESKTOP` | |
| `deviceLabel` | string \| null | |
| `refreshUseCount` | **decimal string** | not a number |
| `accessIssueCount` | **decimal string** | not a number |
| `credentialVersion` | positive integer | |
| `sessionEpoch` | positive integer | |
| `current` | boolean | the session making the request |

`refreshUseCount` and `accessIssueCount` are **strings**. Do not `Number()`
them.

## DELETE /auth/sessions/:sessionId

Ends one owned session. Returns `204`.

Sent with `skipAutoIdempotency: true` and `replayAfterRefresh: true` — revoking
is naturally idempotent, and an idempotency key on it is meaningless.

If the revoked session is the **current** one, the client publishes
`session-ended` and clears local auth state. Revoking your own session logs you
out; the UI must make that clear before confirming.

## POST /auth/activity

Idle-timeout heartbeat. Fired at most once per 60s, and only when the document
is visible and the user actually interacted. Handled entirely inside
`axiosClient` via the `x-auth-user-activity` header — **feature code never
calls this.**

## Session invariants

These are implemented in `lib/api/axiosClient.ts` and `lib/auth/`, and they are
the reason that code is off-limits during the rebuild:

- Every request is fenced to the auth generation that issued it. A response
  arriving after a logout is discarded, so a delayed response cannot revive a
  dead session.
- Concurrent 401s coordinate **one** refresh, not N.
- Cross-tab logout or account replacement invalidates in-flight work in other
  tabs.
- Only naturally idempotent writes, or writes carrying a caller idempotency
  key, are replayed after a refresh. Everything else fails rather than risking
  a double-apply.
- Public action tokens (invite, reset) are never persisted.

Web Locks serialize authentication across tabs when the browser provides them.
Without Web Locks, including HTTP tenant origins, a per-tab promise queue
serializes login, refresh and logout with the same 10-second abort budget.
Expired queued work never starts, and a timed-out running operation holds its
place until it settles. Existing session-generation fences, single-flight
refresh and cross-tab events remain active. This fallback does **not** provide
cross-tab mutual exclusion; the server remains authoritative for session
rotation and validation.

## Errors

| Status | Meaning |
| --- | --- |
| 401 | Invalid credentials, or expired/replaced session |
| 403 | Authenticated but not permitted, or tenant suspended |
| 404 | Unknown session id on revoke |
| 429 | Login rate limited — back off, do not retry in a loop |

Branch on status and `errorCode`, never message text — see
[../reference/errors.md](../reference/errors.md).

The login form also recognizes the **local**
`AUTH_SESSION_COORDINATION_UNAVAILABLE` error (status `503`) from
`axiosClient.withTenantAuthLock`.
It occurs when the session operation's 10-second budget expires. The form
offers reload/retry guidance in Arabic and English, without requiring HTTPS.
Other `503` failures keep their existing handling; this does not change server
error contracts.

Use `pnpm dev` for the selected HTTP deployment on port `5002`, with
`AUTH_COOKIE_SECURE=false` in Gateway and Core. `pnpm dev:https` remains an
optional secure transport using the existing certificate and key.

Login sends `{ email, password }` only as a JSON **POST body** to
`/api/tenant/core/v1/auth/login`. Credential forms also declare `method="post"`
so a native submit before hydration cannot put fields in the URL. The native
fallback alone does not perform the JavaScript login flow. HTTP still sends
request bodies and cookies without encryption: POST prevents URL disclosure,
not interception on the network.

## Portal status

| Capability | Status |
| --- | --- |
| Login, `/me` bootstrap | live, tested |
| Refresh coordination, cross-tab sync | live, tested |
| Logout | live, tested |
| Session list and revoke | live, tested |
| Activity heartbeat | live |
| Accept invite | live at **`/tenant/accept-invite`** — the path the invite email links to |
| Forgot password | live — D1 is stale, and `useLogin.test.ts` pins the dialog's own address to the request body |
| Reset password | live at **`/tenant/reset-password`** |
| Logout-all | not surfaced in the UI |
