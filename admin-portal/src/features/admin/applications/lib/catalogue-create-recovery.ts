import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { FeatureView, TierView } from "../types";

export type PendingCatalogueCreateAttempt = {
  applicationId: string;
  kind: "tier" | "feature";
  resourceKey: string;
  absenceConfirmed: boolean;
};

export function isAmbiguousCatalogueCreateError(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus === 401 ||
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR"
  );
}

export function findCatalogueCreateResult(
  attempt: PendingCatalogueCreateAttempt,
  tiers: readonly TierView[],
  features: readonly FeatureView[],
): TierView | FeatureView | null {
  const rows = attempt.kind === "tier" ? tiers : features;
  return rows.find((row) => row.key === attempt.resourceKey) ?? null;
}

export function readPendingCatalogueCreateAttempt(
  value: string | null,
): PendingCatalogueCreateAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingCatalogueCreateAttempt>;
    if (
      typeof parsed.applicationId !== "string" ||
      !parsed.applicationId ||
      !["tier", "feature"].includes(String(parsed.kind)) ||
      typeof parsed.resourceKey !== "string" ||
      !parsed.resourceKey ||
      typeof parsed.absenceConfirmed !== "boolean"
    ) {
      return null;
    }
    return parsed as PendingCatalogueCreateAttempt;
  } catch {
    return null;
  }
}
