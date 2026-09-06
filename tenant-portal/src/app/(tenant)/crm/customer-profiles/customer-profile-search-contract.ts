// The customer-profiles screen's entire wire vocabulary — the
// `GET /customer-profiles` query string AND the
// `POST /customer-profiles/search` body. Nothing outside this module may name a
// customer-profile query parameter or a filterable column.
//
// TWO endpoints, because they answer two different questions:
//
//  * **Basic** is one condition, typed and answered as you type, over
//    `GET /crm/customer-profiles`. `whitelist + forbidNonWhitelisted +
//    forbidUnknownValues` are all on (crm-app/src/main.ts), so an undocumented
//    key is a hard 400 rather than a field the server quietly drops. The ten
//    keys in `CUSTOMER_PROFILE_LIST_QUERY_KEYS` are the entire accepted
//    surface, read from `CustomerProfilesQueryDto` and the
//    `PaginationQueryDto` it extends (crm-app/src/crm/common/dto/
//    crm-list-query.dto.ts, and shared-libs/packages/database/src/dtos/
//    pagination-query.dto.ts).
//  * **Advanced** is a filter TREE, over `POST /crm/customer-profiles/search`.
//    It is a POST only because the tree does not fit in a query string; it
//    reads, writes nothing, and needs no idempotency key. The response
//    envelope is byte-identical to the list route's, so
//    `parseCustomerProfilesPageResponse` serves both unchanged.
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
//     per leaf, so `status = PROSPECT OR status = INACTIVE` is a normal
//     question. The old "one row per field" restriction was a fact about the
//     query string that had leaked into the screen, and it is gone.
//  3. **`sortBy` has no fallback.** `CustomerProfilesService.findAll` runs it
//     through `safeSortBy(query.sortBy, 'createdAt', ['displayName',
//     'createdAt'])`, and `safeSortBy` THROWS `DbErrors.invalidField` on an
//     unlisted value rather than falling back to the default it was handed.
//     `POST /search` runs the same pair through `searchSort`, so both modes are
//     typed by `CustomerProfileSortBy`.
//  4. **`search` is identity text, not description text.** The repository
//     narrows with `partySearchPredicate()`, which matches the party's display
//     name, first name, last name, organization name and its contact methods
//     (phone/email). Those columns come from a raw join the filter compiler
//     cannot resolve to a column, so they are NOT in
//     `CUSTOMER_PROFILE_FILTERABLE_FIELDS` and cannot be a tree condition —
//     free text is the only way to reach them, in either mode.
//
// `ownerUserId` is a fifth accepted LIST filter and is deliberately not offered
// in basic mode. No endpoint in this workspace lists assignable users by name
// for a branch, so the only basic control that could exist is a box asking a
// human to type a raw UUID — worse than no filter at all, recorded as Q132 in
// docs/build/OPEN-QUESTIONS.md. Advanced offers the column anyway, because
// there the operator list makes "is empty" / "is not empty" useful answers on
// their own.

import {
  crmCompileFilterTree,
  crmSearchTerm,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
  type CrmSearchRequestBody,
} from "../shared/search/filter-tree";

/**
 * `sortBy`'s entire accepted set. Anything else is a 400, never a fallback.
 *
 * Exported because the hook's sort state is typed by it; `CustomerProfileSortDir`
 * below is not, because nothing outside this file names it — an export is a
 * claim that something else needs the value, and `knip` is right to say so.
 */
export type CustomerProfileSortBy = "displayName" | "createdAt";

/** `sortDir` is `SortDirectionEnum`, which is upper case on the wire. */
type CustomerProfileSortDir = "ASC" | "DESC";

/* ------------------------------ basic mode ------------------------------ */

/**
 * How a basic field's value is entered — the value control's type follows this.
 *
 * `source` is a uuid equality filter like any enum is a string one; it is its
 * own kind because its options come from the acquisition-source catalogue
 * rather than from this file, and only the component that renders it knows how
 * to get that.
 */
