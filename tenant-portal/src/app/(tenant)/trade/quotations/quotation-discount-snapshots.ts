import { compareFixedDecimal, multiplyFixedDecimal, subtractFixedDecimal } from "../documents/fixed-decimal";
import { isTradeDecimal, record, tradeInvalidResponse } from "../documents/trade-document-contract";
import { parseQuotationPricingIntent, parseQuotationPricingTotals, type QuotationPricingMode,
  type QuotationPricingTotals, type QuotationPricingIntent } from "./quotation-discount-contract";

export interface QuotationSavedPricing {
  pricing: QuotationPricingIntent; totals: QuotationPricingTotals;
}
export function parseQuotationRevisionDiscount(row: Record<string, unknown>, grandTotal: string) {
  if (!isTradeDecimal(row.subtotal) || !isTradeDecimal(row.discountTotal)
    || (row.pricingMode !== "NONE" && row.pricingMode !== "PROMOTIONS" && row.pricingMode !== "DISCOUNT")
    || !record(row.discountSnapshot) || compareFixedDecimal(row.discountTotal, row.subtotal) > 0
    || compareFixedDecimal(subtractFixedDecimal(row.subtotal, row.discountTotal), grandTotal) !== 0) tradeInvalidResponse();
  const discountSnapshot = record(row.discountSnapshot)!;
  if (Object.keys(discountSnapshot).length > 0) {
    const saved = readQuotationSavedPricing(discountSnapshot);
    if (!saved || saved.pricing.mode !== row.pricingMode
      || compareFixedDecimal(saved.totals.subtotal, row.subtotal) !== 0
      || compareFixedDecimal(saved.totals.discountTotal, row.discountTotal) !== 0
      || compareFixedDecimal(saved.totals.grandTotal, grandTotal) !== 0) tradeInvalidResponse();
  }
  return { subtotal: row.subtotal, discountTotal: row.discountTotal, pricingMode: row.pricingMode as QuotationPricingMode, discountSnapshot };
}
export function parseQuotationLineDiscount(row: Record<string, unknown>, quantity: string, unitPrice: string, lineTotal: string) {
  if (!isTradeDecimal(row.discountTotal) || !record(row.discountSnapshot)) tradeInvalidResponse();
  const gross = multiplyFixedDecimal(quantity, unitPrice);
  if (compareFixedDecimal(row.discountTotal, gross) > 0 || compareFixedDecimal(subtractFixedDecimal(gross, row.discountTotal), lineTotal) !== 0) tradeInvalidResponse();
  return { discountTotal: row.discountTotal, discountSnapshot: record(row.discountSnapshot)! };
}
export function readQuotationSavedPricing(snapshot: Record<string, unknown>): QuotationSavedPricing | null {
  if (Object.keys(snapshot).length === 0) return null;
  return { pricing: parseQuotationPricingIntent(snapshot.pricing), totals: parseQuotationPricingTotals(snapshot.totals) };
}
