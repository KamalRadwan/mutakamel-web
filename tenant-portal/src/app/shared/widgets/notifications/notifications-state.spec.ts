import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Language, LanguageState } from '../../../core/i18n/language';
import en from '../../../../../public/i18n/en.json';
import ar from '../../../../../public/i18n/ar.json';
import { getNotification, getUnreadNotificationCount } from './notifications.api';
import { resetFakeNotifications } from './notifications.fake';
import { KNOWN_NOTIFICATION_TYPES } from './notifications.model';
import { NotificationsState } from './notifications-state';

async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('NotificationsState reads through notifications.api', () => {
  let state: NotificationsState;

  beforeEach(async () => {
    resetFakeNotifications();
    document.documentElement.lang = 'en';
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageState, useValue: { current: signal<Language>('en') } }],
    });
    state = TestBed.inject(NotificationsState);
    TestBed.tick();
    await until(() => state.items().length > 0 && !state.loading());
  });

  it('loads the first page and the server unread count', async () => {
    expect(state.unreadCount()).toBe((await getUnreadNotificationCount()).unreadCount);
    expect(state.items().every((item) => typeof item.notificationType === 'string')).toBe(true);
  });

  it('markRead updates the item, the count and the server', async () => {
    const target = state.items().find((item) => item.readAt === null);
    expect(target).toBeDefined();
    const before = state.unreadCount();
    await state.markRead(target!.id);
    expect(state.items().find((item) => item.id === target!.id)?.readAt).not.toBeNull();
    expect(state.unreadCount()).toBe(before - 1);
    expect((await getNotification(target!.id)).readAt).not.toBeNull();
  });

  it('markAllRead clears the unread count', async () => {
    await state.markAllRead();
    expect(state.unreadCount()).toBe(0);
    expect(state.items().every((item) => item.readAt !== null)).toBe(true);
  });

  it('dismiss removes the item locally and on the server', async () => {
    const id = state.items()[0].id;
    await state.dismiss(id);
    expect(state.items().some((item) => item.id === id)).toBe(false);
    await expect(getNotification(id)).rejects.toMatchObject({ status: 404, code: 'NOTIFICATION_NOT_FOUND' });
  });

  it('drops an item the server no longer has (404 NOTIFICATION_NOT_FOUND)', async () => {
    const target = state.items().find((item) => item.readAt === null)!;
    await state.dismiss(target.id);
    state.items.update((items) => [target, ...items]);
    await state.markRead(target.id);
    expect(state.items().some((item) => item.id === target.id)).toBe(false);
  });
});

describe('notification type labels', () => {
  type Dict = { notifications: { types: Record<string, string> } };
  it.each([
    ['en', en as unknown as Dict],
    ['ar', ar as unknown as Dict],
  ])('%s has a label for every known type plus other', (_lang, dict) => {
    for (const type of KNOWN_NOTIFICATION_TYPES) {
      expect(dict.notifications.types[type.replace(/\./g, '_')]).toBeTruthy();
    }
    expect(dict.notifications.types['other']).toBeTruthy();
  });
});
