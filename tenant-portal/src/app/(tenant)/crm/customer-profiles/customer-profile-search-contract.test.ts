import { describe, expect, it } from "vitest";
import {
  CUSTOMER_PROFILE_LIST_QUERY_KEYS,
  CUSTOMER_PROFILE_SEARCH_FIELDS,
  EMPTY_CUSTOMER_PROFILE_SEARCH,
  buildCustomerProfilesListQuery,
  customerProfileSearchAvailableFields,
  customerProfileSearchField,
  customerProfileSearchWithMode,
  customerProfileSearchWithRow,
  customerProfileSearchWithRowAdded,
  customerProfileSearchWithRowRemoved,
  customerProfileTextSearch,
  type CustomerProfileSearchFieldId,
  type CustomerProfileSearchRow,
  type CustomerProfileSearchState,
} from "./customer-profile-search-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const SOURCE_ID = "01900100-0000-7000-8000-0000000000a1";

const LIST_WINDOW = {
  branchId: BRANCH_ID,
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortDir: "DESC",
} as const;

/** One condition, the way basic mode holds it. */
function basic(
  field: CustomerProfileSearchFieldId,
  value: string,
): CustomerProfileSearchState {
  return { mode: "basic", rows: [{ field, value }] };
}

/** Several conditions, the way advanced mode holds them. */
function advanced(
  ...rows: CustomerProfileSearchRow[]
): CustomerProfileSearchState {
  return { mode: "advanced", rows };
}

function queryFor(search: CustomerProfileSearchState): string {
  return buildCustomerProfilesListQuery({ ...LIST_WINDOW, search }).toString();
}

const UNFILTERED =
  `branchId=${BRANCH_ID}&page=1&limit=25&sortBy=createdAt&sortDir=DESC`;

describe("buildCustomerProfilesListQuery — the default text field", () => {
  it("sends free text as `search`, which is the only key it may use", () => {
    expect(queryFor(basic("text", "acme"))).toBe(`${UNFILTERED}&search=acme`);
  });

  it("trims, because a value of spaces is not a search", () => {
    expect(queryFor(basic("text", "  acme  "))).toBe(`${UNFILTERED}&search=acme`);
  });

  it("clamps at the wire's 200 characters instead of earning a 400", () => {
    const query = buildCustomerProfilesListQuery({
      ...LIST_WINDOW,
      search: basic("text", "a".repeat(250)),
    });
    expect(query.get("search")).toHaveLength(200);
  });

  it("wraps a bare string in the default field, for a caller that has only one", () => {
    expect(customerProfileTextSearch("acme")).toEqual(basic("text", "acme"));
  });
});

describe("buildCustomerProfilesListQuery — the enum and catalogue fields", () => {
  const cases: ReadonlyArray<[CustomerProfileSearchFieldId, string, string]> = [
    ["status", "PROSPECT", "status=PROSPECT"],
    ["profileType", "CORPORATE", "profileType=CORPORATE"],
    ["source", SOURCE_ID, `acquisitionSourceId=${SOURCE_ID}`],
  ];

  it.each(cases)(
    "routes %s through its own wire key",
    (field, value, expected) => {
      expect(queryFor(basic(field, value))).toBe(`${UNFILTERED}&${expected}`);
    },
  );

  it("offers only wire values the DTO's enums accept", () => {
    expect(customerProfileSearchField("status").values).toEqual([
      "PROSPECT",
      "ACTIVE_CUSTOMER",
      "INACTIVE",
      "BLACKLISTED",
    ]);
    expect(customerProfileSearchField("profileType").values).toEqual([
      "INDIVIDUAL",
      "CORPORATE",
    ]);
  });
});

describe("buildCustomerProfilesListQuery — several conditions, AND-ed", () => {
  it("sends one key per row, which is the whole of what AND means here", () => {
    expect(
      queryFor(
        advanced(
          { field: "status", value: "PROSPECT" },
          { field: "source", value: SOURCE_ID },
        ),
      ),
    ).toBe(`${UNFILTERED}&status=PROSPECT&acquisitionSourceId=${SOURCE_ID}`);
  });

  it("emits in catalogue order, so row order cannot change the request", () => {
    expect(
      queryFor(
        advanced(
          { field: "source", value: SOURCE_ID },
          { field: "status", value: "PROSPECT" },
        ),
      ),
    ).toBe(`${UNFILTERED}&status=PROSPECT&acquisitionSourceId=${SOURCE_ID}`);
  });

  it("carries all four equality filters plus the free text at once", () => {
    const query = buildCustomerProfilesListQuery({
      ...LIST_WINDOW,
      search: advanced(
        { field: "text", value: "acme" },
        { field: "status", value: "PROSPECT" },
        { field: "profileType", value: "CORPORATE" },
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
      "profileType",
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
          { field: "status", value: "PROSPECT" },
          { field: "source", value: SOURCE_ID },
        ],
      }),
    ).toBe(`${UNFILTERED}&status=PROSPECT`);
  });
});

