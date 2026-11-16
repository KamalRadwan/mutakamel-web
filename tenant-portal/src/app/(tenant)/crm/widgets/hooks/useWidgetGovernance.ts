"use client";

import { useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission, useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { widgetPath } from "../../dashboards/widget-contract";
import { parseWidgetLibraryDetail, type WidgetLibraryDetail } from "../../dashboards/widget-library-contract";
import { governancePath, governancePrecondition, parseWidgetGovernanceImpact, verifyWidgetGovernanceReceipt,
  WIDGET_ARCHIVE_REASON_LIMIT, type WidgetGovernanceAction, type WidgetGovernanceImpact } from "../widget-governance-contract";
import { useWidgetSafety, type WidgetWriteTicket } from "./useWidgetSafety";
import { assertWidgetStatus, WIDGET_READ, WIDGET_WRITE } from "./widget-requests";

type Target = { scope: string; id: string; action: WidgetGovernanceAction };
type Review = { head: WidgetLibraryDetail; impact: WidgetGovernanceImpact };
type Stage =
  | { kind: "loading" }
  | { kind: "review"; review: Review }
  | { kind: "failed"; error: NormalizedApiError }
  | { kind: "uncertain" }
  | { kind: "checked"; status: WidgetLibraryDetail["status"]; unconfirmed: boolean };
type Dialog = Target & { stage: Stage };

async function readHead(id: string) {
  const response = await axiosClient.get<unknown>(widgetPath(id), WIDGET_READ);
  assertWidgetStatus(response, 200);
  const head = parseWidgetLibraryDetail(response.data);
  if (head.id !== id) throw new Error("Widget lifecycle read belongs to another widget.");
  return head;
}

export function useWidgetGovernance(resource: string, onRefresh: () => Promise<unknown>) {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const toast = useToast();
  const safety = useWidgetSafety(`governance:${resource}`);
  const { scope } = safety;
  const permissions = user?.permissions ?? [];
  const canManage = safety.canMutate && (user?.isTenantOwner === true
    || hasPermission(permissions, "crm.widgets.read") && hasPermission(permissions, "crm.widgets.delete"));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [shown, setShown] = useState(20);
  const trigger = useRef<HTMLElement | null>(null);
  const active = canManage && dialog?.scope === scope ? dialog : null;
  const busy = busyScope === scope;
  const review = active?.stage.kind === "review" ? active.stage.review : null;

  const reasonLength = Array.from(reason.trim()).length;
  const canConfirm = !!review && acknowledged && !busy && !safety.busy && !safety.blocked
    && (active?.action === "RESTORE" || reasonLength > 0 && reasonLength <= WIDGET_ARCHIVE_REASON_LIMIT);

  function update(target: Target, stage: Stage) {
    setDialog({ ...target, stage });
  }

  function finish(ticket: WidgetWriteTicket) {
    const current = safety.currentWrite(ticket);
    safety.finish(ticket);
    if (current) setBusyScope(null);
    return current;
  }

  async function inspect(target: Target) {
    const ticket = safety.beginWrite(canManage && !busy);
    if (!ticket) return;
    setBusyScope(scope);
    setAcknowledged(false);
    setShown(20);
    update(target, { kind: "loading" });
    let refreshRequired = false;
    try {
      const head = await readHead(target.id);
      if (!safety.currentWrite(ticket)) return;
      if (head.accessLevel !== "OWNER") {
        update(target, { kind: "failed", error: { status: 403 } });
        return;
      }
      if ((head.status === "ARCHIVED") === (target.action === "ARCHIVE")) {
        update(target, { kind: "checked", status: head.status, unconfirmed: false });
        refreshRequired = true;
        return;
      }
      const response = await axiosClient.post<unknown>(governancePath(head.id, true), governancePrecondition(head, target.action), WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) return;
      assertWidgetStatus(response, 200);
      update(target, { kind: "review", review: { head, impact: parseWidgetGovernanceImpact(response.data, head, target.action) } });
    } catch (caught) {
      if (safety.currentWrite(ticket)) update(target, { kind: "failed", error: normalizeApiError(caught) });
    } finally { if (finish(ticket) && refreshRequired) await refresh(); }
  }

  async function reconcile(target: Target, ticket: WidgetWriteTicket) {
    try {
      const head = await readHead(target.id);
      if (!safety.currentWrite(ticket)) return false;
      if (head.accessLevel !== "OWNER") return false;
      update(target, { kind: "checked", status: head.status, unconfirmed: true });
      return true;
    } catch { return false; }
  }

  async function refresh() {
    try {
      const result = await onRefresh();
      if (result === false && safety.isCurrent()) toast.warning(t.crmWidgets.review.savedRefreshFailed);
    } catch {
      if (safety.isCurrent()) toast.warning(t.crmWidgets.review.savedRefreshFailed);
    }
  }

  async function confirm() {
    if (!active || !review || !canConfirm) return;
    const ticket = safety.beginWrite(canManage);
    if (!ticket) return;
    setBusyScope(scope);
    setAcknowledged(false);
    let refreshRequired = false;
    try {
      const response = await axiosClient.post<unknown>(governancePath(active.id, false), {
        ...review.impact.body, ...(active.action === "ARCHIVE" ? { reason: reason.trim() } : {}),
      }, WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) return;
      assertWidgetStatus(response, 200);
      verifyWidgetGovernanceReceipt(response.data, review.head, review.impact);
      setDialog(null);
      refreshRequired = true;
      toast.success(active.action === "ARCHIVE" ? t.crmWidgets.governance.archived : t.crmWidgets.governance.restored);
    } catch (caught) {
      if (!safety.currentWrite(ticket)) return;
      const error = normalizeApiError(caught);
      if (error.status === 0 || error.status >= 500) {
        update(active, { kind: "uncertain" });
        refreshRequired = await reconcile(active, ticket);
      } else {
        update(active, { kind: "failed", error });
      }
    } finally {
      if (finish(ticket) && refreshRequired) await refresh();
    }
  }

  async function checkCurrent() {
    if (!active || active.stage.kind !== "uncertain") return;
    const ticket = safety.beginWrite(canManage && !busy);
    if (!ticket) return;
    setBusyScope(scope);
    let refreshed = false;
    try { refreshed = await reconcile(active, ticket); }
    finally { if (finish(ticket) && refreshed) await refresh(); }
  }

  return { canManage, active, busy, review, canConfirm, reason, setReason, acknowledged, setAcknowledged, shown,
    loadMore: () => setShown((count) => count + 20), confirm, checkCurrent,
    open: (id: string, action: WidgetGovernanceAction, anchor?: HTMLElement | null) => {
      if (active || !canManage || safety.busy || safety.blocked || safety.isPending()) return false;
      trigger.current = anchor ?? null;
      setReason("");
      void inspect({ scope, id, action });
      return true;
    },
    restoreFocus: (event: Event) => {
      if (!safety.isCurrent() || !trigger.current?.isConnected) return;
      event.preventDefault();
      trigger.current.focus();
    },
    retry: () => { if (active?.stage.kind === "failed") void inspect(active); },
    close: () => { if (!safety.isPending() && !busy) setDialog(null); },
  };
}
