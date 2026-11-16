import { parseTemplateSourceTuple, parseTemplateDocumentIdentity } from "./template-source-metadata";
import type { CorePath } from "@/lib/api/envelope";
import {
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";

// The template platform: 41 routes, two gates, and a pagination dialect that is
// unlike the rest of Core.
//
// Source: core-app/src/tenant/template-platform/template-platform.controller.ts,
// dto/template-platform.dto.ts, read-model/template-platform-read.types.ts,
// template-platform.errors.ts.

export const TEMPLATES_PATH = "/api/tenant/core/v1/templates";
export const TEMPLATES_SEARCH_PATH = "/api/tenant/core/v1/templates/search";
export const TEMPLATE_STARTERS_PATH = "/api/tenant/core/v1/templates/starters";
export const TEMPLATE_CREATION_SCOPES_PATH = "/api/tenant/core/v1/templates/creation-scopes";

export const TEMPLATE_READ_PERMISSION = "templates.read";
export const TEMPLATE_CREATE_PERMISSION = "templates.create";
export const TEMPLATE_UPDATE_PERMISSION = "templates.update";
export const TEMPLATE_PUBLISH_PERMISSION = "templates.publish";
export const TEMPLATE_ARCHIVE_PERMISSION = "templates.archive";
export const TEMPLATE_RESTORE_PERMISSION = "templates.restore";
export const TEMPLATE_PREVIEW_PERMISSION = "templates.preview";
export const TEMPLATE_ASSETS_PERMISSION = "templates.assets.manage";
export const TEMPLATE_ASSIGNMENTS_PERMISSION = "templates.assignments.manage";

/**
 * `SubscriptionEnforcementGuard.blocked()` — the entitlement 403 raised when a
 * tenant lacks `core.template_designer`. It is not a permission failure, so it
 * goes to the unavailable surface rather than `PermissionGate`.
 */
export const ACCESS_POLICY_BLOCKED_CODE = "ACCESS_POLICY_BLOCKED";

export {
  TEMPLATE_DOCUMENT_TYPES, TEMPLATE_OUTPUT_CHANNELS, TEMPLATE_LAYOUT_MODES, TEMPLATE_ADAPTER_KEYS,
} from "./template-source-metadata";
export const TEMPLATE_DIRECTIONS = ["AUTO", "LTR", "RTL"] as const;
export const TEMPLATE_LOCALES = ["ar-EG", "en-US"] as const;
export const TEMPLATE_SCOPE_TYPES = ["TENANT", "COMPANY", "BRANCH"] as const;
export const TEMPLATE_LIFECYCLE_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
/** `publicValidationState` maps VALID/INVALID to PASSED/FAILED on the wire. */
const TEMPLATE_VALIDATION_STATES = [
  "NOT_VALIDATED",
  "PASSED",
  "FAILED",
  "STALE",
] as const;
/** `TemplateListRequestDto.sortBy` — anything else is a 422. */
export type TemplateSortField =
  | "updatedAt"
  | "createdAt"
  | "code"
  | "name"
  | "publishedVersionNumber";

export type { TemplateDocumentType, TemplateOutputChannel, TemplateLayoutMode, TemplateAdapterKey } from "./template-source-metadata";
export type TemplateDirection = (typeof TEMPLATE_DIRECTIONS)[number];
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];
export type TemplateScopeType = (typeof TEMPLATE_SCOPE_TYPES)[number];
type TemplateValidationState = (typeof TEMPLATE_VALIDATION_STATES)[number];

export const TEMPLATE_NAME_MAX = 200;
export const TEMPLATE_CODE_MAX = 100;
export const TEMPLATE_DESCRIPTION_MAX = 1000;
/** `CursorQueryDto` — `@MaxLength(2048)`, and the value is opaque. */
const TEMPLATE_CURSOR_MAX = 2048;
export const TEMPLATE_PAGE_LIMIT = 25;

export interface TemplateScope {
  type: TemplateScopeType;
  companyId?: string;
  branchId?: string;
}

interface TemplateDraftSummary {
  draftId: string;
  revision: number;
  validationState: TemplateValidationState;
}

interface TemplatePublishedVersion {
  versionId: string;
  versionNumber: number;
  publishedAt: string;
}

export interface TemplateListItem {
  id: string;
  code: string;
  name: string;
  documentType: string;
  outputChannel: string;
  layoutMode: string;
  lifecycleStatus: string;
  locale: string;
  direction: string;
  draft: TemplateDraftSummary;
  currentPublishedVersion: TemplatePublishedVersion | null;
  definitionRevision: number;
  definitionEtag: string;
  updatedAt: string;
}

export interface TemplateCursorPage<T> {
  items: T[];
  /**
   * Opaque, HMAC-signed, 15-minute TTL, fingerprint-bound.
   *
   * It is stored in memory and passed back **byte for byte**: parsing,
   * re-encoding or persisting it across a reload invalidates it, and the
   * correct response to a rejected cursor is to restart the list, never to
   * retry with the same value.
   */
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
  totalCount: number | null;
}

