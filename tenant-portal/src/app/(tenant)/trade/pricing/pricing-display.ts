import {
  compareFixedDecimal,
  multiplyFixedDecimal,
  subtractFixedDecimal,
} from "../documents/fixed-decimal";

export function pricingDisplayTotals(
  baselineUnitPrice: string,
  unitPrice: string,
  quantity: string,
) {
  const discount = subtractFixedDecimal(baselineUnitPrice, unitPrice);
  return {
    subtotal: multiplyFixedDecimal(unitPrice, quantity),
    savings: compareFixedDecimal(discount, "0") > 0
      ? multiplyFixedDecimal(discount, quantity)
      : "0",
  };
}
