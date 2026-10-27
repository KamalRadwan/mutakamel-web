import { isUUIDv7 } from "@/lib/uuid";
import { computeDocumentTotals } from "../documents/document-totals";
import {
  addFixedDecimal,
  canonicalizeDecimalInput,
  compareFixedDecimal,
  fixedDecimalText,
  fixedDecimalUnits,
  multiplyFixedDecimal,
  subtractFixedDecimal,
} from "../documents/fixed-decimal";
import type { QuotationDetail } from "./quotation-contract";

export interface QuotationConversionEvidenceDraft {
  clientLineId: string;
  discountTotal: string;
  chargeTotal: string;
  taxCode: string;
  category: string;
  ratePercent: string;
}

export interface ConvertQuotationRequest {
  lines: {
    clientLineId: string;
    financial: {
      discountTotal: string;
      chargeTotal: string;
      taxTotal: string;
      lineTotal: string;
      taxSnapshot: Record<string, unknown>;
    };
  }[];
  totals: {
    subtotal: string;
    discountTotal: string;
    chargeTotal: string;
    taxTotal: string;
    roundingTotal: string;
    grandTotal: string;
    amountPaid: string;
    amountDue: string;
  };
  terms: Record<string, unknown>;
}

function invalidEvidence(): never {
  throw new Error("QUOTATION_CONVERSION_EVIDENCE");
}

function nonNegative(raw: string): string {
  const value = canonicalizeDecimalInput(raw);
  if (value === null || value.startsWith("-")) invalidEvidence();
  return value;
}

/** ConvertQuotationDto: accepted prices stay on the server; only legal evidence is sent. */
export function buildConvertQuotationToSalesOrder(
  quotation: QuotationDetail,
  evidence: readonly QuotationConversionEvidenceDraft[],
): ConvertQuotationRequest {
  const revision = quotation.revisions.find((r) => r.id === quotation.acceptedRevisionId);
  // GET detail exposes currentLines, so they are usable only for the accepted current revision.
  // documents.service.ts/assertQuotationConversionEvidence also requires non-empty, unchanged terms.
  if (
    quotation.lifecycleStatus !== "ACCEPTED" ||
    !revision || revision.status !== "ACCEPTED" ||
    quotation.acceptedRevisionId !== quotation.currentRevisionId ||
    Object.keys(revision.termsSnapshot).length === 0 ||
    quotation.currentLines.length === 0 || quotation.currentLines.length > 1_000
  ) {
    throw new Error("QUOTATION_CONVERSION_SOURCE");
  }
  const byId = new Map(evidence.map((line) => [line.clientLineId, line]));
  const sourceIds = new Set(quotation.currentLines.map((line) => line.clientLineId));
  if (
    evidence.length !== quotation.currentLines.length || byId.size !== evidence.length ||
    sourceIds.size !== quotation.currentLines.length
  ) invalidEvidence();

  const prepared = quotation.currentLines.map((line) => {
    const draft = byId.get(line.clientLineId);
    if (!draft || !isUUIDv7(line.clientLineId)) invalidEvidence();
    const quantity = nonNegative(line.quantity);
    const unitPrice = nonNegative(line.unitPrice);
    if (quantity === "0") invalidEvidence();
    const discountTotal = nonNegative(draft.discountTotal);
    const chargeTotal = nonNegative(draft.chargeTotal);
    const rate = nonNegative(draft.ratePercent);
    const taxCode = draft.taxCode.trim();
    // Use the portal's existing STANDARD/ZERO/EXEMPT snapshot vocabulary.
    // A tax code never chooses its own category or rate.
    if (
      !taxCode || taxCode.length > 120 ||
      !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u.test(rate) ||
      compareFixedDecimal(rate, "100") > 0 ||
      !["STANDARD", "ZERO", "EXEMPT"].includes(draft.category) ||
      (draft.category === "STANDARD" ? rate === "0" : rate !== "0")
    ) invalidEvidence();
    const subtotal = multiplyFixedDecimal(quantity, unitPrice);
    if (compareFixedDecimal(discountTotal, subtotal) > 0) invalidEvidence();
    const taxableBase = addFixedDecimal(subtractFixedDecimal(subtotal, discountTotal), chargeTotal);
    // Percent / 100 stays exact at this input precision; multiplication uses Trade's half-up scale.
    const rateFraction = fixedDecimalText(fixedDecimalUnits(rate) / BigInt(100));
    const taxTotal = multiplyFixedDecimal(taxableBase, rateFraction);
    return {
      quantity,
      unitPrice,
      discountTotal,
      chargeTotal,
      taxTotal,
      clientLineId: line.clientLineId,
      taxSnapshot: {
        taxCode,
        category: draft.category,
        // Only bounded rate metadata uses Number; all amounts and rate arithmetic stay exact.
        rateBps: Number(fixedDecimalUnits(rate)) / 1_000_000,
        taxableBase,
        taxAmount: taxTotal,
        currencyCode: quotation.currencyCode,
      },
    };
  });
  const result = computeDocumentTotals({
    dialect: "ORDER",
    lines: prepared,
    roundingTotal: "0",
    amountPaid: "0",
  });
  if (!result.ok) invalidEvidence();
  if (compareFixedDecimal(result.value.totals.subtotal, revision.grandTotal) !== 0) {
    throw new Error("QUOTATION_CONVERSION_SOURCE");
  }
  // Construct every nested object explicitly: no itemId, uomId, quantity or UI state can leak.
  return {
    lines: prepared.map((line, index) => ({
      clientLineId: line.clientLineId,
      financial: {
        discountTotal: line.discountTotal,
        chargeTotal: line.chargeTotal,
        taxTotal: line.taxTotal,
        lineTotal: result.value.lines[index]?.lineTotal ?? invalidEvidence(),
        taxSnapshot: line.taxSnapshot,
      },
    })),
    totals: { ...result.value.totals },
    terms: { ...revision.termsSnapshot },
  };
}
