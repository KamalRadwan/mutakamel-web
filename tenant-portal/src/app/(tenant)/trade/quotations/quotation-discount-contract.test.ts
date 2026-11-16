import { describe, expect, it } from "vitest";
import { parseQuotationPricingCalculation, parseQuotationPricingIntent } from "./quotation-discount-contract";
import { DISCOUNT_IDS, quotationPricingCalculation, quotationPricingRequest } from "./quotation-discount.test-fixtures";

describe("authoritative quotation pricing contract", () => {
  it("reads promotions without deducting the separately explained savings twice", () => {
    const parsed = parseQuotationPricingCalculation(quotationPricingCalculation(), quotationPricingRequest());
    expect(parsed.totals).toEqual({ subtotal: "100", discountTotal: "0", grandTotal: "100", baseSubtotal: "120", promotionSavings: "20" });
    expect(parsed.lines[0].priceDecision?.priceBookId).toBe(DISCOUNT_IDS.book);
  });
  it("preserves exact manual amounts, policy identity and advisory unit price", () => {
    const request = quotationPricingRequest({ mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "10", reason: "Approved" });
    const parsed = parseQuotationPricingCalculation(quotationPricingCalculation(request), request);
    expect(parsed.lines[0]).toMatchObject({ unitPrice: "100", netUnitPrice: "90", discountTotal: "10", lineTotal: "90" });
    expect(parsed.limitsSnapshot).toMatchObject({ id: DISCOUNT_IDS.policy, version: 1 });
  });
  it.each([
    { mode: "PROMOTIONS", value: "10" }, { mode: "PROMOTIONS", scope: "LINE" },
    { mode: "DISCOUNT" }, { mode: "DISCOUNT", scope: "LINE", type: "AMOUNT" },
    { mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "100.00000001" },
    { mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "-1" },
  ])("refuses an ambiguous pricing intent %j", (pricing) => expect(() => parseQuotationPricingIntent(pricing)).toThrow());
  it.each([
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.totals.grandTotal = "80"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.totals.discountTotal = "10"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines[0].lineTotal = "99"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines.push({ ...value.lines[0] }); },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines[0].clientLineId = DISCOUNT_IDS.actor; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines[0].itemId = DISCOUNT_IDS.actor; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines[0].quantity = "2"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.lines[0].maxDiscountPercent = "101"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.fingerprint = "unknown"; },
    (value: ReturnType<typeof quotationPricingCalculation>) => { value.currencyDecimalPlaces = 9; },
  ])("quarantines malformed or mismatched financial evidence", (change) => {
    const value = quotationPricingCalculation(); change(value);
    expect(() => parseQuotationPricingCalculation(value, quotationPricingRequest())).toThrow();
  });
  it("does not attach a different mode or manual policy to the current request", () => {
    const value = quotationPricingCalculation();
    expect(() => parseQuotationPricingCalculation(value, quotationPricingRequest({ mode: "DISCOUNT", scope: "LINE" }))).toThrow();
    value.pricing = { mode: "DISCOUNT", scope: "LINE" };
    expect(() => parseQuotationPricingCalculation(value)).toThrow();
  });
  it("parses DOCUMENT x PERCENT and mixed LINE (PERCENT + row-once AMOUNT with qty>=3 + untouched) and enforces positional line order", () => {
    const lineA = DISCOUNT_IDS.line;
    const lineB = "019f0000-0000-7000-8000-000000000015";
    const lineC = "019f0000-0000-7000-8000-000000000016";
    const docPercentReq = quotationPricingRequest({ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "10", reason: "Tier" });
    const docPercentParsed = parseQuotationPricingCalculation(quotationPricingCalculation(docPercentReq), docPercentReq);
    expect(docPercentParsed.pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "10", reason: "Tier" });

    const mixedReq = {
      partyId: DISCOUNT_IDS.party,
      currencyCode: "EGP",
      pricing: { mode: "DISCOUNT" as const, scope: "LINE" as const, reason: "Mixed line deal" },
      lines: [
        { clientLineId: lineA, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "2", priceBookId: DISCOUNT_IDS.book, discount: { type: "PERCENT" as const, value: "5" } },
        { clientLineId: lineB, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "3", discount: { type: "AMOUNT" as const, value: "100" } },
        { clientLineId: lineC, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "1" },
      ],
    };
    const mixedCalc = {
      pricing: mixedReq.pricing,
      currencyDecimalPlaces: 2,
      limitsSnapshot: { id: DISCOUNT_IDS.policy, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
      lines: [
        { clientLineId: lineA, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "2", unitPrice: "1000", baseUnitPrice: "1000", netUnitPrice: "950", subtotal: "2000", discountTotal: "100", lineTotal: "1900", promotionSavings: "0", minimumAllowedPrice: "800", maxDiscountAmount: "400", maxDiscountPercent: "20" },
        { clientLineId: lineB, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "3", unitPrice: "400", baseUnitPrice: "400", netUnitPrice: "366.66666667", subtotal: "1200", discountTotal: "100", lineTotal: "1100", promotionSavings: "0", minimumAllowedPrice: "300", maxDiscountAmount: "240", maxDiscountPercent: "20" },
        { clientLineId: lineC, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "1", unitPrice: "500", baseUnitPrice: "500", netUnitPrice: "500", subtotal: "500", discountTotal: "0", lineTotal: "500", promotionSavings: "0", minimumAllowedPrice: "400", maxDiscountAmount: "100", maxDiscountPercent: "20" },
      ],
      totals: { subtotal: "3700", discountTotal: "200", grandTotal: "3500", baseSubtotal: "3700", promotionSavings: "0" },
      fingerprint: "c".repeat(64),
    };
    const parsedMixed = parseQuotationPricingCalculation(mixedCalc, mixedReq);
    expect(parsedMixed.totals).toEqual({ subtotal: "3700", discountTotal: "200", grandTotal: "3500", baseSubtotal: "3700", promotionSavings: "0" });
    expect(parsedMixed.lines[1]?.netUnitPrice).toBe("366.66666667");

    // Swapping line order with same clientLineId set must be rejected (positional parity).
    const swapped = { ...mixedCalc, lines: [mixedCalc.lines[1]!, mixedCalc.lines[0]!, mixedCalc.lines[2]!] };
    expect(() => parseQuotationPricingCalculation(swapped, mixedReq)).toThrow();
  });
});
