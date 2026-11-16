import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { NormalizedApiError } from "@/lib/api/errors";

/** Public Core commercial failures; never expose server messages or raw codes. */
export function commercialErrorMessage(
  copy: Dictionary["commercialPurchase"],
  error: Pick<NormalizedApiError, "code" | "status"> | null | undefined,
): string {
  if (error?.status === 403) return copy.errors.forbidden;
  if (error?.status === 429) return copy.errors.rateLimited;
  switch (error?.code) {
    case "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED": return copy.expired;
    case "COMMERCIAL_RECOVERY_REVISION_STALE": return copy.recoveryRejected;
    case "ADDON_PREPARATION_STALE": return copy.errors.preparationStale;
    case "COMMERCIAL_TARGET_INCOMPATIBLE": return copy.errors.targetIncompatible;
    case "COMMERCIAL_PRICE_UNAVAILABLE": return copy.errors.priceUnavailable;
    case "COMMERCIAL_CAPACITY_OCCUPIED": return copy.errors.capacityOccupied;
    case "COMMERCIAL_PREPARATION_IN_PROGRESS": return copy.errors.preparationInProgress;
    case "COMMERCIAL_COMMAND_UNAVAILABLE": return copy.errors.commandUnavailable;
    case "SUBSCRIPTION_BILLING_INCOMPLETE": return copy.errors.billingIncomplete;
    case "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED": return copy.errors.alreadyApplied;
    case "WALLET_NOT_FOUND": return copy.errors.walletNotFound;
    default: return copy.errors.unknown;
  }
}
