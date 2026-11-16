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
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../hooks/useInventoryReferences", () => ({ useInventoryReferences: () => ({ canCatalog: false, ensureItem: vi.fn(), ensureUom: vi.fn() }) }));
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
  window.history.replaceState(null, "", "/trade/inventory/serials");
  mocks.headers = { "x-mutakamel-company-id": "company-1" };
  mocks.get.mockReset();
  mocks.get.mockImplementation(async (path: string) => {
    const page = Number(new URL(path, "https://example.test").searchParams.get("page"));
    return { data: { items: [serial((page - 1) * 50 + 1)], total: 151, page, limit: 50 } };
  });
});
afterEach(cleanup);

describe("serial list pagination", () => {
  it("retains rows after a same-query refresh failure but never for another page or scope", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.get.mockRejectedValue(new Error("Private transport diagnostic"));
    await act(async () => result.current.reload());
    expect(result.current.items[0]?.serialKey).toBe("SN-1");
    expect(result.current.isStale).toBe(true);
    expect(result.current.errorMessage).toBe(en.tradeInventory.serialsLoadFailed);
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.items).toEqual([]);
    expect(result.current.isStale).toBe(false);
    mocks.headers = { "x-mutakamel-company-id": "company-2" };
    rerender();
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.items).toEqual([]);
    expect(result.current.isStale).toBe(false);
  });
  it("loads later serial pages and resets to page 1 for a new filter or company", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-1"));
    expect(result.current.pagination).toEqual({ page: 1, total: 151, limit: 50 });
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.items[0]?.serialKey).toBe("SN-101"));
    expect(mocks.get.mock.lastCall?.[0]).toContain("page=3&limit=50");
    act(() => result.current.setFilter("state", "ON_HAND"));
    act(() => result.current.applyFilters());
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

  it("applies all supported filters only on Apply and clears company-specific selections on a scope change", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const calls = mocks.get.mock.calls.length;
    act(() => {
      result.current.setFilter("serialKey", "SN-1");
      result.current.setFilter("itemId", id(1000));
    });
    act(() => result.current.setFilter("profileId", id(1001)));
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    act(() => result.current.applyFilters());
    await waitFor(() => expect(mocks.get.mock.lastCall?.[0]).toContain("itemCompanyProfileId="));
    const path = new URL(mocks.get.mock.lastCall?.[0], "https://example.test");
    expect(path.searchParams.get("serialKey")).toBe("SN-1");
    expect(path.searchParams.get("itemId")).toBe(id(1000));
    expect(path.searchParams.get("itemCompanyProfileId")).toBe(id(1001));
    mocks.headers = { "x-mutakamel-company-id": "company-2" };
    rerender();
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.draft.itemId).toBe("");
    expect(result.current.draft.profileId).toBe("");
    expect(result.current.filters.serialKey).toBe("");
  });

  it("keeps filters while opening/closing a deep link and restores focus to its trigger", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.setFilter("serialKey", "SN-1"));
    act(() => result.current.applyFilters());
    const trigger = document.createElement("button");
    const alternate = document.createElement("button");
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    result.current.headingRef.current = heading;
    document.body.append(trigger, alternate, heading);
    trigger.focus();
    const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.openSerial(id(1)));
    rerender();
    expect(window.location.pathname).toBe(`/trade/inventory/serials/${id(1)}`);
    expect(result.current.detailId).toBe(id(1));
    act(() => result.current.openSerial(id(1)));
    expect(push).toHaveBeenCalledTimes(1);
    act(() => result.current.closeSerial());
    rerender();
    expect(window.location.pathname).toBe("/trade/inventory/serials");
    expect(result.current.filters.serialKey).toBe("SN-1");
    alternate.focus();
    const event = new Event("closeAutoFocus", { cancelable: true });
    act(() => result.current.restoreFocus(event));
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    alternate.focus();
    act(() => result.current.restoreFocus(new Event("closeAutoFocus", { cancelable: true })));
    expect(document.activeElement).toBe(heading);
    alternate.remove();
    heading.remove();
    push.mockRestore();
  });

  it("tracks Back and Forward without clearing filters or admitting invalid record references", async () => {
    const { result, rerender } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.setFilter("serialKey", "SN-1"));
    act(() => result.current.applyFilters());
    act(() => result.current.openSerial("invalid"));
    expect(window.location.pathname).toBe("/trade/inventory/serials");
    act(() => result.current.openSerial(id(1)));
    rerender();
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe("/trade/inventory/serials"));
    rerender();
    expect(result.current.detailId).toBeUndefined();
    expect(result.current.filters.serialKey).toBe("SN-1");
    act(() => window.history.forward());
    await waitFor(() => expect(window.location.pathname).toBe(`/trade/inventory/serials/${id(1)}`));
    rerender();
    expect(result.current.detailId).toBe(id(1));
    expect(result.current.filters.serialKey).toBe("SN-1");
  });

  it("ignores an aborted page when a filter changes", async () => {
    const { result } = renderHook(useInventorySerials);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    let finishOld!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(mocks.get.mock.lastCall?.[0]).toContain("page=2"));
    act(() => result.current.setFilter("serialKey", "SN-1"));
    act(() => result.current.applyFilters());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    await act(async () => {
      finishOld({ data: { items: [serial(51)], total: 151, page: 2, limit: 50 } });
    });
    expect(result.current.items[0]?.serialKey).toBe("SN-1");
    expect(result.current.pagination.page).toBe(1);
  });
});
