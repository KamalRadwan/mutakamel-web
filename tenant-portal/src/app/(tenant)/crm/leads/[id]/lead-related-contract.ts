// What else exists against this lead, as four counts.
//
//   POST /api/tenant/crm/v1/opportunities/search   { filters: [leadId] }
//   GET  /api/tenant/trade/v1/quotations?partyId=…&limit=1
//   GET  /api/tenant/trade/v1/sales-orders?partyId=…&limit=1
//   GET  /api/tenant/trade/v1/invoices?partyId=…&limit=1
//
// **Two different joins, and they are not interchangeable.** An opportunity
// carries `leadId` — it is filed against the lead itself, which is why the CRM
// search filters on that. A trade document has never heard of a lead: it is
// filed against a PARTY, and the lead's own `partyId` is that party (the same
// row the directory holds, which conversion promotes rather than replaces). So
// the three trade counts are "documents for this lead's party", which is the
// only join that exists and also the one a user means.
//
// A narrow contract of its own rather than an import from the four screens
// that own these resources: file-architecture.md#dependency-direction allows a
// screen a named type from a sibling that owns the same resource and nothing
// wider, and this needs one number from each of four of them.
//
// `limit=1` on the three GETs, because only `total` is read. Trade lists are
// flat `{ items, total, page, limit }` inside `data`, and CRM's search answers
// `{ items, meta: { total } }` at the top level — the two are unwrapped
// differently and both are parsed here.

import type { CrmPath, TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const LEAD_RELATED_KINDS = [
  "opportunities",
  "quotations",
  "salesOrders",
  "invoices",
] as const;

export type LeadRelatedKind = (typeof LEAD_RELATED_KINDS)[number];

/**
 * The read permission behind each count, as its own screen declares it. A user
 * without one gets no button rather than a button that answers 403 — the
 * counts are a shortcut to a screen they cannot open either.
 */
export const LEAD_RELATED_PERMISSIONS: Record<LeadRelatedKind, string> = {
  opportunities: "crm.opportunities.read",
  quotations: "trade.quotations.read",
  // UNDERSCORES. Trade spells this one `sales_orders` while its route is
  // `sales-orders`, and the hyphenated guess silently hid the button: a
  // permission string nobody holds is a control nobody sees, with no error
  // anywhere. `lead-related-contract.test.ts` now pins all four against the
  // screens that own them.
  salesOrders: "trade.sales_orders.read",
  invoices: "trade.invoices.read",
};

/** Where each button goes. The lists themselves take no party filter yet. */
export const LEAD_RELATED_ROUTES: Record<LeadRelatedKind, string> = {
  opportunities: "/crm/opportunities",
  quotations: "/trade/quotations",
  salesOrders: "/trade/sales-orders",
  invoices: "/trade/invoices",
};

export const OPPORTUNITY_SEARCH_PATH: CrmPath = "/api/tenant/crm/v1/opportunities/search";

/**
 * `POST /opportunities/search` body, in the shape the opportunities screen
 * already sends: a `filterTree` whose single leaf is `leadId eq <lead>`, which
 * is a field in `OPPORTUNITY_FILTERABLE_FIELDS`.
 *
 * `branchId` travels with it because the route scopes reads by branch, and the
 * lead's own branch is the only one its opportunities can be in. `limit: 1`
 * because only the count is read — the rows are the opportunities screen's
 * business.
 */
export function leadOpportunitySearch(
  leadId: string,
  branchId: string,
): Record<string, unknown> {
  if (!isUUIDv7(leadId) || !isUUIDv7(branchId)) throw new Error("Invalid lead or branch id.");
  return {
    branchId,
    filterTree: { field: "leadId", operator: "eq", value: leadId },
    page: 1,
    limit: 1,
  };
}

/**
 * Written out as literals, not composed from a resource name.
 * `scripts/docs/verify-called-routes.mjs` reads the paths a screen calls out
 * of the SOURCE, so a path assembled from a variable is a path that gate
 * cannot see — and "no fabricated endpoints" would then be a claim about three
 * fewer routes than the app actually calls.
 */
const TRADE_COUNT_PATHS = {
  quotations: "/api/tenant/trade/v1/quotations",
  salesOrders: "/api/tenant/trade/v1/sales-orders",
  invoices: "/api/tenant/trade/v1/invoices",
} as const;

function tradeCountPath(base: (typeof TRADE_COUNT_PATHS)[keyof typeof TRADE_COUNT_PATHS], partyId: string): TradePath {
  if (!isUUIDv7(partyId)) throw new Error("Invalid party id.");
  const query = new URLSearchParams({ partyId, page: "1", limit: "1" });
  return `${base}?${query.toString()}` as TradePath;
}

export const leadQuotationsCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.quotations, partyId);
export const leadSalesOrdersCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.salesOrders, partyId);
export const leadInvoicesCountPath = (partyId: string) =>
  tradeCountPath(TRADE_COUNT_PATHS.invoices, partyId);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The count out of either shape, or null when the body does not carry one.
 *
 * Null is not zero and must not render as one: "no quotations" and "the count
 * could not be read" are different sentences, and a badge showing 0 for the
 * second is a lie a user would act on.
 */
export function parseRelatedTotal(payload: unknown): number | null {
  const body = record(payload);
  if (!body) return null;
  // Trade: `{ items, total, page, limit }`, once `readTradeData` has unwrapped
  // `data`. CRM's search: the same flat shape plus `totalPages`/`hasNext`, sent
  // exactly as it stands. `meta.total` is the third form a CRM list can take,
  // and reading it costs one `??`.
  const total = typeof body.total === "number" ? body.total : record(body.meta)?.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) return null;
  return total;
}
