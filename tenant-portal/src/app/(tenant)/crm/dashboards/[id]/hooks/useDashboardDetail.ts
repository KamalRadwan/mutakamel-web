"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { buildUpdateDashboardRequest, dashboardPath, dashboardRunPath, parseDashboardDetailResponse, type DashboardDetail } from "../../dashboard-contract";
import { buildRunRequest, currenciesInRun, parseRunResponse, type DashboardFilterSelection, type DashboardRunResult } from "../../dashboard-run-contract";
import { dashboardWriteDenied, invalidDashboardReceipt, uncertainDashboardWrite, useDashboardSafety } from "../../hooks/useDashboardSafety";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 4 * 1024 * 1024 } as const;
const WRITE_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024, nonReplayable: true } as const;
const EMPTY_SELECTION: DashboardFilterSelection = { datePreset: null, compare: null, branchId: null, currencyCode: null };
export interface DashboardMutationResult { ok: boolean; conflict: boolean; error: NormalizedApiError | null; refreshFailed?: boolean; ignored?: boolean; }
export function isRevisionConflict(error: NormalizedApiError | null): boolean {
  return error?.status === 409 && ["CRM_DASHBOARD_REVISION_CONFLICT", "CRM_DASHBOARD_LAYOUT_STALE"].includes(error.code ?? "");
}

