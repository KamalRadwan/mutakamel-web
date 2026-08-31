"use client";

import { useState } from "react";
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
}

export function useWidgetDrilldown(dashboardId: string) {
  const [target, setTarget] = useState<DrilldownState | null>(null);
  const [records, setRecords] = useState<DrilldownRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  async function fetchPage(
    state: DrilldownState,
    selection: DashboardFilterSelection,
    nextCursor: string | null,
  ): Promise<void> {
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
          selection,
        }),
        READ_CONFIG,
      );
      const page = parseDrilldownResponse(response.data);
      // The cursor is opaque and is passed back byte-for-byte (S11).
      setRecords((current) => (nextCursor ? [...current, ...page.records] : page.records));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setIsLoading(false);
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
      const state = { widget, pointKey, pointLabel };
      setTarget(state);
      setRecords([]);
      setCursor(null);
      setHasMore(false);
      void fetchPage(state, selection, null);
    },
    loadMore: (selection: DashboardFilterSelection) => {
      if (!target || !cursor) return;
      void fetchPage(target, selection, cursor);
    },
    close: () => {
      setTarget(null);
      setRecords([]);
      setCursor(null);
      setHasMore(false);
      setError(null);
    },
  };
}
