"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch } from "../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../trade-advanced-scope";
import { parseTradeOffsetPage } from "../../../trade-advanced-validation";
import { useInventoryPagination } from "../../hooks/useInventoryPagination";
import { useInventoryWriteIntent } from "../../hooks/useInventoryWriteIntent";
import { INVENTORY_GOVERNANCE_PERMISSION, INVENTORY_READ_PERMISSION, invalidResponse } from "../../inventory-contract";
import { INVENTORY_PERIODS_PATH, buildCreatePeriodRequest, buildReasonCode, parseInventoryPeriod, periodActionPath, periodsListPath,
  type InventoryPeriod, type PeriodFormValues, type PeriodStatus } from "../../inventory-governance-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";

type Action = "close" | "reopen";
export function useInventoryPeriods() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);
  const { post, complete, hasPending, retry, canRetry } = useInventoryWriteIntent(JSON.stringify([user?.id, realtimeAuthGeneration, branchId]));
  const identityKey = JSON.stringify([scope.headers, branchId, user?.id, realtimeAuthGeneration, lang]);
  const identity = useMemo(() => ({ key: identityKey }), [identityKey]);
  const currentScope = useRef(identity);
  useLayoutEffect(() => { currentScope.current = identity; }, [identity]);
  const [filterState, setFilterState] = useState<{ identity: typeof identity; status?: PeriodStatus; effectiveAt: string }>({ identity, effectiveAt: "" });
  const [appliedState, setAppliedState] = useState(filterState);
  const statusFilter = filterState.identity === identity ? filterState.status : undefined;
  const effectiveAtFilter = filterState.identity === identity ? filterState.effectiveAt : "";
  const appliedStatus = appliedState.identity === identity ? appliedState.status : undefined;
  const appliedEffectiveAt = appliedState.identity === identity ? appliedState.effectiveAt : "";
  const { page, pagination, setPage, setTotal } = useInventoryPagination(JSON.stringify([identityKey, appliedStatus, appliedEffectiveAt]));
  const request = useMemo(() => ({ identity, status: appliedStatus, effectiveAt: appliedEffectiveAt, page }), [identity, appliedStatus, appliedEffectiveAt, page]);
  const currentRequest = useRef(request);
  useLayoutEffect(() => { currentRequest.current = request; }, [request]);
  const [result, setResult] = useState<{ request: typeof request | null; items: InventoryPeriod[] }>({ request: null, items: [] });
  const [failure, setFailure] = useState<{ request: typeof request; error: NormalizedApiError } | null>(null);
  const [loading, setLoading] = useState<typeof request | null>(null);
  const [createScope, setCreateScope] = useState<typeof identity | null>(null);
  const [draft, setDraft] = useState<{ identity: typeof identity; values: PeriodFormValues } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFailure, setFormFailure] = useState<{ identity: typeof identity; message: string } | null>(null);
  const [transitionState, setTransitionState] = useState<{ identity: typeof identity; target: InventoryPeriod; id: string; action: Action } | null>(null);
  const transition = transitionState?.identity === identity ? transitionState : null;
  const [pending, setPending] = useState<string | null>(null);
  const [transitionFailure, setTransitionFailure] = useState<{ identity: typeof identity; message: string } | null>(null);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const canManage = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_GOVERNANCE_PERMISSION);
  const queryError = failure?.request === request ? failure.error : null;
  const people = useUserProfiles(result.request === request ? result.items.flatMap((row) => row.closedBy ? [row.closedBy] : []) : [], canRead && scope.isResolved);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!scope.isResolved || !canRead) return;
    setLoading(request); setFailure(null);
    try {
      const response = await tradeGet(periodsListPath(appliedStatus, appliedEffectiveAt, page), { headers: scope.headers, signal, maxResponseBytes: 120_000 });
      if (signal?.aborted || currentRequest.current !== request) return;
      const parsed = parseTradeOffsetPage(response.data, parseInventoryPeriod, invalidResponse);
      setResult({ request, items: parsed.items }); setTotal(parsed.total);
    } catch (error) { if (!signal?.aborted && currentRequest.current === request) setFailure({ request, error: normalizeApiError(error) }); }
    finally { if (!signal?.aborted && currentRequest.current === request) setLoading(null); }
  }, [scope.isResolved, scope.headers, canRead, request, appliedStatus, appliedEffectiveAt, page, setTotal]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  const create = useCallback(async (values?: PeriodFormValues) => {
    if (!canManage || isSubmitting) return false;
    setIsSubmitting(true); setFormFailure(null);
    if (values && !hasPending()) setDraft({ identity, values });
    try {
      const response = values ? await post(INVENTORY_PERIODS_PATH, buildCreatePeriodRequest(values), scope.headers, 20_000) : await retry(INVENTORY_PERIODS_PATH, scope.headers);
      parseInventoryPeriod(response.data); complete();
      if (currentScope.current !== identity) return false;
      setCreateScope(null); setDraft(null); toast.success(t.tradeCommon.savedTitle, isTradeReplay(response.headers) ? t.tradeCommon.replayedDescription : t.tradeInventory.periodCreated);
      await load(); return true;
    } catch (error) { const normalized = normalizeApiError(error); if (currentScope.current === identity) setFormFailure({ identity, message: inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t) }); return false; }
    finally { setIsSubmitting(false); }
  }, [canManage, isSubmitting, post, complete, hasPending, retry, scope.headers, identity, t, toast, load]);
  const runTransition = useCallback(async (reason?: string) => {
    if (!canManage || !transition || pending) return;
    setPending(transition.id); setTransitionFailure(null);
    try {
      const path = periodActionPath(transition.id, transition.action);
      const headers = { ...scope.headers, "If-Match": tradeIfMatch(transition.target.version) };
      const response = reason === undefined ? await retry(path, headers) : await post(path, buildReasonCode(reason), headers, 20_000);
      parseInventoryPeriod(response.data); complete();
      if (currentScope.current !== identity) return;
      setTransitionState(null); toast.success(t.tradeCommon.savedTitle, t.tradeInventory.periodTransitioned); await load();
    } catch (error) { const normalized = normalizeApiError(error); if (currentScope.current === identity) setTransitionFailure({ identity, message: inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t) }); }
    finally { setPending(null); }
  }, [canManage, transition, pending, post, complete, retry, scope.headers, identity, t, toast, load]);
  const setStatusFilter = (status?: PeriodStatus) => setFilterState((previous) => ({ identity, status, effectiveAt: previous.identity === identity ? previous.effectiveAt : "" }));
  const setEffectiveAtFilter = (effectiveAt: string) => setFilterState((previous) => ({ identity, status: previous.identity === identity ? previous.status : undefined, effectiveAt }));
  return { t, lang, canRead, canManage, scopeKey: identityKey, scopeIdentity: identity, isScopeResolved: scope.isResolved, branchIds, branchId, selectBranch,
    items: result.request === request ? result.items : [], actorLabel: (id?: string | null) => id ? people.profiles.get(id)?.profile?.fullName ?? t.common.nameUnavailable : t.tradeCommon.notSet,
    pagination, setPage, statusFilter, effectiveAtFilter, setStatusFilter, setEffectiveAtFilter,
    applyFilters: () => { setAppliedState({ identity, status: statusFilter, effectiveAt: effectiveAtFilter }); setPage(1); },
    clearFilters: () => { const clear = { identity, status: undefined, effectiveAt: "" }; setFilterState(clear); setAppliedState(clear); setPage(1); },
    isLoading: scope.isResolved && canRead && result.request !== request && !queryError, isRefreshing: loading === request, hasLoaded: result.request === request, queryError,
    createOpen: createScope === identity, isSubmitting, formError: formFailure?.identity === identity ? formFailure.message : null,
    unresolved: !isSubmitting && hasPending(), createDraft: draft?.identity === identity ? draft.values : undefined,
    retryOriginal: () => create(), canRetryOriginal: canRetry(INVENTORY_PERIODS_PATH, scope.headers),
    pending, transition, transitionError: transitionFailure?.identity === identity ? transitionFailure.message : null,
    transitionUnresolved: !pending && Boolean(transition && canRetry(periodActionPath(transition.id, transition.action), { ...scope.headers, "If-Match": tradeIfMatch(transition.target.version) })),
    openCreate: () => { setFormFailure(null); setCreateScope(identity); }, closeCreate: () => { if (!isSubmitting && !canRetry(INVENTORY_PERIODS_PATH, scope.headers)) { setCreateScope(null); setDraft(null); } }, create, runTransition,
    openTransition: (target: InventoryPeriod, action: Action) => { setTransitionFailure(null); setTransitionState({ identity, target, id: target.id, action }); },
    closeTransition: () => { if (!pending && !hasPending()) setTransitionState(null); }, reload: () => load() };
}
