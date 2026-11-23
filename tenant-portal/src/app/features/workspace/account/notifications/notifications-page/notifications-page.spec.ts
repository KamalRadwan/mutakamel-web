import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
  type Translation,
} from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/en.json';
import ar from '../../../../../../../public/i18n/ar.json';
import wsEn from '../../../../../../../public/i18n/ws-account-notifications/en.json';
import wsAr from '../../../../../../../public/i18n/ws-account-notifications/ar.json';
import { Notify } from '../../../../../core/notify/notify';
import { NOTIFICATION_TYPES } from '../notifications.model';
import { NotificationsPage } from './notifications-page';

const BASE = '/api/tenant/core/v1/notifications/preferences';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(
      (
        {
          en,
          ar,
          'ws-account-notifications/en': wsEn,
          'ws-account-notifications/ar': wsAr,
        } as Record<string, Translation>
      )[path] ?? {},
    );
  }
}

describe('Account notification preferences on CoreHttp', () => {
  let http: HttpTestingController;
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    connectionLost: vi.fn(),
    connectionRestored: vi.fn(),
  };
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: Loader,
        }),
        { provide: Notify, useValue: notify },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TranslocoService).setTranslation({ ...en, wsAccNotif: wsEn }, 'en');
    TestBed.inject(TranslocoService).setTranslation({ ...ar, wsAccNotif: wsAr }, 'ar');
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
  });

  async function setup(rows: unknown[] = []) {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne(BASE).flush({ success: true, data: rows });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function firstSwitch(el: HTMLElement) {
    return el.querySelector<HTMLButtonElement>('button[role="switch"]')!;
  }

  it('preferences fill missing types as on', async () => {
    const { el } = await setup([
      {
        notificationType: 'core.activity.assigned',
        inAppEnabled: false,
        updatedAt: '2026-11-23T10:00:00Z',
      },
    ]);
    const toggles = el.querySelectorAll('[role="switch"]');
    expect(toggles).toHaveLength(8);
    expect(toggles[0].getAttribute('aria-checked')).toBe('false');
    expect(
      Array.from(toggles)
        .slice(1)
        .every((toggle) => toggle.getAttribute('aria-checked') === 'true'),
    ).toBe(true);
  });

  it.each([500, 0])('preferences load failure (%s)', async (status) => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    const request = http.expectOne(BASE);
    if (status) request.flush({}, { status, statusText: 'Server error' });
    else request.error(new ProgressEvent('error'));
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(wsEn.loadFailed);
    if (!status)
      expect(notify.connectionLost).toHaveBeenCalledWith(
        en.session.connectionLost.title,
        en.session.connectionLost.text,
      );
    el.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne(BASE).flush({ success: true, data: [] });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelectorAll('[role="switch"]')).toHaveLength(8);
  });

  it('toggle saves one type', async () => {
    const { fixture, el } = await setup();
    firstSwitch(el).click();
    fixture.detectChanges();
    const request = http.expectOne(BASE);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      notificationType: NOTIFICATION_TYPES[0],
      inAppEnabled: false,
    });
    request.flush({
      success: true,
      data: { ...request.request.body, updatedAt: '2026-11-23T10:00:00Z' },
    });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(firstSwitch(el).getAttribute('aria-checked')).toBe('false');
    expect(notify.success).toHaveBeenCalledWith(wsEn.toast.saved);
  });

  it('toggle sends key and csrf', async () => {
    const { fixture, el } = await setup();
    firstSwitch(el).click();
    fixture.detectChanges();
    const request = http.expectOne(BASE);
    const key = request.request.headers.get('x-idempotency-key');
    expect(key).toMatch(UUID_V7);
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(request.request.withCredentials).toBe(true);
    request.flush({}, { status: 500, statusText: 'Server error' });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    firstSwitch(el).click();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    http.expectNone(BASE);
    expect(firstSwitch(el).getAttribute('aria-checked')).toBe('true');
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; path=/';
    firstSwitch(el).click();
    fixture.detectChanges();
    const next = http.expectOne(BASE);
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
    next.flush({ success: true, data: { ...next.request.body, updatedAt: 'now' } });
    await settle();
    await fixture.whenStable();
  });

  it('unknown type reverts toggle', async () => {
    const { fixture, el } = await setup();
    firstSwitch(el).click();
    fixture.detectChanges();
    http
      .expectOne(BASE)
      .flush(
        { errorCode: 'NOTIFICATION_TYPE_UNKNOWN' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(firstSwitch(el).getAttribute('aria-checked')).toBe('true');
    expect(notify.error).toHaveBeenCalledWith(wsEn.errors.NOTIFICATION_TYPE_UNKNOWN);
  });

  it('toggle 401 reverts without navigation', async () => {
    const { fixture, el } = await setup();
    firstSwitch(el).click();
    fixture.detectChanges();
    http
      .expectOne(BASE)
      .flush({ code: 'GW.AUTH.UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(firstSwitch(el).getAttribute('aria-checked')).toBe('true');
    expect(notify.error).toHaveBeenCalledWith(wsEn.errors.notSaved);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'GW.IDEM.IN_FLIGHT', en.apiErrors.idempotency],
    [429, 'GW.RATE.LIMIT_EXCEEDED', en.apiErrors.rateLimited],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR', en.apiErrors.generic],
  ])('toggle failures revert (%s)', async (status, code, message) => {
    const { fixture, el } = await setup();
    firstSwitch(el).click();
    fixture.detectChanges();
    http.expectOne(BASE).flush({ code }, { status, statusText: 'Failed' });
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(firstSwitch(el).getAttribute('aria-checked')).toBe('true');
    expect(notify.error).toHaveBeenCalledWith(message);
  });

  it('preferences hint mentions new notifications', async () => {
    const { fixture, el } = await setup();
    expect(el.textContent).toContain('Applies to new notifications.');
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain(wsAr.footer);
    http.expectNone(BASE);
  });
  it.each([
    ['en', 'light'],
    ['en', 'dark'],
    ['ar', 'light'],
    ['ar', 'dark'],
  ])('renders all eight toggles and hints in %s %s', async (lang, theme) => {
    const previousTheme = document.documentElement.dataset['theme'];
    const previousDirection = document.documentElement.dir;
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    TestBed.inject(TranslocoService).setActiveLang(lang);
    try {
      const { el } = await setup();
      const dict = lang === 'ar' ? wsAr : wsEn;
      expect(el.querySelectorAll('[role="switch"]')).toHaveLength(8);
      expect(el.textContent).toContain(dict.footer);
      expect(el.querySelectorAll('ui-field')).toHaveLength(8);
      for (const toggle of el.querySelectorAll('[role="switch"]')) {
        expect(toggle.getAttribute('aria-label')).toBeTruthy();
        expect(toggle.getAttribute('aria-describedby')).toBeTruthy();
      }
    } finally {
      if (previousTheme === undefined) delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = previousTheme;
      document.documentElement.dir = previousDirection;
    }
  });
});
