// Advanced search keeps its explicit-submit filter tree; Basic uses removable tokens.

import {
  crmCompileFilterTree,
  crmUnselectedCondition,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
  type CrmSearchRequestBody,
} from "../shared/search/filter-tree";

import {
  EMPTY_LEAD_BASIC_SEARCH, DEFAULT_LEAD_BASIC_SEARCH, replaceLeadBasicField,
  type LeadBasicSearch, type LeadSearchFieldId, type LeadSearchWindow,
} from "./lead-basic-search-contract";

/* ----------------------------- advanced mode ---------------------------- */

/**
 * `LEAD_FILTERABLE_FIELDS` in crm-app/src/crm/leads/repo/leads.repository.ts,
 * copied here in the SAME ORDER — the whole of what a leaf's `field` may say.
 *
 * A field outside this list is `400 INVALID_FIELD` with the allowed set in
 * `details.allowed`, which reaches the screen as a failed load rather than as
 * an unavailable filter. Exported so the test can pin the boundary from the
 * outside instead of trusting the catalogue below to be a subset by eye.
 *
 * Party-backed display columns — `displayName`, `firstName`, `lastName`,
 * `companyName`, `email`, `primaryMobile`, `phones` — are deliberately absent:
 * they come from a raw join the filter compiler cannot see.
 */
export const LEAD_FILTERABLE_FIELDS: readonly string[] = [
  "id",
  "branchId",
  "acquisitionSourceId",
  "leadProfileType",
  "stageId",
  "stageFlag",
  "status",
  "rating",
  "cardColor",
  "ownerUserId",
  "createdByUserId",
  "description",
  "interestSummary",
  "expectedNeed",
  "convertedCustomerProfileId",
  "convertedOpportunityId",
  "convertedAt",
  "createdAt",
  "updatedAt",
];

export type LeadAdvancedFieldId =
  | "id"
  | "source"
  | "leadType"
  | "stage"
  | "stageFlag"
  | "status"
  | "rating"
  | "cardColor"
  | "owner"
  | "createdBy"
  | "description"
  | "interestSummary"
  | "expectedNeed"
  | "convertedCustomerProfile"
  | "convertedOpportunity"
  | "convertedAt"
  | "createdAt"
  | "updatedAt";

/**
 * Every whitelisted column the card offers, with the kind that decides its
 * operator list and its value control.
 *
 * `nullable` is read from `LeadEntity` (@mutakamel/crm-app-database), because
 * it is what decides whether `isNull`/`isNotNull` may be offered at all —
 * asking whether a `NOT NULL` column is empty is a question with one answer.
 *
 * `branchId` is the ONE whitelisted column left out. The request body already
 * carries the branch and the tree is ANDed onto the scoped query, so a
 * `branchId` leaf can only restate the scope or contradict it: a no-op, or a
 * guaranteed empty list. A control that cannot narrow anything is a trap.
 */
export const LEAD_ADVANCED_FIELDS: readonly CrmSearchFieldDef<LeadAdvancedFieldId>[] = [
  { id: "id", field: "id", kind: "uuid", operators: ["eq"] },
  {
    id: "source",
    field: "acquisitionSourceId",
    kind: "catalogue",
    nullable: true,
    operators: ["eq", "neq", "in", "nin"],
  },
  {
    id: "leadType",
    field: "leadProfileType",
    kind: "enum",
    operators: ["eq"],
    values: ["INDIVIDUAL", "CORPORATE"],
  },
  {
    id: "stage",
    field: "stageId",
    kind: "catalogue",
    operators: ["eq", "neq", "in", "nin"],
  },
  {
    id: "stageFlag",
    field: "stageFlag",
    kind: "enum",
    operators: ["eq", "neq", "in", "nin"],
    values: [
      "NEW",
      "CONTACTED",
      "QUALIFYING",
      "QUALIFIED",
      "DISQUALIFIED",
      "CONVERTED",
      "NURTURING",
      "ON_HOLD",
    ],
  },
  {
    id: "status",
    field: "status",
    kind: "enum",
    operators: ["eq", "neq", "in", "nin"],
    values: ["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"],
  },
  {
    id: "rating",
    field: "rating",
    kind: "number",
    operators: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  },
  {
    id: "cardColor",
    field: "cardColor",
    kind: "enum",
    nullable: true,
    operators: ["eq", "neq", "in", "nin"],
    values: [
      "RED",
      "ORANGE",
      "AMBER",
      "YELLOW",
      "GREEN",
      "TEAL",
      "BLUE",
      "INDIGO",
      "PURPLE",
      "PINK",
      "SLATE",
    ],
  },
  {
    id: "owner",
    field: "ownerUserId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "createdBy",
    field: "createdByUserId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "description",
    field: "description",
    kind: "text",
    nullable: true,
    maxLength: 2000,
    operators: ["ilike", "like", "startsWith", "endsWith", "eq", "neq"],
  },
  {
    id: "interestSummary",
    field: "interestSummary",
    kind: "text",
    nullable: true,
    maxLength: 2000,
    operators: ["ilike", "like", "startsWith", "endsWith", "eq", "neq"],
  },
  {
    id: "expectedNeed",
    field: "expectedNeed",
    kind: "text",
    nullable: true,
    maxLength: 2000,
    operators: ["ilike", "like", "startsWith", "endsWith", "eq", "neq"],
  },
  {
    id: "convertedCustomerProfile",
    field: "convertedCustomerProfileId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "convertedOpportunity",
    field: "convertedOpportunityId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "convertedAt",
    field: "convertedAt",
    kind: "date",
    nullable: true,
    operators: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    id: "createdAt",
    field: "createdAt",
    kind: "date",
    operators: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    id: "updatedAt",
    field: "updatedAt",
    kind: "date",
    operators: ["gt", "gte", "lt", "lte", "between"],
  },
];

