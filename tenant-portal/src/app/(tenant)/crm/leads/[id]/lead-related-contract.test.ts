import { describe, expect, it } from "vitest";
import { INVOICE_PERMISSIONS } from "../../../trade/invoices/invoice-contract";
import { QUOTATION_PERMISSIONS } from "../../../trade/quotations/quotation-contract";
import { SALES_ORDER_PERMISSIONS } from "../../../trade/sales-orders/sales-order-contract";
import {
  LEAD_RELATED_PERMISSIONS,
  leadInvoicesCountPath,
  leadOpportunitySearch,
  leadQuotationsCountPath,
  leadSalesOrdersCountPath,
  parseRelatedTotal,
} from "./lead-related-contract";

const LEAD_ID = "01900100-0000-7000-8000-0000000000a1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";

describe("the related-record permissions", () => {
  // The bug this exists for: `trade.sales-orders.read` was a reasonable guess
  // and wrong — Trade spells the permission with underscores while its route
  // uses hyphens — so the sales-orders button never rendered for anybody, with
  // no error anywhere to say why. A string nobody holds is a control nobody
  // sees. These are read from the screens that OWN each resource, so the next
  // rename fails here instead of silently hiding a button.
  it("matches the permission each owning screen declares", () => {
    expect(LEAD_RELATED_PERMISSIONS.quotations).toBe(QUOTATION_PERMISSIONS.read);
    expect(LEAD_RELATED_PERMISSIONS.salesOrders).toBe(SALES_ORDER_PERMISSIONS.read);
    expect(LEAD_RELATED_PERMISSIONS.invoices).toBe(INVOICE_PERMISSIONS.read);
    // Opportunities has no exported constant; its screen gates on this string.
    expect(LEAD_RELATED_PERMISSIONS.opportunities).toBe("crm.opportunities.read");
  });
});

describe("the related-record requests", () => {
  it("asks the opportunity search for this LEAD, in its own branch", () => {
    expect(leadOpportunitySearch(LEAD_ID, BRANCH_ID)).toEqual({
      branchId: BRANCH_ID,
      filterTree: { field: "leadId", operator: "eq", value: LEAD_ID },
      page: 1,
      limit: 1,
    });
  });

  it("asks each trade list for this lead's PARTY, one row deep", () => {
    for (const path of [
      leadQuotationsCountPath(PARTY_ID),
      leadSalesOrdersCountPath(PARTY_ID),
      leadInvoicesCountPath(PARTY_ID),
    ]) {
      expect(path).toContain(`partyId=${PARTY_ID}`);
      // Only the count is read; the rows belong to the screen behind the link.
      expect(path).toContain("limit=1");
    }
    expect(leadQuotationsCountPath(PARTY_ID)).toContain("/api/tenant/trade/v1/quotations");
    expect(leadSalesOrdersCountPath(PARTY_ID)).toContain("/api/tenant/trade/v1/sales-orders");
    expect(leadInvoicesCountPath(PARTY_ID)).toContain("/api/tenant/trade/v1/invoices");
  });

  it("refuses ids that are not ids rather than building a path around them", () => {
    expect(() => leadOpportunitySearch("nope", BRANCH_ID)).toThrow();
    expect(() => leadQuotationsCountPath("nope")).toThrow();
  });
});

describe("parseRelatedTotal", () => {
  it("reads both list shapes", () => {
    // Trade, once `data` is unwrapped; CRM's search, sent flat.
    expect(parseRelatedTotal({ items: [], total: 7, page: 1, limit: 1 })).toBe(7);
    expect(parseRelatedTotal({ items: [], meta: { total: 3 } })).toBe(3);
  });

  it("answers null for a body with no readable count", () => {
    // Null is not zero, and the difference is the whole point: a count that
    // did not come back must not render as "none".
    for (const body of [null, {}, { total: "7" }, { total: -1 }, { total: 1.5 }, []]) {
      expect(parseRelatedTotal(body)).toBeNull();
    }
  });
});
