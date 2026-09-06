import { describe, expect, it } from "vitest";
import {
  crmBlankCondition,
  crmOperatorsFor,
  type CrmFilterLeaf,
  type CrmFilterTreeNode,
  type CrmSearchCondition,
} from "../shared/search/filter-tree";
import {
  CUSTOMER_PROFILE_ADVANCED_FIELDS,
  CUSTOMER_PROFILE_FILTERABLE_FIELDS,
  DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD,
  CUSTOMER_PROFILE_LIST_QUERY_KEYS,
  CUSTOMER_PROFILE_SEARCH_FIELDS,
  EMPTY_CUSTOMER_PROFILE_SEARCH,
  buildCustomerProfileSearchRequest,
  buildCustomerProfilesListQuery,
  customerProfileAdvancedField,
  customerProfileSearchCleared,
  customerProfileSearchField,
  customerProfileSearchWithGroups,
  customerProfileSearchWithMode,
  customerProfileSearchWithRow,
  customerProfileSearchWithText,
  customerProfileTextSearch,
  type CustomerProfileAdvancedFieldId,
  type CustomerProfileSearchFieldId,
  type CustomerProfileSearchGroup,
  type CustomerProfileSearchState,
} from "./customer-profile-search-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const SOURCE_ID = "01900100-0000-7000-8000-0000000000a1";
const OWNER_ID = "01900100-0000-7000-8000-0000000000a2";

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
  return {
    ...EMPTY_CUSTOMER_PROFILE_SEARCH,
    mode: "basic",
    basic: { field, value },
  };
}

/** One condition, the way the card holds it before it is compiled. */
function condition(
  field: CustomerProfileAdvancedFieldId,
  operator: CrmSearchCondition<CustomerProfileAdvancedFieldId>["operator"],
  value = "",
  valueTo = "",
): CrmSearchCondition<CustomerProfileAdvancedFieldId> {
  return { field, operator, value, valueTo };
}

/** Advanced mode holding `groups`, with no free text. */
function advanced(
  ...groups: CustomerProfileSearchGroup[]
): CustomerProfileSearchState {
  return { ...EMPTY_CUSTOMER_PROFILE_SEARCH, mode: "advanced", groups };
}

function queryFor(search: CustomerProfileSearchState): string {
  return buildCustomerProfilesListQuery({ ...LIST_WINDOW, search }).toString();
}

function bodyFor(search: CustomerProfileSearchState) {
  return buildCustomerProfileSearchRequest(search, LIST_WINDOW);
}

/** Every leaf of a compiled tree, groups flattened away. */
function leavesOf(node: CrmFilterTreeNode | undefined): CrmFilterLeaf[] {
  if (!node) return [];
  if ("children" in node) return node.children.flatMap(leavesOf);
  return [node];
}

const UNFILTERED =
  `branchId=${BRANCH_ID}&page=1&limit=25&sortBy=createdAt&sortDir=DESC`;

