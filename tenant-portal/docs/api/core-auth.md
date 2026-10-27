# Core — Authentication & Session

## Optional email MFA — FE-AUTH-001 (source reviewed 2026-10-23)

Core owns all operations below; browser paths use
`/api/tenant/core/v1/auth`. Source authority is Gateway
`core.route-contracts.ts`, Core's `tenant-auth.controller.ts`,
`common/auth/mfa/mfa.dto.ts`, `mfa.types.ts`, and the implemented A/B
contracts in `backend/docs/LLD/01-core-app/10_MVP/49_email_mfa.md`.

| POST suffix | Closed request | Response |
| --- | --- | --- |
| `/login` | Existing email/password DTO | Existing session or MFA challenge |
| `/mfa/verify` | `{challengeId, code}` | Existing safe session metadata and cookies |
| `/mfa/resend` | `{challengeId}` | Remaining challenge timing |
| `/mfa/settings/challenge` | `{enabled, currentPassword}` | Purpose-bound challenge |
| `/mfa/settings/resend` | `{challengeId}` | Remaining settings challenge timing |
| `/mfa/settings/confirm` | `{challengeId, code}` | Empty 204; all sessions revoked and cookies cleared |

Challenges are inside Core's normal `data` envelope:
`{mfaRequired: true, challengeId, expiresIn, resendAfterSeconds}`.
The portal validates the 43-character base64url ID, integer lifetime (0–600
seconds), and nonnegative resend delay, and projects only those fields.
Login and enrolled invitation acceptance display the same code step, without
committing session metadata, loading `/me`, navigating or showing login success.
Only successful verification enters the ordinary cookie-session bootstrap path.
MFA-off login retains its existing behavior.

The single text field accepts exactly six ASCII digits as a string, including
leading zeroes. It supports keyboard entry, paste and `one-time-code` autofill,
uses LTR digits inside either interface direction, and has a visible label and
associated translated errors. Passwords clear when the challenge starts; codes
clear after each submission and resend. Neither codes, passwords nor challenge
IDs enter browser storage, URLs, logs or analytics. The browser does not inspect
the HttpOnly pre-auth nonce or authentication cookies.

Resend waits for the server-provided cooldown, rotates the code and never
extends the original deadline. Core's `AUTH_MFA_THROTTLED` and Gateway 429s
honor `Retry-After` or `details.retryAfterSeconds`, with a conservative 60-second
fallback when timing is absent. Invalid, expired or consumed codes share
`401 AUTH_MFA_INVALID_CHALLENGE`; the UI does not guess which server condition
occurred. The local deadline separately prompts a restart. Availability failures
use `503 AUTH_MFA_UNAVAILABLE`; a lost/unknown verification response blocks
another code submission and offers a restart. Requests use the existing auth
lock with `nonReplayable`, `skipAuthRefresh`, `skipAutoIdempotency` and
`cache: "no-store"`; they never auto-retry verification or confirmation.

The profile security section independently validates `GET /auth/me` fields
`mfaEnabled: boolean` and `mfaUpdatedAt: ISO string | null`. Missing enrollment
data renders unavailable, rather than treating MFA as off. Every authenticated
user can enable or disable their own MFA without directory/admin permissions.
Each change requires the current password (1–1024 characters) and the purpose-bound
emailed code, with the existing sid-CSRF proof. A successful 204 clears local
session state, broadcasts session end and returns to login. An ambiguous
confirmation requires signing in again to check the account, without replay.
`422 CURRENT_PASSWORD_INVALID` keeps the setting unchanged and clears the password.

The bilingual recovery copy directs lost-mailbox users to their mail provider
or organization; password recovery preserves enrollment. There is no portal
bypass or administrative reset. Both portals and Core/Gateway A–C must ship
together. Source implementation and regression specs are present; typecheck,
lint, specs, real email, cookie/CSRF and two-device acceptance remain lead
verification. No apps or checks were run in the restricted implementer sandbox.

## Session-list pagination (source reviewed 2026-10-18)

`GET /api/tenant/core/v1/auth/sessions?historyPage=1` returns every owned active
session, current device first, plus up to 50 ended rows in `items`.
`endedHistory: { page, pageSize: 50, hasMore }` describes only ended history;
increment the positive integer `historyPage` to read later history pages.
Active devices repeat on every page and never compete with ended rows for space.
`listTenantAuthSessionPage` validates this response; `listTenantAuthSessions`
continues returning the first page's items for the existing device screen.
Concurrent endings or retention cleanup can shift the ended-history offsets.

## Permission freshness (source reviewed 2026-10-18)

With realtime unavailable, a protected request returning 403 with
`MISSING_REQUIRED_PERMISSIONS`, `TENANT_WIDE_PERMISSION_REQUIRED`,
`BRANCH_PERMISSION_DENIED` or `COMPANY_PERMISSION_DENIED` schedules a fresh
`GET /api/tenant/core/v1/auth/me` through AuthContext. Denials within 250 ms
are coalesced, and denials during that refresh do not start another request.
The denied action still rejects and keeps its existing feedback; it is never
replayed. Updated permissions and scopes replace the browser profile so controls
reflect the server projection without a reload. Role-permission saves also await
`retryBootstrap()` to show new grants immediately.

