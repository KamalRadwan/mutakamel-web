import { describe, expect, it } from "vitest";
import {
  computeDocumentTotals,
  findDuplicateClientLineId,
  type LineAmounts,
} from "./document-totals";
import {
  addFixedDecimal,
  multiplyFixedDecimal,
  subtractFixedDecimal,
  sumFixedDecimals,
} from "./fixed-decimal";

const line = (over: Partial<LineAmounts> = {}): LineAmounts => ({
  quantity: "2",
  unitPrice: "10.5",
  discountTotal: "1",
  chargeTotal: "0.5",
  taxTotal: "3",
  ...over,
});

/**
 * Re-derives every identity the way the server writes it, from the same
 * primitives, and asserts the module agrees. Restating the arithmetic rather
 * than hardcoding a number is deliberate: a hardcoded expectation proves the
 * module is self-consistent, not that it matches the referee.
 */
function serverOrderTotals(lines: readonly LineAmounts[], roundingTotal: string, amountPaid: string) {
  const subtotals = lines.map((entry) => multiplyFixedDecimal(entry.quantity, entry.unitPrice));
  const lineTotals = lines.map((entry, index) =>
    addFixedDecimal(
      addFixedDecimal(subtractFixedDecimal(subtotals[index], entry.discountTotal), entry.chargeTotal),
      entry.taxTotal,
    ),
  );
  const grandTotal = addFixedDecimal(sumFixedDecimals(lineTotals), roundingTotal);
  return {
    subtotal: sumFixedDecimals(subtotals),
    discountTotal: sumFixedDecimals(lines.map((entry) => entry.discountTotal)),
    chargeTotal: sumFixedDecimals(lines.map((entry) => entry.chargeTotal)),
    taxTotal: sumFixedDecimals(lines.map((entry) => entry.taxTotal)),
    roundingTotal,
    grandTotal,
    amountPaid,
    amountDue: subtractFixedDecimal(grandTotal, amountPaid),
  };
}

describe("the ORDER dialect", () => {
  it("reproduces validateNewOrderFinancialEvidence exactly", () => {
    const lines = [line(), line({ quantity: "1.25", unitPrice: "3.33333333", taxTotal: "0" })];
    const outcome = computeDocumentTotals({
      dialect: "ORDER",
      lines,
      roundingTotal: "-0.02",
      amountPaid: "5",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.totals).toEqual(serverOrderTotals(lines, "-0.02", "5"));
  });

  it("accepts a negative rounding, which the invoice dialect will not", () => {
    expect(
      computeDocumentTotals({ dialect: "ORDER", lines: [line()], roundingTotal: "-0.05" }).ok,
    ).toBe(true);
    expect(
      computeDocumentTotals({ dialect: "FINANCIAL", lines: [line()], roundingTotal: "-0.05" }),
    ).toEqual({ ok: false, rejection: "ROUNDING_MALFORMED" });
  });

  it("defaults amountPaid to zero and derives amountDue from it", () => {
    const outcome = computeDocumentTotals({
      dialect: "ORDER",
      lines: [line()],
      roundingTotal: "0",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.totals.amountPaid).toBe("0");
    expect(outcome.value.totals.amountDue).toBe(outcome.value.totals.grandTotal);
  });
});

describe("the FINANCIAL dialect", () => {
  it("derives grandTotal from the aggregates and pins amountPaid to zero", () => {
    const lines = [line(), line({ quantity: "3", unitPrice: "1.1" })];
    const outcome = computeDocumentTotals({
      dialect: "FINANCIAL",
      lines,
      roundingTotal: "0.01",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { totals } = outcome.value;
    expect(totals.grandTotal).toBe(
      addFixedDecimal(
        addFixedDecimal(
          addFixedDecimal(
            subtractFixedDecimal(totals.subtotal, totals.discountTotal),
            totals.chargeTotal,
          ),
          totals.taxTotal,
        ),
        "0.01",
      ),
    );
    expect(totals.amountPaid).toBe("0");
    expect(totals.amountDue).toBe(totals.grandTotal);
  });

  it("has no amountPaid to get wrong, because Trade has no settlement source", () => {
    const outcome = computeDocumentTotals({
      dialect: "FINANCIAL",
      lines: [line({ discountTotal: "0", chargeTotal: "0", taxTotal: "0" })],
      roundingTotal: "0",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.totals.amountPaid).toBe("0");
  });
});

describe("what the browser refuses before the server can", () => {
  it("names the offending line rather than the document", () => {
    expect(
      computeDocumentTotals({
        dialect: "ORDER",
        lines: [line(), line({ quantity: "0" })],
        roundingTotal: "0",
      }),
    ).toEqual({ ok: false, rejection: "LINE_QUANTITY_INVALID", lineIndex: 1 });

    expect(
      computeDocumentTotals({
        dialect: "ORDER",
        lines: [line({ discountTotal: "10.50" })],
        roundingTotal: "0",
      }),
    ).toEqual({ ok: false, rejection: "LINE_AMOUNT_MALFORMED", lineIndex: 0 });

    expect(
      computeDocumentTotals({
        dialect: "FINANCIAL",
        lines: [line({ quantity: "1", unitPrice: "5", discountTotal: "6" })],
        roundingTotal: "0",
      }),
    ).toEqual({ ok: false, rejection: "LINE_DISCOUNT_EXCEEDS_SUBTOTAL", lineIndex: 0 });
  });

  it("refuses an empty document", () => {
    expect(computeDocumentTotals({ dialect: "ORDER", lines: [], roundingTotal: "0" })).toEqual({
      ok: false,
      rejection: "NO_LINES",
    });
  });

  it("finds a repeated clientLineId", () => {
    expect(findDuplicateClientLineId(["a", "b", "a"])).toBe(2);
    expect(findDuplicateClientLineId(["a", "b"])).toBeNull();
  });
});
