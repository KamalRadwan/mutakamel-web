import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { getLocalizedApiErrorMessage } from "./localized-api-error";

describe.each(["ar", "en"] as const)("localized API errors (%s)", (lang) => {
  const copy = (lang === "ar" ? ar : en).apiErrorMessages;

  it.each([
    ["ADMIN_PERMISSION_DENIED", "forbidden"],
    ["COMMON.VALIDATION.FAILED", "validation"],
    ["GW.IDEM.IN_FLIGHT", "inFlight"],
    ["CORE.STORAGE_RUNTIME.NOT_CONFIGURED", "unavailable"],
    ["TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED", "tenantReleaseUpgradeRequired"],
    ["SUBSCRIPTION_CANCEL_FORBIDDEN", "billingActionForbidden"],
    ["SUBSCRIPTION_CANCEL_NOT_ALLOWED", "billingActionConflict"],
    ["WALLET_ADJUSTMENT_FORBIDDEN", "billingActionForbidden"],
    ["WALLET_CONFIRM_FORBIDDEN", "billingActionForbidden"],
    ["WALLET_ADJUSTMENT_NOT_ALLOWED", "billingActionConflict"],
    ["WALLET_CONFIRM_NOT_ALLOWED", "billingActionConflict"],
    ["WALLET_PREVIEW_EXPIRED", "walletPreviewExpired"],
    ["WALLET_PREVIEW_MISMATCH", "walletPreviewMismatch"],
    ["WALLET_RECOVERY_UNAVAILABLE", "walletRecoveryUnavailable"],
    ["WALLET_CONFIRM_UNRESOLVED", "walletRecoveryHelp"],
    ["PAYMENT_REFUND_FORBIDDEN", "billingActionForbidden"],
    ["PAYMENT_REFUND_NOT_ALLOWED", "billingActionConflict"],
    ["PAYMENT_REFUND_NOTE_INVALID", "refundNoteInvalid"],
    ["PAYMENT_RECONCILIATION_FORBIDDEN", "billingActionForbidden"],
    ["PAYMENT_RECONCILIATION_NOT_ALLOWED", "billingActionConflict"],
    ["PAYMENT_RECONCILIATION_DECISION_FORBIDDEN", "billingActionForbidden"],
    ["PAYMENT_RECONCILIATION_DECISION_NOT_ALLOWED", "billingActionConflict"],
    ["PAYMENT_RECONCILIATION_IDENTITY_MISMATCH", "billingIdentityMismatch"],
    ["OFFLINE_PAYMENT_FORBIDDEN", "billingActionForbidden"],
    ["OFFLINE_PAYMENT_NOT_ALLOWED", "billingActionConflict"],
    ["OFFLINE_PAYMENT_INVALID", "offlinePaymentInvalid"],
    ["OFFLINE_PAYMENT_IDENTITY_MISMATCH", "billingIdentityMismatch"],
    ["TENANT_FQDN_LIST_FORBIDDEN", "forbidden"],
    ["TENANT_FQDN_PREFLIGHT_FORBIDDEN", "forbidden"],
    ["TENANT_FQDN_MANAGEMENT_FORBIDDEN", "forbidden"],
    ["TENANT_FQDN_REQUIRED", "fqdnRequired"],
    ["TENANT_FQDN_STATE_INVALID", "fqdnStateInvalid"],
    ["TENANT_FQDN_PREFLIGHT_REQUIRED", "fqdnPreflightRequired"],
    ["TENANT_FQDN_REMOVE_NOT_ALLOWED", "fqdnRemoveNotAllowed"],
    ["TENANT_FQDN_PROMOTION_NOT_ALLOWED", "fqdnPromotionNotAllowed"],
  ] as const)("uses reviewed copy for %s", (errorCode, key) => {
    const error = { errorCode, message: "Private backend wording" };
    expect(getLocalizedApiErrorMessage(error, lang)).toBe(copy[key]);
  });

  it.each(["FUTURE.CODE", "UNKNOWN_ERROR", "toString", "constructor", "__proto__", ""])(
    "uses the generic fallback for %s without reading message",
    (errorCode) => {
      const error = Object.defineProperty({ errorCode }, "message", {
        get: () => { throw new Error("Raw messages must not be read"); },
      });
      expect(getLocalizedApiErrorMessage(error, lang)).toBe(copy.generic);
    },
  );

  it("handles missing error codes", () => {
    expect(getLocalizedApiErrorMessage({}, lang)).toBe(copy.generic);
    expect(getLocalizedApiErrorMessage(null, lang)).toBe(copy.generic);
    expect(getLocalizedApiErrorMessage(undefined, lang)).toBe(copy.generic);
  });

  it("localizes the catalogued migration permission reason", () => {
    expect(getLocalizedApiErrorMessage({
      errorCode: "ADMIN_PERMISSION_DENIED",
      message: "admin.migrations.manage is required to start a migration.",
    }, lang)).toBe(copy.migrationManageRequired);
  });

  it("does not trust other text under a known permission code", () => {
    expect(getLocalizedApiErrorMessage({
      errorCode: "ADMIN_PERMISSION_DENIED",
      message: "admin.migrations.manage is required to start a migration. Private details",
    }, lang)).toBe(copy.forbidden);
    expect(getLocalizedApiErrorMessage({
      errorCode: "FUTURE.CODE",
      message: "admin.migrations.manage is required to start a migration.",
    }, lang)).toBe(copy.generic);
  });
});
