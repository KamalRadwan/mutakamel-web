import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { commercialErrorMessage } from "./commercial-error-messages";

const failures = [
  "ADDON_PREPARATION_STALE", "COMMERCIAL_TARGET_INCOMPATIBLE",
  "COMMERCIAL_PRICE_UNAVAILABLE", "COMMERCIAL_CAPACITY_OCCUPIED",
  "COMMERCIAL_PREPARATION_IN_PROGRESS", "COMMERCIAL_COMMAND_UNAVAILABLE",
  "SUBSCRIPTION_BILLING_INCOMPLETE", "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED",
  "WALLET_NOT_FOUND", "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED",
  "COMMERCIAL_RECOVERY_REVISION_STALE",
];

describe.each([en, ar])("commercial error messages", (dictionary) => {
  const copy = dictionary.commercialPurchase;
  it("distinguishes every known refusal without exposing server text or codes", () => {
    const messages = failures.map((code) => {
      const message = commercialErrorMessage(copy, { code, status: 409 });
      expect(message).not.toBe(copy.errors.unknown);
      expect(message).not.toContain(code);
      expect(message.length).toBeGreaterThan(20);
      return message;
    });
    expect(new Set(messages).size).toBe(failures.length);
    expect(commercialErrorMessage(copy, { code: "SUBSCRIPTION_BILLING_INCOMPLETE", status: 503 }))
      .toBe(copy.errors.billingIncomplete);
    expect(commercialErrorMessage(copy, { code: "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED", status: 409 }))
      .toBe(copy.expired);
    expect(commercialErrorMessage(copy, { code: "COMMERCIAL_RECOVERY_REVISION_STALE", status: 409 }))
      .toBe(copy.recoveryRejected);
  });

  it("uses HTTP refusal messages even when a response has an unknown code", () => {
    expect(commercialErrorMessage(copy, { status: 403, code: "UNKNOWN" })).toBe(copy.errors.forbidden);
    expect(commercialErrorMessage(copy, { status: 429, code: "UNKNOWN" })).toBe(copy.errors.rateLimited);
  });

  it("falls back for unknown, missing and network failures", () => {
    for (const error of [null, undefined, { status: 0 }, { status: 500, code: "UNKNOWN" }, { status: 500, code: "toString" }]) {
      expect(commercialErrorMessage(copy, error)).toBe(copy.errors.unknown);
    }
  });
});

it("keeps commercial error keys identical in Arabic and English", () => {
  expect(Object.keys(en.commercialPurchase.errors).sort()).toEqual(Object.keys(ar.commercialPurchase.errors).sort());
  expect(en.commercialPurchase.supportReference).toBeTruthy();
  expect(ar.commercialPurchase.supportReference).toBeTruthy();
});
