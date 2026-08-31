import { describe, expect, it } from "vitest";
import {
  parseSalesOrderAttempt,
  parseSalesOrderConfirmation,
  parseSalesOrderDetail,
} from "./sales-order-contract";

const UUID = "01890000-0000-7000-8000-000000000001";
const OTHER = "01890000-0000-7000-8000-000000000002";

const order = {
  id: UUID,
  version: 4,
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
  grandTotal: "250",
  documentNumber: null,
  draftReference: null,
  partySnapshot: {},
  createdBy: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  confirmationStatus: "NOT_STARTED",
  holdStatus: "NONE",
  sourceQuotationId: OTHER,
  sourceQuotationRevisionId: UUID,
  totalsSnapshot: { subtotal: "250", grandTotal: "250" },
  lines: [
    {
      id: UUID,
      clientLineId: OTHER,
      uomId: UUID,
      orderedQuantity: "2",
      unitPrice: "125",
      lineTotal: "250",
      discountTotal: null,
      chargeTotal: null,
      taxTotal: null,
      printLineNumber: 1,
    },
  ],
};

describe("the sales order's four axes", () => {
  it("keeps confirmation and hold separate from the lifecycle", () => {
    const parsed = parseSalesOrderDetail(order);
    expect(parsed.lifecycleStatus).toBe("DRAFT");
    expect(parsed.confirmationStatus).toBe("NOT_STARTED");
    expect(parsed.holdStatus).toBe("NONE");
    expect(parsed.fulfillmentStatus).toBe("UNPLANNED");
    expect(parsed.billingStatus).toBe("NOT_BILLED");
  });

  it("has no settlement axis, because no such column exists", () => {
    // `SettlementStatus` is exported from @mutakamel/trade-app-common and has
    // no column, no writer and no reader anywhere in trade-app.
    expect(Object.keys(parseSalesOrderDetail(order))).not.toContain("settlementStatus");
  });

  it("keeps the source quotation link, the only lineage edge the API exposes", () => {
    expect(parseSalesOrderDetail(order).sourceQuotationId).toBe(OTHER);
  });

  it("preserves a null line discount rather than reading it as zero", () => {
    // The three evidence columns are nullable on a converted or legacy draft,
    // and "not recorded" is not the same fact as "zero".
    expect(parseSalesOrderDetail(order).lines[0].discountTotal).toBeNull();
  });
});

describe("confirmation", () => {
  it("reads the body's own statusCode, which distinguishes 200 from 202", () => {
    const queued = parseSalesOrderConfirmation({
      statusCode: 202,
      orderId: UUID,
      attemptId: OTHER,
      status: "PENDING",
    });
    expect(queued.statusCode).toBe(202);
    expect(queued.attemptId).toBe(OTHER);
  });

  it("reads the attempt's own version, which is what If-Match must carry", () => {
    // `cancelSalesOrderConfirmationAttempt` asserts against `attempt.version`,
    // not the order's — sending the order's is a 409.
    const attempt = parseSalesOrderAttempt({
      id: OTHER,
      version: 2,
      status: "PENDING",
      deadlineAt: null,
      lastErrorCode: null,
    });
    expect(attempt.version).toBe(2);
  });

  it("surfaces the attempt's last error code", () => {
    const attempt = parseSalesOrderAttempt({
      id: OTHER,
      version: 3,
      status: "CANCELLED",
      lastErrorCode: "USER_CANCELLED:CHANGED_MIND",
    });
    expect(attempt.lastErrorCode).toBe("USER_CANCELLED:CHANGED_MIND");
  });
});
