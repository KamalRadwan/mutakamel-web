import { multiplyFixedDecimal, subtractFixedDecimal, sumFixedDecimals } from "../../documents/fixed-decimal";
import type { QuotationPricingCalculation, QuotationPricingRequest } from "../quotation-discount-contract";

export function parseQuotationPricingRequestMock(
  req: QuotationPricingRequest,
  limitId: string,
): QuotationPricingCalculation {
  const lines = req.lines.map((line, index) => {
    const baseUnitPrice = index === 0 ? "17400.00" : "4200.00";
    const subtotal = multiplyFixedDecimal(line.quantity, baseUnitPrice);
    let discountTotal = "0.00";
    if (req.pricing.mode === "DISCOUNT" && req.pricing.scope === "LINE" && line.discount) {
      discountTotal = line.discount.type === "PERCENT"
        ? multiplyFixedDecimal(subtotal, "0.05")
        : line.discount.value;
    } else if (req.pricing.mode === "DISCOUNT" && req.pricing.scope === "DOCUMENT" && req.pricing.value) {
      discountTotal = req.pricing.type === "PERCENT"
        ? multiplyFixedDecimal(subtotal, "0.10")
        : index === 0 ? req.pricing.value : "0.00";
    }
    const lineTotal = subtractFixedDecimal(subtotal, discountTotal);
    return {
      clientLineId: line.clientLineId,
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: line.quantity,
      unitPrice: baseUnitPrice,
      baseUnitPrice,
      netUnitPrice: baseUnitPrice,
      subtotal,
      discountTotal,
      lineTotal,
      promotionSavings: "0.00",
      minimumAllowedPrice: "100.00",
      maxDiscountAmount: "5000.00",
      maxDiscountPercent: "20",
    };
  });
  const subtotal = sumFixedDecimals(lines.map((l) => l.subtotal));
  const discountTotal = sumFixedDecimals(lines.map((l) => l.discountTotal));
  const grandTotal = subtractFixedDecimal(subtotal, discountTotal);
  return {
    pricing: req.pricing,
    currencyDecimalPlaces: 2,
    limitsSnapshot: req.pricing.mode === "DISCOUNT"
      ? { id: limitId, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true }
      : null,
    lines,
    totals: {
      subtotal,
      discountTotal,
      grandTotal,
      baseSubtotal: subtotal,
      promotionSavings: "0.00",
    },
    fingerprint: "b".repeat(64),
  };
}
