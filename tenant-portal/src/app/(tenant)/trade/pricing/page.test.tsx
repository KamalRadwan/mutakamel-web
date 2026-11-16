// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { PricingDecisionResult } from "../price-books/pricing-contract";
import { buildPricingWaterfall, pricingDisplayTotals } from "./pricing-display";
import { ALL_PRICING_SCOPES } from "./hooks/usePricingScopeOptions";
import type { usePricingWorkbench } from "./hooks/usePricingWorkbench";
import PricingEvaluationPage from "./page";

const COMPANY_ID = "0192f3a0-0000-7000-8000-000000000001";
const ITEM_ID = "0192f3a0-0000-7000-8000-000000000002";
const UOM_ID = "0192f3a0-0000-7000-8000-000000000003";
const BOOK_ID = "0192f3a0-0000-7000-8000-000000000004";
const VERSION_ID = "0192f3a0-0000-7000-8000-000000000005";
const DECISION_ID = "0192f3a0-0000-7000-8000-000000000006";

const fixture = vi.hoisted(() => ({
  model: {} as Record<string, unknown>,
  t: null as unknown,
  lang: "en" as "en" | "ar",
  permissions: ["trade.pricing.read"] as string[],
}));

vi.mock("./hooks/usePricingWorkbench", () => ({
  usePricingWorkbench: () => fixture.model,
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { id: "user-1", permissions: fixture.permissions, isTenantOwner: false },
    realtimeAuthGeneration: 0,
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: fixture.t,
    lang: fixture.lang,
    dir: fixture.lang === "ar" ? "rtl" : "ltr",
  }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => fixture.t,
  useLanguage: () => fixture.lang,
  useDirection: () => (fixture.lang === "ar" ? "rtl" : "ltr"),
}));

