import { isUUIDv7 } from "@/lib/uuid";

type OpportunityTextSearchField =
  | "opportunity"
  | "customer"
  | "email"
  | "phone";

export type OpportunitySearchFieldId =
  | OpportunityTextSearchField
  | "tag"
  | "status"
  | "stageFlag"
  | "pipeline"
  | "stage";

export interface OpportunitySearchFieldDef {
  id: OpportunitySearchFieldId;
  kind: "text" | "tag" | "enum" | "catalogue";
  queryKey:
    | "search"
    | "tagIds"
    | "status"
    | "stageFlag"
    | "pipelineId"
    | "stageId";
  searchField?: OpportunityTextSearchField;
  values?: readonly string[];
}

export const OPPORTUNITY_SEARCH_FIELDS: readonly OpportunitySearchFieldDef[] = [
  { id: "opportunity", kind: "text", queryKey: "search", searchField: "opportunity" },
  { id: "customer", kind: "text", queryKey: "search", searchField: "customer" },
  { id: "email", kind: "text", queryKey: "search", searchField: "email" },
  { id: "phone", kind: "text", queryKey: "search", searchField: "phone" },
  { id: "tag", kind: "tag", queryKey: "tagIds" },
  {
    id: "status",
    kind: "enum",
    queryKey: "status",
    values: ["IN_PROGRESS", "ON_HOLD", "WON", "LOST"],
  },
  {
    id: "stageFlag",
    kind: "enum",
    queryKey: "stageFlag",
    values: [
      "NEW",
      "DISCOVERY",
      "QUALIFICATION",
      "PROPOSAL",
      "NEGOTIATION",
      "CONTRACTING",
      "ON_HOLD",
      "WON",
      "LOST",
    ],
  },
  { id: "pipeline", kind: "catalogue", queryKey: "pipelineId" },
  { id: "stage", kind: "catalogue", queryKey: "stageId" },
];

export interface OpportunityBasicFilter {
  field: OpportunitySearchFieldId;
  value: string;
}

export interface OpportunityBasicSearch {
  /** Compatibility for the former one-box UI; new UI stores text in filters. */
  text: string;
  myOpportunities: boolean;
  filters: readonly OpportunityBasicFilter[];
}

export const EMPTY_OPPORTUNITY_BASIC_SEARCH: OpportunityBasicSearch = {
  text: "",
  myOpportunities: false,
  filters: [],
};

export const DEFAULT_OPPORTUNITY_BASIC_SEARCH: OpportunityBasicSearch = {
  text: "",
  myOpportunities: true,
  filters: [],
};

export const MAX_OPPORTUNITY_SEARCH_TAGS = 50;

export function opportunitySearchField(
  id: OpportunitySearchFieldId,
): OpportunitySearchFieldDef {
  const field = OPPORTUNITY_SEARCH_FIELDS.find((entry) => entry.id === id);
  if (!field) throw new Error(`Unknown opportunity search field: ${id}`);
  return field;
}

export function opportunityBasicFilterId(filter: OpportunityBasicFilter): string {
  return `${filter.field}:${filter.value}`;
}

function normalizeFilter(filter: OpportunityBasicFilter): OpportunityBasicFilter | null {
  const field = opportunitySearchField(filter.field);
  const value = filter.value.trim().slice(0, field.kind === "text" ? 200 : undefined);
  if (!value) return null;
  if (field.values && !field.values.includes(value)) {
    throw new Error("Invalid opportunity search value.");
  }
  if ((field.kind === "tag" || field.kind === "catalogue") && !isUUIDv7(value)) {
    throw new Error("Invalid opportunity search value.");
  }
  return { field: filter.field, value };
}

function isTextField(field: OpportunitySearchFieldId): field is OpportunityTextSearchField {
  return opportunitySearchField(field).kind === "text";
}

