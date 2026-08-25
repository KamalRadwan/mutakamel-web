import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const LOGGING_APPS = [
  "api-gateway-app",
  "core-app",
  "crm-app",
  "worker-app",
] as const;
export type LoggingApp = (typeof LOGGING_APPS)[number];

export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const OVERRIDE_LOG_LEVELS = LOG_LEVELS.slice(1) as readonly Exclude<
  LogLevel,
  "trace"
>[];

export const LOGGING_SCOPES = [
  "GLOBAL",
  "APP",
  "TENANT",
  "TENANT_APP",
] as const;
export type LoggingScope = (typeof LOGGING_SCOPES)[number];

export const HISTORY_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
export type LoggingHistoryAction = (typeof HISTORY_ACTIONS)[number];

export interface LoggingOverride {
  id: string;
  scope: LoggingScope;
  appName: LoggingApp | null;
  tenantId: string | null;
  level: LogLevel;
  reason: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoggingHistoryRow {
  id: string;
  overrideId: string | null;
  action: LoggingHistoryAction;
  scope: LoggingScope;
  appName: LoggingApp | null;
  tenantId: string | null;
  previousLevel: LogLevel | null;
  level: LogLevel | null;
  previousReason: string | null;
  reason: string | null;
  previousExpiresAt: string | null;
  expiresAt: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface EffectiveLoggingLevel {
  level: LogLevel;
  source: LoggingScope | "FALLBACK";
}

export interface ContractResult<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

export interface LoggingOverrideQuery {
  page: number;
  limit: number;
  scope?: LoggingScope;
  appName?: LoggingApp;
  tenantId?: string;
  includeExpired?: boolean;
}

export interface LoggingHistoryQuery {
  overrideId?: string;
  action?: LoggingHistoryAction;
  scope?: LoggingScope;
  appName?: LoggingApp;
  tenantId?: string;
  limit: number;
}

export interface EffectiveLoggingQuery {
  appName: LoggingApp;
  tenantId?: string;
}

export interface LiveLoggingQuery {
  appName?: LoggingApp;
  tenantId?: string;
  minLevel?: LogLevel;
}

export interface UpsertLoggingOverrideDto {
  scope: LoggingScope;
  appName?: LoggingApp;
  tenantId?: string;
  level: Exclude<LogLevel, "trace">;
  reason: string;
  expiresAt: string;
}

export interface LoggingOverrideDraft {
  scope: LoggingScope;
  appName: "" | LoggingApp;
  tenantId: string;
  level: Exclude<LogLevel, "trace">;
  reason: string;
  expiresAtLocal: string;
}

export interface DirectoryFilterDraft {
  scope: "" | LoggingScope;
  appName: "" | LoggingApp;
  tenantId: string;
  includeExpired: boolean;
}

export interface HistoryFilterDraft {
  overrideId: string;
  action: "" | LoggingHistoryAction;
  scope: "" | LoggingScope;
  appName: "" | LoggingApp;
  tenantId: string;
}

export interface EffectiveDraft {
  appName: LoggingApp;
  tenantId: string;
}

export interface LiveLoggingDraft {
  appName: "" | LoggingApp;
  tenantId: string;
  minLevel: LogLevel;
}

export interface LoggingValidationErrors {
  scope?: string;
  appName?: string;
  tenantId?: string;
  level?: string;
  reason?: string;
  expiresAt?: string;
  overrideId?: string;
}

export type ResourceState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "STALE"
  | "ERROR";

export interface ResourceView<T> {
  data: T | null;
  state: ResourceState;
  error: NormalizedApiError | null;
  correlationId: string | null;
  timestamp: string | null;
  isRefreshing: boolean;
}

export type MutationState =
  | "IDLE"
  | "CONFIRMING_UPSERT"
  | "CONFIRMING_DELETE"
  | "SAVING"
  | "DELETING"
  | "SUCCESS"
  | "VALIDATION"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "STALE"
  | "ERROR";

export interface RuntimeLogRow {
  sequence: number;
  timestamp: string;
  level: LogLevel;
  serviceName: string;
  message: string | null;
  correlationId: string | null;
  tenantId: string | null;
}

export type LiveConnectionState =
  | "IDLE"
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "PAUSED_PRIVACY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "STALE"
  | "ERROR";

export interface LiveControlError {
  code: string;
  message: string;
}
