// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet, type TradeResult } from "../../trade-api";
import { useTradeDocumentList } from "./useTradeDocumentList";

const context = vi.hoisted(() => ({
  scope: { isResolved: true, headers: { "x-mutakamel-company-id": "company",
    "x-mutakamel-branch-id": "A" }, userId: "user", canWrite: () => true },
}));
vi.mock("./useTradeDocumentScope", () => ({ useTradeDocumentScope: () => context.scope }));
vi.mock("next/navigation", () => ({ useSearchParams: () => null }));
vi.mock("@/design-system", () => ({ useRealtimeResync: vi.fn() }));
vi.mock("../../trade-api", () => ({ tradeGet: vi.fn() }));
vi.mock("@/lib/api/errors", () => ({
  normalizeApiError: (error: unknown) => error instanceof Error ? { status: 0 } : error,
}));

function deferred() {
  let resolve!: (response: TradeResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<TradeResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(item: string, page = 1): TradeResult {
  return { data: { items: [item], total: 45, page, limit: 20 }, headers: new Headers(), status: 200 };
}
function parseItem(item: unknown): string {
  if (typeof item !== "string") throw new Error("Invalid fixture");
  return item;
}
function switchBranch(branch: string) {
  context.scope = { ...context.scope, headers: { ...context.scope.headers,
    "x-mutakamel-branch-id": branch } };
}
async function flushLoad() { await act(async () => { await Promise.resolve(); }); }

describe("commercial document scoped lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.scope = { ...context.scope, isResolved: true, userId: "user" };
    switchBranch("A");
  });
  afterEach(cleanup);

  it.each(["REJECTED", "CANCELLED", "EXPIRED"])(
    "requests %s from page one and keeps the server's filtered total", async (status) => {
      vi.mocked(tradeGet).mockResolvedValue(response("initial"));
      const { result } = renderHook(() => useTradeDocumentList("/quotations", parseItem));
      await flushLoad();
      act(() => result.current.setPage(3));
      await flushLoad();
      vi.mocked(tradeGet).mockResolvedValueOnce({
        ...response("server match"),
        data: { items: ["server match"], total: 26, page: 1, limit: 25 },
      });
      act(() => result.current.setStatus(status));
      expect(result.current.items).toEqual([]);
      await flushLoad();
      const path = vi.mocked(tradeGet).mock.calls.at(-1)![0];
      const query = new URL(path, "https://tenant.example").searchParams;
      expect(query.get("status")).toBe(status);
      expect(query.get("page")).toBe("1");
      expect(result.current.items).toEqual(["server match"]);
      expect(result.current.pageInfo).toEqual({ page: 1, limit: 25, total: 26 });
    },
  );

  it("searches on the server and combines currency, status and party on every page", async () => {
    vi.mocked(tradeGet).mockResolvedValue(response("server search match"));
    const { result } = renderHook(() => useTradeDocumentList("/quotations", parseItem));
    await flushLoad();
    act(() => {
      result.current.setStatus("EXPIRED");
      result.current.setPartyId("01900100-0000-7000-8000-000000000001");
      result.current.setSearch("  Acme & 10%  ");
      result.current.setCurrencyCode("egp");
    });
    await flushLoad();
    act(() => result.current.setPage(2));
    await flushLoad();
    const path = vi.mocked(tradeGet).mock.calls.at(-1)![0];
    expect(Object.fromEntries(new URL(path, "https://tenant.example").searchParams)).toEqual({
      page: "2", limit: "25", status: "EXPIRED",
      partyId: "01900100-0000-7000-8000-000000000001",
      search: "Acme & 10%", currencyCode: "EGP",
    });
    expect(result.current.items).toEqual(["server search match"]);
    act(() => result.current.setCurrencyCode("E"));
    await flushLoad();
    expect(vi.mocked(tradeGet).mock.calls.at(-1)![0]).not.toContain("currencyCode=");
    expect(result.current.pageInfo.page).toBe(1);
    act(() => { result.current.setSearch(""); result.current.setCurrencyCode(""); });
    await flushLoad();
    expect(vi.mocked(tradeGet).mock.calls.at(-1)![0]).not.toContain("search=");
  });

  it("aborts obsolete searches and ignores their late results", async () => {
    const older = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("initial"))
      .mockReturnValueOnce(older.promise).mockResolvedValueOnce(response("new search"));
    const { result } = renderHook(() => useTradeDocumentList("/quotations", parseItem));
    await flushLoad();
    act(() => result.current.setSearch("old"));
    await flushLoad();
    const signal = vi.mocked(tradeGet).mock.calls[1]?.[1]?.signal;
    act(() => result.current.setSearch("new"));
    await flushLoad();
    expect(signal?.aborted).toBe(true);
    await act(async () => older.resolve(response("late old search")));
    expect(result.current.items).toEqual(["new search"]);
  });

  it.each([{ status: 403 }, new Error("Network unavailable")])(
    "hides A synchronously and never restores it after B fails (%s)", async (error) => {
      const b = deferred();
      vi.mocked(tradeGet).mockResolvedValueOnce(response("A")).mockReturnValueOnce(b.promise);
      const { result, rerender } = renderHook(() => useTradeDocumentList("/purchase-orders", parseItem));
      await flushLoad();
      expect(result.current.items).toEqual(["A"]);
      switchBranch("B");
      rerender();
      expect(result.current.items).toEqual([]);
      expect(result.current.pageInfo.total).toBe(0);
      expect(result.current.queryError).toBeNull();
      expect(result.current.isLoading).toBe(true);
      await flushLoad();
      await act(async () => { b.reject(error); });
      expect(result.current.items).toEqual([]);
      expect(result.current.pageInfo.total).toBe(0);
      expect(result.current.queryError?.status).toBe(error instanceof Error ? 0 : 403);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isRefreshing).toBe(false);
    },
  );

  it.each(["success", "failure"])("ignores a delayed A refresh %s after B succeeds", async (outcome) => {
    const a = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("A"))
      .mockReturnValueOnce(a.promise).mockResolvedValueOnce(response("B"));
    const { result, rerender } = renderHook(() => useTradeDocumentList("/purchase-orders", parseItem));
    await flushLoad();
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.reload(); });
    const signal = vi.mocked(tradeGet).mock.calls[1]?.[1]?.signal;
    switchBranch("B");
    rerender();
    await flushLoad();
    expect(signal?.aborted).toBe(true);
    expect(result.current.items).toEqual(["B"]);
    await act(async () => {
      if (outcome === "success") a.resolve(response("late A"));
      else a.reject({ status: 403 });
      await refresh;
    });
    expect(result.current.items).toEqual(["B"]);
    expect(result.current.queryError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it("keeps loading until B completes when an obsolete A request settles first", async () => {
    const a = deferred();
    const b = deferred();
    vi.mocked(tradeGet).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useTradeDocumentList("/purchase-orders", parseItem));
    await flushLoad();
    switchBranch("B");
    rerender();
    await flushLoad();
    await act(async () => { a.resolve(response("A")); });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await act(async () => { b.resolve(response("B")); });
    expect(result.current.items).toEqual(["B"]);
  });

  it("invalidates overlapping refreshes and clears rows on a current failure", async () => {
    const older = deferred();
    const newer = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("A"))
      .mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useTradeDocumentList("/purchase-orders", parseItem));
    await flushLoad();
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => { first = result.current.reload(); second = result.current.reload(); });
    await act(async () => { newer.reject({ status: 403 }); await second; });
    await act(async () => { older.resolve(response("stale A")); await first; });
    expect(result.current.items).toEqual([]);
    expect(result.current.queryError?.status).toBe(403);
  });

  it("resets pagination on scope changes and hides records when scope becomes unresolved", async () => {
    vi.mocked(tradeGet).mockResolvedValue(response("A"));
    const { result, rerender } = renderHook(() => useTradeDocumentList("/purchase-orders", parseItem));
    await flushLoad();
    act(() => result.current.setPage(3));
    await flushLoad();
    switchBranch("B");
    rerender();
    expect(result.current.pageInfo.page).toBe(1);
    expect(result.current.items).toEqual([]);
    context.scope = { ...context.scope, isResolved: false };
    rerender();
    await flushLoad();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
