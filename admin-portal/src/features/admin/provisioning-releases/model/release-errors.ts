import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  ReleaseMutationPhase,
  ResourceState,
} from "../types/provisioning-releases";

export function classifyReleaseReadError(
  caught: unknown,
  error: NormalizedApiError,
): ResourceState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 404) return "NOT_FOUND";
  if (isContractError(caught)) return "ERROR";
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

export function classifyReleaseMutationError(
  caught: unknown,
  error: NormalizedApiError,
): ReleaseMutationPhase {
  if (isContractError(caught)) return "ERROR";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.errorCode === "GW.IDEM.IN_FLIGHT") return "IN_FLIGHT";
  if (error.httpStatus === 409) return "CONFLICT";
  if ([400, 422].includes(error.httpStatus)) return "VALIDATION";
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function isContractError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    (caught.message === "INVALID_PROVISIONING_RELEASE_RESPONSE" ||
      caught.message === "INVALID_PROVISIONING_RELEASE_ID" ||
      caught.message === "INVALID_PROVISIONING_RELEASE_IDEMPOTENCY_KEY" ||
      caught.message === "INVALID_PROVISIONING_RELEASE_SIGNING_STATE")
  );
}
