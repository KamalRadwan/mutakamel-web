import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../public/i18n/en.json';
import wsEn from '../../../../public/i18n/ws-notifications/en.json';
import { CoreHttp } from '../../core/api/core-http';
import { Notify } from '../../core/notify/notify';
import { NotificationsFeed } from '../../core/realtime/notifications-feed';
import type { NotificationsUnreadState } from '../../core/realtime/notifications-feed.model';
import { NotificationsState } from '../../shared/widgets/notifications/notifications-state';
import { NotificationsApi } from '../../shared/widgets/notifications/notifications.api';
import type { NotificationView } from '../../shared/widgets/notifications/notifications.model';
import { NotificationBell } from './notification-bell';

const BASE = '/api/tenant/core/v1/notifications';
const ID = '019b0dc1-0000-7000-8000-000000000001';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function notification(changes: Partial<NotificationView> = {}): NotificationView {
  return {
    id: ID,
    recipientId: '019b0dc1-0000-7000-8000-000000000002',
    sourceApp: 'core',
    notificationType: 'core.activity.assigned',
    priority: 'P2_NORMAL',
    title: 'Assigned activity',
    body: 'Review the account',
    actionUrl: null,
    entityType: null,
    entityId: null,
    channels: ['in_app'],
    metadata: {},
    createdAt: new Date().toISOString(),
    readAt: null,
    acknowledgedAt: null,
    deliveredAt: null,
    recipientStateVersion: 1,
    ...changes,
  };
}

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

describe('NotificationBell', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NotificationBell>;
  let el: HTMLElement;
  const unread = signal<NotificationsUnreadState | null>(null);

  beforeEach(() => {
    localStorage.clear();
    unread.set(null);
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CoreHttp,
        NotificationsApi,
        { provide: NotificationsFeed, useValue: { unread, onEvent: () => () => undefined } },
        {
          provide: Notify,
          useValue: { error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() },
        },
        provideRouter([
          { path: 'workspace/notifications', component: Target },
          { path: 'workspace/notifications/:id', component: Target },
          { path: 'workspace/home', component: Target },
        ]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestLoader,
        }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
  });

  async function render() {
    for (let i = 0; i < 15; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  async function load(items = [notification()], unreadCount = 1, unreadRevision = 1) {
    const request = http.expectOne((r) => r.method === 'GET' && r.url === BASE);
    expect(request.request.params.keys()).toEqual(['limit']);
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({
      success: true,
      data: {
        items,
        unreadCount,
        unreadRevision,
        unreadChangedAt: new Date().toISOString(),
        nextCursor: null,
        hasNext: false,
      },
    });
    await render();
  }

  function togglePanel() {
    (el.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  async function refreshCount(unreadCount: number) {
    await render();
    const request = http.expectOne(BASE + '/unread-count');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { unreadCount } });
    await render();
  }

  it('bell badge follows the live count', async () => {
    await load();
    const bell = el.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    for (const count of [7, 99, 100, 0]) {
      unread.set({ unreadCount: count, unreadRevision: null, at: Date.now() });
      fixture.detectChanges();
      const badge = bell.querySelector('span');
      expect(badge?.textContent?.trim() ?? null).toBe(
        count === 0 ? null : count > 99 ? '99+' : String(count),
      );
    }
    http.expectNone((r) => r.url === BASE);
  });

  it('opening a stale bell reloads the list', async () => {
    await load();
    unread.set({ unreadCount: 2, unreadRevision: 2, at: Date.now() });
    fixture.detectChanges();
    expect(TestBed.inject(NotificationsState).stale()).toBe(true);
    togglePanel();
    const added = notification({
      id: '019b0dc1-0000-7000-8000-000000000003',
      title: 'New assignment',
    });
    await load([added, notification()], 2, 2);
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(2);
    expect(el.textContent).toContain(added.title);
    expect(TestBed.inject(NotificationsState).stale()).toBe(false);
    unread.set({ unreadCount: 3, unreadRevision: 3, at: Date.now() });
    fixture.detectChanges();
    togglePanel();
    expect(el.querySelector('section[role="dialog"]')).toBeNull();
    http.expectNone((r) => r.url === BASE);
  });

  it('opening a fresh bell does not reload', async () => {
    await load();
    expect(TestBed.inject(NotificationsState).stale()).toBe(false);
    togglePanel();
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(1);
    http.expectNone((r) => r.url === BASE);
  });

  it.each([
    { actionUrl: '/workspace/home', expected: '/workspace/home' },
    { actionUrl: null, expected: '/workspace/notifications/' + ID },
    { actionUrl: '/unregistered', expected: '/workspace/notifications/' + ID },
  ])('bell open item marks read and navigates ($actionUrl)', async ({ actionUrl, expected }) => {
    await load([notification({ actionUrl })]);
    togglePanel();
    (el.querySelector('app-notification-item button') as HTMLButtonElement).click();
    const request = http.expectOne(BASE + '/' + ID + '/read');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount(0);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationsState).items()[0].readAt).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe(expected);
    expect(el.querySelector('section[role="dialog"]')).toBeNull();
  });

  it('bell dismiss removes the row', async () => {
    await load();
    togglePanel();
    const dismiss = el.querySelector(
      `app-notification-item button[aria-label="${en.notifications.actions.dismiss}"]`,
    ) as HTMLButtonElement;
    dismiss.click();
    const request = http.expectOne(BASE + '/' + ID);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount(0);
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(0);
    expect(el.querySelector('section[role="dialog"]')?.textContent).toContain(
      en.notifications.empty,
    );
  });

  it('bell mark all read', async () => {
    await load();
    togglePanel();
    const button = el.querySelector('section[role="dialog"] button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    const request = http.expectOne(BASE + '/read-all');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(request.request.body).toBeNull();
    request.flush({ success: true, data: { updated: 1 } });
    await refreshCount(0);
    expect(
      TestBed.inject(NotificationsState)
        .items()
        .every((item) => item.readAt !== null),
    ).toBe(true);
    expect(button.disabled).toBe(true);
    button.click();
    http.expectNone(BASE + '/read-all');
  });

  it('bell shows list failure', async () => {
    http.expectOne((r) => r.url === BASE).flush({}, { status: 500, statusText: 'Server error' });
    await render();
    togglePanel();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(en.notifications.loadError);
    const retry = Array.from(el.querySelectorAll('section button')).find(
      (button) => button.textContent?.trim() === en.notifications.retry,
    ) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    await load();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('app-notification-item')).toHaveLength(1);
  });

  it('renders shared items and links View all to the inbox page', async () => {
    await load();
    togglePanel();
    const viewAll = el.querySelector('a[href="/workspace/notifications"]') as HTMLAnchorElement;
    expect(viewAll.textContent?.trim()).toBe(en.notifications.viewAll);
    viewAll.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/workspace/notifications');
    expect(el.querySelector('section[role="dialog"]')).toBeNull();
  });
});
