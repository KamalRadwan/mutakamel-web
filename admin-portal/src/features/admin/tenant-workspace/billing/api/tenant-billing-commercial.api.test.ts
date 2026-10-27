import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: mocks }));
import { tenantBillingApi } from "./tenant-billing.api";
import { commercialFixture, commercialIds } from "../model/subscription-commercial-fixtures";
import { addonEnvelope } from "../../../applications/lib/addon-test-fixtures";
beforeEach(() => vi.resetAllMocks());
describe("Negotiated Admin subscription transport", () => {
  it("reads the complete authoritative subscription once", async () => {
    const detail = commercialFixture();
    const signal = new AbortController().signal;
    mocks.get.mockResolvedValueOnce(addonEnvelope(detail));
    const result = await tenantBillingApi.getSubscription(commercialIds.tenant, signal);
    expect(result.commercial?.addonSelections).toHaveLength(1);
    expect(result.commercial).toEqual(detail);
    expect(mocks.get).toHaveBeenCalledWith(`/api/admin/core/v1/tenants/${commercialIds.tenant}/subscription`,
      { cache: "no-store", signal });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it("accepts a subscription commit between independent loads", async () => {
    const detail = commercialFixture();
    const committed = commercialFixture();
    committed.subscriptionRevision = (BigInt(detail.subscriptionRevision) + BigInt(1)).toString();
    committed.addonSelections = [];
    committed.totals.addonRecurringUsd = "0.0000";
    committed.totals.combinedRecurringUsd = committed.totals.baseRecurringUsd;
    committed.subscription.totalPrice = committed.totals.combinedRecurringUsd;
    mocks.get.mockResolvedValueOnce(addonEnvelope(detail)).mockResolvedValueOnce(addonEnvelope(committed));
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).resolves.toMatchObject({ commercial: detail });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).resolves.toMatchObject({ commercial: committed });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it.each(["FOREIGN_OWNER", "INVALID_ID", "UNKNOWN_SCHEMA", "LEGACY_FIELD", "INVALID_PARENT", "INVALID_TOTAL"])("rejects %s within the authoritative response", async kind => {
    const detail = commercialFixture(); const response = addonEnvelope(detail);
    if (kind === "FOREIGN_OWNER") detail.subscription.tenantId = commercialIds.app;
    if (kind === "INVALID_ID") detail.subscription.id = "invalid";
    if (kind === "UNKNOWN_SCHEMA") Object.assign(detail, { unknown: true });
    if (kind === "LEGACY_FIELD") Object.assign(detail, { contractVersion: 2 });
    if (kind === "INVALID_PARENT") detail.addonSelections[0].parentItemId = commercialIds.app;
    if (kind === "INVALID_TOTAL") detail.totals.combinedRecurringUsd = "999.0000";
    mocks.get.mockResolvedValueOnce(response);
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it.each([403, 406, 503])("does not fall back after HTTP%s", async httpStatus => {
    mocks.get.mockRejectedValue({ isNormalized: true, httpStatus, errorCode: "COMMERCIAL_CONTRACT_UNSUPPORTED", message: "Unavailable" });
    await expect(tenantBillingApi.getSubscription(commercialIds.tenant)).rejects.toMatchObject({ httpStatus });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
