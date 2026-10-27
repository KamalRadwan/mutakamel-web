import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_SEARCH } from "./lead-search-contract";
import {
  buildLeadBoardRequest,
  buildLeadInitialBoardRequest,
  buildLeadKpisRequest,
  LEAD_BOARD_STAGE_LIMIT,
} from "./lead-board-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000001";
const ACTOR_ID = "01900100-0000-7000-8000-000000000002";
describe("Lead board request contract", () => {
  it.each(["basic", "advanced"] as const)("sends only consumed options for %s board and KPI reads", (mode) => {
    const search = { ...DEFAULT_LEAD_SEARCH, mode, kpiPreset: "OVERDUE_ACTIVITY" as const };
    const window = { branchId: BRANCH_ID, page: 2, limit: 50, sortBy: "createdAt", sortDir: "DESC" } as const;
    const stage = buildLeadBoardRequest(search, window, ACTOR_ID);
    const initial = buildLeadInitialBoardRequest(search, window, ACTOR_ID);
    const kpis = buildLeadKpisRequest(search, window, ACTOR_ID);
    expect({ ...initial, page: 2 }).toEqual(stage);
    expect(initial).not.toHaveProperty("page");
    expect({ ...kpis, page: 2, limit: 50, sort: "createdAt:DESC" }).toEqual(stage);
    for (const key of ["page", "limit", "sort", "withDeleted", "relations", "select", "addSelect"]) {
      expect(kpis).not.toHaveProperty(key);
    }
    expect(kpis).toHaveProperty("hasOverdueActivity", true);
  });

  it.each(["basic", "advanced"] as const)("keeps overdue as a sibling filter on both %s board pages", (mode) => {
    for (const page of [1, 2]) {
      const base = {
        ...DEFAULT_LEAD_SEARCH, mode,
        basic: { myLeads: true, filters: [
          { field: "email" as const, value: "buyer@example.com" },
          { field: "tag" as const, value: BRANCH_ID },
        ] },
        groups: [{ conditions: [{ field: "status" as const, operator: "eq" as const, value: "OPEN", valueTo: "" }] }],
      };
      const window = { branchId: BRANCH_ID, page, limit: 50, sortBy: "createdAt", sortDir: "DESC" } as const;
      const unfiltered = buildLeadBoardRequest(base, window, ACTOR_ID);
      expect(buildLeadBoardRequest({ ...base, kpiPreset: "OVERDUE_ACTIVITY" }, window, ACTOR_ID))
        .toEqual({ ...unfiltered, hasOverdueActivity: true });
      expect(unfiltered).not.toHaveProperty("hasOverdueActivity");
    }
  });

  it("keeps the preset, text, tags and owner on initial and subsequent Basic board reads", () => {
    for (const page of [1, 2]) {
      const request = buildLeadBoardRequest({
        ...DEFAULT_LEAD_SEARCH,
        kpiPreset: "HOT_3_STAR",
        basic: { myLeads: true, filters: [
          { field: "email", value: "buyer@example.com" },
          { field: "tag", value: BRANCH_ID },
        ] },
      }, { branchId: BRANCH_ID, page, limit: 50, sortBy: "createdAt", sortDir: "DESC" }, ACTOR_ID);
      expect(request).toEqual({
        branchId: BRANCH_ID, page, limit: 50, sort: "createdAt:DESC",
        search: "buyer@example.com", searchField: "email", tagIds: [BRANCH_ID],
        filterTree: { op: "AND", children: [
          { field: "ownerUserId", operator: "eq", value: ACTOR_ID },
          { field: "rating", operator: "eq", value: 3 },
        ] },
      });
    }
  });

  it("ANDs a preset around the entire Advanced OR tree", () => {
    const request = buildLeadBoardRequest({
      ...DEFAULT_LEAD_SEARCH, mode: "advanced", kpiPreset: "QUALIFIED",
      groups: [
        { conditions: [{ field: "rating", operator: "eq", value: "1", valueTo: "" }] },
        { conditions: [{ field: "rating", operator: "eq", value: "3", valueTo: "" }] },
      ],
    }, { branchId: BRANCH_ID, page: 2, limit: 50, sortBy: "createdAt", sortDir: "DESC" });
    expect(request.filterTree).toEqual({ op: "AND", children: [
      { op: "OR", children: [
        { field: "rating", operator: "eq", value: 1 },
        { field: "rating", operator: "eq", value: 3 },
      ] },
      { field: "stageFlag", operator: "eq", value: "QUALIFIED" },
    ] });
  });

  it("keeps My Leads and forces one stage into a 50-record lane", () => {
    const request = buildLeadBoardRequest(
      DEFAULT_LEAD_SEARCH,
      {
        branchId: BRANCH_ID,
        page: 1,
        limit: LEAD_BOARD_STAGE_LIMIT,
        sortBy: "createdAt",
        sortDir: "DESC",
      },
      ACTOR_ID,
    );

    expect(request).toMatchObject({
      branchId: BRANCH_ID,
      page: 1,
      limit: 50,
      sort: "createdAt:DESC",
      filterTree: { field: "ownerUserId", operator: "eq", value: ACTOR_ID },
    });
  });

  it("ANDs the lane stage around the submitted Advanced tree", () => {
    const request = buildLeadBoardRequest(
      {
        ...DEFAULT_LEAD_SEARCH,
        mode: "advanced",
        groups: [{
          conditions: [{
            field: "status",
            operator: "eq",
            value: "OPEN",
            valueTo: "",
          }],
        }],
      },
      {
        branchId: BRANCH_ID,
        page: 2,
        limit: 50,
        sortBy: "displayName",
        sortDir: "ASC",
      },
    );

    expect(request.filterTree).toEqual({ field: "status", operator: "eq", value: "OPEN" });
    expect(request.page).toBe(2);
  });
});
