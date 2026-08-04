import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { ApplicationTechnicalReadinessView } from "../types";

export type TechnicalProvisioningErrorKind =
  | "STALE"
  | "IN_FLIGHT"
  | "FORBIDDEN"
  | "AMBIGUOUS"
  | "TERMINAL";

export type ActivationReadinessState =
  | "LOADING"
  | "UNAVAILABLE"
  | "BLOCKED"
  | "ALLOWED";

export function classifyTechnicalProvisioningError(
  error: NormalizedApiError,
): TechnicalProvisioningErrorKind {
  if (error.errorCode === "APPLICATION_TECHNICAL_DEFINITION_REVISION_STALE") {
    return "STALE";
  }
  if (error.errorCode === "GW.IDEM.IN_FLIGHT") return "IN_FLIGHT";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") {
    return "AMBIGUOUS";
  }
  return "TERMINAL";
}

export function shouldReconcileTechnicalProvisioning(
  kind: TechnicalProvisioningErrorKind,
): boolean {
  return kind === "STALE" || kind === "IN_FLIGHT" || kind === "AMBIGUOUS";
}

export function getActivationReadinessState(
  readiness: ApplicationTechnicalReadinessView | null,
  isLoading: boolean,
  hasError: boolean,
): ActivationReadinessState {
  if (isLoading && !readiness) return "LOADING";
  if (hasError || !readiness) return "UNAVAILABLE";
  return readiness.activationAllowed ? "ALLOWED" : "BLOCKED";
}

