import {
  MIGRATION_RUN_STATUSES,
  MIGRATION_TENANT_OUTCOMES,
  TENANT_SCHEMA_VERSION_STATES,
  type FleetStateCounts,
  type FleetStatus,
  type MigrationRun,
  type MigrationRunProgress,
  type MigrationRunStatus,
  type MigrationRunSummary,
  type MigrationTenantOutcome,
  type MigrationTenantResult,
  type PageMeta,
  type Paginated,
  type TenantSchemaVersion,
  type TenantSchemaVersionState,
} from "../types/database-migrations";

export const INVALID_MIGRATION_RESPONSE = "INVALID_MIGRATION_RESPONSE";
export const INVALID_MIGRATION_RUN_ID = "INVALID_MIGRATION_RUN_ID";

const MAX_ROWS = 5_000;

export function readMigrationRun(value: unknown): MigrationRun {
  const row = requiredRecord(unwrap(value));
  return {
    id: text(row.id, 64),
    applicationKey: text(row.applicationKey, 64),
    targetVersion: text(row.targetVersion, 255),
    strategy: text(row.strategy, 64),
    batchSize: integer(row.batchSize, 0),
    failFast: boolean(row.failFast),
    status: oneOf(row.status, MIGRATION_RUN_STATUSES) as MigrationRunStatus,
    progress: readProgress(row.progress),
    summary: readSummary(row.summary),
    triggeredBy: optionalText(row.triggeredBy, 500) ?? "",
    startedAt: timestamp(row.startedAt),
    pausedAt: optionalTimestamp(row.pausedAt),
    finishedAt: optionalTimestamp(row.finishedAt),
    error: optionalText(row.error, 2_000),
    tenantScope: readTenantScope(row.progress),
  };
}

export function readMigrationRunList(value: unknown): MigrationRun[] {
  return list(unwrap(value)).map(readMigrationRun);
}

export function readFleetStatus(value: unknown): FleetStatus {
  const row = requiredRecord(unwrap(value));
  const distribution = list(row.versionDistribution).map((slice) => {
    const entry = requiredRecord(slice);
    return {
      schemaVersion: text(entry.schemaVersion, 255),
      tenantCount: integer(entry.tenantCount, 0),
    };
  });

  return {
    applicationKey: text(row.applicationKey, 64),
    availableVersion: optionalText(row.availableVersion, 255) ?? "",
    counts: readFleetCounts(row.counts),
    versionDistribution: distribution.sort(
      (left, right) => right.tenantCount - left.tenantCount,
    ),
    activeRun: readActiveRun(row.activeRun),
  };
}

export function readFleetStatusList(value: unknown): FleetStatus[] {
  const unwrapped = unwrap(value);
  return Array.isArray(unwrapped)
    ? unwrapped.map(readFleetStatus)
    : [readFleetStatus(unwrapped)];
}

export function readTenantSchemaVersionPage(
  value: unknown,
): Paginated<TenantSchemaVersion> {
  const envelope = record(value);
  const rows = list(unwrap(value)).map(readTenantSchemaVersion);
  return { items: rows, meta: readMeta(envelope?.meta, rows.length) };
}

export function readTenantSchemaVersion(value: unknown): TenantSchemaVersion {
  const row = requiredRecord(value);
  return {
    tenantId: text(row.tenantId, 64),
    tenantName: optionalText(row.tenantName, 255),
    applicationKey: text(row.applicationKey, 64),
    schemaVersion: optionalText(row.schemaVersion, 255) ?? "",
    schemaChecksum: optionalText(row.schemaChecksum, 64),
    state: oneOf(
      row.state,
      TENANT_SCHEMA_VERSION_STATES,
    ) as TenantSchemaVersionState,
    lastRunId: optionalText(row.lastRunId, 64),
    observedAt: optionalTimestamp(row.observedAt),
    driftDetail: readDetail(row.driftDetail),
  };
}

export function readTenantResultPage(
  value: unknown,
): Paginated<MigrationTenantResult> {
  const envelope = record(value);
  const rows = list(unwrap(value)).map(readTenantResult);
  return { items: rows, meta: readMeta(envelope?.meta, rows.length) };
}

export function readTenantResult(value: unknown): MigrationTenantResult {
  const row = requiredRecord(value);
  const outcome = oneOf(
    row.outcome,
    MIGRATION_TENANT_OUTCOMES,
  ) as MigrationTenantOutcome;

  return {
    tenantId: text(row.tenantId, 64),
    tenantName: optionalText(row.tenantName, 255),
    databaseServerId: optionalText(row.databaseServerId, 64),
    migrationName: optionalText(row.migrationName, 255),
    migrationChecksum: optionalText(row.migrationChecksum, 64),
    outcome,
    skipReason: optionalText(row.skipReason, 1_000),
    appliedCount: integer(row.appliedCount ?? 0, 0),
    pendingCount: integer(row.pendingCount ?? 0, 0),
    durationMs: optionalInteger(row.durationMs),
    errorCode: optionalText(row.errorCode, 200),
    errorDetail: optionalText(row.errorDetail, 2_000),
    startedAt: optionalTimestamp(row.startedAt),
    finishedAt: optionalTimestamp(row.finishedAt),
  };
}

