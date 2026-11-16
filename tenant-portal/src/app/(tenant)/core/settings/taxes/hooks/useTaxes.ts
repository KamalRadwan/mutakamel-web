"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasPermission, useCan } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { readCorePage } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useCompanyOptions } from "../../hooks/useCompanyOptions";
import {
  TAXES_PATH,
  TAX_PAGE_SIZE,
  parseTaxesResponse,
  type Tax,
} from "../tax-contract";
import {
  formatTaxQueryFailure,
  isAbortError,
  normalizeTaxQueryError,
} from "../tax-errors";
import { useTaxFormWrites } from "./useTaxFormWrites";
import { useTaxLifecycleActions } from "./useTaxLifecycleActions";
import { useTaxListFilters } from "./useTaxListFilters";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;

export function useTaxes() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const accessMode = useAccessMode();
  const authScopeKey = useAuthScopeKey(user);
  const manageScope = user?.permissionScopes?.["taxes.tax.manage"];
  const manageScopeKey = manageScope
    ? `${manageScope.tenantWide}:${[...manageScope.companyIds].sort().join(",")}`
    : "none";
  const authFenceKey = `${realtimeAuthGeneration ?? "no-gen"}:${authScopeKey}:${manageScopeKey}:${accessMode.mode ?? "unresolved"}`;

  const canRead = hasPermission(user?.permissions ?? [], "taxes.tax.read");
  const canReadTaxes = canRead && accessMode.canRead;
  const rawCanManage = useCan("taxes.tax.manage");
  const {
    companies,
    manageableCompanies,
    tenantWideAllowed: rawTenantWideAllowed,
    canManageScope: rawCanManageScope,
    canCreate: rawCanCreate,
    loadError: companyLoadError,
    isTruncated: companiesTruncated,
    retry: retryCompanies,
  } = useCompanyOptions("taxes.tax.manage");

  const canManage = accessMode.canMutate && rawCanManage;
  const tenantWideAllowed = accessMode.canMutate && rawTenantWideAllowed;
  const canCreate = accessMode.canMutate && rawCanCreate;
  const canManageScope = useCallback(
    (companyId: string | null) => accessMode.canMutate && rawCanManageScope(companyId),
    [accessMode.canMutate, rawCanManageScope],
  );

  const filters = useTaxListFilters();
  const { page, pageSize, currentQuery, setPage } = filters;
  const scopedQueryKey = `${authFenceKey}:${currentQuery}`;

  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedQueryKey, setTrackedQueryKey] = useState(scopedQueryKey);
  const [items, setItems] = useState<Tax[]>([]);
  const [pageMeta, setPageMeta] = useState({ limit: TAX_PAGE_SIZE, total: 0 });
  const [isLoading, setIsLoading] = useState(canReadTaxes);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [queryErrorState, setQueryErrorState] = useState<{
    key: string;
    error: NormalizedApiError;
  } | null>(null);

  if (trackedAuthKey !== authFenceKey) {
    setTrackedAuthKey(authFenceKey);
    setTrackedQueryKey(scopedQueryKey);
    setItems([]);
    setPageMeta({ limit: pageSize, total: 0 });
    setLoadedQuery(null);
    setQueryErrorState(null);
    setIsLoading(canReadTaxes);
  } else if (trackedQueryKey !== scopedQueryKey) {
    setTrackedQueryKey(scopedQueryKey);
    setQueryErrorState(null);
    setIsLoading(canReadTaxes);
  }

  const activeListRequest = useRef<AbortController | null>(null);
  const itemsRef = useRef<Tax[]>([]);
  const loadedQueryRef = useRef<string | null>(null);
  const mutationInFlightRef = useRef(false);
  const latestAuthFenceRef = useRef(authFenceKey);

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
    itemsRef.current = [];
    loadedQueryRef.current = null;
  }, [authFenceKey]);

  const load = useCallback(async (): Promise<void> => {
    activeListRequest.current?.abort();
    if (!canReadTaxes) {
      activeListRequest.current = null;
      itemsRef.current = [];
      loadedQueryRef.current = null;
      setItems([]);
      setLoadedQuery(null);
      setPageMeta({ limit: pageSize, total: 0 });
      setQueryErrorState(null);
      setIsLoading(false);
      return;
    }

    const startedFence = authFenceKey;
    const startedScopedKey = scopedQueryKey;
    const controller = new AbortController();
    activeListRequest.current = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      activeListRequest.current === controller &&
      latestAuthFenceRef.current === startedFence;

    setIsLoading(true);
    setQueryErrorState(null);

    try {
      const envelope = await readCorePage(TAXES_PATH, currentQuery, {
        signal: controller.signal,
        cache: "no-store",
        suppressForbiddenToast: true,
        maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
      });
      if (!isCurrent()) return;

      const parsed = parseTaxesResponse(envelope);
      const maxPage = Math.max(1, parsed.totalPages);
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }

      itemsRef.current = parsed.items;
      loadedQueryRef.current = startedScopedKey;
      setItems(parsed.items);
      setPageMeta({ limit: parsed.limit, total: parsed.total });
      setLoadedQuery(startedScopedKey);
      setIsLoading(false);
    } catch (error) {
      if (!isCurrent() || isAbortError(error)) {
        return;
      }
      const normalized = normalizeTaxQueryError(error);
      const retainLoadedRows =
        normalized.status !== 403 &&
        loadedQueryRef.current === startedScopedKey &&
        itemsRef.current.length > 0;
      if (!retainLoadedRows) {
        itemsRef.current = [];
        loadedQueryRef.current = null;
        setItems([]);
        setLoadedQuery(null);
        setPageMeta({ limit: pageSize, total: 0 });
      }
      setQueryErrorState({ key: startedScopedKey, error: normalized });
      setIsLoading(false);
    }
  }, [authFenceKey, canReadTaxes, currentQuery, page, pageSize, scopedQueryKey, setPage]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      activeListRequest.current?.abort();
    };
  }, [load]);

  const dismissFormModalsRef = useRef<() => void>(() => {});
  const lifecycle = useTaxLifecycleActions({
    t,
    authFenceKey,
    latestAuthFenceRef,
    mutationInFlightRef,
    canMutate: accessMode.canMutate,
    canManageScope,
    onBeforeOpenDeactivate: () => dismissFormModalsRef.current(),
    reloadList: load,
  });

  const formWrites = useTaxFormWrites({
    t,
    authFenceKey,
    latestAuthFenceRef,
    mutationInFlightRef,
    isPeerBusy: lifecycle.pendingId !== null,
    canMutate: accessMode.canMutate,
    canCreate,
    canManageScope,
    companies,
    onBeforeOpenModal: lifecycle.dismissDeactivate,
    reloadList: load,
  });

  useEffect(() => {
    dismissFormModalsRef.current = formWrites.dismissFormModals;
  }, [formWrites.dismissFormModals]);

  const queryError = queryErrorState?.key === scopedQueryKey ? queryErrorState.error : null;
  const isQueryForbidden = queryError?.status === 403;
  const queryFailure = queryError && !isQueryForbidden ? formatTaxQueryFailure(queryError, t) : null;
  const isCurrentQueryLoaded = loadedQuery === scopedQueryKey;
  const visibleItems = isCurrentQueryLoaded ? items : [];
  const hasRetainedRows = isCurrentQueryLoaded && items.length > 0;
  const isTableLoading = isLoading && !hasRetainedRows;
  const isBusy = formWrites.isSubmitting || lifecycle.pendingId !== null;

  return {
    t,
    lang,
    accessMode: accessMode.mode,
    isPermissionReadOnly: canRead && !isQueryForbidden && accessMode.canMutate && !rawCanManage,
    canManage,
    canCreate,
    canManageScope,
    tenantWideAllowed,
    manageableCompanies,
    companies,
    companyLoadError,
    companiesTruncated,
    retryCompanies,
    items: visibleItems,
    pageInfo: {
      page,
      limit: isCurrentQueryLoaded ? pageMeta.limit : pageSize,
      total: isCurrentQueryLoaded ? pageMeta.total : 0,
    },
    statusFilter: filters.statusFilter,
    companyFilter: filters.companyFilter,
    isScopeSelectOpen: filters.isScopeSelectOpen,
    setIsScopeSelectOpen: filters.setIsScopeSelectOpen,
    inclusiveFilter: filters.inclusiveFilter,
    search: filters.search,
    hasActiveFilters: filters.hasActiveFilters,
    sort: filters.sort,
    setSort: filters.setSort,
    isLoading: isTableLoading,
    isRefreshing: isLoading,
    hasRetainedRows,
    isQueryForbidden,
    queryFailure,
    isSubmitting: formWrites.isSubmitting,
    pendingId: lifecycle.pendingId,
    isBusy,
    formError: formWrites.formError,
    createOpen: formWrites.createOpen,
    editing: formWrites.editing,
    deactivating: lifecycle.deactivating,
    openCreate: formWrites.openCreate,
    closeCreate: formWrites.closeCreate,
    openEdit: formWrites.openEdit,
    closeEdit: formWrites.closeEdit,
    openDeactivate: lifecycle.openDeactivate,
    closeDeactivate: lifecycle.closeDeactivate,
    create: formWrites.create,
    update: formWrites.update,
    deactivate: lifecycle.deactivate,
    reactivate: lifecycle.reactivate,
    setPage: filters.setPage,
    setPageSize: filters.setPageSize,
    setStatusFilter: filters.setStatusFilter,
    setCompanyFilter: filters.setCompanyFilter,
    setInclusiveFilter: filters.setInclusiveFilter,
    setSearch: filters.setSearch,
    clearAllFilters: filters.clearAllFilters,
    reload: () => load(),
  };
}
