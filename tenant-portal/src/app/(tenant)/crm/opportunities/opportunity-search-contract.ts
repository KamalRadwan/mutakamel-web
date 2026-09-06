// The opportunities screen's entire wire vocabulary — the `GET /opportunities`
// query string AND the `POST /opportunities/search` body. Nothing outside this
// module may name an opportunity query parameter or a filterable column.
//
// TWO endpoints, because they answer two different questions:
//
//  * **Basic** is the page-numbered list over `GET /crm/opportunities`.
//    `whitelist + forbidNonWhitelisted + forbidUnknownValues` are all on
//    (crm-app/src/main.ts), so an undocumented key is a hard 400 rather than a
//    field the server quietly drops. `OPPORTUNITY_LIST_QUERY_KEYS` is the
//    entire surface this builder may produce, read from `OpportunitiesQueryDto`
//    and the `PaginationQueryDto` it extends.
//  * **Advanced** is a filter TREE, over `POST /crm/opportunities/search`. It is
//    a POST only because the tree does not fit in a query string; it reads,
//    writes nothing, and needs no idempotency key. The response envelope is
//    byte-identical to the list route's, so `parseOpportunitiesListResponse`
//    serves both.
//
// Five facts shape the file:
//
//  1. **A blank value is not a filter.** `stageId=` is an empty string to
//     `@IsUUID('7')`, and a `filterTree` leaf with no `value` is
//     `400 INVALID_OPERATOR_VALUE` on every operator but `isNull`/`isNotNull`.
//     Either way a value that trims to nothing means the condition is omitted
//     entirely, never sent empty.
//  2. **There is NO uniqueness rule.** A query string has one slot per key, so
//     basic's filters are naturally unique; a filter tree has a node per leaf,
//     so `stageFlag = PROPOSAL OR stageFlag = NEGOTIATION` is a normal
//     question and `amount >= 1000 AND amount < 5000` is one row plus one row.
//  3. **`search` is the TITLE, and only the title.** The repository declares
//     `searchableFields: ['title']`
//     (crm-app/src/crm/opportunities/repo/opportunities.repository.ts), so the
//     free-text box is one `ILIKE %term%` over `title` on both routes. Unlike
//     leads, it reaches nothing the tree cannot: `title` is whitelisted, so
//     free text here is a shorthand for `title ilike …` rather than the only
//     door to a raw-join column. The customer and contact DISPLAY names the
//     board and card projections show are reachable by neither — they come
//     from a party join that exists only on those two routes, and the table's
//     rows carry raw ids for exactly that reason.
//  4. **`sortBy` is one of five, and falls back rather than failing.**
//     `safeSortBy(query.sortBy, 'createdAt', OPPORTUNITY_SORT_FIELDS)` on the
//     GET and `searchSort(dto.sort, 'createdAt', …)` on the POST run the same
//     list. `importance DESC` leads the ordering on both routes before the
//     chosen column, which is why the table's importance column is not
//     sortable and neither mode can ask it to be.
//  5. **The two routes scope differently.** The GET narrows by the workspace's
//     own `pipelineId`; the POST carries no pipeline key at all, so an
//     advanced result set spans every pipeline the actor may read unless the
//     user adds a `pipeline` condition themselves. Injecting one here would
//     answer a question nobody asked, so the field is offered and the choice
//     is left where it can be seen.

import {
  crmCompileFilterTree,
  crmSearchTerm,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
  type CrmSearchRequestBody,
} from "../shared/search/filter-tree";

/**
 * `OPPORTUNITY_SORT_FIELDS` in crm-app/src/crm/opportunities/opportunities.service.ts.
 *
 * Both routes run it through the same guard, so one type covers both. Anything
 * else is silently replaced by `createdAt` rather than rejected — which is
 * worse than a 400, because a table header that sorts by something else looks
 * like it worked.
 */
export type OpportunitySortBy =
  | "title"
  | "amount"
  | "probabilityPercent"
  | "expectedCloseDate"
  | "createdAt";

/** `sortDir` is `SortDirectionEnum`, which is upper case on the wire. */
type OpportunitySortDir = "ASC" | "DESC";

/* ------------------------------ basic mode ------------------------------ */