export function requireRunId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || !/^[A-Za-z0-9-]+$/.test(trimmed)) {
    throw new Error(INVALID_MIGRATION_RUN_ID);
  }
  return trimmed;
}

export function isMigrationContractError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    (caught.message === INVALID_MIGRATION_RESPONSE ||
      caught.message === INVALID_MIGRATION_RUN_ID)
  );
}

function readProgress(value: unknown): MigrationRunProgress {
  const row = record(value) ?? {};
  return {
    totalTenants: integer(row.totalTenants ?? 0, 0),
    queuedTenants: integer(row.queuedTenants ?? 0, 0),
    inFlightTenants: integer(row.inFlightTenants ?? 0, 0),
    succeededTenants: integer(row.succeededTenants ?? 0, 0),
    failedTenants: integer(row.failedTenants ?? 0, 0),
    skippedTenants: integer(row.skippedTenants ?? 0, 0),
    appliedMigrations: integer(row.appliedMigrations ?? 0, 0),
    currentBatch: integer(row.currentBatch ?? 0, 0),
    dryRun: row.dryRun === true,
  };
}

function readSummary(value: unknown): MigrationRunSummary | null {
  const row = record(value);
  if (!row) return null;
  return {
    durationMs: integer(row.durationMs ?? 0, 0),
    tenantsProcessed: integer(row.tenantsProcessed ?? 0, 0),
    tenantsFailed: integer(row.tenantsFailed ?? 0, 0),
    migrationsApplied: integer(row.migrationsApplied ?? 0, 0),
  };
}

/**
 * A run started for one tenant is a fleet run carrying a tenant filter, so the
 * scope has to be read back out of `progress.tenantFilter` rather than from a
 * column of its own.
 */
function readTenantScope(value: unknown): string[] | null {
  const filter = record(record(value)?.tenantFilter);
  const ids = filter?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return ids
    .slice(0, 1_000)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());
}

function readFleetCounts(value: unknown): FleetStateCounts {
  const row = record(value) ?? {};
  return {
    upToDate: integer(row.upToDate ?? 0, 0),
    pending: integer(row.pending ?? 0, 0),
    running: integer(row.running ?? 0, 0),
    failed: integer(row.failed ?? 0, 0),
    blocked: integer(row.blocked ?? 0, 0),
    restoreIncomplete: integer(row.restoreIncomplete ?? 0, 0),
    drifted: integer(row.drifted ?? 0, 0),
  };
}

function readActiveRun(value: unknown): FleetStatus["activeRun"] {
  const row = record(value);
  if (!row) return null;
  return {
    runId: text(row.runId, 64),
    status: oneOf(row.status, MIGRATION_RUN_STATUSES) as MigrationRunStatus,
    progressPct: Math.max(0, Math.min(100, integer(row.progressPct ?? 0, 0))),
  };
}

function readMeta(value: unknown, fallbackTotal: number): PageMeta {
  const row = record(value);
  return {
    page: Math.max(1, integer(row?.page ?? 1, 1)),
    limit: Math.max(1, integer(row?.limit ?? Math.max(fallbackTotal, 1), 1)),
    total: Math.max(0, integer(row?.total ?? fallbackTotal, 0)),
  };
}

/** Drift detail is free-form `jsonb`; it is shown, never interpreted. */
function readDetail(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 4_000) || null;
  try {
    return JSON.stringify(value).slice(0, 4_000);
  } catch {
    return null;
  }
}

/**
 * Worker returns bare payloads today; the documented Database Control contract
 * puts them under `data` with `meta` alongside. Both are accepted so the screen
 * does not break on whichever shape the route ships with.
 */
function unwrap(payload: unknown): unknown {
  const root = record(payload);
  if (root && "data" in root) return root.data;
  return payload;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) invalid();
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : null;
}

function requiredRecord(value: unknown): Record<string, unknown> {
  const result = record(value);
  if (!result) invalid();
  return result;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== "string") invalid();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) invalid();
  return trimmed;
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") invalid();
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function integer(value: unknown, minimum: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) invalid();
  const rounded = Math.trunc(parsed);
  if (rounded < minimum) invalid();
  return rounded;
}

function optionalInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return integer(value, 0);
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value, 100);
  if (Number.isNaN(Date.parse(result))) invalid();
  return result;
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) invalid();
  return value as T;
}

function invalid(): never {
  throw new Error(INVALID_MIGRATION_RESPONSE);
}
