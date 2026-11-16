// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { PricingDecisionResult, PricingReferenceItem } from "../price-books/pricing-contract";
import { PricingDecisionTraceSection } from "./components/PricingDecisionTraceSection";
import { PricingResultSummaryCard } from "./components/PricingResultSummaryCard";
import { buildPricingWaterfall } from "./pricing-display";

const ID = "0192f3a0-0000-7000-8000-000000000001";
const decision: PricingDecisionResult = {
  decisionId: ID, outcome: "ALLOW", baselineUnitPrice: "100", unitPrice: "100",
  currencyCode: "EGP", priceBookId: ID, priceBookVersionId: ID,
  priceBookVersion: 3, minimumAllowedPrice: null, matchedPromotions: [],
};
const item: PricingReferenceItem = {
  itemId: ID, itemKind: "SERVICE", canonicalCode: "ITEM", localizedNames: { en: "Item", ar: "صنف" },
  baseUomId: ID, defaultSalesUomId: null, defaultPurchaseUomId: null,
  salesPrice: "150", standardCost: null, currencyCode: "EGP", canSell: true, canPurchase: true,
};
afterEach(cleanup);

describe.each([["en", en], ["ar", ar]] as const)("Truthful simulation evidence in %s", (lang, t) => {
  it("does not assert a publication state or default/account provenance that the response omits", () => {
    render(<PricingResultSummaryCard t={t} lang={lang} result={decision}
      evaluatedQuantity="1" evaluatedPurpose="SALES" totals={{ subtotal: "100", savings: "0" }}
      waterfall={buildPricingWaterfall(decision)} resolvedVersionNumber={3} resolutionSourceTier="AUTOMATIC" />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText(t.tradePricing.evalSourceAutomatic)).toBeInTheDocument();
    expect(screen.queryByText(t.tradePricing.kpiPillPublished)).not.toBeInTheDocument();
  });

  it("keeps catalog sales reference out of a purchase result", () => {
    render(<PricingResultSummaryCard t={t} lang={lang} result={decision}
      evaluatedQuantity="1" evaluatedPurpose="PURCHASE" totals={{ subtotal: "100", savings: "0" }}
      waterfall={buildPricingWaterfall(decision)} resolvedVersionNumber={3}
      evaluatedItem={item} resolutionSourceTier="EXPLICIT" />);
    expect(screen.queryByText(`${t.tradePricing.evalCatalogRefLabel}:`)).not.toBeInTheDocument();
  });

  it("shows the transient simulation ID without a nonexistent durable receipt link", () => {
    const { container } = render(<PricingDecisionTraceSection t={t} lang={lang} result={decision}
      showRawReceipt={false} onToggleRawReceipt={() => {}} />);
    expect(screen.getByText(ID)).toBeInTheDocument();
    expect(container.querySelector('a[href*="/decisions/"]')).toBeNull();
  });
});