The refresh is fenced to the current session and auth-operation generation;
logout, account switching, a newer bootstrap or unmount cancels pending work.
A denial from `/auth/me` cannot recursively trigger itself. Other 403 codes keep
their existing behavior. This is implemented against the existing Core contract;
automated and authenticated runtime verification remain pending lead verification.

## Self-service profile security (source verified 2026-10-17)

The profile page exposes own-name edits and password changes for every signed-in
user, including the owner. `PATCH /api/tenant/core/v1/users/me` accepts only
trimmed non-empty `firstName`/`lastName` (80 characters maximum), returns the
standard Core envelope containing `TenantUserView`, and synchronizes the
linked Party. Placement, status and role fields are rejected. No user-management
permission is needed for this self-service route.

`POST /api/tenant/core/v1/auth/change-password` accepts `currentPassword` and
`newPassword` (shared policy: 12–128 characters, uppercase/lowercase/digit/symbol
and identity checks). Wrong current password returns translated
`422 CURRENT_PASSWORD_INVALID`; throttling returns 429 and unavailable limiter
Redis returns 503. The endpoint requires origin/CSRF and is limited to 5 attempts
per user per minute. It ends other sessions and invalidates reset tokens while
retaining this sid and its deadlines, replacing its credential and access/CSRF
cookies. A bilingual security email is enqueued best-effort after commit.

The portal sends password changes once under the existing auth lock, with
`skipAutoIdempotency`, `nonReplayable` and `skipAuthRefresh`; validates the safe
session response and commits its timing without storing credentials. Password
fields clear after every submission. Name responses use the existing runtime
user validator. Both forms use bilingual design-system controls and feedback.
Avatars remain deferred. Source implementation is complete; runtime validation
is pending lead verification (no checks run by the implementer).

Status: **verified**

Last source verification: **2026-10-17**

Owning app: **core-app**

Canonical prefix: `/api/tenant/core/v1/auth`

Upstream: `/tenant/auth` (`@Controller('tenant/auth')`)

