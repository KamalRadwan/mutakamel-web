import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { PricingDecisionResult } from "../price-books/pricing-contract";
import {
  buildPricingWaterfall,
  localizeRejectionReason,
  pricingDisplayTotals,
  resolveActiveScenarioPreset,
  resolvePublishedVersionNumber,
  resolveSourceTier,
} from "./pricing-display";

const BOOK_ID = "0192f3a0-0000-7000-8000-000000000010";
const VERSION_ID = "0192f3a0-0000-7000-8000-000000000011";
const DECISION_ID = "0192f3a0-0000-7000-8000-000000000012";

function baseDecision(overrides: Partial<PricingDecisionResult> = {}): PricingDecisionResult {
  return {
    decisionId: DECISION_ID,
    outcome: "ALLOW",
    baselineUnitPrice: "950.00",
    unitPrice: "950.00",
    currencyCode: "EGP",
    priceBookId: BOOK_ID,
    priceBookVersionId: VERSION_ID,
    minimumAllowedPrice: null,
    matchedPromotions: [],
    ...overrides,
  };
}

describe("pricingDisplayTotals", () => {
  it("retains three-decimal amounts", () => {
    expect(pricingDisplayTotals("1.999", "1.234", "3")).toEqual({
      subtotal: "3.702",
      savings: "2.295",
    });
  });

  it("preserves significant digits beyond the safe integer range", () => {
    expect(pricingDisplayTotals("9007199254740993.15", "9007199254740993.125", "2")).toEqual({
      subtotal: "18014398509481986.25",
      savings: "0.05",
    });
  });

  it("multiplies fractional quantities using Trade's eight-decimal rounding", () => {
    expect(pricingDisplayTotals("0.3", "0.1", "0.3")).toEqual({
      subtotal: "0.03",
      savings: "0.06",
    });
    expect(pricingDisplayTotals("0.00000002", "0.00000001", "0.5")).toEqual({
      subtotal: "0.00000001",
      savings: "0.00000001",
    });
  });

  it("keeps savings non-negative", () => {
    expect(pricingDisplayTotals("1", "2", "3")).toEqual({ subtotal: "6", savings: "0" });
    expect(pricingDisplayTotals("2", "2", "3")).toEqual({ subtotal: "6", savings: "0" });
  });
});

describe("buildPricingWaterfall", () => {
  it("treats the matched tier baseline as step 1 without fabricating a promotion row", () => {
    const model = buildPricingWaterfall(baseDecision());
    expect(model.steps).toEqual([
      {
        stepNumber: 1,
        kind: "BASELINE",
        deltaAmount: null,
        runningUnitPrice: "950.00",
      },
    ]);
    expect(model.netUnitDelta).toBe("0");
    expect(model.discountPercent).toBeNull();
  });

  it("accumulates stacked promotions in exact decimal order", () => {
    const model = buildPricingWaterfall(
      baseDecision({
        baselineUnitPrice: "950.00",
        unitPrice: "830.00",
        matchedPromotions: [
          {
            code: "WHOLESALE_10",
            name: "Wholesale 10%",
            benefitType: "PERCENTAGE",
            discountValue: "10",
            discountAmount: "95.00",
            priority: 10,
            stackGroup: "TIER",
          },
          {
            code: "REBATE_25",
            name: "Fixed Rebate",
            benefitType: "FIXED_AMOUNT",
            discountValue: "25",
            discountAmount: "25.00",
            priority: 20,
            stackGroup: "CASH",
          },
        ],
      }),
    );

    expect(model.steps.map((s) => [s.stepNumber, s.kind, s.deltaAmount, s.runningUnitPrice])).toEqual([
      [1, "BASELINE", null, "950.00"],
      [2, "PROMOTION", "95.00", "855"],
      [3, "PROMOTION", "25.00", "830"],
    ]);
    expect(model.netUnitDelta).toBe("-120");
    expect(model.discountPercent).toBe("12.63");
  });

  it("adds a neutral reconciliation step when final unitPrice differs from post-promo total", () => {
    const model = buildPricingWaterfall(
      baseDecision({
        baselineUnitPrice: "100.00",
        unitPrice: "85.00",
        minimumAllowedPrice: "85.00",
        matchedPromotions: [
          {
            code: "PROMO_20",
            discountAmount: "20.00",
          },
        ],
      }),
    );

    expect(model.steps).toHaveLength(3);
    expect(model.steps[2]).toEqual({
      stepNumber: 3,
      kind: "RECONCILIATION",
      deltaAmount: "5",
      runningUnitPrice: "85.00",
    });
    expect(model.netUnitDelta).toBe("-15");
    expect(model.discountPercent).toBe("15");
  });
});

describe("pricing display helpers", () => {
  it("resolves active scenario presets using canonical decimal equality", () => {
    expect(resolveActiveScenarioPreset("SALES", "10.00")).toBe("retail");
    expect(resolveActiveScenarioPreset("SALES", "100")).toBe("wholesale");
    expect(resolveActiveScenarioPreset("SALES", "500.000")).toBe("vip");
    expect(resolveActiveScenarioPreset("PURCHASE", "10.00")).toBeNull();
    expect(resolveActiveScenarioPreset("SALES", "25")).toBeNull();
  });

  it("describes selection without inferring account/default provenance from bounded reference data", () => {
    expect(resolveSourceTier({ priceBookId: BOOK_ID })).toBe("EXPLICIT");
    expect(resolveSourceTier({ priceBookId: "" })).toBe("AUTOMATIC");
    expect(resolveSourceTier(null)).toBe("AUTOMATIC");
  });

  it("does not turn rejected floor-guard promotions into applied discounts", () => {
    const model = buildPricingWaterfall(baseDecision({
      baselineUnitPrice: "100", unitPrice: "100", minimumAllowedPrice: "85",
      matchedPromotions: [], rejectedPromotions: [{ code: "DISCOUNT20", reason: "MINIMUM_PRICE_GUARD" }],
    }));
    expect(model.steps.map((step) => step.kind)).toEqual(["BASELINE"]);
    expect(model.netUnitDelta).toBe("0");
  });

  it("preserves reported discounts when evidence is inconsistent instead of inventing a partial discount", () => {
    const model = buildPricingWaterfall(baseDecision({ baselineUnitPrice: "100", unitPrice: "0", matchedPromotions: [{ code: "BAD", discountAmount: "120" }] }));
    expect(model.steps[1]).toMatchObject({ kind: "PROMOTION", deltaAmount: "120", runningUnitPrice: "-20" });
    expect(model.steps[2]).toMatchObject({ kind: "RECONCILIATION", deltaAmount: "20", runningUnitPrice: "0" });
  });

  it("resolves version numbers and localizes rejection reasons without exposing raw enums", () => {
    expect(resolvePublishedVersionNumber(baseDecision({ priceBookVersion: 4 }))).toBe(4);
    expect(localizeRejectionReason("MINIMUM_PRICE_GUARD", en)).toBe(
      en.tradePricing.evalRejectionReason_MINIMUM_PRICE_GUARD,
    );
    expect(localizeRejectionReason("FUTURE_ENGINE_REASON", en)).toContain("FUTURE_ENGINE_REASON");
  });
});
