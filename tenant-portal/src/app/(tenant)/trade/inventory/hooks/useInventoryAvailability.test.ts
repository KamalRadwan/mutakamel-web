// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useInventoryAvailability } from "./useInventoryAvailability";
import type { InventoryReferenceItem } from "../inventory-reference-contract";
import type { AvailabilityHistoryEntry } from "./useInventoryAvailability";

const testState = vi.hoisted(() => ({ headers: { "x-mutakamel-company-id": "company-a", "x-mutakamel-branch-id": "branch-a" }, mode: "NONE", get: vi.fn(), ensureItem: vi.fn() }));
const itemId = "01902001-3000-7000-8000-000000000002";
const nodeId = "01902001-3000-7000-8000-000000000001";
const uomId = "01902001-3000-7000-8000-000000000003";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useAuthScopeKey", () => ({ useAuthScopeKey: () => "actor-a" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../trade-api", () => ({ tradeGet: testState.get }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: testState.headers["x-mutakamel-branch-id"], selectBranch: vi.fn() }),
  useTradeScope: () => ({ headers: testState.headers, isResolved: true, permissions: ["trade.inventory.read"], isTenantOwner: false }),
  hasTradePermission: () => true,
}));
vi.mock("./useInventoryReferences", () => ({ useInventoryReferences: () => ({
  ensureItem: testState.ensureItem,
  ensureUom: async () => undefined,
  nodes: [], items: [], uoms: [], canCatalog: true, canNodes: true,
}) }));

