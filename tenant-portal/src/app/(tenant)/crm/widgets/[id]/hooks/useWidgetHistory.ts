"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { assertWidgetStatus, WIDGET_READ } from "../../hooks/widget-requests";
import { parseWidgetHistory, widgetHistoryPath, type WidgetHistoryEntry } from "../../widget-history-contract";
export type WidgetHistoryAnchor = { key: string; revision: number; activeVersion: number | null };

interface Request {
  key: string;
  beforeVersion?: number;
}

interface Snapshot {
  key: string;
  request: Request | null;
  items: WidgetHistoryEntry[];
  nextBeforeVersion: number | null;
  error: NormalizedApiError | null;
}

export function useWidgetHistory(widgetId: string, anchor?: WidgetHistoryAnchor) {
  const key = anchor?.key ?? null;
  const revision = anchor?.revision;
  const activeVersion = anchor?.activeVersion ?? null;
  const [request, setRequest] = useState<Request | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const command = request?.key === key ? request : null;

  useEffect(() => {
    if (!key || revision === undefined) return;
    const controller = new AbortController();
    const beforeVersion = command?.beforeVersion;
    async function load(historyKey: string, expectedRevision: number) {
      try {
        const response = await axiosClient.get<unknown>(widgetHistoryPath(widgetId, beforeVersion), { ...WIDGET_READ, signal: controller.signal });
        if (controller.signal.aborted) return;
        assertWidgetStatus(response, 200);
        const page = parseWidgetHistory(response.data, widgetId, expectedRevision, activeVersion, beforeVersion);
        setSnapshot((previous) => {
          const existing = beforeVersion !== undefined && previous?.key === historyKey ? previous.items : [];
          const seen = new Set(existing.map((item) => item.versionNumber));
          return { key: historyKey, request: command, nextBeforeVersion: page.nextBeforeVersion, error: null,
            items: [...existing, ...page.items.filter((item) => !seen.has(item.versionNumber))] };
        });
      } catch (error) {
        if (!controller.signal.aborted) setSnapshot({ key: historyKey, request: command, items: [], nextBeforeVersion: null, error: normalizeApiError(error) });
      }
    }
    void load(key, revision);
    return () => controller.abort();
  }, [activeVersion, command, key, revision, widgetId]);

  const visible = key && snapshot?.key === key ? snapshot : null;
  const loading = key !== null && (!visible || visible.request !== command);
  return {
    items: visible?.items ?? [], loading, failed: !!visible?.error, error: visible?.error ?? null,
    hasMore: visible?.nextBeforeVersion != null,
    loadMore: () => {
      if (key && !loading && visible?.nextBeforeVersion != null) {
        setRequest({ key, beforeVersion: visible.nextBeforeVersion });
      }
    },
    retry: () => { if (key && !loading) setRequest({ key }); },
  };
}
