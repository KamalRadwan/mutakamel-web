import { describe, expect, it } from "vitest";
import {
  formatStorageBytes,
  formatStorageInstant,
  isStorageMigrationRollback,
  remainingStorageBytes,
  storageMigrationTimelineSteps,
} from "./migration-timeline";
import {
  isStorageMigrationAwaitingSourceRelease,
  isStorageMigrationSettled,
  type TenantStorageMigrationStatus,
  type TenantStorageMigrationView,
} from "../../storage/types";

function migration(
  status: TenantStorageMigrationStatus,
  overrides: Partial<TenantStorageMigrationView> = {},
): TenantStorageMigrationView {
  return {
    id: "019f0000-0000-7000-8000-000000000040",
    tenantId: "019f0000-0000-7000-8000-000000000001",
    sourceStorageServerId: "019f0000-0000-7000-8000-000000000010",
    targetStorageServerId: "019f0000-0000-7000-8000-000000000011",
    expectedStoragePlacementRevision: "3",
    resultingStoragePlacementRevision: null,
    sourceOperationGeneration: "1",
    targetOperationGeneration: "1",
    status,
    copiedObjectCount: null,
    copiedBytes: null,
    namespaceDigest: null,
    failureCode: null,
    retainSource: false,
    sourceReleaseRequestedAt: null,
    ...overrides,
  };
}

describe("storageMigrationTimelineSteps", () => {
  it("marks the current status active and everything before it done", () => {
    const steps = storageMigrationTimelineSteps(migration("COPIED"), "en");
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "active",
      "pending",
      "pending",
    ]);
  });

  it("shows a completed migration as fully done with nothing still spinning", () => {
    const steps = storageMigrationTimelineSteps(migration("COMPLETED"), "en");
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("reads a retained committed migration as finished, not as stuck", () => {
    const steps = storageMigrationTimelineSteps(
      migration("PLACEMENT_COMMITTED", { retainSource: true }),
      "en",
    );
    // Placement is committed and nothing advances without the operator, so the
    // committed step is done and no step is left spinning.
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "pending",
    ]);
    expect(steps.map((step) => step.state)).not.toContain("active");
    expect(steps[4].detail).toContain("Waiting for you to confirm");
    expect(steps[4].detail).toContain("tenant is unaffected");
  });

  it("goes back to spinning once the deletion has actually been requested", () => {
    const steps = storageMigrationTimelineSteps(
      migration("PLACEMENT_COMMITTED", {
        retainSource: true,
        sourceReleaseRequestedAt: "2026-09-03T10:00:00.000Z",
      }),
      "en",
    );
    expect(steps[3].state).toBe("active");
    expect(steps[4].state).toBe("pending");
  });

  it("keeps a non-retaining committed migration on the normal ladder", () => {
    const steps = storageMigrationTimelineSteps(
      migration("PLACEMENT_COMMITTED", { retainSource: false }),
      "en",
    );
    expect(steps[3].state).toBe("active");
  });

  it("replaces the ladder with a rollback explanation and surfaces the failure code", () => {
    const rollingBack = storageMigrationTimelineSteps(
      migration("ROLLING_BACK"),
      "en",
    );
    expect(rollingBack).toHaveLength(1);
    expect(rollingBack[0].state).toBe("warning");

    const rolledBack = storageMigrationTimelineSteps(
      migration("ROLLED_BACK", { failureCode: "STORAGE_TARGET_UNREACHABLE" }),
      "ar",
    );
    expect(rolledBack[0].state).toBe("failed");
    expect(rolledBack[0].detail).toContain("STORAGE_TARGET_UNREACHABLE");
    expect(rolledBack[0].label).toBe("تم التراجع");
  });

  it("labels the ladder differently per language", () => {
    expect(storageMigrationTimelineSteps(migration("ACCEPTED"), "en")[0].label).toBe(
      "Accepted",
    );
    expect(storageMigrationTimelineSteps(migration("ACCEPTED"), "ar")[0].label).toBe(
      "مقبول",
    );
  });
});

