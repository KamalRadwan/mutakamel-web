// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePriceBookLoader } from "./usePriceBookLoader";

const A = "01902001-3000-7000-8000-000000000001";
const B = "01902001-3000-7000-8000-000000000002";
const COMPANY = "01902001-3000-7000-8000-000000000003";
const h = vi.hoisted(() => ({ get: vi.fn(), headers: { "x-mutakamel-company-id": "01902001-3000-7000-8000-000000000003" } }));
vi.mock("../../trade-api", () => ({ tradeGet: h.get }));
function response(id = A, name = "Current book") {
  return { data: { book: { id, companyId: COMPANY, code: "WHOLESALE", currencyCode: "EGP", name, version: 1, status: "ACTIVE", purpose: "SALES" }, versions: [] } };
}
function options(id = A) { return { id, scopeKey: id, companyId: COMPANY, enabled: true, headers: h.headers }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(cleanup);
beforeEach(() => { h.get.mockReset().mockResolvedValue(response()); });

describe("book loader identity and response fencing", () => {
  it("keeps a loading outcome until the first validated book arrives", async () => {
    const { result } = renderHook(() => usePriceBookLoader(options()));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.detail?.book.id).toBe(A));
    expect(result.current.isLoading).toBe(false);
  });
  it("hides old data immediately when the actor or company scope changes", async () => {
    const hook = renderHook(({ scopeKey }) => usePriceBookLoader({ ...options(), scopeKey }), { initialProps: { scopeKey: "actor-1" } });
    await waitFor(() => expect(hook.result.current.detail?.book.id).toBe(A));
    const pending = deferred<ReturnType<typeof response>>(); h.get.mockReturnValueOnce(pending.promise);
    hook.rerender({ scopeKey: "actor-2" });
    expect(hook.result.current.detail).toBeNull();
    expect(hook.result.current.isLoading).toBe(true);
    await act(async () => { pending.resolve(response()); });
    await waitFor(() => expect(hook.result.current.detail?.book.id).toBe(A));
  });
  it("does not apply an old response after switching to another book", async () => {
    const pending = deferred<ReturnType<typeof response>>(); h.get.mockReturnValueOnce(pending.promise);
    const hook = renderHook(({ id }) => usePriceBookLoader(options(id)), { initialProps: { id: A } });
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(1));
    h.get.mockResolvedValue(response(B)); hook.rerender({ id: B });
    await waitFor(() => expect(hook.result.current.detail?.book.id).toBe(B));
    await act(async () => { pending.resolve(response(A)); });
    expect(hook.result.current.detail?.book.id).toBe(B);
  });
  it("keeps saved data during a refresh failure and exposes the error separately", async () => {
    const { result } = renderHook(() => usePriceBookLoader(options()));
    await waitFor(() => expect(result.current.detail?.book.id).toBe(A));
    h.get.mockRejectedValueOnce(new Error("upstream unavailable"));
    await act(async () => { await result.current.load(); });
    expect(result.current.detail?.book.id).toBe(A);
    expect(result.current.queryError).not.toBeNull();
  });
  it("rejects a response belonging to a different book instead of presenting its data", async () => {
    h.get.mockResolvedValue(response(B));
    const { result } = renderHook(() => usePriceBookLoader(options()));
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
