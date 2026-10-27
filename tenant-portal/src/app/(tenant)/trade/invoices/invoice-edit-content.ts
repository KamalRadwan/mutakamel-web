import { computeDocumentTotals } from "../documents/document-totals";
import { canonicalizeDecimalInput } from "../documents/fixed-decimal";
import { tradeDecimalError } from "../documents/lib/trade-evidence-validation";
import type { InvoiceDetail, InvoiceDraftLinePayload } from "./invoice-contract";

const AMOUNT_KEYS = ["quantity", "unitPrice", "discountTotal", "chargeTotal", "taxTotal"] as const;
const PRICE_KEYS = ["itemId", "uomId", "quantity", "unitPrice", "discountTotal"] as const;

export function invoiceLineDraft(line: InvoiceDetail["lines"][number]): InvoiceDraftLinePayload {
  return {
    clientLineId: line.clientLineId, itemId: line.itemId, uomId: line.uomId,
    quantity: line.quantity, unitPrice: line.unitPrice, discountTotal: line.discountTotal,
    chargeTotal: line.chargeTotal, taxTotal: line.taxTotal, lineTotal: line.lineTotal,
    priceSnapshot: line.priceSnapshot, taxSnapshot: line.taxSnapshot,
    ...(line.descriptionSnapshot !== null ? { description: line.descriptionSnapshot } : {}),
  };
}

/** Keep opaque evidence on untouched lines, even when another line changes. */
export function invoiceEditFinancialContent(
  invoice: InvoiceDetail,
  drafts: InvoiceDraftLinePayload[],
  roundingTotal: string,
) {
  if (tradeDecimalError(roundingTotal) || drafts.some((line) =>
    AMOUNT_KEYS.some((key) => tradeDecimalError(line[key], key === "quantity")))) return null;
  const originals = new Map(invoice.lines.map((line) => [line.clientLineId, line]));
  const unchanged = (line: InvoiceDraftLinePayload) => {
    const original = originals.get(line.clientLineId);
    return original && [...AMOUNT_KEYS, ...PRICE_KEYS].every((key) => line[key] === original[key]);
  };
  if (drafts.length === invoice.lines.length && drafts.every(unchanged) &&
      roundingTotal === invoice.totalsSnapshot.roundingTotal) {
    return { lines: drafts, totalsSnapshot: invoice.totalsSnapshot };
  }
  const normalized = drafts.map((line) => ({
    ...line,
    ...Object.fromEntries(AMOUNT_KEYS.map((key) => [key, canonicalizeDecimalInput(line[key]) ?? ""])),
  }));
  const outcome = computeDocumentTotals({
    dialect: "FINANCIAL", lines: normalized,
    roundingTotal: canonicalizeDecimalInput(roundingTotal) ?? "",
  });
  if (!outcome.ok) return null;
  if (Object.values(outcome.value.totals).some((value) => tradeDecimalError(value))) return null;
  return {
    totalsSnapshot: outcome.value.totals,
    lines: normalized.map((line, index) => {
      const original = originals.get(line.clientLineId);
      if (unchanged(drafts[index]!)) return drafts[index]!;
      const amounts = outcome.value.lines[index]!;
      const samePrice = original &&
        PRICE_KEYS.every(
          (key) => drafts[index]![key] === original[key],
        );
      return {
        ...line, lineTotal: amounts.lineTotal,
        priceSnapshot: samePrice ? line.priceSnapshot : {
          source: "CATALOG_OR_MANUAL", currencyCode: invoice.currencyCode,
          unitPrice: line.unitPrice, grossAmount: amounts.lineSubtotal,
          discountAmount: line.discountTotal,
        },
        taxSnapshot: {
          currencyCode: invoice.currencyCode, taxAmount: line.taxTotal,
          // Authored tax amounts need no invented percentage or tax category.
        },
      };
    }),
  };
}