/**
 * Basic mode's one condition: the free-text term.
 *
 * It is the ONLY filter basic mode owns, and that is the honest minimum rather
 * than a shortfall. The list route also accepts `pipelineId`, `stageId`,
 * `status`, `customerProfileId`, `ownerUserId` and the two expected-close
 * bounds — but the pipeline and the stage are already asked by the workspace's
 * own pipeline picker and stage bar, which the board view needs regardless.
 * Drawing a second control for either would give one query parameter two
 * owners that overwrite each other, and a search bar that silently loses to a
 * selector above it is worse than no search bar. Everything else the DTO
 * accepts is a raw uuid or an equality the advanced card asks better, with an
 * operator beside it.
 */
interface OpportunitySearchRow {
  /** Raw control value. Empty means "no filter", never an empty filter. */
  text: string;
}

/** `@MaxLength(200)` on `PaginationQueryDto.search`; a longer term is a 400. */
const OPPORTUNITY_SEARCH_TEXT_MAX_LENGTH = 200;

/* ----------------------------- advanced mode ---------------------------- */

/**
 * `OPPORTUNITY_FILTERABLE_FIELDS` in
 * crm-app/src/crm/opportunities/repo/opportunities.repository.ts, copied here
 * in the SAME ORDER — the whole of what a leaf's `field` may say.
 *
 * A field outside this list is `400 INVALID_FIELD` with the allowed set in
 * `details.allowed`, which reaches the screen as a failed load rather than as
 * an unavailable filter. Exported so the test can pin the boundary from the
 * outside instead of trusting the catalogue below to be a subset by eye.
 *
 * The customer and contact display names are deliberately absent: they are not
 * columns of `OpportunityEntity` at all, only projections the board and card
 * routes join in. Fact 3 in the header.
 */
export const OPPORTUNITY_FILTERABLE_FIELDS: readonly string[] = [
  "id",
  "branchId",
  "customerProfileId",
  "customerPartyId",
  "contactPartyId",
  "leadId",
  "pipelineId",
  "stageId",
  "stageFlag",
  "status",
  "ownerUserId",
  "title",
  "description",
  "importance",
  "amount",
  "currencyCode",
  "probabilityPercent",
  "expectedCloseDate",
  "wonAt",
  "lostAt",
  "lostReason",
  "createdAt",
  "updatedAt",
];

export type OpportunityAdvancedFieldId =
  | "id"
  | "customerProfile"
  | "customerParty"
  | "contactParty"
  | "lead"
  | "pipeline"
  | "stage"
  | "stageFlag"
  | "status"
  | "owner"
  | "title"
  | "description"
  | "importance"
  | "amount"
  | "currencyCode"
  | "probabilityPercent"
  | "expectedCloseDate"
  | "wonAt"
  | "lostAt"
  | "lostReason"
  | "createdAt"
  | "updatedAt";

/**
 * Every whitelisted column the card offers, with the kind that decides its
 * operator list and its value control.
 *
 * `nullable` is read from `OpportunityEntity` (@mutakamel/crm-app-database),
 * because it is what decides whether `isNull`/`isNotNull` may be offered at
 * all — asking whether a `NOT NULL` column is empty is a question with one
 * answer, and drawing it invites a user to ask it.
 *
 * `branchId` is the ONE whitelisted column left out. The request body already
 * carries the branch and the tree is ANDed onto the scoped query
 * (`OpportunitiesService.search` pushes `branchId = dto.branchId` as a flat
 * filter before the tree is compiled), so a `branchId` leaf can only restate
 * the scope or contradict it: a no-op, or a guaranteed empty list. A control
 * that cannot narrow anything is a trap.
 *
 * `amount`, `importance` and `probabilityPercent` are `number`, which is the
 * kind that CONVERTS: `requireNumberOrDate` accepts a numeric string as a date,
 * so `amount > "500"` would pass validation and then compare a numeric column
 * against the year 500 — see `scalar` in the shared grammar.
 */
