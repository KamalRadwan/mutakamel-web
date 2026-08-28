import { describe, expect, it } from "vitest";

import {
  INVALID_MIGRATION_RESPONSE,
  INVALID_MIGRATION_RUN_ID,
  isMigrationContractError,
  readFleetStatus,
  readFleetStatusList,
  readMigrationRun,
  readMigrationRunList,
  readTenantResultPage,
  readTenantSchemaVersionPage,
  requireRunId,
} from "./migration-readers";

const RUN_ID = "019f0000-0000-7000-8000-000000000001";

function runPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    applicationKey: "crm",
    targetVersion: "1801500000100-add-index",
    strategy: "batched",
    batchSize: 50,
    failFast: false,
    status: "RUNNING",
    progress: {
      totalTenants: 10,
      queuedTenants: 4,
      inFlightTenants: 1,
      succeededTenants: 3,
      failedTenants: 1,
      skippedTenants: 1,
      appliedMigrations: 6,
      currentBatch: 2,
      dryRun: true,
    },
    summary: null,
    triggeredBy: "release 42",
    startedAt: "2026-08-28T10:00:00.000Z",
    pausedAt: null,
    finishedAt: null,
    error: null,
    ...overrides,
  };
}

describe("run readers", () => {
  it("reads a bare Worker run payload including the dry-run flag", () => {
    const run = readMigrationRun(runPayload());

    expect(run.id).toBe(RUN_ID);
    expect(run.status).toBe("RUNNING");
    expect(run.progress.dryRun).toBe(true);
    expect(run.progress.skippedTenants).toBe(1);
    expect(run.tenantScope).toBeNull();
  });

  it("accepts the documented data envelope as well as the bare payload", () => {
    expect(readMigrationRun({ data: runPayload() }).id).toBe(RUN_ID);
    expect(readMigrationRunList({ data: [runPayload()] })).toHaveLength(1);
    expect(readMigrationRunList([runPayload()])).toHaveLength(1);
  });

  it("recovers the tenant scope from the run's tenant filter", () => {
    const run = readMigrationRun(
      runPayload({
        progress: {
          ...runPayload().progress,
          tenantFilter: { ids: ["tenant-a", "tenant-b"] },
        },
      }),
    );
    expect(run.tenantScope).toEqual(["tenant-a", "tenant-b"]);
  });

  it("defaults a missing progress blob rather than throwing", () => {
    const run = readMigrationRun(runPayload({ progress: null }));
    expect(run.progress.totalTenants).toBe(0);
    expect(run.progress.dryRun).toBe(false);
  });

  it("rejects an unknown run status", () => {
    expect(() => readMigrationRun(runPayload({ status: "HALTED" }))).toThrow(
      INVALID_MIGRATION_RESPONSE,
    );
  });
});

describe("tenant result readers", () => {
  it("preserves the two skip outcomes and the skip reason verbatim", () => {
    const page = readTenantResultPage({
      data: [
        {
          tenantId: "tenant-a",
          outcome: "SKIPPED",
          skipReason: "Relocation in progress",
          appliedCount: 0,
          pendingCount: 2,
          durationMs: null,
          migrationName: "1801-add-index",
          finishedAt: "2026-08-28T10:05:00.000Z",
        },
        {
          tenantId: "tenant-b",
          outcome: "SKIPPED_UP_TO_DATE",
          skipReason: null,
          appliedCount: 0,
          pendingCount: 0,
          durationMs: 12,
          migrationName: "1801-add-index",
          finishedAt: "2026-08-28T10:05:01.000Z",
        },
      ],
      meta: { page: 1, limit: 50, total: 2 },
    });

    expect(page.items.map((item) => item.outcome)).toEqual([
      "SKIPPED",
      "SKIPPED_UP_TO_DATE",
    ]);
    expect(page.items[0].skipReason).toBe("Relocation in progress");
    expect(page.items[1].skipReason).toBeNull();
    expect(page.meta).toEqual({ page: 1, limit: 50, total: 2 });
  });

  it("keeps a reasonless SKIPPED row instead of dropping it", () => {
    const page = readTenantResultPage([
      { tenantId: "tenant-c", outcome: "SKIPPED", skipReason: null },
    ]);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].skipReason).toBeNull();
  });

  it("rejects an unknown outcome value", () => {
    expect(() =>
      readTenantResultPage([{ tenantId: "tenant-d", outcome: "IGNORED" }]),
    ).toThrow(INVALID_MIGRATION_RESPONSE);
  });

  it("derives page meta when the route returns a bare array", () => {
    const page = readTenantResultPage([
      { tenantId: "tenant-e", outcome: "APPLIED" },
    ]);
    expect(page.meta.total).toBe(1);
    expect(page.meta.page).toBe(1);
  });
});

