# Admin Roles and Permissions API

Status: **[Verified]**

Last source verification: **2026-08-12**

Role permission delegation source review: **2026-10-18** (runtime and automated
verification pending lead verification).

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Success |
| --- | --- | ---: |
| `POST /api/admin/core/v1/roles` | `admin.roles.create` + `admin.roles.critical` | `201` |
| `GET /api/admin/core/v1/roles` | `admin.roles.read` | `200` |
| `GET /api/admin/core/v1/roles/assignable-for-invite` | `admin.users.invite` + `admin.users.critical` | `200` |
| `GET /api/admin/core/v1/roles/assignable-for-assignment` | `admin.users.assign_roles` + `admin.users.critical` | `200` |
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

Assignable-role source verification: **2026-10-18**, Core and Gateway source;
automated and authenticated runtime verification pending lead verification.
The invitation and user-detail selectors use the corresponding narrow route
above, without `admin.roles.read`. These are authenticated, idempotent GETs with
ALL semantics for each permission pair. They accept the existing role-list
pagination DTO (`page >= 1`, `limit` within Core's configured maximum, whitelisted
`name`/`createdAt` sort, `ASC`/`DESC`, optional `isSystem`); the portal requests
100 rows per page, ordered by name, and publishes only a complete catalogue
within its existing 50-page bound. Core adds an ID tie-breaker.

Responses contain only `{ id, name, nameI18n: { en, ar } }` under `data`, with
standard pagination under `meta`. Core filters before counting/paging: every
live permission membership of a candidate role must be held by the actor's
current role. Empty-permission roles are eligible; deleted roles and revoked
memberships do not grant access. Persisted super admins bypass containment.
These routes confer no access to role details, permission memberships or
management metadata. Authentication, account state and permission failures
remain errors; `403` is never an empty list. Writes revalidate independently.

The directory role filter retains the full catalogue only for actors with
`admin.roles.read`. Missing operation prerequisites, forbidden reads, failures
and empty assignable lists have distinct feedback in Arabic and English.

Role list uses Core pagination; rows are under `data` and totals under
`meta.total`. The permission catalogue is read-only and seeded by Core. Render
permission keys as the transport identity; localized labels are presentation
only.

## Mutations

- Permission replacement submits the complete desired set.
- The role editor maps `/auth/me` permission keys to catalogue IDs to derive
  delegable permissions. Super administrators bypass containment, matching Core.
  Other actors cannot toggle permissions outside their grants. Group actions
  affect only visible, delegable permissions, and their select/deselect state
  follows that same subset. Disabled permissions show a bilingual explanation.
- Core validates every ID in the replacement, including existing assignments.
  If an existing assignment exceeds the actor's ceiling (or its ID cannot be
  resolved), the permission editor stays read-only with an explanation that a
  higher-authority administrator is needed. Existing assignments are preserved;
  metadata remains independently editable. Saving also rechecks the draft
  against current grants and never silently strips protected permissions.
- Empty permission IDs clear assignable permissions when backend invariants
  allow it.
- System roles and assigned roles can reject update/delete.
- Role/permission changes advance affected users' `authorizationVersion`.
  Existing access JWTs become stale and must be reissued, while the reusable
  Auth Session remains active. Status, password, and other security changes
  are the session-ending category.
- Delete returns `204` with no body.
- Retain one UUIDv7 key for one exact retry of a write-sensitive intent.
- **A response only overwrites the editor that submitted it.** The role detail
  page carries two independent forms — metadata and permissions — with their
  own Save buttons, and both routes answer with the whole role. Applying all of
  it to both editors let a metadata save wipe pending permission ticks, and a
  permission save revert an unsaved name, in each case clearing the discarded
  editor's dirty flag so nothing signalled the loss. The editor that did not
  submit still takes the new authoritative baseline; it keeps its unsaved draft
  on top of it and stays dirty against it. An editor holding no unsaved work is
  refreshed in place, so a rename made elsewhere still appears.

## Current frontend status

`src/app/roles/` source-integrates all six role/permission routes with strict
readers, server pagination, independent role and catalogue loading, explicit
data/error states, nullable-description reconciliation, exact metadata versus
critical permission gates, validation, and caller-owned UUIDv7 intents.
Focused tests cover partial permission sets and ambiguous retry behavior.

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
  description?: string | null;
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
