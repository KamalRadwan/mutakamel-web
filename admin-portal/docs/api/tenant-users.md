# Tenant Users and Access API

Status: **[Verified]**

Last source verification: **2026-08-11**

This is the frontend contract for the tenant **Users / Access** area in Admin
Portal. It covers the 18 Gateway routes that read or mutate tenant users and
the tenant-side access catalogues.

## Transport contract

- Browser prefix: `/api/admin/core/v1`
- Canonical route base: `/api/admin/core/v1/tenants/:id`
- `id` must be a UUIDv7 tenant id.
- `userId` accepts any valid UUID.
- Every mutation in this document requires an `x-idempotency-key` UUIDv7.
- Reads return Core's normal response envelope. Paginated reads have a `data`
  array plus `meta`.
- Gateway-generated failures use Problem Details and expose `code`.
- Core-generated failures expose the application code as `errorCode`.

Do not call Core's controller-relative `/api/v1/admin/...` paths directly from
the browser.

## Endpoint index

| Method | Canonical browser path | Permission | Success | Idempotency |
|---|---|---|---:|---|
| `GET` | `/api/admin/core/v1/tenants/:id/users` | `admin.tenant_users.read` | `200` | No |
| `GET` | `/api/admin/core/v1/tenants/:id/users/summary` | `admin.tenant_users.read` | `200` | No |
| `POST` | `/api/admin/core/v1/tenants/:id/users` | `admin.tenant_users.invite` + `admin.tenant_users.critical` | `201` | Required |
| `GET` | `/api/admin/core/v1/tenants/:id/access/roles` | `admin.tenant_users.assign_roles` | `200` | No |
| `GET` | `/api/admin/core/v1/tenants/:id/access/branches` | `admin.tenant_users.read` | `200` | No |
| `GET` | `/api/admin/core/v1/tenants/:id/access/departments` | `admin.tenant_users.read` | `200` | No |
| `GET` | `/api/admin/core/v1/tenants/:id/access/teams` | `admin.tenant_users.read` | `200` | No |
| `GET` | `/api/admin/core/v1/tenants/:id/users/:userId` | `admin.tenant_users.read` | `200` | No |
| `PATCH` | `/api/admin/core/v1/tenants/:id/users/:userId` | `admin.tenant_users.update` | `200` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/reset-password` | `admin.tenant_users.reset_password` + `admin.tenant_users.critical` | `202` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/resend-invite` | `admin.tenant_users.invite` + `admin.tenant_users.critical` | `202` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/change-password` | `admin.tenant_users.reset_password` + `admin.tenant_users.critical` | `200` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/suspend` | `admin.tenant_users.suspend` + `admin.tenant_users.critical` | `200` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/activate` | `admin.tenant_users.suspend` + `admin.tenant_users.critical` | `200` | Required |
| `PATCH` | `/api/admin/core/v1/tenants/:id/users/:userId/roles` | `admin.tenant_users.assign_roles` + `admin.tenant_users.critical` | `200` | Required |
| `DELETE` | `/api/admin/core/v1/tenants/:id/users/:userId` | `admin.tenant_users.delete` + `admin.tenant_users.critical` | `204` | Required |
| `POST` | `/api/admin/core/v1/tenants/:id/users/:userId/restore` | `admin.tenant_users.restore` + `admin.tenant_users.critical` | `200` | Required |

## Enums

```ts
type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

type AdminTenantUserVisibility = 'ACTIVE' | 'DELETED' | 'ALL';

type TeamMembershipRole = 'MEMBER' | 'LEAD' | 'MANAGER';

