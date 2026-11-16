import type { QuotationPricingCalculation, QuotationPricingIntent, QuotationPricingRequest } from "./quotation-discount-contract";

export const DISCOUNT_IDS = {
  actor: "019f0000-0000-7000-8000-000000000001", party: "019f0000-0000-7000-8000-000000000002",
  company: "019f0000-0000-7000-8000-000000000003", branch: "019f0000-0000-7000-8000-000000000004",
  line: "019f0000-0000-7000-8000-000000000005", item: "019f0000-0000-7000-8000-000000000006",
  uom: "019f0000-0000-7000-8000-000000000007", book: "019f0000-0000-7000-8000-000000000008",
  policy: "019f0000-0000-7000-8000-000000000009",
};
export const DISCOUNT_HEADERS = { "x-mutakamel-company-id": DISCOUNT_IDS.company, "x-mutakamel-branch-id": DISCOUNT_IDS.branch };
export function quotationPricingRequest(pricing: QuotationPricingIntent = { mode: "PROMOTIONS" }): QuotationPricingRequest {
  return { partyId: DISCOUNT_IDS.party, currencyCode: "EGP", pricing,
    lines: [{ clientLineId: DISCOUNT_IDS.line, itemId: DISCOUNT_IDS.item, uomId: DISCOUNT_IDS.uom, quantity: "1" }] };
}
export function quotationPricingCalculation(request = quotationPricingRequest()): QuotationPricingCalculation {
  const manual = request.pricing.mode === "DISCOUNT";
  const discount = manual ? "10" : "0";
  return {
    pricing: request.pricing, currencyDecimalPlaces: 2,
    limitsSnapshot: manual ? { id: DISCOUNT_IDS.policy, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true } : null,
    lines: [{ ...request.lines[0], unitPrice: "100", baseUnitPrice: manual ? "100" : "120", netUnitPrice: manual ? "90" : "100",
      subtotal: "100", discountTotal: discount, lineTotal: manual ? "90" : "100", promotionSavings: manual ? "0" : "20",
      minimumAllowedPrice: "80", maxDiscountAmount: "20", maxDiscountPercent: "20",
      priceDecision: { unitPrice: "100", currencyCode: request.currencyCode, priceBookId: DISCOUNT_IDS.book, minimumAllowedPrice: "80" } }],
    totals: { subtotal: "100", discountTotal: discount, grandTotal: manual ? "90" : "100", baseSubtotal: manual ? "100" : "120", promotionSavings: manual ? "0" : "20" },
    fingerprint: "a".repeat(64),
  };
}
