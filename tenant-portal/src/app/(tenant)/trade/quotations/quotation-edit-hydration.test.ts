import { describe, expect, it } from "vitest";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "../trade-api";
import type { TradeItemOption, TradeUomOption } from "../documents/trade-lookup-contract";
import type { QuotationDetail, QuotationLine, QuotationRevision } from "./quotation-contract";
import {
  QUOTATION_FORBIDDEN_TERM_KEYS,
  buildHydratedQuotationPricingRequest,
  buildHydratedQuotationTerms,
  hydrateQuotationDiscountDraft,
  hydrateQuotationEditSnapshot,
  hydrateQuotationTerms,
  quotationEditScopeHeaders,
  reconcileHydratedLineDrafts,
} from "./quotation-edit-hydration";

const QUOTE_ID = "01890000-0000-7000-8000-000000000001";
const COMPANY_ID = "01890000-0000-7000-8000-000000000002";
const BRANCH_ID = "01890000-0000-7000-8000-000000000003";
const CHANNEL_ID = "01890000-0000-7000-8000-000000000004";
const PARTY_ID = "01890000-0000-7000-8000-000000000005";
const CRM_PROFILE_ID = "01890000-0000-7000-8000-000000000006";
const REV_ID = "01890000-0000-7000-8000-000000000007";
const ITEM_1 = "01890000-0000-7000-8000-000000000011";
const ITEM_2 = "01890000-0000-7000-8000-000000000012";
const COMP_PROF_1 = "01890000-0000-7000-8000-000000000021";
const COMP_PROF_2 = "01890000-0000-7000-8000-000000000022";
const UOM_EA = "01890000-0000-7000-8000-000000000031";
const BOOK_ID = "01890000-0000-7000-8000-000000000041";
const LINE_1 = "01890000-0000-7000-8000-000000000051";
const LINE_2 = "01890000-0000-7000-8000-000000000052";

function makeItem(id: string, sku: string, companyProfileId: string, name: string): TradeItemOption {
  return {
    id, canonicalCode: sku, barcode: null, localizedNames: { en: name, ar: name },
    quotationDescription: `${name} spec`, salesOrderDescription: null, receiptDescription: null,
    deliveryOrderDescription: null, status: "ACTIVE", image: null,
    eligibility: {
      companyProfileId, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
      canSell: true, canPurchase: true, canPos: false,
      baseUomId: UOM_EA, defaultSalesUomId: UOM_EA, defaultPurchaseUomId: UOM_EA,
      branchProfileId: BRANCH_ID, branchProfileVersion: 1, isAssorted: true,
    },
  };
}

const UOM_OPTION: TradeUomOption = {
  id: UOM_EA, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true,
};

function makeDetail(lines: QuotationLine[], revision: QuotationRevision | null): QuotationDetail {
  return {
    id: QUOTE_ID, version: 3, companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: CHANNEL_ID,
    partyId: PARTY_ID, contactPartyId: null, currencyCode: "EGP", businessDate: "2026-08-31",
    lifecycleStatus: "DRAFT", approvalStatus: "NOT_REQUIRED", fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED", grandTotal: "180.00000000", documentNumber: "QT-2026-0042",
    draftReference: "RFQ-42", partySnapshot: { displayName: "Al-Mutahida" }, createdBy: null,
    createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z",
    currentRevisionId: revision?.id ?? null, acceptedRevisionId: null,
    crmCustomerProfileId: CRM_PROFILE_ID, customerEligibilitySource: "CRM_CUSTOMER_PROFILE",
    revisions: revision ? [revision] : [], currentLines: lines,
  };
}

