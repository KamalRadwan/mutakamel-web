import {
  DECIMAL_ZERO,
  NON_NEGATIVE_DECIMAL,
  POSITIVE_DECIMAL,
  SIGNED_DECIMAL,
  addFixedDecimal,
  compareFixedDecimal,
  isCanonicalDecimal,
  multiplyFixedDecimal,
  subtractFixedDecimal,
  sumFixedDecimals,
} from "./fixed-decimal";

// MASTER-PLAN 11.20, corrected: Trade does not compute totals for the caller.
// The browser computes them, the server recomputes them and refuses on any
// disagreement. Two families disagree about the arithmetic, so there are two
// dialects here rather than one — merging them would make one of the two
// wrong.
//
//   ORDER dialect  — sales orders, purchase orders, quotation conversion.
//     trade-app/src/modules/documents/order-print-snapshot.service.ts,
//     `validateNewOrderFinancialEvidence`
//       subtotal      = Σ (quantity × unitPrice)
//       grandTotal    = Σ lineTotal + roundingTotal      (roundingTotal SIGNED)
//       amountDue     = grandTotal − amountPaid          (amountPaid is free)
//       and `parseTotals` additionally refuses subtotal < discountTotal.
//     Compared with `compareFixedDecimal`, so a padded string still passes.
//
//   FINANCIAL dialect — invoices and contracts.
//     trade-app/src/modules/financial-documents/financial-documents.service.ts,
//     `validateInvoiceTotals` / `assertContractFinancialTerms`
//       grandTotal    = subtotal − discountTotal + chargeTotal + taxTotal
//                       + roundingTotal                  (roundingTotal NON-NEGATIVE)
//       amountPaid    MUST be exactly "0"
//       amountDue     = grandTotal
//     Compared with `!==` on the raw strings, so the canonical form is
//     mandatory — see fixed-decimal.ts.
//
// Trade has no payment-settlement source at all (there is no `settlement_status`
// column anywhere in trade-app, and `financial-documents.service.spec.ts` names
// the rule: "rejects paid amounts because Trade has no payment-settlement
// source"). That is why `amountPaid` is pinned to zero on this side.

interface DocumentTotals {
  subtotal: string;
  discountTotal: string;
  chargeTotal: string;
  taxTotal: string;
  roundingTotal: string;
  grandTotal: string;
  amountPaid: string;
  amountDue: string;
}

/** One line's authored evidence, before the snapshot objects are attached. */
export interface LineAmounts {
  quantity: string;
  unitPrice: string;
  discountTotal: string;
  chargeTotal: string;
  taxTotal: string;
}

interface ComputedLine extends LineAmounts {
  /** quantity × unitPrice, half-up at 8 dp. */
  lineSubtotal: string;
  /** lineSubtotal − discountTotal + chargeTotal + taxTotal. */
  lineTotal: string;
}

/**
 * Why a set of figures would be refused, decided **here** rather than read off
 * a 422.
 *
 * The server answers every one of these with the same code, the same status
 * and no field (Q33), so the only way a user can be told which line is wrong
 * is for the browser to reach the same verdict first.
 */
type TotalsRejection =
  | "LINE_AMOUNT_MALFORMED"
  | "LINE_QUANTITY_INVALID"
  | "LINE_DISCOUNT_EXCEEDS_SUBTOTAL"
  | "DUPLICATE_CLIENT_LINE_ID"
  | "NO_LINES"
  | "ROUNDING_MALFORMED"
  | "AMOUNT_PAID_MALFORMED"
  | "TOTALS_SUBTOTAL_BELOW_DISCOUNT";

interface TotalsResult {
  lines: ComputedLine[];
  totals: DocumentTotals;
}

export type TotalsOutcome =
  | { ok: true; value: TotalsResult }
  | { ok: false; rejection: TotalsRejection; lineIndex?: number };

interface TotalsInputBase {
  lines: readonly LineAmounts[];
  /** Signed on the ORDER dialect, non-negative on FINANCIAL. */
  roundingTotal: string;
}

/**
 * `amountPaid` exists on the ORDER dialect and does not exist on FINANCIAL —
 * the discriminated union says so at the type level rather than accepting a
 * value and silently discarding it.
 */
export type TotalsInput =
  | (TotalsInputBase & { dialect: "ORDER"; amountPaid?: string })
  | (TotalsInputBase & { dialect: "FINANCIAL" });

/**
 * Computes every line total and the eight document totals, or names the first
 * reason the server would refuse them.
 *
 * The line ordering is preserved: `lineIndex` on a rejection is the caller's
 * own index, which is the only handle a line editor has for pointing at a row.
 */
