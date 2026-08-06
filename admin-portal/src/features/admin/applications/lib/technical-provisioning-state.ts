import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  ApplicationTechnicalReadinessView,
  ApplicationView,
} from "../types";

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

export type ApplicationPublicationEvidence = Pick<
  ApplicationView,
  "publicationStatus" | "publishedAt" | "publishedBy"
>;

export interface ApplicationTechnicalIdentityPreview {
  runtimeTarget: string;
  databasePrincipal: string;
  primaryComponentKey: string;
  contractVersion: 1;
}

export function deriveTechnicalIdentityPreview(
  applicationKey: string,
): ApplicationTechnicalIdentityPreview {
  const normalizedKey = applicationKey.trim().toLowerCase();
  return {
    runtimeTarget: `${normalizedKey.replaceAll("_", "-")}-app`,
    databasePrincipal: `mutakamel_${normalizedKey}_app`,
    primaryComponentKey: `app.${normalizedKey}`,
    contractVersion: 1,
  };
}

export function canLinkPrimaryComponent(
  readiness: ApplicationTechnicalReadinessView | null,
): boolean {
  return Boolean(
    readiness?.lifecycleStatus === "DRAFT" &&
      readiness.runtimeTarget &&
      readiness.components.length === 0 &&
      !readiness.checks.componentBinding &&
      readiness.reasons.includes("COMPONENT_BINDING_REQUIRED"),
  );
}

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
  publication: ApplicationPublicationEvidence | null,
): ActivationReadinessState {
  if (isLoading && !readiness) return "LOADING";
  if (hasError || !readiness) return "UNAVAILABLE";
  if (
    readiness.publicationStatus !== "PUBLISHED" ||
    publication?.publicationStatus !== "PUBLISHED" ||
    !publication.publishedAt ||
    !publication.publishedBy
  ) {
    return "BLOCKED";
  }
  return readiness.activationAllowed ? "ALLOWED" : "BLOCKED";
}

