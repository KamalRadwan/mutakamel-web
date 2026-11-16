import type { Language } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const ERROR_COPY_KEYS = {
  TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED: "tenantReleaseUpgradeRequired",
  SUBSCRIPTION_CANCEL_FORBIDDEN: "billingActionForbidden",
  SUBSCRIPTION_CANCEL_NOT_ALLOWED: "billingActionConflict",
  WALLET_ADJUSTMENT_FORBIDDEN: "billingActionForbidden",
  WALLET_CONFIRM_FORBIDDEN: "billingActionForbidden",
  WALLET_ADJUSTMENT_NOT_ALLOWED: "billingActionConflict",
  WALLET_CONFIRM_NOT_ALLOWED: "billingActionConflict",
  WALLET_PREVIEW_EXPIRED: "walletPreviewExpired",
  WALLET_PREVIEW_MISMATCH: "walletPreviewMismatch",
  WALLET_RECOVERY_UNAVAILABLE: "walletRecoveryUnavailable",
  WALLET_CONFIRM_UNRESOLVED: "walletRecoveryHelp",
  PAYMENT_REFUND_FORBIDDEN: "billingActionForbidden",
  PAYMENT_REFUND_NOT_ALLOWED: "billingActionConflict",
  PAYMENT_RECONCILIATION_FORBIDDEN: "billingActionForbidden",
  PAYMENT_RECONCILIATION_NOT_ALLOWED: "billingActionConflict",
  PAYMENT_RECONCILIATION_DECISION_FORBIDDEN: "billingActionForbidden",
  PAYMENT_RECONCILIATION_DECISION_NOT_ALLOWED: "billingActionConflict",
  PAYMENT_RECONCILIATION_IDENTITY_MISMATCH: "billingIdentityMismatch",
  OFFLINE_PAYMENT_FORBIDDEN: "billingActionForbidden",
  OFFLINE_PAYMENT_NOT_ALLOWED: "billingActionConflict",
  OFFLINE_PAYMENT_INVALID: "offlinePaymentInvalid",
  OFFLINE_PAYMENT_IDENTITY_MISMATCH: "billingIdentityMismatch",
  TENANT_FQDN_LIST_FORBIDDEN: "forbidden",
  TENANT_FQDN_PREFLIGHT_FORBIDDEN: "forbidden",
  TENANT_FQDN_MANAGEMENT_FORBIDDEN: "forbidden",
  TENANT_FQDN_REQUIRED: "fqdnRequired",
  TENANT_FQDN_STATE_INVALID: "fqdnStateInvalid",
  TENANT_FQDN_PREFLIGHT_REQUIRED: "fqdnPreflightRequired",
  TENANT_FQDN_REMOVE_NOT_ALLOWED: "fqdnRemoveNotAllowed",
  TENANT_FQDN_PROMOTION_NOT_ALLOWED: "fqdnPromotionNotAllowed",
  PAYMENT_REFUND_NOTE_INVALID: "refundNoteInvalid",
  HTTP_401: "unauthenticated",
  "GW.AUTH.UNAUTHORIZED": "unauthenticated",
  HTTP_403: "forbidden",
  ADMIN_PERMISSION_DENIED: "forbidden",
  HTTP_404: "notFound",
  HTTP_409: "conflict",
  HTTP_400: "validation",
  HTTP_422: "validation",
  "COMMON.VALIDATION.FAILED": "validation",
  HTTP_429: "rateLimited",
  HTTP_502: "unavailable",
  HTTP_503: "unavailable",
  HTTP_504: "unavailable",
  "GW.IDEM.IN_FLIGHT": "inFlight",
  STORAGE_SERVER_PROBE_IN_PROGRESS: "inFlight",
  STORAGE_SERVER_REGISTRATION_IN_PROGRESS: "inFlight",
  "CORE.STORAGE_RUNTIME.NOT_CONFIGURED": "unavailable",
  "CORE.STORAGE.RUNTIME_KEY_UNAVAILABLE": "unavailable",
  "CORE.STORAGE_RUNTIME.DISABLED": "unavailable",
} as const satisfies Record<string, keyof typeof ar.apiErrorMessages>;

/** Display only reviewed copy. Backend and local exception messages are untrusted. */
export function getLocalizedApiErrorMessage(
  error: { errorCode?: string; message?: string } | null | undefined,
  lang: Language,
): string {
  const copy = (lang === "ar" ? ar : en).apiErrorMessages;
  const code = error?.errorCode;
  // Match only this reviewed reason, never interpolate backend wording. The
  // same permission code is used by other commands with different requirements.
  if (
    code === "ADMIN_PERMISSION_DENIED" &&
    error?.message === "admin.migrations.manage is required to start a migration."
  ) {
    return copy.migrationManageRequired;
  }
  if (!code || !Object.hasOwn(ERROR_COPY_KEYS, code)) return copy.generic;
  return copy[ERROR_COPY_KEYS[code as keyof typeof ERROR_COPY_KEYS]];
}
