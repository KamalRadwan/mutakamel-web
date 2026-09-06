import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPPORTUNITY_ADVANCED_FIELD,
  EMPTY_OPPORTUNITY_SEARCH,
  OPPORTUNITY_ADVANCED_FIELDS,
  OPPORTUNITY_FILTERABLE_FIELDS,
  OPPORTUNITY_LIST_QUERY_KEYS,
  buildOpportunitiesListQuery,
  buildOpportunitySearchRequest,
  opportunityAdvancedField,
  opportunitySearchCleared,
  opportunitySearchWithBasicText,
  opportunitySearchWithGroups,
  opportunitySearchWithMode,
  opportunitySearchWithText,
  type OpportunityAdvancedFieldId,
  type OpportunitySearchGroup,
  type OpportunitySearchState,
} from "./opportunity-search-contract";
import {
  crmOperatorsFor,
  type CrmFilterLeaf,
  type CrmFilterOperator,
  type CrmFilterTreeNode,
  type CrmSearchCondition,
} from "../shared/search/filter-tree";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const PIPELINE_ID = "01900100-0000-7000-8000-000000000100";
const STAGE_ID = "01900100-0000-7000-8000-000000000101";

const LIST_WINDOW = {
  branchId: BRANCH_ID,
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortDir: "DESC",
} as const;

/** One condition of the card, with `between`'s upper bound left blank. */
function leaf(
  field: OpportunityAdvancedFieldId,
  operator: CrmFilterOperator,
  value = "",
  valueTo = "",
): CrmSearchCondition<OpportunityAdvancedFieldId> {
  return { field, operator, value, valueTo };
}

/** Advanced mode, with the groups the card would have built. */
function advanced(...groups: OpportunitySearchGroup[]): OpportunitySearchState {
  return { ...EMPTY_OPPORTUNITY_SEARCH, mode: "advanced", groups };
}

function queryFor(
  search: OpportunitySearchState,
  pipelineId: string | null = null,
  stageId: string | null = null,
): string {
  return buildOpportunitiesListQuery({
    ...LIST_WINDOW,
    pipelineId,
    stageId,
    search,
  }).toString();
}

function bodyFor(search: OpportunitySearchState) {
  return buildOpportunitySearchRequest(search, LIST_WINDOW);
}

/** Every leaf in a compiled tree, whatever its shape. */
function leaves(node: CrmFilterTreeNode | undefined): CrmFilterLeaf[] {
  if (!node) return [];
  if ("children" in node) return node.children.flatMap(leaves);
  return [node];
}

const UNFILTERED = `branchId=${BRANCH_ID}&page=1&limit=25&sortBy=createdAt&sortDir=DESC`;

/* ------------------------------ basic mode ------------------------------ */

describe("buildOpportunitiesListQuery — the query string the table already sent", () => {
  // The exact string the hook used to build inline. It is asserted whole
  // rather than key by key because crm-app validates with
  // forbidNonWhitelisted: an extra or misspelled key is a hard 400 on every
  // list open, not a parameter the server quietly ignores.
  it("keeps the pipeline and stage the workspace's own selectors hold", () => {
    expect(queryFor(EMPTY_OPPORTUNITY_SEARCH, PIPELINE_ID, STAGE_ID)).toBe(
      `${UNFILTERED}&pipelineId=${PIPELINE_ID}&stageId=${STAGE_ID}`,
    );
  });

  it("omits stageId entirely for All rather than sending it empty", () => {
    expect(queryFor(EMPTY_OPPORTUNITY_SEARCH, PIPELINE_ID, null)).toBe(
      `${UNFILTERED}&pipelineId=${PIPELINE_ID}`,
    );
  });

  it("omits pipelineId too, which is how the server is asked for every one", () => {
    expect(queryFor(EMPTY_OPPORTUNITY_SEARCH, null, null)).toBe(UNFILTERED);
  });
});

