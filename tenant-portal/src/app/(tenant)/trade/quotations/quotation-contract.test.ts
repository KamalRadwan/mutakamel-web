import { describe, expect, it } from "vitest";
import {
  QUOTATION_LIFECYCLE_STATUSES,
  buildCreateQuotation,
  buildQuotationReasonPayload,
  buildUpdateQuotationHeader,
  computePriceLockStatus,
  extractPartyContactCoordinates,
  parseQuotationCustomerPage,
  parseQuotationDetail,
  parseQuotationItemDetailLookup,
  parseQuotationLegacySkuSearch,
  quotationCustomerOptionsPath,
  readQuotationLineSnapshot,
  type QuotationCustomerOption,
} from "./quotation-contract";

const UUID = "01890000-0000-7000-8000-000000000001";
const OTHER = "01890000-0000-7000-8000-000000000002";

const quotation = {
  id: UUID,
  version: 1,
  companyId: OTHER,
  branchId: UUID,
  partyId: OTHER,
  contactPartyId: null,
  currencyCode: "EGP",
  businessDate: "2026-08-31",
  lifecycleStatus: "DRAFT",
  approvalStatus: "NOT_REQUIRED",
  fulfillmentStatus: "UNPLANNED",
  billingStatus: "NOT_BILLED",
  grandTotal: "0",
  documentNumber: null,
  draftReference: null,
  partySnapshot: {},
  createdBy: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  currentRevisionId: null,
  acceptedRevisionId: null,
  crmCustomerProfileId: null,
  customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
  revisions: [],
  currentLines: [],
};

const option: QuotationCustomerOption = {
  partyId: UUID,
  partyType: "ORGANIZATION",
  displayName: "Acme",
  crmCustomerProfileId: null,
  commercialAccountStatus: "ACTIVE",
  eligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
  quotationSelectable: true,
  denialCode: null,
};

describe("the quotation detail", () => {
  it("carries a revision whose own status starts at DRAFT", () => {
    const parsed = parseQuotationDetail({
      ...quotation,
      currentRevisionId: OTHER,
      revisions: [
        {
          id: OTHER,
          revisionNumber: 1,
          status: "DRAFT",
          validUntil: "2026-09-30",
          grandTotal: "125.5",
          subtotal: "125.5", discountTotal: "0", pricingMode: "PROMOTIONS", discountSnapshot: {},
          termsSnapshot: {},
          sentAt: null,
          acceptedAt: null,
          rejectedAt: null,
          priceLockExpiresAt: null,
        },
      ],
    });
    expect(parsed.revisions[0].status).toBe("DRAFT");
    expect(parsed.revisions[0].grandTotal).toBe("125.5");
  });

  it("has no lines and no revision when it was just created", () => {
    // `POST /quotations` writes the header only; the first revision is a
    // separate call, which is why the detail screen leads with "add a revision".
    const parsed = parseQuotationDetail(quotation);
    expect(parsed.currentRevisionId).toBeNull();
    expect(parsed.currentLines).toHaveLength(0);
  });
});

describe("the customer-options cursor", () => {
  it("treats an absent nextCursor as the last page", () => {
    // The service omits the key entirely rather than sending null.
    const page = parseQuotationCustomerPage({ items: [] });
    expect(page.nextCursor).toBeNull();
  });

  it("passes a cursor back verbatim, without parsing it", () => {
    const cursor = "eyJkaXNwbGF5TmFtZSI6IkFjbWUifQ";
    const page = parseQuotationCustomerPage({ items: [], nextCursor: cursor });
    expect(page.nextCursor).toBe(cursor);
    expect(quotationCustomerOptionsPath("", cursor)).toContain(encodeURIComponent(cursor));
  });

  it("drops a cursor past the DTO's 512-character bound rather than sending a 400", () => {
    expect(quotationCustomerOptionsPath("", "x".repeat(513))).not.toContain("cursor=");
  });

  it("keeps a blocked customer in the list, with its denial code", () => {
    const page = parseQuotationCustomerPage({
      items: [
        {
          ...option,
          commercialAccountStatus: "BLOCKED",
          quotationSelectable: false,
          denialCode: "TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED",
        },
      ],
    });
    expect(page.items[0].quotationSelectable).toBe(false);
    expect(page.items[0].denialCode).toBe("TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED");
  });
});

describe("buildCreateQuotation", () => {
  it("sends only the documented keys", () => {
    expect(buildCreateQuotation(option, "egp", " REF ")).toEqual({
      partyId: UUID,
      currencyCode: "EGP",
      draftReference: "REF",
    });
  });

  it("forwards the CRM profile that made the customer eligible", () => {
    const request = buildCreateQuotation(
      { ...option, crmCustomerProfileId: OTHER },
      "EGP",
      "",
    );
    expect(request.crmCustomerProfileId).toBe(OTHER);
    expect(request.draftReference).toBeUndefined();
  });

  it("refuses a currency that is not three letters", () => {
    expect(() => buildCreateQuotation(option, "EG", "")).toThrow();
  });

  it("includes optional contactPartyId and extensionValues when valid", () => {
    const req = buildCreateQuotation(option, "usd", "  RFQ-99 ", {
      contactPartyId: OTHER,
      extensionValues: [{ fieldKey: "project_code", value: "P-100" }],
    });
    expect(req).toEqual({
      partyId: UUID,
      currencyCode: "USD",
      draftReference: "RFQ-99",
      contactPartyId: OTHER,
      extensionValues: [{ fieldKey: "project_code", value: "P-100" }],
    });
  });
});

