import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  GOVERNED_CODE_PATTERN,
  isBoundedInteger,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Document profiles — 5 routes.
// docs/api/trade-advanced.md#document-profiles--5-routes, verified against
// trade-app/src/modules/document-platform/{document-profile.controller.ts,
// document-profile.service.ts,dto/document-profile.dto.ts}.
//
// **There is no GET for a profile or a profile version by id** (Q38). The list
// is the only read, and it embeds `versions[]` through `projectVersion`, so
// every action on this page is driven from a list row. No detail route exists
// and none is fabricated.
//
// S6 cannot be satisfied: Trade has no capabilities endpoint (Q30).

export const DOCUMENT_PROFILES_PATH = "/api/tenant/trade/v1/document-profiles";

// `/document-profile-versions` exposes only `/:id/validate` and
// `/:id/publish` — there is no bare route and no GET by id (Q38) — so the two
// action paths are written as full literals rather than built from a prefix.

export const DOCUMENT_PROFILE_READ_PERMISSION = "trade.document_profiles.read";
export const DOCUMENT_PROFILE_MANAGE_PERMISSION = "trade.document_profiles.manage";
export const DOCUMENT_PROFILE_VALIDATE_PERMISSION = "trade.document_profiles.validate";
export const DOCUMENT_PROFILE_PUBLISH_PERMISSION = "trade.document_profiles.publish";

export const DOCUMENT_PROFILE_PAGE_SIZE = 25;
const REQUIRED_CASES_MAX = 20;
/**
 * `CreateDocumentProfileDto` accepts only three of the six
 * `TradeDocumentFamily` members. The list filter uses the full enum, so a
 * profile can be **filtered for** but never **created for** the other three.
 */
export const CREATABLE_DOCUMENT_TYPES = [
  "QUOTATION",
  "SALES_ORDER",
  "PURCHASE_ORDER",
] as const;

export const FILTERABLE_DOCUMENT_TYPES = [
  ...CREATABLE_DOCUMENT_TYPES,
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "POS_SALE",
] as const;

type CreatableDocumentType = (typeof CREATABLE_DOCUMENT_TYPES)[number];

export const DOCUMENT_PROFILE_SCOPE_TARGETS = ["TENANT", "COMPANY", "BRANCH"] as const;
type DocumentProfileScopeTarget = (typeof DOCUMENT_PROFILE_SCOPE_TARGETS)[number];

export interface DocumentProfileVersion {
  id: string;
  profileVersion: number;
  status: string;
  checksum: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
}

export interface DocumentProfile {
  id: string;
  code: string;
  documentType: string;
  scopeTarget: string;
  version: number;
  versions: DocumentProfileVersion[];
}

export function documentProfileVersionsPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidDocumentProfileResponse();
  return `${DOCUMENT_PROFILES_PATH}/${encodeURIComponent(id)}/versions` as TradePath;
}

export function documentProfileVersionActionPath(
  id: string,
  action: "validate" | "publish",
): TradePath {
  if (!isUuidV7(id)) invalidDocumentProfileResponse();
  const encoded = encodeURIComponent(id);
  return action === "validate"
    ? (`/api/tenant/trade/v1/document-profile-versions/${encoded}/validate` as TradePath)
    : (`/api/tenant/trade/v1/document-profile-versions/${encoded}/publish` as TradePath);
}

export function documentProfilesListPath(
  page: number,
  documentType?: string,
  versionStatus?: string,
): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(DOCUMENT_PROFILE_PAGE_SIZE),
  });
  if (documentType) query.set("documentType", documentType);
  if (versionStatus) query.set("versionStatus", versionStatus);
  return `${DOCUMENT_PROFILES_PATH}?${query.toString()}` as TradePath;
}

export interface DocumentProfileFormValues {
  code: string;
  documentType: CreatableDocumentType;
  scopeTarget: DocumentProfileScopeTarget;
}

export const EMPTY_DOCUMENT_PROFILE_FORM: DocumentProfileFormValues = {
  code: "",
  documentType: "QUOTATION",
  scopeTarget: "COMPANY",
};

export interface DocumentProfileVersionFormValues {
  content: string;
  requiredCases: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export const EMPTY_DOCUMENT_PROFILE_VERSION_FORM: DocumentProfileVersionFormValues = {
  content: "{}",
  requiredCases: "[]",
  effectiveFrom: "",
  effectiveTo: "",
};

export function buildCreateDocumentProfileRequest(values: DocumentProfileFormValues) {
  const code = values.code.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(code)) throw new Error("DOCUMENT_PROFILE_FORM_CODE");
  return { code, documentType: values.documentType, scopeTarget: values.scopeTarget };
}

function jsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("DOCUMENT_PROFILE_FORM_CONTENT");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("DOCUMENT_PROFILE_FORM_CONTENT");
  }
}

