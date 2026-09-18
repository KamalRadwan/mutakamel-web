import { describe, expect, it } from "vitest";
import { INVOICE_PERMISSIONS } from "../../../trade/invoices/invoice-contract";
import { QUOTATION_PERMISSIONS } from "../../../trade/quotations/quotation-contract";
import { SALES_ORDER_PERMISSIONS } from "../../../trade/sales-orders/sales-order-contract";
import {
  CUSTOMER_RELATED_PERMISSIONS,
  customerInvoicesCountPath,
  customerOpportunitySearch,
  customerQuotationsCountPath,
  customerSalesOrdersCountPath,
  parseCustomerRelatedTotal,
} from "./customer-profile-related-contract";

const CUSTOMER_ID = "01900100-0000-7000-8000-0000000000a1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";

describe("the customer related-record permissions", () => {
  it("matches the permission each owning screen declares", () => {
    expect(CUSTOMER_RELATED_PERMISSIONS.quotations).toBe(
      QUOTATION_PERMISSIONS.read,
    );
    expect(CUSTOMER_RELATED_PERMISSIONS.salesOrders).toBe(
      SALES_ORDER_PERMISSIONS.read,
    );
    expect(CUSTOMER_RELATED_PERMISSIONS.invoices).toBe(
      INVOICE_PERMISSIONS.read,
    );
    expect(CUSTOMER_RELATED_PERMISSIONS.opportunities).toBe(
      "crm.opportunities.read",
    );
  });
});

describe("the customer related-record requests", () => {
  it("asks the opportunity search for this customerProfileId, in its own branch", () => {
    expect(customerOpportunitySearch(CUSTOMER_ID, BRANCH_ID)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        field: "customerProfileId",
        operator: "eq",
        value: CUSTOMER_ID,
      },
      page: 1,
      limit: 1,
    });
  });

  it("asks each trade list for this customer's PARTY, one row deep", () => {
    for (const path of [
      customerQuotationsCountPath(PARTY_ID),
      customerSalesOrdersCountPath(PARTY_ID),
      customerInvoicesCountPath(PARTY_ID),
    ]) {
      expect(path).toContain(`partyId=${PARTY_ID}`);
      expect(path).toContain("limit=1");
    }
    expect(customerQuotationsCountPath(PARTY_ID)).toContain(
      "/api/tenant/trade/v1/quotations",
    );
    expect(customerSalesOrdersCountPath(PARTY_ID)).toContain(
      "/api/tenant/trade/v1/sales-orders",
    );
    expect(customerInvoicesCountPath(PARTY_ID)).toContain(
      "/api/tenant/trade/v1/invoices",
    );
  });

  it("refuses ids that are not ids rather than building a path around them", () => {
    expect(() => customerOpportunitySearch("nope", BRANCH_ID)).toThrow();
    expect(() => customerQuotationsCountPath("nope")).toThrow();
  });
});

describe("parseCustomerRelatedTotal", () => {
  it("reads both list shapes", () => {
    expect(
      parseCustomerRelatedTotal({ items: [], total: 7, page: 1, limit: 1 }),
    ).toBe(7);
    expect(
      parseCustomerRelatedTotal({ items: [], meta: { total: 3 } }),
    ).toBe(3);
  });

  it("answers null for a body with no readable count", () => {
    for (const body of [
      null,
      {},
      { total: "7" },
      { total: -1 },
      { total: 1.5 },
      [],
    ]) {
      expect(parseCustomerRelatedTotal(body)).toBeNull();
    }
  });
});
