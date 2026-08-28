import { describe, expect, it } from "vitest";

import {
  describeRunStatus,
  describeSchemaState,
  describeTenantOutcome,
  isAlarmingSchemaState,
  readFleetHealth,
  readRunControlAvailability,
  readRunProgressPct,
  readSkipDisclosure,
  summarizeTenantOutcomes,
} from "./migration-outcomes";
import {
  MIGRATION_TENANT_OUTCOMES,
  TENANT_SCHEMA_VERSION_STATES,
  type MigrationRunProgress,
  type MigrationTenantOutcome,
} from "../types/database-migrations";

describe("tenant outcome descriptors", () => {
  it("keeps SKIPPED and SKIPPED_UP_TO_DATE distinguishable without colour", () => {
    const skipped = describeTenantOutcome("SKIPPED");
    const upToDate = describeTenantOutcome("SKIPPED_UP_TO_DATE");

    // Different glyph — the distinction survives a monochrome render.
    expect(skipped.glyph).not.toBe(upToDate.glyph);
    // Different tone — the distinction is reinforced, never carried alone.
    expect(skipped.tone).not.toBe(upToDate.tone);
    // Different meaning: one is outstanding work, the other is finished work.
    expect(skipped.group).toBe("NEEDS_ATTENTION");
    expect(upToDate.group).toBe("AT_TARGET");
    // Only an exclusion owes an explanation.
    expect(skipped.requiresReason).toBe(true);
    expect(upToDate.requiresReason).toBe(false);
  });

  it("groups an already-at-target tenant with applied rather than with failures", () => {
    expect(describeTenantOutcome("SKIPPED_UP_TO_DATE").group).toBe(
      describeTenantOutcome("APPLIED").group,
    );
    expect(describeTenantOutcome("SKIPPED").group).toBe(
      describeTenantOutcome("FAILED").group,
    );
  });

  it("describes every wire outcome with a unique enum echo", () => {
    for (const outcome of MIGRATION_TENANT_OUTCOMES) {
      expect(describeTenantOutcome(outcome).outcome).toBe(outcome);
    }
  });
});

describe("skip disclosure", () => {
  it("surfaces the recorded reason for an excluded tenant", () => {
    expect(
      readSkipDisclosure({
        outcome: "SKIPPED",
        skipReason: "Relocation in progress",
      }),
    ).toEqual({ kind: "EXCLUDED", reason: "Relocation in progress" });
  });

  it("reports a reasonless exclusion instead of rendering an empty cell", () => {
    expect(
      readSkipDisclosure({ outcome: "SKIPPED", skipReason: null }),
    ).toEqual({ kind: "EXCLUDED_REASON_MISSING" });
    expect(
      readSkipDisclosure({ outcome: "SKIPPED", skipReason: "   " }),
    ).toEqual({ kind: "EXCLUDED_REASON_MISSING" });
  });

  it("does not ask an already-at-target tenant for a reason", () => {
    expect(
      readSkipDisclosure({ outcome: "SKIPPED_UP_TO_DATE", skipReason: null }),
    ).toEqual({ kind: "ALREADY_AT_TARGET" });
  });

  it("returns no disclosure for outcomes that are not skips", () => {
    for (const outcome of ["PENDING", "RUNNING", "APPLIED", "FAILED"] as const) {
      expect(readSkipDisclosure({ outcome, skipReason: null })).toEqual({
        kind: "NONE",
      });
    }
  });
});

describe("outcome summary", () => {
  const results: Array<{ outcome: MigrationTenantOutcome }> = [
    { outcome: "APPLIED" },
    { outcome: "APPLIED" },
    { outcome: "SKIPPED_UP_TO_DATE" },
    { outcome: "SKIPPED_UP_TO_DATE" },
    { outcome: "SKIPPED_UP_TO_DATE" },
    { outcome: "SKIPPED" },
    { outcome: "FAILED" },
    { outcome: "PENDING" },
    { outcome: "RUNNING" },
  ];

  it("never merges the two skip outcomes into one figure", () => {
    const summary = summarizeTenantOutcomes(results);

    expect(summary.tally.SKIPPED).toBe(1);
    expect(summary.tally.SKIPPED_UP_TO_DATE).toBe(3);
    expect(summary.tally.SKIPPED).not.toBe(
      summary.tally.SKIPPED + summary.tally.SKIPPED_UP_TO_DATE,
    );
  });

  it("counts an already-at-target tenant as settled and an exclusion as outstanding", () => {
    const summary = summarizeTenantOutcomes(results);

    expect(summary.atTarget).toBe(5); // 2 applied + 3 already at target
    expect(summary.needsAttention).toBe(2); // 1 failed + 1 excluded
    expect(summary.inFlight).toBe(2);
    expect(summary.total).toBe(9);
  });

  it("returns a zeroed tally for an empty run", () => {
    const summary = summarizeTenantOutcomes([]);
    expect(summary.total).toBe(0);
    for (const outcome of MIGRATION_TENANT_OUTCOMES) {
      expect(summary.tally[outcome]).toBe(0);
    }
  });
});

