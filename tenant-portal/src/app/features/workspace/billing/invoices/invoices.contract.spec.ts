import { DOCUMENT, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { type ActiveInvoicePaymentIntent, type InvoiceRead, type InvoicePaymentQuote, type PaymentStatusView, type TenantInvoiceView } from '../billing.api';
import { InvoicesPage } from './invoices-page/invoices-page';
import { InvoicePage } from './invoice-page/invoice-page';
import { PayModal } from './pay-modal/pay-modal';
import { PaymentPoller, type PollEvent } from './payment-poller';

const BASE = '/api/tenant/core/v1/billing';
const ROW: TenantInvoiceView = { id: 'inv', number: 'INV-42', status: 'ISSUED', purpose: 'MANUAL', currencyCode: 'USD', canonicalUsd: true,
  subtotalUsd: '90.0000', taxTotalUsd: '10.0000', totalUsd: '100.0000', amountPaidUsd: '0.0000', outstandingUsd: '100.0000', legacyOriginalAmounts: null,
  periodStart: null, periodEnd: null, issuedAt: '2026-11-01', dueAt: '2026-12-01', paidAt: null };
const DOC: InvoiceRead = { invoice: { id: 'inv', subscriptionId: 'sub', tenantId: 'tenant', number: 'INV-42', status: 'ISSUED', purpose: 'MANUAL',
  currencyCode: 'USD', subtotal: '90.0000', taxTotal: '10.0000', total: '100.0000', settlementCurrencyCode: 'USD', settlementSubtotalUsd: '90.0000',
  settlementTaxTotalUsd: '10.0000', settlementTotalUsd: '100.0000', amountPaidUsd: '0.0000', periodStart: null, periodEnd: null,
  issuedAt: '2026-11-01', dueAt: '2026-12-01', paidAt: null, createdAt: '', updatedAt: '' },
  lines: [{ id: 'line', invoiceId: 'inv', description: 'Manual service', quantity: '1.00', unitPrice: '90.0000', lineTotal: '90.0000', sourceKind: null,
    baseItemId: null, addonSelectionId: null, addonDefinitionVersionId: null, acceptedSeats: null, acceptedPricingSnapshot: null }] };
const ACTIVE: ActiveInvoicePaymentIntent = { paymentId: 'payment', status: 'PENDING', checkoutUrl: 'https://checkout.example.test/pay', requiresExternalPayment: true,
  expiresAt: '2026-11-23T13:00:00Z', recoveryAction: 'CHECK_STATUS' };
const PAYMENT: PaymentStatusView = { paymentId: 'payment', purpose: 'INVOICE_SETTLEMENT', provider: 'PAYMOB', status: 'SUCCEEDED', invoiceId: 'inv',
  invoiceStatus: 'PAID', subscriptionStatus: 'ACTIVE', providerAmount: '70.0000', providerCurrencyCode: 'USD', settlementAmountUsd: '70.0000',
  walletAppliedUsd: '30.0000', totalAppliedUsd: '100.0000', createdAt: '', updatedAt: '' };
const META = { page: 1, limit: 20, total: 41, totalPages: 3, hasNext: true, hasPrev: false };
const quote = (id = 'quote'): InvoicePaymentQuote => ({ quoteId: id, invoiceId: 'inv', invoiceOutstandingUsd: '100.0000', walletAppliedUsd: '30.0000',
  gatewayAmountUsd: '70.0000', providerAmount: '3500.5000', providerCurrencyCode: 'EGP', currencyUnitsPerUsd: '50.0000', rateRevisionId: 'rate',
  rateObservedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString() });
const intent = (wallet = false) => ({ paymentId: 'payment', status: wallet ? 'SUCCEEDED' : 'PENDING', checkoutUrl: wallet ? null : ACTIVE.checkoutUrl,
  requiresExternalPayment: !wallet, expiresAt: ACTIVE.expiresAt, invoiceStatus: wallet ? 'PAID' : 'ISSUED', subscriptionStatus: 'ACTIVE' });

async function settle(): Promise<void> { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function ok(req: TestRequest, data: unknown, meta?: unknown): void { req.flush({ success: true, data, ...(meta ? { meta } : {}) }); }
function fail(req: TestRequest, status: number, code = 'COMMON.GENERIC.INTERNAL_ERROR'): void {
  if (status === 0) req.error(new ProgressEvent('error')); else req.flush({ errorCode: code, correlationId: 'ref' }, { status, statusText: 'Failure' });
}

describe('Workspace invoice API linking', () => {
  let http: HttpTestingController;
  let fixtures: ComponentFixture<unknown>[];
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true), createUrlTree: vi.fn(), serializeUrl: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks(); fixtures = [];
    query = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), PaymentPoller,
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: AuthSession, useValue: { me: signal({ isTenantOwner: true }) } },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: notify },
      { provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: { queryParamMap: query, paramMap: of(convertToParamMap({ id: 'inv' })) } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf`);
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      const name = String(key);
      if (name === 'binv.pay.validFor') return `Valid for ${(params as Record<string, unknown>)['time']}`;
      if (name.startsWith('bill.errors.') && !/GW\.|RECONCILIATION_HOLD/.test(name) && name !== 'bill.errors.notSaved') return `${name} message`;
      if (name.startsWith('settings.errors.')) return `${name} message`;
      return name;
    });
    vi.spyOn(window, 'open').mockReturnValue({ closed: false, opener: null } as Window);
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    for (const fixture of fixtures) fixture.destroy();
    http.verify(); vi.useRealTimers(); vi.restoreAllMocks(); history.replaceState(null, ''); TestBed.resetTestingModule();
  });
  function create<T>(type: Type<T>): ComponentFixture<T> {
    const fixture = TestBed.createComponent(type); fixtures.push(fixture); fixture.detectChanges(); return fixture;
  }
  async function list(rows: TenantInvoiceView[] = [ROW]) {
    const f = create(InvoicesPage); ok(http.expectOne(r => r.url === `${BASE}/invoices`), rows, META); await settle(); f.detectChanges(); return f;
  }
  async function detail(doc = DOC) {
    const f = create(InvoicePage); ok(http.expectOne(`${BASE}/invoices/inv`), doc); await settle();
    if (f.componentInstance['canPay']()) { ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await settle(); }
    f.detectChanges(); return f;
  }
  async function modal(active: ActiveInvoicePaymentIntent | null = null) {
    const f = create(PayModal); const m = f.componentInstance;
    vi.spyOn(m['modal'](), 'open').mockImplementation(() => {});
    vi.spyOn(m['modal'](), 'close').mockImplementation(() => m['onModalClosed']());
    m.open('inv', 'INV-42');
    ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), active);
    ok(http.expectOne(`${BASE}/payment-input-currencies`), { walletCurrencyCode: 'USD', items: [{ currencyCode: 'USD', isBaseCurrency: true }, { currencyCode: 'EGP', isBaseCurrency: false }], total: 2 });
    await settle(); f.detectChanges(); return f;
  }
  async function quoted() {
    const f = await modal(); const p = f.componentInstance['requestQuote']();
    ok(http.expectOne(`${BASE}/invoices/inv/payment-quote`), quote()); await p; f.detectChanges(); return f;
  }

  it('invoices list renders CorePage rows', async () => {
    const f = await list(); expect(f.nativeElement.textContent).toContain('INV-42');
    expect(f.componentInstance['total']()).toBe(41); expect(f.nativeElement.querySelector('ui-pagination')).not.toBeNull();
    f.componentInstance['onPageChange'](2); f.detectChanges();
    const req = http.expectOne(r => r.url === `${BASE}/invoices` && r.params.get('page') === '2'); ok(req, [ROW], { ...META, page: 2 }); await settle();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 2 } }));
  });
  it('invoices list empty state', async () => {
    const f = await list([]); expect(f.nativeElement.textContent).toContain('binv.empty.none'); expect(f.nativeElement.querySelector('[role="table"]')).toBeNull();
  });
  it('invoice filters go to the server', async () => {
    query.next(convertToParamMap({ page: '3' })); const f = await list();
    query.next(convertToParamMap({ page: '3', status: 'ISSUED,OVERDUE', from: '2026-01-01', to: '2026-11-23' })); f.detectChanges();
    const req = http.expectOne(r => r.url === `${BASE}/invoices`);
    expect(req.request.params.getAll('status')).toEqual(['ISSUED', 'OVERDUE']); expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-11-23'); expect(req.request.params.get('page')).toBe('1'); ok(req, [ROW], META); await settle();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: null }, queryParamsHandling: 'merge' }));
    f.componentInstance['openInvoice'](ROW); expect(router.navigate).toHaveBeenLastCalledWith(['/workspace/billing/invoices', 'inv'],
      expect.objectContaining({ state: expect.objectContaining({ listQuery: { status: 'ISSUED,OVERDUE', from: '2026-01-01', to: '2026-11-23' } }) }));
  });
  it('unpaid filter from the url', async () => {
    query.next(convertToParamMap({ status: 'ISSUED,PARTIALLY_PAID,OVERDUE' })); const f = create(InvoicesPage);
    const req = http.expectOne(r => r.url === `${BASE}/invoices`); expect(req.request.params.getAll('status')).toEqual(['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']); ok(req, [ROW], META); await settle(); f.detectChanges();
  });
  it('void invoice keeps its chip', async () => {
    const row = { ...ROW, status: 'VOID' as const }; const f = await list([row]); expect(f.nativeElement.textContent).toContain('bill.status.invoice.VOID');
    expect(f.componentInstance['actionsFor'](row).map(a => a.id)).toEqual(['open']);
  });
  it('invoices non owner forbidden', async () => {
    const f = create(InvoicesPage); fail(http.expectOne(r => r.url === `${BASE}/invoices`), 403, 'TENANT_OWNER_REQUIRED'); await settle(); f.detectChanges();
    expect(f.nativeElement.querySelector('app-billing-forbidden')).not.toBeNull();
  });
  it('invoices list load failure', async () => {
    const f = create(InvoicesPage);
    for (const status of [503, 0]) {
      fail(http.expectOne(r => r.url === `${BASE}/invoices`), status); await settle(); f.detectChanges();
      expect(f.nativeElement.querySelector('app-billing-failed')).not.toBeNull();
      f.componentInstance['reload'](); f.detectChanges();
    }
    ok(http.expectOne(r => r.url === `${BASE}/invoices`), [], META); await settle(); expect(notify.connectionLost).toHaveBeenCalledTimes(1);
  });
  it('invoice detail shows lines and pay rule', async () => {
    const f = await detail(); expect(f.nativeElement.textContent).toContain('Manual service'); expect(f.componentInstance['canPay']()).toBe(true);
    for (const status of ['PAID', 'VOID', 'DRAFT'] as const) {
      f.componentInstance['data'].set({ ...DOC, invoice: { ...DOC.invoice, status } }); expect(f.componentInstance['canPay']()).toBe(false);
    }
    f.componentInstance['data'].set({ ...DOC, invoice: { ...DOC.invoice, currencyCode: 'EGP' } }); expect(f.componentInstance['canPay']()).toBe(false);
  });
  it('legacy invoice is paid offline only', async () => {
    const f = await detail({ ...DOC, invoice: { ...DOC.invoice, settlementCurrencyCode: 'EGP' } });
    expect(f.componentInstance['canPay']()).toBe(false); expect(f.nativeElement.textContent).toContain('binv.detail.offlineOnly');
  });
  it('missing invoice shows 404 page', async () => {
    const f = create(InvoicePage); fail(http.expectOne(`${BASE}/invoices/inv`), 404, 'INVOICE_NOT_FOUND'); await settle(); f.detectChanges();
    expect(f.nativeElement.querySelector('app-not-found-page')).not.toBeNull();
  });
  it('old invoice without history shows full state', async () => {
    history.replaceState({ invoiceRow: ROW }, ''); const f = create(InvoicePage);
    fail(http.expectOne(`${BASE}/invoices/inv`), 409, 'INVOICE_ACCEPTED_HISTORY_UNAVAILABLE'); await settle(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('INV-42'); expect(f.nativeElement.textContent).toContain('binv.detail.historyUnavailable');
    expect(f.nativeElement.querySelector('app-invoice-lines')).toBeNull();
  });
  it('invoice detail load failure', async () => {
    const f = create(InvoicePage); fail(http.expectOne(`${BASE}/invoices/inv`), 503); await settle(); f.detectChanges();
    expect(f.nativeElement.querySelector('app-billing-failed')).not.toBeNull();
    f.componentInstance['reload'](); f.detectChanges(); ok(http.expectOne(`${BASE}/invoices/inv`), { ...DOC, invoice: { ...DOC.invoice, status: 'PAID' } }); await settle();
    expect(f.componentInstance['loadFailed']()).toBe(false);
  });
  it('active intent resume banner', async () => {
    const f = await detail(); const p = f.componentInstance;
    for (const recoveryAction of ['CONTINUE_CHECKOUT', 'CHECK_STATUS', 'RECONCILIATION_REQUIRED'] as const) {
      const work = p['loadActiveIntent'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), { ...ACTIVE, recoveryAction }); await work; f.detectChanges();
      expect(p['activeIntent']()?.recoveryAction).toBe(recoveryAction);
      expect(f.nativeElement.textContent).toContain(recoveryAction === 'CONTINUE_CHECKOUT' ? 'binv.pay.continuePayment' : recoveryAction === 'CHECK_STATUS' ? 'bill.poll.checkNow' : 'binv.pay.underReview');
    }
    const work = p['loadActiveIntent'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await work; expect(p['activeIntent']()).toBeNull();
  });
  it('active intent failure inline', async () => {
    const f = await detail(); const work = f.componentInstance['loadActiveIntent'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), 503); await work; f.detectChanges();
    expect(f.nativeElement.textContent).toContain('binv.pay.loadFailed'); expect(f.nativeElement.textContent).toContain('bill.common.retry');
  });
  it('quote shows the server split', async () => {
    vi.useFakeTimers(); const f = await quoted(); const text = f.nativeElement.textContent;
    expect(text).toContain('USD 30'); expect(text).toContain('USD 70'); expect(text).toContain('EGP 3,500.50'); expect(text).toContain('15:00');
    await vi.advanceTimersByTimeAsync(1000); f.detectChanges(); expect(f.nativeElement.textContent).toContain('14:59');
  });
  it('quote sends no key', async () => {
    const f = await modal(); const work = f.componentInstance['requestQuote'](); const req = http.expectOne(`${BASE}/invoices/inv/payment-quote`);
    expect(req.request.headers.has('x-idempotency-key')).toBe(false); expect(req.request.body).toEqual({ paymentCurrencyCode: 'USD' }); ok(req, quote()); await work;
  });
  it('unpayable invoice toast and refresh', async () => {
    const f = await modal(); const refresh = vi.fn(); f.componentInstance.refresh.subscribe(refresh);
    for (const code of ['INVOICE_NOT_PAYABLE', 'INVOICE_ALREADY_PAID', 'INVOICE_NOT_CANONICAL_USD']) {
      const work = f.componentInstance['requestQuote'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-quote`), 409, code); await work;
      expect(notify.error).toHaveBeenLastCalledWith(`bill.errors.${code} message`);
    }
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it('quote fx error is a field message', async () => {
    const f = await modal(); const work = f.componentInstance['requestQuote'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-quote`), 422, 'FX_RATE_NOT_FOUND'); await work; f.detectChanges();
    expect(f.componentInstance['currencyError']()).toBe('bill.errors.FX_RATE_NOT_FOUND message'); expect(f.nativeElement.textContent).toContain('bill.errors.FX_RATE_NOT_FOUND'); expect(notify.error).not.toHaveBeenCalled();
  });
  it('quote provider unconfigured toast', async () => {
    const f = await modal(); const work = f.componentInstance['requestQuote'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-quote`), 503, 'PAYMENT_PROVIDER_UNCONFIGURED'); await work;
    expect(notify.error).toHaveBeenCalledWith('bill.errors.PAYMENT_PROVIDER_UNCONFIGURED message');
  });
  it('wallet only payment succeeds without polling', async () => {
    const f = await quoted(); const paid = vi.fn(); f.componentInstance.paid.subscribe(paid);
    const work = f.componentInstance['confirmPay'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents`), intent(true)); await work;
    expect(paid).toHaveBeenCalledOnce(); expect(notify.success).toHaveBeenCalledWith('binv.toast.paid'); expect(f.componentInstance['modal']().close).toHaveBeenCalled();
    expect(f.componentInstance['poller'].polling()).toBe(false); http.expectNone(`${BASE}/payments/payment`); expect(window.open).not.toHaveBeenCalled();
  });
  it('card payment opens checkout and polls', async () => {
    vi.useFakeTimers(); const f = await quoted(); const work = f.componentInstance['confirmPay'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents`), intent()); await work;
    expect(window.open).toHaveBeenCalledWith(ACTIVE.checkoutUrl, '_blank'); expect(f.componentInstance['poller'].polling()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await settle(); ok(http.expectOne(`${BASE}/payments/payment`), PAYMENT); await settle();
    expect(notify.success).toHaveBeenCalledWith('binv.toast.paid');
  });
  it('intent key per quote', async () => {
    const f = await quoted(); const m = f.componentInstance; let key = ''; let body: unknown;
    for (let i = 0; i < 2; i++) {
      const work = m['confirmPay'](); const req = http.expectOne(`${BASE}/invoices/inv/payment-intents`);
      if (i === 0) { key = req.request.headers.get('x-idempotency-key')!; body = req.request.body; } else { expect(req.request.headers.get('x-idempotency-key')).toBe(key); expect(req.request.body).toEqual(body); }
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); fail(req, 503); await work;
    }
    const requote = m['requestQuote'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-quote`), quote('new')); await requote;
    const work = m['confirmPay'](); const req = http.expectOne(`${BASE}/invoices/inv/payment-intents`); expect(req.request.headers.get('x-idempotency-key')).not.toBe(key); expect(req.request.body).toEqual({ paymentQuoteId: 'new' }); fail(req, 503); await work;
  });
  it('expired quote re-quotes', async () => {
    const f = await quoted();
    for (const code of ['FX_QUOTE_EXPIRED', 'FX_QUOTE_ALREADY_CONSUMED', 'PAYMENT_QUOTE_STALE']) {
      const work = f.componentInstance['confirmPay'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents`), 409, code); await settle();
      ok(http.expectOne(`${BASE}/invoices/inv/payment-quote`), quote(code)); await work; expect(f.componentInstance['quote']()?.quoteId).toBe(code);
      expect(notify.warning).toHaveBeenLastCalledWith('binv.pay.quoteExpired');
    }
  });
  it('active intent conflict shows resume', async () => {
    const f = await quoted(); const work = f.componentInstance['confirmPay'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents`), 409, 'PAYMENT_INTENT_ALREADY_ACTIVE'); await work;
    ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), { ...ACTIVE, recoveryAction: 'CONTINUE_CHECKOUT' }); await settle();
    expect(f.componentInstance['attempt']()?.recoveryAction).toBe('CONTINUE_CHECKOUT'); expect(notify.warning).toHaveBeenCalled();
  });
  it('intent key mismatch text', async () => {
    const f = await quoted();
    for (const [status, code] of [[409, 'IDEMPOTENCY_KEY_REUSED'], [422, 'GW.IDEM.MISMATCH']] as const) {
      const work = f.componentInstance['confirmPay'](); const req = http.expectOne(`${BASE}/invoices/inv/payment-intents`);
      req.flush({ code }, { status, statusText: 'Conflict' }); await work;
      expect(notify.error).toHaveBeenLastCalledWith(code === 'IDEMPOTENCY_KEY_REUSED' ? 'bill.errors.IDEMPOTENCY_KEY_REUSED message' : 'settings.errors.idempotencyMismatch message');
      expect(f.componentInstance['step']()).toBe('quote');
    }
  });
  it('intent in flight blocks resend', async () => {
    const f = await quoted(); const work = f.componentInstance['confirmPay'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents`), 409, 'GW.IDEM.IN_FLIGHT'); await work;
    await f.componentInstance['confirmPay'](); http.expectNone(`${BASE}/invoices/inv/payment-intents`); expect(f.componentInstance['intentInFlight']()).toBe(true);
    expect(notify.error).toHaveBeenCalledWith('settings.errors.idempotency message');
  });
  for (const [name, status, code] of [['wallet insufficient toast', 422, 'WALLET_INSUFFICIENT'], ['reconciliation hold toast', 409, 'INVOICE_COLLECTION_RECONCILIATION_HOLD']] as const) {
    it(name, async () => {
      const f = await quoted(); const work = f.componentInstance['confirmPay'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents`), status, code); await work;
      expect(notify.error).toHaveBeenCalled(); expect(f.componentInstance['step']()).toBe('quote');
    });
  }
  it('intent 401 keeps modal and key', async () => {
    const f = await quoted(); const key = f.componentInstance['intentRequest']?.key;
    const work = f.componentInstance['confirmPay'](); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents`), 401, 'COMMON.GENERIC.UNAUTHORIZED'); await work;
    expect(notify.error).toHaveBeenCalledWith('bill.errors.notSaved'); expect(f.componentInstance['intentRequest']?.key).toBe(key);
    expect(f.componentInstance['modal']().close).not.toHaveBeenCalled(); expect(router.navigate).not.toHaveBeenCalled();
  });
  it('intent failure retry same key', async () => {
    const f = await quoted(); let key: string | null = null;
    for (const status of [503, 0]) {
      const work = f.componentInstance['confirmPay'](); const req = http.expectOne(`${BASE}/invoices/inv/payment-intents`);
      if (key) expect(req.request.headers.get('x-idempotency-key')).toBe(key); key = req.request.headers.get('x-idempotency-key'); fail(req, status); await work;
    }
    expect(notify.error).toHaveBeenCalledTimes(2);
  });
  it('payment poll final states', async () => {
    vi.useFakeTimers(); const f = await modal(ACTIVE); const m = f.componentInstance;
    for (const status of ['SUCCEEDED', 'FAILED', 'EXPIRED'] as const) {
      m['startPolling']('payment'); await vi.advanceTimersByTimeAsync(5000);
      ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await settle(); ok(http.expectOne(`${BASE}/payments/payment`), { ...PAYMENT, status }); await settle();
      expect(m['poller'].polling()).toBe(false);
    }
    expect(notify.success).toHaveBeenCalledWith('binv.toast.paid'); expect(notify.error).toHaveBeenCalledWith('binv.toast.failed'); expect(notify.warning).toHaveBeenCalledWith('binv.toast.expired');
  });
  it('payment poll window ends with check now', async () => {
    vi.useFakeTimers(); const f = await modal(ACTIVE);
    for (let i = 0; i < 59; i++) {
      await vi.advanceTimersByTimeAsync(5000); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), ACTIVE); await settle();
      ok(http.expectOne(`${BASE}/payments/payment`), { ...PAYMENT, status: 'PENDING' }); await settle();
    }
    await vi.advanceTimersByTimeAsync(5000); f.detectChanges(); expect(f.componentInstance['poller'].polling()).toBe(false);
    expect(f.nativeElement.textContent).toContain('bill.poll.stillProcessing'); expect(f.nativeElement.textContent).toContain('bill.poll.checkNow');
    const work = f.componentInstance['retryPolling'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), ACTIVE); await work;
    expect(f.componentInstance['poller'].polling()).toBe(false); http.expectNone(`${BASE}/payments/payment`);
  });
  it('payment poll 404 stops', async () => {
    vi.useFakeTimers(); const f = await modal(ACTIVE); await vi.advanceTimersByTimeAsync(5000);
    ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await settle(); fail(http.expectOne(`${BASE}/payments/payment`), 404, 'PAYMENT_NOT_FOUND'); await settle();
    expect(f.componentInstance['poller'].polling()).toBe(false); expect(f.componentInstance['pollTimedOut']()).toBe(true); f.detectChanges(); expect(f.nativeElement.textContent).toContain('bill.poll.checkNow');
  });
  it('check now respects each recovery action without restarting polling', async () => {
    const f = await modal(ACTIVE); const m = f.componentInstance;
    m['poller'].stop(); m['pollTimedOut'].set(true);
    for (const recoveryAction of ['CONTINUE_CHECKOUT', 'CHECK_STATUS', 'RECONCILIATION_REQUIRED'] as const) {
      m['attempt'].set(ACTIVE);
      const work = m['retryPolling']();
      ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), { ...ACTIVE, recoveryAction }); await work; f.detectChanges();
      expect(m['attempt']()?.recoveryAction).toBe(recoveryAction);
      expect(m['poller'].polling()).toBe(false);
      expect(f.nativeElement.textContent).toContain(recoveryAction === 'CONTINUE_CHECKOUT' ? 'binv.pay.continuePayment' : recoveryAction === 'CHECK_STATUS' ? 'bill.poll.checkNow' : 'binv.pay.underReview');
    }
    m['attempt'].set(ACTIVE);
    const refresh = vi.fn(); m.refresh.subscribe(refresh);
    const work = m['retryPolling'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), null); await work;
    expect(refresh).toHaveBeenCalledOnce(); expect(m['modal']().close).toHaveBeenCalled();
  });
  it('blocked checkout retains a usable fallback action', async () => {
    const f = await quoted(); vi.mocked(window.open).mockReturnValue(null);
    const work = f.componentInstance['confirmPay'](); ok(http.expectOne(`${BASE}/invoices/inv/payment-intents`), intent()); await work; f.detectChanges();
    expect(f.componentInstance['popupBlocked']()).toBe(true);
    expect(f.nativeElement.textContent).toContain('binv.pay.openPaymentPage');
    expect(notify.warning).toHaveBeenCalledWith('binv.toast.popupBlockedTitle', 'binv.toast.popupBlockedText');
  });
  it('offline payment label', async () => {
    vi.useFakeTimers(); const f = await modal(ACTIVE); await vi.advanceTimersByTimeAsync(5000);
    ok(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), ACTIVE); await settle(); ok(http.expectOne(`${BASE}/payments/payment`), { ...PAYMENT, provider: 'OFFLINE', status: 'REQUIRES_REVIEW' }); await settle(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('binv.payments.offline'); expect(f.componentInstance['attempt']()?.checkoutUrl).toBeNull();
    f.componentInstance['openCheckoutUrl'](); expect(window.open).not.toHaveBeenCalled();
  });
  it('no invoice download control', async () => {
    const f = await detail(); const controls = Array.from(f.nativeElement.querySelectorAll('button, a')) as HTMLElement[];
    expect(controls.some(el => /pdf|download|receipt/i.test(el.textContent ?? ''))).toBe(false);
  });
  it('poll errors back off and stop after three consecutive failures', async () => {
    vi.useFakeTimers(); const events: PollEvent[] = []; const poller = TestBed.inject(PaymentPoller);
    poller.start('inv', 'payment', e => events.push(e));
    for (const delay of [5000, 10000, 20000]) { await vi.advanceTimersByTimeAsync(delay); fail(http.expectOne(`${BASE}/invoices/inv/payment-intents/active`), 503); await settle(); }
    expect(poller.polling()).toBe(false); expect(events.at(-1)?.kind).toBe('error');
  });
});
