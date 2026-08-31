import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { isUUIDv7 } from "@/lib/uuid";
import {
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Import runs, sources and results — 7 of the 11 import routes (the other four
// are import mappings). docs/api/trade-advanced.md#imports--11-routes, verified
// against trade-app/src/modules/extensions-automation/{import-mappings.service.ts,
// import-source.service.ts,extensions-automation.controller.ts}.
//
// Three contract facts this screen is built around:
//
//   1. **The list and detail reads need `trade.import.execute`, not
//      `.manage`.** A user who may configure mappings cannot see the runs, and
//      there is no read-only import grant.
//   2. **The 202s are not completion.** `preview`, `execute` and `release` all
//      answer 202 with no `Location` header and no operation resource: the run
//      id is in the body and `GET /imports/:runId` is the only way to learn
//      what happened.
//   3. **There is no download route for results** (Q39). `GET /imports/:runId/
//      results` is a paginated JSON list and nothing else, so the outcome is
//      rendered in the page and no download control is offered.

export const IMPORTS_PATH = "/api/tenant/trade/v1/imports";
export const IMPORT_SOURCES_PATH = "/api/tenant/trade/v1/imports/sources";
export const IMPORT_PREVIEW_PATH = "/api/tenant/trade/v1/imports/preview";

export const IMPORT_EXECUTE_PERMISSION = "trade.import.execute";
export const IMPORT_MANAGE_PERMISSION = "trade.import.manage";

export const IMPORT_PAGE_SIZE = 50;
/** `TRADE_IMPORT_SOURCE_MAX_BYTES` — 50 MiB. */
export const IMPORT_SOURCE_MAX_BYTES = 50 * 1024 * 1024;
/** One part, named exactly `file`; `fields: 0` forbids any other form field. */
export const IMPORT_SOURCE_FIELD_NAME = "file";
export const IMPORT_SOURCE_ACCEPT = [".csv", ".xlsx"];

export const IMPORT_RUN_STATUSES = [
  "PENDING",
  "PREVIEWING",
  "PREVIEWED",
  "EXECUTING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
] as const;

/**
 * Five row statuses across two phases: a **preview** produces `VALID` and
 * `INVALID`; an **execute** produces `SUCCEEDED`, `FAILED` and `SKIPPED`. All
 * five render — the plan's "succeeded / failed / skipped" is the execute phase
 * only.
 */
export const IMPORT_RESULT_STATUSES = [
  "VALID",
  "INVALID",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
] as const;

export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];
export type ImportResultStatus = (typeof IMPORT_RESULT_STATUSES)[number];

/** A run is still moving while it is in one of these. */
export const IN_FLIGHT_RUN_STATUSES: readonly string[] = [
  "PENDING",
  "PREVIEWING",
  "EXECUTING",
];

export interface ImportRun {
  id: string;
  mappingId: string;
  sourceId: string;
  mediaType: string;
  fileSizeBytes: number;
  mode: string;
  status: string;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  succeededCount: number;
  failedCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResultRow {
  rowNumber: number;
  stableRowKey: string;
  status: string;
  errorCode: string | null;
  errorFieldCode: string | null;
  completedAt: string | null;
}

export function importRunPath(runId: string): TradePath {
  if (!isUuidV7(runId)) invalidImportResponse();
  return `${IMPORTS_PATH}/${encodeURIComponent(runId)}` as TradePath;
}

export function importRunExecutePath(runId: string): TradePath {
  return `${importRunPath(runId)}/execute` as TradePath;
}

export function importRunResultsPath(
  runId: string,
  page: number,
  status?: ImportResultStatus,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(IMPORT_PAGE_SIZE) });
  if (status) query.set("status", status);
  return `${importRunPath(runId)}/results?${query.toString()}` as TradePath;
}

export function importSourceReleasePath(sourceId: string): TradePath {
  if (!isUuidV7(sourceId)) invalidImportResponse();
  return `${IMPORT_SOURCES_PATH}/${encodeURIComponent(sourceId)}/release` as TradePath;
}

export function importRunsListPath(
  page: number,
  status?: ImportRunStatus,
  mappingId?: string,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(IMPORT_PAGE_SIZE) });
  if (status) query.set("status", status);
  if (mappingId) query.set("mappingId", mappingId);
  return `${IMPORTS_PATH}?${query.toString()}` as TradePath;
}

/** `PreviewImportDto` — both ids required, `predecessorRunId` optional. */
export function buildPreviewRequest(mappingId: string, sourceId: string) {
  const mapping = mappingId.trim();
  const source = sourceId.trim();
  if (!isUUIDv7(mapping)) throw new Error("IMPORT_FORM_MAPPING");
  if (!isUUIDv7(source)) throw new Error("IMPORT_FORM_SOURCE");
  return { mappingId: mapping, sourceId: source };
}

