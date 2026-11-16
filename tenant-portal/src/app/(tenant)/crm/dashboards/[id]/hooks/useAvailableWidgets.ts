"use client";
import { useCallback, useEffect, useState } from "react";
import { mergeDefinitionItems } from "../../definition-pagination";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { WidgetDefinition } from "../../widget-contract";
import { isPlaceableWidget, parseWidgetLibraryResponse, widgetLibraryListPath } from "../../widget-library-contract";
import { useDashboardSafety } from "../../hooks/useDashboardSafety";
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
export function useAvailableWidgets(enabled: boolean) {
  const { scope, startRead, currentRead, readSettled } = useDashboardSafety("widget-picker");
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]); const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false); const [nextCursor, setNextCursor] = useState<string | null>(null); const [dataScope, setDataScope] = useState<object | null>(null);
  const load = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    const ticket = enabled ? startRead() : null; if (!ticket) return;
    setError(null); setIsLoading(true);
    try {
      const response = await axiosClient.get<unknown>(widgetLibraryListPath({ search: "", access: null, status: "PUBLISHED", source: null, ownerUserId: null }, cursor), { ...READ_CONFIG, signal });
      const page = parseWidgetLibraryResponse(response.data);
      if (signal?.aborted || !currentRead(ticket)) return;
      const placeable = page.items.filter(isPlaceableWidget);
      setWidgets((current) => cursor ? mergeDefinitionItems(current, placeable) : placeable); setNextCursor(page.nextCursor); setDataScope(scope);
    } catch (caught) { if (!signal?.aborted && currentRead(ticket)) { setError(normalizeApiError(caught)); setDataScope(scope); } }
    finally { if (!signal?.aborted && readSettled(ticket)) setIsLoading(false); }
  }, [enabled, scope, startRead, currentRead, readSettled]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(undefined, controller.signal); }); return () => controller.abort(); }, [load]);
  return { widgets: enabled && dataScope === scope ? widgets : [], error: enabled && dataScope === scope ? error : null, reload: () => load(), isLoading,
    hasMore: enabled && dataScope === scope && nextCursor !== null, loadMore: () => nextCursor && !isLoading ? load(nextCursor) : Promise.resolve() };
}
