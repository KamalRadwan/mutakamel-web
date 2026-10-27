# Core — Identity and Organization

Status: **verified**

Last source verification: **2026-08-31** (re-verified against controllers and services while building Phase 4)

User/contact and organization detail reads re-verified **2026-09-14** for the
shared audit-name and contact-card integration described below.

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/organization`, `.../users`,
`.../roles`, `.../permissions`

Upstream: `/api/v1/tenant/organization`, `/api/v1/tenant/users`,
`/api/v1/tenant/` (roles and permissions share the bare `tenant` controller
prefix — see the note under [Roles](#roles--7-routes))

Portal status: **built** — MASTER-PLAN Phase 4 landed 2026-08-31. All 50 routes
are called from a screen under `src/app/(tenant)/core/{organization,users,roles,profile}`
and every response passes a validator in `app/(tenant)/core/contracts/`.
`pnpm docs:verify-called-routes` proves the path set matches this page exactly.

Three states this page asks for **cannot be discriminated from the wire**, and
the screens say so rather than guessing — see Q18, Q20 and Q21 in
[../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md).

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

**Planned addition, 2026-09-07:** [Application Addons target](application-addons-target.md)
adds separate Company/Branch activation/configuration and Tenant-wide addon
seat allocation. These are not new fields on the current organization/user
DTOs below. A discovered Company or shared Branch does not authorize
Company-wide activation or global seat management; current base module
assignments remain distinct from planned addon assignments.

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

Organization edits re-verified **2026-10-17** (CLXAPP-120) against the Gateway
organization PATCH contracts, Core update DTOs and `OrganizationService`.
The live edit drawer sends an empty string to clear company `legalName` /
`taxNumber` and branch `address` / `phone`, and `null` to remove a team's
`leadUserId`. These values survive request serialization; omission would keep
the stored value. Creation still omits blank optional fields. Company currency
cannot be cleared: the edit field is marked required with Arabic/English help,
and saving is disabled unless its trimmed code has three characters. Core
still validates that the currency is enabled. Existing permissions, response
validation and error handling are unchanged.

### States the UI must render

- **`GET /organization/tree` is bounded at 5 000 nodes per level** and returns
  422 above it. A tenant that large needs the paginated list screens, not the
  tree — say so rather than failing silently.
- **Deletion blockers are 409s with meaning.** A company with branches, a branch
  with departments, a department with teams, a team with placed users. Render
  *which* children block it (MASTER-PLAN task 4.10 + the `DeletionBlockerDialog`
  pattern), never a bare "failed". The list arrives as `details.blockers`, and it
  is **server-authored English prose, not an enum** — `OrganizationService`
  builds each phrase from a string literal, so the headline is localized from the
  `ORG_NODE_NOT_EMPTY` code and the phrases render verbatim underneath.
- **HQ uniqueness** — a company may have one headquarters branch. Setting a
  second is a 409.
- Creating under an **inactive** parent is rejected. Deactivating a parent that
  still has active children is rejected.

---

## Shared user contact projection

Verified **2026-09-14** against Gateway `core.tenant.users.get`,
`TenantUsersController.findOne`, `TenantUsersService.findOne`, and its
`TenantUserView` / `toUserView` projection.

`lib/people/user-profile.ts` reads `GET /api/tenant/core/v1/users/:id` through
the Core envelope reader. It validates the exact requested UUID and projects
only `id`, combined `firstName` + `lastName`, and `email`. The modal never
receives administrative attributes, roles, or organization placement data.
`users.user.read` is required; Core's `assertCanReadUser` also checks scope.
For the authenticated actor, the existing `/auth/me` profile supplies these
same display fields without a second read. Other references are never matched
by name or email.

The source provides **no phone, image URL, or Party ID** in `TenantUserView`.
The internal entity has a Party relationship, but that does not authorize the
frontend to invent a relation. `users/me/profile` contains UI preferences,
not contact information. Phone and photo remain unavailable in user-backed
cards; the reusable template supports them for callers with a verified source.
See [Q138](../build/OPEN-QUESTIONS.md#q138--tenant-user-contact-cards-have-no-phone-or-photo-contract).

The shared audit also resolves organization names through existing individual
company, branch, department and team GETs, gated by their `org.*.read`
permission and server scope. Only validated `{id, name}` enters the labels.
The CRM acquisition-source detail reader separately consumes raw
`AcquisitionSourceView.nameAr/nameEn` under `crm.acquisition_sources.read`.

## Users — 22 routes

Users drawer behavior reviewed **2026-10-18** (FE-CORE-USERS-004): invite and
edit forms mount only while open, so loading `/core/users` requests only the
users list and does not load hidden organization or manager pickers. Invite
remains visible to callers with `users.user.invite`, but is disabled with a
translated explanation unless they also hold `org.company.read`,
`org.branch.read` and `org.department.read` to complete the required placement.

### Own avatar — verified 2026-10-17

`GET /api/tenant/core/v1/profile/avatar` streams the signed-in user's current
linked person Party image. `PUT` on the same path accepts multipart `file` and
returns 204; `DELETE` removes it and returns 204. These self-service routes need
tenant authentication, with no Directory grant or client-selected Party ID.
The canonical route maps to Core `/api/v1/tenant/profile/avatar`.

Uploads accept PNG, JPEG or WebP up to 2 MiB and 25 million pixels, with one
non-animated image, matching extension/signature and successful server decoding.
The normalized output must also fit 2 MiB. `400 PARTY_IMAGE_REQUIRED`,
`413 PARTY_IMAGE_TOO_LARGE` and `415 PARTY_IMAGE_INVALID` identify upload errors.
An absent image returns `404 PARTY_IMAGE_NOT_FOUND`; an unavailable person link
returns `404 PARTY_NOT_FOUND`. Server denials render `PermissionGate`.

The profile uploader and header use the same authenticated, no-store image route
with initials as fallback. Successful writes refresh both in the current tab;
failed writes retain the last image. The picture is shared with the linked
Directory contact. No rendition, thumbnail or schema change is introduced.

### User administration and preferences

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
| POST | `/api/tenant/core/v1/users/:userId/modules` | `users.user.manage_modules` | `AssignModuleDto` |
| DELETE | `/api/tenant/core/v1/users/:userId/modules/:moduleKey` | `users.user.manage_modules` | — |

Module-seat authorization re-verified **2026-10-18** (CORE-USERS-004).
Only Workspace Administrator receives the new permission by default; owner
RBAC remains implicit. Profile editing permission alone does not enable module
controls. The live portal hides module mutations for self; Core refuses
self-assignment with **403 `USER_SELF_FORBIDDEN`**, including for owners.
Reads require `users.user.read` for the target branch, or tenant-wide permission
for a branchless user. Missing actor/scope context fails closed before reading
assignments, and a missing target returns **404 `TENANT_USER_NOT_FOUND`**.

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

User placement edits re-verified **2026-10-17** (CLXAPP-115) against Core's
`UpdateTenantUserDto` and `TenantUsersService.update`. On
`PATCH /api/tenant/core/v1/users/:id`, `teamId` and `managerId` accept a UUIDv7
or `null`; omission preserves the stored value. The live edit drawer sends
only changed team/manager fields, using `null` when cleared. Changing company,
branch or department resets the selected team, so saving a department move
clears the old home team in the same request. Other placement IDs remain
required in the form and cannot be cleared. Successful saves use the validated
updated user response and close the drawer; failures retain the form and show
the existing translated error (including `PLACEMENT_INCONSISTENT` for an
invalid hierarchy).

`status` is `UserStatusEnum`: **`INVITED`** · **`ACTIVE`** · **`SUSPENDED`** ·
**`DEACTIVATED`**.
`TeamMembershipRoleEnum`: **`MEMBER`** · **`LEAD`** · **`MANAGER`**.

### States the UI must render

- **`POST /users` counts against the seat limit** (`@CountsAgainstUsers()`).
  A tenant at cap gets **403 `USER_LIMIT_REACHED`** — an actionable outcome that
  should link to the plan-change path, not a generic error (task 4.29).
- **`POST /users/:userId/modules` has its own capacity check** behind a
  PostgreSQL advisory lock. Seat exhaustion is a real, expected outcome — and it
  is a **422 `SEAT_LIMIT_REACHED`**, not a 403: `UserModulesService.assign`
  throws `UnprocessableEntityException`. `MODULE_NOT_SUBSCRIBED` and
  `MODULE_NOT_FOUND` are 422 from the same method; `SUBSCRIPTION_NOT_FOUND` is
  a 404.
- **Suspend and activate both advance the security epoch**, so every existing
  token for that user goes stale immediately. Activate is *not* a no-op undo —
  it re-admits the user with fresh credentials required.
- **Owner and self protections**: a user cannot delete or deactivate themselves,
  and the tenant owner cannot be removed. Both are refusals with distinct codes.
  User-detail management protections re-verified **2026-10-17**: Edit is disabled
  for the actor's own record and the tenant owner's record, with a localized
  explanation. Team memberships remain readable with no write controls. Role
  grant editors and their assignment/option fetches are skipped for these
  protected targets, so opening one's own detail never requests
  `/users/:self/assignments`. Other users retain permission-gated management.
  Own records link **Edit my name** to `/core/profile`, whose existing
  self-service name form uses `PATCH /api/tenant/core/v1/users/me`.
- **The primary team membership cannot be removed** — only replaced through the
  `PUT`.
- **`DEACTIVATED` is a fourth state, not a synonym for deleted.** The plan's
  verb set ("suspend / activate / delete") does not cover it; the list filter
  does. Render all four.
- **`INVITED`**: pending badge and revoke (`DELETE /users/:id`) are built.
  **There is no resend route on this controller** — `TenantUsersService.invite`
  sends the invitation once from `POST /users` — so the screen states that
  rather than offering a control with nothing behind it (Q21).

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

Scope-role visibility source-reviewed **2026-10-18** (FE-CORE-USERS-003):
both reading and replacing scope-role assignments require the tenant owner.
The user-detail panel skips scope-role requests for non-owners and shows the
localized owner-only explanation instead of a table or Retry error. Branch-role
assignments continue to load independently.

Grant pickers re-verified **2026-10-17** (FE-CORE-USERS-002):
`GET /api/tenant/core/v1/users/:userId/assignment-options` requires only
`users.user.assign_roles`. It accepts `PaginationQueryDto` (`page`, `limit`,
`search`) and returns Core `data: { choices, hasMore, labels }` rather than a
standard list envelope. Search matches stored role/branch names; ordering is
role name, branch name, role ID, branch ID. The branch editor selects a single
server-authorized role/branch pair and supports search and additional pages.
Choices require active branches/companies, actor assignment authority and all
role permissions on that branch. The owner-reserved role is excluded for
non-owner recipients. Mutation checks remain authoritative.

`labels` contains names for existing visible branch grants and, for owners,
exact-scope grants, independent of search, pagination and inactive status.
Only these minimal names are exposed without companion read permissions.
Option-read failures show Retry and disable branch writes; existing IDs are
never used as display labels. The owner-only scope editor still uses the role,
branch and company catalogues and stays disabled with a reason until all
required reads succeed. Scope-role catalogues exclude the owner-reserved role
for non-owner recipients.

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

Role permission editor re-verified **2026-10-17** against Core's grant check
and `/auth/me` permission scope projection. Each catalogue key is grantable
only when its `permissionScopes[key].tenantWide` is true. Company/branch
grants do not authorize role definitions. Unavailable keys are disabled with
a keyboard-accessible explanation. If the role already contains keys outside
the actor's authority (including IDs absent from the catalogue), the permission
editor is read-only and asks the actor to contact the workspace owner: Core
validates the entire replacement, even unchanged keys. Saving requires a loaded
catalogue and rechecks the current session authority. Missing
`roles.permission.read`, or a catalogue 403, renders `PermissionGate`.
`ROLE_PERMISSION_GRANT_DENIED` has Arabic and English messages.

---

## Not on this page

`/api/tenant/core/v1/auth/*` is [core-auth.md](core-auth.md).
`/api/tenant/core/v1/users/:id/webphone` and its call-log routes were removed
from tenant-master exposure on 2026-08-30 — the inventory dropped from 199 Core
routes to 195. Do not build against them.
