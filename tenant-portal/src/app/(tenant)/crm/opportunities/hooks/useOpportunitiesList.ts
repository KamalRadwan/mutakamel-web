"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeResync } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  EMPTY_OPPORTUNITY_SEARCH,
  buildOpportunitiesListQuery,
  buildOpportunitySearchRequest,
  type OpportunitySearchState,
  type OpportunitySortBy,
} from "../opportunity-search-contract";
import type { OpportunityStatus, StageFlag } from "./pipeline-types";

export interface OpportunityListItem {
  id: string;
  branchId: string;
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  stageFlag: StageFlag;
  status: OpportunityStatus;
  title: string;
  importance: number;
  ownerUserId: string | null;
  expectedCloseDate: string | null;
  createdAt: string;
}

export interface OpportunitiesListPageInfo {
  page: number;
  limit: number;
  total: number;
}

export type OpportunitiesSort = {
  id: OpportunitySortBy;
  direction: "asc" | "desc";
};

const STAGE_FLAGS: StageFlag[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
  "ON_HOLD",
  "WON",
  "LOST",
];
const OPPORTUNITY_STATUSES: OpportunityStatus[] = ["IN_PROGRESS", "ON_HOLD", "WON", "LOST"];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error("Invalid opportunities response.");
  }
  return candidate;
}

function requiredUuidV7(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) throw new Error("Invalid opportunities response.");
  return candidate;
}

function nullableUuidV7(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isUUIDv7(value)) throw new Error("Invalid opportunities response.");
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function enumValue<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error("Invalid opportunities response.");
  }
  return value as T;
}

function parseItem(value: unknown, expectedBranchId: string): OpportunityListItem {
  const item = record(value);
  if (!item) throw new Error("Invalid opportunities response.");
  const branchId = requiredUuidV7(item, "branchId");
  if (branchId !== expectedBranchId) throw new Error("Invalid opportunities response.");
  const importance = item.importance;
  if (!Number.isInteger(importance) || (importance as number) < 0 || (importance as number) > 3) {
    throw new Error("Invalid opportunities response.");
  }
  return {
    id: requiredUuidV7(item, "id"),
    branchId,
    customerProfileId: requiredUuidV7(item, "customerProfileId"),
    pipelineId: requiredUuidV7(item, "pipelineId"),
    stageId: requiredUuidV7(item, "stageId"),
    stageFlag: enumValue(item.stageFlag, STAGE_FLAGS),
    status: enumValue(item.status, OPPORTUNITY_STATUSES),
    title: requiredString(item, "title"),
    importance: importance as number,
    ownerUserId: nullableUuidV7(item.ownerUserId),
    expectedCloseDate: nullableString(item.expectedCloseDate),
    createdAt: requiredString(item, "createdAt"),
  };
}

