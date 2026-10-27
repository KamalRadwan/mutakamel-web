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

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid evidence");
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

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid evidence");
    expect(result.subtotal).toBe("500");
    expect(result.discountTotal).toBe("50");
    expect(result.chargeTotal).toBe("50");
    expect(result.taxTotal).toBe("75");
    expect(result.roundingTotal).toBe("0.5");
    expect(result.grandTotal).toBe("575.5");
    expect(result.amountPaid).toBe("0");
    expect(result.amountDue).toBe("575.5");
  });

  it.each([
    ["quantity", ""], ["quantity", "0"], ["quantity", "-1"],
    ["quantity", "1e2"], ["quantity", "10000000000000000"],
    ["unitPrice", ""], ["unitPrice", "-1"], ["unitPrice", "12oops"],
    ["unitPrice", "0.123456789"], ["unitPrice", "10000000000000000"],
    ["discountAmount", "-1"], ["discountAmount", ""], ["chargeAmount", "bad"],
    ["taxRatePercent", ""], ["taxRatePercent", "15oops"],
    ["taxRatePercent", "-1"], ["taxRatePercent", "101"], ["taxRatePercent", "15.001"],
  ])("rejects %s=%s without substituting financial values", (field, raw) => {
    const draft = { ...createEmptyEvidenceLineDraft(), [field]: raw };
    const result = computeTradeEvidence([draft], { dialect: "FINANCIAL", currencyCode: "SAR" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field, lineIndex: 0 }));
    expect(result).not.toHaveProperty("grandTotal");
    expect(draft[field as keyof typeof draft]).toBe(raw);
  });

  it("accepts a valid zero price and exact basis-point tax rates", () => {
    const result = computeTradeEvidence([{ ...createEmptyEvidenceLineDraft(), taxRatePercent: "15.01" }], {
      dialect: "FINANCIAL", currencyCode: "SAR",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid evidence");
    expect(result.lines[0].unitPrice).toBe("0");
    expect(result.lines[0].taxRateBps).toBe(1501);
    expect(result.grandTotal).toBe("0");
  });

  it("returns calculation errors for excessive discounts, overflow and invalid totals", () => {
    const line = { ...createEmptyEvidenceLineDraft(), unitPrice: "1" };
    for (const draft of [
      { ...line, discountAmount: "2" },
      { ...line, quantity: "9999999999999999", unitPrice: "2" },
    ]) {
      const result = computeTradeEvidence([draft], { dialect: "ORDER", currencyCode: "SAR" });
      expect(result.ok).toBe(false);
      expect(result.errors[0].message).toBe("calculationInvalid");
      expect(result).not.toHaveProperty("grandTotal");
    }
    expect(computeTradeEvidence([line], { dialect: "FINANCIAL", currencyCode: "SAR", roundingTotal: "" }).ok).toBe(false);
    expect(computeTradeEvidence([line], { dialect: "ORDER", currencyCode: "SAR", amountPaid: "oops" }).ok).toBe(false);
    expect(computeTradeEvidence([line], { dialect: "ORDER", currencyCode: "SAR", roundingTotal: "-0.01" }).ok).toBe(true);
    expect(computeTradeEvidence([], { dialect: "ORDER", currencyCode: "SAR" }).ok).toBe(false);
  });

  it.each(["ORDER", "FINANCIAL"] as const)("calculates %s tax beyond safe integer precision exactly", (dialect) => {
    const result = computeTradeEvidence([{
      ...createEmptyEvidenceLineDraft(),
      unitPrice: "9007199254740993",
      taxRatePercent: "0.01",
    }], { dialect, currencyCode: "SAR" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid evidence");
    expect(result.lines[0].taxRateBps).toBe(1);
    expect(result.taxTotal).toBe("900719925474.0993");
    expect(result.grandTotal).toBe("9008099974666467.0993");
  });

  it("rounds a fractional tax half-up at eight decimal places", () => {
    const result = computeTradeEvidence([{
      ...createEmptyEvidenceLineDraft(),
      unitPrice: "0.00005",
      taxRatePercent: "0.01",
    }], { dialect: "FINANCIAL", currencyCode: "SAR" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid evidence");
    expect(result.taxTotal).toBe("0.00000001");
    expect(result.grandTotal).toBe("0.00005001");
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
