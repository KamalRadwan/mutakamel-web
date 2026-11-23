import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../api/core-http';
import { AuthSession } from '../auth/auth-session';
import type { SessionStatus } from '../auth/auth-session.model';
import { Notify } from '../notify/notify';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import type { StandDownHook } from '../tabs/tab-leader.model';
import { RealtimeClient } from './realtime-client';
import {
  parseRealtimeEvent,
  type RealtimeConnectionState,
  type RealtimeEvent,
  type RealtimeEventData,
  type RealtimeRecovery,
} from './realtime-client.model';
import { NotificationsFeed } from './notifications-feed';
import type { NotificationsFeedEvent, NotificationsUnreadState } from './notifications-feed.model';

const BASE = '/api/tenant/core/v1/notifications';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOTICE = '33333333-3333-4333-8333-333333333333';
const RECIPIENT = '44444444-4444-4444-8444-444444444444';
const EVENT_ID = '019ab37a-1234-7123-8123-123456789abc';
const AT = '2026-11-23T12:00:00.000Z';
const envelope = { contractVersion: 1, eventId: EVENT_ID, occurredAt: AT, correlationId: USER };
const ONLINE: RealtimeConnectionState = { status: 'connected', stale: false, failure: null, at: 1 };
type Capabilities = RealtimeEventData<'session.ready.v1'>['payload']['capabilities'];

// Payloads pass the same RT10 parser as the real client before entering the feed adapter.
function created(silent = false): RealtimeEvent {
  return {
    name: 'notification.created.v1',
    event: parseRealtimeEvent('notification.created.v1', {
      ...envelope,
      payload: {
        notificationId: NOTICE,
        recipientId: RECIPIENT,
        deliveryEventId: EVENT_ID,
        cursor: 'opaque-realtime-cursor',
        type: 'core.activity.assigned',
        title: 'Assigned',
        body: 'A task',
        priority: 'P2_NORMAL',
        entity: null,
        action: null,
        createdAt: AT,
        expiresAt: null,
        silent,
        metadata: {},
      },
    }),
  };
}
function updated(
  version = 2,
  change: 'READ' | 'ACKNOWLEDGED' | 'DISMISSED' = 'READ',
): RealtimeEvent {
  return {
    name: 'notification.updated.v1',
    event: parseRealtimeEvent('notification.updated.v1', {
      ...envelope,
      payload: {
        notificationId: NOTICE,
        recipientId: RECIPIENT,
        change,
        state: {
          readAt: AT,
          acknowledgedAt: change === 'ACKNOWLEDGED' ? AT : null,
          dismissedAt: change === 'DISMISSED' ? AT : null,
        },
        changedAt: AT,
        recipientStateVersion: version,
      },
    }),
  };
}
function unread(unreadCount: number, unreadRevision: number): RealtimeEvent {
  return {
    name: 'notification.unread-count.changed.v1',
    event: parseRealtimeEvent('notification.unread-count.changed.v1', {
      ...envelope,
      payload: { unreadCount, unreadRevision, changedAt: AT },
    }),
  };
}