Host forwarding verified **2026-09-12**: development requests pass through the
Portal's Host-preserving API route handler to Gateway. On
`http://mersany.mutakamel.ai:5002`, public branding returns 200 and an accept-invite
POST with a deliberately unissued test token returns `400 INVALID_ACTION_TOKEN`,
proving tenant resolution and the invitation lookup are reached. An unknown
host still returns `404 TENANT_NOT_RESOLVABLE`. This check did not use the user's
invitation or establish an authenticated session. See
[development API forwarding](../architecture/routing.md#development-api-forwarding--verified-2026-09-12).

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

Optional per-user email MFA is source-integrated as recorded in the
FE-AUTH-001 section above (2026-10-23); runtime verification remains pending.

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

Password validation source-reviewed **2026-10-17** (CLXAPP-111): both DTOs
enforce string type and 12–128 characters, leaving strength to the shared
service policy. Arabic characters satisfy its symbol rule; a length-valid weak
password returns `422 WEAK_PASSWORD`. The portal shows the existing localized
password-policy message for validation `400`/`422` and `WEAK_PASSWORD`, keeping
the form editable. Only `INVALID_ACTION_TOKEN` selects the rejected-link state.
Specs were added; runtime and automated verification remain pending lead verification.

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

**Every unusable-token rejection is one code.** `findUsableActionToken` answers
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
`AUTH_COOKIE_SECURE`: `false` enables the HTTP profile only in development/test;
staging and production require the secure default (`true` or omitted) under
D-041. Both apps reject `false` there; Gateway also checks `APP_ENV`.
JavaScript does not select that setting.

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
  accessibleBranchCompanies: { branchId: string; companyId: string }[];
  accessScope: {
    mode: "FULL" | "EXPLICIT";
    branchesTruncated: boolean;
    companiesTruncated: boolean;
    teamMembershipsTruncated: boolean;
    teamMembershipsTotal: number;
  };
  permissions: string[];           // drives route admission
  permissionScopes: Record<string, {
    tenantWide: boolean;
    companyIds: string[];
    branchIds: string[];
  }>;
  teamMemberships: TenantTeamMembership[];
}
```

`accessibleBranches` is what the branch selector offers, and every CRM list
requires one of them as `branchId`. `permissions` drives **route** admission;
**action** admission uses the CRM capabilities endpoints instead — see
[README.md](README.md#capabilities-endpoints).

Core action scopes (source verified **2026-10-17**, FE-CORE-PERM-001) use
`permissionScopes` from the same active grants as Core's permission guard.
The portal validates the map against `permissions`, with at most 500 keys and
500 unique IDs per scope collection. Missing or malformed projections invalidate
the profile. `useCan(key, { tenantWide?, companyId?, branchId? })` reflects an
individual action's grant; the flat permission list admits routes only.
`accessScope.mode: FULL` never upgrades another permission to tenant-wide.

Company CRUD, role CRUD and role permission edits require the action's
`tenantWide` flag, as do workspace, branding, currency and email configuration
writes. Taxes and numbering offer tenant-wide creation only with that flag;
company choices are filtered by the management permission's company IDs, and
each record's edit/deactivate action uses its immutable scope. A company-list
failure never grants tenant-wide authority. Submit handlers repeat these
advisory checks; Core remains authoritative for every request.

Shared directory creation and writes require tenant-wide grants; branch-owned
records use the action's branch projection, including their contact/address
sections. The current party-role form creates shared roles, so it requires
tenant-wide role management. Template definition actions use the definition's
scope and creation choices intersect the server's creation-scope list with
the current grant. The global reusable-asset upload and tenant-assignment forms
require tenant-wide management grants. Retiring a definition asset resolves its
definition scope before opening confirmation and rechecks that target on submit.

Core supplies `accessibleBranchCompanies` from the same scoped branch query as
`accessibleBranches`. The portal uses these explicit ownership pairs to build
organization headers, including for owners or role grants without team
memberships. Pair IDs must be UUIDv7, reference an accessible branch and company,
and cannot assign one branch to conflicting companies. If Core declares
`accessScope.companiesTruncated: true`, mapped companies may fall outside the
bounded company projection without invalidating the session. Branch-scoped
request headers use the mapped owning company even when the company projection
omits it. The ownership map is required; memberships never substitute for it.

Source reviewed **2026-10-18** (FE-CORE-PROFILE-DEAD-001): the portal validates
the required `accessScope` projection, including all three boolean truncation
flags. While signed in, a persistent bilingual status banner identifies each
partial branch, company or team-membership list. These `/me` projections remain
bounded, so their picker choices are not a complete access inventory. Refreshing
the profile updates or clears the warning; truncation does not invalidate a
session or broaden permissions. Missing/malformed scope projections and missing
ownership maps invalidate the profile. Automated checks remain pending lead verification.

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
| 429 | Core login budget: `AUTH_LOGIN_THROTTLED`; `Retry-After` gives seconds and `details.retryAfterSeconds` is an array containing the same seconds string. Back off; do not retry in a loop. Gateway IP limits may instead return `GW.RATE.LIMIT_EXCEEDED`. |
| 503 | Login-budget Redis unavailable or returning malformed replies, or public-route limiter Redis unavailable on login, forgot-password, reset-password or accept-invite. Core uses its translated service-unavailable error shape for both limiters; Gateway uses `GW.RATE.UNAVAILABLE`. Treat as temporarily unavailable. |

The account/device login budget runs before lookup for known, unknown and
passwordless accounts. Trusted devices get their own 10-attempt burst/refill
(one per 90 seconds); unknown devices use email + client IP and a shared
50-per-15-minute email ceiling. Budget failures/malformed Redis replies fail
closed with 503 before account lookup for every email, using the same translated
error code and shape as the outer public-route limiter. Login timing padding
still applies. Gateway preserves Core's localized,
non-cacheable 429 body and `Retry-After`.

Branch on status and `errorCode`, never message text — see
[../reference/errors.md](../reference/errors.md).

The login form also recognizes the **local**
`AUTH_SESSION_COORDINATION_UNAVAILABLE` error (status `503`) from
`axiosClient.withTenantAuthLock`.
It occurs when the session operation's 10-second budget expires. The form
offers reload/retry guidance in Arabic and English, without requiring HTTPS.
Public login, forgot-password, reset-password and accept-invite `503` responses
show a translated temporary-unavailability message. Existing codes, details,
headers and correlation IDs are retained; no public write is retried automatically.

On `429 AUTH_LOGIN_THROTTLED`, login reads `Retry-After` (seconds or HTTP date),
falling back to `details.retryAfterSeconds` (Core sends a one-element string
array). It rounds the remaining wait up to whole minutes in the active locale,
disables submit and blocks resubmission until the deadline. The countdown uses
elapsed wall time so background-tab timer delays do not extend the wait.
Missing or malformed timing uses a 60-second fallback. Other Gateway 429
responses retain the general rate-limit guidance.

The error-code generator includes the shared login-lockout policy and reads custom
`HttpException` subclass `super()` calls, including `AUTH_LOGIN_THROTTLED` / 429.

Use `pnpm dev` for development/test HTTP use on port `5002`, with
`AUTH_COOKIE_SECURE=false` in Gateway and Core. `pnpm dev:https` remains an
optional local secure transport using the existing certificate and key.
Staging and production require nginx TLS termination, HTTP-to-HTTPS redirect,
HSTS on HTTPS responses, and Secure cookies (D-041). Nginx preserves the tenant
Host and auth headers/cookies and overwrites forwarded scheme/client-IP headers;
Gateway trusts only nginx peer IPs/CIDRs configured in `TRUST_PROXY`. See
[security headers](../architecture/security-headers.md#sd-03--http-deployment-and-cookie-profiles).

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
