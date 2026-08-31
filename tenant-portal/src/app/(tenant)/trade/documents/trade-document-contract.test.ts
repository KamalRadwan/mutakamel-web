import { describe, expect, it } from "vitest";
import {
  isTradeDecimal,
  parseTradeDocumentHeader,
  parseTradeFinalizedDocument,
  parseTradeListPage,
  partyDisplayName,
  readTotalsSnapshot,
  tradeDocumentActionPath,
  tradeListPath,
} from "./trade-document-contract";

const UUID = "01890000-0000-7000-8000-000000000001";
const OTHER_UUID = "01890000-0000-7000-8000-000000000002";

const header = {
  id: UUID,
  version: 3,
  companyId: OTHER_UUID,
  branchId: UUID,
  partyId: OTHER_UUID,
  contactPartyId: null,
  currencyCode: "EGP",
  businessDate: "2026-08-31",
  lifecycleStatus: "DRAFT",
  approvalStatus: "NOT_REQUIRED",
  fulfillmentStatus: "UNPLANNED",
  billingStatus: "NOT_BILLED",
  grandTotal: "10.5",
  documentNumber: null,
  draftReference: "REF-1",
  partySnapshot: { displayName: "Acme" },
  createdBy: UUID,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

describe("parseTradeDocumentHeader", () => {
  it("reads the columns a quotation, sales order and purchase order share", () => {
    const parsed = parseTradeDocumentHeader(header);
    expect(parsed.grandTotal).toBe("10.5");
    expect(parsed.draftReference).toBe("REF-1");
    expect(parsed.createdBy).toBe(UUID);
  });

  it("refuses a money field that arrived as a JS number", () => {
    // No Trade endpoint returns a number for money or quantity. One arriving
    // means the contract changed, and coercing it would lose precision
    // silently — which is the whole reason the validator exists.
    expect(() => parseTradeDocumentHeader({ ...header, grandTotal: 10.5 })).toThrow();
  });

  it("refuses a padded decimal, which fixedDecimalText never emits", () => {
    expect(isTradeDecimal("10.50")).toBe(true);
    expect(isTradeDecimal("010.5")).toBe(false);
  });

  it("refuses a version below 1", () => {
    expect(() => parseTradeDocumentHeader({ ...header, version: 0 })).toThrow();
  });
});

describe("parseTradeFinalizedDocument", () => {
  const finalized = {
    id: UUID,
    version: 1,
    companyId: OTHER_UUID,
    branchId: UUID,
    partyId: OTHER_UUID,
    currencyCode: "EGP",
    businessDate: "2026-08-31",
    documentNumber: "INV-1",
    reference: null,
    lifecycleStatus: "DRAFT",
    notes: null,
    partySnapshot: {},
    termsSnapshot: {},
    totalsSnapshot: { subtotal: "10", grandTotal: "10" },
    finalizedAt: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };

  it("requires a document number, which is assigned at creation here", () => {
    expect(parseTradeFinalizedDocument(finalized).documentNumber).toBe("INV-1");
    expect(() => parseTradeFinalizedDocument({ ...finalized, documentNumber: null })).toThrow();
  });

  it("keeps a draft's null finalizedAt, which the check constraint requires", () => {
    expect(parseTradeFinalizedDocument(finalized).finalizedAt).toBeNull();
  });
});

describe("readTotalsSnapshot", () => {
  it("omits a key the server did not send rather than defaulting it to zero", () => {
    const totals = readTotalsSnapshot({ subtotal: "10", grandTotal: "10" });
    expect(totals.subtotal).toBe("10");
    expect(totals.amountDue).toBeUndefined();
  });
});

describe("parseTradeListPage", () => {
  it("reads the flat shape, which carries no totalPages, hasNext or hasPrev", () => {
    const page = parseTradeListPage({ items: [1, 2], total: 7, page: 1, limit: 25 }, (x) => x);
    expect(page).toEqual({ items: [1, 2], total: 7, page: 1, limit: 25 });
  });

  it("refuses a Core-shaped response with the pager in a sibling meta", () => {
    expect(() => parseTradeListPage({ data: [], meta: { total: 0 } }, (x) => x)).toThrow();
  });
});

describe("paths", () => {
  it("sends page, limit and the two documented filters, and nothing else", () => {
    expect(tradeListPath("/api/tenant/trade/v1/quotations", 2, "SENT")).toBe(
      "/api/tenant/trade/v1/quotations?page=2&limit=25&status=SENT",
    );
  });

  it("refuses to build a path around an id that is not a UUID v7", () => {
    expect(() => tradeDocumentActionPath("/api/tenant/trade/v1/quotations", "nope", "send")).toThrow();
  });
});

describe("partyDisplayName", () => {
  it("reads the snapshot the service wrote, and returns null rather than a placeholder", () => {
    expect(partyDisplayName({ displayName: "Acme" })).toBe("Acme");
    expect(partyDisplayName({})).toBeNull();
  });
});
