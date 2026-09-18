import type { CrmSearchRequestBody } from "../shared/search/filter-tree";
import { buildLeadBasicSearchRequest } from "./lead-basic-search-contract";
import { buildLeadSearchRequest, type LeadSearchState } from "./lead-search-contract";
import type { LeadSearchWindow } from "./lead-basic-search-contract";

export const LEAD_BOARD_STAGE_LIMIT = 50;

/**
 * Board and list keep the same search question, but use different response
 * projections. The board endpoint owns stage partitioning; the stage-page
 * endpoint receives this same body and constrains the stage from its path.
 */
export function buildLeadBoardRequest(
  search: LeadSearchState,
  window: LeadSearchWindow,
  actorId?: string,
): CrmSearchRequestBody {
  return search.mode === "advanced"
    ? buildLeadSearchRequest(search, window)
    : buildLeadBasicSearchRequest(search.basic, window, actorId);
}
