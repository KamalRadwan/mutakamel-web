import { describe, expect, it } from "vitest";
import { buildQuotationPricingRequest, defaultQuotationDiscount, discountValue, resetQuotationFixedDiscounts } from "./quotation-discount-draft";
import { DISCOUNT_IDS } from "./quotation-discount.test-fixtures";

const line = () => ({ clientLineId: DISCOUNT_IDS.line, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "2", unitPrice: null, isPricing: false, priceError: null });
describe("quotation discount intent serialization", () => {
  it.each(["NONE", "PROMOTIONS"] as const)("sends %s intent and excludes inactive manual values", (mode) => {
    const draft = { ...defaultQuotationDiscount(), mode, value: "25", reason: "Old manual value", lineDiscounts: { [DISCOUNT_IDS.line]: { type: "AMOUNT" as const, value: "4" } } };
    const request = buildQuotationPricingRequest(draft, [line()], DISCOUNT_IDS.party, "EGP");
    expect(request?.pricing).toEqual({ mode });
    expect(request?.lines[0]).not.toHaveProperty("discount");
  });
  it("keeps whole-line fixed amounts distinct from a document amount", () => {
    const draft = { ...defaultQuotationDiscount(), mode: "DISCOUNT" as const, scope: "LINE" as const, reason: " Approved ",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "AMOUNT" as const, value: "10.00" } } };
    const request = buildQuotationPricingRequest(draft, [line()], DISCOUNT_IDS.party, "EGP");
    expect(request?.pricing).toEqual({ mode: "DISCOUNT", scope: "LINE", reason: "Approved" });
    expect(request?.lines[0]).toMatchObject({ quantity: "2", discount: { type: "AMOUNT", value: "10" } });
  });
  it.each(["-1", "1e2", "Infinity", "100.00000001", "", "9".repeat(41)])("refuses invalid percentages %s", (value) => expect(discountValue(value, "PERCENT")).toBeNull());
  it("preserves very large decimal-string amounts without floating point", () => expect(discountValue("9007199254740993.01", "AMOUNT")).toBe("9007199254740993.01"));
  it("refuses incomplete, duplicate or foreign line identities", () => {
    expect(buildQuotationPricingRequest(defaultQuotationDiscount(), [line(), line()], DISCOUNT_IDS.party, "EGP")).toBeNull();
    expect(buildQuotationPricingRequest(defaultQuotationDiscount(), [{ ...line(), quantity: "0" }], DISCOUNT_IDS.party, "EGP")).toBeNull();
    expect(buildQuotationPricingRequest(defaultQuotationDiscount(), [line()], "customer", "EGP")).toBeNull();
  });
  it("clears fixed amounts after changing currency while retaining percentage intent", () => {
    const draft = { ...defaultQuotationDiscount(), mode: "DISCOUNT" as const, type: "AMOUNT" as const, value: "10",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "AMOUNT" as const, value: "4" }, [DISCOUNT_IDS.actor]: { type: "PERCENT" as const, value: "5" } } };
    expect(resetQuotationFixedDiscounts(draft)).toMatchObject({ value: "", lineDiscounts: { [DISCOUNT_IDS.line]: { value: "" }, [DISCOUNT_IDS.actor]: { value: "5" } } });
  });
});
