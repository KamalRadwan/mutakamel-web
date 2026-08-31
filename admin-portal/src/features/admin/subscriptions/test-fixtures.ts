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
        },
        effectiveAllowedUsers: 10,
        enabledModules: ["module.crm"],
        items: [
          {
            id: ITEM_ID,
            subscriptionId: SUBSCRIPTION_ID,
            moduleId: MODULE_ID,
            tierId: TIER_ID,
            seats: 10,
            lineTotal: "120.0000",
            moduleKey: "crm",
            moduleName: "CRM",
            tierKey: "pro",
            tierName: "Professional",
            currencyCode: "USD",
            features: ["crm.leads", "crm.pipeline"],
          },
        ],
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
