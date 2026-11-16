import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  invalidCoreResponse,
  isMember,
  record,
  requiredBoolean,
  requiredText,
  requiredUuidV7,
} from "../../contracts/core-page";
import { ORG_NAME_MAX_LENGTH } from "../../contracts/organization-contract";
import {
  MAX_ROLE_PERMISSIONS,
  MAX_SYSTEM_ROLE_PERMISSIONS,
  PERMISSION_KEY_MAX_LENGTH,
  PERMISSION_LABEL_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  ROLE_PERMISSION_MODES,
  rolePath,
  type RolePermissionMode,
} from "../../contracts/role-contract";

/** `IMPLEMENTATION.md`: max 100 unique branches per custom role. */
export const MAX_ROLE_BRANCH_PROFILES = 100;
/** `IMPLEMENTATION.md`: max 200 unique permissions per branch profile. */
export const MAX_PERMISSIONS_PER_BRANCH = 200;

const MAX_CATALOGUE_ITEMS = 2_000;
const MAX_TAXONOMY_GROUPS = 8;
const MAX_REVISION_LENGTH = 32;
const CATALOGUE_REVISION_PATTERN = /^[0-9a-f]{64}$/;
// 100 profiles × 200 IDs plus the bounded 2,000-entry bilingual catalogue.
// This aggregate can exceed the shared one-megabyte list-page limit.
const ROLE_BRANCH_DOCUMENT_LIMIT_BYTES = 4_000_000;
const NON_NEGATIVE_INTEGER_STRING = /^(?:0|[1-9]\d*)$/;

type RoleCatalogueScope = "BRANCH" | "TENANT";

export const ROLE_RECORD_SCOPES = ["OWN", "TEAM", "ALL"] as const;
export type RoleRecordScope = (typeof ROLE_RECORD_SCOPES)[number];

