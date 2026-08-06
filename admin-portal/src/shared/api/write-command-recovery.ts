import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const GATEWAY_IDEMPOTENCY_IN_FLIGHT = "GW.IDEM.IN_FLIGHT";

/**
 * A definitive client rejection completes the submitted command identity.
 * Unknown transport/5xx outcomes and Gateway in-flight responses keep the
 * exact key so a later retry can reconcile the same command.
 */
export function shouldRotateWriteCommandKey(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 400 &&
    error.httpStatus < 500 &&
    error.errorCode !== GATEWAY_IDEMPOTENCY_IN_FLIGHT
  );
}

export function isAmbiguousWriteOutcome(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.errorCode === GATEWAY_IDEMPOTENCY_IN_FLIGHT ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.httpStatus >= 500
  );
}
