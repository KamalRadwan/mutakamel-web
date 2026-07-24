# Tenant Roles API

Base path: `/tenant`

The Roles module manages tenant custom roles, their permissions, and branch-scoped role assignments for tenant users.

## Permission Catalog

### `GET /tenant/permissions`
Returns the tenant permission catalog with localized permission labels grouped for role-building UIs.
- **Permissions**: `roles.permission.read`
- **Queries**: Pagination, `group`
- **Response**: `200 OK` (Paginated permissions)

## Roles

### `POST /tenant/roles`
Creates a custom tenant role and optionally grants tenant permission IDs in the same transaction.
- **Permissions**: `roles.role.create`
- **Body**: `CreateTenantRoleDto`
- **Response**: `201 Created`

### `GET /tenant/roles`
Returns tenant roles with pagination, search, and optional system-role filtering.
- **Permissions**: `roles.role.read`
- **Queries**: Pagination, `isSystem`
- **Response**: `200 OK` (Paginated Roles)

### `GET /tenant/roles/:id`
Returns a tenant role detail including the permission IDs granted to the role.
- **Permissions**: `roles.role.read`
- **Response**: `200 OK`

### `PATCH /tenant/roles/:id`
Updates a custom tenant role name and description while preventing edits to system roles.
- **Permissions**: `roles.role.update`
- **Body**: `UpdateTenantRoleDto`
- **Response**: `200 OK`

### `PUT /tenant/roles/:id/permissions`
Replaces all permissions granted to a custom tenant role and bumps sessions for users holding that role.
- **Permissions**: `roles.role.update`
- **Body**: `SetRolePermissionsDto`
- **Response**: `200 OK`

### `DELETE /tenant/roles/:id`
Soft-deletes a custom tenant role after verifying it is not a system role and not assigned to users.
- **Permissions**: `roles.role.delete`
- **Response**: `204 No Content`

## Assignments

### `GET /tenant/users/:userId/assignments`
Returns the branch-scoped role assignments for one tenant user, including related role and branch records.
- **Permissions**: `users.user.assign_roles`
- **Response**: `200 OK`

### `PUT /tenant/users/:userId/assignments`
Replaces all branch-role assignments for one tenant user after validating actor branch access and target branches/roles.
- **Permissions**: `users.user.assign_roles`
- **Body**: `SetUserBranchRolesDto`
- **Response**: `200 OK`

### `POST /tenant/users/:userId/assignments`
Adds one branch-role assignment for a tenant user after validating actor access and duplicate assignments.
- **Permissions**: `users.user.assign_roles`
- **Body**: `AddAssignmentDto`
- **Response**: `201 Created`

### `DELETE /tenant/users/:userId/assignments/:assignmentId`
Deletes one branch-role assignment for a tenant user after validating actor branch access.
- **Permissions**: `users.user.assign_roles`
- **Response**: `204 No Content`
