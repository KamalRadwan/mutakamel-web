import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { CommercialPreview, CommercialOperation } from '../../billing.model';
import { ChangePage } from './change-page';
import {
  BASE,
  SUBSCRIPTION,
  SUMMARY,
  OFFERS,
  operation,
  preview,
  receipt,
  setupHttp,
  respond,
  fail,
  tick,
} from '../subscription.spec-helpers';

// Read the protected state as well as the rendered result; HTTP always goes through BillingApi/CoreHttp.
type PageState = Record<string, any>;
let fixture: ComponentFixture<ChangePage>;
let dialogMethods: PropertyDescriptorMap;
let c: PageState;
let http: HttpTestingController;
let notify: Notify;
const messages: Record<string, string> = {
  'bsub.row.downgradeNotAllowed': 'Lowering is not available in self-service',
  'bsub.row.holdersExceed':
    '{{holders}} users hold roles in this app, but you chose {{seats}} seats.',
  'bsub.dunning.settleFirst': 'Settle the overdue invoice first',
  'bsub.operation.review': 'Under review by support',
  'bsub.operation.recover': 'Recover',
  'bsub.operation.startAgain': 'Start again',
  'bill.poll.stillProcessing': 'Still processing',
  'bill.poll.checkNow': 'Check now',
  'bill.common.retry': 'Retry',
  'bill.errors.notSaved': 'Not saved. Try again',
  'bill.errors.SUBSCRIPTION_PLAN_CHANGE_NOOP': 'No changes to apply',
  'bill.errors.COMMERCIAL_PRICE_UNAVAILABLE': 'Price unavailable',
  'bsub.receipt.settingUp': 'Setting up your apps',
  'bsub.preview.topUp': 'Top up {{amount}}',
  'bsub.preview.pricesChanged': 'Prices changed, preview again.',
};
function root(): HTMLElement {
  return fixture.nativeElement;
}
function request(path: string): TestRequest {
  return http.expectOne((r) => r.url === `${BASE}${path}`);
}
function catalogue(data = OFFERS, hasNext = false, page = 1): void {
  const req = request('/subscription/catalogue');
  req.flush({
    success: true,
    data,
    meta: {
      page,
      limit: 100,
      total: data.length,
      totalPages: hasNext ? 2 : page,
      hasNext,
      hasPrev: page > 1,
    },
  });
}
async function render(summary = SUMMARY): Promise<void> {
  fixture = TestBed.createComponent(ChangePage);
  c = fixture.componentInstance as unknown as PageState;
  respond(request('/subscription'), structuredClone(SUBSCRIPTION));
  catalogue();
  respond(request('/billing/summary'), summary);
  await tick();
  fixture.detectChanges();
  await tick(10);
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  await tick(10);
  fixture.detectChanges();
}
function row(): void {
  c['updateRow'](0, {
    kind: 'change-seats',
    selectionKey: '019f0000-0000-7000-8000-000000000001',
    targetKind: 'APPLICATION',
    targetId: 'item',
    newSeats: '4',
    locked: true,
  });
  if (!c['cart']().length)
    c['cart'].set([
      {
        kind: 'change-seats',
        selectionKey: '019f0000-0000-7000-8000-000000000001',
        targetKind: 'APPLICATION',
        targetId: 'item',
        newSeats: '4',
        locked: true,
      },
    ]);
}
function prepare(): TestRequest {
  row();
  void c['startReview']();
  return request('/subscription/preparations');
}
async function ready(value = preview()): Promise<void> {
  respond(prepare(), operation('READY'), 202);
  await tick();
  respond(request('/subscription/plan-change-previews'), value, 201);
  await tick();
  fixture.detectChanges();
  await tick(10);
  fixture.detectChanges();
}
function apply(): TestRequest {
  void c['confirmApply']();
  return request('/subscription/plan-change-previews/preview/apply');
}
async function terminal(state: CommercialOperation['state']): Promise<void> {
  const op = operation(state);
  op.safeReasonCode = 'COMMERCIAL_PRICE_UNAVAILABLE';
  respond(prepare(), op, 202);
  await tick();
  fixture.detectChanges();
  await tick(10);
  fixture.detectChanges();
}
function translate(): void {
  vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation(((
    key: string,
    params?: Record<string, unknown>,
  ) =>
    (messages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      String(params?.[name] ?? ''),
    )) as TranslocoService['translate']);
}

