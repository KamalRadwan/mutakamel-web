import type { CorePath } from "@/lib/api/envelope";
import { coreDelete, coreGet, corePatch, corePost } from "../core-api";
import {
  TEMPLATES_PATH,
  TEMPLATES_SEARCH_PATH,
  TEMPLATE_CREATION_SCOPES_PATH,
  TEMPLATE_PAGE_LIMIT,
  TEMPLATE_STARTERS_PATH,
  parseTemplateCursorPage,
  parseTemplateDetail,
  parseTemplateListItem,
  templatePath,
  type TemplateCursorPage,
  type TemplateDetail,
  type TemplateListItem,
  type TemplateSortField,
} from "./templates-contract";
import {
  parseCreationScopes,
  parseTemplateStarters,
  type TemplateCreationScope,
  type TemplateStarter,
} from "./template-discovery-contract";

const LIST_LIMIT_BYTES = 900_000;
const DETAIL_LIMIT_BYTES = 400_000;
const WRITE_LIMIT_BYTES = 400_000;

export interface TemplateListRequest {
  assignmentScopeType: "TENANT" | "COMPANY" | "BRANCH";
  assignmentCompanyId?: string;
  assignmentBranchId?: string;
  name?: string;
  code?: string;
  documentType?: string;
  outputChannel?: string;
  layoutMode?: string;
  lifecycleStatus?: string;
  locale?: string;
  hasPublishedVersion?: boolean;
  sortBy: TemplateSortField;
  /** **Lowercase.** The shared `sortDir: ASC|DESC` convention does not apply here. */
  sortDirection: "asc" | "desc";
  /** Passed back byte-for-byte, or omitted to start the list from the top. */
  cursor?: string;
  limit?: number;
}

function listQuery(request: TemplateListRequest): string {
  const query = new URLSearchParams({
    assignmentScopeType: request.assignmentScopeType,
    sortBy: request.sortBy,
    sortDirection: request.sortDirection,
    limit: String(request.limit ?? TEMPLATE_PAGE_LIMIT),
  });
  for (const key of [
    "assignmentCompanyId",
    "assignmentBranchId",
    "name",
    "code",
    "documentType",
    "outputChannel",
    "layoutMode",
    "lifecycleStatus",
    "locale",
    "cursor",
  ] as const) {
    const value = request[key];
    if (value) query.set(key, value);
  }
  if (request.hasPublishedVersion !== undefined) {
    query.set("hasPublishedVersion", String(request.hasPublishedVersion));
  }
  return query.toString();
}

export async function fetchTemplates(
  request: TemplateListRequest,
  signal?: AbortSignal,
): Promise<TemplateCursorPage<TemplateListItem>> {
  const result = await coreGet(`${TEMPLATES_PATH}?${listQuery(request)}` as CorePath, {
    signal,
    maxResponseBytes: LIST_LIMIT_BYTES,
  });
  return parseTemplateCursorPage(result.data, parseTemplateListItem);
}

/**
 * The read-like POST variant, for a filter set too large to encode safely in a
 * query string. It answers **200**, is `@ReadLikeOperation()`, and takes the
 * same body the query string carries.
 */
export async function searchTemplates(
  request: TemplateListRequest,
  signal?: AbortSignal,
): Promise<TemplateCursorPage<TemplateListItem>> {
  const result = await corePost(TEMPLATES_SEARCH_PATH, request, {
    signal,
    maxResponseBytes: LIST_LIMIT_BYTES,
  });
  return parseTemplateCursorPage(result.data, parseTemplateListItem);
}

export async function fetchTemplate(
  templateId: string,
  signal?: AbortSignal,
): Promise<TemplateDetail> {
  const result = await coreGet(templatePath(templateId), {
    signal,
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseTemplateDetail(result.data);
}

export async function fetchTemplateStarters(
  query: Record<string, string>,
  signal?: AbortSignal,
): Promise<TemplateStarter[]> {
  const search = new URLSearchParams(query).toString();
  const result = await coreGet(`${TEMPLATE_STARTERS_PATH}?${search}` as CorePath, {
    signal,
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseTemplateStarters(result.data);
}

/** Needs `templates.read` **and** `templates.create` — reading it is a create action. */
export async function fetchCreationScopes(
  signal?: AbortSignal,
): Promise<TemplateCreationScope[]> {
  const result = await coreGet(TEMPLATE_CREATION_SCOPES_PATH, {
    signal,
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseCreationScopes(result.data);
}

/** **201**, idempotency-required. The transport attaches the UUIDv7 key. */
export async function createTemplate(body: Record<string, unknown>): Promise<TemplateDetail> {
  const result = await corePost(TEMPLATES_PATH, body, { maxResponseBytes: WRITE_LIMIT_BYTES });
  return parseTemplateDetail(result.data);
}

/**
 * `If-Match` carries the **definition** revision. A `direction` change also
 * needs `expectedDraftRevision` in the body, because changing LTR/RTL rewrites
 * the draft and cannot be pinned by the definition revision alone.
 */
export async function updateTemplate(
  templateId: string,
  body: Record<string, unknown>,
  ifMatch: string,
): Promise<TemplateDetail> {
  const result = await corePatch(templatePath(templateId), body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: WRITE_LIMIT_BYTES,
  });
  return parseTemplateDetail(result.data);
}

/** **200**, **no body**, `If-Match`. Sending a body is `CORE.TEMPLATE.SCHEMA.INVALID`. */
export async function setTemplateLifecycle(
  templateId: string,
  action: "archive" | "restore",
  ifMatch: string,
): Promise<TemplateDetail> {
  const path = (
    action === "archive"
      ? `/api/tenant/core/v1/templates/${encodeURIComponent(templateId)}/archive`
      : `/api/tenant/core/v1/templates/${encodeURIComponent(templateId)}/restore`
  ) as CorePath;
  const result = await corePost(path, undefined, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: WRITE_LIMIT_BYTES,
  });
  return parseTemplateDetail(result.data);
}

/** **204**, `If-Match`. A published or assigned definition is refused. */
export async function deleteTemplate(templateId: string, ifMatch: string): Promise<void> {
  await coreDelete(templatePath(templateId), {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: WRITE_LIMIT_BYTES,
  });
}

