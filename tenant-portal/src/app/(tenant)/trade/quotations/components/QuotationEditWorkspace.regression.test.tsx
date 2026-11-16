// @vitest-environment jsdom
import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { seedLanguageSnapshot, setLanguage } from "@/i18n/dictionary-store";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { multiplyFixedDecimal, subtractFixedDecimal, sumFixedDecimals } from "../../documents/fixed-decimal";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import type { QuotationPricingCalculation, QuotationPricingRequest } from "../quotation-discount-contract";
import CreateQuotationStandalonePage from "../new/page";
import QuotationDetailPage from "../[id]/page";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
const PARTY_ID = "01890000-0000-7000-8000-000000000003";
const CRM_PROFILE_ID = "01890000-0000-7000-8000-000000000008";
const CONTACT_ID = "01890000-0000-7000-8000-000000000004";
const QUOTE_ID = "01890000-0000-7000-8000-000000000010";
const REV_1_ID = "01890000-0000-7000-8000-000000000011";
const REV_2_ID = "01890000-0000-7000-8000-000000000012";
const ITEM_PBX_ID = "01890000-0000-7000-8000-000000000020";
const ITEM_PHONE_ID = "01890000-0000-7000-8000-000000000025";
const ITEM_CABLE_ID = "01890000-0000-7000-8000-000000000028";
const UOM_EA_ID = "01890000-0000-7000-8000-000000000021";
const BOOK_ID = "01890000-0000-7000-8000-000000000040";
const LINE_1_ID = "01890000-0000-7000-8000-000000000061";
const LINE_2_ID = "01890000-0000-7000-8000-000000000062";
const LINE_3_ID = "01890000-0000-7000-8000-000000000063";
const LIMIT_ID = "01890000-0000-7000-8000-000000000070";

const DICTIONARIES = { en, ar } as const;
const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

const state = vi.hoisted(() => {
  const companyId = "01890000-0000-7000-8000-000000000001";
  const branchId = "01890000-0000-7000-8000-000000000002";
  const actorId = "01890000-0000-7000-8000-000000000090";
  const stableHeaders = { "x-company-id": companyId, "x-branch-id": branchId };
  const emptySearchParams = new URLSearchParams();
  const companyOpts = [{ value: companyId, label: "Mersany Solutions" }];
  const branchOpts = [{ value: branchId, label: "Cairo HQ" }];
  const defaultPerms = ["trade.quotations.read", "trade.quotations.create", "trade.quotations.update", "trade.quotations.send", "trade.items.read"];
  const buildScopes = (perms: string[]) =>
    Object.fromEntries(perms.map((perm) => [perm, { tenantWide: true, companyIds: [companyId], branchIds: [branchId] }]));
  const auth = {
    user: { id: actorId, isTenantOwner: false, permissions: defaultPerms, permissionScopes: buildScopes(defaultPerms) },
    realtimeAuthGeneration: `tenant:s1:${actorId}`,
    readReadyProfileCommit: () => ({ user: { id: actorId }, sessionRevision: JSON.stringify(["s1", 1, 1]), sequence: 1 }),
  };
  const docScope = {
    isResolved: true,
    headers: stableHeaders,
    userId: actorId,
    canWrite: (perm: string) => auth.user.isTenantOwner || auth.user.permissions.includes(perm),
  };
  const scopeValue = {
    context: { companyId, branchId, channelId: null },
    companyIds: [companyId], branchIds: [branchId], isLoadingBranches: false, branchesError: null, refreshBranches: vi.fn(),
    channels: [], isLoadingChannels: false, channelsError: null, refreshChannels: vi.fn(),
    selectCompany: vi.fn(), selectBranch: vi.fn(), selectChannel: vi.fn(), selectContext: vi.fn(),
    headersFor: () => stableHeaders,
    gapFor: () => null, contextLocked: false, registerContextGuard: () => () => {}, applyContextChange: vi.fn(),
  };
  return {
    lang: "en" as "en" | "ar",
    setPermissions: (perms: string[], isOwner = false) => {
      auth.user = { id: actorId, isTenantOwner: isOwner, permissions: perms, permissionScopes: buildScopes(perms) };
    },
    defaultPerms,
    auth,
    docScope,
    scopeValue,
    emptySearchParams,
    companyOpts,
    branchOpts,
    tradeGetMock: vi.fn(),
    tradePostMock: vi.fn(),
    tradePatchMock: vi.fn(),
    loadCurrenciesMock: vi.fn(),
    routerPush: vi.fn(),
  };
});

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: DICTIONARIES[state.lang], lang: state.lang, dir: DIRECTIONS[state.lang] }),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => state.auth }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: state.routerPush }),
  useSearchParams: () => state.emptySearchParams,
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: state.tradeGetMock,
  tradePost: state.tradePostMock,
  tradePatch: state.tradePatchMock,
}));
vi.mock("@/app/(tenant)/core/contracts/currency-options", () => ({ loadActiveCurrencyOptions: state.loadCurrenciesMock }));
vi.mock("../../documents/hooks/useTradeDocumentScope", () => ({ useTradeDocumentScope: () => state.docScope }));
vi.mock("../../useTradeScope", () => ({
  useTradeScope: () => state.scopeValue,
  useOptionalTradeScope: () => state.scopeValue,
}));
vi.mock("@/hooks/useTenantOrganizationOptions", () => ({
  useTenantOrganizationOptions: (kind: "company" | "branch") => (kind === "company" ? state.companyOpts : state.branchOpts),
}));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: () => null }));
vi.mock("./QuotationPdfWorkspace", () => ({ QuotationPdfWorkspace: () => null }));

