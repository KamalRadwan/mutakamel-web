// Test-only fixtures, never catalogue defaults or readiness evidence.
import type { AxiosResponse } from "@/lib/api/axiosClient";
import { readInitialQuote, readOriginalInitialSeedReceipt } from "../initial-commercial-readers";
import { readInitialQuoteRequest, readInitialTerms } from "./initial-commercial-request";

export const initialId = (n: number) => `019f0000-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const initialNow = "2026-09-08T01:00:00.000Z";
export function initialRequestFixture(purpose: "TENANT_CREATION" | "INITIAL_SEED" = "INITIAL_SEED") {
  return readInitialQuoteRequest({ purpose, ...(purpose === "INITIAL_SEED" ? { targetTenantId: initialId(2) } : {}),
    billingCycle: "MONTHLY", currencyCode: "USD", trialDays: 7, applications: [{ selectionKey: initialId(10), applicationId: initialId(11), tierId: initialId(12), seats: 3,
      addons: [{ selectionKey: initialId(13), addonId: initialId(14), definitionVersionId: initialId(15), seats: 2 }] }] });
}
export function initialTermsFixture() {
  const request = initialRequestFixture();
  return readInitialTerms({ billingCycle: request.billingCycle, currencyCode: request.currencyCode, trialDays: request.trialDays, applications: request.applications });
}
export function initialQuoteFixture(purpose: "TENANT_CREATION" | "INITIAL_SEED" = "INITIAL_SEED") {
  return readInitialQuote({ quoteId: initialId(1), purpose, targetTenantId: purpose === "INITIAL_SEED" ? initialId(2) : null,
    billingCycle: "MONTHLY", currencyCode: "USD", resolvedTrialDays: 7, createdAt: initialNow, expiresAt: "2026-09-08T01:15:00.000Z",
    totals: { baseRecurringUsd: "6.3750", addonRecurringUsd: "10.5000", combinedRecurringUsd: "16.8750" },
    items: [{ ...initialRequestFixture(purpose).applications[0], acceptedPricing: { priceRevision: "b".repeat(64), billingCycle: "MONTHLY", currencyCode: "USD",
      recurringAmountUsd: "6.3750", breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 3, unitPriceUsd: "2.1250", amountUsd: "6.3750" }] },
    addons: [{ ...initialRequestFixture(purpose).applications[0].addons[0], acceptedPricing: { priceRevision: initialId(16), billingCycle: "MONTHLY", currencyCode: "USD",
      recurringAmountUsd: "10.5000", breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 2, unitPriceUsd: "5.2500", amountUsd: "10.5000" }] } }] }] });
}
export function initialReceiptFixture() {
  return readOriginalInitialSeedReceipt({ commandId: initialId(3), tenantId: initialId(2), subscriptionId: initialId(4), quoteId: initialId(1),
    subscriptionRevision: "1", status: "TRIAL", billingCycle: "MONTHLY", currencyCode: "USD", trialDays: 7, trialStartedAt: initialNow,
    trialEndsAt: "2026-09-15T01:00:00.000Z", createdAt: initialNow, totals: initialQuoteFixture().totals,
    selections: [{ selectionKey: initialId(10), itemId: initialId(20), applicationId: initialId(11),
      addons: [{ selectionKey: initialId(13), addonSelectionId: initialId(21), addonId: initialId(14), definitionVersionId: initialId(15) }] }] });
}
export function initialResponse(data: unknown): AxiosResponse<unknown> {
  return { status: 201, statusText: "Created", headers: new Headers(),
    data: { success: true, data, correlationId: initialId(99), timestamp: initialNow } };
}
