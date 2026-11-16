import type { CorePath } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { coreDelete, coreGetResponse, corePatchResponse, corePostResponse } from "../core-api";
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
  parseTemplateCursorResponse,
  parseTemplateListItem,
  templatePath,
  TEMPLATES_PATH,
  type TemplateCursorPage,
} from "./templates-contract";
import { parseTemplateVersion, type TemplateVersion } from "./template-lifecycle-contract";
import { readTemplateResponse, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "./template-wire";

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

export type AssignmentScope =
  | { type: "TENANT" }
  | { type: "COMPANY"; companyId: string }
  | { type: "BRANCH"; companyId: string; branchId: string };

export const TENANT_ASSIGNMENT_SCOPE: AssignmentScope = { type: "TENANT" };
export const SALES_QUOTATION_SELECTOR = {
  documentType: "QUOTATION",
  outputChannel: "PRINT",
  adapterKey: "TRADE_QUOTATION_PRINT_V1",
} as const;

export function assignmentScopeKey(scope: AssignmentScope): string {
  if (scope.type === "TENANT") return scope.type;
  if (scope.type === "COMPANY") return `COMPANY:${scope.companyId}`;
  return `BRANCH:${scope.companyId}:${scope.branchId}`;
}

export function isSalesQuotationSelector(selector: Pick<AssignmentSelector, "documentType" | "outputChannel" | "adapterKey">) {
  return selector.documentType === SALES_QUOTATION_SELECTOR.documentType &&
    selector.outputChannel === SALES_QUOTATION_SELECTOR.outputChannel &&
    selector.adapterKey === SALES_QUOTATION_SELECTOR.adapterKey;
}

export interface AssignmentSelector {
  documentType: string;
  outputChannel: string;
  adapterKey: string;
  locale: string;
  scope: AssignmentScope;
}

export interface AssignmentUpdate {
  versionId?: string;
  priority?: number;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  status?: AssignmentStatus;
}

export type AssignmentCreate = Omit<AssignmentSelector, "locale"> &
  Required<Omit<AssignmentUpdate, "status">> & { locale: string | null };

export interface TemplateAssignment {
  id: string;
  definitionId: string;
  versionId: string;
  versionNumber: number;
  documentType: string;
  outputChannel: string;
  adapterKey: string;
  locale: string | null;
  scope: AssignmentScope;
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
    matchedScope: AssignmentScope;
    localeMatch: "EXACT" | "DEFAULT";
    priority: number;
    version: {
      definitionId: string;
      id: string;
      number: number;
      documentType: string;
      outputChannel: string;
      adapterKey: string;
      locale: string;
    };
  } | null;
  eligibleCandidateCount: number;
}

function integer(source: Record<string, unknown>, key: string, min: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < min) invalidCoreResponse();
  return value as number;
}

function parseScope(value: unknown): AssignmentScope {
  const scope = record(value);
  if (!scope) invalidCoreResponse();
  if (scope.type === "TENANT" && scope.companyId == null && scope.branchId == null) {
    return TENANT_ASSIGNMENT_SCOPE;
  }
  if (scope.type === "COMPANY" && scope.branchId == null) {
    return { type: scope.type, companyId: requiredUuidV7(scope, "companyId") };
  }
  if (scope.type === "BRANCH") {
    return { type: scope.type, companyId: requiredUuidV7(scope, "companyId"), branchId: requiredUuidV7(scope, "branchId") };
  }
  return invalidCoreResponse();
}

function scopeAppliesTo(owner: AssignmentScope, target: AssignmentScope): boolean {
  if (owner.type === "TENANT") return true;
  if (target.type === "TENANT" || owner.companyId !== target.companyId) return false;
  return owner.type === "COMPANY" || (target.type === "BRANCH" && owner.branchId === target.branchId);
}

function parseTemplateAssignment(payload: unknown): TemplateAssignment {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const revision = integer(row, "revision", 1);
  const etag = requiredText(row, "etag", 64);
  if (etag !== `"${revision}"`) invalidCoreResponse();
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
    revision,
    etag,
  };
}

