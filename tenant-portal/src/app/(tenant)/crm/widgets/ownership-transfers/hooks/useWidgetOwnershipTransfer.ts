"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useWidgetSafety } from "../../hooks/useWidgetSafety";
import { assertWidgetStatus, WIDGET_READ, WIDGET_WRITE } from "../../hooks/widget-requests";
import {
  parseTransferImpact, parseTransferTargetPage, parseTransferWidget, transferPrecondition,
  verifyTransferReceipt, widgetTransferPath, widgetTransferSearchPath, WIDGET_TRANSFER_REASON_LIMIT,
  type TransferImpact, type TransferTarget, type TransferWidget,
} from "../../widget-ownership-transfer-contract";

const COMMAND = { ...WIDGET_WRITE, skipAutoIdempotency: true } as const;
type Session = {
  token: symbol; scope: string; id: string; widget?: TransferWidget; target?: TransferTarget;
  impact?: TransferImpact; reason: string; acknowledged: boolean; error?: NormalizedApiError;
  phase: "loading" | "editing" | "reviewing" | "saving";
};
type Targets = { token: symbol; search: string; items: TransferTarget[]; cursor: string | null; loading: boolean; error?: NormalizedApiError };
type Recovery = { scope: string; id: string; widget?: TransferWidget | null; loading: boolean; error?: NormalizedApiError };

async function readWidget(id: string, signal: AbortSignal) {
  const response = await axiosClient.get<unknown>(widgetTransferPath(id), { ...WIDGET_READ, signal });
  assertWidgetStatus(response, 200);
  return parseTransferWidget(response.data, id);
}