export type TemplatePdfPreviewCapability =
  | { readonly state: "ENABLED" | "HIDDEN"; readonly reason: null }
  | { readonly state: "DISABLED"; readonly reason: "ARCHIVED" | "ACCESS_POLICY_READ_ONLY" };

export interface TemplateDetail extends TemplateListItem {
  description: string | null;
  dataSourceKey: string;
  scope: TemplateScope;
  systemProtected: boolean;
  /** Core's PDF create capability. Older or invalid evidence leaves it absent. */
  previewPdf?: TemplatePdfPreviewCapability;
  /** Core's definition-scoped asset write grant, when explicitly enabled. */
  manageAssets?: { readonly state: "ENABLED"; readonly reason: null };
  /** The `If-Match` value for every definition-level write. */
  etag: string;
  currentDraft: {
    draftId: string;
    revision: number;
    contentChecksum: string;
    validationState: TemplateValidationState;
    etag: string;
  };
  createdAt: string;
}

function optionalScope(value: unknown): TemplateScope {
  const scope = record(value);
  if (!scope || !isMember(TEMPLATE_SCOPE_TYPES, scope.type)) invalidCoreResponse();
  return {
    type: scope.type,
    companyId: nullableUuidV7(scope, "companyId") ?? undefined,
    branchId: nullableUuidV7(scope, "branchId") ?? undefined,
  };
}

function parseDraftSummary(value: unknown): TemplateDraftSummary {
  const draft = record(value);
  if (!draft) invalidCoreResponse();
  const revision = draft.revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 1) invalidCoreResponse();
  return {
    draftId: requiredUuidV7(draft, "draftId"),
    revision: revision as number,
    // An unrecognised state must not take the list down — it degrades to the
    // "not validated" label rather than throwing.
    validationState: isMember(TEMPLATE_VALIDATION_STATES, draft.validationState)
      ? draft.validationState
      : "NOT_VALIDATED",
  };
}

function parsePublishedVersion(value: unknown): TemplatePublishedVersion | null {
  if (value === null || value === undefined) return null;
  const version = record(value);
  if (!version) invalidCoreResponse();
  const hasCoreId = Object.hasOwn(version, "templateVersionId");
  const hasLegacyId = Object.hasOwn(version, "versionId");
  if (!hasCoreId && !hasLegacyId) invalidCoreResponse();
  const versionId = requiredUuidV7(version, hasCoreId ? "templateVersionId" : "versionId");
  if (hasCoreId && hasLegacyId && requiredUuidV7(version, "versionId") !== versionId) invalidCoreResponse();
  const number = version.versionNumber;
  if (!Number.isSafeInteger(number) || (number as number) < 1) invalidCoreResponse();
  return {
    versionId,
    versionNumber: number as number,
    publishedAt: requiredTimestamp(version, "publishedAt"),
  };
}

function positiveInteger(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidCoreResponse();
  return value as number;
}

export function parseTemplateListItem(payload: unknown): TemplateListItem {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const identity = parseTemplateDocumentIdentity(row);
  return {
    id: requiredUuidV7(row, "templateId"),
    code: requiredText(row, "code", TEMPLATE_CODE_MAX),
    name: requiredText(row, "name", TEMPLATE_NAME_MAX),
    documentType: identity.documentType,
    outputChannel: identity.outputChannel,
    layoutMode: identity.layoutMode,
    lifecycleStatus: requiredText(row, "lifecycleStatus", 16),
    locale: requiredText(row, "locale", 35),
    direction: requiredText(row, "direction", 8),
    draft: parseDraftSummary(row.draft),
    currentPublishedVersion: parsePublishedVersion(row.currentPublishedVersion),
    definitionRevision: positiveInteger(row, "definitionRevision"),
    definitionEtag: requiredText(row, "definitionEtag", 64),
    updatedAt: requiredTimestamp(row, "updatedAt"),
  };
}

function parsePdfPreviewCapability(value: unknown): TemplatePdfPreviewCapability | undefined {
  const capabilities = record(value);
  if (!capabilities || !Object.hasOwn(capabilities, "previewPdf")) return undefined;
  const capability = record(capabilities.previewPdf);
  if (!capability || Object.keys(capability).length !== 2 ||
    !Object.hasOwn(capability, "state") || !Object.hasOwn(capability, "reason")) return undefined;
  const { state, reason } = capability;
  if ((state === "ENABLED" || state === "HIDDEN") && reason === null) return { state, reason };
  if (state === "DISABLED" && (reason === "ARCHIVED" || reason === "ACCESS_POLICY_READ_ONLY")) return { state, reason };
  return undefined;
}

