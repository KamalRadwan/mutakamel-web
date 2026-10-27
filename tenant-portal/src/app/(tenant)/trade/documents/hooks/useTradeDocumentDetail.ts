"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [result, setResult] = useState<{
    key: string;
    document: T | null;
    isLoading: boolean;
    isMissing: boolean;
    error: NormalizedApiError | null;
  } | null>(null);
  const activeKey = useRef<string | null>(null);
  const request = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });

  const { isResolved, headers } = scope;
  const requestKey = JSON.stringify([
    basePath, id, scope.userId, isResolved,
    Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  // Hide obsolete details before the new route or scope's effect runs.
  const current = isResolved && result?.key === requestKey ? result : null;
  // Revisiting a previous scope must still require a fresh authorized read.
  if (result && result.key !== requestKey) setResult(null);

  const load = useCallback(
    async (): Promise<T | null> => {
      if (!isResolved || activeKey.current !== requestKey) return null;
      request.current.controller?.abort();
      const controller = new AbortController();
      const { signal } = controller;
      const generation = request.current.generation + 1;
      request.current = { generation, controller };
      const isCurrent = () => !signal.aborted && activeKey.current === requestKey &&
        request.current.generation === generation;
      setResult({ key: requestKey, document: null, isLoading: true, isMissing: false, error: null });
      try {
        const result = await tradeGet(tradeDocumentPath(basePath, id), {
          signal,
          headers,
          maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        });
        const parsed = parse(result.data);
        if (!isCurrent()) return null;
        setResult({ key: requestKey, document: parsed, isLoading: false, isMissing: false, error: null });
        return parsed;
      } catch (error) {
        if (!isCurrent() || isAbortError(error)) return null;
        const normalized = normalizeApiError(error);
        setResult({ key: requestKey, document: null, isLoading: false,
          isMissing: normalized.status === 404, error: normalized.status === 404 ? null : normalized });
        return null;
      }
    },
    [basePath, id, isResolved, headers, parse, requestKey],
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

  return {
    scope,
    document: current?.document ?? null,
    isLoading: isResolved && (!current || current.isLoading),
    isRefreshing: isResolved && (!current || current.isLoading),
    isMissing: current?.isMissing ?? false,
    loadError: current?.error ?? null,
    reload: () => load(),
  };
}
