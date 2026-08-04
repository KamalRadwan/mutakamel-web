import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

const IDEMPOTENCY_IN_FLIGHT_CODE = "GW.IDEM.IN_FLIGHT";

/**
 * A definitive 4xx response completes the original write intent at Gateway,
 * so a later operator submission must use a new key. An in-flight response or
 * an unknown/5xx outcome keeps the original key for exact reconciliation.
 */
export function shouldResetDatabaseServerWriteKey(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 400 &&
    error.httpStatus < 500 &&
    error.errorCode !== IDEMPOTENCY_IN_FLIGHT_CODE
  );
}
