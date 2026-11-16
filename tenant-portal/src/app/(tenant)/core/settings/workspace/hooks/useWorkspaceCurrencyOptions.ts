"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCurrencyOptions, type CurrencyOption } from "../currency-options";
import {
  classifyWorkspaceFailure,
  isAbortError,
  type WorkspaceQueryFailure,
} from "../workspace-errors";

export function useWorkspaceCurrencyOptions(canRead: boolean, canReadCurrencies: boolean) {
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [currenciesTotal, setCurrenciesTotal] = useState(0);
  const [isCurrenciesTruncated, setIsCurrenciesTruncated] = useState(false);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(false);
  const [currencyLoadFailure, setCurrencyLoadFailure] = useState<WorkspaceQueryFailure | null>(
    null,
  );
  const currencyAbortRef = useRef<AbortController | null>(null);

  const fetchCurrencies = useCallback(async (): Promise<void> => {
    currencyAbortRef.current?.abort();
    if (!canRead || !canReadCurrencies) {
      currencyAbortRef.current = null;
      setCurrencyOptions([]);
      setCurrenciesTotal(0);
      setIsCurrenciesTruncated(false);
      setCurrencyLoadFailure(null);
      setIsLoadingCurrencies(false);
      return;
    }

    const controller = new AbortController();
    currencyAbortRef.current = controller;
    setIsLoadingCurrencies(true);
    setCurrencyLoadFailure(null);

    try {
      const result = await loadCurrencyOptions(controller.signal);
      if (controller.signal.aborted || currencyAbortRef.current !== controller) return;
      setCurrencyOptions(result.currencies);
      setCurrenciesTotal(result.total);
      setIsCurrenciesTruncated(result.isTruncated);
      setCurrencyLoadFailure(null);
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        currencyAbortRef.current !== controller
      ) {
        return;
      }
      setCurrencyOptions([]);
      setCurrenciesTotal(0);
      setIsCurrenciesTruncated(false);
      setCurrencyLoadFailure(classifyWorkspaceFailure(error));
    } finally {
      if (currencyAbortRef.current === controller && !controller.signal.aborted) {
        setIsLoadingCurrencies(false);
      }
    }
  }, [canRead, canReadCurrencies]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void fetchCurrencies();
    });
    return () => {
      disposed = true;
      currencyAbortRef.current?.abort();
    };
  }, [fetchCurrencies]);

  return {
    currencyOptions,
    currenciesTotal,
    isCurrenciesTruncated,
    isLoadingCurrencies,
    currencyLoadFailure,
    fetchCurrencies,
  };
}
