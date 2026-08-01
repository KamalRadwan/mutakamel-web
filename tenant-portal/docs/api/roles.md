# Tenant roles and role assignments API

> **Contract status:** Current; legacy branch assignments and newer exact-scope assignments coexist
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1`
> **Controller-relative prefix:** `/tenant`
> **Tenant Portal status:** Planned. No complete replacement-grade role editor exists in `tenant-portal`.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Roles controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/tenant-roles`
- Exact-scope controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/scope-role-assignments`
- Legacy settings/users UI: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings`

## Security and common contract

Routes require a tenant JWT, matching verified host, current session/subscription, the listed permission, and effective branch/company scope. Exact-scope assignment GET and PUT additionally require the current actor to be an active tenant owner; the permission alone is insufficient.

All IDs are UUIDv7. Unknown DTO fields are rejected. List routes use common pagination (`page` 1, `limit` 20/max 100, `search` max 200). Paginated results put the array in `data` and counts in `meta`. Standard errors use the Core envelope; `204` has no body.

These mutations have no explicit application idempotency contract. Role/assignment changes bump session versions for affected users; the UI must expect their access tokens to become stale.

Role data is private and scope-sensitive; do not store it in a shared/public cache. All routes are synchronous from the portal contract and expose no async job.

## Permission catalogue and roles

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/permissions` | `roles.permission.read` | Paginated catalogue; use returned keys/labels |
| `POST /api/tenant/core/v1/roles` | `roles.role.create` | Create non-system role |
| `GET /api/tenant/core/v1/roles` | `roles.role.read` | Paginated; strict optional `isSystem` |
| `GET /api/tenant/core/v1/roles/:id` | `roles.role.read` | Role plus permission IDs |
| `PATCH /api/tenant/core/v1/roles/:id` | `roles.role.update` | Update custom role |
| `PUT /api/tenant/core/v1/roles/:id/permissions` | `roles.role.update` | Replace permission set |
| `DELETE /api/tenant/core/v1/roles/:id` | `roles.role.delete` | `204`, soft delete if unused |

Create: `name` required/non-empty, maximum 120; optional `description` maximum 2,000; optional unique `permissionIds` UUIDv7 array. Update accepts `name` and `description`. Permission replacement body is `{permissionIds:[...]}`; an empty array is valid.

Do not hard-code the permission catalogue. Unknown IDs return `PERMISSION_UNKNOWN`. System roles cannot be updated/deleted.

## Legacy branch-role assignments

| Method and canonical browser path | Permission |
|---|---|
| `GET /api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` |
| `PUT /api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` |
| `POST /api/tenant/core/v1/users/:userId/assignments` | `users.user.assign_roles` |
| `DELETE /api/tenant/core/v1/users/:userId/assignments/:assignmentId` | `users.user.assign_roles` |

An assignment is `{branchId,roleId}`. PUT body replaces the unique pair list; POST adds one pair. Actor branch access, target user, role, duplicate, self-assignment, and owner protections are enforced.

## Exact-scope assignments

| Method and canonical browser path | Permission plus guard |
|---|---|
| `GET /api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` + active tenant owner |
| `PUT /api/tenant/core/v1/users/:userId/scope-role-assignments` | `users.user.assign_roles` + active tenant owner |

PUT accepts `{assignments:[...]}` with at most 500 unique tuples. Each item:

```ts
{
  scopeTarget: "TENANT" | "COMPANY" | "BRANCH";
  roleId: UUIDv7;
  companyId?: UUIDv7;
  branchId?: UUIDv7;
}
```

Shape rules:

- `TENANT`: no company or branch.
- `COMPANY`: company required; no branch.
- `BRANCH`: both company and branch required and related.

An empty assignment array is valid and removes all assignable exact-scope grants, subject to owner protections.

Safe catalogue example:

```http
GET /api/tenant/core/v1/permissions?page=1&limit=20&sortBy=group&sortDir=ASC
Authorization: Bearer <tenant-access-token>
```

Validation combines DTO rules (UUIDv7, lengths, unique tuples, scope shape) with owner/branch/role domain checks.

## Errors and AI implementation rules

Expected errors include `ROLE_NOT_FOUND`, `ROLE_NAME_TAKEN`, `ROLE_IN_USE`, `ROLE_IS_SYSTEM`, `PERMISSION_UNKNOWN`, `ASSIGNMENT_EXISTS`, `ASSIGNMENT_NOT_FOUND`, `BRANCH_OR_ROLE_INVALID`, `BRANCH_ACCESS_DENIED`, `TENANT_USER_NOT_FOUND`, `TENANT_OWNER_PROTECTED`, `ROLE_SELF_ASSIGNMENT_FORBIDDEN`, `ACTOR_NOT_FOUND`, and `SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED`.

- Prefer exact-scope assignments for new owner administration flows; keep legacy branch routes only where existing behavior requires them.
- Show the effective scope tuple explicitly before replacement.
- Refetch assignments after write and require reauthentication if the current user's session becomes stale.
- Never infer tenant-owner status from a role name or permission key.
