// Query builder for `GET /leads` — the whole of the leads list query string.
//
// `whitelist + forbidNonWhitelisted + forbidUnknownValues` are all on
// (crm-app/src/main.ts), so an undocumented key is a hard 400 rather than a
// field the server quietly drops. The twelve keys below are the entire
// accepted surface, read from `LeadsQueryDto` and the `PaginationQueryDto` it
// extends (crm-app/src/crm/common/dto/crm-list-query.dto.ts, and
// shared-libs/packages/database/src/dtos/pagination-query.dto.ts).
//
// Five rules shape this file:
//
//  1. **Conditions join with AND, and only AND.** The endpoint applies its six
//     equality filters together, and offers no operators (`gt`, `like`,
//     `between`, …) and no OR. Advanced search is therefore a list of
//     `[field] [value]` rows AND-ed together, with the join drawn as static
//     text rather than as an AND/OR control: a control that silently does
//     nothing is worse than one that is absent. The filter-tree engine in
//     shared-libs would answer the wider grammar and is exposed on no CRM
//     route — Q131 in docs/build/OPEN-QUESTIONS.md.
//  2. **One row per field.** A query string has a single slot per key, so a
//     second `status` row could only overwrite the first. A field already
//     spoken for is withheld from every other row's picker
//     (`leadSearchAvailableFields`), and this builder THROWS rather than
//     quietly dropping one if a caller assembles a pair anyway.
//  3. **A blank value is not a filter.** `status=` is an empty string to
//     `@IsEnum`, which is a 400 — not "no status filter". A value that trims
//     to nothing means the key is omitted entirely.
//  4. **`sortBy` has no fallback.** The service validates it against
//     `['displayName', 'createdAt']` and 400s on anything else rather than
//     sorting by a default, so the type here is that pair and nothing wider.
//  5. **`search` is identity text, not description text.** It matches the
//     party's display name, first name, last name, organization name and its
//     contact methods (phone/email). The lead's own `description` is listed in
//     the repository's `searchableFields` but is not reachable through this
//     endpoint, so the label must not promise it.
//
// `ownerUserId` is a seventh accepted filter and is DELIBERATELY not offered,
// in either mode. No endpoint in this workspace lists assignable users by name
// for a branch, so the only control that could exist is a box asking a human
// to type a raw UUID. That is a worse experience than no filter at all.
// Recorded as Q132 in docs/build/OPEN-QUESTIONS.md rather than worked around.

/** `sortBy`'s entire accepted set. Anything else is a 400, never a fallback. */
type LeadsSortBy = "displayName" | "createdAt";

/** `sortDir` is `SortDirectionEnum`, which is upper case on the wire. */
type LeadsSortDir = "ASC" | "DESC";

/**
 * How a field's value is entered — the value control's type follows this.
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

/** The field a fresh row opens on: free text over names and contact methods. */
const DEFAULT_LEAD_SEARCH_FIELD: LeadSearchFieldId = "text";

/** One condition: a field, and the value it must equal. */
export interface LeadSearchRow {
  field: LeadSearchFieldId;
  /** Raw control value. Empty means "no filter", never an empty filter. */
  value: string;
}

/**
 * Basic asks one condition, advanced asks several — the same conditions
 * either way, since the wire has nothing wider to offer the second mode.
 */
export type LeadSearchMode = "basic" | "advanced";

export interface LeadSearchState {
  mode: LeadSearchMode;
  /**
   * The conditions, AND-ed. NEVER empty: "no filter" is one row with a blank
   * value, so basic always has a row to draw and a removed last row leaves a
   * control behind rather than a gap.
   */
  rows: readonly LeadSearchRow[];
}

/**
 * Nothing selected: basic, one blank row, so no filter key is sent.
 *
 * Shared by every caller that resets. Safe because nothing in this module
 * writes through a state it is handed — every helper returns a new object and
 * a new array.
 */
export const EMPTY_LEAD_SEARCH: LeadSearchState = {
  mode: "basic",
  rows: [{ field: DEFAULT_LEAD_SEARCH_FIELD, value: "" }],
};

