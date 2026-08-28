import {
  ALARMING_SCHEMA_VERSION_STATES,
  type FleetStateCounts,
  type MigrationRun,
  type MigrationRunStatus,
  type MigrationTenantOutcome,
  type MigrationTenantResult,
  type MigrationTone,
  type TenantSchemaVersionState,
} from "../types/database-migrations";

/**
 * A stable icon identifier resolved to a component at render time. Keeping the
 * mapping here — rather than inside a `.tsx` — is what lets the distinction
 * between the two skip outcomes be asserted by a plain unit test.
 */
export type MigrationGlyph =
  | "check"
  | "spinner"
  | "clock"
  | "cross"
  | "ban"
  | "target"
  | "drift"
  | "restore"
  | "pause"
  | "stop";

/** Which column of a fleet summary an outcome belongs in. */
export type OutcomeGroup = "IN_FLIGHT" | "AT_TARGET" | "NEEDS_ATTENTION";

export interface OutcomeDescriptor {
  outcome: MigrationTenantOutcome;
  tone: MigrationTone;
  glyph: MigrationGlyph;
  group: OutcomeGroup;
  /**
   * `true` only for `SKIPPED` — a tenant the run was not allowed to touch.
   * `SKIPPED_UP_TO_DATE` is not an exclusion and never sets this.
   */
  requiresReason: boolean;
}

const OUTCOME_DESCRIPTORS: Record<MigrationTenantOutcome, OutcomeDescriptor> = {
  PENDING: {
    outcome: "PENDING",
    tone: "waiting",
    glyph: "clock",
    group: "IN_FLIGHT",
    requiresReason: false,
  },
  RUNNING: {
    outcome: "RUNNING",
    tone: "progress",
    glyph: "spinner",
    group: "IN_FLIGHT",
    requiresReason: false,
  },
  APPLIED: {
    outcome: "APPLIED",
    tone: "success",
    glyph: "check",
    group: "AT_TARGET",
    requiresReason: false,
  },
  FAILED: {
    outcome: "FAILED",
    tone: "danger",
    glyph: "cross",
    group: "NEEDS_ATTENTION",
    requiresReason: false,
  },
  // Excluded by eligibility. The run never reached this database, so the tenant
  // is still behind and belongs with the work that remains.
  SKIPPED: {
    outcome: "SKIPPED",
    tone: "caution",
    glyph: "ban",
    group: "NEEDS_ATTENTION",
    requiresReason: true,
  },
  // Reached and found already at the target version. Nothing is outstanding, so
  // it settles beside APPLIED rather than beside an exclusion.
  SKIPPED_UP_TO_DATE: {
    outcome: "SKIPPED_UP_TO_DATE",
    tone: "neutral",
    glyph: "target",
    group: "AT_TARGET",
    requiresReason: false,
  },
};

export function describeTenantOutcome(
  outcome: MigrationTenantOutcome,
): OutcomeDescriptor {
  return OUTCOME_DESCRIPTORS[outcome];
}

/**
 * Why a tenant was passed over, as the row must present it.
 *
 * `REASON_MISSING` exists because `ck_mtr_skip_reason` makes a reasonless
 * `SKIPPED` row impossible upstream: seeing one means the contract broke, and
 * an operator is better served by that being stated than by an empty cell.
 */
export type SkipDisclosure =
  | { kind: "NONE" }
  | { kind: "ALREADY_AT_TARGET" }
  | { kind: "EXCLUDED"; reason: string }
  | { kind: "EXCLUDED_REASON_MISSING" };

export function readSkipDisclosure(
  result: Pick<MigrationTenantResult, "outcome" | "skipReason">,
): SkipDisclosure {
  if (result.outcome === "SKIPPED_UP_TO_DATE") {
    return { kind: "ALREADY_AT_TARGET" };
  }
  if (result.outcome !== "SKIPPED") return { kind: "NONE" };
  const reason = result.skipReason?.trim();
  return reason
    ? { kind: "EXCLUDED", reason }
    : { kind: "EXCLUDED_REASON_MISSING" };
}

export type OutcomeTally = Record<MigrationTenantOutcome, number>;

export interface OutcomeSummary {
  tally: OutcomeTally;
  total: number;
  inFlight: number;
  atTarget: number;
  needsAttention: number;
}

/**
 * Counts outcomes without ever collapsing `SKIPPED` and `SKIPPED_UP_TO_DATE`
 * into a single "skipped" figure — the collapse that makes a fleet summary
 * unreadable, because it hides how many tenants were never touched.
 */
export function summarizeTenantOutcomes(
  results: readonly Pick<MigrationTenantResult, "outcome">[],
): OutcomeSummary {
  const tally: OutcomeTally = {
    PENDING: 0,
    RUNNING: 0,
    APPLIED: 0,
    FAILED: 0,
    SKIPPED: 0,
    SKIPPED_UP_TO_DATE: 0,
  };
  let inFlight = 0;
  let atTarget = 0;
  let needsAttention = 0;

  for (const result of results) {
    const descriptor = OUTCOME_DESCRIPTORS[result.outcome];
    if (!descriptor) continue;
    tally[result.outcome] += 1;
    if (descriptor.group === "IN_FLIGHT") inFlight += 1;
    else if (descriptor.group === "AT_TARGET") atTarget += 1;
    else needsAttention += 1;
  }

  return {
    tally,
    total: inFlight + atTarget + needsAttention,
    inFlight,
    atTarget,
    needsAttention,
  };
}

