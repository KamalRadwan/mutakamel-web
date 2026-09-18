import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_PROFILE_SEARCH,
  customerProfileSearchWithField,
} from "./customer-profile-search-contract";
import {
  buildCustomerProfileBoardRequest,
  CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
} from "./customer-profile-board-contract";
import {
  CUSTOMER_PROFILE_BOARD_STATUSES,
  parseCustomerProfileBoardLane,
  parseCustomerProfileBoardResponse,
} from "./hooks/useCustomerProfileBoard";

const BRANCH_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b4";
const USER_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b7";

function lane(status: (typeof CUSTOMER_PROFILE_BOARD_STATUSES)[number]) {
  return {
    status,
    items: [],
    total: 0,
    page: 1,
    limit: CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
}

describe("customer profile board contract", () => {
  it("requests 50 records per status and applies My Customers", () => {
    expect(
      buildCustomerProfileBoardRequest(
        DEFAULT_CUSTOMER_PROFILE_SEARCH,
        {
          branchId: BRANCH_ID,
          page: 1,
          limit: CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
          sortBy: "createdAt",
          sortDir: "DESC",
        },
        USER_ID,
      ),
    ).toEqual({
      branchId: BRANCH_ID,
      filterTree: { field: "ownerUserId", operator: "eq", value: USER_ID },
      sort: "createdAt:DESC",
      page: 1,
      limit: 50,
    });
  });

  it("removes a Basic status token from the fixed Board lanes without mutating the search", () => {
    const search = customerProfileSearchWithField(
      DEFAULT_CUSTOMER_PROFILE_SEARCH,
      "status",
      "ACTIVE_CUSTOMER",
    );
    expect(
      buildCustomerProfileBoardRequest(
        search,
        {
          branchId: BRANCH_ID,
          page: 1,
          limit: 50,
          sortBy: "displayName",
          sortDir: "ASC",
        },
        USER_ID,
      ).filterTree,
    ).toEqual({ field: "ownerUserId", operator: "eq", value: USER_ID });
    expect(search.basic.filters).toEqual([
      { field: "status", value: "ACTIVE_CUSTOMER" },
    ]);
  });

  it("removes Advanced status conditions while preserving the rest of the tree", () => {
    const search = {
      ...DEFAULT_CUSTOMER_PROFILE_SEARCH,
      mode: "advanced" as const,
      groups: [
        {
          conditions: [
            {
              field: "status" as const,
              operator: "eq" as const,
              value: "ACTIVE_CUSTOMER",
              valueTo: "",
            },
            {
              field: "description" as const,
              operator: "ilike" as const,
              value: "hospital",
              valueTo: "",
            },
          ],
        },
      ],
    };

    expect(
      buildCustomerProfileBoardRequest(search, {
        branchId: BRANCH_ID,
        page: 2,
        limit: CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
        sortBy: "createdAt",
        sortDir: "DESC",
      }),
    ).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        field: "description",
        operator: "ilike",
        value: "hospital",
      },
      sort: "createdAt:DESC",
      page: 2,
      limit: 50,
    });
    expect(search.groups[0]?.conditions.map(({ field }) => field)).toEqual([
      "status",
      "description",
    ]);
  });

  it("parses all four authoritative status lanes", () => {
    const parsed = parseCustomerProfileBoardResponse(
      { statuses: CUSTOMER_PROFILE_BOARD_STATUSES.map(lane) },
      BRANCH_ID,
    );
    expect(Object.keys(parsed)).toEqual([...CUSTOMER_PROFILE_BOARD_STATUSES]);
    expect(parsed.ACTIVE_CUSTOMER).toEqual({
      items: [],
      total: 0,
      page: 1,
      hasMore: false,
    });
  });

  it("rejects missing, duplicate, and mismatched status lanes", () => {
    expect(() =>
      parseCustomerProfileBoardResponse(
        { statuses: CUSTOMER_PROFILE_BOARD_STATUSES.slice(0, 3).map(lane) },
        BRANCH_ID,
      ),
    ).toThrow("Invalid customer profile board response.");
    expect(() =>
      parseCustomerProfileBoardResponse(
        {
          statuses: [
            lane("PROSPECT"),
            lane("PROSPECT"),
            lane("INACTIVE"),
            lane("BLACKLISTED"),
          ],
        },
        BRANCH_ID,
      ),
    ).toThrow("Invalid customer profile board response.");
    expect(() =>
      parseCustomerProfileBoardLane(
        lane("INACTIVE"),
        BRANCH_ID,
        "ACTIVE_CUSTOMER",
      ),
    ).toThrow("Invalid customer profile board response.");
  });
});
