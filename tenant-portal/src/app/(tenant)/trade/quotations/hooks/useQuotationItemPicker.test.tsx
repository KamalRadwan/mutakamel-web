// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import type { TradeItemOption } from "../../documents/trade-lookup-contract";
import { useQuotationItemPicker } from "./useQuotationItemPicker";

const preview = vi.hoisted(() => ({ amount: null as string | null, seen: vi.fn() }));
const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  tradePost: evaluate,
}));
vi.mock("./useQuotationPricingPreview", () => ({
  useQuotationPricingPreview: ({ request, enabled }: { request: import("../quotation-discount-contract").QuotationPricingRequest | null; enabled: boolean }) => {
    preview.seen(enabled ? request : null);
    return { ready: enabled && request !== null && preview.amount !== null, loading: false, retry: vi.fn(),
      calculation: enabled && request && preview.amount !== null ? {
        lines: request.lines.map(({ clientLineId }) => ({ clientLineId, unitPrice: "0.1" })),
        totals: { grandTotal: preview.amount },
      } : null };
  },
}));

const id = (value: number) => `0192f3a0-0000-7000-8000-${String(value).padStart(12, "0")}`;
const unit = { id: id(3), code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true };
function item(value: number): TradeItemOption {
  return { id: id(value), canonicalCode: `SKU-${value}`, barcode: null, localizedNames: { en: "Item" },
    quotationDescription: null, salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    status: "ACTIVE", eligibility: { companyProfileId: id(8), companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: unit.id, defaultSalesUomId: unit.id,
      defaultPurchaseUomId: unit.id, branchProfileId: id(9), branchProfileVersion: 1, isAssorted: true } };
}
function draft(): TradeLineDraftState {
  const items = [item(1), item(2)];
  return { lines: [], items, itemsById: Object.fromEntries(items.map((row) => [row.id, row])),
    uomsByItem: Object.fromEntries(items.map((row) => [row.id, [unit]])), lookupError: null,
    isLoadingItems: false, runningTotal: null, invalidLineIndex: null, lineErrors: [], purpose: "SALES",
    searchItems: vi.fn(), addLine: vi.fn(), removeLine: vi.fn(), setItem: vi.fn(), setUom: vi.fn(),
    setQuantity: vi.fn(), commitQuantity: vi.fn(), reset: vi.fn(), appendItems: vi.fn(),
    ensureItemUoms: vi.fn(async () => [unit]), retryLookups: vi.fn(), restore: vi.fn() };
}
const headers: Record<string, string> = { "x-mutakamel-company-id": id(20), "x-mutakamel-branch-id": id(21) };

