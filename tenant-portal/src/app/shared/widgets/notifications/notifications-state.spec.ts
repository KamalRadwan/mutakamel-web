import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../public/i18n/en.json';
import ar from '../../../../../public/i18n/ar.json';
import { Notify } from '../../../core/notify/notify';
import { NotificationsFeed } from '../../../core/realtime/notifications-feed';
import { fakeListNotifications, resetFakeNotifications } from './notifications.fake';
import { KNOWN_NOTIFICATION_TYPES } from './notifications.model';
import { NotificationsState } from './notifications-state';

const BASE = '/api/tenant/core/v1/notifications';
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

describe('NotificationsState public bell contract', () => {
  let http: HttpTestingController;
  const unread = signal<{ unreadCount: number; unreadRevision: number | null; at: number } | null>(
    null,
  );
  const notify = { error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(() => {
    resetFakeNotifications();
    unread.set(null);
    vi.clearAllMocks();
    document.cookie = 'mutakamel-http-tenant-csrf=csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Notify, useValue: notify },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) =>
              key === 'wsNotif.errors.notSaved' ? 'Not saved. Try again.' : key,
          },
        },
        { provide: NotificationsFeed, useValue: { unread, onEvent: () => () => undefined } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
  });

  it('exposes items, revisions, stale, load and missing-user state', async () => {
    const snapshot = await fakeListNotifications();
    const state = TestBed.inject(NotificationsState);
    TestBed.tick();
    http.expectOne((r) => r.url === BASE).flush({ success: true, data: snapshot });
    await settle();
    expect(state.items()).toEqual(snapshot.items);
    expect(state.unreadRevision()).toBe(snapshot.unreadRevision);
    expect(state.loading()).toBe(false);
    expect(state.userMissing()).toBe(false);
    expect(state.loadFailed()).toBe(false);
    expect(state.nextCursor()).toBeNull();
    unread.set({ unreadCount: snapshot.unreadCount + 1, unreadRevision: 10, at: 1 });
    TestBed.tick();
    expect(state.stale()).toBe(true);
  });

  it('inbox write 401 keeps key and shows notSaved', async () => {
    const snapshot = await fakeListNotifications();
    const state = TestBed.inject(NotificationsState);
    TestBed.tick();
    http.expectOne((r) => r.url === BASE).flush({ success: true, data: snapshot });
    await settle();
    const id = state.items()[0].id;
    const done = state.markRead(id);
    const request = http.expectOne(BASE + '/' + id + '/read');
    const key = request.request.headers.get('x-idempotency-key');
    request.flush({ code: 'GW.AUTH.UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(state.items()[0].readAt).toBeNull();
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again.');
    const retry = state.markRead(id);
    const retried = http.expectOne(BASE + '/' + id + '/read');
    expect(retried.request.headers.get('x-idempotency-key')).toBe(key);
    retried.flush(null, { status: 204, statusText: 'No content' });
    await settle();
    http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: 3 } });
    await retry;
  });
});

describe('notification type labels', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s has every known type plus other', (_lang, dict) => {
    const types: Record<string, string> = dict.notifications.types;
    for (const type of KNOWN_NOTIFICATION_TYPES)
      expect(types[type.replace(/\./g, '_')]).toBeTruthy();
    expect(types['other']).toBeTruthy();
  });
});