const CATALOG_ITEMS = [
  {
    id: ITEM_PBX_ID, canonicalCode: "CLOUD-PBX-PRO-50", barcode: null, status: "ACTIVE", image: null,
    localizedNames: { en: "Cloud PBX Pro 50", ar: "سنترال سحابي 50" },
    quotationDescription: "MUTATED LIVE CATALOG DESC", salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    eligibility: {
      companyProfileId: "01890000-0000-7000-8000-000000000022", companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_EA_ID, defaultSalesUomId: UOM_EA_ID, defaultPurchaseUomId: UOM_EA_ID,
      branchProfileId: "01890000-0000-7000-8000-000000000023", branchProfileVersion: 1, isAssorted: true,
    },
  },
  {
    id: ITEM_PHONE_ID, canonicalCode: "YEALINK-T54W-IP", barcode: null, status: "ACTIVE", image: null,
    localizedNames: { en: "Yealink T54W IP Phone", ar: "هاتف يالينك T54W" },
    quotationDescription: "Live phone catalog description", salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    eligibility: {
      companyProfileId: "01890000-0000-7000-8000-000000000026", companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_EA_ID, defaultSalesUomId: UOM_EA_ID, defaultPurchaseUomId: UOM_EA_ID,
      branchProfileId: "01890000-0000-7000-8000-000000000027", branchProfileVersion: 1, isAssorted: true,
    },
  },
  {
    id: ITEM_CABLE_ID, canonicalCode: "CAT6A-PATCH-3M", barcode: null, status: "ACTIVE", image: null,
    localizedNames: { en: "Cat6A Shielded Patch", ar: "كابل شبكة Cat6A" },
    quotationDescription: "Live patch cord description", salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    eligibility: {
      companyProfileId: "01890000-0000-7000-8000-000000000029", companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_EA_ID, defaultSalesUomId: UOM_EA_ID, defaultPurchaseUomId: UOM_EA_ID,
      branchProfileId: "01890000-0000-7000-8000-000000000030", branchProfileVersion: 1, isAssorted: true,
    },
  },
];

function reply(data: unknown) { return { data, headers: new Headers() }; }
function apiError(status: number, code: string) {
  return new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: { code } });
}
function routeParams(id = QUOTE_ID): Promise<{ id: string }> {
  return Object.assign(Promise.resolve({ id }), { status: "fulfilled" as const, value: { id } });
}

