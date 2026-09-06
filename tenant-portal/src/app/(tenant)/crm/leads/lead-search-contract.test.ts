import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_ADVANCED_FIELD,
  EMPTY_LEAD_SEARCH,
  LEAD_ADVANCED_FIELDS,
  LEAD_FILTERABLE_FIELDS,
  LEAD_LIST_QUERY_KEYS,
  LEAD_SEARCH_FIELDS,
  buildLeadSearchRequest,
  buildLeadsListQuery,
  leadAdvancedField,
  leadSearchCleared,
  leadSearchField,
  leadSearchValueOf,
  leadSearchWithField,
  leadSearchWithGroups,
  leadSearchWithMode,
  leadSearchWithRow,
  leadSearchWithText,
  type LeadAdvancedFieldId,
  type LeadSearchFieldId,
  type LeadSearchGroup,
  type LeadSearchState,
} from "./lead-search-contract";
import {
  crmOperatorsFor,
  type CrmFilterLeaf,
  type CrmFilterOperator,
  type CrmFilterTreeNode,
  type CrmSearchCondition,
} from "../shared/search/filter-tree";

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

/** Basic mode's one condition. */
function basic(field: LeadSearchFieldId, value: string): LeadSearchState {
  return { ...EMPTY_LEAD_SEARCH, mode: "basic", basic: { field, value } };
}

/** One condition of the card, with `between`'s upper bound left blank. */
function leaf(
  field: LeadAdvancedFieldId,
  operator: CrmFilterOperator,
  value = "",
  valueTo = "",
): CrmSearchCondition<LeadAdvancedFieldId> {
  return { field, operator, value, valueTo };
}

/** Advanced mode, with the groups the card would have built. */
function advanced(...groups: LeadSearchGroup[]): LeadSearchState {
  return { ...EMPTY_LEAD_SEARCH, mode: "advanced", groups };
}

function queryFor(search: LeadSearchState): string {
  return buildLeadsListQuery({ ...LIST_WINDOW, search }).toString();
}

function bodyFor(search: LeadSearchState) {
  return buildLeadSearchRequest(search, LIST_WINDOW);
}

/** Every leaf in a compiled tree, whatever its shape. */
function leaves(node: CrmFilterTreeNode | undefined): CrmFilterLeaf[] {
  if (!node) return [];
  if ("children" in node) return node.children.flatMap(leaves);
  return [node];
}

const UNFILTERED =
  `branchId=${BRANCH_ID}&page=1&limit=50&sortBy=createdAt&sortDir=DESC`;

/* ------------------------------ basic mode ------------------------------ */

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

  it("sends nothing for the empty state the screen starts and resets to", () => {
    expect(queryFor(EMPTY_LEAD_SEARCH)).toBe(UNFILTERED);
  });

  // The card's groups belong to the OTHER endpoint. A basic request must not
  // pick anything up from them, however much a mode switch left behind.
  it("ignores the advanced groups entirely", () => {
    const state: LeadSearchState = {
      ...advanced({ conditions: [leaf("status", "eq", "OPEN")] }),
      mode: "basic",
      text: "acme",
    };
    expect(queryFor(state)).toBe(UNFILTERED);
  });
});

