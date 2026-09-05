import { describe, expect, it } from "vitest";
import {
  formatRelocationInstant,
  recoverRelocationRun,
  relocationRollbackExplanation,
  relocationTimelineStates,
  relocationTimelineSteps,
} from "./relocation-timeline";
import type { RelocationRecord, RelocationStepEntry } from "../types";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";

function record(overrides: Partial<RelocationRecord> = {}): RelocationRecord {
  return {
    relocationId: "019f0000-0000-7000-8000-0000000000aa",
    tenantId: TENANT_ID,
    sourceDatabaseServerId: "019f0000-0000-7000-8000-000000000010",
    sourceDatabaseName: "tenant_acme",
    targetDatabaseServerId: "019f0000-0000-7000-8000-000000000011",
    targetDatabaseName: "tenant_acme",
    actorId: "019f0000-0000-7000-8000-0000000000ff",
    reason: "Rebalance the Cairo fleet",
    startedAt: "2026-09-01T10:00:00.000Z",
    steps: [],
    outcome: "RUNNING",
    ...overrides,
  };
}

const step = (
  name: RelocationStepEntry["step"],
  state: RelocationStepEntry["state"] = "DONE",
  detail?: string,
): RelocationStepEntry => ({
  step: name,
  state,
  at: "2026-09-01T10:05:00.000Z",
  ...(detail ? { detail } : {}),
});

describe("relocationTimelineStates", () => {
  it("marks the first unrecorded step active only while the move is running", () => {
    const states = relocationTimelineStates(
      record({ steps: [step("CLAIM"), step("QUIESCE")] }),
    );
    expect(states.map((entry) => entry.state)).toEqual([
      "done",
      "done",
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(states[2].step).toBe("BACKUP");
  });

  it("never leaves a step spinning once the relocation is settled", () => {
    const abandoned = relocationTimelineStates(
      record({
        outcome: "ABANDONED",
        failedStep: "VERIFY",
        rollback: "SOURCE_AUTHORITATIVE",
        steps: [
          step("CLAIM"),
          step("QUIESCE"),
          step("BACKUP"),
          step("PROVISION"),
          step("RESTORE"),
          step("VERIFY", "FAILED", "Row counts did not match on 3 tables"),
        ],
      }),
    );
    expect(abandoned.map((entry) => entry.state)).not.toContain("active");
    expect(abandoned[5]).toMatchObject({
      step: "VERIFY",
      state: "failed",
      detail: "Row counts did not match on 3 tables",
    });
    expect(abandoned[6].state).toBe("pending");
  });

  it("keeps the ten documented steps in their documented order", () => {
    expect(relocationTimelineStates(record()).map((entry) => entry.step)).toEqual([
      "CLAIM",
      "QUIESCE",
      "BACKUP",
      "PROVISION",
      "RESTORE",
      "VERIFY",
      "REPOINT",
      "LIFT",
      "RETAIN",
      "DESTROY",
    ]);
  });
});

describe("relocationTimelineSteps", () => {
  it("surfaces a failed step's detail in both languages, at that step's own position", () => {
    const failed = record({
      outcome: "ABANDONED",
      failedStep: "RESTORE",
      steps: [step("CLAIM"), step("RESTORE", "FAILED", "pg_restore exited 1")],
    });
    // RESTORE is the fifth documented step, so the ledger entry lands there
    // rather than at the index it happened to occupy in `steps[]`.
    const english = relocationTimelineSteps(failed, "en");
    expect(english[4].label).toBe("Restore");
    expect(english[4].detail).toBe("Failed: pg_restore exited 1");
    expect(relocationTimelineSteps(failed, "ar")[4].detail).toBe(
      "فشل: pg_restore exited 1",
    );
  });

  it("labels steps differently per language and stamps completed ones", () => {
    const english = relocationTimelineSteps(record({ steps: [step("CLAIM")] }), "en");
    const arabic = relocationTimelineSteps(record({ steps: [step("CLAIM")] }), "ar");
    expect(english[0].label).toBe("Claim");
    expect(arabic[0].label).toBe("المطالبة");
    expect(english[0].detail).toContain("2026");
    expect(english[1].detail).toContain("Running now");
  });
});

describe("relocationRollbackExplanation", () => {
  it("explains each rollback and returns null when none was recorded", () => {
    expect(relocationRollbackExplanation("SOURCE_AUTHORITATIVE", "en")).toContain(
      "authoritative",
    );
    expect(relocationRollbackExplanation("REPOINT_TO_RETAINED_SOURCE", "ar")).toContain(
      "المصدر",
    );
    expect(relocationRollbackExplanation("NONE", "en")).toContain("no rollback");
    expect(relocationRollbackExplanation(undefined, "en")).toBeNull();
  });
});

describe("recoverRelocationRun", () => {
  it("prefers a running relocation over a completed one", () => {
    const running = { runId: "run-running", record: record() };
    const done = {
      runId: "run-done",
      record: record({ outcome: "RELOCATED", retainUntil: "2026-09-08T10:00:00.000Z" }),
    };
    expect(recoverRelocationRun([done, running])?.runId).toBe("run-running");
  });

  it("adopts a completed relocation whose source is still retained", () => {
    const retained = {
      runId: "run-retained",
      record: record({ outcome: "RELOCATED", retainUntil: "2026-09-08T10:00:00.000Z" }),
    };
    expect(recoverRelocationRun([retained])?.runId).toBe("run-retained");
  });

  it("ignores a relocation whose source was already released", () => {
    const released = {
      runId: "run-released",
      record: record({
        outcome: "RELOCATED",
        retainUntil: "2026-09-08T10:00:00.000Z",
        sourceDestroyedAt: "2026-09-09T10:00:00.000Z",
      }),
    };
    const abandoned = {
      runId: "run-abandoned",
      record: record({ outcome: "ABANDONED", failedStep: "BACKUP" }),
    };
    expect(recoverRelocationRun([released, abandoned])).toBeNull();
    expect(recoverRelocationRun([])).toBeNull();
  });
});

describe("formatRelocationInstant", () => {
  it("is locale-explicit and degrades without throwing", () => {
    expect(formatRelocationInstant("2026-09-01T10:00:00.000Z", "en")).toContain("2026");
    expect(formatRelocationInstant(null, "en")).toBe("Not available");
    expect(formatRelocationInstant("not-a-date", "ar")).toBe("غير متاح");
  });
});