function buildPreview(req: QuotationPricingRequest): QuotationPricingCalculation {
  const lines = req.lines.map((line, index) => {
    const baseUnitPrice = line.itemId === ITEM_PBX_ID ? "17800.00" : "3950.00";
    const subtotal = multiplyFixedDecimal(line.quantity, baseUnitPrice);
    let discountTotal = "0.00";
    if (req.pricing.mode === "DISCOUNT" && req.pricing.scope === "LINE" && line.discount) {
      discountTotal = line.discount.type === "PERCENT" ? multiplyFixedDecimal(subtotal, "0.05") : line.discount.value;
    } else if (req.pricing.mode === "DISCOUNT" && req.pricing.scope === "DOCUMENT" && req.pricing.value) {
      discountTotal = req.pricing.type === "PERCENT"
        ? multiplyFixedDecimal(subtotal, "0.08")
        : req.pricing.value === "5000" ? (index === 0 ? "3751.32" : "1248.68") : "0.00";
    }
    return {
      clientLineId: line.clientLineId, itemId: line.itemId, uomId: line.uomId, quantity: line.quantity,
      unitPrice: baseUnitPrice, baseUnitPrice, netUnitPrice: baseUnitPrice, subtotal, discountTotal,
      lineTotal: subtractFixedDecimal(subtotal, discountTotal), promotionSavings: "0.00",
      minimumAllowedPrice: "100.00", maxDiscountAmount: "8400.00", maxDiscountPercent: "20",
    };
  });
  const subtotal = sumFixedDecimals(lines.map((l) => l.subtotal));
  const discountTotal = sumFixedDecimals(lines.map((l) => l.discountTotal));
  return {
    pricing: req.pricing, currencyDecimalPlaces: 2,
    limitsSnapshot: req.pricing.mode === "DISCOUNT" ? { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true } : null,
    lines, totals: { subtotal, discountTotal, grandTotal: subtractFixedDecimal(subtotal, discountTotal), baseSubtotal: subtotal, promotionSavings: "0.00" },
    fingerprint: "f".repeat(64),
  };
}

