import { newIdempotencyKey } from '../../../core/api/idempotency';
import {
  acknowledgeNotification,
  dismissNotification,
  getNotification,
  getNotificationConfig,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.api';
import { resetFakeNotifications, setFakeNotificationUserInactive } from './notifications.fake';
import { KNOWN_NOTIFICATION_TYPES, inAppActionPath, notificationLook } from './notifications.model';

const MISSING_ID = '019a7c10-ffff-7000-8000-00000000ffff';

const VIEW_KEYS = [
  'acknowledgedAt',
  'actionUrl',
  'body',
  'channels',
  'createdAt',
  'deliveredAt',
  'entityId',
  'entityType',
  'id',
  'metadata',
  'notificationType',
  'priority',
  'readAt',
  'recipientId',
  'recipientStateVersion',
  'sourceApp',
  'title',
].sort();

async function rejectsWith(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ status, code });
  expect((error as { details?: unknown }).details).toBeUndefined();
}

describe('notifications fake follows TenantNotificationsController', () => {
  beforeEach(() => {
    resetFakeNotifications();
    document.documentElement.lang = 'en';
  });

  afterAll(() => setFakeNotificationUserInactive(false));

  it('lists newest first with the backend item and page shape', async () => {
    const page = await listNotifications();
    expect(Object.keys(page).sort()).toEqual(
      ['hasNext', 'items', 'nextCursor', 'unreadChangedAt', 'unreadCount', 'unreadRevision'].sort(),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) expect(Object.keys(item).sort()).toEqual(VIEW_KEYS);
    const times = page.items.map((item) => item.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('pages with limit and an opaque cursor', async () => {
    const all = await listNotifications({ limit: 50 });
    const first = await listNotifications({ limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.hasNext).toBe(true);
    const second = await listNotifications({ limit: 3, cursor: first.nextCursor as string });
    expect(second.items.map((item) => item.id)).toEqual(all.items.slice(3, 6).map((item) => item.id));
  });

  it('rejects a bad cursor with 400 NOTIFICATION_CURSOR_INVALID and a bad limit with 400 CORE_VALIDATION_FAILED', async () => {
    await rejectsWith(listNotifications({ cursor: 'not-a-cursor' }), 400, 'NOTIFICATION_CURSOR_INVALID');
    await rejectsWith(listNotifications({ limit: 51 }), 400, 'CORE_VALIDATION_FAILED');
    await rejectsWith(listNotifications({ limit: 0 }), 400, 'CORE_VALIDATION_FAILED');
  });

  it('filters unreadOnly and reports the unread count', async () => {
    const unread = await listNotifications({ unreadOnly: true });
    expect(unread.items.every((item) => item.readAt === null)).toBe(true);
    expect((await getUnreadNotificationCount()).unreadCount).toBe(unread.items.length);
    expect(unread.unreadCount).toBe(unread.items.length);
  });

  it('returns stored text in the request language', async () => {
    const en = await listNotifications({ limit: 1 });
    document.documentElement.lang = 'ar';
    const ar = await listNotifications({ limit: 1 });
    expect(ar.items[0].id).toBe(en.items[0].id);
    expect(ar.items[0].title).not.toBe(en.items[0].title);
  });

  it('marks one read (idempotent) and lowers the unread count', async () => {
    const { items } = await listNotifications({ unreadOnly: true });
    const before = (await getUnreadNotificationCount()).unreadCount;
    const readKey = newIdempotencyKey();
    await expect(markNotificationRead(items[0].id, readKey)).resolves.toBeUndefined();
    await markNotificationRead(items[0].id, readKey);
    expect((await getUnreadNotificationCount()).unreadCount).toBe(before - 1);
    expect((await getNotification(items[0].id)).readAt).not.toBeNull();
  });

  it('acknowledges and also marks read', async () => {
    const { items } = await listNotifications({ unreadOnly: true });
    await acknowledgeNotification(items[0].id, newIdempotencyKey());
    const item = await getNotification(items[0].id);
    expect(item.acknowledgedAt).not.toBeNull();
    expect(item.readAt).not.toBeNull();
  });

  it('marks all read and returns { updated }', async () => {
    const before = (await getUnreadNotificationCount()).unreadCount;
    expect(await markAllNotificationsRead(newIdempotencyKey())).toEqual({ updated: before });
    expect(await markAllNotificationsRead(newIdempotencyKey())).toEqual({ updated: 0 });
    expect((await getUnreadNotificationCount()).unreadCount).toBe(0);
  });

  it('dismisses for this user; the item then returns 404 NOTIFICATION_NOT_FOUND', async () => {
    const { items } = await listNotifications();
    await expect(dismissNotification(items[0].id, newIdempotencyKey())).resolves.toBeUndefined();
    await rejectsWith(getNotification(items[0].id), 404, 'NOTIFICATION_NOT_FOUND');
    await rejectsWith(markNotificationRead(items[0].id, newIdempotencyKey()), 404, 'NOTIFICATION_NOT_FOUND');
    await rejectsWith(dismissNotification(items[0].id, newIdempotencyKey()), 404, 'NOTIFICATION_NOT_FOUND');
    expect((await listNotifications()).items.some((item) => item.id === items[0].id)).toBe(false);
  });

  it('returns 404 NOTIFICATION_NOT_FOUND for an unknown id and 400 CORE_VALIDATION_FAILED for a non-UUID', async () => {
    await rejectsWith(getNotification(MISSING_ID), 404, 'NOTIFICATION_NOT_FOUND');
    await rejectsWith(acknowledgeNotification(MISSING_ID, newIdempotencyKey()), 404, 'NOTIFICATION_NOT_FOUND');
    await rejectsWith(getNotification('n-1'), 400, 'CORE_VALIDATION_FAILED');
  });

  it('returns 404 NOTIFICATION_USER_NOT_FOUND for an inactive recipient', async () => {
    const { items } = await listNotifications();
    setFakeNotificationUserInactive(true);
    await rejectsWith(listNotifications(), 404, 'NOTIFICATION_USER_NOT_FOUND');
    await rejectsWith(getUnreadNotificationCount(), 404, 'NOTIFICATION_USER_NOT_FOUND');
    await rejectsWith(markNotificationRead(items[0].id, newIdempotencyKey()), 404, 'NOTIFICATION_USER_NOT_FOUND');
    await rejectsWith(markAllNotificationsRead(newIdempotencyKey()), 404, 'NOTIFICATION_USER_NOT_FOUND');
    setFakeNotificationUserInactive(false);
  });

  it('serves the runtime config with the preference catalogue', async () => {
    const config = await getNotificationConfig();
    expect(Object.keys(config).sort()).toEqual(
      ['enabled', 'inAppEnabled', 'pollIntervalMs', 'preferenceCatalogue', 'previewLimit', 'realtimeEnabled'].sort(),
    );
    expect(config.preferenceCatalogue.map((row) => row.notificationType)).toEqual([...KNOWN_NOTIFICATION_TYPES]);
  });
});

describe('notifications model helpers', () => {
  it('maps every known type to an icon, tone and label key', () => {
    for (const type of KNOWN_NOTIFICATION_TYPES) {
      const look = notificationLook(type);
      expect(look.icon).toMatch(/^tabler/);
      expect(look.tile).toMatch(/^bg-icon-/);
      expect(look.labelKey).toBe(`notifications.types.${type.replace(/\./g, '_')}`);
    }
  });

  it('gives unknown types a neutral look', () => {
    expect(notificationLook('trade.something.new')).toEqual({
      icon: 'tablerInfoCircle',
      tile: 'bg-icon-gray',
      labelKey: 'notifications.types.other',
    });
  });

  it('follows only same-app action paths that match a registered route', async () => {
    const routes = [
      { path: 'crm/leads', children: [{ path: '' }, { path: ':id' }] },
      { path: '**', children: [] },
    ];
    expect(await inAppActionPath('/crm/leads', routes)).toBe('/crm/leads');
    expect(await inAppActionPath('/crm/leads/019a7c10', routes)).toBe('/crm/leads/019a7c10');
    expect(await inAppActionPath('/workspace/unknown', routes)).toBeNull();
    expect(await inAppActionPath('https://example.com', routes)).toBeNull();
    expect(await inAppActionPath('//example.com', routes)).toBeNull();
    expect(await inAppActionPath(null, routes)).toBeNull();
  });
});
