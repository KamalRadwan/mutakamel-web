import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { QueryClient } from '@tanstack/angular-query';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/api-errors';
import { CoreHttp } from '../../../core/api/core-http';
import { AuthSession } from '../../../core/auth/auth-session';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { BillingApi, billingErrorMessage, seatDowngradeDetails, seatDowngradeMessage, seatHoldersDetails } from './billing.api';
import type { BillingSummary, PrepareBody, QuoteBody, RecoveryBody } from './billing.model';

const DETAILS = { moduleKey: ['crm'], used: ['4'], target: ['2'], excess: ['2'] };

function translator(messages: Record<string, string>): TranslocoService {
  return {
    translate: (key: string, params?: Record<string, unknown>) =>
      (messages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? '')),
  } as unknown as TranslocoService;
}

describe('seatDowngradeDetails', () => {
  it('reads the one-element decimal string arrays of SEAT_DOWNGRADE_FREE_UP_REQUIRED', () => {
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', DETAILS))).toEqual({
      moduleKey: 'crm',
      used: 4,
      target: 2,
      excess: 2,
    });
  });

  it('returns null when a key is missing, scalar or not a count', () => {
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED'))).toBeNull();
    expect(
      seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', { moduleKey: 'crm', used: 4, target: 2, excess: 2 })),
    ).toBeNull();
    expect(seatDowngradeDetails(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', { ...DETAILS, excess: ['x'] }))).toBeNull();
  });
});