type CustomerProfileSearchValueKind = "text" | "enum" | "source";

export interface CustomerProfileSearchFieldDef {
  /**
   * The screen's identity for the field, and the value of the field picker.
   *
   * Deliberately NOT the wire key, even where the two happen to be spelled
   * alike: this module is the only place that may name a query parameter, so
   * nothing outside it can drift a key by renaming a UI concept.
   */
  readonly id: CustomerProfileSearchFieldId;
  /** The query parameter this field filters on. */
  readonly key: string;
  readonly kind: CustomerProfileSearchValueKind;
  /** The accepted wire values, for `kind: "enum"` only. */
  readonly values?: readonly string[];
  /** `@MaxLength` on the wire, for `kind: "text"` only. */
  readonly maxLength?: number;
}

export type CustomerProfileSearchFieldId =
  | "text"
  | "status"
  | "profileType"
  | "source";

export const CUSTOMER_PROFILE_SEARCH_FIELDS: readonly CustomerProfileSearchFieldDef[] =
  [
    { id: "text", key: "search", kind: "text", maxLength: 200 },
    {
      id: "status",
      key: "status",
      kind: "enum",
      values: ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"],
    },
    {
      id: "profileType",
      key: "profileType",
      kind: "enum",
      values: ["INDIVIDUAL", "CORPORATE"],
    },
    { id: "source", key: "acquisitionSourceId", kind: "source" },
  ] as const;

/** The field basic mode opens on: free text over names and contact methods. */
const DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD: CustomerProfileSearchFieldId =
  "text";

/** Basic mode's one condition: a field, and the value it must equal. */
export interface CustomerProfileSearchRow {
  field: CustomerProfileSearchFieldId;
  /** Raw control value. Empty means "no filter", never an empty filter. */
  value: string;
}

export function customerProfileSearchField(
  id: CustomerProfileSearchFieldId,
): CustomerProfileSearchFieldDef {
  const field = CUSTOMER_PROFILE_SEARCH_FIELDS.find(
    (candidate) => candidate.id === id,
  );
  if (!field) throw new Error(`Unknown customer profile search field: ${id}`);
  return field;
}

/* ----------------------------- advanced mode ---------------------------- */

/**
 * `CUSTOMER_PROFILE_FILTERABLE_FIELDS` in
 * crm-app/src/crm/customer-profiles/repo/customer-profiles.repository.ts,
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
export const CUSTOMER_PROFILE_FILTERABLE_FIELDS: readonly string[] = [
  "id",
  "branchId",
  "acquisitionSourceId",
  "profileType",
  "status",
  "ownerUserId",
  "sourceLeadId",
  "description",
  "createdAt",
  "updatedAt",
];

export type CustomerProfileAdvancedFieldId =
  | "id"
  | "source"
  | "profileType"
  | "status"
  | "owner"
  | "sourceLead"
  | "description"
  | "createdAt"
  | "updatedAt";

/**
 * Every whitelisted column the card offers, with the kind that decides its
 * operator list and its value control.
 *
 * `nullable` is read from `CustomerProfileEntity` (@mutakamel/crm-app-database),
 * because it is what decides whether `isNull`/`isNotNull` may be offered at all
 * — asking whether a `NOT NULL` column is empty is a question with one answer.
 *
 * `branchId` is the ONE whitelisted column left out. The request body already
 * carries the branch and the tree is ANDed onto the scoped query, so a
 * `branchId` leaf can only restate the scope or contradict it: a no-op, or a
 * guaranteed empty list. A control that cannot narrow anything is a trap.
 */
