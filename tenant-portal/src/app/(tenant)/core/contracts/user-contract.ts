import {
  readCoreData,
  readCorePage,
  writeCoreData,
  type CorePath,
} from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildCoreListQuery,
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  parseCorePage,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
  type CorePage,
} from "./core-page";

export const USERS_PATH = "/api/tenant/core/v1/users";

/** `UserStatusEnum` — core-app/packages/common/src/enums/user-status.enum.ts. */
export const USER_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];


export const USER_EMAIL_MAX_LENGTH = 255;
export const USER_NAME_MAX_LENGTH = 80;
export const USER_EMPLOYEE_CODE_MAX_LENGTH = 32;
export const USER_JOB_TITLE_MAX_LENGTH = 120;

export const USER_LIMIT_REACHED_CODE = "USER_LIMIT_REACHED";

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
  isTenantOwner: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InviteUserInput {
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId?: string;
  managerId?: string;
  employeeCode?: string;
  jobTitle?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  managerId?: string;
  jobTitle?: string;
}

export interface TenantUserFilters {
  status?: UserStatus;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
}

export function parseTenantUser(payload: unknown): TenantUser {
  const source = record(payload);
  if (!source || !isMember(USER_STATUSES, source.status)) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    email: requiredText(source, "email", USER_EMAIL_MAX_LENGTH),
    firstName: requiredText(source, "firstName", USER_NAME_MAX_LENGTH),
    lastName: requiredText(source, "lastName", USER_NAME_MAX_LENGTH),
    employeeCode: nullableText(source, "employeeCode", USER_EMPLOYEE_CODE_MAX_LENGTH),
    companyId: requiredUuidV7(source, "companyId"),
    branchId: requiredUuidV7(source, "branchId"),
    departmentId: requiredUuidV7(source, "departmentId"),
    teamId: nullableUuidV7(source, "teamId"),
    managerId: nullableUuidV7(source, "managerId"),
    jobTitle: nullableText(source, "jobTitle", USER_JOB_TITLE_MAX_LENGTH),
    isTenantOwner: requiredBoolean(source, "isTenantOwner"),
    status: source.status,
    createdAt: requiredTimestamp(source, "createdAt"),
    updatedAt: requiredTimestamp(source, "updatedAt"),
  };
}

export function userPath(id: string, suffix = ""): CorePath {
  if (!isUUIDv7(id)) invalidCoreResponse();
  return `${USERS_PATH}/${encodeURIComponent(id)}${suffix}`;
}

export async function fetchTenantUsers(options: {
  page: number;
  search: string;
  filters: TenantUserFilters;
  signal?: AbortSignal;
}): Promise<CorePage<TenantUser>> {
  const query = buildCoreListQuery({
    page: options.page,
    search: options.search,
    sortBy: "createdAt",
    sortDir: "DESC",
    filters: { ...options.filters },
  });
  const envelope = await readCorePage(USERS_PATH, query, {
    signal: options.signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCorePage(envelope, parseTenantUser);
}

export async function fetchTenantUser(
  id: string,
  signal?: AbortSignal,
): Promise<TenantUser> {
  return parseTenantUser(
    await readCoreData(userPath(id), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function inviteTenantUser(body: InviteUserInput): Promise<TenantUser> {
  return parseTenantUser(
    await writeCoreData("post", USERS_PATH, body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function updateTenantUser(
  id: string,
  body: UpdateUserInput,
): Promise<TenantUser> {
  return parseTenantUser(
    await writeCoreData("patch", userPath(id), body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

/**
 * Suspend and activate both advance the user's security epoch, so every token
 * that user holds goes stale the moment either succeeds. Activate is not an
 * undo — it re-admits them with fresh credentials required.
 */
export async function setTenantUserStatus(
  id: string,
  action: "suspend" | "activate",
): Promise<TenantUser> {
  return parseTenantUser(
    await writeCoreData("post", userPath(id, `/${action}`), undefined, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function deleteTenantUser(id: string): Promise<void> {
  await writeCoreData("delete", userPath(id), undefined, {
    cache: "no-store",
    maxResponseBytes: 10_000,
    nonReplayable: true,
  });
}

export function userDisplayName(user: {
  firstName: string;
  lastName: string;
}): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
