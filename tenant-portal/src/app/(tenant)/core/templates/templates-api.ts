import type { TemplateCreatePage } from "./template-create-page";
import type { CorePath } from "@/lib/api/envelope";
import { coreDelete, coreGet, coreGetResponse, corePatchResponse, corePost, corePostResponse } from "../core-api";
import { invalidCoreResponse, record } from "../contracts/core-page";
import { readTemplateResponse, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "./template-wire";
import { parseEditorDocument } from "./template-editor-model";
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
  type TemplateDocumentType,
  type TemplateLayoutMode,
  type TemplateAdapterKey,
  type TemplateLocale,
  type TemplateDirection,
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
  assertCurrent?: () => void,
): Promise<TemplateCursorPage<TemplateListItem>> {
  const result = await coreGet(`${TEMPLATES_PATH}?${listQuery(request)}` as CorePath, {
    signal,
    ...(assertCurrent ? { assertCurrent } : {}),
    maxResponseBytes: LIST_LIMIT_BYTES,
    suppressForbiddenToast: true,
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
  assertCurrent?: () => void,
): Promise<TemplateCursorPage<TemplateListItem>> {
  const result = await corePost(TEMPLATES_SEARCH_PATH, request, {
    signal,
    ...(assertCurrent ? { assertCurrent } : {}),
    maxResponseBytes: LIST_LIMIT_BYTES,
    suppressForbiddenToast: true,
  });
  return parseTemplateCursorPage(result.data, parseTemplateListItem);
}

export async function fetchTemplate(
  templateId: string,
  signal?: AbortSignal,
): Promise<TemplateDetail> {
  const result = await coreGetResponse(templatePath(templateId), {
    signal,
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseTemplateDetail(readTemplateResponse(result, [200]));
}

export async function fetchTemplateStarters(
  query: Record<string, string>,
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<TemplateStarter[]> {
  const search = new URLSearchParams(query).toString();
  const result = await coreGet(`${TEMPLATE_STARTERS_PATH}?${search}` as CorePath, {
    signal,
    ...(assertCurrent ? { assertCurrent } : {}),
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseTemplateStarters(result.data);
}

/** Needs `templates.read` **and** `templates.create` — reading it is a create action. */
export async function fetchCreationScopes(
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<TemplateCreationScope[]> {
  const result = await coreGet(TEMPLATE_CREATION_SCOPES_PATH, {
    signal,
    ...(assertCurrent ? { assertCurrent } : {}),
    maxResponseBytes: DETAIL_LIMIT_BYTES,
  });
  return parseCreationScopes(result.data);
}

export type TemplateCreateRequest = {
  code: string;
  name: string;
  description?: string;
  documentType: TemplateDocumentType;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateAdapterKey;
  locale: TemplateLocale;
  direction: TemplateDirection;
  scope: { type: "TENANT" } | { type: "COMPANY"; companyId: string };
  starterKey?: string;
} & ({ outputChannel: "PRINT"; page: TemplateCreatePage } | { outputChannel: "EMAIL"; page?: never });

/** **201**, idempotency-required. The transport attaches the UUIDv7 key. */
export async function createTemplate(
  body: TemplateCreateRequest,
  signal?: AbortSignal,
  assertCurrent?: () => void,
): Promise<TemplateDetail> {
  const result = await corePostResponse(TEMPLATES_PATH, body, {
    maxResponseBytes: WRITE_LIMIT_BYTES, ...(signal ? { signal } : {}), ...(assertCurrent ? { assertCurrent } : {}),
  });
  const envelope = record(result.data);
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data")) invalidCoreResponse();

  const payload = record(readTemplateResponse(result, [201]));
  if (!payload || Object.keys(payload).length !== 2) invalidCoreResponse();
  const definition = parseTemplateDetail(payload.definition);
  const draft = record(payload.draft);
  if (!draft || draft.templateId !== definition.id ||
      draft.draftId !== definition.currentDraft.draftId ||
      draft.revision !== definition.currentDraft.revision ||
      draft.etag !== definition.currentDraft.etag ||
      draft.contentChecksum !== definition.currentDraft.contentChecksum) invalidCoreResponse();
  return definition;
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
  const result = await corePatchResponse(templatePath(templateId), body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: body.direction === undefined ? WRITE_LIMIT_BYTES : TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES,
  });
  const envelope = record(result.data);
  if (!envelope || !Object.hasOwn(envelope, "success") || envelope.success !== true ||
      !Object.hasOwn(envelope, "data")) invalidCoreResponse();

  const payload = record(readTemplateResponse(result, [200]));
  if (!payload || Object.keys(payload).length !== 2 ||
      !Object.hasOwn(payload, "definition") || !Object.hasOwn(payload, "draft")) invalidCoreResponse();

  const wireDefinition = record(payload.definition);
  if (!wireDefinition) invalidCoreResponse();
  const definition = parseTemplateDetail(wireDefinition);
  const draftSummary = record(wireDefinition.currentDraft);
  if (draftSummary?.validationState !== definition.currentDraft.validationState) invalidCoreResponse();

  if (body.name !== undefined &&
      (typeof body.name !== "string" ||
        definition.name !== body.name.normalize("NFC").trim())) invalidCoreResponse();
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") invalidCoreResponse();
    if (wireDefinition.description !== (body.description?.normalize("NFC").trim() || null)) invalidCoreResponse();
  }

  const responseEtag = result.headers.get("etag");
  if (definition.id !== templateId || definition.definitionRevision <= 1 ||
      ifMatch !== `"${definition.definitionRevision - 1}"` ||
      definition.etag !== `"${definition.definitionRevision}"` ||
      (responseEtag !== null && responseEtag !== definition.etag)) invalidCoreResponse();

  if (body.direction === undefined) {
    if (payload.draft !== null) invalidCoreResponse();
    // Draft-only writes have their own revision. Use Core's current summary.
    return definition;
  }

  const currentDraft = definition.currentDraft;
  const draft = record(payload.draft);
  if (!draft || draft.templateId !== definition.id ||
      draft.draftId !== currentDraft.draftId ||
      draft.revision !== currentDraft.revision ||
      draft.etag !== currentDraft.etag ||
      draft.contentChecksum !== currentDraft.contentChecksum ||
      currentDraft.etag !== `"${currentDraft.revision}"` ||
      currentDraft.revision <= 1 ||
      body.expectedDraftRevision !== currentDraft.revision - 1) invalidCoreResponse();

  const document = parseEditorDocument(draft.editorDocument ?? null);
  const validation = record(draft.validation);
  if (definition.direction !== body.direction || document.direction !== definition.direction ||
      document.locale !== definition.locale || document.documentType !== definition.documentType ||
      document.outputChannel !== definition.outputChannel || document.layoutMode !== definition.layoutMode ||
      document.dataSourceKey !== definition.dataSourceKey ||
      document.schemaVersion !== draft.schemaVersion ||
      currentDraft.validationState !== "STALE" || validation?.state !== "STALE" ||
      validation.lastValidationRunId !== null || validation.validatedDraftRevision !== null) invalidCoreResponse();

  return definition;
}

/** **200**, **no body**, `If-Match`. Sending a body is `CORE.TEMPLATE.SCHEMA.INVALID`. */
export async function setTemplateLifecycle(
  templateId: string,
  action: "archive" | "restore",
  ifMatch: string,
): Promise<TemplateDetail & { correlationId?: string }> {
  const path = (
    action === "archive"
      ? `/api/tenant/core/v1/templates/${encodeURIComponent(templateId)}/archive`
      : `/api/tenant/core/v1/templates/${encodeURIComponent(templateId)}/restore`
  ) as CorePath;
  const result = await corePost(path, undefined, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: WRITE_LIMIT_BYTES,
  });
  return {
    ...parseTemplateDetail(result.data),
    correlationId: result.headers.get("x-correlation-id") ?? undefined,
  };
}

/** **204**, `If-Match`. A published or assigned definition is refused. */
export async function deleteTemplate(templateId: string, ifMatch: string): Promise<void> {
  await coreDelete(templatePath(templateId), {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: WRITE_LIMIT_BYTES,
  });
}