/* ------------------------------ basic mode ------------------------------ */

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
    ];

    for (const search of searches) {
      const query = buildCustomerProfilesListQuery({ ...LIST_WINDOW, search });
      for (const key of query.keys()) {
        expect(CUSTOMER_PROFILE_LIST_QUERY_KEYS).toContain(key);
      }
    }
    expect(CUSTOMER_PROFILE_LIST_QUERY_KEYS).toHaveLength(10);
  });

  // `ownerUserId` is accepted by the DTO and deliberately unreachable in BASIC
  // mode: no endpoint lists assignable users by name, so the control could only
  // ask for a raw UUID. Advanced reaches the column through the tree, where
  // "is empty" is a useful answer on its own.
  it("offers no basic field that would send ownerUserId", () => {
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

/* -------------------------------- state --------------------------------- */

describe("customer profile search state", () => {
  it("clears the value when the basic row changes field, since it means nothing there", () => {
    const next = customerProfileSearchWithRow(basic("status", "PROSPECT"), {
      field: "source",
    });
    expect(next.basic).toEqual({ field: "source", value: "" });
  });

  it("carries neither side's question across a mode switch", () => {
    const asked = customerProfileSearchWithText(
      customerProfileSearchWithGroups(basic("status", "PROSPECT"), [
        { conditions: [condition("status", "eq", "ACTIVE_CUSTOMER")] },
      ]),
      "acme",
    );
    const advancedState = customerProfileSearchWithMode(asked, "advanced");
    // The basic row is still in state and still unasked: the query string is
    // not built in advanced mode, and the tree is not built in basic mode.
    expect(advancedState.basic).toEqual({ field: "status", value: "PROSPECT" });
    expect(bodyFor(advancedState)).toEqual({
      branchId: BRANCH_ID,
      filterTree: { field: "status", operator: "eq", value: "ACTIVE_CUSTOMER" },
      search: "acme",
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
    expect(queryFor(customerProfileSearchWithMode(advancedState, "basic"))).toBe(
      `${UNFILTERED}&status=PROSPECT`,
    );
  });

  // The card is never handed zero groups: an empty one would leave the "add
  // condition" control with nothing to attach to.
  it("opens the card on one blank condition, on the first offered field", () => {
    expect(EMPTY_CUSTOMER_PROFILE_SEARCH.groups).toEqual([
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
    ]);
    // The literal above must stay in step with the operator list the card
    // would derive for that field.
    expect(crmBlankCondition(DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD)).toEqual(
      EMPTY_CUSTOMER_PROFILE_SEARCH.groups[0]!.conditions[0],
    );
  });

  it("is a no-op on the mode already selected", () => {
    const state = basic("status", "PROSPECT");
    expect(customerProfileSearchWithMode(state, "basic")).toBe(state);
  });

  it("clears the card back to one blank group without leaving advanced", () => {
    const state = customerProfileSearchWithText(
      advanced({ conditions: [condition("status", "eq", "PROSPECT")] }),
      "acme",
    );
    const cleared = customerProfileSearchCleared(state);
    expect(cleared.mode).toBe("advanced");
    expect(cleared.text).toBe("");
    expect(cleared.groups).toEqual(EMPTY_CUSTOMER_PROFILE_SEARCH.groups);
    expect(bodyFor(cleared)).toEqual({
      branchId: BRANCH_ID,
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });
});

/* ----------------------------- advanced mode ---------------------------- */

describe("buildCustomerProfileSearchRequest — the filter tree", () => {
  it("ORs the groups and ANDs what is inside each one", () => {
    const body = bodyFor(
      advanced(
        {
          conditions: [
            condition("status", "eq", "PROSPECT"),
            condition("profileType", "eq", "CORPORATE"),
          ],
        },
        {
          conditions: [
            condition("createdAt", "gte", "2026-01-01"),
            condition("source", "eq", SOURCE_ID),
          ],
        },
      ),
    );
    expect(body.filterTree).toEqual({
      op: "OR",
      children: [
        {
          op: "AND",
          children: [
            { field: "status", operator: "eq", value: "PROSPECT" },
            { field: "profileType", operator: "eq", value: "CORPORATE" },
          ],
        },
        {
          op: "AND",
          children: [
            { field: "createdAt", operator: "gte", value: "2026-01-01" },
            { field: "acquisitionSourceId", operator: "eq", value: SOURCE_ID },
          ],
        },
      ],
    });
  });

  // The exact body for the route's own documented example — two AND-ed
  // conditions OR-ed against a one-sided date range, where the second group
  // collapses to its single leaf rather than an AND wrapping one child.
  it("matches the shape the route documents, byte for byte", () => {
    expect(
      bodyFor(
        advanced(
          {
            conditions: [
              condition("status", "eq", "PROSPECT"),
              condition("profileType", "eq", "CORPORATE"),
            ],
          },
          { conditions: [condition("createdAt", "gte", "2026-01-01")] },
        ),
      ),
    ).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        op: "OR",
        children: [
          {
            op: "AND",
            children: [
              { field: "status", operator: "eq", value: "PROSPECT" },
              { field: "profileType", operator: "eq", value: "CORPORATE" },
            ],
          },
          { field: "createdAt", operator: "gte", value: "2026-01-01" },
        ],
      },
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  // The tree has a node per leaf, unlike the query string's one slot per key,
  // so `status = PROSPECT OR status = INACTIVE` is a normal question. The old
  // one-row-per-field rule was a fact about the query string, and it is gone.
  it("lets the same field be asked twice, in one group and across groups", () => {
    expect(
      bodyFor(
        advanced({
          conditions: [
            condition("createdAt", "gte", "2026-01-01"),
            condition("createdAt", "lt", "2026-02-01"),
          ],
        }),
      ).filterTree,
    ).toEqual({
      op: "AND",
      children: [
        { field: "createdAt", operator: "gte", value: "2026-01-01" },
        { field: "createdAt", operator: "lt", value: "2026-02-01" },
      ],
    });

    expect(
      bodyFor(
        advanced(
          { conditions: [condition("status", "eq", "PROSPECT")] },
          { conditions: [condition("status", "eq", "INACTIVE")] },
        ),
      ).filterTree,
    ).toEqual({
      op: "OR",
      children: [
        { field: "status", operator: "eq", value: "PROSPECT" },
        { field: "status", operator: "eq", value: "INACTIVE" },
      ],
    });
  });

  // A single condition is the tree, not an AND wrapping one child: the server
  // caps depth at 5, and a wrapper spends a level to say nothing.
  it("sends one condition unwrapped", () => {
    expect(
      bodyFor(advanced({ conditions: [condition("status", "eq", "PROSPECT")] }))
        .filterTree,
    ).toEqual({ field: "status", operator: "eq", value: "PROSPECT" });
  });

  it("drops a blank condition, and the group with it once it holds nothing", () => {
    const body = bodyFor(
      advanced(
        {
          conditions: [
            condition("status", "eq", "PROSPECT"),
            // No value: every operator but the two null ones answers
            // 400 INVALID_OPERATOR_VALUE, so this row is omitted rather than
            // sent empty.
            condition("description", "ilike", "   "),
          ],
        },
        { conditions: [condition("source", "eq", "")] },
      ),
    );
    // The emptied second group is GONE — not an OR against nothing, which
    // would leave a one-child OR node standing.
    expect(body.filterTree).toEqual({
      field: "status",
      operator: "eq",
      value: "PROSPECT",
    });
  });

  it("omits `filterTree` and `search` entirely when nothing was asked", () => {
    expect(bodyFor(EMPTY_CUSTOMER_PROFILE_SEARCH)).toEqual({
      branchId: BRANCH_ID,
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
    expect("filterTree" in bodyFor(EMPTY_CUSTOMER_PROFILE_SEARCH)).toBe(false);
    expect("search" in bodyFor(EMPTY_CUSTOMER_PROFILE_SEARCH)).toBe(false);
  });

  // `isNull`/`isNotNull` are the only operators that take no value, and the
  // compiler must omit the KEY rather than set it undefined: `JSON.stringify`
  // would drop it either way, but a caller inspecting the body before it is
  // serialised would still see the property.
  it("sends no `value` key at all for isNull and isNotNull", () => {
    for (const operator of ["isNull", "isNotNull"] as const) {
      const leaf = bodyFor(
        advanced({ conditions: [condition("owner", operator)] }),
      ).filterTree;
      expect(leaf).toEqual({ field: "ownerUserId", operator });
      expect(Object.hasOwn(leaf as object, "value")).toBe(false);
      expect("value" in (leaf as object)).toBe(false);
    }
  });

  it("offers the two null operators only on a column that can be null", () => {
    for (const definition of CUSTOMER_PROFILE_ADVANCED_FIELDS) {
      const operators = crmOperatorsFor(
        definition.kind,
        definition.nullable ?? false,
      );
      expect(operators.includes("isNull")).toBe(definition.nullable === true);
    }
  });

  it("sends `between` as a 2-tuple and `in` as a list, both trimmed", () => {
    expect(
      bodyFor(
        advanced({
          conditions: [
            condition("createdAt", "between", "2026-01-01", "2026-03-31"),
          ],
        }),
      ).filterTree,
    ).toEqual({
      field: "createdAt",
      operator: "between",
      value: ["2026-01-01", "2026-03-31"],
    });

    expect(
      bodyFor(
        advanced({
          conditions: [
            condition("status", "in", " PROSPECT , ACTIVE_CUSTOMER ,"),
          ],
        }),
      ).filterTree,
    ).toEqual({
      field: "status",
      operator: "in",
      value: ["PROSPECT", "ACTIVE_CUSTOMER"],
    });
  });

  it("clamps the free-text term rather than earning a 400 on the 201st character", () => {
    const body = bodyFor(
      customerProfileSearchWithText(
        advanced({ conditions: [condition("status", "eq", "")] }),
        "  " + "a".repeat(250) + "  ",
      ),
    );
    expect(body.search).toHaveLength(200);
  });

  it("sends the sort as the one `field:DIR` form both routes agree on", () => {
    expect(
      buildCustomerProfileSearchRequest(EMPTY_CUSTOMER_PROFILE_SEARCH, {
        ...LIST_WINDOW,
        sortBy: "displayName",
        sortDir: "ASC",
        page: 3,
        limit: 25,
      }),
    ).toEqual({
      branchId: BRANCH_ID,
      sort: "displayName:ASC",
      page: 3,
      limit: 25,
    });
  });
});

describe("buildCustomerProfileSearchRequest — the filterable-column boundary", () => {
  // A field outside CUSTOMER_PROFILE_FILTERABLE_FIELDS is 400 INVALID_FIELD,
  // which reaches the screen as a failed load rather than as an unavailable
  // filter — so no state may be able to produce one.
  it("never names a column outside the repository's whitelist", () => {
    // The card's own starting row for each field — its first offered operator,
    // filled in — so the walk covers exactly what a user can build.
    const filled = CUSTOMER_PROFILE_ADVANCED_FIELDS.map((definition) => ({
      ...crmBlankCondition(definition),
      value: definition.kind === "date" ? "2026-01-01" : "x",
    }));
    const states = [
      advanced({ conditions: filled }),
      ...filled.map((row) => advanced({ conditions: [row] })),
      ...filled.map((row) => advanced({ conditions: [row] }, { conditions: filled })),
    ];

    for (const state of states) {
      const leaves = leavesOf(bodyFor(state).filterTree);
      expect(leaves.length).toBeGreaterThan(0);
      for (const leaf of leaves) {
        expect(CUSTOMER_PROFILE_FILTERABLE_FIELDS).toContain(leaf.field);
      }
    }
  });

  it("pins the whitelist itself, in the repository's order", () => {
    expect(CUSTOMER_PROFILE_FILTERABLE_FIELDS).toEqual([
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
    ]);
  });

  // The body already carries the branch and the tree is ANDed onto the scoped
  // query, so a `branchId` leaf can only restate the scope or contradict it.
  it("offers every whitelisted column except branchId", () => {
    expect(CUSTOMER_PROFILE_ADVANCED_FIELDS.map((field) => field.field)).toEqual(
      CUSTOMER_PROFILE_FILTERABLE_FIELDS.filter((field) => field !== "branchId"),
    );
  });

  it("reaches ownerUserId, which basic mode deliberately cannot", () => {
    expect(
      bodyFor(advanced({ conditions: [condition("owner", "eq", OWNER_ID)] }))
        .filterTree,
    ).toEqual({ field: "ownerUserId", operator: "eq", value: OWNER_ID });
  });

  it("rejects a filter field id that is not in the catalogue", () => {
    expect(() =>
      customerProfileAdvancedField(
        "branchId" as CustomerProfileAdvancedFieldId,
      ),
    ).toThrow("Unknown customer profile filter field: branchId");
  });
});
