import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { TenantUnavailablePage } from './tenant-unavailable-page';

it.each(['ar', 'en'] as const)('explains the removed workspace with its address and support note in %s', (lang) => {
  const langs = { ar, en };
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs,
        translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: lang },
      }),
    ],
  });
  localStorage.setItem('lang', lang);
  const fixture = TestBed.createComponent(TenantUnavailablePage);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const copy = langs[lang].errors.tenantUnavailable;
  expect(host.querySelector('h1')?.textContent?.trim()).toBe(copy.title);
  expect(host.querySelector('h1 + p')?.textContent?.trim()).toBe(copy.text);
  const notes = [...host.querySelectorAll('li')].map((li) => li.textContent?.trim());
  expect(notes).toContain(location.host);
  expect(notes).toContain(copy.support);
  expect(host.querySelector('[dir="ltr"]')?.textContent?.trim()).toBe(location.host);
  expect(host.querySelector('[data-status-action]')?.textContent?.trim()).toBe(copy.retry);
});
