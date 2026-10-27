"use client";

import { useCallback, useEffect, useState } from "react";
import { definitionListPath, mergeDefinitionItems } from '../../definition-pagination';
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { WIDGETS_PATH, parseWidgetsResponse, type WidgetDefinition } from "../../widget-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;

/**
 * The widgets that can be placed on this dashboard.
 *
 * `GET /widgets` needs `crm.widgets.read`, which is a **separate** grant from
 * `crm.dashboards.update`: an actor may edit a dashboard's layout and still
 * not be allowed to list widgets. The picker degrades to its own error rather
 * than blocking the layout editor.
 */
export function useAvailableWidgets(enabled: boolean) {
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string): Promise<void> => {
    if (!enabled) return;
    setError(null);
    setIsLoading(true);
    try {
      const response = await axiosClient.get<unknown>(definitionListPath(WIDGETS_PATH, cursor), READ_CONFIG);
      const page = parseWidgetsResponse(response.data);
      setWidgets((current) => cursor ? mergeDefinitionItems(current, page.items) : page.items);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Deferred out of the effect body: a synchronous setState there cascades a
  // render, which `react-hooks/set-state-in-effect` refuses. Same shape as
  // every other loader in this app.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return {
    widgets, error, reload: () => load(), isLoading,
    hasMore: nextCursor !== null,
    loadMore: () => nextCursor && !isLoading ? load(nextCursor) : Promise.resolve(),
  };
}
