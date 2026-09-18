import { isUUIDv7 } from "@/lib/uuid";
import type { CrmFilterLeaf, CrmSearchRequestBody } from "../shared/search/filter-tree";

export type LeadTextSearchField = "lead" | "customer" | "email" | "phone";
export type LeadSearchFieldId =
  | LeadTextSearchField
  | "tag"
  | "status"
  | "stageFlag"
  | "leadType"
  | "stage"
  | "source";

export interface LeadSearchFieldDef {
  id: LeadSearchFieldId;
  key: string;
  kind: "text" | "enum" | "stage" | "source" | "tag";
  searchField?: LeadTextSearchField;
  values?: readonly string[];
}

// LeadsQueryDto, LeadSearchDto and LeadsRepository.LEAD_FILTERABLE_FIELDS in crm-app.
export const LEAD_SEARCH_FIELDS: readonly LeadSearchFieldDef[] = [
  { id: "lead", key: "search", kind: "text", searchField: "lead" },
  { id: "customer", key: "search", kind: "text", searchField: "customer" },
  { id: "tag", key: "tagIds", kind: "tag" },
  { id: "email", key: "search", kind: "text", searchField: "email" },
  { id: "phone", key: "search", kind: "text", searchField: "phone" },
  { id: "status", key: "status", kind: "enum", values: ["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"] },
  { id: "stageFlag", key: "stageFlag", kind: "enum", values: [
    "NEW", "CONTACTED", "QUALIFYING", "QUALIFIED", "DISQUALIFIED", "CONVERTED", "NURTURING", "ON_HOLD",
  ] },
  { id: "leadType", key: "leadProfileType", kind: "enum", values: ["INDIVIDUAL", "CORPORATE"] },
  { id: "stage", key: "stageId", kind: "stage" },
  { id: "source", key: "acquisitionSourceId", kind: "source" },
];

export interface LeadBasicFilter { field: LeadSearchFieldId; value: string }
export interface LeadBasicSearch { myLeads: boolean; filters: readonly LeadBasicFilter[] }
export const EMPTY_LEAD_BASIC_SEARCH: LeadBasicSearch = { myLeads: false, filters: [] };
export const DEFAULT_LEAD_BASIC_SEARCH: LeadBasicSearch = { myLeads: true, filters: [] };

export interface LeadSearchWindow {
  branchId: string;
  page: number;
  limit: number;
  sortBy: "displayName" | "createdAt";
  sortDir: "ASC" | "DESC";
}

export interface LeadBasicSearchRequest extends CrmSearchRequestBody {
  searchField?: LeadTextSearchField;
  tagIds?: string[];
}

// LeadSearchDto.tagIds uses @ArrayMaxSize(MAX_SEARCH_TAG_IDS).
export const MAX_LEAD_SEARCH_TAGS = 50;

export function leadSearchField(id: LeadSearchFieldId): LeadSearchFieldDef {
  const field = LEAD_SEARCH_FIELDS.find((entry) => entry.id === id);
  if (!field) throw new Error(`Unknown lead search field: ${id}`);
  return field;
}

export function leadBasicFilterId(filter: LeadBasicFilter): string {
  return `${filter.field}:${filter.value}`;
}

function normalizeFilter(filter: LeadBasicFilter): LeadBasicFilter | null {
  const field = leadSearchField(filter.field);
  // SearchManyDto/PaginationQueryDto cap the general search at 200 characters.
  const value = filter.value.trim().slice(0, field.kind === "text" ? 200 : undefined);
  if (!value) return null;
  if (
    (field.values && !field.values.includes(value)) ||
    (["stage", "source", "tag"].includes(field.kind) && !isUUIDv7(value))
  ) {
    throw new Error("Invalid lead search value.");
  }
  return { field: filter.field, value };
}

function isTextField(id: LeadSearchFieldId): boolean {
  return leadSearchField(id).kind === "text";
}

export function addLeadBasicFilter(basic: LeadBasicSearch, filter: LeadBasicFilter): LeadBasicSearch {
  const next = normalizeFilter(filter);
  if (!next) return basic;
  if (basic.filters.some((entry) => leadBasicFilterId(entry) === leadBasicFilterId(next))) return basic;
  if (
    next.field === "tag" &&
    basic.filters.filter((entry) => entry.field === "tag").length >= MAX_LEAD_SEARCH_TAGS
  ) {
    return basic;
  }
  // The API carries one `search` and one `searchField`, so semantic text chips
  // are mutually exclusive while structured filters remain in place.
  const filters = isTextField(next.field)
    ? basic.filters.filter((entry) => !isTextField(entry.field))
    : basic.filters;
  return { ...basic, filters: [...filters, next] };
}

