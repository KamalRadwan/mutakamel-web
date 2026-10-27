"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRealtimeResync } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import {
  TRADE_DOCUMENT_PAGE_SIZE,
  TRADE_LIST_RESPONSE_BYTES,
  parseTradeListPage,
  tradeListPath,
} from "../trade-document-contract";
import { useTradeDocumentScope, type TradeDocumentScope } from "./useTradeDocumentScope";

export interface TradeDocumentListState<T> {
  scope: TradeDocumentScope;
  items: T[];
  pageInfo: { page: number; limit: number; total: number };
  status: string;
  partyId: string;
  isLoading: boolean;
  isRefreshing: boolean;
  queryError: NormalizedApiError | null;
  setPage: (page: number) => void;
  setStatus: (status: string) => void;
  setPartyId: (partyId: string) => void;
  reload: () => Promise<void>;
}

/**
 * The list half of every commercial-document screen.
 *
 * `DocumentListQueryDto` reads exactly four parameters — `page`, `limit`,
 * `status` and `partyId` — and nothing else.
 *
 * The response is flat `{ items, total, page, limit }` with no `totalPages`,
 * `hasNext` or `hasPrev`; `DataTable` derives its own pager from the three
 * numbers, which is why `PageInfo` is returned rather than a fabricated shape.
 */
export function useTradeDocumentList<T>(
  basePath: string,
  parseItem: (item: unknown) => T,
): TradeDocumentListState<T> {
  const scope = useTradeDocumentScope();
  const searchParams = useSearchParams();
  const urlPartyId =
    searchParams?.get("partyId")?.trim() ||
    searchParams?.get("search")?.trim() ||
    "";
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [partyId, setPartyId] = useState(() => urlPartyId);
  const [result, setResult] = useState<{
    key: string;
    items: T[];
    total: number;
    isLoading: boolean;
    hasLoaded: boolean;
    error: NormalizedApiError | null;
  } | null>(null);
  const activeKey = useRef<string | null>(null);
  const request = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });

  const [prevUrlPartyId, setPrevUrlPartyId] = useState(urlPartyId);
  if (prevUrlPartyId !== urlPartyId) {
    setPrevUrlPartyId(urlPartyId);
    setPage(1);
    setPartyId(urlPartyId);
  }

  const { isResolved, headers } = scope;
  const scopeKey = JSON.stringify([
    basePath, scope.userId, isResolved,
    Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  const [previousScopeKey, setPreviousScopeKey] = useState(scopeKey);
  if (previousScopeKey !== scopeKey) {
    setPreviousScopeKey(scopeKey);
    setPage(1);
  }
  const requestKey = JSON.stringify([scopeKey, page, status, partyId]);
  // Quarantine old rows during render, before the new scope's effect runs.
  const current = isResolved && result?.key === requestKey ? result : null;

  const load = useCallback(
    async (): Promise<void> => {
      // Both scope headers or nothing: BRANCH_REQUIRED is refused by the
      // Gateway as a 400 before trade-app sees the request, and that is not a
      // failure the user can act on. The screen says "pick a branch" instead.
      if (!isResolved || activeKey.current !== requestKey) return;
      request.current.controller?.abort();
      const controller = new AbortController();
      const { signal } = controller;
      const generation = request.current.generation + 1;
      request.current = { generation, controller };
      const isCurrent = () => !signal.aborted && activeKey.current === requestKey &&
        request.current.generation === generation;
      setResult((previous) => ({
        key: requestKey,
        items: previous?.key === requestKey ? previous.items : [],
        total: previous?.key === requestKey ? previous.total : 0,
        hasLoaded: previous?.key === requestKey && previous.hasLoaded,
        isLoading: true,
        error: null,
      }));
      try {
        const trimmedPartyId = partyId.trim();
        const result = await tradeGet(
          tradeListPath(
            basePath,
            page,
            status || undefined,
            isUUIDv7(trimmedPartyId) ? trimmedPartyId : undefined,
          ),
          { signal, headers, maxResponseBytes: TRADE_LIST_RESPONSE_BYTES },
        );
        const parsed = parseTradeListPage(result.data, parseItem);
        if (!isCurrent()) return;
        setResult({ key: requestKey, items: parsed.items, total: parsed.total,
          hasLoaded: true, isLoading: false, error: null });
      } catch (error) {
        if (!isCurrent()) return;
        setResult({ key: requestKey, items: [], total: 0, hasLoaded: false,
          isLoading: false, error: normalizeApiError(error) });
      }
    },
    [basePath, page, status, partyId, isResolved, headers, parseItem, requestKey],
  );

  useEffect(() => {
    activeKey.current = requestKey;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      activeKey.current = null;
      request.current.controller?.abort();
      request.current.generation += 1;
    };
  }, [load, requestKey]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => load(), [load]);
  useRealtimeResync(reload);

  return {
    scope,
    items: current?.items ?? [],
    pageInfo: { page, limit: TRADE_DOCUMENT_PAGE_SIZE, total: current?.total ?? 0 },
    status,
    partyId,
    isLoading: isResolved && (!current || (current.isLoading && !current.hasLoaded)),
    isRefreshing: isResolved && (!current || current.isLoading),
    queryError: current?.error ?? null,
    setPage,
    setStatus: (next: string) => {
      setPage(1);
      setStatus(next);
    },
    setPartyId: (next: string) => {
      setPage(1);
      setPartyId(next);
    },
    reload,
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