function isoInstant(value: string): string {
  const parsed = new Date(value);
  if (value.trim().length === 0 || Number.isNaN(parsed.getTime())) {
    throw new Error("DOCUMENT_PROFILE_FORM_DATE");
  }
  return parsed.toISOString();
}

/** `requiredCases` is optional here and defaults to `[]` — unlike the policy ladder. */
export function buildCreateDocumentProfileVersionRequest(
  values: DocumentProfileVersionFormValues,
): {
  content: Record<string, unknown>;
  requiredCases: unknown[];
  effectiveFrom: string;
  effectiveTo?: string;
} {
  let requiredCases: unknown;
  try {
    requiredCases = JSON.parse(values.requiredCases);
  } catch {
    throw new Error("DOCUMENT_PROFILE_FORM_CASES");
  }
  if (!Array.isArray(requiredCases) || requiredCases.length > REQUIRED_CASES_MAX) {
    throw new Error("DOCUMENT_PROFILE_FORM_CASES");
  }
  const request = {
    content: jsonObject(values.content),
    requiredCases,
    effectiveFrom: isoInstant(values.effectiveFrom),
  };
  return values.effectiveTo.trim().length > 0
    ? { ...request, effectiveTo: isoInstant(values.effectiveTo) }
    : request;
}

/**
 * `PublishDocumentProfileVersionDto.expectedActivePointerVersion` is an
 * **int ≥ 0 and required** — a second optimistic-concurrency token in the
 * body, on top of `If-Match`. This is the only Trade route that needs two, and
 * both must be current or the publish fails.
 */
export function buildPublishDocumentProfileVersionRequest(raw: string): {
  expectedActivePointerVersion: number;
} {
  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("DOCUMENT_PROFILE_FORM_POINTER");
  }
  return { expectedActivePointerVersion: parsed };
}

export function parseDocumentProfilesResponse(
  payload: unknown,
): TradeOffsetPage<DocumentProfile> {
  return parseTradeOffsetPage(payload, parseDocumentProfile, invalidDocumentProfileResponse);
}

function parseDocumentProfile(payload: unknown): DocumentProfile {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 100) ||
    !isNonEmptyString(row.documentType, 32) ||
    !isNonEmptyString(row.scopeTarget, 16) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidDocumentProfileResponse();
  }
  return {
    id: row.id,
    code: row.code,
    documentType: row.documentType,
    scopeTarget: row.scopeTarget,
    version: row.version,
    versions: Array.isArray(row.versions) ? row.versions.map(parseDocumentProfileVersion) : [],
  };
}

function parseDocumentProfileVersion(payload: unknown): DocumentProfileVersion {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isBoundedInteger(row.profileVersion, 1, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 24) ||
    !isNonEmptyString(row.checksum, 128) ||
    !isTimestamp(row.effectiveFrom) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidDocumentProfileResponse();
  }
  return {
    id: row.id,
    profileVersion: row.profileVersion,
    status: row.status,
    checksum: row.checksum,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: isTimestamp(row.effectiveTo) ? row.effectiveTo : null,
    version: row.version,
  };
}

export function documentProfileMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.DOCUMENT_PROFILE.NOT_FOUND":
      return t.tradeGovernance.errorProfileNotFound;
    case "TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN":
      return t.tradeGovernance.errorProfileIdentityTaken;
    case "TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID":
      return t.tradeGovernance.errorProfileSchemaInvalid;
    case "TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED":
      return t.tradeGovernance.errorProfileScopeNotAllowed;
    case "TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED":
      return t.tradeGovernance.errorProfileCompatibility;
    case "TRADE.DOCUMENT_PROFILE.REQUIRED_CASES_FAILED":
      return t.tradeGovernance.errorProfileRequiredCases;
    case "TRADE.DOCUMENT_PROFILE.VALIDATION_LIMIT_EXCEEDED":
      return t.tradeGovernance.errorProfileValidationLimit;
    case "TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY":
      return t.tradeGovernance.errorProfilePublishNotReady;
    case "TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE":
      return t.tradeGovernance.errorProfilePublicationUnavailable;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function documentProfileFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "DOCUMENT_PROFILE_FORM_CODE":
      return t.tradeGovernance.formCodeInvalid;
    case "DOCUMENT_PROFILE_FORM_CONTENT":
      return t.tradeGovernance.formContentInvalid;
    case "DOCUMENT_PROFILE_FORM_CASES":
      return t.tradeGovernance.formRequiredCasesInvalid;
    case "DOCUMENT_PROFILE_FORM_DATE":
      return t.tradeGovernance.formDateInvalid;
    case "DOCUMENT_PROFILE_FORM_POINTER":
      return t.tradeGovernance.formPointerInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}

function invalidDocumentProfileResponse(): never {
  throw new Error("Invalid Trade document profile response.");
}
