import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { Language, LanguageState } from '../../../core/i18n/language';
import { NOTIFICATION_INBOX_PAGE_SIZE, NotificationInbox } from './notification-inbox';
import { NotificationsState } from './notifications-state';
import {
  fakeNotificationKeys,
  resetFakeNotifications,
  setFakeNotificationError,
  setFakeNotificationUserInactive,
} from './notifications.fake';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function keysFor(action: string): (string | undefined)[] {
  return fakeNotificationKeys()
    .filter((entry) => entry.action === action)
    .map((entry) => entry.key);
}

describe('NotificationInbox', () => {
  let lang: ReturnType<typeof signal<Language>>;

  async function setupInbox(pageSize = 20): Promise<NotificationInbox> {
    lang = signal<Language>('en');
    TestBed.configureTestingModule({
      providers: [
        NotificationInbox,
        { provide: NOTIFICATION_INBOX_PAGE_SIZE, useValue: pageSize },
        { provide: LanguageState, useValue: { current: lang } },
      ],
    });
    const inbox = TestBed.inject(NotificationInbox);
    TestBed.tick();
    await until(() => !inbox.loading());
    return inbox;
  }

  beforeEach(() => {
    resetFakeNotifications();
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    setFakeNotificationError(null);
    setFakeNotificationUserInactive(false);
  });

  it('sends unreadOnly=true when enabled and pages with nextCursor', async () => {
    const inbox = await setupInbox(2);
    expect(inbox.items()).toHaveLength(2);
    expect(inbox.nextCursor()).not.toBeNull();

    await inbox.loadMore();
    expect(inbox.items()).toHaveLength(4);

    inbox.unreadOnly.set(true);
    await inbox.reload();
    expect(inbox.items()).toHaveLength(2);
    expect(inbox.items().every((item) => item.readAt === null)).toBe(true);
    expect(inbox.nextCursor()).not.toBeNull();

    await inbox.loadMore();
    expect(inbox.items()).toHaveLength(4);
    expect(inbox.items().every((item) => item.readAt === null)).toBe(true);
    expect(inbox.nextCursor()).toBeNull();

    const firstUnread = inbox.items()[0];
    await inbox.markRead(firstUnread.id);
    // Item stays visible under unreadOnly until the next reload so nothing jumps under the cursor.
    expect(inbox.items().some((item) => item.id === firstUnread.id && item.readAt !== null)).toBe(true);
    expect(inbox.unreadCount()).toBe(3);
  });

  it('rolls back optimistic markRead, acknowledge and dismiss on 500 and reuses the idempotency key on retry', async () => {
    const inbox = await setupInbox();
    const unread = inbox.items().filter((item) => item.readAt === null);
    const [first, second, third] = unread;
    const startUnread = inbox.unreadCount();

    setFakeNotificationError(new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
    await expect(inbox.markRead(first.id)).rejects.toMatchObject({ status: 500 });
    expect(inbox.items().find((item) => item.id === first.id)?.readAt).toBeNull();
    expect(inbox.unreadCount()).toBe(startUnread);

    await expect(inbox.acknowledge(second.id)).rejects.toMatchObject({ status: 500 });
    expect(inbox.items().find((item) => item.id === second.id)?.acknowledgedAt).toBeNull();
    expect(inbox.items().find((item) => item.id === second.id)?.readAt).toBeNull();
    expect(inbox.unreadCount()).toBe(startUnread);

    await expect(inbox.dismiss(third.id)).rejects.toMatchObject({ status: 500 });
    expect(inbox.items().some((item) => item.id === third.id)).toBe(true);
    expect(inbox.unreadCount()).toBe(startUnread);

    setFakeNotificationError(null);
    await inbox.markRead(first.id);
    await inbox.acknowledge(second.id);
    await inbox.dismiss(third.id);

    const [read1, readRetry] = keysFor(`read:${first.id}`);
    expect(read1).toMatch(UUID_V7);
    expect(readRetry).toBe(read1);

    const [ack1, ackRetry] = keysFor(`acknowledge:${second.id}`);
    expect(ack1).toMatch(UUID_V7);
    expect(ackRetry).toBe(ack1);

    const [dismiss1, dismissRetry] = keysFor(`dismiss:${third.id}`);
    expect(dismiss1).toMatch(UUID_V7);
    expect(dismissRetry).toBe(dismiss1);
  });

  it('drops an item and forgets its key on 404 NOTIFICATION_NOT_FOUND', async () => {
    const inbox = await setupInbox();
    const target = inbox.items()[0];
    await inbox.dismiss(target.id);

    inbox.items.set([target]);
    await expect(inbox.dismiss(target.id)).resolves.toBeUndefined();
    expect(inbox.items()).toEqual([]);

    const [firstKey, secondKey] = keysFor(`dismiss:${target.id}`);
    expect(secondKey).toMatch(UUID_V7);
    expect(secondKey).not.toBe(firstKey);
  });

  it('reloads once from the first page when loadMore receives NOTIFICATION_CURSOR_INVALID', async () => {
    const inbox = await setupInbox(2);
    const firstPageIds = inbox.items().map((item) => item.id);

    inbox.nextCursor.set('not-a-valid-cursor');
    await expect(inbox.loadMore()).resolves.toBeUndefined();

    expect(inbox.loadFailed()).toBe(false);
    expect(inbox.items().map((item) => item.id)).toEqual(firstPageIds);
    expect(inbox.nextCursor()).not.toBeNull();
  });

  it('sets userMissing on 404 NOTIFICATION_USER_NOT_FOUND without setting loadFailed', async () => {
    const inbox = await setupInbox();
    setFakeNotificationUserInactive(true);
    await inbox.reload();

    expect(inbox.userMissing()).toBe(true);
    expect(inbox.loadFailed()).toBe(false);
  });

  it('syncs writes across independent inboxes via NotificationsSync', async () => {
    lang = signal<Language>('en');
    TestBed.configureTestingModule({
      providers: [NotificationInbox, { provide: LanguageState, useValue: { current: lang } }],
    });
    const bellState = TestBed.inject(NotificationsState);
    const pageInbox = TestBed.inject(NotificationInbox);
    TestBed.tick();
    await until(() => !bellState.loading() && !pageInbox.loading());

    const startUnread = bellState.unreadCount();
    const target = pageInbox.items().find((item) => item.readAt === null)!;
    await pageInbox.dismiss(target.id);
    TestBed.tick();

    await until(() => !bellState.loading() && !bellState.items().some((item) => item.id === target.id));
    expect(bellState.unreadCount()).toBe(startUnread - 1);
  });
});
