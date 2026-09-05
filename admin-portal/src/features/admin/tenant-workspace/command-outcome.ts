import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

/**
 * Whether a failed placement command left an outcome the operator still has to
 * resolve, or definitively did not run.
 *
 * The distinction is not cosmetic. An ambiguous outcome keeps the persisted
 * attempt on file so the operator can reconcile it, and blocks any submission
 * with different values — which is correct when the command may have taken
 * effect, and a trap when it certainly did not.
 *
 * A `5xx` alone cannot tell them apart. Both moves refuse some requests with
 * `503` *before* writing anything: the relocation checks the backup runtime and
 * Core's reachability inside `accept()`, before opening the run row and before
 * answering `202`; the storage migration checks Worker recovery evidence before
 * claiming its command row. Those refusals prove nothing started — no ledger,
 * no claim, nothing to reconcile — so the caller must be free to change the
 * destination and try again.
 *
 * Treating one of them as ambiguous is what locked an operator out of a command
 * that had never run, behind a mismatch warning about values they were right to
 * change.
 */
export function isAmbiguousCommandOutcome(
  error: NormalizedApiError,
  definitiveRefusalCodes: ReadonlySet<string>,
): boolean {
  if (error.errorCode && definitiveRefusalCodes.has(error.errorCode)) {
    return false;
  }
  return (
    // A refresh may have replayed the command before the 401 surfaced.
    error.httpStatus === 401 ||
    // No response at all: the request may or may not have reached the server.
    error.httpStatus === 0 ||
    error.httpStatus >= 500 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

/** Worker refusals raised before a relocation exists. */
export const RELOCATION_DEFINITIVE_REFUSAL_CODES: ReadonlySet<string> = new Set(
  ["WORKER.BACKUP.RUNTIME_UNAVAILABLE", "WORKER.RELOCATION.CORE_PLACEMENT_UNAVAILABLE"],
);

/** Core refusals raised before a storage migration command row exists. */
export const STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES: ReadonlySet<string> =
  new Set([
    "STORAGE_MIGRATION_READINESS_UNAVAILABLE",
    "STORAGE_MIGRATION_READINESS_TIMEOUT",
  ]);
