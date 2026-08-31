import type { CorePath } from "@/lib/api/envelope";
import { coreDelete, coreGet, corePatch, corePost } from "../core-api";
import {
  invalidCoreResponse,
  nullableText,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import {
  TEMPLATE_PAGE_LIMIT,
  parseTemplateCursorPage,
  type TemplateCursorPage,
  type TemplateScope,
  type TemplateScopeType,
} from "./templates-contract";

// Assignments point a scope at a published version with a priority and an
// effective window. `resolve` answers "which template actually renders for this
// selector at this instant" — the screen offers it rather than making the user
// reason about overlapping windows, because those bugs are invisible until a
// document renders wrong.

const TEMPLATE_ASSIGNMENTS_PATH = "/api/tenant/core/v1/templates/assignments";
const TEMPLATE_ASSIGNMENTS_RESOLVE_PATH =
  "/api/tenant/core/v1/templates/assignments/resolve";

type AssignmentStatus = "ACTIVE" | "INACTIVE";

export const ASSIGNMENT_CONFLICT_CODE = "CORE.TEMPLATE.ASSIGNMENT.CONFLICT";
export const ASSIGNMENT_INCOMPATIBLE_CODE = "CORE.TEMPLATE.ASSIGNMENT.VERSION_INCOMPATIBLE";
export const ASSIGNMENT_SCOPE_INVALID_CODE = "CORE.TEMPLATE.ASSIGNMENT.SCOPE_INVALID";

const ASSIGNMENT_PRIORITY_MIN = 0;
export const ASSIGNMENT_PRIORITY_MAX = 1000;

export interface TemplateAssignment {
  id: string;
  definitionId: string;
  versionId: string;
  versionNumber: number;
  documentType: string;
  outputChannel: string;
  adapterKey: string;
  locale: string | null;
  scope: TemplateScope;
  priority: number;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  revision: number;
  etag: string;
}

export interface ResolvedAssignment {
  evaluatedAt: string;
  chosen: {
    assignmentId: string;
    localeMatch: string;
    priority: number;
    versionId: string;
    versionNumber: number;
  } | null;
  eligibleCandidateCount: number;
}

function integer(source: Record<string, unknown>, key: string, min: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < min) invalidCoreResponse();
  return value as number;
}

function parseScope(value: unknown): TemplateScope {
  const scope = record(value);
  if (!scope) invalidCoreResponse();
  const type = scope.type;
  if (type !== "TENANT" && type !== "COMPANY" && type !== "BRANCH") invalidCoreResponse();
  return {
    type: type as TemplateScopeType,
    companyId: typeof scope.companyId === "string" ? scope.companyId : undefined,
    branchId: typeof scope.branchId === "string" ? scope.branchId : undefined,
  };
}

function parseTemplateAssignment(payload: unknown): TemplateAssignment {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "assignmentId"),
    definitionId: requiredUuidV7(row, "definitionId"),
    versionId: requiredUuidV7(row, "versionId"),
    versionNumber: integer(row, "versionNumber", 1),
    documentType: requiredText(row, "documentType", 40),
    outputChannel: requiredText(row, "outputChannel", 16),
    adapterKey: requiredText(row, "adapterKey", 64),
    locale: nullableText(row, "locale", 35),
    scope: parseScope(row.scope),
    priority: integer(row, "priority", ASSIGNMENT_PRIORITY_MIN),
    isDefault: requiredBoolean(row, "isDefault"),
    effectiveFrom: requiredTimestamp(row, "effectiveFrom"),
    effectiveTo:
      row.effectiveTo === null || row.effectiveTo === undefined
        ? null
        : requiredTimestamp(row, "effectiveTo"),
    status: requiredText(row, "status", 16),
    revision: integer(row, "revision", 1),
    etag: requiredText(row, "etag", 64),
  };
}

export function parseResolvedAssignment(payload: unknown): ResolvedAssignment {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const chosen = record(row.chosen);
  const version = chosen ? record(chosen.version) : null;
  return {
    evaluatedAt: requiredTimestamp(row, "evaluatedAt"),
    chosen:
      chosen && version
        ? {
            assignmentId: requiredUuidV7(chosen, "assignmentId"),
            localeMatch: requiredText(chosen, "localeMatch", 16),
            priority: integer(chosen, "priority", ASSIGNMENT_PRIORITY_MIN),
            versionId: requiredUuidV7(version, "templateVersionId"),
            versionNumber: integer(version, "versionNumber", 1),
          }
        : null,
    eligibleCandidateCount: integer(row, "eligibleCandidateCount", 0),
  };
}

export interface AssignmentListRequest {
  scopeType: TemplateScopeType;
  companyId?: string;
  branchId?: string;
  documentType?: string;
  outputChannel?: string;
  adapterKey?: string;
  status?: AssignmentStatus;
  cursor?: string;
}

export async function fetchTemplateAssignments(
  request: AssignmentListRequest,
  signal?: AbortSignal,
): Promise<TemplateCursorPage<TemplateAssignment>> {
  const query = new URLSearchParams({
    scopeType: request.scopeType,
    limit: String(TEMPLATE_PAGE_LIMIT),
  });
  for (const key of [
    "companyId",
    "branchId",
    "documentType",
    "outputChannel",
    "adapterKey",
    "status",
    "cursor",
  ] as const) {
    const value = request[key];
    if (value) query.set(key, value);
  }
  const result = await coreGet(
    `${TEMPLATE_ASSIGNMENTS_PATH}?${query.toString()}` as CorePath,
    { signal, maxResponseBytes: 900_000 },
  );
  return parseTemplateCursorPage(result.data, parseTemplateAssignment);
}

/** **200**, `@ReadLikeOperation()`, `no-store` — a preview, not a mutation. */
export async function resolveTemplateAssignment(
  body: Record<string, unknown>,
): Promise<ResolvedAssignment> {
  const result = await corePost(TEMPLATE_ASSIGNMENTS_RESOLVE_PATH, body, {
    maxResponseBytes: 200_000,
  });
  return parseResolvedAssignment(result.data);
}

export async function createTemplateAssignment(
  body: Record<string, unknown>,
): Promise<TemplateAssignment> {
  const result = await corePost(TEMPLATE_ASSIGNMENTS_PATH, body, {
    maxResponseBytes: 200_000,
  });
  return parseTemplateAssignment(result.data);
}

function assignmentPath(assignmentId: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(assignmentId)) invalidCoreResponse();
  return `/api/tenant/core/v1/templates/assignments/${encodeURIComponent(assignmentId)}`;
}

/** Revalidates compatibility, overlap, priority and scope — an edit can fail for a field the user did not touch. */
export async function updateTemplateAssignment(
  assignmentId: string,
  body: Record<string, unknown>,
  ifMatch: string,
): Promise<TemplateAssignment> {
  const result = await corePatch(assignmentPath(assignmentId), body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: 200_000,
  });
  return parseTemplateAssignment(result.data);
}

/** **204.** Deactivates, preserving assignment history. */
export async function deleteTemplateAssignment(
  assignmentId: string,
  ifMatch: string,
): Promise<void> {
  await coreDelete(assignmentPath(assignmentId), {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: 20_000,
  });
}
