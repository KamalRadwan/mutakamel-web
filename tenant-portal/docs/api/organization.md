# Organization API

Base path: `/tenant/organization`

The Organization module manages the tenant's structural hierarchy: Companies -> Branches -> Departments -> Teams.

## Organization Tree

### `GET /tenant/organization/tree`
Returns the tenant company, branch, department, and team hierarchy in a single tree payload.
- **Permissions**: `org.company.read`
- **Response**: `200 OK` (Tree of Companies -> Branches -> Departments -> Teams)

## Companies

### `POST /tenant/organization/companies`
Creates a tenant company after validating code uniqueness and optional active default currency.
- **Permissions**: `org.company.manage`
- **Body**: `CreateCompanyDto`
- **Response**: `201 Created`

### `GET /tenant/organization/companies`
Returns tenant companies with pagination, search, sorting, and optional status filtering.
- **Permissions**: `org.company.read`
- **Queries**: Pagination, `status`
- **Response**: `200 OK` (Paginated Companies)

### `GET /tenant/organization/companies/:id`
Returns one tenant company by ID.
- **Permissions**: `org.company.read`
- **Response**: `200 OK`

### `PATCH /tenant/organization/companies/:id`
Updates company metadata, currency, and status while blocking invalid currency and unsafe deactivation.
- **Permissions**: `org.company.manage`
- **Body**: `UpdateCompanyDto`
- **Response**: `200 OK`

### `DELETE /tenant/organization/companies/:id`
Soft-deletes a company when it has no branches and no users placed directly in it.
- **Permissions**: `org.company.manage`
- **Response**: `204 No Content`

## Branches

### `POST /tenant/organization/branches`
Creates a branch under an active company, validating branch code uniqueness and headquarters uniqueness.
- **Permissions**: `org.branch.manage`
- **Body**: `CreateBranchDto`
- **Response**: `201 Created`

### `GET /tenant/organization/branches`
Returns tenant branches with pagination, search, sorting, and optional company/status filters.
- **Permissions**: `org.branch.read`
- **Queries**: Pagination, `companyId`, `status`
- **Response**: `200 OK` (Paginated Branches)

### `GET /tenant/organization/branches/:id`
Returns one tenant branch by ID.
- **Permissions**: `org.branch.read`
- **Response**: `200 OK`

### `PATCH /tenant/organization/branches/:id`
Updates branch metadata, headquarters flag, and status while blocking unsafe deactivation.
- **Permissions**: `org.branch.manage`
- **Body**: `UpdateBranchDto`
- **Response**: `200 OK`

### `DELETE /tenant/organization/branches/:id`
Soft-deletes a branch when it has no departments and no users placed in it.
- **Permissions**: `org.branch.manage`
- **Response**: `204 No Content`

## Departments

### `POST /tenant/organization/departments`
Creates a department under an active branch and validates department code uniqueness within that branch.
- **Permissions**: `org.department.manage`
- **Body**: `CreateDepartmentDto`
- **Response**: `201 Created`

### `GET /tenant/organization/departments`
Returns tenant departments with pagination, search, sorting, and optional branch/status filters.
- **Permissions**: `org.department.read`
- **Queries**: Pagination, `branchId`, `status`
- **Response**: `200 OK` (Paginated Departments)

### `GET /tenant/organization/departments/:id`
Returns one tenant department by ID.
- **Permissions**: `org.department.read`
- **Response**: `200 OK`

### `PATCH /tenant/organization/departments/:id`
Updates department name and status while blocking unsafe deactivation.
- **Permissions**: `org.department.manage`
- **Body**: `UpdateDepartmentDto`
- **Response**: `200 OK`

### `DELETE /tenant/organization/departments/:id`
Soft-deletes a department when it has no teams and no users placed in it.
- **Permissions**: `org.department.manage`
- **Response**: `204 No Content`

## Teams

### `POST /tenant/organization/teams`
Creates a team under an active department, validating team code uniqueness and optional lead user existence.
- **Permissions**: `org.team.manage`
- **Body**: `CreateTeamDto`
- **Response**: `201 Created`

### `GET /tenant/organization/teams`
Returns tenant teams with pagination, search, sorting, and optional department/status filters.
- **Permissions**: `org.team.read`
- **Queries**: Pagination, `departmentId`, `status`
- **Response**: `200 OK` (Paginated Teams)

### `GET /tenant/organization/teams/:id`
Returns one tenant team by ID.
- **Permissions**: `org.team.read`
- **Response**: `200 OK`

### `PATCH /tenant/organization/teams/:id`
Updates team name, lead user, and status while blocking unsafe deactivation.
- **Permissions**: `org.team.manage`
- **Body**: `UpdateTeamDto`
- **Response**: `200 OK`

### `DELETE /tenant/organization/teams/:id`
Soft-deletes a team when it has no users placed in it.
- **Permissions**: `org.team.manage`
- **Response**: `204 No Content`
