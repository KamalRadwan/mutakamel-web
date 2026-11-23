import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Notify } from '../../../../../core/notify/notify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatsSection } from '../../seats/seats-section/seats-section';
import { SubscriptionPage } from './subscription-page';
import {
  BASE,
  SUBSCRIPTION,
  SUMMARY,
  setupHttp,
  respond,
  fail,
  tick,
} from '../subscription.spec-helpers';

@Component({ selector: 'app-seats-section', template: '' })
class SeatsStub {}
let fixture: ComponentFixture<SubscriptionPage>;
let c: Record<string, any>;
let http: HttpTestingController;
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  TestBed.overrideComponent(SubscriptionPage, {
    remove: { imports: [SeatsSection] },
    add: { imports: [SeatsStub] },
  });
  http = setupHttp([provideHttpClient(), provideHttpClientTesting()]);
});
afterEach(() => {
  fixture?.destroy();
  http.verify();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});
function create(): void {
  fixture = TestBed.createComponent(SubscriptionPage);
  c = fixture.componentInstance as unknown as Record<string, any>;
}
async function loaded(summary = SUMMARY): Promise<void> {
  create();
  respond(http.expectOne(`${BASE}/subscription`), SUBSCRIPTION);
  respond(http.expectOne(`${BASE}/billing/summary`), summary);
  await tick(1000);
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
}
function root(): HTMLElement {
  return fixture.nativeElement;
}
describe('subscription detail HTTP contract', () => {
  it('subscription detail renders server values', async () => {
    await loaded();
    expect(root().textContent).toContain('USD 123.46');
    expect(root().textContent).toContain('CRM');
    expect(c['subscription']().totals).toEqual(SUBSCRIPTION.totals);
    expect(c['subscription']().projection).toEqual(SUBSCRIPTION.projection);
  });
  it('no subscription empty state', async () => {
    create();
    fail(http.expectOne(`${BASE}/subscription`), 404, 'SUBSCRIPTION_NOT_FOUND');
    respond(http.expectOne(`${BASE}/billing/summary`), SUMMARY);
    await tick(1000);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    expect(root().textContent).toContain('bsub.empty.none');
    expect(root().querySelector('app-billing-failed')).toBeNull();
  });
  it('subscription non owner forbidden', async () => {
    create();
    fail(http.expectOne(`${BASE}/subscription`), 403, 'TENANT_OWNER_REQUIRED');
    respond(http.expectOne(`${BASE}/billing/summary`), SUMMARY);
    await tick(1000);
    fixture.detectChanges();
    expect(root().querySelector('app-billing-forbidden')).toBeTruthy();
  });
  it.each([
    [503, 'SUBSCRIPTION_READ_UNAVAILABLE'],
    [409, 'SUBSCRIPTION_READ_INCONSISTENT'],
    [0, 'NETWORK_ERROR'],
  ] as const)('subscription load failure %s', async (status, code) => {
    const notify = vi.spyOn(TestBed.inject(Notify), 'error');
    create();
    fail(http.expectOne(`${BASE}/subscription`), status, code);
    respond(http.expectOne(`${BASE}/billing/summary`), SUMMARY);
    await tick(1000);
    fixture.detectChanges();
    expect(root().querySelector('app-billing-failed button')).toBeTruthy();
    if (status === 0) expect(notify).toHaveBeenCalled();
    c['reload']();
    respond(http.expectOne(`${BASE}/subscription`), SUBSCRIPTION);
    respond(http.expectOne(`${BASE}/billing/summary`), SUMMARY);
    await tick(1000);
    expect(c['failed']()).toBe(false);
  });
  it('subscription read is bare', async () => {
    create();
    const req = http.expectOne(`${BASE}/subscription`);
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.body).toBeNull();
    expect(
      req.request.headers.keys().filter((key) => /^x-(idempotency-key|mutakamel-)/i.test(key)),
    ).toEqual([]);
    respond(req, SUBSCRIPTION);
    respond(http.expectOne(`${BASE}/billing/summary`), SUMMARY);
    await tick(1000);
  });
  it.each(['invoice', null])('change plan disabled while past due %s', async (invoiceId) => {
    await loaded({
      ...SUMMARY,
      subscription: { ...SUMMARY.subscription, accessMode: 'DUNNING' },
      outstandingInvoice: invoiceId
        ? ({ id: invoiceId } as NonNullable<typeof SUMMARY.outstandingInvoice>)
        : null,
    });
    expect(c['changeDisabled']()).toBe(true);
    expect(c['changeDisabledReasonKey']()).toBe('bsub.dunning.settleFirst');
    const button = root().querySelector<HTMLButtonElement>('button[uiButton]');
    expect(button?.disabled).toBe(true);
    expect(
      root().querySelector(`a[href="/workspace/billing/invoices${invoiceId ? '/invoice' : ''}"]`),
    ).toBeTruthy();
    expect(root().textContent).toContain('bsub.dunning.settleFirst');
  });
  it('reacts to owner changes from me without reloading the session', async () => {
    await loaded();
    const session = TestBed.inject(AuthSession);
    const me = session.me as ReturnType<typeof signal>;
    me.set({ isTenantOwner: false });
    fixture.detectChanges();
    expect(root().querySelector('app-billing-forbidden')).toBeTruthy();
    expect(session.ensureLoaded).not.toHaveBeenCalled();
  });
});
