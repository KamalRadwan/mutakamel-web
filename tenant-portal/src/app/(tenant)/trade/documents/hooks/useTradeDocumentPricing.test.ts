// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTradeDocumentPricing } from "./useTradeDocumentPricing";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../trade-api", () => ({ tradePost: post }));

type Query = Parameters<typeof useTradeDocumentPricing>[0];
const ID = "0192f3a0-0000-7000-8000-000000000001";
const OTHER = "0192f3a0-0000-7000-8000-000000000002";
const QUERY: Query = {
  headers: { "x-mutakamel-company-id": ID, "x-mutakamel-branch-id": OTHER },
  currencyCode: "SAR", partyId: ID, purpose: "SALES", enabled: true,
  lines: [{ clientLineId: ID, itemId: ID, uomId: OTHER, quantity: "2" }],
};
function response(unitPrice = "12.34567890", currencyCode = "SAR") {
  return { data: { unitPrice, currencyCode, priceBookId: ID, minimumAllowedPrice: null } };
}
function deferred() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<ReturnType<typeof response>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function startRequest() {
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
}
beforeEach(() => { vi.useFakeTimers(); post.mockReset(); post.mockResolvedValue(response()); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("document pricing lifecycle", () => {
  it("preserves exact server prices, including zero, without a manual override", async () => {
    const { result, rerender } = renderHook((query: Query) => useTradeDocumentPricing(query), { initialProps: QUERY });
    expect(result.current.ready).toBe(false);
    await startRequest();
    expect(post).toHaveBeenCalledWith("/api/tenant/trade/v1/pricing/evaluate", {
      purpose: "SALES", partyId: ID, itemId: ID, uomId: OTHER, quantity: "2", currencyCode: "SAR",
    }, expect.objectContaining({ headers: QUERY.headers, signal: expect.any(AbortSignal) }));
    expect(result.current.prices[0]?.unitPrice).toBe("12.34567890");
    expect(result.current.ready).toBe(true);
    post.mockResolvedValue(response("0"));
    rerender({ ...QUERY, purpose: "PURCHASE" });
    expect(result.current.ready).toBe(false);
    await startRequest();
    expect(result.current.prices[0]?.unitPrice).toBe("0");
    expect(result.current.ready).toBe(true);
  });

  it.each<[string, Partial<Query>]>([
    ["party", { partyId: OTHER }],
    ["currency", { currencyCode: "USD" }],
    ["scope", { headers: { ...QUERY.headers, "x-mutakamel-company-id": OTHER } }],
    ["purpose", { purpose: "PURCHASE" as const }],
    ["item", { lines: [{ ...QUERY.lines[0]!, itemId: OTHER }] }],
    ["UOM", { lines: [{ ...QUERY.lines[0]!, uomId: ID }] }],
    ["quantity", { lines: [{ ...QUERY.lines[0]!, quantity: "3" }] }],
  ])("invalidates and refreshes when %s changes", async (_, patch) => {
    const { result, rerender } = renderHook((query: Query) => useTradeDocumentPricing(query), { initialProps: QUERY });
    await startRequest();
    rerender({ ...QUERY, ...patch });
    expect(result.current.ready).toBe(false);
    expect(result.current.prices[0]?.unitPrice).toBeNull();
    post.mockResolvedValue(response("5", patch.currencyCode ?? "SAR"));
    await startRequest();
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.current.prices[0]?.unitPrice).toBe("5");
  });

  it("ignores old successes and failures after inputs change, even if abort is ignored", async () => {
    const first = deferred(); const second = deferred(); const third = deferred();
    post.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const { result, rerender } = renderHook((query: Query) => useTradeDocumentPricing(query), { initialProps: QUERY });
    await startRequest();
    const firstSignal: AbortSignal = post.mock.calls[0]![2].signal;
    rerender({ ...QUERY, partyId: OTHER });
    expect(firstSignal.aborted).toBe(true);
    await startRequest();
    rerender({ ...QUERY, purpose: "PURCHASE" });
    await startRequest();
    await act(async () => { third.resolve(response("30")); });
    await act(async () => { second.reject(new Error("old failure")); first.resolve(response("10")); });
    expect(result.current.ready).toBe(true);
    expect(result.current.prices[0]).toMatchObject({ unitPrice: "30", error: null, isPricing: false });
  });

  it("rejects failed or wrong-currency prices and clears evidence for invalid inputs", async () => {
    post.mockResolvedValueOnce(response("10", "USD"));
    const { result, rerender } = renderHook((query: Query) => useTradeDocumentPricing(query), { initialProps: QUERY });
    await startRequest();
    expect(result.current.ready).toBe(false);
    expect(result.current.prices[0]?.error).not.toBeNull();
    rerender({ ...QUERY, lines: [{ ...QUERY.lines[0]!, quantity: "0" }] });
    await startRequest();
    expect(post).toHaveBeenCalledTimes(1);
    expect(result.current.prices[0]).toMatchObject({ unitPrice: null, isPricing: false });
  });

  it("does not reuse a price when returning to an earlier query or reopening", async () => {
    const { result, rerender } = renderHook((query: Query) => useTradeDocumentPricing(query), { initialProps: QUERY });
    await startRequest();
    rerender({ ...QUERY, enabled: false });
    expect(result.current.ready).toBe(false);
    rerender(QUERY);
    expect(result.current.ready).toBe(false);
    await startRequest();
    expect(post).toHaveBeenCalledTimes(2);
    rerender({ ...QUERY, lines: [] });
    expect(result.current.ready).toBe(false);
    rerender(QUERY);
    expect(result.current.ready).toBe(false);
  });
});
