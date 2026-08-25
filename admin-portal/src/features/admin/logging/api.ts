import { axiosClient } from "@/lib/api/axiosClient";
import {
  readEffectiveLoggingLevel,
  readLoggingHistory,
  readLoggingOverride,
  readLoggingOverrides,
  isUuidV7,
} from "./readers";
import {
  HISTORY_ACTIONS,
  LOGGING_APPS,
  LOGGING_SCOPES,
  LOG_LEVELS,
  type ContractResult,
  type EffectiveLoggingLevel,
  type EffectiveLoggingQuery,
  type LiveLoggingQuery,
  type LoggingHistoryQuery,
  type LoggingHistoryRow,
  type LoggingOverride,
  type LoggingOverrideQuery,
  type UpsertLoggingOverrideDto,
} from "./types";

export const LOGGING_BASE_URL = "/api/admin/core/v1/logging/level-overrides";

function keyed(idempotencyKey: string) {
  if (!isUuidV7(idempotencyKey)) throw new TypeError("INVALID_IDEMPOTENCY_KEY");
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

export const loggingApi = {
  list: async (
    query: LoggingOverrideQuery,
    signal?: AbortSignal,
  ): Promise<ContractResult<LoggingOverride[]>> => {
    const response = await axiosClient.get<unknown>(
      `${LOGGING_BASE_URL}${serializeOverrideQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return readLoggingOverrides(response.data);
  },

  history: async (
    query: LoggingHistoryQuery,
    signal?: AbortSignal,
  ): Promise<ContractResult<LoggingHistoryRow[]>> => {
    const response = await axiosClient.get<unknown>(
      `${LOGGING_BASE_URL}/history${serializeHistoryQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return readLoggingHistory(response.data);
  },

  effective: async (
    query: EffectiveLoggingQuery,
    signal?: AbortSignal,
  ): Promise<ContractResult<EffectiveLoggingLevel>> => {
    const response = await axiosClient.get<unknown>(
      `${LOGGING_BASE_URL}/effective${serializeEffectiveQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return readEffectiveLoggingLevel(response.data);
  },

  upsert: async (
    command: UpsertLoggingOverrideDto,
    idempotencyKey: string,
  ): Promise<ContractResult<LoggingOverride>> => {
    const response = await axiosClient.put<unknown>(
      LOGGING_BASE_URL,
      command,
      keyed(idempotencyKey),
    );
    return readLoggingOverride(response.data);
  },

  remove: async (id: string, idempotencyKey: string): Promise<string | null> => {
    if (!isUuidV7(id)) throw new TypeError("INVALID_LOGGING_OVERRIDE_ID");
    const response = await axiosClient.delete(
      `${LOGGING_BASE_URL}/${encodeURIComponent(id)}`,
      keyed(idempotencyKey),
    );
    const correlationId = response.headers.get("x-correlation-id");
    return correlationId && isUuidV7(correlationId) ? correlationId : null;
  },
};

export function serializeOverrideQuery(query: LoggingOverrideQuery): string {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    (query.scope !== undefined && !LOGGING_SCOPES.includes(query.scope)) ||
    (query.appName !== undefined && !LOGGING_APPS.includes(query.appName)) ||
    (query.tenantId !== undefined && !isUuidV7(query.tenantId)) ||
    (query.includeExpired !== undefined &&
      typeof query.includeExpired !== "boolean")
  ) {
    throw new TypeError("INVALID_LOGGING_OVERRIDE_QUERY");
  }
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.scope) params.set("scope", query.scope);
  if (query.appName) params.set("appName", query.appName);
  if (query.tenantId) params.set("tenantId", query.tenantId);
  if (query.includeExpired !== undefined) {
    params.set("includeExpired", query.includeExpired ? "true" : "false");
  }
  return `?${params.toString()}`;
}

export function serializeHistoryQuery(query: LoggingHistoryQuery): string {
  if (
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 200 ||
    (query.overrideId !== undefined && !isUuidV7(query.overrideId)) ||
    (query.action !== undefined && !HISTORY_ACTIONS.includes(query.action)) ||
    (query.scope !== undefined && !LOGGING_SCOPES.includes(query.scope)) ||
    (query.appName !== undefined && !LOGGING_APPS.includes(query.appName)) ||
    (query.tenantId !== undefined && !isUuidV7(query.tenantId))
  ) {
    throw new TypeError("INVALID_LOGGING_HISTORY_QUERY");
  }
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.overrideId) params.set("overrideId", query.overrideId);
  if (query.action) params.set("action", query.action);
  if (query.scope) params.set("scope", query.scope);
  if (query.appName) params.set("appName", query.appName);
  if (query.tenantId) params.set("tenantId", query.tenantId);
  return `?${params.toString()}`;
}

export function serializeEffectiveQuery(query: EffectiveLoggingQuery): string {
  if (
    !LOGGING_APPS.includes(query.appName) ||
    (query.tenantId !== undefined && !isUuidV7(query.tenantId))
  ) {
    throw new TypeError("INVALID_EFFECTIVE_LOGGING_QUERY");
  }
  const params = new URLSearchParams({ appName: query.appName });
  if (query.tenantId) params.set("tenantId", query.tenantId);
  return `?${params.toString()}`;
}

export function serializeLiveQuery(query: LiveLoggingQuery): string {
  if (
    (query.appName !== undefined && !LOGGING_APPS.includes(query.appName)) ||
    (query.tenantId !== undefined && !isUuidV7(query.tenantId)) ||
    (query.minLevel !== undefined && !LOG_LEVELS.includes(query.minLevel))
  ) {
    throw new TypeError("INVALID_LIVE_LOGGING_QUERY");
  }
  const params = new URLSearchParams();
  if (query.appName) params.set("appName", query.appName);
  if (query.tenantId) params.set("tenantId", query.tenantId);
  if (query.minLevel) params.set("minLevel", query.minLevel);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function liveLoggingUrl(query: LiveLoggingQuery): string {
  return `${LOGGING_BASE_URL}/live${serializeLiveQuery(query)}`;
}
