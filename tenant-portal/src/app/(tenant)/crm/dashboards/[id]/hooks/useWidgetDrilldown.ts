"use client";

import { useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { dashboardDrilldownPath } from "../../dashboard-contract";
import {
  buildDrilldownRequest,
  parseDrilldownResponse,
  type DashboardFilterSelection,
  type DrilldownRecord,
} from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";

const READ_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 512 * 1024,
  // READ_HEAVY, not WRITE_SENSITIVE: the Gateway reserves no idempotency key.
  skipAutoIdempotency: true,
} as const;

export interface DrilldownState {
  widget: WidgetDefinition;
  pointKey: string;
  pointLabel: string;
  selection: DashboardFilterSelection;
}

export function useWidgetDrilldown(dashboardId: string) {
  const [target, setTarget] = useState<DrilldownState | null>(null);
  const [records, setRecords] = useState<DrilldownRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const request = useRef<AbortController | null>(null);
  const epochRef = useRef(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setTarget(null);
        setRecords([]);
        setCursor(null);
        setHasMore(false);
        setIsLoading(false);
        setError(null);
      }
    });
    return () => {
      active = false;
      request.current?.abort();
      ++epochRef.current;
    };
  }, [dashboardId]);

  async function fetchPage(
    state: DrilldownState,
    nextCursor: string | null,
  ): Promise<void> {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const epoch = ++epochRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.post<unknown>(
        dashboardDrilldownPath(dashboardId, state.widget.id),
        buildDrilldownRequest({
          pointKey: state.pointKey,
          seriesKey: null,
          cursor: nextCursor,
          expectedWidgetRevision: state.widget.revision,
          selection: state.selection,
        }),
        { ...READ_CONFIG, signal: controller.signal },
      );
      if (epoch !== epochRef.current || controller.signal.aborted) return;
      const page = parseDrilldownResponse(response.data);
      // The cursor is opaque and is passed back byte-for-byte (S11).
      setRecords((current) => (nextCursor ? [...current, ...page.records] : page.records));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (caught) {
      if (epoch !== epochRef.current || controller.signal.aborted) return;
      setError(normalizeApiError(caught));
    } finally {
      if (epoch === epochRef.current && !controller.signal.aborted) {
        request.current = null;
        setIsLoading(false);
      }
    }
  }

  return {
    target,
    records,
    hasMore,
    isLoading,
    error,
    open: (
      widget: WidgetDefinition,
      pointKey: string,
      pointLabel: string,
      selection: DashboardFilterSelection,
    ) => {
      const state = { widget, pointKey, pointLabel, selection: { ...selection } };
      setTarget(state);
      setRecords([]);
      setCursor(null);
      setHasMore(false);
      void fetchPage(state, null);
    },
    loadMore: () => {
      if (!target || !cursor || request.current) return;
      void fetchPage(target, cursor);
    },
    close: () => {
      request.current?.abort();
      request.current = null;
      ++epochRef.current;
      setIsLoading(false);
      setTarget(null);
      setRecords([]);
      setCursor(null);
      setHasMore(false);
      setError(null);
    },
  };
}
