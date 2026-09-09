import type { AddonDetail, AddonPrices, AddonReceipt } from "./addon-contract";
export const addonIds = { app: "01900000-0000-7000-8000-000000000001", addon: "01900000-0000-7000-8000-000000000002",
  definition: "01900000-0000-7000-8000-000000000003", key: "01900000-0000-7000-8000-000000000004", price: "01900000-0000-7000-8000-000000000005" };
export function addonFixture(): AddonDetail {
  return { id: addonIds.addon, applicationId: addonIds.app, applicationKey: "crm", key: "crm.logistics", name: "Logistics", description: null,
    lifecycleStatus: "DRAFT", catalogueRevision: "9007199254740993", operationalRevision: "1", draftVersionId: addonIds.definition, publishedVersionId: null, deleted: false,
    ownerRegistrationAvailable: true,
    draft: { id: addonIds.definition, addonId: addonIds.addon, applicationId: addonIds.app, version: "1", definitionRevision: "2", name: "Logistics", description: null,
      mode: "ALL_ACTIVE", schemaRef: null, definitionHash: null, publishedAt: null, revokedAt: null, tierIds: [], grants: [], bindings: [], dependencies: [] }, published: null };
}
export function addonPricesFixture(): AddonPrices {
  return { applicationId: addonIds.app, applicationKey: "crm", addonId: addonIds.addon, addonKey: "crm.logistics", ladders: [
    { billingCycle: "MONTHLY", revision: "0", revisionId: null, configured: false, brackets: [] },
    { billingCycle: "ANNUAL", revision: "0", revisionId: null, configured: false, brackets: [] } ] };
}
export function addonReceiptFixture(operation: AddonReceipt["operation"] = "CREATE"): AddonReceipt {
  return { commandId: addonIds.key, operation, applicationId: addonIds.app, applicationKey: "crm", addonId: addonIds.addon,
    addonKey: "crm.logistics", catalogueRevision: "9007199254740994", operationalRevision: "1", definitionVersionId: addonIds.definition, definitionRevision: "2",
    lifecycleStatus: "DRAFT", deleted: operation === "DELETE", noChange: false, affectedOperationId: null };
}
export function addonEnvelope(data: unknown, meta?: unknown) {
  return { status: 200, statusText: "OK", headers: new Headers(),
    data: { success: true, data, ...(meta ? { meta } : {}), correlationId: addonIds.key, timestamp: "2026-09-07T19:00:00.000Z" } };
}
export const addonPageMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasPrev: false, hasNext: false };
