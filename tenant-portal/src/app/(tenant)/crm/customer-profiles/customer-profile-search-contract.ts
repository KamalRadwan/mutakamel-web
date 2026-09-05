// Query builder for `GET /customer-profiles` — the whole of the customer list
// query string.
//
// `whitelist + forbidNonWhitelisted + forbidUnknownValues` are all on
// (crm-app/src/main.ts), so an undocumented key is a hard 400 rather than a
// field the server quietly drops. The ten keys below are the entire accepted
// surface, read from `CustomerProfilesQueryDto` and the `PaginationQueryDto`
// it extends (crm-app/src/crm/common/dto/crm-list-query.dto.ts, and
// shared-libs/packages/database/src/dtos/pagination-query.dto.ts).
//
// Five rules shape this file:
//
//  1. **Conditions join with AND, and only AND.** The endpoint applies its
//     four equality filters together, and offers no operators (`gt`, `like`,
//     `between`, …) and no OR. Advanced search is therefore a list of
//     `[field] [value]` rows AND-ed together, with the join drawn as static
//     text rather than as an AND/OR control: a control that silently does
//     nothing is worse than one that is absent. The filter-tree engine in
//     shared-libs would answer the wider grammar and is exposed on no CRM
//     route — Q131 in docs/build/OPEN-QUESTIONS.md.
//  2. **One row per field.** A query string has a single slot per key, so a
//     second `status` row could only overwrite the first. A field already
//     spoken for is withheld from every other row's picker
//     (`customerProfileSearchAvailableFields`), and this builder THROWS rather
//     than quietly dropping one if a caller assembles a pair anyway.
//  3. **A blank value is not a filter.** `status=` is an empty string to
//     `@IsEnum`, which is a 400 — not "no status filter". A value that trims
//     to nothing means the key is omitted entirely.
//  4. **`sortBy` has no fallback.** `CustomerProfilesService.findAll` runs it
//     through `safeSortBy(query.sortBy, 'createdAt', ['displayName',
//     'createdAt'])`, and `safeSortBy` THROWS `DbErrors.invalidField` on an
//     unlisted value rather than falling back to the default it was handed —
//     so the type here is that pair and nothing wider.
//  5. **`search` is identity text, not description text.** The repository
//     narrows with `partySearchPredicate()`, which matches the party's display
//     name, first name, last name, organization name and its contact methods
//     (phone/email). The profile's own `description` is listed in the
//     repository's `searchableFields` but no code path reaches it through this
//     endpoint, so the label must not promise it.
//
// `ownerUserId` is a fifth accepted filter and is DELIBERATELY not offered, in
// either mode. No endpoint in this workspace lists assignable users by name
// for a branch, so the only control that could exist is a box asking a human
// to type a raw UUID. That is a worse experience than no filter at all.
// Recorded as Q132 in docs/build/OPEN-QUESTIONS.md rather than worked around.

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

/**
 * How a field's value is entered — the value control's type follows this.
 *
 * `source` is a uuid equality filter like any enum is a string one; it is its
 * own kind because its options come from the acquisition-source catalogue
 * rather than from this file, and only the component that renders it knows
 * how to fetch that.
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

/** The field a fresh row opens on: free text over names and contact methods. */
const DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD: CustomerProfileSearchFieldId =
  "text";

/** One condition: a field, and the value it must equal. */
export interface CustomerProfileSearchRow {
  field: CustomerProfileSearchFieldId;
  /** Raw control value. Empty means "no filter", never an empty filter. */
  value: string;
}

/**
 * Basic asks one condition, advanced asks several — the same conditions
 * either way, since the wire has nothing wider to offer the second mode.
 */
export type CustomerProfileSearchMode = "basic" | "advanced";

export interface CustomerProfileSearchState {
  mode: CustomerProfileSearchMode;
  /**
   * The conditions, AND-ed. NEVER empty: "no filter" is one row with a blank
   * value, so basic always has a row to draw and a removed last row leaves a
   * control behind rather than a gap.
   */
  rows: readonly CustomerProfileSearchRow[];
}

/**
 * Nothing selected: basic, one blank row, so no filter key is sent.
 *
 * Shared by every caller that resets. Safe because nothing in this module
 * writes through a state it is handed — every helper returns a new object and
 * a new array.
 */
export const EMPTY_CUSTOMER_PROFILE_SEARCH: CustomerProfileSearchState = {
  mode: "basic",
  rows: [{ field: DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD, value: "" }],
};

