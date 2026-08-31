"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { fetchBillingSummary, type BillingSummary } from "../billing-contract";
import { fetchPaymentInputCurrencies, type PaymentInputCurrencies } from "../payment-contract";
import { createWalletTopup, type TopupResult } from "../wallet-contract";

// `TopupDto.amount` — `/^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$/`.
// Copied verbatim so the field rejects locally what the server would reject
// remotely, instead of spending a round trip to learn it.
const TOPUP_AMOUNT = /^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$/u;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * The billing summary, the collection currencies a top-up may use, and the
 * top-up write itself.
 *
 * The two reads are settled independently: a failing currency catalogue must
 * not blank a page whose subscription and wallet loaded fine, and a
 * capabilities-shaped failure is a perfectly ordinary answer
 * (docs/design/states.md#partial-failure-needs-promiseallsettled).
 */
export function useBillingSummary() {
  const { t } = useI18n();
  const toast = useToast();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [summaryError, setSummaryError] = useState<NormalizedApiError | null>(null);
  const [currencies, setCurrencies] = useState<PaymentInputCurrencies | null>(null);
  const [currenciesFailed, setCurrenciesFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topup, setTopup] = useState<TopupResult | null>(null);
  const [topupError, setTopupError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    const [summaryResult, currencyResult] = await Promise.allSettled([
      fetchBillingSummary(signal),
      fetchPaymentInputCurrencies(signal),
    ]);
    if (signal?.aborted) return;

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
      setSummaryError(null);
    } else if (!isAbortError(summaryResult.reason)) {
      setSummaryError(normalizeApiError(summaryResult.reason));
    }

    if (currencyResult.status === "fulfilled") {
      setCurrencies(currencyResult.value);
      setCurrenciesFailed(false);
    } else if (!isAbortError(currencyResult.reason)) {
      setCurrenciesFailed(true);
    }

    setHasLoaded(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  /**
   * `POST /payments/topup` — `@AllowedDuringDunning()`, idempotency-required.
   *
   * The key is minted once per submission and reused by a retry of the same
   * intent, so a replay returns the same hosted checkout rather than opening a
   * second charge. Nothing is redirected automatically: the checkout URL is
   * offered as a control the owner presses.
   */
  const submitTopup = useCallback(
    async (amount: string, currencyCode: string): Promise<boolean> => {
      if (isToppingUp) return false;
      const trimmed = amount.trim();
      if (!TOPUP_AMOUNT.test(trimmed)) {
        setTopupError(t.coreBilling.topupAmountInvalid);
        return false;
      }
      setIsToppingUp(true);
      setTopupError(null);
      try {
        const result = await createWalletTopup(trimmed, currencyCode, generateUUIDv7());
        setTopup(result);
        toast.success(
          t.coreBilling.topupStartedTitle,
          result.replayed ? t.coreBilling.topupReplayed : t.coreBilling.topupStarted,
        );
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        // The transport already raises its own toast for a 403.
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreBilling.topupFailed, normalized);
        }
        setTopupError(t.coreBilling.topupFailed);
        return false;
      } finally {
        setIsToppingUp(false);
      }
    },
    [isToppingUp, t, toast],
  );

  return {
    summary,
    summaryError,
    currencies,
    currenciesFailed,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isToppingUp,
    topup,
    topupError,
    submitTopup,
    dismissTopup: () => setTopup(null),
    reload: () => load(),
  };
}
