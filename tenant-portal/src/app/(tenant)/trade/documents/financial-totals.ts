import { isTradeDecimal, record, tradeInvalidResponse } from "./trade-document-contract";

export const FINANCIAL_TOTAL_KEYS = [
  "subtotal", "discountTotal", "chargeTotal", "taxTotal", "roundingTotal",
  "grandTotal", "amountPaid", "amountDue",
] as const;

export type FinancialTotals = Record<(typeof FINANCIAL_TOTAL_KEYS)[number], string>;

/** FinancialTotalsDto requires all eight values; missing evidence is never zero. */
export function parseFinancialTotals(value: unknown): FinancialTotals {
  const row = record(value);
  if (!row) tradeInvalidResponse();
  const totals = {} as FinancialTotals;
  for (const key of FINANCIAL_TOTAL_KEYS) {
    const amount = row[key];
    if (!isTradeDecimal(amount)) tradeInvalidResponse();
    totals[key] = amount;
  }
  return totals;
}