/** Free text in the default field — how a caller that has only a string asks. */
export function customerProfileTextSearch(
  value: string,
): CustomerProfileSearchState {
  return {
    mode: "basic",
    rows: [{ field: DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD, value }],
  };
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

/**
 * The fields row `rowIndex` may offer: every one no OTHER row already holds.
 *
 * Rule 2 in the header — one slot per key — enforced where a user could break
 * it, so a duplicate is unreachable rather than merely rejected. The row's own
 * field stays in the list, otherwise the picker could not display its own
 * value. A `rowIndex` past the end asks "what could a NEW row filter on?",
 * which is how the add control decides whether to render at all.
 */
export function customerProfileSearchAvailableFields(
  state: CustomerProfileSearchState,
  rowIndex: number,
): readonly CustomerProfileSearchFieldDef[] {
  const taken = new Set(
    state.rows
      .filter((_row, index) => index !== rowIndex)
      .map((row) => row.field),
  );
  return CUSTOMER_PROFILE_SEARCH_FIELDS.filter((field) => !taken.has(field.id));
}

/** The one row invariant: an empty list becomes a single blank condition. */
function withRows(
  state: CustomerProfileSearchState,
  rows: readonly CustomerProfileSearchRow[],
): CustomerProfileSearchState {
  if (rows.length > 0) return { mode: state.mode, rows };
  return {
    mode: state.mode,
    rows: [{ field: DEFAULT_CUSTOMER_PROFILE_SEARCH_FIELD, value: "" }],
  };
}

/**
 * Switch mode, carrying what the other mode can hold.
 *
 * Basic to advanced keeps the single condition as the first row, so the
 * question on screen survives the switch. Advanced to basic keeps the first
 * row and drops the rest — basic has one slot, and inventing a way to show
 * four conditions in it would be a worse lie than losing three.
 */
export function customerProfileSearchWithMode(
  state: CustomerProfileSearchState,
  mode: CustomerProfileSearchMode,
): CustomerProfileSearchState {
  if (mode === state.mode) return state;
  if (mode === "advanced") return { mode, rows: state.rows };
  return { mode, rows: state.rows.slice(0, 1) };
}

/**
 * Row `rowIndex` with `patch` applied.
 *
 * Changing the FIELD clears the VALUE. `PROSPECT` is a customer status and
 * means nothing as an acquisition-source id, and carrying it across would send
 * a value the wire rejects with a 400 that reads as an empty list.
 */
export function customerProfileSearchWithRow(
  state: CustomerProfileSearchState,
  rowIndex: number,
  patch: Partial<CustomerProfileSearchRow>,
): CustomerProfileSearchState {
  const rows = state.rows.map((row, index) => {
    if (index !== rowIndex) return row;
    const field = patch.field ?? row.field;
    if (field !== row.field) return { field, value: "" };
    return { field, value: patch.value ?? row.value };
  });
  return withRows(state, rows);
}

/**
 * A new blank condition on the first field nothing else claims.
 *
 * Returns the state untouched once every field is spoken for; the add control
 * is hidden at that point, so this is the guard behind the guard.
 */
export function customerProfileSearchWithRowAdded(
  state: CustomerProfileSearchState,
): CustomerProfileSearchState {
  const [next] = customerProfileSearchAvailableFields(state, state.rows.length);
  if (!next) return state;
  return withRows(state, [...state.rows, { field: next.id, value: "" }]);
}

export function customerProfileSearchWithRowRemoved(
  state: CustomerProfileSearchState,
  rowIndex: number,
): CustomerProfileSearchState {
  return withRows(
    state,
    state.rows.filter((_row, index) => index !== rowIndex),
  );
}

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
 * All ten keys the endpoint accepts: `branchId`, the four pagination and sort
 * keys, and the five filters (`search` plus the four equality filters).
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
  // Accepted by the DTO, never sent by this builder — see the header.
  "ownerUserId",
];

/**
 * The list request's query string, filters included.
 *
 * Parameter order is fixed — branch, page window, sort, then the filters in
 * the CATALOGUE's order rather than the order the rows were added — so two
 * users who asked the same AND-ed question produce the same string, and a
 * request is comparable between a test and the network tab. AND is
 * commutative on the wire; row order is a fact about a screen, not a query.
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

  // Basic asks ONE condition however many rows a mode switch left behind, so
  // the mode on screen and the request on the wire can never disagree.
  const rows = search.mode === "basic" ? search.rows.slice(0, 1) : search.rows;

  const values = new Map<CustomerProfileSearchFieldId, string>();
  for (const row of rows) {
    // Throws on an unknown field, which can only arrive through a cast.
    customerProfileSearchField(row.field);
    if (values.has(row.field)) {
      throw new Error(`Duplicate customer profile search field: ${row.field}`);
    }
    values.set(row.field, row.value.trim());
  }

  for (const field of CUSTOMER_PROFILE_SEARCH_FIELDS) {
    const value = values.get(field.id);
    if (!value) continue;
    // Clamped rather than sent long: `@MaxLength(200)` rejects the request
    // outright, so a 201st character would blank the list instead of narrowing
    // it. The input control caps at the same number, so this is the belt to its
    // braces — a pasted value is the only way to reach it.
    query.set(field.key, field.maxLength ? value.slice(0, field.maxLength) : value);
  }
  return query;
}
