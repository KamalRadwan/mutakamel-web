import { describe, expect, it } from "vitest";
import { INVOICE_PERMISSIONS } from "../../../trade/invoices/invoice-contract";
import { QUOTATION_PERMISSIONS } from "../../../trade/quotations/quotation-contract";
import { SALES_ORDER_PERMISSIONS } from "../../../trade/sales-orders/sales-order-contract";
import {
  CUSTOMER_RELATED_PERMISSIONS,
  buildCustomerRelatedHref,
  canReadCustomerRelated,
  customerInvoicesCountPath,
  customerOpportunitySearch,
  customerQuotationsCountPath,
  customerSalesOrdersCountPath,
  parseCustomerRelatedTotal,
} from "./customer-profile-related-contract";

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

describe("customer related-record admission", () => {
  it.each(["own", "team", "all"])("accepts an Opportunities %s read grant", (scope) => {
    expect(canReadCustomerRelated([`crm.opportunities.read.${scope}`], "opportunities")).toBe(true);
  });

  it("keeps Trade permissions exact and denies unrelated CRM grants", () => {
    expect(canReadCustomerRelated(["crm.opportunities.update.team"], "opportunities")).toBe(false);
    expect(canReadCustomerRelated([], "opportunities")).toBe(false);
    for (const kind of ["quotations", "salesOrders", "invoices"] as const) {
      expect(canReadCustomerRelated(["crm.opportunities.read.team"], kind)).toBe(false);
      expect(canReadCustomerRelated([`${CUSTOMER_RELATED_PERMISSIONS[kind]}.team`], kind)).toBe(false);
      expect(canReadCustomerRelated([CUSTOMER_RELATED_PERMISSIONS[kind]], kind)).toBe(true);
    }
  });
});

describe("the customer related-record requests", () => {
  it("asks the opportunity search for this customerPartyId, in its own branch", () => {
    expect(customerOpportunitySearch(PARTY_ID, BRANCH_ID)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        field: "customerPartyId",
        operator: "eq",
        value: PARTY_ID,
      },
      page: 1,
      limit: 1,
    });
  });

  it("builds party-scoped destination hrefs for all four related document kinds", () => {
    expect(buildCustomerRelatedHref("opportunities", PARTY_ID)).toBe(
      `/crm/opportunities?partyId=${PARTY_ID}`,
    );
    expect(buildCustomerRelatedHref("quotations", PARTY_ID)).toBe(
      `/trade/quotations?partyId=${PARTY_ID}`,
    );
    expect(buildCustomerRelatedHref("salesOrders", PARTY_ID)).toBe(
      `/trade/sales-orders?partyId=${PARTY_ID}`,
    );
    expect(buildCustomerRelatedHref("invoices", PARTY_ID)).toBe(
      `/trade/invoices?partyId=${PARTY_ID}`,
    );
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