function buildDefaultWorkbench(t = en, lang: "en" | "ar" = "en") {
  return {
    t,
    lang,
    canRead: true,
    isScopeResolved: true,
    branchIds: [],
    branchId: null,
    selectBranch: vi.fn(),
    values: {
      purpose: "SALES" as const,
      itemId: ITEM_ID,
      uomId: UOM_ID,
      quantity: "100",
      currencyCode: "SAR",
      priceBookId: "",
      partyId: "",
    },
    result: null,
    evaluatedInputs: null,
    hasStaleEdits: false,
    pinnedEvaluations: [],
    pinCurrentResult: vi.fn(),
    clearPinnedEvaluations: vi.fn(),
    applyPreset: vi.fn(),
    noPrice: false,
    isEvaluating: false,
    queryError: null,
    queryErrorMessage: undefined,
    formError: null,
    setValue: vi.fn(),
    reset: vi.fn(),
    evaluate: vi.fn(),
    scopeOptions: {
      t,
      context: { companyId: COMPANY_ID, branchId: null, channelId: null },
      companyOptions: [{ value: COMPANY_ID, label: "Mersany Trading" }],
      branchOptions: [{ value: ALL_PRICING_SCOPES, label: t.trade.scopeAllBranches }],
      channelOptions: [{ value: ALL_PRICING_SCOPES, label: t.trade.scopeAllChannels }],
      companyLabel: "Mersany Trading",
      branchLabel: t.trade.scopeAllBranches,
      channelLabel: t.trade.scopeAllChannels,
      isLoading: false,
      canReadCompanies: true,
      canReadBranches: true,
      companyError: null,
      branchError: null,
      isLoadingChannels: false,
      channelsError: null,
      refreshChannels: vi.fn(),
      setCompanySearch: vi.fn(),
      setBranchSearch: vi.fn(),
      setChannelSearch: vi.fn(),
      changeCompany: vi.fn(),
      changeBranch: vi.fn(),
      changeChannel: vi.fn(),
      retry: vi.fn(),
    },
    currencies: {
      currencies: [{ code: "SAR", name: "Saudi Riyal", isDefault: true }],
      options: [{ value: "SAR", label: "Saudi Riyal (SAR)" }],
      canRead: true,
      error: null,
      loading: false,
      setSearch: vi.fn(),
      retry: vi.fn(),
    },
    isLoadingRefData: false,
    selectedCurrencyLabel: "Saudi Riyal (SAR)",
    uoms: [{ id: UOM_ID, code: "CTN", displayName: "Carton", localizedNames: { en: "Carton", ar: "كرتونة" } }],
    selectedItem: {
      itemId: ITEM_ID,
      canonicalCode: "ITM-2048",
      itemKind: "STOCK",
      localizedNames: { en: "Extra Virgin Olive Oil", ar: "زيت زيتون بكر ممتاز" },
      baseUomId: UOM_ID,
      defaultSalesUomId: UOM_ID,
      defaultPurchaseUomId: UOM_ID,
      canSell: true,
      canPurchase: true,
      salesPrice: "1000.00",
      standardCost: null,
      currencyCode: "SAR",
    },
    allItemOptions: [{ value: ITEM_ID, label: "Extra Virgin Olive Oil", description: "ITM-2048" }],
    itemOptions: [{ value: ITEM_ID, label: "Extra Virgin Olive Oil", description: "ITM-2048" }],
    setItemSearch: vi.fn(),
    allAccountOptions: [],
    accountOptions: [],
    setAccountSearch: vi.fn(),
    eligibleBooks: [
      {
        id: BOOK_ID,
        code: "PB-WHOLESALE-2026",
        name: "Wholesale Price Book 2026",
        localizedNames: { en: "Wholesale Price Book 2026", ar: "دفتر أسعار الجملة 2026" },
        purpose: "SALES",
        currencyCode: "SAR",
        status: "ACTIVE",
        version: 1,
        versionCount: 3,
        versions: [
          {
            id: VERSION_ID,
            versionNumber: 3,
            status: "PUBLISHED",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
            version: 1,
          },
        ],
      },
    ],
    activePreset: "wholesale" as const,
    selectScenarioPreset: vi.fn(),
    selectPurpose: vi.fn(),
    selectCurrencyCode: vi.fn(),
    selectItem: vi.fn(),
    normalizeQuantityBlur: vi.fn(),
    isAdvancedOpen: false,
    setIsAdvancedOpen: vi.fn(),
    advancedSummaryText: "Date: Now · Price book: Auto",
    isTraceOpen: false,
    setIsTraceOpen: vi.fn(),
    showRawReceipt: false,
    setShowRawReceipt: vi.fn(),
    totals: { subtotal: "0", savings: "0" },
    waterfall: null,
    resolvedBook: undefined,
    resolvedVersionNumber: null,
    evaluatedItem: undefined,
    evaluatedUom: undefined,
    resolutionSourceTier: "AUTOMATIC" as const,
    resetAll: vi.fn(),
  } satisfies ReturnType<typeof usePricingWorkbench>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.lang = "en";
  fixture.t = en;
  fixture.permissions = ["trade.pricing.read"];
  fixture.model = buildDefaultWorkbench(en, "en");
});
afterEach(cleanup);

