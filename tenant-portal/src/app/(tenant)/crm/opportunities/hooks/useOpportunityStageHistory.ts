"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  opportunityStageHistoryPath,
  parseOpportunityStageHistory,
  type OpportunityStageHistoryEntry,
} from "../opportunity-contract";

export function useOpportunityStageHistory(id: string | undefined, reload: number, onForbidden?: () => void) {
  const [items, setItems] = useState<OpportunityStageHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const forbidden = useRef(onForbidden);
  useEffect(() => { forbidden.current = onForbidden; }, [onForbidden]);

  const load = useCallback(async (cursor: string | null = null) => {
    if (!id || !isUUIDv7(id) || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    setDenied(false);
    try {
      const response = await axiosClient.get<unknown>(opportunityStageHistoryPath(id, cursor), {
        signal: controller.signal, cache: "no-store", maxResponseBytes: 256 * 1024,
      });
      const page = parseOpportunityStageHistory(response.data);
      if (cursor && page.nextCursor === cursor) throw new Error("History cursor did not advance.");
      if (controller.signal.aborted) return;
      setItems((previous) => cursor
        ? [...previous, ...page.items.filter((entry) => !previous.some(({ id }) => id === entry.id))]
        : page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailed(true);
        if (normalizeApiError(error).status === 403) {
          setDenied(true);
          setItems([]);
          setNextCursor(null);
          forbidden.current?.();
        }
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setItems([]);
      setNextCursor(null);
      setFailed(false);
      setDenied(false);
      setLoading(false);
      void load();
    });
    return () => {
      controller.abort();
      request.current?.abort();
      request.current = null;
    };
  }, [load, reload]);

  return { items, nextCursor, loading, failed, denied, loadMore: () => load(nextCursor) };
}
