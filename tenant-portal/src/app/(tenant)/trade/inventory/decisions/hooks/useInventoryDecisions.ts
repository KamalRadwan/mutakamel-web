"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeGet } from "../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../trade-advanced-scope";
import { isUuidV7, parseTradeOffsetPage, tradeStatusLabel } from "../../../trade-advanced-validation";
import { useInventoryPagination } from "../../hooks/useInventoryPagination";
import { INVENTORY_READ_PERMISSION, invalidResponse } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";
import { inventoryDecisionsListPath, parseInventoryDecision, type InventoryDecision, type InventoryPolicyKind } from "../../inventory-governance-contract";

interface DecisionFilters { policyKind: InventoryPolicyKind | undefined; aggregateId: string }
const EMPTY: DecisionFilters = { policyKind: undefined, aggregateId: "" };

export function useInventoryDecisions() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const detailId = pathname.startsWith(`${TENANT_ROUTES.tradeInventoryDecisions}/`) ? pathname.slice(TENANT_ROUTES.tradeInventoryDecisions.length + 1) : undefined;
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const selectionKey = JSON.stringify([scope.headers, user?.id, realtimeAuthGeneration]);
  const [filterState, setFilterState] = useState({ selectionKey, draft: EMPTY, filters: EMPTY });
  const draft = filterState.selectionKey === selectionKey ? filterState.draft : EMPTY;
  const filters = filterState.selectionKey === selectionKey ? filterState.filters : EMPTY;
  const [view, setView] = useState<"table" | "card">("table");
  const [referenceFailed, setReferenceFailed] = useState(false);
  const referenceError = referenceFailed && draft.aggregateId.trim() && !isUuidV7(draft.aggregateId.trim()) ? t.tradeInventory.readViews.referenceInvalid : null;
  const queryKey = JSON.stringify([scope.headers, user?.id, realtimeAuthGeneration, canRead, lang, filters]);
  const { page, pagination, setPage, setTotal } = useInventoryPagination(queryKey);
  const key = useMemo(() => ({ queryKey, page }), [queryKey, page]);
  const currentKey = useRef(key);
  useLayoutEffect(() => { currentKey.current = key; }, [key]);
  const [result, setResult] = useState<{ key: typeof key | null; items: InventoryDecision[] }>({ key: null, items: [] });
  const [failure, setFailure] = useState<{ key: typeof key; error: NormalizedApiError } | null>(null);
  const [pending, setPending] = useState<typeof key | null>(null);
  const items = useMemo(() => result.key === key ? result.items : [], [result, key]);
  const queryError = failure?.key === key ? failure.error : null;
  const isStale = items.length > 0 && Boolean(queryError && (queryError.status === 0 || queryError.status >= 500));
  const errorMessage = queryError ? inventoryMessage(queryError, t) ?? t.tradeInventory.decisionsLoadFailed : undefined;
  const branches = useTenantOrganizationOptions("branch", useMemo(() => [...new Set(items.flatMap((item) => item.branchId ? [item.branchId] : []))], [items]));

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!scope.isResolved || !canRead) return;
    setPending(key);
    setFailure(null);
    try {
      const response = await tradeGet(inventoryDecisionsListPath(filters.policyKind, filters.aggregateId || undefined, page), {
        signal, headers: scope.headers, maxResponseBytes: 500_000,
      });
      if (signal?.aborted || currentKey.current !== key) return;
      const parsed = parseTradeOffsetPage(response.data, parseInventoryDecision, invalidResponse);
      setResult({ key, items: parsed.items });
      setTotal(parsed.total);
    } catch (error) {
      if (!signal?.aborted && currentKey.current === key) setFailure({ key, error: normalizeApiError(error) });
    } finally { if (!signal?.aborted && currentKey.current === key) setPending(null); }
  }, [scope.isResolved, scope.headers, canRead, key, filters, page, setTotal]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  const aggregateLabel = (type: string) => tradeStatusLabel(t.tradeInventory.readViews.aggregates, type, t.common.unknownCode);
  const sourceOptions = [...new Map(items.filter((item) => item.aggregateId).map((item) => [item.aggregateId, {
    value: item.aggregateId, label: `${aggregateLabel(item.aggregateType)} · ${formatDateTime(item.evaluatedAt, lang)}`,
  }])).values()];
  const applyFilters = () => {
    const reference = draft.aggregateId.trim();
    if (reference && !isUuidV7(reference)) { setReferenceFailed(true); return; }
    setReferenceFailed(false);
    setFilterState({ selectionKey, draft, filters: { ...draft, aggregateId: reference } });
  };
  const clearFilters = () => { setReferenceFailed(false); setFilterState({ selectionKey, draft: EMPTY, filters: EMPTY }); };
  const setFilter = <K extends keyof DecisionFilters>(field: K, value: DecisionFilters[K]) => setFilterState((previous) => {
    const active = previous.selectionKey === selectionKey ? previous : { selectionKey, draft: EMPTY, filters: EMPTY };
    return { ...active, draft: { ...active.draft, [field]: value } };
  });
  const openDecision = (id: string) => {
    if (!isUuidV7(id)) return;
    const target = `${TENANT_ROUTES.tradeInventoryDecisions}/${encodeURIComponent(id)}`;
    if (window.location.pathname === target) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body && active !== document.documentElement ? active : null;
    window.history.pushState(null, "", target);
  };
  const closeDecision = () => window.history.replaceState(null, "", TENANT_ROUTES.tradeInventoryDecisions);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const target = returnFocus.current?.isConnected ? returnFocus.current : headingRef.current;
    target?.focus({ preventScroll: true });
  };
  const branchLabel = (id: string | null) => id ? branches.find((branch) => branch.value === id)?.label ?? t.common.nameUnavailable : t.tradeInventory.readViews.notSet;
  return { t, lang, canRead, isScopeResolved: scope.isResolved, branchIds, branchId, selectBranch, items, pagination, setPage,
    draft, filters, view, setView, setFilter, applyFilters, clearFilters, referenceError, sourceOptions, aggregateLabel, branchLabel,
    queryError, isStale, errorMessage, isLoading: scope.isResolved && canRead && result.key !== key && !queryError, isRefreshing: pending === key,
    reload: () => load(), openDecision, closeDecision, detailId, headingRef, restoreFocus };
}
