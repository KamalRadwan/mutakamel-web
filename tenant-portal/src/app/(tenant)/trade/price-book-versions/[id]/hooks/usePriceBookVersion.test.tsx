// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePriceBookVersion } from "./usePriceBookVersion";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), push: vi.fn(),
  user: { id: "01902001-3000-7000-8000-000000000009" },
  allowed: true,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), outcomeFromApi: vi.fn() },
  headers: { "x-mutakamel-company-id": "01902001-3000-7000-8000-000000000001" },
}));

vi.mock("@/design-system", () => ({ useToast: () => mocks.toast, useConnectivity: () => ({ status: "online" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../../../price-books/hooks/usePricingReferenceData", () => ({ usePricingReferenceData: () => ({ data: null, books: [], isLoading: false, error: null, reload: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user, authState: "AUTHENTICATED" }) }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchId: null }),
  useTradeScope: () => ({
    isResolved: true, headers: mocks.headers, permissions: [], isTenantOwner: true,
  }),
  hasTradePermission: (_permissions: readonly string[], _owner: boolean, permission: string) => permission === "trade.policy.publish" ? mocks.allowed : true,
}));
vi.mock("../../../trade-api", () => ({
  isTradeReplay: () => false,
  tradeGet: mocks.get,
  tradePost: mocks.post,
  tradePatch: mocks.patch,
  tradeDelete: mocks.del,
  tradeIfMatch: (version: number) => `"${version}"`,
}));

const versionId = "01902001-3000-7000-8000-000000000002";
const entryConflict = "01902001-3000-7000-8000-000000000003:01902001-3000-7000-8000-000000000004";
const promotionConflict = "INVALID_BENEFIT:01902001-3000-7000-8000-000000000005";
const detail = {
  book: {
    id: "01902001-3000-7000-8000-000000000001", code: "RETAIL",
    purpose: "SALES", currencyCode: "SAR", status: "ACTIVE", version: 1,
  },
  version: {
    id: versionId, versionNumber: 1, status: "DRAFT", version: 1,
    effectiveFrom: "2026-10-17T00:00:00.000Z", effectiveTo: null, checksum: "a".repeat(64),
  },
  entries: [], promotions: [], latestTestEvidence: null,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.get.mockResolvedValue({ data: detail });
  mocks.post.mockReset();
  mocks.del.mockReset();
  mocks.toast.outcomeFromApi.mockReturnValue(false);
});

async function loadVersion() {
  const hook = renderHook(() => usePriceBookVersion(versionId));
  await waitFor(() => expect(hook.result.current.detail?.version.id).toBe(versionId));
  return hook;
}

describe("Price-book version validation feedback", () => {
  it("returns to the parent book after a same-key retry confirms an uncertain deletion", async () => {
    mocks.del.mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce({ data: {} });
    const { result } = await loadVersion();
    await act(async () => { expect(await result.current.deleteDraft()).toBe(false); });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.ambiguous).not.toBeNull();
    const original = mocks.del.mock.calls[0];
    await act(async () => { await result.current.ambiguous?.retry(); });
    expect(mocks.del.mock.calls[1]).toEqual(original);
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(`/trade/price-books/${detail.book.id}`);
  });
  it("retains both conflict groups after HTTP 200 and the detail refresh, without success", async () => {
    const report = {
      passed: false, entryCount: 2, promotionCount: 1,
      conflicts: [entryConflict], promotionConflicts: [promotionConflict],
    };
    mocks.post.mockResolvedValue({ status: 200, data: report });
    const { result } = await loadVersion();
    await act(async () => { await result.current.test(); });
    expect(result.current.testReport).toEqual(report);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.toast.warning).toHaveBeenCalledWith(en.tradePricing.testFailedTitle, en.tradePricing.errorTestFailed);
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("announces success only for a passed test", async () => {
    mocks.post.mockResolvedValue({ data: {
      passed: true, entryCount: 1, promotionCount: 0, conflicts: [], promotionConflicts: [],
    } });
    const { result } = await loadVersion();
    await act(async () => { await result.current.test(); });
    expect(result.current.testReport?.passed).toBe(true);
    expect(mocks.toast.success).toHaveBeenCalledWith(en.tradeCommon.savedTitle, en.tradePricing.testPassed);
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("reports an empty version as failed even with no conflicts", async () => {
    mocks.post.mockResolvedValue({ data: {
      passed: false, entryCount: 0, promotionCount: 0, conflicts: [], promotionConflicts: [],
    } });
    const { result } = await loadVersion();
    await act(async () => { await result.current.test(); });
    expect(result.current.testReport?.entryCount).toBe(0);
    expect(mocks.toast.warning).toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("rejects malformed HTTP 200 reports instead of announcing a pass", async () => {
    mocks.post.mockResolvedValue({ data: { passed: "false" } });
    const { result } = await loadVersion();
    await act(async () => { await result.current.test(); });
    expect(result.current.testReport).toBeNull();
    expect(mocks.toast.error).toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("preserves the existing publish success path", async () => {
    mocks.get.mockResolvedValue({ data: {
      ...detail,
      version: { ...detail.version, status: "TESTED", createdByUserId: versionId },
      latestTestEvidence: { passed: true, testedAt: "2026-10-18T00:00:00.000Z" },
    } });
    mocks.post.mockResolvedValue({ data: {} });
    const { result } = await loadVersion();
    await act(async () => { await result.current.publish(); });
    expect(result.current.testReport).toBeNull();
    expect(mocks.toast.success).toHaveBeenCalledWith(en.tradeCommon.savedTitle, en.tradePricing.versionPublished);
  });

  it("sends an explicit predecessor only when publishing a replacement", async () => {
    mocks.get.mockResolvedValue({ data: {
      ...detail,
      version: { ...detail.version, status: "TESTED", createdByUserId: versionId },
      latestTestEvidence: { passed: true, testedAt: "2026-10-18T00:00:00.000Z" },
    } });
    const { result } = await loadVersion();
    await act(async () => { result.current.setSupersedesVersionId(` ${entryConflict.split(":")[0]} `); });
    await act(async () => { await result.current.publish(); });
    expect(mocks.post).toHaveBeenCalledWith(
      expect.stringContaining("/publish"),
      { supersedesVersionId: entryConflict.split(":")[0] },
      expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"1"' }) }),
    );
  });

  it.each(["DRAFT", "PUBLISHED", "SCHEDULED"])("blocks publishing a %s version", async (status) => {
    mocks.get.mockResolvedValue({ data: {
      ...detail, version: { ...detail.version, status, createdByUserId: versionId },
      latestTestEvidence: { passed: true, testedAt: "2026-10-18T00:00:00.000Z" },
    } });
    const { result } = await loadVersion();
    expect(result.current.publishDisabledReasons).toContain(en.tradePricing.publishTestedRequired);
    await act(async () => { await result.current.publish(); });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    { creator: "01902001-3000-7000-8000-000000000009", passed: true, allowed: true, reason: "publishCheckerRequired" },
    { creator: versionId, passed: false, allowed: true, reason: "publishEvidenceRequired" },
    { creator: versionId, passed: true, allowed: false, reason: "publishPermissionRequired" },
  ] as const)("blocks an ineligible checker: $reason", async ({ creator, passed, allowed, reason }) => {
    mocks.allowed = allowed;
    mocks.get.mockResolvedValue({ data: {
      ...detail,
      version: { ...detail.version, status: "TESTED", createdByUserId: creator },
      latestTestEvidence: { passed, testedAt: "2026-10-18T00:00:00.000Z" },
    } });
    const { result } = await loadVersion();
    expect(result.current.canPublish).toBe(false);
    expect(result.current.publishDisabledReasons).toContain(en.tradePricing[reason]);
    await act(async () => { await result.current.publish(); });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("saves draft edits via PATCH with If-Match and reloads version detail", async () => {
    mocks.patch.mockResolvedValue({ data: {} });
    const { result } = await loadVersion();
    await act(async () => {
      result.current.setDraft((prev) =>
        prev ? { ...prev, notes: "Updated telecom wholesale notes" } : prev,
      );
    });
    expect(result.current.isDirty).toBe(true);
    let saved = false;
    await act(async () => {
      saved = await result.current.saveDraft();
    });
    expect(saved).toBe(true);
    expect(mocks.patch).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/price-book-versions/${versionId}`,
      expect.objectContaining({ notes: "Updated telecom wholesale notes" }),
      expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"1"' }) }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(
      en.tradeCommon.savedTitle,
      en.tradePricing.versionSaved,
    );
  });

  it("loads version-to-version diff, retires published versions, and deletes unpublished drafts", async () => {
    const compareId = "01902001-3000-7000-8000-000000000008";
    const { result } = await loadVersion();

    mocks.get.mockResolvedValueOnce({
      data: {
        currencyCode: "SAR",
        targetVersion: { id: versionId, priceBookId: detail.book.id, priceBookCode: "RETAIL", versionNumber: 2, status: "DRAFT" },
        baselineVersion: { id: compareId, priceBookId: detail.book.id, priceBookCode: "RETAIL", versionNumber: 1, status: "PUBLISHED" },
        summary: { totalCompared: 1, added: 0, removed: 0, increased: 1, decreased: 0, unchanged: 0, promotionsChanged: 0 },
        entries: [{ changeType: "INCREASED", itemId: versionId, itemCode: "SKU-1", uomId: compareId, uomCode: "EA", minimumQuantity: "0", priority: 100, baselineUnitPrice: "10.00", targetUnitPrice: "12.00", deltaAmount: "2.00", deltaPct: 20 }],
        promotions: [],
      },
    });
    await act(async () => {
      await result.current.loadDiff(compareId);
    });
    expect(result.current.diffResult?.summary.increased).toBe(1);

    mocks.get.mockResolvedValue({ data: { ...detail, version: { ...detail.version, status: "PUBLISHED" } } });
    await act(async () => { await result.current.reload(); });
    mocks.post.mockResolvedValueOnce({ data: {} });
    await act(async () => {
      await result.current.retire("Superseded by Q4 tariff");
    });
    expect(mocks.post).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/price-book-versions/${versionId}/retire`,
      { reason: "Superseded by Q4 tariff" },
      expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"1"' }) }),
    );

    mocks.get.mockResolvedValue({ data: detail });
    await act(async () => { await result.current.reload(); });
    mocks.del.mockResolvedValueOnce({ data: {} });
    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteDraft();
    });
    expect(deleted).toBe(true);
    expect(mocks.del).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/price-book-versions/${versionId}`,
      expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"1"' }) }),
    );
  });
});