describe("buildLeadsListQuery — the accepted key surface", () => {
  it("never produces a key outside the documented twelve", () => {
    const searches: LeadSearchState[] = [
      EMPTY_LEAD_SEARCH,
      ...LEAD_SEARCH_FIELDS.map((field) =>
        basic(field.id, field.kind === "text" ? "acme" : STAGE_ID),
      ),
    ];

    for (const search of searches) {
      for (const key of buildLeadsListQuery({ ...LIST_WINDOW, search }).keys()) {
        expect(LEAD_LIST_QUERY_KEYS).toContain(key);
      }
    }
    expect(LEAD_LIST_QUERY_KEYS).toHaveLength(12);
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

/* ---------------------------- state transitions --------------------------- */

describe("lead search modes", () => {
  it("is a no-op on the mode already selected", () => {
    const state = basic("status", "OPEN");
    expect(leadSearchWithMode(state, "basic")).toBe(state);
  });

  // The two modes speak different wires. Neither half is translated into the
  // other, and that is visible in a way a silent partial translation is not.
  it("keeps both halves intact and swaps only the mode", () => {
    const state = leadSearchWithText(
      advanced({ conditions: [leaf("status", "eq", "OPEN")] }),
      "acme",
    );
    const next = leadSearchWithMode(state, "basic");
    expect(next.mode).toBe("basic");
    expect(next.groups).toBe(state.groups);
    expect(next.text).toBe("acme");
  });

  it("clears the value when the basic field changes, since it means nothing there", () => {
    expect(leadSearchWithRow(basic("status", "OPEN"), { field: "stage" }).basic).toEqual({
      field: "stage",
      value: "",
    });
  });
});

describe("lead search by field — what the stage bar writes", () => {
  it("reads back the value filtering on a field, and blank when none does", () => {
    const state = basic("stage", STAGE_ID);
    expect(leadSearchValueOf(state, "stage")).toBe(STAGE_ID);
    expect(leadSearchValueOf(state, "source")).toBe("");
  });

  it("replaces the single condition", () => {
    expect(leadSearchWithField(basic("status", "OPEN"), "stage", STAGE_ID).basic).toEqual({
      field: "stage",
      value: STAGE_ID,
    });
  });

  it("drops the condition on a blank value instead of blanking it", () => {
    const next = leadSearchWithField(basic("stage", STAGE_ID), "stage", "");
    expect(queryFor(next)).toBe(UNFILTERED);
  });
});

describe("advanced reset", () => {
  it("clears the text and the groups without leaving advanced mode", () => {
    const state = leadSearchWithText(
      advanced(
        { conditions: [leaf("status", "eq", "OPEN")] },
        { conditions: [leaf("stageFlag", "eq", "NEW")] },
      ),
      "acme",
    );
    const next = leadSearchCleared(state);
    expect(next.mode).toBe("advanced");
    expect(next.text).toBe("");
    expect(next.groups).toEqual(EMPTY_LEAD_SEARCH.groups);
    expect(bodyFor(next).filterTree).toBeUndefined();
  });
});

/* --------------------------- the filter tree ---------------------------- */

describe("buildLeadSearchRequest — the shape of the body", () => {
  it("sends the branch, the sort pair and the page window, and nothing else", () => {
    expect(bodyFor(EMPTY_LEAD_SEARCH)).toEqual({
      branchId: BRANCH_ID,
      sort: "createdAt:DESC",
      page: 1,
      limit: 50,
    });
  });

  it("omits `filterTree` and `search` rather than sending them empty", () => {
    const body = bodyFor(advanced({ conditions: [leaf("status", "eq", "  ")] }));
    expect("filterTree" in body).toBe(false);
    expect("search" in body).toBe(false);
  });

  it("carries the free text, clamped at the wire's 200 characters", () => {
    const state = leadSearchWithText(EMPTY_LEAD_SEARCH, `  ${"a".repeat(250)}  `);
    expect(bodyFor(state).search).toHaveLength(200);
  });
});

describe("buildLeadSearchRequest — groups compile to AND inside, OR between", () => {
  // The exact tree the route's own OpenAPI example documents.
  it("wraps two OR groups of two ANDed leaves, and nothing more", () => {
    const state = advanced(
      { conditions: [leaf("status", "eq", "OPEN"), leaf("stageFlag", "eq", "QUALIFIED")] },
      { conditions: [leaf("createdAt", "gte", "2026-01-01"), leaf("stage", "eq", STAGE_ID)] },
    );

    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        {
          op: "AND",
          children: [
            { field: "status", operator: "eq", value: "OPEN" },
            { field: "stageFlag", operator: "eq", value: "QUALIFIED" },
          ],
        },
        {
          op: "AND",
          children: [
            { field: "createdAt", operator: "gte", value: "2026-01-01" },
            { field: "stageId", operator: "eq", value: STAGE_ID },
          ],
        },
      ],
    });
  });

  // Depth is capped at 5, so a wrapper that says nothing is a level spent on
  // nothing. A lone leaf is the whole tree.
  it("never wraps a single condition in a pointless AND node", () => {
    expect(bodyFor(advanced({ conditions: [leaf("status", "eq", "OPEN")] })).filterTree).toEqual(
      { field: "status", operator: "eq", value: "OPEN" },
    );
  });

  it("collapses a single-condition group inside an OR, but keeps the OR", () => {
    const state = advanced(
      { conditions: [leaf("status", "eq", "OPEN"), leaf("stageFlag", "eq", "QUALIFIED")] },
      { conditions: [leaf("createdAt", "gte", "2026-01-01")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        {
          op: "AND",
          children: [
            { field: "status", operator: "eq", value: "OPEN" },
            { field: "stageFlag", operator: "eq", value: "QUALIFIED" },
          ],
        },
        { field: "createdAt", operator: "gte", value: "2026-01-01" },
      ],
    });
  });
});

describe("buildLeadSearchRequest — the same field, twice", () => {
  // The restriction that used to forbid this was a fact about the query
  // string's one slot per key. A tree has a node per leaf.
  it("asks one field two ways inside one AND group", () => {
    const state = advanced({
      conditions: [leaf("createdAt", "gte", "2026-01-01"), leaf("createdAt", "lt", "2026-02-01")],
    });
    expect(bodyFor(state).filterTree).toEqual({
      op: "AND",
      children: [
        { field: "createdAt", operator: "gte", value: "2026-01-01" },
        { field: "createdAt", operator: "lt", value: "2026-02-01" },
      ],
    });
  });

  it("asks one field two ways across two OR groups", () => {
    const state = advanced(
      { conditions: [leaf("stageFlag", "eq", "NEW")] },
      { conditions: [leaf("stageFlag", "eq", "CONTACTED")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        { field: "stageFlag", operator: "eq", value: "NEW" },
        { field: "stageFlag", operator: "eq", value: "CONTACTED" },
      ],
    });
  });
});

describe("buildLeadSearchRequest — a blank condition is dropped", () => {
  // Every operator but the two null ones is `400 INVALID_OPERATOR_VALUE` on a
  // missing value, and a half-filled row must not fail the rest of the query.
  it("keeps the conditions around a blank one", () => {
    const state = advanced({
      conditions: [
        leaf("status", "eq", "OPEN"),
        leaf("description", "ilike", "   "),
        leaf("stageFlag", "eq", "QUALIFIED"),
      ],
    });
    expect(leaves(bodyFor(state).filterTree).map((node) => node.field)).toEqual([
      "status",
      "stageFlag",
    ]);
  });

  it("drops a group whose every condition is blank, and the OR with it", () => {
    const state = advanced(
      { conditions: [leaf("status", "eq", "OPEN")] },
      { conditions: [leaf("stageFlag", "eq", ""), leaf("description", "ilike", " ")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      field: "status",
      operator: "eq",
      value: "OPEN",
    });
  });

  it("needs BOTH bounds before it will send a `between`", () => {
    const half = advanced({ conditions: [leaf("createdAt", "between", "2026-01-01", "")] });
    expect(bodyFor(half).filterTree).toBeUndefined();

    const whole = advanced({
      conditions: [leaf("createdAt", "between", "2026-01-01", "2026-02-01")],
    });
    expect(bodyFor(whole).filterTree).toEqual({
      field: "createdAt",
      operator: "between",
      value: ["2026-01-01", "2026-02-01"],
    });
  });

  it("drops an `in` with nothing selected, and sends the rest as an array", () => {
    expect(
      bodyFor(advanced({ conditions: [leaf("status", "in", " , ")] })).filterTree,
    ).toBeUndefined();
    expect(
      bodyFor(advanced({ conditions: [leaf("status", "in", "OPEN, ON_HOLD")] })).filterTree,
    ).toEqual({ field: "status", operator: "in", value: ["OPEN", "ON_HOLD"] });
  });
});

describe("buildLeadSearchRequest — `isNull` carries no value", () => {
  // `OperatorCompiler.compile` returns `IsNull()` before it looks at `value`;
  // the two null operators are the only ones that may arrive without one, and
  // a `value: undefined` key would still be a key to anything inspecting the
  // body before it is serialised.
  it.each(["isNull", "isNotNull"] as const)("sends no `value` key for %s", (operator) => {
    const tree = bodyFor(advanced({ conditions: [leaf("owner", operator)] })).filterTree;
    expect(tree).toEqual({ field: "ownerUserId", operator });
    expect("value" in (tree as CrmFilterLeaf)).toBe(false);
  });

  it("keeps a valueless condition even though its value is blank", () => {
    const state = advanced({
      conditions: [leaf("status", "eq", "OPEN"), leaf("convertedAt", "isNull")],
    });
    expect(leaves(bodyFor(state).filterTree)).toHaveLength(2);
  });

  // Asking whether a NOT NULL column is empty is a question with one answer.
  it("offers the null operators on nullable columns only", () => {
    for (const field of LEAD_ADVANCED_FIELDS) {
      const operators = crmOperatorsFor(field.kind, field.nullable ?? false);
      expect(operators.includes("isNull")).toBe(field.nullable === true);
      expect(operators.includes("isNotNull")).toBe(field.nullable === true);
    }
  });
});

describe("buildLeadSearchRequest — the whitelist boundary", () => {
  // A field outside `LEAD_FILTERABLE_FIELDS` is 400 INVALID_FIELD, which
  // reaches the screen as a failed load rather than an unavailable filter.
  it("mirrors the repository's whitelist exactly", () => {
    expect(LEAD_FILTERABLE_FIELDS).toEqual([
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
    ]);
  });

  it("cannot produce a leaf outside the whitelist, on any field or operator", () => {
    for (const field of LEAD_ADVANCED_FIELDS) {
      for (const operator of crmOperatorsFor(field.kind, field.nullable ?? false)) {
        const state = advanced({
          conditions: [leaf(field.id, operator, "2026-01-01", "2026-02-01")],
        });
        for (const node of leaves(bodyFor(state).filterTree)) {
          expect(LEAD_FILTERABLE_FIELDS).toContain(node.field);
        }
      }
    }
  });

  // The branch travels in the body and the tree is ANDed onto the scoped
  // query, so a `branchId` leaf could only restate the scope or empty the list.
  it("offers no condition that would name branchId", () => {
    expect(LEAD_ADVANCED_FIELDS.map((field) => field.field)).not.toContain("branchId");
  });

  it("offers every other whitelisted column exactly once", () => {
    const offered = LEAD_ADVANCED_FIELDS.map((field) => field.field);
    expect(new Set(offered).size).toBe(offered.length);
    expect([...offered].sort()).toEqual(
      LEAD_FILTERABLE_FIELDS.filter((field) => field !== "branchId")
        .slice()
        .sort(),
    );
  });

  it("throws on a field id a cast smuggled past the picker", () => {
    expect(() => leadAdvancedField("displayName" as LeadAdvancedFieldId)).toThrow(
      "Unknown lead filter field: displayName",
    );
    expect(() =>
      bodyFor(
        advanced({ conditions: [leaf("displayName" as LeadAdvancedFieldId, "eq", "acme")] }),
      ),
    ).toThrow("Unknown lead filter field: displayName");
  });

  // Rule 4 in the contract's header: these come from a raw join the filter
  // compiler cannot resolve to a column, so free text is their only route.
  it("offers no party-backed display column", () => {
    const offered = LEAD_ADVANCED_FIELDS.map((field) => field.field);
    for (const column of [
      "displayName",
      "firstName",
      "lastName",
      "companyName",
      "email",
      "primaryMobile",
      "phones",
    ]) {
      expect(offered).not.toContain(column);
      expect(LEAD_FILTERABLE_FIELDS).not.toContain(column);
    }
  });
});

describe("advanced group edits", () => {
  it("starts on one group holding one blank condition on the default field", () => {
    expect(EMPTY_LEAD_SEARCH.groups).toEqual([
      {
        conditions: [
          { field: DEFAULT_LEAD_ADVANCED_FIELD.id, operator: "eq", value: "", valueTo: "" },
        ],
      },
    ]);
  });

  it("replaces the groups wholesale, which is all the card ever does", () => {
    const groups: LeadSearchGroup[] = [{ conditions: [leaf("status", "eq", "OPEN")] }];
    expect(leadSearchWithGroups(EMPTY_LEAD_SEARCH, groups).groups).toBe(groups);
  });
});
