import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: mocks }));
import { tenantBillingApi } from "./tenant-billing.api";
import { commercialFixture, commercialIds } from "../model/subscription-commercial-fixtures";
import { addonEnvelope } from "../../../applications/lib/addon-test-fixtures";
function responses() {
  const detail = commercialFixture();
  const items = { subscriptionId: detail.subscription.id, subscriptionRevision: detail.subscriptionRevision, baseItems: detail.baseItems, addonSelections: detail.addonSelections };
  return { detail, items };
}
beforeEach(() => vi.clearAllMocks());
describe("Negotiated Admin subscription transport", () => {
  it("reads and reconciles both V2 resources", async () => {
    const { detail, items } = responses();
    mocks.get.mockResolvedValueOnce(addonEnvelope(detail)).mockResolvedValueOnce(addonEnvelope(items));
    const result = await tenantBillingApi.getSubscription(commercialIds.tenant);
    expect(result.commercial?.addonSelections).toHaveLength(1);
    expect(mocks.get).toHaveBeenCalledWith(`/api/admin/core/v1/tenants/${commercialIds.tenant}/subscription/items`,
      { cache: "no-store", signal: undefined });
  });
  it("does not reconcile independently read different revisions", async () => {
    const { detail, items } = responses(); items.subscriptionRevision = "9";
    mocks.get.mockResolvedValueOnce(addonEnvelope(detail)).mockResolvedValueOnce(addonEnvelope(items));
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it.each(["FOREIGN_OWNER", "UNKNOWN_SCHEMA", "LEGACY_FIELD"])("does not fall back after %s", async kind => {
    const { detail, items } = responses(); const response = addonEnvelope(detail);
    if (kind === "FOREIGN_OWNER") detail.subscription.tenantId = commercialIds.app;
    if (kind === "UNKNOWN_SCHEMA") Object.assign(detail, { unknown: true });
    if (kind === "LEGACY_FIELD") Object.assign(detail, { contractVersion: 2 });
    mocks.get.mockResolvedValueOnce(response).mockResolvedValueOnce(addonEnvelope(items));
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it.each([403, 406, 503])("does not fall back after HTTP%s", async httpStatus => {
    mocks.get.mockRejectedValue({ isNormalized: true, httpStatus, errorCode: "COMMERCIAL_CONTRACT_UNSUPPORTED", message: "Unavailable" });
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).rejects.toMatchObject({ httpStatus });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
