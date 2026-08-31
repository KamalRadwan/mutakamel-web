import type { CorePath, CrmPath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

// Wire contract for the global record search — MASTER-PLAN 13.21.
//
// `PaginationQueryDto` carries an optional `search` (`@MaxLength(200)`), but it
// is honoured PER ENDPOINT, not universally. Every source below was read in
// backend source before it was listed here, and the four that made the cut are
// the four that genuinely filter on the term. What each one matches is
// recorded beside it, because "no results" means something different when the
// endpoint only looks at one column.
//
// Deliberately NOT sources, with the reason:
//
//   crm reminders          `RemindersQueryDto extends BranchListQueryDto`, so
//                          `search` validates — and `listScopedReminders`
//                          passes `undefined` where the search tuple goes
//                          (crm-app activities.service.ts). Accepted and
//                          silently ignored.
//   trade items            `CatalogListQueryDto` has no `search` at all.
//                          `POST /trade/v1/items/search` takes
//                          `CatalogSearchDto`, whose filters compare
//                          `canonical_code`/`status`/`item_kind` with `=`
//                          (catalog.repository.ts) — an exact-code lookup, not
//                          a text search.
//   trade documents        `DocumentListQueryDto` is page/limit/status/partyId.
//                          No `search` key exists, and under
//                          `forbidNonWhitelisted` sending one is a 400. The
//                          `POST …/search` routes on quotations and
//                          purchase-quotations take that SAME DTO.
//
// Recorded as Q110 and Q111 in docs/build/OPEN-QUESTIONS.md.

export const SEARCH_MIN_TERM_LENGTH = 2;
/** `PaginationQueryDto.search` is `@MaxLength(200)` — a longer term is a 400. */
export const SEARCH_MAX_TERM_LENGTH = 200;
/** How many rows each family shows before the "open the full list" link. */
export const SEARCH_PREVIEW_LIMIT = 10;
/** `PAGINATION_DEFAULTS.MAX_LIMIT` in @mutakamel/database — both apps. */
export const SEARCH_EXPORT_PAGE_SIZE = 100;

export const SEARCH_RESPONSE_LIMIT_BYTES = 512 * 1024;

/** The four record families whose list endpoint genuinely filters on the term. */
export const SEARCH_SOURCE_IDS = [
  "parties",
  "leads",
  "customerProfiles",
  "opportunities",
] as const;
export type SearchSourceId = (typeof SEARCH_SOURCE_IDS)[number];

/** The two families named by 13.21 whose endpoints cannot search at all. */
export const UNSEARCHABLE_SOURCE_IDS = ["items", "commercialDocuments"] as const;
export type UnsearchableSourceId = (typeof UNSEARCHABLE_SOURCE_IDS)[number];

export interface SearchResultRow {
  id: string;
  title: string;
  subtitle: string | null;
}

export interface SearchSourcePage {
  items: SearchResultRow[];
  total: number;
}

export interface SearchSourceDefinition {
  id: SearchSourceId;
  /** `crm` sources need a branch; `core` ones do not. */
  app: "core" | "crm";
  /** Route admission for the module this family lives in. */
  permission: string;
  /** CRM read grants carry `.own`/`.team`/`.all`; Core's never do. */
  acceptsScopedPermission: boolean;
  /** Where "open the full list" goes. */
  listHref: string;
  detailHref: (id: string) => string;
}

export const SEARCH_SOURCES: Readonly<Record<SearchSourceId, SearchSourceDefinition>> = {
  // GET /api/tenant/core/v1/directory/parties
  // PartyQueryDto extends PaginationQueryDto; directory.service.ts passes
  // `query.search` straight into `searchDirectoryPage`, and PartiesRepository
  // declares searchableFields: displayName, legalName, firstName, lastName,
  // organizationName, taxNumber, commercialRegistrationNumber.
  parties: {
    id: "parties",
    app: "core",
    permission: "directory.party.read",
    acceptsScopedPermission: false,
    listHref: TENANT_ROUTES.coreDirectory,
    detailHref: (id) => `${TENANT_ROUTES.coreDirectory}/${id}`,
  },
  // GET /api/tenant/crm/v1/leads
  // leads.service.ts findAll -> LeadsRepository.searchReadModels, which applies
  // `partySearchPredicate()`: party display_name / first_name / last_name /
  // organization_name, plus any party contact-method value.
  leads: {
    id: "leads",
    app: "crm",
    permission: "crm.leads.read",
    acceptsScopedPermission: true,
    listHref: TENANT_ROUTES.crmLeads,
    detailHref: (id) => `${TENANT_ROUTES.crmLeads}/${id}`,
  },
  // GET /api/tenant/crm/v1/customer-profiles — the same party predicate.
  customerProfiles: {
    id: "customerProfiles",
    app: "crm",
    permission: "crm.customer_profiles.read",
    acceptsScopedPermission: true,
    listHref: TENANT_ROUTES.crmCustomerProfiles,
    detailHref: (id) => `${TENANT_ROUTES.crmCustomerProfiles}/${id}`,
  },
  // GET /api/tenant/crm/v1/opportunities
  // opportunities.service.ts findAll -> BaseTenantRepository.search ->
  // applyFreeText over `searchableFields: ['title']`. TITLE ONLY: an
  // opportunity found by its customer's name is not a result this route can
  // return, and the screen says so rather than letting the user infer it.
  opportunities: {
    id: "opportunities",
    app: "crm",
    permission: "crm.opportunities.read",
    acceptsScopedPermission: true,
    listHref: TENANT_ROUTES.crmOpportunities,
    detailHref: (id) => `${TENANT_ROUTES.crmOpportunities}/${id}`,
  },
};

export const CORE_PARTIES_PATH: CorePath = "/api/tenant/core/v1/directory/parties";

export type CrmSearchSourceId = Exclude<SearchSourceId, "parties">;

const CRM_SOURCE_PATHS: Record<CrmSearchSourceId, CrmPath> = {
  leads: "/api/tenant/crm/v1/leads",
  customerProfiles: "/api/tenant/crm/v1/customer-profiles",
  opportunities: "/api/tenant/crm/v1/opportunities",
};

/** Trimmed and clamped to what the DTO accepts, so a long paste is not a 400. */
export function normalizeSearchTerm(raw: string): string {
  return raw.trim().slice(0, SEARCH_MAX_TERM_LENGTH);
}

export function isSearchableTerm(term: string): boolean {
  return term.length >= SEARCH_MIN_TERM_LENGTH;
}

/**
 * `sortBy` is sent only to Core: its parties route sorts on `displayName`,
 * which is the useful order for a name search. The CRM lists sort by
 * `createdAt` by default and their `sortBy` whitelist does not include the
 * party columns the search matches, so asking for one would be a 400.
 */
export function buildPartiesSearchQuery(
  term: string,
  page: number,
  limit: number,
): string {
  return new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy: "displayName",
    sortDir: "ASC",
    search: term,
  }).toString();
}