describe("schema state descriptors", () => {
  it("marks only DRIFTED and RESTORE_INCOMPLETE as alarming", () => {
    const alarming = TENANT_SCHEMA_VERSION_STATES.filter((state) =>
      describeSchemaState(state).isAlarming,
    );
    expect(alarming).toEqual(["RESTORE_INCOMPLETE", "DRIFTED"]);
    expect(isAlarmingSchemaState("DRIFTED")).toBe(true);
    expect(isAlarmingSchemaState("RESTORE_INCOMPLETE")).toBe(true);
    expect(isAlarmingSchemaState("FAILED")).toBe(false);
    expect(isAlarmingSchemaState("BLOCKED")).toBe(false);
  });

  it("separates an alarming state from a merely failed one by glyph and tone", () => {
    const drifted = describeSchemaState("DRIFTED");
    const failed = describeSchemaState("FAILED");
    expect(drifted.glyph).not.toBe(failed.glyph);
    expect(drifted.tone).not.toBe(failed.tone);
  });
});

describe("fleet health", () => {
  it("counts everything that is not up to date as behind and flags fragmentation", () => {
    const health = readFleetHealth(
      {
        upToDate: 40,
        pending: 5,
        running: 2,
        failed: 1,
        blocked: 1,
        restoreIncomplete: 2,
        drifted: 3,
      },
      4,
    );

    expect(health.total).toBe(54);
    expect(health.behind).toBe(14);
    expect(health.alarming).toBe(5);
    expect(health.driftedCount).toBe(3);
    expect(health.restoreIncompleteCount).toBe(2);
    expect(health.fragmented).toBe(true);
  });

  it("treats one dominant version as an unfragmented fleet", () => {
    const health = readFleetHealth(
      {
        upToDate: 10,
        pending: 0,
        running: 0,
        failed: 0,
        blocked: 0,
        restoreIncomplete: 0,
        drifted: 0,
      },
      1,
    );
    expect(health.behind).toBe(0);
    expect(health.alarming).toBe(0);
    expect(health.fragmented).toBe(false);
  });
});

describe("run control availability", () => {
  const progress = (
    overrides: Partial<MigrationRunProgress> = {},
  ): MigrationRunProgress => ({
    totalTenants: 10,
    queuedTenants: 0,
    inFlightTenants: 0,
    succeededTenants: 0,
    failedTenants: 0,
    skippedTenants: 0,
    appliedMigrations: 0,
    currentBatch: 1,
    dryRun: false,
    ...overrides,
  });

  it("offers pause and abort only while the run can still change", () => {
    for (const status of ["PENDING", "RUNNING", "PAUSED"] as const) {
      const availability = readRunControlAvailability({
        status,
        progress: progress(),
      });
      expect(availability.canPause).toBe(true);
      expect(availability.canAbort).toBe(true);
    }
    for (const status of ["COMPLETED", "FAILED", "ABORTED"] as const) {
      const availability = readRunControlAvailability({
        status,
        progress: progress(),
      });
      expect(availability.canPause).toBe(false);
      expect(availability.canAbort).toBe(false);
    }
  });

  it("offers resume only from PAUSED", () => {
    expect(
      readRunControlAvailability({ status: "PAUSED", progress: progress() })
        .canResume,
    ).toBe(true);
    expect(
      readRunControlAvailability({ status: "RUNNING", progress: progress() })
        .canResume,
    ).toBe(false);
  });

  it("offers retry-failed only once a stopped run has left failures", () => {
    expect(
      readRunControlAvailability({
        status: "COMPLETED_WITH_ERRORS",
        progress: progress({ failedTenants: 3 }),
      }).canRetryFailed,
    ).toBe(true);
    expect(
      readRunControlAvailability({
        status: "COMPLETED",
        progress: progress({ failedTenants: 0 }),
      }).canRetryFailed,
    ).toBe(false);
    expect(
      readRunControlAvailability({
        status: "RUNNING",
        progress: progress({ failedTenants: 3 }),
      }).canRetryFailed,
    ).toBe(false);
  });
});

describe("run status descriptors and progress", () => {
  it("treats only PENDING, RUNNING and PAUSED as active", () => {
    expect(describeRunStatus("PENDING").isActive).toBe(true);
    expect(describeRunStatus("RUNNING").isActive).toBe(true);
    expect(describeRunStatus("PAUSED").isActive).toBe(true);
    expect(describeRunStatus("COMPLETED").isActive).toBe(false);
    expect(describeRunStatus("COMPLETED_WITH_ERRORS").isActive).toBe(false);
    expect(describeRunStatus("ABORTED").isActive).toBe(false);
  });

  it("counts every settled tenant, including skips, toward completion", () => {
    expect(
      readRunProgressPct({
        totalTenants: 10,
        succeededTenants: 4,
        failedTenants: 1,
        skippedTenants: 5,
      }),
    ).toBe(100);
    expect(
      readRunProgressPct({
        totalTenants: 0,
        succeededTenants: 0,
        failedTenants: 0,
        skippedTenants: 0,
      }),
    ).toBe(0);
    expect(
      readRunProgressPct({
        totalTenants: 8,
        succeededTenants: 2,
        failedTenants: 0,
        skippedTenants: 0,
      }),
    ).toBe(25);
  });
});
