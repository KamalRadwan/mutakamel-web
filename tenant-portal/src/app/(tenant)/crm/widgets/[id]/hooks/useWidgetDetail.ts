"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parseCatalogResponse, type DashboardCatalog } from "../../../dashboards/dashboard-catalog-contract";
import { WIDGET_CATALOG_PATH, widgetPath } from "../../../dashboards/widget-contract";
import { parseWidgetLibraryDetail, type WidgetLibraryDetail } from "../../../dashboards/widget-library-contract";
import { parseWidgetDraftState, widgetDraftPath, widgetDraftPrecondition, type WidgetDraftContent, type WidgetDraftState } from "../../widget-draft-contract";
import { useWidgetSafety, type WidgetWriteTicket } from "../../hooks/useWidgetSafety";
import { WIDGET_READ, WIDGET_WRITE, assertWidgetStatus, sameWidgetValue, uncertainWidgetWrite } from "../../hooks/widget-requests";
import { useWidgetLifecycle } from "./useWidgetLifecycle";
interface WidgetUpdateOutcome { ok: boolean; conflict: boolean; error: NormalizedApiError | null; uncertain?: boolean; refreshed?: boolean; stale?: boolean; }
interface Snapshot { scope: string; widget: WidgetLibraryDetail; catalog: DashboardCatalog | null; draftState: WidgetDraftState | null; draftFailed: boolean; }
const DRAFT_CONFLICTS = ["CRM_WIDGET_REVISION_CONFLICT", "CRM_WIDGET_DRAFT_CONFLICT", "CRM_WIDGET_DRAFT_BASE_CONFLICT"];
export function useWidgetDetail(widgetId: string) {
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const canRead = hasPermission(permissions, "crm.widgets.read");
  const canUpdate = hasPermission(permissions, "crm.widgets.update");
  const safety = useWidgetSafety("widget:" + widgetId);
  const { scope, startRead, currentRead, reconciled } = safety;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const confirmed = useRef<Snapshot | null>(null);
  const [read, setRead] = useState<{ scope: string; busy?: boolean; error?: NormalizedApiError } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [writeDenied, setWriteDenied] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal, write?: WidgetWriteTicket) => {
    const ticket = canRead ? startRead(write) : null;
    if (!ticket) return false;
    setRead({ scope, busy: true });
    const [detail, catalog] = await Promise.allSettled([
      axiosClient.get<unknown>(widgetPath(widgetId), { ...WIDGET_READ, signal }),
      axiosClient.get<unknown>(WIDGET_CATALOG_PATH, { ...WIDGET_READ, signal }),
    ]);
    if (signal?.aborted || !currentRead(ticket)) return false;
    try {
      if (detail.status === "rejected") throw detail.reason;
      assertWidgetStatus(detail.value, 200);
      const widget = parseWidgetLibraryDetail(detail.value.data);
      if (widget.id !== widgetId) throw new Error("Widget read belongs to another resource.");
      let nextCatalog: DashboardCatalog | null = null;
      try { if (catalog.status === "fulfilled") { assertWidgetStatus(catalog.value, 200); nextCatalog = parseCatalogResponse(catalog.value.data); } } catch {}
      let draftState: WidgetDraftState | null = null;
      let draftFailed = false;
      if (canUpdate && widget.accessLevel !== "VIEW" && (widget.status !== "ARCHIVED" || widget.draftRevision !== null)) {
        try {
          const response = await axiosClient.get<unknown>(widgetDraftPath(widgetId), { ...WIDGET_READ, signal });
          assertWidgetStatus(response, 200);
          const draft = parseWidgetDraftState(response.data);
          if (draft.widgetId !== widgetId || draft.widgetRevision !== widget.revision
            || draft.governanceRevision !== widget.governanceRevision || draft.activeVersionNumber !== widget.versionNumber
            || (draft.draft?.revision ?? null) !== widget.draftRevision) throw new Error("Widget head and draft snapshots disagree.");
          draftState = draft;
        } catch { draftFailed = true; }
      }
      if (signal?.aborted || !currentRead(ticket)) return false;
      const next = { scope, widget, catalog: nextCatalog, draftState, draftFailed };
      confirmed.current = next; setSnapshot(next); setRead({ scope });
      if (!draftFailed) reconciled(ticket);
      return !draftFailed;
    } catch (caught) {
      const error = normalizeApiError(caught);
      if ([401, 403, 404].includes(error.status)) { confirmed.current = null; setSnapshot(null); }
      setRead({ scope, error });
      return false;
    }
  }, [scope, widgetId, canRead, canUpdate, startRead, currentRead, reconciled]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);
  const update = async (input: WidgetDraftContent, base: WidgetDraftState): Promise<WidgetUpdateOutcome> => {
    const current = confirmed.current?.scope === scope ? confirmed.current.draftState : null;
    const no = { ok: false, conflict: false, error: null };
    const allowed = !!current && canRead && canUpdate && writeDenied !== scope && !read?.busy && !read?.error;
    if (allowed && (base.widgetId !== widgetId
      || !sameWidgetValue(widgetDraftPrecondition(current), widgetDraftPrecondition(base)))) return { ...no, conflict: true };
    const ticket = safety.beginWrite(allowed);
    if (!ticket || !current) return no;
    setPending(scope);
    try {
      const expected = widgetDraftPrecondition(base);
      const name = input.name.trim();
      const response = await axiosClient.patch<unknown>(widgetPath(widgetId), { ...input, name, ...expected }, WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) throw new Error("Widget save scope changed.");
      assertWidgetStatus(response, 200);
      const result = parseWidgetDraftState(response.data);
      const draft = result.draft;
      if (!draft || result.widgetId !== widgetId || result.widgetRevision !== expected.expectedWidgetRevision
        || result.governanceRevision < base.governanceRevision
        || result.activeVersionNumber !== base.activeVersionNumber || draft.baseVersionNumber !== base.activeVersionNumber
        || (expected.expectedDraftId !== null && draft.draftId !== expected.expectedDraftId)
        || draft.revision !== expected.expectedDraftRevision + 1 || draft.updatedByUserId !== user?.id
        || draft.name !== name || draft.visualizationType !== input.visualizationType
        || !sameWidgetValue(draft.querySpec, input.querySpec) || !sameWidgetValue(draft.displaySpec, input.displaySpec)) throw new Error("Widget draft save receipt does not match.");
      const refreshed = await load(undefined, ticket);
      if (!refreshed) safety.fence(ticket);
      return { ok: true, conflict: false, error: null, refreshed };
    } catch (caught) {
      const error = normalizeApiError(caught);
      if (error.status === 403) setWriteDenied(scope);
      const uncertain = uncertainWidgetWrite(error);
      if (uncertain) { safety.fence(ticket); await load(undefined, ticket); }
      return { ...no, error, conflict: DRAFT_CONFLICTS.includes(error.code ?? ""), uncertain, stale: !safety.currentWrite(ticket) };
    } finally { const active = safety.currentWrite(ticket); safety.finish(ticket); if (active) setPending(null); }
  };
  const current = canRead && snapshot?.scope === scope ? snapshot : null;
  const error = canRead ? read?.scope === scope ? read.error ?? null : null : { status: 403 };
  const readOnly = !safety.canMutate || writeDenied === scope;
  const mayActOnDraft = !!current?.draftState && current.widget.status !== "ARCHIVED" && !readOnly && !error;
  const lifecycle = useWidgetLifecycle({
    widgetId, safety, canDiscard: mayActOnDraft && canUpdate,
    canPublish: mayActOnDraft && hasPermission(permissions, "crm.widgets.publish"),
    currentDraft: () => confirmed.current?.scope === scope && !read?.busy && !error ? confirmed.current.draftState : null,
    refresh: (ticket) => load(undefined, ticket),
  });
  return { scope, widget: error?.status === 403 || error?.status === 404 ? null : current?.widget ?? null, catalog: current?.catalog ?? null,
    draftState: error ? null : current?.draftState ?? null, draftFailed: current?.draftFailed ?? false,
    isLoading: !current && !error || read?.scope === scope && read.busy === true,
    isSaving: pending === scope || lifecycle.action !== null, error, update, reload: () => load(),
    refreshAfterWrite: (ticket: WidgetWriteTicket) => load(undefined, ticket), lifecycle,
    readOnly, blocked: safety.busy || safety.blocked || !!error,
    needsReview: safety.unresolved, reviewReady: safety.reviewedRead, review: safety.review, isPending: safety.isPending };
}
