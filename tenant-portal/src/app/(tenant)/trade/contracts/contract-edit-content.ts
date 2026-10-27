import { addFixedDecimal, canonicalizeDecimalInput, subtractFixedDecimal } from "../documents/fixed-decimal";
import { isTradeDecimal } from "../documents/trade-document-contract";
import { tradeDecimalError } from "../documents/lib/trade-evidence-validation";
import type { FinancialTotals } from "../documents/financial-totals";

const EDITABLE_TOTAL_KEYS = ["subtotal", "discountTotal", "chargeTotal", "taxTotal", "roundingTotal"] as const;

export function contractEditedTotals(
  totals: FinancialTotals,
  original?: FinancialTotals,
): FinancialTotals | null {
  const amounts = EDITABLE_TOTAL_KEYS.map((key) => canonicalizeDecimalInput(totals[key]));
  if (amounts.some((amount) => amount === null || tradeDecimalError(amount))) return null;
  // Restoring an amount or changing only its formatting must retain stored evidence.
  if (original && EDITABLE_TOTAL_KEYS.every(
    (key, index) => amounts[index] === canonicalizeDecimalInput(original[key]),
  )) return original;
  const [subtotal, discount, charge, tax, rounding] = amounts as string[];
  const grandTotal = addFixedDecimal(addFixedDecimal(addFixedDecimal(
    subtractFixedDecimal(subtotal!, discount!), charge!), tax!), rounding!);
  if (!isTradeDecimal(grandTotal) || tradeDecimalError(grandTotal)) return null;
  return { ...totals, subtotal: subtotal!, discountTotal: discount!, chargeTotal: charge!,
    taxTotal: tax!, roundingTotal: rounding!, grandTotal, amountPaid: "0", amountDue: grandTotal };
}
