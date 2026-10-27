import { describe, expect, it } from "vitest";
import { parseQuotationDetail, type QuotationDetail } from "./quotation-contract";
import { buildConvertQuotationToSalesOrder, type QuotationConversionEvidenceDraft } from "./quotation-conversion-contract";

const ID = "01890000-0000-7000-8000-000000000001";
const REVISION = "01890000-0000-7000-8000-000000000002";
const LINE = "01890000-0000-7000-8000-000000000003";
const OTHER_LINE = "01890000-0000-7000-8000-000000000004";

function source(): QuotationDetail {
  return parseQuotationDetail({
    id: ID, version: 3, companyId: ID, branchId: ID, partyId: ID,
    contactPartyId: null, currencyCode: "EGP", businessDate: "2026-10-17",
    lifecycleStatus: "ACCEPTED", approvalStatus: "NOT_REQUIRED",
    fulfillmentStatus: "UNPLANNED", billingStatus: "NOT_BILLED",
    grandTotal: "200", documentNumber: "Q-1", draftReference: null,
    partySnapshot: {}, createdBy: null,
    createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
    currentRevisionId: REVISION, acceptedRevisionId: REVISION,
    crmCustomerProfileId: null, customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
    revisions: [{
      id: REVISION, revisionNumber: 1, status: "ACCEPTED", validUntil: "2026-12-31",
      grandTotal: "200", termsSnapshot: { paymentTermCode: "NET_30", incotermCode: "EXW", custom: { days: 30 } },
      sentAt: null, acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null,
    }],
    currentLines: [{
      id: ID, clientLineId: LINE, printLineNumber: 1, descriptionSnapshot: "Accepted goods",
      quantity: "2", uomId: ID, unitPrice: "100", lineTotal: "200",
    }],
  });
}

function evidence(overrides: Partial<QuotationConversionEvidenceDraft> = {}): QuotationConversionEvidenceDraft {
  return {
    clientLineId: LINE, discountTotal: "10", chargeTotal: "5",
    taxCode: "VAT-15", category: "STANDARD", ratePercent: "15", ...overrides,
  };
}

