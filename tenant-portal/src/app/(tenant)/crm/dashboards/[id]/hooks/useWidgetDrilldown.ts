"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { dashboardDrilldownPath } from "../../dashboard-contract";
import { buildDrilldownRequest, parseDrilldownResponse, type DashboardFilterSelection, type DrilldownRecord } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024, skipAutoIdempotency: true } as const;
export interface DrilldownState {
  widget: WidgetDefinition;
  pointKey: string;
  pointLabel: string;
  selection: DashboardFilterSelection;
}
interface ReadScope { grants: string; generation: unknown; dashboardId: string; }
interface Snapshot {
  scope: ReadScope;
  target: DrilldownState | null;
  records: DrilldownRecord[];
  hasMore: boolean;
  isLoading: boolean;
  error: NormalizedApiError | null;
}
const emptySnapshot = (scope: ReadScope): Snapshot => ({ scope, target: null, records: [], hasMore: false, isLoading: false, error: null });
const needsDashboardRefresh = (error: NormalizedApiError | null) => error?.status === 403 || error?.status === 404
  || error?.code === "CRM_WIDGET_REVISION_CONFLICT";

export function useWidgetDrilldown(dashboardId: string) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const grants = useAuthScopeKey(user ?? null);
  // Object identity also hides an old A snapshot after authority goes A → B → A.
  const scope = useMemo(() => ({ grants, generation: realtimeAuthGeneration, dashboardId }), [grants, realtimeAuthGeneration, dashboardId]);
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(scope));
  const runtime = useRef({ scope, active: false, epoch: 0, controller: null as AbortController | null,
    target: null as DrilldownState | null, cursor: null as string | null, hasMore: false,
    retryCursor: null as string | null, requiresRefresh: false });
  useLayoutEffect(() => {
    const current = runtime.current;
    current.scope = scope;
    current.active = true;
    current.target = null;
    current.cursor = null;
    current.hasMore = false;
    current.requiresRefresh = false;
    current.epoch++;
    return () => { current.active = false; current.epoch++; current.controller?.abort(); current.controller = null; };
  }, [scope]);
  const isCurrent = () => runtime.current.active && runtime.current.scope === scope;

  async function fetchPage(target: DrilldownState, nextCursor: string | null) {
    if (!isCurrent()) return;
    const current = runtime.current;
    current.controller?.abort();
    const controller = new AbortController();
    current.controller = controller;
    current.retryCursor = nextCursor;
    const epoch = ++current.epoch;
    const accepted = () => isCurrent() && epoch === current.epoch && !controller.signal.aborted;
    setSnapshot((previous) => ({ ...(previous.scope === scope ? previous : emptySnapshot(scope)),
      target, isLoading: true, error: null }));
    try {
      const response = await axiosClient.post<unknown>(dashboardDrilldownPath(dashboardId, target.widget.id),
        buildDrilldownRequest({ pointKey: target.pointKey, seriesKey: null, cursor: nextCursor,
          expectedWidgetRevision: target.widget.revision, selection: target.selection }),
        { ...READ_CONFIG, signal: controller.signal });
      if (!accepted()) return;
      const page = parseDrilldownResponse(response.data);
      if (page.dashboardId !== dashboardId || page.widgetId !== target.widget.id || page.widgetRevision !== target.widget.revision
        || page.pointKey !== target.pointKey.trim() || page.seriesKey !== null
        || (nextCursor !== null && page.hasMore && page.nextCursor === nextCursor)) {
        throw new Error("CRM_DRILLDOWN_RESPONSE_INVALID");
      }
      current.cursor = page.nextCursor;
      current.hasMore = page.hasMore;
      current.requiresRefresh = false;
      setSnapshot((previous) => ({ scope, target, records: nextCursor && previous.scope === scope
        ? [...previous.records, ...page.records.filter((row) => !previous.records.some((entry) => entry.id === row.id))]
        : page.records, hasMore: page.hasMore, isLoading: false, error: null }));
    } catch (caught) {
      if (!accepted()) return;
      const error = normalizeApiError(caught);
      current.requiresRefresh = needsDashboardRefresh(error);
      if (current.requiresRefresh) { current.cursor = null; current.hasMore = false; }
      setSnapshot((previous) => ({ ...(previous.scope === scope ? previous : emptySnapshot(scope)), target,
        records: current.requiresRefresh ? [] : previous.records, hasMore: current.requiresRefresh ? false : previous.hasMore,
        isLoading: false, error }));
    } finally {
      if (accepted()) { current.controller = null; }
    }
  }

  const visible = snapshot.scope === scope ? snapshot : emptySnapshot(scope);
  return {
    target: visible.target, records: visible.records, hasMore: visible.hasMore,
    isLoading: visible.isLoading, error: visible.error, requiresRefresh: needsDashboardRefresh(visible.error),
    open: (widget: WidgetDefinition, pointKey: string, pointLabel: string, selection: DashboardFilterSelection) => {
      if (!isCurrent()) return;
      const target = { widget: { ...widget }, pointKey, pointLabel, selection: { ...selection } };
      runtime.current.target = target;
      runtime.current.cursor = null;
      runtime.current.hasMore = false;
      runtime.current.requiresRefresh = false;
      setSnapshot({ ...emptySnapshot(scope), target });
      void fetchPage(target, null);
    },
    loadMore: () => {
      const current = runtime.current;
      if (!isCurrent() || !current.target || !current.cursor || !current.hasMore || current.controller || current.requiresRefresh) return;
      void fetchPage(current.target, current.cursor);
    },
    retry: () => {
      const current = runtime.current;
      if (!isCurrent() || !current.target || current.controller || current.requiresRefresh) return;
      void fetchPage(current.target, current.retryCursor);
    },
    close: () => {
      if (!isCurrent()) return;
      const current = runtime.current;
      current.controller?.abort(); current.controller = null; current.epoch++;
      current.target = null; current.cursor = null; current.hasMore = false;
      setSnapshot(emptySnapshot(scope));
    },
  };
}