function buildPersistedQuotation(variant: "LINE_MIXED" | "DOC_AMOUNT" | "DOC_PERCENT_SENT") {
  const isMixed = variant === "LINE_MIXED";
  const isDocAmount = variant === "DOC_AMOUNT";
  const isSent = variant === "DOC_PERCENT_SENT";
  const lines = [
    {
      id: "01890000-0000-7000-8000-000000000032", clientLineId: LINE_2_ID, printLineNumber: 2,
      descriptionSnapshot: "Frozen 10-line executive SIP phone", quantity: "3.00000000", uomId: UOM_EA_ID,
      unitPrice: "3950.00", discountTotal: isMixed ? "100.00" : isDocAmount ? "1248.68" : "948.00",
      lineTotal: isMixed ? "11750.00" : isDocAmount ? "10601.32" : "10902.00",
      taxSnapshot: { sku: "YEALINK-T54W-IP", uomCode: "EA" },
      discountSnapshot: { itemId: ITEM_PHONE_ID, ...(isMixed ? { discount: { type: "AMOUNT", value: "100.00000000" } } : {}) },
    },
    ...(isMixed ? [{
      id: "01890000-0000-7000-8000-000000000033", clientLineId: LINE_3_ID, printLineNumber: 3,
      descriptionSnapshot: "Frozen Cat6A patch cord", quantity: "1.00000000", uomId: UOM_EA_ID,
      unitPrice: "3950.00", discountTotal: "0.00", lineTotal: "3950.00",
      taxSnapshot: { sku: "CAT6A-PATCH-3M", uomCode: "EA" },
      discountSnapshot: { itemId: ITEM_CABLE_ID },
    }] : []),
    {
      id: "01890000-0000-7000-8000-000000000031", clientLineId: LINE_1_ID, printLineNumber: 1,
      descriptionSnapshot: "Frozen 50-extension cloud PBX license", quantity: "2.00000000", uomId: UOM_EA_ID,
      unitPrice: "17800.00", discountTotal: isMixed ? "1780.00" : isDocAmount ? "3751.32" : "2848.00",
      lineTotal: isMixed ? "33820.00" : isDocAmount ? "31848.68" : "32752.00",
      taxSnapshot: { sku: "CLOUD-PBX-PRO-50", uomCode: "EA" },
      discountSnapshot: { itemId: ITEM_PBX_ID, priceBookId: BOOK_ID, ...(isMixed ? { discount: { type: "PERCENT", value: "5.00000000" } } : {}) },
    },
  ];
  const subtotal = isMixed ? "51400.00" : "47450.00";
  const discountTotal = isMixed ? "1880.00" : isDocAmount ? "5000.00" : "3796.00";
  const grandTotal = isMixed ? "49520.00" : isDocAmount ? "42450.00" : "43654.00";
  return {
    id: QUOTE_ID, version: 3, companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: null,
    partyId: PARTY_ID, crmCustomerProfileId: CRM_PROFILE_ID, customerEligibilitySource: "CRM_PROFILE",
    contactPartyId: CONTACT_ID, currencyCode: "EGP", businessDate: "2026-11-14",
    lifecycleStatus: isSent ? "SENT" : "DRAFT", approvalStatus: "NOT_REQUIRED", fulfillmentStatus: "UNPLANNED", billingStatus: "NOT_BILLED",
    grandTotal, documentNumber: isSent ? "QT-000088" : null, draftReference: "RFQ-DENSE-27",
    partySnapshot: { displayName: "Nile Telecom Group" }, createdBy: null,
    createdAt: "2026-11-14T01:00:00.000Z", updatedAt: "2026-11-14T01:00:00.000Z",
    currentRevisionId: REV_1_ID, acceptedRevisionId: null,
    revisions: [{
      id: REV_1_ID, revisionNumber: 1, status: isSent ? "SENT" : "DRAFT", validUntil: "2099-12-31",
      subtotal, discountTotal, grandTotal, pricingMode: "DISCOUNT",
      discountSnapshot: {
        pricing: isMixed
          ? { mode: "DISCOUNT", scope: "LINE", reason: "Partner bundle tier" }
          : isDocAmount
            ? { mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "5000.00000000", reason: "Project cap" }
            : { mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "8.00000000", reason: "Seasonal offer" },
        limitsSnapshot: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
        totals: { subtotal, discountTotal, grandTotal, baseSubtotal: subtotal, promotionSavings: "0.00" },
      },
      termsSnapshot: { paymentTermCode: "NET_45", incotermCode: "CIF", deliveryDays: 21, warrantyMonths: 24, customClause: "KEEP_ME" },
      sentAt: isSent ? "2026-11-14T01:30:00.000Z" : null, acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null,
    }],
    currentLines: lines,
  };
}

