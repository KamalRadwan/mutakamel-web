import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  asOpenEnum,
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Control tower — 4 routes.
// docs/api/trade-advanced.md#control-tower--4-routes, verified against
// trade-app/src/modules/control-tower/{control-tower.controller.ts,
// control-tower.service.ts,dto/control-tower.dto.ts}.
//
// **It is NOT gated on `trade.control_tower_advanced`.** That feature key is
// referenced nowhere in trade-app. The controller declares
// `allOf: [trade.analytics]` plus `anyOf` of seven domain features, so a tenant
// holding analytics and none of the seven is still refused — and the refusal is
// a feature-entitlement failure, not a permission one.
//
// **Two enums here contradict the code that writes them.** Neither the
// severity chips nor the retry control is built from its enum:
//
//   severity   the query DTO accepts LOW/MEDIUM/HIGH/CRITICAL; the exported
//              `ExceptionSeverity` is INFO/WARNING/HIGH/CRITICAL; the only
//              literal written anywhere is "HIGH". Filtering by INFO or
//              WARNING is a 400. The filter therefore offers what the DTO
//              accepts, and rows render whatever they carry.
//   retryClass four literals are written and three are absent from
//              `RetryClass`, and one path copies the value from a worker
//              payload unvalidated. The retry control uses an allow-list.

export const CONTROL_TOWER_EXCEPTIONS_PATH =
  "/api/tenant/trade/v1/control-tower/exceptions";

export const CONTROL_TOWER_READ_PERMISSION = "trade.control_tower.read";
export const CONTROL_TOWER_RETRY_PERMISSION = "trade.control_tower.retry";
export const CONTROL_TOWER_RESOLVE_PERMISSION = "trade.control_tower.resolve";

export const CONTROL_TOWER_PAGE_SIZE = 25;
const RESOLUTION_REASON_MAX_LENGTH = 240;

export const EXCEPTION_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "ACTION_PENDING",
  "RECONCILIATION_PENDING",
  "RESOLVED",
  "QUARANTINED",
] as const;

/** What the **query DTO** accepts — not `ExceptionSeverity`, which differs. */
export const EXCEPTION_SEVERITY_FILTERS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const RESOLUTION_CODES = ["SOURCE_CORRECTED", "OWNER_RESULT_APPLIED"] as const;

/** The same allow-list the webhook delivery screen uses, for the same reason. */
export const RETRYABLE_RETRY_CLASSES: readonly string[] = ["TRANSIENT", "AFTER_REFRESH"];

export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];
export type ExceptionSeverityFilter = (typeof EXCEPTION_SEVERITY_FILTERS)[number];
export type ResolutionCode = (typeof RESOLUTION_CODES)[number];

export interface ControlTowerException {
  id: string;
  sourceOwner: string;
  sourceType: string;
  sourceId: string;
  category: string;
  /** Open: neither the filter list nor the enum closes what rows carry. */
  severity: string;
  status: string;
  retryClass: string;
  safeErrorCode: string;
  correlationId: string;
  resolvedAt: string | null;
  version: number;
  updatedAt: string;
}

interface IntegrationAttempt {
  id: string;
  ownerCode: string;
  status: string;
  retryClass: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  updatedAt: string;
}

export interface ControlTowerExceptionDetail extends ControlTowerException {
  attempts: IntegrationAttempt[];
  asOf: string;
}

