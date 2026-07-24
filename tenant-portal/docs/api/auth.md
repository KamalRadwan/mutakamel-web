# Tenant Auth API

Base path: `/tenant/auth`

The Auth module provides endpoints to authenticate and manage a tenant user's session. Calls to this module usually require the tenant to be resolvable via the request host (e.g. calling `tenant1.mutakamel.ai/tenant/auth/login`).

## `POST /tenant/auth/login`
Authenticates an active tenant user against the tenant resolved from the request host and returns bearer tokens.
- **Access**: Public
- **Throttled**: 5 calls per 60s
- **Body**: `{ email, password }`
- **Response**: `200 OK`
  - Returns: `{ accessToken, refreshToken }`

## `POST /tenant/auth/refresh`
Consumes a valid tenant refresh token, marks it used, and returns a new access/refresh token pair.
- **Access**: Public
- **Throttled**: 20 calls per 60s
- **Body**: `{ refreshToken }`
- **Response**: `200 OK`
  - Returns: `{ accessToken, refreshToken }`

## `POST /tenant/auth/accept-invite`
Consumes a single-use invite token, sets the initial password, activates the tenant user, and returns bearer tokens.
- **Access**: Public
- **Body**: `{ inviteToken, password }`
- **Response**: `200 OK`
  - Returns: `{ accessToken, refreshToken }`

## `POST /tenant/auth/forgot-password`
Sends a tenant password-reset email.
- **Access**: Public
- **Body**: `{ email }`
- **Response**: `204 No Content`

## `POST /tenant/auth/reset-password`
Consumes a valid password-reset token, updates the password, and revokes existing refresh tokens.
- **Access**: Public
- **Body**: `{ resetToken, newPassword }`
- **Response**: `204 No Content`

## `POST /tenant/auth/logout`
Marks the supplied refresh token family as used so the current tenant session cannot be refreshed again.
- **Access**: Public (Possession of refresh token is sufficient)
- **Body**: `{ refreshToken }`
- **Response**: `204 No Content`

## `POST /tenant/auth/logout-all`
Bumps the current tenant user session version and revokes all of their refresh tokens.
- **Access**: Authenticated Tenant User
- **Response**: `204 No Content`

## `GET /tenant/auth/me`
Returns the authenticated tenant user profile and their branch/company access envelope.
- **Access**: Authenticated Tenant User
- **Response**: `200 OK`
  - Returns: `{ user: { id, email, firstName, lastName, ... }, scopes: [...] }`
