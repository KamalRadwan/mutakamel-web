import { describe, expect, it } from "vitest";
import {
  EMPTY_LEAD_SEARCH,
  LEAD_LIST_QUERY_KEYS,
  LEAD_SEARCH_FIELDS,
  buildLeadsListQuery,
  leadSearchAvailableFields,
  leadSearchField,
  leadSearchValueOf,
  leadSearchWithField,
  leadSearchWithMode,
  leadSearchWithRow,
  leadSearchWithRowAdded,
  leadSearchWithRowRemoved,
  type LeadSearchFieldId,
  type LeadSearchRow,
  type LeadSearchState,
} from "./lead-search-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const STAGE_ID = "01900100-0000-7000-8000-000000000010";
const SOURCE_ID = "01900100-0000-7000-8000-0000000000a1";

const LIST_WINDOW = {
  branchId: BRANCH_ID,
  page: 1,
  limit: 50,
  sortBy: "createdAt",
  sortDir: "DESC",
} as const;

/** One condition, the way basic mode holds it. */
function basic(field: LeadSearchFieldId, value: string): LeadSearchState {
  return { mode: "basic", rows: [{ field, value }] };
}

/** Several conditions, the way advanced mode holds them. */
function advanced(...rows: LeadSearchRow[]): LeadSearchState {
  return { mode: "advanced", rows };
}

function queryFor(search: LeadSearchState): string {
  return buildLeadsListQuery({ ...LIST_WINDOW, search }).toString();
}

const UNFILTERED =
  `branchId=${BRANCH_ID}&page=1&limit=50&sortBy=createdAt&sortDir=DESC`;

describe("buildLeadsListQuery — the default text field", () => {
  it("sends free text as `search`, which is the only key it may use", () => {
    expect(queryFor(basic("text", "acme"))).toBe(`${UNFILTERED}&search=acme`);
  });

  it("trims, because a value of spaces is not a search", () => {
    expect(queryFor(basic("text", "  acme  "))).toBe(`${UNFILTERED}&search=acme`);
  });

  it("clamps at the wire's 200 characters instead of earning a 400", () => {
    const query = buildLeadsListQuery({
      ...LIST_WINDOW,
      search: basic("text", "a".repeat(250)),
    });
    expect(query.get("search")).toHaveLength(200);
  });
});

describe("buildLeadsListQuery — the enum and catalogue fields", () => {
  const cases: ReadonlyArray<[LeadSearchFieldId, string, string]> = [
    ["status", "OPEN", "status=OPEN"],
    ["stageFlag", "QUALIFYING", "stageFlag=QUALIFYING"],
    ["leadType", "CORPORATE", "leadProfileType=CORPORATE"],
    ["stage", STAGE_ID, `stageId=${STAGE_ID}`],
    ["source", SOURCE_ID, `acquisitionSourceId=${SOURCE_ID}`],
  ];

  it.each(cases)("routes %s through its own wire key", (field, value, expected) => {
    expect(queryFor(basic(field, value))).toBe(`${UNFILTERED}&${expected}`);
  });

  it("offers only wire values the DTO's enums accept", () => {
    expect(leadSearchField("status").values).toEqual([
      "OPEN",
      "CONVERTED",
      "DISQUALIFIED",
      "ON_HOLD",
    ]);
    expect(leadSearchField("stageFlag").values).toEqual([
      "NEW",
      "CONTACTED",
      "QUALIFYING",
      "QUALIFIED",
      "DISQUALIFIED",
      "CONVERTED",
      "NURTURING",
      "ON_HOLD",
    ]);
    expect(leadSearchField("leadType").values).toEqual([
      "INDIVIDUAL",
      "CORPORATE",
    ]);
  });
});

