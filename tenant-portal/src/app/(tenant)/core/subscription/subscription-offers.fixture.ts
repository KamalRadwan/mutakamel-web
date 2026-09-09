import type { SubscriptionOffer } from "./subscription-offers";
const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;

/** Test-only published source evidence; production has no built-in products or prices. */
export function createSubscriptionOffersFixture() {
  const application = { id: id(1), key: "crm", name: "CRM", publicationVersionId: id(2), definitionRevision: "9007199254740993" };
  const data: SubscriptionOffer[] = [
    { sourceKind: "APPLICATION", application, tier: { id: id(3), key: "starter", name: "CRM Starter", rank: 1 },
      status: "PREPARATION_REQUIRED", safeReasonCode: "PREPARATION_REQUIRED", ladders: [
        { billingCycle: "MONTHLY", state: "CONFIGURED", brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }], safeReasonCode: null },
        { billingCycle: "ANNUAL", state: "UNCONFIGURED", brackets: [], safeReasonCode: "PRICE_NOT_CONFIGURED" },
      ] },
    { sourceKind: "ADDON", application: { ...application }, addon: { id: id(4), key: "crm.logistics", name: "Logistics",
      definitionVersionId: id(5), definitionVersion: "2", definitionRevision: "3", operationalRevision: "4", compatibility: { mode: "ALL_ACTIVE", tierIds: [] } },
      status: "PREPARATION_REQUIRED", safeReasonCode: "PREPARATION_REQUIRED", ladders: [
        { billingCycle: "MONTHLY", state: "CONFIGURED", safeReasonCode: null, brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: "10.0000" }, { minUsers: 11, maxUsers: 25, unitPrice: "9.0000" }, { minUsers: 26, maxUsers: null, unitPrice: "8.0000" },
        ] },
        { billingCycle: "ANNUAL", state: "UNCONFIGURED", brackets: [], safeReasonCode: "PRICE_NOT_CONFIGURED" },
      ] },
  ];
  return { success: true, data, meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    correlationId: "catalogue-request", timestamp: "2026-09-07T19:00:00.000Z" };
}
