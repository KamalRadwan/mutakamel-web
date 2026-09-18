import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_ADVANCED_FIELD,
  EMPTY_LEAD_SEARCH,
  LEAD_ADVANCED_FIELDS,
  LEAD_FILTERABLE_FIELDS,
  buildLeadSearchRequest,
  leadAdvancedField,
  leadSearchCleared,
  leadSearchValuesOf,
  leadSearchWithField,
  leadSearchWithGroups,
  leadSearchWithMode,
  type LeadAdvancedFieldId,
  type LeadSearchGroup,
  type LeadSearchState,
} from "./lead-search-contract";
import { buildLeadsListQuery, type LeadSearchFieldId } from "./lead-basic-search-contract";
import {
  crmGroupsWithConnector,
  crmOperatorsFor,
  crmOperatorsForField,
  type CrmFilterLeaf,
  type CrmFilterOperator,
  type CrmFilterTreeNode,
  type CrmSearchCondition,
} from "../shared/search/filter-tree";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const STAGE_ID = "01900100-0000-7000-8000-000000000010";

const LIST_WINDOW = {
  branchId: BRANCH_ID,
  page: 1,
  limit: 50,
  sortBy: "createdAt",
  sortDir: "DESC",
} as const;

/** Basic mode's one condition. */
function basic(field: LeadSearchFieldId, value: string): LeadSearchState {
  return { ...EMPTY_LEAD_SEARCH, mode: "basic", basic: { myLeads: false, filters: [{ field, value }] } };
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
  return buildLeadsListQuery({ ...LIST_WINDOW, basic: search.basic }).toString();
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

/* ---------------------------- state transitions --------------------------- */

describe("lead search modes", () => {
  it("is a no-op on the mode already selected", () => {
    const state = basic("status", "OPEN");
    expect(leadSearchWithMode(state, "basic")).toBe(state);
  });

  // The two modes speak different wires. Neither half is translated into the
  // other, and that is visible in a way a silent partial translation is not.
  it("keeps both halves intact and swaps only the mode", () => {
    const state = advanced({ conditions: [leaf("status", "eq", "OPEN")] });
    const next = leadSearchWithMode(state, "basic");
    expect(next.mode).toBe("basic");
    expect(next.groups).toBe(state.groups);
  });


});

describe("lead search by field — what the stage bar writes", () => {
  it("reads back the value filtering on a field, and blank when none does", () => {
    const state = basic("stage", STAGE_ID);
    expect(leadSearchValuesOf(state, "stage")).toEqual([STAGE_ID]);
    expect(leadSearchValuesOf(state, "source")).toEqual([]);
  });

  it("preserves other filters when a stage is selected", () => {
    expect(leadSearchWithField(basic("status", "OPEN"), "stage", STAGE_ID).basic).toEqual({
      myLeads: false,
      filters: [{ field: "status", value: "OPEN" }, { field: "stage", value: STAGE_ID }],
    });
  });

  it("drops the condition on a blank value instead of blanking it", () => {
    const next = leadSearchWithField(basic("stage", STAGE_ID), "stage", "");
    expect(queryFor(next)).toBe(UNFILTERED);
  });

  it.each([STAGE_ID, ""])("selects basic stage search without submitting or losing an advanced draft (%s)", (stageId) => {
    const draft = advanced({ conditions: [leaf("status", "eq", "OPEN")] });
    const next = leadSearchWithField(draft, "stage", stageId);
    expect(next.mode).toBe("basic");
    expect(next.groups).toBe(draft.groups);
    expect(queryFor(next)).toBe(stageId ? `${UNFILTERED}&stageId=${stageId}` : UNFILTERED);
    expect(leadSearchWithMode(next, "advanced").groups).toBe(draft.groups);
  });
});

describe("advanced reset", () => {
  it("clears the groups without leaving advanced mode", () => {
    const state = advanced(
      { conditions: [leaf("status", "eq", "OPEN")] },
      { conditions: [leaf("stageFlag", "eq", "NEW")] },
    );
    const next = leadSearchCleared(state);
    expect(next.mode).toBe("advanced");
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

  it("omits `filterTree` and the removed free-text search key", () => {
    const body = bodyFor(advanced({ conditions: [leaf("status", "eq", "  ")] }));
    expect("filterTree" in body).toBe(false);
    expect("search" in body).toBe(false);
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

  it.each(["likeAny", "ilikeAny", "startsWithAny", "endsWithAny"] as const)(
    "sends a non-empty string array for %s",
    (operator) => {
      expect(
        bodyFor(advanced({ conditions: [leaf("description", operator, "Acme, Mona")] }))
          .filterTree,
      ).toEqual({ field: "description", operator, value: ["Acme", "Mona"] });
      expect(
        bodyFor(advanced({ conditions: [leaf("description", operator, " , ")] }))
          .filterTree,
      ).toBeUndefined();
    },
  );

  it("converts a numeric list while preserving date list strings", () => {
    expect(
      bodyFor(advanced({ conditions: [leaf("rating", "in", "1, 3")] })).filterTree,
    ).toEqual({ field: "rating", operator: "in", value: [1, 3] });
    expect(
      bodyFor(advanced({ conditions: [leaf("createdAt", "in", "2026-01-01, 2026-02-01")] }))
        .filterTree,
    ).toEqual({
      field: "createdAt",
      operator: "in",
      value: ["2026-01-01", "2026-02-01"],
    });
  });
});

describe("advanced operator compatibility", () => {
  it("offers every meaningful SearchMany operator for each scalar kind", () => {
    expect(crmOperatorsFor("uuid", false)).toEqual(["eq", "neq", "in", "nin"]);
    expect(crmOperatorsFor("enum", false)).toEqual(["eq", "neq", "in", "nin"]);
    expect(crmOperatorsFor("number", false)).toEqual([
      "eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "nin",
    ]);
    expect(crmOperatorsFor("date", false)).toEqual([
      "eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "nin",
    ]);
    expect(crmOperatorsFor("text", false)).toEqual([
      "eq", "neq", "like", "ilike", "startsWith", "endsWith", "in", "nin",
      "likeAny", "ilikeAny", "startsWithAny", "endsWithAny",
    ]);
  });

  it("uses a field-specific policy instead of exposing the whole database grammar", () => {
    expect(crmOperatorsForField(leadAdvancedField("leadType"))).toEqual(["eq"]);
    expect(crmOperatorsForField(leadAdvancedField("status"))).toEqual([
      "eq", "neq", "in", "nin",
    ]);
    expect(crmOperatorsForField(leadAdvancedField("description"))).toEqual([
      "ilike", "like", "startsWith", "endsWith", "eq", "neq", "isNull", "isNotNull",
    ]);
    expect(crmOperatorsForField(leadAdvancedField("createdAt"))).toEqual([
      "gt", "gte", "lt", "lte", "between",
    ]);
  });

  it("always compiles Lead Type with its implicit equality operator", () => {
    expect(
      bodyFor(advanced({ conditions: [leaf("leadType", "neq", "INDIVIDUAL")] }))
        .filterTree,
    ).toEqual({ field: "leadProfileType", operator: "eq", value: "INDIVIDUAL" });
  });

  it("omits array-only or duplicate aliases and appends null checks only when nullable", () => {
    const nullableText = crmOperatorsFor("text", true);
    expect(nullableText).toEqual([
      ...crmOperatorsFor("text", false), "isNull", "isNotNull",
    ]);
    expect(nullableText).not.toEqual(expect.arrayContaining(["any", "eqAny", "neqAny"]));
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
      const operators = crmOperatorsForField(field);
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
    ]);
  });

  it("cannot produce a leaf outside the whitelist, on any field or operator", () => {
    for (const field of LEAD_ADVANCED_FIELDS) {
      for (const operator of crmOperatorsForField(field)) {
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
  it("starts on one group with its Key deliberately unselected", () => {
    expect(EMPTY_LEAD_SEARCH.groups).toEqual([
      {
        conditions: [
          {
            field: DEFAULT_LEAD_ADVANCED_FIELD.id,
            fieldSelected: false,
            operator: "eq",
            value: "",
            valueTo: "",
          },
        ],
      },
    ]);
  });

  it("replaces the groups wholesale, which is all the card ever does", () => {
    const groups: LeadSearchGroup[] = [{ conditions: [leaf("status", "eq", "OPEN")] }];
    expect(leadSearchWithGroups(EMPTY_LEAD_SEARCH, groups).groups).toBe(groups);
  });

  it("turns an AND row into an OR group and compiles a real OR payload", () => {
    const groups: LeadSearchGroup[] = [{
      conditions: [
        leaf("status", "eq", "OPEN"),
        leaf("leadType", "eq", "CORPORATE"),
      ],
    }];
    const next = crmGroupsWithConnector(groups, 0, 1, "OR");

    expect(bodyFor(advanced(...next)).filterTree).toEqual({
      op: "OR",
      children: [
        { field: "status", operator: "eq", value: "OPEN" },
        { field: "leadProfileType", operator: "eq", value: "CORPORATE" },
      ],
    });
  });

  it("turns an OR row back into AND without losing either condition", () => {
    const groups: LeadSearchGroup[] = [
      { conditions: [leaf("status", "eq", "OPEN")] },
      { conditions: [leaf("leadType", "eq", "CORPORATE")] },
    ];
    const next = crmGroupsWithConnector(groups, 1, 0, "AND");

    expect(bodyFor(advanced(...next)).filterTree).toEqual({
      op: "AND",
      children: [
        { field: "status", operator: "eq", value: "OPEN" },
        { field: "leadProfileType", operator: "eq", value: "CORPORATE" },
      ],
    });
  });
});