export function addOpportunityBasicFilter(
  basic: OpportunityBasicSearch,
  filter: OpportunityBasicFilter,
): OpportunityBasicSearch {
  const next = normalizeFilter(filter);
  if (!next) return basic;
  if (basic.filters.some((entry) => opportunityBasicFilterId(entry) === opportunityBasicFilterId(next))) {
    return basic;
  }
  if (
    next.field === "tag" &&
    basic.filters.filter(({ field }) => field === "tag").length >= MAX_OPPORTUNITY_SEARCH_TAGS
  ) {
    return basic;
  }
  const filters = isTextField(next.field)
    ? basic.filters.filter((entry) => !isTextField(entry.field))
    : next.field === "tag"
      ? basic.filters
      : basic.filters.filter((entry) => entry.field !== next.field);
  return { ...basic, text: "", filters: [...filters, next] };
}

export function opportunityBasicSearchForCustomerParty(
  partyId: string,
): OpportunityBasicSearch {
  const trimmed = partyId.trim();
  if (!trimmed) return EMPTY_OPPORTUNITY_BASIC_SEARCH;
  return addOpportunityBasicFilter(EMPTY_OPPORTUNITY_BASIC_SEARCH, {
    field: "customer",
    value: trimmed,
  });
}

export function removeOpportunityBasicFilter(
  basic: OpportunityBasicSearch,
  id: string,
): OpportunityBasicSearch {
  return id === "my-opportunities"
    ? { ...basic, myOpportunities: false }
    : {
        ...basic,
        filters: basic.filters.filter((entry) => opportunityBasicFilterId(entry) !== id),
      };
}

export interface OpportunityBasicWireValues {
  search?: string;
  searchField?: OpportunityTextSearchField;
  status?: string;
  stageFlag?: string;
  pipelineId?: string;
  stageId?: string;
  ownerUserId?: string;
  tagIds: string[];
}

/** Compiles the shared Basic chips for list, board, card and stage-page reads. */
export function compileOpportunityBasicSearch(
  basic: OpportunityBasicSearch,
  actorUserId?: string,
): OpportunityBasicWireValues {
  const values: OpportunityBasicWireValues = { tagIds: [] };
  const textFilters = basic.filters.filter(({ field }) => isTextField(field));
  if (textFilters.length > 1) {
    throw new Error("Only one semantic opportunity search term is supported.");
  }
  const text = textFilters[0];
  if (text) {
    values.search = text.value.trim().slice(0, 200);
    values.searchField = text.field as OpportunityTextSearchField;
  } else {
    const legacyText = basic.text.trim().slice(0, 200);
    if (legacyText) {
      values.search = legacyText;
      values.searchField = "opportunity";
    }
  }
  for (const input of basic.filters) {
    const filter = normalizeFilter(input);
    if (!filter || isTextField(filter.field)) continue;
    if (filter.field === "tag") {
      if (!values.tagIds.includes(filter.value)) values.tagIds.push(filter.value);
    } else if (filter.field === "pipeline") {
      values.pipelineId = filter.value;
    } else if (filter.field === "stage") {
      values.stageId = filter.value;
    } else {
      values[filter.field] = filter.value;
    }
  }
  if (values.tagIds.length > MAX_OPPORTUNITY_SEARCH_TAGS) {
    throw new Error(`At most ${MAX_OPPORTUNITY_SEARCH_TAGS} opportunity tags are supported.`);
  }
  if (basic.myOpportunities) {
    if (!isUUIDv7(actorUserId)) {
      throw new Error("My Opportunities requires the authenticated user.");
    }
    values.ownerUserId = actorUserId;
  }
  return values;
}

export function appendOpportunityBasicQuery(
  query: URLSearchParams,
  basic: OpportunityBasicSearch,
  actorUserId?: string,
  options: { includePipeline?: boolean; includeStage?: boolean } = {},
): URLSearchParams {
  const values = compileOpportunityBasicSearch(basic, actorUserId);
  if (values.search) query.set("search", values.search);
  if (values.searchField) query.set("searchField", values.searchField);
  if (values.status) query.set("status", values.status);
  if (values.stageFlag) query.set("stageFlag", values.stageFlag);
  if (values.pipelineId && options.includePipeline !== false) {
    query.set("pipelineId", values.pipelineId);
  }
  if (values.stageId && options.includeStage !== false) {
    query.set("stageId", values.stageId);
  }
  if (values.ownerUserId) query.set("ownerUserId", values.ownerUserId);
  for (const tagId of values.tagIds) query.append("tagIds", tagId);
  return query;
}
