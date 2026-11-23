import { inject, Service } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError, errorCodeOf, errorMessage } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery } from '../../../core/api/core-http';
import type { CorePage, CorePageMeta } from '../../../core/api/core-page';
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
  InvoiceListQuery,
  PageQuery,
  Paged,
  PaymentInputCurrencies,
  PaymentStatusView,
  PrepareBody,
  QuoteBody,
  RecoveryBody,
  SubscriptionOffer,
  SubscriptionView,
  subscriptionViewSchema,
  TenantInvoiceView,
  TopupBody,
  TopupResult,
  WalletLedgerEntry,
  WalletView,
} from './billing.model';

export { ApiError, newIdempotencyKey };
export * from './billing.model';

const CORE_PATH = '/api/tenant/core/v1';

@Service()
export class BillingApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  getBillingSummary(): Promise<BillingSummary> {
    return this.read('/billing/summary');
  }

  listInvoices(q: InvoiceListQuery): Promise<CorePage<TenantInvoiceView>> {
    return this.readPage('/billing/invoices', {
      page: q.page, limit: q.limit, status: q.status, from: q.from, to: q.to,
    });
  }

  getInvoice(id: string): Promise<InvoiceRead> {
    return this.read(`/billing/invoices/${encodeURIComponent(id)}`, undefined, true);
  }

  listPaymentCurrencies(): Promise<PaymentInputCurrencies> {
    return this.read('/billing/payment-input-currencies');
  }

  createPaymentQuote(invoiceId: string, paymentCurrencyCode: string): Promise<InvoicePaymentQuote> {
    return this.write(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-quote`, { paymentCurrencyCode });
  }

  createPaymentIntent(invoiceId: string, paymentQuoteId: string, key: string): Promise<InvoicePaymentIntent> {
    return this.write(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, { paymentQuoteId }, key);
  }

  getActivePaymentIntent(invoiceId: string): Promise<ActiveInvoicePaymentIntent | null> {
    return this.read(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents/active`);
  }

  getPayment(paymentId: string): Promise<PaymentStatusView> {
    return this.read(`/billing/payments/${encodeURIComponent(paymentId)}`);
  }

  getWallet(): Promise<WalletView> {
    return this.read('/wallet');
  }

  listWalletLedger(q: PageQuery): Promise<CorePage<WalletLedgerEntry>> {
    return this.readPage('/wallet/ledger', { page: q.page, limit: q.limit });
  }

  listPayments(q: PageQuery): Promise<CorePage<PaymentStatusView>> {
    return this.readPage('/payments', { page: q.page, limit: q.limit });
  }

  topUpWallet(body: TopupBody, key: string): Promise<TopupResult> {
    return this.write('/payments/topup', body, key);
  }

  async getSubscription(): Promise<SubscriptionView> {
    const result = subscriptionViewSchema.safeParse(await this.read<unknown>('/subscription', undefined, true));
    if (!result.success) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    return result.data;
  }

  prepareChange(body: PrepareBody, key: string): Promise<CommercialOperation> {
    return this.write('/subscription/preparations', body, key);
  }

  getOperation(id: string): Promise<CommercialOperation> {
    return this.read(`/subscription/operations/${encodeURIComponent(id)}`, undefined, true);
  }

  quoteChange(body: QuoteBody, key: string): Promise<CommercialPreview> {
    return this.write('/subscription/plan-change-previews', body, key);
  }

  applyChange(previewId: string, key: string): Promise<AppliedReceipt> {
    return this.write(`/subscription/plan-change-previews/${encodeURIComponent(previewId)}/apply`, {}, key);
  }

  getReceipt(previewId: string): Promise<AppliedReceipt> {
    return this.read(`/subscription/plan-change-previews/${encodeURIComponent(previewId)}/receipt`, undefined, true);
  }

  recoverOperation(id: string, body: RecoveryBody, key: string): Promise<CommercialOperation> {
    return this.write(`/subscription/operations/${encodeURIComponent(id)}/recovery`, body, key);
  }

  listCatalogue(q: CatalogueQuery): Promise<CorePage<SubscriptionOffer>> {
    return this.readPage('/subscription/catalogue', {
      page: q.page, limit: q.limit, applicationKey: q.applicationKey, parentTierId: q.parentTierId,
    }, true);
  }

  private read<T>(path: string, query?: CoreQuery, bare = false): Promise<T> {
    return this.queries.fetchQuery({
      queryKey: ['billing', path, query], staleTime: 0,
      queryFn: async () => bare
        ? unwrapBillingEnvelope<T>(await this.http.read(`${CORE_PATH}${path}`, query, { bare: true })).data
        : this.http.read<T>(`${CORE_PATH}${path}`, query),
    });
  }

  private readPage<T>(path: string, query: CoreQuery, bare = false): Promise<CorePage<T>> {
    return this.queries.fetchQuery({
      queryKey: ['billing', path, query], staleTime: 0,
      queryFn: async () => {
        if (!bare) return this.http.readPage<T>(`${CORE_PATH}${path}`, query);
        const { data, meta } = unwrapBillingEnvelope<T[]>(await this.http.read(`${CORE_PATH}${path}`, query, { bare: true }));
        if (!Array.isArray(data) || !meta ||
            ![meta.page, meta.limit, meta.total, meta.totalPages].every((value) => typeof value === 'number' && Number.isFinite(value)) ||
            typeof meta.hasNext !== 'boolean' || typeof meta.hasPrev !== 'boolean') {
          throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        }
        return { data, meta };
      },
    });
  }

  private async write<T>(path: string, body: unknown, key?: string): Promise<T> {
    const result = await this.http.write<T>('POST', `${CORE_PATH}${path}`, body, { key });
    await this.queries.cancelQueries({ queryKey: ['billing'] });
    await this.queries.invalidateQueries({ queryKey: ['billing'] });
    return result.data;
  }
}