describe("buildLeadsListQuery — several conditions, AND-ed", () => {
  it("sends one key per row, which is the whole of what AND means here", () => {
    expect(
      queryFor(
        advanced({ field: "status", value: "OPEN" }, { field: "stage", value: STAGE_ID }),
      ),
    ).toBe(`${UNFILTERED}&status=OPEN&stageId=${STAGE_ID}`);
  });

  it("emits in catalogue order, so row order cannot change the request", () => {
    const query = queryFor(
      advanced({ field: "stage", value: STAGE_ID }, { field: "status", value: "OPEN" }),
    );
    expect(query).toBe(`${UNFILTERED}&status=OPEN&stageId=${STAGE_ID}`);
  });

  it("carries all six equality filters plus the free text at once", () => {
    const query = buildLeadsListQuery({
      ...LIST_WINDOW,
      search: advanced(
        { field: "text", value: "acme" },
        { field: "status", value: "OPEN" },
        { field: "stageFlag", value: "QUALIFYING" },
        { field: "leadType", value: "CORPORATE" },
        { field: "stage", value: STAGE_ID },
        { field: "source", value: SOURCE_ID },
      ),
    });
    expect([...query.keys()]).toEqual([
      "branchId",
      "page",
      "limit",
      "sortBy",
      "sortDir",
      "search",
      "status",
      "stageFlag",
      "leadProfileType",
      "stageId",
      "acquisitionSourceId",
    ]);
  });

  // Basic has one slot however many rows an Advanced-to-Basic switch left in
  // state, so the mode on screen and the request on the wire cannot disagree.
  it("sends only the first condition while the mode is basic", () => {
    expect(
      queryFor({
        mode: "basic",
        rows: [
          { field: "status", value: "OPEN" },
          { field: "stage", value: STAGE_ID },
        ],
      }),
    ).toBe(`${UNFILTERED}&status=OPEN`);
  });
});

