import {
  LOGGING_APPS,
  LOGGING_SCOPES,
  LOG_LEVELS,
  OVERRIDE_LOG_LEVELS,
  type EffectiveDraft,
  type EffectiveLoggingQuery,
  type HistoryFilterDraft,
  type LiveLoggingDraft,
  type LiveLoggingQuery,
  type LoggingHistoryQuery,
  type LoggingOverrideDraft,
  type LoggingValidationErrors,
  type UpsertLoggingOverrideDto,
} from "./types";
import { isUuidV7 } from "./readers";

const MAX_OVERRIDE_MS = 24 * 60 * 60 * 1_000;

export function buildOverrideCommand(
  draft: LoggingOverrideDraft,
  now = Date.now(),
): { command: UpsertLoggingOverrideDto | null; errors: LoggingValidationErrors } {
  const errors: LoggingValidationErrors = {};
  const tenantId = draft.tenantId.trim();
  const reason = draft.reason.trim();
  const needsApp = draft.scope === "APP" || draft.scope === "TENANT_APP";
  const needsTenant = draft.scope === "TENANT" || draft.scope === "TENANT_APP";

  if (!LOGGING_SCOPES.includes(draft.scope)) errors.scope = "INVALID_SCOPE";
  if (needsApp && !LOGGING_APPS.includes(draft.appName as never)) {
    errors.appName = "APP_REQUIRED";
  }
  if (needsTenant && !isUuidV7(tenantId)) {
    errors.tenantId = "TENANT_UUID_V7_REQUIRED";
  }
  if (!OVERRIDE_LOG_LEVELS.includes(draft.level)) {
    errors.level = "INVALID_OVERRIDE_LEVEL";
  }
  if (!reason || reason.length > 255) errors.reason = "INVALID_REASON";

  const expiresAt = localDateTimeToIso(draft.expiresAtLocal);
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (
    !expiresAt ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= now ||
    expiresAtMs - now > MAX_OVERRIDE_MS
  ) {
    errors.expiresAt = "INVALID_EXPIRY";
  }

  if (Object.keys(errors).length) return { command: null, errors };
  return {
    command: {
      scope: draft.scope,
      level: draft.level,
      reason,
      expiresAt: expiresAt!,
      ...(needsApp ? { appName: draft.appName as UpsertLoggingOverrideDto["appName"] } : {}),
      ...(needsTenant ? { tenantId } : {}),
    },
    errors,
  };
}

export function buildHistoryQuery(
  draft: HistoryFilterDraft,
  limit: number,
): { query: LoggingHistoryQuery | null; errors: LoggingValidationErrors } {
  const errors: LoggingValidationErrors = {};
  const overrideId = draft.overrideId.trim();
  const tenantId = draft.tenantId.trim();
  if (overrideId && !isUuidV7(overrideId)) errors.overrideId = "INVALID_UUID_V7";
  if (tenantId && !isUuidV7(tenantId)) errors.tenantId = "INVALID_UUID_V7";
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    errors.scope = "INVALID_LIMIT";
  }
  if (Object.keys(errors).length) return { query: null, errors };
  return {
    query: {
      limit,
      ...(overrideId ? { overrideId } : {}),
      ...(draft.action ? { action: draft.action } : {}),
      ...(draft.scope ? { scope: draft.scope } : {}),
      ...(draft.appName ? { appName: draft.appName } : {}),
      ...(tenantId ? { tenantId } : {}),
    },
    errors,
  };
}

export function buildEffectiveQuery(
  draft: EffectiveDraft,
): { query: EffectiveLoggingQuery | null; errors: LoggingValidationErrors } {
  const tenantId = draft.tenantId.trim();
  const errors: LoggingValidationErrors = {};
  if (!LOGGING_APPS.includes(draft.appName)) errors.appName = "APP_REQUIRED";
  if (tenantId && !isUuidV7(tenantId)) errors.tenantId = "INVALID_UUID_V7";
  return Object.keys(errors).length
    ? { query: null, errors }
    : {
        query: {
          appName: draft.appName,
          ...(tenantId ? { tenantId } : {}),
        },
        errors,
      };
}

export function buildLiveQuery(
  draft: LiveLoggingDraft,
): { query: LiveLoggingQuery | null; errors: LoggingValidationErrors } {
  const tenantId = draft.tenantId.trim();
  const errors: LoggingValidationErrors = {};
  if (tenantId && !isUuidV7(tenantId)) errors.tenantId = "INVALID_UUID_V7";
  if (!LOG_LEVELS.includes(draft.minLevel)) errors.level = "INVALID_LOG_LEVEL";
  return Object.keys(errors).length
    ? { query: null, errors }
    : {
        query: {
          minLevel: draft.minLevel,
          ...(draft.appName ? { appName: draft.appName } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
        errors,
      };
}

function localDateTimeToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function isoToLocalDateTime(value: string): string {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function defaultExpiryLocal(now = Date.now()): string {
  return isoToLocalDateTime(new Date(now + 60 * 60 * 1_000).toISOString());
}

export function overrideIntentFingerprint(command: UpsertLoggingOverrideDto): string {
  return JSON.stringify([
    "PUT",
    command.scope,
    command.appName ?? null,
    command.tenantId ?? null,
    command.level,
    command.reason,
    command.expiresAt,
  ]);
}

export function deleteIntentFingerprint(id: string): string {
  return JSON.stringify(["DELETE", id]);
}

export function shouldRetainIntent(error: {
  httpStatus: number;
  errorCode: string;
}): boolean {
  return (
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR" ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT|IDEM_IN_FLIGHT|GW\.IDEM\.IN_FLIGHT)/u.test(
      error.errorCode,
    )
  );
}
