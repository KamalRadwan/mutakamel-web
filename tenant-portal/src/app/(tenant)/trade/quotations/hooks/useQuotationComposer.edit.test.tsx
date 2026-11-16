// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { peekLanguageSnapshot } from "@/i18n/dictionary-store";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import type { QuotationDetail } from "../quotation-contract";
import type { QuotationPricingRequest } from "../quotation-discount-contract";
import { parseQuotationPricingRequestMock } from "./quotation-edit.test-helpers";

const { auth, tradeGetMock, tradePostMock, tradePatchMock, loadCurrenciesMock, toast, router } = vi.hoisted(() => ({
  auth: {
    user: { id: "01890000-0000-7000-8000-000000000090", isTenantOwner: true } as { id: string; isTenantOwner?: boolean } | null,
    realtimeAuthGeneration: "tenant:session-a:01890000-0000-7000-8000-000000000090" as string | null,
    readReadyProfileCommit: vi.fn(),
  },
  tradeGetMock: vi.fn(),
  tradePostMock: vi.fn(),
  tradePatchMock: vi.fn(),
  loadCurrenciesMock: vi.fn(),
  router: { push: vi.fn() },
  toast: {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/app/(tenant)/core/contracts/currency-options", () => ({ loadActiveCurrencyOptions: loadCurrenciesMock }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => router,
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: tradeGetMock,
  tradePost: tradePostMock,
  tradePatch: tradePatchMock,
}));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => {
    const snapshot = peekLanguageSnapshot("en");
    if (!snapshot) throw new Error("tests/i18n.ts must preload English");
    return { t: snapshot.dictionary, lang: "en", dir: "ltr" };
  },
}));

import { useQuotationComposer } from "./useQuotationComposer";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
const CHANNEL_ID = "01890000-0000-7000-8000-000000000005";
const AMBIENT_CHANNEL_ID = "01890000-0000-7000-8000-000000000006";
const PARTY_ID = "01890000-0000-7000-8000-000000000003";
const CRM_PROFILE_ID = "01890000-0000-7000-8000-000000000008";
const CONTACT_ID = "01890000-0000-7000-8000-000000000004";
const QUOTE_ID = "01890000-0000-7000-8000-000000000010";
const REV_1_ID = "01890000-0000-7000-8000-000000000011";
const REV_2_ID = "01890000-0000-7000-8000-000000000012";
const ITEM_A_ID = "01890000-0000-7000-8000-000000000020";
const ITEM_B_ID = "01890000-0000-7000-8000-000000000025";
const PROFILE_A_ID = "01890000-0000-7000-8000-000000000022";
const PROFILE_B_ID = "01890000-0000-7000-8000-000000000026";
const UOM_ID = "01890000-0000-7000-8000-000000000021";
const BOOK_ID = "01890000-0000-7000-8000-000000000040";
const LINE_1_CLIENT_ID = "01890000-0000-7000-8000-000000000061";
const LINE_2_CLIENT_ID = "01890000-0000-7000-8000-000000000062";
const LIMIT_ID = "01890000-0000-7000-8000-000000000070";

function reply(data: unknown, replayed = false) {
  return { data, headers: new Headers(replayed ? { "Idempotency-Replayed": "true" } : {}) };
}

function apiError(status: number, code: string) {
  return new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: { code } });
}

const CATALOG_ITEMS = [
  {
    id: ITEM_A_ID, canonicalCode: "CLOUD-PBX-PRO-50", barcode: null,
    localizedNames: { en: "Cloud PBX Pro 50" }, quotationDescription: "50-extension cloud PBX license",
    salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    status: "ACTIVE", image: null,
    eligibility: {
      companyProfileId: PROFILE_A_ID, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_ID,
      defaultSalesUomId: UOM_ID, defaultPurchaseUomId: UOM_ID,
      branchProfileId: "01890000-0000-7000-8000-000000000023", branchProfileVersion: 1, isAssorted: true,
    },
  },
  {
    id: ITEM_B_ID, canonicalCode: "YEALINK-T54W-IP", barcode: null,
    localizedNames: { en: "Yealink T54W IP Phone" }, quotationDescription: "10-line executive SIP phone",
    salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
    status: "ACTIVE", image: null,
    eligibility: {
      companyProfileId: PROFILE_B_ID, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_ID,
      defaultSalesUomId: UOM_ID, defaultPurchaseUomId: UOM_ID,
      branchProfileId: "01890000-0000-7000-8000-000000000027", branchProfileVersion: 1, isAssorted: true,
    },
  },
];

