import { TranslocoService } from '@jsverse/transloco';
import { ApiError, errorCodeOf } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import {
  fakeApplyChange,
  fakeCreatePaymentIntent,
  fakeCreatePaymentQuote,
  fakeGetActivePaymentIntent,
  fakeGetBillingSummary,
  fakeGetInvoice,
  fakeGetOperation,
  fakeGetPayment,
  fakeGetReceipt,
  fakeGetSubscription,
  fakeGetWallet,
  fakeListCatalogue,
  fakeListInvoices,
  fakeListPaymentCurrencies,
  fakeListPayments,
  fakeListWalletLedger,
  fakePrepareChange,
  fakeQuoteChange,
  fakeRecoverOperation,
  fakeTopUpWallet,
} from './billing.fake';
import {
  ActiveInvoicePaymentIntent,
  AppliedReceipt,
  BillingSummary,
  CatalogueQuery,
  CommercialOperation,
  CommercialPreview,
  InvoicePaymentIntent,
  InvoicePaymentQuote,
  InvoiceRead,
  PageQuery,
  Paged,
  PaymentInputCurrencies,
  PaymentStatusView,
  PrepareBody,
  QuoteBody,
  RecoveryBody,
  SubscriptionOffer,
  SubscriptionView,
  TenantInvoiceView,
  TopupBody,
  TopupResult,
  WalletLedgerEntry,
  WalletView,
} from './billing.model';

export { ApiError, newIdempotencyKey };
export * from './billing.model';

/** GET /api/tenant/core/v1/billing/summary */
export function getBillingSummary(): Promise<BillingSummary> {
  return fakeGetBillingSummary();
}

/** GET /api/tenant/core/v1/billing/invoices?page&limit */
export function listInvoices(q: PageQuery): Promise<Paged<TenantInvoiceView>> {
  return fakeListInvoices(q);
}

/** GET /api/tenant/core/v1/billing/invoices/:id (no query, no company/branch headers) */
export function getInvoice(id: string): Promise<InvoiceRead> {
  return fakeGetInvoice(id);
}

/** GET /api/tenant/core/v1/billing/payment-input-currencies */
export function listPaymentCurrencies(): Promise<PaymentInputCurrencies> {
  return fakeListPaymentCurrencies();
}

/** POST /api/tenant/core/v1/billing/invoices/:id/payment-quote (no key) */
export function createPaymentQuote(
  invoiceId: string,
  paymentCurrencyCode: string,
): Promise<InvoicePaymentQuote> {
  return fakeCreatePaymentQuote(invoiceId, paymentCurrencyCode);
}

/** POST /api/tenant/core/v1/billing/invoices/:id/payment-intents (header x-idempotency-key UUIDv7) */
export function createPaymentIntent(
  invoiceId: string,
  paymentQuoteId: string,
  idempotencyKey: string,
): Promise<InvoicePaymentIntent> {
  return fakeCreatePaymentIntent(invoiceId, paymentQuoteId, idempotencyKey);
}

/** GET /api/tenant/core/v1/billing/invoices/:id/payment-intents/active */
export function getActivePaymentIntent(invoiceId: string): Promise<ActiveInvoicePaymentIntent | null> {
  return fakeGetActivePaymentIntent(invoiceId);
}

/** GET /api/tenant/core/v1/billing/payments/:id */
export function getPayment(paymentId: string): Promise<PaymentStatusView> {
  return fakeGetPayment(paymentId);
}

/** GET /api/tenant/core/v1/wallet */
export function getWallet(): Promise<WalletView> {
  return fakeGetWallet();
}

/** GET /api/tenant/core/v1/wallet/ledger?page&limit */
export function listWalletLedger(q: PageQuery): Promise<Paged<WalletLedgerEntry>> {
  return fakeListWalletLedger(q);
}

/** GET /api/tenant/core/v1/payments?page&limit */
export function listPayments(q: PageQuery): Promise<Paged<PaymentStatusView>> {
  return fakeListPayments(q);
}

/** POST /api/tenant/core/v1/payments/topup (header x-idempotency-key UUIDv7) */
export function topUpWallet(body: TopupBody, idempotencyKey: string): Promise<TopupResult> {
  return fakeTopUpWallet(body, idempotencyKey);
}