export function replaceLeadBasicField(basic: LeadBasicSearch, field: LeadSearchFieldId, value: string): LeadBasicSearch {
  return addLeadBasicFilter({ ...basic, filters: basic.filters.filter((entry) => entry.field !== field) }, { field, value });
}

export function removeLeadBasicFilter(basic: LeadBasicSearch, id: string): LeadBasicSearch {
  return id === "my-leads"
    ? { ...basic, myLeads: false }
    : { ...basic, filters: basic.filters.filter((entry) => leadBasicFilterId(entry) !== id) };
}

function groupedValues(basic: LeadBasicSearch): Map<LeadSearchFieldId, string[]> {
  const grouped = new Map<LeadSearchFieldId, string[]>();
  for (const input of basic.filters) {
    const filter = normalizeFilter(input);
    if (!filter) continue;
    const values = grouped.get(filter.field) ?? [];
    if (!values.includes(filter.value)) grouped.set(filter.field, [...values, filter.value]);
  }
  const textCount = [...grouped.entries()]
    .filter(([field]) => isTextField(field))
    .reduce((count, [, values]) => count + values.length, 0);
  if (textCount > 1) throw new Error("Only one semantic lead search term is supported.");
  if ((grouped.get("tag")?.length ?? 0) > MAX_LEAD_SEARCH_TAGS) {
    throw new Error(`At most ${MAX_LEAD_SEARCH_TAGS} lead tags are supported.`);
  }
  return grouped;
}

export function leadBasicSearchNeedsPost(basic: LeadBasicSearch): boolean {
  const values = groupedValues(basic);
  return values.has("tag") || [...values.entries()].some(([field, alternatives]) =>
    !isTextField(field) && alternatives.length > 1,
  );
}

function ownerId(basic: LeadBasicSearch, actorId?: string): string | undefined {
  if (!basic.myLeads) return undefined;
  if (!isUUIDv7(actorId)) throw new Error("My Leads requires the authenticated user.");
  return actorId;
}

function textFilter(values: Map<LeadSearchFieldId, string[]>): {
  field: LeadTextSearchField;
  value: string;
} | undefined {
  for (const definition of LEAD_SEARCH_FIELDS) {
    if (definition.kind !== "text" || !definition.searchField) continue;
    const value = values.get(definition.id)?.[0];
    if (value) return { field: definition.searchField, value };
  }
  return undefined;
}

export function buildLeadsListQuery({ basic, actorId, ...window }: LeadSearchWindow & {
  basic: LeadBasicSearch;
  actorId?: string;
}): URLSearchParams {
  if (leadBasicSearchNeedsPost(basic)) throw new Error("Selected lead filters require the search endpoint.");
  const values = groupedValues(basic);
  const query = new URLSearchParams({
    branchId: window.branchId,
    page: String(window.page),
    limit: String(window.limit),
    sortBy: window.sortBy,
    sortDir: window.sortDir,
  });
  for (const [field, alternatives] of values) {
    const definition = leadSearchField(field);
    if (definition.kind === "text" || definition.kind === "tag") continue;
    query.set(definition.key, alternatives[0]!);
  }
  const text = textFilter(values);
  if (text) {
    query.set("search", text.value);
    query.set("searchField", text.field);
  }
  const owner = ownerId(basic, actorId);
  if (owner) query.set("ownerUserId", owner);
  return query;
}

export function buildLeadBasicSearchRequest(
  basic: LeadBasicSearch,
  window: LeadSearchWindow,
  actorId?: string,
): LeadBasicSearchRequest {
  const values = groupedValues(basic);
  const children: CrmFilterLeaf[] = [];
  for (const [field, alternatives] of values) {
    const definition = leadSearchField(field);
    if (definition.kind === "text" || definition.kind === "tag") continue;
    children.push({
      field: definition.key,
      operator: alternatives.length === 1 ? "eq" : "in",
      value: alternatives.length === 1 ? alternatives[0] : alternatives,
    });
  }
  const owner = ownerId(basic, actorId);
  if (owner) children.push({ field: "ownerUserId", operator: "eq", value: owner });
  const text = textFilter(values);
  const tagIds = values.get("tag");
  return {
    branchId: window.branchId,
    ...(children.length ? { filterTree: children.length === 1 ? children[0] : { op: "AND" as const, children } } : {}),
    ...(text ? { search: text.value, searchField: text.field } : {}),
    ...(tagIds?.length ? { tagIds } : {}),
    sort: `${window.sortBy}:${window.sortDir}`,
    page: window.page,
    limit: window.limit,
  };
}