export const OPPORTUNITY_ADVANCED_FIELDS: readonly CrmSearchFieldDef<OpportunityAdvancedFieldId>[] =
  [
    { id: "id", field: "id", kind: "uuid" },
    { id: "customerProfile", field: "customerProfileId", kind: "uuid" },
    { id: "customerParty", field: "customerPartyId", kind: "uuid" },
    { id: "contactParty", field: "contactPartyId", kind: "uuid", nullable: true },
    { id: "lead", field: "leadId", kind: "uuid", nullable: true },
    // Both catalogues the workspace already holds: `usePipelineWorkspace`
    // loads every accessible pipeline WITH its stages to draw the board, so
    // neither picker costs a request.
    { id: "pipeline", field: "pipelineId", kind: "catalogue" },
    { id: "stage", field: "stageId", kind: "catalogue" },
    {
      id: "stageFlag",
      field: "stageFlag",
      kind: "enum",
      nullable: true,
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
    {
      id: "status",
      field: "status",
      kind: "enum",
      values: ["IN_PROGRESS", "ON_HOLD", "WON", "LOST"],
    },
    { id: "owner", field: "ownerUserId", kind: "uuid", nullable: true },
    // `varchar(180)` and `varchar(3)` are real column bounds, so the control
    // caps where the database does.
    { id: "title", field: "title", kind: "text", maxLength: 180 },
    // `description` and `lostReason` are unbounded `text`. The cap is the
    // portal's, matching the other two search contracts: a filter nobody could
    // read back is not worth a scrolling box.
    { id: "description", field: "description", kind: "text", nullable: true, maxLength: 2000 },
    { id: "importance", field: "importance", kind: "number" },
    { id: "amount", field: "amount", kind: "number", nullable: true },
    {
      id: "currencyCode",
      field: "currencyCode",
      kind: "text",
      nullable: true,
      maxLength: 3,
    },
    {
      id: "probabilityPercent",
      field: "probabilityPercent",
      kind: "number",
      nullable: true,
    },
    { id: "expectedCloseDate", field: "expectedCloseDate", kind: "date", nullable: true },
    { id: "wonAt", field: "wonAt", kind: "date", nullable: true },
    { id: "lostAt", field: "lostAt", kind: "date", nullable: true },
    { id: "lostReason", field: "lostReason", kind: "text", nullable: true, maxLength: 2000 },
    { id: "createdAt", field: "createdAt", kind: "date" },
    { id: "updatedAt", field: "updatedAt", kind: "date" },
  ];

export type OpportunitySearchGroup = CrmSearchGroup<OpportunityAdvancedFieldId>;

export function opportunityAdvancedField(
  id: OpportunityAdvancedFieldId,
): CrmSearchFieldDef<OpportunityAdvancedFieldId> {
  const field = OPPORTUNITY_ADVANCED_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Unknown opportunity filter field: ${id}`);
  return field;
}

/** The field a fresh condition opens on, and the card's own first entry. */
export const DEFAULT_OPPORTUNITY_ADVANCED_FIELD = OPPORTUNITY_ADVANCED_FIELDS[0]!;

/* -------------------------------- state --------------------------------- */

/**
 * Basic asks the list route with one term; advanced asks the search route with
 * a tree. They are separate shapes because they are separate wires — carrying
 * a half-built tree into a query string is not possible.
 */
export type OpportunitySearchMode = "basic" | "advanced";

export interface OpportunitySearchState {
  mode: OpportunitySearchMode;
  /** Basic mode's single condition. A blank term means no filter. */
  basic: OpportunitySearchRow;
  /** Advanced mode's free-text term — the same `title` match, on the POST. */
  text: string;
  /**
   * Advanced mode's sections: AND inside a group, OR between groups. NEVER
   * empty — an emptied card keeps one blank group, so the controls that add
   * the next condition are still on screen.
   */
  groups: readonly OpportunitySearchGroup[];
}

/** Nothing asked: basic, blank term, one blank condition. */
export const EMPTY_OPPORTUNITY_SEARCH: OpportunitySearchState = {
  mode: "basic",
  basic: { text: "" },
  text: "",
  groups: [
    {
      conditions: [
        {
          field: DEFAULT_OPPORTUNITY_ADVANCED_FIELD.id,
          operator: "eq",
          value: "",
          valueTo: "",
        },
      ],
    },
  ],
};

/**
 * Switch mode. Neither side's question is carried into the other.
 *
 * The two modes speak different wires: basic's term is a query parameter and
 * advanced's tree has an operator on every leaf, and there is no honest
 * translation of "between, or this OR that" into one query slot. Losing the
 * question on a switch is visible; silently dropping the half of it that does
 * not fit is not.
 */
export function opportunitySearchWithMode(
  state: OpportunitySearchState,
  mode: OpportunitySearchMode,
): OpportunitySearchState {
  return mode === state.mode ? state : { ...state, mode };
}

/** Basic mode's term. */
export function opportunitySearchWithBasicText(
  state: OpportunitySearchState,
  text: string,
): OpportunitySearchState {
  return { ...state, basic: { text } };
}

/** Advanced mode's groups, replaced wholesale by the card's editors. */
export function opportunitySearchWithGroups(
  state: OpportunitySearchState,
  groups: readonly OpportunitySearchGroup[],
): OpportunitySearchState {
  return { ...state, groups };
}

/** Advanced mode's free-text term. */
export function opportunitySearchWithText(
  state: OpportunitySearchState,
  text: string,
): OpportunitySearchState {
  return { ...state, text };
}

/** Advanced mode back to blank, without leaving it. */
export function opportunitySearchCleared(
  state: OpportunitySearchState,
): OpportunitySearchState {
  return { ...state, text: "", groups: EMPTY_OPPORTUNITY_SEARCH.groups };
}

/* --------------------------- the two requests --------------------------- */

/**
 * Every key `buildOpportunitiesListQuery` may produce.
 *
 * Exported so the test can assert the builder never steps outside it: an
 * unknown key is a 400 that empties the table, not a no-op. The DTO accepts
 * four more — `status`, `customerProfileId`, `ownerUserId`, `expectedCloseFrom`
 * / `expectedCloseTo` — that this builder deliberately never sends, because
 * advanced mode asks each of them with an operator beside it instead of as a
 * bare equality.
 */
export const OPPORTUNITY_LIST_QUERY_KEYS: readonly string[] = [
  "branchId",
  "page",
  "limit",
  "sortBy",
  "sortDir",
  "pipelineId",
  "stageId",
  "search",
];

export interface OpportunitiesListQueryInput {
  /** Required by the route: a list without one is 422, not an unfiltered list. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the table asks for 25. */
  limit: number;
  sortBy: OpportunitySortBy;
  sortDir: OpportunitySortDir;
  /** The workspace's pipeline picker, or `null` for every accessible pipeline. */
  pipelineId: string | null;
  /** The workspace's stage bar, or `null` for "all stages". */
  stageId: string | null;
  search: OpportunitySearchState;
}

/**
 * The list request's query string, filter included.
 *
 * Parameter order is fixed — branch, page window, sort, then the filters — so
 * two users who asked the same question produce the same string, and a request
 * is comparable between a test and the network tab.
 */
export function buildOpportunitiesListQuery({
  branchId,
  page,
  limit,
  sortBy,
  sortDir,
  pipelineId,
  stageId,
  search,
}: OpportunitiesListQueryInput): URLSearchParams {
  const query = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(limit),
    sortBy,
    // `sortDir`, not `sortOrder`. CRM validates with forbidNonWhitelisted, so
    // the wrong name is a 400 on every list open rather than an ignored
    // parameter — the values themselves were always right.
    sortDir,
  });

  if (pipelineId) query.set("pipelineId", pipelineId);
  // Absent rather than empty when nothing is chosen: `@IsOptional()` skips only
  // null/undefined, so `stageId=` would reach `@IsUUID('7')` in
  // `OpportunitiesQueryDto` and answer 400 instead of "every stage". The same
  // is true of `pipelineId` above.
  if (stageId) query.set("stageId", stageId);

  const term = search.basic.text.trim();
  if (term) {
    // Clamped rather than sent long: `@MaxLength(200)` rejects the request
    // outright, so a 201st character would blank the table instead of narrowing
    // it. The input control caps at the same number, so this is the belt to its
    // braces — a pasted value is the only way to reach it.
    query.set("search", term.slice(0, OPPORTUNITY_SEARCH_TEXT_MAX_LENGTH));
  }
  return query;
}

export interface OpportunitySearchRequestInput {
  /** Required by the route: `@RequireBranchAccess('body')` reads it from here. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the table asks for 25. */
  limit: number;
  sortBy: OpportunitySortBy;
  sortDir: OpportunitySortDir;
}

/**
 * The `POST /crm/opportunities/search` body.
 *
 * `filterTree` and `search` are both OMITTED when empty rather than sent as
 * `{}` or `""`: an empty tree is not "no filter" to the compiler, and an empty
 * `search` is a `@MaxLength` string that matches nothing. A body with neither
 * is the unfiltered branch list, which is what an untouched card should ask
 * for.
 */
export function buildOpportunitySearchRequest(
  state: OpportunitySearchState,
  { branchId, page, limit, sortBy, sortDir }: OpportunitySearchRequestInput,
): CrmSearchRequestBody {
  const filterTree = crmCompileFilterTree(state.groups, opportunityAdvancedField);
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
