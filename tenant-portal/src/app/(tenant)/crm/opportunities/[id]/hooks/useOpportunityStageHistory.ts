"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { opportunityPath } from "../../opportunity-contract";
import { parseOpportunityStageHistory, type OpportunityHistoryRow } from "./opportunity-stage-history-contract";

export function useOpportunityStageHistory(opportunityId: string, refreshToken: string) {
  const [items, setItems] = useState<OpportunityHistoryRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: string | null) => {
    inFlight.current?.abort();
    const controller = new AbortController(); inFlight.current = controller;
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ limit: "100" }); if (cursor) query.set("cursor", cursor);
      const response = await axiosClient.get<unknown>(`${opportunityPath(opportunityId)}/stage-history?${query}`, { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 });
      const page = parseOpportunityStageHistory(response.data, opportunityId);
      if (cursor && page.nextCursor === cursor) throw new Error("Repeated opportunity history cursor");
      if (controller.signal.aborted) return;
      setItems((current) => cursor ? [...current, ...page.items.filter((row) => !current.some(({ id }) => id === row.id))] : page.items);
      setNextCursor(page.nextCursor);
    } catch (caught) { if (!controller.signal.aborted) setError(normalizeApiError(caught)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [opportunityId]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(null); }); return () => { active = false; inFlight.current?.abort(); }; }, [load, refreshToken, revision]);
  return { items, nextCursor, error, loading, reload: () => setRevision((current) => current + 1), loadMore: () => { if (!loading && nextCursor) void load(nextCursor); } };
}