export function computeDocumentTotals(input: TotalsInput): TotalsOutcome {
  if (input.lines.length === 0) return { ok: false, rejection: "NO_LINES" };

  const roundingPattern = input.dialect === "ORDER" ? SIGNED_DECIMAL : NON_NEGATIVE_DECIMAL;
  if (!isCanonicalDecimal(input.roundingTotal, roundingPattern)) {
    return { ok: false, rejection: "ROUNDING_MALFORMED" };
  }

  const amountPaid = input.dialect === "ORDER" ? (input.amountPaid ?? DECIMAL_ZERO) : DECIMAL_ZERO;
  if (!isCanonicalDecimal(amountPaid, NON_NEGATIVE_DECIMAL)) {
    return { ok: false, rejection: "AMOUNT_PAID_MALFORMED" };
  }

  const computed: ComputedLine[] = [];
  for (const [lineIndex, line] of input.lines.entries()) {
    if (!isCanonicalDecimal(line.quantity, POSITIVE_DECIMAL)) {
      return { ok: false, rejection: "LINE_QUANTITY_INVALID", lineIndex };
    }
    const amounts = [line.unitPrice, line.discountTotal, line.chargeTotal, line.taxTotal];
    if (amounts.some((amount) => !isCanonicalDecimal(amount, NON_NEGATIVE_DECIMAL))) {
      return { ok: false, rejection: "LINE_AMOUNT_MALFORMED", lineIndex };
    }
    const lineSubtotal = multiplyFixedDecimal(line.quantity, line.unitPrice);
    // `assertInvoiceLineEvidence` refuses a discount above the line subtotal,
    // and the ORDER dialect would produce a negative `lineTotal` that
    // `OrderLineFinancialEvidenceDto` then rejects as non-non-negative. One
    // rule, two routes to the same refusal.
    if (compareFixedDecimal(line.discountTotal, lineSubtotal) > 0) {
      return { ok: false, rejection: "LINE_DISCOUNT_EXCEEDS_SUBTOTAL", lineIndex };
    }
    computed.push({
      ...line,
      lineSubtotal,
      lineTotal: addFixedDecimal(
        addFixedDecimal(subtractFixedDecimal(lineSubtotal, line.discountTotal), line.chargeTotal),
        line.taxTotal,
      ),
    });
  }

  const subtotal = sumFixedDecimals(computed.map((line) => line.lineSubtotal));
  const discountTotal = sumFixedDecimals(computed.map((line) => line.discountTotal));
  const chargeTotal = sumFixedDecimals(computed.map((line) => line.chargeTotal));
  const taxTotal = sumFixedDecimals(computed.map((line) => line.taxTotal));

  // `parseTotals` in order-print-snapshot.service.ts refuses the whole document
  // when the aggregate discount exceeds the aggregate subtotal, even though
  // every line passed its own check. Reachable when rounding is involved.
  if (compareFixedDecimal(subtotal, discountTotal) < 0) {
    return { ok: false, rejection: "TOTALS_SUBTOTAL_BELOW_DISCOUNT" };
  }

  // The two dialects genuinely compute grandTotal differently. The ORDER one
  // sums the per-line totals; the FINANCIAL one re-derives from the aggregates.
  // They agree numerically, and the distinction is kept anyway so each matches
  // the expression its own validator evaluates.
  const grandTotal =
    input.dialect === "ORDER"
      ? addFixedDecimal(sumFixedDecimals(computed.map((line) => line.lineTotal)), input.roundingTotal)
      : addFixedDecimal(
          addFixedDecimal(
            addFixedDecimal(subtractFixedDecimal(subtotal, discountTotal), chargeTotal),
            taxTotal,
          ),
          input.roundingTotal,
        );

  return {
    ok: true,
    value: {
      lines: computed,
      totals: {
        subtotal,
        discountTotal,
        chargeTotal,
        taxTotal,
        roundingTotal: input.roundingTotal,
        grandTotal,
        amountPaid,
        amountDue: subtractFixedDecimal(grandTotal, amountPaid),
      },
    },
  };
}

/**
 * Rejects duplicate `clientLineId`s before the request is built.
 *
 * Every validator on the server checks this and answers with the same opaque
 * 422 as a wrong sum, so catching it here is the difference between "line 3
 * repeats line 1" and "the document is incomplete".
 */
export function findDuplicateClientLineId(ids: readonly string[]): number | null {
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (seen.has(id)) return index;
    seen.add(id);
  }
  return null;
}
