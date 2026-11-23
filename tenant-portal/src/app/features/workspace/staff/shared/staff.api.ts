import {
  fakeActivateUser,
  fakeAddBranchRole,
  fakeAddMembership,
  fakeAssignModule,
  fakeCreateBranch,
  fakeCreateCompany,
  fakeCreateDepartment,
  fakeCreateRole,
  fakeCreateTeam,
  fakeDeleteBranch,
  fakeDeleteCompany,
  fakeDeleteDepartment,
  fakeDeleteRole,
  fakeDeleteTeam,
  fakeDeleteUser,
  fakeGetBranch,
  fakeGetCompany,
  fakeGetDepartment,
  fakeGetMe,
  fakeGetOrgTree,
  fakeGetReportingScopes,
  fakeGetRole,
  fakeGetRoleBranchPermissions,
  fakeGetTeam,
  fakeGetUser,
  fakeInviteUser,
  fakeListAssignmentOptions,
  fakeListBranchRoles,
  fakeListBranches,
  fakeListCompanies,
  fakeListCurrencies,
  fakeListDepartments,
  fakeListMemberships,
  fakeListModules,
  fakeListPermissions,
  fakeListRoles,
  fakeListScopeRoles,
  fakeListTeams,
  fakeListUsers,
  fakePatchReportingScopes,
  fakePreviewSeatImpact,
  fakeRemoveBranchRole,
  fakeRemoveMembership,
  fakeResendInvite,
  fakeRevokeSessions,
  fakeRoleHolderCount,
  fakeSetBranchRoles,
  fakeSetMemberships,
  fakeSetRoleBranchPermissions,
  fakeSetRolePermissions,
  fakeSetScopeRoles,
  fakeSuspendUser,
  fakeUnassignModule,
  fakeUpdateBranch,
  fakeUpdateCompany,
  fakeUpdateDepartment,
  fakeUpdateRole,
  fakeUpdateTeam,
  fakeUpdateUser,
  type StaffFixtureReadScope,
} from './staff.fake';
import {
  AssignmentOptions,
  Branch,
  BranchRoleAssignment,
  Company,
  ConfirmAddonCascadeOptions,
  Currency,
  Department,
  ListQuery,
  Me,
  MembershipRole,
  ModuleAssignment,
  CorePage,
  OrgTreeNode,
  Permission,
  ReportingScopes,
  Role,
  RoleBranchPermissions,
  RoleDetail,
  ScopeRoleAssignment,
  ScopeTarget,
  SeatImpact,
  Team,
  TeamMembership,
  TenantUser,
} from './staff.model';

export { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
export { newIdempotencyKey } from '../../../../core/api/idempotency';

export { staffErrorMessage } from './staff-errors';

export async function listAllPages<T>(
  fetchPage: (q: ListQuery) => Promise<CorePage<T>>,
  query: ListQuery = {},
): Promise<T[]> {
  const limit = query.limit ?? 100;
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetchPage({ ...query, page, limit });
    all.push(...res.data);
    if (!res.meta.hasNext || res.data.length === 0 || page >= res.meta.totalPages) {
      break;
    }
    page++;
  }
  return all;
}

// Real browser base: /api/tenant/core/v1

export function getMe(): Promise<Me> {
  // GET /api/tenant/core/v1/auth/me
  return fakeGetMe();
}

export function getOrgTree(): Promise<OrgTreeNode[]> {
  // GET /api/tenant/core/v1/organization/tree
  return fakeGetOrgTree();
}

// FAKE, used by billing/seats, operations/application-activation, seats/over-capacity until they link
export function listCompanies(q: ListQuery = {}, canRead?: StaffFixtureReadScope): Promise<CorePage<Company>> {
  // GET /api/tenant/core/v1/organization/companies (sortBy: name|code|createdAt)
  return fakeListCompanies(q, canRead);
}

export function getCompany(id: string): Promise<Company> {
  // GET /api/tenant/core/v1/organization/companies/:id
  return fakeGetCompany(id);
}

export function createCompany(
  b: {
    code: string;
    name: string;
    legalName?: string | null;
    taxNumber?: string | null;
    currencyCode?: string | null;
  },
  key: string,
): Promise<Company> {
  // POST /api/tenant/core/v1/organization/companies (x-idempotency-key)
  return fakeCreateCompany(b, key);
}

