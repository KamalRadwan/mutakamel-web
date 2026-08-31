import { readCoreData, type CorePath } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { isUUIDv7 } from "@/lib/uuid";
import { corePost } from "../core-api";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  record,
  requiredBoolean,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import { invoicePath } from "./billing-contract";
import {
  currencyCode,
  invalidBillingResponse,
  nullableTimestamp,
  nullableWireEnum,
  requiredDecimal,
  wireEnum,
} from "./billing-validation";

// The collection flow — `PaymentsService`
// (../backend/mutakamel-apps/core-app/src/tenant/payments/payments.service.ts):
// payment-quote -> payment-intent -> hosted checkout -> poll active/status.
//
// A URL success is never settlement authority. The provider redirect carries
// whatever it wants in the query string; the only truth is
// `GET .../payment-intents/active` and `GET /billing/payments/:paymentId`.
// The webhook (`POST /public/payments/webhook`) is HMAC-authenticated and
// marked EXTERNAL_CALLBACK_DO_NOT_CALL — the portal never calls it.

const PAYMENT_INPUT_CURRENCIES_PATH =
  "/api/tenant/core/v1/billing/payment-input-currencies" as const;

function paymentQuotePath(invoiceId: string): CorePath {
  return `${invoicePath(invoiceId)}/payment-quote`;
}

function paymentIntentsPath(invoiceId: string): CorePath {
  return `${invoicePath(invoiceId)}/payment-intents`;
}

function activePaymentIntentPath(invoiceId: string): CorePath {
  return `${invoicePath(invoiceId)}/payment-intents/active`;
}

// Written as one literal rather than assembled from a base constant: the base
// alone is not a route, and `scripts/docs/verify-called-routes.mjs` reads string
// literals, so a bare `/billing/payments` const reads to it as a fabricated
// endpoint.
function paymentStatusPath(paymentId: string): CorePath {
  if (!isUUIDv7(paymentId)) invalidBillingResponse();
  return `/api/tenant/core/v1/billing/payments/${encodeURIComponent(paymentId)}`;
}

// The provider checkout URL, accepted only over https. It leaves this origin
// entirely, so the one thing worth asserting is the scheme: a `javascript:`
// value reaching an anchor would be an XSS sink handed over by an upstream
// nobody in the browser can vouch for.
export function checkoutUrl(source: Record<string, unknown>): string | null {
  const value = source.checkoutUrl;
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.startsWith("https://") || value.length > 2048) {
    invalidBillingResponse();
  }
  return value;
}

export interface InvoicePaymentQuote {
  quoteId: string;
  invoiceId: string;
  invoiceOutstandingUsd: string;
  /** Applied from the USD wallet before the gateway is asked for anything. */
  walletAppliedUsd: string;
  gatewayAmountUsd: string;
  /** The amount in the chosen collection currency — a display value, not a balance. */
  providerAmount: string;
  providerCurrencyCode: string;
  currencyUnitsPerUsd: string;
  rateRevisionId: string | null;
  rateObservedAt: string;
  /** Short-lived. Past this the quote is dead and the owner must re-quote. */
  expiresAt: string;
}

export function parseInvoicePaymentQuote(payload: unknown): InvoicePaymentQuote {
  const quote = record(payload);
  if (!quote) invalidBillingResponse();
  return {
    quoteId: requiredUuidV7(quote, "quoteId"),
    invoiceId: requiredUuidV7(quote, "invoiceId"),
    invoiceOutstandingUsd: requiredDecimal(quote, "invoiceOutstandingUsd"),
    walletAppliedUsd: requiredDecimal(quote, "walletAppliedUsd"),
    gatewayAmountUsd: requiredDecimal(quote, "gatewayAmountUsd"),
    providerAmount: requiredDecimal(quote, "providerAmount"),
    providerCurrencyCode: currencyCode(quote, "providerCurrencyCode"),
    currencyUnitsPerUsd: requiredDecimal(quote, "currencyUnitsPerUsd"),
    rateRevisionId:
      quote.rateRevisionId === undefined || quote.rateRevisionId === null
        ? null
        : requiredUuidV7(quote, "rateRevisionId"),
    rateObservedAt: requiredTimestamp(quote, "rateObservedAt"),
    expiresAt: requiredTimestamp(quote, "expiresAt"),
  };
}

export interface InvoicePaymentIntent {
  paymentId: string;
  status: string;
  checkoutUrl: string | null;
  requiresExternalPayment: boolean;
  expiresAt: string | null;
  invoiceStatus: string;
  subscriptionStatus: string;
}

export function parseInvoicePaymentIntent(payload: unknown): InvoicePaymentIntent {
  const intent = record(payload);
  if (!intent) invalidBillingResponse();
  return {
    paymentId: requiredUuidV7(intent, "paymentId"),
    status: wireEnum(intent, "status"),
    checkoutUrl: checkoutUrl(intent),
    requiresExternalPayment: requiredBoolean(intent, "requiresExternalPayment"),
    expiresAt: nullableTimestamp(intent, "expiresAt"),
    invoiceStatus: wireEnum(intent, "invoiceStatus"),
    subscriptionStatus: wireEnum(intent, "subscriptionStatus"),
  };
}

