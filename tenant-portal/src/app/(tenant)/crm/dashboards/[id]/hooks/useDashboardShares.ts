"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { DASHBOARD_SHARE_TARGETS_PATH, dashboardPath } from "../../dashboard-contract";
import { buildShareRequest, parseShareTargetsResponse, parseSharesResponse, resourceSharePath, resourceSharesPath, shareTargetsQuery,
  type ShareAccessLevel, type ShareRecord, type ShareSubjectType, type ShareTarget } from "../../share-contract";
import { dashboardWriteDenied, invalidDashboardReceipt, uncertainDashboardWrite, useDashboardSafety } from "../../hooks/useDashboardSafety";
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = { ...READ_CONFIG, nonReplayable: true } as const;
export interface ShareWriteResult { ok: boolean; error: NormalizedApiError | null; refreshFailed?: boolean; }
export function useDashboardShares(dashboardId: string, enabled: boolean) {
  const safety = useDashboardSafety(`shares:${dashboardId}`);
  const targetsSafety = useDashboardSafety(`share-targets:${dashboardId}`);
  const { scope, startRead, currentRead, readSettled, readSucceeded } = safety;
  const [shares, setShares] = useState<ShareRecord[]>([]); const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [dataScope, setDataScope] = useState<object | null>(null); const [targetScope, setTargetScope] = useState<object | null>(null);
  const [isLoading, setIsLoading] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null); const [targetSearchError, setTargetSearchError] = useState<NormalizedApiError | null>(null);
  const request = useRef<AbortController | null>(null); const targetRequest = useRef<AbortController | null>(null); const searchRef = useRef("");
  const resourcePath = dashboardPath(dashboardId);
  const load = useCallback(async (): Promise<boolean> => {
    const ticket = enabled ? startRead() : null; if (!ticket) return false;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setIsLoading(true); setError(null);
    try {
      const response = await axiosClient.get<unknown>(resourceSharesPath(resourcePath), { ...READ_CONFIG, signal: controller.signal });
      const parsed = parseSharesResponse(response.data);
      if (controller.signal.aborted || !currentRead(ticket)) return false;
      setShares(parsed); setDataScope(scope); readSucceeded(); return true;
    } catch (caught) { if (!controller.signal.aborted && currentRead(ticket)) { setError(normalizeApiError(caught)); setDataScope(scope); } return false; }
    finally { if (!controller.signal.aborted && readSettled(ticket)) setIsLoading(false); }
  }, [enabled, resourcePath, scope, startRead, currentRead, readSettled, readSucceeded]);
  useEffect(() => {
    const controller = new AbortController(); const requests = { list: request, targets: targetRequest };
    queueMicrotask(() => { if (!controller.signal.aborted) void load(); });
    return () => { controller.abort(); requests.list.current?.abort(); requests.targets.current?.abort(); };
  }, [load]);
  const searchTargets = async (search: string) => {
    searchRef.current = search; const ticket = enabled ? targetsSafety.startRead() : null; if (!ticket) return;
    targetRequest.current?.abort(); const controller = new AbortController(); targetRequest.current = controller;
    setTargetSearchError(null);
    try {
      const response = await axiosClient.get<unknown>(`${DASHBOARD_SHARE_TARGETS_PATH}${shareTargetsQuery(search, 0)}`, { ...READ_CONFIG, signal: controller.signal });
      const parsed = parseShareTargetsResponse(response.data).items;
      if (controller.signal.aborted || !targetsSafety.currentRead(ticket)) return;
      setTargets(parsed); setTargetScope(scope);
    } catch (caught) { if (!controller.signal.aborted && targetsSafety.currentRead(ticket)) { setTargets([]); setTargetScope(scope); setTargetSearchError(normalizeApiError(caught)); } }
  };
  async function write(call: () => Promise<{ status: number; data: unknown }>, validate: (data: unknown, status: number) => void): Promise<ShareWriteResult> {
    const ticket = safety.beginWrite(enabled); if (!ticket) return { ok: false, error: enabled && safety.canMutate ? null : dashboardWriteDenied() };
    setIsSubmitting(true);
    try { const response = await call(); validate(response.data, response.status); if (!safety.currentWrite(ticket)) return { ok: false, error: null }; }
    catch (caught) { const normalized = normalizeApiError(caught); if (uncertainDashboardWrite(normalized)) safety.fence(ticket); return { ok: false, error: safety.currentWrite(ticket) ? normalized : null }; }
    finally { safety.finish(ticket); setIsSubmitting(false); }
    const refreshed = await load();
    return safety.isScopeCurrent() ? { ok: true, error: null, refreshFailed: !refreshed } : { ok: false, error: null };
  }
  const share = async (input: { subjectType: ShareSubjectType; subjectId: string; accessLevel: ShareAccessLevel; expiresAt: string }): Promise<ShareWriteResult> => {
    let body: Record<string, unknown>;
    try { body = buildShareRequest(input); } catch (caught) { return { ok: false, error: { status: 0, code: caught instanceof Error ? caught.message : "INVALID_INPUT" } }; }
    return write(() => axiosClient.post<unknown>(resourceSharesPath(resourcePath), body, WRITE_CONFIG), (data) => {
      const receipt = parseSharesResponse([data])[0];
      if (!receipt || receipt.subjectType !== input.subjectType || receipt.subjectId !== input.subjectId || receipt.accessLevel !== input.accessLevel
        || (receipt.expiresAt ? new Date(receipt.expiresAt).getTime() : null) !== (input.expiresAt ? new Date(input.expiresAt).getTime() : null)) invalidDashboardReceipt();
    });
  };
  const revoke = async (id: string) => write(() => axiosClient.delete<unknown>(resourceSharePath(resourcePath, id), WRITE_CONFIG), (data, status) => {
    if (status !== 204 || (data !== undefined && data !== null && data !== "")) invalidDashboardReceipt();
  });
  return { shares: enabled && dataScope === scope ? shares : [], targets: enabled && targetScope === scope ? targets : [],
    isLoading, isSubmitting, error: dataScope === scope ? error : null, targetSearchError: targetScope === scope ? targetSearchError : null,
    needsReconciliation: safety.blocked, reviewReady: safety.reviewReady, acknowledge: safety.acknowledge,
    searchTargets, retrySearchTargets: () => void searchTargets(searchRef.current), share, revoke, reload: load };
}