describe('NotificationsFeed', () => {
  let isLeader: ReturnType<typeof signal<boolean>>;
  let status: ReturnType<typeof signal<SessionStatus>>;
  let me: ReturnType<typeof signal<{ id: string } | null>>;
  let connection: ReturnType<typeof signal<RealtimeConnectionState>>;
  let capabilities: ReturnType<typeof signal<Capabilities | null>>;
  let recoveries: ReturnType<typeof signal<RealtimeRecovery[]>>;
  let emit: (event: RealtimeEvent) => void;
  let standDown: StandDownHook;
  let http: HttpTestingController;
  let bus: TabBus;
  let feed: NotificationsFeed;
  let notify: Notify;
  const unsubscribe = vi.fn();
  const unregister = vi.fn();
  const retrySocket = vi.fn();
  const completeRecovery = vi.fn();

  async function settle(): Promise<void> {
    for (let round = 0; round < 12; round++) await Promise.resolve();
    TestBed.tick();
  }
  function create(leader = true, sessionStatus: SessionStatus = 'signed-in'): void {
    isLeader.set(leader);
    status.set(sessionStatus);
    feed = TestBed.inject(NotificationsFeed);
    TestBed.tick();
  }
  async function config(overrides: Record<string, unknown> = {}): Promise<void> {
    http.expectOne(`${BASE}/config`).flush({
      success: true,
      data: {
        enabled: true,
        inAppEnabled: true,
        realtimeEnabled: true,
        pollIntervalMs: 5_000,
        ...overrides,
      },
    });
    await settle();
  }
  function pendingSnapshot() {
    const request = http.expectOne((request) => request.url === BASE);
    expect(request.request.params.keys()).toEqual(['limit']);
    expect(request.request.params.get('limit')).toBe('1');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    return request;
  }
  async function snapshot(unreadCount = 3, unreadRevision = 1): Promise<void> {
    pendingSnapshot().flush({
      success: true,
      data: {
        items: [],
        unreadCount,
        unreadRevision,
        unreadChangedAt: AT,
        nextCursor: null,
        hasNext: false,
      },
    });
    await settle();
  }
  async function ready(overrides: Record<string, unknown> = {}): Promise<void> {
    create();
    await config(overrides);
    await snapshot();
  }
  function recovery(
    id = 'notifications-1',
    scope: RealtimeRecovery['scope'] = 'NOTIFICATIONS',
  ): void {
    recoveries.update((value) => [
      ...value,
      { id, scope, reason: 'RECOVERY_INCOMPLETE', at: Date.now() },
    ]);
    connection.set({ status: 'stale', stale: true, failure: null, at: Date.now() });
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    isLeader = signal(false);
    status = signal<SessionStatus>('signed-in');
    me = signal<{ id: string } | null>({ id: USER });
    connection = signal<RealtimeConnectionState>(ONLINE);
    capabilities = signal<Capabilities | null>({
      notifications: { receive: true },
      crmLeads: { receive: false },
      presence: { publishSelf: false, watchMode: 'NONE' },
    });
    recoveries = signal<RealtimeRecovery[]>([]);
    completeRecovery.mockImplementation((id: string) => {
      recoveries.update((values) => values.filter((value) => value.id !== id));
      if (recoveries().length === 0) connection.set(ONLINE);
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CoreHttp,
        TabBus,
        NotificationsFeed,
        Notify,
        { provide: AuthSession, useValue: { status, me } },
        {
          provide: TabLeader,
          useValue: {
            isLeader,
            registerStandDown: (_owner: string, hook: StandDownHook) => {
              standDown = hook;
              return unregister;
            },
          },
        },
        {
          provide: RealtimeClient,
          useValue: {
            connection,
            capabilities,
            recoveries,
            onEvent: (handler: (event: RealtimeEvent) => void) => {
              emit = handler;
              return unsubscribe;
            },
            completeRecovery,
            retry: retrySocket,
          },
        },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    bus = TestBed.inject(TabBus);
    bus.bindLeader('local', isLeader, () => undefined);
    notify = TestBed.inject(Notify);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('boots from an authoritative snapshot and does not poll a healthy socket', async () => {
    await ready();
    expect(feed.unread()).toEqual({ unreadCount: 3, unreadRevision: 1, at: Date.now() });
    expect(feed.state().status).toBe('live');
    expect(feed.stale()).toBe(false);
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
  });

  it('maps validated creations to the existing inbox topic and supports unsubscribe', async () => {
    await ready();
    const handler = vi.fn();
    const off = feed.onEvent(handler);
    emit(created());
    expect(handler).toHaveBeenCalledExactlyOnceWith({
      kind: 'created',
      notificationId: NOTICE,
      notice: { eventId: EVENT_ID, title: 'Assigned', body: 'A task' },
    });
    off();
    emit(created());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('shows a new-notification info toast once per event and honors silent delivery', async () => {
    await ready();
    emit(created(true));
    expect(notify.toasts()).toEqual([]);
    emit(created());
    emit(created());
    expect(notify.toasts()).toEqual([
      expect.objectContaining({ type: 'info', title: 'Assigned', text: 'A task', count: 1 }),
    ]);
  });

  it('shows shared notification notices once in a follower and ignores other users', () => {
    create(false);
    bus.bindLeader(
      'remote',
      () => true,
      () => undefined,
    );
    const value: NotificationsFeedEvent = {
      kind: 'created',
      notificationId: NOTICE,
      notice: { eventId: EVENT_ID, title: 'Assigned', body: 'A task' },
    };
    bus.publish('notifications.event', { userId: OTHER, value });
    expect(notify.toasts()).toEqual([]);
    bus.publish('notifications.event', { userId: USER, value });
    bus.publish('notifications.event', { userId: USER, value });
    expect(notify.toasts()).toHaveLength(1);
    expect(notify.toasts()[0]?.count).toBe(1);
    bus.bindLeader('local', isLeader, () => undefined);
  });

  it.each(['READ', 'ACKNOWLEDGED', 'DISMISSED'] as const)(
    'maps %s and ignores equal or older recipient versions',
    async (change) => {
      await ready();
      const handler = vi.fn();
      feed.onEvent(handler);
      emit(updated(3, change));
      emit(updated(2, change));
      emit(updated(3, change));
      expect(handler).toHaveBeenCalledExactlyOnceWith({
        kind: 'updated',
        notificationId: NOTICE,
        change,
        readAt: AT,
        acknowledgedAt: change === 'ACKNOWLEDGED' ? AT : null,
        recipientStateVersion: 3,
      });
    },
  );

  it('does not let out-of-order events or an in-flight HTTP snapshot roll back unread revisions', async () => {
    create();
    await config();
    emit(unread(7, 9));
    emit(unread(8, 8));
    emit(unread(12, 9));
    await snapshot(3, 2);
    expect(feed.unread()?.unreadCount).toBe(7);
    expect(feed.unread()?.unreadRevision).toBe(9);
    emit(unread(0, 10));
    expect(feed.unread()?.unreadCount).toBe(0);
  });

  it('polls and resyncs the inbox even when the count is unchanged with realtime disabled', async () => {
    await ready({ realtimeEnabled: false });
    const handler = vi.fn();
    feed.onEvent(handler);
    emit(created());
    expect(handler).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    await snapshot();
    expect(handler).toHaveBeenCalledExactlyOnceWith({ kind: 'sync' });
    expect(feed.state().status).toBe('polling');
    expect(feed.stale()).toBe(false);
  });

  it('uses HTTP when notification receive capability is absent', async () => {
    capabilities.set({
      notifications: { receive: false },
      crmLeads: { receive: false },
      presence: { publishSelf: false, watchMode: 'NONE' },
    });
    await ready();
    const handler = vi.fn();
    feed.onEvent(handler);
    emit(created());
    expect(handler).not.toHaveBeenCalled();
    expect(feed.state().status).toBe('polling');
    await vi.advanceTimersByTimeAsync(5_000);
    await snapshot(4, 2);
  });

  it.each([{ enabled: false }, { inAppEnabled: false }])(
    'honors disabled config %j without polling or events',
    async (flags) => {
      create();
      await config(flags);
      emit(created());
      emit(unread(99, 100));
      await vi.advanceTimersByTimeAsync(3_600_000);
      http.expectNone(() => true);
      expect(feed.state().status).toBe('disabled');
      expect(feed.unread()).toBeNull();
    },
  );

  it.each([0, 1, 4_999, 9_000_000])(
    'bounds the configured polling interval %s',
    async (interval) => {
      await ready({ realtimeEnabled: false, pollIntervalMs: interval });
      const delay = Math.max(5_000, Math.min(3_600_000, interval));
      await vi.advanceTimersByTimeAsync(delay - 1);
      http.expectNone(() => true);
      await vi.advanceTimersByTimeAsync(1);
      await snapshot();
    },
  );

  it('keeps the last snapshot and a persistent visible stale state while the socket is unavailable', async () => {
    await ready();
    connection.set({
      status: 'unavailable',
      stale: true,
      failure: {
        code: 'REALTIME.CLIENT.UNAVAILABLE',
        status: 503,
        retryable: false,
        retryAfterMs: null,
        correlationId: null,
      },
      at: Date.now(),
    });
    TestBed.tick();
    expect(feed.stale()).toBe(true);
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    await snapshot(4, 2);
    expect(feed.stale()).toBe(true);
    expect(feed.unread()?.unreadCount).toBe(4);
    // Inbox HTTP loads also call connectionRestored; the live feed must keep its stale notice visible.
    notify.connectionRestored();
    TestBed.tick();
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
    connection.set(ONLINE);
    TestBed.tick();
    expect(feed.stale()).toBe(false);
    expect(notify.toasts()).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
  });

  it('completes only notification recovery after HTTP succeeds and fans out one inbox sync', async () => {
    await ready();
    const handler = vi.fn();
    feed.onEvent(handler);
    recovery('crm', 'CRM_LEADS');
    http.expectNone(() => true);
    recovery();
    expect(completeRecovery).not.toHaveBeenCalled();
    await snapshot(0, 2);
    expect(completeRecovery).toHaveBeenCalledExactlyOnceWith('notifications-1');
    expect(handler).toHaveBeenCalledExactlyOnceWith({ kind: 'sync' });
    expect(recoveries().map((item) => item.id)).toEqual(['crm']);
  });

  it('refreshes ALL without claiming that CRM or presence recovered', async () => {
    capabilities.set({
      notifications: { receive: true },
      crmLeads: { receive: true },
      presence: { publishSelf: false, watchMode: 'NONE' },
    });
    await ready();
    recovery('all', 'ALL');
    await snapshot(0, 2);
    expect(completeRecovery).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('completes ALL when notifications are the only granted scope', async () => {
    await ready();
    recovery('all', 'ALL');
    await snapshot(0, 2);
    expect(completeRecovery).toHaveBeenCalledExactlyOnceWith('all');
    expect(feed.state().status).toBe('live');
  });

  it('does another snapshot for recovery that arrived during a pending request', async () => {
    create();
    await config();
    const pending = pendingSnapshot();
    recovery();
    pending.flush({
      success: true,
      data: {
        items: [],
        unreadCount: 1,
        unreadRevision: 1,
        unreadChangedAt: AT,
        nextCursor: null,
        hasNext: false,
      },
    });
    await settle();
    expect(completeRecovery).not.toHaveBeenCalled();
    await snapshot(2, 2);
    expect(completeRecovery).toHaveBeenCalledExactlyOnceWith('notifications-1');
  });

  it('does not complete a failed recovery and retries with bounded backoff', async () => {
    await ready();
    recovery();
    pendingSnapshot().flush({}, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(completeRecovery).not.toHaveBeenCalled();
    expect(feed.stale()).toBe(true);
    expect(feed.unread()?.unreadCount).toBe(3);
    await vi.advanceTimersByTimeAsync(9_999);
    http.expectNone(() => true);
    await vi.advanceTimersByTimeAsync(1);
    await snapshot(2, 2);
    expect(completeRecovery).toHaveBeenCalledOnce();
    expect(feed.state().status).toBe('live');
    expect(notify.toasts()).toEqual([]);
  });

  it.each([401, 403, 404])(
    'stops HTTP on terminal status %s and preserves the failure code',
    async (code) => {
      create();
      http
        .expectOne(`${BASE}/config`)
        .flush(
          { errorCode: 'NOTIFICATION_USER_NOT_FOUND' },
          { status: code, statusText: 'Denied' },
        );
      await settle();
      expect(feed.failed()).toBe(true);
      expect(feed.state().failure?.code).toBe('NOTIFICATION_USER_NOT_FOUND');
      expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
      await vi.advanceTimersByTimeAsync(3_600_000);
      http.expectNone(() => true);
    },
  );

  it('does not poll unknown feature flags after config failure and retries the config', async () => {
    create();
    http.expectOne(`${BASE}/config`).error(new ProgressEvent('error'));
    await settle();
    expect(feed.state().failure?.code).toBe('NETWORK_ERROR');
    http.expectNone(BASE);
    await vi.advanceTimersByTimeAsync(120_000);
    await config({ enabled: false });
    expect(feed.state().status).toBe('disabled');
    expect(notify.toasts()).toEqual([]);
  });

  it('rejects malformed successful HTTP data instead of publishing it', async () => {
    create();
    await config();
    pendingSnapshot().flush({ success: true, data: { unreadCount: -1, unreadRevision: 2 } });
    await settle();
    expect(feed.unread()).toBeNull();
    expect(feed.state().failure?.status).toBe(502);
  });

  it.each([
    { enabled: 'true' },
    { inAppEnabled: null },
    { realtimeEnabled: 1 },
    { pollIntervalMs: '5000' },
  ])('rejects malformed config %j without inventing enabled flags', async (flags) => {
    create();
    await config(flags);
    expect(feed.state().failure?.status).toBe(502);
    http.expectNone(BASE);
  });

  it('marks a stalled request stale without starting overlapping requests', async () => {
    create();
    await config({ realtimeEnabled: false });
    const pending = pendingSnapshot();
    await vi.advanceTimersByTimeAsync(10_000);
    TestBed.tick();
    expect(feed.state().failure?.code).toBe('REALTIME.CLIENT.TIMEOUT');
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
    http.expectNone(() => true);
    pending.flush({
      success: true,
      data: {
        items: [],
        unreadCount: 1,
        unreadRevision: 1,
        unreadChangedAt: AT,
        nextCursor: null,
        hasNext: false,
      },
    });
    await settle();
    expect(feed.state().status).toBe('polling');
    expect(notify.toasts()).toEqual([]);
  });

  it('honors Retry-After on a rate-limited fallback', async () => {
    create();
    await config({ realtimeEnabled: false });
    pendingSnapshot().flush(
      {},
      { status: 429, statusText: 'Limited', headers: { 'Retry-After': '45' } },
    );
    await settle();
    await vi.advanceTimersByTimeAsync(44_999);
    http.expectNone(() => true);
    await vi.advanceTimersByTimeAsync(1);
    await snapshot();
  });

  it('stops after six consecutive failures and supports an explicit retry', async () => {
    create();
    await config();
    for (let failure = 1; failure <= 6; failure++) {
      pendingSnapshot().flush({}, { status: 500, statusText: 'Failed' });
      await settle();
      if (failure < 6) await vi.advanceTimersByTimeAsync(Math.min(300_000, 5_000 * 2 ** failure));
    }
    expect(feed.failed()).toBe(true);
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
    feed.retry();
    expect(retrySocket).toHaveBeenCalledOnce();
    TestBed.tick();
    expect(notify.toasts().some((toast) => toast.pinned)).toBe(true);
    await config();
    await snapshot();
    expect(feed.failed()).toBe(false);
  });

  it('never overlaps slow fallback reads', async () => {
    create();
    await config({ realtimeEnabled: false });
    const pending = pendingSnapshot();
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
    pending.flush({
      success: true,
      data: {
        items: [],
        unreadCount: 1,
        unreadRevision: 1,
        unreadChangedAt: AT,
        nextCursor: null,
        hasNext: false,
      },
    });
    await settle();
    await vi.advanceTimersByTimeAsync(5_000);
    await snapshot();
  });

  it('uses shared scoped state/events in followers without HTTP or duplicate socket mapping', async () => {
    create(false);
    const handler = vi.fn();
    feed.onEvent(handler);
    emit(created());
    bus.bindLeader(
      'remote',
      () => true,
      () => undefined,
    );
    bus.publish('notifications.unread', {
      userId: USER,
      value: { unreadCount: 7, unreadRevision: 4, at: 1 },
    });
    bus.publish('notifications.feed.state', {
      userId: USER,
      value: { status: 'stale', stale: true, failure: null, at: 1 },
    });
    bus.publish('notifications.event', {
      userId: USER,
      value: { kind: 'created', notificationId: NOTICE },
    });
    bus.publish('notifications.event', { userId: OTHER, value: { kind: 'sync' } });
    bus.bindLeader('local', isLeader, () => undefined);
    TestBed.tick();
    expect(feed.unread()?.unreadCount).toBe(7);
    expect(feed.stale()).toBe(true);
    expect(handler).toHaveBeenCalledExactlyOnceWith({ kind: 'created', notificationId: NOTICE });
    me.set({ id: OTHER });
    expect(feed.unread()).toBeNull();
    expect(feed.state().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
  });

  it.each<SessionStatus>(['unknown', 'loading', 'failed', 'signed-out'])(
    'does no work while session is %s',
    async (value) => {
      create(true, value);
      emit(created());
      feed.retry();
      await vi.advanceTimersByTimeAsync(3_600_000);
      http.expectNone(() => true);
      expect(feed.unread()).toBeNull();
    },
  );

  it('ignores an old identity response when another user signs in', async () => {
    create();
    await config();
    const old = pendingSnapshot();
    me.set({ id: OTHER });
    TestBed.tick();
    await config();
    await snapshot(9, 2);
    old.flush({
      success: true,
      data: {
        items: [],
        unreadCount: 99,
        unreadRevision: 99,
        unreadChangedAt: AT,
        nextCursor: null,
        hasNext: false,
      },
    });
    await settle();
    expect(feed.unread()?.unreadCount).toBe(9);
  });

  it('ignores a pending response after logout', async () => {
    create();
    await config();
    status.set('signed-out');
    TestBed.tick();
    await snapshot();
    expect(feed.unread()).toBeNull();
    expect(bus.state<NotificationsUnreadState>('notifications.unread')()).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
  });

  it('stand-down blocks pending config and realtime callbacks until a new leadership term', async () => {
    create();
    await standDown();
    await config();
    emit(created());
    connection.set({ ...ONLINE, at: 9 });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
    isLeader.set(false);
    TestBed.tick();
    isLeader.set(true);
    TestBed.tick();
    await config();
    await snapshot();
  });

  it('stops on rejected socket admission and does not apply a pending snapshot', async () => {
    create();
    await config();
    connection.set({
      status: 'failed',
      stale: true,
      failure: {
        code: 'REALTIME.AUTH.ACCESS_REVOKED',
        status: 403,
        retryable: false,
        retryAfterMs: null,
        correlationId: null,
      },
      at: 1,
    });
    TestBed.tick();
    await snapshot();
    expect(feed.unread()).toBeNull();
    expect(feed.failed()).toBe(true);
    await vi.advanceTimersByTimeAsync(3_600_000);
    http.expectNone(() => true);
  });

  it('destroy unsubscribes and cancels scheduled fallback', async () => {
    await ready({ realtimeEnabled: false });
    TestBed.resetTestingModule();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    http.expectNone(() => true);
  });
});