describe("customer profile search rows — a field may appear at most once", () => {
  it("withholds a field already spoken for from every other row's picker", () => {
    const state = advanced(
      { field: "status", value: "PROSPECT" },
      { field: "source", value: SOURCE_ID },
    );
    // Row 1's own field stays — the picker must be able to show its value —
    // and row 0's is gone, so a second `status` row cannot be chosen.
    expect(
      customerProfileSearchAvailableFields(state, 1).map((field) => field.id),
    ).toEqual(["text", "profileType", "source"]);
    // A row index past the end asks what a NEW row could filter on.
    expect(
      customerProfileSearchAvailableFields(state, state.rows.length).map(
        (field) => field.id,
      ),
    ).toEqual(["text", "profileType"]);
  });

  it("adds a row on a free field, and stops once every field is taken", () => {
    let state: CustomerProfileSearchState = EMPTY_CUSTOMER_PROFILE_SEARCH;
    for (
      let index = 1;
      index < CUSTOMER_PROFILE_SEARCH_FIELDS.length;
      index += 1
    ) {
      state = customerProfileSearchWithRowAdded(state);
    }
    expect(state.rows.map((row) => row.field)).toEqual(
      CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) => field.id),
    );
    // Nothing left to offer: the state comes back untouched rather than
    // growing a duplicate row.
    expect(customerProfileSearchWithRowAdded(state)).toBe(state);
  });

  it("cannot be talked into two rows on one field through the picker", () => {
    const state = advanced(
      { field: "status", value: "PROSPECT" },
      { field: "source", value: SOURCE_ID },
    );
    const offered = customerProfileSearchAvailableFields(state, 1).map(
      (field) => field.id,
    );
    expect(offered).not.toContain("status");
    for (const field of offered) {
      const next = customerProfileSearchWithRow(state, 1, { field });
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
          { field: "status", value: "PROSPECT" },
          { field: "status", value: "INACTIVE" },
        ),
      ),
    ).toThrow("Duplicate customer profile search field: status");
  });

  it("clears the value when a row changes field, since it means nothing there", () => {
    const state = basic("status", "PROSPECT");
    expect(
      customerProfileSearchWithRow(state, 0, { field: "source" }).rows,
    ).toEqual([{ field: "source", value: "" }]);
  });

  it("keeps a condition behind when the last row is removed", () => {
    const state = advanced({ field: "status", value: "PROSPECT" });
    expect(customerProfileSearchWithRowRemoved(state, 0).rows).toEqual([
      { field: "text", value: "" },
    ]);
    expect(queryFor(customerProfileSearchWithRowRemoved(state, 0))).toBe(
      UNFILTERED,
    );
  });
});

describe("customer profile search modes", () => {
  it("carries the current condition into advanced as the first row", () => {
    const next = customerProfileSearchWithMode(
      basic("status", "PROSPECT"),
      "advanced",
    );
    expect(next).toEqual(advanced({ field: "status", value: "PROSPECT" }));
  });

  it("keeps the first row and drops the rest on the way back to basic", () => {
    const next = customerProfileSearchWithMode(
      advanced(
        { field: "status", value: "PROSPECT" },
        { field: "source", value: SOURCE_ID },
        { field: "text", value: "acme" },
      ),
      "basic",
    );
    expect(next).toEqual(basic("status", "PROSPECT"));
    expect(queryFor(next)).toBe(`${UNFILTERED}&status=PROSPECT`);
  });

  it("is a no-op on the mode already selected", () => {
    const state = basic("status", "PROSPECT");
    expect(customerProfileSearchWithMode(state, "basic")).toBe(state);
  });
});

describe("buildCustomerProfilesListQuery — a blank value is not a filter", () => {
  // `status=` is an empty string to @IsEnum, which is a 400 — not "any
  // status". Every field must omit its key rather than send it empty.
  it.each(CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) => field.id))(
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
          { field: "status", value: "PROSPECT" },
          { field: "source", value: "   " },
          { field: "text", value: "acme" },
        ),
      ),
    ).toBe(`${UNFILTERED}&search=acme&status=PROSPECT`);
  });

  it("sends nothing when every row is blank", () => {
    expect(
      queryFor(
        advanced({ field: "text", value: "" }, { field: "status", value: "  " }),
      ),
    ).toBe(UNFILTERED);
  });

  it("sends nothing for the empty state the screen starts and resets to", () => {
    expect(queryFor(EMPTY_CUSTOMER_PROFILE_SEARCH)).toBe(UNFILTERED);
  });
});

describe("buildCustomerProfilesListQuery — the accepted key surface", () => {
  it("never produces a key outside the documented ten", () => {
    const searches: CustomerProfileSearchState[] = [
      EMPTY_CUSTOMER_PROFILE_SEARCH,
      ...CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) =>
        basic(field.id, field.kind === "text" ? "acme" : SOURCE_ID),
      ),
      // Every field at once, which is the widest request this builder can make.
      advanced(
        ...CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) => ({
          field: field.id,
          value: field.kind === "text" ? "acme" : SOURCE_ID,
        })),
      ),
    ];

    for (const search of searches) {
      const query = buildCustomerProfilesListQuery({ ...LIST_WINDOW, search });
      for (const key of query.keys()) {
        expect(CUSTOMER_PROFILE_LIST_QUERY_KEYS).toContain(key);
      }
    }
    expect(CUSTOMER_PROFILE_LIST_QUERY_KEYS).toHaveLength(10);
  });

  // `ownerUserId` is accepted by the DTO and deliberately unreachable in BOTH
  // modes: no endpoint lists assignable users by name, so the control could
  // only ask for a raw UUID.
  it("offers no field that would send ownerUserId", () => {
    expect(
      CUSTOMER_PROFILE_SEARCH_FIELDS.map((field) => field.key),
    ).not.toContain("ownerUserId");
  });

  it("rejects a field id that is not in the catalogue", () => {
    expect(() =>
      customerProfileSearchField("owner" as CustomerProfileSearchFieldId),
    ).toThrow("Unknown customer profile search field: owner");
    expect(() =>
      queryFor(basic("owner" as CustomerProfileSearchFieldId, "x")),
    ).toThrow("Unknown customer profile search field: owner");
  });
});
