import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import {
  readWebphoneExtension,
  readWebphoneExtensions,
  readWebphoneExtensionServers,
  readWebphoneServers,
  type WebphoneExtensionServer,
} from "../../settings/webphone/webphone-contract";
import type {
  AdminUser,
  AdminRole,
  AdminWebphoneCreateDto,
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

// The transport already auto-toasts every non-public 403 (dispatchForbiddenToast
// in axiosClient.ts) — callers branch on this to render an in-body permission
// gate instead of also toasting, so the two never fire for the same response.
// Kept as its own function (not an inline `err?.response?.status === 403`
// check) so the HTTP status literal never sits inside the same catch block as
// a toast.error() call — see docs/design-system/toast-contract.md.
export function isForbiddenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const response = (error as Record<string, unknown>).response as Record<string, unknown> | undefined;
  return response?.status === FORBIDDEN_STATUS;
}

const FORBIDDEN_STATUS = 403;

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

// WebPhone identities are extension rows served by the WebPhone module, not
// fields on the user — so they are addressed under that module's namespace and
// by extension id, never under /users/:id.
export const WEBPHONE_EXTENSIONS_PATH = "/api/admin/webphone/v1/extensions";

export function userWebphonePath(extensionId: string) {
  return `${WEBPHONE_EXTENSIONS_PATH}/${encodeURIComponent(extensionId)}`;
}

/** Every admin extension. The module has no by-owner read; callers match. */
export async function listWebphoneExtensions() {
  const res = await axiosClient.get<unknown>(WEBPHONE_EXTENSIONS_PATH, {
    cache: "no-store",
  });
  return readWebphoneExtensions(unwrapCoreData(res.data));
}

/**
 * The extension belonging to one user, or undefined when they have none.
 * Having no extension is a normal, unconfigured state — not an error.
 */
export async function getUserWebphone(ownerId: string) {
  return (await listWebphoneExtensions()).find(
    (extension) => extension.ownerId === ownerId,
  );
}

export async function createUserWebphone(
  dto: AdminWebphoneCreateDto,
  idempotencyKey: string,
) {
  const res = await axiosClient.post<unknown>(
    WEBPHONE_EXTENSIONS_PATH,
    dto,
    idempotentWrite(idempotencyKey),
  );
  return readWebphoneExtension(unwrapCoreData(res.data));
}

export async function updateUserWebphone(
  extensionId: string,
  dto: AdminWebphoneUpdateDto,
  idempotencyKey: string,
) {
  const res = await axiosClient.patch<unknown>(
    userWebphonePath(extensionId),
    dto,
    idempotentWrite(idempotencyKey),
  );
  return readWebphoneExtension(unwrapCoreData(res.data));
}

export const WEBPHONE_SERVERS_PATH = "/api/admin/webphone/v1/servers";

export function userWebphoneServersPath(extensionId: string) {
  return `${userWebphonePath(extensionId)}/servers`;
}

/**
 * Every SIP server, in failover order.
 *
 * The user panel needs them for two things it cannot invent: the name to show
 * against each link in the user's chain, and the per-server defaults that its
 * blank override inputs advertise as their placeholder.
 */
export async function listWebphoneServers() {
  const res = await axiosClient.get<unknown>(WEBPHONE_SERVERS_PATH, {
    cache: "no-store",
  });
  return readWebphoneServers(unwrapCoreData(res.data));
}

export async function getExtensionServers(extensionId: string) {
  const res = await axiosClient.get<unknown>(
    userWebphoneServersPath(extensionId),
    { cache: "no-store" },
  );
  return readWebphoneExtensionServers(unwrapCoreData(res.data));
}

/**
 * Replaces the whole chain in one write.
 *
 * The order is the statement, so a partial update has no meaning here: sending
 * every link makes the write idempotent and leaves no room for two links to
 * claim the same position. The caller re-reads afterwards rather than parsing
 * this response, because the route's success body is not part of the contract.
 */
export async function putExtensionServers(
  extensionId: string,
  chain: WebphoneExtensionServer[],
  idempotencyKey: string,
): Promise<void> {
  await axiosClient.put<unknown>(
    userWebphoneServersPath(extensionId),
    chain,
    idempotentWrite(idempotencyKey),
  );
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