type AdminTenantUserRoleScope = 'TENANT' | 'COMPANY' | 'BRANCH';
```

`DELETED` is **not** a `UserStatus`. A deleted user has a non-null `deletedAt`
and is selected with `visibility=DELETED` or `visibility=ALL`. The delete
operation also stores `status: 'DEACTIVATED'`.

## Authoritative user projection

List items, user detail, profile/lifecycle mutations, password change, role
replacement, and restore all use this safe projection:

```ts
interface AdminTenantUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  status: UserStatus;
  isTenantOwner: boolean;
  organization: {
    company: OrganizationRef;
    branch: OrganizationRef;
    department: OrganizationRef;
    team: OrganizationRef | null;
  };
  manager: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  roleAssignments: Array<{
    assignmentId: string;
    roleId: string;
    roleName: string;
    scope: AdminTenantUserRoleScope;
    companyId: string | null;
    branchId: string | null;
  }>;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface OrganizationRef {
  id: string;
  code: string | null;
  name: string | null;
}
```

Never expect a password hash or an invite/reset token in a response.

## Directory and summary

### `GET /api/admin/core/v1/tenants/:id/users`

```ts
interface AdminTenantUserQuery {
  page?: number;       // integer >= 1, default 1
  limit?: number;      // integer 1..100, default 20
  q?: string;          // trimmed, 1..200
  status?: UserStatus;
  role?: string;       // UUID
  companyId?: string;  // UUID
  branchId?: string;   // UUID
  departmentId?: string; // UUID
  teamId?: string;     // UUID
  visibility?: AdminTenantUserVisibility; // list default ACTIVE
  sortBy?:
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'employeeCode'
    | 'status'
    | 'lastLoginAt'
    | 'createdAt';     // service default createdAt
  sortDir?: 'ASC' | 'DESC'; // default ASC
}
```

`q` searches email, first name, last name, employee code, and job title. The
legacy `search` parameter and `includeDeleted` boolean are temporarily
accepted, but new UI must send only `q` and `visibility`. Sending conflicting
canonical and legacy values fails with
`TENANT_USER_SEARCH_AMBIGUOUS` or `TENANT_USER_VISIBILITY_AMBIGUOUS`.

The response is paginated:

```ts
interface PaginatedTenantUsers {
  data: AdminTenantUserView[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### `GET /api/admin/core/v1/tenants/:id/users/summary`

Accepts the same identity, status, organization, role, and visibility filters
as the list. Its visibility default is `ALL`, not `ACTIVE`.

```ts
interface AdminTenantUserSummary {
  total: number;
  invited: number;
  active: number;
  suspended: number;
  deactivated: number;
  deleted: number;
  owners: number;
  locked: number;
}
```

Use this endpoint for KPI cards. Do not calculate totals from the current list
page.

## Access catalogues

All four endpoints return the standard paginated envelope. Common query:

```ts
interface AccessCatalogueQuery {
  q?: string;      // trimmed, 1..120
  page?: number;   // default 1
  limit?: number;  // 1..100, default 50
}
```

### The selectors must be able to reach past one page

The editor loads one page — roles and branches at 50, departments and teams at
100 — and `q` is how anything beyond it is reached. Each selector renders a
search box wired to that parameter, and shows `shown / total` whenever the page
is a subset, so the list says it is not the whole catalogue before the reader
has to guess.

Until this was wired the parameter existed, the API layer serialised it, and the
UI never sent it: past those counts an administrator simply could not choose the
role or branch they were looking for, with nothing on screen to say why.

Two rules the search keeps:

- **A search is a new question.** It always asks for page 1; carrying the
  previous page number in would skip the first matches. An empty box drops `q`
  rather than sending an empty string, so clearing it returns the plain first
  page instead of asking the server to match nothing.
- **A selection survives its page.** The placement selects already kept the
  value currently assigned as a fallback option; the role list now does the same
  for anything checked, under the name it was checked with. A selection whose
  checkbox disappears behind a search is a grant the operator can neither see
  nor take back.

### Roles

`GET /api/admin/core/v1/tenants/:id/access/roles`

```ts
interface TenantRoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}
```

### Branches

`GET /api/admin/core/v1/tenants/:id/access/branches`

```ts
interface TenantBranchOption {
  id: string;
  code: string;
  name: string;
  company: { id: string; code: string; name: string };
}
```

### Departments and teams

```ts
// GET /api/admin/core/v1/tenants/:id/access/departments
interface DepartmentCatalogueQuery extends AccessCatalogueQuery {
  branchId: string; // required UUID
}

// GET /api/admin/core/v1/tenants/:id/access/teams
interface TeamCatalogueQuery extends AccessCatalogueQuery {
  departmentId: string; // required UUID
}

interface TenantOrganizationOption {
  id: string;
  code: string;
  name: string;
}
```

Only active, non-deleted options with active ancestors are returned. In a
cascading editor:

1. Changing company clears branch, department, and team.
2. Changing branch clears department and team.
3. Changing department clears team.
4. Team remains optional.

## Invite a user

`POST /api/admin/core/v1/tenants/:id/users`

```ts
interface AdminInviteTenantUserDto {
  email: string;       // valid email, max 255; trimmed and lowercased
  firstName: string;   // non-empty after trim, max 80
  lastName: string;    // non-empty after trim, max 80
  employeeCode?: string; // max 32
  companyId: string;   // required UUIDv7
  branchId: string;    // required UUIDv7
  departmentId: string; // required UUIDv7
  teamId?: string;     // UUIDv7
  managerId?: string;  // UUIDv7
  partyId?: string;    // UUIDv7
  jobTitle?: string;   // max 120
  roleAssignments?: BranchRoleAssignment[];
  teamMemberships?: TeamMembership[];
}

interface BranchRoleAssignment {
  branchId: string; // UUIDv7
  roleId: string;   // UUIDv7
}

interface TeamMembership {
  teamId: string; // UUIDv7
  role?: TeamMembershipRole;
  isPrimary?: boolean; // strict boolean
}
```

`roleAssignments` must be unique by `branchId:roleId`.
`teamMemberships` must be unique by `teamId`. Organization placement,
manager hierarchy, role references, and team references are validated against
the selected tenant database.

Response:

```ts
interface AdminTenantUserInvitation {
  user: AdminTenantUserView;
  delivery: 'QUEUED' | 'ALREADY_QUEUED';
}
```

Invitation creation requires security-email delivery to be available. One
important partial-success case exists: if the user was committed but queuing
the email failed, Core returns `503 TENANT_USER_CREATED_EMAIL_DELIVERY_FAILED`
with `userId` and `retryAction: 'RESEND_INVITE'`. Do not blindly retry create
with a new key; show the created user and offer resend invitation.

## Update profile and placement

`PATCH /api/admin/core/v1/tenants/:id/users/:userId`

```ts
interface AdminUpdateTenantUserDto {
  firstName?: string;       // non-empty after trim, max 80
  lastName?: string;        // non-empty after trim, max 80
  employeeCode?: string | null; // max 32; null clears
  companyId?: string;       // UUID
  branchId?: string;        // UUID
  departmentId?: string;    // UUID
  teamId?: string | null;   // UUID; null clears
  managerId?: string | null; // UUID; null clears
  jobTitle?: string | null; // max 120; null clears
}
```

Email and owner status are immutable. Core validates the complete resulting
organization placement, active ancestry, manager activity, and manager-cycle
safety. A changed profile advances `profileVersion`; an organization-placement
change also advances `authorizationVersion`. Existing reusable Auth Sessions
remain active, but their stale access JWTs must refresh and reload `/auth/me`.

## Password and invitation actions

### Send password reset

`POST /api/admin/core/v1/tenants/:id/users/:userId/reset-password`

- Only an `ACTIVE` user is eligible.
- The endpoint rotates a single-use reset token and queues email.
- It does not change the current password or revoke current sessions yet.
- Success is `202` with `{ userId, delivery }`.
- An `INVITED` user returns `TENANT_USER_INVITE_PENDING`.

### Resend invitation

`POST /api/admin/core/v1/tenants/:id/users/:userId/resend-invite`

- Only an `INVITED` user is eligible.
- Success is `202` with `{ userId, delivery }`.
- The old invitation token is invalidated.

```ts
interface TenantUserDelivery {
  userId: string;
  delivery: 'QUEUED' | 'ALREADY_QUEUED';
}
```

### Direct password change

`POST /api/admin/core/v1/tenants/:id/users/:userId/change-password`

```ts
interface AdminTenantUserChangePasswordDto {
  newPassword: string;
  passwordConfirmation: string;
}
```

Each string must be 12..128 characters and contain at least one uppercase
letter, lowercase letter, number, and symbol. They must match. Do not offer
this action for owners, `INVITED`, `DEACTIVATED`, or deleted users. Success
returns `AdminTenantUserView`, clears the lock/failure counter, advances
`securityEpoch`, ends all of that user's Auth Sessions, and invalidates pending
password-reset tokens.

## WebPhone

WebPhone is no longer administered through tenant users. The per-user
`webphone_*` columns and this route were removed; extensions are managed in the
WebPhone namespace at `/api/admin/webphone/v1/*`, documented in
[webphone.md](webphone.md).
```

If `enabled` is true, extension, SIP username, and an existing or newly
provided SIP password are all required. Empty/null `sipPassword` removes the
stored secret. Extension and SIP username must be unique inside the tenant.
Only send `sipPassword` when creating, clearing, or rotating the secret.

## Roles

`PATCH /api/admin/core/v1/tenants/:id/users/:userId/roles`

```ts
interface SetUserBranchRolesDto {
  assignments: Array<{
    branchId: string; // UUIDv7
    roleId: string;   // UUIDv7
  }>;
}
```

This is complete replacement, not a delta. Pairs must be unique. An empty
array removes all replaceable branch-role assignments. The action returns the
refreshed `AdminTenantUserView`.

## Lifecycle

### Suspend

`POST /api/admin/core/v1/tenants/:id/users/:userId/suspend`

- Owner accounts are protected.
- Already `SUSPENDED` is idempotent and still revokes outstanding credentials.
- `DEACTIVATED` cannot be suspended.
- Success returns the user with `status: 'SUSPENDED'`.

### Activate

`POST /api/admin/core/v1/tenants/:id/users/:userId/activate`

- Owner accounts are protected.
- Already `ACTIVE` is idempotent.
- Only `SUSPENDED` can transition to `ACTIVE`.

### Delete

`DELETE /api/admin/core/v1/tenants/:id/users/:userId`

- Owner accounts are protected.
- The user becomes `DEACTIVATED`, credentials are revoked, and the row is
  soft-deleted.
- Success is `204` with no response body.

### Restore

`POST /api/admin/core/v1/tenants/:id/users/:userId/restore`

- The route loads a soft-deleted record directly.
- A non-deleted record returns `TENANT_USER_NOT_DELETED`.
- Restore conflicts when an active user already has the same email or employee
  code.
- A restored user is always `SUSPENDED`; activation is a separate action.

## Tenant readiness rule

All 18 routes first resolve the tenant and open its database context. The
tenant must be `ACTIVE` or `SUSPENDED`. For `PROVISIONING`,
`PROVISIONING_FAILED`, or `DELETED`, Core returns
`TENANT_DATABASE_NOT_READY`. The tenant detail page should disable the Users
tab until the tenant reaches an eligible state.

## Important application errors

| Code | Meaning / UI behavior |
|---|---|
| `TENANT_NOT_FOUND` | Tenant id is missing or inaccessible. |
| `TENANT_DATABASE_NOT_READY` | Disable tenant access UI until provisioning succeeds. |
| `TENANT_USER_NOT_FOUND` | User is absent; refresh the directory. |
| `TENANT_OWNER_PROTECTED` | Owner cannot be updated, suspended, role-edited, password-changed, or deleted. |
| `TENANT_USER_IDENTITY_CONFLICT` | Email or employee code conflicts with another user. |
| `TENANT_USER_PLACEMENT_INVALID` | Company/branch/department/team ancestry is invalid or inactive. |
| `TENANT_USER_MANAGER_INVALID` | Manager is not an active tenant user. |
| `TENANT_USER_MANAGER_CYCLE` | Manager selection creates a reporting cycle. |
| `TENANT_USER_SEARCH_AMBIGUOUS` | Conflicting `q` and legacy `search`. |
| `TENANT_USER_VISIBILITY_AMBIGUOUS` | Conflicting `visibility` and legacy `includeDeleted`. |
| `TENANT_USER_STATUS_TRANSITION_INVALID` | Lifecycle action is invalid for the current status. |
| `TENANT_USER_INVITE_PENDING` | Use invitation acceptance/resend, not reset password. |
| `TENANT_USER_INVITE_NOT_PENDING` | Resend is only for invited users. |
| `TENANT_USER_PASSWORD_RESET_UNAVAILABLE` | Reset is only for active users. |
| `TENANT_USER_PASSWORD_CHANGE_UNAVAILABLE` | Direct change is blocked for invited/deactivated users. |
| `PASSWORD_CONFIRMATION_MISMATCH` | Password fields differ. |
| `WEAK_PASSWORD` | Password does not satisfy the strong-password policy. |
| `TENANT_USER_RESTORE_CONFLICT` | Email/employee code was reused while this row was deleted. |
| `TENANT_USER_CREATED_EMAIL_DELIVERY_FAILED` | User exists; use returned `userId` to resend invitation. |
| `TENANT_USER_EMAIL_DELIVERY_UNAVAILABLE` | Security-email delivery is unavailable; do not report success. |

Also handle the shared Gateway validation, authorization, idempotency, and
rate-limit errors described in the tenant
[Error catalogue](tenants.md#error-catalogue).

## Current Admin Portal integration

The tenant access workspace implements all 18 routes in this contract. It
loads no tenant-database resource before tenant status is `ACTIVE` or
`SUSPENDED`, and it issues no read without `admin.tenant_users.read`. Directory
and summary share exact filters while roles, branches, departments, and teams
retain independent permission/error states.

The UI uses structured organization, role-assignment, and manager
projections. Invite, edit, reset/resend/change-password, role, lifecycle,
delete, and restore commands use their canonical `POST`/`PATCH`/
`DELETE` verbs and stable caller-owned UUIDv7 identities. Deleted visibility,
owner protection, cascade confirmations, write-only password handling, and
partial email-delivery outcomes are represented explicitly.

## Frontend implementation checklist

- Gate each control with its exact permission from the endpoint table.
- Use the canonical Gateway paths and response envelope.
- Load directory and summary with identical filters.
- Keep active/deleted visibility separate from `UserStatus`.
- Implement dependent organization selectors from the access catalogue APIs.
- Disable owner profile, password, role, lifecycle, and delete mutations based
  on `isTenantOwner`.
- Reuse the same idempotency key for an exact retry; create a new key for a new
  user intent.
- Refresh rows from mutation responses instead of patching local guesses.
- Never persist or display SIP/password/token material.
- Treat email queuing as part of action success.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- Gateway routes:
  `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Gateway idempotency:
  `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- Controller:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/tenants.controller.ts`
- Service:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/admin-tenant-users.service.ts`
- Query DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-tenant-user-query.dto.ts`
- Access catalogue DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-tenant-access-catalogue.dto.ts`
- Params DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-tenant-user-params.dto.ts`
- Invite DTO:
  `../backend/mutakamel-apps/core-app/src/tenant/tenant-users/dto/create-tenant-user.dto.ts`
- Update DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-update-tenant-user.dto.ts`
- Password DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-tenant-user-change-password.dto.ts`
- Role DTO:
  `../backend/mutakamel-apps/core-app/src/tenant/tenant-roles/dto/set-user-branch-roles.dto.ts`
- Team membership DTO:
  `../backend/mutakamel-apps/core-app/src/tenant/tenant-users/dto/team-membership.dto.ts`
- Response DTO:
  `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/admin-tenant-user-view.dto.ts`
- Status enum:
  `../backend/mutakamel-apps/core-app/packages/common/src/enums/user-status.enum.ts`
- Team membership enum:
  `../backend/mutakamel-apps/core-app/packages/common/src/enums/team-membership-role.enum.ts`