export function updateCompany(
  id: string,
  patch: Partial<Pick<Company, 'name' | 'legalName' | 'taxNumber' | 'currencyCode' | 'status'>>,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<Company> {
  // PATCH /api/tenant/core/v1/organization/companies/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeUpdateCompany(id, patch, key, opts);
}

export function deleteCompany(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  // DELETE /api/tenant/core/v1/organization/companies/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeDeleteCompany(id, key, opts);
}

// FAKE, used by billing/seats, operations/activities, operations/application-activation, operations/audit-log, operations/party-directory, seats/over-capacity until they link
export function listBranches(q: ListQuery = {}, canRead?: StaffFixtureReadScope): Promise<CorePage<Branch>> {
  // GET /api/tenant/core/v1/organization/branches
  return fakeListBranches(q, canRead);
}

// FAKE, used by operations/application-activation until it links
export function getBranch(id: string): Promise<Branch> {
  // GET /api/tenant/core/v1/organization/branches/:id
  return fakeGetBranch(id);
}

export function createBranch(
  b: {
    companyId: string;
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    isHeadquarters?: boolean;
  },
  key: string,
): Promise<Branch> {
  // POST /api/tenant/core/v1/organization/branches (x-idempotency-key)
  return fakeCreateBranch(b, key);
}

export function updateBranch(
  id: string,
  patch: Partial<Pick<Branch, 'name' | 'address' | 'phone' | 'isHeadquarters' | 'status'>>,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<Branch> {
  // PATCH /api/tenant/core/v1/organization/branches/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeUpdateBranch(id, patch, key, opts);
}

export function deleteBranch(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  // DELETE /api/tenant/core/v1/organization/branches/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeDeleteBranch(id, key, opts);
}

export function listDepartments(q: ListQuery = {}, canRead?: StaffFixtureReadScope): Promise<CorePage<Department>> {
  // GET /api/tenant/core/v1/organization/departments
  return fakeListDepartments(q, canRead);
}

export function getDepartment(id: string): Promise<Department> {
  // GET /api/tenant/core/v1/organization/departments/:id
  return fakeGetDepartment(id);
}

export function createDepartment(
  b: { branchId: string; code: string; name: string },
  key: string,
): Promise<Department> {
  // POST /api/tenant/core/v1/organization/departments (x-idempotency-key)
  return fakeCreateDepartment(b, key);
}

export function updateDepartment(
  id: string,
  patch: Partial<Pick<Department, 'name' | 'status'>>,
  key: string,
): Promise<Department> {
  // PATCH /api/tenant/core/v1/organization/departments/:id (x-idempotency-key)
  return fakeUpdateDepartment(id, patch, key);
}

export function deleteDepartment(id: string, key: string): Promise<void> {
  // DELETE /api/tenant/core/v1/organization/departments/:id (x-idempotency-key)
  return fakeDeleteDepartment(id, key);
}

export function listTeams(q: ListQuery = {}, canRead?: StaffFixtureReadScope): Promise<CorePage<Team>> {
  // GET /api/tenant/core/v1/organization/teams
  return fakeListTeams(q, canRead);
}

export function getTeam(id: string): Promise<Team> {
  // GET /api/tenant/core/v1/organization/teams/:id
  return fakeGetTeam(id);
}

export function createTeam(
  b: { departmentId: string; code: string; name: string; leadUserId?: string | null },
  key: string,
): Promise<Team> {
  // POST /api/tenant/core/v1/organization/teams (x-idempotency-key)
  return fakeCreateTeam(b, key);
}

export function updateTeam(
  id: string,
  patch: Partial<Pick<Team, 'name' | 'leadUserId' | 'status'>>,
  key: string,
): Promise<Team> {
  // PATCH /api/tenant/core/v1/organization/teams/:id (x-idempotency-key)
  return fakeUpdateTeam(id, patch, key);
}

export function deleteTeam(id: string, key: string): Promise<void> {
  // DELETE /api/tenant/core/v1/organization/teams/:id (x-idempotency-key)
  return fakeDeleteTeam(id, key);
}

// FAKE, used by operations/addon-seats, operations/audit-log, operations/party-directory until they link
export function listUsers(q: ListQuery = {}, canRead?: StaffFixtureReadScope): Promise<CorePage<TenantUser>> {
  // GET /api/tenant/core/v1/users (sortBy: email|firstName|lastName|employeeCode|createdAt)
  return fakeListUsers(q, canRead);
}

// FAKE, used by operations/addon-seats, operations/party-directory until they link
export function getUser(id: string): Promise<TenantUser> {
  // GET /api/tenant/core/v1/users/:id
  return fakeGetUser(id);
}

export function inviteUser(
  b: {
    email: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
    companyId: string;
    branchId: string;
    departmentId: string;
    teamId?: string | null;
    managerId?: string | null;
    jobTitle?: string | null;
    roleAssignments?: { branchId: string; roleId: string }[];
    teamMemberships?: { teamId: string; role?: MembershipRole }[];
  },
  key: string,
): Promise<TenantUser> {
  // POST /api/tenant/core/v1/users (x-idempotency-key)
  return fakeInviteUser(b, key);
}

export function updateUser(
  id: string,
  patch: Partial<
    Pick<
      TenantUser,
      'firstName' | 'lastName' | 'employeeCode' | 'companyId' | 'branchId' | 'departmentId' | 'teamId' | 'managerId' | 'jobTitle'
    >
  >,
  key: string,
): Promise<TenantUser> {
  // PATCH /api/tenant/core/v1/users/:id (x-idempotency-key)
  return fakeUpdateUser(id, patch, key);
}

export function deleteUser(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  // DELETE /api/tenant/core/v1/users/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeDeleteUser(id, key, opts);
}

export function resendInvite(id: string, key: string): Promise<{ deliveryStatus: 'QUEUED' }> {
  // POST /api/tenant/core/v1/users/:id/resend-invite (x-idempotency-key)
  return fakeResendInvite(id, key);
}

export function suspendUser(id: string, key: string): Promise<TenantUser> {
  // POST /api/tenant/core/v1/users/:id/suspend (x-idempotency-key)
  return fakeSuspendUser(id, key);
}

export function activateUser(id: string, key: string): Promise<TenantUser> {
  // POST /api/tenant/core/v1/users/:id/activate (x-idempotency-key)
  return fakeActivateUser(id, key);
}

export function revokeSessions(id: string, key: string): Promise<TenantUser> {
  // POST /api/tenant/core/v1/users/:id/sessions/revoke (x-idempotency-key)
  return fakeRevokeSessions(id, key);
}

export function listMemberships(userId: string): Promise<TeamMembership[]> {
  // GET /api/tenant/core/v1/users/:userId/team-memberships
  return fakeListMemberships(userId);
}

export function setMemberships(
  userId: string,
  memberships: { teamId: string; role: MembershipRole; isPrimary?: boolean }[],
  key: string,
): Promise<TeamMembership[]> {
  // PUT /api/tenant/core/v1/users/:userId/team-memberships (x-idempotency-key)
  return fakeSetMemberships(userId, memberships, key);
}

export function addMembership(
  userId: string,
  m: { teamId: string; role: MembershipRole; isPrimary?: boolean },
  key: string,
): Promise<TeamMembership[]> {
  // POST /api/tenant/core/v1/users/:userId/team-memberships (x-idempotency-key); returns the user's full membership list
  return fakeAddMembership(userId, m, key);
}

export function removeMembership(userId: string, membershipId: string, key: string): Promise<void> {
  // DELETE /api/tenant/core/v1/users/:userId/team-memberships/:membershipId (x-idempotency-key)
  return fakeRemoveMembership(userId, membershipId, key);
}

export function getReportingScopes(userId: string, membershipId: string): Promise<ReportingScopes> {
  // GET /api/tenant/core/v1/users/:userId/team-memberships/:membershipId/reporting-scopes
  return fakeGetReportingScopes(userId, membershipId);
}

export function patchReportingScopes(
  userId: string,
  membershipId: string,
  body: { expectedRevision: number; addBranchIds?: string[]; removeBranchIds?: string[] },
  key: string,
): Promise<{ membershipId: string; revision: number; outcome: 'APPLIED' | 'NO_CHANGE'; replayed: boolean }> {
  // PATCH /api/tenant/core/v1/users/:userId/team-memberships/:membershipId/reporting-scopes (x-idempotency-key)
  return fakePatchReportingScopes(userId, membershipId, body, key);
}

export function listModules(userId: string): Promise<ModuleAssignment[]> {
  // GET /api/tenant/core/v1/users/:userId/modules
  return fakeListModules(userId);
}

export function assignModule(userId: string, moduleKey: string, key: string): Promise<ModuleAssignment> {
  // POST /api/tenant/core/v1/users/:userId/modules (body: { moduleKey }; x-idempotency-key)
  return fakeAssignModule(userId, moduleKey, key);
}

export function unassignModule(userId: string, moduleKey: string, key: string): Promise<void> {
  // DELETE /api/tenant/core/v1/users/:userId/modules/:moduleKey (x-idempotency-key)
  return fakeUnassignModule(userId, moduleKey, key);
}

export function listPermissions(q: ListQuery = {}): Promise<CorePage<Permission>> {
  // GET /api/tenant/core/v1/permissions (sortBy: key|group)
  return fakeListPermissions(q);
}

export function listRoles(q: ListQuery & { isSystem?: boolean } = {}): Promise<CorePage<Role>> {
  // GET /api/tenant/core/v1/roles
  return fakeListRoles(q);
}

export function getRole(id: string): Promise<RoleDetail> {
  // GET /api/tenant/core/v1/roles/:id
  return fakeGetRole(id);
}

export function createRole(
  b: { name: string; description?: string; permissionIds?: string[] },
  key: string,
): Promise<RoleDetail> {
  // POST /api/tenant/core/v1/roles (x-idempotency-key)
  return fakeCreateRole(b, key);
}

export function updateRole(
  id: string,
  patch: { name?: string; description?: string | null },
  key: string,
): Promise<RoleDetail> {
  // PATCH /api/tenant/core/v1/roles/:id (x-idempotency-key)
  return fakeUpdateRole(id, patch, key);
}

export function setRolePermissions(
  id: string,
  permissionIds: string[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<RoleDetail> {
  // PUT /api/tenant/core/v1/roles/:id/permissions?confirmAddonCascade=true (x-idempotency-key)
  return fakeSetRolePermissions(id, permissionIds, key, opts);
}

export function deleteRole(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  // DELETE /api/tenant/core/v1/roles/:id?confirmAddonCascade=true (x-idempotency-key)
  return fakeDeleteRole(id, key, opts);
}

export function getRoleBranchPermissions(id: string): Promise<RoleBranchPermissions> {
  // GET /api/tenant/core/v1/roles/:id/branch-permissions (owner only)
  return fakeGetRoleBranchPermissions(id);
}

export function setRoleBranchPermissions(
  id: string,
  body: { expectedRevision: string; catalogueRevision: string; profiles: { branchId: string; permissionIds: string[] }[] },
  opts?: ConfirmAddonCascadeOptions,
): Promise<RoleBranchPermissions> {
  // PUT /api/tenant/core/v1/roles/:id/branch-permissions?confirmAddonCascade=true (owner only; idempotencyMode: NONE)
  return fakeSetRoleBranchPermissions(id, body, opts);
}

export function listAssignmentOptions(userId: string, q: ListQuery = {}): Promise<AssignmentOptions> {
  // GET /api/tenant/core/v1/users/:userId/assignment-options
  return fakeListAssignmentOptions(userId, q);
}

export function listBranchRoles(userId: string): Promise<BranchRoleAssignment[]> {
  // GET /api/tenant/core/v1/users/:userId/assignments
  return fakeListBranchRoles(userId);
}

export function setBranchRoles(
  userId: string,
  assignments: { branchId: string; roleId: string }[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<BranchRoleAssignment[]> {
  // PUT /api/tenant/core/v1/users/:userId/assignments?confirmAddonCascade=true (x-idempotency-key)
  return fakeSetBranchRoles(userId, assignments, key, opts);
}

export function addBranchRole(
  userId: string,
  b: { branchId: string; roleId: string },
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<BranchRoleAssignment> {
  // POST /api/tenant/core/v1/users/:userId/assignments?confirmAddonCascade=true (x-idempotency-key)
  return fakeAddBranchRole(userId, b, key, opts);
}

export function removeBranchRole(
  userId: string,
  assignmentId: string,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<void> {
  // DELETE /api/tenant/core/v1/users/:userId/assignments/:assignmentId?confirmAddonCascade=true (x-idempotency-key)
  return fakeRemoveBranchRole(userId, assignmentId, key, opts);
}

export function listScopeRoles(userId: string): Promise<ScopeRoleAssignment[]> {
  // GET /api/tenant/core/v1/users/:userId/scope-role-assignments (owner only)
  return fakeListScopeRoles(userId);
}

export function setScopeRoles(
  userId: string,
  assignments: { scopeTarget: ScopeTarget; roleId: string; companyId?: string | null; branchId?: string | null }[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<ScopeRoleAssignment[]> {
  // PUT /api/tenant/core/v1/users/:userId/scope-role-assignments?confirmAddonCascade=true (owner only; x-idempotency-key)
  return fakeSetScopeRoles(userId, assignments, key, opts);
}

export function roleHolderCount(roleId: string): Promise<number> {
  // FAKE-ONLY, no backend route: returns the live holder count across branch and scope assignments
  return fakeRoleHolderCount(roleId);
}

export function listCurrencies(): Promise<Currency[]> {
  // GET /api/tenant/core/v1/currencies (paged): reads every page
  return listAllPages((q) => fakeListCurrencies(q));
}

/**
 * @deprecated Use `previewSeats` from `features/workspace/seats/seats.api` instead.
 */
export function previewSeatImpact(change: {
  roleId?: string;
  userId?: string;
  profiles?: { branchId: string; permissionIds: string[] }[];
  permissionIds?: string[];
  addBranchRoles?: { branchId: string; roleId: string }[];
}): Promise<SeatImpact[]> {
  // FAKE-ONLY placeholder until the owner settles the seat rules (seats-analysis.md); returns [] unless FAKE_SEAT_IMPACT is true
  return fakePreviewSeatImpact(change);
}