export const CUSTOMER_PROFILE_ADVANCED_FIELDS: readonly CrmSearchFieldDef<CustomerProfileAdvancedFieldId>[] =
  [
    { id: "id", field: "id", kind: "uuid" },
    { id: "source", field: "acquisitionSourceId", kind: "catalogue", nullable: true },
    {
      id: "profileType",
      field: "profileType",
      kind: "enum",
      values: ["INDIVIDUAL", "CORPORATE"],
    },
    {
      id: "status",
      field: "status",
      kind: "enum",
      values: ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"],
    },
    { id: "owner", field: "ownerUserId", kind: "uuid", nullable: true },
    { id: "sourceLead", field: "sourceLeadId", kind: "uuid", nullable: true },
    {
      id: "description",
      field: "description",
      kind: "text",
      nullable: true,
      maxLength: 2000,
    },
    { id: "createdAt", field: "createdAt", kind: "date" },
    { id: "updatedAt", field: "updatedAt", kind: "date" },
  ];

export type CustomerProfileSearchGroup =
  CrmSearchGroup<CustomerProfileAdvancedFieldId>;

export function customerProfileAdvancedField(
  id: CustomerProfileAdvancedFieldId,
): CrmSearchFieldDef<CustomerProfileAdvancedFieldId> {
  const field = CUSTOMER_PROFILE_ADVANCED_FIELDS.find(
    (candidate) => candidate.id === id,
  );
  if (!field) throw new Error(`Unknown customer profile filter field: ${id}`);
  return field;
}

/** The field a fresh condition opens on. */
export const DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD =
  CUSTOMER_PROFILE_ADVANCED_FIELDS[0]!;

/* -------------------------------- state --------------------------------- */

/**
 * Basic asks one condition of the list route; advanced asks a tree of the
 * search route. They are separate shapes because they are separate wires —
 * carrying a half-built tree into a query string is not possible, and
 * pretending otherwise is what the old "advanced" mode did.
 */
export type CustomerProfileSearchMode = "basic" | "advanced";

export interface CustomerProfileSearchState {
  mode: CustomerProfileSearchMode;
  /** Basic mode's single condition. A blank value means no filter. */
  basic: CustomerProfileSearchRow;
  /** Advanced mode's free-text term — rule 4's only route to the party columns. */
  text: string;
  /**
   * Advanced mode's sections: AND inside a group, OR between groups. NEVER
   * empty — an emptied card keeps one blank group, so the controls that add
   * the next condition are still on screen.
   */
  groups: readonly CustomerProfileSearchGroup[];
}

/**
 * Nothing selected: basic, one blank condition, so no filter key is sent.
 *
 * Shared by every caller that resets. Safe because nothing in this module
 * writes through a state it is handed — every helper returns a new object.
 */
export const EMPTY_CUSTOMER_PROFILE_SEARCH: CustomerProfileSearchState = {
  mode: "basic",
  basic: { field: DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD, value: "" },
  text: "",
  groups: [
    {
      conditions: [
        {
          field: DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD.id,
          operator: "eq",
          value: "",
          valueTo: "",
        },
      ],
    },
  ],
};

/** Free text in the default field — how a caller that has only a string asks. */
export function customerProfileTextSearch(
  value: string,
): CustomerProfileSearchState {
  return {
    ...EMPTY_CUSTOMER_PROFILE_SEARCH,
    basic: { field: DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD, value },
  };
}

/**
 * Switch mode. Neither side's question is carried into the other.
 *
 * The two modes speak different wires: basic's `status=PROSPECT` is a query
 * parameter and advanced's is a tree leaf with an operator beside it, and there
 * is no honest translation of "contains, between, or this OR that" into one
 * query slot. Losing the question on a switch is visible; silently dropping the
 * half of it that does not fit is not.
 */
export function customerProfileSearchWithMode(
  state: CustomerProfileSearchState,
  mode: CustomerProfileSearchMode,
): CustomerProfileSearchState {
  return mode === state.mode ? state : { ...state, mode };
}

/** Basic mode's condition with `patch` applied. */
export function customerProfileSearchWithRow(
  state: CustomerProfileSearchState,
  patch: Partial<CustomerProfileSearchRow>,
): CustomerProfileSearchState {
  const field = patch.field ?? state.basic.field;
  // Changing the FIELD clears the VALUE. `PROSPECT` is a customer status and
  // means nothing as an acquisition-source id, and carrying it across would
  // send a value the wire rejects with a 400 that reads as an empty list.
  const value = field !== state.basic.field ? "" : (patch.value ?? state.basic.value);
  return { ...state, basic: { field, value } };
}