export type LeadSearchGroup = CrmSearchGroup<LeadAdvancedFieldId>;

export function leadAdvancedField(
  id: LeadAdvancedFieldId,
): CrmSearchFieldDef<LeadAdvancedFieldId> {
  const field = LEAD_ADVANCED_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Unknown lead filter field: ${id}`);
  return field;
}

/** The field a fresh condition opens on. */
export const DEFAULT_LEAD_ADVANCED_FIELD = LEAD_ADVANCED_FIELDS[0]!;

/* -------------------------------- state --------------------------------- */

/**
 * Basic holds filter tokens; advanced holds the editable tree of the
 * search route. They are separate shapes because they are separate wires —
 * carrying a half-built tree into a query string is not possible, and
 * pretending otherwise is what the old "advanced" mode did.
 */
export type LeadSearchMode = "basic" | "advanced";

export interface LeadSearchState {
  mode: LeadSearchMode;
  /** Committed Basic filters; unfinished typing stays inside the search input. */
  basic: LeadBasicSearch;
  /**
   * Advanced mode's sections: AND inside a group, OR between groups. NEVER
   * empty — an emptied card keeps one blank group, so the controls that add
   * the next condition are still on screen.
   */
  groups: readonly LeadSearchGroup[];
}

/** An explicitly cleared search. New visits use DEFAULT_LEAD_SEARCH. */
export const EMPTY_LEAD_SEARCH: LeadSearchState = {
  mode: "basic",
  basic: EMPTY_LEAD_BASIC_SEARCH,
  groups: [
    { conditions: [crmUnselectedCondition(DEFAULT_LEAD_ADVANCED_FIELD)] },
  ],
};

export const DEFAULT_LEAD_SEARCH: LeadSearchState = {
  ...EMPTY_LEAD_SEARCH, basic: DEFAULT_LEAD_BASIC_SEARCH,
};

/** Each mode retains its own draft; switching never translates conditions. */
export function leadSearchWithMode(
  state: LeadSearchState,
  mode: LeadSearchMode,
): LeadSearchState {
  return mode === state.mode ? state : { ...state, mode };
}

/** The stage strip reflects every selected stage, including OR alternatives. */
export function leadSearchValuesOf(state: LeadSearchState, field: LeadSearchFieldId): string[] {
  return state.basic.filters.filter((filter) => filter.field === field).map((filter) => filter.value);
}

/** Stage-strip changes preserve My Leads and every other Basic field. */
export function leadSearchWithField(state: LeadSearchState, field: LeadSearchFieldId, value: string): LeadSearchState {
  return { ...state, mode: "basic", basic: replaceLeadBasicField(state.basic, field, value) };
}

/** Advanced mode's groups, replaced wholesale by the card's editors. */
export function leadSearchWithGroups(
  state: LeadSearchState,
  groups: readonly LeadSearchGroup[],
): LeadSearchState {
  return { ...state, groups };
}

/** Advanced mode back to blank, without leaving it. */
export function leadSearchCleared(state: LeadSearchState): LeadSearchState {
  return { ...state, groups: EMPTY_LEAD_SEARCH.groups };
}

/**
 * The `POST /crm/leads/search` body.
 *
 * `filterTree` is omitted when empty rather than sent as `{}`. The Leads
 * Advanced UI is condition-only; Party text scopes live in Basic search.
 */
export function buildLeadSearchRequest(
  state: LeadSearchState,
  { branchId, page, limit, sortBy, sortDir }: LeadSearchWindow,
): CrmSearchRequestBody {
  const filterTree = crmCompileFilterTree(state.groups, leadAdvancedField);
  return {
    branchId,
    ...(filterTree ? { filterTree } : {}),
    // `field:DIR` is the one form `SortCompiler.normalise` and the GET route
    // agree on, so both modes order rows identically.
    sort: `${sortBy}:${sortDir}`,
    page,
    limit,
  };
}
