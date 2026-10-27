import { describe, expect, it } from "vitest";
import { pricingDisplayTotals } from "./pricing-display";

describe("pricingDisplayTotals", () => {
  it("retains three-decimal amounts", () => {
    expect(pricingDisplayTotals("1.999", "1.234", "3")).toEqual({
      subtotal: "3.702", savings: "2.295",
    });
  });

  it("preserves significant digits beyond the safe integer range", () => {
    expect(pricingDisplayTotals("9007199254740993.15", "9007199254740993.125", "2")).toEqual({
      subtotal: "18014398509481986.25", savings: "0.05",
    });
  });

  it("multiplies fractional quantities using Trade's eight-decimal rounding", () => {
    expect(pricingDisplayTotals("0.3", "0.1", "0.3")).toEqual({
      subtotal: "0.03", savings: "0.06",
    });
    expect(pricingDisplayTotals("0.00000002", "0.00000001", "0.5")).toEqual({
      subtotal: "0.00000001", savings: "0.00000001",
    });
  });

  it("keeps savings non-negative", () => {
    expect(pricingDisplayTotals("1", "2", "3")).toEqual({ subtotal: "6", savings: "0" });
    expect(pricingDisplayTotals("2", "2", "3")).toEqual({ subtotal: "6", savings: "0" });
  });
});