// CoreHttp's bare option returns the raw body, including Core's envelope.
function unwrapBillingEnvelope<T>(body: unknown): { data: T; meta?: CorePageMeta } {
  if (typeof body !== 'object' || body === null ||
      !('success' in body) || body.success !== true || !('data' in body)) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return { data: body.data as T, ...('meta' in body ? { meta: body.meta as CorePageMeta } : {}) };
}

// Fake-backed until each Billing page package switches to BillingApi; removed by WS-10.
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

export function billingErrorMessage(error: unknown, t: TranslocoService, operation: 'read' | 'write' = 'read'): string {
  const code = typeof error === 'string' ? error : errorCodeOf(error);
  const details = error instanceof ApiError ? error.details : undefined;
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return t.translate('bill.errors.notSaved', details);
  }
  if (code === 'GW.IDEM.MISSING' || code === 'GW.IDEM.BAD_VALUE') {
    return t.translate('bill.errors.generic', details);
  }

  if (code) {
    const key = `bill.errors.${code}`;
    const translated = t.translate(key, details);
    if (translated && translated !== key) {
      return translated;
    }
  }

  return errorMessage(error, 'bill', t);
}

export interface SeatHoldersDetails {
  moduleKey: string;
  holders: number;
  seats: number;
}

export function seatHoldersDetails(error: unknown): SeatHoldersDetails | null {
  if (!(error instanceof ApiError) || error.status !== 422 || error.code !== 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE') return null;
  const first = (key: string): string | null => {
    const value = error.details?.[key];
    return Array.isArray(value) && typeof value[0] === 'string' && value[0] !== '' ? value[0] : null;
  };
  const moduleKey = first('moduleKey');
  const holders = first('holders');
  const seats = first('seats');
  if (moduleKey === null || holders === null || seats === null || !/^\d+$/.test(holders) || !/^\d+$/.test(seats) ||
      !Number.isSafeInteger(Number(holders)) || !Number.isSafeInteger(Number(seats))) return null;
  return { moduleKey, holders: Number(holders), seats: Number(seats) };
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
