import type {
  BranchOption,
  OrganizationOption,
  PageResult,
  RoleOption,
  TenantUserSummary,
  TenantUserView,
} from "../types";

export const TENANT_ID = "019ff251-02e5-71fc-a7e9-05495cb3c6a8";
export const USER_ID = "019ff251-1000-7000-8000-000000000001";
export const OWNER_ID = "019ff251-1000-7000-8000-000000000002";
export const COMPANY_ID = "019ff251-2000-7000-8000-000000000001";
export const BRANCH_ID = "019ff251-2000-7000-8000-000000000002";
export const DEPARTMENT_ID = "019ff251-2000-7000-8000-000000000003";
export const TEAM_ID = "019ff251-2000-7000-8000-000000000004";
export const ROLE_ID = "019ff251-3000-7000-8000-000000000001";
export const ASSIGNMENT_ID = "019ff251-3000-7000-8000-000000000002";
export const COMMAND_ID = "019ff251-4000-7000-8000-000000000001";
export const NOW = "2026-08-11T19:33:49.000Z";

export function userPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: USER_ID,
    email: "mona@example.test",
    firstName: "Mona",
    lastName: "Ali",
    employeeCode: "E-10",
    jobTitle: "Accountant",
    status: "ACTIVE",
    isTenantOwner: false,
    organization: {
      company: { id: COMPANY_ID, code: "ACME", name: "Acme" },
      branch: { id: BRANCH_ID, code: "CAI", name: "Cairo" },
      department: { id: DEPARTMENT_ID, code: "FIN", name: "Finance" },
      team: { id: TEAM_ID, code: "AR", name: "Receivables" },
    },
    manager: null,
    roleAssignments: [
      {
        assignmentId: ASSIGNMENT_ID,
        roleId: ROLE_ID,
        roleName: "Finance",
        scope: "BRANCH",
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
      },
    ],
    webphone: {
      enabled: true,
      extension: "1001",
      sipUsername: "1001",
      displayName: "Mona Ali",
      outboundCallerId: "+201000000000",
      transport: "wss",
      passwordConfigured: true,
    },
    lastLoginAt: NOW,
    lockedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

export function userFixture(overrides: Partial<TenantUserView> = {}): TenantUserView {
  return { ...(userPayload() as unknown as TenantUserView), ...overrides };
}

export const summaryFixture: TenantUserSummary = {
  total: 9,
  invited: 1,
  active: 5,
  suspended: 1,
  deactivated: 1,
  deleted: 1,
  owners: 1,
  webphoneEnabled: 2,
  locked: 0,
};

export const roleFixture: RoleOption = {
  id: ROLE_ID,
  name: "Finance",
  description: "Finance access",
  isSystem: false,
};

export const branchFixture: BranchOption = {
  id: BRANCH_ID,
  code: "CAI",
  name: "Cairo",
  company: { id: COMPANY_ID, code: "ACME", name: "Acme" },
};

export const departmentFixture: OrganizationOption = {
  id: DEPARTMENT_ID,
  code: "FIN",
  name: "Finance",
};

export const teamFixture: OrganizationOption = {
  id: TEAM_ID,
  code: "AR",
  name: "Receivables",
};

export function pageFixture<T>(items: T[], overrides: Partial<PageResult<T>> = {}): PageResult<T> {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrev: false,
    ...overrides,
  };
}

export const envelope = (data: unknown) => ({ data: { success: true, data } });
