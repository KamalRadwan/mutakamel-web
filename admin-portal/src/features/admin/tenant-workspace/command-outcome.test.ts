import { describe, expect, it } from "vitest";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  isAmbiguousCommandOutcome,
  RELOCATION_DEFINITIVE_REFUSAL_CODES,
  STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
} from "./command-outcome";

function error(httpStatus: number, errorCode = ""): NormalizedApiError {
  return { isNormalized: true, httpStatus, errorCode, message: "failed" };
}

describe("isAmbiguousCommandOutcome", () => {
  it("keeps a lost or unanswered write undecided", () => {
    for (const outcome of [error(0), error(500), error(502), error(504)]) {
      expect(
        isAmbiguousCommandOutcome(outcome, RELOCATION_DEFINITIVE_REFUSAL_CODES),
      ).toBe(true);
    }
  });

  it("keeps a refresh-replayed write and an in-flight idempotency key undecided", () => {
    expect(
      isAmbiguousCommandOutcome(error(401), RELOCATION_DEFINITIVE_REFUSAL_CODES),
    ).toBe(true);
    expect(
      isAmbiguousCommandOutcome(
        error(409, "GW.IDEM.IN_FLIGHT"),
        RELOCATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(true);
  });

  it("settles a 4xx, which ends the intent", () => {
    expect(
      isAmbiguousCommandOutcome(
        error(422, "WORKER.RELOCATION.TENANT_INELIGIBLE"),
        RELOCATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(false);
  });

  it("settles a 503 the Worker raises before the relocation exists", () => {
    // The regression this guards: a backup runtime that refuses at accept time
    // never opened a run, so the operator must stay free to pick a different
    // destination. Treating it as undecided locked them behind an intent
    // mismatch about a command that had not run.
    expect(
      isAmbiguousCommandOutcome(
        error(503, "WORKER.BACKUP.RUNTIME_UNAVAILABLE"),
        RELOCATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(false);
    expect(
      isAmbiguousCommandOutcome(
        error(503, "WORKER.RELOCATION.CORE_PLACEMENT_UNAVAILABLE"),
        RELOCATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(false);
  });

  it("settles a 503 Core raises before a storage migration command row exists", () => {
    expect(
      isAmbiguousCommandOutcome(
        error(503, "STORAGE_MIGRATION_READINESS_UNAVAILABLE"),
        STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(false);
  });

  it("still treats a 503 it cannot attribute as undecided", () => {
    // A post-commit failure carries a different code and genuinely leaves work
    // outstanding, so the default has to stay conservative.
    expect(
      isAmbiguousCommandOutcome(
        error(503, "STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED"),
        STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(true);
  });

  it("does not let one flow's refusal settle the other's command", () => {
    expect(
      isAmbiguousCommandOutcome(
        error(503, "WORKER.BACKUP.RUNTIME_UNAVAILABLE"),
        STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
      ),
    ).toBe(true);
  });
});