export interface ActiveInvoicePaymentIntent {
  paymentId: string;
  status: string;
  checkoutUrl: string | null;
  requiresExternalPayment: boolean;
  expiresAt: string | null;
  /** CONTINUE_CHECKOUT · CHECK_STATUS · RECONCILIATION_REQUIRED. */
  recoveryAction: string;
}

export function parseActiveIntent(payload: unknown): ActiveInvoicePaymentIntent | null {
  if (payload === null || payload === undefined) return null;
  const intent = record(payload);
  if (!intent) invalidBillingResponse();
  return {
    paymentId: requiredUuidV7(intent, "paymentId"),
    status: wireEnum(intent, "status"),
    checkoutUrl: checkoutUrl(intent),
    requiresExternalPayment: requiredBoolean(intent, "requiresExternalPayment"),
    expiresAt: nullableTimestamp(intent, "expiresAt"),
    recoveryAction: wireEnum(intent, "recoveryAction"),
  };
}

export interface TenantPayment {
  paymentId: string;
  purpose: string;
  provider: string;
  status: string;
  invoiceId: string | null;
  invoiceStatus: string | null;
  subscriptionStatus: string | null;
  providerAmount: string;
  providerCurrencyCode: string;
  settlementAmountUsd: string;
  walletAppliedUsd: string;
  totalAppliedUsd: string;
  createdAt: string;
  updatedAt: string;
}

export function parseTenantPayment(payload: unknown): TenantPayment {
  const payment = record(payload);
  if (!payment) invalidBillingResponse();
  return {
    paymentId: requiredUuidV7(payment, "paymentId"),
    purpose: wireEnum(payment, "purpose"),
    provider: wireEnum(payment, "provider"),
    status: wireEnum(payment, "status"),
    invoiceId:
      payment.invoiceId === undefined || payment.invoiceId === null
        ? null
        : requiredUuidV7(payment, "invoiceId"),
    invoiceStatus: nullableWireEnum(payment, "invoiceStatus"),
    subscriptionStatus: nullableWireEnum(payment, "subscriptionStatus"),
    providerAmount: requiredDecimal(payment, "providerAmount"),
    providerCurrencyCode: currencyCode(payment, "providerCurrencyCode"),
    settlementAmountUsd: requiredDecimal(payment, "settlementAmountUsd"),
    walletAppliedUsd: requiredDecimal(payment, "walletAppliedUsd"),
    totalAppliedUsd: requiredDecimal(payment, "totalAppliedUsd"),
    createdAt: requiredTimestamp(payment, "createdAt"),
    updatedAt: requiredTimestamp(payment, "updatedAt"),
  };
}

/**
 * `WalletInputCurrenciesView` — the currencies a quote or top-up may be
 * *collected* in. `walletCurrencyCode` is always USD and is the only balance
 * that exists; everything else is a collection currency.
 */
export interface PaymentInputCurrencies {
  walletCurrencyCode: string;
  items: { currencyCode: string; isBaseCurrency: boolean }[];
}

export function parsePaymentInputCurrencies(payload: unknown): PaymentInputCurrencies {
  const view = record(payload);
  if (!view || !Array.isArray(view.items) || view.items.length > 50) invalidBillingResponse();
  return {
    walletCurrencyCode: currencyCode(view, "walletCurrencyCode"),
    items: view.items.map((item) => {
      const entry = record(item);
      if (!entry) invalidBillingResponse();
      return {
        currencyCode: currencyCode(entry, "currencyCode"),
        isBaseCurrency: requiredBoolean(entry, "isBaseCurrency"),
      };
    }),
  };
}

export async function fetchPaymentInputCurrencies(
  signal?: AbortSignal,
): Promise<PaymentInputCurrencies> {
  return parsePaymentInputCurrencies(
    await readCoreData(PAYMENT_INPUT_CURRENCIES_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function fetchActiveIntent(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<ActiveInvoicePaymentIntent | null> {
  return parseActiveIntent(
    await readCoreData(activePaymentIntentPath(invoiceId), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function fetchPaymentStatus(
  paymentId: string,
  signal?: AbortSignal,
): Promise<TenantPayment> {
  return parseTenantPayment(
    await readCoreData(paymentStatusPath(paymentId), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

/** `POST .../payment-quote` — 201, immutable, short-lived. Not idempotency-required. */
export async function createPaymentQuote(
  invoiceId: string,
  paymentCurrencyCode: string,
): Promise<InvoicePaymentQuote> {
  const result = await corePost(
    paymentQuotePath(invoiceId),
    { paymentCurrencyCode },
    { maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES },
  );
  return parseInvoicePaymentQuote(result.data);
}

/**
 * `POST .../payment-intents` — 201, `@IdempotencyRequired()`.
 *
 * The key is supplied by the caller so a retry of the *same user intent* reuses
 * it. A replay comes back with `Idempotency-Replayed: true` and the same intent;
 * that is the write having run exactly once, and it renders as success.
 */
export async function createPaymentIntent(
  invoiceId: string,
  paymentQuoteId: string,
  idempotencyKey: string,
): Promise<{ intent: InvoicePaymentIntent; replayed: boolean }> {
  const result = await corePost(
    paymentIntentsPath(invoiceId),
    { paymentQuoteId },
    {
      headers: { "x-idempotency-key": idempotencyKey },
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    },
  );
  return {
    intent: parseInvoicePaymentIntent(result.data),
    replayed: isIdempotentReplay(result.headers),
  };
}