export function parseTemplateDetail(payload: unknown): TemplateDetail {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const draft = record(row.currentDraft);
  if (!draft) invalidCoreResponse();
  const revision = positiveInteger(row, "revision");
  const identity = parseTemplateSourceTuple(row);
  const previewPdf = parsePdfPreviewCapability(row.capabilities);
  const assetCapability = record(record(row.capabilities)?.manageAssets);
  const manageAssets = assetCapability && Object.keys(assetCapability).length === 2 &&
    assetCapability.state === "ENABLED" && assetCapability.reason === null ? { state: "ENABLED", reason: null } as const : undefined;
  return {
    id: requiredUuidV7(row, "templateId"),
    code: requiredText(row, "code", TEMPLATE_CODE_MAX),
    name: requiredText(row, "name", TEMPLATE_NAME_MAX),
    description: nullableText(row, "description", TEMPLATE_DESCRIPTION_MAX),
    documentType: identity.documentType,
    outputChannel: identity.outputChannel,
    layoutMode: identity.layoutMode,
    dataSourceKey: identity.dataSourceKey,
    lifecycleStatus: requiredText(row, "lifecycleStatus", 16),
    locale: requiredText(row, "locale", 35),
    direction: requiredText(row, "direction", 8),
    scope: optionalScope(row.scope),
    systemProtected: requiredBoolean(row, "systemProtected"),
    ...(previewPdf ? { previewPdf } : {}),
    ...(manageAssets ? { manageAssets } : {}),
    definitionRevision: revision,
    definitionEtag: requiredText(row, "etag", 64),
    etag: requiredText(row, "etag", 64),
    draft: {
      draftId: requiredUuidV7(draft, "draftId"),
      revision: positiveInteger(draft, "revision"),
      validationState: isMember(TEMPLATE_VALIDATION_STATES, draft.validationState)
        ? draft.validationState
        : "NOT_VALIDATED",
    },
    currentDraft: {
      draftId: requiredUuidV7(draft, "draftId"),
      revision: positiveInteger(draft, "revision"),
      contentChecksum: requiredText(draft, "contentChecksum", 128),
      validationState: isMember(TEMPLATE_VALIDATION_STATES, draft.validationState)
        ? draft.validationState
        : "NOT_VALIDATED",
      etag: requiredText(draft, "etag", 64),
    },
    currentPublishedVersion: parsePublishedVersion(row.currentPublishedVersion),
    createdAt: requiredTimestamp(row, "createdAt"),
    updatedAt: requiredTimestamp(row, "updatedAt"),
  };
}

/** Admit the raw list/search wire before removing supported Core wrapping.
 * SuccessResponseDto, ApiErrorDto and Gateway Problem Details carry distinct
 * signals; none of the error shapes can establish an authorized cursor page. */
export function parseTemplateCursorResponse<T>(
  response: { status: number; data: unknown },
  parseItem: (value: unknown) => T,
): TemplateCursorPage<T> {
  if (response.status !== 200) invalidCoreResponse();
  const outer = record(response.data);
  if (!outer) invalidCoreResponse();
  const wrapped = Object.hasOwn(outer, "data");
  if (wrapped && Object.hasOwn(outer, "items")) invalidCoreResponse();
  const page = wrapped ? record(outer.data) : outer;
  if (!page || Object.hasOwn(page, "data")) invalidCoreResponse();
  for (const layer of wrapped ? [outer, page] : [outer]) {
    if ((Object.hasOwn(layer, "success") && layer.success !== true) ||
      (Object.hasOwn(layer, "statusCode") && layer.statusCode !== response.status) ||
      (Object.hasOwn(layer, "status") && layer.status !== response.status) ||
      ["errorCode", "code", "errorCategory", "errors", "details", "type", "title", "detail"].some(key => Object.hasOwn(layer, key))) {
      invalidCoreResponse();
    }
  }
  return parseTemplateCursorPage(page, parseItem);
}

export function parseTemplateCursorPage<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
): TemplateCursorPage<T> {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidCoreResponse();
  const pageInfo = record(body.pageInfo);
  if (!pageInfo) invalidCoreResponse();
  const nextCursor = pageInfo.nextCursor;
  if (
    nextCursor !== null &&
    nextCursor !== undefined &&
    (typeof nextCursor !== "string" || nextCursor.length > TEMPLATE_CURSOR_MAX)
  ) {
    invalidCoreResponse();
  }
  const total = body.totalCount;
  const limit = positiveInteger(pageInfo, "limit");
  const hasNextPage = requiredBoolean(pageInfo, "hasNextPage");
  // CursorQueryDto caps every template catalogue at 100 rows.
  if (limit > 100 || body.items.length > limit ||
    (hasNextPage ? typeof nextCursor !== "string" || nextCursor.length === 0 : nextCursor != null) ||
    (total != null && (!Number.isSafeInteger(total) || (total as number) < 0))) invalidCoreResponse();
  return {
    items: body.items.map(parseItem),
    // Preserved exactly as received — never re-encoded.
    nextCursor: (nextCursor as string | null | undefined) ?? null,
    hasNextPage,
    limit,
    totalCount: Number.isSafeInteger(total) ? (total as number) : null,
  };
}

export function templatePath(templateId: string): CorePath {
  if (!/^[0-9a-f-]{36}$/iu.test(templateId)) invalidCoreResponse();
  return `/api/tenant/core/v1/templates/${encodeURIComponent(templateId)}`;
}
