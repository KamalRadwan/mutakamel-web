import {
  readCoreData,
  readCorePage,
  writeCoreData,
  type CorePath,
} from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
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

// Each level is a literal rather than a prefix plus interpolation: the bare
// `/organization` prefix is not a route, and naming it would put a path in the
// source that the Gateway contract does not have.
const ORGANIZATION_TREE_PATH: CorePath = "/api/tenant/core/v1/organization/tree";
const LEVEL_PATH: Record<OrgLevel, CorePath> = {
  companies: "/api/tenant/core/v1/organization/companies",
  branches: "/api/tenant/core/v1/organization/branches",
  departments: "/api/tenant/core/v1/organization/departments",
  teams: "/api/tenant/core/v1/organization/teams",
};

/** `OrgNodeStatusEnum` — core-app/packages/common/src/enums/org-node-status.enum.ts. */
export const ORG_NODE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type OrgNodeStatus = (typeof ORG_NODE_STATUSES)[number];

/**
 * The four strictly-nested levels the Core organization controller exposes.
 *
 * Written as a union rather than `(typeof ARRAY)[number]`: nothing iterates the
 * array, so it was runtime data allocated at module load purely to derive a
 * type that says the same thing.
 */
export type OrgLevel = "companies" | "branches" | "departments" | "teams";

export const ORG_CODE_MAX_LENGTH = 32;
export const ORG_NAME_MAX_LENGTH = 120;
export const ORG_LEGAL_NAME_MAX_LENGTH = 200;
export const ORG_TAX_NUMBER_MAX_LENGTH = 64;
export const ORG_ADDRESS_MAX_LENGTH = 2000;
export const ORG_PHONE_MAX_LENGTH = 32;
export const ORG_CURRENCY_CODE_LENGTH = 3;

/** OrganizationService.TREE_NODE_LIMIT_PER_LEVEL — a level above it is a 422. */
export const ORG_TREE_NODE_LIMIT_PER_LEVEL = 5_000;
export const ORG_TREE_TOO_LARGE_CODE = "ORG_TREE_TOO_LARGE";
const ORG_NODE_NOT_EMPTY_CODE = "ORG_NODE_NOT_EMPTY";

