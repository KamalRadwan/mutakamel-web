"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { CorePageMeta } from "../../../contracts/core-page";
import { fetchInvoices, type TenantInvoice } from "../../billing-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * `GET /billing/invoices` — `PaginationQueryDto`, newest first.
 *
 * Server-side paging only. The total comes from the envelope's `meta`, so the
 * pager reflects what actually exists rather than the length of one page.
 */
export function useInvoices() {
  const [items, setItems] = useState<TenantInvoice[]>([]);
  const [meta, setMeta] = useState<CorePageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchInvoices(page, signal);
        if (signal?.aborted) return;
        setItems(result.items);
        setMeta(result);
        setHasLoaded(true);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setError(normalizeApiError(caught));
        setHasLoaded(true);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    items,
    total: meta?.total ?? 0,
    page,
    setPage,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    error,
    reload: () => load(),
  };
}
