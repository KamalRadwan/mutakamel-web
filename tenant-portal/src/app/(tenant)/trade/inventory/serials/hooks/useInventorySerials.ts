"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeGet } from "../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../trade-advanced-scope";
import { isUuidV7, parseTradeOffsetPage } from "../../../trade-advanced-validation";
import { useInventoryPagination } from "../../hooks/useInventoryPagination";
import { useInventoryReferences } from "../../hooks/useInventoryReferences";
import { INVENTORY_READ_PERMISSION, invalidResponse } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";
import { parseInventorySerial, serialsListPath, type InventorySerial, type SerialState } from "../../inventory-governance-contract";

interface SerialFilters { serialKey: string; state: SerialState | undefined; itemId: string; profileId: string }
const EMPTY_FILTERS: SerialFilters = { serialKey: "", state: undefined, itemId: "", profileId: "" };
type View = "table" | "card" | "board";

export function useInventorySerials() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const detailId = pathname.startsWith(`${TENANT_ROUTES.tradeInventorySerials}/`) ? pathname.slice(TENANT_ROUTES.tradeInventorySerials.length + 1) : undefined;
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const selectionKey = JSON.stringify([scope.headers, user?.id, realtimeAuthGeneration]);
  const scopeKey = JSON.stringify([selectionKey, lang]);
  const references = useInventoryReferences({ headers: scope.headers, scopeKey, enabled: scope.isResolved && canRead });
  const [filterState, setFilterState] = useState({ selectionKey, draft: EMPTY_FILTERS, filters: EMPTY_FILTERS });
  const draft = filterState.selectionKey === selectionKey ? filterState.draft : EMPTY_FILTERS;
  const filters = filterState.selectionKey === selectionKey ? filterState.filters : EMPTY_FILTERS;
  const [view, setView] = useState<View>("table");
  const queryKey = JSON.stringify([scopeKey, canRead, filters]);
  const { page, pagination, setPage, setTotal } = useInventoryPagination(queryKey);
  const requestKey = useMemo(() => ({ queryKey, page }), [queryKey, page]);
  const currentKey = useRef(requestKey);
  useLayoutEffect(() => { currentKey.current = requestKey; }, [requestKey]);
  const [result, setResult] = useState<{ key: typeof requestKey | null; items: InventorySerial[] }>({ key: null, items: [] });
  const [loadingKey, setLoadingKey] = useState<typeof requestKey | null>(null);
  const [failure, setFailure] = useState<{ key: typeof requestKey; error: NormalizedApiError } | null>(null);
  const [validationFailed, setValidationFailed] = useState(false);
  const validationError = validationFailed && draft.serialKey.trim().length > 120 ? t.tradeInventory.readViews.serialLengthError : null;
  const items = result.key === requestKey ? result.items : [];
  const queryError = failure?.key === requestKey ? failure.error : null;
  const isStale = items.length > 0 && Boolean(queryError && (queryError.status === 0 || queryError.status >= 500));
  const errorMessage = queryError ? inventoryMessage(queryError, t) ?? t.tradeInventory.serialsLoadFailed : undefined;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!scope.isResolved || !canRead) return;
    setLoadingKey(requestKey);
    setFailure(null);
    try {
      const response = await tradeGet(serialsListPath(filters.state, filters.serialKey || undefined, {
        itemId: filters.itemId || undefined, itemCompanyProfileId: filters.profileId || undefined,
      }, page), { signal, headers: scope.headers, maxResponseBytes: 200_000 });
      if (signal?.aborted || currentKey.current !== requestKey) return;
      const parsed = parseTradeOffsetPage(response.data, parseInventorySerial, invalidResponse);
      setResult({ key: requestKey, items: parsed.items });
      setTotal(parsed.total);
    } catch (error) {
      if (!signal?.aborted && currentKey.current === requestKey) setFailure({ key: requestKey, error: normalizeApiError(error) });
    } finally {
      if (!signal?.aborted && currentKey.current === requestKey) setLoadingKey(null);
    }
  }, [scope.isResolved, scope.headers, canRead, requestKey, filters, page, setTotal]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (result.key !== requestKey || !references.canCatalog) return;
    void Promise.allSettled([...new Set(result.items.map((item) => item.itemId))].map(references.ensureItem));
    void Promise.allSettled([...new Set(result.items.flatMap((item) => item.currentUomId ? [item.currentUomId] : []))].map(references.ensureUom));
  }, [result, requestKey, references.canCatalog, references.ensureItem, references.ensureUom]);

  const applyFilters = () => {
    if (draft.serialKey.trim().length > 120) { setValidationFailed(true); return; }
    setValidationFailed(false);
    setFilterState({ selectionKey, draft, filters: { ...draft, serialKey: draft.serialKey.trim() } });
  };
  const clearFilters = () => { setValidationFailed(false); setFilterState({ selectionKey, draft: EMPTY_FILTERS, filters: EMPTY_FILTERS }); };
  const setFilter = <K extends keyof SerialFilters>(key: K, value: SerialFilters[K]) => {
    setFilterState((previous) => {
      const active = previous.selectionKey === selectionKey ? previous : { selectionKey, draft: EMPTY_FILTERS, filters: EMPTY_FILTERS };
      return { ...active, draft: { ...active.draft, [key]: value, ...(key === "itemId" ? { profileId: "" } : {}) } };
    });
  };
  // Next16's native-history integration preserves the list and its focus target.
  const openSerial = (id: string) => {
    if (!isUuidV7(id)) return;
    const target = `${TENANT_ROUTES.tradeInventorySerials}/${encodeURIComponent(id)}`;
    if (window.location.pathname === target) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body && active !== document.documentElement ? active : null;
    window.history.pushState(null, "", target);
  };
  const closeSerial = () => window.history.replaceState(null, "", TENANT_ROUTES.tradeInventorySerials);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const target = returnFocus.current?.isConnected ? returnFocus.current : headingRef.current;
    target?.focus({ preventScroll: true });
  };
  return { t, lang, canRead, isScopeResolved: scope.isResolved, branchIds, branchId, selectBranch,
    items, pagination, setPage, draft, filters, view, setView, setFilter, applyFilters, clearFilters,
    validationError, references, queryError, isStale, errorMessage, isLoading: scope.isResolved && canRead && result.key !== requestKey && !queryError,
    isRefreshing: loadingKey === requestKey, reload: () => load(), openSerial, closeSerial,
    detailId, headingRef, restoreFocus };
}
