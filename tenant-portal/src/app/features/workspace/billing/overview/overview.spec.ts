import { DOCUMENT, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/ws-billing-overview/en.json';
import ar from '../../../../../../public/i18n/ws-billing-overview/ar.json';
import billEn from '../../../../../../public/i18n/ws-billing/en.json';
import billAr from '../../../../../../public/i18n/ws-billing/ar.json';
import settingsEn from '../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../public/i18n/settings/ar.json';
import { AuthSession } from '../../../../core/auth/auth-session';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { BillingApi } from '../billing.api';
import type { BillingSummary, PaymentStatus, PaymentStatusView, TenantInvoiceView, WalletLedgerEntry } from '../billing.model';
import { formatUsd } from '../shared/money';
import { PAYMENT_POLL } from '../shared/billing-poll';
import { OverviewPage } from './overview-page/overview-page';
import { PaymentsTable } from './payments-table/payments-table';
import { LedgerTable } from './ledger-table/ledger-table';
import { TopupModal } from './topup-modal/topup-modal';

const BASE = '/api/tenant/core/v1';
const WALLET = { currencyCode: 'USD', balanceUsd: '12345.6789', reservedBalanceUsd: '20.0000', availableBalanceUsd: '12325.6789', status: 'ACTIVE' } as const;
const SUMMARY: BillingSummary = {
  subscription: { id: 'sub', status: 'PAST_DUE', billingCycle: 'MONTHLY', startedAt: '2026-01-01', trialEndsAt: null,
    currentPeriodStart: null, currentPeriodEnd: '2026-12-01', activationScheduledAt: null,
    totalPriceUsd: '99999999999999.9999', accessMode: 'DUNNING' },
  wallet: WALLET, outstandingInvoice: null,
};
const INVOICE: TenantInvoiceView = {
  id: 'invoice', number: 'INV-0123', status: 'OVERDUE', purpose: 'RENEWAL', currencyCode: 'USD', canonicalUsd: true,
  subtotalUsd: '125.1234', taxTotalUsd: '0.0000', totalUsd: '125.1234', amountPaidUsd: '0.0000', outstandingUsd: '125.1234',
  legacyOriginalAmounts: null, periodStart: null, periodEnd: null, issuedAt: null, dueAt: '2026-11-01', paidAt: null,
};
const PAYMENT: PaymentStatusView = {
  paymentId: 'payment', purpose: 'WALLET_TOP_UP', provider: 'PAYMOB', status: 'PENDING', invoiceId: null, invoiceStatus: null,
  subscriptionStatus: 'PAST_DUE', providerAmount: '100.1234', providerCurrencyCode: 'EGP', settlementAmountUsd: '2.0000',
  walletAppliedUsd: '0.0000', totalAppliedUsd: '2.0000', createdAt: '2026-11-23T08:00:00Z', updatedAt: '2026-11-23T08:00:00Z',
};
const LEDGER: WalletLedgerEntry = {
  id: 'ledger', walletId: 'wallet', direction: 'CREDIT', amountUsd: '99.8765', sourceAmount: '5000.1234', sourceCurrencyCode: 'EGP',
  currencyUnitsPerUsd: null, rateRevisionId: null, rateObservedAt: null, balanceAfterUsd: '700.1234', reason: 'TOP_UP',
  actor: { type: 'ADMIN', id: 'admin' }, referenceType: null, referenceId: null, note: 'Admin note — ملاحظة الإدارة', createdAt: '2026-11-23T08:00:00Z',
};
const CURRENCIES = { walletCurrencyCode: 'USD', items: [{ currencyCode: 'USD', isBaseCurrency: true }], total: 1,
  topUpLimitsUsd: { min: '2.3456', max: '45678.1234' } };

class Loader {
  getTranslation(lang: string) {
    const arabic = lang.endsWith('ar');
    if (lang.startsWith('ws-billing-overview/')) return of(arabic ? ar : en);
    if (lang.startsWith('ws-billing/')) return of(arabic ? billAr : billEn);
    if (lang.startsWith('settings/')) return of(arabic ? settingsAr : settingsEn);
    return of(arabic ? globalAr : globalEn);
  }
}

describe('Workspace billing overview API linking', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<unknown>;
  const me = signal({ isTenantOwner: true });
  const language = signal<'en' | 'ar'>('en');
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    me.set({ isTenantOwner: true });
    language.set('en');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: AuthSession, useValue: { me } },
      { provide: LanguageState, useValue: { current: language } },
      { provide: Notify, useValue: notify },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: true,
        missingHandler: { logMissingKey: false } }, loader: Loader }),
    ] });
    const t = TestBed.inject(TranslocoService);
    t.setTranslation({ ...globalEn, bill: billEn, bov: en, settings: settingsEn }, 'en');
    t.setTranslation({ ...globalAr, bill: billAr, bov: ar, settings: settingsAr }, 'ar');
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-value`);
    vi.spyOn(window, 'open').mockReturnValue({ closed: false, opener: window } as Window);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    http = TestBed.inject(HttpTestingController);
    expect(TestBed.inject(BillingApi)).toBeInstanceOf(BillingApi);
  });
  afterEach(() => {
    fixture?.destroy();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    http?.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });
  function create<T>(type: Type<T>): T {
    const created = TestBed.createComponent(type);
    fixture = created;
    fixture.detectChanges();
    return created.componentInstance;
  }
  async function render() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }
  function text(): string { return (fixture.nativeElement as HTMLElement).textContent ?? ''; }
  function get(path: string): TestRequest { return http.expectOne((r) => r.url === BASE + path); }
  function success(req: TestRequest, data: unknown) { req.flush({ success: true, data }); }
  function fail(req: TestRequest, code: string, status = 503) { req.flush({ errorCode: code, correlationId: 'ref-test' }, { status, statusText: 'Test error' }); }
  function page(req: TestRequest, data: unknown[], total = data.length) {
    const current = Number(req.request.params.get('page'));
    req.flush({ success: true, data, meta: { page: current, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)), hasNext: total > current * 20, hasPrev: current > 1 } });
  }
  async function overview(summary = SUMMARY) {
    const component = create(OverviewPage);
    success(get('/billing/summary'), summary);
    await render();
    success(get('/wallet'), WALLET);
    page(get('/payments'), []);
    await render();
    return component;
  }
  async function topup() {
    const component = create(TopupModal);
    component.open();
    success(get('/billing/payment-input-currencies'), CURRENCIES);
    await render();
    component['amount'].set('10');
    return component;
  }
  async function startTopup(component: TopupModal) {
    const pending = component['submit']();
    const req = get('/payments/topup');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-value');
    success(req, { paymentId: 'payment', checkoutUrl: 'https://checkout.example.test/payment' });
    await pending;
    await render();
  }
  async function tick(status: PaymentStatus) {
    vi.advanceTimersByTime(PAYMENT_POLL.intervalMs);
    await render();
    success(get('/billing/payments/payment'), { ...PAYMENT, status });
    await render();
  }

  it('overview renders summary strings unchanged', async () => {
    const component = await overview();
    expect(component['summary']()).toEqual(SUMMARY);
    for (const amount of [SUMMARY.subscription.totalPriceUsd, WALLET.balanceUsd, WALLET.reservedBalanceUsd, WALLET.availableBalanceUsd]) {
      expect(text()).toContain(formatUsd(amount));
    }
    expect(text()).toContain(billEn.status.subscription.PAST_DUE);
    expect(text()).toContain(billEn.access.DUNNING);
  });

  it('invoice due now card and all invoices link', async () => {
    const component = await overview({ ...SUMMARY, outstandingInvoice: INVOICE });
    expect(text()).toContain(en.cards.dueNow);
    expect(text()).toContain(INVOICE.number);
    expect(text()).toContain(formatUsd(INVOICE.outstandingUsd));
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')];
    const all = links.find((a) => a.textContent?.includes(en.cards.allInvoices))!;
    expect(all.pathname).toBe('/workspace/billing/invoices');
    expect(new URL(all.href).searchParams.get('status')).toBe('ISSUED,PARTIALLY_PAID,OVERDUE');
    expect(links.find((a) => a.textContent?.trim() === billEn.common.pay)?.href).toContain('/workspace/billing/invoices/invoice?pay=1');
    component['summary'].set(SUMMARY);
    await render();
    expect(text()).not.toContain(en.cards.dueNow);
  });

  it('non owner sees forbidden state', async () => {
    create(OverviewPage);
    fail(get('/billing/summary'), 'TENANT_OWNER_REQUIRED', 403);
    await render();
    expect(text()).toContain(billEn.forbidden.title);
    http.expectNone((r) => r.url.endsWith('/payments') || r.url.endsWith('/wallet'));
  });
  it('known non owner makes no billing request', async () => {
    me.set({ isTenantOwner: false });
    create(OverviewPage);
    await render();
    expect(text()).toContain(billEn.forbidden.title);
    http.expectNone(() => true);
  });
  it('no subscription shows empty state with catalogue link', async () => {
    create(OverviewPage);
    fail(get('/billing/summary'), 'SUBSCRIPTION_NOT_FOUND', 404);
    await render();
    expect(text()).toContain(en.empty.noSubscription);
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe('/workspace/billing/catalogue');
  });
  it('summary failure shows load failure with retry', async () => {
    const component = create(OverviewPage);
    fail(get('/billing/summary'), 'SUBSCRIPTION_READ_INCONSISTENT', 409);
    await render();
    expect(text()).toContain(billEn.failed.title);
    expect(text()).toContain('ref-test');
    (fixture.nativeElement as HTMLElement).querySelector('app-billing-failed button')?.dispatchEvent(new MouseEvent('click'));
    fail(get('/billing/summary'), 'UNAVAILABLE', 503);
    await render();
    expect(component['loadFailed']()).toBe(true);
  });
  it('summary offline shows lost connection', async () => {
    create(OverviewPage);
    get('/billing/summary').error(new ProgressEvent('error'));
    await render();
    expect(text()).toContain(billEn.failed.title);
    expect(notify.connectionLost).toHaveBeenCalledOnce();
  });
  it('read only access badge text', async () => {
    await overview({ ...SUMMARY, subscription: { ...SUMMARY.subscription, accessMode: 'READ_ONLY' } });
    expect(text()).toContain(billEn.badges.access.READ_ONLY);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('article button')?.disabled).toBe(false);
  });
  it('payments tab pages through CorePage', async () => {
    const component = create(PaymentsTable);
    const first = get('/payments');
    expect(first.request.params.get('limit')).toBe('20');
    page(first, [PAYMENT], 21);
    await render();
    expect(text()).toContain('EGP 100.12');
    expect((fixture.nativeElement as HTMLElement).querySelector('ui-pagination')).not.toBeNull();
    component['page'].set(2);
    await render();
    const second = get('/payments');
    expect(second.request.params.get('page')).toBe('2');
    page(second, []);
    await render();
    expect(text()).toContain(en.payments.empty);
    component['onPageSizeChange'](101);
    await render();
    http.expectNone(() => true);
  });
  it('payments tab failure is local', async () => {
    const component = await overview();
    component['tablesReloadToken'].update((n) => n + 1);
    await render();
    fail(get('/payments'), 'UNAVAILABLE');
    await render();
    expect(text()).toContain(billEn.failed.title);
    expect(text()).toContain(formatUsd(WALLET.balanceUsd));
    await TestBed.inject(Router).navigate([], { queryParams: { tab: 'wallet' } });
    await render();
    page(get('/wallet/ledger'), [LEDGER]);
    await render();
    expect(text()).toContain(LEDGER.note);
  });
  it('offline payment row label', async () => {
    create(PaymentsTable);
    page(get('/payments'), [{ ...PAYMENT, provider: 'OFFLINE' }]);
    await render();
    expect(text()).toContain(en.payments.offline);
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href*="checkout"]')).toBeNull();
  });
  it('ledger tab states', async () => {
    const component = create(LedgerTable);
    page(get('/wallet/ledger'), [LEDGER]);
    await render();
    expect(text()).toContain(LEDGER.note);
    expect(text()).toContain('+USD 99.88');
    expect(text()).toContain('USD 700.12');
    component['reload']();
    page(get('/wallet/ledger'), []);
    await render();
    expect(text()).toContain(en.ledger.empty);
    component['reload']();
    fail(get('/wallet/ledger'), 'UNAVAILABLE');
    await render();
    expect(text()).toContain(billEn.failed.title);
  });
  it('topup query opens the modal', async () => {
    await TestBed.inject(Router).navigate([], { queryParams: { topup: 1, tab: 'payments' } });
    create(OverviewPage);
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false);
    success(get('/billing/summary'), SUMMARY);
    await render();
    success(get('/wallet'), WALLET);
    page(get('/payments'), []);
    success(get('/billing/payment-input-currencies'), CURRENCIES);
    await render();
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
    expect(TestBed.inject(Router).url).not.toContain('topup=');
    expect(TestBed.inject(Router).url).toContain('tab=payments');
    const modal = fixture.debugElement.query(By.directive(TopupModal)).componentInstance as TopupModal;
    expect(modal['amount']()).toBe('');
  });
  it('missing wallet shows dash', async () => {
    create(OverviewPage);
    success(get('/billing/summary'), SUMMARY);
    await render();
    fail(get('/wallet'), 'WALLET_NOT_FOUND', 404);
    page(get('/payments'), []);
    await render();
    const wallet = (fixture.nativeElement as HTMLElement).querySelectorAll('article')[1];
    expect(wallet.textContent).not.toContain(formatUsd(WALLET.balanceUsd));
    expect(wallet.textContent).toContain('—');
  });
  it('wallet failure inline retry', async () => {
    const component = create(OverviewPage);
    success(get('/billing/summary'), SUMMARY);
    await render();
    fail(get('/wallet'), 'UNAVAILABLE');
    page(get('/payments'), []);
    await render();
    expect((fixture.nativeElement as HTMLElement).querySelector('article app-billing-failed')).not.toBeNull();
    const retry = component['loadWallet']();
    success(get('/wallet'), WALLET);
    await retry;
    await render();
    expect(text()).toContain(formatUsd(WALLET.balanceUsd));
  });
  it('currencies usd only', async () => {
    const component = await topup();
    expect(component['currencies']()).toEqual(['USD']);
    expect(component['currencyCode']()).toBe('USD');
  });
  it('currencies failure inline retry', async () => {
    const component = create(TopupModal);
    component.open();
    fail(get('/billing/payment-input-currencies'), 'UNAVAILABLE');
    await render();
    expect(text()).toContain(billEn.failed.title);
    const retry = component['loadCurrencies']();
    success(get('/billing/payment-input-currencies'), CURRENCIES);
    await retry;
    await render();
    expect(component['currenciesFailed']()).toBe(false);
  });
  it('top-up hint shows server limits', async () => {
    const component = await topup();
    expect(component['limitsHint']()).toBe('About \u2066USD 2.35\u2069 to \u2066USD 45,678.12\u2069. The final check is made when you pay.');
    expect(text()).toContain(component['limitsHint']());
    component['amount'].set('1');
    const submit = component['submit']();
    fail(get('/payments/topup'), 'TOPUP_AMOUNT_OUT_OF_RANGE', 422);
    await submit;
  });
  it('top-up opens checkout and polls payment', async () => {
    vi.useFakeTimers();
    const component = await topup();
    await startTopup(component);
    expect(window.open).toHaveBeenCalledWith('https://checkout.example.test/payment', '_blank');
    await tick('PENDING');
    expect(component['polling']()).toBe(true);
    http.expectNone(`${BASE}/wallet`);
  });
  it('blocked popup shows checkout link', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const component = await topup();
    await startTopup(component);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[target="_blank"]');
    expect(link?.textContent).toContain(en.topup.openCheckout);
    expect(link?.href).toBe('https://checkout.example.test/payment');
    expect(link?.rel).toContain('noopener');
  });
  it('top-up key reuse rules', async () => {
    const component = await topup();
    const keys: (string | null)[] = [];
    for (const amount of ['10', '10', '11']) {
      component['amount'].set(amount);
      const submit = component['submit']();
      const req = get('/payments/topup');
      keys.push(req.request.headers.get('x-idempotency-key'));
      expect(req.request.body).toEqual({ amount, currencyCode: 'USD' });
      fail(req, 'PAYMENT_PROVIDER_UNCONFIGURED');
      await submit;
    }
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
    component['onCurrencyChange']('EGP');
    component['currencies'].set(['USD', 'EGP']);
    const submit = component['submit']();
    const next = get('/payments/topup');
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(keys[2]);
    fail(next, 'UNAVAILABLE');
    await submit;
  });
  it.each([
    ['TOPUP_AMOUNT_OUT_OF_RANGE', 'amount out of range is a field message'],
    ['FX_AMOUNT_ROUNDS_TO_ZERO', 'amount rounds to zero field message'],
  ])('%s: %s', async (code) => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), code, 422);
    await submit;
    await render();
    expect(component['amountError']()).toBe(billEn.errors[code as keyof typeof billEn.errors]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[id$="-amount-error"]')?.getAttribute('role')).toBe('alert');
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('deactivated currency reloads list', async () => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), 'FX_RATE_NOT_FOUND', 422);
    await render();
    success(get('/billing/payment-input-currencies'), CURRENCIES);
    await submit;
    await render();
    expect(component['currencyError']()).toBe(billEn.errors.FX_RATE_NOT_FOUND);
    expect((fixture.nativeElement as HTMLElement).querySelector('[id$="-currency-error"]')?.textContent).toContain(billEn.errors.FX_RATE_NOT_FOUND);
  });
  it('access blocked top-up toast', async () => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), 'ACCESS_POLICY_BLOCKED', 403);
    await submit;
    expect(notify.error).toHaveBeenCalledWith(billEn.errors.ACCESS_POLICY_BLOCKED);
  });
  it('inactive wallet toast', async () => {
    const component = await topup();
    for (const code of ['WALLET_NOT_ACTIVE', 'WALLET_FROZEN']) {
      const submit = component['submit']();
      fail(get('/payments/topup'), code, 409);
      await submit;
      expect(notify.error).toHaveBeenLastCalledWith(billEn.errors.WALLET_NOT_ACTIVE);
    }
  });
  it('top-up key mismatch text', async () => {
    const component = await topup();
    for (const code of ['IDEMPOTENCY_KEY_REUSED', 'GW.IDEM.MISMATCH']) {
      const submit = component['submit']();
      fail(get('/payments/topup'), code, code.startsWith('GW') ? 422 : 409);
      await submit;
      expect(notify.error).toHaveBeenCalledWith(settingsEn.errors.idempotencyMismatch);
    }
  });
  it('top-up in flight blocks resend', async () => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), 'GW.IDEM.IN_FLIGHT', 409);
    await submit;
    expect(notify.info).toHaveBeenCalledOnce();
    await component['submit']();
    http.expectNone(`${BASE}/payments/topup`);
  });
  it('replayed unavailable intent starts over', async () => {
    const component = await topup();
    const first = component['submit']();
    const firstReq = get('/payments/topup');
    const key = firstReq.request.headers.get('x-idempotency-key');
    fail(firstReq, 'PAYMENT_INTENT_UNAVAILABLE', 409);
    await first;
    const second = component['submit']();
    const nextReq = get('/payments/topup');
    expect(nextReq.request.headers.get('x-idempotency-key')).not.toBe(key);
    fail(nextReq, 'UNAVAILABLE');
    await second;
  });
  it.each([
    [503, 'PAYMENT_PROVIDER_UNCONFIGURED', 'provider unconfigured toast keeps key'],
    [401, 'SESSION_EXPIRED', 'top-up 401 keeps form and key'],
    [0, 'NETWORK_ERROR', 'top-up offline keeps key'],
  ])('%s %s: %s', async (status, code) => {
    const component = await topup();
    const submit = component['submit']();
    const req = get('/payments/topup');
    const key = req.request.headers.get('x-idempotency-key');
    if (status === 0) req.error(new ProgressEvent('error')); else fail(req, code, status);
    await submit;
    expect(component['phase']()).toBe('form');
    expect(component['amount']()).toBe('10');
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
    if (status === 0) expect(notify.connectionLost).toHaveBeenCalledOnce();
    else expect(notify.error).toHaveBeenCalledWith(status === 401 ? billEn.errors.notSaved : billEn.errors.PAYMENT_PROVIDER_UNCONFIGURED);
    const retry = component['submit']();
    const retryReq = get('/payments/topup');
    expect(retryReq.request.headers.get('x-idempotency-key')).toBe(key);
    fail(retryReq, 'UNAVAILABLE');
    await retry;
  });
  it('top-up succeeded refreshes balance', async () => {
    vi.useFakeTimers();
    await overview();
    const component = fixture.debugElement.query(By.directive(TopupModal)).componentInstance as TopupModal;
    component.open();
    success(get('/billing/payment-input-currencies'), CURRENCIES);
    await render();
    component['amount'].set('10');
    await startTopup(component);
    await tick('SUCCEEDED');
    expect(notify.success).toHaveBeenCalledWith(en.topup.succeeded);
    success(get('/billing/summary'), SUMMARY);
    page(get('/payments'), [PAYMENT]);
    await render();
    success(get('/wallet'), { ...WALLET, balanceUsd: '999.1234' });
    await render();
    expect(text()).toContain('USD 999.12');
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL.intervalMs);
    http.expectNone((r) => r.url.includes('/billing/payments/'));
  });
  it('top-up failed or expired stops polling', async () => {
    vi.useFakeTimers();
    const component = await topup();
    for (const [status, message] of [['FAILED', en.topup.failed], ['EXPIRED', en.topup.expired]] as const) {
      if (component['phase']() !== 'form') {
        component.open();
        success(get('/billing/payment-input-currencies'), CURRENCIES);
        await render();
        component['amount'].set('10');
      }
      await startTopup(component);
      await tick(status);
      expect(text()).toContain(message);
      expect(notify.error).toHaveBeenCalledWith(message);
      expect(component['polling']()).toBe(false);
      await vi.advanceTimersByTimeAsync(PAYMENT_POLL.intervalMs);
      http.expectNone((r) => r.url.includes('/billing/payments/'));
    }
  });
  it('top-up under review stops polling', async () => {
    vi.useFakeTimers();
    const component = await topup();
    await startTopup(component);
    await tick('REQUIRES_REVIEW');
    expect(notify.info).toHaveBeenCalledWith(en.topup.review);
    expect(text()).toContain(en.topup.review);
    expect(component['canCheck']()).toBe(false);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL.intervalMs);
    http.expectNone((r) => r.url.includes('/billing/payments/'));
  });
  it('top-up poll window ends with check now', async () => {
    vi.useFakeTimers();
    const component = await topup();
    await startTopup(component);
    for (let i = 0; i < PAYMENT_POLL.attempts; i++) await tick('PENDING');
    expect(text()).toContain(billEn.poll.stillProcessing);
    expect(text()).toContain(billEn.poll.checkNow);
    const check = component['checkNow']();
    success(get('/billing/payments/payment'), PAYMENT);
    await check;
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL.intervalMs * 2);
    http.expectNone((r) => r.url.includes('/billing/payments/'));
  });
  it('top-up poll 404 stops', async () => {
    vi.useFakeTimers();
    const component = await topup();
    await startTopup(component);
    vi.advanceTimersByTime(PAYMENT_POLL.intervalMs);
    await render();
    fail(get('/billing/payments/payment'), 'PAYMENT_NOT_FOUND', 404);
    await render();
    expect(text()).toContain(billEn.poll.checkNow);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL.intervalMs * 2);
    http.expectNone((r) => r.url.includes('/billing/payments/'));
    const check = component['checkNow']();
    success(get('/billing/payments/payment'), { ...PAYMENT, status: 'SUCCEEDED' });
    await check;
    expect(notify.success).toHaveBeenCalledWith(en.topup.succeeded);
  });
  it('overview shows server money without arithmetic', async () => {
    const component = await overview();
    expect(component['wallet']()).toEqual(WALLET);
    expect(text()).toContain('USD 12,325.68');
    expect(text()).toContain('USD 100,000,000,000,000');
    for (const span of (fixture.nativeElement as HTMLElement).querySelectorAll('[dir="ltr"]')) {
      expect(span.textContent).not.toMatch(/[٠-٩]/);
    }
  });
  it('closing the modal ignores a pending poll result', async () => {
    vi.useFakeTimers();
    const component = await topup();
    await startTopup(component);
    vi.advanceTimersByTime(PAYMENT_POLL.intervalMs);
    await render();
    const req = get('/billing/payments/payment');
    component['close']();
    success(req, { ...PAYMENT, status: 'SUCCEEDED' });
    expect(notify.success).not.toHaveBeenCalled();
  });
  it('reopening during a currency request keeps the form usable', async () => {
    const component = create(TopupModal);
    component.open();
    const req = get('/billing/payment-input-currencies');
    component['close']();
    component.open();
    success(req, CURRENCIES);
    await render();
    expect(component['currenciesLoading']()).toBe(false);
    expect(component['currencies']()).toEqual(['USD']);
    component['amount'].set('10');
    await startTopup(component);
  });
  it('unchanged input cannot unblock an in-flight attempt', async () => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), 'GW.IDEM.IN_FLIGHT', 409);
    await submit;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    component['onCurrencyChange']('USD');
    await component['submit']();
    http.expectNone(`${BASE}/payments/topup`);
  });
  it('field errors retranslate when the language changes', async () => {
    const component = await topup();
    const submit = component['submit']();
    fail(get('/payments/topup'), 'TOPUP_AMOUNT_OUT_OF_RANGE', 422);
    await submit;
    expect(component['amountError']()).toBe(billEn.errors.TOPUP_AMOUNT_OUT_OF_RANGE);
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await render();
    expect(component['amountError']()).toBe(billAr.errors.TOPUP_AMOUNT_OUT_OF_RANGE);
  });
  it('currencies without limits do not invent a hint', async () => {
    const component = create(TopupModal);
    component.open();
    success(get('/billing/payment-input-currencies'), { ...CURRENCIES, topUpLimitsUsd: undefined });
    await render();
    expect(component['limitsHint']()).toBeNull();
  });
  it('list offline errors use the persistent connection toast and local retry', async () => {
    const component = create(PaymentsTable);
    get('/payments').error(new ProgressEvent('error'));
    await render();
    expect(text()).toContain(billEn.failed.title);
    expect(notify.connectionLost).toHaveBeenCalledOnce();
    component['reload']();
    page(get('/payments'), [PAYMENT]);
    await render();
    expect(notify.connectionRestored).toHaveBeenCalled();
  });
  it('ledger owner rejection has a forbidden state', async () => {
    create(LedgerTable);
    fail(get('/wallet/ledger'), 'TENANT_OWNER_REQUIRED', 403);
    await render();
    expect(text()).toContain(billEn.forbidden.title);
  });
  it.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const)(
    '%s %s renders scoped billing labels and LTR money', async (lang, theme) => {
      const document = TestBed.inject(DOCUMENT);
      const previousTheme = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', theme);
      language.set(lang);
      TestBed.inject(TranslocoService).setActiveLang(lang);
      try {
        await overview({ ...SUMMARY, outstandingInvoice: INVOICE });
        expect(text()).toContain((lang === 'ar' ? ar : en).cards.dueNow);
        expect(text()).toContain('USD 125.12');
        expect(text()).not.toMatch(/bov\.|bill\./);
        for (const span of (fixture.nativeElement as HTMLElement).querySelectorAll('[dir="ltr"]')) {
          expect(span.textContent).not.toMatch(/[٠-٩]/);
        }
      } finally {
        if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', previousTheme);
      }
    },
  );
  it('Arabic and English translations keep matching keys', () => {
    function keys(value: object, prefix = ''): string[] {
      return Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null
        ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);
    }
    expect(keys(ar)).toEqual(keys(en));
  });
});


