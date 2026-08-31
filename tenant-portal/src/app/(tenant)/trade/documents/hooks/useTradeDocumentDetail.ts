"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { TRADE_DOCUMENT_RESPONSE_BYTES, tradeDocumentPath } from "../trade-document-contract";
import { isAbortError } from "./useTradeDocumentList";
import { useTradeDocumentScope, type TradeDocumentScope } from "./useTradeDocumentScope";

export interface TradeDocumentDetailState<T> {
  scope: TradeDocumentScope;
  document: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  /** True when the record is gone — `NotFoundState`, and never a retry. */
  isMissing: boolean;
  loadError: NormalizedApiError | null;
  reload: () => Promise<T | null>;
}

/**
 * The detail half of every commercial-document screen.
 *
 * A 404 is separated from every other failure on purpose: the request
 * succeeded and the answer was "this does not exist", so a retry can never
 * change it. Trade reaches 404 two ways here — an explicit `*.NOT_FOUND`, and
 * `TRADE.QUOTE.TRANSITION_NOT_ALLOWED` thrown from a second site when the
 * document cannot be loaded in the caller's scope — so the status, not the
 * code, is what this branches on.
 */
export function useTradeDocumentDetail<T>(
  basePath: string,
  id: string,
  parse: (payload: unknown) => T,
): TradeDocumentDetailState<T> {
  const scope = useTradeDocumentScope();
  const [document, setDocument] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isMissing, setIsMissing] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);

  const { isResolved, headers } = scope;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<T | null> => {
      if (!isResolved) {
        setIsLoading(false);
        return null;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await tradeGet(tradeDocumentPath(basePath, id), {
          signal,
          headers,
          maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        });
        const parsed = parse(result.data);
        setDocument(parsed);
        setIsMissing(false);
        setHasLoaded(true);
        return parsed;
      } catch (error) {
        if (isAbortError(error)) return null;
        const normalized = normalizeApiError(error);
        if (normalized.status === 404) setIsMissing(true);
        else setLoadError(normalized);
        return null;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [basePath, id, isResolved, headers, parse],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    scope,
    document,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isMissing,
    loadError,
    reload: () => load(),
  };
}
