# Core — Identity and Organization

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/organization`, `.../users`,
`.../roles`, `.../permissions`

Upstream: `/api/v1/tenant/organization`, `/api/v1/tenant/users`,
`/api/v1/tenant/` (roles and permissions share the bare `tenant` controller
prefix — see the note under [Roles](#roles--7-routes))

Portal status: **not-started** — this page is the contract for MASTER-PLAN
Phase 4. No screen calls any route here yet.

Source inspected:
`core-app/src/tenant/organization/organization.controller.ts`,
`core-app/src/tenant/organization/dto/*.dto.ts`,
`core-app/src/tenant/tenant-users/tenant-users.controller.ts`,
`core-app/src/tenant/tenant-users/dto/*.dto.ts`,
`core-app/src/tenant/tenant-roles/tenant-roles.controller.ts`,
`core-app/src/tenant/tenant-roles/dto/*.dto.ts`,
`core-app/src/tenant/scope-role-assignments/scope-role-assignments.controller.ts`,
`core-app/src/tenant/user-modules/user-modules.controller.ts`,
`core-app/src/main.ts` (global prefix `api`, URI versioning, default `1`),
`core-app/src/common/common.module.ts` (global guard order),
`docs/generated/tenant-api-routes.json`.

**50 routes.** Organization 21 · Users 22 · Roles 6 · Permissions 1.

---

## What applies to every route on this page

- **Class-level `TenantGuard`** on all four controllers — the caller's token
  audience must be `tenant`, else `403 TENANT_ACCESS_REQUIRED`.
- **`@RequirePermissions(...)` is AND**, not OR. Every listed key must be held.
  Missing ones come back in `details.permissions` with
  `MISSING_REQUIRED_PERMISSIONS`.
- **Permissions are resolved server-side from the tenant database**, never read
  from the JWT, and cached against the signed `authorizationVersion`. A role
  change bumps that version and silently invalidates the cache.
- **Unknown request fields are a 400**, not a silent ignore — the global pipe
  runs `whitelist` + `forbidNonWhitelisted` + `forbidUnknownValues`.
- **All identifiers are UUID v7** (`@IsUUID('7')`). A v4 is a 400.
- **List routes extend `PaginationQueryDto`**: `page` (1-based, default 1),
  `limit` (1–100), `sortBy`, `sortDir` (`ASC`/`DESC`), `search`. `sortBy` is
  validated against a per-endpoint whitelist — outside it is a 400.
- **Responses are wrapped in `data`.** This is Core. **CRM is not** — never
  unwrap a CRM response through the Core helper (standing rule S1).
- Codes are `SCREAMING_SNAKE` in `errorCode`, with a `correlationId` on every
  envelope. Surface the correlation id; it is the only link to a server log.

---

## Organization — 21 routes

Four levels, strictly nested: **company → branch → department → team**. A child
cannot be created under an inactive parent, and a parent cannot be deleted while
it has children or directly-placed users.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/organization/tree` | `org.company.read` | — |
| GET | `/api/tenant/core/v1/organization/companies` | `org.company.read` | `OrganizationQueryDto` |
| POST | `/api/tenant/core/v1/organization/companies` | `org.company.manage` | `CreateCompanyDto` |
| GET | `/api/tenant/core/v1/organization/companies/:id` | `org.company.read` | — |
| PATCH | `/api/tenant/core/v1/organization/companies/:id` | `org.company.manage` | `UpdateCompanyDto` |
| DELETE | `/api/tenant/core/v1/organization/companies/:id` | `org.company.manage` | — |
| GET | `/api/tenant/core/v1/organization/branches` | `org.branch.read` | `OrganizationQueryDto` + `companyId` |
| POST | `/api/tenant/core/v1/organization/branches` | `org.branch.manage` | `CreateBranchDto` |
| GET | `/api/tenant/core/v1/organization/branches/:id` | `org.branch.read` | — |
| PATCH | `/api/tenant/core/v1/organization/branches/:id` | `org.branch.manage` | `UpdateBranchDto` |
| DELETE | `/api/tenant/core/v1/organization/branches/:id` | `org.branch.manage` | — |
| GET | `/api/tenant/core/v1/organization/departments` | `org.department.read` | `OrganizationQueryDto` + `branchId` |
| POST | `/api/tenant/core/v1/organization/departments` | `org.department.manage` | `CreateDepartmentDto` |
| GET | `/api/tenant/core/v1/organization/departments/:id` | `org.department.read` | — |
| PATCH | `/api/tenant/core/v1/organization/departments/:id` | `org.department.manage` | `UpdateDepartmentDto` |
| DELETE | `/api/tenant/core/v1/organization/departments/:id` | `org.department.manage` | — |
| GET | `/api/tenant/core/v1/organization/teams` | `org.team.read` | `OrganizationQueryDto` + `departmentId` |
| POST | `/api/tenant/core/v1/organization/teams` | `org.team.manage` | `CreateTeamDto` |
| GET | `/api/tenant/core/v1/organization/teams/:id` | `org.team.read` | — |
| PATCH | `/api/tenant/core/v1/organization/teams/:id` | `org.team.manage` | `UpdateTeamDto` |
| DELETE | `/api/tenant/core/v1/organization/teams/:id` | `org.team.manage` | — |

### Request bodies

`code` is trimmed **and upper-cased** by a transform; `name` is trimmed.
`status` appears only on the update DTOs, never on create.

| DTO | Fields |
| --- | --- |
| `CreateCompanyDto` | `code` (≤32, upper), `name` (≤120), `legalName?` (≤200), `taxNumber?` (≤64), `currencyCode?` (exactly 3, upper) |
| `UpdateCompanyDto` | `name?`, `legalName?`, `taxNumber?`, `currencyCode?`, `status?` |
| `CreateBranchDto` | `companyId` **required**, `code` (≤32, upper), `name` (≤120), `address?` (≤2000), `phone?` (≤32), `isHeadquarters?` |
| `UpdateBranchDto` | `name?`, `address?`, `phone?`, `isHeadquarters?`, `status?` |
| `CreateDepartmentDto` | `branchId` **required**, `code` (≤32, upper), `name` (≤120) |
| `UpdateDepartmentDto` | `name?`, `status?` |
| `CreateTeamDto` | `departmentId` **required**, `code` (≤32, upper), `name` (≤120), `leadUserId?` |
| `UpdateTeamDto` | `name?`, `leadUserId?`, `status?` |
| `OrganizationQueryDto` | `PaginationQueryDto` + `companyId?`, `branchId?`, `departmentId?`, `status?` — **one shared DTO for all four list endpoints** |

`status` is `OrgNodeStatusEnum`: **`ACTIVE`** · **`INACTIVE`**.

### States the UI must render

- **`GET /organization/tree` is bounded at 5 000 nodes per level** and returns
  422 above it. A tenant that large needs the paginated list screens, not the
  tree — say so rather than failing silently.
- **Deletion blockers are 409s with meaning.** A company with branches, a branch
  with departments, a department with teams, a team with placed users. Render
  *which* children block it (MASTER-PLAN task 4.10 + the `DeletionBlockerDialog`
  pattern), never a bare "failed".
- **HQ uniqueness** — a company may have one headquarters branch. Setting a
  second is a 409.
- Creating under an **inactive** parent is rejected. Deactivating a parent that
  still has active children is rejected.

---

## Users — 22 routes

`me/profile` is declared **before** `:id` in the controller so it cannot be
swallowed by the id route. Keep that in mind when reading the source order.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/users/me/profile` | **none** — any authenticated tenant user | — |
| PUT | `/api/tenant/core/v1/users/me/profile` | **none** | `UpdateTenantProfileDto` |
| GET | `/api/tenant/core/v1/users` | `users.user.read` | `TenantUserQueryDto` |
| POST | `/api/tenant/core/v1/users` | `users.user.invite` | `CreateTenantUserDto` |
| GET | `/api/tenant/core/v1/users/:id` | `users.user.read` | — |
| PATCH | `/api/tenant/core/v1/users/:id` | `users.user.update` | `UpdateTenantUserDto` |
| DELETE | `/api/tenant/core/v1/users/:id` | `users.user.delete` | — |
| POST | `/api/tenant/core/v1/users/:id/suspend` | `users.user.deactivate` | — |
| POST | `/api/tenant/core/v1/users/:id/activate` | `users.user.deactivate` | — |
| GET | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.read` | — |
| PUT | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` | `SetTenantUserTeamMembershipsDto` |
| POST | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` | `TeamMembershipDto` |
| DELETE | `/api/tenant/core/v1/users/:id/team-memberships/:membershipId` | `users.user.manage_memberships` | — |
| GET | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | — |
| PUT | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | `SetUserBranchRolesDto` |
| POST | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | `AddAssignmentDto` |
| DELETE | `/api/tenant/core/v1/users/:userId/assignments/:assignmentId` | `users.user.assign_roles` | — |
| GET | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` | — |
| PUT | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` | `ReplaceScopeRoleAssignmentsDto` |
| GET | `/api/tenant/core/v1/users/:userId/modules` | `users.user.read` | — |
| POST | `/api/tenant/core/v1/users/:userId/modules` | `users.user.update` | `AssignModuleDto` |
| DELETE | `/api/tenant/core/v1/users/:userId/modules/:moduleKey` | `users.user.update` | — |

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateTenantUserDto` | `email` (trim+lowercase, ≤255), `firstName`/`lastName` (≤80), `employeeCode?` (≤32), **`companyId`, `branchId`, `departmentId` all required**, `teamId?`, `managerId?`, `partyId?`, `jobTitle?` (≤120), `roleAssignments?` (≤500, unique on `branchId:roleId`), `teamMemberships?` (≤500, unique on `teamId`) |
| `UpdateTenantUserDto` | Every field optional. **No `email`, no `partyId`, no `roleAssignments`** — those are set at invite time or through the assignment routes |
| `TenantUserQueryDto` | `PaginationQueryDto` + `status?`, `companyId?`, `branchId?`, `departmentId?`, `teamId?` |
| `TeamMembershipDto` | `teamId`, `role?` (`TeamMembershipRoleEnum`), `isPrimary?` |
| `SetTenantUserTeamMembershipsDto` | `memberships` — non-empty, ≤500, unique on `teamId` |
| `UpdateTenantProfileDto` | `themeKey?` (≤64), `language?` (one of the supported set, ≤8), `extensions?` (object) |
| `AssignModuleDto` | the subscribed module key |

`status` is `UserStatusEnum`: **`INVITED`** · **`ACTIVE`** · **`SUSPENDED`** ·
**`DEACTIVATED`**.
`TeamMembershipRoleEnum`: **`MEMBER`** · **`LEAD`** · **`MANAGER`**.

### States the UI must render

- **`POST /users` counts against the seat limit** (`@CountsAgainstUsers()`).
  A tenant at cap gets **403 `USER_LIMIT_REACHED`** — an actionable outcome that
  should link to the plan-change path, not a generic error (task 4.29).
- **`POST /users/:userId/modules` has its own capacity check** behind a
  PostgreSQL advisory lock. Seat exhaustion is a real, expected 403.
- **Suspend and activate both advance the security epoch**, so every existing
  token for that user goes stale immediately. Activate is *not* a no-op undo —
  it re-admits the user with fresh credentials required.
- **Owner and self protections**: a user cannot delete or deactivate themselves,
  and the tenant owner cannot be removed. Both are refusals with distinct codes.
- **The primary team membership cannot be removed** — only replaced through the
  `PUT`.
- **`DEACTIVATED` is a fourth state, not a synonym for deleted.** The plan's
  verb set ("suspend / activate / delete") does not cover it; the list filter
  does. Render all four.
- **`INVITED` has no screen yet** — pending badge, resend, revoke and
  invite-expired are task 4.33.

### Two role models coexist — this is not a mistake

| Route | Table | Shape |
| --- | --- | --- |
| `/users/:userId/assignments` | `tenant_user_branch_roles` | A role scoped to **one branch**. Supports add and remove individually |
| `/users/:userId/scope-role-assignments` | `tenant_user_scope_roles` | A role scoped to `TENANT`, `COMPANY` or `BRANCH`. **`PUT` only — a full atomic replacement**, and **owner-only** |

A user's effective permissions are the **union** of both. The UI must not imply
that one supersedes the other. The scope-role `PUT` is the most destructive
write in Core: it replaces the entire set in one transaction, so it needs a
pre-write diff confirmation (task 4.21 + the `AtomicReplacementConfirm`
pattern).

---

## Roles — 7 routes

> **Path note.** `TenantRolesController` is mounted on the bare `tenant`
> prefix, not `tenant/roles`, so it also owns `/permissions` and the
> `/users/:userId/assignments` routes listed above. The canonical browser paths
> are unaffected; this only matters when reading the controller.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/permissions` | `roles.permission.read` | `PaginationQueryDto` |
| GET | `/api/tenant/core/v1/roles` | `roles.role.read` | `TenantRoleQueryDto` |
| POST | `/api/tenant/core/v1/roles` | `roles.role.create` | `CreateTenantRoleDto` |
| GET | `/api/tenant/core/v1/roles/:id` | `roles.role.read` | — |
| PATCH | `/api/tenant/core/v1/roles/:id` | `roles.role.update` | `UpdateTenantRoleDto` |
| PUT | `/api/tenant/core/v1/roles/:id/permissions` | `roles.role.update` | `SetRolePermissionsDto` |
| DELETE | `/api/tenant/core/v1/roles/:id` | `roles.role.delete` | — |

| DTO | Fields |
| --- | --- |
| `CreateTenantRoleDto` | `name` (trim, ≤120), `description?` (≤2000), `permissionIds?` — **≤200**, unique, UUID v7 each |
| `UpdateTenantRoleDto` | `name?`, `description?` |
| `SetRolePermissionsDto` | `permissionIds` **required**, ≤200, unique |
| `TenantRoleQueryDto` | `PaginationQueryDto` + `isSystem?` |

`GET /permissions` returns the catalogue with **localized labels** —
`key`, `group`, `descriptionI18n`, `groupI18n`. Use those for the role editor;
do not build your own permission descriptions.

### States the UI must render

- **System roles are read-only.** `PATCH` and `DELETE` on one are refused.
  The list filter `isSystem` exists so the UI can mark them.
- **A role in use cannot be deleted** — 409 naming the holders.
- **200 permissions is a hard cap** per role, enforced by the DTO.
- **`PUT /roles/:id/permissions` bumps `authorizationVersion` for every holder**
  in a single transaction, and the backend asserts the fan-out set matches
  exactly. Every affected user's next request re-resolves permissions. The UI
  should say that the change takes effect immediately for all holders, because
  it does.

---

## Not on this page

`/api/tenant/core/v1/auth/*` is [core-auth.md](core-auth.md).
`/api/tenant/core/v1/users/:id/webphone` and its call-log routes were removed
from tenant-master exposure on 2026-08-30 — the inventory dropped from 199 Core
routes to 195. Do not build against them.
