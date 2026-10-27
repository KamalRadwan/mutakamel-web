import { describe, expect, it } from "vitest";

import { normalizeApiError } from "@/shared/api/normalized-api-error";
import {
  classifyMigrationMutationError,
  MIGRATION_PRECONDITION_CODES,
  readPreconditionCode,
} from "./migration-errors";

// Run-start / retry preconditions, plus the existing downgrade backup refusal.
// Keep the public codes explicit: suffix matching hid the Worker/portal drift.
const WORKER_PRECONDITIONS = [
  ["WORKER.MIGRATION.RUN_ALREADY_ACTIVE", 409],
  ["WORKER.MIGRATION.BLOCKED", 409],
  ["WORKER.MIGRATION.LINT_FAILED", 422],
  ["WORKER.MIGRATION.UNTESTED", 422],
  ["WORKER.MIGRATION.BACKUP_REQUIRED", 422],
  ["WORKER.TENANT_CLAIM.HELD", 409],
  ["WORKER.MIGRATION.TENANT_INELIGIBLE", 422],
  ["WORKER.MIGRATION.MAINTENANCE_WINDOW_CLOSED", 422],
] as const;

describe("Worker migration precondition contract", () => {
  it("maps the complete current precondition set without speculative codes", () => {
    expect([...MIGRATION_PRECONDITION_CODES].sort()).toEqual(
      WORKER_PRECONDITIONS.map(([code]) => code).sort(),
    );
  });

  it.each(WORKER_PRECONDITIONS)("recognizes %s through either error envelope", (code, status) => {
    const details = {
      reason: ["UnsafeIndex1900000000002 L1/CREATE_INDEX_NOT_CONCURRENT"],
    };
    for (const data of [
      { success: false, statusCode: status, errorCode: code, message: "Refused", details },
      { status, code, title: "Refused", errors: details },
    ]) {
      const error = normalizeApiError({ response: { status, data } });
      expect(readPreconditionCode(error)).toBe(code);
      expect(classifyMigrationMutationError(null, error)).toBe("PRECONDITION");
      expect(error.details).toEqual(details);
    }
  });

  it.each([
    "BLOCKED",
    "CRM.MIGRATION.BLOCKED",
    "WORKER.OTHER.RUN_ALREADY_ACTIVE",
    "MIGRATION_RUN_ALREADY_ACTIVE",
    "WORKER.MIGRATION.TEST_EXPIRED",
    "WORKER.MIGRATION.TEST_CHECKSUM_MISMATCH",
    "WORKER.MIGRATION.NOT_APPROVED",
    "WORKER.MIGRATION.BASELINE_AHEAD_OF_APPLICATION",
  ])("does not recognize non-contract code %s", (code) => {
    const error = normalizeApiError({
      response: { status: 409, data: { success: false, errorCode: code, message: "Conflict" } },
    });
    expect(readPreconditionCode(error)).toBeNull();
    expect(classifyMigrationMutationError(null, error)).toBe("CONFLICT");
  });
});