beforeEach(() => { preview.amount = null; preview.seen.mockClear(); evaluate.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("quotation catalogue selection", () => {
  it("prices pending items from the company base price until a customer is chosen", async () => {
    vi.useFakeTimers();
    evaluate.mockResolvedValue({ data: {
      unitPrice: "3555", baselineUnitPrice: "3950", currencyCode: "EGP", priceBookId: id(30), minimumAllowedPrice: null,
    } });
    const state = draft();
    const { result, rerender } = renderHook(({ partyId }: { partyId: string | null }) =>
      useQuotationItemPicker({ draft: state, headers, currencyCode: "EGP", partyId }),
    { initialProps: { partyId: null as string | null } });
    act(() => { result.current.setOpen(true); result.current.toggle(id(1)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.pricing.prices[0]?.unitPrice).toBe("3950");
    expect(result.current.total).toBe("3950");
    expect(preview.seen).toHaveBeenLastCalledWith(null);

    preview.amount = "0.1";
    rerender({ partyId: id(31) });
    expect(preview.seen).toHaveBeenLastCalledWith(expect.objectContaining({ partyId: id(31) }));
    expect(result.current.pricing.prices[0]?.unitPrice).toBe("0.1");
    expect(evaluate).toHaveBeenCalledOnce();
  });
  it("selects visible items together, keeps hidden selections reviewable, and clears review on cancel", () => {
    const state = draft();
    const { result } = renderHook(() => useQuotationItemPicker({ draft: state, headers, currencyCode: "EGP", partyId: null }));
    act(() => result.current.toggleVisible([id(1), id(2)]));
    expect(result.current.rows).toHaveLength(2);
    act(() => result.current.searchItems("another search"));
    act(() => result.current.toggleReview());
    expect(result.current.reviewSelection).toBe(true);
    expect(result.current.rows.map((row) => row.itemId)).toEqual([id(1), id(2)]);
    act(() => result.current.toggleVisible([id(1)]));
    expect(result.current.rows.map((row) => row.itemId)).toEqual([id(2)]);
    act(() => result.current.setOpen(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.reviewSelection).toBe(false);
  });

  it("bounds unit catalogue reads and stops a pending batch after scope changes", async () => {
    const state = draft();
    const finish: Array<() => void> = [];
    state.ensureItemUoms = vi.fn(() => new Promise<Array<typeof unit>>((resolve) => finish.push(() => resolve([unit]))));
    const { result, rerender } = renderHook(({ scope }) => useQuotationItemPicker({ draft: state, headers: scope, currencyCode: "EGP", partyId: null }), { initialProps: { scope: headers } });
    act(() => result.current.toggleVisible(Array.from({ length: 13 }, (_, index) => id(index + 1))));
    expect(state.ensureItemUoms).toHaveBeenCalledTimes(6);
    rerender({ scope: { "x-company-id": id(21) } });
    await act(async () => { finish.forEach((resolve) => resolve()); await Promise.resolve(); });
    expect(state.ensureItemUoms).toHaveBeenCalledTimes(6);
    expect(result.current.rows).toEqual([]);
  });
  it("adds all selected rows atomically and preserves selections across server searches", () => {
    const state = draft();
    const { result, rerender } = renderHook(({ current }) => useQuotationItemPicker({ draft: current, headers, currencyCode: "EGP", partyId: null }), { initialProps: { current: state } });
    act(() => { result.current.setOpen(true); result.current.toggle(id(1)); });
    act(() => result.current.searchItems("another item"));
    rerender({ current: { ...state, items: [item(2)] } });
    act(() => result.current.toggle(id(2)));
    act(() => result.current.update(id(1), { quantity: "0.50" }));
    expect(result.current.canAdd).toBe(true);
    act(() => result.current.add());
    expect(state.appendItems).toHaveBeenCalledExactlyOnceWith([
      { itemId: id(1), uomId: unit.id, quantity: "0.5" }, { itemId: id(2), uomId: unit.id, quantity: "1" },
    ]);
    expect(result.current.open).toBe(false);
  });

  it("permits adding valid lines when advisory price preview is unavailable", () => {
    const state = draft();
    const { result } = renderHook(() => useQuotationItemPicker({ draft: state, headers, currencyCode: "EGP", partyId: null }));
    act(() => result.current.toggle(id(1)));
    expect(result.current.total).toBeNull();
    expect(result.current.canAdd).toBe(true);
  });

  it("requires an authorised item UOM and a positive numeric(24,8) quantity", () => {
    const state = { ...draft(), uomsByItem: {} };
    const { result, rerender } = renderHook(({ current }) => useQuotationItemPicker({ draft: current, headers, currencyCode: "EGP", partyId: null }), { initialProps: { current: state as TradeLineDraftState } });
    act(() => result.current.toggle(id(1)));
    expect(result.current.canAdd).toBe(false);
    rerender({ current: draft() });
    for (const quantity of ["0", "-1", "10000000000000000", "0.000000001", "abc"]) {
      act(() => result.current.update(id(1), { quantity }));
      expect(result.current.canAdd).toBe(false);
    }
    act(() => result.current.update(id(1), { quantity: ".5" }));
    expect(result.current.canAdd).toBe(true);
  });

  it("computes fractional selected totals exactly and clears old selections on scope change", () => {
    preview.amount = "0.02";
    const state = draft();
    const { result, rerender } = renderHook(({ scope, mode }: { scope: Record<string, string>; mode: "NONE" | "PROMOTIONS" | "DISCOUNT" }) =>
      useQuotationItemPicker({ draft: state, headers: scope, currencyCode: "EGP", partyId: id(30), crmCustomerProfileId: id(31), pricingMode: mode }),
    { initialProps: { scope: headers, mode: "NONE" } });
    act(() => { result.current.setOpen(true); result.current.toggle(id(1)); });
    act(() => result.current.update(id(1), { quantity: "0.2" }));
    expect(preview.seen).toHaveBeenLastCalledWith(expect.objectContaining({
      partyId: id(30), crmCustomerProfileId: id(31), currencyCode: "EGP",
      pricing: { mode: "NONE" },
      lines: [{ itemId: id(1), clientLineId: id(1), quantity: "0.2", uomId: unit.id }],
    }));
    expect(result.current.total).toBe("0.02");
    expect(result.current.pricing.prices[0]?.unitPrice).toBe("0.1");
    rerender({ scope: headers, mode: "PROMOTIONS" });
    expect(preview.seen).toHaveBeenLastCalledWith(expect.objectContaining({ pricing: { mode: "PROMOTIONS" } }));
    rerender({ scope: headers, mode: "DISCOUNT" });
    expect(preview.seen).toHaveBeenLastCalledWith(expect.objectContaining({ pricing: { mode: "NONE" } }));
    rerender({ scope: { ...headers, "x-mutakamel-branch-id": id(22) }, mode: "DISCOUNT" });
    expect(result.current.rows).toEqual([]);
    expect(result.current.canAdd).toBe(false);
  });

  it("enforces the document's 1000-line capacity before append", () => {
    const state = draft();
    state.lines = Array.from({ length: 1000 }, (_, index) => ({ clientLineId: id(index + 100), itemId: id(1), uomId: unit.id, quantity: "1", unitPrice: null, isPricing: false, priceError: null }));
    const { result } = renderHook(() => useQuotationItemPicker({ draft: state, headers, currencyCode: "EGP", partyId: null }));
    act(() => result.current.toggle(id(1)));
    act(() => result.current.add());
    expect(result.current.canAdd).toBe(false);
    expect(state.appendItems).not.toHaveBeenCalled();
  });
});