/**
 * The multipart body: exactly one part, named `file`.
 *
 * `limits: { files: 1, fields: 0, parts: 1 }` — no other form field may be
 * sent, not even a name, so this appends nothing else.
 */
export function buildImportSourceBody(file: File): FormData {
  const body = new FormData();
  body.append(IMPORT_SOURCE_FIELD_NAME, file);
  return body;
}

export function parseImportRunsResponse(payload: unknown): TradeOffsetPage<ImportRun> {
  return parseTradeOffsetPage(payload, parseImportRun, invalidImportResponse);
}

export function parseImportRun(payload: unknown): ImportRun {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.mappingId) ||
    !isNonEmptyString(row.mediaType, 120) ||
    !isNonEmptyString(row.mode, 24) ||
    !isNonEmptyString(row.status, 32) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.createdAt) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidImportResponse();
  }
  return {
    id: row.id,
    mappingId: row.mappingId,
    sourceId: isUuidV7(row.sourceId) ? row.sourceId : "",
    mediaType: row.mediaType,
    fileSizeBytes: isBoundedInteger(row.fileSizeBytes, 0, Number.MAX_SAFE_INTEGER)
      ? row.fileSizeBytes
      : 0,
    mode: row.mode,
    status: row.status,
    totalCount: countOf(row.totalCount),
    validCount: countOf(row.validCount),
    invalidCount: countOf(row.invalidCount),
    succeededCount: countOf(row.succeededCount),
    failedCount: countOf(row.failedCount),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function countOf(value: unknown): number {
  return isBoundedInteger(value, 0, Number.MAX_SAFE_INTEGER) ? value : 0;
}

export function parseImportResultsResponse(payload: unknown): TradeOffsetPage<ImportResultRow> {
  return parseTradeOffsetPage(payload, parseImportResultRow, invalidImportResponse);
}

function parseImportResultRow(payload: unknown): ImportResultRow {
  const row = record(payload);
  if (
    !row ||
    !isBoundedInteger(row.rowNumber, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 24)
  ) {
    invalidImportResponse();
  }
  return {
    rowNumber: row.rowNumber,
    stableRowKey: typeof row.stableRowKey === "string" ? row.stableRowKey : "",
    status: row.status,
    errorCode: typeof row.errorCode === "string" ? row.errorCode : null,
    errorFieldCode: typeof row.errorFieldCode === "string" ? row.errorFieldCode : null,
    completedAt: isTimestamp(row.completedAt) ? row.completedAt : null,
  };
}

/** An upload answers with the source record; only its id is needed downstream. */
export function parseImportSourceId(payload: unknown): string {
  const row = record(payload);
  if (!row || !isUuidV7(row.id)) invalidImportResponse();
  return row.id;
}

/**
 * `TRADE.IMPORT.FILE_UNSAFE` is emitted at **five** statuses from six throw
 * sites, so the code alone does not say what happened — the HTTP status is the
 * only separator, and this is the one place that discriminates on it.
 */
export function importMessage(error: NormalizedApiError, t: Dictionary): string | undefined {
  if (error.code === "TRADE.IMPORT.FILE_UNSAFE") {
    switch (error.status) {
      case 413:
        return t.tradeAutomation.errorFileTooLarge;
      case 415:
        return t.tradeAutomation.errorFileWrongType;
      case 409:
        return t.tradeAutomation.errorFileScanPending;
      case 422:
        return t.tradeAutomation.errorFileRejected;
      default:
        return t.tradeAutomation.errorFileMissing;
    }
  }
  switch (error.code) {
    case "TRADE.IMPORT.MAPPING_INVALID":
      return error.status === 404
        ? t.tradeAutomation.errorMappingNotFound
        : t.tradeAutomation.errorMappingInvalid;
    case "TRADE.IMPORT.SCOPE_MISMATCH":
      return t.tradeAutomation.errorImportScopeMismatch;
    case "TRADE.IMPORT.SOURCE_RELEASE_FORBIDDEN":
      return t.tradeAutomation.errorSourceReleaseForbidden;
    case "TRADE.STORAGE.UNAVAILABLE":
      return t.tradeAutomation.errorStorageUnavailable;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function importFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "IMPORT_FORM_MAPPING") return t.tradeAutomation.formMappingIdInvalid;
  if (reason === "IMPORT_FORM_SOURCE") return t.tradeAutomation.formSourceIdInvalid;
  return t.tradeCommon.actionFailed;
}

export function isImportRunStatus(value: unknown): value is ImportRunStatus {
  return isMemberOf(value, IMPORT_RUN_STATUSES);
}

export function isImportResultStatus(value: unknown): value is ImportResultStatus {
  return isMemberOf(value, IMPORT_RESULT_STATUSES);
}

function invalidImportResponse(): never {
  throw new Error("Invalid Trade import response.");
}
