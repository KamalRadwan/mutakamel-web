import { describe, expect, it } from "vitest";
import { adaptSubscriptionCommercial, readSubscriptionCommercial, type SubscriptionCommercial } from "./subscription-commercial";
import { commercialFixture, commercialIds } from "./subscription-commercial-fixtures";
describe("Closed canonical Admin subscription", () => {
  it("retains base allowance and complete graduated addon evidence without inflation", () => {
    const value = readSubscriptionCommercial(commercialFixture());
    const adapted = adaptSubscriptionCommercial(value);
    expect(adapted.effectiveAllowedUsers).toBe(30);
    expect(adapted.items).toHaveLength(1);
    expect(adapted.commercial?.addonSelections[0].acceptedPricing.recurringAmountUsd).toBe("275.0000");
    expect(adapted.commercial?.subscriptionRevision).toBe("9007199254740993");
    expect(adapted.items[0].features).toBeNull();
    expect(adapted.commercial?.baseItems[0].acceptedPricing.breakdown).toEqual([{ minUsers: 1, maxUsers: null, chargedUsers: 30, unitPriceUsd: "10.0000", amountUsd: "300.0000" }]);
    expect(adapted.commercial).toEqual(value);
  });
  it.each([
    (value: SubscriptionCommercial) => { value.addonSelections[0].seats = 31; },
    (value: SubscriptionCommercial) => { value.addonSelections[0].parentItemId = commercialIds.tenant; },
    (value: SubscriptionCommercial) => { value.addonSelections[0].addonKey = "trade.logistics"; },
    (value: SubscriptionCommercial) => { value.baseAllowance.effectiveAllowedUsers = 60; },
    (value: SubscriptionCommercial) => { value.baseAllowance.enabledApplications.push("crm"); },
    (value: SubscriptionCommercial) => { value.addonSelections[0].acceptedPricing.recurringAmountUsd = "240.0000"; },
    (value: SubscriptionCommercial) => { value.addonSelections[0].acceptedPricing.breakdown![0].amountUsd = "90.0000"; },
    (value: SubscriptionCommercial) => { Object.assign(value.addonSelections[0].acceptedPricing, { priceRevision: null }); },
    (value: SubscriptionCommercial) => { value.baseItems[0].acceptedPricing.priceRevision = commercialIds.price; },
    (value: SubscriptionCommercial) => { value.totals.combinedRecurringUsd = "999.0000"; },
    (value: SubscriptionCommercial) => { value.addonSelections[0].acceptedPricing.billingCycle = "ANNUAL"; },
    (value: SubscriptionCommercial) => { value.addonSelections.push(value.addonSelections[0]); },
  ])("rejects inconsistent accepted evidence %#", mutate => {
    const value = commercialFixture(); mutate(value); expect(() => readSubscriptionCommercial(value)).toThrow();
  });
  it("rejects future or unknown projections rather than claiming runtime access", () => {
    const value = commercialFixture();
    expect(() => readSubscriptionCommercial({ ...value, projection: { observation: "READY", state: "ACTIVE", safeReasonCode: null } })).toThrow();
    expect(() => readSubscriptionCommercial({ ...value, subscription: { ...value.subscription, pendingAmount: "1" } })).toThrow();
  });
  it("retains historical evidence when operational authority has been revoked", () => {
    const value = commercialFixture(); value.addonSelections[0].effectiveState.definitionState = "REVOKED";
    expect(readSubscriptionCommercial(value).totals.combinedRecurringUsd).toBe("575.0000");
  });
});