export function buildCrmSearchPath(
  source: CrmSearchSourceId,
  branchId: string,
  term: string,
  page: number,
  limit: number,
): CrmPath {
  const query = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(limit),
    search: term,
  });
  return `${CRM_SOURCE_PATHS[source]}?${query.toString()}` as CrmPath;
}

function invalid(): never {
  throw new Error("Invalid search response.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredId(source: Record<string, unknown>): string {
  const value = source.id;
  if (!isUUIDv7(value)) invalid();
  return value;
}

function requiredLabel(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) invalid();
  return value;
}

function optionalLabel(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid();
  return value;
}

function safeCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalid();
  return value as number;
}

function assertDistinct(items: SearchResultRow[]): SearchResultRow[] {
  if (new Set(items.map(({ id }) => id)).size !== items.length) invalid();
  return items;
}

type RowProjection = (source: Record<string, unknown>) => SearchResultRow;

const ROW_PROJECTIONS: Record<SearchSourceId, RowProjection> = {
  // PartyEntity: `displayName` is NOT NULL; `legalName` is nullable.
  parties: (source) => ({
    id: requiredId(source),
    title: requiredLabel(source, "displayName"),
    subtitle: optionalLabel(source, "legalName"),
  }),
  // LeadReadModel = LeadEntity & PartyBackedIdentity — `displayName` is always
  // projected, `companyName` only for a party that carries one.
  leads: (source) => ({
    id: requiredId(source),
    title: requiredLabel(source, "displayName"),
    subtitle: optionalLabel(source, "companyName"),
  }),
  customerProfiles: (source) => ({
    id: requiredId(source),
    title: requiredLabel(source, "displayName"),
    subtitle: optionalLabel(source, "companyName"),
  }),
  // OpportunityEntity.title is NOT NULL and is the only searched column.
  opportunities: (source) => ({
    id: requiredId(source),
    title: requiredLabel(source, "title"),
    subtitle: null,
  }),
};

function projectRows(source: SearchSourceId, items: unknown[]): SearchResultRow[] {
  const project = ROW_PROJECTIONS[source];
  return assertDistinct(
    items.map((item) => {
      const row = record(item);
      if (!row) invalid();
      return project(row);
    }),
  );
}

/**
 * Core's paginated envelope: `data` is the items array and the pager sits in a
 * SIBLING `meta` — S1. Never run this through the CRM reader.
 */
export function parseCoreSearchPage(envelope: {
  data: unknown;
  meta: unknown;
}): SearchSourcePage {
  if (!Array.isArray(envelope.data)) invalid();
  const meta = record(envelope.meta);
  if (!meta) invalid();
  const items = projectRows("parties", envelope.data);
  const total = safeCount(meta.total);
  if (items.length > total) invalid();
  return { items, total };
}

/**
 * A CRM list body, exactly as sent: FLAT — `{ items, total, page, limit,
 * totalPages, hasNext, hasPrev }` with no `meta` anywhere in crm-app. Reading
 * `payload.meta` here is the defect that shipped in `useOpportunitiesList.ts`
 * and threw on every genuine response (docs/api/README.md#crm--raw).
 */
export function parseCrmSearchPage(
  source: CrmSearchSourceId,
  payload: unknown,
): SearchSourcePage {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) invalid();
  const items = projectRows(source, page.items);
  const total = safeCount(page.total);
  if (items.length > total) invalid();
  return { items, total };
}
