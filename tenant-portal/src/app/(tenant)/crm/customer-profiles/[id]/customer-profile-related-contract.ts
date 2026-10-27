// What else exists against this customer profile, as four counts:
//   POST /api/tenant/crm/v1/opportunities/search   { filters: [customerProfileId] }
//   GET  /api/tenant/trade/v1/quotations?partyId=…&limit=1
//   GET  /api/tenant/trade/v1/sales-orders?partyId=…&limit=1
//   GET  /api/tenant/trade/v1/invoices?partyId=…&limit=1

import { hasPermission } from "@/design-system";
import type { CrmPath, TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const CUSTOMER_RELATED_KINDS = [
  "opportunities",
  "quotations",
  "salesOrders",
  "invoices",
] as const;

export type CustomerRelatedKind = (typeof CUSTOMER_RELATED_KINDS)[number];

export const CUSTOMER_RELATED_PERMISSIONS: Record<CustomerRelatedKind, string> = {
  opportunities: "crm.opportunities.read",
  quotations: "trade.quotations.read",
  salesOrders: "trade.sales_orders.read",
  invoices: "trade.invoices.read",
};

export function canReadCustomerRelated(
  permissions: readonly string[],
  kind: CustomerRelatedKind,
): boolean {
  return hasPermission(
    permissions,
    CUSTOMER_RELATED_PERMISSIONS[kind],
    kind === "opportunities",
  );
}

const CUSTOMER_RELATED_ROUTES: Record<CustomerRelatedKind, string> = {
  opportunities: "/crm/opportunities",
  quotations: "/trade/quotations",
  salesOrders: "/trade/sales-orders",
  invoices: "/trade/invoices",
};

export function buildCustomerRelatedHref(
  kind: CustomerRelatedKind,
  partyId: string | null | undefined,
): string {
  const base = CUSTOMER_RELATED_ROUTES[kind];
  const trimmed = partyId?.trim() ?? "";
  if (!trimmed) return base;
  return `${base}?partyId=${encodeURIComponent(trimmed)}`;
}

export const CUSTOMER_OPPORTUNITY_SEARCH_PATH: CrmPath =
  "/api/tenant/crm/v1/opportunities/search";

export function customerOpportunitySearch(
  partyId: string,
  branchId: string,
): Record<string, unknown> {
  if (!isUUIDv7(partyId) || !isUUIDv7(branchId)) {
    throw new Error("Invalid customer party or branch id.");
  }
  return {
    branchId,
    filterTree: {
      field: "customerPartyId",
      operator: "eq",
      value: partyId,
    },
    page: 1,
    limit: 1,
  };
}

const TRADE_COUNT_PATHS = {
  quotations: "/api/tenant/trade/v1/quotations",
  salesOrders: "/api/tenant/trade/v1/sales-orders",
  invoices: "/api/tenant/trade/v1/invoices",
} as const;

function tradeCountPath(
  base: (typeof TRADE_COUNT_PATHS)[keyof typeof TRADE_COUNT_PATHS],
  partyId: string,
): TradePath {
  if (!isUUIDv7(partyId)) throw new Error("Invalid party id.");
  const query = new URLSearchParams({ partyId, page: "1", limit: "1" });
  return `${base}?${query.toString()}` as TradePath;
}

export const customerQuotationsCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.quotations, partyId);
export const customerSalesOrdersCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.salesOrders, partyId);
export const customerInvoicesCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.invoices, partyId);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseCustomerRelatedTotal(payload: unknown): number | null {
  const body = record(payload);
  if (!body) return null;
  const total =
    typeof body.total === "number" ? body.total : record(body.meta)?.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    return null;
  }
  return total;
}