/** Advanced mode's groups, replaced wholesale by the card's editors. */
export function customerProfileSearchWithGroups(
  state: CustomerProfileSearchState,
  groups: readonly CustomerProfileSearchGroup[],
): CustomerProfileSearchState {
  return { ...state, groups };
}

/** Advanced mode's free-text term. */
export function customerProfileSearchWithText(
  state: CustomerProfileSearchState,
  text: string,
): CustomerProfileSearchState {
  return { ...state, text };
}

/** Advanced mode back to blank, without leaving it. */
export function customerProfileSearchCleared(
  state: CustomerProfileSearchState,
): CustomerProfileSearchState {
  return { ...state, text: "", groups: EMPTY_CUSTOMER_PROFILE_SEARCH.groups };
}

/* --------------------------- the two requests --------------------------- */

/**
 * All ten keys the list endpoint accepts: `branchId`, the four pagination and
 * sort keys, and the five filters (`search` plus the four equality filters).
 *
 * Exported so the test can assert the builder never produces anything outside
 * it: an unknown key here is a 400 that empties the screen, not a no-op.
 */
export const CUSTOMER_PROFILE_LIST_QUERY_KEYS: readonly string[] = [
  "branchId",
  "page",
  "limit",
  "sortBy",
  "sortDir",
  ...CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) => field.key),
  // Accepted by the DTO, never sent by this builder — see the header's note on
  // Q132. Advanced mode reaches the column through the tree instead.
  "ownerUserId",
];

export interface CustomerProfilesListQueryInput {
  /** Required by the route: a list without one is 422, not an unfiltered list. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the screen asks for 25. */
  limit: number;
  sortBy: CustomerProfileSortBy;
  sortDir: CustomerProfileSortDir;
  search: CustomerProfileSearchState;
}

/**
 * The list request's query string, filter included.
 *
 * Parameter order is fixed — branch, page window, sort, then the filter — so
 * two users who asked the same question produce the same string, and a request
 * is comparable between a test and the network tab.
 */
export function buildCustomerProfilesListQuery({
  branchId,
  page,
  limit,
  sortBy,
  sortDir,
  search,
}: CustomerProfilesListQueryInput): URLSearchParams {
  const query = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(limit),
    sortBy,
    sortDir,
  });

  // Throws on an unknown field, which can only arrive through a cast.
  const field = customerProfileSearchField(search.basic.field);
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

export interface CustomerProfileSearchRequestInput {
  /** Required by the route: `@RequireBranchAccess('body')` reads it from here. */
  branchId: string;
  page: number;
  /** `@Max(100)` on the wire; the screen asks for 25. */
  limit: number;
  sortBy: CustomerProfileSortBy;
  sortDir: CustomerProfileSortDir;
}

/**
 * The `POST /crm/customer-profiles/search` body.
 *
 * `filterTree` and `search` are both OMITTED when empty rather than sent as
 * `{}` or `""`: an empty tree is not "no filter" to the compiler, and an empty
 * `search` is a `@MaxLength` string that matches nothing. A body with neither
 * is the unfiltered branch list, which is what an untouched card should ask
 * for.
 */
export function buildCustomerProfileSearchRequest(
  state: CustomerProfileSearchState,
  { branchId, page, limit, sortBy, sortDir }: CustomerProfileSearchRequestInput,
): CrmSearchRequestBody {
  const filterTree = crmCompileFilterTree(
    state.groups,
    customerProfileAdvancedField,
  );
  const search = crmSearchTerm(state.text);
  return {
    branchId,
    ...(filterTree ? { filterTree } : {}),
    ...(search ? { search } : {}),
    // `field:DIR` is the one form `searchSort` and the GET route agree on, so
    // both modes order rows identically.
    sort: `${sortBy}:${sortDir}`,
    page,
    limit,
  };
}
