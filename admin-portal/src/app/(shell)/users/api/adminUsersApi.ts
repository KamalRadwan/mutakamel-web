import { axiosClient } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import type {
  AdminUser,
  AdminRole,
  AdminWebphoneConfig,
  AdminWebphoneUpdateDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  AssignRoleDto,
  AdminUserErrorCode,
} from "../types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  isSuperAdmin?: string;
  roleId?: string;
  sortBy?: string;
  sortDir?: string;
}

export interface ListRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  isSystem?: boolean;
  sortBy?: string;
  sortDir?: string;
}

export function normalizeErrorCode(error: unknown): AdminUserErrorCode | string | null {
  if (!error || typeof error !== "object") return null;
  const errObj = error as Record<string, unknown>;
  const response = errObj.response as Record<string, unknown> | undefined;
  const resData = response?.data as Record<string, unknown> | undefined;
  return (resData?.errorCode as string) ?? (resData?.code as string) ?? (errObj.errorCode as string) ?? (errObj.code as string) ?? null;
}

export async function listAdminUsers(params: ListUsersParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.search) query.append("search", params.search);
  if (params.status && params.status !== "ALL") query.append("status", params.status);
  if (params.isSuperAdmin && params.isSuperAdmin !== "ALL") {
    query.append("isSuperAdmin", params.isSuperAdmin === "TRUE" ? "true" : "false");
  }
  if (params.roleId && params.roleId !== "ALL") query.append("roleId", params.roleId);
  if (params.sortBy) query.append("sortBy", params.sortBy);
  if (params.sortDir) query.append("sortDir", params.sortDir);

  const res = await axiosClient.get<SuccessResponse<AdminUser[]>>(
    `/api/admin/core/v1/users?${query.toString()}`
  );
  return res.data;
}

export async function getAdminUser(id: string) {
  const res = await axiosClient.get<SuccessResponse<AdminUser>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}`
  );
  return res.data.data;
}

export async function inviteAdminUser(
  dto: CreateAdminUserDto,
  idempotencyKey: string,
) {
  const res = await axiosClient.post<SuccessResponse<AdminUser>>(
    "/api/admin/core/v1/users",
    dto,
    idempotentWrite(idempotencyKey),
  );
  return res.data.data;
}

export async function updateAdminUser(
  id: string,
  dto: UpdateAdminUserDto,
  idempotencyKey: string,
) {
  const res = await axiosClient.patch<SuccessResponse<AdminUser>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}`,
    dto,
    idempotentWrite(idempotencyKey),
  );
  return res.data.data;
}

export async function assignUserRole(
  id: string,
  dto: AssignRoleDto,
  idempotencyKey: string,
) {
  await axiosClient.patch(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}/roles`,
    dto,
    idempotentWrite(idempotencyKey),
  );
}

export async function suspendAdminUser(id: string, idempotencyKey: string) {
  const res = await axiosClient.post<SuccessResponse<AdminUser>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}/suspend`,
    {},
    idempotentWrite(idempotencyKey),
  );
  return res.data.data;
}

export async function activateAdminUser(id: string, idempotencyKey: string) {
  const res = await axiosClient.post<SuccessResponse<AdminUser>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}/activate`,
    {},
    idempotentWrite(idempotencyKey),
  );
  return res.data.data;
}

export async function deleteAdminUser(id: string, idempotencyKey: string) {
  await axiosClient.delete(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}`,
    idempotentWrite(idempotencyKey),
  );
}

export async function getUserWebphone(id: string) {
  const res = await axiosClient.get<SuccessResponse<AdminWebphoneConfig>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}/webphone`
  );
  return res.data.data;
}

export async function updateUserWebphone(
  id: string,
  dto: AdminWebphoneUpdateDto,
  idempotencyKey: string,
) {
  const res = await axiosClient.patch<SuccessResponse<AdminWebphoneConfig>>(
    `/api/admin/core/v1/users/${encodeURIComponent(id)}/webphone`,
    dto,
    idempotentWrite(idempotencyKey),
  );
  return res.data.data;
}

export async function listRoles(params: ListRolesParams = {}) {
  const query = new URLSearchParams();
  query.append("page", (params.page || 1).toString());
  query.append("limit", (params.limit || 100).toString());
  query.append("sortBy", params.sortBy || "name");
  query.append("sortDir", params.sortDir || "ASC");
  if (params.search) query.append("search", params.search);
  if (params.isSystem !== undefined) query.append("isSystem", params.isSystem ? "true" : "false");

  const res = await axiosClient.get<SuccessResponse<AdminRole[]>>(
    `/api/admin/core/v1/roles?${query.toString()}`
  );
  return res.data;
}

function idempotentWrite(idempotencyKey: string) {
  if (!UUID_V7_PATTERN.test(idempotencyKey)) {
    throw new TypeError("INVALID_IDEMPOTENCY_KEY");
  }
  return {
    headers: { "x-idempotency-key": idempotencyKey },
    skipAutoIdempotency: true,
    replayAfterRefresh: true,
    cache: "no-store" as const,
  };
}
