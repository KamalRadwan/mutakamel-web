// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { DISCOUNT_IDS } from "../quotation-discount.test-fixtures";
import { useQuotationDiscount } from "./useQuotationDiscount";

const props = { enabled: true, locked: false, contextKey: "customer-a", currencyCode: "EGP", lineIds: [DISCOUNT_IDS.line, DISCOUNT_IDS.actor] };
function setup(initial = defaultQuotationDiscount()) {
  return renderHook((options) => {
    const [draft, update] = useState<QuotationDiscountDraft>(initial);
    return useQuotationDiscount({ ...options, draft, update });
  }, { initialProps: props });
}
async function flush() { await act(async () => { await Promise.resolve(); }); }

describe("quotation discount intent interactions", () => {
  it("requires confirmation to discard entered manual discount and supports cancellation", () => {
    const { result } = setup();
    act(() => result.current.setMode("DISCOUNT"));
    act(() => result.current.setValue("10"));
    act(() => result.current.setMode("PROMOTIONS"));
    expect(result.current.pendingChange).toEqual({ mode: "PROMOTIONS" });
    expect(result.current.draft.value).toBe("10");
    act(() => result.current.cancelChange());
    expect(result.current.draft.mode).toBe("DISCOUNT");
    act(() => result.current.setMode("PROMOTIONS"));
    act(() => result.current.confirmChange());
    expect(result.current.draft).toEqual({ ...defaultQuotationDiscount(), mode: "PROMOTIONS" });
  });
  it("clears the other scope only after explicit confirmation", () => {
    const { result } = setup({ ...defaultQuotationDiscount(), mode: "DISCOUNT", value: "20" });
    act(() => result.current.setScope("LINE"));
    expect(result.current.draft.scope).toBe("DOCUMENT");
    act(() => result.current.confirmChange());
    expect(result.current.draft).toMatchObject({ scope: "LINE", value: "0", lineDiscounts: {} });
    act(() => result.current.setLineValue(DISCOUNT_IDS.line, "5"));
    act(() => result.current.setScope("DOCUMENT"));
    act(() => result.current.confirmChange());
    expect(result.current.draft.lineDiscounts).toEqual({});
  });
  it("does not reinterpret a fixed amount as the same percentage", () => {
    const { result } = setup({ ...defaultQuotationDiscount(), mode: "DISCOUNT", type: "AMOUNT", value: "20" });
    act(() => result.current.setType("PERCENT"));
    expect(result.current.pendingChange).toEqual({ type: "PERCENT" });
    act(() => result.current.confirmChange());
    expect(result.current.draft).toMatchObject({ type: "PERCENT", value: "0" });
  });
  it("retains percentages and requires fixed amounts to be entered after currency change", async () => {
    const { result, rerender } = setup({ ...defaultQuotationDiscount(), mode: "DISCOUNT", scope: "LINE",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "AMOUNT", value: "20" }, [DISCOUNT_IDS.actor]: { type: "PERCENT", value: "5" } } });
    await flush(); rerender({ ...props, currencyCode: "USD" }); await flush();
    expect(result.current.draft.lineDiscounts).toEqual({ [DISCOUNT_IDS.line]: { type: "AMOUNT", value: "" }, [DISCOUNT_IDS.actor]: { type: "PERCENT", value: "5" } });
    expect(result.current.notice).toBe("currency");
  });
  it("clears customer-bound discounts on context change", async () => {
    const { result, rerender } = setup({ ...defaultQuotationDiscount(), mode: "DISCOUNT", value: "5", reason: "Old customer" });
    await flush(); rerender({ ...props, contextKey: "customer-b" }); await flush();
    expect(result.current.draft).toEqual(defaultQuotationDiscount());
    expect(result.current.notice).toBe("context");
  });
  it("preserves intent for retained lines and removes deleted line identities", async () => {
    const initial: QuotationDiscountDraft = { ...defaultQuotationDiscount(), mode: "DISCOUNT", scope: "LINE",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "PERCENT", value: "5" }, [DISCOUNT_IDS.actor]: { type: "AMOUNT", value: "2" } } };
    const { result, rerender } = setup(initial); await flush();
    rerender({ ...props, lineIds: [DISCOUNT_IDS.line] }); await flush();
    expect(result.current.draft.lineDiscounts).toEqual({ [DISCOUNT_IDS.line]: { type: "PERCENT", value: "5" } });
  });
  it("does not clear the restored handoff on its first enabled render", async () => {
    const initial = { ...defaultQuotationDiscount(), mode: "DISCOUNT" as const, type: "AMOUNT" as const, value: "12" };
    const { result } = setup(initial); await flush();
    expect(result.current.draft.value).toBe("12"); expect(result.current.notice).toBeNull();
  });
  it("fences every editor and confirmation while the write outcome is unknown", () => {
    const { result, rerender } = setup({ ...defaultQuotationDiscount(), mode: "DISCOUNT", value: "5" });
    act(() => result.current.setMode("PROMOTIONS")); rerender({ ...props, locked: true });
    act(() => { result.current.confirmChange(); result.current.setValue("99"); result.current.setReason("Changed"); result.current.setLineValue(DISCOUNT_IDS.line, "10"); });
    expect(result.current.draft).toMatchObject({ mode: "DISCOUNT", value: "5", reason: "", lineDiscounts: {} });
  });
  it("does not zero an existing line discount when clicking the already-selected line type", () => {
    const { result } = setup({
      ...defaultQuotationDiscount(), mode: "DISCOUNT", scope: "LINE",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "PERCENT", value: "12.5" } },
    });
    act(() => result.current.setLineType(DISCOUNT_IDS.line, "PERCENT"));
    expect(result.current.draft.lineDiscounts[DISCOUNT_IDS.line]).toEqual({ type: "PERCENT", value: "12.5" });
    act(() => result.current.setLineType(DISCOUNT_IDS.line, "AMOUNT"));
    expect(result.current.draft.lineDiscounts[DISCOUNT_IDS.line]).toEqual({ type: "AMOUNT", value: "0" });
  });
});