describe("buildOpportunitiesListQuery — the free-text term", () => {
  it("sends the term as `search`, which is the only key it may use", () => {
    const state = opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "renewal");
    expect(queryFor(state)).toBe(`${UNFILTERED}&search=renewal`);
  });

  it("trims, because a value of spaces is not a search", () => {
    const state = opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "  renewal  ");
    expect(queryFor(state)).toBe(`${UNFILTERED}&search=renewal`);
  });

  it("sends no key at all for a blank term", () => {
    expect(queryFor(opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "   "))).toBe(
      UNFILTERED,
    );
  });

  it("clamps at the wire's 200 characters instead of earning a 400", () => {
    const query = buildOpportunitiesListQuery({
      ...LIST_WINDOW,
      pipelineId: null,
      stageId: null,
      search: opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "a".repeat(250)),
    });
    expect(query.get("search")).toHaveLength(200);
  });

  // The card's groups belong to the OTHER endpoint. A basic request must not
  // pick anything up from them, however much a mode switch left behind.
  it("ignores the advanced groups and the advanced text entirely", () => {
    const state: OpportunitySearchState = {
      ...advanced({ conditions: [leaf("status", "eq", "IN_PROGRESS")] }),
      mode: "basic",
      text: "renewal",
    };
    expect(queryFor(state)).toBe(UNFILTERED);
  });
});

describe("buildOpportunitiesListQuery — the accepted key surface", () => {
  it("never produces a key outside the documented eight", () => {
    const searches: OpportunitySearchState[] = [
      EMPTY_OPPORTUNITY_SEARCH,
      opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "renewal"),
      advanced({ conditions: [leaf("status", "eq", "IN_PROGRESS")] }),
    ];

    for (const search of searches) {
      const query = buildOpportunitiesListQuery({
        ...LIST_WINDOW,
        pipelineId: PIPELINE_ID,
        stageId: STAGE_ID,
        search,
      });
      for (const key of query.keys()) {
        expect(OPPORTUNITY_LIST_QUERY_KEYS).toContain(key);
      }
    }
    expect(OPPORTUNITY_LIST_QUERY_KEYS).toHaveLength(8);
  });
});

/* ---------------------------- state transitions --------------------------- */

describe("opportunity search modes", () => {
  it("is a no-op on the mode already selected", () => {
    const state = opportunitySearchWithBasicText(EMPTY_OPPORTUNITY_SEARCH, "renewal");
    expect(opportunitySearchWithMode(state, "basic")).toBe(state);
  });

  // The two modes speak different wires. Neither half is translated into the
  // other, and that is visible in a way a silent partial translation is not.
  it("keeps both halves intact and swaps only the mode", () => {
    const state = opportunitySearchWithText(
      advanced({ conditions: [leaf("status", "eq", "IN_PROGRESS")] }),
      "renewal",
    );
    const next = opportunitySearchWithMode(state, "basic");
    expect(next.mode).toBe("basic");
    expect(next.groups).toBe(state.groups);
    expect(next.text).toBe("renewal");
  });
});

describe("advanced reset", () => {
  it("clears the text and the groups without leaving advanced mode", () => {
    const state = opportunitySearchWithText(
      advanced(
        { conditions: [leaf("status", "eq", "IN_PROGRESS")] },
        { conditions: [leaf("stageFlag", "eq", "PROPOSAL")] },
      ),
      "renewal",
    );
    const next = opportunitySearchCleared(state);
    expect(next.mode).toBe("advanced");
    expect(next.text).toBe("");
    expect(next.groups).toEqual(EMPTY_OPPORTUNITY_SEARCH.groups);
    expect(bodyFor(next).filterTree).toBeUndefined();
  });
});

/* --------------------------- the filter tree ---------------------------- */