export function parseOpportunitiesListResponse(
  payload: unknown,
  expectedBranchId: string,
): { items: OpportunityListItem[]; pageInfo: OpportunitiesListPageInfo } {
  // CRM pages are FLAT. `paginatedReadModels` in crm-app returns
  // { items, total, page, limit, totalPages, hasNext, hasPrev } with no
  // `meta` wrapper anywhere in the module — that is Core's shape, not CRM's
  // (standing rule S1). This parser required `payload.meta` and threw
  // "Invalid opportunities response." on every real response; its test made it
  // look correct by feeding the same wrong shape back, and even named itself
  // after it. Corrected 2026-08-31 against crm-app source.
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) {
    throw new Error("Invalid opportunities response.");
  }
  const items = page.items.map((item) => parseItem(item, expectedBranchId));
  const total = page.total;
  const pageNumber = page.page;
  const limit = page.limit;
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(pageNumber) ||
    !Number.isSafeInteger(limit) ||
    (total as number) < 0 ||
    (pageNumber as number) < 1 ||
    (limit as number) < 1
  ) {
    throw new Error("Invalid opportunities response.");
  }
  return {
    items,
    pageInfo: { page: pageNumber as number, limit: limit as number, total: total as number },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// The table view's data source — the generic, page-numbered GET
// /opportunities list, and the POST /opportunities/search route that answers
// the same envelope from a filter tree. Unlike the board/card projections,
// both return the raw OpportunityEntity: no customer or owner display name.
// See Q14 in docs/build/OPEN-QUESTIONS.md.
export function useOpportunitiesList(
  branchId: string | null,
  pipelineId: string | null,
  stageId: string | null,
) {
  const [items, setItems] = useState<OpportunityListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<OpportunitiesListPageInfo>({ page: 1, limit: 25, total: 0 });
  const [sort, setSort] = useState<OpportunitiesSort>({ id: "createdAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(false);
  // Handed to DataTable so a load failure replaces the empty state rather
  // than stacking a banner on top of "No matching opportunities".
  const [error, setError] = useState<NormalizedApiError | null>(null);
  // The question ON SCREEN. In basic mode it is also the question on the wire;
  // in advanced mode it is a draft the user is still building, and only the
  // card's Search button promotes it. `opportunity-search-contract` owns every
  // wire name either mode may produce.
  const [search, setSearch] = useState<OpportunitySearchState>(EMPTY_OPPORTUNITY_SEARCH);
  // The question ON THE WIRE. Split from the draft because a filter tree is
  // built one control at a time and every intermediate state is a different
  // query — usually an expensive one nobody asked for.
  const [appliedSearch, setAppliedSearch] =
    useState<OpportunitySearchState>(EMPTY_OPPORTUNITY_SEARCH);
  // Mirrors `appliedSearch` for the two callbacks below, which decide whether a
  // change reaches the wire before the render that would have shown it to them.
  const appliedSearchRef = useRef<OpportunitySearchState>(EMPTY_OPPORTUNITY_SEARCH);
  const requestEpochRef = useRef(0);
  const pageRef = useRef(1);
  // 0 for every fetch key that changes once per gesture — a branch, a pipeline,
  // a stage, a sort, a submitted tree — so those keep firing on the next
  // microtask exactly as they always have. 250 only while the basic text box is
  // being typed into, which is the one control that changes per keystroke.
  const fetchDelayRef = useRef(0);

  // The search route carries no pipeline or stage key at all: its scope is the
  // body's branch plus whatever the user put in the tree. Dropping both here
  // keeps the workspace's own selectors out of `fetchList`'s identity while
  // advanced mode is applied, so moving the pipeline picker for the board does
  // not re-run a query it cannot narrow.
  const scopedPipelineId = appliedSearch.mode === "advanced" ? null : pipelineId;
  const scopedStageId = appliedSearch.mode === "advanced" ? null : stageId;

  const fetchList = useCallback(
    async (requestedPage: number, signal?: AbortSignal) => {
      if (!branchId) {
        setItems([]);
        setPageInfo({ page: 1, limit: 25, total: 0 });
        setIsLoading(false);
        return;
      }
      const requestEpoch = requestEpochRef.current + 1;
      requestEpochRef.current = requestEpoch;
      setIsLoading(true);
      setError(null);
      try {
        const listWindow = {
          branchId,
          page: requestedPage,
          limit: 25,
          sortBy: sort.id,
          sortDir: sort.direction === "asc" ? ("ASC" as const) : ("DESC" as const),
        };
        // Two endpoints, ONE parser: `POST /opportunities/search` answers with
        // the same `{ items, total, page, limit, totalPages, hasNext, hasPrev }`
        // envelope the list route does, so nothing below this line branches.
        const response =
          appliedSearch.mode === "advanced"
            ? await axiosClient.post<unknown>(
                "/api/tenant/crm/v1/opportunities/search",
                buildOpportunitySearchRequest(appliedSearch, listWindow),
                {
                  signal,
                  cache: "no-store",
                  maxResponseBytes: 1024 * 1024,
                  // A POST that READS. It has no idempotency key because there
                  // is nothing to make idempotent, and it may be replayed after
                  // a token refresh for the same reason a GET may — re-running
                  // it changes nothing.
                  skipAutoIdempotency: true,
                  replayAfterRefresh: true,
                },
              )
            : await axiosClient.get<unknown>(
                `/api/tenant/crm/v1/opportunities?${buildOpportunitiesListQuery({
                  ...listWindow,
                  pipelineId: scopedPipelineId,
                  stageId: scopedStageId,
                  search: appliedSearch,
                }).toString()}`,
                { signal, cache: "no-store", maxResponseBytes: 1024 * 1024 },
              );
        const parsed = parseOpportunitiesListResponse(response.data, branchId);
        if (requestEpoch !== requestEpochRef.current) return;
        pageRef.current = parsed.pageInfo.page;
        setItems(parsed.items);
        setPageInfo(parsed.pageInfo);
      } catch (caught) {
        if (isAbortError(caught) || requestEpoch !== requestEpochRef.current) return;
        setItems([]);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted && requestEpoch === requestEpochRef.current) setIsLoading(false);
      }
    },
    [appliedSearch, branchId, scopedPipelineId, sort, scopedStageId],
  );

  // Every change to the fetch key — branch, pipeline, stage, sort or the
  // APPLIED search — restarts at page 1. Page 3 of one stage is not the page 3
  // being left, and on a narrowed result it is usually past the end.
  //
  // The draft is deliberately absent from that list: editing an advanced
  // condition changes `search` and nothing else, so no request leaves until
  // `submitSearch` promotes it.
  useEffect(() => {
    const controller = new AbortController();
    // Read once and reset, so the delay belongs to the change that asked for
    // it rather than to every fetch after it.
    const delay = fetchDelayRef.current;
    fetchDelayRef.current = 0;
    if (delay === 0) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) void fetchList(1, controller.signal);
      });
      return () => controller.abort();
    }
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) void fetchList(1, controller.signal);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fetchList]);

  // Mirrors OPPORTUNITY_SORT_FIELDS on the server; anything else is a 400.
  const SORTABLE_IDS = [
    "title",
    "amount",
    "probabilityPercent",
    "expectedCloseDate",
    "createdAt",
  ] as const;

  /**
   * A change to the question on screen, and — for basic mode only — to the
   * question on the wire.
   *
   * Basic answers as you type; the 250 ms delay the effect above reads is what
   * coalesces the keystrokes. Advanced does NOT: editing a condition must not
   * fire a request, so the draft moves and the wire does not until
   * `submitSearch` runs.
   *
   * The one exception is the mode switch itself. Arriving in advanced applies
   * once, so basic's term stops answering the moment its box leaves the screen
   * — a table still narrowed by a filter nobody can see is worse than an
   * unfiltered one.
   */
  const changeSearch = useCallback((next: OpportunitySearchState) => {
    setSearch(next);
    const current = appliedSearchRef.current;
    if (next.mode === "advanced" && current.mode === "advanced") return;
    // Only a typed term earns the delay. A mode switch is one gesture and
    // should answer at once.
    fetchDelayRef.current =
      next.mode === "basic" &&
      current.mode === "basic" &&
      next.basic.text !== current.basic.text
        ? 250
        : 0;
    appliedSearchRef.current = next;
    setAppliedSearch(next);
  }, []);

  /** Advanced mode's Search button: promote the draft, and run it. */
  const submitSearch = useCallback(() => {
    fetchDelayRef.current = 0;
    appliedSearchRef.current = search;
    setAppliedSearch(search);
  }, [search]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => void fetchList(pageRef.current), [fetchList]);
  useRealtimeResync(reload);

  return {
    items,
    pageInfo,
    sort,
    setSort: (next: { id: string; direction: "asc" | "desc" }) => {
      if ((SORTABLE_IDS as readonly string[]).includes(next.id)) {
        setSort(next as OpportunitiesSort);
      }
    },
    isLoading,
    error,
    setPage: (nextPage: number) => void fetchList(nextPage),
    reload,
    /** The draft the search bar renders. */
    search,
    changeSearch,
    submitSearch,
  };
}