/** GET /api/tenant/core/v1/subscription */
export function getSubscription(): Promise<SubscriptionView> {
  return fakeGetSubscription();
}

/** GET /api/tenant/core/v1/subscription/catalogue?page&limit&applicationKey&parentTierId */
export function listCatalogue(q: CatalogueQuery): Promise<Paged<SubscriptionOffer>> {
  return fakeListCatalogue(q);
}

/** POST /api/tenant/core/v1/subscription/preparations (202, header x-idempotency-key UUIDv7) */
export function prepareChange(
  body: PrepareBody,
  idempotencyKey: string,
): Promise<CommercialOperation> {
  return fakePrepareChange(body, idempotencyKey);
}

/** GET /api/tenant/core/v1/subscription/operations/:id */
export function getOperation(operationId: string): Promise<CommercialOperation> {
  return fakeGetOperation(operationId);
}

/** POST /api/tenant/core/v1/subscription/plan-change-previews (header x-idempotency-key UUIDv7) */
export function quoteChange(
  body: QuoteBody,
  idempotencyKey: string,
): Promise<CommercialPreview> {
  return fakeQuoteChange(body, idempotencyKey);
}

/** POST /api/tenant/core/v1/subscription/plan-change-previews/:id/apply (body {}, header x-idempotency-key UUIDv7) */
export function applyChange(previewId: string, idempotencyKey: string): Promise<AppliedReceipt> {
  return fakeApplyChange(previewId, idempotencyKey);
}

/** GET /api/tenant/core/v1/subscription/plan-change-previews/:id/receipt */
export function getReceipt(previewId: string): Promise<AppliedReceipt> {
  return fakeGetReceipt(previewId);
}

/** POST /api/tenant/core/v1/subscription/operations/:id/recovery (202, header x-idempotency-key UUIDv7) */
export function recoverOperation(
  operationId: string,
  body: RecoveryBody,
  idempotencyKey: string,
): Promise<CommercialOperation> {
  return fakeRecoverOperation(operationId, body, idempotencyKey);
}

export function billingErrorMessage(error: unknown, t: TranslocoService): string {
  const code = typeof error === 'string' ? error : errorCodeOf(error);
  const details = error instanceof ApiError ? error.details : undefined;

  if (code) {
    const key = `bill.errors.${code}`;
    const translated = t.translate(key, details);
    if (translated && translated !== key) {
      return translated;
    }
  }

  if (error instanceof ApiError && error.status === 0) {
    return t.translate('bill.errors.network');
  }

  return t.translate('bill.errors.generic');
}

export interface SeatDowngradeDetails {
  moduleKey: string;
  used: number;
  target: number;
  excess: number;
}

/**
 * 409 SEAT_DOWNGRADE_FREE_UP_REQUIRED details { moduleKey: ['crm'], used: ['4'], target: ['2'], excess: ['2'] }:
 * one element each, numbers as decimal strings. Null when any of them is missing or not a count.
 */
export function seatDowngradeDetails(error: unknown): SeatDowngradeDetails | null {
  const details = error instanceof ApiError ? error.details : undefined;
  const first = (key: string): string | null => {
    const value = details?.[key];
    return Array.isArray(value) && typeof value[0] === 'string' && value[0] !== '' ? value[0] : null;
  };
  const count = (key: string): number | null => {
    const raw = first(key);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  };
  const moduleKey = first('moduleKey');
  const used = count('used');
  const target = count('target');
  const excess = count('excess');
  if (moduleKey === null || used === null || target === null || excess === null) return null;
  return { moduleKey, used, target, excess };
}

/** The SEAT_DOWNGRADE_FREE_UP_REQUIRED message with the counts when the details carry them. */
export function seatDowngradeMessage(error: unknown, t: TranslocoService): string {
  const counts = seatDowngradeDetails(error);
  if (counts) {
    const key = 'bill.errors.SEAT_DOWNGRADE_FREE_UP_REQUIRED_COUNTS';
    const translated = t.translate(key, { used: counts.used, target: counts.target, excess: counts.excess });
    if (translated && translated !== key) return translated;
  }
  return billingErrorMessage(error, t);
}

/** Shared helper: reads the top-level correlationId first (5xx responses carry no details). */
export { correlationIdOf } from '../../../core/api/api-errors';