function buildSavedMixedLineQuotation(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: QUOTE_ID,
    version: 3,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    channelId: null,
    partyId: PARTY_ID,
    crmCustomerProfileId: CRM_PROFILE_ID,
    customerEligibilitySource: "CRM_PROFILE",
    contactPartyId: null,
    currencyCode: "EGP",
    businessDate: "2026-11-14",
    lifecycleStatus: "DRAFT",
    approvalStatus: "NOT_REQUIRED",
    fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED",
    grandTotal: "45570.00",
    documentNumber: null,
    draftReference: "RFQ-EDIT-01",
    partySnapshot: { displayName: "Mersany Telecom LLC" },
    createdBy: null,
    createdAt: "2026-11-14T01:00:00.000Z",
    updatedAt: "2026-11-14T01:00:00.000Z",
    currentRevisionId: REV_1_ID,
    acceptedRevisionId: null,
    revisions: [
      {
        id: REV_1_ID,
        revisionNumber: 1,
        status: "DRAFT",
        validUntil: "2099-12-31",
        subtotal: "47400.00",
        discountTotal: "1830.00",
        grandTotal: "45570.00",
        pricingMode: "DISCOUNT",
        discountSnapshot: {
          pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Partner bundle tier" },
          limitsSnapshot: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
          totals: { subtotal: "47400.00", discountTotal: "1830.00", grandTotal: "45570.00", baseSubtotal: "47400.00", promotionSavings: "0" },
        },
        termsSnapshot: {
          paymentTermCode: "NET_45",
          incotermCode: "CIF",
          deliveryDays: 21,
          warrantyMonths: 24,
          customClause: "KEEP_ME",
          grandTotal: "999999.99",
        },
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
      },
    ],
    currentLines: [
      {
        id: "01890000-0000-7000-8000-000000000032",
        clientLineId: LINE_2_CLIENT_ID,
        printLineNumber: 2,
        descriptionSnapshot: "10-line executive SIP phone",
        quantity: "3.00000000",
        uomId: UOM_ID,
        unitPrice: "4200.00",
        discountTotal: "100.00",
        lineTotal: "12500.00",
        discountSnapshot: { itemId: ITEM_B_ID, discount: { type: "AMOUNT", value: "100.00000000" } },
      },
      {
        id: "01890000-0000-7000-8000-000000000031",
        clientLineId: LINE_1_CLIENT_ID,
        printLineNumber: 1,
        descriptionSnapshot: "50-extension cloud PBX license",
        quantity: "2.00000000",
        uomId: UOM_ID,
        unitPrice: "17400.00",
        discountTotal: "1740.00",
        lineTotal: "33060.00",
        discountSnapshot: { itemId: ITEM_A_ID, priceBookId: BOOK_ID, discount: { type: "PERCENT", value: "5.00000000" } },
      },
    ],
    ...overrides,
  };
}

