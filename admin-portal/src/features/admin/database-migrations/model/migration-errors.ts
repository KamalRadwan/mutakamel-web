import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  MigrationMutationPhase,
  ResourceState,
} from "../types/database-migrations";
import { isMigrationContractError } from "./migration-readers";

/**
 * `PROJECTION_UNAVAILABLE` is deliberately a `503`: the schema-version
 * projection is a cache, so losing it degrades the fleet view rather than
 * indicating corruption.
 */
export const PROJECTION_UNAVAILABLE = "PROJECTION_UNAVAILABLE";

/**
 * Precondition failures a start request answers with, each of which explains
 * exactly why a run will not begin.
 */
export const MIGRATION_PRECONDITION_CODES = [
  "MIGRATION_RUN_ALREADY_ACTIVE",
  "MIGRATION_UNTESTED",
  "MIGRATION_TEST_EXPIRED",
  "MIGRATION_TEST_CHECKSUM_MISMATCH",
  "MIGRATION_NOT_APPROVED",
  "MIGRATION_BLOCKED",
  "MIGRATION_LINT_FAILED",
  "MIGRATION_BACKUP_REQUIRED",
  "TENANT_CLAIM_HELD",
  "TENANT_INELIGIBLE",
  "MAINTENANCE_WINDOW_CLOSED",
  "BASELINE_AHEAD_OF_APPLICATION",
] as const;
export type MigrationPreconditionCode =
  (typeof MIGRATION_PRECONDITION_CODES)[number];

export function readPreconditionCode(
  error: NormalizedApiError,
): MigrationPreconditionCode | null {
  const code = error.errorCode.split(".").pop() ?? error.errorCode;
  return (MIGRATION_PRECONDITION_CODES as readonly string[]).includes(code)
    ? (code as MigrationPreconditionCode)
    : null;
}

export function classifyMigrationReadError(
  caught: unknown,
  error: NormalizedApiError,
): ResourceState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 404) return "NOT_FOUND";
  if (isMigrationContractError(caught)) return "ERROR";
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

export function classifyMigrationMutationError(
  caught: unknown,
  error: NormalizedApiError,
): MigrationMutationPhase {
  if (isMigrationContractError(caught)) return "ERROR";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (readPreconditionCode(error)) return "PRECONDITION";
  if (error.httpStatus === 409) return "CONFLICT";
  if (error.httpStatus === 400 || error.httpStatus === 422) {
    return "PRECONDITION";
  }
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

/**
 * The fleet projection is a filter, not the source of truth, so its absence
 * must degrade only the fleet panel and never hide the run controls.
 */
export function isProjectionDegraded(error: NormalizedApiError): boolean {
  return (
    error.httpStatus === 503 ||
    error.httpStatus === 404 ||
    error.httpStatus === 501 ||
    error.errorCode.endsWith(PROJECTION_UNAVAILABLE)
  );
}
