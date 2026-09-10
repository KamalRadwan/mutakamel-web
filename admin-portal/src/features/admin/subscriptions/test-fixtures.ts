import { commercialFixture } from "../tenant-workspace/billing/model/subscription-commercial-fixtures";
const SUBSCRIPTION_ID = "019f0000-0000-7000-8000-000000000001";
export const TENANT_ID = "019f0000-0000-7000-8000-000000000002";
export const ITEM_ID = "019f0000-0000-7000-8000-000000000003";
const MODULE_ID = "019f0000-0000-7000-8000-000000000004";
const TIER_ID = "019f0000-0000-7000-8000-000000000005";
export const CORRELATION_ID = "019f0000-0000-7000-8000-000000000006";

export function validSubscriptionsEnvelope() {
  return {
    success: true,
    data: [
      {
        subscription: {
          id: SUBSCRIPTION_ID,
          tenantId: TENANT_ID,
          allowedUsers: 10,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currencyCode: "USD",
          startedAt: "2026-01-01T00:00:00.000Z",
          currentPeriodStart: "2026-08-01T00:00:00.000Z",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          pendingPeriodStart: null,
          pendingPeriodEnd: null,
          trialDays: 14,
          trialStartedAt: null,
          trialEndsAt: null,
          activationScheduledAt: null,
          activatedAt: "2026-01-01T00:00:00.000Z",
          cancelAt: null,
          totalPrice: "120.0000",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          currentCollectionInvoiceId: null,
        },
        subscriptionRevision: "1",
        baseItems: [{ id: ITEM_ID, applicationId: MODULE_ID, applicationKey: "crm", applicationName: "CRM", tierId: TIER_ID,
          tierKey: "pro", tierName: "Professional", tierRank: 1, seats: 10, acceptedPricing: { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "120.0000",
            priceRevision: "a".repeat(64), breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 10, unitPriceUsd: "12.0000", amountUsd: "120.0000" }] } }],
        addonSelections: [],
        baseAllowance: { allowedUsers: 10, effectiveAllowedUsers: 10, enabledApplications: ["crm"] },
        totals: { baseRecurringUsd: "120.0000", addonRecurringUsd: "0.0000", combinedRecurringUsd: "120.0000" },
        projection: commercialFixture().projection,
        tenant: {
          id: TENANT_ID,
          name: "Acme",
          companyName: "Acme LLC",
          status: "ACTIVE",
        },
      },
    ],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    correlationId: CORRELATION_ID,
    timestamp: "2026-08-12T09:00:00.000Z",
  };
}