interface OrgNodeBase {
  id: string;
  code: string;
  name: string;
  status: OrgNodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends OrgNodeBase {
  legalName: string | null;
  taxNumber: string | null;
  currencyCode: string | null;
}

export interface Branch extends OrgNodeBase {
  companyId: string;
  address: string | null;
  phone: string | null;
  isHeadquarters: boolean;
}

interface Department extends OrgNodeBase {
  branchId: string;
}

export interface Team extends OrgNodeBase {
  departmentId: string;
  leadUserId: string | null;
}

export interface OrgTreeNode {
  id: string;
  code: string;
  name: string;
  status: OrgNodeStatus;
  children: OrgTreeNode[];
}

function parseOrgNodeBase(payload: unknown): { source: Record<string, unknown> } & OrgNodeBase {
  const source = record(payload);
  if (!source || !isMember(ORG_NODE_STATUSES, source.status)) invalidCoreResponse();
  return {
    source,
    id: requiredUuidV7(source, "id"),
    code: requiredText(source, "code", ORG_CODE_MAX_LENGTH),
    name: requiredText(source, "name", ORG_NAME_MAX_LENGTH),
    status: source.status,
    createdAt: requiredTimestamp(source, "createdAt"),
    updatedAt: requiredTimestamp(source, "updatedAt"),
  };
}

export function parseCompany(payload: unknown): Company {
  const { source, ...base } = parseOrgNodeBase(payload);
  return {
    ...base,
    legalName: nullableText(source, "legalName", ORG_LEGAL_NAME_MAX_LENGTH),
    taxNumber: nullableText(source, "taxNumber", ORG_TAX_NUMBER_MAX_LENGTH),
    currencyCode: nullableText(source, "currencyCode", ORG_CURRENCY_CODE_LENGTH),
  };
}

export function parseBranch(payload: unknown): Branch {
  const { source, ...base } = parseOrgNodeBase(payload);
  return {
    ...base,
    companyId: requiredUuidV7(source, "companyId"),
    address: nullableText(source, "address", ORG_ADDRESS_MAX_LENGTH),
    phone: nullableText(source, "phone", ORG_PHONE_MAX_LENGTH),
    isHeadquarters: requiredBoolean(source, "isHeadquarters"),
  };
}

function parseDepartment(payload: unknown): Department {
  const { source, ...base } = parseOrgNodeBase(payload);
  return { ...base, branchId: requiredUuidV7(source, "branchId") };
}

export function parseTeam(payload: unknown): Team {
  const { source, ...base } = parseOrgNodeBase(payload);
  return {
    ...base,
    departmentId: requiredUuidV7(source, "departmentId"),
    leadUserId: nullableUuidV7(source, "leadUserId"),
  };
}

// The tree is four levels deep and the server builds it from the same bounded
// page reads, so a depth beyond four means the shape changed rather than that
// the tenant grew.
const ORG_TREE_MAX_DEPTH = 4;

export function parseOrgTree(payload: unknown, depth = 1): OrgTreeNode[] {
  if (!Array.isArray(payload) || payload.length > ORG_TREE_NODE_LIMIT_PER_LEVEL) {
    invalidCoreResponse();
  }
  return payload.map((value) => {
    const source = record(value);
    if (!source || !isMember(ORG_NODE_STATUSES, source.status)) invalidCoreResponse();
    if (!Array.isArray(source.children)) invalidCoreResponse();
    if (depth >= ORG_TREE_MAX_DEPTH && source.children.length > 0) invalidCoreResponse();
    return {
      id: requiredUuidV7(source, "id"),
      code: requiredText(source, "code", ORG_CODE_MAX_LENGTH),
      name: requiredText(source, "name", ORG_NAME_MAX_LENGTH),
      status: source.status,
      children: parseOrgTree(source.children, depth + 1),
    };
  });
}

const LEVEL_PARSERS = {
  companies: parseCompany,
  branches: parseBranch,
  departments: parseDepartment,
  teams: parseTeam,
} as const;

export type OrgNodeOf<L extends OrgLevel> = ReturnType<(typeof LEVEL_PARSERS)[L]>;

function organizationNodePath(level: OrgLevel, id: string): CorePath {
  if (!isUUIDv7(id)) invalidCoreResponse();
  return `${LEVEL_PATH[level]}/${encodeURIComponent(id)}`;
}

export async function fetchOrgTree(signal?: AbortSignal): Promise<OrgTreeNode[]> {
  const data = await readCoreData(ORGANIZATION_TREE_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseOrgTree(data);
}

/** The query key each level's list route takes for its parent, if it has one. */
const ORG_PARENT_QUERY_KEY = {
  companies: undefined,
  branches: "companyId",
  departments: "branchId",
  teams: "departmentId",
} as const;

/** The only sort fields the org-node endpoints accept; else a 400. */
export const ORG_NODE_SORT_FIELDS = ["name", "code", "createdAt"] as const;
export type OrgNodeSortField = (typeof ORG_NODE_SORT_FIELDS)[number];

export async function fetchOrgNodes<L extends OrgLevel>(
  level: L,
  options: {
    page: number;
    search: string;
    status?: OrgNodeStatus;
    parentId?: string;
    limit?: number;
    sortBy?: OrgNodeSortField;
    sortDir?: "ASC" | "DESC";
    signal?: AbortSignal;
  },
): Promise<CorePage<OrgNodeOf<L>>> {
  const parentKey = ORG_PARENT_QUERY_KEY[level];

  const query = buildCoreListQuery({
    page: options.page,
    search: options.search,
    sortBy: options.sortBy ?? "name",
    sortDir: options.sortDir ?? "ASC",
    limit: options.limit,
    filters: {
      status: options.status,
      ...(parentKey ? { [parentKey]: options.parentId } : {}),
    },
  });

  const envelope = await readCorePage(LEVEL_PATH[level], query, {
    signal: options.signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  // `LEVEL_PARSERS[level]` widens to the union of the four parsers, which TS
  // cannot correlate with `L` on its own. The assertion re-states the mapping
  // the table already guarantees; the runtime parser is still the level's own.
  const parseItem = LEVEL_PARSERS[level] as (value: unknown) => OrgNodeOf<L>;
  return parseCorePage(envelope, parseItem);
}

export async function fetchOrgNode<L extends OrgLevel>(
  level: L,
  id: string,
  signal?: AbortSignal,
): Promise<OrgNodeOf<L>> {
  const data = await readCoreData(organizationNodePath(level, id), {
    signal,
    cache: "no-store",
    maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  });
  return LEVEL_PARSERS[level](data) as OrgNodeOf<L>;
}

export async function createOrgNode<L extends OrgLevel>(
  level: L,
  body: Record<string, unknown>,
): Promise<OrgNodeOf<L>> {
  const data = await writeCoreData("post", LEVEL_PATH[level], body, {
    cache: "no-store",
    maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
  });
  return LEVEL_PARSERS[level](data) as OrgNodeOf<L>;
}

export async function updateOrgNode<L extends OrgLevel>(
  level: L,
  id: string,
  body: Record<string, unknown>,
): Promise<OrgNodeOf<L>> {
  const data = await writeCoreData("patch", organizationNodePath(level, id), body, {
    cache: "no-store",
    maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
  });
  return LEVEL_PARSERS[level](data) as OrgNodeOf<L>;
}

export async function deleteOrgNode(level: OrgLevel, id: string): Promise<void> {
  await writeCoreData("delete", organizationNodePath(level, id), undefined, {
    cache: "no-store",
    maxResponseBytes: 10_000,
    nonReplayable: true,
  });
}

/**
 * The `details.blockers` array on a `409 ORG_NODE_NOT_EMPTY`.
 *
 * These are **server-authored English phrases** ("company has branches"), not
 * enum codes — `OrganizationService.notEmpty()` builds them from a literal. The
 * localized headline comes from the error CODE, and these render verbatim
 * underneath, the same way `StatusBadge` shows an unmapped wire value rather
 * than inventing a label for it.
 */
export function readDeletionBlockers(error: NormalizedApiError): string[] {
  if (error.status !== 409 || error.code !== ORG_NODE_NOT_EMPTY_CODE) return [];
  const blockers = error.fieldErrors?.blockers;
  return Array.isArray(blockers) ? blockers.slice(0, 10) : [];
}

