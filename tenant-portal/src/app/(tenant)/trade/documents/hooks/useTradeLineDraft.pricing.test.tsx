// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTradeLineDraft } from "./useTradeLineDraft";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: get,
  tradePost: post,
}));

const LINE = "0192f3a0-0000-7000-8000-000000000001";
const ITEM = "0192f3a0-0000-7000-8000-000000000002";
const UOM = "0192f3a0-0000-7000-8000-000000000003";
const OTHER = "0192f3a0-0000-7000-8000-000000000004";
const HEADERS = {
  "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000010",
  "x-mutakamel-branch-id": "0192f3a0-0000-7000-8000-000000000011",
};
const CONTEXT = {
  headers: HEADERS, currencyCode: "EGP", partyId: LINE, enabled: true,
};

function line(clientLineId = LINE) {
  return {
    clientLineId, itemId: ITEM, uomId: UOM, quantity: "1",
    unitPrice: null, priceError: null, isPricing: false,
  };
}

function response(unitPrice: string, currencyCode = "EGP") {
  return { data: { unitPrice, currencyCode, priceBookId: OTHER } };
}

function deferred() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<ReturnType<typeof response>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function renderDraft() {
  return renderHook(({ headers, currencyCode, partyId, enabled }) =>
    useTradeLineDraft(headers, currencyCode, partyId, "SALES", enabled),
  { initialProps: CONTEXT });
}

async function startPricing() {
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
}

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 100 } });
  post.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useTradeLineDraft pricing consistency", () => {
  it.each(["quantity", "uomId", "itemId"] as const)(
    "ignores an older response after changing %s on the same line",
    async (field) => {
      const old = deferred();
      const latest = deferred();
      post.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
      const { result } = renderDraft();
      act(() => result.current.reset([line()]));
      await startPricing();

      act(() => {
        if (field === "quantity") result.current.setQuantity(0, "2");
        else if (field === "uomId") result.current.setUom(0, OTHER);
        else result.current.reset([{ ...line(), itemId: OTHER }]);
      });
      expect(result.current.lines[0]?.unitPrice).toBeNull();
      expect(result.current.runningTotal).toBeNull();
      expect(post.mock.calls[0]?.[2].signal.aborted).toBe(true);
      await startPricing();
      expect(post).toHaveBeenCalledTimes(2);
      expect(post.mock.calls[1]?.[1][field]).toBe(field === "quantity" ? "2" : OTHER);

      await act(async () => { latest.resolve(response("20")); });
      expect(result.current.lines[0]).toMatchObject({
        clientLineId: LINE, unitPrice: "20", isPricing: false, priceError: null,
      });
      const total = result.current.runningTotal;
      expect(total).not.toBeNull();
      await act(async () => { old.resolve(response("10")); });
      expect(result.current.lines[0]?.unitPrice).toBe("20");
      expect(result.current.runningTotal).toBe(total);
    },
  );

  it("does not attach a removed line's late failure to the line now at its index", async () => {
    const removed = deferred();
    const priorRemaining = deferred();
    const currentRemaining = deferred();
    post.mockReturnValueOnce(removed.promise)
      .mockReturnValueOnce(priorRemaining.promise)
      .mockReturnValueOnce(currentRemaining.promise);
    const { result } = renderDraft();
    act(() => result.current.reset([line(), line(OTHER)]));
    await startPricing();
    act(() => result.current.removeLine(0));
    await startPricing();
    expect(post).toHaveBeenCalledTimes(3);
    await act(async () => { currentRemaining.resolve(response("30")); });
    await act(async () => {
      removed.reject(new Error("obsolete pricing failure"));
      priorRemaining.resolve(response("10"));
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({
      clientLineId: OTHER, unitPrice: "30", priceError: null, isPricing: false,
    });
  });

  it.each<[string, typeof CONTEXT]>([
    ["party", { ...CONTEXT, partyId: OTHER }],
    ["currency", { ...CONTEXT, currencyCode: "USD" }],
    ["company", { ...CONTEXT, headers: { ...HEADERS, "x-mutakamel-company-id": OTHER } }],
    ["branch", { ...CONTEXT, headers: { ...HEADERS, "x-mutakamel-branch-id": OTHER } }],
  ])("clears settled prices immediately and reevaluates after a %s change", async (_, context) => {
    post.mockResolvedValueOnce(response("10"));
    const latest = deferred();
    post.mockReturnValueOnce(latest.promise);
    const { result, rerender } = renderDraft();
    act(() => result.current.reset([line()]));
    await startPricing();
    expect(result.current.lines[0]?.unitPrice).toBe("10");
    expect(result.current.runningTotal).not.toBeNull();

    rerender(context);
    expect(result.current.lines[0]).toMatchObject({
      unitPrice: null, priceError: null, isPricing: true,
    });
    expect(result.current.runningTotal).toBeNull();
    await startPricing();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[1]).toMatchObject({
      partyId: context.partyId, currencyCode: context.currencyCode,
    });
    expect(post.mock.calls[1]?.[2].headers).toEqual(context.headers);
    await act(async () => { latest.resolve(response("20", context.currencyCode)); });
    expect(result.current.lines[0]?.unitPrice).toBe("20");
    expect(result.current.runningTotal).not.toBeNull();
  });

  it("clears prices while disabled and ignores a pending request after closing", async () => {
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response("20"));
    const { result, rerender } = renderDraft();
    act(() => result.current.reset([line()]));
    await startPricing();
    rerender({ ...CONTEXT, enabled: false });
    expect(result.current.lines[0]).toMatchObject({ unitPrice: null, isPricing: false });
    await act(async () => { pending.resolve(response("10")); });
    expect(result.current.runningTotal).toBeNull();
    rerender(CONTEXT);
    await startPricing();
    expect(result.current.lines[0]?.unitPrice).toBe("20");
  });
});
