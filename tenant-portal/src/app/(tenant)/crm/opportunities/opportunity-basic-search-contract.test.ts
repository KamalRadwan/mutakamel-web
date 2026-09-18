import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPPORTUNITY_BASIC_SEARCH,
  EMPTY_OPPORTUNITY_BASIC_SEARCH,
  MAX_OPPORTUNITY_SEARCH_TAGS,
  OPPORTUNITY_SEARCH_FIELDS,
  addOpportunityBasicFilter,
  appendOpportunityBasicQuery,
  compileOpportunityBasicSearch,
  removeOpportunityBasicFilter,
  type OpportunityBasicSearch,
} from "./opportunity-basic-search-contract";

const ACTOR = "01900100-0000-7000-8000-000000000001";
const TAG = "01900100-0000-7000-8000-000000000002";
const SECOND_TAG = "01900100-0000-7000-8000-000000000003";
const PIPELINE = "01900100-0000-7000-8000-000000000004";
const STAGE = "01900100-0000-7000-8000-000000000005";

describe("Basic opportunity search contract", () => {
  it("defaults to the authenticated salesperson and clears that scope explicitly", () => {
    expect(compileOpportunityBasicSearch(DEFAULT_OPPORTUNITY_BASIC_SEARCH, ACTOR)).toEqual({
      ownerUserId: ACTOR,
      tagIds: [],
    });
    expect(
      compileOpportunityBasicSearch(
        removeOpportunityBasicFilter(DEFAULT_OPPORTUNITY_BASIC_SEARCH, "my-opportunities"),
        ACTOR,
      ).ownerUserId,
    ).toBeUndefined();
  });

  it("cannot silently broaden My Opportunities without an authenticated actor", () => {
    expect(() => compileOpportunityBasicSearch(DEFAULT_OPPORTUNITY_BASIC_SEARCH)).toThrow(
      "authenticated user",
    );
  });

  it.each(OPPORTUNITY_SEARCH_FIELDS.filter(({ kind }) => kind === "text"))(
    "sends the exact semantic searchField for $id",
    (field) => {
      const basic = addOpportunityBasicFilter(DEFAULT_OPPORTUNITY_BASIC_SEARCH, {
        field: field.id,
        value: "  01050049899  ",
      });
      expect(compileOpportunityBasicSearch(basic, ACTOR)).toEqual({
        search: "01050049899",
        searchField: field.searchField,
        ownerUserId: ACTOR,
        tagIds: [],
      });
    },
  );

  it("combines structured chips and preserves repeated tags", () => {
    const basic: OpportunityBasicSearch = {
      myOpportunities: true,
      text: "",
      filters: [
        { field: "status", value: "IN_PROGRESS" },
        { field: "stageFlag", value: "PROPOSAL" },
        { field: "tag", value: TAG },
        { field: "tag", value: SECOND_TAG },
      ],
    };
    const query = appendOpportunityBasicQuery(new URLSearchParams(), basic, ACTOR);
    expect(query.get("status")).toBe("IN_PROGRESS");
    expect(query.get("stageFlag")).toBe("PROPOSAL");
    expect(query.get("ownerUserId")).toBe(ACTOR);
    expect(query.getAll("tagIds")).toEqual([TAG, SECOND_TAG]);
  });

  it("compiles pipeline and stage chips, and can omit route-owned scope keys", () => {
    const basic: OpportunityBasicSearch = {
      myOpportunities: false,
      text: "",
      filters: [
        { field: "pipeline", value: PIPELINE },
        { field: "stage", value: STAGE },
      ],
    };
    const query = appendOpportunityBasicQuery(new URLSearchParams(), basic, ACTOR);
    expect(query.get("pipelineId")).toBe(PIPELINE);
    expect(query.get("stageId")).toBe(STAGE);

    const boardQuery = appendOpportunityBasicQuery(
      new URLSearchParams(),
      basic,
      ACTOR,
      { includePipeline: false, includeStage: false },
    );
    expect(boardQuery.has("pipelineId")).toBe(false);
    expect(boardQuery.has("stageId")).toBe(false);
  });

  it("replaces the semantic term and single-valued enums without dropping other chips", () => {
    const withStatus = addOpportunityBasicFilter(DEFAULT_OPPORTUNITY_BASIC_SEARCH, {
      field: "status",
      value: "IN_PROGRESS",
    });
    const withTitle = addOpportunityBasicFilter(withStatus, {
      field: "opportunity",
      value: "Renewal",
    });
    const withPhone = addOpportunityBasicFilter(withTitle, {
      field: "phone",
      value: "01050049899",
    });
    const replacedStatus = addOpportunityBasicFilter(withPhone, {
      field: "status",
      value: "ON_HOLD",
    });
    expect(replacedStatus.filters).toEqual([
      { field: "phone", value: "01050049899" },
      { field: "status", value: "ON_HOLD" },
    ]);
  });

  it("rejects invalid enum/tag values and caps the tag chip count", () => {
    expect(() =>
      addOpportunityBasicFilter(EMPTY_OPPORTUNITY_BASIC_SEARCH, {
        field: "status",
        value: "OPEN",
      }),
    ).toThrow();
    expect(() =>
      addOpportunityBasicFilter(EMPTY_OPPORTUNITY_BASIC_SEARCH, {
        field: "tag",
        value: "not-a-tag-id",
      }),
    ).toThrow();

    const full: OpportunityBasicSearch = {
      myOpportunities: false,
      text: "",
      filters: Array.from({ length: MAX_OPPORTUNITY_SEARCH_TAGS }, (_, index) => ({
        field: "tag" as const,
        value: `01900100-0000-7000-8000-${index.toString(16).padStart(12, "0")}`,
      })),
    };
    expect(
      addOpportunityBasicFilter(full, {
        field: "tag",
        value: "01900100-0000-7000-8000-ffffffffffff",
      }),
    ).toBe(full);
  });
});
