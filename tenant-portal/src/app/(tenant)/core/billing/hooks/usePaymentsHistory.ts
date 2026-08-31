"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { CorePageMeta } from "../../contracts/core-page";
import type { TenantPayment } from "../payment-contract";
import {
  fetchTenantPayments,
  fetchWalletLedger,
  type WalletLedgerEntry,
} from "../wallet-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

interface PagedState<T> {
  items: T[];
  meta: CorePageMeta | null;
  error: NormalizedApiError | null;
  isLoading: boolean;
  hasLoaded: boolean;
}

const EMPTY: PagedState<never> = {
  items: [],
  meta: null,
  error: null,
  isLoading: true,
  hasLoaded: false,
};

/**
 * The two immutable histories behind the wallet: every payment attempt this
 * tenant made, and the wallet's own USD ledger.
 *
 * They page independently because they are separate routes with separate
 * failure modes — one of them being down is a degraded tab, not a dead screen.
 */
export function usePaymentsHistory() {
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [payments, setPayments] = useState<PagedState<TenantPayment>>(EMPTY);
  const [ledger, setLedger] = useState<PagedState<WalletLedgerEntry>>(EMPTY);

  const loadPayments = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setPayments((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const page = await fetchTenantPayments(paymentsPage, signal);
        if (signal?.aborted) return;
        setPayments({
          items: page.items,
          meta: page,
          error: null,
          isLoading: false,
          hasLoaded: true,
        });
      } catch (error) {
        if (isAbortError(error)) return;
        setPayments((current) => ({
          ...current,
          error: normalizeApiError(error),
          isLoading: false,
          hasLoaded: true,
        }));
      }
    },
    [paymentsPage],
  );

  const loadLedger = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLedger((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const page = await fetchWalletLedger(ledgerPage, signal);
        if (signal?.aborted) return;
        setLedger({
          items: page.items,
          meta: page,
          error: null,
          isLoading: false,
          hasLoaded: true,
        });
      } catch (error) {
        if (isAbortError(error)) return;
        setLedger((current) => ({
          ...current,
          error: normalizeApiError(error),
          isLoading: false,
          hasLoaded: true,
        }));
      }
    },
    [ledgerPage],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadPayments(controller.signal);
    });
    return () => controller.abort();
  }, [loadPayments]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadLedger(controller.signal);
    });
    return () => controller.abort();
  }, [loadLedger]);

  return {
    payments,
    ledger,
    paymentsPage,
    ledgerPage,
    setPaymentsPage,
    setLedgerPage,
    reloadPayments: () => loadPayments(),
    reloadLedger: () => loadLedger(),
  };
}
