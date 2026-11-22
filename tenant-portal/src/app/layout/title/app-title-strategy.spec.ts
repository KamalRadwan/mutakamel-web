import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { Translation, TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AppTitleStrategy, titleKeysFor } from './app-title-strategy';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    brand: 'Mutakamel',
    nav: {
      apps: { crm: 'CRM' },
      features: { home: 'Home', leads: 'Leads', settings: 'Settings' },
      pages: { crm: { settings: { pipelines: 'Pipelines' } } },
    },
    custom: { title: 'Custom page' },
  },
  ar: {
    brand: 'متكامل',
    nav: {
      apps: { crm: 'إدارة العملاء' },
      features: { home: 'الرئيسية', leads: 'العملاء المحتملون', settings: 'الإعدادات' },
      pages: { crm: { settings: { pipelines: 'مسارات البيع' } } },
    },
  },
};

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(TRANSLATIONS[lang] ?? {});
  }
}

@Component({ template: '' })
class Blank {}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Blank },
        { path: 'crm/leads', component: Blank },
        { path: 'crm/leads/:id', component: Blank },
        { path: 'crm/settings/pipelines', component: Blank },
        { path: 'crm/settings/pipelines/:id', component: Blank },
        { path: 'custom', title: 'custom.title', component: Blank },
        { path: '**', component: Blank },
      ]),
      { provide: TitleStrategy, useClass: AppTitleStrategy },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en' }, loader: Loader }),
    ],
  });
  const transloco = TestBed.inject(TranslocoService);
  transloco.setActiveLang('en');
  return { router: TestBed.inject(Router), title: TestBed.inject(Title), transloco };
}

describe('titleKeysFor', () => {
  it('orders page, feature and app keys from the URL', () => {
    expect(titleKeysFor('/')).toEqual(['nav.features.home']);
    expect(titleKeysFor('/workspace')).toEqual(['nav.features.home']);
    expect(titleKeysFor('/crm/settings/pipelines?tab=1')).toEqual([
      'nav.pages.crm.settings.pipelines',
      'nav.features.settings',
      'nav.apps.crm',
    ]);
    expect(titleKeysFor('/crm/leads/019a7c10')).toEqual(['nav.features.leads', 'nav.apps.crm']);
    expect(titleKeysFor('/crm/off/leads')).toEqual(['nav.apps.crm']);
    expect(titleKeysFor('/login')).toEqual([]);
  });
});

describe('AppTitleStrategy', () => {
  it('sets "<page> · <brand>" from the nav key and falls back to the feature on detail pages', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/crm/settings/pipelines');
    expect(title.getTitle()).toBe('Pipelines · Mutakamel');
    await router.navigateByUrl('/crm/settings/pipelines/42');
    expect(title.getTitle()).toBe('Pipelines · Mutakamel');
    await router.navigateByUrl('/crm/leads/42');
    expect(title.getTitle()).toBe('Leads · Mutakamel');
    await router.navigateByUrl('/');
    expect(title.getTitle()).toBe('Home · Mutakamel');
  });

  it('uses a route title as an i18n key and shows the brand alone when nothing resolves', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/custom');
    expect(title.getTitle()).toBe('Custom page · Mutakamel');
    await router.navigateByUrl('/unknown/path');
    expect(title.getTitle()).toBe('Mutakamel');
  });

  it('updates the title when the language changes', async () => {
    const { router, title, transloco } = setup();
    await router.navigateByUrl('/crm/leads');
    expect(title.getTitle()).toBe('Leads · Mutakamel');
    transloco.setActiveLang('ar');
    await new Promise((resolve) => setTimeout(resolve));
    expect(title.getTitle()).toBe('العملاء المحتملون · متكامل');
    transloco.setActiveLang('en');
    await new Promise((resolve) => setTimeout(resolve));
    expect(title.getTitle()).toBe('Leads · Mutakamel');
  });
});
