import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  GOVERNED_CODE_PATTERN,
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Extension profiles — 9 routes.
// docs/api/trade-advanced.md#extensions--9-routes, verified against
// trade-app/src/modules/extensions-automation/{extensions-automation.controller.ts,
// extension-profile-queries.service.ts,extension-profiles.service.ts,
// dto/extensions-automation.dto.ts}.
//
// Two shapes worth stating:
//
//   * `UpdateExtensionProfileDto` carries **only** `fields[]` and it is
//     REQUIRED — there is no partial update, so the editor always sends the
//     complete field set and a missing row is a deletion.
//   * `POST /extensions/profiles/:id/validate` is gated on
//     `trade.extensions.manage`, not on a test or read grant.

export const EXTENSION_TARGETS_PATH = "/api/tenant/trade/v1/extensions/targets";
export const EXTENSION_PROFILES_PATH = "/api/tenant/trade/v1/extensions/profiles";

export const EXTENSION_READ_PERMISSION = "trade.extensions.read";
export const EXTENSION_MANAGE_PERMISSION = "trade.extensions.manage";
export const EXTENSION_PUBLISH_PERMISSION = "trade.extensions.publish";

export const EXTENSION_PAGE_SIZE = 25;
export const EXTENSION_FIELDS_MAX = 100;
const EXTENSION_VALUE_MAX_BYTES = 16 * 1024;

/** `@IsIn` on `CreateExtensionProfileDto.targetCode`. */
export const EXTENSION_TARGET_CODES = [
  "CATALOG_ITEM",
  "QUOTATION",
  "SALES_ORDER",
  "PURCHASE_ORDER",
] as const;

/** `BRANCH` is **not** accepted on an extension profile. */
export const EXTENSION_SCOPE_TARGETS = ["TENANT", "COMPANY"] as const;

export const EXTENSION_VALUE_KINDS = ["SCALAR", "OBJECT", "COLLECTION"] as const;
export const EXTENSION_SCALAR_TYPES = [
  "STRING",
  "BOOLEAN",
  "DECIMAL",
  "DATE",
  "UUID",
  "ENUM",
] as const;
export const EXTENSION_VISIBILITY_CODES = ["INTERNAL", "USER", "EXTERNAL_SAFE"] as const;
export const EXTENSION_DEFAULT_STRATEGIES = ["NONE", "LITERAL", "OWNER_DERIVED"] as const;
export const EXTENSION_PROFILE_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;

/**
 * A **five-value subset** of the seven-value `GovernedVersionStatus`:
 * `APPROVAL_PENDING` and `SCHEDULED` are not filterable here even though the
 * enum contains them.
 */
export const EXTENSION_VERSION_STATUSES = [
  "DRAFT",
  "TESTED",
  "PUBLISHED",
  "SUPERSEDED",
  "RETIRED",
] as const;

export type ExtensionTargetCode = (typeof EXTENSION_TARGET_CODES)[number];
type ExtensionScopeTarget = (typeof EXTENSION_SCOPE_TARGETS)[number];
type ExtensionValueKind = (typeof EXTENSION_VALUE_KINDS)[number];
type ExtensionScalarType = (typeof EXTENSION_SCALAR_TYPES)[number];
type ExtensionVisibilityCode = (typeof EXTENSION_VISIBILITY_CODES)[number];
type ExtensionDefaultStrategy = (typeof EXTENSION_DEFAULT_STRATEGIES)[number];
export type ExtensionProfileStatus = (typeof EXTENSION_PROFILE_STATUSES)[number];

