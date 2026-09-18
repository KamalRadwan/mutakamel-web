import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_BASIC_SEARCH,
  EMPTY_LEAD_BASIC_SEARCH,
  LEAD_SEARCH_FIELDS,
  MAX_LEAD_SEARCH_TAGS,
  addLeadBasicFilter,
  buildLeadBasicSearchRequest,
  buildLeadsListQuery,
  leadBasicSearchNeedsPost,
  removeLeadBasicFilter,
  type LeadBasicSearch,
} from "./lead-basic-search-contract";
import { DEFAULT_LEAD_SEARCH, leadSearchValuesOf, leadSearchWithField } from "./lead-search-contract";

const ACTOR = "01900100-0000-7000-8000-000000000001";
const STAGE = "01900100-0000-7000-8000-000000000002";
const SOURCE = "01900100-0000-7000-8000-000000000003";
const TAG = "01900100-0000-7000-8000-000000000004";
const window = { branchId: STAGE, page: 2, limit: 50, sortBy: "createdAt", sortDir: "DESC" } as const;
const query = (basic: LeadBasicSearch) => buildLeadsListQuery({ basic, actorId: ACTOR, ...window });

describe("Basic lead search server contract", () => {
  it("defaults to the authenticated owner and removes that constraint only when cleared", () => {
    expect(query(DEFAULT_LEAD_BASIC_SEARCH).get("ownerUserId")).toBe(ACTOR);
    expect(query(removeLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, "my-leads")).has("ownerUserId")).toBe(false);
    expect(query(EMPTY_LEAD_BASIC_SEARCH).size).toBe(5);
  });

  it("cannot silently broaden My Leads when the actor is unavailable", () => {
    expect(() => buildLeadsListQuery({ basic: DEFAULT_LEAD_BASIC_SEARCH, ...window })).toThrow("authenticated user");
    expect(() => buildLeadBasicSearchRequest(DEFAULT_LEAD_BASIC_SEARCH, window, "bad-id")).toThrow("authenticated user");
  });

  it.each(LEAD_SEARCH_FIELDS.filter((field) => field.kind !== "text" && field.kind !== "tag"))(
    "sends the supported wire key for $id alongside My Leads",
    (field) => {
      const value = field.values?.[0] ?? STAGE;
      const result = query(addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: field.id, value }));
      expect(result.get(field.key)).toBe(value);
      expect(result.get("ownerUserId")).toBe(ACTOR);
      expect(result.size).toBe(7);
    },
  );

  it.each(LEAD_SEARCH_FIELDS.filter((field) => field.kind === "text"))(
    "sends search plus exact searchField for $id",
    (field) => {
      const result = query(addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: field.id, value: "Mona" }));
      expect(result.get("search")).toBe("Mona");
      expect(result.get("searchField")).toBe(field.searchField);
      expect(result.get("ownerUserId")).toBe(ACTOR);
      expect(result.size).toBe(8);
    },
  );

  it("ANDs different fields and ORs repeated field values before pagination", () => {
    const basic: LeadBasicSearch = { myLeads: true, filters: [
      { field: "status", value: "OPEN" },
      { field: "status", value: "ON_HOLD" },
      { field: "stage", value: STAGE },
      { field: "source", value: SOURCE },
      { field: "customer", value: " Mona " },
    ] };
    expect(leadBasicSearchNeedsPost(basic)).toBe(true);
    expect(() => query(basic)).toThrow("search endpoint");
    expect(buildLeadBasicSearchRequest(basic, window, ACTOR)).toEqual({
      branchId: STAGE,
      page: 2,
      limit: 50,
      sort: "createdAt:DESC",
      search: "Mona",
      searchField: "customer",
      filterTree: { op: "AND", children: [
        { field: "status", operator: "in", value: ["OPEN", "ON_HOLD"] },
        { field: "stageId", operator: "eq", value: STAGE },
        { field: "acquisitionSourceId", operator: "eq", value: SOURCE },
        { field: "ownerUserId", operator: "eq", value: ACTOR },
      ] },
    });
    expect(leadBasicSearchNeedsPost(removeLeadBasicFilter(basic, "status:ON_HOLD"))).toBe(false);
  });

  it("uses the read-only POST tagIds contract and keeps tag alternatives as OR", () => {
    const secondTag = "01900100-0000-7000-8000-000000000005";
    const basic: LeadBasicSearch = { myLeads: true, filters: [
      { field: "tag", value: TAG },
      { field: "tag", value: secondTag },
    ] };
    expect(leadBasicSearchNeedsPost(basic)).toBe(true);
    expect(buildLeadBasicSearchRequest(basic, window, ACTOR)).toEqual({
      branchId: STAGE,
      page: 2,
      limit: 50,
      sort: "createdAt:DESC",
      tagIds: [TAG, secondTag],
      filterTree: { field: "ownerUserId", operator: "eq", value: ACTOR },
    });
  });

  it("trims, caps and replaces semantic text while retaining structured filters", () => {
    const initial = addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: "status", value: "OPEN" });
    const first = addLeadBasicFilter(initial, { field: "lead", value: "first" });
    const next = addLeadBasicFilter(first, { field: "phone", value: `  ${"1".repeat(250)}  ` });
    expect(next.filters).toEqual([
      { field: "status", value: "OPEN" },
      { field: "phone", value: "1".repeat(200) },
    ]);
    expect(next.myLeads).toBe(true);
  });

  it("deduplicates selections, ignores empty values and stops at the tag ceiling", () => {
    const initial = addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: "status", value: "OPEN" });
    expect(addLeadBasicFilter(initial, { field: "status", value: "OPEN" })).toBe(initial);
    expect(addLeadBasicFilter(initial, { field: "source", value: "  " })).toBe(initial);

    const tags = Array.from({ length: MAX_LEAD_SEARCH_TAGS }, (_, index) => ({
      field: "tag" as const,
      value: `01900100-0000-7000-8000-${index.toString(16).padStart(12, "0")}`,
    }));
    const full: LeadBasicSearch = { myLeads: false, filters: tags };
    expect(addLeadBasicFilter(full, {
      field: "tag",
      value: "01900100-0000-7000-8000-ffffffffffff",
    })).toBe(full);
  });

  it("rejects unsupported enums, catalogue ids and fabricated multiple text predicates", () => {
    expect(() => addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: "status", value: "open" })).toThrow();
    expect(() => addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: "stage", value: "New" })).toThrow();
    expect(() => buildLeadBasicSearchRequest({ myLeads: false, filters: [
      { field: "lead", value: "one" },
      { field: "phone", value: "two" },
    ] }, window)).toThrow("Only one semantic");
  });

  it("stage-strip selection and All preserve owner and other filters", () => {
    const initial = {
      ...DEFAULT_LEAD_SEARCH,
      basic: addLeadBasicFilter(DEFAULT_LEAD_BASIC_SEARCH, { field: "status", value: "OPEN" }),
    };
    const selected = leadSearchWithField(initial, "stage", STAGE);
    expect(leadSearchValuesOf(selected, "stage")).toEqual([STAGE]);
    expect(leadSearchWithField(selected, "stage", "").basic).toEqual(initial.basic);
    const multi = { ...selected, basic: addLeadBasicFilter(selected.basic, { field: "stage", value: SOURCE }) };
    expect(leadSearchValuesOf(multi, "stage")).toEqual([STAGE, SOURCE]);
    expect(leadSearchWithField(multi, "stage", STAGE).basic).toEqual(selected.basic);
  });
});
