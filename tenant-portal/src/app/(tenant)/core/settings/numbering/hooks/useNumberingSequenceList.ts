"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRealtimeResync } from "@/design-system";
import { fetchNumberingSequences } from "../numbering-api";
import {
  NUMBERING_PAGE_SIZE,
  NUMBERING_SORT_FIELDS,
  isValidNumberingCode,
  numberingListQuery,
  type NumberingSequence,
  type NumberingSortField,
} from "../numbering-contract";
import {
  classifyNumberingQueryError,
  isAbortError,
  isNumberingQueryNotFound,
  type NumberingQueryError,
} from "../numbering-errors";

interface UseNumberingSequenceListOptions {
  readonly authFenceKey: string;
  readonly latestAuthFenceRef: RefObject<string>;
  readonly canRead: boolean;
  readonly canReadAccess: boolean;
  readonly onQueryForbidden: () => void;
}

interface ScopedQueryErrorState {
  readonly scopedKey: string;
  readonly error: NumberingQueryError;
}

export function useNumberingSequenceList({
  authFenceKey,
  latestAuthFenceRef,
  canRead,
  canReadAccess,
  onQueryForbidden,
}: UseNumberingSequenceListOptions) {
  const canAttemptRead = canRead && canReadAccess;

  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilterState] = useState<string | undefined>(undefined);
  const [codeFilter, setCodeFilterState] = useState<string | undefined>(undefined);
  const [search, setSearchState] = useState("");
  const [sort, setSortState] = useState<{ id: NumberingSortField; direction: "asc" | "desc" }>({
    id: "code",
    direction: "asc",
  });

  const currentQuery = useMemo(
    () =>
      numberingListQuery({
        page,
        companyId: companyFilter,
        code: codeFilter,
        search,
        sortBy: sort.id,
        sortDir: sort.direction === "asc" ? "ASC" : "DESC",
      }),
    [page, companyFilter, codeFilter, search, sort],
  );
  const scopedQueryKey = `${authFenceKey}:${currentQuery}`;

  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedScopedKey, setTrackedScopedKey] = useState(scopedQueryKey);
  const [items, setItems] = useState<NumberingSequence[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: NUMBERING_PAGE_SIZE, total: 0 });
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [queryErrorState, setQueryErrorState] = useState<ScopedQueryErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(canAttemptRead);

  if (trackedAuthKey !== authFenceKey) {
    setTrackedAuthKey(authFenceKey);
    setTrackedScopedKey(scopedQueryKey);
    setItems([]);
    setPageInfo({ page: 1, limit: NUMBERING_PAGE_SIZE, total: 0 });
    setLoadedQuery(null);
    setQueryErrorState(null);
    setIsLoading(canAttemptRead);
  } else if (trackedScopedKey !== scopedQueryKey) {
    setTrackedScopedKey(scopedQueryKey);
    setQueryErrorState(null);
    setIsLoading(canAttemptRead);
  }

  const mountedRef = useRef(true);
  const loadEpochRef = useRef(0);
  const activeLoadRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<NumberingSequence[]>([]);
  const loadedQueryRef = useRef<string | null>(null);
  const onQueryForbiddenRef = useRef(onQueryForbidden);

  useEffect(() => {
    onQueryForbiddenRef.current = onQueryForbidden;
  }, [onQueryForbidden]);

  useEffect(() => {
    loadEpochRef.current += 1;
    itemsRef.current = [];
    loadedQueryRef.current = null;
  }, [authFenceKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadEpochRef.current += 1;
      activeLoadRef.current?.abort();
      activeLoadRef.current = null;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    activeLoadRef.current?.abort();
    if (!canAttemptRead) {
      activeLoadRef.current = null;
      loadEpochRef.current += 1;
      itemsRef.current = [];
      loadedQueryRef.current = null;
      onQueryForbiddenRef.current();
      setItems([]);
      setLoadedQuery(null);
      setQueryErrorState(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    activeLoadRef.current = controller;
    const requestEpoch = ++loadEpochRef.current;
    const requestAuthFenceKey = authFenceKey;
    const requestScopedKey = scopedQueryKey;
    const isCurrentLoad = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      activeLoadRef.current === controller &&
      loadEpochRef.current === requestEpoch &&
      latestAuthFenceRef.current === requestAuthFenceKey;
    let recoveringPage = false;

    setIsLoading(true);
    setQueryErrorState(null);

    try {
      const parsed = await fetchNumberingSequences({
        page,
        companyId: companyFilter,
        code: codeFilter,
        search,
        sortBy: sort.id,
        sortDir: sort.direction === "asc" ? "ASC" : "DESC",
        signal: controller.signal,
      });
      if (!isCurrentLoad()) return;

      const lastPage = Math.max(1, parsed.totalPages);
      if (page > lastPage) {
        recoveringPage = true;
        setPage(lastPage);
        return;
      }

      itemsRef.current = parsed.items;
      loadedQueryRef.current = requestScopedKey;
      setItems(parsed.items);
      setPageInfo({ page: parsed.page, limit: parsed.limit, total: parsed.total });
      setLoadedQuery(requestScopedKey);
      setQueryErrorState(null);
    } catch (error) {
      if (!isCurrentLoad() || isAbortError(error)) return;
      const classified = classifyNumberingQueryError(error);
      const isForbidden = classified.kind === "api" && classified.error.status === 403;
      const isNotFound = isNumberingQueryNotFound(classified);
      const retainLoadedRows =
        !isForbidden &&
        !isNotFound &&
        loadedQueryRef.current === requestScopedKey &&
        itemsRef.current.length > 0;

      if (!retainLoadedRows) {
        itemsRef.current = [];
        loadedQueryRef.current = null;
        setItems([]);
        setLoadedQuery(null);
        setPageInfo({ page: isForbidden ? 1 : page, limit: NUMBERING_PAGE_SIZE, total: 0 });
      }
      if (isForbidden) {
        onQueryForbiddenRef.current();
      }
      setQueryErrorState({ scopedKey: requestScopedKey, error: classified });
    } finally {
      if (!recoveringPage && isCurrentLoad()) {
        setIsLoading(false);
      }
    }
  }, [
    canAttemptRead,
    authFenceKey,
    scopedQueryKey,
    page,
    companyFilter,
    codeFilter,
    search,
    sort,
    latestAuthFenceRef,
  ]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      activeLoadRef.current?.abort();
      activeLoadRef.current = null;
    };
  }, [load]);

  useRealtimeResync(load);

  const setCompanyFilter = useCallback((next: string | undefined) => {
    setPage(1);
    setCompanyFilterState(next);
  }, []);

  const setCodeFilter = useCallback((next: string | undefined) => {
    setPage(1);
    const normalized = next?.trim().toUpperCase();
    setCodeFilterState(normalized && isValidNumberingCode(normalized) ? normalized : undefined);
  }, []);

  const setSearch = useCallback((next: string) => {
    setPage(1);
    setSearchState(next);
  }, []);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = NUMBERING_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setPage(1);
    setCompanyFilterState(undefined);
    setCodeFilterState(undefined);
    setSearchState("");
  }, []);

  const visibleItems = loadedQuery === scopedQueryKey ? items : [];
  const hasRetainedRows = visibleItems.length > 0;
  const queryError =
    queryErrorState?.scopedKey === scopedQueryKey ? queryErrorState.error : null;
  const isQueryForbidden = queryError?.kind === "api" && queryError.error.status === 403;
  const isQueryNotFound = isNumberingQueryNotFound(queryError);
  const hasActiveFilters =
    Boolean(companyFilter) || Boolean(codeFilter) || search.trim().length > 0;

  return {
    items: visibleItems,
    hasRetainedRows,
    pageInfo,
    companyFilter,
    codeFilter,
    search,
    sort,
    hasActiveFilters,
    isLoading: isLoading && !hasRetainedRows,
    isRefreshing: isLoading,
    queryError,
    isQueryForbidden,
    isQueryNotFound,
    setPage,
    setCompanyFilter,
    setCodeFilter,
    setSearch,
    setSort,
    clearAllFilters,
    reload: load,
  };
}
