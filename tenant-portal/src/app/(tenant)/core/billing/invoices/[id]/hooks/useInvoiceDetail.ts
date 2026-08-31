"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { fetchInvoice, type TenantInvoice } from "../../../billing-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * `GET /billing/invoices/:invoiceId` — 404 for both an absent invoice and one
 * belonging to another tenant, which is the correct answer to both.
 *
 * A malformed id in the URL is resolved here rather than sent: the route param
 * is `@IsUUID('7')` and a bad value is a stale or hand-edited link, which is a
 * not-found, not a validation error to surface.
 */
export function useInvoiceDetail(invoiceId: string) {
  const [invoice, setInvoice] = useState<TenantInvoice | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!isUUIDv7(invoiceId)) {
        setError({ status: 404, code: "INVOICE_NOT_FOUND" });
        setIsLoading(false);
        setHasLoaded(true);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchInvoice(invoiceId, signal);
        if (signal?.aborted) return;
        setInvoice(result);
        setHasLoaded(true);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setError(normalizeApiError(caught));
        setHasLoaded(true);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [invoiceId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  // Stable while `invoiceId` is: the payment hook takes this as its
  // settled-callback and puts it in an effect's dependency list, so a fresh
  // arrow per render would tear down and rebuild the poll on every render.
  const reload = useCallback(() => {
    void load();
  }, [load]);

  return {
    invoice,
    error,
    isNotFound: error?.status === 404,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    reload,
  };
}