export interface SchemaStateDescriptor {
  state: TenantSchemaVersionState;
  tone: MigrationTone;
  glyph: MigrationGlyph;
  /** Surfaced above the fleet table, not as one row colour among seven. */
  isAlarming: boolean;
}

const SCHEMA_STATE_DESCRIPTORS: Record<
  TenantSchemaVersionState,
  SchemaStateDescriptor
> = {
  UP_TO_DATE: {
    state: "UP_TO_DATE",
    tone: "success",
    glyph: "check",
    isAlarming: false,
  },
  PENDING: {
    state: "PENDING",
    tone: "waiting",
    glyph: "clock",
    isAlarming: false,
  },
  RUNNING: {
    state: "RUNNING",
    tone: "progress",
    glyph: "spinner",
    isAlarming: false,
  },
  FAILED: { state: "FAILED", tone: "danger", glyph: "cross", isAlarming: false },
  BLOCKED: {
    state: "BLOCKED",
    tone: "caution",
    glyph: "ban",
    isAlarming: false,
  },
  RESTORE_INCOMPLETE: {
    state: "RESTORE_INCOMPLETE",
    tone: "alarm",
    glyph: "restore",
    isAlarming: true,
  },
  DRIFTED: {
    state: "DRIFTED",
    tone: "alarm",
    glyph: "drift",
    isAlarming: true,
  },
};

export function describeSchemaState(
  state: TenantSchemaVersionState,
): SchemaStateDescriptor {
  return SCHEMA_STATE_DESCRIPTORS[state];
}

export function isAlarmingSchemaState(
  state: TenantSchemaVersionState,
): boolean {
  return (ALARMING_SCHEMA_VERSION_STATES as readonly string[]).includes(state);
}

export interface FleetHealth {
  total: number;
  /** Everything that is not `UP_TO_DATE`. */
  behind: number;
  /** `DRIFTED` + `RESTORE_INCOMPLETE`. */
  alarming: number;
  driftedCount: number;
  restoreIncompleteCount: number;
  /** Distinct schema versions in the fleet; more than one is fragmentation. */
  fragmented: boolean;
}

export function readFleetHealth(
  counts: FleetStateCounts,
  versionCount: number,
): FleetHealth {
  const total =
    counts.upToDate +
    counts.pending +
    counts.running +
    counts.failed +
    counts.blocked +
    counts.restoreIncomplete +
    counts.drifted;

  return {
    total,
    behind: total - counts.upToDate,
    alarming: counts.drifted + counts.restoreIncomplete,
    driftedCount: counts.drifted,
    restoreIncompleteCount: counts.restoreIncomplete,
    fragmented: versionCount > 1,
  };
}

export interface RunStatusDescriptor {
  status: MigrationRunStatus;
  tone: MigrationTone;
  glyph: MigrationGlyph;
  /** The run can still change on its own. */
  isActive: boolean;
}

const RUN_STATUS_DESCRIPTORS: Record<MigrationRunStatus, RunStatusDescriptor> = {
  PENDING: {
    status: "PENDING",
    tone: "waiting",
    glyph: "clock",
    isActive: true,
  },
  RUNNING: {
    status: "RUNNING",
    tone: "progress",
    glyph: "spinner",
    isActive: true,
  },
  PAUSED: {
    status: "PAUSED",
    tone: "caution",
    glyph: "pause",
    isActive: true,
  },
  COMPLETED: {
    status: "COMPLETED",
    tone: "success",
    glyph: "check",
    isActive: false,
  },
  COMPLETED_WITH_ERRORS: {
    status: "COMPLETED_WITH_ERRORS",
    tone: "caution",
    glyph: "cross",
    isActive: false,
  },
  FAILED: {
    status: "FAILED",
    tone: "danger",
    glyph: "cross",
    isActive: false,
  },
  ABORTED: {
    status: "ABORTED",
    tone: "danger",
    glyph: "stop",
    isActive: false,
  },
};

export function describeRunStatus(
  status: MigrationRunStatus,
): RunStatusDescriptor {
  return RUN_STATUS_DESCRIPTORS[status];
}

export interface RunControlAvailability {
  canPause: boolean;
  canResume: boolean;
  canAbort: boolean;
  canRetryFailed: boolean;
}

/**
 * Which run controls the lifecycle allows, before permission is considered.
 * Mirrors `MigrationOrchestratorService`'s accepted transitions so a control
 * that the engine would refuse is never offered.
 */
export function readRunControlAvailability(
  run: Pick<MigrationRun, "status" | "progress">,
): RunControlAvailability {
  const { status } = run;
  return {
    canPause:
      status === "PENDING" || status === "RUNNING" || status === "PAUSED",
    canResume: status === "PAUSED",
    canAbort:
      status === "PENDING" || status === "RUNNING" || status === "PAUSED",
    // `retryFailed` starts a new run filtered to the failed tenants, so it only
    // makes sense once this run has stopped and left failures behind.
    canRetryFailed:
      !describeRunStatus(status).isActive && run.progress.failedTenants > 0,
  };
}

/** Whole-percent completion, clamped, for a determinate progress bar. */
export function readRunProgressPct(
  progress: Pick<
    MigrationRun["progress"],
    "totalTenants" | "succeededTenants" | "failedTenants" | "skippedTenants"
  >,
): number {
  if (progress.totalTenants <= 0) return 0;
  const settled =
    progress.succeededTenants +
    progress.failedTenants +
    progress.skippedTenants;
  return Math.max(0, Math.min(100, Math.round((settled / progress.totalTenants) * 100)));
}
