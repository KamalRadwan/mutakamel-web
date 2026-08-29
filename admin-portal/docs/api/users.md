# Admin Users and Profile API

Status: **[Verified]**

Last source verification: **2026-08-29**

Owner: **Core**

Canonical browser prefix: `/api/admin/core/v1/users`

## Route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
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

WebPhone is not part of this surface. The per-user `webphone_*` columns and
their five routes were removed; the module is its own Gateway namespace at
`/api/admin/webphone/v1/*`, documented in [webphone.md](webphone.md).

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

The user list, invite, detail, lifecycle, role assignment, and self profile use
real APIs. Authenticated runtime and deployment verification remain separate
from source integration.

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

---
