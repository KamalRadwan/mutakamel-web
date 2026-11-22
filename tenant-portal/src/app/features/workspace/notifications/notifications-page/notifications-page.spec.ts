import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import wsEn from '../../../../../../public/i18n/ws-notifications/en.json';
import wsAr from '../../../../../../public/i18n/ws-notifications/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import { NOTIFICATION_INBOX_PAGE_SIZE } from '../../../../shared/widgets/notifications/notification-inbox';
import {
  getNotification,
  getUnreadNotificationCount,
  listNotifications,
} from '../../../../shared/widgets/notifications/notifications.api';
import {
  resetFakeNotifications,
  setFakeNotificationError,
  setFakeNotificationUserInactive,
} from '../../../../shared/widgets/notifications/notifications.fake';
import { notificationsRoutes } from '../notifications.routes';
import { NotificationsPage } from './notifications-page';

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path === 'en') return of(en as Translation);
    if (path === 'ar') return of(ar as Translation);
    if (path === 'ws-notifications/en') return of(wsEn as Translation);
    if (path === 'ws-notifications/ar') return of(wsAr as Translation);
    return of({});
  }
}

@Component({ selector: 'test-leads-target', template: '<p>Leads</p>' })
class DummyLeadsTarget {}

async function until(check: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

describe('NotificationsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    resetFakeNotifications();
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
    setFakeNotificationError(null);
    setFakeNotificationUserInactive(false);
    localStorage.clear();
  });

  async function openPage(url = '/workspace/notifications', pageSize = 20) {
    TestBed.configureTestingModule({
      providers: [
        { provide: NOTIFICATION_INBOX_PAGE_SIZE, useValue: pageSize },
        provideRouter([
          { path: 'workspace/notifications', children: notificationsRoutes },
          { path: 'crm/leads', component: DummyLeadsTarget },
        ]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestLoader,
        }),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, NotificationsPage);
    const router = TestBed.inject(Router);
    const notify = TestBed.inject(Notify);
    const el = harness.routeNativeElement!;
    await until(() => el.querySelectorAll('app-notification-item').length > 0 || el.querySelector('ui-full-state') !== null);
    harness.detectChanges();
    return { harness, page, router, notify, el };
  }

  it('shows All without a count, Unread with count, and switches tabs via ?tab query param', async () => {
    const { harness, router, el } = await openPage();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent?.trim()).toBe('All');
    expect(tabs[1].textContent).toContain('Unread');
    expect(tabs[1].textContent).toContain('4');

    // Only P1_HIGH gets the inline Acknowledge button on the list.
    const ackButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('app-notification-item button')).filter((b) =>
      b.textContent?.includes('Acknowledge'),
    );
    expect(ackButtons).toHaveLength(1);

    tabs[1].click();
    harness.detectChanges();
    await until(() => el.querySelectorAll('app-notification-item').length === 4);
    harness.detectChanges();

    expect(router.url).toContain('tab=unread');
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(4);

    tabs[0].click();
    harness.detectChanges();
    await until(() => el.querySelectorAll('app-notification-item').length === 8);
    harness.detectChanges();
    expect(router.url).toBe('/workspace/notifications');
  });

  it('shows empty state when all items are dismissed or unread is empty', async () => {
    const { harness, el } = await openPage();
    const markAllBtn = Array.from(el.querySelectorAll('header button')).find((b) =>
      b.textContent?.includes('Mark all as read'),
    ) as HTMLButtonElement;
    markAllBtn.click();
    harness.detectChanges();
    await until(async () => (await getUnreadNotificationCount()).unreadCount === 0);

    const unreadTab = el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1];
    unreadTab.click();
    harness.detectChanges();
    await until(() => el.textContent?.includes(en.notifications.emptyUnread) ?? false);
    expect(el.textContent).toContain(en.notifications.emptyUnread);

    const allTab = el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0];
    allTab.click();
    harness.detectChanges();
    await until(() => el.querySelectorAll('app-notification-item').length === 8);
    for (let i = 0; i < 8; i++) {
      const dismissBtn = el.querySelector<HTMLButtonElement>('app-notification-item button[aria-label="Dismiss notification"]')!;
      dismissBtn.click();
      harness.detectChanges();
    }
    await until(() => el.textContent?.includes(en.notifications.empty) ?? false);
    expect(el.textContent).toContain(en.notifications.empty);
    await until(async () => (await listNotifications()).items.length === 0);
  });

  it('renders load-failure state and recovers on Retry', async () => {
    setFakeNotificationError(new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
    const { harness, el } = await openPage();

    expect(el.querySelector('ui-full-state')?.textContent).toContain(wsEn.loadFailed.title);
    setFakeNotificationError(null);
    const retryBtn = el.querySelector<HTMLButtonElement>('ui-full-state button')!;
    retryBtn.click();
    harness.detectChanges();

    await until(() => el.querySelectorAll('app-notification-item').length === 8);
    expect(el.querySelector('ui-full-state')).toBeNull();
  });

  it('renders unavailable state without action when recipient is missing', async () => {
    setFakeNotificationUserInactive(true);
    const { el } = await openPage();

    const fullState = el.querySelector('ui-full-state')!;
    expect(fullState.textContent).toContain(wsEn.unavailable.title);
    expect(fullState.querySelector('button')).toBeNull();
  });

  it('keeps loaded items and shows an error toast when loadMore fails', async () => {
    const { harness, notify, el } = await openPage('/workspace/notifications', 2);
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(2);

    setFakeNotificationError(new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
    const loadMoreBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(en.notifications.loadMore),
    )!;
    loadMoreBtn.click();
    await until(() => notify.toasts().some((t) => t.title === en.notifications.loadError));
    harness.detectChanges();

    expect(el.querySelectorAll('app-notification-item')).toHaveLength(2);
  });

  it('navigates to ./<id> when actionUrl is missing or unregistered, and follows registered routes', async () => {
    const { harness, router, el } = await openPage();
    const openButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('app-notification-item button')).filter(
      (b) => b.textContent?.includes('Follow-up call due') || b.textContent?.includes('New lead assigned'),
    );

    // Item #1 has unregistered /workspace/operations/activities -> opens detail child route
    openButtons[0].click();
    await until(() => router.url === '/workspace/notifications/019a7c10-0001-7000-8000-000000000001');
    harness.detectChanges();
    await until(() => el.querySelector('dialog[open]') !== null);
    await until(async () => (await getNotification('019a7c10-0001-7000-8000-000000000001')).readAt !== null);

    // Navigate back to list and open item #2 (/crm/leads, registered)
    await harness.navigateByUrl('/workspace/notifications');
    await until(() => el.querySelectorAll('app-notification-item').length > 0);
    harness.detectChanges();
    const leadBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('app-notification-item button')).find((b) =>
      b.textContent?.includes('New lead assigned'),
    )!;
    leadBtn.click();
    await until(() => router.url === '/crm/leads');
    await until(async () => (await getNotification('019a7c10-0002-7000-8000-000000000002')).readAt !== null);
  });
});