export function useDashboardDetail(dashboardId: string) {
  const { user } = useTenantAuth();
  const safety = useDashboardSafety(`dashboard:${dashboardId}`);
  const { scope, startRead, currentRead, readSettled, readSucceeded, beginWrite, currentWrite, finish, fence } = safety;
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [run, setRun] = useState<DashboardRunResult | null>(null);
  const [dataScope, setDataScope] = useState<object | null>(null);
  const [runScope, setRunScope] = useState<object | null>(null);
  const [attemptScope, setAttemptScope] = useState<object | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detailError, setDetailError] = useState<NormalizedApiError | null>(null);
  const [runError, setRunError] = useState<NormalizedApiError | null>(null);
  const [selectionState, setSelection] = useState({ scope, value: EMPTY_SELECTION });
  const selection = selectionState.scope === scope ? selectionState.value : EMPTY_SELECTION;
  const definitionRequest = useRef<AbortController | null>(null);
  const runRequest = useRef<AbortController | null>(null);
  const runEpoch = useRef(0);
  const visibleDetail = dataScope === scope && detail?.id === dashboardId ? detail : null;
  const visibleRun = runScope === scope && run?.dashboardId === dashboardId ? run : null;

  const load = useCallback(async (filters: DashboardFilterSelection): Promise<boolean> => {
    const ticket = startRead();
    if (!ticket) return false;
    definitionRequest.current?.abort(); runRequest.current?.abort();
    const controller = new AbortController();
    const executionController = new AbortController();
    definitionRequest.current = controller; runRequest.current = executionController;
    const epoch = ++runEpoch.current;
    setIsLoading(true); setIsRunning(true); setDetailError(null); setRunError(null);
    const [definition, execution] = await Promise.allSettled([
      axiosClient.get<unknown>(dashboardPath(dashboardId), { ...READ_CONFIG, signal: controller.signal }),
      axiosClient.post<unknown>(dashboardRunPath(dashboardId), buildRunRequest(filters, true), { ...READ_CONFIG, signal: executionController.signal, skipAutoIdempotency: true }),
    ]);
    if (controller.signal.aborted || !currentRead(ticket)) {
      if (!controller.signal.aborted && readSettled(ticket)) { setAttemptScope(scope); setIsLoading(false); if (epoch === runEpoch.current) setIsRunning(false); }
      return false;
    }
    let confirmed = false;
    try {
      if (definition.status === "rejected") throw definition.reason;
      const parsed = parseDashboardDetailResponse(definition.value.data);
      if (parsed.id !== dashboardId) invalidDashboardReceipt();
      setDetail(parsed); setDataScope(scope); readSucceeded(); confirmed = true;
    } catch (error) { setDetailError(normalizeApiError(error)); }
    setAttemptScope(scope); setIsLoading(false);
    if (epoch !== runEpoch.current || executionController.signal.aborted) return false;
    try {
      if (execution.status === "rejected") throw execution.reason;
      const parsed = parseRunResponse(execution.value.data, filters);
      if (parsed.dashboardId !== dashboardId) invalidDashboardReceipt();
      setRun(parsed); setRunScope(scope);
    } catch (error) { setRun(null); setRunError(normalizeApiError(error)); }
    setIsRunning(false);
    return confirmed;
  }, [dashboardId, scope, startRead, currentRead, readSettled, readSucceeded]);

  useEffect(() => {
    const controller = new AbortController();
    const requests = { definition: definitionRequest, execution: runRequest, epoch: runEpoch };
    queueMicrotask(() => { if (!controller.signal.aborted) void load(EMPTY_SELECTION); });
    return () => { controller.abort(); requests.definition.current?.abort(); requests.execution.current?.abort(); ++requests.epoch.current; };
  }, [load]);

  const rerun = useCallback(async (filters: DashboardFilterSelection): Promise<void> => {
    const ticket = startRead();
    if (!ticket) return;
    runRequest.current?.abort();
    const controller = new AbortController(); runRequest.current = controller;
    const epoch = ++runEpoch.current;
    setSelection({ scope, value: filters }); setRun(null); setIsRunning(true); setRunError(null);
    try {
      const response = await axiosClient.post<unknown>(dashboardRunPath(dashboardId), buildRunRequest(filters, true), { ...READ_CONFIG, signal: controller.signal, skipAutoIdempotency: true });
      if (epoch !== runEpoch.current || controller.signal.aborted || !currentRead(ticket)) return;
      const parsed = parseRunResponse(response.data, filters);
      if (parsed.dashboardId !== dashboardId) invalidDashboardReceipt();
      setRun(parsed); setRunScope(scope);
    } catch (error) {
      if (epoch !== runEpoch.current || controller.signal.aborted || !currentRead(ticket)) return;
      setRunError(normalizeApiError(error));
    } finally { if (epoch === runEpoch.current && !controller.signal.aborted) setIsRunning(false); }
  }, [dashboardId, scope, startRead, currentRead]);

  const rename = async (name: string, description: string): Promise<DashboardMutationResult> => {
    const allowed = visibleDetail && ["OWNER", "EDIT"].includes(visibleDetail.accessLevel)
      && (user?.isTenantOwner || hasPermission(user?.permissions ?? [], "crm.dashboards.update"));
    let body: Record<string, unknown>;
    try { if (!visibleDetail) return { ok: false, conflict: false, error: null }; body = buildUpdateDashboardRequest({ revision: visibleDetail.revision, name, description }); }
    catch (error) { return { ok: false, conflict: false, error: { status: 0, code: error instanceof Error ? error.message : "INVALID_INPUT" } }; }
    const ticket = beginWrite(Boolean(allowed));
    if (!ticket) return allowed && safety.canMutate ? { ok: false, conflict: false, error: null, ignored: true } : { ok: false, conflict: false, error: dashboardWriteDenied() };
    setIsSaving(true);
    try {
      const response = await axiosClient.patch<unknown>(dashboardPath(dashboardId), body, WRITE_CONFIG);
      const parsed = parseDashboardDetailResponse(response.data);
      if (parsed.id !== dashboardId || parsed.revision <= visibleDetail.revision || parsed.name !== name.trim() || (parsed.description ?? "") !== description.trim()) invalidDashboardReceipt();
      if (!currentWrite(ticket)) return { ok: false, conflict: false, error: null, ignored: true };
      setDetail(parsed); setDataScope(scope);
      return { ok: true, conflict: false, error: null };
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (uncertainDashboardWrite(normalized)) fence(ticket);
      if (!currentWrite(ticket)) return { ok: false, conflict: false, error: null, ignored: true };
      return { ok: false, conflict: isRevisionConflict(normalized), error: normalized };
    } finally { finish(ticket); setIsSaving(false); }
  };
  const availableCurrencies = useMemo(() => currenciesInRun(visibleRun), [visibleRun]);
  return { detail: visibleDetail, run: visibleRun, selection, availableCurrencies,
    isLoading: attemptScope !== scope || isLoading, isRunning, isSaving,
    detailError: attemptScope === scope ? detailError : null, runError: attemptScope === scope ? runError : null,
    needsReconciliation: safety.blocked, reviewReady: safety.reviewReady, acknowledge: safety.acknowledge,
    rename, rerun, reload: async () => { await load(selection); }, reloadConfirmed: () => load(selection) };
}


