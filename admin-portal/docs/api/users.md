# Admin Users, Profile, and WebPhone API

Status: **[Frontend/source audit; WebPhone route inventory drift unresolved]**

Last source verification: **2026-08-29**

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
| `GET /api/admin/core/v1/users/:id/webphone` | Previously documented as `admin.users.read` | `200` expected by frontend | Frontend reference; absent from current generated inventory |
| `PATCH /api/admin/core/v1/users/:id/webphone` | Previously documented as `admin.users.update` + `admin.users.critical` | `200` expected by frontend | Frontend reference; absent from current generated inventory |
| `GET /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |
| `GET /api/admin/core/v1/users/me/webphone` | Previously documented as authenticated | `200` expected by frontend | Frontend reference; absent from current generated inventory |
| `GET /api/admin/core/v1/users/me/webphone/call-logs` | Previously documented as authenticated | `200` expected by frontend | Frontend reference; absent from current generated inventory |
| `POST /api/admin/core/v1/users/me/webphone/call-logs` | Previously documented as authenticated | `201` expected by frontend | Frontend reference; absent from current generated inventory |

Every inventory-confirmed paired permission uses ALL semantics. The WebPhone
rows above are not inventory-confirmed permission contracts.

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

The Admin Portal currently references administrative/self-service WebPhone and
call-log routes. None appears in the current 246-route generated Admin Core
inventory. Until Core ownership and route contracts are confirmed, this section
describes frontend expectations only and must not be used as backend evidence.

If a confirmed self-service WebPhone route returns the SIP password required for
active browser registration, it may exist only in current component memory.

The administrative projection omits the password and returns
`passwordConfigured`. Initialize edit password fields empty; blank means
preserve unless the DTO explicitly represents a clear action.

Never write SIP passwords to browser storage, logs, analytics, diagnostics, or
fixtures.

The frontend's currently referenced call-log payload is:

```ts
interface CreateAdminWebphoneCallLogDto {
  type: string;
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
}
```

## Idempotency and state

Gateway write-sensitive routes require UUIDv7 intent keys where declared in the
[generated inventory](../generated/admin-core-api-routes.md). Disable duplicate
submissions and retain the original key for an exact retry.

A missing read permission renders forbidden, not an empty user list.

## Current frontend evidence

- `src/app/users/hooks/useUsers.ts`
- `src/app/users/[id]/hooks/useUserDetail.ts`
- `src/app/profile/hooks/useMyProfile.ts`
- `src/app/profile/page.tsx`
- `src/components/layout/webphone/`
- `src/components/layout/hooks/useWebRTCPhone.ts`

The user list, invite, detail, lifecycle, role assignment, and self profile use
inventory-confirmed APIs. Administrative WebPhone, self WebPhone, and call logs
remain frontend references with unresolved Admin Core inventory drift.
Authenticated runtime and deployment verification remain separate from source
integration.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-users/admin-users.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-users/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/admin-user-roles.controller.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`


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

### `UpdateAdminUserWebphoneDto`
```typescript
{
  enabled?: boolean;
  extension?: string | null;          // @MaxLength(32)
  sipUsername?: string | null;        // @MaxLength(120)
  sipPassword?: string | null;       // @MaxLength(255)
  displayName?: string | null;       // @MaxLength(120)
  outboundCallerId?: string | null;  // @MaxLength(64)
  transport?: 'ws' | 'wss';
}
```

### `CreateAdminWebphoneCallLogDto`
```typescript
{
  type: WebphoneCallLogType;
  displayName?: string | null;       // @MaxLength(120)
  phoneNumber: string;               // @IsNotEmpty, @MaxLength(80)
  startedAt?: string | null;         // @IsDateString
  answeredAt?: string | null;        // @IsDateString
  endedAt?: string | null;           // @IsDateString
  durationSeconds?: number | null;   // @IsInt, @Min(0), @Max(86400)
  cause?: string | null;             // @MaxLength(120)
}
```

---
