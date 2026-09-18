import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_SEARCH } from "./lead-search-contract";
import {
  buildLeadBoardRequest,
  LEAD_BOARD_STAGE_LIMIT,
} from "./lead-board-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000001";
const ACTOR_ID = "01900100-0000-7000-8000-000000000002";
describe("Lead board request contract", () => {
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
