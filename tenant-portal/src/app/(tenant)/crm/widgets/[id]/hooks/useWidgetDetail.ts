"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  buildUpdateWidgetRequest,
  parseWidgetDetailResponse,
  parseWidgetUpdateResponse,
  widgetPath,
  type CrmVisualization,
  type WidgetDetail,
  type WidgetQuerySpec,
  type WidgetUpdateResult,
} from "../../../dashboards/widget-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1024 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 1024 * 1024,
  nonReplayable: true,
} as const;

export interface WidgetUpdateOutcome {
  ok: boolean;
  conflict: boolean;
  /** Dashboards whose layout the server moved to fit the new visualization. */
  adjustments: WidgetUpdateResult["layoutAdjustments"];
  error: NormalizedApiError | null;
}

export function useWidgetDetail(widgetId: string) {
  const [widget, setWidget] = useState<WidgetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axiosClient.get<unknown>(widgetPath(widgetId), {
          ...READ_CONFIG,
          signal,
        });
        setWidget(parseWidgetDetailResponse(response.data));
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [widgetId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  /**
   * `PATCH /widgets/:id`.
   *
   * The response is not just the widget: it also names every dashboard whose
   * revision moved and every placement the server **resized or repositioned**
   * because the new visualization's constraints no longer fitted the old box.
   * That is a consequence the user has to be told about, not swallowed.
   *
   * `querySpec` is **optional and normally absent**. The server replaces it
   * wholesale when it is sent and preserves it when it is not, so a rename
   * omits it — D23. `buildWidgetUpdate` decides; this only transports.
   */
  const update = async (input: {
    name: string;
    visualizationType: CrmVisualization;
    querySpec?: WidgetQuerySpec;
  }): Promise<WidgetUpdateOutcome> => {
    if (!widget) return { ok: false, conflict: false, adjustments: [], error: null };
    setIsSaving(true);
    try {
      const response = await axiosClient.patch<unknown>(
        widgetPath(widgetId),
        buildUpdateWidgetRequest({ revision: widget.revision, ...input }),
        WRITE_CONFIG,
      );
      const result = parseWidgetUpdateResponse(response.data);
      await load();
      return { ok: true, conflict: false, adjustments: result.layoutAdjustments, error: null };
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      return {
        ok: false,
        conflict: normalized.status === 409 && normalized.code === "CRM_WIDGET_REVISION_CONFLICT",
        adjustments: [],
        error: normalized,
      };
    } finally {
      setIsSaving(false);
    }
  };

  return { widget, isLoading, isSaving, error, update, reload: () => load() };
}
