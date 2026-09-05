# Admin Users, Profile, and WebPhone API

Status: **[Frontend/source audit; WebPhone drift resolved — the routes moved to
the WebPhone module namespace]**

Last source verification: **2026-09-03**

Owner: **Core**

Canonical browser prefix: `/api/admin/core/v1/users`

## Route matrix

| Method and browser path | Permission mode | Success | Current evidence |
| --- | --- | ---: | --- |
| `POST /api/admin/core/v1/users` | `admin.users.invite` + `admin.users.critical` | `201` | `DONE` |
| `GET /api/admin/core/v1/users` | `admin.users.read` | `200` | `DONE` |
| `GET /api/admin/core/v1/users/:id` | `admin.users.read` | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/:id` | `admin.users.update` + `admin.users.critical` | `200` | `DONE` |
| `POST /api/admin/core/v1/users/:id/suspend` | `admin.users.suspend` + `admin.users.critical` | `201` | `DONE` |
| `POST /api/admin/core/v1/users/:id/activate` | `admin.users.suspend` + `admin.users.critical` | `201` | `DONE` |
| `DELETE /api/admin/core/v1/users/:id` | `admin.users.delete` + `admin.users.critical` | `204` | `DONE` |
| `PATCH /api/admin/core/v1/users/:id/roles` | `admin.users.assign_roles` + `admin.users.critical` | `204` | `DONE` |
| `GET /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |

Every paired permission uses ALL semantics.

**No WebPhone route lives under `/users`.** The five that once did
(`:id/webphone`, `me/webphone`, `me/webphone/call-logs`) were deleted with the
seven `webphone_*` columns on `admin_users`; the Gateway answers those paths
`404 GW.ROUTE.UNKNOWN`. See [WebPhone](#webphone) below for what replaced them.

## Invite

```ts
interface CreateAdminUserDto {
  email: string;      // email, lowercase, max 255
  firstName: string;  // trimmed, 1..80
  lastName: string;   // trimmed, 1..80
  roleId: string;     // UUIDv7
  isSuperAdmin?: boolean;
}
```

The returned user remains `INVITED` until invite acceptance. Only a current
super admin may create another super admin. Duplicate email/role/invariant
errors must be displayed from the authoritative response.

## List

The list accepts pagination/search/status, `isSuperAdmin`, and `roleId` filters
from `AdminUserQueryDto`. Rows are in `data`; the total is `meta.total`, never
`totalItems`.

```ts
type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
```

## Update and lifecycle

- Email is immutable.
- Identity, role, or super-admin changes use `PATCH /users/:id`.
- Dedicated role replacement uses `PATCH /users/:id/roles` with the complete
  desired role set.
- Suspend/activate enforce self-protection and last-active-super-admin
  invariants.
- Delete is a soft delete and returns `204` with no body.
- Refresh the user projection after mutations because affected sessions can be
  invalidated.

## Self profile

```ts
interface UpdateAdminProfileDto {
  themeKey?: string;
  language?: string;
  extensions?: Record<string, unknown>;
}
```

The current Portal exposes `/profile`, reads this projection from
`GET /users/me/profile`, and saves the exact DTO through
`PATCH /users/me/profile`. Loading, forbidden, unavailable, save-failure, and
safe retry states are rendered explicitly.

## WebPhone

WebPhone is its own Gateway app, not part of Core's `/users` space. Its admin
namespace is **`/api/admin/webphone/v1`**, and it is absent from the generated
Admin Core inventory by design — that inventory covers `core.admin.*` route
keys only.

A user's phone is an **extension row keyed by `ownerId`**, not fields on the
user record. `ownerId` is the admin user's own id (for the admin audience the
JWT `sub` / `identityId` *is* `admin_users.id`), so one user has at most one
extension and an unconfigured user simply has no row.

