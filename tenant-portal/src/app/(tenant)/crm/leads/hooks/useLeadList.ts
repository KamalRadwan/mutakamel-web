"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildLeadBasicSearchRequest,
  buildLeadsListQuery,
  leadBasicSearchNeedsPost,
  type LeadSearchWindow,
} from "../lead-basic-search-contract";
import {
  parseLeadsResponse,
  type LeadItem,
  type LeadsPageInfo,
} from "../lead-list-contract";
import {
  DEFAULT_LEAD_SEARCH,
  buildLeadSearchRequest,
  type LeadSearchState,
} from "../lead-search-contract";

export type LeadsView = "board" | "card" | "list";

export interface LeadsSort {
  id: "displayName" | "createdAt";
  direction: "asc" | "desc";
}

// GET /crm/leads accepts displayName and createdAt only; anything else is a 400.
export const DEFAULT_LEADS_SORT: LeadsSort = { id: "createdAt", direction: "desc" };

const DEFAULT_ADVANCED_LEAD_SEARCH: LeadSearchState = { ...DEFAULT_LEAD_SEARCH, mode: "advanced" };
const PAGE_SIZE = 50;
const DEBOUNCE_MS = 250;
const EMPTY_PAGE_INFO: LeadsPageInfo = {
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};
const INVALID_LEADS = "Invalid leads response.";
const READ_OPTIONS = { cache: "no-store", maxResponseBytes: 1024 * 1024 } as const;

