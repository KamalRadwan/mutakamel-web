import { describe, expect, it } from "vitest";
import {
  buildZeroFinancialTotals,
  computeTradeEvidence,
  createEmptyEvidenceLineDraft,
} from "./trade-financial-evidence";

const ITEM_UUID = "01890000-0000-7000-8000-000000000001";
const UOM_UUID = "01890000-0000-7000-8000-000000000002";

describe("computeTradeEvidence", () => {
  it("computes ORDER dialect line and header totals with 8-decimal precision", () => {
    const draft = {
      ...createEmptyEvidenceLineDraft(),
      itemId: ITEM_UUID,
      uomCode: UOM_UUID,
      description: "Industrial Valve",
      quantity: "2",
      unitPrice: "100",
      discountAmount: "10",
      chargeAmount: "0",
      taxCode: "VAT-15",
      taxRatePercent: "15",
    };

    const result = computeTradeEvidence([draft], {
      dialect: "ORDER",
      currencyCode: "SAR",
    });

    expect(result.subtotal).toBe("200");
    expect(result.discountTotal).toBe("10");
    expect(result.taxTotal).toBe("28.5");
    expect(result.grandTotal).toBe("218.5");
    expect(result.amountPaid).toBe("0");
    expect(result.amountDue).toBe("218.5");
    expect(result.lines[0].taxSnapshot).toMatchObject({
      taxCode: "VAT-15",
      category: "STANDARD",
      rateBps: 1500,
    });
  });

  it("computes FINANCIAL dialect line and header totals including chargeAmount and roundingTotal", () => {
    const draft = {
      ...createEmptyEvidenceLineDraft(),
      itemId: ITEM_UUID,
      uomCode: UOM_UUID,
      description: "Consulting Retainer",
      quantity: "1",
      unitPrice: "500",
      discountAmount: "50",
      chargeAmount: "50",
      taxCode: "VAT-15",
      taxRatePercent: "15",
    };

    const result = computeTradeEvidence([draft], {
      dialect: "FINANCIAL",
      currencyCode: "SAR",
      roundingTotal: "0.5",
    });

    expect(result.subtotal).toBe("500");
    expect(result.discountTotal).toBe("50");
    expect(result.chargeTotal).toBe("50");
    expect(result.taxTotal).toBe("75");
    expect(result.roundingTotal).toBe("0.5");
    expect(result.grandTotal).toBe("575.5");
    expect(result.amountPaid).toBe("0");
    expect(result.amountDue).toBe("575.5");
  });

  it("builds canonical zero totals for NON_FINANCIAL contracts", () => {
    expect(buildZeroFinancialTotals()).toEqual({
      subtotal: "0",
      discountTotal: "0",
      chargeTotal: "0",
      taxTotal: "0",
      roundingTotal: "0",
      grandTotal: "0",
      amountPaid: "0",
      amountDue: "0",
    });
  });
});
