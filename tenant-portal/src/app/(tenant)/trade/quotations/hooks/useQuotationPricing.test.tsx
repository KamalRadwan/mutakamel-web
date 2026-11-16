// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedApiError } from "@/lib/api/errors";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { DISCOUNT_HEADERS, DISCOUNT_IDS, quotationPricingCalculation } from "../quotation-discount.test-fixtures";
import { useQuotationPricing } from "./useQuotationPricing";
const mocks = vi.hoisted(() => ({ canApply: true, reasonRequired: false, preview: vi.fn() }));
vi.mock("./useQuotationDiscountPolicy", () => ({ useQuotationDiscountPolicy: () => ({ policy: { canApply: mocks.canApply, hasApplyPermission: true, canManage: false, configured: mocks.canApply,
  limit: mocks.canApply ? { id: "019f0000-0000-7000-8000-000000000009", version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: mocks.reasonRequired } : null }, retry: vi.fn() }) }));
vi.mock("./useQuotationDiscountLimits", () => ({ useQuotationDiscountLimits: () => ({ setOpen: vi.fn() }) }));
vi.mock("./useQuotationPricingPreview", () => ({ useQuotationPricingPreview: (options: { stale: boolean; enabled: boolean }) => {
  mocks.preview(options);
  return { calculation: !options.stale && options.enabled ? quotationPricingCalculation() : null,
    ready: !options.stale && options.enabled, loading: false, error: null, stale: options.stale, retry: vi.fn() };
} }));
const lines = [{ clientLineId: DISCOUNT_IDS.line, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "1", unitPrice: null, isPricing: false, priceError: null }];
const initialProps = { writeError: null as NormalizedApiError | null };
function setup() {
  return renderHook((props) => {
    const [draft, update] = useState<QuotationDiscountDraft>(() => ({ ...defaultQuotationDiscount(), mode: "DISCOUNT", value: "10" }));
    return useQuotationPricing({ draft, update, headers: DISCOUNT_HEADERS, currencyCode: "EGP", partyId: DISCOUNT_IDS.party,
      contextKey: "a", lines, enabled: true, locked: false, stale: props.writeError?.code === "TRADE.QUOTE.PRICING_CHANGED",
      writeError: props.writeError, clearWriteError: vi.fn() });
  }, { initialProps });
}
beforeEach(() => { mocks.canApply = true; mocks.reasonRequired = false; mocks.preview.mockClear(); });
afterEach(cleanup);
describe("quotation pricing editor save admission", () => {
  it("requires configured server authority for manual pricing", () => {
    mocks.canApply = false; const { result } = setup();
    expect(result.current.ready).toBe(false); expect(mocks.preview.mock.lastCall?.[0].enabled).toBe(false);
  });
  it("previews a permitted discount without a reason and includes the reason if supplied", () => {
    mocks.reasonRequired = true; const { result } = setup();
    expect(result.current.ready).toBe(true);
    expect(result.current.request?.pricing.reason).toBeUndefined();
    act(() => result.current.discount.setReason("Approved exception"));
    expect(result.current.ready).toBe(true); expect(result.current.request?.pricing.reason).toBe("Approved exception");
  });
  it("quarantines an unchanged preview after a save refusal", () => {
    const { result, rerender } = setup(); expect(result.current.ready).toBe(true);
    const refusal = { status: 422, code: "TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED", fieldErrors: { maxDiscountAmount: ["5"] } };
    rerender({ writeError: refusal }); expect(result.current.ready).toBe(false);
    expect(result.current.preview.calculation).toBeNull(); expect(result.current.writeError).toBe(refusal);
  });
  it("does not attach the previous write refusal to changed pricing intent", () => {
    const { result, rerender } = setup();
    const refusal = { status: 409, code: "TRADE.QUOTE.PRICING_CHANGED" };
    rerender({ writeError: refusal }); expect(result.current.ready).toBe(false);
    act(() => result.current.discount.setValue("5"));
    expect(result.current.writeError).toBeNull(); expect(result.current.ready).toBe(true);
  });
});