describe("lifecycle statuses, header PATCH, reason DTO, and price-lock helpers", () => {
  it("lists closed and expired statuses without a fabricated CONVERTED state", () => {
    expect(QUOTATION_LIFECYCLE_STATUSES).toEqual([
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
    ]);
    expect(QUOTATION_LIFECYCLE_STATUSES).not.toContain("CONVERTED");
  });

  it("builds UpdateQuotationDto with nullable draftReference and contactPartyId", () => {
    expect(
      buildUpdateQuotationHeader({
        draftReference: "  DRAFT-101  ",
        contactPartyId: OTHER,
      }),
    ).toEqual({
      draftReference: "DRAFT-101",
      contactPartyId: OTHER,
    });

    expect(
      buildUpdateQuotationHeader({
        draftReference: "   ",
        contactPartyId: "",
      }),
    ).toEqual({
      draftReference: null,
      contactPartyId: null,
    });

    expect(() =>
      buildUpdateQuotationHeader({ contactPartyId: "not-a-uuid" }),
    ).toThrow("QUOTATION_FORM_CONTACT_PARTY");
  });

  it("builds DocumentReasonDto with bounded reasonCode and optional evidenceRef", () => {
    expect(buildQuotationReasonPayload(" CUSTOMER_REQUESTED ", "  ")).toEqual({
      reasonCode: "CUSTOMER_REQUESTED",
    });
    expect(
      buildQuotationReasonPayload("COMPETITOR_SELECTED", " Email ref #4481 "),
    ).toEqual({
      reasonCode: "COMPETITOR_SELECTED",
      evidenceRef: "Email ref #4481",
    });
    expect(() => buildQuotationReasonPayload("   ")).toThrow(
      "QUOTATION_REASON_REQUIRED",
    );
  });

  it("extracts contact coordinates and evaluates price lock status accurately", () => {
    expect(
      extractPartyContactCoordinates({
        primaryEmail: "procurement@mutahida.eg",
        whatsappPhone: "+20 100 123 4567",
      }),
    ).toEqual({
      email: "procurement@mutahida.eg",
      phone: "+20 100 123 4567",
      contactName: null,
    });

    const baseNow = Date.parse("2026-09-01T00:00:00.000Z");
    expect(computePriceLockStatus("ACCEPTED", null, baseNow)).toEqual({
      state: "pinned",
      hoursLeft: null,
    });
    expect(
      computePriceLockStatus(
        "SENT",
        {
          id: OTHER,
          revisionNumber: 1,
          status: "SENT",
          validUntil: "2026-09-30",
          grandTotal: "500.00",
          subtotal: "500.00", discountTotal: "0", pricingMode: "PROMOTIONS", discountSnapshot: {},
          termsSnapshot: {},
          sentAt: "2026-09-01T00:00:00.000Z",
          acceptedAt: null,
          rejectedAt: null,
          priceLockExpiresAt: "2026-09-01T12:00:00.000Z",
        },
        baseNow,
      ),
    ).toEqual({ state: "expiring", hoursLeft: 12 });
  });

  it("sorts currentLines by printLineNumber ASC and validates line snapshot + item lookup contracts", () => {
    const ITEM = "01890000-0000-7000-8000-000000000010";
    const BOOK = "01890000-0000-7000-8000-000000000011";
    const detail = parseQuotationDetail({
      ...quotation,
      currentLines: [
        { id: OTHER, printLineNumber: 2, clientLineId: OTHER, descriptionSnapshot: "Second", uomId: UUID, quantity: "1.0000", unitPrice: "20.00000000", discountTotal: "0", lineTotal: "20.00000000", discountSnapshot: {}, itemCompanyProfileId: UUID, taxSnapshot: { sku: "SKU-2", uomCode: "EA" } },
        { id: UUID, printLineNumber: 1, clientLineId: UUID, descriptionSnapshot: "First", uomId: UUID, quantity: "2.0000", unitPrice: "50.00000000", discountTotal: "10.00000000", lineTotal: "90.00000000", discountSnapshot: { itemId: ITEM, uomId: UUID, clientLineId: UUID, priceBookId: BOOK, discount: { type: "PERCENT", value: "10.00000000" } } },
      ],
    });
    expect(detail.currentLines.map((l) => l.printLineNumber)).toEqual([1, 2]);
    expect(readQuotationLineSnapshot(detail.currentLines[0]!)).toMatchObject({ itemId: ITEM, priceBookId: BOOK, discount: { type: "PERCENT", value: "10" }, corrupted: false });
    expect(readQuotationLineSnapshot(detail.currentLines[1]!)).toMatchObject({ itemId: null, itemCompanyProfileId: UUID, sku: "SKU-2", uomCode: "EA", corrupted: false });
    expect(readQuotationLineSnapshot({ ...detail.currentLines[0]!, discountSnapshot: { itemId: "bad" } }).corrupted).toBe(true);

    const lookedUp = parseQuotationItemDetailLookup({
      id: ITEM, canonicalCode: "SKU-1", localizedNames: { en: "Valve" }, status: "ACTIVE", baseUomId: UUID,
      companyProfile: { id: OTHER, version: 1, status: "ACTIVE", canSell: true, canPurchase: true, canPos: false, defaultSalesUomId: null, defaultPurchaseUomId: null },
      branchProfile: { id: UUID, version: 1, isAssorted: true },
    });
    expect(lookedUp.isSellEligible).toBe(true);
    expect(lookedUp.item?.eligibility.defaultSalesUomId).toBe(UUID);

    const searchPage = { items: [lookedUp.item], total: 1, page: 1, limit: 100 };
    expect(parseQuotationLegacySkuSearch(searchPage, "SKU-1", OTHER)?.id).toBe(ITEM);
    expect(parseQuotationLegacySkuSearch(searchPage, "SKU-1", UUID)).toBeNull();
  });
});
