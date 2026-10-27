import type { CrmSearchRequestBody } from "../shared/search/filter-tree";
import { buildLeadBasicSearchRequest } from "./lead-basic-search-contract";
import { buildLeadSearchRequest, withLeadKpiPreset, type LeadSearchState } from "./lead-search-contract";
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
    : withLeadKpiPreset(buildLeadBasicSearchRequest(search.basic, window, actorId), search.kpiPreset);
}

/** Initial board reads always start every lane at page one. */
export function buildLeadInitialBoardRequest(...args: Parameters<typeof buildLeadBoardRequest>) {
  const { page, ...body } = buildLeadBoardRequest(...args);
  void page;
  return body;
}

/** KPI counts share search predicates, without ordering or a page window. */
export function buildLeadKpisRequest(...args: Parameters<typeof buildLeadBoardRequest>) {
  const { sort, limit, ...body } = buildLeadInitialBoardRequest(...args);
  void sort;
  void limit;
  return body;
}
