// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePriceBookVersion } from "./usePriceBookVersion";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(),
  user: { id: "01902001-3000-7000-8000-000000000009" },
  allowed: true,
  toast: { success: vi.fn(), error: vi.fn(), outcomeFromApi: vi.fn() },
  headers: { "x-mutakamel-company-id": "01902001-3000-7000-8000-000000000001" },
}));

vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user }) }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchId: null }),
  useTradeScope: () => ({
    isResolved: true, headers: mocks.headers, permissions: [], isTenantOwner: true,
  }),
  hasTradePermission: () => mocks.allowed,
}));
vi.mock("../../../trade-api", () => ({
  tradeGet: mocks.get, tradePost: mocks.post,
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
  mocks.toast.outcomeFromApi.mockReturnValue(false);
});

async function loadVersion() {
  const hook = renderHook(() => usePriceBookVersion(versionId));
  await waitFor(() => expect(hook.result.current.detail?.version.id).toBe(versionId));
  return hook;
}

describe("Price-book version validation feedback", () => {
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
    expect(mocks.toast.error).toHaveBeenCalledWith(en.tradePricing.testFailedTitle, en.tradePricing.errorTestFailed);
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
    expect(mocks.toast.error).toHaveBeenCalled();
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
    { creator: undefined, passed: true, allowed: true, reason: "publishIdentityRequired" },
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
});
