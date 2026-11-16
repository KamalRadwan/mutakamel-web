import { addFixedDecimal, canonicalizeDecimalInput, compareFixedDecimal, POSITIVE_DECIMAL, subtractFixedDecimal } from "../documents/fixed-decimal";
import { itemDisplayName, type TradeItemOption } from "../documents/trade-lookup-contract";
import { canonicalTradeQuantity } from "../documents/trade-line-validation";

export function quotationSecondaryItemName(item: TradeItemOption, language: string): string | null {
  const primary = itemDisplayName(item, language);
  for (const key of ["en", "ar"]) {
    const value = item.localizedNames[key];
    if (typeof value === "string" && value.trim() && value.trim() !== primary) return value.trim();
  }
  return null;
}

export function stepQuotationQuantity(value: string, direction: 1 | -1): string {
  const current = canonicalizeDecimalInput(value);
  if (!current || !POSITIVE_DECIMAL.test(current)) return "1";
  const next = direction === 1 ? addFixedDecimal(current, "1") : subtractFixedDecimal(current, "1");
  return compareFixedDecimal(next, "0") > 0 && canonicalTradeQuantity(next) !== null ? next : current;
}
