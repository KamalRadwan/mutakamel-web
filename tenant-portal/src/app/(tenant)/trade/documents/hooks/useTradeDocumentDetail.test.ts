// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet, type TradeResult } from "../../trade-api";
import { useTradeDocumentDetail } from "./useTradeDocumentDetail";

const ID = "01900500-0000-7000-8000-000000000001";
const NEXT_ID = "01900500-0000-7000-8000-000000000002";
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
function response(document: string): TradeResult {
  return { data: document, headers: new Headers(), status: 200 };
}
function parse(document: unknown): string {
  if (typeof document !== "string") throw new Error("Invalid fixture");
  return document;
}
function switchBranch(branch: string) {
  context.scope = { ...context.scope, headers: { ...context.scope.headers,
    "x-mutakamel-branch-id": branch } };
}
async function flushLoad() { await act(async () => { await Promise.resolve(); }); }

describe("commercial document detail isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    context.scope = { ...context.scope, isResolved: true, userId: "user" };
    switchBranch("A");
  });
  afterEach(cleanup);

  it.each([403, 500, 404])("clears a loaded document after a %s refresh", async (status) => {
    const refresh = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("A")).mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(() => useTradeDocumentDetail("/quotations", ID, parse));
    await flushLoad();
    expect(result.current.document).toBe("A");
    let pending!: Promise<string | null>;
    act(() => { pending = result.current.reload(); });
    expect(result.current.document).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => { refresh.reject({ status }); await pending; });
    expect(result.current.document).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isMissing).toBe(status === 404);
    expect(result.current.loadError?.status ?? null).toBe(status === 404 ? null : status);
  });

  it.each(["route", "branch", "user"])("quarantines details synchronously on a %s change", async (change) => {
    const next = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("A")).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ id }) =>
      useTradeDocumentDetail("/quotations", id, parse), { initialProps: { id: ID } });
    await flushLoad();
    expect(result.current.document).toBe("A");
    if (change === "branch") switchBranch("B");
    if (change === "user") context.scope = { ...context.scope, userId: "other" };
    rerender({ id: change === "route" ? NEXT_ID : ID });
    expect(result.current.document).toBeNull();
    expect(result.current.loadError).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await flushLoad();
    await act(async () => { next.reject({ status: 403 }); });
    expect(result.current.document).toBeNull();
    expect(result.current.loadError?.status).toBe(403);
  });

  it.each(["success", "failure"])("ignores a delayed previous-scope refresh %s", async (outcome) => {
    const old = deferred();
    vi.mocked(tradeGet).mockResolvedValueOnce(response("A"))
      .mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("B"));
    const { result, rerender } = renderHook(() => useTradeDocumentDetail("/quotations", ID, parse));
    await flushLoad();
    let pending!: Promise<string | null>;
    act(() => { pending = result.current.reload(); });
    const signal = vi.mocked(tradeGet).mock.calls[1]?.[1]?.signal;
    switchBranch("B");
    rerender();
    await flushLoad();
    expect(signal?.aborted).toBe(true);
    expect(result.current.document).toBe("B");
    await act(async () => {
      if (outcome === "success") old.resolve(response("late A"));
      else old.reject({ status: 403 });
      expect(await pending).toBeNull();
    });
    expect(result.current.document).toBe("B");
    expect(result.current.loadError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it("does not let an older success override a newer denial", async () => {
    const older = deferred();
    const newer = deferred();
    vi.mocked(tradeGet).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useTradeDocumentDetail("/quotations", ID, parse));
    await flushLoad();
    let pending!: Promise<string | null>;
    act(() => { pending = result.current.reload(); });
    await act(async () => { older.resolve(response("obsolete")); });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.document).toBeNull();
    await act(async () => { newer.reject({ status: 403 }); await pending; });
    expect(result.current.loadError?.status).toBe(403);
    expect(result.current.document).toBeNull();
  });

  it("hides loaded data and stops requests while scope is unresolved", async () => {
    vi.mocked(tradeGet).mockResolvedValue(response("A"));
    const { result, rerender } = renderHook(() => useTradeDocumentDetail("/quotations", ID, parse));
    await flushLoad();
    context.scope = { ...context.scope, isResolved: false };
    rerender();
    expect(result.current.document).toBeNull();
    await flushLoad();
    expect(await result.current.reload()).toBeNull();
    expect(tradeGet).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    context.scope = { ...context.scope, isResolved: true };
    rerender();
    expect(result.current.document).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await flushLoad();
    expect(tradeGet).toHaveBeenCalledTimes(2);
    expect(result.current.document).toBe("A");
  });
});
