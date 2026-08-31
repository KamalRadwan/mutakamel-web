"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { TRADE_LIST_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { isAbortError } from "../../documents/hooks/useTradeDocumentList";
import {
  parseQuotationCustomerPage,
  quotationCustomerOptionsPath,
  type QuotationCustomerOption,
} from "../quotation-contract";

export interface QuotationCustomersState {
  options: QuotationCustomerOption[];
  search: string;
  setSearch: (search: string) => void;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: NormalizedApiError | null;
}

/**
 * The customer picker behind `GET /quotations/customer-options` — the **only**
 * cursor-paged endpoint in the whole Trade app.
 *
 * Three properties of that cursor decide the shape of this hook:
 *
 * 1. `nextCursor` is **omitted** on the last page rather than sent as `null`,
 *    so absence is the terminator.
 * 2. The cursor is passed back **verbatim**. It is base64url JSON and unsigned,
 *    which changes nothing about how the portal treats it — parsing it would
 *    couple this screen to a shape the service is free to change.
 * 3. An unparseable cursor is **silently ignored** and the first page comes
 *    back with no error at all. A paging bug therefore looks like an infinite
 *    first page, which is why appending is guarded on the cursor actually
 *    changing.
 */
export function useQuotationCustomers(
  headers: Record<string, string>,
  isEnabled: boolean,
): QuotationCustomersState {
  const [options, setOptions] = useState<QuotationCustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal: AbortSignal, activeCursor: string | null, activeSearch: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradeGet(quotationCustomerOptionsPath(activeSearch, activeCursor), {
          signal,
          headers,
          maxResponseBytes: TRADE_LIST_RESPONSE_BYTES,
        });
        const page = parseQuotationCustomerPage(result.data);
        setOptions((current) => (activeCursor === null ? page.items : [...current, ...page.items]));
        // Guarding on a *different* cursor is what stops the silent-ignore
        // behaviour from becoming an endless "load more" that re-appends the
        // same first page forever.
        setNextCursor(page.nextCursor === activeCursor ? null : page.nextCursor);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setError(normalizeApiError(caught));
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [headers],
  );

  useEffect(() => {
    if (!isEnabled) return undefined;
    const controller = new AbortController();
    // Deferred to a microtask so the loader's first `setState` is not
    // synchronous with the effect body.
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal, cursor, search);
    });
    return () => controller.abort();
  }, [load, isEnabled, cursor, search]);

  return {
    options,
    search,
    setSearch: (next: string) => {
      setOptions([]);
      setCursor(null);
      setNextCursor(null);
      setSearch(next);
    },
    isLoading,
    hasMore: nextCursor !== null,
    loadMore: () => {
      if (nextCursor !== null) setCursor(nextCursor);
    },
    error,
  };
}