export function parseResolvedAssignment(payload: unknown): ResolvedAssignment {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const evaluatedAt = requiredTimestamp(row, "evaluatedAt");
  const eligibleCandidateCount = integer(row, "eligibleCandidateCount", 0);
  if (row.chosen === null) {
    if (eligibleCandidateCount !== 0) invalidCoreResponse();
    return { evaluatedAt, eligibleCandidateCount, chosen: null };
  }
  const chosen = record(row.chosen);
  const version = record(chosen?.version);
  if (!chosen || !version || eligibleCandidateCount !== 1 ||
      (chosen.localeMatch !== "EXACT" && chosen.localeMatch !== "DEFAULT")) {
    invalidCoreResponse();
  }
  return {
    evaluatedAt,
    eligibleCandidateCount,
    chosen: {
      assignmentId: requiredUuidV7(chosen, "assignmentId"),
      matchedScope: parseScope(chosen.matchedScope),
      localeMatch: chosen.localeMatch,
      priority: integer(chosen, "priority", ASSIGNMENT_PRIORITY_MIN),
      version: {
        definitionId: requiredUuidV7(version, "definitionId"),
        id: requiredUuidV7(version, "versionId"),
        number: integer(version, "versionNumber", 1),
        documentType: requiredText(version, "documentType", 40),
        outputChannel: requiredText(version, "outputChannel", 16),
        adapterKey: requiredText(version, "dataSourceKey", 64),
        locale: requiredText(version, "locale", 35),
      },
    },
  };
}

export interface AssignmentListRequest {
  scope: AssignmentScope;
  documentType?: string;
  outputChannel?: string;
  adapterKey?: string;
  status?: AssignmentStatus;
  cursor?: string;
}

