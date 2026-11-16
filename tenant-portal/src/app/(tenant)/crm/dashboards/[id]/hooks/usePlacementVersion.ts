"use client";

import { useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parseWidgetHistory, widgetHistoryPath } from "../../../widgets/widget-history-contract";
import { uncertainDashboardWrite, useDashboardSafety } from "../../hooks/useDashboardSafety";
import {
  parsePlacementVersionBinding, parsePlacementVersionImpact, placementVersionConfirmBody, placementVersionPath,
  placementVersionReviewBody, verifyPlacementVersionReceipt,
  type PlacementVersionBinding, type PlacementVersionChoice, type PlacementVersionImpact,
} from "../../placement-version-contract";

const READ = { cache: "no-store", maxResponseBytes: 128 * 1024 } as const;
const COMMAND = { ...READ, nonReplayable: true, skipAutoIdempotency: true } as const;
const FOLLOW: PlacementVersionChoice = { versionPolicy: "FOLLOW_ACTIVE", pinnedVersionNumber: null };
type History = ReturnType<typeof parseWidgetHistory>;
type Target = { scope: object; dashboardId: string; placementId: string; widgetId: string; name: string };
type Session = {
  target: Target;
  current?: PlacementVersionBinding;
  choice?: PlacementVersionChoice;
  impact?: PlacementVersionImpact;
  history?: History;
  historyError?: NormalizedApiError;
  error?: NormalizedApiError;
  uncertain?: boolean;
};

export function usePlacementVersion(dashboardId: string, enabled: boolean, canReadHistory: boolean, reload: () => Promise<boolean>) {
  const { t } = useI18n();
  const toast = useToast();
  const safety = useDashboardSafety(`dashboard:${dashboardId}`);
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState<{ scope: object; kind: "read" | "save" } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const active = session?.target.scope === safety.scope ? session : null;
  const busy = pending?.scope === safety.scope ? pending.kind : null;
  const allowed = enabled && safety.canMutate && !safety.busy && !safety.blocked && !busy;

  async function read(work: () => Promise<Partial<Session>>, base: Session, history = false) {
    if (!allowed) return;
    const ticket = safety.startRead();
    if (!ticket) return;
    setPending({ scope: safety.scope, kind: "read" });
    setSession(base);
    try {
      const data = await work();
      if (safety.currentRead(ticket)) setSession({ ...base, ...data });
    } catch (error) {
      if (safety.currentRead(ticket)) setSession({ ...base, [history ? "historyError" : "error"]: normalizeApiError(error) });
    } finally {
      if (safety.readSettled(ticket)) setPending(null);
    }
  }

  function load(target: Target) {
    void read(async () => {
      const { data } = await axiosClient.get<unknown>(placementVersionPath(target), READ);
      const current = parsePlacementVersionBinding(data, target);
      const choice: PlacementVersionChoice = current.versionPolicy === "PINNED"
        ? { versionPolicy: "PINNED", pinnedVersionNumber: current.pinnedVersionNumber } : FOLLOW;
      return { current, choice };
    }, { target });
  }

  const options = [...new Set(active?.current ? [active.current.activeVersionNumber, active.current.selectedVersionNumber,
    ...(active.history?.items.map((item) => item.versionNumber) ?? [])] : [])].sort((a, b) => b - a);

  function select(value: string) {
    if (!active || !allowed || active.uncertain) return;
    const version = options.find((number) => String(number) === value);
    if (value !== "follow" && version === undefined) return;
    const choice: PlacementVersionChoice = version === undefined ? FOLLOW : { versionPolicy: "PINNED", pinnedVersionNumber: version };
    setSession({ ...active, choice, impact: undefined, error: undefined });
  }

  function loadHistory() {
    if (!active?.current || !canReadHistory || active.uncertain || active.history?.nextBeforeVersion === null) return;
    const { current, history } = active;
    const cursor = history?.nextBeforeVersion ?? undefined;
    void read(async () => {
      const { data } = await axiosClient.get<unknown>(widgetHistoryPath(current.widgetId, cursor), READ);
      const page = parseWidgetHistory(data, current.widgetId, current.widgetRevision, current.activeVersionNumber, cursor);
      return { history: { ...page, items: [...(history?.items ?? []), ...page.items] } };
    }, { ...active, historyError: undefined }, true);
  }

  function review() {
    if (!active?.current || !active.choice || active.uncertain) return;
    const { current, choice, target } = active;
    void read(async () => {
      const { data } = await axiosClient.post<unknown>(placementVersionPath(target, true), placementVersionReviewBody(current, choice), COMMAND);
      return { impact: parsePlacementVersionImpact(data, current, choice) };
    }, { ...active, impact: undefined, error: undefined });
  }

  async function confirm() {
    if (!active?.current || !active.impact?.changed || !allowed) return;
    const { current, impact, target } = active;
    const ticket = safety.beginWrite(true);
    if (!ticket) return;
    setPending({ scope: safety.scope, kind: "save" });
    let committed = false;
    try {
      const response = await axiosClient.patch<unknown>(placementVersionPath(target), placementVersionConfirmBody(current, impact), COMMAND);
      if (response.status !== 200) throw new Error("Invalid CRM placement version mutation status.");
      verifyPlacementVersionReceipt(response.data, current, impact);
      if (!safety.currentWrite(ticket)) return;
      committed = true;
      setSession(null);
    } catch (caught) {
      const error = normalizeApiError(caught);
      const uncertain = uncertainDashboardWrite(error);
      if (uncertain) safety.fence(ticket);
      if (safety.currentWrite(ticket)) setSession({ ...active, impact: undefined, error, uncertain });
    } finally {
      safety.finish(ticket);
      if (safety.isScopeCurrent()) setPending(null);
    }
    if (!committed || !safety.isScopeCurrent()) return;
    const refreshed = await reload().catch(() => false);
    if (safety.isScopeCurrent()) {
      if (refreshed) toast.success(t.crmDashboards.placementVersion.saved);
      else toast.warning(t.crmDashboards.review.refreshFailed);
    }
  }

  return { active, busy, allowed, canReadHistory, options, select, loadHistory, review, confirm,
    open: (placementId: string, widgetId: string, name: string, anchor: HTMLButtonElement | null) => {
      if (!allowed) return false;
      trigger.current = anchor;
      load({ scope: safety.scope, dashboardId, placementId, widgetId, name });
      return true;
    },
    retry: () => { if (active && !active.uncertain) load(active.target); },
    close: () => { if (!busy) setSession(null); },
    restoreFocus: (event: Event) => {
      if (safety.isScopeCurrent() && trigger.current?.isConnected) {
        event.preventDefault();
        trigger.current.focus();
      }
      trigger.current = null;
    },
  };
}
