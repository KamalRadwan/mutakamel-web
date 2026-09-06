// The leads screen's entire wire vocabulary — the `GET /leads` query string
// AND the `POST /leads/search` body. Nothing outside this module may name a
// lead query parameter or a filterable column.
//
// TWO endpoints, because they answer two different questions:
//
//  * **Basic** is one condition, typed and answered as you type, over
//    `GET /crm/leads`. `whitelist + forbidNonWhitelisted + forbidUnknownValues`
//    are all on (crm-app/src/main.ts), so an undocumented key is a hard 400
//    rather than a field the server quietly drops. The twelve keys in
//    `LEAD_LIST_QUERY_KEYS` are the entire accepted surface, read from
//    `LeadsQueryDto` and the `PaginationQueryDto` it extends.
//  * **Advanced** is a filter TREE, over `POST /crm/leads/search`. It is a
//    POST only because the tree does not fit in a query string; it reads,
//    writes nothing, and needs no idempotency key. The response envelope is
//    byte-identical to the list route's, so `parseLeadsResponse` serves both.
//
// Four rules shape the file:
//
//  1. **A blank value is not a filter.** `status=` is an empty string to
//     `@IsEnum`, and a `filterTree` leaf with no `value` is
//     `400 INVALID_OPERATOR_VALUE` on every operator but `isNull`/`isNotNull`.
//     Either way a value that trims to nothing means the condition is omitted
//     entirely, never sent empty.
//  2. **There is NO uniqueness rule.** A query string has one slot per key, so
//     basic's single condition is naturally unique; a filter tree has a node
//     per leaf, so `stageFlag = NEW OR stageFlag = CONTACTED` is a normal
//     question. The old "one row per field" restriction was a fact about the
//     query string that had leaked into the screen, and it is gone.
//  3. **`sortBy` has no fallback.** The service validates it against
//     `['displayName', 'createdAt']` and 400s on anything else rather than
//     sorting by a default. `POST /search` runs the same pair through
//     `searchSort`, so both modes are typed by `LeadsSortBy`.
//  4. **`search` is identity text, not description text.** It matches the
//     party's display name, first name, last name, organization name and its
//     contact methods (phone/email). Those columns come from a raw join the
//     filter compiler cannot resolve to a column, so they are NOT in
//     `LEAD_FILTERABLE_FIELDS` and cannot be a tree condition — free text is
//     the only way to reach them, in either mode.

import {
  crmCompileFilterTree,
  crmSearchTerm,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
  type CrmSearchRequestBody,
} from "../shared/search/filter-tree";

/** `sortBy`'s entire accepted set. Anything else is a 400, never a fallback. */
type LeadsSortBy = "displayName" | "createdAt";

/** `sortDir` is `SortDirectionEnum`, which is upper case on the wire. */
type LeadsSortDir = "ASC" | "DESC";

/* ------------------------------ basic mode ------------------------------ */

/**
 * How a basic field's value is entered — the value control's type follows this.
 *
 * `stage` and `source` are both uuid equality filters on the wire; they are
 * separate kinds because their option lists come from different catalogues
 * (the stages the leads hook already loaded, and the acquisition-source
 * catalogue), and only the component that renders them knows how to get each.
 */
type LeadSearchValueKind = "text" | "enum" | "stage" | "source";

export interface LeadSearchFieldDef {
  /**
   * The screen's identity for the field, and the value of the field picker.
   *
   * Deliberately NOT the wire key, even where the two happen to be spelled
   * alike: this module is the only place that may name a query parameter, so
   * nothing outside it can drift a key by renaming a UI concept.
   */
  readonly id: LeadSearchFieldId;
  /** The query parameter this field filters on. */
  readonly key: string;
  readonly kind: LeadSearchValueKind;
  /** The accepted wire values, for `kind: "enum"` only. */
  readonly values?: readonly string[];
  /** `@MaxLength` on the wire, for `kind: "text"` only. */
  readonly maxLength?: number;
}

export type LeadSearchFieldId =
  | "text"
  | "status"
  | "stageFlag"
  | "leadType"
  | "stage"
  | "source";

export const LEAD_SEARCH_FIELDS: readonly LeadSearchFieldDef[] = [
  { id: "text", key: "search", kind: "text", maxLength: 200 },
  {
    id: "status",
    key: "status",
    kind: "enum",
    values: ["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"],
  },
  {
    id: "stageFlag",
    key: "stageFlag",
    kind: "enum",
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
    id: "leadType",
    key: "leadProfileType",
    kind: "enum",
    values: ["INDIVIDUAL", "CORPORATE"],
  },
  { id: "stage", key: "stageId", kind: "stage" },
  { id: "source", key: "acquisitionSourceId", kind: "source" },
] as const;

