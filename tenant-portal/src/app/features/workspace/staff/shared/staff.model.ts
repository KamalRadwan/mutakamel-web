import type { CorePage } from '../../../../core/api/core-page';

export type { CorePage };

export type OrgStatus = 'ACTIVE' | 'INACTIVE';


export interface ListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  seatModuleKey?: string;
  seatState?: 'ACTIVE' | 'OVER_CAPACITY' | string;
}

export interface ConfirmAddonCascadeOptions {
  confirmAddonCascade?: boolean;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  taxNumber: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isHeadquarters: boolean;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  branchId: string;
  code: string;
  name: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  leadUserId: string | null;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrgTreeNode {
  id: string;
  code: string;
  name: string;
  status: OrgStatus;
  children: OrgTreeNode[];
}

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string | null;
  managerId: string | null;
  jobTitle: string | null;
  status: UserStatus;
  isTenantOwner: boolean;
  seats: { moduleKey: string; accessState: 'ACTIVE' | 'OVER_CAPACITY' }[];
  createdAt: string;
  updatedAt: string;
}

export type MembershipRole = 'MEMBER' | 'LEAD' | 'MANAGER';

export interface TeamMembership {
  id: string;
  tenantUserId: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string;
  role: MembershipRole;
  isPrimary: boolean;
  reportingScopeRevision: number;
  team?: Team;
  createdAt: string;
  updatedAt: string;
}

export interface ReportingScopeItem {
  id: string;
  companyId: string;
  branchId: string;
  origin: 'HOME' | 'EXPLICIT';
  revision: number;
  capabilities: { canRemove: boolean };
}

export interface ReportingScopes {
  membershipId: string;
  revision: number;
  items: ReportingScopeItem[];
  capabilities: { canManage: boolean };
}

export interface ModuleAssignment {
  id: string;
  userId: string;
  moduleKey: string;
  source?: 'ROLE' | 'MANUAL';
  grantedAt?: string;
  accessState?: 'ACTIVE' | 'OVER_CAPACITY';
  cause?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchRoleAssignment {
  id: string;
  tenantUserId: string;
  branchId: string;
  roleId: string;
  createdAt: string;
  updatedAt: string;
}

export type ScopeTarget = 'TENANT' | 'COMPANY' | 'BRANCH';

export interface ScopeRoleAssignment {
  id: string;
  tenantUserId: string;
  roleId: string;
  scopeTarget: ScopeTarget;
  companyId: string | null;
  branchId: string | null;
  scopeActive: boolean;
  createdAt: string;
}

export interface I18n {
  en: string;
  ar: string;
}

export interface AssignmentOptions {
  choices: {
    branchId: string;
    branchName: string;
    roleId: string;
    roleName: string;
    roleNameI18n: I18n;
  }[];
  hasMore: boolean;
  labels: {
    kind: 'role' | 'branch' | 'company';
    id: string;
    name: string;
    nameI18n?: I18n;
  }[];
}

export type PermissionMode = 'GLOBAL' | 'BRANCH';

export interface Role {
  id: string;
  name: string;
  nameI18n: I18n;
  description?: string;
  descriptionI18n?: I18n;
  isSystem: boolean;
  permissionMode: PermissionMode;
  branchProfileCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends Role {
  /** Required and validated by RolesApi; optional only for retained legacy producers. */
  holderCount?: number;
  permissionIds: string[];
}

export interface Permission {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  group: string;
  groupI18n: I18n;
  descriptionI18n?: I18n;
}

export interface CatalogueEntry {
  id: string;
  key: string;
  nameI18n: I18n;
  module: { id: string; nameI18n: I18n };
  groups: [{ id: string; nameI18n: I18n }, { id: string; nameI18n: I18n }];
  scope: 'BRANCH' | 'TENANT';
  recordScope: 'OWN' | 'TEAM' | 'ALL' | null;
}

export interface RoleBranchProfile {
  branchId: string;
  companyId: string;
  branchName: string;
  companyName: string;
  isActive: boolean;
  permissionIds: string[];
}

export interface RoleBranchPermissions {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  permissionMode: PermissionMode;
  revision: string;
  catalogueRevision: string;
  globalPermissionIds: string[];
  profiles: RoleBranchProfile[];
  catalogue: CatalogueEntry[];
  limits: { branches: 100; permissionsPerBranch: 200 };
}

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
}

export interface Currency {
  code: string;
  name: string;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SeatImpact {
  moduleKey: string;
  moduleName: I18n;
  holdersAffected: number;
  seatsNeeded: number;
  seatsFree: number;
}

export type OrgCascadeLevel = 'company' | 'branch' | 'department' | 'team';

export interface OrgCascadeValue {
  companyId: string | null;
  branchId: string | null;
  departmentId: string | null;
  teamId: string | null;
}

export interface StaffListFilter {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
}

export interface StaffListSortOption {
  value: string;
  label: string;
}

export interface BlockerLink {
  label: string;
  route: unknown[];
  queryParams?: Record<string, string>;
}

export interface BlockersDialogOptions {
  title?: string;
  blockers: string[];
  links?: Record<string, BlockerLink>;
  primaryAction?: { label: string; run: () => Promise<void> };
}

export const STAFF_LIMITS = {
  code: 32,
  name: 120,
  legalName: 200,
  taxNumber: 64,
  address: 2000,
  phone: 32,
  email: 255,
  personName: 80,
  employeeCode: 32,
  jobTitle: 120,
  roleName: 120,
  roleDescription: 2000,
  rolePermissions: 200,
  branchProfiles: 100,
  profilePermissions: 200,
  assignments: 500,
  memberships: 500,
  reportingBranches: 20,
  pageSize: 100,
} as const;

export const CODE_PATTERN = /^[A-Z0-9_-]{1,32}$/;
export const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;
