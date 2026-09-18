import type { CrmSearchRequestBody } from "../shared/search/filter-tree";
import { buildCustomerProfileBasicSearchRequest } from "./customer-profile-basic-search-contract";
import {
  buildCustomerProfileSearchRequest,
  type CustomerProfileSearchState,
} from "./customer-profile-search-contract";
import type { CustomerProfileSearchWindow } from "./customer-profile-basic-search-contract";

export const CUSTOMER_PROFILE_BOARD_LANE_LIMIT = 50;

/**
 * Status is the Board's fixed grouping axis. Sending a selected status again
 * inside the caller's filter would AND it with every lane and make the other
 * three lanes look empty. Keep the draft intact for Card/Table while removing
 * only that axis from the Board request.
 */
function withoutBoardStatus(
  search: CustomerProfileSearchState,
): CustomerProfileSearchState {
  if (search.mode === "advanced") {
    return {
      ...search,
      groups: search.groups.map((group) => ({
        ...group,
        conditions: group.conditions.filter(
          (condition) => condition.field !== "status",
        ),
      })),
    };
  }

  return {
    ...search,
    basic: {
      ...search.basic,
      filters: search.basic.filters.filter(
        (filter) => filter.field !== "status",
      ),
    },
  };
}

export function buildCustomerProfileBoardRequest(
  search: CustomerProfileSearchState,
  window: CustomerProfileSearchWindow,
  actorId?: string,
): CrmSearchRequestBody {
  const boardSearch = withoutBoardStatus(search);
  return boardSearch.mode === "advanced"
    ? buildCustomerProfileSearchRequest(boardSearch, window)
    : buildCustomerProfileBasicSearchRequest(
        boardSearch.basic,
        window,
        actorId,
      );
}
