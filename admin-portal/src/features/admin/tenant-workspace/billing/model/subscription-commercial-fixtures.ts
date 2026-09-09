import type { SubscriptionCommercial } from "./subscription-commercial";
import type { CommercialApplyReceipt, CommercialOperationReceipt, CommercialPreview } from "@/features/admin/subscriptions/commercial-change/commercial-change-readers";
export const commercialIds = {
  tenant: "01900000-0000-7000-8000-000000000010", subscription: "01900000-0000-7000-8000-000000000011", item: "01900000-0000-7000-8000-000000000012",
  app: "01900000-0000-7000-8000-000000000013", tier: "01900000-0000-7000-8000-000000000014", addon: "01900000-0000-7000-8000-000000000015",
  selection: "01900000-0000-7000-8000-000000000016", definition: "01900000-0000-7000-8000-000000000017", price: "01900000-0000-7000-8000-000000000018",
};
export function commercialFixture(): SubscriptionCommercial {
  return { subscriptionRevision: "9007199254740993", subscription: {
    id: commercialIds.subscription, tenantId: commercialIds.tenant, allowedUsers: 30, status: "ACTIVE", billingCycle: "MONTHLY", currencyCode: "USD",
    startedAt: "2026-09-01T00:00:00.000Z", currentPeriodStart: "2026-09-01T00:00:00.000Z", currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    pendingPeriodStart: null, pendingPeriodEnd: null, trialDays: 14, trialStartedAt: null, trialEndsAt: null, activationScheduledAt: null,
    activatedAt: "2026-09-01T00:00:00.000Z", cancelAt: null, totalPrice: "575.0000", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z", currentCollectionInvoiceId: null },
    baseItems: [{ id: commercialIds.item, applicationId: commercialIds.app, applicationKey: "crm", applicationName: "CRM", tierId: commercialIds.tier, tierKey: "starter", tierName: "Starter", tierRank: 0, seats: 30,
      acceptedPricing: { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "300.0000", priceRevision: "a".repeat(64),
        breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 30, unitPriceUsd: "10.0000", amountUsd: "300.0000" }] } }],
    addonSelections: [{ id: commercialIds.selection, parentItemId: commercialIds.item, addonId: commercialIds.addon, addonKey: "crm.logistics", definitionVersionId: commercialIds.definition, seats: 30,
      acceptedPricing: { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "275.0000", priceRevision: commercialIds.price, breakdown: [
        { minUsers: 1, maxUsers: 10, chargedUsers: 10, unitPriceUsd: "10.0000", amountUsd: "100.0000" },
        { minUsers: 11, maxUsers: 25, chargedUsers: 15, unitPriceUsd: "9.0000", amountUsd: "135.0000" },
        { minUsers: 26, maxUsers: null, chargedUsers: 5, unitPriceUsd: "8.0000", amountUsd: "40.0000" } ] },
      effectiveState: { applicationLifecycleStatus: "ACTIVE", addonLifecycleStatus: "ACTIVE", definitionState: "PUBLISHED", operationalUse: "NOT_EVALUATED" } }],
    baseAllowance: { allowedUsers: 30, effectiveAllowedUsers: 30, enabledApplications: ["crm"] }, totals: { baseRecurringUsd: "300.0000", addonRecurringUsd: "275.0000", combinedRecurringUsd: "575.0000" },
    projection: { observation: "NOT_OBSERVED", state: null, safeReasonCode: "TENANT_PROJECTION_NOT_OBSERVED" } };
}

/** Shared fixtures for the existing commercial lifecycle assertions. */
export function commercialPreviewFixture(): CommercialPreview {
  const source = commercialFixture();
  const item = source.baseItems[0];
  return { previewId: "01900000-0000-7000-8000-000000000020", operationId: "01900000-0000-7000-8000-000000000021",
    subscriptionId: source.subscription.id, subscriptionRevision: source.subscriptionRevision, actorBindingDigest: "b".repeat(64), targetSetDigest: "c".repeat(64),
    pricedAt: "2099-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:05:00.000Z", billingCycle: "MONTHLY", currencyCode: "USD",
    preparation: { preparationId: "01900000-0000-7000-8000-000000000022" },
    changes: [{ ordinal: 1, selectionKey: "01900000-0000-7000-8000-000000000023", sourceKind: "APPLICATION", operation: "CHANGE", applicationId: item.applicationId,
      itemId: item.id, addonSelectionId: null, parentItemId: null, parentSelectionKey: null, addonId: null, fromSeats: 30, toSeats: 31,
      fromTierId: item.tierId, toTierId: item.tierId, fromDefinitionVersionId: null, toDefinitionVersionId: null,
      acceptedPricingBefore: item.acceptedPricing, acceptedPricingAfter: { ...item.acceptedPricing, recurringAmountUsd: "310.0000",
        breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 31, unitPriceUsd: "10.0000", amountUsd: "310.0000" }] },
      previousAmountUsd: "300.0000", nextAmountUsd: "310.0000", fullPeriodDeltaUsd: "10.0000", proratedAllocationUsd: "5.0000" }],
    financial: { previousRecurringUsd: "575.0000", nextRecurringUsd: "585.0000", fullPeriodDeltaUsd: "10.0000", direction: "DEBIT",
      proratedAmountUsd: "5.0000", walletStatus: "ACTIVE", walletAvailableUsd: "100.0000", walletShortfallUsd: "0.0000", canApply: true } };
}
export function commercialOperationFixture(): CommercialOperationReceipt {
  return { operationId: commercialPreviewFixture().preparation.preparationId, operationRevision: "1", intentKind: "COMMERCIAL_CHANGE", state: "READY", phase: "READY",
    createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z", terminalAt: null, safeReasonCode: null, retryAfterSeconds: null,
    relatedPreviewId: null, committedReceiptRef: null, projectionState: "NOT_REQUIRED" };
}
export function commercialReceiptFixture(): CommercialApplyReceipt {
  const preview = commercialPreviewFixture();
  return { previewId: preview.previewId, operationId: preview.operationId, appliedAt: "2099-01-01T00:01:00.000Z",
    changes: [{ selectionKey: preview.changes[0].selectionKey, sourceKind: "APPLICATION", operation: "CHANGE", selectionId: commercialIds.item }],
    removedSelectionIds: [], subscriptionRevision: "9007199254740994", totals: { baseRecurringUsd: "310.0000", addonRecurringUsd: "275.0000", combinedRecurringUsd: "585.0000" },
    settlement: { walletLedgerEntryId: "01900000-0000-7000-8000-000000000025", walletId: "01900000-0000-7000-8000-000000000026", currencyCode: "USD", direction: "DEBIT", amountUsd: "5.0000", balanceAfterUsd: "95.0000" },
    projection: { state: "PENDING", preparationId: preview.preparation.preparationId } };
}
