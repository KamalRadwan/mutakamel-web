"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { parsePriceBookDetail, priceBookDetailPath, type PriceBookDetail } from "../pricing-contract";

interface Options {
  id: string;
  scopeKey: string;
  companyId: string | null;
  enabled: boolean;
  headers: Record<string, string>;
}

export function usePriceBookLoader({ id, scopeKey, companyId, enabled, headers }: Options) {
  const [saved, setSaved] = useState<{ key: string; detail: PriceBookDetail } | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: NormalizedApiError | null } | null>(null);
  const [loading, setLoading] = useState<{ key: string; pending: boolean } | null>(null);
  const activeKey = useRef<string | null>(scopeKey);
  const sequence = useRef(0);
  useLayoutEffect(() => {
    activeKey.current = scopeKey;
    sequence.current += 1;
    return () => { activeKey.current = null; sequence.current += 1; };
  }, [scopeKey]);
  const isCurrentScope = useCallback(() => activeKey.current === scopeKey, [scopeKey]);

  const load = useCallback(async (signal?: AbortSignal): Promise<PriceBookDetail | null> => {
    if (!enabled || !isCurrentScope() || signal?.aborted) return null;
    const request = ++sequence.current;
    const current = () => isCurrentScope() && request === sequence.current && !signal?.aborted;
    setLoading({ key: scopeKey, pending: true });
    setFailure({ key: scopeKey, error: null });
    try {
      const result = await tradeGet(priceBookDetailPath(id), { signal, headers, maxResponseBytes: 800_000 });
      const parsed = parsePriceBookDetail(result.data);
      if (!current()) return null;
      if (parsed.book.id !== id || (companyId && parsed.book.companyId && parsed.book.companyId !== companyId)) throw new Error("INVALID_PRICING_RESPONSE");
      setSaved({ key: scopeKey, detail: parsed });
      return parsed;
    } catch (err) {
      if (current()) setFailure({ key: scopeKey, error: normalizeApiError(err) });
      return null;
    } finally {
      if (current()) setLoading({ key: scopeKey, pending: false });
    }
  }, [enabled, isCurrentScope, scopeKey, id, companyId, headers]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);
  return {
    detail: enabled && saved?.key === scopeKey ? saved.detail : null,
    queryError: enabled && failure?.key === scopeKey ? failure.error : null,
    isLoading: enabled && (loading?.key !== scopeKey || loading.pending),
    load, isCurrentScope,
  };
}