describe("buildOpportunitySearchRequest — the shape of the body", () => {
  it("sends the branch, the sort pair and the page window, and nothing else", () => {
    expect(bodyFor(EMPTY_OPPORTUNITY_SEARCH)).toEqual({
      branchId: BRANCH_ID,
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  it("omits `filterTree` and `search` rather than sending them empty", () => {
    const body = bodyFor(advanced({ conditions: [leaf("status", "eq", "  ")] }));
    expect("filterTree" in body).toBe(false);
    expect("search" in body).toBe(false);
  });

  it("carries the free text, clamped at the wire's 200 characters", () => {
    const state = opportunitySearchWithText(
      EMPTY_OPPORTUNITY_SEARCH,
      `  ${"a".repeat(250)}  `,
    );
    expect(bodyFor(state).search).toHaveLength(200);
  });

  // Fact 5 in the contract's header: the POST has no pipeline key, so an
  // advanced result set is scoped by the body's branch and by whatever the
  // user put in the tree — never by the workspace's pipeline picker.
  it("names no pipeline of its own, whatever the workspace has selected", () => {
    expect("pipelineId" in bodyFor(EMPTY_OPPORTUNITY_SEARCH)).toBe(false);
  });
});

describe("buildOpportunitySearchRequest — groups compile to AND inside, OR between", () => {
  // `(status = IN_PROGRESS AND stageFlag = PROPOSAL) OR (createdAt >= 2026-01-01)`,
  // the exact tree the route's own OpenAPI example documents.
  it("wraps two OR groups of two ANDed leaves, and nothing more", () => {
    const state = advanced(
      {
        conditions: [
          leaf("status", "eq", "IN_PROGRESS"),
          leaf("stageFlag", "eq", "PROPOSAL"),
        ],
      },
      {
        conditions: [
          leaf("createdAt", "gte", "2026-01-01"),
          leaf("pipeline", "eq", PIPELINE_ID),
        ],
      },
    );

    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        {
          op: "AND",
          children: [
            { field: "status", operator: "eq", value: "IN_PROGRESS" },
            { field: "stageFlag", operator: "eq", value: "PROPOSAL" },
          ],
        },
        {
          op: "AND",
          children: [
            { field: "createdAt", operator: "gte", value: "2026-01-01" },
            { field: "pipelineId", operator: "eq", value: PIPELINE_ID },
          ],
        },
      ],
    });
  });

  // Depth is capped at 5, so a wrapper that says nothing is a level spent on
  // nothing. A lone leaf is the whole tree.
  it("never wraps a single condition in a pointless AND node", () => {
    expect(
      bodyFor(advanced({ conditions: [leaf("status", "eq", "WON")] })).filterTree,
    ).toEqual({ field: "status", operator: "eq", value: "WON" });
  });

  it("collapses a single-condition group inside an OR, but keeps the OR", () => {
    const state = advanced(
      {
        conditions: [
          leaf("status", "eq", "IN_PROGRESS"),
          leaf("stageFlag", "eq", "PROPOSAL"),
        ],
      },
      { conditions: [leaf("createdAt", "gte", "2026-01-01")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        {
          op: "AND",
          children: [
            { field: "status", operator: "eq", value: "IN_PROGRESS" },
            { field: "stageFlag", operator: "eq", value: "PROPOSAL" },
          ],
        },
        { field: "createdAt", operator: "gte", value: "2026-01-01" },
      ],
    });
  });
});

describe("buildOpportunitySearchRequest — the same field, twice", () => {
  // The restriction that used to forbid this was a fact about the query
  // string's one slot per key. A tree has a node per leaf.
  it("asks one field two ways inside one AND group", () => {
    const state = advanced({
      conditions: [leaf("amount", "gte", "1000"), leaf("amount", "lt", "5000")],
    });
    expect(bodyFor(state).filterTree).toEqual({
      op: "AND",
      children: [
        { field: "amount", operator: "gte", value: 1000 },
        { field: "amount", operator: "lt", value: 5000 },
      ],
    });
  });

  it("asks one field two ways across two OR groups", () => {
    const state = advanced(
      { conditions: [leaf("stageFlag", "eq", "PROPOSAL")] },
      { conditions: [leaf("stageFlag", "eq", "NEGOTIATION")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      op: "OR",
      children: [
        { field: "stageFlag", operator: "eq", value: "PROPOSAL" },
        { field: "stageFlag", operator: "eq", value: "NEGOTIATION" },
      ],
    });
  });
});

describe("buildOpportunitySearchRequest — a number is a JSON number", () => {
  // `requireNumberOrDate` accepts a numeric STRING as a date, so `amount >
  // "500"` would pass validation and then compare a numeric column against the
  // year 500. Nothing about the response would say so.
  it.each(["amount", "importance", "probabilityPercent"] as const)(
    "converts %s before it reaches the wire",
    (field) => {
      const [node] = leaves(bodyFor(advanced({ conditions: [leaf(field, "gt", "500")] })).filterTree);
      expect(node?.value).toBe(500);
      expect(typeof node?.value).toBe("number");
    },
  );

  it("converts both bounds of a numeric `between`", () => {
    const state = advanced({ conditions: [leaf("amount", "between", "1000", "5000")] });
    expect(bodyFor(state).filterTree).toEqual({
      field: "amount",
      operator: "between",
      value: [1000, 5000],
    });
  });

  it("converts every member of a numeric `in`", () => {
    const state = advanced({ conditions: [leaf("importance", "in", "1, 2, 3")] });
    expect(bodyFor(state).filterTree).toEqual({
      field: "importance",
      operator: "in",
      value: [1, 2, 3],
    });
  });

  // A date column keeps the picker's `YYYY-MM-DD` string: `requireNumberOrDate`
  // takes it, Postgres compares a timestamptz against it correctly, and
  // converting here would bake the browser's timezone into a date the user
  // picked in their own.
  it("leaves a date as the string the picker produced", () => {
    const [node] = leaves(
      bodyFor(advanced({ conditions: [leaf("expectedCloseDate", "lte", "2026-03-31")] }))
        .filterTree,
    );
    expect(node?.value).toBe("2026-03-31");
  });
});

describe("buildOpportunitySearchRequest — a blank condition is dropped", () => {
  // Every operator but the two null ones is `400 INVALID_OPERATOR_VALUE` on a
  // missing value, and a half-filled row must not fail the rest of the query.
  it("keeps the conditions around a blank one", () => {
    const state = advanced({
      conditions: [
        leaf("status", "eq", "IN_PROGRESS"),
        leaf("description", "ilike", "   "),
        leaf("stageFlag", "eq", "PROPOSAL"),
      ],
    });
    expect(leaves(bodyFor(state).filterTree).map((node) => node.field)).toEqual([
      "status",
      "stageFlag",
    ]);
  });

  it("drops a group whose every condition is blank, and the OR with it", () => {
    const state = advanced(
      { conditions: [leaf("status", "eq", "WON")] },
      { conditions: [leaf("stageFlag", "eq", ""), leaf("title", "ilike", " ")] },
    );
    expect(bodyFor(state).filterTree).toEqual({
      field: "status",
      operator: "eq",
      value: "WON",
    });
  });

  it("sends nothing at all when every group is blank", () => {
    const state = advanced(
      { conditions: [leaf("title", "ilike", "")] },
      { conditions: [leaf("amount", "gt", "  ")] },
    );
    expect("filterTree" in bodyFor(state)).toBe(false);
  });

  it("needs BOTH bounds before it will send a `between`", () => {
    const half = advanced({
      conditions: [leaf("expectedCloseDate", "between", "2026-01-01", "")],
    });
    expect(bodyFor(half).filterTree).toBeUndefined();

    const whole = advanced({
      conditions: [leaf("expectedCloseDate", "between", "2026-01-01", "2026-02-01")],
    });
    expect(bodyFor(whole).filterTree).toEqual({
      field: "expectedCloseDate",
      operator: "between",
      value: ["2026-01-01", "2026-02-01"],
    });
  });

  it("drops an `in` with nothing selected, and sends the rest as an array", () => {
    expect(
      bodyFor(advanced({ conditions: [leaf("status", "in", " , ")] })).filterTree,
    ).toBeUndefined();
    expect(
      bodyFor(advanced({ conditions: [leaf("status", "in", "WON, LOST")] })).filterTree,
    ).toEqual({ field: "status", operator: "in", value: ["WON", "LOST"] });
  });
});

describe("buildOpportunitySearchRequest — `isNull` carries no value", () => {
  // `OperatorCompiler.compile` returns `IsNull()` before it looks at `value`;
  // the two null operators are the only ones that may arrive without one, and
  // a `value: undefined` key would still be a key to anything inspecting the
  // body before it is serialised.
  it.each(["isNull", "isNotNull"] as const)("sends no `value` key for %s", (operator) => {
    const tree = bodyFor(advanced({ conditions: [leaf("amount", operator)] })).filterTree;
    expect(tree).toEqual({ field: "amount", operator });
    expect("value" in (tree as CrmFilterLeaf)).toBe(false);
  });

  it("keeps a valueless condition even though its value is blank", () => {
    const state = advanced({
      conditions: [leaf("status", "eq", "IN_PROGRESS"), leaf("owner", "isNull")],
    });
    expect(leaves(bodyFor(state).filterTree)).toHaveLength(2);
  });

  // Asking whether a NOT NULL column is empty is a question with one answer.
  it("offers the null operators on nullable columns only", () => {
    for (const field of OPPORTUNITY_ADVANCED_FIELDS) {
      const operators = crmOperatorsFor(field.kind, field.nullable ?? false);
      expect(operators.includes("isNull")).toBe(field.nullable === true);
      expect(operators.includes("isNotNull")).toBe(field.nullable === true);
    }
  });

  // Read straight off `OpportunityEntity`. A `nullable` that drifted would
  // either hide a real question or offer one with a single answer.
  it("marks exactly the columns the entity declares nullable", () => {
    const nullable = OPPORTUNITY_ADVANCED_FIELDS.filter((field) => field.nullable === true).map(
      (field) => field.field,
    );
    expect([...nullable].sort()).toEqual(
      [
        "amount",
        "contactPartyId",
        "currencyCode",
        "description",
        "expectedCloseDate",
        "leadId",
        "lostAt",
        "lostReason",
        "ownerUserId",
        "probabilityPercent",
        "stageFlag",
        "wonAt",
      ].sort(),
    );
  });
});

describe("buildOpportunitySearchRequest — the whitelist boundary", () => {
  // A field outside `OPPORTUNITY_FILTERABLE_FIELDS` is 400 INVALID_FIELD,
  // which reaches the screen as a failed load rather than an unavailable
  // filter.
  it("mirrors the repository's whitelist exactly", () => {
    expect(OPPORTUNITY_FILTERABLE_FIELDS).toEqual([
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
    ]);
  });

  it("cannot produce a leaf outside the whitelist, on any field or operator", () => {
    for (const field of OPPORTUNITY_ADVANCED_FIELDS) {
      for (const operator of crmOperatorsFor(field.kind, field.nullable ?? false)) {
        const state = advanced({
          conditions: [leaf(field.id, operator, "2026-01-01", "2026-02-01")],
        });
        for (const node of leaves(bodyFor(state).filterTree)) {
          expect(OPPORTUNITY_FILTERABLE_FIELDS).toContain(node.field);
        }
      }
    }
  });

  // The branch travels in the body and the tree is ANDed onto the scoped
  // query, so a `branchId` leaf could only restate the scope or empty the list.
  it("offers no condition that would name branchId", () => {
    expect(OPPORTUNITY_ADVANCED_FIELDS.map((field) => field.field)).not.toContain("branchId");
  });

  it("offers every other whitelisted column exactly once", () => {
    const offered = OPPORTUNITY_ADVANCED_FIELDS.map((field) => field.field);
    expect(new Set(offered).size).toBe(offered.length);
    expect([...offered].sort()).toEqual(
      OPPORTUNITY_FILTERABLE_FIELDS.filter((field) => field !== "branchId")
        .slice()
        .sort(),
    );
  });

  it("throws on a field id a cast smuggled past the picker", () => {
    expect(() =>
      opportunityAdvancedField("customerDisplayName" as OpportunityAdvancedFieldId),
    ).toThrow("Unknown opportunity filter field: customerDisplayName");
    expect(() =>
      bodyFor(
        advanced({
          conditions: [
            leaf("customerDisplayName" as OpportunityAdvancedFieldId, "eq", "acme"),
          ],
        }),
      ),
    ).toThrow("Unknown opportunity filter field: customerDisplayName");
  });

  // Fact 3 in the contract's header: these are projections the board and card
  // routes join in, not columns of `OpportunityEntity`. Neither the tree nor
  // the free-text box can reach them, and the table renders raw ids instead.
  it("offers no party-backed display column", () => {
    const offered = OPPORTUNITY_ADVANCED_FIELDS.map((field) => field.field);
    for (const column of [
      "customerDisplayName",
      "customerCompanyName",
      "contactDisplayName",
      "ownerDisplayName",
      "leadSourceName",
    ]) {
      expect(offered).not.toContain(column);
      expect(OPPORTUNITY_FILTERABLE_FIELDS).not.toContain(column);
    }
  });
});

describe("advanced group edits", () => {
  it("starts on one group holding one blank condition on the default field", () => {
    expect(EMPTY_OPPORTUNITY_SEARCH.groups).toEqual([
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
    ]);
  });

  it("replaces the groups wholesale, which is all the card ever does", () => {
    const groups: OpportunitySearchGroup[] = [
      { conditions: [leaf("status", "eq", "WON")] },
    ];
    expect(opportunitySearchWithGroups(EMPTY_OPPORTUNITY_SEARCH, groups).groups).toBe(groups);
  });
});
