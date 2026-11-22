import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import wsEn from '../../../../public/i18n/ws-notifications/en.json';
import { resetFakeNotifications } from '../../shared/widgets/notifications/notifications.fake';
import { NotificationBell } from './notification-bell';

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path === 'en') return of(en as Translation);
    if (path === 'ws-notifications/en') return of(wsEn as Translation);
    return of({});
  }
}

@Component({ selector: 'test-target', template: '' })
class Target {}

async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeNotifications();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'workspace/notifications', component: Target },
          { path: 'workspace/notifications/:id', component: Target },
        ]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestLoader,
        }),
      ],
    });
  });

  async function openPanel() {
    const fixture = TestBed.createComponent(NotificationBell);
    const el: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    (el.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    await until(() => {
      fixture.detectChanges();
      return el.querySelectorAll('app-notification-item').length > 0;
    });
    return { fixture, el, router: TestBed.inject(Router) };
  }

  it('renders rows with the shared item and links "View all" to the inbox page', async () => {
    const { fixture, el, router } = await openPanel();
    const viewAll = el.querySelector('a[href="/workspace/notifications"]') as HTMLAnchorElement;
    expect(viewAll).not.toBeNull();
    expect(viewAll.textContent?.trim()).toBe(en.notifications.viewAll);
    viewAll.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/workspace/notifications');
    expect(el.querySelector('section[role="dialog"]')).toBeNull();
  });

  it('opens the detail modal route for an item without a followable link', async () => {
    const { fixture, el, router } = await openPanel();
    const firstOpen = el.querySelector('app-notification-item button') as HTMLButtonElement;
    firstOpen.click();
    await until(() => router.url.startsWith('/workspace/notifications/'));
    fixture.detectChanges();
    expect(router.url).toMatch(/^\/workspace\/notifications\/[0-9a-f-]{36}$/);
    expect(el.querySelector('section[role="dialog"]')).toBeNull();
  });
});
