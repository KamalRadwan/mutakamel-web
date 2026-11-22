import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Language, LanguageState } from '../../../core/i18n/language';
import {
  fakeNotificationKeys,
  resetFakeNotifications,
  setFakeNotificationUserInactive,
} from './notifications.fake';
import { NotificationsState } from './notifications-state';

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

describe('NotificationsState sends one x-idempotency-key per user action', () => {
  let state: NotificationsState;

  beforeEach(async () => {
    resetFakeNotifications();
    document.documentElement.lang = 'en';
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageState, useValue: { current: signal<Language>('en') } }],
    });
    state = TestBed.inject(NotificationsState);
    TestBed.tick();
    await until(() => state.items().length > 1 && !state.loading());
  });

  afterEach(() => setFakeNotificationUserInactive(false));

  it('reuses the key when a failed mark-read is retried, and starts a new one after success', async () => {
    const unread = state.items().filter((item) => item.readAt === null);
    const [a, b] = unread;

    setFakeNotificationUserInactive(true);
    await state.markRead(a.id);
    expect(state.items().find((item) => item.id === a.id)?.readAt).toBeNull();
    setFakeNotificationUserInactive(false);
    await state.markRead(a.id);

    const [first, retry] = keysFor(`read:${a.id}`);
    expect(first).toMatch(UUID_V7);
    expect(retry).toBe(first);

    await state.markRead(b.id);
    expect(keysFor(`read:${b.id}`)[0]).not.toBe(first);
  });

  it('sends a fresh key on acknowledge, dismiss and read-all', async () => {
    const [a, b] = state.items();
    await state.acknowledge(a.id);
    await state.dismiss(b.id);
    await state.markAllRead();
    const keys = [keysFor(`acknowledge:${a.id}`)[0], keysFor(`dismiss:${b.id}`)[0], keysFor('read-all')[0]];
    for (const key of keys) expect(key).toMatch(UUID_V7);
    expect(new Set(keys).size).toBe(3);
  });

  it('forgets the key once the item is gone (404 NOTIFICATION_NOT_FOUND)', async () => {
    const [a] = state.items();
    await state.dismiss(a.id);
    state.items.set([a]);
    await state.dismiss(a.id);
    const [done, gone] = keysFor(`dismiss:${a.id}`);
    expect(gone).toMatch(UUID_V7);
    expect(gone).not.toBe(done);
  });
});