interface RoleBranchTaxonomyNode {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface RoleBranchCatalogueItem {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  module: RoleBranchTaxonomyNode;
  groups: RoleBranchTaxonomyNode[];
  /** Unknown or unclassified eligibility fails closed to TENANT (locked in branch editor). */
  scope: RoleCatalogueScope;
  recordScope: RoleRecordScope | null;
}

export interface RoleBranchProfile {
  branchId: string;
  companyId: string;
  branchName: string;
  companyName: string;
  isActive: boolean;
  permissionIds: string[];
}

export interface RoleBranchLimits {
  branches: number;
  permissionsPerBranch: number;
}

export interface RoleBranchPermissionsDocument {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  permissionMode: RolePermissionMode;
  /** Persisted integer serialized as decimal string; never coerce via Number(). */
  revision: string;
  catalogueRevision: string;
  globalPermissionIds: string[];
  profiles: RoleBranchProfile[];
  catalogue: RoleBranchCatalogueItem[];
  limits: RoleBranchLimits;
}

export interface SaveRoleBranchProfileInput {
  branchId: string;
  permissionIds: string[];
}

export interface SaveRoleBranchPermissionsBody {
  expectedRevision: string;
  catalogueRevision: string;
  profiles: SaveRoleBranchProfileInput[];
}

function parseLocalizedLabel(source: Record<string, unknown>, key: string) {
  const value = record(source[key]);
  if (!value) invalidCoreResponse();
  return {
    ar: requiredText(value, "ar", PERMISSION_LABEL_MAX_LENGTH),
    en: requiredText(value, "en", PERMISSION_LABEL_MAX_LENGTH),
  };
}

function parseTaxonomyNode(payload: unknown): RoleBranchTaxonomyNode {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const nameI18n = parseLocalizedLabel(source, "nameI18n");
  return {
    id: requiredText(source, "id", PERMISSION_KEY_MAX_LENGTH),
    nameAr: nameI18n.ar,
    nameEn: nameI18n.en,
  };
}

function parseUniqueUuidList(payload: unknown, maxItems: number): string[] {
  if (!Array.isArray(payload) || payload.length > maxItems) invalidCoreResponse();
  if (!payload.every((value) => isUUIDv7(value))) invalidCoreResponse();
  if (new Set(payload).size !== payload.length) invalidCoreResponse();
  return payload as string[];
}

function parseCatalogueScope(value: unknown): RoleCatalogueScope {
  if (value === "BRANCH") return "BRANCH";
  if (value === undefined || value === null || typeof value === "string") return "TENANT";
  invalidCoreResponse();
}

function parseRecordScope(value: unknown): RoleRecordScope | null {
  if (value === null || value === undefined) return null;
  if (isMember(ROLE_RECORD_SCOPES, value)) return value;
  invalidCoreResponse();
}

export function parseRoleBranchCatalogueItem(payload: unknown): RoleBranchCatalogueItem {
  const source = record(payload);
  if (!source || !Array.isArray(source.groups) || source.groups.length > MAX_TAXONOMY_GROUPS) {
    invalidCoreResponse();
  }
  const nameI18n = parseLocalizedLabel(source, "nameI18n");
  return {
    id: requiredUuidV7(source, "id"),
    key: requiredText(source, "key", PERMISSION_KEY_MAX_LENGTH),
    nameAr: nameI18n.ar,
    nameEn: nameI18n.en,
    module: parseTaxonomyNode(source.module),
    groups: source.groups.map(parseTaxonomyNode),
    scope: parseCatalogueScope(source.scope),
    recordScope: parseRecordScope(source.recordScope),
  };
}

function parseRoleBranchLimits(payload: unknown): RoleBranchLimits {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const { branches, permissionsPerBranch } = source;
  if (
    !Number.isSafeInteger(branches) ||
    (branches as number) < 1 ||
    (branches as number) > MAX_ROLE_BRANCH_PROFILES ||
    !Number.isSafeInteger(permissionsPerBranch) ||
    (permissionsPerBranch as number) < 1 ||
    (permissionsPerBranch as number) > MAX_PERMISSIONS_PER_BRANCH
  ) {
    invalidCoreResponse();
  }
  return { branches: branches as number, permissionsPerBranch: permissionsPerBranch as number };
}

function parseRoleBranchProfile(payload: unknown, maxPermissions: number): RoleBranchProfile {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  return {
    branchId: requiredUuidV7(source, "branchId"),
    companyId: requiredUuidV7(source, "companyId"),
    branchName: requiredText(source, "branchName", ORG_NAME_MAX_LENGTH),
    companyName: requiredText(source, "companyName", ORG_NAME_MAX_LENGTH),
    isActive: requiredBoolean(source, "isActive"),
    permissionIds: parseUniqueUuidList(source.permissionIds, maxPermissions),
  };
}

export function parseRoleBranchPermissions(
  payload: unknown,
  expectedRoleId?: string,
): RoleBranchPermissionsDocument {
  const source = record(payload);
  if (!source || !isMember(ROLE_PERMISSION_MODES, source.permissionMode)) invalidCoreResponse();
  const roleId = requiredUuidV7(source, "roleId");
  if (expectedRoleId !== undefined && roleId !== expectedRoleId) invalidCoreResponse();

  const isSystem = requiredBoolean(source, "isSystem");
  if (isSystem && source.permissionMode !== "GLOBAL") invalidCoreResponse();

  const revision = requiredText(source, "revision", MAX_REVISION_LENGTH);
  if (!NON_NEGATIVE_INTEGER_STRING.test(revision)) invalidCoreResponse();
  const catalogueRevision = requiredText(source, "catalogueRevision", 64);
  if (!CATALOGUE_REVISION_PATTERN.test(catalogueRevision)) invalidCoreResponse();

  const limits = parseRoleBranchLimits(source.limits);
  const globalLimit = isSystem ? MAX_SYSTEM_ROLE_PERMISSIONS : MAX_ROLE_PERMISSIONS;
  const profileLimit = isSystem ? MAX_SYSTEM_ROLE_PERMISSIONS : limits.branches;
  const perBranchLimit = isSystem ? MAX_SYSTEM_ROLE_PERMISSIONS : limits.permissionsPerBranch;

  if (!Array.isArray(source.catalogue) || source.catalogue.length > MAX_CATALOGUE_ITEMS) {
    invalidCoreResponse();
  }
  const catalogue = source.catalogue.map(parseRoleBranchCatalogueItem);
  if (
    new Set(catalogue.map((item) => item.id)).size !== catalogue.length ||
    new Set(catalogue.map((item) => item.key)).size !== catalogue.length
  ) {
    invalidCoreResponse();
  }

  if (!Array.isArray(source.profiles) || source.profiles.length > profileLimit) {
    invalidCoreResponse();
  }
  const profiles = source.profiles.map((entry) => parseRoleBranchProfile(entry, perBranchLimit));
  if (new Set(profiles.map((profile) => profile.branchId)).size !== profiles.length) {
    invalidCoreResponse();
  }

  return {
    roleId,
    roleName: requiredText(source, "roleName", ROLE_NAME_MAX_LENGTH),
    isSystem,
    permissionMode: source.permissionMode,
    revision,
    catalogueRevision,
    globalPermissionIds: parseUniqueUuidList(source.globalPermissionIds, globalLimit),
    profiles,
    catalogue,
    limits,
  };
}

/** Assembles the exact whitelisted `PUT /roles/:id/branch-permissions` payload. */
export function buildSaveRoleBranchPermissionsBody(
  input: SaveRoleBranchPermissionsBody,
  options?: { limits?: RoleBranchLimits; branchCatalogueIds?: ReadonlySet<string> },
): SaveRoleBranchPermissionsBody {
  const maxBranches = options?.limits?.branches ?? MAX_ROLE_BRANCH_PROFILES;
  const maxPerBranch = options?.limits?.permissionsPerBranch ?? MAX_PERMISSIONS_PER_BRANCH;
  if (
    !NON_NEGATIVE_INTEGER_STRING.test(input.expectedRevision) ||
    input.expectedRevision.length > MAX_REVISION_LENGTH ||
    !CATALOGUE_REVISION_PATTERN.test(input.catalogueRevision) ||
    !Array.isArray(input.profiles) ||
    input.profiles.length > maxBranches
  ) {
    invalidCoreResponse();
  }

  const seenBranches = new Set<string>();
  const profiles: SaveRoleBranchProfileInput[] = input.profiles.map((profile) => {
    if (!isUUIDv7(profile.branchId) || seenBranches.has(profile.branchId)) invalidCoreResponse();
    seenBranches.add(profile.branchId);
    const permissionIds = parseUniqueUuidList(profile.permissionIds, maxPerBranch);
    if (
      options?.branchCatalogueIds &&
      permissionIds.some((id) => !options.branchCatalogueIds?.has(id))
    ) {
      invalidCoreResponse();
    }
    return { branchId: profile.branchId, permissionIds: [...permissionIds] };
  });

  return {
    expectedRevision: input.expectedRevision,
    catalogueRevision: input.catalogueRevision,
    profiles,
  };
}

export async function fetchRoleBranchPermissions(
  id: string,
  signal?: AbortSignal,
): Promise<RoleBranchPermissionsDocument> {
  const data = await readCoreData(rolePath(id, "/branch-permissions"), {
    signal,
    cache: "no-store",
    suppressForbiddenToast: true,
    maxResponseBytes: ROLE_BRANCH_DOCUMENT_LIMIT_BYTES,
  });
  return parseRoleBranchPermissions(data, id);
}

export async function saveRoleBranchPermissions(
  id: string,
  body: SaveRoleBranchPermissionsBody,
  options?: { limits?: RoleBranchLimits; branchCatalogueIds?: ReadonlySet<string> },
): Promise<RoleBranchPermissionsDocument> {
  const validated = buildSaveRoleBranchPermissionsBody(body, options);
  const data = await writeCoreData("put", rolePath(id, "/branch-permissions"), validated, {
    cache: "no-store",
    suppressForbiddenToast: true,
    // Uncertain writes re-read authoritative state rather than auto-replaying.
    nonReplayable: true,
    maxResponseBytes: ROLE_BRANCH_DOCUMENT_LIMIT_BYTES,
  });
  return parseRoleBranchPermissions(data, id);
}