interface ExtensionVersion {
  id: string;
  versionNumber: number;
  version: number;
  status: string;
  definitionHash: string;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ExtensionProfile {
  id: string;
  code: string;
  targetCode: string;
  scopeTarget: string;
  status: string;
  version: number;
  updatedAt: string;
  currentPublishedVersion: ExtensionVersion | null;
  editableDraftVersion: ExtensionVersion | null;
}

export interface ExtensionField {
  id: string;
  fieldKey: string;
  valueKind: string;
  scalarType: string | null;
  isRequired: boolean;
  isSearchable: boolean;
  visibilityCode: string;
  maxLength: number | null;
  maxItems: number | null;
  decimalScale: number | null;
  minimumDecimal: string | null;
  maximumDecimal: string | null;
  defaultStrategy: string;
}

export interface ExtensionProfileDetail extends ExtensionProfile {
  currentPublishedFields: ExtensionField[];
  draftFields: ExtensionField[];
}

export interface ExtensionTargetsCatalogue {
  registryVersion: number;
  targets: Array<{ code: string }>;
  fieldsPerProfile: number;
  valueBytes: number;
}

export function extensionProfilePath(id: string): TradePath {
  if (!isUuidV7(id)) invalidExtensionResponse();
  return `${EXTENSION_PROFILES_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function extensionProfileActionPath(id: string, action: "validate" | "publish"): TradePath {
  return `${extensionProfilePath(id)}/${action}` as TradePath;
}

export function extensionProfileVersionsPath(id: string, page: number): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(EXTENSION_PAGE_SIZE) });
  return `${extensionProfilePath(id)}/versions?${query.toString()}` as TradePath;
}

export function extensionProfilesListPath(
  page: number,
  targetCode?: ExtensionTargetCode,
  status?: ExtensionProfileStatus,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(EXTENSION_PAGE_SIZE) });
  if (targetCode) query.set("targetCode", targetCode);
  if (status) query.set("status", status);
  return `${EXTENSION_PROFILES_PATH}?${query.toString()}` as TradePath;
}

export interface ExtensionFieldDraft {
  fieldKey: string;
  valueKind: ExtensionValueKind;
  scalarType: ExtensionScalarType | "";
  isRequired: boolean;
  isSearchable: boolean;
  visibilityCode: ExtensionVisibilityCode;
  maxLength: string;
  maxItems: string;
  decimalScale: string;
  minimumDecimal: string;
  maximumDecimal: string;
  defaultStrategy: ExtensionDefaultStrategy;
}

export const EMPTY_EXTENSION_FIELD_DRAFT: ExtensionFieldDraft = {
  fieldKey: "",
  valueKind: "SCALAR",
  scalarType: "STRING",
  isRequired: false,
  isSearchable: false,
  visibilityCode: "INTERNAL",
  maxLength: "",
  maxItems: "",
  decimalScale: "",
  minimumDecimal: "",
  maximumDecimal: "",
  defaultStrategy: "NONE",
};

export interface ExtensionProfileFormValues {
  code: string;
  targetCode: ExtensionTargetCode;
  scopeTarget: ExtensionScopeTarget;
  fields: ExtensionFieldDraft[];
}

export const EMPTY_EXTENSION_PROFILE_FORM: ExtensionProfileFormValues = {
  code: "",
  targetCode: "CATALOG_ITEM",
  scopeTarget: "COMPANY",
  fields: [EMPTY_EXTENSION_FIELD_DRAFT],
};

export function toFieldDrafts(fields: readonly ExtensionField[]): ExtensionFieldDraft[] {
  return fields.map((field) => ({
    fieldKey: field.fieldKey,
    valueKind: isMemberOf(field.valueKind, EXTENSION_VALUE_KINDS) ? field.valueKind : "SCALAR",
    scalarType: isMemberOf(field.scalarType, EXTENSION_SCALAR_TYPES) ? field.scalarType : "",
    isRequired: field.isRequired,
    isSearchable: field.isSearchable,
    visibilityCode: isMemberOf(field.visibilityCode, EXTENSION_VISIBILITY_CODES)
      ? field.visibilityCode
      : "INTERNAL",
    maxLength: field.maxLength === null ? "" : String(field.maxLength),
    maxItems: field.maxItems === null ? "" : String(field.maxItems),
    decimalScale: field.decimalScale === null ? "" : String(field.decimalScale),
    minimumDecimal: field.minimumDecimal ?? "",
    maximumDecimal: field.maximumDecimal ?? "",
    defaultStrategy: isMemberOf(field.defaultStrategy, EXTENSION_DEFAULT_STRATEGIES)
      ? field.defaultStrategy
      : "NONE",
  }));
}

interface ExtensionFieldBody {
  fieldKey: string;
  valueKind: ExtensionValueKind;
  visibilityCode: ExtensionVisibilityCode;
  isRequired: boolean;
  isSearchable: boolean;
  defaultStrategy: ExtensionDefaultStrategy;
  scalarType?: ExtensionScalarType;
  maxLength?: number;
  maxItems?: number;
  decimalScale?: number;
  minimumDecimal?: string;
  maximumDecimal?: string;
}

function boundedInt(raw: string, min: number, max: number): number {
  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error("EXTENSION_FORM_BOUNDS");
  }
  return parsed;
}

function buildExtensionFields(drafts: readonly ExtensionFieldDraft[]): ExtensionFieldBody[] {
  if (drafts.length < 1 || drafts.length > EXTENSION_FIELDS_MAX) {
    throw new Error("EXTENSION_FORM_FIELDS");
  }
  return drafts.map((draft) => {
    const fieldKey = draft.fieldKey.trim();
    if (fieldKey.length === 0 || fieldKey.length > 100) throw new Error("EXTENSION_FORM_FIELD_KEY");
    const body: ExtensionFieldBody = {
      fieldKey,
      valueKind: draft.valueKind,
      visibilityCode: draft.visibilityCode,
      isRequired: draft.isRequired,
      isSearchable: draft.isSearchable,
      defaultStrategy: draft.defaultStrategy,
    };
    if (draft.scalarType !== "") body.scalarType = draft.scalarType;
    if (draft.maxLength.trim().length > 0) body.maxLength = boundedInt(draft.maxLength, 1, 4096);
    if (draft.maxItems.trim().length > 0) body.maxItems = boundedInt(draft.maxItems, 1, 100);
    // `decimalScale` is 0–8, matching the eight-place decimal contract.
    if (draft.decimalScale.trim().length > 0) {
      body.decimalScale = boundedInt(draft.decimalScale, 0, 8);
    }
    if (draft.minimumDecimal.trim().length > 0) {
      if (!isDecimalString(draft.minimumDecimal.trim())) throw new Error("EXTENSION_FORM_DECIMAL");
      body.minimumDecimal = draft.minimumDecimal.trim();
    }
    if (draft.maximumDecimal.trim().length > 0) {
      if (!isDecimalString(draft.maximumDecimal.trim())) throw new Error("EXTENSION_FORM_DECIMAL");
      body.maximumDecimal = draft.maximumDecimal.trim();
    }
    return body;
  });
}

export function buildCreateExtensionProfileRequest(values: ExtensionProfileFormValues) {
  const code = values.code.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(code)) throw new Error("EXTENSION_FORM_CODE");
  return {
    code,
    targetCode: values.targetCode,
    scopeTarget: values.scopeTarget,
    fields: buildExtensionFields(values.fields),
  };
}

/** The update body is `{ fields }` and nothing else — a full replacement. */
export function buildUpdateExtensionProfileRequest(drafts: readonly ExtensionFieldDraft[]) {
  return { fields: buildExtensionFields(drafts) };
}

export function parseExtensionProfilesResponse(
  payload: unknown,
): TradeOffsetPage<ExtensionProfile> {
  return parseTradeOffsetPage(payload, parseExtensionProfile, invalidExtensionResponse);
}

function parseExtensionVersion(payload: unknown): ExtensionVersion {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isBoundedInteger(row.versionNumber, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 24) ||
    !isNonEmptyString(row.definitionHash, 128) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidExtensionResponse();
  }
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    version: row.version,
    status: row.status,
    definitionHash: row.definitionHash,
    publishedAt: isTimestamp(row.publishedAt) ? row.publishedAt : null,
    updatedAt: row.updatedAt,
  };
}

export function parseExtensionProfile(payload: unknown): ExtensionProfile {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 100) ||
    !isNonEmptyString(row.targetCode, 40) ||
    !isNonEmptyString(row.scopeTarget, 16) ||
    !isNonEmptyString(row.status, 24) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidExtensionResponse();
  }
  return {
    id: row.id,
    code: row.code,
    targetCode: row.targetCode,
    scopeTarget: row.scopeTarget,
    status: row.status,
    version: row.version,
    updatedAt: row.updatedAt,
    currentPublishedVersion: record(row.currentPublishedVersion)
      ? parseExtensionVersion(row.currentPublishedVersion)
      : null,
    editableDraftVersion: record(row.editableDraftVersion)
      ? parseExtensionVersion(row.editableDraftVersion)
      : null,
  };
}

function parseExtensionField(payload: unknown): ExtensionField {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.fieldKey, 100) ||
    !isNonEmptyString(row.valueKind, 16) ||
    !isNonEmptyString(row.visibilityCode, 16) ||
    typeof row.isRequired !== "boolean" ||
    typeof row.isSearchable !== "boolean" ||
    !isNonEmptyString(row.defaultStrategy, 16)
  ) {
    invalidExtensionResponse();
  }
  return {
    id: row.id,
    fieldKey: row.fieldKey,
    valueKind: row.valueKind,
    scalarType: typeof row.scalarType === "string" ? row.scalarType : null,
    isRequired: row.isRequired,
    isSearchable: row.isSearchable,
    visibilityCode: row.visibilityCode,
    maxLength: isBoundedInteger(row.maxLength, 1, 4096) ? row.maxLength : null,
    maxItems: isBoundedInteger(row.maxItems, 1, 100) ? row.maxItems : null,
    decimalScale: isBoundedInteger(row.decimalScale, 0, 8) ? row.decimalScale : null,
    minimumDecimal: isDecimalString(row.minimumDecimal) ? row.minimumDecimal : null,
    maximumDecimal: isDecimalString(row.maximumDecimal) ? row.maximumDecimal : null,
    defaultStrategy: row.defaultStrategy,
  };
}

function versionFields(payload: unknown): ExtensionField[] {
  const version = record(payload);
  return version && Array.isArray(version.fields)
    ? version.fields.map(parseExtensionField)
    : [];
}

export function parseExtensionProfileDetail(payload: unknown): ExtensionProfileDetail {
  const row = record(payload);
  if (!row) invalidExtensionResponse();
  return {
    ...parseExtensionProfile(payload),
    currentPublishedFields: versionFields(row.currentPublishedVersion),
    draftFields: versionFields(row.editableDraftVersion),
  };
}

export function parseExtensionTargets(payload: unknown): ExtensionTargetsCatalogue {
  const row = record(payload);
  const limits = row ? record(row.limits) : null;
  if (!row || !Array.isArray(row.targets) || !isBoundedInteger(row.registryVersion, 0, 10_000)) {
    invalidExtensionResponse();
  }
  return {
    registryVersion: row.registryVersion,
    targets: row.targets.flatMap((entry) => {
      const target = record(entry);
      return target && typeof target.code === "string" ? [{ code: target.code }] : [];
    }),
    fieldsPerProfile: isBoundedInteger(limits?.fieldsPerProfile, 1, 10_000)
      ? limits.fieldsPerProfile
      : EXTENSION_FIELDS_MAX,
    valueBytes: isBoundedInteger(limits?.valueBytes, 1, 1_000_000)
      ? limits.valueBytes
      : EXTENSION_VALUE_MAX_BYTES,
  };
}

export function extensionMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    // One code, three statuses: 404 "no such definition", 409 "conflicting
    // definition", 422 "invalid definition". The status is the only separator.
    case "TRADE.EXTENSION.DEFINITION_INVALID":
      return error.status === 404
        ? t.tradeAutomation.errorExtensionNotFound
        : error.status === 409
          ? t.tradeAutomation.errorExtensionConflict
          : t.tradeAutomation.errorExtensionInvalid;
    case "TRADE.EXTENSION.PROFILE_INCOMPATIBLE":
      return t.tradeAutomation.errorExtensionIncompatible;
    case "TRADE.EXTENSION.VALUE_INVALID":
      return t.tradeAutomation.errorExtensionValueInvalid;
    case "TRADE.EXTENSION.RESERVED_FIELD":
      return t.tradeAutomation.errorExtensionReservedField;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function extensionFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "EXTENSION_FORM_CODE":
      return t.tradeAutomation.formCodeInvalid;
    case "EXTENSION_FORM_FIELDS":
      return t.tradeAutomation.formFieldsInvalid;
    case "EXTENSION_FORM_FIELD_KEY":
      return t.tradeAutomation.formFieldKeyInvalid;
    case "EXTENSION_FORM_BOUNDS":
      return t.tradeAutomation.formBoundsInvalid;
    case "EXTENSION_FORM_DECIMAL":
      return t.tradeAutomation.formDecimalInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}

export function isExtensionTargetCode(value: unknown): value is ExtensionTargetCode {
  return isMemberOf(value, EXTENSION_TARGET_CODES);
}

export function isExtensionProfileStatus(value: unknown): value is ExtensionProfileStatus {
  return isMemberOf(value, EXTENSION_PROFILE_STATUSES);
}

export function invalidExtensionResponse(): never {
  throw new Error("Invalid Trade extension response.");
}
