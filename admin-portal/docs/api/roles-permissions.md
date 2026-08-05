# Admin Roles and Permissions API

Status: **[Verified]**

Last source verification: **2026-07-30**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Success |
| --- | --- | ---: |
| `POST /api/admin/core/v1/roles` | `admin.roles.create` + `admin.roles.critical` | `201` |
| `GET /api/admin/core/v1/roles` | `admin.roles.read` | `200` |
| `GET /api/admin/core/v1/roles/:id` | `admin.roles.read` | `200` |
| `PATCH /api/admin/core/v1/roles/:id` | `admin.roles.update` | `200` |
| `PATCH /api/admin/core/v1/roles/:id/permissions` | `admin.roles.update` + `admin.roles.critical` | `200` |
| `DELETE /api/admin/core/v1/roles/:id` | `admin.roles.delete` + `admin.roles.critical` | `204` |
| `GET /api/admin/core/v1/permissions` | `admin.permissions.read` | `200` |

Permission pairs use ALL semantics.

## Critical distinction

Ordinary role metadata update requires only `admin.roles.update`. Do not
over-restrict it with `admin.roles.critical`. Replacing the permission set is
critical and requires both permissions.

## Role DTOs

```ts
interface CreateAdminRoleDto {
  name: string;
  description?: string;
  permissionIds?: string[];
}

interface UpdateAdminRoleDto {
  name?: string;
  description?: string | null;
}

interface SetRolePermissionsDto {
  permissionIds: string[]; // complete replacement, UUIDv7 values
}
```

Read exact validation limits from the current DTOs before implementing a form.
Strict Core validation rejects unknown fields.

## List and catalogue

Role list uses Core pagination; rows are under `data` and totals under
`meta.total`. The permission catalogue is read-only and seeded by Core. Render
permission keys as the transport identity; localized labels are presentation
only.

## Mutations

- Permission replacement submits the complete desired set.
- Empty permission IDs clear assignable permissions when backend invariants
  allow it.
- System roles and assigned roles can reject update/delete.
- Role/permission changes can invalidate affected sessions.
- Delete returns `204` with no body.
- Retain one UUIDv7 key for one exact retry of a write-sensitive intent.

## Current frontend status

`src/app/roles/` uses real Core role and permission calls. Remaining refactors
include exact response types, explicit error/data states, stable mutation
intents, and avoiding critical over-restriction for ordinary metadata updates.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/admin-roles.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/admin-permissions.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`


## DTOs (Migrated from dtos.md)

### `CreateAdminRoleDto`
```typescript
{
  name: string;
  description?: string;
  type: AdminTierEnum;
  permissionIds?: string[];
}
```

### `UpdateAdminRoleDto`
```typescript
{
  name?: string;
  description?: string;
}
```

### `SetRolePermissionsDto`
```typescript
{
  permissionIds: string[];  // Full replacement set
}
```

### `SetUserRolesDto`
```typescript
{
  roleIds: string[];  // @IsArray, @ArrayUnique, @IsUUID('7')
}
```

---