const snapshot = { nodeId, itemId, uomId, onHandQuantity: "12.00000001", reservedQuantity: "2", availableQuantity: "10.00000001", version: 4, asOf: "2026-11-03T08:42:00Z", advisory: true };
const otherItemId = "01902001-3000-7000-8000-000000000004";
const otherUomId = "01902001-3000-7000-8000-000000000005";
const item = (id = itemId, trackingMode: InventoryReferenceItem["trackingMode"] = "NONE", baseUomId = uomId): InventoryReferenceItem => ({
  id, name: "Cable", code: "CABLE", profileId: nodeId, profileVersion: 1, baseUomId,
  defaultSalesUomId: null, defaultPurchaseUomId: null, trackingMode, trackInventory: true,
});
const historyEntry = (selectedItem: InventoryReferenceItem): AvailabilityHistoryEntry => ({
  key: selectedItem.id, item: selectedItem,
  query: { nodeId, itemId: selectedItem.id, uomId: selectedItem.baseUomId,
    lotKey: selectedItem.trackingMode === "LOT" ? "LOT-2026" : "", serialKey: selectedItem.trackingMode === "SERIAL" ? "SN-2026" : "" },
  snapshot: { ...snapshot, itemId: selectedItem.id, uomId: selectedItem.baseUomId },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function fill(result: { current: ReturnType<typeof useInventoryAvailability> }) {
  await act(async () => { await result.current.chooseItem(itemId); });
  act(() => result.current.setValue("nodeId", nodeId));
}

describe("availability inquiry", () => {
  beforeEach(() => { testState.get.mockReset(); testState.mode = "NONE";
    testState.ensureItem.mockReset().mockImplementation(async (id: string) => item(id, testState.mode as InventoryReferenceItem["trackingMode"]));
    testState.headers = { "x-mutakamel-company-id": "company-a", "x-mutakamel-branch-id": "branch-a" }; });

  it("keeps exact decimal results and preserves the last snapshot on a failed refresh", async () => {
    testState.get.mockResolvedValueOnce({ data: snapshot }).mockRejectedValueOnce(new Error("Network unavailable"));
    const { result } = renderHook(useInventoryAvailability);
    await fill(result);
    await act(async () => { await result.current.lookUp(); });
    expect(result.current.result?.availableQuantity).toBe("10.00000001");
    expect(result.current.history).toHaveLength(1);
    await act(async () => { await result.current.refreshSnapshot(); });
    expect(result.current.queryError?.status).toBe(0);
    expect(result.current.result?.availableQuantity).toBe("10.00000001");
    expect(result.current.history).toHaveLength(1);
  });

  it("requires a lot for a lot-tracked item before sending the inquiry", async () => {
    testState.mode = "LOT";
    const { result } = renderHook(useInventoryAvailability);
    await fill(result);
    await act(async () => { await result.current.lookUp(); });
    expect(testState.get).not.toHaveBeenCalled();
    expect(result.current.formError).toBe(en.tradeInventory.formTrackingInvalid);
    expect(result.current.formField).toBe("lotKey");
  });

  it("identifies the missing selector and clears its error when corrected", async () => {
    const { result } = renderHook(useInventoryAvailability);
    await act(async () => { await result.current.lookUp(); });
    expect(result.current.formField).toBe("nodeId");
    expect(testState.get).not.toHaveBeenCalled();
    act(() => { result.current.setValue("nodeId", nodeId); });
    expect(result.current.formField).toBeNull();
    expect(result.current.formError).toBeNull();
  });

  it("discards an old branch response after the operating scope changes", async () => {
    let resolve: (value: { data: typeof snapshot }) => void = () => undefined;
    testState.get.mockImplementation(() => new Promise<{ data: typeof snapshot }>((done) => { resolve = done; }));
    const { result, rerender } = renderHook(useInventoryAvailability);
    await fill(result);
    let request: Promise<void> = Promise.resolve();
    act(() => { request = result.current.lookUp(); });
    await waitFor(() => expect(testState.get).toHaveBeenCalledOnce());
    testState.headers = { ...testState.headers, "x-mutakamel-branch-id": "branch-b" };
    rerender();
    await act(async () => { resolve({ data: snapshot }); await request; });
    expect(result.current.result).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.values.itemId).toBe("");
  });

  it("restores the history item's tracking controls and cancels pending item hydration", async () => {
    const pendingItem = deferred<InventoryReferenceItem>();
    testState.ensureItem.mockReturnValueOnce(pendingItem.promise);
    const { result } = renderHook(useInventoryAvailability);
    let selection: Promise<void> = Promise.resolve();
    act(() => { selection = result.current.chooseItem(itemId); });
    const serialEntry = historyEntry(item(otherItemId, "SERIAL", otherUomId));
    act(() => result.current.selectHistoryEntry(serialEntry));
    expect(result.current.selectedItem?.trackingMode).toBe("SERIAL");
    expect(result.current.values.serialKey).toBe("SN-2026");
    expect(result.current.itemLoading).toBe(false);
    await act(async () => { pendingItem.resolve(item(itemId, "LOT")); await selection; });
    expect(result.current.selectedItem?.id).toBe(otherItemId);
    expect(result.current.values.uomId).toBe(otherUomId);
    expect(result.current.values.lotKey).toBe("");
  });

  it("reruns a lot history query while preserving its item and tracking selection", async () => {
    const lotItem = item(otherItemId, "LOT", otherUomId);
    testState.ensureItem.mockImplementation(async (id: string) => id === otherItemId ? lotItem : item());
    testState.get.mockResolvedValue({ data: { ...snapshot, itemId: otherItemId, uomId: otherUomId } });
    const { result } = renderHook(useInventoryAvailability);
    await fill(result);
    act(() => result.current.selectHistoryEntry(historyEntry(lotItem), true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(testState.get.mock.calls[0]?.[0]).toContain("lotKey=LOT-2026");
    expect(result.current.selectedItem?.trackingMode).toBe("LOT");
    expect(result.current.values.uomId).toBe(otherUomId);
  });

  it("gives the newest inquiry priority before asynchronous item hydration finishes", async () => {
    const first = deferred<InventoryReferenceItem>();
    const second = deferred<InventoryReferenceItem>();
    testState.ensureItem.mockImplementation((id: string) => id === itemId ? first.promise : second.promise);
    testState.get.mockResolvedValue({ data: { ...snapshot, itemId: otherItemId } });
    const { result } = renderHook(useInventoryAvailability);
    act(() => result.current.setValue("nodeId", nodeId));
    act(() => result.current.setValue("uomId", uomId));
    act(() => result.current.setValue("itemId", itemId));
    let firstLookup: Promise<void> = Promise.resolve();
    let secondLookup: Promise<void> = Promise.resolve();
    act(() => { firstLookup = result.current.lookUp(); });
    act(() => result.current.setValue("itemId", otherItemId));
    act(() => { secondLookup = result.current.lookUp(); });
    await act(async () => { second.resolve(item(otherItemId)); await secondLookup; });
    await act(async () => { first.resolve(item()); await firstLookup; });
    expect(testState.get).toHaveBeenCalledOnce();
    expect(result.current.result?.itemId).toBe(otherItemId);
    expect(result.current.resultQuery?.itemId).toBe(otherItemId);
  });

  it("keeps the displayed snapshot inspectable after the session list is cleared", async () => {
    testState.get.mockResolvedValue({ data: snapshot });
    const { result } = renderHook(useInventoryAvailability);
    await fill(result);
    await act(async () => { await result.current.lookUp(); });
    const entry = result.current.history[0];
    act(() => result.current.clearHistory());
    act(() => result.current.setInspected(entry));
    expect(result.current.history).toEqual([]);
    expect(result.current.result).toEqual(snapshot);
    expect(result.current.inspected?.snapshot).toEqual(snapshot);
  });

  it("does not revive snapshots or an inspector when returning to a previous branch", async () => {
    testState.get.mockResolvedValue({ data: snapshot });
    const { result, rerender } = renderHook(useInventoryAvailability);
    await fill(result);
    await act(async () => { await result.current.lookUp(); });
    act(() => result.current.setInspected(result.current.history[0]));
    const originalHeaders = testState.headers;
    testState.headers = { ...originalHeaders, "x-mutakamel-branch-id": "branch-b" };
    rerender();
    testState.headers = originalHeaders;
    rerender();
    expect(result.current.result).toBeNull();
    expect(result.current.inspected).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it("restores inspector focus and falls back to the page heading when its session trigger was removed", () => {
    const { result } = renderHook(useInventoryAvailability);
    const trigger = document.createElement("button");
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    document.body.append(trigger, heading);
    result.current.headingRef.current = heading;
    trigger.focus();
    act(() => result.current.setInspected(historyEntry(item())));
    heading.focus();
    result.current.restoreInspectorFocus();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    result.current.restoreInspectorFocus();
    expect(document.activeElement).toBe(heading);
    heading.remove();
  });
});