describe('seatDowngradeMessage', () => {
  const t = translator({
    'bill.errors.SEAT_DOWNGRADE_FREE_UP_REQUIRED': 'Free seats first.',
    'bill.errors.SEAT_DOWNGRADE_FREE_UP_REQUIRED_COUNTS': '{{used}} in use, free {{excess}} to reach {{target}}.',
  });

  it('puts the counts in the message when the details carry them', () => {
    expect(seatDowngradeMessage(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', DETAILS), t)).toBe(
      '4 in use, free 2 to reach 2.',
    );
  });

  it('uses the plain code message without details', () => {
    expect(seatDowngradeMessage(new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED'), t)).toBe('Free seats first.');
  });
});

const BASE = '/api/tenant/core/v1';
const META = { page: 2, limit: 10, total: 11, totalPages: 2, hasNext: false, hasPrev: true };
const SUMMARY: BillingSummary = {
  subscription: {
    id: 'sub', status: 'ACTIVE', billingCycle: 'MONTHLY', startedAt: '2026-01-01', trialEndsAt: null,
    currentPeriodStart: null, currentPeriodEnd: '2026-12-01', activationScheduledAt: null,
    totalPriceUsd: '99999999999999.9999', accessMode: 'READ_ONLY',
  },
  wallet: { currencyCode: 'USD', balanceUsd: '12.3456', reservedBalanceUsd: '0.0000', availableBalanceUsd: '12.3456', status: 'ACTIVE' },
  outstandingInvoice: null,
};
const PREPARE: PrepareBody = {
  expectedSubscriptionRevision: '1',
  changes: [{ sourceKind: 'APPLICATION', operation: 'ADD', selectionKey: 'crm', applicationId: 'app', tierId: 'tier', seats: 3 }],
};
const QUOTE: QuoteBody = { ...PREPARE, preparationId: 'op' };
const RECOVERY: RecoveryBody = { expectedOperationRevision: '1', action: 'RECONCILE', reason: 'check_status' };

function assertBare(req: TestRequest, params: string[] = []): void {
  expect(req.request.method).toBe('GET');
  expect(req.request.withCredentials).toBe(true);
  expect(req.request.body).toBeNull();
  expect(req.request.headers.keys().filter((key) => /^x-(idempotency-key|mutakamel-)/i.test(key))).toEqual([]);
  expect(req.request.params.keys().sort()).toEqual(params.sort());
}

describe('BillingApi Core transport', () => {
  let api: BillingApi;
  let http: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me: signal({ isTenantOwner: true }), ensureLoaded: vi.fn().mockResolvedValue('signed-in') } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-value`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(BillingApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('summary unwraps the Core envelope', async () => {
    const result = api.getBillingSummary();
    http.expectOne(`${BASE}/billing/summary`).flush({ success: true, data: SUMMARY });
    expect(await result).toEqual(SUMMARY);
  });

  it('malformed success body is an internal error', async () => {
    for (const read of [() => api.getBillingSummary(), () => api.getSubscription()]) {
      for (const body of [{ data: {} }, { success: false, data: {} }, { success: true }, null]) {
        const result = expect(read()).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
        http.expectOne(() => true).flush(body);
        await result;
      }
    }
  });

  it('invoices list returns CorePage', async () => {
    const result = api.listInvoices({ page: 2, limit: 10 });
    const req = http.expectOne(`${BASE}/billing/invoices?page=2&limit=10`);
    req.flush({ success: true, data: [{ id: 'invoice', totalUsd: '12.3456' }], meta: META });
    expect(await result).toEqual({ data: [{ id: 'invoice', totalUsd: '12.3456' }], meta: META });
  });

  it('invoices list sends status and date filters', async () => {
    const result = api.listInvoices({ page: 1, limit: 20, status: ['ISSUED', 'OVERDUE'], from: '2026-01-01', to: '2026-11-23' });
    const req = http.expectOne((r) => r.url === `${BASE}/billing/invoices`);
    expect(req.request.params.getAll('status')).toEqual(['ISSUED', 'OVERDUE']);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-11-23');
    req.flush({ success: true, data: [], meta: META });
    await result;
    const empty = api.listInvoices({ page: 1, limit: 20, status: [], from: '', to: '' });
    const emptyReq = http.expectOne(`${BASE}/billing/invoices?page=1&limit=20`);
    emptyReq.flush({ success: true, data: [], meta: META });
    await empty;
  });

  it('payments and ledger return CorePage', async () => {
    for (const [path, read] of [
      ['/payments', () => api.listPayments({ page: 2, limit: 10 })],
      ['/wallet/ledger', () => api.listWalletLedger({ page: 2, limit: 10 })],
    ] as const) {
      const result = read();
      http.expectOne(`${BASE}${path}?page=2&limit=10`).flush({ success: true, data: [], meta: META });
      expect(await result).toEqual({ data: [], meta: META });
    }
  });

  it('invoice detail is a bare read', async () => {
    const spy = vi.spyOn(TestBed.inject(CoreHttp), 'read');
    const result = api.getInvoice('invoice/a ?');
    const req = http.expectOne(`${BASE}/billing/invoices/invoice%2Fa%20%3F`);
    assertBare(req);
    expect(spy).toHaveBeenCalledWith(req.request.url, undefined, { bare: true });
    req.flush({ success: true, data: { invoice: { id: 'invoice/a ?' }, lines: [] } });
    expect(await result).toEqual({ invoice: { id: 'invoice/a ?' }, lines: [] });
  });

  it('subscription reads are bare', async () => {
    const spy = vi.spyOn(TestBed.inject(CoreHttp), 'read');
    for (const [path, read] of [
      ['/subscription', () => api.getSubscription()],
      ['/subscription/operations/op%2Fa', () => api.getOperation('op/a')],
      ['/subscription/plan-change-previews/p%2Fa/receipt', () => api.getReceipt('p/a')],
    ] as const) {
      const result = read();
      const req = http.expectOne(`${BASE}${path}`);
      assertBare(req);
      expect(spy).toHaveBeenLastCalledWith(req.request.url, undefined, { bare: true });
      req.flush({ success: true, data: { id: path } });
      expect(await result).toEqual({ id: path });
    }
  });

  it('catalogue read sends only listed params', async () => {
    const spy = vi.spyOn(TestBed.inject(CoreHttp), 'read');
    const q = { page: 2, limit: 100, applicationKey: 'crm', parentTierId: 'tier', extra: 'ignored' };
    const result = api.listCatalogue(q);
    const req = http.expectOne((r) => r.url === `${BASE}/subscription/catalogue`);
    assertBare(req, ['page', 'limit', 'applicationKey', 'parentTierId']);
    expect(req.request.params.get('applicationKey')).toBe('crm');
    expect(req.request.params.get('parentTierId')).toBe('tier');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('100');
    expect(spy).toHaveBeenCalledWith(req.request.url, { page: 2, limit: 100, applicationKey: 'crm', parentTierId: 'tier' }, { bare: true });
    req.flush({ success: true, data: [], meta: META });
    expect(await result).toEqual({ data: [], meta: META });
    const empty = api.listCatalogue({ page: 1, limit: 20, applicationKey: '', parentTierId: '' });
    http.expectOne(`${BASE}/subscription/catalogue?page=1&limit=20`).flush({ success: true, data: [], meta: META });
    await empty;
  });

  it('rejects malformed paged bodies', async () => {
    for (const read of [() => api.listCatalogue({ page: 1, limit: 20 }), () => api.listInvoices({ page: 1, limit: 20 })]) {
      for (const body of [{ success: true, data: [] }, { success: true, data: {}, meta: META }, { success: true, data: [], meta: { ...META, hasPrev: null } }]) {
        const result = expect(read()).rejects.toMatchObject({ status: 502 });
        http.expectOne(() => true).flush(body);
        await result;
      }
    }
  });

  it('active intent null is valid', async () => {
    const result = api.getActivePaymentIntent('i/a');
    http.expectOne(`${BASE}/billing/invoices/i%2Fa/payment-intents/active`).flush({ success: true, data: null });
    expect(await result).toBeNull();
  });

  it('wallet, payment and currency reads preserve the payload', async () => {
    for (const [path, read, data] of [
      ['/wallet', () => api.getWallet(), SUMMARY.wallet],
      ['/billing/payments/p%2Fa', () => api.getPayment('p/a'), { paymentId: 'p/a', purpose: 'WALLET_TOP_UP' }],
      ['/billing/payment-input-currencies', () => api.listPaymentCurrencies(), { walletCurrencyCode: 'USD', items: [], total: 0, topUpLimitsUsd: { min: '1.0000', max: '100000.0000' } }],
    ] as const) {
      const result = read();
      http.expectOne(`${BASE}${path}`).flush({ success: true, data });
      expect(await result).toEqual(data);
    }
  });

  it('quote sends no idempotency key', async () => {
    const result = api.createPaymentQuote('i/a', 'EGP');
    const req = http.expectOne(`${BASE}/billing/invoices/i%2Fa/payment-quote`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-value');
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.body).toEqual({ paymentCurrencyCode: 'EGP' });
    req.flush({ success: true, data: { quoteId: 'q', providerAmount: '1234.5678' } }, { status: 201, statusText: 'Created' });
    expect(await result).toEqual({ quoteId: 'q', providerAmount: '1234.5678' });
  });

  it('intent sends key and reuses it on retry', async () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    const failed = expect(api.createPaymentIntent('i/a', 'q', key)).rejects.toMatchObject({ status: 503 });
    const first = http.expectOne(`${BASE}/billing/invoices/i%2Fa/payment-intents`);
    expect(first.request.headers.get('x-idempotency-key')).toBe(key);
    expect(first.request.headers.get('x-csrf-token')).toBe('csrf-value');
    first.flush({ errorCode: 'PAYMENT_PROVIDER_UNCONFIGURED' }, { status: 503, statusText: 'Unavailable' });
    await failed;
    http.expectNone(() => true);
    const retry = api.createPaymentIntent('i/a', 'q', key);
    const second = http.expectOne(`${BASE}/billing/invoices/i%2Fa/payment-intents`);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    expect(second.request.body).toEqual(first.request.body);
    expect(second.request.body).toEqual({ paymentQuoteId: 'q' });
    const paid = { status: 'SUCCEEDED', checkoutUrl: null, requiresExternalPayment: false };
    second.flush({ success: true, data: paid }, { status: 201, statusText: 'Created' });
    expect(await retry).toEqual(paid);
  });

  it('top-up sends key', async () => {
    const body = { amount: '12.3456', currencyCode: 'USD' };
    const key = newIdempotencyKey();
    const failed = expect(api.topUpWallet(body, key)).rejects.toMatchObject({ status: 503 });
    const first = http.expectOne(`${BASE}/payments/topup`);
    expect(first.request.headers.get('x-idempotency-key')).toBe(key);
    first.flush({ errorCode: 'PAYMENT_PROVIDER_UNCONFIGURED' }, { status: 503, statusText: 'Unavailable' });
    await failed;
    http.expectNone(() => true);
    const result = api.topUpWallet(body, key);
    const req = http.expectOne(`${BASE}/payments/topup`);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-value');
    expect(req.request.body).toEqual(body);
    expect(req.request.body).toEqual(first.request.body);
    req.flush({ success: true, data: { paymentId: 'p', checkoutUrl: 'https://checkout.example/p' } }, { status: 201, statusText: 'Created' });
    expect(await result).toEqual({ paymentId: 'p', checkoutUrl: 'https://checkout.example/p' });
  });

  it('prepare and recover accept 202', async () => {
    for (const [path, body, write] of [
      ['/subscription/preparations', PREPARE, (key: string) => api.prepareChange(PREPARE, key)],
      ['/subscription/operations/op%2Fa/recovery', RECOVERY, (key: string) => api.recoverOperation('op/a', RECOVERY, key)],
    ] as const) {
      const key = newIdempotencyKey();
      const result = write(key);
      const req = http.expectOne(`${BASE}${path}`);
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush({ success: true, data: { operationId: 'op', state: 'PREPARING' } }, { status: 202, statusText: 'Accepted' });
      expect(await result).toEqual({ operationId: 'op', state: 'PREPARING' });
    }
  });

  it('preview accepts 201', async () => {
    const key = newIdempotencyKey();
    const result = api.quoteChange(QUOTE, key);
    const req = http.expectOne(`${BASE}/subscription/plan-change-previews`);
    expect(req.request.body).toEqual(QUOTE);
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ success: true, data: { previewId: 'p' } }, { status: 201, statusText: 'Created' });
    expect(await result).toEqual({ previewId: 'p' });
  });

  it('apply sends an empty JSON object', async () => {
    const key = newIdempotencyKey();
    const result = api.applyChange('p/a', key);
    const req = http.expectOne(`${BASE}/subscription/plan-change-previews/p%2Fa/apply`);
    expect(req.request.body).toEqual({});
    expect(req.request.serializeBody()).toBe('{}');
    expect(req.request.detectContentTypeHeader()).toBe('application/json');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ success: true, data: { previewId: 'p/a' } });
    expect(await result).toEqual({ previewId: 'p/a' });
  });

  it('write without CSRF cookie sends nothing', async () => {
    cookie = '';
    await expect(api.topUpWallet({ amount: '1', currencyCode: 'USD' }, newIdempotencyKey()))
      .rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(() => true);
  });

  it('write errors map through ApiError', async () => {
    for (const [status, body, code] of [
      [400, { errorCode: 'CORE_VALIDATION_FAILED', details: { amount: ['invalid_amount'] }, correlationId: 'c1' }, 'CORE_VALIDATION_FAILED'],
      [401, { errorCode: 'COMMON.GENERIC.UNAUTHORIZED', correlationId: 'c1' }, 'COMMON.GENERIC.UNAUTHORIZED'],
      [403, { errorCode: 'TENANT_OWNER_REQUIRED', correlationId: 'c1' }, 'TENANT_OWNER_REQUIRED'],
      [404, { errorCode: 'INVOICE_NOT_FOUND', correlationId: 'c1' }, 'INVOICE_NOT_FOUND'],
      [409, { code: 'GW.IDEM.MISMATCH', errors: { _: ['body_mismatch'] }, correlationId: 'c1' }, 'GW.IDEM.MISMATCH'],
      [422, { errorCode: 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', details: { moduleKey: ['crm'], holders: ['4'], seats: ['2'] }, correlationId: 'c1' }, 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE'],
      [503, { errorCode: 'ACCESS_POLICY_UNAVAILABLE', correlationId: 'c1' }, 'ACCESS_POLICY_UNAVAILABLE'],
    ] as const) {
      const result = expect(api.topUpWallet({ amount: '1', currencyCode: 'USD' }, newIdempotencyKey()))
        .rejects.toMatchObject({ status, code, correlationId: 'c1', details: 'details' in body ? body.details : 'errors' in body ? body.errors : undefined });
      http.expectOne(`${BASE}/payments/topup`).flush(body, { status, statusText: 'Error' });
      await result;
      http.expectNone(() => true);
    }
  });

  it('writes invalidate billing queries', async () => {
    const cancel = vi.spyOn(QueryClient.prototype, 'cancelQueries');
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const result = api.topUpWallet({ amount: '1', currencyCode: 'USD' }, newIdempotencyKey());
    expect(invalidate).not.toHaveBeenCalled();
    http.expectOne(`${BASE}/payments/topup`).flush({ success: true, data: { paymentId: 'p', checkoutUrl: 'https://checkout.example' } });
    await result;
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['billing'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['billing'] });
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(invalidate.mock.invocationCallOrder[0]);
    const failed = expect(api.applyChange('missing', newIdempotencyKey())).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${BASE}/subscription/plan-change-previews/missing/apply`).flush({}, { status: 404, statusText: 'Missing' });
    await failed;
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('polling reads always request fresh data and never retry automatically', async () => {
    for (const state of ['PREPARING', 'READY']) {
      const result = api.getOperation('op');
      http.expectOne(`${BASE}/subscription/operations/op`).flush({ success: true, data: { state } });
      expect(await result).toEqual({ state });
    }
    const failed = expect(api.getWallet()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    http.expectOne(`${BASE}/wallet`).error(new ProgressEvent('error'));
    await failed;
    http.expectNone(() => true);
  });
});

describe('billing error helpers', () => {
  it('write 401 maps to not saved', () => {
    const t = translator({ 'bill.errors.notSaved': 'Not saved. Try again.' });
    expect(billingErrorMessage(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'), t, 'write')).toBe('Not saved. Try again.');
  });

  it('billing error mapper falls back to the core mapper', () => {
    const t = translator({
      'bill.errors.SEAT_MODULE_HOLDERS_EXCEED_PURCHASE': '{{holders}} holders',
      'bill.errors.generic': 'Billing error',
      'settings.errors.generic': 'Core error',
      'settings.errors.idempotency': 'Still saving',
      'settings.errors.network': 'Lost connection',
      'settings.errors.session': 'Session ended',
    });
    expect(billingErrorMessage(new ApiError(422, 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', { holders: ['4'] }), t)).toBe('4 holders');
    expect(billingErrorMessage(new ApiError(500, 'UNKNOWN_CODE'), t)).toBe('Core error');
    expect(billingErrorMessage(new ApiError(409, 'GW.IDEM.IN_FLIGHT'), t)).toBe('Still saving');
    expect(billingErrorMessage(new ApiError(0, 'NETWORK_ERROR'), t)).toBe('Lost connection');
    expect(billingErrorMessage(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'), t)).toBe('Session ended');
    for (const code of ['GW.IDEM.MISSING', 'GW.IDEM.BAD_VALUE']) {
      expect(billingErrorMessage(new ApiError(400, code), t)).toBe('Billing error');
    }
  });

  it('seat holders details parse string arrays', () => {
    const details = { moduleKey: ['crm', 'ignored'], holders: ['4'], seats: ['2'] };
    expect(seatHoldersDetails(new ApiError(422, 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', details))).toEqual({ moduleKey: 'crm', holders: 4, seats: 2 });
    for (const invalid of [undefined, {}, { ...details, seats: [] }, { ...details, holders: 4 }, { ...details, holders: ['-1'] }, { ...details, holders: ['1e2'] }, { ...details, seats: ['1.5'] }]) {
      expect(seatHoldersDetails(new ApiError(422, 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', invalid))).toBeNull();
    }
    expect(seatHoldersDetails(new ApiError(409, 'OTHER', details))).toBeNull();
    expect(seatHoldersDetails(null)).toBeNull();
  });
});
