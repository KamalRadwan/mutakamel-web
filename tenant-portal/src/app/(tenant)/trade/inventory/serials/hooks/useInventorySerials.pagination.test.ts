// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useInventorySerials } from "./useInventorySerials";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  headers: { "x-mutakamel-company-id": "company-1" },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: null, selectBranch: vi.fn() }),
  hasTradePermission: () => true,
  useTradeScope: () => ({ isResolved: true, headers: mocks.headers, permissions: [], isTenantOwner: true }),
}));
vi.mock("../../../trade-api", () => ({ tradeGet: mocks.get }));

const id = (n: number) => `019f2200-0000-7000-8000-${String(n).padStart(12, "0")}`;
const serial = (n: number) => ({
  id: id(n), itemId: id(1000), itemCompanyProfileId: id(1001), serialKey: `SN-${n}`,
  state: "ON_HAND", currentFulfillmentNodeId: null,
  lastTransitionAt: "2026-10-26T10:00:00.000Z", version: 1,
});
beforeEach(() => {
  mocks.headers = { "x-mutakamel-company-id": "company-1" };
  mocks.get.mockReset();
  mocks.get.mockImplementation(async (path: string) => {
    const page = Number(new URL(path, "https://example.test").searchParams.get("page"));
    return { data: { items: [serial((page - 1) * 50 + 1)], total: 151, page, limit: 50 } };
  });
});
afterEach(cleanup);

describe("serial list pagination", () => {
  it("loads later serial pages and resets to page 1 for a new filter or company", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-1"));
    expect(result.current.pagination).toEqual({ page: 1, total: 151, limit: 50 });
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-101"));
    expect(mocks.get.mock.lastCall?.[0]).toContain("page=3&limit=50");
    act(() => result.current.setStateFilter("ON_HAND"));
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-1"));
    expect(mocks.get.mock.lastCall?.[0]).toContain("page=1&limit=50&state=ON_HAND");
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-51"));
    mocks.headers = { "x-mutakamel-company-id": "company-2" };
    rerender();
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-1"));
    expect(result.current.pagination.page).toBe(1);
  });

  it("rejects the obsolete array response", async () => {
    mocks.get.mockResolvedValue({ data: [serial(1)] });
    const { result } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.items).toEqual([]);
  });

  it("ignores an aborted page when a filter changes", async () => {
    const { result } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    let finishOld!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(mocks.get.mock.lastCall?.[0]).toContain("page=2"));
    act(() => result.current.setSearch("SN-1"));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    await act(async () => {
      finishOld({ data: { items: [serial(51)], total: 151, page: 2, limit: 50 } });
    });
    expect(result.current.items[0]?.serialKey).toBe("SN-1");
    expect(result.current.pagination.page).toBe(1);
  });
});
