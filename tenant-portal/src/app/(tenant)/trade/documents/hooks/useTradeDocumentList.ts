"use client";

import { useCallback, useEffect, useState } from "react";
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
 * `status` and `partyId` — and nothing else. There is no search, no sort and no
 * date range on any of the six list routes, so none is offered: a control that
 * silently does nothing is worse than its absence. Ordering is fixed at
 * `createdAt DESC` by the service.
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
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [partyId, setPartyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const { isResolved, headers } = scope;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      // Both scope headers or nothing: BRANCH_REQUIRED is refused by the
      // Gateway as a 400 before trade-app sees the request, and that is not a
      // failure the user can act on. The screen says "pick a branch" instead.
      if (!isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await tradeGet(
          tradeListPath(basePath, page, status || undefined, isUUIDv7(partyId) ? partyId : undefined),
          { signal, headers, maxResponseBytes: TRADE_LIST_RESPONSE_BYTES },
        );
        const parsed = parseTradeListPage(result.data, parseItem);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [basePath, page, status, partyId, isResolved, headers, parseItem],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => load(), [load]);
  useRealtimeResync(reload);

  return {
    scope,
    items,
    pageInfo: { page, limit: TRADE_DOCUMENT_PAGE_SIZE, total },
    status,
    partyId,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
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