describe("isStorageMigrationRollback", () => {
  it("identifies only the two unwinding statuses", () => {
    expect(isStorageMigrationRollback("ROLLING_BACK")).toBe(true);
    expect(isStorageMigrationRollback("ROLLED_BACK")).toBe(true);
    expect(isStorageMigrationRollback("COPYING")).toBe(false);
    expect(isStorageMigrationRollback("COMPLETED")).toBe(false);
  });
});

describe("formatStorageBytes", () => {
  it("scales byte strings without losing the not-set case", () => {
    // One fractional digit below 10 units, none at or above it — the same rule
    // the Backup module's formatter uses, so the two read alike.
    expect(formatStorageBytes("1073741824", "en")).toBe("1.0 GB");
    expect(formatStorageBytes("53687091200", "en")).toBe("50 GB");
    expect(formatStorageBytes("0", "en")).toBe("0 B");
    expect(formatStorageBytes(null, "en")).toBe("Not set");
    expect(formatStorageBytes("", "ar")).toBe("غير محدد");
    expect(formatStorageBytes("not-a-number", "en")).toBe("Not set");
  });
});

describe("remainingStorageBytes", () => {
  it("subtracts with BigInt so quotas beyond MAX_SAFE_INTEGER stay exact", () => {
    expect(
      remainingStorageBytes({
        maxBytes: "9007199254740993",
        reservedBytes: "1",
      }),
    ).toBe("9007199254740992");
  });

  it("never reports a negative remainder and passes through an undeclared ceiling", () => {
    expect(
      remainingStorageBytes({ maxBytes: "100", reservedBytes: "250" }),
    ).toBe("0");
    expect(
      remainingStorageBytes({ maxBytes: null, reservedBytes: "250" }),
    ).toBeNull();
    expect(
      remainingStorageBytes({ maxBytes: "oops", reservedBytes: "1" }),
    ).toBeNull();
  });
});

describe("formatStorageInstant", () => {
  it("is locale-explicit and degrades without throwing", () => {
    expect(formatStorageInstant("2026-09-01T10:00:00.000Z", "en")).toContain("2026");
    expect(formatStorageInstant(null, "ar")).toBe("غير متاح");
    expect(formatStorageInstant("nope", "en")).toBe("Not available");
  });
});

describe("isStorageMigrationAwaitingSourceRelease", () => {
  it("is true only for a committed migration still holding its source", () => {
    expect(
      isStorageMigrationAwaitingSourceRelease(
        migration("PLACEMENT_COMMITTED", { retainSource: true }),
      ),
    ).toBe(true);
    expect(
      isStorageMigrationAwaitingSourceRelease(
        migration("PLACEMENT_COMMITTED", { retainSource: false }),
      ),
    ).toBe(false);
    expect(
      isStorageMigrationAwaitingSourceRelease(
        migration("PLACEMENT_COMMITTED", {
          retainSource: true,
          sourceReleaseRequestedAt: "2026-09-03T10:00:00.000Z",
        }),
      ),
    ).toBe(false);
    expect(
      isStorageMigrationAwaitingSourceRelease(
        migration("COPYING", { retainSource: true }),
      ),
    ).toBe(false);
  });
});

describe("isStorageMigrationSettled", () => {
  it("stops the poll on a terminal status and on a retained resting migration", () => {
    expect(isStorageMigrationSettled(migration("COMPLETED"))).toBe(true);
    expect(isStorageMigrationSettled(migration("ROLLED_BACK"))).toBe(true);
    expect(
      isStorageMigrationSettled(
        migration("PLACEMENT_COMMITTED", { retainSource: true }),
      ),
    ).toBe(true);
  });

  it("keeps polling anything that can still advance on its own", () => {
    expect(isStorageMigrationSettled(migration("ACCEPTED"))).toBe(false);
    expect(isStorageMigrationSettled(migration("COPYING"))).toBe(false);
    expect(isStorageMigrationSettled(migration("ROLLING_BACK"))).toBe(false);
    expect(
      isStorageMigrationSettled(
        migration("PLACEMENT_COMMITTED", { retainSource: false }),
      ),
    ).toBe(false);
    expect(
      isStorageMigrationSettled(
        migration("PLACEMENT_COMMITTED", {
          retainSource: true,
          sourceReleaseRequestedAt: "2026-09-03T10:00:00.000Z",
        }),
      ),
    ).toBe(false);
  });
});
