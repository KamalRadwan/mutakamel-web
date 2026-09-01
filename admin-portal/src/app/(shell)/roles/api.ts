import { axiosClient } from "@/lib/api/axiosClient";
import {
  isUuidV7,
  readPermissionCatalogue,
  readRole,
  readRolesPage,
  validateCreateRoleCommand,
  validateReplacePermissionsCommand,
  validateUpdateRoleCommand,
  type CreateRoleCommand,
  type ReplaceRolePermissionsCommand,
  type UpdateRoleCommand,
} from "./contract";

const ADMIN_ROLES_URL = "/api/admin/core/v1/roles";
const ADMIN_PERMISSIONS_URL = "/api/admin/core/v1/permissions";

/** The only sort fields `GET /admin/roles` accepts; anything else is a 400. */
export const ROLE_SORT_FIELDS = ["name", "createdAt"] as const;
export type RoleSortField = (typeof ROLE_SORT_FIELDS)[number];

export interface RoleListQuery {
  page: number;
  limit: number;
  isSystem?: boolean;
  sortBy?: RoleSortField;
  sortDir?: "ASC" | "DESC";
}

export const rolesApi = {
  list: async (query: RoleListQuery, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${ADMIN_ROLES_URL}${serializeRoleListQuery(query)}`,
      readConfig(signal),
    );
    return readRolesPage(response.data);
  },

  get: async (roleId: string, signal?: AbortSignal) => {
    requireUuidV7(roleId, "INVALID_ROLE_ID");
    const response = await axiosClient.get<unknown>(
      `${ADMIN_ROLES_URL}/${encodeURIComponent(roleId)}`,
      readConfig(signal),
    );
    return readRole(response.data);
  },

  permissions: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      ADMIN_PERMISSIONS_URL,
      readConfig(signal),
    );
    return readPermissionCatalogue(response.data);
  },

  create: async (command: CreateRoleCommand, idempotencyKey: string) => {
    validateCreateRoleCommand(command);
    const response = await axiosClient.post<unknown>(
      ADMIN_ROLES_URL,
      command,
      writeConfig(idempotencyKey),
    );
    return readRole(response.data);
  },

  update: async (
    roleId: string,
    command: UpdateRoleCommand,
    idempotencyKey: string,
  ) => {
    requireUuidV7(roleId, "INVALID_ROLE_ID");
    validateUpdateRoleCommand(command);
    const response = await axiosClient.patch<unknown>(
      `${ADMIN_ROLES_URL}/${encodeURIComponent(roleId)}`,
      command,
      writeConfig(idempotencyKey),
    );
    return readRole(response.data);
  },

  replacePermissions: async (
    roleId: string,
    command: ReplaceRolePermissionsCommand,
    idempotencyKey: string,
  ) => {
    requireUuidV7(roleId, "INVALID_ROLE_ID");
    validateReplacePermissionsCommand(command);
    const response = await axiosClient.patch<unknown>(
      `${ADMIN_ROLES_URL}/${encodeURIComponent(roleId)}/permissions`,
      command,
      writeConfig(idempotencyKey),
    );
    return readRole(response.data);
  },

  remove: async (roleId: string, idempotencyKey: string) => {
    requireUuidV7(roleId, "INVALID_ROLE_ID");
    await axiosClient.delete(
      `${ADMIN_ROLES_URL}/${encodeURIComponent(roleId)}`,
      writeConfig(idempotencyKey),
    );
  },
};

export function serializeRoleListQuery(query: RoleListQuery): string {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    (query.isSystem !== undefined && typeof query.isSystem !== "boolean") ||
    (query.sortBy !== undefined && !ROLE_SORT_FIELDS.includes(query.sortBy)) ||
    (query.sortDir !== undefined && query.sortDir !== "ASC" && query.sortDir !== "DESC")
  ) {
    throw new TypeError("INVALID_ROLE_LIST_QUERY");
  }
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    sortBy: query.sortBy ?? "createdAt",
    sortDir: query.sortDir ?? "DESC",
  });
  if (query.isSystem !== undefined) {
    params.set("isSystem", query.isSystem ? "true" : "false");
  }
  return `?${params.toString()}`;
}

function readConfig(signal?: AbortSignal) {
  return { cache: "no-store" as const, ...(signal ? { signal } : {}) };
}

function writeConfig(idempotencyKey: string) {
  requireUuidV7(idempotencyKey, "INVALID_IDEMPOTENCY_KEY");
  return {
    headers: { "x-idempotency-key": idempotencyKey },
    skipAutoIdempotency: true,
    replayAfterRefresh: true,
    cache: "no-store" as const,
  };
}

function requireUuidV7(value: string, message: string): void {
  if (!isUuidV7(value)) throw new TypeError(message);
}