| Method and browser path | Permission mode | Success |
| --- | --- | ---: |
| `GET /api/admin/webphone/v1/extensions` | `admin.webphone.read` | `200` |
| `POST /api/admin/webphone/v1/extensions` | `admin.webphone.update` | `201` |
| `PATCH /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `200` |
| `DELETE /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `204` |
| `GET`/`PUT /api/admin/webphone/v1/extensions/:id/servers` | `admin.webphone.read` / `.update` | `200` |
| `GET`/`PATCH /api/admin/webphone/v1/config` | `admin.webphone.read` / `.update` | `200` |
| `GET /api/admin/webphone/v1/servers` | `admin.webphone.read` | `200` |
| `GET /api/admin/webphone/v1/me` | Authenticated | `200` |
| `GET /api/admin/webphone/v1/me/call-logs` | Authenticated | `200` |
| `POST /api/admin/webphone/v1/me/call-logs` | Authenticated | `201` |

None of the WebPhone writes carries a `critical` companion permission. The full
server and ICE surface lives in [webphone.md](webphone.md); only what the user
screens touch is listed here.

The module exposes no by-owner read, so the user-detail screen lists extensions
and matches on `ownerId`; it `POST`s when that match is empty and `PATCH`es the
matched extension otherwise. Removing a phone is a `DELETE` from
Settings → WebPhone — clearing the fields on the user screen does not delete the
row, and the extension number and SIP username are required on every save
because a row cannot exist without them.

### The extension is the identity; the chain is where it registers

A scope holds an ordered list of SIP servers, and each user has their own ordered
**chain** across it, held separately and replaced wholesale by
`PUT /extensions/:id/servers`. Creating an extension does not create a chain, so
a user screen that only `POST`s an extension leaves a phone with nowhere to
register: assign the chain in the same flow, or send the operator to
Settings → WebPhone to do it.

Each link may override that server's `timeoutSeconds` and `maxRetries`; omitting
them (or sending `null`) inherits the server's defaults, which is the normal
case. An empty chain is accepted and means the user registers nowhere.

`/me` is the one route that returns a **decrypted** SIP password, and it is
reachable with no WebPhone permission at all: holding an extension is the
authorization. It accepts no identifier that could name another subject.

Every other projection omits the password and returns `passwordConfigured`.
Initialize edit password fields empty; blank means preserve.

Never write SIP passwords to browser storage, logs, analytics, diagnostics, or
fixtures.

The widget renders only while `/me` reports `enabled: true`, and it registers
only when `/me` also returns a usable `servers[]` — the caller's chain, filtered
to entries that have both a `sipDomain` and a `websocketUrl`. A user extension
alone produces a visible but offline phone, and so does an extension whose chain
is empty.

## Idempotency and state

Gateway write-sensitive routes require UUIDv7 intent keys where declared in the
[generated inventory](../generated/admin-core-api-routes.md). Disable duplicate
submissions and retain the original key for an exact retry.

A missing read permission renders forbidden, not an empty user list.

## Current frontend evidence

- `src/app/(shell)/users/hooks/useUsers.ts`
- `src/app/(shell)/users/hooks/useUserDetail.ts`
- `src/app/(shell)/users/api/adminUsersApi.ts`
- `src/app/(shell)/settings/webphone/webphone-contract.ts` — the single parser
  and type for extension responses, shared with the users screen
- `src/app/(shell)/profile/hooks/useMyProfile.ts`
- `src/components/layout/AdminWebPhone.tsx` — binds the shared widget to
  `/api/admin/webphone/v1`
