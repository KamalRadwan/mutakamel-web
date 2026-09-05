import { axiosClient } from "@/lib/api/axiosClient";
import {
  readBranchPage,
  readOrganizationPage,
  readRolePage,
  readTenantUserDelivery,
  readTenantUserInvitation,
  readTenantUserPage,
  readTenantUserSummary,
  readTenantUserView,
} from "./readers";
import type {
  CatalogueQuery,
  ChangeTenantUserPasswordInput,
  DepartmentCatalogueQuery,
  InviteTenantUserInput,
  ReplaceTenantUserRolesInput,
  TeamCatalogueQuery,
  TenantUserListQuery,
  TenantUserSummaryQuery,
  UpdateTenantUserInput,
} from "./types";

const BASE_URL = "/api/admin/core/v1/tenants";
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QueryValue = string | number | undefined;

function tenantUrl(tenantId: string): string {
  return `${BASE_URL}/${encodeURIComponent(tenantId)}`;
}

function userUrl(tenantId: string, userId: string): string {
  return `${tenantUrl(tenantId)}/users/${encodeURIComponent(userId)}`;
}

function queryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

function listQuery(query: TenantUserListQuery): Record<string, QueryValue> {
  return {
    page: query.page,
    limit: query.limit,
    q: query.q?.trim() || undefined,
    status: query.status,
    role: query.role,
    companyId: query.companyId,
    branchId: query.branchId,
    departmentId: query.departmentId,
    teamId: query.teamId,
    visibility: query.visibility,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
}

function summaryQuery(query: TenantUserSummaryQuery): Record<string, QueryValue> {
  return {
    q: query.q?.trim() || undefined,
    status: query.status,
    role: query.role,
    companyId: query.companyId,
    branchId: query.branchId,
    departmentId: query.departmentId,
    teamId: query.teamId,
    visibility: query.visibility,
  };
}

function catalogueQuery(query: CatalogueQuery): Record<string, QueryValue> {
  return {
    q: query.q?.trim() || undefined,
    page: query.page,
    limit: query.limit,
  };
}

function writeConfig(
  idempotencyKey: string,
  language?: "ar" | "en",
) {
  if (!UUID_V7_PATTERN.test(idempotencyKey)) {
    throw new Error("INVALID_TENANT_ACCESS_IDEMPOTENCY_KEY");
  }
  return {
    headers: {
      "x-idempotency-key": idempotencyKey,
      ...(language ? { "accept-language": language } : {}),
    },
  };
}

export function toTenantUserSummaryQuery(
  query: TenantUserListQuery,
): TenantUserSummaryQuery {
  return {
    q: query.q,
    status: query.status,
    role: query.role,
    companyId: query.companyId,
    branchId: query.branchId,
    departmentId: query.departmentId,
    teamId: query.teamId,
    visibility: query.visibility,
  };
}

export const tenantAccessApi = {
  listUsers: async (tenantId: string, query: TenantUserListQuery, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/users${queryString(listQuery(query))}`,
      { signal },
    );
    return readTenantUserPage(response.data);
  },

  summarizeUsers: async (
    tenantId: string,
    query: TenantUserSummaryQuery,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/users/summary${queryString(summaryQuery(query))}`,
      { signal },
    );
    return readTenantUserSummary(response.data);
  },

  listRoles: async (tenantId: string, query: CatalogueQuery = {}, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/access/roles${queryString(catalogueQuery(query))}`,
      { signal },
    );
    return readRolePage(response.data);
  },

  listBranches: async (
    tenantId: string,
    query: CatalogueQuery = {},
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/access/branches${queryString(catalogueQuery(query))}`,
      { signal },
    );
    return readBranchPage(response.data);
  },

  listDepartments: async (
    tenantId: string,
    query: DepartmentCatalogueQuery,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/access/departments${queryString({
        branchId: query.branchId,
        ...catalogueQuery(query),
      })}`,
      { signal },
    );
    return readOrganizationPage(response.data);
  },

  listTeams: async (
    tenantId: string,
    query: TeamCatalogueQuery,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantUrl(tenantId)}/access/teams${queryString({
        departmentId: query.departmentId,
        ...catalogueQuery(query),
      })}`,
      { signal },
    );
    return readOrganizationPage(response.data);
  },

  getUser: async (tenantId: string, userId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(userUrl(tenantId, userId), {
      signal,
    });
    return readTenantUserView(response.data);
  },

  inviteUser: async (
    tenantId: string,
    input: InviteTenantUserInput,
    idempotencyKey: string,
    language?: "ar" | "en",
  ) => {
    const response = await axiosClient.post<unknown>(
      `${tenantUrl(tenantId)}/users`,
      input,
      writeConfig(idempotencyKey, language),
    );
    return readTenantUserInvitation(response.data);
  },

  updateUser: async (
    tenantId: string,
    userId: string,
    input: UpdateTenantUserInput,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.patch<unknown>(
      userUrl(tenantId, userId),
      input,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  resetPassword: async (
    tenantId: string,
    userId: string,
    idempotencyKey: string,
    language?: "ar" | "en",
  ) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/reset-password`,
      undefined,
      writeConfig(idempotencyKey, language),
    );
    return readTenantUserDelivery(response.data);
  },

  transferOwnership: async (
    tenantId: string,
    userId: string,
    newOwnerUserId: string,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/transfer-ownership`,
      { newOwnerUserId },
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  resendInvite: async (
    tenantId: string,
    userId: string,
    idempotencyKey: string,
    language?: "ar" | "en",
  ) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/resend-invite`,
      undefined,
      writeConfig(idempotencyKey, language),
    );
    return readTenantUserDelivery(response.data);
  },

  changePassword: async (
    tenantId: string,
    userId: string,
    input: ChangeTenantUserPasswordInput,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/change-password`,
      input,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  suspendUser: async (tenantId: string, userId: string, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/suspend`,
      undefined,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  activateUser: async (tenantId: string, userId: string, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/activate`,
      undefined,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  replaceRoles: async (
    tenantId: string,
    userId: string,
    input: ReplaceTenantUserRolesInput,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.patch<unknown>(
      `${userUrl(tenantId, userId)}/roles`,
      input,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },

  deleteUser: async (tenantId: string, userId: string, idempotencyKey: string) => {
    await axiosClient.delete(
      userUrl(tenantId, userId),
      writeConfig(idempotencyKey),
    );
  },

  restoreUser: async (tenantId: string, userId: string, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${userUrl(tenantId, userId)}/restore`,
      undefined,
      writeConfig(idempotencyKey),
    );
    return readTenantUserView(response.data);
  },
};