export function useWidgetOwnershipTransfer(refresh: () => Promise<boolean>) {
  const { t } = useI18n();
  const toast = useToast();
  const safety = useWidgetSafety("ownership-transfer");
  const { scope } = safety;
  const [session, setSession] = useState<Session | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [checked, setChecked] = useState<Recovery | null>(null);
  const request = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const active = session?.scope === scope ? session : null;
  const targetPage = targets && targets.token === active?.token ? targets : null;
  const recoveryId = safety.unresolvedSubject;
  const recovery = recoveryId && checked?.scope === scope && checked.id === recoveryId ? checked : null;
  const allowed = safety.canMutate && !safety.blocked && !safety.busy;
  const busy = active?.phase === "reviewing" || active?.phase === "saving";
  const canEdit = allowed && active?.phase === "editing" && !!active.widget && ![403, 404, 409].includes(active.error?.status ?? 0);
  const canReview = canEdit && !!active?.target && !targetPage?.loading && targetPage?.error?.status !== 403;
  const reasonLength = Array.from(active?.reason.trim() ?? "").length;
  const canConfirm = canReview && !!active?.impact && active.acknowledged && reasonLength > 0 && reasonLength <= WIDGET_TRANSFER_REASON_LIMIT;

  useEffect(() => () => request.current?.abort(), [scope]);

  function patch(token: symbol, update: Partial<Session>) {
    setSession((current) => current?.token === token ? { ...current, ...update } : current);
  }

  function startRead() {
    const ticket = safety.startRead();
    if (!ticket) return null;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return { ticket, signal: controller.signal, current: () => !controller.signal.aborted && safety.currentRead(ticket),
      settled: () => request.current === controller && !controller.signal.aborted && safety.isCurrent() };
  }

  async function loadHead(id: string, reason = "") {
    const read = startRead();
    if (!read) return;
    const token = Symbol("ownership-transfer");
    setSession({ id, token, scope, phase: "loading", reason, acknowledged: false });
    try {
      const widget = await readWidget(id, read.signal);
      if (read.current()) patch(token, { widget, phase: "editing" });
    } catch (error) {
      if (read.current()) patch(token, { phase: "editing", error: normalizeApiError(error) });
    } finally {
      if (read.settled()) setSession((current) => current?.token === token && current.phase === "loading"
        ? { ...current, phase: "editing" } : current);
    }
  }

  async function searchTargets(search: string, previous?: Targets) {
    if (!canEdit || !active?.widget) return;
    const { token, id, widget } = active;
    const read = startRead();
    if (!read) return;
    const base: Targets = { token, search, items: previous?.items ?? [], cursor: previous?.cursor ?? null, loading: true };
    setTargets(base);
    try {
      const path = widgetTransferSearchPath(widgetTransferPath(id, "targets"), search, base.cursor ?? undefined);
      const response = await axiosClient.get<unknown>(path, { ...WIDGET_READ, signal: read.signal });
      assertWidgetStatus(response, 200);
      const page = parseTransferTargetPage(response.data, widget.ownerUserId, base.cursor ?? undefined);
      if (read.current()) setTargets({ ...base, items: [...base.items, ...page.items], cursor: page.nextCursor, loading: false });
    } catch (error) {
      if (read.current()) setTargets({ ...base, loading: false, error: normalizeApiError(error) });
    } finally {
      if (read.settled()) setTargets((current) => current === base ? { ...base, loading: false } : current);
    }
  }

  async function inspect() {
    if (!canReview || !active?.widget || !active.target) return;
    const { id, token, widget, target } = active;
    const read = startRead();
    if (!read) return;
    patch(token, { phase: "reviewing", impact: undefined, error: undefined, acknowledged: false });
    try {
      const response = await axiosClient.post<unknown>(widgetTransferPath(id, "impact"), transferPrecondition(widget, target),
        { ...COMMAND, signal: read.signal });
      assertWidgetStatus(response, 200);
      const impact = parseTransferImpact(response.data, widget, target);
      if (read.current()) patch(token, { widget: impact.widget, target: impact.target, impact });
    } catch (error) {
      const failure = normalizeApiError(error);
      if (read.current()) patch(token, { error: failure,
        ...(failure.code === "CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE" ? { target: undefined } : {}) });
    } finally {
      if (read.settled()) patch(token, { phase: "editing" });
    }
  }

  async function confirm() {
    if (!canConfirm || !active?.impact) return;
    const { id, token, impact } = active;
    const ticket = safety.beginWrite(true);
    if (!ticket) return;
    patch(token, { phase: "saving", acknowledged: false });
    let committed = false;
    try {
      const response = await axiosClient.patch<unknown>(widgetTransferPath(id), {
        ...transferPrecondition(impact.widget, impact.target), impactId: impact.impactId,
        reason: active.reason.trim(), acknowledged: true,
      }, COMMAND);
      assertWidgetStatus(response, 200);
      verifyTransferReceipt(response.data, impact);
      if (safety.currentWrite(ticket)) {
        committed = true;
        setSession(null);
        toast.success(t.crmWidgets.ownership.transferred);
      }
    } catch (error) {
      const failure = normalizeApiError(error);
      const uncertain = failure.status === 0 || failure.status >= 500 || failure.code === "GW.IDEM.IN_FLIGHT";
      if (uncertain) safety.fence(ticket, id);
      if (safety.currentWrite(ticket)) {
        if (uncertain) setSession(null);
        else patch(token, { phase: "editing", impact: undefined, error: failure,
          ...(failure.code === "CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE" ? { target: undefined } : {}) });
      }
    } finally { safety.finish(ticket); }
    if (committed && !await refresh().catch(() => false) && safety.isCurrent()) toast.warning(t.crmWidgets.review.savedRefreshFailed);
  }

  async function checkCurrent() {
    if (!recoveryId) return;
    const read = startRead();
    if (!read) return;
    const base = { id: recoveryId, scope, loading: false };
    setChecked({ ...base, loading: true });
    try {
      const widget = await readWidget(recoveryId, read.signal);
      if (!read.current()) return;
      setChecked({ ...base, widget });
      safety.reconciled(read.ticket);
    } catch (error) {
      if (!read.current()) return;
      const failure = normalizeApiError(error);
      if (failure.status === 404 && failure.code === "CRM_WIDGET_NOT_FOUND") {
        setChecked({ ...base, widget: null });
        safety.reconciled(read.ticket);
      } else setChecked({ ...base, error: failure });
    } finally {
      if (read.settled()) setChecked((current) => current?.scope === scope && current.id === recoveryId && current.loading ? base : current);
    }
  }

  return { active, allowed, busy, canEdit, canReview, canConfirm, targetPage, recovery, recoveryId,
    blocked: safety.blocked, readOnly: !safety.canMutate, recoveryReady: safety.reviewedRead && recovery?.widget !== undefined,
    open: (id: string, anchor: HTMLElement) => {
      if (!allowed || active || safety.isPending()) return;
      trigger.current = anchor;
      void loadHead(id);
    },
    reload: () => { if (active && allowed && !busy) void loadHead(active.id, active.reason); },
    searchTargets: (search: string) => void searchTargets(search),
    moreTargets: () => { if (targetPage?.cursor && !targetPage.loading) void searchTargets(targetPage.search, targetPage); },
    retryTargets: () => { if (targetPage) void searchTargets(targetPage.search); },
    select: (id: string | undefined) => {
      if (!active || !canEdit) return;
      const target = targetPage?.items.find((item) => item.id === id);
      if (id !== undefined && !target) return;
      patch(active.token, { target, impact: undefined, acknowledged: false, error: undefined });
    },
    setReason: (reason: string) => { if (active && canEdit) patch(active.token, { reason }); },
    acknowledge: (acknowledged: boolean) => { if (active?.impact && canEdit) patch(active.token, { acknowledged }); },
    inspect, confirm, checkCurrent,
    reviewRecovery: () => {
      if (!safety.reviewedRead || recovery?.widget === undefined) return;
      safety.review();
      void refresh();
    },
    close: () => { if (!safety.isPending()) { request.current?.abort(); setSession(null); } },
    restoreFocus: (event: Event) => {
      if (safety.isCurrent() && trigger.current?.isConnected) {
        event.preventDefault();
        trigger.current.focus();
      }
      trigger.current = null;
    },
  };
}
