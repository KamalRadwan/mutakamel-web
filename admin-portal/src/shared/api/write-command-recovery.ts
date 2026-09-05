import type { ApiRequestOutcome } from "@/lib/api/axiosClient";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

const GATEWAY_IDEMPOTENCY_IN_FLIGHT = "GW.IDEM.IN_FLIGHT";

type WriteOutcome = {
  httpStatus: NormalizedApiError["httpStatus"];
  errorCode: NormalizedApiError["errorCode"];
  requestOutcome?: ApiRequestOutcome;
};

/**
 * A request that reached the server and settled, only for the admin session
 * epoch to move underneath it.
 *
 * The transport reports this as a synthetic 409, which reads as a definitive
 * client refusal — so status and code alone say "this command never ran" about
 * a command that may well have succeeded. Clearing its recovery key there is
 * how a second, differently-keyed attempt gets sent: a duplicate backup, a
 * duplicate restore. It has to be answered before anything else is examined.
 */
function settledBeforeSessionChange(error: WriteOutcome): boolean {
  return error.requestOutcome === "settled-before-session-change";
}

/**
 * A definitive client rejection completes the submitted command identity.
 * Unknown transport/5xx outcomes and Gateway in-flight responses keep the
 * exact key so a later retry can reconcile the same command.
 */
export function shouldRotateWriteCommandKey(error: WriteOutcome): boolean {
  if (settledBeforeSessionChange(error)) return false;
  return (
    error.httpStatus >= 400 &&
    error.httpStatus < 500 &&
    error.errorCode !== GATEWAY_IDEMPOTENCY_IN_FLIGHT
  );
}

export function isAmbiguousWriteOutcome(error: WriteOutcome): boolean {
  if (settledBeforeSessionChange(error)) return true;
  return (
    error.errorCode === GATEWAY_IDEMPOTENCY_IN_FLIGHT ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.httpStatus >= 500
  );
}