/** The field basic mode opens on: free text over names and contact methods. */
const DEFAULT_LEAD_SEARCH_FIELD: LeadSearchFieldId = "text";

/** Basic mode's one condition: a field, and the value it must equal. */
export interface LeadSearchRow {
  field: LeadSearchFieldId;
  /** Raw control value. Empty means "no filter", never an empty filter. */
  value: string;
}

export function leadSearchField(id: LeadSearchFieldId): LeadSearchFieldDef {
  const field = LEAD_SEARCH_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Unknown lead search field: ${id}`);
  return field;
}

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
 * they come from a raw join the filter compiler cannot see. Rule 4 in the
 * header, and the card says so where a user would look for them.
 */
export const LEAD_FILTERABLE_FIELDS: readonly string[] = [
  "id",
  "branchId",
  "acquisitionSourceId",
  "leadProfileType",
  "stageId",
  "stageFlag",
  "status",
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
  { id: "id", field: "id", kind: "uuid" },
  { id: "source", field: "acquisitionSourceId", kind: "catalogue", nullable: true },
  {
    id: "leadType",
    field: "leadProfileType",
    kind: "enum",
    values: ["INDIVIDUAL", "CORPORATE"],
  },
  { id: "stage", field: "stageId", kind: "catalogue" },
  {
    id: "stageFlag",
    field: "stageFlag",
    kind: "enum",
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
    values: ["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"],
  },
  { id: "owner", field: "ownerUserId", kind: "uuid", nullable: true },
  { id: "createdBy", field: "createdByUserId", kind: "uuid", nullable: true },
  { id: "description", field: "description", kind: "text", nullable: true, maxLength: 2000 },
  {
    id: "interestSummary",
    field: "interestSummary",
    kind: "text",
    nullable: true,
    maxLength: 2000,
  },
  { id: "expectedNeed", field: "expectedNeed", kind: "text", nullable: true, maxLength: 2000 },
  {
    id: "convertedCustomerProfile",
    field: "convertedCustomerProfileId",
    kind: "uuid",
    nullable: true,
  },
  { id: "convertedOpportunity", field: "convertedOpportunityId", kind: "uuid", nullable: true },
  { id: "convertedAt", field: "convertedAt", kind: "date", nullable: true },
  { id: "createdAt", field: "createdAt", kind: "date" },
  { id: "updatedAt", field: "updatedAt", kind: "date" },
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
 * Basic asks one condition of the list route; advanced asks a tree of the
 * search route. They are separate shapes because they are separate wires —
 * carrying a half-built tree into a query string is not possible, and
 * pretending otherwise is what the old "advanced" mode did.
 */
export type LeadSearchMode = "basic" | "advanced";

export interface LeadSearchState {
  mode: LeadSearchMode;
  /** Basic mode's single condition. A blank value means no filter. */
  basic: LeadSearchRow;
  /** Advanced mode's free-text term — rule 4's only route to the party columns. */
  text: string;
  /**
   * Advanced mode's sections: AND inside a group, OR between groups. NEVER
   * empty — an emptied card keeps one blank group, so the controls that add
   * the next condition are still on screen.
   */
  groups: readonly LeadSearchGroup[];
}

/** Nothing selected: basic, one blank condition, so no filter key is sent. */
export const EMPTY_LEAD_SEARCH: LeadSearchState = {
  mode: "basic",
  basic: { field: DEFAULT_LEAD_SEARCH_FIELD, value: "" },
  text: "",
  groups: [
    { conditions: [{ field: DEFAULT_LEAD_ADVANCED_FIELD.id, operator: "eq", value: "", valueTo: "" }] },
  ],
};

/**
 * Switch mode. Neither side's question is carried into the other.
 *
 * The two modes speak different wires: basic's `status=OPEN` is a query
 * parameter and advanced's is a tree leaf with an operator beside it, and
 * there is no honest translation of "contains, between, or this OR that" into
 * one query slot. Losing the question on a switch is visible; silently
 * dropping the half of it that does not fit is not.
 */
export function leadSearchWithMode(
  state: LeadSearchState,
  mode: LeadSearchMode,
): LeadSearchState {
  return mode === state.mode ? state : { ...state, mode };
}

/** Basic mode's condition with `patch` applied. */
export function leadSearchWithRow(
  state: LeadSearchState,
  patch: Partial<LeadSearchRow>,
): LeadSearchState {
  const field = patch.field ?? state.basic.field;
  // Changing the FIELD clears the VALUE. `OPEN` is a lead status and means
  // nothing as a stage id, and carrying it across would send a value the wire
  // rejects with a 400 that reads as an empty list.
  const value = field !== state.basic.field ? "" : (patch.value ?? state.basic.value);
  return { ...state, basic: { field, value } };
}

/** The value basic mode is filtering `field` on, or "" when it is not. */
export function leadSearchValueOf(
  state: LeadSearchState,
  field: LeadSearchFieldId,
): string {
  return state.basic.field === field ? state.basic.value : "";
}

/**
 * State with basic mode filtering on `field` — for a control that names a
 * field rather than a row, which is the stage bar above the card and table
 * views.
 *
 * A blank value drops the condition instead of blanking it, so pressing the
 * bar's "all" really does return an unfiltered list.
 */
export function leadSearchWithField(
  state: LeadSearchState,
  field: LeadSearchFieldId,
  value: string,
): LeadSearchState {
  if (!value) return { ...state, basic: { field: DEFAULT_LEAD_SEARCH_FIELD, value: "" } };
  return { ...state, basic: { field, value } };
}

/** Advanced mode's groups, replaced wholesale by the card's editors. */
export function leadSearchWithGroups(
  state: LeadSearchState,
  groups: readonly LeadSearchGroup[],
): LeadSearchState {
  return { ...state, groups };
}

/** Advanced mode's free-text term. */
export function leadSearchWithText(state: LeadSearchState, text: string): LeadSearchState {
  return { ...state, text };
}

/** Advanced mode back to blank, without leaving it. */
export function leadSearchCleared(state: LeadSearchState): LeadSearchState {
  return { ...state, text: "", groups: EMPTY_LEAD_SEARCH.groups };
}

/* --------------------------- the two requests --------------------------- */

/**
 * All twelve keys the list endpoint accepts: `branchId`, the four pagination
 * and sort keys, and the seven filters (`search` plus the six equality
 * filters).
 *
 * Exported so the test can assert the builder never produces anything outside
 * it: an unknown key here is a 400 that empties the screen, not a no-op.
 */
export const LEAD_LIST_QUERY_KEYS: readonly string[] = [
  "branchId",
  "page",
  "limit",
  "sortBy",
  "sortDir",
  ...LEAD_SEARCH_FIELDS.map((field) => field.key),
  // Accepted by the DTO, never sent by this builder. `ownerUserId` would need
  // a control asking a human to type a raw UUID, which is worse than no filter
  // — Q132. Advanced mode offers it anyway, because there the operator list
  // makes "is empty" / "is not empty" useful answers on their own.
  "ownerUserId",
];

export interface LeadsListQueryInput {
  /** Required by the route: a list without one is 422, not an unfiltered list. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the screen asks for 50. */
  limit: number;
  sortBy: LeadsSortBy;
  sortDir: LeadsSortDir;
  search: LeadSearchState;
}

/**
 * The list request's query string, filter included.
 *
 * Parameter order is fixed — branch, page window, sort, then the filter — so
 * two users who asked the same question produce the same string, and a request
 * is comparable between a test and the network tab.
 */
export function buildLeadsListQuery({
  branchId,
  page,
  limit,
  sortBy,
  sortDir,
  search,
}: LeadsListQueryInput): URLSearchParams {
  const query = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(limit),
    sortBy,
    sortDir,
  });

  // Throws on an unknown field, which can only arrive through a cast.
  const field = leadSearchField(search.basic.field);
  const value = search.basic.value.trim();
  if (value) {
    // Clamped rather than sent long: `@MaxLength(200)` rejects the request
    // outright, so a 201st character would blank the list instead of narrowing
    // it. The input control caps at the same number, so this is the belt to its
    // braces — a pasted value is the only way to reach it.
    query.set(field.key, field.maxLength ? value.slice(0, field.maxLength) : value);
  }
  return query;
}

export interface LeadSearchRequestInput {
  /** Required by the route: `@RequireBranchAccess('body')` reads it from here. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the screen asks for 50. */
  limit: number;
  sortBy: LeadsSortBy;
  sortDir: LeadsSortDir;
}

/**
 * The `POST /crm/leads/search` body.
 *
 * `filterTree` and `search` are both OMITTED when empty rather than sent as
 * `{}` or `""`: an empty tree is not "no filter" to the compiler, and an empty
 * `search` is a `@MaxLength` string that matches nothing. A body with neither
 * is the unfiltered branch list, which is what an untouched card should ask
 * for.
 */
export function buildLeadSearchRequest(
  state: LeadSearchState,
  { branchId, page, limit, sortBy, sortDir }: LeadSearchRequestInput,
): CrmSearchRequestBody {
  const filterTree = crmCompileFilterTree(state.groups, leadAdvancedField);
  const search = crmSearchTerm(state.text);
  return {
    branchId,
    ...(filterTree ? { filterTree } : {}),
    ...(search ? { search } : {}),
    // `field:DIR` is the one form `SortCompiler.normalise` and the GET route
    // agree on, so both modes order rows identically.
    sort: `${sortBy}:${sortDir}`,
    page,
    limit,
  };
}
