"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCan } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { ActiveStatus } from "../../../core-validation";
import {
  CURRENCY_PAGE_SIZE,
  CURRENCY_PAGE_SIZE_OPTIONS,
  CURRENCY_SORT_FIELDS,
  currenciesListQuery,
  fetchCurrenciesPage,
  resolveCurrencyListFilter,
  type Currency,
  type CurrencyListFilter,
  type CurrencySortField,
} from "../currency-contract";
import { normalizeCurrencyQueryError } from "./currency-errors";
import { useBaseCurrency } from "./useBaseCurrency";
import { useCurrencyMutations } from "./useCurrencyMutations";

export function useCurrencies() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const accessMode = useAccessMode();
  const authScopeKey = useAuthScopeKey(user);

  const canRead = useCan("currencies.currency.read");
  const hasManageGrant = useCan("currencies.currency.manage", { tenantWide: true });
  const canManage = accessMode.canMutate && hasManageGrant;

  const manageScope = user?.permissionScopes?.["currencies.currency.manage"];
  const manageScopeKey = manageScope
    ? `${manageScope.tenantWide}:${[...manageScope.companyIds].sort().join(",")}:${[...manageScope.branchIds].sort().join(",")}`
    : "none";
  const authFenceKey = `${realtimeAuthGeneration ?? "no-gen"}:${authScopeKey}:${canRead ? "r1" : "r0"}:${manageScopeKey}:${accessMode.mode ?? "unresolved"}`;
  const canReadCurrencies = canRead && accessMode.canRead;

  const [items, setItems] = useState<Currency[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: CURRENCY_PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(CURRENCY_PAGE_SIZE);
  const [listFilter, setListFilterState] = useState<CurrencyListFilter | undefined>(undefined);
  const [search, setSearchState] = useState("");
  const [sort, setSortState] = useState<{ id: CurrencySortField; direction: "asc" | "desc" }>({
    id: "code",
    direction: "asc",
  });

  const { status: statusFilter, isDefault: defaultFilter } = resolveCurrencyListFilter(listFilter);
  const sortField = sort.id;
  const sortDir = sort.direction === "asc" ? "ASC" : "DESC";
  const currentQuery = currenciesListQuery({
    page,
    limit: pageSize,
    status: statusFilter,
    isDefault: defaultFilter,
    search,
    sortBy: sortField,
    sortDir,
  });
  const scopedQueryKey = `${authFenceKey}:${currentQuery}`;

  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedQueryKey, setTrackedQueryKey] = useState(scopedQueryKey);
  const [isLoading, setIsLoading] = useState(canReadCurrencies);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [queryErrorState, setQueryErrorState] = useState<{
    key: string;
    error: NormalizedApiError;
  } | null>(null);

  if (trackedAuthKey !== authFenceKey) {
    const resetQuery = currenciesListQuery({
      page: 1,
      limit: pageSize,
      status: statusFilter,
      isDefault: defaultFilter,
      search,
      sortBy: sort.id,
      sortDir,
    });
    setTrackedAuthKey(authFenceKey);
    setTrackedQueryKey(`${authFenceKey}:${resetQuery}`);
    setItems([]);
    setPageInfo({ page: 1, limit: pageSize, total: 0 });
    if (page !== 1) setPage(1);
    setLoadedQuery(null);
    setQueryErrorState(null);
    setIsLoading(canReadCurrencies);
  } else if (trackedQueryKey !== scopedQueryKey) {
    setTrackedQueryKey(scopedQueryKey);
    setQueryErrorState(null);
    setIsLoading(canReadCurrencies);
  }

  const mountedRef = useRef(true);
  const activeLoadRef = useRef<AbortController | null>(null);
  const latestLoadIdRef = useRef(0);
  const latestAuthFenceRef = useRef(authFenceKey);
  const itemsRef = useRef<Currency[]>([]);
  const loadedQueryRef = useRef<string | null>(null);
  const dismissModalsRef = useRef<() => void>(() => {});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
    itemsRef.current = [];
    loadedQueryRef.current = null;
  }, [authFenceKey]);

  const queryError = queryErrorState?.key === scopedQueryKey ? queryErrorState.error : null;
  const isQueryForbidden = queryError?.status === 403;

  const { baseCurrency, baseStatus, isBaseLoading, reloadBaseCurrency } = useBaseCurrency({
    authFenceKey,
    enabled: canReadCurrencies && !isQueryForbidden,
  });

  const load = useCallback(async (): Promise<void> => {
    activeLoadRef.current?.abort();
    if (!mountedRef.current) return;
    if (!canReadCurrencies) {
      activeLoadRef.current = null;
      latestLoadIdRef.current += 1;
      itemsRef.current = [];
      loadedQueryRef.current = null;
      dismissModalsRef.current();
      setItems([]);
      setLoadedQuery(null);
      setPageInfo({ page: 1, limit: pageSize, total: 0 });
      setQueryErrorState(null);
      setIsLoading(false);
      return;
    }

    const startedFence = authFenceKey;
    const startedScopedKey = scopedQueryKey;
    const controller = new AbortController();
    activeLoadRef.current = controller;
    const requestId = ++latestLoadIdRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      activeLoadRef.current === controller &&
      latestLoadIdRef.current === requestId &&
      latestAuthFenceRef.current === startedFence;

    let recoveringPage = false;
    setIsLoading(true);
    setQueryErrorState(null);
    try {
      const parsed = await fetchCurrenciesPage({
        page,
        limit: pageSize,
        status: statusFilter,
        isDefault: defaultFilter,
        search,
        sortBy: sortField,
        sortDir,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      const lastPage = Math.max(1, parsed.totalPages);
      // Mutations can remove the final row on a filtered page. Changing the
      // page triggers a fresh read with the same filters, search and sort.
      if (page > lastPage) {
        recoveringPage = true;
        setPage(lastPage);
        return;
      }
      itemsRef.current = parsed.items;
      loadedQueryRef.current = startedScopedKey;
      setItems(parsed.items);
      setPageInfo({ page: parsed.page, limit: parsed.limit, total: parsed.total });
      setLoadedQuery(startedScopedKey);
    } catch (error) {
      if (!isCurrent() || isAbortError(error)) return;
      const normalized = normalizeCurrencyQueryError(error);
      const retainLoadedRows =
        normalized.status !== 403 &&
        loadedQueryRef.current === startedScopedKey &&
        itemsRef.current.length > 0;
      if (!retainLoadedRows) {
        itemsRef.current = [];
        loadedQueryRef.current = null;
        setItems([]);
        setLoadedQuery(null);
        setPageInfo({
          page: normalized.status === 403 ? 1 : page,
          limit: pageSize,
          total: 0,
        });
      }
      if (normalized.status === 403) {
        dismissModalsRef.current();
      }
      setQueryErrorState({ key: startedScopedKey, error: normalized });
    } finally {
      if (isCurrent() && !recoveringPage) setIsLoading(false);
    }
  }, [
    authFenceKey,
    canReadCurrencies,
    defaultFilter,
    page,
    pageSize,
    scopedQueryKey,
    search,
    setIsLoading,
    setLoadedQuery,
    setQueryErrorState,
    sortDir,
    sortField,
    statusFilter,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      latestLoadIdRef.current += 1;
      activeLoadRef.current?.abort();
      activeLoadRef.current = null;
    };
  }, [load]);

  const reload = useCallback(async (): Promise<void> => {
    await Promise.allSettled([load(), reloadBaseCurrency()]);
  }, [load, reloadBaseCurrency]);

  const { dismissAllModals, ...mutations } = useCurrencyMutations({
    t,
    authFenceKey,
    canManage,
    isForbidden: isQueryForbidden,
    onRefreshList: load,
    onRefreshAll: reload,
  });

  useEffect(() => {
    dismissModalsRef.current = dismissAllModals;
  }, [dismissAllModals]);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = CURRENCY_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  const setListFilter = useCallback((next: CurrencyListFilter | undefined) => {
    setPage(1);
    setListFilterState(next);
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setListFilterState(undefined);
    setSearchState("");
  }, []);

  const setPageSize = useCallback(
    (nextSize: number) => {
      if (!CURRENCY_PAGE_SIZE_OPTIONS.some((allowed) => allowed === nextSize)) return;
      if (nextSize === pageSize) return;
      setPage(1);
      setPageSizeState(nextSize);
    },
    [pageSize],
  );

  const isCurrentQueryLoaded = loadedQuery === scopedQueryKey;
  const visibleItems = isCurrentQueryLoaded ? items : [];
  const visiblePageInfo = isCurrentQueryLoaded
    ? pageInfo
    : { page, limit: pageSize, total: 0 };
  const hasRetainedRows = isCurrentQueryLoaded && items.length > 0;

  return {
    t,
    lang,
    sort,
    setSort,
    canRead,
    canManage,
    items,
    visibleItems,
    pageInfo,
    visiblePageInfo,
    pageSize,
    listFilter,
    statusFilter,
    defaultFilter,
    search,
    hasActiveFilters: listFilter !== undefined || search.trim().length > 0,
    hasRetainedRows,
    isQueryForbidden,
    isLoading: isLoading && !isCurrentQueryLoaded,
    isRefreshing: isLoading,
    queryError,
    baseCurrency,
    baseStatus,
    isBaseLoading,
    reloadBaseCurrency,
    setPage,
    setPageSize,
    setListFilter,
    setStatusFilter: (next: ActiveStatus | undefined) => setListFilter(next),
    setDefaultFilter: (next: boolean | undefined) =>
      setListFilter(next === undefined ? undefined : next ? "DEFAULT" : "NON_DEFAULT"),
    setSearch: (next: string) => {
      setPage(1);
      setSearchState(next);
    },
    clearFilters,
    reload,
    ...mutations,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
