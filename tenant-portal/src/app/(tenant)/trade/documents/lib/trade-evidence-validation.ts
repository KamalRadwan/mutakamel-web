import { canonicalizeDecimalInput, compareFixedDecimal } from "../fixed-decimal";
import type { TradeEvidenceDialect, TradeEvidenceLineDraft } from "./trade-financial-evidence";

export interface TradeEvidenceError {
  field: keyof TradeEvidenceLineDraft | "roundingTotal" | "amountPaid" | "calculation";
  lineIndex?: number;
  message: "decimalInvalid" | "quantityInvalid" | "taxRateInvalid" | "calculationInvalid";
}

export function tradeDecimalError(raw: string, positive = false, signed = false): "decimalInvalid" | "quantityInvalid" | undefined {
  const value = canonicalizeDecimalInput(raw);
  if (value === null || (!signed && value.startsWith("-")) ||
    compareFixedDecimal(value, "10000000000000000") >= 0 ||
    compareFixedDecimal(value, "-10000000000000000") <= 0) return "decimalInvalid";
  return positive && value === "0" ? "quantityInvalid" : undefined;
}

export function validateTradeEvidence(
  lines: TradeEvidenceLineDraft[],
  options: { dialect: TradeEvidenceDialect; roundingTotal?: string; amountPaid?: string },
): TradeEvidenceError[] {
  const errors: TradeEvidenceError[] = [];
  function decimal(raw: string, field: TradeEvidenceError["field"], lineIndex?: number, signed = false) {
    const message = tradeDecimalError(raw, field === "quantity", signed);
    if (message) errors.push({ field, lineIndex, message });
  }
  lines.forEach((line, lineIndex) => {
    decimal(line.quantity, "quantity", lineIndex);
    decimal(line.unitPrice, "unitPrice", lineIndex);
    decimal(line.discountAmount, "discountAmount", lineIndex);
    if (options.dialect === "FINANCIAL") decimal(line.chargeAmount, "chargeAmount", lineIndex);
    const rate = canonicalizeDecimalInput(line.taxRatePercent);
    // Tax snapshots use integer basis points (0..10000), not rounded rates.
    if (rate === null || rate.startsWith("-") || compareFixedDecimal(rate, "100") > 0 ||
      (rate.split(".")[1]?.length ?? 0) > 2) {
      errors.push({ field: "taxRatePercent", lineIndex, message: "taxRateInvalid" });
    }
  });
  decimal(options.roundingTotal ?? "0", "roundingTotal", undefined, options.dialect === "ORDER");
  if (options.dialect === "ORDER") decimal(options.amountPaid ?? "0", "amountPaid");
  return errors;
}