- `packages/webphone/src/hooks/useWebRTCPhone.ts` — the widget itself, shared
  with the tenant portal

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-users/admin-users.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-users/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/admin-user-roles.controller.ts`
- `../backend/mutakamel-apps/core-app/src/webphone/admin/admin-webphone.controller.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/webphone.route-contracts.ts`


## DTOs (Migrated from dtos.md)

### `CreateAdminUserDto`
```typescript
{
  email: string;           // @IsEmail, @MaxLength(255), auto-trim & lowercase
  firstName: string;       // @IsString, @MinLength(1), @MaxLength(80), auto-trim
  lastName: string;        // @IsString, @MinLength(1), @MaxLength(80), auto-trim
  tier?: AdminTierEnum;    // @IsOptional, @IsEnum
  roleIds?: string[];      // @IsOptional, @IsArray, @ArrayUnique, @IsUUID('7')
}
```

### `UpdateAdminUserDto`
```typescript
{
  firstName?: string;      // @IsOptional, @MinLength(1), @MaxLength(80)
  lastName?: string;       // @IsOptional, @MinLength(1), @MaxLength(80)
  tier?: AdminTierEnum;    // @IsOptional, @IsEnum
}
```

### `AdminUserQueryDto` (extends `PaginationQueryDto`)
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: UserStatusEnum;
  tier?: AdminTierEnum;
}
```

### `UpdateAdminProfileDto`
```typescript
{
  themeKey?: string;                    // @IsOptional, @MaxLength(64)
  language?: string;                   // @IsOptional, @IsIn(SUPPORTED_LANGUAGES)
  extensions?: Record<string, unknown>; // @IsOptional, @IsObject, shallow-merged
}
```

### `CreateWebphoneExtensionDto`
```typescript
{
  ownerId: string;                   // @IsUUID('7') — the owning admin user
  extension: string;                 // /^[A-Za-z0-9*#+._-]{1,32}$/ — not numbers only
  sipUsername: string;               // @MaxLength(120)
  sipPassword?: string | null;       // write-only, @MaxLength(1024)
  displayName?: string | null;       // @MaxLength(120)
  outboundCallerId?: string | null;  // @MaxLength(64)
  enabled?: boolean;                 // default false; enabling requires a password
}
```

### `UpdateWebphoneExtensionDto`
```typescript
{
  extension?: string;                // same pattern; never null — a row needs one
  sipUsername?: string;              // @MaxLength(120)
  sipPassword?: string | null;       // write-only; null clears
  displayName?: string | null;       // @MaxLength(120), null clears
  outboundCallerId?: string | null;  // @MaxLength(64), null clears
  enabled?: boolean;                 // enabling requires a stored password
}
```

Neither DTO carries `transport` any more. Protocol is the scheme of the server's
`websocketUrl`, not a property of the person holding the extension, and sending
the field is rejected — these DTOs are strict about unknown keys.

### `SetWebphoneExtensionServersDto`
```typescript
{
  servers: Array<{
    serverId: string;                // @IsUUID('7') — a server in the same scope
    timeoutSeconds?: number | null;  // 3..120; null inherits the server's default
    maxRetries?: number | null;      // 0..10;  null inherits the server's default
  }>;                                // order IS the failover order; empty is valid
}
```

Sent as a `PUT` because it replaces the whole chain. Array order is the failover
order — do not send a `priority`; the server assigns it contiguously from 1.

A disabled extension occupies no seat. Creating or enabling one without a SIP
password fails `WEBPHONE_CONFIG_INCOMPLETE`; a second extension for the same
owner fails `WEBPHONE_OWNER_HAS_EXTENSION`.

### `CreateWebphoneCallLogDto`
```typescript
{
  type: WebphoneCallLogType;
  phoneNumber: string;               // @IsNotEmpty, @MaxLength(80)
  displayName?: string | null;       // @MaxLength(120)
  startedAt?: string | null;         // @IsISO8601
  answeredAt?: string | null;        // @IsISO8601, null for unanswered inbound
  endedAt?: string | null;           // @IsISO8601
  durationSeconds?: number | null;   // @IsInt, @Min(0), @Max(86400)
  cause?: string | null;             // stable status code, truncated at 120 on write
}
```

Call logs are non-idempotent and non-replayable: each completed call is a
distinct event, so the write carries no intent key and is never retried.

---
