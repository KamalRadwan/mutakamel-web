import {
  HISTORY_ACTIONS,
  LOGGING_APPS,
  LOGGING_SCOPES,
  LOG_LEVELS,
  type ContractResult,
  type EffectiveLoggingLevel,
  type LoggingHistoryRow,
  type LoggingOverride,
  type RuntimeLogRow,
} from "./types";

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SERVICE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class LoggingContractError extends Error {
  constructor(code = "INVALID_LOGGING_RESPONSE") {
    super(code);
    this.name = "LoggingContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

export function readLoggingOverrides(
  payload: unknown,
): ContractResult<LoggingOverride[]> {
  return readEnvelope(payload, (value) => {
    const rows = array(value, 100).map(readOverride);
    unique(rows.map((row) => row.id));
    unique(rows.map(scopeIdentity));
    return rows;
  });
}

export function readLoggingOverride(
  payload: unknown,
): ContractResult<LoggingOverride> {
  return readEnvelope(payload, readOverride);
}

export function readLoggingHistory(
  payload: unknown,
): ContractResult<LoggingHistoryRow[]> {
  return readEnvelope(payload, (value) => {
    const rows = array(value, 200).map(readHistoryRow);
    unique(rows.map((row) => row.id));
    return rows;
  });
}

export function readEffectiveLoggingLevel(
  payload: unknown,
): ContractResult<EffectiveLoggingLevel> {
  return readEnvelope(payload, (value) => {
    const source = object(value);
    return {
      level: oneOf(source.level, LOG_LEVELS),
      source: oneOf(source.source, [...LOGGING_SCOPES, "FALLBACK"] as const),
    };
  });
}

export function readRuntimeLogEvent(
  raw: unknown,
  sequence: number,
): RuntimeLogRow {
  const source = object(raw, "INVALID_LIVE_LOG_EVENT");
  const serviceName = matchingString(
    source.serviceName,
    SERVICE_NAME_PATTERN,
    64,
    "INVALID_LIVE_LOG_EVENT",
  );
  return {
    sequence,
    timestamp: isoTimestamp(source.timestamp, "INVALID_LIVE_LOG_EVENT"),
    level: oneOf(source.level, LOG_LEVELS, "INVALID_LIVE_LOG_EVENT"),
    serviceName,
    message: optionalNullableLooseString(source.message, 4_000),
    correlationId: optionalNullableCorrelation(source.correlationId),
    tenantId: optionalNullableUuid(source.tenantId, "INVALID_LIVE_LOG_EVENT"),
  };
}

function readEnvelope<T>(
  payload: unknown,
  readData: (value: unknown) => T,
): ContractResult<T> {
  const envelope = object(payload);
  if (envelope.success !== true) fail();
  return {
    data: readData(envelope.data),
    correlationId: uuidV7(envelope.correlationId),
    timestamp: isoTimestamp(envelope.timestamp),
  };
}

function readOverride(value: unknown): LoggingOverride {
  const row = object(value);
  const scope = oneOf(row.scope, LOGGING_SCOPES);
  const appName = nullableOneOf(row.appName, LOGGING_APPS);
  const tenantId = nullableUuidV7(row.tenantId);
  assertTarget(scope, appName, tenantId);
  const createdAt = isoTimestamp(row.createdAt);
  const updatedAt = isoTimestamp(row.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) fail();
  return {
    id: uuidV7(row.id),
    scope,
    appName,
    tenantId,
    level: oneOf(row.level, LOG_LEVELS),
    reason: nullableString(row.reason, 255),
    expiresAt: nullableIsoTimestamp(row.expiresAt),
    createdBy: optionalNullableUuid(row.createdBy),
    updatedBy: optionalNullableUuid(row.updatedBy),
    createdAt,
    updatedAt,
  };
}

function readHistoryRow(value: unknown): LoggingHistoryRow {
  const row = object(value);
  const scope = oneOf(row.scope, LOGGING_SCOPES);
  const appName = nullableOneOf(row.appName, LOGGING_APPS);
  const tenantId = nullableUuidV7(row.tenantId);
  assertTarget(scope, appName, tenantId);
  const action = oneOf(row.action, HISTORY_ACTIONS);
  const level = nullableOneOf(row.level, LOG_LEVELS);
  if (action === "DELETE" ? level !== null : level === null) fail();
  return {
    id: uuidV7(row.id),
    overrideId: nullableUuidV7(row.overrideId),
    action,
    scope,
    appName,
    tenantId,
    previousLevel: nullableOneOf(row.previousLevel, LOG_LEVELS),
    level,
    previousReason: nullableString(row.previousReason, 255),
    reason: nullableString(row.reason, 255),
    previousExpiresAt: nullableIsoTimestamp(row.previousExpiresAt),
    expiresAt: nullableIsoTimestamp(row.expiresAt),
    actorId: nullableUuidV7(row.actorId),
    createdAt: isoTimestamp(row.createdAt),
  };
}

function scopeIdentity(row: LoggingOverride): string {
  return `${row.scope}:${row.appName ?? ""}:${row.tenantId ?? ""}`;
}

function assertTarget(
  scope: LoggingOverride["scope"],
  appName: LoggingOverride["appName"],
  tenantId: LoggingOverride["tenantId"],
): void {
  const valid =
    (scope === "GLOBAL" && appName === null && tenantId === null) ||
    (scope === "APP" && appName !== null && tenantId === null) ||
    (scope === "TENANT" && appName === null && tenantId !== null) ||
    (scope === "TENANT_APP" && appName !== null && tenantId !== null);
  if (!valid) fail();
}

function object(
  value: unknown,
  code = "INVALID_LOGGING_RESPONSE",
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(code);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function boundedString(
  value: unknown,
  maximum: number,
  code = "INVALID_LOGGING_RESPONSE",
): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.length > maximum
  ) {
    fail(code);
  }
  return value;
}

function matchingString(
  value: unknown,
  pattern: RegExp,
  maximum: number,
  code = "INVALID_LOGGING_RESPONSE",
): string {
  const result = boundedString(value, maximum, code);
  if (!pattern.test(result)) fail(code);
  return result;
}

function nullableString(value: unknown, maximum: number): string | null {
  return value === null ? null : boundedString(value, maximum);
}

function optionalNullableLooseString(
  value: unknown,
  maximum: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value || value.length > maximum) {
    fail("INVALID_LIVE_LOG_EVENT");
  }
  return value;
}

function uuidV7(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) fail();
  return value;
}

function nullableUuidV7(value: unknown): string | null {
  return value === null ? null : uuidV7(value);
}

function optionalNullableUuid(
  value: unknown,
  code = "INVALID_LOGGING_RESPONSE",
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !isUuidV7(value)) fail(code);
  return value;
}

function optionalNullableCorrelation(value: unknown): string | null {
  if (value === undefined || value === null || value === "unknown") return null;
  return matchingString(
    value,
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u,
    200,
    "INVALID_LIVE_LOG_EVENT",
  );
}

function isoTimestamp(
  value: unknown,
  code = "INVALID_LOGGING_RESPONSE",
): string {
  if (typeof value !== "string") fail(code);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code);
  }
  return value;
}

function nullableIsoTimestamp(value: unknown): string | null {
  return value === null ? null : isoTimestamp(value);
}

function oneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
  code = "INVALID_LOGGING_RESPONSE",
): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(code);
  return value as T;
}

function nullableOneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
): T | null {
  return value === null ? null : oneOf(value, values);
}

function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function fail(code = "INVALID_LOGGING_RESPONSE"): never {
  throw new LoggingContractError(code);
}
