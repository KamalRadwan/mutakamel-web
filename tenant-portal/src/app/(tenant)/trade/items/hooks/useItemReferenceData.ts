"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import {
  itemReferenceDataPath,
  parseItemReferenceData,
  type ItemReferenceData,
} from "../item-reference-data-contract";

const RESPONSE_LIMIT_BYTES = 200_000;
const EMPTY_REFERENCE_DATA: ItemReferenceData = {
  owners: [],
  taxes: [],
  companyCurrencyCode: null,
};

export function useItemReferenceData(enabled: boolean) {
  // Reference data is tenant-wide for owners and company-scoped for taxes and
  // currency. Deliberately strip branch/channel context from this request.
  const { headers } = useTradeScopeRequest("COMPANY");
  const scopeKey = headers[COMPANY_SCOPE_HEADER] ?? "tenant";
  const [data, setData] = useState<ItemReferenceData>(EMPTY_REFERENCE_DATA);
  const [loadedScopeKey, setLoadedScopeKey] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setError(null);
      void tradeGet(itemReferenceDataPath(searchTerm), {
        signal: controller.signal,
        headers,
        maxResponseBytes: RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (!controller.signal.aborted) {
            setData(parseItemReferenceData(result.data));
            setLoadedScopeKey(scopeKey);
          }
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setData(EMPTY_REFERENCE_DATA);
          setLoadedScopeKey(scopeKey);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, headers, scopeKey, searchTerm]);

  const search = useCallback((query: string) => setSearchTerm(query), []);
  const visibleData = loadedScopeKey === scopeKey ? data : EMPTY_REFERENCE_DATA;
  return { ...visibleData, isLoading, error, search };
}
