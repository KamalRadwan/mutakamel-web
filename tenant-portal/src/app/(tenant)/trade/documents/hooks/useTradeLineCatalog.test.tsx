// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { TradeUomOption } from "../trade-lookup-contract";
import { useTradeLineCatalog } from "./useTradeLineCatalog";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()), tradeGet: get,
}));

const HEADERS = { "x-mutakamel-company-id": "019f0000-0000-7000-8000-000000000001" };
const FIRST = "019f0000-0000-7000-8000-000000000010";
const SECOND = "019f0000-0000-7000-8000-000000000020";
const UNIT = { id: "019f0000-0000-7000-8000-000000000030", code: "EA",
  displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise; reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
function response(items: unknown[] = []) {
  return { data: { items, total: items.length, page: 1, limit: 100 }, headers: new Headers() };
}
function failure(status: number, code: string) {
  return new TenantApiClientError("Lookup failed", { status, statusText: "Unavailable",
    headers: new Headers(), data: { code } });
}

beforeEach(() => { get.mockReset(); });
afterEach(cleanup);

describe("Trade line catalogue independent lookup failures", () => {
  it("retains a UOM failure when the overlapping initial item list succeeds later", async () => {
    const items = deferred<ReturnType<typeof response>>();
    const units = deferred<ReturnType<typeof response>>();
    get.mockImplementation((path: string) => path.includes("/catalog/uoms") ? units.promise : items.promise);
    const { result } = renderHook(() => useTradeLineCatalog(HEADERS, "SALES", true));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    let unitRead!: Promise<TradeUomOption[]>;
    act(() => { unitRead = result.current.ensureItemUoms(FIRST); });
    await act(async () => {
      units.reject(failure(503, "TRADE.DEPENDENCY.TIMEOUT")); await unitRead;
    });
    expect(result.current.lookupError?.code).toBe("TRADE.DEPENDENCY.TIMEOUT");
    await act(async () => { items.resolve(response()); await items.promise; });
    expect(result.current.isLoadingItems).toBe(false);
    expect(result.current.lookupError?.code).toBe("TRADE.DEPENDENCY.TIMEOUT");
    expect(get.mock.calls.filter(([path]) => String(path).includes("/catalog/uoms"))).toHaveLength(1);
  });

  it("retains the item-list failure when a separate UOM read succeeds", async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes("/catalog/uoms")) return response([UNIT]);
      throw failure(503, "TRADE.DEPENDENCY.TIMEOUT");
    });
    const { result } = renderHook(() => useTradeLineCatalog(HEADERS, "SALES", true));
    await waitFor(() => expect(result.current.lookupError?.status).toBe(503));
    await act(async () => { await result.current.ensureItemUoms(FIRST); });
    expect(result.current.uomsByItem[FIRST]).toEqual([UNIT]);
    expect(result.current.lookupError?.code).toBe("TRADE.DEPENDENCY.TIMEOUT");
  });

  it("retries each failed UOM once, deduplicates overlapping clicks and retains another item's failure", async () => {
    const retryFirst = deferred<ReturnType<typeof response>>();
    const retrySecond = deferred<ReturnType<typeof response>>();
    let recovering = false;
    get.mockImplementation(async (path: string) => {
      if (!path.includes("/catalog/uoms")) return response();
      const first = path.includes(FIRST);
      if (recovering) return first ? retryFirst.promise : retrySecond.promise;
      throw first ? failure(503, "TRADE.DEPENDENCY.TIMEOUT") : failure(404, "TRADE.CATALOG.ITEM_NOT_FOUND");
    });
    const { result } = renderHook(() => useTradeLineCatalog(HEADERS, "SALES", true));
    await waitFor(() => expect(result.current.isLoadingItems).toBe(false));
    await act(async () => { await Promise.all([
      result.current.ensureItemUoms(FIRST), result.current.ensureItemUoms(SECOND),
    ]); });
    expect(result.current.lookupError?.code).toBe("TRADE.DEPENDENCY.TIMEOUT");
    recovering = true;
    act(() => { result.current.retryLookups(); result.current.retryLookups(); });
    await waitFor(() => expect(get.mock.calls.filter(([path]) => String(path).includes("/catalog/uoms"))).toHaveLength(4));
    await act(async () => {
      retryFirst.resolve(response([UNIT])); retrySecond.reject(failure(404, "TRADE.CATALOG.ITEM_NOT_FOUND"));
      await Promise.allSettled([retryFirst.promise, retrySecond.promise]);
    });
    await waitFor(() => expect(result.current.uomsByItem[FIRST]).toEqual([UNIT]));
    expect(result.current.lookupError?.code).toBe("TRADE.CATALOG.ITEM_NOT_FOUND");
    expect(get.mock.calls.filter(([path]) => String(path).includes(FIRST))).toHaveLength(2);
    expect(get.mock.calls.filter(([path]) => String(path).includes(SECOND))).toHaveLength(2);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(get.mock.calls.filter(([path]) => String(path).includes("/catalog/uoms"))).toHaveLength(4);
  });
});
