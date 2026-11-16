"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { TRADE_LIST_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { isAbortError } from "../../documents/hooks/useTradeDocumentList";
import { parseSupplierAccounts, supplierAccountsPath, type SupplierAccountOption } from "../purchase-quotation-contract";

interface SupplierResult {
  scopeKey: string;
  search: string;
  items: SupplierAccountOption[];
  error: NormalizedApiError | null;
}

export function usePurchaseQuotationSuppliers(headers: Record<string, string>, enabled: boolean) {
  const scopeKey = JSON.stringify(headers);
  const [query, setQuery] = useState({ search: "", revision: 0 });
  const [result, setResult] = useState<SupplierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const searchSuppliers = useCallback((search: string) => {
    setQuery((current) => ({ search: search.trim().slice(0, 200), revision: current.revision + 1 }));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      void (async () => {
        try {
          const response = await tradeGet(supplierAccountsPath(query.search), {
            headers, signal: controller.signal, maxResponseBytes: TRADE_LIST_RESPONSE_BYTES,
          });
          const items = parseSupplierAccounts(response.data);
          if (!controller.signal.aborted) setResult({ scopeKey, search: query.search, items, error: null });
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          setResult({ scopeKey, search: query.search, items: [], error: normalizeApiError(error) });
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [enabled, headers, scopeKey, query]);

  const scoped = enabled && result?.scopeKey === scopeKey ? result : null;
  const current = scoped?.search === query.search ? scoped : null;
  return {
    suppliers: current?.items ?? [],
    suppliersError: current?.error ?? null,
    isLoadingSuppliers: enabled && (loading || current === null),
    canUseSupplierPicker: scoped !== null && scoped.error === null,
    searchSuppliers,
  };
}
