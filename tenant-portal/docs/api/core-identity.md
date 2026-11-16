# Core — Identity and Organization

Status: **verified**

Last source verification: **2026-11-01** (re-verified against Gateway route contracts, owning Core controllers, DTOs, services, and `TenantPermissionScopeService` for the Organization & Identity redesign)

User/contact and organization detail reads re-verified **2026-09-14** for the
shared audit-name and contact-card integration described below.

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/organization`, `.../users`,
`.../profile/avatar`, `.../roles`, `.../permissions`

Upstream: `/api/v1/tenant/organization`, `/api/v1/tenant/users`,
`/api/v1/tenant/profile/avatar`, `/api/v1/tenant/` (roles, permissions, and
`/users/:userId/assignment*` share the bare `tenant` controller prefix — see the
note under [Roles](#roles--9-routes))

Portal status: **built** — MASTER-PLAN Phase 4 landed 2026-08-31 and was
expanded with self-service profile/avatar, grant options, invitation resend, and
admin session revocation. Organization, user administration, role/permission,
grant-option, module-seat, and `users/me/profile` contracts live in
`src/app/(tenant)/core/contracts/`, while `PATCH /users/me` and `/profile/avatar`
live in `src/app/(tenant)/core/profile/` and `src/hooks/useProfileAvatarImage.ts`
(and the shared contact projection lives in `src/lib/people/user-profile.ts`).
Companion commercial Addon seat routes under `/users/:userId/addon-*` are
documented in [addon-assignments.md](addon-assignments.md).

Remaining wire-level non-discrimination notes are recorded in Q18 and Q20 of
[../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md); Q21 (resend
invitation) is superseded by `POST /api/tenant/core/v1/users/:id/resend-invite`
verified below.

Source inspected:
`../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`,
`core-app/src/tenant/organization/organization.controller.ts`,
`core-app/src/tenant/organization/organization.service.ts`,
`core-app/src/tenant/organization/dto/*.dto.ts`,
`core-app/src/tenant/tenant-users/tenant-users.controller.ts`,
`core-app/src/tenant/tenant-users/tenant-users.service.ts`,
`core-app/src/tenant/tenant-users/dto/*.dto.ts`,
`core-app/src/tenant/tenant-roles/tenant-roles.controller.ts`,
`core-app/src/tenant/tenant-roles/tenant-roles.service.ts`,
`core-app/src/tenant/tenant-roles/dto/*.dto.ts`,
`core-app/src/tenant/scope-role-assignments/scope-role-assignments.controller.ts`,
`core-app/src/tenant/scope-role-assignments/scope-role-assignments.service.ts`,
`core-app/src/tenant/user-modules/user-modules.controller.ts`,
`core-app/src/common/tenant-access/tenant-permission-scope.service.ts`,
`core-app/src/main.ts` (global prefix `api`, URI versioning, default `1`),
`core-app/src/common/common.module.ts` (global guard order),
`docs/generated/tenant-api-routes.json`.

**57 routes on this page** (plus 4 commercial Addon seat routes in
[addon-assignments.md](addon-assignments.md)): Organization 21 · Users &
self-service profile 29 · Roles 6 · Permissions 1.

---

## What applies to every route on this page

- **Class-level `TenantGuard`** on all owning controllers — the caller's token
  audience must be `tenant`, else `403 TENANT_ACCESS_REQUIRED`.
- **`@RequirePermissions(...)` is AND**, not OR, on these controllers. Every
  listed key must be held. Missing ones come back in `details.permissions` with
  `MISSING_REQUIRED_PERMISSIONS`.
- **Permissions and scopes are resolved server-side from the tenant database**
  via `TenantPermissionScopeService`, never trusted from JWT claims, and cached
  against the signed `authorizationVersion`. Any role or grant mutation bumps
  that version so subsequent requests re-resolve immediately.
- **Additive scope union, no narrower `Deny` override**: effective permissions
  combine branch role grants (`tenant_user_branch_roles`) and scoped role grants
  (`tenant_user_scope_roles` at `TENANT`, `COMPANY`, or `BRANCH`). A broader
  `TENANT` or `COMPANY` grant cannot be subtracted on a child branch; scoping
  checks return `403 TENANT_WIDE_PERMISSION_REQUIRED`,
  `403 COMPANY_PERMISSION_DENIED`, or `403 BRANCH_PERMISSION_DENIED`.
- **Catalogue boundaries**: roles (`/roles`) and permissions (`/permissions`)
  are tenant-wide catalogues rather than per-company isolated partitions. Do not
  imply absolute cross-company non-discovery for shared catalogues.
- **Unknown request fields are a 400**, not a silent ignore — the global pipe
  runs `whitelist` + `forbidNonWhitelisted` + `forbidUnknownValues`.
- **All identifiers on identity/organization DTOs are UUID v7** (`@IsUUID('7')`).
  A v4 is a 400.
- **List routes extend `PaginationQueryDto`**: `page` (1-based, default 1),
  `limit` (1–100), `sortBy`, `sortDir` (`ASC`/`DESC`), `search`. `sortBy` is
  validated against a per-endpoint whitelist — outside it is a 400.
- **Responses are wrapped in `data`.** This is Core. **CRM is not** — never
  unwrap a CRM response through the Core helper (standing rule S1).
- Codes are `SCREAMING_SNAKE` in `errorCode`, with a `correlationId` on every
  envelope. Surface the correlation id; it is the only link to a server log.

---

## Organization — 21 routes

**Companion surface:** [Application Addons target](application-addons-target.md)
and [addon-assignments.md](addon-assignments.md) cover Company/Branch addon
activation and user addon seat allocation. Those are separate contracts and
permissions, not fields on the organization or base user DTOs below.

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
| GET | `/api/tenant/core/v1/organization/departments` | `org.department.read` | `OrganizationQueryDto` + `companyId`, `branchId` |
| POST | `/api/tenant/core/v1/organization/departments` | `org.department.manage` | `CreateDepartmentDto` |
| GET | `/api/tenant/core/v1/organization/departments/:id` | `org.department.read` | — |
| PATCH | `/api/tenant/core/v1/organization/departments/:id` | `org.department.manage` | `UpdateDepartmentDto` |
| DELETE | `/api/tenant/core/v1/organization/departments/:id` | `org.department.manage` | — |
| GET | `/api/tenant/core/v1/organization/teams` | `org.team.read` | `OrganizationQueryDto` + `companyId`, `branchId`, `departmentId` |
| POST | `/api/tenant/core/v1/organization/teams` | `org.team.manage` | `CreateTeamDto` |
| GET | `/api/tenant/core/v1/organization/teams/:id` | `org.team.read` | — |
| PATCH | `/api/tenant/core/v1/organization/teams/:id` | `org.team.manage` | `UpdateTeamDto` |
| DELETE | `/api/tenant/core/v1/organization/teams/:id` | `org.team.manage` | — |

### Request bodies

`code` is trimmed **and upper-cased** by a transform; `name` is trimmed.
`code` and parent foreign keys (`companyId`, `branchId`, `departmentId`) are
immutable after creation — they appear only on create DTOs (`CreateDepartmentDto`
accepts `branchId` only, not `companyId`; `CreateTeamDto` accepts `departmentId`
only, not `companyId` or `branchId`). `status` is omitted on create (new nodes
start `ACTIVE`) and is editable via `PATCH` on update DTOs.

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

Ancestor list filtering re-verified **2026-11-01**: branches accept company;
departments intersect company and branch; teams intersect company, branch and
department. The relational predicates also intersect the actor's allowed branch
IDs. Omitting a filter means all visible values; no `All` sentinel reaches the
API. Changing a parent in the list clears its selected descendants. Filter
options include inactive nodes, while create-form pickers retain active-parent
requirements and their existing sole-option selection rule. Live department
reads returned one distinct department per company and zero for a mismatched
company/branch pair. The current tenant has no teams, so a positive team-result
fixture remains unproven live; predicate and authority tests cover that path.

`status` is `OrgNodeStatusEnum`: **`ACTIVE`** · **`INACTIVE`**.

Organization edits re-verified **2026-10-17** (CLXAPP-120) and **2026-11-01**
against Gateway organization PATCH contracts, Core update DTOs and
`OrganizationService`. Sending an empty string clears company `legalName` /
`taxNumber` and branch `address` / `phone`; sending `null` clears a team's
`leadUserId`. Creation omits blank optional fields. Company `currencyCode`
cannot be cleared once set and must reference an enabled workspace currency
(`422 CURRENCY_NOT_ENABLED`). Team leads must belong to the team's branch
(`404 ORG_LEAD_USER_NOT_FOUND`, `422 ORG_LEAD_BRANCH_REQUIRED`,
`409 ORG_LEAD_CHANGE_CONFLICT`). Concurrent hierarchy shifts surface
`409 ORG_BRANCH_SCOPE_STALE` or `409 ORG_NODE_SCOPE_STALE`.

### States the UI must render

- **`GET /organization/tree` is bounded at 5 000 nodes per level** and returns
  `422 ORG_TREE_TOO_LARGE` above it. Direct large tenants to the paginated list
  screens rather than failing silently.
- **Deletion blockers are 409s with meaning.** A company with branches, a branch
  with departments, a department with teams, or a node with placed users returns
  `409 ORG_NODE_NOT_EMPTY` with `details.blockers` (server-authored English
  summary strings; localize the headline from `ORG_NODE_NOT_EMPTY` and list the
  blockers clearly).
- **HQ uniqueness and transfer protection** — a company may have one
  headquarters branch (`409 ORG_HQ_EXISTS` when creating a second). Attempting
  to deactivate, delete, or unmark the current headquarters branch when another
  branch exists returns `409 ORG_HQ_TRANSFER_REQUIRED` until another active
  branch is promoted to headquarters.
- Creating or reactivating under an **inactive** parent returns `409 ORG_PARENT_INACTIVE`.
  Deactivating a parent that still has active children or placed users is
  rejected with `409 ORG_NODE_NOT_EMPTY`.

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

> **Heading anchor preserved for existing cross-links; current count is 29 routes**
> across self-service profile/avatar (`6`), user administration & lifecycle
> (`9`), team memberships (`4`), branch/scoped role grants & options (`7`), and
> base module seats (`3`). Commercial Addon seat routes (`4`) live in
> [addon-assignments.md](addon-assignments.md).

Invite and edit modals mount their option queries only while open, so loading
`/core/users` requests only the users list. Inviting remains visible to callers
with `users.user.invite`, and requires `org.company.read`, `org.branch.read`
and `org.department.read` to complete the required placement hierarchy.

**Placement vs authorization**: `companyId`, `branchId`, `departmentId` and
optional `teamId` establish the user's home organizational placement and keep
their `isPrimary` team membership synchronized. Placement does **not** grant
RBAC permissions on its own; operational and administrative permissions come
from the additive union of `/users/:userId/assignments` and
`/users/:userId/scope-role-assignments` (plus module/addon seats where enforced).

### Own avatar — verified 2026-10-17

`GET /api/tenant/core/v1/profile/avatar` streams the signed-in user's current
linked person Party image. `PUT` on the same path accepts multipart `file` and
returns 204; `DELETE` removes it and returns 204. These self-service routes need
tenant authentication, with no Directory grant or client-selected Party ID.
The canonical route maps to Core `/api/v1/tenant/profile/avatar`.
The portal requests the image only when `/auth/me` reports `hasAvatar: true`, or
after an upload in the same tab (`useProfileAvatarImage`). Without an image the
GET returns 404, so the shell no longer probes for one.

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

`me` and `me/profile` are declared **before** `:id` in `TenantUsersController`
so they cannot be swallowed by the `:id` parameter routes.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/profile/avatar` | **none** — any authenticated tenant user | — |
| PUT | `/api/tenant/core/v1/profile/avatar` | **none** — any authenticated tenant user | multipart `file` |
| DELETE | `/api/tenant/core/v1/profile/avatar` | **none** — any authenticated tenant user | — |
| PATCH | `/api/tenant/core/v1/users/me` | **none** — any authenticated tenant user | `UpdateOwnNameDto` |
| GET | `/api/tenant/core/v1/users/me/profile` | **none** — any authenticated tenant user | — |
| PUT | `/api/tenant/core/v1/users/me/profile` | **none** | `UpdateTenantProfileDto` |
| GET | `/api/tenant/core/v1/users` | `users.user.read` | `TenantUserQueryDto` |
| POST | `/api/tenant/core/v1/users` | `users.user.invite` | `CreateTenantUserDto` |
| GET | `/api/tenant/core/v1/users/:id` | `users.user.read` | — |
| PATCH | `/api/tenant/core/v1/users/:id` | `users.user.update` | `UpdateTenantUserDto` |
| DELETE | `/api/tenant/core/v1/users/:id` | `users.user.delete` | — |
| POST | `/api/tenant/core/v1/users/:id/suspend` | `users.user.deactivate` | — |
| POST | `/api/tenant/core/v1/users/:id/activate` | `users.user.deactivate` | — |
| POST | `/api/tenant/core/v1/users/:id/resend-invite` | `users.user.invite` | — |
| POST | `/api/tenant/core/v1/users/:id/sessions/revoke` | `users.user.deactivate` | — |
| GET | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.read` | — |
| PUT | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` | `SetTenantUserTeamMembershipsDto` |
| POST | `/api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` | `TeamMembershipDto` |
| DELETE | `/api/tenant/core/v1/users/:id/team-memberships/:membershipId` | `users.user.manage_memberships` | — |
| GET | `/api/tenant/core/v1/users/:id/team-memberships/:membershipId/reporting-scopes` | `users.user.read` | — |
| PATCH | `/api/tenant/core/v1/users/:id/team-memberships/:membershipId/reporting-scopes` | `users.user.manage_memberships` | `PatchTeamReportingScopesDto` |
| GET | `/api/tenant/core/v1/users/:userId/assignment-options` | `users.user.assign_roles` | `PaginationQueryDto` |
| GET | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | — |
| PUT | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | `SetUserBranchRolesDto` |
| POST | `/api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` | `AddAssignmentDto` |
| DELETE | `/api/tenant/core/v1/users/:userId/assignments/:assignmentId` | `users.user.assign_roles` | — |
| GET | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` | — |
| PUT | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` | `ReplaceScopeRoleAssignmentsDto` |
| GET | `/api/tenant/core/v1/users/:userId/modules` | `users.user.read` | — |
| POST | `/api/tenant/core/v1/users/:userId/modules` | `users.user.manage_modules` | `AssignModuleDto` |
| DELETE | `/api/tenant/core/v1/users/:userId/modules/:moduleKey` | `users.user.manage_modules` | — |

Reporting scope source and Gateway verified **2026-11-09**. GET returns the
visible branch subset and its membership revision. PATCH requires a UUIDv7
`x-idempotency-key`, `expectedRevision`, and a nonempty add/remove delta. The
command preserves HR placement and the HOME branch. Reload GET after a receipt
or revision conflict. Core rechecks current authority on replay. The endpoint
requires the Core reporting coverage migration and package adoption.

Module-seat authorization re-verified **2026-10-18** (CORE-USERS-004) and
**2026-11-01**. Only Workspace Administrator receives `users.user.manage_modules`
by default; owner RBAC remains implicit. Profile editing permission alone does
not enable module controls. The portal hides module mutations for self; Core
refuses self-assignment with **403 `USER_SELF_FORBIDDEN`**, including for owners.
Reads require `users.user.read` for the target branch, or tenant-wide permission
for a branchless user. Missing actor/scope context fails closed before reading
assignments, and a missing target returns **404 `TENANT_USER_NOT_FOUND`**.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateTenantUserDto` | `email` (trim+lowercase, ≤255), `firstName`/`lastName` (≤80), `employeeCode?` (≤32), **`companyId`, `branchId`, `departmentId` all required**, `teamId?`, `managerId?`, `partyId?`, `jobTitle?` (≤120), `roleAssignments?` (≤500, unique on `branchId:roleId`), `teamMemberships?` (≤500, unique on `teamId`) |
| `UpdateTenantUserDto` | Every field optional (`firstName?`, `lastName?`, `employeeCode?`, `companyId?`, `branchId?`, `departmentId?`, `teamId?` UUIDv7 or `null`, `managerId?` UUIDv7 or `null`, `jobTitle?`). **No `email`, no `partyId`, no `roleAssignments`** |
| `UpdateOwnNameDto` | `firstName?` (trim, 1–80), `lastName?` (trim, 1–80) — at least one non-empty field required; updates linked Person Party display name |
| `TenantUserQueryDto` | `PaginationQueryDto` + `status?`, `companyId?`, `branchId?`, `departmentId?`, `teamId?` |
| `TeamMembershipDto` | `teamId`, `role?` (`TeamMembershipRoleEnum`), `isPrimary?` |
| `SetTenantUserTeamMembershipsDto` | `memberships` — non-empty, ≤500, unique on `teamId` |
| `UpdateTenantProfileDto` | `themeKey?` (≤64), `language?` (one of the supported set, ≤8), `extensions?` (object) |
| `AssignModuleDto` | `moduleKey` (`^[a-z][a-z0-9_]*$`, ≤64) — subscribed base module key |

User placement edits re-verified **2026-10-17** (CLXAPP-115) and **2026-11-01**
against Core's `UpdateTenantUserDto` and `TenantUsersService.update`. On
`PATCH /api/tenant/core/v1/users/:id`, `teamId` and `managerId` accept a UUIDv7
or `null`; omission preserves the stored value, while explicit `null` clears it.
Optional text fields (`employeeCode`, `jobTitle`) clear when sent as empty
strings. Changing company, branch or department resets downstream placement
selections so stale child IDs are never submitted (`422 PLACEMENT_INCONSISTENT`
if mismatched). Concurrent edits to the target user surface
`409 TENANT_USER_CHANGED`.

`status` is `UserStatusEnum`: **`INVITED`** · **`ACTIVE`** · **`SUSPENDED`** ·
**`DEACTIVATED`**.
`TeamMembershipRoleEnum`: **`MEMBER`** · **`LEAD`** · **`MANAGER`**.

### States and runtime details the UI must handle

- **`POST /users` counts against the seat limit** (`@CountsAgainstUsers()`).
  A tenant at cap gets **403 `USER_LIMIT_REACHED`**. Suppressed recipient
  addresses on `POST /users`, `POST /users/:id/resend-invite`, or
  invite-restoring `POST /users/:id/activate` fail with
  **422 `INVITE_EMAIL_UNDELIVERABLE`**.
- **`POST /users/:userId/modules` has its own capacity check** behind a
  PostgreSQL advisory lock: **422 `SEAT_LIMIT_REACHED`** (not 403),
  **422 `MODULE_NOT_SUBSCRIBED`**, **422 `MODULE_NOT_FOUND`**, and
  **404 `SUBSCRIPTION_NOT_FOUND`**. Allowance sync fences can return
  **409 `APPLICATION_ALLOWANCE_NOT_READY`**, **409 `APPLICATION_ALLOWANCE_STALE`**,
  **409 `TENANT_USER_ASSIGNMENTS_CHANGED`**, or
  **503 `APPLICATION_ALLOWANCE_UNAVAILABLE`**; `DELETE /users/:userId/modules/:moduleKey`
  returns **409 `ADDON_ASSIGNMENTS_EXIST`** while dependent add-on seats remain
  assigned.
- **Runtime vs Swagger HTTP status mismatch on `suspend` and `activate`**
  (verified **2026-11-01** in `TenantUsersController`): both `@Post(':id/suspend')`
  and `@Post(':id/activate')` declare `@ApiEndpointDoc({ status: HttpStatus.OK })`
  (Swagger `200`), **but omit `@HttpCode(HttpStatus.OK)`**, so NestJS returns
  **`201 Created`** at runtime. By contrast, `@Post(':id/resend-invite')` and
  `@Post(':id/sessions/revoke')` explicitly carry `@HttpCode(HttpStatus.OK)` and
  return **`200 OK`**. Frontend callers use `writeCoreData` (`response.ok`) and
  validate `data` rather than hardcoding `status === 200`.
- **Suspend, activate, and session revocation**:
  - `POST /users/:id/suspend` advances `securityEpoch`, revokes active sessions,
    and sets `status = 'SUSPENDED'`.
  - `POST /users/:id/activate` requires `user.status === 'SUSPENDED'` (else
    **409 `INVALID_STATUS_TRANSITION`**), advances `securityEpoch`, and revokes
    prior sessions. If the user already has a password hash, `status` becomes
    **`ACTIVE`**; if the account was suspended before ever accepting its invite,
    `status` returns to **`INVITED`**, prior unused invite tokens are marked
    used, and a fresh invitation email is queued. Use the returned `user.status`
    as authoritative rather than assuming `ACTIVE`.
  - `POST /users/:id/sessions/revoke` requires `users.user.deactivate`, advances
    `securityEpoch`, and revokes all active sessions (`ADMIN_REVOKED`) **without
    changing `user.status`**, returning the updated `TenantUserView`.
- **Resending an invitation (`POST /users/:id/resend-invite`)** — verified
  **2026-11-01** (supersedes Q21):
  - Requires `users.user.invite` on the target user's branch (or tenant-wide if
    branchless) and full target authority coverage (`assertTargetAuthorityCovered`).
  - Requires `user.status === 'INVITED'`, else **409 `INVALID_STATUS_TRANSITION`**
    (active owner/self accounts fail this status gate on the server, and the UI
    suppresses resend on non-`INVITED`, self, and owner records).
  - Rate-limited at **5 requests per 60 seconds** (`tenantInviteResendTracker`)
    with `@FailClosedRateLimit()`.
  - Marks earlier unused `INVITE` action tokens as `used: true`, enqueues a new
    invite email in the outbox, and returns HTTP `200` with Core
    `data: { deliveryStatus: "QUEUED" }`. Render `QUEUED` honestly as queued for
    delivery — never claim confirmed inbox receipt.
- **Owner, self, and target-authority protections**:
  - Self-mutations on admin user endpoints fail with **403 `USER_SELF_FORBIDDEN`**;
    own-name edits go through `PATCH /api/tenant/core/v1/users/me`.
  - Mutations against the workspace owner fail with
    **409 `TENANT_OWNER_PROTECTED`**.
  - Non-owner actors cannot modify, suspend, activate, delete, resend invites,
    revoke sessions, or change memberships/roles for a user whose effective
    tenant/company/branch scope exceeds the actor's own scope
    (**403 `TARGET_AUTHORITY_EXCEEDS_ACTOR`**).
- **The primary team membership cannot be removed** directly
  (**409 `PRIMARY_TEAM_MEMBERSHIP_PROTECTED`**) — it tracks the user's home
  `teamId` placement or is replaced atomically via `PUT /team-memberships` with
  a single primary entry (`422 TEAM_MEMBERSHIP_PRIMARY_CONFLICT`,
  `422 TEAM_MEMBERSHIP_LIMIT_EXCEEDED`).
- **`DEACTIVATED` is a fourth `UserStatusEnum` value**, distinct from deleted;
  all four lifecycle values must remain filterable and renderable.

### Two role models coexist — this is not a mistake

| Route | Table | Shape |
| --- | --- | --- |
| `/users/:userId/assignments` | `tenant_user_branch_roles` | A role scoped to **one branch**. Supports add (`POST`), remove (`DELETE`), and full-set replacement (`PUT`) |
| `/users/:userId/scope-role-assignments` | `tenant_user_scope_roles` | A role scoped to `TENANT`, `COMPANY` or `BRANCH`. **`PUT` only — a full atomic replacement**, and **owner-only** (`403 SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED`) |

A user's effective permissions are the **additive union** of both, with no
narrower `Deny` override. The scope-role `PUT` replaces the entire set in one
transaction (capped at 500 unique tuples; `409 SCOPE_ROLE_ASSIGNMENT_CONFLICT`,
`422 SCOPE_ROLE_ASSIGNMENT_LIMIT_EXCEEDED`, `422 SCOPE_ROLE_ASSIGNMENT_INVALID`),
so the UI confirms the diff before writing. Branch role grants also enforce
per-branch privilege coverage (`403 ROLE_PRIVILEGE_ESCALATION`), owner-reserved
role protection (`409 ROLE_RESERVED_FOR_OWNER`), self-grant prohibition
(`403 ROLE_SELF_ASSIGNMENT_FORBIDDEN`), and user cap
(`422 TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED` on write; `409` if stored rows
exceed the 500-row fetch bound).

Scope-role visibility source-reviewed **2026-10-18** (FE-CORE-USERS-003):
both reading and replacing scope-role assignments require the tenant owner.
The user-detail panel skips scope-role requests for non-owners and shows the
localized owner-only explanation instead of a table or Retry error. Branch-role
assignments continue to load independently.

Grant-picker contracts source-reviewed **2026-10-17** (FE-CORE-USERS-002) and **2026-11-01**:
`GET /api/tenant/core/v1/users/:userId/assignment-options` requires only
`users.user.assign_roles`. It accepts `PaginationQueryDto` (`page`, `limit`,
`search`) and returns Core `data: { choices, hasMore, labels }` rather than a
standard list envelope (`422 ROLE_ASSIGNMENT_LABELS_LIMIT_EXCEEDED` if stored
grant labels exceed the safety bound). Search matches stored role/branch names;
ordering is role name, branch name, role ID, branch ID. Choices require active
branches/companies, actor assignment authority and all role permissions on that
branch. The owner-reserved role is excluded for non-owner recipients. Mutation
checks remain authoritative.

`labels` contains names for existing visible branch grants and, for owners,
exact-scope grants, independent of search, pagination and inactive status.
Only these minimal names are exposed without companion read permissions.
Option-read failures show Retry and disable branch writes; existing IDs are
never used as display labels. The owner-only scope editor uses the role, branch
and company catalogues and stays disabled with a reason until all required reads
succeed.

Live verification **2026-11-01** initially found assignment-options returning
HTTP 500. The authorized Core fix now runs both reads inside the tenant
repository transaction instead of its intentionally disabled `getRepository`
accessor. After a Core image rebuild and a clean container source comparison,
the authenticated tenant returned 18 choices and three existing-grant labels.
The actual Grant picker loads names and enables its submit action for a valid
selection; QA cancelled without granting access. See the resolution evidence in
[Q143](../build/OPEN-QUESTIONS.md#q143--live-role-assignment-options-read-returns-500).

---

## Roles — 9 routes

> **Path note.** `TenantRolesController` is mounted on the bare `tenant`
> prefix, not `tenant/roles`, so it also owns `/permissions` and the
> `/users/:userId/assignment*` routes listed above. The canonical browser paths
> are unaffected; this only matters when reading the controller.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/permissions` | `roles.permission.read` | `PaginationQueryDto` |
| GET | `/api/tenant/core/v1/roles` | `roles.role.read` | `TenantRoleQueryDto` |
| POST | `/api/tenant/core/v1/roles` | `roles.role.create` | `CreateTenantRoleDto` |
| GET | `/api/tenant/core/v1/roles/:id` | `roles.role.read` | — |
| PATCH | `/api/tenant/core/v1/roles/:id` | `roles.role.update` | `UpdateTenantRoleDto` |
| PUT | `/api/tenant/core/v1/roles/:id/permissions` | `roles.role.update` | `SetRolePermissionsDto` |
| GET | `/api/tenant/core/v1/roles/:id/branch-permissions` | `roles.role.read` + `roles.permission.read`, active tenant owner | — |
| PUT | `/api/tenant/core/v1/roles/:id/branch-permissions` | `roles.role.update` + `roles.permission.read`, active tenant owner | `SetRoleBranchPermissionsDto` |
| DELETE | `/api/tenant/core/v1/roles/:id` | `roles.role.delete` | — |

| DTO | Fields |
| --- | --- |
| `CreateTenantRoleDto` | `name` (trim, ≤120), `description?` (≤2000), `permissionIds?` — **≤200**, unique, UUID v7 each |
| `UpdateTenantRoleDto` | `name?`, `description?` |
| `SetRolePermissionsDto` | `permissionIds` **required**, ≤200, unique |
| `TenantRoleQueryDto` | `PaginationQueryDto` + `isSystem?` |
| `SetRoleBranchPermissionsDto` | `expectedRevision` non-negative integer **string** (transport maximum 64 characters); `catalogueRevision` non-empty string (maximum 128); `profiles` full replacement array |
| `RoleBranchProfileInputDto` | `branchId` UUID v7; `permissionIds` unique UUID v7 array. Domain limits: **100 unique branches**, **200 unique permissions per branch**. Parser safety caps are 500 profiles / 1,000 IDs before domain validation. |

`GET /permissions` returns the tenant-wide catalogue with **localized labels** —
`key`, `group`, `descriptionI18n`, `groupI18n`. Use those for the role editor;
do not build client-invented permission descriptions. `GET /roles` returns
`TenantRoleSummary` (`id`, `name`, `nameI18n`, `description`, `descriptionI18n`,
`isSystem`, `permissionMode`, `branchProfileCount`, `createdAt`, `updatedAt`)
with **no holder count** on the wire. `permissionMode` is required and is either
`GLOBAL` or `BRANCH`; system roles remain `GLOBAL`.

### Branch permission profiles — verified 2026-11-02

`GET /roles/:id/branch-permissions` returns `roleId`, `roleName`, `isSystem`,
`permissionMode`, decimal-string `revision`, `catalogueRevision`,
`globalPermissionIds`, `profiles`, `catalogue` and `limits`. Profiles include
branch/company IDs and names, `isActive` and permission IDs. Catalogue items carry
human AR/EN labels, a module and nested groups, `BRANCH`/`TENANT` eligibility and
the real `OWN`/`TEAM`/`ALL` record scope. Hydrate the editor from this document and
canonical organization reads; do not invent keys, descriptions or scope variants.

PUT sends only `{ expectedRevision, catalogueRevision, profiles: [{ branchId,
permissionIds }] }`. Copy both revision values from GET. Company choices group
branches in the UI and are not a request field or a company-wide grant. Branches
and their parent companies must be live and active; permissions must belong to
the current active branch-eligible catalogue. Unknown/unclassified eligibility
is locked at workspace level. Inactive or unavailable saved choices can be
reviewed and explicitly removed, rather than silently dropped.

The first successful PUT transitions a custom role to `BRANCH`, clears its
legacy global permission links and atomically replaces every branch profile.
An empty profile is valid configuration with no authority. `profiles: []` clears
all branch contributions and **stays `BRANCH`**. A missing branch profile grants
nothing, including for future branches. Permissions from other roles still add
access; an unselected permission is not a `Deny`. Branch-derived company discovery
does not grant company mutation authority.

The same transaction checks current owner authority, fences role/catalogue
revisions, writes audit events and invalidates every live-assignment holder,
including inactive holders. Do not retry the PUT automatically. After a timeout
or uncertain result, GET and compare the authoritative revision and profiles.
On conflict retain the draft, load the latest state for comparison, and require
an explicit decision before another save. System-role GET is read-only; writes
return `409 ROLE_IS_SYSTEM`. The global `/roles/:id/permissions` setter rejects
`BRANCH` roles with `409 ROLE_BRANCH_MODE_REQUIRED`.

| Canonical code | Status | UI behavior |
| --- | --- | --- |
| `ROLE_BRANCH_OWNER_REQUIRED` | 403 | Owner-only boundary; discard stale privileged controls. |
| `ROLE_BRANCH_REVISION_CONFLICT` | 409 | Preserve draft and offer latest-version comparison. |
| `ROLE_BRANCH_CATALOGUE_CHANGED` | 409 | Reload the catalogue and review the retained draft. |
| `ROLE_BRANCH_SCOPE_INVALID` | 422 | Review deleted/inactive branch or parent-company choices. |
| `ROLE_BRANCH_PERMISSION_INVALID` | 422 | Review unavailable or workspace-only permission choices. |
| `ROLE_BRANCH_LIMIT_EXCEEDED` | 422 | Explain the branch/profile or effective-union limit. |
| `ROLE_BRANCH_MODE_REQUIRED` | 409 | Use the branch editor instead of the global setter. |

The UI uses centered modals and Scope → Permissions → Review, supports AR/EN and
light/dark themes, and auto-selects a sole choice only from complete unsearched
options. A later explicit uncheck is preserved. Module/group labels remain human
names, and record scopes select actual catalogue variants.

### States the UI must render

- **System roles are read-only** (`409 ROLE_IS_SYSTEM` on `PATCH`, `PUT`, or
  `DELETE`; reserved system names on create/rename fail with
  `409 ROLE_NAME_RESERVED`; duplicate names fail with `409 ROLE_NAME_TAKEN`).
- **A role in use cannot be deleted** — `409 ROLE_IN_USE`.
- **200 permissions is the custom-role write cap**, enforced by the DTO (`permissionIds`
  may also be `[]` on `PUT /roles/:id/permissions` to clear all permissions on a
  custom role; `409 TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED` if stored rows exceed
  the fetch bound). Unknown permission IDs fail with `422 PERMISSION_UNKNOWN`.
  Read-only system roles have a separate stored-read bound of 1,000, matching
  Core `MAX_SYSTEM_TENANT_ROLE_PERMISSIONS`; the response parser accepts that
  bound without widening the custom-role write limit.
- **`PUT /roles/:id/permissions` bumps `authorizationVersion` for every holder**
  in a single transaction, and the backend asserts the fan-out set matches
  exactly. Every affected user's next request re-resolves permissions
  immediately without signing in again.

Role permission editor re-verified **2026-10-17** and **2026-11-01** against
Core's grant check and `/auth/me` permission scope projection. Each catalogue
key is grantable only when its `permissionScopes[key].tenantWide` is true.
Company/branch grants do not authorize role definitions. Unavailable keys are
disabled with a keyboard-accessible explanation. If the role already contains
keys outside the actor's authority (including IDs absent from the catalogue),
the permission editor is read-only and asks the actor to contact the workspace
owner: Core validates the entire replacement, even unchanged keys
(`403 ROLE_PERMISSION_GRANT_DENIED`, `422 ROLE_PERMISSION_AUTHORITY_EXCEEDED`,
`422 ROLE_PERMISSION_GRANT_REQUEST_INVALID`). Saving requires a loaded catalogue
and rechecks current session authority. Missing `roles.permission.read`, or a
catalogue 403, renders `PermissionGate`.

---

## Not on this page

- `/api/tenant/core/v1/auth/*` is [core-auth.md](core-auth.md).
- `/api/tenant/core/v1/users/:userId/addon-assignments*` and
  `/api/tenant/core/v1/users/:userId/addon-assignment-options` are
  [addon-assignments.md](addon-assignments.md).
- `/api/tenant/core/v1/users/:id/webphone` and its call-log routes were removed
  from tenant-master exposure on 2026-08-30. Do not build against them.