export function controlTowerExceptionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidControlTowerResponse();
  return `${CONTROL_TOWER_EXCEPTIONS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function controlTowerActionPath(id: string, action: "retry" | "resolve"): TradePath {
  return `${controlTowerExceptionPath(id)}/${action}` as TradePath;
}

export function controlTowerListPath(
  page: number,
  status?: ExceptionStatus,
  severity?: ExceptionSeverityFilter,
  category?: string,
): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(CONTROL_TOWER_PAGE_SIZE),
  });
  if (status) query.set("status", status);
  if (severity) query.set("severity", severity);
  if (category) query.set("category", category);
  return `${CONTROL_TOWER_EXCEPTIONS_PATH}?${query.toString()}` as TradePath;
}

/** `RetryExceptionDto.reason` is optional and at most 240 characters. */
export function buildRetryExceptionRequest(reason: string): { reason?: string } {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return {};
  if (trimmed.length > RESOLUTION_REASON_MAX_LENGTH) throw new Error("CONTROL_TOWER_FORM_REASON");
  return { reason: trimmed };
}

/**
 * `ResolveExceptionDto` needs all three: a resolution code, a reason and an
 * **evidence object**. Evidence is `@IsObject()` and required — an empty
 * object is legal, but omitting the key is a 400.
 */
export function buildResolveExceptionRequest(
  resolutionCode: ResolutionCode,
  reason: string,
  evidence: string,
): { resolutionCode: ResolutionCode; reason: string; evidence: Record<string, unknown> } {
  const trimmed = reason.trim();
  if (trimmed.length === 0 || trimmed.length > RESOLUTION_REASON_MAX_LENGTH) {
    throw new Error("CONTROL_TOWER_FORM_REASON");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(evidence.trim().length === 0 ? "{}" : evidence);
  } catch {
    throw new Error("CONTROL_TOWER_FORM_EVIDENCE");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CONTROL_TOWER_FORM_EVIDENCE");
  }
  return {
    resolutionCode,
    reason: trimmed,
    evidence: parsed as Record<string, unknown>,
  };
}

export function parseControlTowerExceptionsResponse(
  payload: unknown,
): TradeOffsetPage<ControlTowerException> {
  return parseTradeOffsetPage(
    payload,
    parseControlTowerException,
    invalidControlTowerResponse,
  );
}

function parseControlTowerException(payload: unknown): ControlTowerException {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.sourceOwner, 64) ||
    !isNonEmptyString(row.sourceType, 40) ||
    !isNonEmptyString(row.category, 64) ||
    !isNonEmptyString(row.status, 32) ||
    !isNonEmptyString(row.safeErrorCode, 160) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidControlTowerResponse();
  }
  return {
    id: row.id,
    sourceOwner: row.sourceOwner,
    sourceType: row.sourceType,
    sourceId: isUuidV7(row.sourceId) ? row.sourceId : "",
    category: row.category,
    // Open enums: kept as strings so an unmapped value renders as itself.
    severity: asOpenEnum(row.severity) ?? "",
    retryClass: asOpenEnum(row.retryClass) ?? "",
    status: row.status,
    safeErrorCode: row.safeErrorCode,
    correlationId: isUuidV7(row.correlationId) ? row.correlationId : "",
    resolvedAt: isTimestamp(row.resolvedAt) ? row.resolvedAt : null,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

export function parseControlTowerExceptionDetail(
  payload: unknown,
): ControlTowerExceptionDetail {
  const row = record(payload);
  if (!row || !Array.isArray(row.attempts) || !isTimestamp(row.asOf)) {
    invalidControlTowerResponse();
  }
  return {
    ...parseControlTowerException(payload),
    asOf: row.asOf,
    attempts: row.attempts.map((entry) => {
      const attempt = record(entry);
      if (
        !attempt ||
        !isUuidV7(attempt.id) ||
        !isNonEmptyString(attempt.ownerCode, 64) ||
        !isNonEmptyString(attempt.status, 40) ||
        !isBoundedInteger(attempt.attemptCount, 0, 10_000) ||
        !isTimestamp(attempt.updatedAt)
      ) {
        invalidControlTowerResponse();
      }
      return {
        id: attempt.id,
        ownerCode: attempt.ownerCode,
        status: attempt.status,
        retryClass: asOpenEnum(attempt.retryClass),
        attemptCount: attempt.attemptCount,
        nextAttemptAt: isTimestamp(attempt.nextAttemptAt) ? attempt.nextAttemptAt : null,
        lastErrorCode: typeof attempt.lastErrorCode === "string" ? attempt.lastErrorCode : null,
        updatedAt: attempt.updatedAt,
      };
    }),
  };
}

export function controlTowerMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.CONTROL_TOWER.NOT_FOUND":
      return t.tradeControlTower.errorNotFound;
    case "TRADE.CONTROL_TOWER.SCOPE_DENIED":
      return t.tradeControlTower.errorScopeDenied;
    case "TRADE.CONTROL_TOWER.RETRY_NOT_ALLOWED":
      return t.tradeControlTower.errorRetryNotAllowed;
    case "TRADE.CONTROL_TOWER.RETRY_IN_PROGRESS":
      return t.tradeControlTower.errorRetryInProgress;
    case "TRADE.CONTROL_TOWER.TARGET_STALE":
      return t.tradeControlTower.errorTargetStale;
    case "TRADE.CONTROL_TOWER.RESOLUTION_INVALID":
      return t.tradeControlTower.errorResolutionInvalid;
    case "TRADE.CONTROL_TOWER.PROJECTION_UNAVAILABLE":
      return t.tradeControlTower.errorProjectionUnavailable;
    case "TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE":
      return t.tradeControlTower.errorOwnerUnavailable;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function controlTowerFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "CONTROL_TOWER_FORM_REASON") return t.tradeControlTower.formReasonInvalid;
  if (reason === "CONTROL_TOWER_FORM_EVIDENCE") return t.tradeControlTower.formEvidenceInvalid;
  return t.tradeCommon.actionFailed;
}

export function isExceptionStatus(value: unknown): value is ExceptionStatus {
  return isMemberOf(value, EXCEPTION_STATUSES);
}

export function isExceptionSeverityFilter(value: unknown): value is ExceptionSeverityFilter {
  return isMemberOf(value, EXCEPTION_SEVERITY_FILTERS);
}

function invalidControlTowerResponse(): never {
  throw new Error("Invalid Trade control tower response.");
}