describe("lead search rows — a field may appear at most once", () => {
  it("withholds a field already spoken for from every other row's picker", () => {
    const state = advanced(
      { field: "status", value: "OPEN" },
      { field: "stage", value: STAGE_ID },
    );
    // Row 1's own field stays — the picker must be able to show its value —
    // and row 0's is gone, so a second `status` row cannot be chosen.
    expect(leadSearchAvailableFields(state, 1).map((field) => field.id)).toEqual([
      "text",
      "stageFlag",
      "leadType",
      "stage",
      "source",
    ]);
    // A row index past the end asks what a NEW row could filter on.
    expect(leadSearchAvailableFields(state, state.rows.length).map((f) => f.id)).toEqual(
      ["text", "stageFlag", "leadType", "source"],
    );
  });

  it("adds a row on a free field, and stops once every field is taken", () => {
    let state: LeadSearchState = EMPTY_LEAD_SEARCH;
    for (let index = 1; index < LEAD_SEARCH_FIELDS.length; index += 1) {
      state = leadSearchWithRowAdded(state);
    }
    expect(state.rows.map((row) => row.field)).toEqual(
      LEAD_SEARCH_FIELDS.map((field) => field.id),
    );
    // Nothing left to offer: the state comes back untouched rather than
    // growing a duplicate row.
    expect(leadSearchWithRowAdded(state)).toBe(state);
  });

  it("cannot be talked into two rows on one field through the picker", () => {
    const state = advanced(
      { field: "status", value: "OPEN" },
      { field: "stage", value: STAGE_ID },
    );
    const offered = leadSearchAvailableFields(state, 1).map((field) => field.id);
    expect(offered).not.toContain("status");
    for (const field of offered) {
      const next = leadSearchWithRow(state, 1, { field });
      const used = next.rows.map((row) => row.field);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  // The picker makes it unreachable; a cast could still assemble one, and a
  // second `status` could only overwrite the first rather than narrow it.
  it("throws rather than silently dropping a duplicate a caller assembled", () => {
    expect(() =>
      queryFor(
        advanced(
          { field: "status", value: "OPEN" },
          { field: "status", value: "ON_HOLD" },
        ),
      ),
    ).toThrow("Duplicate lead search field: status");
  });

  it("clears the value when a row changes field, since it means nothing there", () => {
    const state = basic("status", "OPEN");
    expect(leadSearchWithRow(state, 0, { field: "stage" }).rows).toEqual([
      { field: "stage", value: "" },
    ]);
  });

  it("keeps a condition behind when the last row is removed", () => {
    const state = advanced({ field: "status", value: "OPEN" });
    expect(leadSearchWithRowRemoved(state, 0).rows).toEqual([
      { field: "text", value: "" },
    ]);
    expect(queryFor(leadSearchWithRowRemoved(state, 0))).toBe(UNFILTERED);
  });
});

describe("lead search modes", () => {
  it("carries the current condition into advanced as the first row", () => {
    const next = leadSearchWithMode(basic("status", "OPEN"), "advanced");
    expect(next).toEqual(advanced({ field: "status", value: "OPEN" }));
  });

  it("keeps the first row and drops the rest on the way back to basic", () => {
    const next = leadSearchWithMode(
      advanced(
        { field: "status", value: "OPEN" },
        { field: "stage", value: STAGE_ID },
        { field: "text", value: "acme" },
      ),
      "basic",
    );
    expect(next).toEqual(basic("status", "OPEN"));
    expect(queryFor(next)).toBe(`${UNFILTERED}&status=OPEN`);
  });

  it("is a no-op on the mode already selected", () => {
    const state = basic("status", "OPEN");
    expect(leadSearchWithMode(state, "basic")).toBe(state);
  });
});

describe("lead search by field — what the stage bar writes", () => {
  it("reads back the value filtering on a field, and blank when none does", () => {
    const state = advanced(
      { field: "status", value: "OPEN" },
      { field: "stage", value: STAGE_ID },
    );
    expect(leadSearchValueOf(state, "stage")).toBe(STAGE_ID);
    expect(leadSearchValueOf(state, "source")).toBe("");
  });

  it("replaces the single condition in basic mode", () => {
    expect(leadSearchWithField(basic("status", "OPEN"), "stage", STAGE_ID)).toEqual(
      basic("stage", STAGE_ID),
    );
  });

  it("leaves the other conditions standing in advanced mode", () => {
    const state = advanced({ field: "status", value: "OPEN" });
    expect(leadSearchWithField(state, "stage", STAGE_ID).rows).toEqual([
      { field: "status", value: "OPEN" },
      { field: "stage", value: STAGE_ID },
    ]);
  });

  it("takes over a lone blank row rather than stacking on top of it", () => {
    const state = leadSearchWithMode(EMPTY_LEAD_SEARCH, "advanced");
    expect(leadSearchWithField(state, "stage", STAGE_ID).rows).toEqual([
      { field: "stage", value: STAGE_ID },
    ]);
  });

  it("drops the condition on a blank value instead of blanking it", () => {
    const state = advanced(
      { field: "status", value: "OPEN" },
      { field: "stage", value: STAGE_ID },
    );
    const next = leadSearchWithField(state, "stage", "");
    expect(next.rows).toEqual([{ field: "status", value: "OPEN" }]);
    expect(queryFor(next)).toBe(`${UNFILTERED}&status=OPEN`);
  });
});

describe("buildLeadsListQuery — a blank value is not a filter", () => {
  // `status=` is an empty string to @IsEnum, which is a 400 — not "any
  // status". Every field must omit its key rather than send it empty.
  it.each(LEAD_SEARCH_FIELDS.map((field) => field.id))(
    "sends no filter key at all for a blank %s",
    (field) => {
      expect(queryFor(basic(field, ""))).toBe(UNFILTERED);
      expect(queryFor(basic(field, "   "))).toBe(UNFILTERED);
    },
  );

  it("skips a blank row and keeps the rows around it", () => {
    expect(
      queryFor(
        advanced(
          { field: "status", value: "OPEN" },
          { field: "stage", value: "   " },
          { field: "text", value: "acme" },
        ),
      ),
    ).toBe(`${UNFILTERED}&search=acme&status=OPEN`);
  });

  it("sends nothing when every row is blank", () => {
    expect(
      queryFor(
        advanced({ field: "text", value: "" }, { field: "status", value: "  " }),
      ),
    ).toBe(UNFILTERED);
  });

  it("sends nothing for the empty state the screen starts and resets to", () => {
    expect(queryFor(EMPTY_LEAD_SEARCH)).toBe(UNFILTERED);
  });
});

describe("buildLeadsListQuery — the accepted key surface", () => {
  it("never produces a key outside the documented twelve", () => {
    const searches: LeadSearchState[] = [
      EMPTY_LEAD_SEARCH,
      ...LEAD_SEARCH_FIELDS.map((field) =>
        basic(field.id, field.kind === "text" ? "acme" : STAGE_ID),
      ),
      // Every field at once, which is the widest request this builder can make.
      advanced(
        ...LEAD_SEARCH_FIELDS.map((field) => ({
          field: field.id,
          value: field.kind === "text" ? "acme" : STAGE_ID,
        })),
      ),
    ];

    for (const search of searches) {
      for (const key of buildLeadsListQuery({ ...LIST_WINDOW, search }).keys()) {
        expect(LEAD_LIST_QUERY_KEYS).toContain(key);
      }
    }
    expect(LEAD_LIST_QUERY_KEYS).toHaveLength(12);
  });

  // `ownerUserId` is accepted by the DTO and deliberately unreachable in BOTH
  // modes: no endpoint lists assignable users by name, so the control could
  // only ask for a raw UUID.
  it("offers no field that would send ownerUserId", () => {
    expect(LEAD_SEARCH_FIELDS.map((field) => field.key)).not.toContain(
      "ownerUserId",
    );
  });

  it("rejects a field id that is not in the catalogue", () => {
    expect(() => leadSearchField("owner" as LeadSearchFieldId)).toThrow(
      "Unknown lead search field: owner",
    );
    expect(() => queryFor(basic("owner" as LeadSearchFieldId, "x"))).toThrow(
      "Unknown lead search field: owner",
    );
  });
});
