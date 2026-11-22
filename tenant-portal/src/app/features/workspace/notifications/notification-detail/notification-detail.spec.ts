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
import { Notify } from '../../../../core/notify/notify';
import { NOTIFICATION_INBOX_PAGE_SIZE } from '../../../../shared/widgets/notifications/notification-inbox';
import { getNotification } from '../../../../shared/widgets/notifications/notifications.api';
import { resetFakeNotifications } from '../../../../shared/widgets/notifications/notifications.fake';
import { notificationsRoutes } from '../notifications.routes';

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

describe('NotificationDetail', () => {
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
    localStorage.clear();
  });

  async function openAt(url: string, pageSize = 20) {
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
    await harness.navigateByUrl(url);
    const router = TestBed.inject(Router);
    const notify = TestBed.inject(Notify);
    const root = harness.fixture.nativeElement as HTMLElement;
    return { harness, router, notify, root };
  }

  it('loads by id via getNotification when not in the parent list and marks read', async () => {
    // Page size 2 holds only items #1 and #2; item #4 (unread, null actionUrl) must be fetched via getNotification.
    const { harness, root } = await openAt('/workspace/notifications/019a7c10-0004-7000-8000-000000000004', 2);
    await until(() => root.querySelector('dialog[open]') !== null);
    harness.detectChanges();

    const dialog = root.querySelector('dialog')!;
    expect(dialog.textContent).toContain('You are now the owner of a record');
    expect(dialog.textContent).toContain('Related record: Opportunity');
    await until(async () => (await getNotification('019a7c10-0004-7000-8000-000000000004')).readAt !== null);
  });

  it('toasts and returns to the list on 404 or non-UUID id', async () => {
    const missing = await openAt('/workspace/notifications/019a7c10-ffff-7000-8000-00000000ffff?tab=unread');
    await until(() => missing.router.url === '/workspace/notifications?tab=unread');
    expect(missing.notify.toasts().some((t) => t.title === wsEn.detail.gone)).toBe(true);
    expect(missing.root.querySelector('dialog[open]')).toBeNull();

    TestBed.resetTestingModule();
    const invalid = await openAt('/workspace/notifications/not-a-uuid');
    await until(() => invalid.router.url === '/workspace/notifications');
    expect(invalid.notify.toasts().some((t) => t.title === wsEn.detail.gone)).toBe(true);
    expect(invalid.root.querySelector('dialog[open]')).toBeNull();
  });

  it('shows Open only when actionUrl matches a registered route and navigates there on click', async () => {
    // Item #2 has /crm/leads (registered in router config)
    const { harness, router, root } = await openAt('/workspace/notifications/019a7c10-0002-7000-8000-000000000002');
    await until(() => root.querySelector('dialog[open]') !== null);
    harness.detectChanges();

    const openBtn = Array.from(root.querySelectorAll('dialog footer button')).find(
      (b) => b.textContent?.trim() === wsEn.actions.open,
    ) as HTMLButtonElement | undefined;
    expect(openBtn).toBeDefined();
    await until(async () => (await getNotification('019a7c10-0002-7000-8000-000000000002')).readAt !== null);
    openBtn!.click();
    await until(() => router.url === '/crm/leads');

    // Item #1 has /workspace/operations/activities (unregistered in this test router) -> no Open button
    TestBed.resetTestingModule();
    const unregistered = await openAt('/workspace/notifications/019a7c10-0001-7000-8000-000000000001');
    await until(() => unregistered.root.querySelector('dialog[open]') !== null);
    unregistered.harness.detectChanges();
    const noOpen = Array.from(unregistered.root.querySelectorAll('dialog footer button')).find(
      (b) => b.textContent?.trim() === wsEn.actions.open,
    );
    expect(noOpen).toBeUndefined();
    await until(async () => (await getNotification('019a7c10-0001-7000-8000-000000000001')).readAt !== null);
  });

  // D-N1 (brief ws-notifications-ui-n1-inbox): the list offers Acknowledge on P1_HIGH only, but the detail
  // offers it on every unacknowledged item. Item #2 is P2_NORMAL on purpose.
  it('acknowledges a normal-priority item inside the modal and stays open, then dismisses and returns to the list', async () => {
    const { harness, router, root } = await openAt('/workspace/notifications/019a7c10-0002-7000-8000-000000000002?tab=unread');
    await until(() => root.querySelector('dialog[open]') !== null);
    harness.detectChanges();

    const ackBtn = Array.from(root.querySelectorAll('dialog footer button')).find(
      (b) => b.textContent?.trim() === wsEn.actions.acknowledge,
    ) as HTMLButtonElement;
    expect(ackBtn).toBeDefined();
    ackBtn.click();
    harness.detectChanges();

    expect(root.querySelector('dialog[open]')).not.toBeNull();
    expect(root.querySelector('dialog')?.textContent).toContain(wsEn.acknowledgedJustNow);
    expect(
      Array.from(root.querySelectorAll('dialog footer button')).some((b) => b.textContent?.trim() === wsEn.actions.acknowledge),
    ).toBe(false);
    await until(async () => (await getNotification('019a7c10-0002-7000-8000-000000000002')).acknowledgedAt !== null);

    const dismissBtn = Array.from(root.querySelectorAll('dialog footer button')).find(
      (b) => b.textContent?.trim() === wsEn.actions.dismiss,
    ) as HTMLButtonElement;
    // The acknowledge write also refreshes the unread count; Dismiss stays disabled until it settles.
    await until(() => {
      harness.detectChanges();
      return !dismissBtn.disabled;
    });
    dismissBtn.click();
    await until(() => router.url === '/workspace/notifications?tab=unread');
    await expect(getNotification('019a7c10-0002-7000-8000-000000000002')).rejects.toMatchObject({
      status: 404,
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });

  it('closes and returns to the list preserving ?tab=unread', async () => {
    const { harness, router, root } = await openAt('/workspace/notifications/019a7c10-0001-7000-8000-000000000001?tab=unread');
    await until(() => root.querySelector('dialog[open]') !== null);
    harness.detectChanges();
    await until(async () => (await getNotification('019a7c10-0001-7000-8000-000000000001')).readAt !== null);

    const closeBtn = root.querySelector<HTMLButtonElement>('dialog header button')!;
    closeBtn.click();
    await until(() => router.url === '/workspace/notifications?tab=unread');
  });
});
