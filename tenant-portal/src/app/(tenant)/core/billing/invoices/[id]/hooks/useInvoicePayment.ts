"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  createPaymentIntent,
  createPaymentQuote,
  fetchActiveIntent,
  fetchPaymentInputCurrencies,
  fetchPaymentStatus,
  type ActiveInvoicePaymentIntent,
  type InvoicePaymentQuote,
  type PaymentInputCurrencies,
  type TenantPayment,
} from "../../../payment-contract";

/**
 * `COLLECTION_HOLD_STATUSES` in `payments.service.ts` — the states in which a
 * payment still holds the collection open. Anything else is finished, one way
 * or another, and polling it forever would be a spinner that never resolves.
 */
const HOLD_STATUSES = ["CREATED", "PENDING", "REQUIRES_REVIEW"];

const POLL_INTERVAL_MS = 5_000;
/** Five minutes of polling. `INTENT_TTL_MS` expires an abandoned intent anyway. */
const MAX_POLLS = 60;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * The collection flow for one invoice: quote, intent, hand-off, and the polling
 * that is the only settlement authority.
 *
 * **A URL success is never settlement authority.** The owner returns from the
 * hosted checkout carrying whatever the provider put in the query string, and
 * this hook ignores all of it. The truth is `GET .../payment-intents/active`
 * and `GET /billing/payments/:paymentId`, so those are what it polls.
 */
export function useInvoicePayment(invoiceId: string, onSettled: () => void) {
  const { t } = useI18n();
  const toast = useToast();

  const [currencies, setCurrencies] = useState<PaymentInputCurrencies | null>(null);
  const [currenciesFailed, setCurrenciesFailed] = useState(false);
  const [quote, setQuote] = useState<InvoicePaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<NormalizedApiError | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [active, setActive] = useState<ActiveInvoicePaymentIntent | null>(null);
  const [payment, setPayment] = useState<TenantPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pollsExhausted, setPollsExhausted] = useState(false);
  /** Held across retries so a resend is the SAME write, never a second charge. */
  const [pendingIntentKey, setPendingIntentKey] = useState<string | null>(null);
  const [ambiguousKey, setAmbiguousKey] = useState<string | null>(null);
  const pollCount = useRef(0);

  const readAuthoritativeState = useCallback(
    async (signal?: AbortSignal): Promise<ActiveInvoicePaymentIntent | null> => {
      const current = await fetchActiveIntent(invoiceId, signal);
      if (signal?.aborted) return current;
      setActive(current);
      if (current) {
        // The payment projection carries the settled USD figures the active
        // intent does not; both are read because neither is a superset.
        try {
          setPayment(await fetchPaymentStatus(current.paymentId, signal));
        } catch {
          setPayment(null);
        }
      } else {
        setPayment(null);
      }
      return current;
    },
    [invoiceId],
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      const [currencyResult, intentResult] = await Promise.allSettled([
        fetchPaymentInputCurrencies(signal),
        readAuthoritativeState(signal),
      ]);
      if (signal?.aborted) return;
      if (currencyResult.status === "fulfilled") {
        setCurrencies(currencyResult.value);
        setCurrenciesFailed(false);
      } else if (!isAbortError(currencyResult.reason)) {
        setCurrenciesFailed(true);
      }
      if (intentResult.status === "rejected" && !isAbortError(intentResult.reason)) {
        setActive(null);
      }
      setIsLoading(false);
    },
    [readAuthoritativeState],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  // The poll runs only while a hold is genuinely open. When the hold clears,
  // the invoice itself is refetched — its status is what actually changed.
  //
  // It keys on the intent's id and status, NOT on the `active` object: every
  // poll writes a freshly parsed object, so an object dependency would tear the
  // interval down and rebuild it on each tick — resetting the attempt counter
  // and turning a bounded poll into an unbounded one.
  const activePaymentId = active?.paymentId ?? null;
  const activeStatus = active?.status ?? null;
  useEffect(() => {
    if (!activePaymentId || !activeStatus || !HOLD_STATUSES.includes(activeStatus)) return;
    pollCount.current = 0;
    // Deferred a microtask: setting state synchronously in an effect body
    // cascades a render, and this only has to clear before the first poll.
    queueMicrotask(() => setPollsExhausted(false));
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        window.clearInterval(timer);
        setPollsExhausted(true);
        return;
      }
      void readAuthoritativeState(controller.signal)
        .then((current) => {
          if (!current && !controller.signal.aborted) {
            window.clearInterval(timer);
            onSettled();
          }
        })
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [activePaymentId, activeStatus, readAuthoritativeState, onSettled]);

  const requestQuote = useCallback(
    async (paymentCurrencyCode: string): Promise<void> => {
      if (isQuoting) return;
      setIsQuoting(true);
      setQuoteError(null);
      try {
        setQuote(await createPaymentQuote(invoiceId, paymentCurrencyCode));
      } catch (error) {
        const normalized = normalizeApiError(error);
        setQuote(null);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          setQuoteError(normalized);
        }
      } finally {
        setIsQuoting(false);
      }
    },
    [invoiceId, isQuoting, toast],
  );

  /**
   * `POST .../payment-intents` — `@IdempotencyRequired()`.
   *
   * A replay comes back with `Idempotency-Replayed: true` and the same intent.
   * That is the write having run exactly once, so it is reported as success;
   * calling it a duplicate would tell the owner something went wrong when
   * nothing did.
   */
  const startPayment = useCallback(
    async (retryKey?: string): Promise<void> => {
      if (!quote || isStarting) return;
      const key = retryKey ?? pendingIntentKey ?? generateUUIDv7();
      setPendingIntentKey(key);
      setIsStarting(true);
      setAmbiguousKey(null);
      try {
        const { replayed } = await createPaymentIntent(invoiceId, quote.quoteId, key);
        toast.success(
          t.coreBilling.intentCreatedTitle,
          replayed ? t.coreBilling.intentReplayed : t.coreBilling.intentCreated,
        );
        setPendingIntentKey(null);
        await readAuthoritativeState();
      } catch (error) {
        const normalized = normalizeApiError(error);
        // A transport-level failure on a write that may already have reached
        // the server is ambiguous, not failed. The key is the only safe retry.
        if (normalized.status === 0) {
          setAmbiguousKey(key);
        } else if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreBilling.intentFailed, normalized);
        }
        // A 409 here usually means a collection hold already exists. Refetching
        // is what turns "that was refused" into a screen showing why — the
        // conflict handling docs/architecture/data-layer.md#errors requires.
        if (normalized.status === 409) await readAuthoritativeState();
      } finally {
        setIsStarting(false);
      }
    },
    [quote, isStarting, pendingIntentKey, invoiceId, toast, t, readAuthoritativeState],
  );

  return {
    currencies,
    currenciesFailed,
    quote,
    quoteError,
    isQuoting,
    isStarting,
    active,
    payment,
    isLoading,
    pollsExhausted,
    ambiguousKey,
    requestQuote,
    startPayment,
    clearQuote: () => {
      setQuote(null);
      setQuoteError(null);
    },
    dismissAmbiguous: () => setAmbiguousKey(null),
    refreshStatus: () => readAuthoritativeState(),
  };
}
