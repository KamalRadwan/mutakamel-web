"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useWidgetSafety, type WidgetWriteTicket } from "../../hooks/useWidgetSafety";
import { assertWidgetStatus, WIDGET_WRITE } from "../../hooks/widget-requests";
import { parseWidgetVersionComparison, verifyWidgetVersionRestore, widgetVersionCommandPath, widgetVersionRestoreBody,
  type VersionPair, type WidgetVersionComparison } from "../../widget-version-comparison-contract";
import { useWidgetHistory } from "./useWidgetHistory";

type Review = {
  scope: string; pair: VersionPair; loading: boolean; saving?: boolean;
  comparison?: WidgetVersionComparison; source?: number; acknowledged?: boolean; error?: NormalizedApiError;
};
const COMMAND = { ...WIDGET_WRITE, skipAutoIdempotency: true } as const;

export function useWidgetVersionComparison(widgetId: string, head: { revision: number; version: number } | null,
  canRestore: boolean, refresh: (ticket: WidgetWriteTicket) => Promise<boolean>) {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const toast = useToast();
  const safety = useWidgetSafety(`widget:${widgetId}`);
  const { scope } = safety;
  const [historyScope, setHistoryScope] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ scope: string; left?: number; right?: number } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const request = useRef<AbortController | null>(null);
  const compareTrigger = useRef<HTMLElement | null>(null);
  const open = !!head && historyScope === scope;
  const history = useWidgetHistory(widgetId, open && head ? {
    key: JSON.stringify([scope, "history", head.revision, head.version]), revision: head.revision, activeVersion: head.version,
  } : undefined);
  const active = open && review?.scope === scope ? review : null;
  const selected = selection?.scope === scope ? selection : null;
  const includes = (value: number | undefined) => history.items.some((entry) => entry.versionNumber === value);
  const left = includes(selected?.left) ? selected?.left : history.items[1]?.versionNumber;
  const right = includes(selected?.right) ? selected?.right : history.items[0]?.versionNumber;
  const canCompare = open && !safety.busy && left !== undefined && right !== undefined && left !== right;
  const canChooseRestore = canRestore && safety.canMutate && !safety.blocked && !safety.busy
    && !!active?.comparison?.proof && !active?.error && !active?.loading;
  const ready = canChooseRestore && !!active?.acknowledged && active.source !== undefined;

  useEffect(() => () => request.current?.abort(), [scope]);

  async function inspect(pair: VersionPair) {
    if (!open || safety.isPending()) return;
    const ticket = safety.startRead();
    if (!ticket) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const base = { scope, pair, loading: true };
    setReview(base);
    try {
      const response = await axiosClient.post<unknown>(widgetVersionCommandPath(widgetId, "compare"), pair,
        { ...COMMAND, signal: controller.signal });
      if (controller.signal.aborted || !safety.currentRead(ticket)) return;
      assertWidgetStatus(response, 200);
      const comparison = parseWidgetVersionComparison(response.data, widgetId, pair);
      setReview({ ...base, loading: false, comparison, source: comparison.left.versionNumber });
    } catch (error) {
      if (!controller.signal.aborted && safety.currentRead(ticket)) {
        setReview({ ...base, loading: false, error: normalizeApiError(error) });
      }
    } finally {
      if (!controller.signal.aborted && request.current === controller && safety.isCurrent()) {
        setReview((current) => current === base ? { ...base, loading: false } : current);
      }
    }
  }

  async function confirm() {
    if (!ready || !active?.comparison || active.source === undefined || !user?.id) return;
    const ticket = safety.beginWrite(true);
    if (!ticket) return;
    const { comparison, source } = active;
    setReview({ ...active, acknowledged: false, saving: true });
    try {
      const response = await axiosClient.post<unknown>(widgetVersionCommandPath(widgetId, "restore-draft"),
        widgetVersionRestoreBody(comparison, source), COMMAND);
      assertWidgetStatus(response, 200);
      verifyWidgetVersionRestore(response.data, comparison, source, user.id);
      if (!safety.currentWrite(ticket)) return;
      setReview(null);
      setHistoryScope(null);
      toast.success(t.crmWidgets.versionComparison.restored);
      if (!await refresh(ticket).catch(() => false) && safety.currentWrite(ticket)) {
        safety.fence(ticket);
        toast.info(t.crmWidgets.review.savedRefreshFailed);
      }
    } catch (error) {
      const failure = normalizeApiError(error);
      if (failure.status === 0 || failure.status >= 500 || failure.code === "GW.IDEM.IN_FLIGHT") {
        safety.fence(ticket);
        if (safety.currentWrite(ticket)) {
          setReview(null);
          setHistoryScope(null);
          await refresh(ticket).catch(() => false);
        }
      } else if (safety.currentWrite(ticket)) {
        setReview({ ...active, saving: false, comparison: undefined, acknowledged: false, error: failure });
      }
    } finally { safety.finish(ticket); }
  }

  return { open, history, left, right, canCompare, active, canChooseRestore, ready, confirm,
    openHistory: () => {
      if (!head || safety.isPending()) return;
      setSelection(null);
      setHistoryScope(scope);
    },
    closeHistory: () => { if (!safety.isPending()) { request.current?.abort(); setReview(null); setHistoryScope(null); } },
    pick: (side: "left" | "right", value: string) => {
      const version = history.items.find((entry) => String(entry.versionNumber) === value)?.versionNumber;
      if (version !== undefined) setSelection({ scope, left, right, [side]: version });
    },
    compare: (anchor: HTMLElement) => {
      if (!canCompare || left === undefined || right === undefined) return;
      compareTrigger.current = anchor;
      void inspect({ leftVersionNumber: left, rightVersionNumber: right });
    },
    retry: () => { if (active && !active.saving) void inspect(active.pair); },
    close: () => { if (!safety.isPending()) { request.current?.abort(); setReview(null); } },
    restoreFocus: (event: Event) => {
      if (safety.isCurrent() && compareTrigger.current?.isConnected) {
        event.preventDefault();
        compareTrigger.current.focus();
      }
      compareTrigger.current = null;
    },
    selectSource: (value: string) => {
      if (!canChooseRestore || !active?.comparison) return;
      const source = [active.comparison.left.versionNumber, active.comparison.right.versionNumber].find((version) => String(version) === value);
      if (source !== undefined) setReview({ ...active, source, acknowledged: false });
    },
    acknowledge: (checked: boolean) => { if (canChooseRestore && active) setReview({ ...active, acknowledged: checked }); },
  };
}
