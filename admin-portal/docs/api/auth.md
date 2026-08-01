# Admin Authentication API

Status: **Verified backend contract; frontend DONE/PARTIAL/BROKEN**

Last source verification: **2026-07-30**

Verified against the current Core controller, DTOs, cookie helpers, and gateway
route contracts.

Browser prefix: `/api/admin/core/v1/auth`

Core upstream prefix: `/api/v1/admin/auth`

## Browser cookie mode

The Admin Portal should use cookie mode:

```http
x-auth-cookie-mode: 1
credentials: include
```

- Core returns only non-secret expiry and token-type metadata in JSON.
- Core stores both the short-lived access token and rotating refresh token in
  HttpOnly cookies.
- Browser JavaScript stores only non-secret session timing and validated
  profile metadata. The Gateway promotes the access-token cookie to the
  upstream `Authorization` header for authenticated admin routes.
- `x-auth-remember: 1` gives all three auth cookies persistent `maxAge`; `0`
  uses session cookies.
- Do not read, copy, or persist the refresh token in frontend JavaScript.

Cookie-mode token response:

```ts
interface AdminAuthCookieResponse {
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
}
```

Without cookie mode, Core returns the full token pair. That mode is for
non-browser clients and is not the Admin Portal contract.

## POST `/api/admin/core/v1/auth/login`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `200`.

```ts
interface LoginDto {
  email: string; // @IsEmail, @MaxLength(255), trim + lowercase
  password: string; // @IsString, @MinLength(1), @MaxLength(128)
}
```

Send `x-auth-cookie-mode: 1`, `x-auth-remember: 1 | 0`, and include
credentials. After receiving the token response, call `/auth/me` before
considering login complete.

## POST `/api/admin/core/v1/auth/refresh`

Public. Rate limit: 20 requests per 60 seconds. Returns HTTP `200`.

```ts
interface RefreshDto {
  refreshToken?: string; // optional in cookie mode
}
```

In cookie mode, send `{}` and let Core read the HttpOnly cookie. Core rotates
the cookie and returns a new access token response. A definitive `401` or `403`
clears rejected auth cookies; transient server failures retain them so a safe
retry remains possible.

The shared client coordinates refresh and retries a protected request at most
once. The proactive scheduler refreshes 60 seconds before access expiry and
re-arms itself after every successful rotation. Transient failures retry after
30 seconds; only definitive `401` or `403` refresh rejection ends the session.
Feature hooks must not implement independent refresh loops.

## POST `/api/admin/core/v1/auth/accept-invite`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `200`.

```ts
interface AcceptInviteDto {
  token: string; // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string; // @IsString, @MinLength(12), @MaxLength(128), strong-password policy
}
```

Use cookie mode. Invite acceptance activates the account and issues an auth
session.

## POST `/api/admin/core/v1/auth/forgot-password`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `204` with no body.

```ts
interface ForgotPasswordDto {
  email: string; // @IsEmail, @MaxLength(255), trim + lowercase
}
```

Always display the same confirmation message. The endpoint intentionally does
not reveal whether the account exists or can reset its password.

The current frontend forgot-password modal is simulated and does not call this
endpoint.

## POST `/api/admin/core/v1/auth/reset-password`

Public. Rate limit: 5 requests per 60 seconds. Returns HTTP `204` with no body.

```ts
interface ResetPasswordDto {
  token: string; // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string; // @IsString, @MinLength(12), @MaxLength(128), strong-password policy
}
```

On success, existing sessions are invalidated and auth cookies are cleared.
Send the admin to login.

## POST `/api/admin/core/v1/auth/logout`

Public. Rate limit: 20 requests per 60 seconds. Returns HTTP `204`.

Request body is `RefreshDto`; send `{}` in cookie mode. Clear the frontend
session in a `finally` path even if durable server-side revocation reports an
error.

## POST `/api/admin/core/v1/auth/logout-all`

Protected by `AdminGuard`. Returns HTTP `204`.

Invalidates every admin session by advancing the account session version and
revoking refresh-token families. Clear the current frontend session after
success.

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

## Current frontend status

Implemented in `src/context/AuthContext.tsx` and
`src/lib/api/axiosClient.ts`:

- login;
- `/me` hydration;
- proactive refresh;
- recurring proactive scheduling after every successful rotation;
- one coordinated refresh retry after protected `401`;
- logout;
- cross-tab login-generation and logout events.

Not yet implemented as real routes/screens:

- accept-invite;
- reset-password;
- logout-all security control.

Forgot-password remains `BROKEN`: the UI simulates completion with a timer
instead of calling the documented endpoint.
