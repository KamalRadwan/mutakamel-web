import type { SubscriptionView } from "./subscription-read";
const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const timestamp = "2026-09-07T19:00:00.000Z";
export function createSubscriptionFixture() {
  const pricing = (recurringAmountUsd: string, seats: number, unitPriceUsd: string, priceRevision: string) => ({
    billingCycle: "MONTHLY" as const, currencyCode: "USD" as const, recurringAmountUsd, priceRevision,
    breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: seats, unitPriceUsd, amountUsd: recurringAmountUsd }],
  });
  const data: SubscriptionView = {
    subscriptionRevision: "9007199254740993",
    subscription: {
      id: id(1), tenantId: id(2), allowedUsers: 10, status: "ACTIVE", billingCycle: "MONTHLY", currencyCode: "USD",
      startedAt: timestamp, currentPeriodStart: timestamp, currentPeriodEnd: timestamp, pendingPeriodStart: null, pendingPeriodEnd: null,
      trialDays: 7, trialStartedAt: null, trialEndsAt: null, activationScheduledAt: null, activatedAt: timestamp, cancelAt: null,
      totalPrice: "115.0000", createdAt: timestamp, updatedAt: timestamp, currentCollectionInvoiceId: null,
    },
    baseItems: [{ id: id(3), applicationId: id(4), applicationKey: "crm", applicationName: "CRM", tierId: id(5), tierKey: "starter", tierName: null, tierRank: 1, seats: 10, acceptedPricing: pricing("100.0000", 10, "10.0000", "a".repeat(64)) }],
    addonSelections: [{ id: id(6), parentItemId: id(3), addonId: id(7), addonKey: "crm.logistics", definitionVersionId: id(8), seats: 3,
      acceptedPricing: pricing("15.0000", 3, "5.0000", id(9)), effectiveState: { applicationLifecycleStatus: "ACTIVE", addonLifecycleStatus: "DISABLED", definitionState: "REVOKED", operationalUse: "NOT_EVALUATED" } }],
    baseAllowance: { allowedUsers: 10, effectiveAllowedUsers: 10, enabledApplications: ["crm"] },
    totals: { baseRecurringUsd: "100.0000", addonRecurringUsd: "15.0000", combinedRecurringUsd: "115.0000" },
    projection: { observation: "NOT_OBSERVED", state: null, safeReasonCode: "TENANT_PROJECTION_NOT_OBSERVED" },
  };
  return { success: true, data, correlationId: "request-id", timestamp };
}