interface LeadListQuery {
  page: number;
  sort: LeadsSort;
  search: LeadSearchState;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

interface LeadListOptions {
  branchId: string | null;
  actorId: string | undefined;
  activeView: LeadsView;
  /** Runs when a list read starts; the screen clears its write feedback. */
  onLoadStart: () => void;
}

/**
 * The Card/Table list: one page of rows, the search on screen and the search
 * on the wire, paging and sorting. Board lanes are `useLeadBoard`'s, so the
 * board view reads nothing here.
 *
 * Every query change schedules ONE debounced read; an explicit `reload` cancels
 * the scheduled one and reads now, so a write that reloads never pays for a
 * second identical request 250 ms later.
 */
export function useLeadList({ branchId, actorId, activeView, onLoadStart }: LeadListOptions) {
  const [items, setItems] = useState<LeadItem[]>([]);
  const [pageInfo, setPageInfo] = useState<LeadsPageInfo>(EMPTY_PAGE_INFO);
  // The question ON SCREEN. In Advanced it is a draft only Search promotes:
  // every intermediate filter tree is a different, usually expensive, query.
  const [search, setSearch] = useState<LeadSearchState>(DEFAULT_LEAD_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<LeadSearchState>(DEFAULT_LEAD_SEARCH);
  const [sort, setSort] = useState<LeadsSort>(DEFAULT_LEADS_SORT);
  const [isLoading, setIsLoading] = useState(false);
  // The read's own failure, kept apart from write feedback so the views can
  // show it in place of the empty state.
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  // The query the next read sends. A ref because writes reload long after the
  // render that started them.
  const queryRef = useRef<LeadListQuery>({ page: 1, sort: DEFAULT_LEADS_SORT, search: DEFAULT_LEAD_SEARCH });
  // The last Advanced query explicitly submitted: re-entering Advanced
  // restores its results without applying later draft edits.
  const submittedAdvancedRef = useRef<LeadSearchState>(DEFAULT_ADVANCED_LEAD_SEARCH);
  const epochRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  const read = useCallback(async (): Promise<boolean> => {
    const epoch = ++epochRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { page, sort: order, search: query } = queryRef.current;
    const myLeadsWithoutActor = query.mode === "basic" && query.basic.myLeads && !isUUIDv7(actorId);
    if (!branchId || myLeadsWithoutActor || activeView === "board") {
      setItems([]);
      setPageInfo(EMPTY_PAGE_INFO);
      setIsLoading(false);
      setLoadError(null);
      if (!branchId || myLeadsWithoutActor) return false;
      onLoadStart();
      return true;
    }

    setIsLoading(true);
    setLoadError(null);
    onLoadStart();
    const readPage = (requestedPage: number) => {
      const window: LeadSearchWindow = {
        branchId,
        page: requestedPage,
        limit: PAGE_SIZE,
        sortBy: order.id,
        sortDir: order.direction === "asc" ? "ASC" : "DESC",
      };
      // Both endpoints answer with the same page envelope, so one parser reads either.
      if (query.mode === "advanced" || leadBasicSearchNeedsPost(query.basic)) {
        const body = query.mode === "advanced"
          ? buildLeadSearchRequest(query, window)
          : buildLeadBasicSearchRequest(query.basic, window, actorId);
        // A POST that reads: no idempotency key, and safe to replay after a refresh.
        return axiosClient.post<unknown>("/api/tenant/crm/v1/leads/search", body, {
          ...READ_OPTIONS,
          signal: controller.signal,
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
        });
      }
      const params = buildLeadsListQuery({ ...window, basic: query.basic, actorId });
      return axiosClient.get<unknown>(`/api/tenant/crm/v1/leads?${params.toString()}`, {
        ...READ_OPTIONS,
        signal: controller.signal,
      });
    };

    try {
      let next = parseLeadsResponse((await readPage(page)).data, branchId);
      if (next.page !== page) throw new Error(INVALID_LEADS);
      // A delete elsewhere can leave the requested page past the end.
      const lastPage = Math.max(next.totalPages, 1);
      if (next.page > lastPage) {
        next = parseLeadsResponse((await readPage(lastPage)).data, branchId);
        if (next.page !== lastPage || next.page > Math.max(next.totalPages, 1)) {
          throw new Error(INVALID_LEADS);
        }
      }
      if (epoch !== epochRef.current) return false;
      const { items: nextItems, ...nextPageInfo } = next;
      queryRef.current = { ...queryRef.current, page: nextPageInfo.page };
      setItems(nextItems);
      setPageInfo(nextPageInfo);
      return true;
    } catch (caught) {
      if (isAbortError(caught) || epoch !== epochRef.current) return false;
      setItems([]);
      setPageInfo((current) => ({ ...current, total: 0, totalPages: 0, hasNext: false, hasPrev: false }));
      setLoadError(normalizeApiError(caught));
      return false;
    } finally {
      if (epoch === epochRef.current) setIsLoading(false);
    }
  }, [activeView, actorId, branchId, onLoadStart]);

  const cancelScheduled = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const schedule = useCallback(() => {
    cancelScheduled();
    timerRef.current = window.setTimeout(() => void read(), DEBOUNCE_MS);
  }, [cancelScheduled, read]);

  useEffect(() => {
    schedule();
    return () => {
      cancelScheduled();
      controllerRef.current?.abort();
    };
  }, [cancelScheduled, schedule]);

  /** Reads now, optionally from another page; cancels any scheduled read. */
  const reload = useCallback(
    (page?: number) => {
      cancelScheduled();
      if (page !== undefined) queryRef.current = { ...queryRef.current, page };
      return read();
    },
    [cancelScheduled, read],
  );

  const apply = useCallback(
    (patch: Partial<LeadListQuery>) => {
      queryRef.current = { ...queryRef.current, ...patch };
      schedule();
    },
    [schedule],
  );

  // Applying a search starts the result set over: page 4 of a name search is
  // not page 4 of a status filter.
  const applySearch = useCallback(
    (next: LeadSearchState) => {
      setAppliedSearch(next);
      apply({ search: next, page: 1 });
    },
    [apply],
  );

  /**
   * Basic answers as you type (the debounce coalesces keystrokes). Advanced
   * only moves the draft — except on arrival, which applies its last submitted
   * query so Basic's filters stop answering once their controls are gone.
   */
  const changeSearch = useCallback(
    (next: LeadSearchState) => {
      setSearch(next);
      if (next.mode === "basic") applySearch(next);
      else if (queryRef.current.search.mode !== "advanced") applySearch(submittedAdvancedRef.current);
    },
    [applySearch],
  );

  const submitSearch = useCallback(() => {
    if (search.mode !== "advanced") return;
    submittedAdvancedRef.current = search;
    applySearch(search);
  }, [applySearch, search]);

  const resetSearch = useCallback(() => {
    submittedAdvancedRef.current = DEFAULT_ADVANCED_LEAD_SEARCH;
    changeSearch(DEFAULT_LEAD_SEARCH);
  }, [changeSearch]);

  const changePage = useCallback((page: number) => apply({ page }), [apply]);

  const changeSort = useCallback(
    (next: { id: string; direction: "asc" | "desc" }) => {
      if (next.id !== "displayName" && next.id !== "createdAt") return;
      const order: LeadsSort = { id: next.id, direction: next.direction };
      setSort(order);
      apply({ sort: order, page: 1 });
    },
    [apply],
  );

  /** Drops the rows and any in-flight answer, e.g. when the branch changes. */
  const clear = useCallback(() => {
    epochRef.current += 1;
    setItems([]);
    setLoadError(null);
  }, []);

  return {
    items,
    setItems,
    pageInfo,
    search,
    appliedSearch,
    sort,
    isLoading,
    loadError,
    changeSearch,
    submitSearch,
    resetSearch,
    changePage,
    changeSort,
    reload,
    clear,
  };
}
