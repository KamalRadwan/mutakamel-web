import { generateUUIDv7 } from "@/lib/uuid";
import {
  DECIMAL_ZERO,
  addFixedDecimal,
  canonicalizeDecimalInput,
  compareFixedDecimal,
  multiplyFixedDecimal,
  subtractFixedDecimal,
} from "../fixed-decimal";
import { computeDocumentTotals } from "../document-totals";
import { validateTradeEvidence, type TradeEvidenceError } from "./trade-evidence-validation";

export type TradeEvidenceDialect = "ORDER" | "FINANCIAL";

export interface TradeEvidenceLineDraft {
  id: string;
  itemId: string;
  itemCode?: string;
  description: string;
  uomCode: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  chargeAmount: string;
  taxCode: string;
  taxRatePercent: string;
}

interface ComputedTradeEvidenceLine {
  lineNumber: number;
  clientLineId: string;
  itemId: string;
  itemCode?: string;
  description: string;
  uomCode: string;
  quantity: string;
  unitPrice: string;
  grossAmount: string;
  discountAmount: string;
  chargeAmount: string;
  taxableAmount: string;
  taxRateBps: number;
  taxAmount: string;
  lineTotal: string;
  taxSnapshot: Record<string, unknown>;
  priceSnapshot: Record<string, unknown>;
}

export interface ComputedTradeDocumentTotals {
  lines: ComputedTradeEvidenceLine[];
  subtotal: string;
  discountTotal: string;
  chargeTotal: string;
  taxTotal: string;
  roundingTotal: string;
  grandTotal: string;
  amountPaid: string;
  amountDue: string;
}

export type TradeEvidenceOutcome =
  | (ComputedTradeDocumentTotals & { ok: true; errors: TradeEvidenceError[] })
  | { ok: false; errors: TradeEvidenceError[] };

