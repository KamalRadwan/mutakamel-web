import type { TradePath } from "@/lib/api/envelope";
import {
  GOVERNED_CODE_PATTERN,
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Import mappings — 4 of the 11 import routes.
//
// **The API page names this field `mappingKind`; source calls it `targetCode`.**
// `CreateImportMappingDto` in
// trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts
// declares `@IsIn(["CATALOG_COMPANY_PROFILE","CATALOG_BRANCH_ASSIGNMENT"])
// targetCode!: string` — the accepted values match the page, the key does not.
// `projectMapping` returns `targetCode` as well. Sending `mappingKind` would be
// a 400 under `forbidNonWhitelisted`, so this file uses `targetCode`. Recorded
// as Q92.
//
// All four routes need `trade.import.manage` — including the reads, which is
// the mirror of the runs screen needing `trade.import.execute` for its reads.

export const IMPORT_MAPPINGS_PATH = "/api/tenant/trade/v1/import-mappings";

export const IMPORT_MAPPING_PAGE_SIZE = 50;
export const IMPORT_MAPPING_FIELDS_MAX = 200;

export const IMPORT_MAPPING_TARGET_CODES = [
  "CATALOG_COMPANY_PROFILE",
  "CATALOG_BRANCH_ASSIGNMENT",
] as const;

// `executionMode` is `@IsIn(["PER_ROW"])` — one value, sent automatically by
// the two request builders below rather than offered as a choice.

export const IMPORT_MAPPING_SCOPE_TARGETS = ["COMPANY", "BRANCH"] as const;
export const IMPORT_MAPPING_STATUSES = ["DRAFT", "ACTIVE"] as const;

export const IMPORT_TRANSFORM_CODES = [
  "IDENTITY",
  "TRIM",
  "PARSE_DECIMAL",
  "PARSE_DATE",
  "NORMALIZE_CODE",
  "ENUM_MAP",
] as const;

type ImportMappingTargetCode = (typeof IMPORT_MAPPING_TARGET_CODES)[number];
type ImportMappingScopeTarget = (typeof IMPORT_MAPPING_SCOPE_TARGETS)[number];
export type ImportMappingStatus = (typeof IMPORT_MAPPING_STATUSES)[number];
type ImportTransformCode = (typeof IMPORT_TRANSFORM_CODES)[number];

export interface ImportMapping {
  id: string;
  code: string;
  targetCode: string;
  scopeTarget: string;
  branchId: string | null;
  status: string;
  version: number;
  updatedAt: string;
}

export function importMappingPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidImportMappingResponse();
  return `${IMPORT_MAPPINGS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function importMappingsListPath(
  page: number,
  status?: ImportMappingStatus,
): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(IMPORT_MAPPING_PAGE_SIZE),
  });
  if (status) query.set("status", status);
  return `${IMPORT_MAPPINGS_PATH}?${query.toString()}` as TradePath;
}

export interface ImportMappingFieldDraft {
  sourceColumnCode: string;
  sourceOrdinal: string;
  targetFieldCode: string;
  transformCode: ImportTransformCode;
  isRequired: boolean;
}

export const EMPTY_IMPORT_MAPPING_FIELD: ImportMappingFieldDraft = {
  sourceColumnCode: "",
  sourceOrdinal: "0",
  targetFieldCode: "",
  transformCode: "IDENTITY",
  isRequired: false,
};

export interface ImportMappingFormValues {
  code: string;
  targetCode: ImportMappingTargetCode;
  scopeTarget: ImportMappingScopeTarget;
  fields: ImportMappingFieldDraft[];
}

export const EMPTY_IMPORT_MAPPING_FORM: ImportMappingFormValues = {
  code: "",
  targetCode: "CATALOG_COMPANY_PROFILE",
  scopeTarget: "COMPANY",
  fields: [EMPTY_IMPORT_MAPPING_FIELD],
};

interface MappingFieldBody {
  sourceColumnCode: string;
  sourceOrdinal: number;
  targetFieldCode: string;
  transformCode: ImportTransformCode;
  isRequired: boolean;
}

function buildFields(drafts: readonly ImportMappingFieldDraft[]): MappingFieldBody[] {
  if (drafts.length < 1 || drafts.length > IMPORT_MAPPING_FIELDS_MAX) {
    throw new Error("IMPORT_MAPPING_FORM_FIELDS");
  }
  return drafts.map((draft) => {
    const sourceColumnCode = draft.sourceColumnCode.trim();
    const targetFieldCode = draft.targetFieldCode.trim();
    if (sourceColumnCode.length === 0 || targetFieldCode.length === 0) {
      throw new Error("IMPORT_MAPPING_FORM_FIELDS");
    }
    const sourceOrdinal = Number(draft.sourceOrdinal.trim());
    if (!Number.isSafeInteger(sourceOrdinal) || sourceOrdinal < 0 || sourceOrdinal > 999) {
      throw new Error("IMPORT_MAPPING_FORM_ORDINAL");
    }
    return {
      sourceColumnCode,
      sourceOrdinal,
      targetFieldCode,
      transformCode: draft.transformCode,
      isRequired: draft.isRequired,
    };
  });
}

export function buildCreateImportMappingRequest(values: ImportMappingFormValues) {
  const code = values.code.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(code)) throw new Error("IMPORT_MAPPING_FORM_CODE");
  return {
    code,
    targetCode: values.targetCode,
    scopeTarget: values.scopeTarget,
    executionMode: "PER_ROW",
    fields: buildFields(values.fields),
  };
}

/** `UpdateImportMappingDto` is a full replacement: both keys are required. */
export function buildUpdateImportMappingRequest(fields: readonly ImportMappingFieldDraft[]) {
  return { executionMode: "PER_ROW", fields: buildFields(fields) };
}

export function parseImportMappingsResponse(payload: unknown): TradeOffsetPage<ImportMapping> {
  return parseTradeOffsetPage(payload, parseImportMapping, invalidImportMappingResponse);
}

function parseImportMapping(payload: unknown): ImportMapping {
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
    invalidImportMappingResponse();
  }
  return {
    id: row.id,
    code: row.code,
    targetCode: row.targetCode,
    scopeTarget: row.scopeTarget,
    branchId: isUuidV7(row.branchId) ? row.branchId : null,
    status: row.status,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

interface ImportMappingVersion {
  id: string;
  versionNumber: number;
  status: string;
  executionMode: string;
  publishedAt: string | null;
  fields: ImportMappingFieldRow[];
}

export interface ImportMappingFieldRow {
  sourceColumnCode: string;
  sourceOrdinal: number;
  targetFieldCode: string;
  transformCode: string;
  isRequired: boolean;
}

export interface ImportMappingDetail extends ImportMapping {
  versions: ImportMappingVersion[];
}

export function parseImportMappingDetail(payload: unknown): ImportMappingDetail {
  const row = record(payload);
  if (!row || !Array.isArray(row.versions)) invalidImportMappingResponse();
  return {
    ...parseImportMapping(payload),
    versions: row.versions.map((entry) => {
      const version = record(entry);
      if (
        !version ||
        !isUuidV7(version.id) ||
        !isBoundedInteger(version.versionNumber, 1, Number.MAX_SAFE_INTEGER) ||
        !isNonEmptyString(version.status, 24) ||
        !isNonEmptyString(version.executionMode, 24) ||
        !Array.isArray(version.fields)
      ) {
        invalidImportMappingResponse();
      }
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        executionMode: version.executionMode,
        publishedAt: isTimestamp(version.publishedAt) ? version.publishedAt : null,
        fields: version.fields.map(parseImportMappingFieldRow),
      };
    }),
  };
}

function parseImportMappingFieldRow(payload: unknown): ImportMappingFieldRow {
  const row = record(payload);
  if (
    !row ||
    !isNonEmptyString(row.sourceColumnCode, 120) ||
    !isBoundedInteger(row.sourceOrdinal, 0, 999) ||
    !isNonEmptyString(row.targetFieldCode, 120) ||
    !isNonEmptyString(row.transformCode, 40) ||
    typeof row.isRequired !== "boolean"
  ) {
    invalidImportMappingResponse();
  }
  return {
    sourceColumnCode: row.sourceColumnCode,
    sourceOrdinal: row.sourceOrdinal,
    targetFieldCode: row.targetFieldCode,
    transformCode: row.transformCode,
    isRequired: row.isRequired,
  };
}

export function toMappingFieldDrafts(
  fields: readonly ImportMappingFieldRow[],
): ImportMappingFieldDraft[] {
  return fields.map((field) => ({
    sourceColumnCode: field.sourceColumnCode,
    sourceOrdinal: String(field.sourceOrdinal),
    targetFieldCode: field.targetFieldCode,
    transformCode: isMemberOf(field.transformCode, IMPORT_TRANSFORM_CODES)
      ? field.transformCode
      : "IDENTITY",
    isRequired: field.isRequired,
  }));
}

export function isImportMappingStatus(value: unknown): value is ImportMappingStatus {
  return isMemberOf(value, IMPORT_MAPPING_STATUSES);
}

function invalidImportMappingResponse(): never {
  throw new Error("Invalid Trade import mapping response.");
}
