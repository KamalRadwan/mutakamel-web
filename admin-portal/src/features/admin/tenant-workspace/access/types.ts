import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { TenantStatus } from "../core/types";

export const TENANT_USER_STATUSES = [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
] as const;

export type TenantUserStatus = (typeof TENANT_USER_STATUSES)[number];
export type TenantUserVisibility = "ACTIVE" | "DELETED" | "ALL";
export type TenantUserSortField =
  | "email"
  | "firstName"
  | "lastName"
  | "employeeCode"
  | "status"
  | "lastLoginAt"
  | "createdAt";
export type SortDirection = "ASC" | "DESC";
export type TenantUserRoleScope = "TENANT" | "COMPANY" | "BRANCH";
export type DeliveryState = "QUEUED" | "ALREADY_QUEUED";
export type TeamMembershipRole = "MEMBER" | "LEAD" | "MANAGER";

export interface TenantUserOrganizationRef {
  id: string;
  code: string | null;
  name: string | null;
}

export interface TenantUserManagerRef {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TenantUserRoleAssignment {
  assignmentId: string;
  roleId: string;
  roleName: string;
  scope: TenantUserRoleScope;
  companyId: string | null;
  branchId: string | null;
}

/** The server never returns a SIP credential; only passwordConfigured is readable. */
export interface TenantUserWebphone {
  enabled: boolean;
  extension: string | null;
  sipUsername: string | null;
  displayName: string | null;
  outboundCallerId: string | null;
  transport: "ws" | "wss";
  passwordConfigured: boolean;
}

export interface TenantUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  status: TenantUserStatus;
  isTenantOwner: boolean;
  organization: {
    company: TenantUserOrganizationRef;
    branch: TenantUserOrganizationRef;
    department: TenantUserOrganizationRef;
    team: TenantUserOrganizationRef | null;
  };
  manager: TenantUserManagerRef | null;
  roleAssignments: TenantUserRoleAssignment[];
  webphone: TenantUserWebphone;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TenantUserSummary {
  total: number;
  invited: number;
  active: number;
  suspended: number;
  deactivated: number;
  deleted: number;
  owners: number;
  webphoneEnabled: number;
  locked: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TenantUserListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: TenantUserStatus;
  role?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  visibility?: TenantUserVisibility;
  sortBy?: TenantUserSortField;
  sortDir?: SortDirection;
}

export type TenantUserSummaryQuery = Omit<
  TenantUserListQuery,
  "page" | "limit" | "sortBy" | "sortDir"
>;

export interface CatalogueQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  company: {
    id: string;
    code: string;
    name: string;
  };
}

export interface OrganizationOption {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentCatalogueQuery extends CatalogueQuery {
  branchId: string;
}

export interface TeamCatalogueQuery extends CatalogueQuery {
  departmentId: string;
}

export interface BranchRoleAssignmentInput {
  branchId: string;
  roleId: string;
}

export interface TeamMembershipInput {
  teamId: string;
  role?: TeamMembershipRole;
  isPrimary?: boolean;
}

export interface InviteTenantUserInput {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId?: string;
  managerId?: string;
  partyId?: string;
  jobTitle?: string;
  roleAssignments?: BranchRoleAssignmentInput[];
  teamMemberships?: TeamMembershipInput[];
}

export interface UpdateTenantUserInput {
  firstName?: string;
  lastName?: string;
  employeeCode?: string | null;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string | null;
  managerId?: string | null;
  jobTitle?: string | null;
}

export interface ChangeTenantUserPasswordInput {
  newPassword: string;
  passwordConfirmation: string;
}

export interface UpdateTenantUserWebphoneInput {
  enabled?: boolean;
  extension?: string | null;
  sipUsername?: string | null;
  /** Write-only. It must never be copied into readable user state. */
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  transport?: "ws" | "wss";
}

export interface ReplaceTenantUserRolesInput {
  assignments: BranchRoleAssignmentInput[];
}

export interface TenantUserDeliveryResult {
  userId: string;
  delivery: DeliveryState;
}

export interface TenantUserInvitationResult {
  user: TenantUserView;
  delivery: DeliveryState;
}

export type TenantAccessResourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "forbidden"
  | "unavailable"
  | "error";

export interface TenantAccessResource<T> {
  status: TenantAccessResourceStatus;
  data: T | null;
  error: NormalizedApiError | null;
}

export type TenantAccessCommandName =
  | "invite"
  | "update"
  | "reset-password"
  | "resend-invite"
  | "change-password"
  | "webphone"
  | "suspend"
  | "activate"
  | "roles"
  | "delete"
  | "restore";

export interface TenantAccessCommandState {
  name: TenantAccessCommandName | null;
  userId: string | null;
  pending: boolean;
  error: NormalizedApiError | null;
}

export interface TenantAccessPermissions {
  canRead: boolean;
  canReadRoles: boolean;
  canInvite: boolean;
  canUpdate: boolean;
  canResetPassword: boolean;
  canManageWebphone: boolean;
  canSuspend: boolean;
  canAssignRoles: boolean;
  canDelete: boolean;
  canRestore: boolean;
}

export const TENANT_ACCESS_PERMISSION_SETS = {
  read: ["admin.tenant_users.read"],
  readRoles: ["admin.tenant_users.assign_roles"],
  invite: ["admin.tenant_users.invite", "admin.tenant_users.critical"],
  update: ["admin.tenant_users.update"],
  resetPassword: [
    "admin.tenant_users.reset_password",
    "admin.tenant_users.critical",
  ],
  manageWebphone: [
    "admin.tenant_users.manage_webphone",
    "admin.tenant_users.critical",
  ],
  suspend: ["admin.tenant_users.suspend", "admin.tenant_users.critical"],
  assignRoles: [
    "admin.tenant_users.assign_roles",
    "admin.tenant_users.critical",
  ],
  delete: ["admin.tenant_users.delete", "admin.tenant_users.critical"],
  restore: ["admin.tenant_users.restore", "admin.tenant_users.critical"],
} as const;

export function isTenantAccessDatabaseReady(status: TenantStatus): boolean {
  return status === "ACTIVE" || status === "SUSPENDED";
}

export function isDeletedTenantUser(user: TenantUserView): boolean {
  return user.deletedAt !== null;
}

export function isOwnerProtectedCommand(
  command: TenantAccessCommandName,
): boolean {
  return [
    "update",
    "change-password",
    "suspend",
    "activate",
    "roles",
    "delete",
  ].includes(command);
}