describe("quotationEditScopeHeaders & terms hydration", () => {
  it("pins company, branch, and optional channel scope headers from the saved quotation", () => {
    expect(quotationEditScopeHeaders({ companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: CHANNEL_ID })).toEqual({
      [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID, [CHANNEL_SCOPE_HEADER]: CHANNEL_ID,
    });
    expect(quotationEditScopeHeaders({ companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: null })).toEqual({
      [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID,
    });
  });

  it("strips all 12 forbidden monetary override keys while preserving custom non-monetary terms and past validUntil", () => {
    const forbiddenEntries = Object.fromEntries(QUOTATION_FORBIDDEN_TERM_KEYS.map((k) => [k, "999"]));
    const rev: QuotationRevision = {
      id: REV_ID, revisionNumber: 1, status: "DRAFT", validUntil: "2025-01-15",
      grandTotal: "100", subtotal: "100", discountTotal: "0", pricingMode: "PROMOTIONS",
      discountSnapshot: {}, sentAt: null, acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null,
      termsSnapshot: {
        ...forbiddenEntries,
        paymentTermCode: "NET_60", incotermCode: "CIF", deliveryDays: 21, warrantyMonths: 24,
        customerPoRequired: true, notes: "Keep custom key",
      },
    };
    const hydrated = hydrateQuotationTerms(rev);
    expect(hydrated.validUntil).toBe("2025-01-15");
    expect(hydrated.paymentTermCode).toBe("NET_60");
    expect(hydrated.deliveryDays).toBe("21");
    expect(hydrated.preservedTerms).toEqual({ customerPoRequired: true, notes: "Keep custom key" });
    for (const key of QUOTATION_FORBIDDEN_TERM_KEYS) {
      expect(hydrated.rawTermsSnapshot).not.toHaveProperty(key);
    }

    const built = buildHydratedQuotationTerms(hydrated, {
      paymentTermCode: "NET_45", incotermCode: "", deliveryDays: "30", warrantyMonths: "",
    });
    expect(built).toEqual({
      terms: { paymentTermCode: "NET_45", deliveryDays: 30, customerPoRequired: true, notes: "Keep custom key" },
      deliveryDaysError: false, warrantyMonthsError: false, tooLargeError: false,
    });

    const emptyHydrated = hydrateQuotationTerms({ ...rev, termsSnapshot: {} });
    expect(
      buildHydratedQuotationTerms(emptyHydrated, { paymentTermCode: "", incotermCode: "", deliveryDays: "", warrantyMonths: "" }).terms,
    ).toEqual({});
    expect(
      buildHydratedQuotationTerms(emptyHydrated, { paymentTermCode: "", incotermCode: "", deliveryDays: "-3", warrantyMonths: "12" }).deliveryDaysError,
    ).toBe(true);
  });
});

describe("hydrateQuotationDiscountDraft", () => {
  const baseRev: QuotationRevision = {
    id: REV_ID, revisionNumber: 2, status: "DRAFT", validUntil: "2026-10-01",
    grandTotal: "184", subtotal: "200", discountTotal: "16", pricingMode: "DISCOUNT",
    discountSnapshot: {
      pricing: { mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "8.00000000", reason: "Seasonal" },
      totals: { subtotal: "200", discountTotal: "16", grandTotal: "184", baseSubtotal: "200", promotionSavings: "0" },
    },
    termsSnapshot: {}, sentAt: null, acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null,
  };

  it("hydrates PROMOTIONS, DOCUMENT (% / AMOUNT), and mixed LINE (% / AMOUNT) discounts with reason", () => {
    expect(hydrateQuotationDiscountDraft({ ...baseRev, pricingMode: "PROMOTIONS" }, []).mode).toBe("PROMOTIONS");

    const docDraft = hydrateQuotationDiscountDraft(baseRev, []);
    expect(docDraft).toEqual({
      mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "8", reason: "Seasonal", lineDiscounts: {},
    });

    const lines: QuotationLine[] = [
      {
        id: LINE_1, printLineNumber: 1, clientLineId: LINE_1, descriptionSnapshot: "Pump",
        uomId: UOM_EA, quantity: "2.0000", unitPrice: "100.00000000", discountTotal: "20.00000000", lineTotal: "180.00000000",
        discountSnapshot: { itemId: ITEM_1, uomId: UOM_EA, clientLineId: LINE_1, discount: { type: "PERCENT", value: "10.00000000" } },
      },
      {
        id: LINE_2, printLineNumber: 2, clientLineId: LINE_2, descriptionSnapshot: "Seal",
        uomId: UOM_EA, quantity: "1.0000", unitPrice: "50.00000000", discountTotal: "7.50000000", lineTotal: "42.50000000",
        discountSnapshot: { itemId: ITEM_2, uomId: UOM_EA, clientLineId: LINE_2, discount: { type: "AMOUNT", value: "7.50000000" } },
      },
    ];
    const lineDraft = hydrateQuotationDiscountDraft(
      { ...baseRev, discountSnapshot: { pricing: { mode: "DISCOUNT", scope: "LINE", reason: "VIP bundle" } } },
      lines,
    );
    expect(lineDraft).toEqual({
      mode: "DISCOUNT", scope: "LINE", type: "PERCENT", value: "0", reason: "VIP bundle",
      lineDiscounts: {
        [LINE_1]: { type: "PERCENT", value: "10" },
        [LINE_2]: { type: "AMOUNT", value: "7.5" },
      },
    });
  });
});

describe("hydrateQuotationEditSnapshot, reconcileHydratedLineDrafts, and pricing guard", () => {
  const item1 = makeItem(ITEM_1, "PMP-100", COMP_PROF_1, "Centrifugal Pump");
  const item2 = makeItem(ITEM_2, "SEL-200", COMP_PROF_2, "Mechanical Seal");

  it("hydrates modern itemId + priceBookId + canonicalized quantity and resolves legacy row by exact companyProfileId + sku", () => {
    const detail = makeDetail(
      [
        {
          id: LINE_1, printLineNumber: 1, clientLineId: LINE_1, descriptionSnapshot: "Custom pump description",
          uomId: UOM_EA, quantity: "2.00000000", unitPrice: "100.00000000", discountTotal: "10.00000000", lineTotal: "190.00000000",
          itemCompanyProfileId: COMP_PROF_1,
          discountSnapshot: { itemId: ITEM_1, uomId: UOM_EA, clientLineId: LINE_1, priceBookId: BOOK_ID, discount: { type: "AMOUNT", value: "10.00000000" } },
        },
        {
          id: LINE_2, printLineNumber: 2, clientLineId: LINE_2, descriptionSnapshot: "Legacy seal description",
          uomId: UOM_EA, quantity: "3.5000", unitPrice: "20.00000000", discountTotal: "0", lineTotal: "70.00000000",
          itemCompanyProfileId: COMP_PROF_2, taxSnapshot: { sku: "SEL-200", uomCode: "EA" },
          discountSnapshot: {},
        },
      ],
      {
        id: REV_ID, revisionNumber: 1, status: "DRAFT", validUntil: "2026-10-15",
        grandTotal: "260", subtotal: "270", discountTotal: "10", pricingMode: "DISCOUNT",
        discountSnapshot: {
          pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Contract" },
          totals: { subtotal: "270", discountTotal: "10", grandTotal: "260", baseSubtotal: "270", promotionSavings: "0" },
        },
        termsSnapshot: {}, sentAt: null, acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null,
      },
    );

    const snapshot = hydrateQuotationEditSnapshot(detail, {
      itemsById: { [ITEM_1]: item1, [ITEM_2]: item2 },
      uomsByItem: { [ITEM_1]: [UOM_OPTION], [ITEM_2]: [UOM_OPTION] },
    });
    expect(snapshot.canPreviewPricing).toBe(true);
    expect(snapshot.lines.map((l) => ({ id: l.clientLineId, itemId: l.itemId, qty: l.quantity }))).toEqual([
      { id: LINE_1, itemId: ITEM_1, qty: "2" },
      { id: LINE_2, itemId: ITEM_2, qty: "3.5" },
    ]);
    expect(snapshot.lineDisplayById[LINE_1]).toMatchObject({
      description: "Custom pump description", itemName: "Centrifugal Pump", sku: "PMP-100", uomCode: "EA", priceBookId: BOOK_ID, status: "READY",
    });
    expect(snapshot.lineDisplayById[LINE_2]).toMatchObject({
      description: "Legacy seal description", itemName: "Mechanical Seal", sku: "SEL-200", uomCode: "EA", status: "READY",
    });

    const req = buildHydratedQuotationPricingRequest({
      draft: snapshot.discount, lines: snapshot.lines, partyId: snapshot.partyId, currencyCode: snapshot.currencyCode,
      crmCustomerProfileId: snapshot.crmCustomerProfileId, persistedLineIds: snapshot.persistedLineIds,
      blockingLineIds: snapshot.blockingLineIds, priceBookIdByLineId: snapshot.priceBookIdByLineId,
      hydratedItemIdByLineId: snapshot.hydratedItemIdByLineId,
    });
    expect(req?.lines[0]?.priceBookId).toBe(BOOK_ID);
    expect(req?.lines[1]?.priceBookId).toBeUndefined();
  });

  it("preserves unresolved legacy rows without guessing by descriptionSnapshot and blocks preview/submit until replaced or removed", () => {
    const detail = makeDetail(
      [
        {
          id: LINE_1, printLineNumber: 1, clientLineId: LINE_1, descriptionSnapshot: "Centrifugal Pump",
          uomId: UOM_EA, quantity: "1.0000", unitPrice: "100.00000000", discountTotal: "0", lineTotal: "100.00000000",
          discountSnapshot: { itemId: ITEM_1, uomId: UOM_EA, clientLineId: LINE_1, priceBookId: BOOK_ID },
        },
        {
          id: LINE_2, printLineNumber: 2, clientLineId: LINE_2, descriptionSnapshot: "Centrifugal Pump",
          uomId: UOM_EA, quantity: "4.0000", unitPrice: "50.00000000", discountTotal: "0", lineTotal: "200.00000000",
          taxSnapshot: { uomCode: "EA" }, discountSnapshot: {},
        },
      ],
      null,
    );

    const snapshot = hydrateQuotationEditSnapshot(detail, { itemsById: { [ITEM_1]: item1 } });
    expect(snapshot.lineDisplayById[LINE_2]).toMatchObject({
      description: "Centrifugal Pump", itemName: null, uomCode: "EA",
      status: "UNRESOLVED_LEGACY", unavailable: true, requiresReplacement: true,
    });
    expect(snapshot.canPreviewPricing).toBe(false);
    expect(
      buildHydratedQuotationPricingRequest({
        draft: snapshot.discount, lines: snapshot.lines, partyId: PARTY_ID, currencyCode: "EGP",
        persistedLineIds: snapshot.persistedLineIds, blockingLineIds: snapshot.blockingLineIds,
      }),
    ).toBeNull();

    // Replacing LINE_2 with sell-eligible item2 unlocks preview & submit.
    const replacedLines = [snapshot.lines[0]!, { ...snapshot.lines[1]!, itemId: ITEM_2 }];
    const reconciledReplaced = reconcileHydratedLineDrafts(snapshot, replacedLines, {
      itemsById: { [ITEM_1]: item1, [ITEM_2]: item2 }, uomsByItem: { [ITEM_2]: [UOM_OPTION] },
    });
    expect(reconciledReplaced.canPreviewPricing).toBe(true);
    expect(reconciledReplaced.lineDisplayById[LINE_2]).toMatchObject({
      itemId: ITEM_2, itemName: "Mechanical Seal", sku: "SEL-200", unavailable: false, status: "READY",
    });

    // Removing LINE_2 also unlocks preview & submit.
    const reconciledRemoved = reconcileHydratedLineDrafts(snapshot, [snapshot.lines[0]!], { itemsById: { [ITEM_1]: item1 } });
    expect(reconciledRemoved.canSubmitRevision).toBe(true);
  });
});