describe.each([
  { lang: "en" as const, t: en },
  { lang: "ar" as const, t: ar },
])("PricingEvaluationPage in $lang", ({ lang, t }) => {
  it("renders compact ready, unresolved-company, noPrice, and retryable error states without auto-evaluating", () => {
    fixture.lang = lang;
    fixture.t = t;

    const readyModel = buildDefaultWorkbench(t, lang);
    fixture.model = readyModel;
    const { rerender } = render(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );

    expect(screen.getByText(t.tradePricing.evalReadyTitle)).toBeVisible();
    expect(screen.getByText("Mersany Trading")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: t.tradePricing.evalScenarioVip }));
    expect(readyModel.selectScenarioPreset).toHaveBeenCalledWith("vip");
    expect(readyModel.evaluate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.tradePricing.evalRunAction }));
    expect(readyModel.evaluate).toHaveBeenCalledTimes(1);

    fixture.model = { ...buildDefaultWorkbench(t, lang), isScopeResolved: false };
    rerender(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );
    expect(screen.getByText(t.tradePricing.evalScopeSelectPromptTitle)).toBeVisible();

    fixture.model = { ...buildDefaultWorkbench(t, lang), noPrice: true };
    rerender(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );
    expect(screen.getByText(t.tradePricing.errorNoEligiblePrice)).toBeVisible();

    const erroredModel = {
      ...buildDefaultWorkbench(t, lang),
      queryError: { status: 500, message: "Upstream unavailable", code: "INTERNAL_ERROR" },
      queryErrorMessage: "Upstream unavailable",
    };
    fixture.model = erroredModel;
    rerender(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );
    expect(screen.getByText(t.tradePricing.evaluateFailed)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(erroredModel.evaluate).toHaveBeenCalledTimes(1);
  });

  it("renders the authoritative result summary, waterfall steps, audit disclosure, and pinned comparison", () => {
    fixture.lang = lang;
    fixture.t = t;

    const decision: PricingDecisionResult = {
      decisionId: DECISION_ID,
      outcome: "ALLOW",
      baselineUnitPrice: "950.00",
      unitPrice: "855.00",
      currencyCode: "SAR",
      priceBookId: BOOK_ID,
      priceBookVersionId: VERSION_ID,
      priceBookVersion: 3,
      minimumAllowedPrice: "800.00",
      matchedPromotions: [
        {
          code: "TIER_10",
          name: "Wholesale 10%",
          benefitType: "PERCENTAGE",
          discountValue: "10",
          discountAmount: "95.00",
          priority: 10,
          stackGroup: "DEFAULT",
        },
      ],
      rejectedPromotions: [{ code: "VIP_ONLY", reason: "SELECTOR_MISMATCH" }],
    };

    const base = buildDefaultWorkbench(t, lang);
    const pinSpy = vi.fn();
    const clearSpy = vi.fn();
    fixture.model = {
      ...base,
      result: decision,
      evaluatedInputs: { ...base.values },
      totals: pricingDisplayTotals(decision.baselineUnitPrice, decision.unitPrice, "100"),
      waterfall: buildPricingWaterfall(decision),
      resolvedBook: base.eligibleBooks[0],
      resolvedVersionNumber: 3,
      evaluatedItem: base.selectedItem,
      evaluatedUom: base.uoms[0],
      isTraceOpen: true,
      pinCurrentResult: pinSpy,
      clearPinnedEvaluations: clearSpy,
      pinnedEvaluations: [
        {
          id: "0192f3a0-0000-7000-8000-000000000099",
          inputs: { ...base.values, quantity: "10" },
          scopeHeaders: { "x-mutakamel-company-id": COMPANY_ID },
          decision,
        },
      ],
    };

    render(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );

    expect(screen.getByText(t.tradePricing.evalResultSummaryTitle)).toBeVisible();
    expect(screen.getByText(t.tradePricing.evalWaterfallHeading)).toBeVisible();
    expect(screen.getByText(t.tradePricing.evalStepBaselineTitle)).toBeVisible();
    expect(screen.getByText("Wholesale 10%")).toBeVisible();
    expect(screen.getByText(t.tradePricing.evalPreTaxQuantityTotalLabel)).toBeVisible();
    expect(screen.getByText(t.tradePricing.evalRejectionReason_SELECTOR_MISMATCH)).toBeVisible();
    expect(screen.queryByText("SELECTOR_MISMATCH")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.tradePricing.pinToComparison }));
    expect(pinSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: t.tradePricing.clearComparison }));
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("renders PermissionGate when pricing read access is denied", () => {
    fixture.lang = lang;
    fixture.t = t;
    fixture.model = { ...buildDefaultWorkbench(t, lang), canRead: false };

    render(
      <TooltipProvider>
        <PricingEvaluationPage />
      </TooltipProvider>,
    );

    expect(screen.getByText(t.permissionGate.title)).toBeVisible();
  });
});