describe("quotation conversion request and financial evidence (CXPORTAL-TRADE-102/114)", () => {
  it("sends exactly the current nested DTO fields even when UI inputs contain identity fields", () => {
    const draft = { ...evidence(), itemId: ID, uomId: ID, quantity: "999" };
    const request = buildConvertQuotationToSalesOrder(source(), [draft]);
    expect(Object.keys(request).sort()).toEqual(["lines", "terms", "totals"]);
    expect(Object.keys(request.lines[0]).sort()).toEqual(["clientLineId", "financial"]);
    expect(Object.keys(request.lines[0].financial).sort()).toEqual([
      "chargeTotal", "discountTotal", "lineTotal", "taxSnapshot", "taxTotal",
    ]);
    expect(Object.keys(request.totals).sort()).toEqual([
      "amountDue", "amountPaid", "chargeTotal", "discountTotal", "grandTotal", "roundingTotal", "subtotal", "taxTotal",
    ]);
    expect(JSON.stringify(request)).not.toMatch(/"(?:uomId|quantity|itemId)"/u);
  });

  it("calculates nonzero tax on the accepted subtotal less discount plus charge", () => {
    const request = buildConvertQuotationToSalesOrder(source(), [evidence()]);
    expect(request.lines[0]).toEqual({
      clientLineId: LINE,
      financial: {
        discountTotal: "10", chargeTotal: "5", taxTotal: "29.25", lineTotal: "224.25",
        taxSnapshot: {
          taxCode: "VAT-15", category: "STANDARD", rateBps: 1500,
          taxableBase: "195", taxAmount: "29.25", currencyCode: "EGP",
        },
      },
    });
    expect(request.totals).toEqual({
      subtotal: "200", discountTotal: "10", chargeTotal: "5", taxTotal: "29.25",
      roundingTotal: "0", grandTotal: "224.25", amountPaid: "0", amountDue: "224.25",
    });
  });

  it.each(["ZERO", "EXEMPT"])("requires explicit %s treatment and zero rate", (category) => {
    const request = buildConvertQuotationToSalesOrder(source(), [evidence({ category, ratePercent: "0" })]);
    expect(request.lines[0].financial.taxTotal).toBe("0");
    expect(request.lines[0].financial.taxSnapshot).toMatchObject({ category, rateBps: 0 });
    expect(request.totals.grandTotal).toBe("195");
    expect(() => buildConvertQuotationToSalesOrder(source(), [evidence({ category })])).toThrow("QUOTATION_CONVERSION_EVIDENCE");
  });

  it.each([
    { category: "" }, { ratePercent: "" }, { taxCode: " " },
    { category: "STANDARD", ratePercent: "0" }, { ratePercent: "101" },
    { ratePercent: "12.34567" }, { discountTotal: "201" }, { chargeTotal: "-1" },
    { discountTotal: "" }, { chargeTotal: "0.000000001" },
  ])("refuses missing or invalid evidence rather than supplying defaults: %j", (overrides) => {
    expect(() => buildConvertQuotationToSalesOrder(source(), [evidence(overrides)])).toThrow("QUOTATION_CONVERSION_EVIDENCE");
  });

  it("matches and totals multiple lines by clientLineId, independent of input order", () => {
    const quotation = source();
    quotation.currentLines.push({ ...quotation.currentLines[0], id: OTHER_LINE, clientLineId: OTHER_LINE, quantity: "1", lineTotal: "100" });
    quotation.revisions[0].grandTotal = "300";
    const second = evidence({ clientLineId: OTHER_LINE, discountTotal: "0", chargeTotal: "0", category: "EXEMPT", ratePercent: "0" });
    const request = buildConvertQuotationToSalesOrder(quotation, [second, evidence()]);
    expect(request.lines.map((line) => line.clientLineId)).toEqual([LINE, OTHER_LINE]);
    expect(request.totals).toMatchObject({ subtotal: "300", taxTotal: "29.25", grandTotal: "324.25" });
  });

  it("rejects absent, duplicate and foreign line evidence", () => {
    for (const drafts of [[], [evidence(), evidence()], [evidence({ clientLineId: OTHER_LINE })]]) {
      expect(() => buildConvertQuotationToSalesOrder(source(), drafts)).toThrow("QUOTATION_CONVERSION_EVIDENCE");
    }
    const quotation = source();
    quotation.currentLines.push({ ...quotation.currentLines[0] });
    expect(() => buildConvertQuotationToSalesOrder(quotation, [evidence(), evidence()])).toThrow();
  });

  it("rounds percentage tax half-up at eight decimals without floating-point amounts", () => {
    const quotation = source();
    Object.assign(quotation.currentLines[0], { quantity: "3", unitPrice: "0.33333333", lineTotal: "0.99999999" });
    quotation.revisions[0].grandTotal = "0.99999999";
    const request = buildConvertQuotationToSalesOrder(quotation, [evidence({ discountTotal: "0", chargeTotal: "0", ratePercent: "12.3456" })]);
    expect(request.lines[0].financial.taxTotal).toBe("0.123456");
    expect(request.totals.grandTotal).toBe("1.12345599");
  });

  it("preserves monetary values beyond Number's safe integer range", () => {
    const quotation = source();
    Object.assign(quotation.currentLines[0], { quantity: "1", unitPrice: "9007199254740993.01", lineTotal: "9007199254740993.01" });
    quotation.revisions[0].grandTotal = "9007199254740993.01";
    const request = buildConvertQuotationToSalesOrder(quotation, [evidence({ discountTotal: "0", chargeTotal: "0", category: "EXEMPT", ratePercent: "0" })]);
    expect(request.totals.grandTotal).toBe("9007199254740993.01");
  });

  it("copies the accepted terms exactly without injecting fallback terms", () => {
    const quotation = source();
    const request = buildConvertQuotationToSalesOrder(quotation, [evidence()]);
    expect(request.terms).toEqual(quotation.revisions[0].termsSnapshot);
    quotation.revisions[0].termsSnapshot = {};
    expect(() => buildConvertQuotationToSalesOrder(quotation, [evidence()])).toThrow("QUOTATION_CONVERSION_SOURCE");
  });

  it.each([
    (q: QuotationDetail) => { q.lifecycleStatus = "SENT"; },
    (q: QuotationDetail) => { q.acceptedRevisionId = null; },
    (q: QuotationDetail) => { q.currentRevisionId = ID; },
    (q: QuotationDetail) => { q.revisions[0].status = "DRAFT"; },
    (q: QuotationDetail) => { q.revisions[0].grandTotal = "201"; },
    (q: QuotationDetail) => { q.currentLines = []; },
  ])("refuses a source that cannot represent the accepted revision", (change) => {
    const quotation = source();
    change(quotation);
    expect(() => buildConvertQuotationToSalesOrder(quotation, [evidence()])).toThrow("QUOTATION_CONVERSION_SOURCE");
  });
});
