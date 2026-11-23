import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import globalAr from '../../../../../../../public/i18n/ar.json';
import catalogueEn from '../../../../../../../public/i18n/ws-billing-catalogue/en.json';
import catalogueAr from '../../../../../../../public/i18n/ws-billing-catalogue/ar.json';
import billingEn from '../../../../../../../public/i18n/ws-billing/en.json';
import billingAr from '../../../../../../../public/i18n/ws-billing/ar.json';
import settingsEn from '../../../../../../../public/i18n/settings/en.json';
import settingsAr from '../../../../../../../public/i18n/settings/ar.json';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Notify } from '../../../../../core/notify/notify';
import type { OfferLadder, SubscriptionOffer, SubscriptionView } from '../../billing.model';
import { CataloguePage } from './catalogue-page';

const BASE = '/api/tenant/core/v1/subscription';
const application = { id: 'app', key: 'crm', name: 'Server CRM', publicationVersionId: 'publication', definitionRevision: '1' };
const ladders: [OfferLadder, OfferLadder] = ['MONTHLY', 'ANNUAL'].map((billingCycle) => ({
  billingCycle, state: 'CONFIGURED', safeReasonCode: null,
  brackets: [{ minUsers: 1, maxUsers: null, unitPrice: '12.3456' }],
})) as [OfferLadder, OfferLadder];