describe("useQuotationComposer unified Edit & Supersede integration (unmocked collaborators)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.readReadyProfileCommit.mockImplementation(() => auth.user && ({
      user: auth.user, sessionRevision: JSON.stringify(["session-a", 1, 1]), sequence: 1,
    }));
    loadCurrenciesMock.mockResolvedValue([]);
    tradeGetMock.mockImplementation(async (path: string) => {
      if (path.includes("/quotations/discount-policy")) {
        return reply({
          canApply: true, hasApplyPermission: true, canManage: false, configured: true,
          limit: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
        });
      }
      if (path.includes("/quotations/contact-options")) {
        return reply({
          partyType: "ORGANIZATION",
          items: [{
            partyId: CONTACT_ID, displayName: "Nour El-Din", relationshipType: "CONTACT_PERSON",
            relationshipLabel: "Procurement", isPrimary: true, email: null, mobile: null, phone: null,
          }],
        });
      }
      if (path.includes("/uoms/catalogue")) {
        return reply({
          items: [{ id: UOM_ID, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true }],
          total: 1, page: 1, limit: 50,
        });
      }
      if (path.includes("/items/") && !path.includes("?")) {
        const found = CATALOG_ITEMS.find((entry) => path.endsWith(`/${entry.id}`));
        if (!found) throw apiError(404, "ITEM_NOT_FOUND");
        return reply({
          ...found,
          baseUomId: UOM_ID,
          companyProfile: {
            id: found.eligibility.companyProfileId, version: 1, status: "ACTIVE",
            canSell: true, canPurchase: false, canPos: false,
            defaultSalesUomId: null, defaultPurchaseUomId: null,
          },
          branchProfile: {
            id: found.eligibility.branchProfileId,
            version: 1,
            isAssorted: true,
          },
        });
      }
      if (path.includes("/items")) {
        return reply({ items: CATALOG_ITEMS, total: 2, page: 1, limit: 50 });
      }
      return reply(buildSavedMixedLineQuotation({ version: 4 }));
    });
    tradePostMock.mockImplementation(async (path: string, body: unknown) => {
      if (path.endsWith("/quotations/pricing-preview")) {
        return reply(parseQuotationPricingRequestMock(body as QuotationPricingRequest, LIMIT_ID));
      }
      return reply({
        ...buildSavedMixedLineQuotation().revisions[0]!,
        id: REV_2_ID,
        revisionNumber: 2,
        lines: buildSavedMixedLineQuotation().currentLines,
      });
    });
  });

  it("hydrates persisted lines in printLineNumber order, canonicalizes decimals, pins null-channel scope, and starts clean", async () => {
    const existing = buildSavedMixedLineQuotation({ channelId: null });
    const ambientHeaders = {
      [COMPANY_SCOPE_HEADER]: COMPANY_ID,
      [BRANCH_SCOPE_HEADER]: BRANCH_ID,
      [CHANNEL_SCOPE_HEADER]: AMBIENT_CHANNEL_ID,
    };
    const { result } = renderHook(() => useQuotationComposer({
      headers: ambientHeaders,
      isEnabled: true,
      canCreate: false,
      canUpdate: true,
      canSend: true,
      existingQuotation: existing,
    }));

    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.lineDraft.lines.map((l) => l.clientLineId)).toEqual([LINE_1_CLIENT_ID, LINE_2_CLIENT_ID]);
    expect(result.current.lineDraft.lines.map((l) => l.quantity)).toEqual(["2", "3"]);
    expect(result.current.discount).toEqual({
      mode: "DISCOUNT",
      scope: "LINE",
      type: "PERCENT",
      value: "0",
      reason: "Partner bundle tier",
      lineDiscounts: {
        [LINE_1_CLIENT_ID]: { type: "PERCENT", value: "5" },
        [LINE_2_CLIENT_ID]: { type: "AMOUNT", value: "100" },
      },
    });
    expect(result.current.paymentTermCode).toBe("NET_45");
    expect(result.current.incotermCode).toBe("CIF");
    expect(result.current.deliveryDays).toBe("21");
    expect(result.current.warrantyMonths).toBe("24");
    expect(loadCurrenciesMock).not.toHaveBeenCalled();
    expect(tradeGetMock.mock.calls.some(([p]) => String(p).includes("customer-options"))).toBe(false);

    const previewCall = tradePostMock.mock.calls.find(([p]) => String(p).endsWith("/pricing-preview"));
    expect(previewCall?.[1]).toMatchObject({
      partyId: PARTY_ID,
      crmCustomerProfileId: CRM_PROFILE_ID,
      lines: [
        { clientLineId: LINE_1_CLIENT_ID, itemId: ITEM_A_ID, quantity: "2", priceBookId: BOOK_ID, discount: { type: "PERCENT", value: "5" } },
        { clientLineId: LINE_2_CLIENT_ID, itemId: ITEM_B_ID, quantity: "3", discount: { type: "AMOUNT", value: "100" } },
      ],
    });
    expect(previewCall?.[2]?.headers?.[CHANNEL_SCOPE_HEADER]).toBeUndefined();
  });

  it("executes header-only PATCH without creating a revision when only draftReference or contact changes", async () => {
    const existing = buildSavedMixedLineQuotation({ channelId: CHANNEL_ID });
    tradePatchMock.mockResolvedValueOnce(reply({ ...existing, version: 4, draftReference: "RFQ-HEADER-ONLY", contactPartyId: CONTACT_ID }));

    const { result } = renderHook(() => useQuotationComposer({
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      isEnabled: true, canCreate: false, canUpdate: true, canSend: true, existingQuotation: existing,
    }));

    await waitFor(() => expect(result.current.contacts.partyType).toBe("ORGANIZATION"));
    act(() => {
      result.current.setDraftReference("RFQ-HEADER-ONLY");
      result.current.selectContact(CONTACT_ID);
    });

    expect(result.current.headerDirty).toBe(true);
    expect(result.current.commercialDirty).toBe(false);
    expect(result.current.canSubmit).toBe(true);

    let saved = false;
    await act(async () => { saved = await result.current.submit(); });
    expect(saved).toBe(true);
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePatchMock.mock.calls[0]?.[1]).toEqual({ draftReference: "RFQ-HEADER-ONLY", contactPartyId: CONTACT_ID });
    expect(tradePatchMock.mock.calls[0]?.[2]?.headers).toMatchObject({
      [CHANNEL_SCOPE_HEADER]: CHANNEL_ID,
      "if-match": '"3"',
    });
    expect(tradePostMock.mock.calls.filter(([p]) => String(p).endsWith("/revisions"))).toHaveLength(0);
  });

  it("preserves hydrated discounts, priceBookId, and unknown terms while stripping forbidden monetary keys on single-field edit", async () => {
    const existing = buildSavedMixedLineQuotation();
    const { result } = renderHook(() => useQuotationComposer({
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      isEnabled: true, canCreate: false, canUpdate: true, canSend: true, existingQuotation: existing,
    }));

    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });

    act(() => { result.current.lineDraft.setQuantity(0, "4"); });
    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });
    expect(result.current.canSubmit).toBe(true);

    await act(async () => { await result.current.submit(); });

    expect(tradePatchMock).not.toHaveBeenCalled();
    const revCalls = tradePostMock.mock.calls.filter(([p]) => String(p).endsWith("/revisions"));
    expect(revCalls).toHaveLength(1);
    const payload = revCalls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      validUntil: "2099-12-31",
      pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Partner bundle tier" },
      lines: [
        { clientLineId: LINE_1_CLIENT_ID, itemId: ITEM_A_ID, quantity: "4", priceBookId: BOOK_ID, discount: { type: "PERCENT", value: "5" } },
        { clientLineId: LINE_2_CLIENT_ID, itemId: ITEM_B_ID, quantity: "3", discount: { type: "AMOUNT", value: "100" } },
      ],
      terms: {
        paymentTermCode: "NET_45",
        incotermCode: "CIF",
        deliveryDays: 21,
        warrantyMonths: 24,
        customClause: "KEEP_ME",
      },
    });
    expect((payload.terms as Record<string, unknown>).grandTotal).toBeUndefined();
  });

  it("chains PATCH (v3->v4) into POST /revisions (If-Match: v4) and replays ambiguous Step 2 with exact key without duplicate PATCH", async () => {
    const existing = buildSavedMixedLineQuotation();
    tradePatchMock.mockResolvedValueOnce(reply({ ...existing, version: 4, draftReference: "COMBINED-REF" }));
    let revAttempts = 0;
    tradePostMock.mockImplementation(async (path: string, body: unknown) => {
      if (path.endsWith("/quotations/pricing-preview")) {
        return reply(parseQuotationPricingRequestMock(body as QuotationPricingRequest, LIMIT_ID));
      }
      revAttempts += 1;
      if (revAttempts === 1) throw apiError(0, "NETWORK_ERROR");
      return reply({
        ...existing.revisions[0]!,
        id: REV_2_ID,
        revisionNumber: 2,
        lines: existing.currentLines,
      }, true);
    });

    const { result } = renderHook(() => useQuotationComposer({
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      isEnabled: true, canCreate: false, canUpdate: true, canSend: true, existingQuotation: existing,
    }));

    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });
    act(() => {
      result.current.setDraftReference("COMBINED-REF");
      result.current.setValidUntil("2099-12-25");
    });

    await act(async () => { await result.current.submit(); });
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(revAttempts).toBe(1);
    expect(result.current.write.ambiguous).not.toBeNull();

    const firstRevCall = tradePostMock.mock.calls.find(([p]) => String(p).endsWith("/revisions"));
    expect(firstRevCall?.[2]?.headers?.["if-match"]).toBe('"4"');

    await act(async () => { await result.current.write.ambiguous?.retry(); });
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(revAttempts).toBe(2);
    const allRevCalls = tradePostMock.mock.calls.filter(([p]) => String(p).endsWith("/revisions"));
    expect(allRevCalls[1]).toEqual(allRevCalls[0]);
    expect(result.current.write.ambiguous).toBeNull();
  });

  it("edits an issued quotation inline and requires confirmation to save a replacement draft", async () => {
    const r1Sent = {
      ...buildSavedMixedLineQuotation().revisions[0]!,
      status: "SENT" as const,
      sentAt: "2026-11-14T02:00:00.000Z",
    };
    const issued = buildSavedMixedLineQuotation({
      lifecycleStatus: "SENT",
      documentNumber: "QT-000099",
      revisions: [r1Sent],
    });
    const r2Draft = { ...r1Sent, id: REV_2_ID, revisionNumber: 2, status: "DRAFT" as const, sentAt: null, grandTotal: "45570.00" };
    tradeGetMock.mockImplementation(async (path: string) => {
      if (path.includes("/quotations/discount-policy")) {
        return reply({
          canApply: true, hasApplyPermission: true, canManage: false, configured: true,
          limit: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
        });
      }
      if (path.includes("/uoms/catalogue")) {
        return reply({
          items: [{ id: UOM_ID, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true }],
          total: 1, page: 1, limit: 50,
        });
      }
      if (path.includes("/items/") && !path.includes("?")) {
        const found = CATALOG_ITEMS.find((entry) => path.endsWith(`/${entry.id}`));
        if (!found) throw apiError(404, "ITEM_NOT_FOUND");
        return reply({
          ...found,
          baseUomId: UOM_ID,
          companyProfile: {
            id: found.eligibility.companyProfileId, version: 1, status: "ACTIVE",
            canSell: true, canPurchase: false, canPos: false,
            defaultSalesUomId: null, defaultPurchaseUomId: null,
          },
          branchProfile: {
            id: found.eligibility.branchProfileId,
            version: 1,
            isAssorted: true,
          },
        });
      }
      if (path.includes("/items")) return reply({ items: CATALOG_ITEMS, total: 2, page: 1, limit: 50 });
      return reply({
        ...issued,
        version: 4,
        lifecycleStatus: "DRAFT",
        currentRevisionId: REV_2_ID,
        grandTotal: "45570.00",
        revisions: [r2Draft, r1Sent],
      });
    });

    const onSaved = vi.fn();
    const { result } = renderHook(() => useQuotationComposer({
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      isEnabled: true, canCreate: false, canUpdate: true, canSend: true,
      existingQuotation: issued, onSaved,
    }));

    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });
    expect(result.current.headerFieldsLocked).toBe(false);
    expect(result.current.canSubmit).toBe(false);
    act(() => { result.current.lineDraft.setQuantity(0, "3"); });
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    await act(async () => { expect(await result.current.submit()).toBe(false); });
    await act(async () => { expect(await result.current.submit({ confirmIssuedChange: true })).toBe(true); });
    expect(tradePatchMock).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    const updated = onSaved.mock.calls[0]?.[0] as QuotationDetail;
    expect(updated.documentNumber).toBe("QT-000099");
    expect(updated.lifecycleStatus).toBe("DRAFT");
    expect(updated.revisions.find((r) => r.revisionNumber === 1)).toEqual(r1Sent);
  });

  it("blocks pricing-preview and submit when an unresolved legacy line exists until replaced or removed", async () => {
    const unresolved = buildSavedMixedLineQuotation({
      currentLines: [
        {
          id: "01890000-0000-7000-8000-000000000039",
          clientLineId: LINE_1_CLIENT_ID,
          printLineNumber: 1,
          descriptionSnapshot: "Legacy Unresolved Hardware",
          quantity: "1",
          uomId: UOM_ID,
          unitPrice: "5000.00",
          discountTotal: "0",
          lineTotal: "5000.00",
          discountSnapshot: {},
        },
        buildSavedMixedLineQuotation().currentLines[0]!,
      ],
    });

    const { result } = renderHook(() => useQuotationComposer({
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      isEnabled: true, canCreate: false, canUpdate: true, canSend: true, existingQuotation: unresolved,
    }));

    await waitFor(() => expect(result.current.hasUnavailableLines).toBe(true));
    expect(result.current.pricing.request).toBeNull();
    expect(result.current.canSubmit).toBe(false);

    act(() => { result.current.lineDraft.removeLine(0); });
    await waitFor(() => expect(result.current.hasUnavailableLines).toBe(false));
    await waitFor(() => expect(result.current.pricing.ready).toBe(true), { timeout: 2000 });
    expect(result.current.canSubmit).toBe(true);
  });
});
