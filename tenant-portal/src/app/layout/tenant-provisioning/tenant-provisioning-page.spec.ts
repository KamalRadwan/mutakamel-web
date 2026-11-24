import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { vi } from 'vitest';
import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { TenantProvisioningPage } from './tenant-provisioning-page';

it.each(['ar', 'en'] as const)('describes setup and announces a pending retry in %s', (lang) => {
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
  const fixture = TestBed.createComponent(TenantProvisioningPage);
  const host: HTMLElement = fixture.nativeElement;
  const retry = vi.fn();
  fixture.componentInstance.retryRequested.subscribe(retry);
  fixture.detectChanges();
  const copy = langs[lang].errors.provisioning;
  const button = host.querySelector<HTMLButtonElement>('[data-status-action]')!;
  expect(host.querySelector('h1')?.textContent?.trim()).toBe(copy.title);
  expect(host.querySelector('h1 + p')?.textContent?.trim()).toBe(copy.text);
  expect(button.textContent?.trim()).toBe(copy.retry);
  button.click();
  expect(retry).toHaveBeenCalledTimes(1);
  fixture.componentRef.setInput('checking', true);
  fixture.detectChanges();
  expect(button.disabled).toBe(true);
  expect(host.querySelector('[role="status"]')?.textContent?.trim()).toBe(copy.checking);
  button.click();
  expect(retry).toHaveBeenCalledTimes(1);
});