function tier(key = 'starter', rank = 1): SubscriptionOffer {
  return { sourceKind: 'APPLICATION', application, ladders, status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED', tier: { id: key, key, name: `Server ${key}`, rank } };
}

function addon(status: SubscriptionOffer['status'] = 'PREPARATION_REQUIRED'): SubscriptionOffer {
  return { sourceKind: 'ADDON', application, ladders, status, safeReasonCode: 'PREPARATION_REQUIRED',
    addon: { id: 'addon', key: 'unknown_addon', name: 'Server add-on', definitionVersionId: 'definition',
      definitionVersion: '1', definitionRevision: '1', operationalRevision: '1',
      compatibility: { mode: 'ALLOWLIST', tierIds: ['pro'] } } };
}

function subscription(current = false): SubscriptionView {
  return {
    subscription: { id: 'sub', tenantId: 'tenant', allowedUsers: 5, status: 'ACTIVE', billingCycle: 'MONTHLY',
      currencyCode: 'USD', startedAt: '', currentPeriodStart: null, currentPeriodEnd: '', pendingPeriodStart: null,
      pendingPeriodEnd: null, trialDays: 0, trialStartedAt: null, trialEndsAt: null, activationScheduledAt: null,
      activatedAt: null, cancelAt: null, totalPrice: null, createdAt: '', updatedAt: '', currentCollectionInvoiceId: null },
    subscriptionRevision: '1',
    baseItems: current ? [{ id: 'base', applicationId: application.id, applicationKey: 'crm', applicationName: 'CRM',
      tierId: 'starter', tierKey: 'starter', tierName: 'Starter', tierRank: 1, seats: 5,
      acceptedPricing: { billingCycle: 'MONTHLY', currencyCode: 'USD', recurringAmountUsd: '60', priceRevision: '1', breakdown: [] } }] : [],
    addonSelections: [], baseAllowance: { allowedUsers: 5, effectiveAllowedUsers: 5, enabledApplications: [] },
    totals: { baseRecurringUsd: '0', addonRecurringUsd: '0', combinedRecurringUsd: '0' },
    projection: { observation: 'NOT_OBSERVED', state: null, safeReasonCode: 'TENANT_PROJECTION_NOT_OBSERVED' },
  };
}

describe('CataloguePage with BillingApi', () => {
  let fixture: ComponentFixture<CataloguePage>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const me = signal({ isTenantOwner: true });
  const root = (): HTMLElement => fixture.nativeElement;
  const text = (): string => root().textContent!.replace(/[\u2066\u2069]/g, '');

  beforeEach(() => {
    me.set({ isTenantOwner: true });
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [CataloguePage, TranslocoTestingModule.forRoot({
        langs: {
          en: { ...globalEn, bill: billingEn, bcat: catalogueEn, settings: settingsEn },
          ar: { ...globalAr, bill: billingAr, bcat: catalogueAr, settings: settingsAr },
          'ws-billing/en': billingEn, 'ws-billing/ar': billingAr,
          'ws-billing-catalogue/en': catalogueEn, 'ws-billing-catalogue/ar': catalogueAr,
          'settings/en': settingsEn, 'settings/ar': settingsAr,
        },
        translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        preloadLangs: true,
      })],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthSession, useValue: { me } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable(),
          snapshot: { queryParams: {}, queryParamMap: params.value } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    TestBed.resetTestingModule();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('dir');
  });

  function start(view = subscription()): void {
    fixture = TestBed.createComponent(CataloguePage);
    http.expectOne(BASE).flush({ success: true, data: view });
    fixture.detectChanges();
  }

  async function flushPage(offers: SubscriptionOffer[], page = 1, hasNext = false): Promise<void> {
    http.expectOne(`${BASE}/catalogue?page=${page}&limit=100`).flush({ success: true, data: offers,
      meta: { page, limit: 100, total: hasNext ? 2001 : offers.length, totalPages: hasNext ? 21 : page,
        hasNext, hasPrev: page > 1 } });
    // Advance the real CoreHttp and TanStack promises without waiting for a still-pending next page.
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  }

  async function render(): Promise<void> {
    await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fail(status: number, errorCode: string): void {
    http.expectOne(`${BASE}/catalogue?page=1&limit=100`).flush(
      { errorCode, correlationId: 'catalogue-ref' }, { status, statusText: 'Failure' },
    );
  }

  it('catalogue groups one page by app', async () => {
    start();
    await flushPage([addon(), tier(), { ...tier(), application: { ...application, id: 'trade', key: 'trade' } }]);
    await render();
    expect(root().querySelectorAll('app-offer-card')).toHaveLength(2);
    expect(fixture.componentInstance['groups']()[0].tiers).toHaveLength(1);
    expect(fixture.componentInstance['groups']()[0].addons).toHaveLength(1);
  });

  it('catalogue loads every page before grouping', async () => {
    start();
    await flushPage([addon()], 1, true);
    expect(fixture.componentInstance['groups']()).toEqual([]);
    await flushPage([tier()], 2);
    await render();
    expect(root().querySelectorAll('app-offer-card')).toHaveLength(1);
    expect(fixture.componentInstance['groups']()[0].tiers).toHaveLength(1);
    expect(fixture.componentInstance['groups']()[0].addons).toHaveLength(1);
  });

  it('catalogue request is bare', async () => {
    start();
    const req = http.expectOne(`${BASE}/catalogue?page=1&limit=100`);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    expect(req.request.headers.keys().filter((key) => /idempotency|mutakamel|^key$/i.test(key))).toEqual([]);
    req.flush({ success: true, data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1, hasNext: false, hasPrev: false } });
    await render();
  });

  it('catalogue stops at twenty pages', async () => {
    start();
    for (let page = 1; page <= 20; page += 1) await flushPage([tier()], page, true);
    await render();
    http.expectNone((req) => req.url === `${BASE}/catalogue`);
    expect(text()).toContain(catalogueEn.errors.tooLarge);
    expect(root().querySelector('app-offer-card')).toBeNull();
    expect(root().querySelector('button')?.textContent).toContain(billingEn.common.retry);
  });

  it('catalogue empty state', async () => {
    start();
    await flushPage([]);
    await render();
    expect(text()).toContain(catalogueEn.empty.none);
  });

  it('unavailable offer shown disabled', async () => {
    start();
    await flushPage([{ ...tier(), status: 'UNAVAILABLE', safeReasonCode: 'PRICE_UNAVAILABLE' }, addon('UNAVAILABLE')]);
    await render();
    expect(text()).toContain(catalogueEn.price.notSet);
    expect(root().querySelectorAll('app-offer-card button[disabled]')).toHaveLength(2);
    expect(root().querySelector('app-offer-card a')).toBeNull();
  });

  it('add-on without parent is not buyable', async () => {
    start(subscription(true));
    const blocked = addon('PARENT_REQUIRED');
    const incompatible = addon('INCOMPATIBLE');
    if (incompatible.sourceKind === 'ADDON') incompatible.addon = { ...incompatible.addon, id: 'incompatible' };
    await flushPage([blocked, incompatible, tier('pro', 2)]);
    await render();
    expect(root().querySelectorAll('app-offer-card section button[disabled]')).toHaveLength(2);
    expect(root().querySelector('app-offer-card section a')).toBeNull();
    expect(text()).toContain(billingEn.offerStatus.INCOMPATIBLE);
    expect(text()).toContain(billingEn.offerStatus.PARENT_REQUIRED.split('{{app}}')[0]);
  });

  it('buyable offer links to change', async () => {
    start(subscription(true));
    await flushPage([tier(), tier('pro', 2), addon()]);
    await render();
    const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('app-offer-card a'));
    expect(links.map((link) => link.pathname)).toEqual([
      '/workspace/billing/subscription/change', '/workspace/billing/subscription/change',
    ]);
    expect(links.map((link) => new URL(link.href).searchParams.get('add'))).toEqual([
      'tier:base:pro', 'addon:addon:definition:base',
    ]);
    expect(text()).toContain(catalogueEn.badges.current);
    expect(text()).toContain(catalogueEn.badges.subscribed);
  });

  it('starting price is the server string', async () => {
    start();
    const offer = { ...tier(), ladders: ladders.map((ladder) => ({ ...ladder,
      brackets: [{ minUsers: 1, maxUsers: null, unitPrice: '99999999999999.1234' }],
    })) as [OfferLadder, OfferLadder] };
    await flushPage([offer]);
    await render();
    expect(text()).toContain('Starting at USD 99,999,999,999,999.1234');
    const prices = Array.from(root().querySelectorAll<HTMLButtonElement>('app-offer-card button'))
      .find((button) => button.textContent?.trim() === catalogueEn.actions.prices)!;
    const dialog = root().querySelector('dialog')!;
    Object.defineProperty(dialog, 'showModal', { value: () => dialog.setAttribute('open', '') });
    prices.click();
    await render();
    expect(root().querySelector('app-price-ladder-modal')?.textContent).toContain('USD 99,999,999,999,999.1234');
  });

  it('unknown key falls back to server name', async () => {
    start();
    await flushPage([{ ...tier('unknown_tier'), application: { ...application, key: 'unknown_app', name: 'Server application' } }]);
    await render();
    expect(text()).toContain('Server application');
    expect(text()).toContain('Server unknown_tier');
  });

  it('catalogue non owner forbidden', async () => {
    start();
    fail(403, 'TENANT_OWNER_REQUIRED');
    await render();
    expect(root().querySelector('app-billing-forbidden')).not.toBeNull();
    expect(root().querySelector('app-offer-card')).toBeNull();
  });

  it('catalogue contract error load failure', async () => {
    start();
    fail(400, 'COMMERCIAL_CONTRACT_INVALID');
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(text()).toContain('catalogue-ref');
  });

  it('catalogue unavailable retry', async () => {
    start();
    await flushPage([tier()], 1, true);
    http.expectOne(`${BASE}/catalogue?page=2&limit=100`).flush(
      { errorCode: 'SUBSCRIPTION_CATALOGUE_UNAVAILABLE', correlationId: 'catalogue-ref' },
      { status: 503, statusText: 'Unavailable' },
    );
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(text()).toContain('catalogue-ref');
    root().querySelector<HTMLButtonElement>('app-billing-failed button')!.click();
    http.expectOne(BASE).flush({ success: true, data: subscription() });
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-offer-card')).not.toBeNull();
    expect(root().querySelector('app-billing-failed')).toBeNull();
  });

  it('catalogue offline', async () => {
    start();
    http.expectOne(`${BASE}/catalogue?page=1&limit=100`).error(new ProgressEvent('error'));
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(TestBed.inject(Notify).toasts()).toEqual([expect.objectContaining({
      type: 'error', pinned: true, title: settingsEn.errors.network,
    })]);
    root().querySelector<HTMLButtonElement>('app-billing-failed button')!.click();
    http.expectOne(BASE).flush({ success: true, data: subscription() });
    await flushPage([]);
    await render();
    expect(TestBed.inject(Notify).toasts()).toEqual([]);
  });

  it('catalogue without subscription marks only when the backend confirms no subscription', async () => {
    fixture = TestBed.createComponent(CataloguePage);
    http.expectOne(BASE).flush({ errorCode: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-offer-card')).not.toBeNull();
    expect(root().querySelector('app-billing-failed')).toBeNull();
    expect(fixture.componentInstance['groups']()[0].subscribed).toBe(false);
    expect(fixture.componentInstance['groups']()[0].tiers[0].current).toBe(false);
  });

  it.each([401, 404, 409, 503])('shows subscription HTTP %s failures instead of offering an empty plan', async (status) => {
    fixture = TestBed.createComponent(CataloguePage);
    http.expectOne(BASE).flush(
      { errorCode: 'SUBSCRIPTION_READ_UNAVAILABLE', correlationId: 'subscription-ref' },
      { status, statusText: 'Failed' },
    );
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(root().querySelector('app-offer-card')).toBeNull();
    expect(text()).toContain('subscription-ref');
  });

  it('shows forbidden when the real subscription read rejects owner access', async () => {
    fixture = TestBed.createComponent(CataloguePage);
    http.expectOne(BASE).flush({ errorCode: 'TENANT_OWNER_REQUIRED' }, { status: 403, statusText: 'Forbidden' });
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-billing-forbidden')).not.toBeNull();
    expect(root().querySelector('app-offer-card')).toBeNull();
  });

  it('shows a failure when a successful subscription response contains an items-only projection', async () => {
    fixture = TestBed.createComponent(CataloguePage);
    const view = subscription(true);
    http.expectOne(BASE).flush({ success: true, data: {
      subscriptionId: view.subscription.id,
      subscriptionRevision: view.subscriptionRevision,
      baseItems: view.baseItems,
      addonSelections: view.addonSelections,
    } });
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(root().querySelector('app-offer-card')).toBeNull();
  });

  it('shows the network failure state when the subscription read is offline', async () => {
    fixture = TestBed.createComponent(CataloguePage);
    http.expectOne(BASE).error(new ProgressEvent('error'));
    await flushPage([tier()]);
    await render();
    expect(root().querySelector('app-billing-failed')).not.toBeNull();
    expect(root().querySelector('app-offer-card')).toBeNull();
    expect(TestBed.inject(Notify).toasts()).toEqual([expect.objectContaining({ type: 'error', pinned: true })]);
  });

  it('catalogue search is local', async () => {
    start();
    await flushPage([tier(), { ...tier(), application: { ...application, id: 'trade', key: 'trade' } }]);
    await render();
    params.next(convertToParamMap({ app: 'trade' }));
    await render();
    expect(fixture.componentInstance['visibleGroups']().map((group) => group.application.key)).toEqual(['trade']);
    expect(root().querySelectorAll('app-offer-card')).toHaveLength(1);
    http.expectNone(() => true);
  });

  it('page twenty succeeds when it is the last page, including empty intermediate pages', async () => {
    start();
    for (let page = 1; page < 20; page += 1) await flushPage([], page, true);
    await flushPage([tier()], 20);
    await render();
    expect(root().querySelector('app-billing-failed')).toBeNull();
    expect(root().querySelector('app-offer-card')).not.toBeNull();
  });

  it('price safe reasons disable otherwise buyable offers', async () => {
    start();
    const raw = { ...tier(), safeReasonCode: 'PRICE_NOT_CONFIGURED' };
    // The wire contract includes PRICE_NOT_CONFIGURED; the shared OfferReason union currently omits it.
    await flushPage([raw as SubscriptionOffer, { ...addon(), safeReasonCode: 'PRICE_UNAVAILABLE' }]);
    await render();
    expect(root().querySelectorAll('app-offer-card button[disabled]')).toHaveLength(2);
    expect(root().querySelector('app-offer-card a')).toBeNull();
  });

  it.each(['en', 'ar'] as const)('catalogue renders %s in both themes and switches language live', async (lang) => {
    start();
    await flushPage([tier(), { ...addon(), status: 'UNAVAILABLE' }]);
    const t = TestBed.inject(TranslocoService);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      t.setActiveLang(lang);
      await render();
      const copy = lang === 'ar' ? catalogueAr : catalogueEn;
      expect(text()).toContain(copy.price.startingAt.replace('{{price}}', 'USD 12.3456'));
      expect(text()).toContain(copy.price.notSet);
      expect(text()).not.toMatch(/bcat\.|bill\./);
    }
    t.setActiveLang(lang === 'ar' ? 'en' : 'ar');
    await render();
    expect(text()).toContain((lang === 'ar' ? catalogueEn : catalogueAr).price.notSet);
  });

  it('non owner does not request catalogue or subscription', async () => {
    me.set({ isTenantOwner: false });
    fixture = TestBed.createComponent(CataloguePage);
    await render();
    expect(root().querySelector('app-billing-forbidden')).not.toBeNull();
    http.expectNone(() => true);
  });
});