describe("fleet readers", () => {
  const fleetPayload = {
    applicationKey: "core",
    availableVersion: "1801-latest",
    counts: {
      upToDate: 10,
      pending: 2,
      running: 1,
      failed: 1,
      blocked: 0,
      restoreIncomplete: 1,
      drifted: 2,
    },
    versionDistribution: [
      { schemaVersion: "1799-old", tenantCount: 3 },
      { schemaVersion: "1801-latest", tenantCount: 14 },
    ],
    activeRun: { runId: RUN_ID, status: "RUNNING", progressPct: 42 },
  };

  it("orders the version distribution by tenant count so fragmentation reads at a glance", () => {
    const fleet = readFleetStatus(fleetPayload);
    expect(fleet.versionDistribution.map((slice) => slice.schemaVersion)).toEqual(
      ["1801-latest", "1799-old"],
    );
    expect(fleet.counts.drifted).toBe(2);
    expect(fleet.counts.restoreIncomplete).toBe(1);
    expect(fleet.activeRun?.progressPct).toBe(42);
  });

  it("accepts a single application object or a list of them", () => {
    expect(readFleetStatusList(fleetPayload)).toHaveLength(1);
    expect(readFleetStatusList({ data: [fleetPayload, fleetPayload] })).toHaveLength(
      2,
    );
  });

  it("clamps an out-of-range active-run percentage", () => {
    const fleet = readFleetStatus({
      ...fleetPayload,
      activeRun: { runId: RUN_ID, status: "RUNNING", progressPct: 320 },
    });
    expect(fleet.activeRun?.progressPct).toBe(100);
  });
});

describe("tenant projection readers", () => {
  it("reads every projection state and stringifies free-form drift detail", () => {
    const page = readTenantSchemaVersionPage({
      data: [
        {
          tenantId: "tenant-a",
          applicationKey: "crm",
          schemaVersion: "1799-old",
          state: "DRIFTED",
          observedAt: "2026-08-28T09:00:00.000Z",
          driftDetail: { missingIndex: ["idx_contacts_email"] },
        },
        {
          tenantId: "tenant-b",
          applicationKey: "crm",
          schemaVersion: "1801-latest",
          state: "RESTORE_INCOMPLETE",
          observedAt: null,
          driftDetail: null,
        },
      ],
      meta: { page: 2, limit: 25, total: 60 },
    });

    expect(page.items.map((item) => item.state)).toEqual([
      "DRIFTED",
      "RESTORE_INCOMPLETE",
    ]);
    expect(page.items[0].driftDetail).toContain("idx_contacts_email");
    expect(page.items[1].driftDetail).toBeNull();
    expect(page.meta).toEqual({ page: 2, limit: 25, total: 60 });
  });

  it("rejects an unknown projection state", () => {
    expect(() =>
      readTenantSchemaVersionPage([
        {
          tenantId: "tenant-x",
          applicationKey: "crm",
          schemaVersion: "1",
          state: "STALE",
        },
      ]),
    ).toThrow(INVALID_MIGRATION_RESPONSE);
  });
});

describe("run id guard", () => {
  it("accepts an identifier and rejects a path traversal attempt", () => {
    expect(requireRunId(` ${RUN_ID} `)).toBe(RUN_ID);
    expect(() => requireRunId("../../admin/jobs")).toThrow(
      INVALID_MIGRATION_RUN_ID,
    );
    expect(() => requireRunId("")).toThrow(INVALID_MIGRATION_RUN_ID);
  });

  it("recognises both contract errors", () => {
    expect(isMigrationContractError(new Error(INVALID_MIGRATION_RESPONSE))).toBe(
      true,
    );
    expect(isMigrationContractError(new Error(INVALID_MIGRATION_RUN_ID))).toBe(
      true,
    );
    expect(isMigrationContractError(new Error("boom"))).toBe(false);
  });
});