export async function fetchTemplateAssignments(
  request: AssignmentListRequest,
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<TemplateCursorPage<TemplateAssignment>> {
  const query = new URLSearchParams({
    scopeType: request.scope.type,
    limit: String(TEMPLATE_PAGE_LIMIT),
  });
  for (const key of [
    "documentType",
    "outputChannel",
    "adapterKey",
    "status",
    "cursor",
  ] as const) {
    const value = request[key];
    if (value) query.set(key, value);
  }
  if (request.scope.type !== "TENANT") query.set("companyId", request.scope.companyId);
  if (request.scope.type === "BRANCH") query.set("branchId", request.scope.branchId);
  const result = await coreGetResponse(
    `${TEMPLATE_ASSIGNMENTS_PATH}?${query.toString()}` as CorePath,
    { signal, assertCurrent, maxResponseBytes: 900_000, requireExactResponseTarget: true },
  );
  return parseTemplateCursorResponse(result, (value) => {
    const assignment = parseTemplateAssignment(value);
    if (assignmentScopeKey(assignment.scope) !== assignmentScopeKey(request.scope)) invalidCoreResponse();
    return assignment;
  });
}

/** **200**, `@ReadLikeOperation()`, `no-store` — a preview, not a mutation. */
export async function resolveTemplateAssignment(
  body: AssignmentSelector,
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<ResolvedAssignment> {
  const result = await corePostResponse(TEMPLATE_ASSIGNMENTS_RESOLVE_PATH, body, {
    signal, assertCurrent, maxResponseBytes: 200_000, requireExactResponseTarget: true,
  });
  const payload = record(readTemplateResponse(result, [200]));
  const selector = record(payload?.selector);
  if (!selector || selector.documentType !== body.documentType || selector.outputChannel !== body.outputChannel ||
      selector.adapterKey !== body.adapterKey || selector.locale !== body.locale ||
      assignmentScopeKey(parseScope(selector.scope)) !== assignmentScopeKey(body.scope)) invalidCoreResponse();
  const resolved = parseResolvedAssignment(payload);
  if (resolved.chosen) {
    const { version } = resolved.chosen;
    if (!scopeAppliesTo(resolved.chosen.matchedScope, body.scope) ||
        version.documentType !== body.documentType || version.outputChannel !== body.outputChannel ||
        version.adapterKey !== body.adapterKey ||
        (resolved.chosen.localeMatch === "EXACT" && version.locale !== body.locale)) invalidCoreResponse();
  }
  return resolved;
}

export async function createTemplateAssignment(
  body: AssignmentCreate,
  idempotencyKey: string,
  assertCurrent?: () => void,
): Promise<TemplateAssignment> {
  const result = await corePostResponse(TEMPLATE_ASSIGNMENTS_PATH, body, {
    headers: { "x-idempotency-key": idempotencyKey },
    assertCurrent, maxResponseBytes: 200_000, requireExactResponseTarget: true,
  });
  const assignment = parseAssignmentReceipt(result, 201);
  if (assignment.revision !== 1 || assignment.versionId !== body.versionId || assignment.locale !== body.locale ||
      assignment.documentType !== body.documentType || assignment.outputChannel !== body.outputChannel ||
      assignment.adapterKey !== body.adapterKey || assignment.isDefault !== body.isDefault ||
      assignmentScopeKey(assignment.scope) !== assignmentScopeKey(body.scope)) invalidCoreResponse();
  return assignment;
}

function assignmentPath(assignmentId: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(assignmentId)) invalidCoreResponse();
  return `/api/tenant/core/v1/templates/assignments/${encodeURIComponent(assignmentId)}`;
}

export async function fetchTemplateAssignment(
  assignmentId: string,
  assertCurrent: () => void,
): Promise<TemplateAssignment> {
  const result = await coreGetResponse(assignmentPath(assignmentId), {
    assertCurrent, maxResponseBytes: 200_000, requireExactResponseTarget: true,
  });
  const assignment = parseTemplateAssignment(readTemplateResponse(result, [200],
    row => row.assignmentId === assignmentId && (row.status === "ACTIVE" || row.status === "INACTIVE")));
  if (assignment.id !== assignmentId || result.headers.get("etag") !== assignment.etag) invalidCoreResponse();
  return assignment;
}

/** Revalidates compatibility, overlap, priority and scope — an edit can fail for a field the user did not touch. */
export async function updateTemplateAssignment(
  previous: TemplateAssignment,
  body: AssignmentUpdate,
  idempotencyKey: string,
  assertCurrent?: () => void,
): Promise<TemplateAssignment> {
  const result = await corePatchResponse(assignmentPath(previous.id), body, {
    headers: { "If-Match": previous.etag, "x-idempotency-key": idempotencyKey },
    assertCurrent,
    maxResponseBytes: 200_000,
    requireExactResponseTarget: true,
  });
  const assignment = parseAssignmentReceipt(result, 200);
  const versionId = body.versionId ?? previous.versionId;
  if (assignment.id !== previous.id || assignment.definitionId !== previous.definitionId ||
      assignment.revision !== previous.revision + 1 || assignment.versionId !== versionId ||
      (versionId === previous.versionId && assignment.versionNumber !== previous.versionNumber) ||
      assignment.documentType !== previous.documentType || assignment.outputChannel !== previous.outputChannel ||
      assignment.adapterKey !== previous.adapterKey || assignment.locale !== previous.locale ||
      assignment.isDefault !== (body.isDefault ?? previous.isDefault) ||
      assignment.status !== (body.status ?? previous.status) ||
      assignmentScopeKey(assignment.scope) !== assignmentScopeKey(previous.scope)) invalidCoreResponse();
  return assignment;
}

/** **204.** Deactivates, preserving assignment history. */
export async function deleteTemplateAssignment(
  assignmentId: string,
  ifMatch: string,
  idempotencyKey: string,
  assertCurrent: () => void,
): Promise<boolean> {
  const result = await coreDelete(assignmentPath(assignmentId), {
    headers: { "If-Match": ifMatch, "x-idempotency-key": idempotencyKey },
    assertCurrent,
    nonReplayable: true,
    maxResponseBytes: 20_000,
    requireExactResponseTarget: true,
  });
  if (result.status !== 204) invalidCoreResponse();
  return isIdempotentReplay(result.headers);
}

function parseAssignmentReceipt(response: { status: number; data: unknown; headers: Headers }, status: number) {
  const payload = record(readTemplateResponse(response, [status]));
  const assignment = parseTemplateAssignment(payload?.assignment);
  if (response.headers.get("etag") !== assignment.etag) invalidCoreResponse();
  return assignment;
}

export interface AssignmentTemplateChoice {
  id: string;
  name: string;
  code: string;
  locale: string;
}

export async function fetchQuotationAssignmentTemplates(
  scope: AssignmentScope,
  locale: string,
  cursor: string | undefined,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<TemplateCursorPage<AssignmentTemplateChoice>> {
  const query = new URLSearchParams({
    assignmentScopeType: scope.type,
    documentType: SALES_QUOTATION_SELECTOR.documentType,
    outputChannel: SALES_QUOTATION_SELECTOR.outputChannel,
    lifecycleStatus: "ACTIVE",
    hasPublishedVersion: "true",
    sortBy: "name",
    sortDirection: "asc",
    limit: String(TEMPLATE_PAGE_LIMIT),
  });
  if (scope.type === "TENANT") query.set("definitionScopeType", "TENANT");
  else query.set("assignmentCompanyId", scope.companyId);
  if (scope.type === "BRANCH") query.set("assignmentBranchId", scope.branchId);
  if (locale) query.set("locale", locale);
  if (cursor) query.set("cursor", cursor);
  const result = await coreGetResponse(`${TEMPLATES_PATH}?${query}` as CorePath, {
    signal, assertCurrent, maxResponseBytes: 900_000, suppressForbiddenToast: true, requireExactResponseTarget: true,
  });
  const page = parseTemplateCursorResponse(result, (value) => {
    const template = parseTemplateListItem(value);
    const owner = parseScope(record(value)?.definitionScope);
    if (owner.type === "BRANCH") invalidCoreResponse();
    return { template, owner };
  });
  return {
    ...page,
    items: page.items
      .filter(({ template, owner }) => template.documentType === SALES_QUOTATION_SELECTOR.documentType &&
        template.outputChannel === SALES_QUOTATION_SELECTOR.outputChannel &&
        template.lifecycleStatus === "ACTIVE" && template.currentPublishedVersion &&
        (!locale || template.locale === locale) && scopeAppliesTo(owner, scope))
      .map(({ template: { id, name, code, locale } }) => ({ id, name, code, locale })),
  };
}

export async function fetchQuotationAssignmentVersions(
  definitionId: string,
  locale: string,
  cursor: string | undefined,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<TemplateCursorPage<TemplateVersion>> {
  const query = new URLSearchParams({ lifecycleStatus: "PUBLISHED", limit: String(TEMPLATE_PAGE_LIMIT) });
  if (cursor) query.set("cursor", cursor);
  const result = await coreGetResponse(`${templatePath(definitionId)}/versions?${query}` as CorePath, {
    signal, assertCurrent, maxResponseBytes: 900_000, suppressForbiddenToast: true, requireExactResponseTarget: true,
  });
  const page = parseTemplateCursorResponse(result, (value) => {
    const row = record(value);
    const version = parseTemplateVersion(row);
    if (!row || row.templateDefinitionId !== definitionId || row.documentType !== SALES_QUOTATION_SELECTOR.documentType ||
        row.outputChannel !== SALES_QUOTATION_SELECTOR.outputChannel ||
        version.dataSourceKey !== SALES_QUOTATION_SELECTOR.adapterKey || version.lifecycleStatus !== "PUBLISHED" ||
        !version.locale || (locale && version.locale !== locale)) invalidCoreResponse();
    return { version, needsFixedCanvasCheck: row.layoutMode === "FIXED_CANVAS" };
  });
  const items: TemplateVersion[] = [];
  for (const { version, needsFixedCanvasCheck } of page.items) {
    if (!needsFixedCanvasCheck || await isEligibleFixedCanvasVersion(definitionId, version, signal, assertCurrent)) {
      items.push(version);
    }
  }
  return { ...page, items };
}

async function isEligibleFixedCanvasVersion(
  definitionId: string,
  selected: TemplateVersion,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<boolean> {
  const response = await coreGetResponse(`${templatePath(definitionId)}/versions/${selected.id}`, {
    signal, assertCurrent, maxResponseBytes: TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES,
    suppressForbiddenToast: true, requireExactResponseTarget: true,
  });
  const payload = record(readTemplateResponse(response, [200]));
  const version = parseTemplateVersion(payload);
  const document = record(payload?.editorDocument);
  if (!payload || payload.templateDefinitionId !== definitionId || version.id !== selected.id ||
      version.versionNumber !== selected.versionNumber || version.locale !== selected.locale ||
      version.templateContentChecksum !== selected.templateContentChecksum ||
      version.dataSourceKey !== SALES_QUOTATION_SELECTOR.adapterKey || payload.layoutMode !== "FIXED_CANVAS" ||
      !document) invalidCoreResponse();
  // The Trade quotation bundle renders one implicit page for Fixed Canvas.
  return version.lifecycleStatus === "PUBLISHED" && !Object.hasOwn(document, "canvasPages");
}