beforeEach(() => {
  dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
  vi.useFakeTimers();
  sessionStorage.clear();
  http = setupHttp([provideHttpClient(), provideHttpClientTesting()]);
  translate();
  notify = TestBed.inject(Notify);
  vi.spyOn(notify, 'error');
  vi.spyOn(TestBed.inject(Router), 'navigate');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    writable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    writable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    }),
  });
});
afterEach(() => {
  fixture?.destroy();
  http.verify();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
  for (const name of ['showModal', 'close']) {
    const descriptor = dialogMethods[name];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('subscription plan change HTTP contract', () => {
  it('prepare starts operation polling', async () => {
    await render();
    respond(prepare(), operation(), 202);
    await tick(1999);
    http.expectNone(`${BASE}/subscription/operations/op`);
    await tick(1);
    respond(request('/subscription/operations/op'), operation('READY'));
    await tick();
    respond(request('/subscription/plan-change-previews'), preview(), 201);
    await tick();
    expect(c['reviewPhase']()).toBe('quoted');
  });
  it('prepare retry reuses key and body', async () => {
    await render();
    const first = prepare();
    const body = JSON.stringify(first.request.body);
    const key = first.request.headers.get('x-idempotency-key');
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    fail(first, 0);
    await tick(400);
    const retry = request('/subscription/preparations');
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(JSON.stringify(retry.request.body)).toBe(body);
    fail(retry, 401);
    await tick();
    expect(c['step']()).toBe(1);
  });
  it('downgrade not allowed row message', async () => {
    await render();
    fail(prepare(), 403, 'DOWNGRADE_NOT_ALLOWED');
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(c['cart']()[0].serverError).toBe(messages['bsub.row.downgradeNotAllowed']);
    expect(root().textContent).toContain(messages['bsub.row.downgradeNotAllowed']);
  });
  it('seat holders exceed purchase row message', async () => {
    await render();
    fail(prepare(), 422, 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', {
      moduleKey: ['crm'],
      holders: ['7'],
      seats: ['4'],
    });
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(root().textContent).toContain('7 users hold roles in this app, but you chose 4 seats.');
  });
  it('seat free up required links to reduce', async () => {
    await render();
    fail(prepare(), 409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', {
      moduleKey: ['crm'],
      used: ['7'],
      target: ['4'],
      excess: ['3'],
    });
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(c['cart']()[0].serverError).toBeTruthy();
    expect(
      root().querySelector('a[href="/workspace/billing/subscription/seats/reduce?module=crm"]'),
    ).toBeTruthy();
  });
  it.each([
    [409, 'SUBSCRIPTION_PLAN_CHANGE_PAST_DUE'],
    [403, 'ACCESS_POLICY_BLOCKED'],
  ] as const)('past due prepare message %s %s', async (status, code) => {
    await render();
    fail(prepare(), status, code);
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(root().textContent).toContain('Settle the overdue invoice first');
    expect(root().querySelector('a[href="/workspace/billing/invoices"]')).toBeTruthy();
  });
  it.each([
    ['CANCELLED', 'cancelled'],
    ['PROVISIONING', 'provisioning'],
    ['COLLECTION_IN_PROGRESS', 'collection'],
    ['COLLECTION_OPEN', 'collection'],
  ])('plan change state notices %s', async (suffix, key) => {
    await render();
    fail(
      prepare(),
      409,
      suffix === 'COLLECTION_OPEN'
        ? 'SUBSCRIPTION_COLLECTION_OPEN'
        : `SUBSCRIPTION_PLAN_CHANGE_${suffix}`,
    );
    await tick();
    expect(c['noticeKey']()).toBe(`bsub.notice.${key}`);
  });
  it('noop change toast', async () => {
    await render();
    fail(prepare(), 422, 'SUBSCRIPTION_PLAN_CHANGE_NOOP');
    await tick();
    expect(notify.error).toHaveBeenCalledWith('No changes to apply');
  });
  it('stale revision reloads subscription', async () => {
    await render();
    fail(prepare(), 409, 'ADDON_PREPARATION_STALE');
    await tick();
    respond(request('/subscription'), { ...SUBSCRIPTION, subscriptionRevision: '32' });
    catalogue();
    respond(request('/billing/summary'), SUMMARY);
    await tick();
    expect(c['subscription']().subscriptionRevision).toBe('32');
    expect(c['preparedBody']).toBeNull();
    void c['startReview']();
    const req = request('/subscription/preparations');
    expect(req.request.body.expectedSubscriptionRevision).toBe('32');
    fail(req, 401);
    await tick();
  });
  it('payload too large text', async () => {
    await render();
    fail(prepare(), 413, 'COMMERCIAL_PAYLOAD_TOO_LARGE');
    await tick();
    expect(notify.error).toHaveBeenCalledWith('settings.errors.tooLarge');
    expect(c['step']()).toBe(1);
  });
  it('prepare 401 keeps cart and key', async () => {
    await render();
    const first = prepare();
    const key = first.request.headers.get('x-idempotency-key');
    fail(first, 401);
    await tick();
    expect(c['cart']()).toHaveLength(1);
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    void c['startReview']();
    const retry = request('/subscription/preparations');
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    fail(retry, 401);
    await tick();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('ready operation requests preview', async () => {
    await render();
    respond(prepare(), operation('READY'), 202);
    await tick();
    const quote = request('/subscription/plan-change-previews');
    expect(quote.request.body.preparationId).toBe('op');
    respond(quote, preview(), 201);
    await tick();
    expect(c['reviewPhase']()).toBe('quoted');
  });
  it('blocked operation offers recover', async () => {
    await render();
    await terminal('BLOCKED');
    expect(root().textContent).toContain('Recover');
    expect(root().textContent).toContain('Price unavailable');
    http.expectNone(`${BASE}/subscription/operations/op`);
  });
  it('needs review stops', async () => {
    await render();
    await terminal('NEEDS_REVIEW');
    expect(root().textContent).toContain('Under review by support');
    expect(root().textContent).not.toContain('Recover');
    await tick(60_000);
    http.expectNone(`${BASE}/subscription/operations/op`);
  });
  it('aborted offers start again', async () => {
    await render();
    await terminal('ABORTED');
    expect(root().textContent).toContain('Start again');
    c['startAgain']();
    expect(c['step']()).toBe(1);
  });
  it('operation poll window ends with check now', async () => {
    await render();
    respond(prepare(), operation(), 202);
    await tick();
    for (let i = 0; i < 60; i++) {
      await tick(i < 15 ? 2000 : 5000);
      respond(request('/subscription/operations/op'), operation());
      await tick();
    }
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(root().textContent).toContain('Still processing');
    expect(root().textContent).toContain('Check now');
    const check = c['checkOperation']();
    respond(request('/subscription/operations/op'), operation());
    await tick();
    await check;
    await tick(10_000);
    http.expectNone(`${BASE}/subscription/operations/op`);
  });
  it('recover resumes polling', async () => {
    await render();
    await terminal('BLOCKED');
    void c['recover']();
    const req = request('/subscription/operations/op/recovery');
    expect(req.request.body.action).toBe('RECONCILE');
    respond(req, operation(), 202);
    await tick(2000);
    respond(request('/subscription/operations/op'), operation('READY'));
    await tick();
    respond(request('/subscription/plan-change-previews'), preview(), 201);
    await tick();
    expect(c['reviewPhase']()).toBe('quoted');
  });
  it('stale recovery reloads operation', async () => {
    await render();
    await terminal('BLOCKED');
    void c['recover']();
    const first = request('/subscription/operations/op/recovery');
    const key = first.request.headers.get('x-idempotency-key');
    fail(first, 409, 'COMMERCIAL_RECOVERY_REVISION_STALE');
    await tick();
    respond(request('/subscription/operations/op'), operation('BLOCKED', '2'));
    await tick();
    http.expectNone(`${BASE}/subscription/operations/op/recovery`);
    expect(c['reviewPhase']()).toBe('blocked');
    void c['recover']();
    const next = request('/subscription/operations/op/recovery');
    expect(next.request.body.expectedOperationRevision).toBe('2');
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
    fail(next, 401);
    await tick();
  });
  it('preview shows server financials', async () => {
    await render();
    await ready();
    expect(root().textContent).toContain('USD 123.46');
    expect(root().textContent).toContain('USD 167.89');
    expect(root().textContent).toContain('USD 7.65');
    expect(c['remainingSeconds']()).toBeGreaterThan(0);
  });
  it('preview resends the frozen command', async () => {
    await render();
    row();
    c['reason'].set('Owner request');
    void c['startReview']();
    const req = request('/subscription/preparations');
    const json = JSON.stringify(req.request.body);
    expect(Object.isFrozen(req.request.body)).toBe(true);
    expect(Object.isFrozen(req.request.body.changes)).toBe(true);
    expect(Object.isFrozen(req.request.body.changes[0])).toBe(true);
    respond(req, operation('READY'), 202);
    await tick();
    const quoted = request('/subscription/plan-change-previews');
    const { preparationId, ...body } = quoted.request.body;
    expect(preparationId).toBe('op');
    expect(JSON.stringify(body)).toBe(json);
    expect(c['frozenBodyJson']).toBe(json);
    respond(quoted, preview(), 201);
    await tick();
  });
  it('wallet shortfall disables apply', async () => {
    await render();
    const value = preview();
    value.financial = {
      ...value.financial,
      canApply: true,
      walletStatus: 'ACTIVE',
      walletAvailableUsd: '0.0000',
      walletShortfallUsd: '0.1234',
    };
    await ready(value);
    expect(c['canConfirmApply']()).toBe(false);
    const link = root().querySelector<HTMLAnchorElement>(
      'a[href="/workspace/billing/overview?topup=1"]',
    );
    expect(link?.textContent).toContain('Top up USD 0.12');
    const confirm = Array.from(root().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('bsub.change.confirmBtn'),
    );
    expect(confirm?.disabled).toBe(true);
  });
  it.each(['SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE', 'SUBSCRIPTION_PLAN_CHANGE_PRICING_CHANGED', 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_PRICING_CHANGED'])(
    'pricing changed re-previews %s',
    async (code) => {
      await render();
      respond(prepare(), operation('READY'), 202);
      await tick();
      const first = request('/subscription/plan-change-previews');
      const body = first.request.body;
      const key = first.request.headers.get('x-idempotency-key');
      fail(first, 409, code);
      await tick();
      expect(c['noticeKey']()).toBe('bsub.preview.pricesChanged');
      void c['refreshQuote']();
      const next = request('/subscription/plan-change-previews');
      expect(next.request.body).toEqual(body);
      expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
      respond(next, preview(), 201);
      await tick();
    },
  );
  it('apply shows receipt and setup note', async () => {
    await render();
    await ready();
    const applied = receipt();
    respond(apply(), applied);
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(c['step']()).toBe(3);
    expect(root().textContent).toContain('Setting up your apps');
    expect(root().textContent).toContain('USD 167.89');
    expect(c['receipt']()).toEqual(applied);
    expect(TestBed.inject(AuthSession).ensureLoaded).not.toHaveBeenCalled();
  });
  it('apply body is an empty object', async () => {
    await render();
    await ready();
    const req = apply();
    expect(req.request.body).toEqual({});
    expect(req.request.detectContentTypeHeader()).toBe('application/json');
    respond(req, receipt());
    await tick();
  });
  it('expired preview re-previews', async () => {
    await render();
    await ready();
    fail(apply(), 409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED');
    await tick();
    const req = request('/subscription/plan-change-previews');
    expect(req.request.body.preparationId).toBe('op');
    respond(req, preview(), 201);
    await tick();
    expect(c['step']()).toBe(2);
    expect(c['reviewPhase']()).toBe('quoted');
  });
  it('already applied reads receipt', async () => {
    await render();
    await ready();
    fail(apply(), 409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED');
    await tick();
    respond(request('/subscription/plan-change-previews/preview/receipt'), receipt());
    await tick();
    expect(c['step']()).toBe(3);
  });
  it.each([0, 503])('lost apply response reads receipt %s', async (status) => {
    await render();
    await ready();
    const first = apply();
    const key = first.request.headers.get('x-idempotency-key');
    fail(first, status);
    await tick();
    http.expectNone(`${BASE}/subscription/plan-change-previews/preview/apply`);
    fail(
      request('/subscription/plan-change-previews/preview/receipt'),
      404,
      'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND',
    );
    await tick();
    const next = apply();
    expect(next.request.headers.get('x-idempotency-key')).toBe(key);
    respond(next, receipt());
    await tick();
    expect(c['step']()).toBe(3);
  });
  it.each([
    [422, 'WALLET_INSUFFICIENT'],
    [409, 'WALLET_INSUFFICIENT'],
    [409, 'WALLET_FROZEN'],
    [409, 'WALLET_NOT_ACTIVE'],
  ] as const)('apply wallet shortfall links to top up %s %s', async (status, code) => {
    await render();
    await ready();
    fail(apply(), status, code);
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    expect(root().querySelector('a[href="/workspace/billing/overview?topup=1"]')).toBeTruthy();
    expect(c['step']()).toBe(2);
  });
  it.each(['SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED', 'GW.IDEM.IN_FLIGHT'])(
    'apply key conflicts %s',
    async (code) => {
      await render();
      await ready();
      fail(apply(), 409, code);
      await tick();
      void c['confirmApply']();
      await tick(1000);
      http.expectNone(`${BASE}/subscription/plan-change-previews/preview/apply`);
      expect(c['canConfirmApply']()).toBe(false);
      expect(notify.error).toHaveBeenCalled();
    },
  );
  it('apply 401 keeps key', async () => {
    await render();
    await ready();
    const first = apply();
    const key = first.request.headers.get('x-idempotency-key');
    fail(first, 401);
    await tick();
    expect(c['step']()).toBe(2);
    expect(c['preview']()?.previewId).toBe('preview');
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    const next = apply();
    expect(next.request.headers.get('x-idempotency-key')).toBe(key);
    respond(next, receipt());
    await tick();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it.each([200, 404, 503])('receipt read states %s', async (status) => {
    await render();
    await ready();
    fail(apply(), 503);
    await tick();
    const req = request('/subscription/plan-change-previews/preview/receipt');
    if (status === 200) respond(req, receipt());
    else fail(req, status);
    await tick();
    fixture.detectChanges();
    await tick(10);
    fixture.detectChanges();
    if (status === 200) expect(c['step']()).toBe(3);
    else if (status === 404) expect(c['canConfirmApply']()).toBe(true);
    else {
      expect(c['canConfirmApply']()).toBe(false);
      c['remainingSeconds'].set(0);
      await c['refreshQuote']();
      http.expectNone(`${BASE}/subscription/plan-change-previews`);
      expect(root().textContent).toContain('Retry');
      void c['retryReceipt']();
      respond(request('/subscription/plan-change-previews/preview/receipt'), receipt());
      await tick();
      expect(c['step']()).toBe(3);
    }
  });
  it('subscription shows server money without arithmetic', async () => {
    await render();
    const value = preview();
    value.financial.nextRecurringUsd = '99999999999999.9999';
    value.financial.proratedAmountUsd = '0.1234';
    await ready(value);
    expect(root().textContent).toContain('USD 100,000,000,000,000');
    expect(root().textContent).toContain('USD 0.12');
  });
  it('cart edit discards frozen command and every key', async () => {
    await render();
    await ready();
    const body = c['preparedBody'];
    c['updateRow'](0, { ...c['cart']()[0], newSeats: '5' });
    expect(c['preparedBody']).toBeNull();
    expect(c['preview']()).toBeNull();
    expect(c['activeOperation']).toBeNull();
    expect(c['prepareCommand']).toBeNull();
    expect(c['quoteCommand']).toBeNull();
    expect(body.changes[0].seats).toBe(4);
  });
  it('catalogue loads all pages up to twenty', async () => {
    fixture = TestBed.createComponent(ChangePage);
    c = fixture.componentInstance as unknown as PageState;
    respond(request('/subscription'), SUBSCRIPTION);
    respond(request('/billing/summary'), SUMMARY);
    for (let page = 1; page <= 20; page++) {
      catalogue(OFFERS, page < 20, page);
      await tick();
    }
    http.expectNone((r) => r.url.endsWith('/catalogue'));
    expect(c['catalogueOffers']()).toHaveLength(20);
  });
  it('rejects an incomplete catalogue after twenty pages', async () => {
    fixture = TestBed.createComponent(ChangePage);
    c = fixture.componentInstance as unknown as PageState;
    respond(request('/subscription'), SUBSCRIPTION);
    respond(request('/billing/summary'), SUMMARY);
    for (let page = 1; page <= 20; page++) {
      catalogue(OFFERS, true, page);
      await tick();
    }
    http.expectNone((r) => r.url.endsWith('/catalogue'));
    expect(c['loadFailed']()).toBe(true);
    expect(c['catalogueOffers']()).toHaveLength(0);
    fixture.detectChanges();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
  });
  it('does not restore a discarded cart when recovery completes late', async () => {
    await render();
    await terminal('BLOCKED');
    void c['recover']();
    const recovery = request('/subscription/operations/op/recovery');
    c['updateRow'](0, { ...c['cart']()[0], newSeats: '5' });
    respond(recovery, operation('READY'), 202);
    await tick();
    expect(c['step']()).toBe(1);
    expect(c['activeOperation']).toBeNull();
    expect(c['preview']()).toBeNull();
    http.expectNone((r) => r.url.endsWith('/subscription/plan-change-previews'));
  });
  it('preview 401 keeps its command key', async () => {
    await render();
    respond(prepare(), operation('READY'), 202);
    await tick();
    const first = request('/subscription/plan-change-previews');
    const key = first.request.headers.get('x-idempotency-key');
    fail(first, 401);
    await tick();
    void c['refreshQuote']();
    const next = request('/subscription/plan-change-previews');
    expect(next.request.headers.get('x-idempotency-key')).toBe(key);
    respond(next, preview(), 201);
    await tick();
  });
  it('recover 401 keeps operation and key', async () => {
    await render();
    await terminal('BLOCKED');
    void c['recover']();
    const first = request('/subscription/operations/op/recovery');
    const key = first.request.headers.get('x-idempotency-key');
    const body = first.request.body;
    fail(first, 401);
    await tick();
    expect(c['reviewPhase']()).toBe('blocked');
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again');
    void c['recover']();
    const next = request('/subscription/operations/op/recovery');
    expect(next.request.headers.get('x-idempotency-key')).toBe(key);
    expect(next.request.body).toEqual(body);
    fail(next, 401);
    await tick();
  });
  it('late preview cannot restore a discarded cart command', async () => {
    await render();
    respond(prepare(), operation('READY'), 202);
    await tick();
    const req = request('/subscription/plan-change-previews');
    c['updateRow'](0, { ...c['cart']()[0], newSeats: '5' });
    respond(req, preview(), 201);
    await tick();
    expect(c['preview']()).toBeNull();
    expect(c['step']()).toBe(1);
  });
});