export function leadSearchField(id: LeadSearchFieldId): LeadSearchFieldDef {
  const field = LEAD_SEARCH_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Unknown lead search field: ${id}`);
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
export function leadSearchAvailableFields(
  state: LeadSearchState,
  rowIndex: number,
): readonly LeadSearchFieldDef[] {
  const taken = new Set(
    state.rows
      .filter((_row, index) => index !== rowIndex)
      .map((row) => row.field),
  );
  return LEAD_SEARCH_FIELDS.filter((field) => !taken.has(field.id));
}

/** The one row invariant: an empty list becomes a single blank condition. */
function withRows(
  state: LeadSearchState,
  rows: readonly LeadSearchRow[],
): LeadSearchState {
  if (rows.length > 0) return { mode: state.mode, rows };
  return { mode: state.mode, rows: [{ field: DEFAULT_LEAD_SEARCH_FIELD, value: "" }] };
}

/**
 * Switch mode, carrying what the other mode can hold.
 *
 * Basic to advanced keeps the single condition as the first row, so the
 * question on screen survives the switch. Advanced to basic keeps the first
 * row and drops the rest — basic has one slot, and inventing a way to show
 * four conditions in it would be a worse lie than losing three.
 */
export function leadSearchWithMode(
  state: LeadSearchState,
  mode: LeadSearchMode,
): LeadSearchState {
  if (mode === state.mode) return state;
  if (mode === "advanced") return { mode, rows: state.rows };
  return { mode, rows: state.rows.slice(0, 1) };
}

/**
 * Row `rowIndex` with `patch` applied.
 *
 * Changing the FIELD clears the VALUE. `OPEN` is a lead status and means
 * nothing as a stage id, and carrying it across would send a value the wire
 * rejects with a 400 that reads as an empty list.
 */
export function leadSearchWithRow(
  state: LeadSearchState,
  rowIndex: number,
  patch: Partial<LeadSearchRow>,
): LeadSearchState {
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
export function leadSearchWithRowAdded(state: LeadSearchState): LeadSearchState {
  const [next] = leadSearchAvailableFields(state, state.rows.length);
  if (!next) return state;
  return withRows(state, [...state.rows, { field: next.id, value: "" }]);
}

export function leadSearchWithRowRemoved(
  state: LeadSearchState,
  rowIndex: number,
): LeadSearchState {
  return withRows(
    state,
    state.rows.filter((_row, index) => index !== rowIndex),
  );
}

/** The value currently filtering on `field`, or "" when no row holds it. */
export function leadSearchValueOf(
  state: LeadSearchState,
  field: LeadSearchFieldId,
): string {
  return state.rows.find((row) => row.field === field)?.value ?? "";
}

/**
 * State with `field` filtering on `value`, for a control that names a field
 * rather than a row — the stage bar above the card and table views.
 *
 * A blank value drops the condition instead of blanking it, so pressing the
 * bar's "all" really does return an unfiltered list. In basic mode the single
 * row simply becomes this condition; in advanced the row keeps its place among
 * the others, and a lone blank row is treated as the placeholder it is rather
 * than left behind above the new condition.
 */
export function leadSearchWithField(
  state: LeadSearchState,
  field: LeadSearchFieldId,
  value: string,
): LeadSearchState {
  if (!value) {
    return withRows(
      state,
      state.rows.filter((row) => row.field !== field),
    );
  }
  if (state.mode === "basic") return { mode: state.mode, rows: [{ field, value }] };

  const held = state.rows.some((row) => row.field === field);
  if (held) {
    return withRows(
      state,
      state.rows.map((row) => (row.field === field ? { field, value } : row)),
    );
  }
  const [only] = state.rows;
  if (state.rows.length === 1 && only && !only.value.trim()) {
    return withRows(state, [{ field, value }]);
  }
  return withRows(state, [...state.rows, { field, value }]);
}

/**
 * All twelve keys the endpoint accepts: `branchId`, the four pagination and
 * sort keys, and the seven filters (`search` plus the six equality filters).
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
  // Accepted by the DTO, never sent by this builder — see the header.
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
 * The list request's query string, filters included.
 *
 * Parameter order is fixed — branch, page window, sort, then the filters in
 * the CATALOGUE's order rather than the order the rows were added — so two
 * users who asked the same AND-ed question produce the same string, and a
 * request is comparable between a test and the network tab. AND is
 * commutative on the wire; row order is a fact about a screen, not a query.
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

  // Basic asks ONE condition however many rows a mode switch left behind, so
  // the mode on screen and the request on the wire can never disagree.
  const rows = search.mode === "basic" ? search.rows.slice(0, 1) : search.rows;

  const values = new Map<LeadSearchFieldId, string>();
  for (const row of rows) {
    // Throws on an unknown field, which can only arrive through a cast.
    leadSearchField(row.field);
    if (values.has(row.field)) {
      throw new Error(`Duplicate lead search field: ${row.field}`);
    }
    values.set(row.field, row.value.trim());
  }

  for (const field of LEAD_SEARCH_FIELDS) {
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