export function computeTradeEvidence(
  drafts: TradeEvidenceLineDraft[],
  options: {
    dialect: TradeEvidenceDialect;
    currencyCode: string;
    roundingTotal?: string;
    amountPaid?: string;
  },
): TradeEvidenceOutcome {
  const errors = validateTradeEvidence(drafts, options);
  if (errors.length) return { ok: false, errors };
  const currency = options.currencyCode.trim().toUpperCase() || "SAR";

  const preparedLines = drafts.map((line, idx) => {
    const quantity = canonicalizeDecimalInput(line.quantity)!;
    const unitPrice = canonicalizeDecimalInput(line.unitPrice)!;
    const grossAmount = multiplyFixedDecimal(quantity, unitPrice);
    const rawDiscount = canonicalizeDecimalInput(line.discountAmount)!;
    const discountAmount = rawDiscount;
    const chargeAmount =
      options.dialect === "FINANCIAL"
        ? canonicalizeDecimalInput(line.chargeAmount)!
        : DECIMAL_ZERO;

    const afterDiscount = subtractFixedDecimal(grossAmount, discountAmount);
    const taxableAmount =
      options.dialect === "FINANCIAL"
        ? addFixedDecimal(afterDiscount, chargeAmount)
        : afterDiscount;

    const rate = canonicalizeDecimalInput(line.taxRatePercent)!;
    const taxRateBps = Number.parseInt(multiplyFixedDecimal(rate, "100"), 10);
    const rateFraction = multiplyFixedDecimal(rate, "0.01");
    const taxAmount = multiplyFixedDecimal(taxableAmount, rateFraction);
    const lineTotal = addFixedDecimal(taxableAmount, taxAmount);

    const taxCode = (line.taxCode || "VAT-15").trim() || "VAT-15";
    const category =
      taxRateBps === 0
        ? taxCode.toUpperCase().includes("EXEMPT")
          ? "EXEMPT"
          : "ZERO"
        : "STANDARD";

    return {
      lineNumber: idx + 1,
      clientLineId: line.id,
      itemId: line.itemId.trim(),
      ...(line.itemCode?.trim() ? { itemCode: line.itemCode.trim() } : {}),
      description: line.description.trim(),
      uomCode: line.uomCode.trim(),
      quantity,
      unitPrice,
      grossAmount,
      discountAmount,
      chargeAmount,
      taxableAmount,
      taxRateBps,
      taxAmount,
      lineTotal,
      taxSnapshot: {
        taxCode,
        category,
        rateBps: taxRateBps,
        ratePercent: taxRateBps / 100,
        taxableBase: taxableAmount,
        taxAmount,
        currencyCode: currency,
      },
      priceSnapshot: {
        source: "CATALOG_OR_MANUAL",
        currencyCode: currency,
        unitPrice,
        grossAmount,
        discountAmount,
      },
    };
  });

  const invalidDiscountIndex = preparedLines.findIndex((line) =>
    compareFixedDecimal(line.discountAmount, line.grossAmount) > 0);
  if (invalidDiscountIndex >= 0) {
    return { ok: false, errors: [{ field: "discountAmount", lineIndex: invalidDiscountIndex, message: "calculationInvalid" }] };
  }

  const roundingTotal = canonicalizeDecimalInput(options.roundingTotal ?? "0")!;

  const amountPaid =
    options.dialect === "ORDER"
      ? canonicalizeDecimalInput(options.amountPaid ?? "0")!
      : DECIMAL_ZERO;

  const outcome = computeDocumentTotals(
    options.dialect === "ORDER"
      ? {
          dialect: "ORDER",
          roundingTotal,
          amountPaid,
          lines: preparedLines.map((l) => ({
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountTotal: l.discountAmount,
            chargeTotal: l.chargeAmount,
            taxTotal: l.taxAmount,
          })),
        }
      : {
          dialect: "FINANCIAL",
          roundingTotal,
          lines: preparedLines.map((l) => ({
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountTotal: l.discountAmount,
            chargeTotal: l.chargeAmount,
            taxTotal: l.taxAmount,
          })),
        },
  );

  if (outcome.ok) {
    // Match the numeric(24,8) storage domain for calculated amounts too.
    const amounts = [
      ...preparedLines.flatMap((line) => [line.grossAmount, line.taxableAmount, line.taxAmount, line.lineTotal]),
      ...Object.entries(outcome.value.totals).filter(([key]) => key !== "roundingTotal").map(([, value]) => value),
    ];
    if (amounts.some((amount) => compareFixedDecimal(amount, "0") < 0 || compareFixedDecimal(amount, "10000000000000000") >= 0)) {
      return { ok: false, errors: [{ field: "calculation", message: "calculationInvalid" }] };
    }
    return {
      ok: true,
      errors: [],
      lines: preparedLines.map((l, i) => ({
        ...l,
        grossAmount: outcome.value.lines[i]?.lineSubtotal ?? l.grossAmount,
        lineTotal: outcome.value.lines[i]?.lineTotal ?? l.lineTotal,
      })),
      ...outcome.value.totals,
    };
  }

  return {
    ok: false,
    errors: [{ field: outcome.rejection === "LINE_DISCOUNT_EXCEEDS_SUBTOTAL" ? "discountAmount" : "calculation", lineIndex: outcome.lineIndex, message: "calculationInvalid" }],
  };
}

export function createEmptyEvidenceLineDraft(): TradeEvidenceLineDraft {
  return {
    id: generateUUIDv7(),
    itemId: "",
    itemCode: "",
    description: "",
    uomCode: "",
    quantity: "1",
    unitPrice: "0",
    discountAmount: "0",
    chargeAmount: "0",
    taxCode: "VAT-15",
    taxRatePercent: "15",
  };
}

export function buildZeroFinancialTotals() {
  return {
    subtotal: DECIMAL_ZERO,
    discountTotal: DECIMAL_ZERO,
    chargeTotal: DECIMAL_ZERO,
    taxTotal: DECIMAL_ZERO,
    roundingTotal: DECIMAL_ZERO,
    grandTotal: DECIMAL_ZERO,
    amountPaid: DECIMAL_ZERO,
    amountDue: DECIMAL_ZERO,
  };
}
