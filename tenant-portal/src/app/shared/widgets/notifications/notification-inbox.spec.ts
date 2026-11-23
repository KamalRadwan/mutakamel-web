import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { NotificationsFeed } from '../../../core/realtime/notifications-feed';
import type {
  NotificationsFeedEvent,
  NotificationsUnreadState,
} from '../../../core/realtime/notifications-feed.model';
import { NotificationInbox } from './notification-inbox';
import type { NotificationListResult, NotificationView } from './notifications.model';

const BASE = '/api/tenant/core/v1/notifications';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

describe('NotificationInbox with real CoreHttp', () => {
  let http: HttpTestingController;
  let inbox: NotificationInbox;
  let snapshot: NotificationListResult;
  let unread: ReturnType<typeof signal<NotificationsUnreadState | null>>;
  let emit: (event: NotificationsFeedEvent) => void;
  let unsubscribe: ReturnType<typeof vi.fn>;
  const notify = { error: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };
  const lang = signal('en');

  beforeEach(async () => {
    snapshot = {
      items: [1, 2, 3, 4].map((n): NotificationView => ({
        id: `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`,
        recipientId: 'recipient',
        sourceApp: 'core',
        notificationType: 'core.activity.assigned',
        priority: 'P2_NORMAL',
        title: `Notification ${n}`,
        body: 'Assigned activity',
        actionUrl: null,
        entityType: null,
        entityId: null,
        channels: ['IN_APP'],
        metadata: {},
        createdAt: '2026-11-23T09:00:00Z',
        readAt: null,
        acknowledgedAt: null,
        deliveredAt: null,
        recipientStateVersion: 1,
      })),
      unreadCount: 4,
      unreadRevision: 1,
      unreadChangedAt: '2026-11-23T09:00:00Z',
      nextCursor: null,
      hasNext: false,
    };
    unread = signal<NotificationsUnreadState | null>(null);
    unsubscribe = vi.fn();
    vi.clearAllMocks();
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NotificationInbox,
        { provide: Notify, useValue: notify },
        { provide: LanguageState, useValue: { current: lang } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
        {
          provide: NotificationsFeed,
          useValue: {
            unread,
            onEvent: (handler: typeof emit) => {
              emit = handler;
              return unsubscribe;
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    inbox = TestBed.inject(NotificationInbox);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
  });

  async function load(page = snapshot) {
    http.expectOne((r) => r.url === BASE).flush({ success: true, data: page });
    await settle();
  }

  async function refreshCount(count = 0) {
    await settle();
    http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: count } });
    await settle();
  }

  it('inbox loads list and revision', async () => {
    await load();
    expect(inbox.items()).toEqual(snapshot.items);
    expect(inbox.unreadCount()).toBe(snapshot.unreadCount);
    expect(inbox.unreadRevision()).toBe(snapshot.unreadRevision);
  });

  it('inbox empty state', async () => {
    await load({ ...snapshot, items: [], unreadCount: 0 });
    expect(inbox.items()).toEqual([]);
    expect(inbox.loadFailed()).toBe(false);
    inbox.unreadOnly.set(true);
    const done = inbox.reload();
    const request = http.expectOne((r) => r.url === BASE && r.params.get('unreadOnly') === 'true');
    request.flush({ success: true, data: { ...snapshot, items: [], unreadCount: 0 } });
    await done;
    expect(inbox.items()).toEqual([]);
  });

  it('inbox load more by cursor', async () => {
    const [a, b, c] = snapshot.items;
    await load({ ...snapshot, items: [a, b], nextCursor: 'opaque', hasNext: true });
    const done = inbox.loadMore();
    const request = http.expectOne((r) => r.url === BASE && r.params.get('cursor') === 'opaque');
    expect(request.request.params.keys().sort()).toEqual(['cursor', 'limit']);
    request.flush({ success: true, data: { ...snapshot, items: [b, c, c] } });
    await done;
    expect(inbox.items().map((row) => row.id)).toEqual([a.id, b.id, c.id]);
  });

  it('bad cursor reloads once', async () => {
    await load({ ...snapshot, nextCursor: 'bad', hasNext: true });
    const done = inbox.loadMore();
    http
      .expectOne((r) => r.params.get('cursor') === 'bad')
      .flush(
        { errorCode: 'NOTIFICATION_CURSOR_INVALID' },
        { status: 400, statusText: 'Bad request' },
      );
    await settle();
    http
      .expectOne((r) => r.url === BASE && !r.params.has('cursor'))
      .flush(
        { errorCode: 'NOTIFICATION_CURSOR_INVALID' },
        { status: 400, statusText: 'Bad request' },
      );
    await done;
    expect(inbox.loadFailed()).toBe(true);
    http.expectNone((r) => r.url === BASE);
  });

  it('inbox user missing state', async () => {
    http
      .expectOne((r) => r.url === BASE)
      .flush(
        { errorCode: 'NOTIFICATION_USER_NOT_FOUND' },
        { status: 404, statusText: 'Not found' },
      );
    await settle();
    expect(inbox.userMissing()).toBe(true);
    expect(inbox.loadFailed()).toBe(false);
  });

  it.each([500, 0])('inbox load failure (%s)', async (status) => {
    const request = http.expectOne((r) => r.url === BASE);
    if (status) request.flush({}, { status, statusText: 'Server error' });
    else request.error(new ProgressEvent('error'));
    await settle();
    expect(inbox.loadFailed()).toBe(true);
    expect(inbox.loading()).toBe(false);
    if (!status) expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    const done = inbox.reload();
    await load();
    await done;
    expect(inbox.loadFailed()).toBe(false);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('language switch does not reload inbox', async () => {
    await load();
    lang.set('ar');
    TestBed.tick();
    http.expectNone((r) => r.url === BASE);
    expect(inbox.items()[0].title).toBe(snapshot.items[0].title);
  });

  it('feed unread respects revision', async () => {
    unread.set({ unreadCount: 99, unreadRevision: null, at: 1 });
    TestBed.tick();
    expect(inbox.unreadCount()).toBe(0);
    await load({ ...snapshot, unreadRevision: 10 });
    unread.set({ unreadCount: 7, unreadRevision: 11, at: 2 });
    TestBed.tick();
    expect(inbox.unreadCount()).toBe(7);
    unread.set({ unreadCount: 50, unreadRevision: 10, at: 3 });
    TestBed.tick();
    expect(inbox.unreadCount()).toBe(7);
    unread.set({ unreadCount: 3, unreadRevision: null, at: 4 });
    TestBed.tick();
    expect(inbox.unreadCount()).toBe(3);
    expect(inbox.unreadRevision()).toBe(11);
  });

  it('rising count marks the list stale', async () => {
    await load();
    unread.set({ unreadCount: snapshot.unreadCount + 1, unreadRevision: 2, at: 1 });
    TestBed.tick();
    expect(inbox.stale()).toBe(true);
    const done = inbox.reload();
    await load({ ...snapshot, unreadRevision: 3 });
    await done;
    expect(inbox.stale()).toBe(false);
  });

  it('created event refetches and prepends', async () => {
    await load({ ...snapshot, items: snapshot.items.slice(1) });
    const first = snapshot.items[0];
    emit({ kind: 'created', notificationId: first.id });
    http.expectOne(BASE + '/' + first.id).flush({ success: true, data: first });
    await settle();
    expect(inbox.items()[0]).toEqual(first);
    emit({ kind: 'created', notificationId: first.id });
    http.expectOne(BASE + '/' + first.id).flush({ success: true, data: first });
    await settle();
    expect(inbox.items().filter((row) => row.id === first.id)).toHaveLength(1);
    emit({ kind: 'created', notificationId: 'missing' });
    http
      .expectOne(BASE + '/missing')
      .flush({ errorCode: 'NOTIFICATION_NOT_FOUND' }, { status: 404, statusText: 'Not found' });
    await settle();
    expect(notify.error).not.toHaveBeenCalled();
  });

  function update(
    row: NotificationView,
    change: 'READ' | 'ACKNOWLEDGED' | 'DISMISSED',
    version = row.recipientStateVersion + 1,
  ) {
    emit({
      kind: 'updated',
      notificationId: row.id,
      change,
      recipientStateVersion: version,
      readAt: '2026-11-23T10:00:00Z',
      acknowledgedAt: null,
    });
  }

  it('updated event patches the row', async () => {
    await load();
    const first = inbox.items()[0];
    update(first, 'READ');
    expect(inbox.items()[0].readAt).not.toBeNull();
    update(first, 'DISMISSED', first.recipientStateVersion + 2);
    expect(inbox.items().some((row) => row.id === first.id)).toBe(false);
  });

  it('stale update is ignored', async () => {
    await load();
    const first = inbox.items()[0];
    update(first, 'DISMISSED', first.recipientStateVersion);
    expect(inbox.items()[0]).toEqual(first);
  });

  it('sync event reloads inbox', async () => {
    await load();
    emit({ kind: 'sync' });
    await load({ ...snapshot, items: [] });
    expect(inbox.items()).toEqual([]);
  });

  it('unsubscribes and ignores pending created fetch after destroy', async () => {
    await load();
    emit({ kind: 'created', notificationId: 'pending' });
    const request = http.expectOne(BASE + '/pending');
    TestBed.resetTestingModule();
    expect(unsubscribe).toHaveBeenCalledOnce();
    request.flush({ success: true, data: { ...snapshot.items[0], id: 'pending' } });
    await settle();
    expect(inbox.items().some((row) => row.id === 'pending')).toBe(false);
  });

  it('mark read', async () => {
    await load();
    const first = inbox.items()[0];
    const done = inbox.markRead(first.id);
    const request = http.expectOne(BASE + '/' + first.id + '/read');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    request.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount(snapshot.unreadCount - 1);
    await done;
    expect(inbox.items()[0].readAt).not.toBeNull();
    expect(inbox.unreadCount()).toBe(snapshot.unreadCount - 1);
  });

  it('mark read of missing item drops row', async () => {
    await load();
    const first = inbox.items()[0];
    let done = inbox.markRead(first.id);
    const request = http.expectOne(BASE + '/' + first.id + '/read');
    const key = request.request.headers.get('x-idempotency-key');
    request.flush(
      { errorCode: 'NOTIFICATION_NOT_FOUND' },
      { status: 404, statusText: 'Not found' },
    );
    await refreshCount();
    await done;
    expect(inbox.items().some((row) => row.id === first.id)).toBe(false);
    // A terminal not-found never resurrects the item from a delayed detail view.
    done = inbox.markRead(first.id, first);
    await done;
    http.expectNone(BASE + '/' + first.id + '/read');
    expect(key).toMatch(UUID_V7);
  });

  it('a successful action uses a fresh key for another notification', async () => {
    await load();
    const [first, second] = snapshot.items;
    let done = inbox.markRead(first.id);
    const request = http.expectOne(BASE + '/' + first.id + '/read');
    const key = request.request.headers.get('x-idempotency-key');
    request.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
    done = inbox.markRead(second.id);
    const retry = http.expectOne(BASE + '/' + second.id + '/read');
    expect(retry.request.headers.get('x-idempotency-key')).not.toBe(key);
    retry.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
  });

  it('mark read retry reuses key', async () => {
    await load();
    const first = inbox.items()[0];
    const failure = inbox.markRead(first.id).catch((e: unknown) => e);
    const request = http.expectOne(BASE + '/' + first.id + '/read');
    const key = request.request.headers.get('x-idempotency-key');
    request.flush({}, { status: 500, statusText: 'Server error' });
    await failure;
    expect(inbox.items()[0].readAt).toBeNull();
    const done = inbox.markRead(first.id);
    const retry = http.expectOne(BASE + '/' + first.id + '/read');
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    retry.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
  });

  it('mark all read', async () => {
    await load();
    const done = inbox.markAllRead();
    http.expectOne(BASE + '/read-all').flush({ success: true, data: { updated: 4 } });
    await refreshCount();
    await done;
    expect(inbox.items().every((row) => row.readAt !== null)).toBe(true);
    expect(inbox.unreadCount()).toBe(0);
  });

  it('acknowledge marks read', async () => {
    await load();
    const first = inbox.items()[0];
    const done = inbox.acknowledge(first.id);
    http
      .expectOne(BASE + '/' + first.id + '/acknowledge')
      .flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
    expect(inbox.items()[0].readAt).not.toBeNull();
    expect(inbox.items()[0].acknowledgedAt).not.toBeNull();
  });

  it('dismiss removes row', async () => {
    await load();
    const first = inbox.items()[0];
    const done = inbox.dismiss(first.id);
    const request = http.expectOne(BASE + '/' + first.id);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
    expect(inbox.items().some((row) => row.id === first.id)).toBe(false);
  });

  it('inbox write 401 keeps key', async () => {
    await load();
    const first = inbox.items()[0];
    const failed = inbox.dismiss(first.id).catch((e: unknown) => e);
    const request = http.expectOne(BASE + '/' + first.id);
    const key = request.request.headers.get('x-idempotency-key');
    request.flush({ code: 'GW.AUTH.UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    await failed;
    expect(inbox.items()).toContainEqual(first);
    const done = inbox.dismiss(first.id);
    const retry = http.expectOne(BASE + '/' + first.id);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    retry.flush(null, { status: 204, statusText: 'No content' });
    await refreshCount();
    await done;
  });

  it('a failed read cannot undo a newer acknowledged event or unread revision', async () => {
    await load();
    const row = snapshot.items[0];
    const failed = inbox.markRead(row.id).catch((e: unknown) => e);
    emit({
      kind: 'updated',
      notificationId: row.id,
      change: 'ACKNOWLEDGED',
      recipientStateVersion: 3,
      readAt: '2026-11-23T11:00:00Z',
      acknowledgedAt: '2026-11-23T11:00:00Z',
    });
    unread.set({ unreadCount: 2, unreadRevision: 3, at: 1 });
    TestBed.tick();
    http.expectOne(BASE + '/' + row.id + '/read').flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.items()[0].acknowledgedAt).toBe('2026-11-23T11:00:00Z');
    expect(inbox.items()[0].recipientStateVersion).toBe(3);
    expect(inbox.unreadCount()).toBe(2);
  });

  it('failed dismissal restores only its row and preserves a concurrent creation', async () => {
    await load();
    const row = snapshot.items[0];
    const failed = inbox.dismiss(row.id).catch((e: unknown) => e);
    emit({ kind: 'created', notificationId: 'new' });
    http.expectOne(BASE + '/new').flush({ success: true, data: { ...row, id: 'new' } });
    await settle();
    update(row, 'READ', 3);
    http.expectOne(BASE + '/' + row.id).flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.items()[0].id).toBe('new');
    expect(inbox.items().find((item) => item.id === row.id)?.recipientStateVersion).toBe(3);
  });

  it('late read-all failure preserves a successful read and new rows', async () => {
    await load();
    const row = snapshot.items[0];
    const failed = inbox.markAllRead().catch((e: unknown) => e);
    update(row, 'READ', 2);
    emit({ kind: 'created', notificationId: 'new' });
    http.expectOne(BASE + '/new').flush({ success: true, data: { ...row, id: 'new' } });
    await settle();
    http.expectOne(BASE + '/read-all').flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.items()[0].id).toBe('new');
    expect(inbox.items().find((item) => item.id === row.id)?.readAt).not.toBeNull();
    expect(inbox.items().find((item) => item.id === snapshot.items[1].id)?.readAt).toBeNull();
  });

  it('read-all success does not mark a notification arriving after dispatch as read', async () => {
    await load();
    const done = inbox.markAllRead();
    emit({ kind: 'created', notificationId: 'new' });
    http
      .expectOne(BASE + '/new')
      .flush({ success: true, data: { ...snapshot.items[0], id: 'new' } });
    await settle();
    http.expectOne(BASE + '/read-all').flush({ success: true, data: { updated: 4 } });
    await refreshCount(1);
    await done;
    expect(inbox.items()[0].readAt).toBeNull();
    expect(inbox.unreadCount()).toBe(1);
  });

  it('a dismiss event before created-detail completion prevents resurrection', async () => {
    await load();
    const row = { ...snapshot.items[0], id: 'new' };
    emit({ kind: 'created', notificationId: row.id });
    update(row, 'DISMISSED', 3);
    http.expectOne(BASE + '/new').flush({ success: true, data: row });
    await settle();
    expect(inbox.items().some((item) => item.id === row.id)).toBe(false);
  });

  it('a duplicate created event whose detail is gone removes an existing row', async () => {
    await load();
    const row = snapshot.items[0];
    emit({ kind: 'created', notificationId: row.id });
    http
      .expectOne(BASE + '/' + row.id)
      .flush({ errorCode: 'NOTIFICATION_NOT_FOUND' }, { status: 404, statusText: 'Missing' });
    await settle();
    expect(inbox.items().some((item) => item.id === row.id)).toBe(false);
    expect(inbox.stale()).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('a recipient update before created-detail completion is applied by version', async () => {
    await load();
    const row = { ...snapshot.items[0], id: 'new' };
    emit({ kind: 'created', notificationId: row.id });
    update(row, 'READ', 3);
    http.expectOne(BASE + '/new').flush({ success: true, data: row });
    await settle();
    expect(inbox.items()[0].recipientStateVersion).toBe(3);
    expect(inbox.items()[0].readAt).not.toBeNull();
  });

  it('a stale reload cannot undo recipient events received while loading', async () => {
    await load();
    const done = inbox.reload();
    update(snapshot.items[0], 'READ', 3);
    update(snapshot.items[1], 'DISMISSED', 3);
    await load();
    await done;
    expect(inbox.items()[0].recipientStateVersion).toBe(3);
    expect(inbox.items().some((row) => row.id === snapshot.items[1].id)).toBe(false);
  });

  it('an equal-revision list cannot overwrite a count or pending action received while loading', async () => {
    await load();
    const reload = inbox.reload();
    const failed = inbox.markRead(snapshot.items[0].id).catch((e: unknown) => e);
    await load();
    await reload;
    expect(inbox.unreadCount()).toBe(3);
    http
      .expectOne(BASE + '/' + snapshot.items[0].id + '/read')
      .flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.unreadCount()).toBe(4);
  });

  it('an acknowledgement pending alongside a failed read counts the recipient only once', async () => {
    await load();
    const row = snapshot.items[0];
    const failed = inbox.markRead(row.id).catch((e: unknown) => e);
    const done = inbox.acknowledge(row.id);
    expect(inbox.unreadCount()).toBe(3);
    http.expectOne(BASE + '/' + row.id + '/read').flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.unreadCount()).toBe(3);
    http
      .expectOne(BASE + '/' + row.id + '/acknowledge')
      .flush(null, { status: 204, statusText: 'OK' });
    await refreshCount(3);
    await done;
    expect(inbox.items()[0].acknowledgedAt).not.toBeNull();
    expect(inbox.unreadCount()).toBe(3);
  });

  it('unread-only rows disappear optimistically and return on failure', async () => {
    inbox.unreadOnly.set(true);
    await load();
    const row = snapshot.items[0];
    const failed = inbox.markRead(row.id).catch((e: unknown) => e);
    expect(inbox.items().some((item) => item.id === row.id)).toBe(false);
    http.expectOne(BASE + '/' + row.id + '/read').flush({}, { status: 500, statusText: 'Error' });
    await failed;
    expect(inbox.items()[0]).toEqual(row);
  });

  it('coalesces duplicate pending dismissals into one user intent', async () => {
    await load();
    const row = snapshot.items[0];
    const first = inbox.dismiss(row.id);
    const second = inbox.dismiss(row.id, row);
    expect(first).toBe(second);
    http.expectOne(BASE + '/' + row.id).flush(null, { status: 204, statusText: 'OK' });
    await refreshCount(3);
    await first;
  });

  it('count recovery failure marks stale and reports missing-user and connection failures', async () => {
    await load();
    const done = inbox.markRead(snapshot.items[0].id);
    http
      .expectOne(BASE + '/' + snapshot.items[0].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    http.expectOne(BASE + '/unread-count').error(new ProgressEvent('error'));
    await done;
    expect(inbox.stale()).toBe(true);
    expect(notify.connectionLost).toHaveBeenCalledOnce();
    const other = inbox.markRead(snapshot.items[1].id);
    http
      .expectOne(BASE + '/' + snapshot.items[1].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    http
      .expectOne(BASE + '/unread-count')
      .flush({ errorCode: 'NOTIFICATION_USER_NOT_FOUND' }, { status: 404, statusText: 'Missing' });
    await other;
    expect(inbox.userMissing()).toBe(true);
  });

  it('a count requested before a newer unread revision cannot overwrite it', async () => {
    await load();
    const done = inbox.markRead(snapshot.items[0].id);
    http
      .expectOne(BASE + '/' + snapshot.items[0].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    unread.set({ unreadCount: 8, unreadRevision: 5, at: 1 });
    TestBed.tick();
    http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: 0 } });
    await done;
    expect(inbox.unreadCount()).toBe(8);
  });

  it('serializes count recovery after concurrent writes rather than reusing an old in-flight count', async () => {
    await load();
    const first = inbox.markRead(snapshot.items[0].id);
    http
      .expectOne(BASE + '/' + snapshot.items[0].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    const count = http.expectOne(BASE + '/unread-count');
    const second = inbox.markRead(snapshot.items[1].id);
    http
      .expectOne(BASE + '/' + snapshot.items[1].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    http.expectNone(BASE + '/unread-count');
    count.flush({ success: true, data: { unreadCount: 3 } });
    await refreshCount(2);
    await Promise.all([first, second]);
    expect(inbox.unreadCount()).toBe(2);
  });

  it('does not hide a missing-user error from a created-detail request as a missing item', async () => {
    await load();
    emit({ kind: 'created', notificationId: 'new' });
    http
      .expectOne(BASE + '/new')
      .flush({ errorCode: 'NOTIFICATION_USER_NOT_FOUND' }, { status: 404, statusText: 'Missing' });
    await settle();
    expect(inbox.userMissing()).toBe(true);
    expect(inbox.stale()).toBe(true);
    expect(notify.error).toHaveBeenCalledOnce();
  });

  it('a malformed count is reported as stale without changing the last known count', async () => {
    await load();
    const done = inbox.markRead(snapshot.items[0].id);
    http
      .expectOne(BASE + '/' + snapshot.items[0].id + '/read')
      .flush(null, { status: 204, statusText: 'OK' });
    await settle();
    http.expectOne(BASE + '/unread-count').flush({ success: true, data: { unreadCount: -1 } });
    await done;
    expect(inbox.unreadCount()).toBe(3);
    expect(inbox.stale()).toBe(true);
    expect(notify.error).toHaveBeenCalledOnce();
  });

  it('ignores a write completion after destruction and starts no count recovery', async () => {
    await load();
    const done = inbox.markRead(snapshot.items[0].id);
    const request = http.expectOne(BASE + '/' + snapshot.items[0].id + '/read');
    TestBed.resetTestingModule();
    request.flush(null, { status: 204, statusText: 'OK' });
    await done;
    http.expectNone(BASE + '/unread-count');
  });

  it('inbox write without csrf sends nothing', async () => {
    await load();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    const before = inbox.items();
    await expect(inbox.dismiss(before[0].id)).rejects.toMatchObject({
      code: 'GW.AUTH.CSRF_INVALID',
    });
    expect(inbox.items()).toEqual(before);
    expect(inbox.unreadCount()).toBe(snapshot.unreadCount);
    http.expectNone(() => true);
  });
});
