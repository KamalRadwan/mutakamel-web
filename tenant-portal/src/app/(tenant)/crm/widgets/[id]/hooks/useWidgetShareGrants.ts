"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { WIDGET_SHARE_TARGETS_PATH, widgetPath } from "../../../dashboards/widget-contract";
import { buildShareRequest, parseShareTargetsResponse, parseSharesResponse, resourceSharePath, resourceSharesPath, shareTargetsQuery, type ShareRecord, type ShareTarget, type ShareAccessLevel, type ShareSubjectType } from "../../../dashboards/share-contract";
import { useWidgetSafety, type WidgetWriteTicket } from "../../hooks/useWidgetSafety";
import { WIDGET_READ, WIDGET_WRITE, assertWidgetStatus, uncertainWidgetWrite } from "../../hooks/widget-requests";
interface ShareOutcome { ok: boolean; error: NormalizedApiError | null; uncertain?: boolean; refreshed?: boolean; stale?: boolean; }
export function useWidgetShareGrants(widgetId: string, enabled: boolean) {
  const safety = useWidgetSafety("widget-shares:" + widgetId);
  const { scope, startRead, currentRead, reconciled } = safety;
  const path = widgetPath(widgetId);
  const [snapshot, setSnapshot] = useState<{ scope: string; rows: ShareRecord[] } | null>(null);
  const [readState, setRead] = useState<{ scope: string; busy?: boolean; error?: NormalizedApiError } | null>(null);
  const [targetState, setTargets] = useState<{ scope: string; query: string; rows: ShareTarget[]; next: number | null; error?: NormalizedApiError; busy?: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const targetsSequence = useRef(0);
  const targetsRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (signal?: AbortSignal, write?: WidgetWriteTicket) => {
    const ticket = enabled ? startRead(write) : null;
    if (!ticket) return false;
    setRead({ scope, busy: true });
    try {
      const response = await axiosClient.get<unknown>(resourceSharesPath(path), { ...WIDGET_READ, signal });
      if (signal?.aborted || !currentRead(ticket)) return false;
      assertWidgetStatus(response, 200);
      const rows = parseSharesResponse(response.data);
      setSnapshot({ scope, rows }); setRead({ scope }); reconciled(ticket); return true;
    } catch (caught) { if (!signal?.aborted && currentRead(ticket)) setRead({ scope, error: normalizeApiError(caught) }); return false; }
  }, [scope, path, enabled, startRead, currentRead, reconciled]);
  useEffect(() => {
    const controller = new AbortController();
    const sequence = targetsSequence;
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => { controller.abort(); targetsRequest.current?.abort(); sequence.current++; };
  }, [load]);
  const searchTargets = async (query: string, offset = 0) => {
    if (!enabled || !safety.isCurrent()) return;
    const seq = ++targetsSequence.current;
    targetsRequest.current?.abort();
    const controller = new AbortController(); targetsRequest.current = controller;
    const search = query.trim().slice(0, 80);
    const existing = offset && targetState?.scope === scope && targetState.query === search ? targetState.rows : [];
    setTargets({ scope, query: search, rows: existing, next: null, busy: true });
    try {
      const response = await axiosClient.get<unknown>(WIDGET_SHARE_TARGETS_PATH + shareTargetsQuery(search, offset), { ...WIDGET_READ, signal: controller.signal });
      if (controller.signal.aborted || seq !== targetsSequence.current || !safety.isCurrent()) return;
      assertWidgetStatus(response, 200);
      const page = parseShareTargetsResponse(response.data);
      const merged = [...new Map([...existing, ...page.items].map((target) => [target.type + ":" + target.id, target])).values()];
      setTargets({ scope, query: search, rows: merged, next: page.nextOffset });
    } catch (caught) {
      if (!controller.signal.aborted && seq === targetsSequence.current && safety.isCurrent()) setTargets({ scope, query: search, rows: existing, next: offset || null, error: normalizeApiError(caught) });
    }
  };
  const mutate = async (input: { subjectType: ShareSubjectType; subjectId: string; accessLevel: ShareAccessLevel; expiresAt: string } | { revoke: string }): Promise<ShareOutcome> => {
    const no = { ok: false, error: null };
    if (!enabled || denied === scope || snapshot?.scope !== scope || readState?.error || readState?.busy) return no;
    if ("revoke" in input && !snapshot.rows.some((row) => row.id === input.revoke)) return no;
    let body: Record<string, unknown> | null = null;
    try { if (!("revoke" in input)) body = buildShareRequest(input); }
    catch (caught) { return { ok: false, error: { status: 422, code: caught instanceof Error ? caught.message : "CRM_SHARE_TARGET_INVALID" } }; }
    const ticket = safety.beginWrite(true);
    if (!ticket) return no;
    setPending(scope);
    try {
      const response = "revoke" in input
        ? await axiosClient.delete<unknown>(resourceSharePath(path, input.revoke), WIDGET_WRITE)
        : await axiosClient.post<unknown>(resourceSharesPath(path), body, WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) throw new Error("Widget share scope changed.");
      if ("revoke" in input) assertWidgetStatus(response, 204);
      else {
        assertWidgetStatus(response, 201);
        const receipt = parseSharesResponse([response.data])[0];
        if (!receipt || receipt.subjectId !== input.subjectId || receipt.subjectType !== input.subjectType || receipt.accessLevel !== input.accessLevel
          || (input.expiresAt ? Date.parse(receipt.expiresAt ?? "") !== Date.parse(input.expiresAt) : receipt.expiresAt !== null)) throw new Error("Widget share receipt does not match.");
      }
      const refreshed = await load(undefined, ticket);
      if (!refreshed) safety.fence(ticket);
      return { ok: true, error: null, refreshed };
    } catch (caught) {
      const error = normalizeApiError(caught);
      if (error.status === 403) setDenied(scope);
      const uncertain = uncertainWidgetWrite(error);
      if (uncertain) { safety.fence(ticket); await load(undefined, ticket); }
      return { ok: false, error, uncertain, stale: !safety.currentWrite(ticket) };
    } finally { const active = safety.currentWrite(ticket); safety.finish(ticket); if (active) setPending(null); }
  };
  const currentTargets = enabled && targetState?.scope === scope ? targetState : null;
  const error = enabled && readState?.scope === scope ? readState.error ?? null : null;
  return { scope, shares: enabled && snapshot?.scope === scope && error?.status !== 403 ? snapshot.rows : [],
    targets: currentTargets?.rows ?? [], targetsError: currentTargets?.error ?? null, targetsLoading: currentTargets?.busy ?? false,
    targetsHasMore: currentTargets?.next != null, targetsQuery: currentTargets?.query ?? "",
    targetsMore: () => currentTargets?.next != null ? searchTargets(currentTargets.query, currentTargets.next) : Promise.resolve(),
    isLoading: enabled && (snapshot?.scope !== scope && !error || readState?.scope === scope && readState.busy === true),
    isSubmitting: pending === scope, error, searchTargets, reload: () => load(),
    needsReview: enabled && safety.unresolved, reviewReady: enabled && safety.reviewedRead, review: safety.review,
    blocked: !enabled || safety.busy || safety.blocked || denied === scope || !!error,
    share: (input: { subjectType: ShareSubjectType; subjectId: string; accessLevel: ShareAccessLevel; expiresAt: string }) => mutate(input),
    revoke: (id: string) => mutate({ revoke: id }) };
}

