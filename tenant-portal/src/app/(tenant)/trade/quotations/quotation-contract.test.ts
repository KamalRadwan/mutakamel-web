import { describe, expect, it } from "vitest";
import {
  buildCreateQuotation,
  parseQuotationCustomerPage,
  parseQuotationDetail,
  quotationCustomerOptionsPath,
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
});
