import { isUUIDv7 } from "@/lib/uuid";

export const PARTY_DOCUMENT_COUNT_KINDS = [
  "opportunities",
  "quotations",
  "salesOrders",
  "invoices",
] as const;

export type PartyDocumentCountKind =
  (typeof PARTY_DOCUMENT_COUNT_KINDS)[number];

export type PartyDocumentCounts = Record<
  PartyDocumentCountKind,
  number | null
>;

export type PartyDocumentCountVisibility = Record<
  PartyDocumentCountKind,
  boolean
>;

export const PARTY_DOCUMENT_COUNT_PERMISSIONS: Record<
  PartyDocumentCountKind,
  string
> = {
  // CRM grants are scoped (`.own/.team/.all`); Trade's are plain.
  opportunities: "crm.opportunities.read",
  quotations: "trade.quotations.read",
  salesOrders: "trade.sales_orders.read",
  invoices: "trade.invoices.read",
};

export const PARTY_DOCUMENT_COUNT_PATHS: Record<
  PartyDocumentCountKind,
  string
> = {
  // crm-app OpportunitiesController.countsByParty — the same `{ items: [{ partyId, count }] }`
  // shape as Trade's, but the branch travels in the body (`@RequireBranchAccess('body')`)
  // instead of the BRANCH_REQUIRED scope headers.
  opportunities: "/api/tenant/crm/v1/opportunities/counts-by-party",
  quotations: "/api/tenant/trade/v1/quotations/counts-by-party",
  salesOrders: "/api/tenant/trade/v1/sales-orders/counts-by-party",
  invoices: "/api/tenant/trade/v1/invoices/counts-by-party",
};

/** Kinds whose permission is a scoped CRM grant. */
export const PARTY_DOCUMENT_COUNT_SCOPED: Record<PartyDocumentCountKind, boolean> = {
  opportunities: true,
  quotations: false,
  salesOrders: false,
  invoices: false,
};

const PARTY_DOCUMENT_ROUTES: Record<PartyDocumentCountKind, string> = {
  opportunities: "/crm/opportunities",
  quotations: "/trade/quotations",
  salesOrders: "/trade/sales-orders",
  invoices: "/trade/invoices",
};

/** Builds a party-scoped destination href (`?partyId=<id>`) for `next/link` navigation. */
export function buildPartyDocumentHref(
  kind: PartyDocumentCountKind,
  partyId: string | null | undefined,
): string {
  const base = PARTY_DOCUMENT_ROUTES[kind];
  const trimmed = partyId?.trim() ?? "";
  if (!trimmed) return base;
  return `${base}?partyId=${encodeURIComponent(trimmed)}`;
}

/** The request body each kind's route expects for one batch of Party ids. */
export function partyDocumentCountsRequestBody(
  kind: PartyDocumentCountKind,
  branchId: string,
  partyIds: readonly string[],
): { partyIds: string[]; branchId?: string } {
  return kind === "opportunities"
    ? { branchId, partyIds: [...partyIds] }
    : { partyIds: [...partyIds] };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Parses the Trade envelope and requires one bounded count for every requested party. */
export function parsePartyDocumentCountsResponse(
  value: unknown,
  requestedPartyIds: readonly string[],
): Map<string, number> {
  const outer = record(value);
  const body = record(outer?.data) ?? outer;
  if (!body || !Array.isArray(body.items)) {
    throw new Error("Invalid document counts response.");
  }

  const requested = new Set(requestedPartyIds);
  const counts = new Map<string, number>();
  for (const value of body.items) {
    const item = record(value);
    if (
      !item ||
      !isUUIDv7(item.partyId) ||
      !requested.has(item.partyId) ||
      !Number.isSafeInteger(item.count) ||
      Number(item.count) < 0 ||
      counts.has(item.partyId)
    ) {
      throw new Error("Invalid document counts response.");
    }
    counts.set(item.partyId, Number(item.count));
  }
  if (counts.size !== requested.size) {
    throw new Error("Invalid document counts response.");
  }
  return counts;
}