describe("Shared Quotation Create/Edit Workspace UI Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.lang = "en";
    state.setPermissions(state.defaultPerms, false);
    seedLanguageSnapshot({ lang: "en", dictionary: en });
    seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    setLanguage("en");
    state.loadCurrenciesMock.mockResolvedValue([{ code: "EGP", name: "Egyptian Pound", symbol: "EGP", isDefault: true }]);
  });

  afterEach(cleanup);

  function installTradeMocks(detailPayload: unknown, options?: { policyForbidden?: boolean; detailForbidden?: boolean }) {
    state.tradeGetMock.mockImplementation(async (path: string) => {
      if (path.endsWith(`/quotations/${QUOTE_ID}`)) {
        if (options?.detailForbidden) throw apiError(403, "AUTH.FORBIDDEN");
        return reply(detailPayload);
      }
      if (path.includes("/quotations/discount-policy")) {
        if (options?.policyForbidden) throw apiError(403, "AUTH.FORBIDDEN");
        return reply({
          canApply: true, hasApplyPermission: true, canManage: false, configured: true,
          limit: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
        });
      }
      if (path.includes("/quotations/contact-options")) {
        return reply({
          partyType: "ORGANIZATION",
          items: [{ partyId: CONTACT_ID, displayName: "Mariam Hassan", relationshipType: "CONTACT_PERSON", relationshipLabel: null, isPrimary: true, email: null, mobile: null, phone: null }],
        });
      }
      if (path.includes("/quotations/customer-options")) {
        return reply({ items: [] });
      }
      if (path.includes("/catalog/uoms") || path.includes("/uoms")) {
        return reply({ items: [{ id: UOM_EA_ID, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true }], total: 1, page: 1, limit: 100 });
      }
      const singleItem = CATALOG_ITEMS.find((entry) => path.endsWith(`/items/${entry.id}`));
      if (singleItem) {
        return reply({
          id: singleItem.id, canonicalCode: singleItem.canonicalCode, barcode: singleItem.barcode, status: singleItem.status,
          image: singleItem.image, baseUomId: singleItem.eligibility.baseUomId,
          localizedNames: singleItem.localizedNames, quotationDescription: singleItem.quotationDescription,
          companyProfile: {
            id: singleItem.eligibility.companyProfileId, version: singleItem.eligibility.companyProfileVersion,
            status: singleItem.eligibility.companyProfileStatus, canSell: singleItem.eligibility.canSell,
            canPurchase: singleItem.eligibility.canPurchase, canPos: singleItem.eligibility.canPos,
            defaultSalesUomId: singleItem.eligibility.defaultSalesUomId, defaultPurchaseUomId: singleItem.eligibility.defaultPurchaseUomId,
          },
          branchProfile: {
            id: singleItem.eligibility.branchProfileId, version: singleItem.eligibility.branchProfileVersion,
            isAssorted: singleItem.eligibility.isAssorted,
          },
        });
      }
      if (path.includes("/items")) {
        return reply({ items: CATALOG_ITEMS, total: 3, page: 1, limit: 100 });
      }
      return reply(detailPayload);
    });
    state.tradePostMock.mockImplementation(async (path: string, body: unknown) => {
      if (path.endsWith("/quotations/pricing-preview")) return reply(buildPreview(body as QuotationPricingRequest));
      const base = detailPayload as ReturnType<typeof buildPersistedQuotation>;
      return reply({ ...base.revisions[0]!, id: REV_2_ID, revisionNumber: 2, status: "DRAFT", sentAt: null, lines: base.currentLines });
    });
  }

  it("composes the shared workspace across /new and /[id], hydrating persisted LINE mixed PERCENT/AMOUNT, frozen Description, and round-trip save", async () => {
    const persisted = buildPersistedQuotation("LINE_MIXED");
    installTradeMocks(persisted);

    const createRender = render(<CreateQuotationStandalonePage />);
    expect(screen.getByTestId("quotation-workspace")).toBeTruthy();
    expect(screen.getByRole("button", { name: en.tradeDocuments.quotations.saveQuotation })).toBeDisabled();
    createRender.unmount();
    state.loadCurrenciesMock.mockClear();

    render(<Suspense fallback={null}><QuotationDetailPage params={routeParams()} /></Suspense>);
    const table = await screen.findByRole("table", {}, { timeout: 4000 });
    await waitFor(() => expect(within(table).getByText(/35,600\.00/)).toBeTruthy(), { timeout: 4000 });
    expect(within(within(table).getAllByRole("row").at(-1)!).getByText(/-.*1,880\.00/)).toBeTruthy();

    expect(screen.getByTestId("quotation-workspace")).toBeTruthy();
    expect(state.loadCurrenciesMock).not.toHaveBeenCalled();
    expect(state.tradeGetMock.mock.calls.some(([p]) => String(p).includes("customer-options"))).toBe(false);
    expect(screen.getByLabelText(en.tradeDocuments.customer)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("textbox", { name: en.tradeDocuments.currency })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: en.quotationFlow.documentReference })).toHaveValue("RFQ-DENSE-27");
    expect(screen.getByRole("textbox", { name: en.quotationFlow.documentReference })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: en.common.save })).toBeDisabled();

    // Persisted LINE mixed PERCENT + AMOUNT (row-once on qty=3) + undiscounted 3rd row in printLineNumber order
    expect(screen.getByRole("textbox", { name: new RegExp(`^${en.quotationDiscount.reason}`) })).toHaveValue("Partner bundle tier");
    expect(within(table).getByRole("columnheader", { name: en.quotationDiscount.lineDiscount })).toBeTruthy();
    expect(within(table).getByRole("textbox", { name: `${en.quotationExperience.quantity} 1` })).toHaveValue("2");
    expect(within(table).getByRole("textbox", { name: `${en.quotationDiscount.lineDiscount} 1` })).toHaveValue("5");
    expect(within(table).getByRole("textbox", { name: `${en.quotationExperience.quantity} 2` })).toHaveValue("3");
    expect(within(table).getByRole("textbox", { name: `${en.quotationDiscount.lineDiscount} 2` })).toHaveValue("100");
    expect(within(table).getByRole("textbox", { name: `${en.quotationExperience.quantity} 3` })).toHaveValue("1");
    expect(within(table).getByRole("textbox", { name: `${en.quotationDiscount.lineDiscount} 3` })).toHaveValue("0");
    for (const [number, type, suffix] of [[1, en.quotationDiscount.percent, "%"], [2, en.quotationDiscount.amount, "EGP"]] as const) {
      const typeControl = within(table).getByRole("combobox", { name: `${en.quotationDiscount.type} ${number}` });
      const valueControl = within(table).getByRole("textbox", { name: `${en.quotationDiscount.lineDiscount} ${number}` });
      expect(typeControl).toHaveTextContent(type);
      expect(typeControl.closest("td")).toContainElement(valueControl);
      expect(within(valueControl.closest("td")!).getByText(suffix)).toBeVisible();
    }
    expect(within(table).getByText(/11,850\.00/)).toBeTruthy();

    // Accessible read-only Description column uses frozen descriptionSnapshot, never live mutated catalogue text
    expect(within(table).getByRole("columnheader", { name: en.dashboard.description })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /description/i })).toBeNull();
    const description = within(table).getByText(/Frozen 50-extension cloud PBX license/i);
    expect(description).toHaveClass("whitespace-pre-wrap");
    expect(within(table).queryByText(/MUTATED LIVE CATALOG DESC/)).toBeNull();
    // Hydrated terms + single-field UI edit preserves mixed discounts, priceBookId, and unknown terms on POST /revisions
    expect(screen.getByRole("button", { name: new RegExp(en.quotationExperience.termsSection) })).toHaveTextContent("NET_45");
    fireEvent.change(within(table).getByRole("textbox", { name: `${en.quotationExperience.quantity} 1` }), { target: { value: "4" } });
    const saveButton = screen.getByRole("button", { name: en.common.save });
    await waitFor(() => expect(saveButton).toBeEnabled(), { timeout: 4000 });
    await act(async () => { fireEvent.click(saveButton); });

    const revCall = state.tradePostMock.mock.calls.find(([p]) => String(p).endsWith("/revisions"));
    const revHeaders = (revCall?.[2] as { headers?: Record<string, string> } | undefined)?.headers;
    expect(revHeaders?.[COMPANY_SCOPE_HEADER]).toBe(COMPANY_ID);
    expect(revHeaders?.[BRANCH_SCOPE_HEADER]).toBe(BRANCH_ID);
    expect(revHeaders?.[CHANNEL_SCOPE_HEADER]).toBeUndefined();
    expect(revCall?.[1]).toMatchObject({
      pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Partner bundle tier" },
      lines: [
        { clientLineId: LINE_1_ID, itemId: ITEM_PBX_ID, quantity: "4", priceBookId: BOOK_ID, discount: { type: "PERCENT", value: "5" } },
        { clientLineId: LINE_2_ID, itemId: ITEM_PHONE_ID, quantity: "3", discount: { type: "AMOUNT", value: "100" } },
        { clientLineId: LINE_3_ID, itemId: ITEM_CABLE_ID, quantity: "1" },
      ],
      terms: { paymentTermCode: "NET_45", incotermCode: "CIF", deliveryDays: 21, warrantyMonths: 24, customClause: "KEEP_ME" },
    });
  }, 15_000);

  it("hydrates DOCUMENT fixed AMOUNT mode and hydrates inline RTL DOCUMENT PERCENT editing on SENT", async () => {
    installTradeMocks(buildPersistedQuotation("DOC_AMOUNT"));
    const first = render(<Suspense fallback={null}><QuotationDetailPage params={routeParams()} /></Suspense>);
    const amountTable = await screen.findByRole("table", {}, { timeout: 4000 });
    await waitFor(() => expect(within(amountTable).getByText(/-.*5,000\.00/)).toBeTruthy(), { timeout: 4000 });

    expect(screen.getByRole("textbox", { name: new RegExp(`^${en.quotationDiscount.value}`) })).toHaveValue("5000");
    expect(screen.getByRole("textbox", { name: new RegExp(`^${en.quotationDiscount.reason}`) })).toHaveValue("Project cap");
    expect(within(amountTable).queryByRole("columnheader", { name: en.quotationDiscount.allocatedDiscount })).toBeNull();
    expect(within(amountTable).queryByRole("columnheader", { name: en.quotationDiscount.lineDiscount })).toBeNull();
    expect(within(amountTable).queryByRole("textbox", { name: new RegExp(en.quotationDiscount.lineDiscount) })).toBeNull();
    expect(within(amountTable).getAllByRole("row").at(-1)).toHaveTextContent(en.quotationDiscount.discount);
    expect(within(amountTable).getByRole("rowheader", { name: en.quotationDiscount.discount })).toHaveAttribute("colspan", "7");
    first.unmount();

    // SENT and DRAFT share the same editor, even before saving.
    state.lang = "ar";
    setLanguage("ar");
    installTradeMocks(buildPersistedQuotation("DOC_PERCENT_SENT"));
    render(<Suspense fallback={null}><QuotationDetailPage params={routeParams()} /></Suspense>);

    const editTable = await screen.findByRole("table", {}, { timeout: 4000 });
    await waitFor(() => expect(within(editTable).getAllByRole("row").at(-1)).toHaveTextContent(ar.quotationDiscount.discount), { timeout: 4000 });
    expect(screen.getByRole("textbox", { name: ar.quotationFlow.documentReference })).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText(ar.quotationExperience.contactLabel)).not.toHaveAttribute("aria-readonly");
    const pctInput = screen.getByRole("textbox", { name: new RegExp(`^${ar.quotationDiscount.percentValue}`) });
    expect(pctInput).toHaveAttribute("dir", "ltr");
    expect(pctInput).toHaveValue("8");
    expect(within(editTable).getByRole("columnheader", { name: ar.dashboard.description })).toBeTruthy();
  }, 15_000);

  it("enforces PermissionGate on missing create grant, 403 detail read, and 403 edit discount-policy probe", async () => {
    state.setPermissions(["trade.quotations.read"], false);
    const deniedCreate = render(<CreateQuotationStandalonePage />);
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
    expect(screen.queryByTestId("quotation-workspace")).toBeNull();
    deniedCreate.unmount();

    installTradeMocks(buildPersistedQuotation("LINE_MIXED"), { detailForbidden: true });
    const deniedDetail = render(<Suspense fallback={null}><QuotationDetailPage params={routeParams()} /></Suspense>);
    expect(await screen.findByText(en.permissionGate.title, {}, { timeout: 4000 })).toBeTruthy();
    deniedDetail.unmount();

    state.setPermissions(["trade.quotations.read", "trade.quotations.update", "trade.items.read"], false);
    installTradeMocks(buildPersistedQuotation("LINE_MIXED"), { policyForbidden: true });
    render(<Suspense fallback={null}><QuotationDetailPage params={routeParams()} /></Suspense>);
    expect(await screen.findByText(en.permissionGate.title, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(en.permissionGate.description)).toBeTruthy();
  }, 15_000);
});
