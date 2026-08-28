import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

/**
 * Catalogue applications the migration engine rolls out to tenant databases.
 * Mirrors `MIGRATION_APPLICATION_KEYS` in `@mutakamel/worker-app-contracts`,
 * which `ck_migration_runs_application` enforces at insert time.
 */
export const MIGRATION_APPLICATION_KEYS = [
  "core",
  "crm",
  "trade",
  "webphone",
] as const;
export type MigrationApplicationKey =
  (typeof MIGRATION_APPLICATION_KEYS)[number];

/** `worker.migration_runs.strategy`. */
export const MIGRATION_STRATEGIES = ["batched", "blue-green"] as const;
export type MigrationStrategy = (typeof MIGRATION_STRATEGIES)[number];

/** `worker.migration_runs.status`. */
export const MIGRATION_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "ABORTED",
] as const;
export type MigrationRunStatus = (typeof MIGRATION_RUN_STATUSES)[number];

/**
 * `worker.migration_tenant_results.outcome`.
 *
 * `SKIPPED` and `SKIPPED_UP_TO_DATE` are deliberately separate wire values and
 * must never be merged into one "skipped" figure: the first means the run was
 * not allowed to touch the tenant, the second means the tenant was reached and
 * already carried the target version.
 */
export const MIGRATION_TENANT_OUTCOMES = [
  "PENDING",
  "RUNNING",
  "APPLIED",
  "FAILED",
  "SKIPPED",
  "SKIPPED_UP_TO_DATE",
] as const;
export type MigrationTenantOutcome =
  (typeof MIGRATION_TENANT_OUTCOMES)[number];

/** `control_plane.tenant_schema_versions.state`. */
export const TENANT_SCHEMA_VERSION_STATES = [
  "UP_TO_DATE",
  "PENDING",
  "RUNNING",
  "FAILED",
  "BLOCKED",
  "RESTORE_INCOMPLETE",
  "DRIFTED",
] as const;
export type TenantSchemaVersionState =
  (typeof TENANT_SCHEMA_VERSION_STATES)[number];

/**
 * Projection states that describe a database nobody has explained yet. They are
 * surfaced on their own, above the fleet table, rather than as one row colour
 * among seven.
 */
export const ALARMING_SCHEMA_VERSION_STATES = [
  "DRIFTED",
  "RESTORE_INCOMPLETE",
] as const satisfies readonly TenantSchemaVersionState[];

/** Rolled-up counters `worker.migration_runs.progress` carries. */
export interface MigrationRunProgress {
  totalTenants: number;
  queuedTenants: number;
  inFlightTenants: number;
  succeededTenants: number;
  failedTenants: number;
  skippedTenants: number;
  appliedMigrations: number;
  currentBatch: number;
  dryRun: boolean;
}

export interface MigrationRunSummary {
  durationMs: number;
  tenantsProcessed: number;
  tenantsFailed: number;
  migrationsApplied: number;
}

/** One row of `worker.migration_runs`. */
export interface MigrationRun {
  id: string;
  applicationKey: string;
  targetVersion: string;
  strategy: string;
  batchSize: number;
  failFast: boolean;
  status: MigrationRunStatus;
  progress: MigrationRunProgress;
  summary: MigrationRunSummary | null;
  triggeredBy: string;
  startedAt: string;
  pausedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  /** Present only when the run was filtered to an explicit tenant list. */
  tenantScope: string[] | null;
}

/** One row of `worker.migration_tenant_results`. */
export interface MigrationTenantResult {
  tenantId: string;
  tenantName: string | null;
  databaseServerId: string | null;
  migrationName: string | null;
  migrationChecksum: string | null;
  outcome: MigrationTenantOutcome;
  /**
   * Mandatory for `SKIPPED` — `ck_mtr_skip_reason` rejects a silent skip. A
   * null reason on a `SKIPPED` row is a contract defect the screen reports
   * rather than hides.
   */
  skipReason: string | null;
  appliedCount: number;
  pendingCount: number;
  durationMs: number | null;
  errorCode: string | null;
  errorDetail: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** One row of `control_plane.tenant_schema_versions`. */
export interface TenantSchemaVersion {
  tenantId: string;
  tenantName: string | null;
  applicationKey: string;
  schemaVersion: string;
  schemaChecksum: string | null;
  state: TenantSchemaVersionState;
  lastRunId: string | null;
  observedAt: string | null;
  driftDetail: string | null;
}

export interface FleetStateCounts {
  upToDate: number;
  pending: number;
  running: number;
  failed: number;
  blocked: number;
  restoreIncomplete: number;
  drifted: number;
}

export interface FleetVersionSlice {
  schemaVersion: string;
  tenantCount: number;
}

export interface FleetActiveRun {
  runId: string;
  status: MigrationRunStatus;
  progressPct: number;
}

/** `GET /migrations/fleet` — one application's projection roll-up. */
export interface FleetStatus {
  applicationKey: string;
  availableVersion: string;
  counts: FleetStateCounts;
  /** Fleet fragmentation: a healthy fleet is one dominant entry. */
  versionDistribution: FleetVersionSlice[];
  activeRun: FleetActiveRun | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** How the operator chose to run: a rehearsal, or the real thing. */
export const MIGRATION_RUN_MODES = ["DRY_RUN", "APPLY"] as const;
export type MigrationRunMode = (typeof MIGRATION_RUN_MODES)[number];

/** Whether one run covers a single tenant or every eligible tenant. */
export const MIGRATION_RUN_SCOPES = ["SINGLE_TENANT", "FLEET"] as const;
export type MigrationRunScope = (typeof MIGRATION_RUN_SCOPES)[number];

/** `StartMigrationRunDto` in `@mutakamel/worker-app-contracts`. */
export interface StartMigrationRunDto {
  applicationKey: MigrationApplicationKey;
  targetVersion: string;
  strategy: MigrationStrategy;
  batchSize?: number;
  failFast: boolean;
  dryRun: boolean;
  tenantFilter?: { ids?: string[]; excludeIds?: string[] };
  triggeredBy: string;
}

/** `MigrationControlDto` in `@mutakamel/worker-app-contracts`. */
export interface MigrationControlDto {
  runId: string;
  reason: string;
}

export interface MigrationPermissions {
  /** `admin.migrations.read`. */
  canRead: boolean;
  /** `admin.migrations.manage` — the LLD's `execute` tier. */
  hasExecute: boolean;
  /** `admin.migrations.critical`. */
  hasCritical: boolean;
  /**
   * Start, pause, resume, retry. The Gateway route contract requires
   * ALL(`admin.migrations.manage`, `admin.migrations.critical`) on every
   * mutating migration route today, so a manage-only operator is shown a
   * read-only surface rather than a control certain to return `403`.
   */
  canExecute: boolean;
  /** Abort and fleet-wide apply — `execute` **and** `critical`. */
  canDestroy: boolean;
}

export type ResourceState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "ERROR";

export type MigrationMutationName =
  | "START"
  | "PAUSE"
  | "RESUME"
  | "ABORT"
  | "RETRY_FAILED";

export type MigrationMutationPhase =
  | "IDLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PRECONDITION"
  | "UNAVAILABLE"
  | "ERROR";

export interface MigrationMutationState {
  name: MigrationMutationName | null;
  phase: MigrationMutationPhase;
  error: NormalizedApiError | null;
}

/** Presentation tone for a state or outcome chip. Never the only signal. */
export type MigrationTone =
  | "success"
  | "progress"
  | "waiting"
  | "neutral"
  | "caution"
  | "danger"
  | "alarm";
