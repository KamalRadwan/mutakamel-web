// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { InventoryReferenceItem, InventoryReferenceUom } from "../inventory-reference-contract";
import { useInventoryReferences } from "./useInventoryReferences";

const testState = vi.hoisted(() => ({
  headers: { "x-mutakamel-company-id": "company-a", "x-mutakamel-branch-id": "branch-a" },
  get: vi.fn(), units: vi.fn(), canCatalog: true,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null, realtimeAuthGeneration: 1 }) }));
vi.mock("@/hooks/useAuthScopeKey", () => ({ useAuthScopeKey: () => "actor-a" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/lib/auth/permission-scope", () => ({ can: () => testState.canCatalog }));
vi.mock("../../trade-api", () => ({ tradeGet: testState.get }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchId: testState.headers["x-mutakamel-branch-id"] }),
  useTradeScope: () => ({ headers: testState.headers, isResolved: true, permissions: ["trade.inventory.read"], isTenantOwner: false }),
  hasTradePermission: () => true,
}));
// This suite tests publication order and cache ownership; DTO parsing has separate contract coverage.
vi.mock("../inventory-reference-contract", () => ({ parseInventoryReferenceItem: (value: unknown) => value }));
vi.mock("../inventory-reference-loader", () => ({ loadInventoryUnits: testState.units }));

const initialItem: InventoryReferenceItem = {
  id: "01902001-3000-7000-8000-000000000001", name: "Cable", code: "CAB", profileId: null,
  profileVersion: null, baseUomId: "01902001-3000-7000-8000-000000000003",
  defaultSalesUomId: null, defaultPurchaseUomId: null, trackingMode: null, trackInventory: null,
};
const remoteItem = { ...initialItem, id: "01902001-3000-7000-8000-000000000002", name: "Scanner", code: "SCAN" };
const hydratedRemote: InventoryReferenceItem = { ...remoteItem, profileVersion: 7, trackingMode: "SERIAL", trackInventory: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const useDirectory = () => useInventoryReferences({ headers: testState.headers, scopeKey: JSON.stringify(testState.headers), enabled: true });

describe("inventory reference directory publication", () => {
  beforeEach(() => {
    testState.headers = { "x-mutakamel-company-id": "company-a", "x-mutakamel-branch-id": "branch-a" };
    testState.canCatalog = true;
    testState.get.mockReset().mockImplementation(async (path: string) => {
      if (path.includes("/items?")) return { data: { items: path.includes("search=") ? [remoteItem] : [initialItem] } };
      if (path.endsWith(remoteItem.id)) return { data: hydratedRemote };
      return { data: [] };
    });
    testState.units.mockReset().mockResolvedValue([]);
  });

  it("keeps a searched hydrated item when slower initial unit pages finish", async () => {
    const units = deferred<InventoryReferenceUom[]>();
    testState.units.mockReturnValue(units.promise);
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(testState.units).toHaveBeenCalledOnce());
    await act(async () => { await result.current.searchItems("Scanner"); });
    await act(async () => { await result.current.ensureItem(remoteItem.id); });
    await act(async () => { units.resolve([]); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([hydratedRemote]);
    expect(result.current.itemLabel(remoteItem.id)).toBe("Scanner · SCAN");
    expect(result.current.itemLabel(initialItem.id)).toBe("Cable · CAB");
  });

  it("keeps hydrated tracking metadata when another remote search returns summary rows", async () => {
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.ensureItem(remoteItem.id); });
    await act(async () => { await result.current.searchItems("Scanner"); });
    expect(result.current.items).toEqual([hydratedRemote]);
  });

  it("merges a selected item's hydration into the matching initial summary row", async () => {
    const units = deferred<InventoryReferenceUom[]>();
    const hydratedInitial: InventoryReferenceItem = { ...initialItem, profileVersion: 3, trackingMode: "LOT", trackInventory: true };
    testState.units.mockReturnValue(units.promise);
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(testState.units).toHaveBeenCalledOnce());
    testState.get.mockResolvedValueOnce({ data: hydratedInitial });
    await act(async () => { await result.current.ensureItem(initialItem.id); });
    await act(async () => { units.resolve([]); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([hydratedInitial]);
  });

  it("preserves the latest search failure when initial directory loading finishes", async () => {
    const units = deferred<InventoryReferenceUom[]>();
    testState.units.mockReturnValue(units.promise);
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(testState.units).toHaveBeenCalledOnce());
    testState.get.mockRejectedValueOnce(new Error("Search unavailable"));
    await act(async () => { await result.current.searchItems("Scanner"); });
    await act(async () => { units.resolve([]); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.itemError?.message).toBe("Search unavailable");
    expect(result.current.error?.message).toBe("Search unavailable");
  });

  it("discards an older search completion after the latest search has returned", async () => {
    const first = deferred<{ data: { items: InventoryReferenceItem[] } }>();
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    testState.get.mockReturnValueOnce(first.promise);
    let search: Promise<void> = Promise.resolve();
    act(() => { search = result.current.searchItems("Cable"); });
    await act(async () => { await result.current.searchItems("Scanner"); });
    await act(async () => { first.resolve({ data: { items: [initialItem] } }); await search; });
    expect(result.current.items).toEqual([remoteItem]);
  });

  it("loads the default catalogue for a new scope after searching in the previous scope", async () => {
    const { result, rerender } = renderHook(useDirectory);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.searchItems("Scanner"); });
    testState.headers = { ...testState.headers, "x-mutakamel-branch-id": "branch-b" };
    rerender();
    await waitFor(() => expect(result.current.items).toEqual([initialItem]));
    expect(result.current.itemLabel(remoteItem.id)).toBe(en.common.nameUnavailable);
  });

  it("retries the current search rather than replacing it with the default catalogue", async () => {
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    testState.get.mockRejectedValueOnce(new Error("Search unavailable"));
    await act(async () => { await result.current.searchItems("Scanner"); });
    expect(result.current.itemError?.message).toBe("Search unavailable");
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.items).toEqual([remoteItem]));
    expect(result.current.itemError).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not query the catalogue or unit directory without the scoped catalogue permission", async () => {
    testState.canCatalog = false;
    const { result } = renderHook(useDirectory);
    await waitFor(() => expect(testState.get).toHaveBeenCalledOnce());
    expect(testState.get.mock.calls[0]?.[0]).toContain("inventory/nodes");
    expect(testState.units).not.toHaveBeenCalled();
    await act(async () => { await result.current.searchItems("Scanner"); });
    await expect(result.current.ensureItem(remoteItem.id)).rejects.toThrow(en.common.nameUnavailable);
    expect(testState.get).toHaveBeenCalledOnce();
    expect(result.current.items).toEqual([]);
  });
});
