import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { CoreHttp } from '../api/core-http';
import { AuthSession } from '../auth/auth-session';
import type { SessionStatus } from '../auth/auth-session.model';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import type { StandDownHook } from '../tabs/tab-leader.model';
import { NotificationsFeed } from './notifications-feed';
import type { NotificationsFeedEvent, NotificationsUnreadState } from './notifications-feed.model';

const BASE = '/api/tenant/core/v1/notifications';

describe('NotificationsFeed (poll-only)', () => {
  let isLeader: ReturnType<typeof signal<boolean>>;
  let status: ReturnType<typeof signal<SessionStatus>>;
  let standDown: StandDownHook;
  let unregister: ReturnType<typeof vi.fn>;
  let registerStandDown: ReturnType<typeof vi.fn>;
  let http: HttpTestingController;
  let bus: TabBus;
  let publish: MockInstance<TabBus['publish']>;
  let feed: NotificationsFeed;

  async function settle(): Promise<void> {
    for (let round = 0; round < 12; round++) await Promise.resolve();
  }

  function create(leader = true, sessionStatus: SessionStatus = 'signed-in'): void {
    isLeader.set(leader);
    status.set(sessionStatus);
    feed = TestBed.inject(NotificationsFeed);
    TestBed.tick();
  }

  async function config(interval = 30_000): Promise<void> {
    http.expectOne(`${BASE}/config`).flush({
      success: true,
      data: { enabled: true, inAppEnabled: true, realtimeEnabled: false, pollIntervalMs: interval },
    });
    await settle();
  }

  async function count(unreadCount: number): Promise<void> {
    const request = http.expectOne(`${BASE}/unread-count`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    request.flush({ success: true, data: { unreadCount } });
    await settle();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    isLeader = signal(false);
    status = signal<SessionStatus>('signed-in');
    unregister = vi.fn();
    registerStandDown = vi.fn((_owner: string, hook: StandDownHook) => {
      standDown = hook;
      return unregister;
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), CoreHttp, TabBus, NotificationsFeed,
        { provide: AuthSession, useValue: { status } },
        { provide: TabLeader, useValue: { isLeader, registerStandDown } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    bus = TestBed.inject(TabBus);
    bus.bindLeader('local', isLeader, () => undefined);
    publish = vi.spyOn(bus, 'publish');
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('follower never polls', async () => {
    create(false);
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
    expect(feed.unread()).toBeNull();
  });

  it('leader polls at the config interval', async () => {
    create();
    await config();
    await count(3);
    expect(feed.unread()).toEqual({ unreadCount: 3, unreadRevision: null, at: Date.now() });
    await vi.advanceTimersByTimeAsync(29_999);
    http.expectNone(`${BASE}/unread-count`);
    await vi.advanceTimersByTimeAsync(1);
    await count(4);
    await vi.advanceTimersByTimeAsync(30_000);
    await count(5);
    http.expectNone(`${BASE}/config`);
    expect(publish).toHaveBeenLastCalledWith('notifications.unread', {
      unreadCount: 5, unreadRevision: null, at: Date.now(),
    });
  });

  it('config forbidden falls back to sixty seconds', async () => {
    create();
    http.expectOne(`${BASE}/config`).flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, {
      status: 403, statusText: 'Forbidden',
    });
    await settle();
    await count(2);
    await vi.advanceTimersByTimeAsync(59_999);
    http.expectNone(`${BASE}/unread-count`);
    await vi.advanceTimersByTimeAsync(1);
    await count(3);
  });

  it.each([500, 0])('config failure falls back to defaults (status %s)', async (errorStatus) => {
    create();
    const request = http.expectOne(`${BASE}/config`);
    if (errorStatus === 0) request.error(new ProgressEvent('error'));
    else request.flush({}, { status: errorStatus, statusText: 'Server Error' });
    await settle();
    await count(2);
    await vi.advanceTimersByTimeAsync(59_999);
    http.expectNone(`${BASE}/unread-count`);
    await vi.advanceTimersByTimeAsync(1);
    await count(3);
  });

  it.each([[1, 5_000], [4_000_000, 3_600_000]])('poll interval is clamped (%s to %s)', async (value, interval) => {
    create();
    await config(value);
    await count(1);
    await vi.advanceTimersByTimeAsync(interval - 1);
    http.expectNone(`${BASE}/unread-count`);
    await vi.advanceTimersByTimeAsync(1);
    await count(2);
  });

  it('unchanged count is not republished', async () => {
    create();
    await config();
    await count(0);
    const initial = feed.unread();
    await vi.advanceTimersByTimeAsync(30_000);
    await count(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(feed.unread()).toBe(initial);
  });

  it.each([400, 401, 403, 404, 409, 500, 0])('failed poll keeps the last count (status %s)', async (errorStatus) => {
    create();
    await config();
    await count(4);
    const previous = feed.unread();
    await vi.advanceTimersByTimeAsync(30_000);
    const request = http.expectOne(`${BASE}/unread-count`);
    if (errorStatus === 0) request.error(new ProgressEvent('error'));
    else request.flush({}, { status: errorStatus, statusText: 'Failed' });
    await settle();
    expect(feed.unread()).toBe(previous);
    expect(publish).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    await count(6);
    expect(feed.unread()?.unreadCount).toBe(6);
  });

  it('followers read the published count', () => {
    create(false);
    const value: NotificationsUnreadState = { unreadCount: 7, unreadRevision: null, at: Date.now() };
    bus.bindLeader('remote', () => true, () => undefined);
    bus.publish('notifications.unread', value);
    bus.bindLeader('local', isLeader, () => undefined);
    expect(feed.unread()).toEqual(value);
    http.expectNone(() => true);
  });

  it('stand down stops polling', async () => {
    create();
    await config();
    await count(1);
    expect(registerStandDown).toHaveBeenCalledWith('notifications-feed', expect.any(Function));
    await standDown();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
    isLeader.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
  });

  it('new leader starts polling', async () => {
    create(false);
    isLeader.set(true);
    TestBed.tick();
    await config();
    await count(2);
    isLeader.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
    isLeader.set(true);
    TestBed.tick();
    await config(5_000);
    await count(3);
    await vi.advanceTimersByTimeAsync(5_000);
    await count(4);
  });

  it('sign out stops the feed', async () => {
    create();
    await config();
    await count(2);
    status.set('signed-out');
    expect(feed.unread()).toBeNull();
    TestBed.tick();
    expect(bus.state<NotificationsUnreadState>('notifications.unread')()).toBeNull();
    await vi.advanceTimersByTimeAsync(120_000);
    http.expectNone(() => true);
  });

  it.each<SessionStatus>(['unknown', 'loading', 'failed', 'signed-out'])('does no work while session is %s', async (value) => {
    create(true, value);
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
    expect(feed.unread()).toBeNull();
    status.set('signed-in');
    TestBed.tick();
    await config();
    await count(1);
  });

  it('follower clears its visible count on sign out', () => {
    create(false);
    bus.bindLeader('remote', () => true, () => undefined);
    bus.publish('notifications.unread', { unreadCount: 4, unreadRevision: null, at: Date.now() });
    bus.bindLeader('local', isLeader, () => undefined);
    publish.mockClear();
    status.set('signed-out');
    TestBed.tick();
    expect(feed.unread()).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it('pending config cannot start polling after stand down', async () => {
    create();
    await standDown();
    await config();
    await vi.advanceTimersByTimeAsync(120_000);
    http.expectNone(() => true);
  });

  it('pending poll cannot publish after leadership changes', async () => {
    create();
    await config();
    const pending = http.expectOne(`${BASE}/unread-count`);
    await standDown();
    isLeader.set(false);
    TestBed.tick();
    isLeader.set(true);
    TestBed.tick();
    await config();
    await count(9);
    pending.flush({ success: true, data: { unreadCount: 1 } });
    await settle();
    expect(feed.unread()?.unreadCount).toBe(9);
  });

  it('pending poll cannot restore state after sign out', async () => {
    create();
    await config();
    status.set('signed-out');
    TestBed.tick();
    await count(3);
    expect(feed.unread()).toBeNull();
    expect(bus.state<NotificationsUnreadState>('notifications.unread')()).toBeNull();
  });

  it('slow polls do not overlap', async () => {
    create();
    await config();
    const pending = http.expectOne(`${BASE}/unread-count`);
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(`${BASE}/unread-count`);
    pending.flush({ success: true, data: { unreadCount: 2 } });
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    await count(3);
  });

  it('onEvent subscribes and unregisters from the event topic', async () => {
    create();
    await config();
    await count(1);
    const handler = vi.fn();
    const off = feed.onEvent(handler);
    const event: NotificationsFeedEvent = { kind: 'sync' };
    bus.publish('notifications.event', event);
    expect(handler).toHaveBeenCalledWith(event);
    off();
    bus.publish('notifications.event', { kind: 'created', notificationId: 'n1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('destroy stops polling and unregisters the stand down hook', async () => {
    create();
    await config();
    await count(1);
    TestBed.resetTestingModule();
    expect(unregister).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(120_000);
    http.expectNone(() => true);
  });
});
