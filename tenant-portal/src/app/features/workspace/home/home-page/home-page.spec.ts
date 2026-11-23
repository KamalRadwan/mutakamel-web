import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import homeAr from '../../../../../../public/i18n/home/ar.json';
import homeEn from '../../../../../../public/i18n/home/en.json';
import { LanguageState } from '../../../../core/i18n/language';
import type { AppsOverviewItem } from '../modules.model';
import { HomePage } from './home-page';

const OVERVIEW = '/api/tenant/core/v1/apps/overview';

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path === 'home/en') return of(homeEn as Translation);
    if (path === 'home/ar') return of(homeAr as Translation);
    return of({});
  }
}

function app(moduleKey: string, group: AppsOverviewItem['group'], extra: Partial<AppsOverviewItem> = {}): AppsOverviewItem {
  return {
    moduleKey,
    nameI18n: { en: `${moduleKey} en`, ar: `${moduleKey} ar` },
    iconKey: null,
    group,
    isAddon: false,
    myAccessState: null,
    seats: null,
    ...extra,
  };
}

function startHome() {
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return fixture;
}

async function render(items: AppsOverviewItem[]): Promise<HTMLElement> {
  const fixture = startHome();
  const request = TestBed.inject(HttpTestingController).expectOne({ method: 'GET', url: OVERVIEW });
  expect(request.request.withCredentials).toBe(true);
  request.flush({ success: true, data: { items } });
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function section(root: HTMLElement, group: string): HTMLElement | null {
  return root.querySelector(`section[aria-labelledby="home-section-${group}"]`);
}

function cardNames(root: HTMLElement, group: string): string[] {
  return Array.from(section(root, group)?.querySelectorAll('app-app-card h3') ?? [], (h) => h.textContent.trim());
}

describe('HomePage on the apps overview', () => {
  let languageBefore: { stored: string | null; lang: string; dir: string };
  beforeEach(() => {
    languageBefore = { stored: localStorage.getItem('lang'), lang: document.documentElement.lang, dir: document.documentElement.dir };
    localStorage.removeItem('home.future.collapsed');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestLoader,
        }),
      ],
    });
    TestBed.inject(LanguageState).current.set('en');
  });

  afterEach(() => {
    try { TestBed.inject(HttpTestingController).verify(); }
    finally {
      TestBed.resetTestingModule();
      if (languageBefore.stored === null) localStorage.removeItem('lang');
      else localStorage.setItem('lang', languageBefore.stored);
      document.documentElement.lang = languageBefore.lang;
      document.documentElement.dir = languageBefore.dir;
    }
  });

  it.each([
    ['en', 'ltr', 'Your apps', 'Add to your workspace', 'Coming soon', ['Point of Sale', 'Projects', 'Helpdesk']],
    ['ar', 'rtl', 'تطبيقاتك', 'أضِف إلى مساحة عملك', 'قريبًا', ['نقاط البيع', 'المشاريع', 'مكتب المساعدة']],
  ] as const)('renders distinct Core and static cards in %s', async (language, dir, subscribed, available, future, names) => {
    TestBed.inject(LanguageState).current.set(language);
    const root = await render([
      app('trade', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('crm', 'AVAILABLE'),
      app('pos', 'AVAILABLE'),
      app('projects', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('helpdesk', 'FUTURE'),
      app('hr', 'FUTURE'),
      app('crm', 'AVAILABLE'),
    ]);
    expect(document.documentElement.dir).toBe(dir);
    expect(section(root, 'subscribed')?.querySelector('h2')?.textContent.trim()).toBe(subscribed);
    expect(section(root, 'available')?.querySelector('h2')?.textContent.trim()).toBe(available);
    expect(section(root, 'future')?.querySelector('h2')?.textContent.trim()).toBe(future);
    expect(cardNames(root, 'subscribed')).toEqual([`trade ${language}`]);
    expect(cardNames(root, 'available')).toEqual([`crm ${language}`]);
    expect(cardNames(root, 'future')).toEqual(names);
    expect(section(root, 'available')?.querySelectorAll('app-app-card a, app-app-card button')).toHaveLength(0);
    expect(section(root, 'future')?.querySelectorAll('app-app-card a, app-app-card button')).toHaveLength(0);
  });

  it('renders useful empty states with static cards when Core returns no apps', async () => {
    const root = await render([]);
    expect(section(root, 'subscribed')?.textContent).toContain(homeEn.sections.subscribed.empty);
    expect(section(root, 'available')?.textContent).toContain(homeEn.sections.available.empty);
    expect(cardNames(root, 'future')).toEqual(['Point of Sale', 'Projects', 'Helpdesk']);
  });

  it('preserves loading and retry without showing subscriptions on a failed request', async () => {
    const fixture = startHome();
    const root: HTMLElement = fixture.nativeElement;
    const http = TestBed.inject(HttpTestingController);
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(cardNames(root, 'future')).toHaveLength(3);
    http.expectOne(OVERVIEW).flush(null, { status: 503, statusText: 'Service unavailable' });
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(homeEn.error.text);
    expect(section(root, 'subscribed')).toBeNull();
    expect(section(root, 'available')).toBeNull();
    expect(cardNames(root, 'future')).toHaveLength(3);

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    http.expectOne(OVERVIEW).flush({ success: true, data: { items: [app('crm', 'SUBSCRIBED')] } });
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(cardNames(root, 'subscribed')).toEqual(['crm en']);
  });

  it('uses the seat and access states returned by Core and only links to a launch route', async () => {
    const root = await render([
      app('crm', 'SUBSCRIBED', { myAccessState: 'OVER_CAPACITY', seats: { used: 6, total: 5 } }),
      app('trade', 'SUBSCRIBED', { myAccessState: 'ACTIVE' }),
      app('accounting', 'SUBSCRIBED'),
      app('crm.email', 'SUBSCRIBED', { myAccessState: 'ACTIVE', isAddon: true }),
    ]);
    const [crm, trade, accounting, addon] = [...section(root, 'subscribed')!.querySelectorAll('app-app-card')];
    expect(crm.textContent).toContain('6 / 5 users');
    expect(crm.textContent).toContain(homeEn.badges.overCapacity);
    expect(crm.querySelector('a')?.getAttribute('href')).toBe('/crm/dashboard');
    expect(trade.querySelector('a')?.getAttribute('href')).toBe('/trade/dashboard');
    expect(trade.textContent).toContain(homeEn.badges.active);
    expect(trade.textContent).not.toContain('users');
    expect(accounting.querySelector('a')).toBeNull();
    expect(accounting.textContent).toContain(homeEn.badges.noAccess);
    expect(addon.querySelector('a')).toBeNull();
    expect(addon.textContent).toContain(homeEn.badges.active);
    expect(addon.textContent).toContain(homeEn.badges.addon);
  });
});
