import { generateUUIDv7 } from "@/lib/uuid";
import {
  DECIMAL_ZERO,
  addFixedDecimal,
  canonicalizeDecimalInput,
  multiplyFixedDecimal,
  subtractFixedDecimal,
} from "../fixed-decimal";
import { computeDocumentTotals } from "../document-totals";

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

export interface ComputedTradeEvidenceLine {
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

function safeCanonicalNonNegative(raw: string | undefined): string {
  const canonical = canonicalizeDecimalInput(raw ?? "0");
  if (!canonical || canonical.startsWith("-")) return DECIMAL_ZERO;
  return canonical;
}

function safeCanonicalPositive(raw: string | undefined): string {
  const canonical = canonicalizeDecimalInput(raw ?? "1");
  if (!canonical || canonical === "0" || canonical.startsWith("-")) return "1";
  return canonical;
}

export function computeTradeEvidence(
  drafts: TradeEvidenceLineDraft[],
  options: {
    dialect: TradeEvidenceDialect;
    currencyCode: string;
    roundingTotal?: string;
    amountPaid?: string;
  },
): ComputedTradeDocumentTotals {
  const currency = options.currencyCode.trim().toUpperCase() || "SAR";

  const preparedLines = drafts.map((line, idx) => {
    const quantity = safeCanonicalPositive(line.quantity);
    const unitPrice = safeCanonicalNonNegative(line.unitPrice);
    const grossAmount = multiplyFixedDecimal(quantity, unitPrice);
    const rawDiscount = safeCanonicalNonNegative(line.discountAmount);
    const discountAmount = rawDiscount;
    const chargeAmount =
      options.dialect === "FINANCIAL"
        ? safeCanonicalNonNegative(line.chargeAmount)
        : DECIMAL_ZERO;

    const afterDiscount = subtractFixedDecimal(grossAmount, discountAmount);
    const safeAfterDiscount = afterDiscount.startsWith("-")
      ? DECIMAL_ZERO
      : afterDiscount;
    const taxableAmount =
      options.dialect === "FINANCIAL"
        ? addFixedDecimal(safeAfterDiscount, chargeAmount)
        : safeAfterDiscount;

    const rateNum = Number.parseFloat(line.taxRatePercent || "0");
    const safeRatePercent =
      Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100 ? rateNum : 0;
    const taxRateBps = Math.round(safeRatePercent * 100);
    const rateFraction =
      canonicalizeDecimalInput(String(safeRatePercent / 100)) ?? DECIMAL_ZERO;
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
        ratePercent: safeRatePercent,
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

  const roundingTotal =
    options.dialect === "FINANCIAL"
      ? safeCanonicalNonNegative(options.roundingTotal)
      : (canonicalizeDecimalInput(options.roundingTotal ?? "0") ?? DECIMAL_ZERO);

  const amountPaid =
    options.dialect === "ORDER"
      ? safeCanonicalNonNegative(options.amountPaid)
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
    return {
      lines: preparedLines.map((l, i) => ({
        ...l,
        grossAmount: outcome.value.lines[i]?.lineSubtotal ?? l.grossAmount,
        lineTotal: outcome.value.lines[i]?.lineTotal ?? l.lineTotal,
      })),
      ...outcome.value.totals,
    };
  }

  return {
    lines: preparedLines,
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
