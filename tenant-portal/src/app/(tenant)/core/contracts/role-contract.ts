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
  nullableText,
  parseCorePage,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
  type CorePage,
} from "./core-page";

const ROLES_PATH = "/api/tenant/core/v1/roles";
const PERMISSIONS_PATH = "/api/tenant/core/v1/permissions";

export const ROLE_NAME_MAX_LENGTH = 120;
export const ROLE_DESCRIPTION_MAX_LENGTH = 2000;
/** `SetRolePermissionsDto` — MAX_TENANT_ROLE_PERMISSIONS. A 201st is a 400. */
export const MAX_ROLE_PERMISSIONS = 200;
const PERMISSION_KEY_MAX_LENGTH = 160;
const PERMISSION_LABEL_MAX_LENGTH = 500;



/** `LocalizedText` as the permission and role catalogues return it. */
interface LocalizedText {
  ar: string;
  en: string;
}

export interface TenantRole {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantRoleDetail extends TenantRole {
  permissionIds: string[];
}

export interface TenantPermission {
  id: string;
  key: string;
  group: string;
  nameAr: string;
  nameEn: string;
  groupNameAr: string;
  groupNameEn: string;
}

function parseLocalizedText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): LocalizedText | null {
  const value = record(source[key]);
  if (!value) return null;
  return {
    ar: requiredText(value, "ar", maxLength),
    en: requiredText(value, "en", maxLength),
  };
}

function parseRoleFields(payload: unknown): { source: Record<string, unknown> } & TenantRole {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const name = requiredText(source, "name", ROLE_NAME_MAX_LENGTH);
  const nameI18n = parseLocalizedText(source, "nameI18n", ROLE_NAME_MAX_LENGTH);
  const descriptionI18n = parseLocalizedText(
    source,
    "descriptionI18n",
    ROLE_DESCRIPTION_MAX_LENGTH,
  );
  return {
    source,
    id: requiredUuidV7(source, "id"),
    name,
    // The catalogue localizes the seeded system roles and falls back to the
    // stored name for a tenant-authored one, so a missing i18n block is the
    // name itself rather than a broken response.
    nameAr: nameI18n?.ar ?? name,
    nameEn: nameI18n?.en ?? name,
    descriptionAr: descriptionI18n?.ar ?? nullableText(source, "description", ROLE_DESCRIPTION_MAX_LENGTH),
    descriptionEn: descriptionI18n?.en ?? nullableText(source, "description", ROLE_DESCRIPTION_MAX_LENGTH),
    isSystem: requiredBoolean(source, "isSystem"),
    createdAt: requiredTimestamp(source, "createdAt"),
    updatedAt: requiredTimestamp(source, "updatedAt"),
  };
}

function parseTenantRole(payload: unknown): TenantRole {
  const { source, ...role } = parseRoleFields(payload);
  void source;
  return role;
}

export function parseTenantRoleDetail(payload: unknown): TenantRoleDetail {
  const { source, ...role } = parseRoleFields(payload);
  const permissionIds = source.permissionIds;
  if (!Array.isArray(permissionIds) || permissionIds.length > MAX_ROLE_PERMISSIONS) {
    invalidCoreResponse();
  }
  if (!permissionIds.every((value) => isUUIDv7(value))) invalidCoreResponse();
  if (new Set(permissionIds).size !== permissionIds.length) invalidCoreResponse();
  return { ...role, permissionIds: permissionIds as string[] };
}

export function parseTenantPermission(payload: unknown): TenantPermission {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const descriptionI18n = parseLocalizedText(
    source,
    "descriptionI18n",
    PERMISSION_LABEL_MAX_LENGTH,
  );
  const groupI18n = parseLocalizedText(source, "groupI18n", PERMISSION_LABEL_MAX_LENGTH);
  if (!descriptionI18n || !groupI18n) invalidCoreResponse();
  const group = requiredText(source, "group", PERMISSION_KEY_MAX_LENGTH);
  return {
    id: requiredUuidV7(source, "id"),
    key: requiredText(source, "key", PERMISSION_KEY_MAX_LENGTH),
    group,
    nameAr: descriptionI18n.ar,
    nameEn: descriptionI18n.en,
    groupNameAr: groupI18n.ar,
    groupNameEn: groupI18n.en,
  };
}

function rolePath(id: string, suffix = ""): CorePath {
  if (!isUUIDv7(id)) invalidCoreResponse();
  return `${ROLES_PATH}/${encodeURIComponent(id)}${suffix}`;
}

export async function fetchTenantRoles(options: {
  page: number;
  search: string;
  isSystem?: boolean;
  signal?: AbortSignal;
}): Promise<CorePage<TenantRole>> {
  const query = buildCoreListQuery({
    page: options.page,
    search: options.search,
    sortBy: "name",
    filters: {
      isSystem: options.isSystem === undefined ? undefined : String(options.isSystem),
    },
  });
  const envelope = await readCorePage(ROLES_PATH, query, {
    signal: options.signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCorePage(envelope, parseTenantRole);
}

export async function fetchTenantRole(
  id: string,
  signal?: AbortSignal,
): Promise<TenantRoleDetail> {
  return parseTenantRoleDetail(
    await readCoreData(rolePath(id), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function createTenantRole(body: {
  name: string;
  description?: string;
}): Promise<TenantRoleDetail> {
  return parseTenantRoleDetail(
    await writeCoreData("post", ROLES_PATH, body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function updateTenantRole(
  id: string,
  body: { name?: string; description?: string },
): Promise<TenantRoleDetail> {
  return parseTenantRoleDetail(
    await writeCoreData("patch", rolePath(id), body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

/**
 * Replaces the role's whole permission set and bumps `authorizationVersion` for
 * every holder in the same transaction — the change is live for all of them on
 * their next request, not after a re-login.
 */
export async function setRolePermissions(
  id: string,
  permissionIds: string[],
): Promise<TenantRoleDetail> {
  if (permissionIds.length > MAX_ROLE_PERMISSIONS) invalidCoreResponse();
  return parseTenantRoleDetail(
    await writeCoreData("put", rolePath(id, "/permissions"), { permissionIds }, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
      replayAfterRefresh: true,
    }),
  );
}

export async function deleteTenantRole(id: string): Promise<void> {
  await writeCoreData("delete", rolePath(id), undefined, {
    cache: "no-store",
    maxResponseBytes: 10_000,
    nonReplayable: true,
  });
}

/** The catalogue, with the labels the backend already localized. */
export async function fetchPermissionCatalogue(
  page: number,
  signal?: AbortSignal,
): Promise<CorePage<TenantPermission>> {
  const query = buildCoreListQuery({ page, search: "", sortBy: "group" });
  const envelope = await readCorePage(PERMISSIONS_PATH, query, {
    signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCorePage(envelope, parseTenantPermission);
}
