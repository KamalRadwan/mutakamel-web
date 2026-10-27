import { beforeEach, describe, expect, it, vi } from "vitest";
import { addonEnvelope } from "../../../applications/lib/addon-test-fixtures";
import { tenantBillingApi } from "./tenant-billing.api";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: mocks }));

const tenantId = "019f0000-0000-7000-8000-000000000001";
const walletId = "019f0000-0000-7000-8000-000000000002";
const entryId = "019f0000-0000-7000-8000-000000000003";
const otherId = "019f0000-0000-7000-8000-000000000004";

function entry() {
  return {
    id: entryId,
    walletId,
    direction: "CREDIT",
    amountUsd: "10.0000",
    sourceAmount: "10.0000",
    sourceCurrencyCode: "USD",
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: "10.0000",
    reason: "ADJUSTMENT",
    actor: { type: "SYSTEM", id: null },
    referenceType: null,
    referenceId: null,
    note: null,
    createdAt: "2026-10-18T00:00:00.000Z",
  };
}

function meta(total: number) {
  return { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: false, hasPrev: false };
}

beforeEach(() => vi.resetAllMocks());

describe("Authoritative tenant ledger loading", () => {
  it("accepts an insertion between loads without comparing independent pages", async () => {
    const before = [entry()];
    const after = [{ ...entry(), id: otherId, balanceAfterUsd: "20.0000" }, ...before];
    mocks.get.mockResolvedValueOnce(addonEnvelope(before, meta(1)))
      .mockResolvedValueOnce(addonEnvelope(after, meta(2)));

    await expect(tenantBillingApi.getLedger(tenantId)).resolves.toEqual({ items: before, meta: meta(1) });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await expect(tenantBillingApi.getLedger(tenantId)).resolves.toEqual({ items: after, meta: meta(2) });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    for (const call of mocks.get.mock.calls) {
      expect(call).toEqual([`/api/admin/core/v1/tenants/${tenantId}/wallet/ledger?page=1&limit=20`, undefined]);
    }
  });

  it.each([0, 1])("uses one request for a page with %i entries", async total => {
    const items = total === 0 ? [] : [entry()];
    mocks.get.mockResolvedValueOnce(addonEnvelope(items, meta(total)));
    await expect(tenantBillingApi.getLedger(tenantId)).resolves.toEqual({ items, meta: meta(total) });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("preserves pagination and cancellation on the tenant-scoped request", async () => {
    const signal = new AbortController().signal;
    const pageMeta = { page: 2, limit: 25, total: 26, totalPages: 2, hasNext: false, hasPrev: true };
    mocks.get.mockResolvedValueOnce(addonEnvelope([entry()], pageMeta));
    await expect(tenantBillingApi.getLedger(tenantId, 2, 25, signal)).resolves.toMatchObject({ meta: pageMeta });
    expect(mocks.get).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${tenantId}/wallet/ledger?page=2&limit=25`, { signal },
    );
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("rejects entries belonging to different wallets within one page", async () => {
    mocks.get.mockResolvedValueOnce(addonEnvelope([entry(), { ...entry(), id: otherId, walletId: otherId }], meta(2)));
    await expect(tenantBillingApi.getLedger(tenantId)).rejects.toThrow("INVALID_TENANT_WALLET_LEDGER_RESPONSE");
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it.each(["INVALID_WALLET", "INVALID_ENTRY", "MISSING_ACTOR", "INVALID_PAGINATION"])("rejects %s in the single response", async kind => {
    const row = entry();
    const pageMeta = meta(1);
    if (kind === "INVALID_WALLET") row.walletId = "invalid";
    if (kind === "INVALID_ENTRY") row.id = "invalid";
    if (kind === "MISSING_ACTOR") Object.assign(row, { actor: null });
    if (kind === "INVALID_PAGINATION") pageMeta.totalPages = 0;
    mocks.get.mockResolvedValueOnce(addonEnvelope([row], pageMeta));
    await expect(tenantBillingApi.getLedger(tenantId)).rejects.toThrow();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("preserves forbidden responses", async () => {
    const error = { isNormalized: true, httpStatus: 403, errorCode: "FORBIDDEN" };
    mocks.get.mockRejectedValueOnce(error);
    await expect(tenantBillingApi.getLedger(tenantId)).rejects.toBe(error);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
