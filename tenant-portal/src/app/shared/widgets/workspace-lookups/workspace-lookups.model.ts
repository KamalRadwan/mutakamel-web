export interface WorkspaceCompany {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  taxNumber: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceBranch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isHeadquarters: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceUser {
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
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  isTenantOwner: boolean;
  seats: { moduleKey: string; accessState: 'ACTIVE' | 'OVER_CAPACITY' }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceApp {
  moduleKey: string;
  nameI18n: { en: string; ar: string };
  iconKey: string | null;
  group: 'SUBSCRIBED' | 'AVAILABLE' | 'FUTURE';
  isAddon: boolean;
  myAccessState: 'ACTIVE' | 'OVER_CAPACITY' | null;
  seats: { used: number; total: number } | null;
}

export interface WorkspaceCompanyQuery {
  search?: string;
  status?: WorkspaceCompany['status'];
  page?: number;
  limit?: number;
}

export interface WorkspaceBranchQuery extends WorkspaceCompanyQuery {
  companyId?: string;
}

export interface WorkspaceUserQuery {
  search?: string;
  branchId?: string;
  status?: WorkspaceUser['status'];
  page?: number;
  limit?: number;
}

export type WorkspaceAllCompaniesQuery = Omit<WorkspaceCompanyQuery, 'page' | 'limit'>;
export type WorkspaceAllBranchesQuery = Omit<WorkspaceBranchQuery, 'page' | 'limit'>;
