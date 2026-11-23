import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../auth/auth-session';
import type { SessionStatus } from '../auth/auth-session.model';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import type { StandDownHook } from '../tabs/tab-leader.model';
import { RealtimeClient } from './realtime-client';
import {
  REALTIME_SOCKET_FACTORY,
  type RealtimeEvent,
  type RealtimeScoped,
  type RealtimeSocket,
  type RealtimeSocketOptions,
} from './realtime-client.model';

const ID = '019aabbc-0000-7000-8000-000000000001';
const ID2 = '019aabbc-0000-7000-8000-000000000002';
const AT = '2026-11-23T12:00:00.000Z';
const TAB = '01234567-0123-4123-8123-012345678901';

class ControlledSocket implements RealtimeSocket {
  readonly handlers = new Map<string, Set<(value: unknown) => void>>();
  readonly commands: Array<{ name: string; payload: unknown; ack: (value: unknown) => void }> = [];
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  on(name: string, handler: (value: unknown) => void): void {
    const handlers = this.handlers.get(name) ?? new Set();
    handlers.add(handler);
    this.handlers.set(name, handlers);
  }
  off(name: string, handler: (value: unknown) => void): void {
    this.handlers.get(name)?.delete(handler);
  }
  emit(name: string, payload: unknown, ack: (value: unknown) => void): void {
    this.commands.push({ name, payload, ack });
  }
  server(name: string, payload: unknown): void {
    for (const handler of this.handlers.get(name) ?? []) handler(payload);
  }
  acknowledge(
    index = 0,
    data: unknown = { accepted: true },
    override: Record<string, unknown> = {},
  ): void {
    const command = this.commands[index];
    if (!command) throw new Error('Missing command');
    const body = command.payload as { requestId: string };
    command.ack({
      contractVersion: 1,
      ok: true,
      requestId: body.requestId,
      serverTime: AT,
      data,
      ...override,
    });
  }
}

function envelope(payload: unknown, eventId = ID) {
  return { contractVersion: 1, eventId, correlationId: ID, occurredAt: AT, payload };
}
function ready(recoveryComplete = true) {
  return {
    ...envelope({
      recovered: true,
      recoveryComplete,
      capabilities: {
        crmLeads: { receive: true },
        notifications: { receive: true },
        presence: { publishSelf: false, watchMode: 'NONE' },
      },
      grantedCapabilities: ['CRM_LEADS', 'NOTIFICATIONS'],
      notificationResyncRequired: !recoveryComplete,
      lastNotificationCursorAccepted: true,
    }),
    presenceGeneration: ID,
    logicalSessionId: ID,
    sessionStartedAt: AT,
    stateVersion: 0,
  };
}
function notification(eventId = ID2, cursor = 'n1.cursor') {
  return envelope(
    {
      notificationId: ID,
      recipientId: ID,
      deliveryEventId: eventId,
      cursor,
      type: 'crm.lead',
      title: 'Assigned lead',
      body: 'A lead was assigned.',
      priority: 'P2_NORMAL',
      entity: null,
      action: { route: '/crm/leads' },
      createdAt: AT,
      expiresAt: null,
      silent: false,
      metadata: {},
    },
    eventId,
  );
}

describe('RealtimeClient RT10 ownership and lifecycle', () => {
  const isLeader = signal(true);
  const status = signal<SessionStatus>('signed-in');
  const me = signal<{ id: string } | null>({ id: ID });
  let bus: TabBus;
  let client: RealtimeClient;
  let socket: ControlledSocket;
  let sockets: ControlledSocket[];
  let options: RealtimeSocketOptions[];
  let standDown: StandDownHook = async () => undefined;
  let refresh: ReturnType<typeof vi.fn<() => Promise<'ok' | 'ended'>>>;
  let sessionEnded: ReturnType<typeof vi.fn>;
  let unregister: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
  function create(input: { supported?: boolean; transport?: boolean } = {}): void {
    TestBed.configureTestingModule({
      providers: [
        RealtimeClient,
        TabBus,
        { provide: AuthSession, useValue: { status, me, refresh, sessionEnded } },
        {
          provide: TabLeader,
          useValue: {
            isLeader,
            tabId: TAB,
            supported: input.supported ?? true,
            registerStandDown: (_owner: string, hook: StandDownHook) => {
              standDown = hook;
              return unregister;
            },
          },
        },
        {
          provide: REALTIME_SOCKET_FACTORY,
          useValue:
            input.transport === false
              ? null
              : (value: RealtimeSocketOptions) => {
                  options.push(value);
                  socket = new ControlledSocket();
                  sockets.push(socket);
                  return socket;
                },
        },
      ],
    });
    bus = TestBed.inject(TabBus);
    bus.bindLeader(TAB, isLeader, () => undefined);
    client = TestBed.inject(RealtimeClient);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    localStorage.clear();
    isLeader.set(true);
    status.set('signed-in');
    me.set({ id: ID });
    sockets = [];
    options = [];
    refresh = vi.fn(async () => 'ok' as const);
    sessionEnded = vi.fn(async () => undefined);
    unregister = vi.fn();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens one same-origin cookie socket with strict RT10 metadata and app tab identity', () => {
    create();
    expect(sockets).toHaveLength(1);
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(options[0]).toEqual({
      path: '/realtime/socket.io',
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      withCredentials: true,
      timeout: 10_000,
      auth: {
        contractVersion: 1,
        platform: 'web',
        appVersion: '0.0.0',
        tabId: TAB,
        deviceId: expect.any(String),
        clientInstanceId: expect.any(String),
      },
    });
    TestBed.tick();
    expect(sockets).toHaveLength(1);
    socket.server('connect', undefined);
    expect(client.connection().status).toBe('connecting');
    socket.server('session.ready.v1', ready());
    expect(client.connection().status).toBe('connected');
    expect(client.capabilities()?.notifications.receive).toBe(true);
  });

  it.each(['follower', 'signed-out', 'unsupported', 'unavailable'])(
    'does not open a socket when %s',
    (mode) => {
      if (mode === 'follower') isLeader.set(false);
      if (mode === 'signed-out') status.set('signed-out');
      create({ supported: mode !== 'unsupported', transport: mode !== 'unavailable' });
      expect(sockets).toHaveLength(0);
      expect(client.connection().status).toBe(
        ['unsupported', 'unavailable'].includes(mode) ? 'unavailable' : 'idle',
      );
    },
  );

  it('uses app stand-down hook and ignores late socket callbacks after leadership loss', async () => {
    create();
    socket.server('session.ready.v1', ready());
    const previous = socket;
    const oldListener = [...(previous.handlers.get('notification.created.v1') ?? [])][0];
    const event = vi.fn();
    client.onEvent(event);
    await standDown();
    isLeader.set(false);
    TestBed.tick();
    oldListener?.(notification());
    expect(event).not.toHaveBeenCalled();
    expect(previous.disconnect).toHaveBeenCalledOnce();
    expect([...previous.handlers.values()].every((set) => set.size === 0)).toBe(true);
    expect(sockets).toHaveLength(1);
    isLeader.set(true);
    TestBed.tick();
    expect(sockets).toHaveLength(2);
    expect(options[1]?.auth.deviceId).toBe(options[0]?.auth.deviceId);
    expect(options[1]?.auth.clientInstanceId).toBe(options[0]?.auth.clientInstanceId);
  });

  it('clears all exposed session data and cancels reconnect on sign-out', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server('disconnect', 'transport close');
    status.set('signed-out');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
    expect(client.connection().status).toBe('idle');
    expect(client.capabilities()).toBeNull();
    expect(client.recoveries()).toEqual([]);
    expect(bus.state('realtime.cursor')()).toBeNull();
  });

  it('fans out validated event envelopes and never sends read/acknowledge HTTP mutations', async () => {
    create();
    socket.server('session.ready.v1', ready());
    const handler = vi.fn();
    client.on('notification.created.v1', handler);
    socket.server('notification.created.v1', notification());
    await settle();
    expect(handler).toHaveBeenCalledWith(notification());
    expect(bus.state<RealtimeScoped<RealtimeEvent>>('realtime.event')()?.value.name).toBe(
      'notification.created.v1',
    );
    expect(socket.commands[0]?.name).toBe('notification.received.v1');
    expect(socket.commands[0]?.payload).toMatchObject({
      contractVersion: 1,
      payload: {
        notificationId: ID,
        recipientId: ID,
        deliveryEventId: ID2,
        cursor: 'n1.cursor',
      },
    });
    expect((socket.commands[0]?.payload as { requestId: string }).requestId).toMatch(
      /^[0-9a-f-]{14}7[0-9a-f-]+$/,
    );
  });

  it('commits opaque cursors in receipt order only after correlated successful acknowledgements', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server('notification.created.v1', notification());
    socket.server(
      'notification.created.v1',
      notification('019aabbc-0000-7000-8000-000000000003', 'n2.cursor'),
    );
    await settle();
    expect(socket.commands).toHaveLength(1);
    expect(bus.state('realtime.cursor')()).toBeNull();
    socket.acknowledge();
    await settle();
    expect(bus.state<RealtimeScoped<string>>('realtime.cursor')()?.value).toBe('n1.cursor');
    expect(socket.commands).toHaveLength(2);
    socket.acknowledge(1);
    await settle();
    expect(bus.state<RealtimeScoped<string>>('realtime.cursor')()?.value).toBe('n2.cursor');
    socket.server('disconnect', 'transport close');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(options[1]?.auth.lastNotificationCursor).toBe('n2.cursor');
  });

  it('deduplicates fanout but acknowledges duplicate deliveries without cursor regression', async () => {
    create();
    socket.server('session.ready.v1', ready());
    const handler = vi.fn();
    client.on('notification.created.v1', handler);
    socket.server('notification.created.v1', notification());
    await settle();
    socket.acknowledge();
    await settle();
    socket.server('notification.created.v1', notification(ID2, 'old.cursor'));
    await settle();
    socket.acknowledge(1);
    await settle();
    expect(handler).toHaveBeenCalledOnce();
    expect(bus.state<RealtimeScoped<string>>('realtime.cursor')()?.value).toBe('n1.cursor');
  });

  it.each(['timeout', 'mismatch', 'negative', 'malformed'])(
    'keeps cursor unchanged and requests HTTP recovery on %s receipt',
    async (mode) => {
      create();
      socket.server('session.ready.v1', ready());
      socket.server('notification.created.v1', notification());
      await settle();
      if (mode === 'timeout') await vi.advanceTimersByTimeAsync(10_000);
      if (mode === 'mismatch') socket.acknowledge(0, { accepted: true }, { requestId: ID });
      if (mode === 'negative')
        socket.commands[0]?.ack({
          contractVersion: 1,
          ok: false,
          serverTime: AT,
          requestId: (socket.commands[0]?.payload as { requestId: string }).requestId,
          error: {
            code: 'REALTIME.LIMIT.RATE_LIMITED',
            message: 'Rate limited',
            retryable: true,
            retryAfterMs: 30_000,
          },
        });
      if (mode === 'malformed') socket.commands[0]?.ack({ ok: true });
      await settle();
      expect(bus.state('realtime.cursor')()).toBeNull();
      expect(client.stale()).toBe(true);
      expect(client.recoveries()[0]?.scope).toBe('NOTIFICATIONS');
    },
  );

  it('does not treat recovered Socket.IO as completed authoritative recovery', () => {
    create();
    socket.server('session.ready.v1', ready(false));
    expect(client.stale()).toBe(true);
    expect(client.recoveries().map((value) => value.scope)).toEqual(['NOTIFICATIONS', 'CRM_LEADS']);
    const recovery = [...client.recoveries()];
    for (const item of recovery.slice(0, 1)) client.completeRecovery(item.id);
    expect(client.stale()).toBe(true);
    for (const item of recovery.slice(1)) client.completeRecovery(item.id);
    expect(client.stale()).toBe(false);
    expect(client.recovery()).toBeNull();
  });

  it('ignores HTTP completion tokens from a prior socket lifetime', async () => {
    create();
    socket.server('session.ready.v1', ready(false));
    const oldRecovery = [...client.recoveries()];
    socket.server('disconnect', 'transport close');
    await vi.advanceTimersByTimeAsync(1_000);
    socket.server('session.ready.v1', ready(false));
    for (const item of oldRecovery) client.completeRecovery(item.id);
    expect(client.stale()).toBe(true);
    expect(client.recoveries()).toHaveLength(2);
    for (const item of [...client.recoveries()]) client.completeRecovery(item.id);
    expect(client.stale()).toBe(false);
  });

  it('does not commit or send later queued receipts past a failed acknowledgement', async () => {
    create();
    socket.server('session.ready.v1', ready());
    const oldSocket = socket;
    socket.server('notification.created.v1', notification());
    socket.server(
      'notification.created.v1',
      notification('019aabbc-0000-7000-8000-000000000003', 'n2.cursor'),
    );
    await settle();
    socket.acknowledge(0, { accepted: true }, { requestId: ID });
    await settle();
    expect(oldSocket.commands).toHaveLength(1);
    expect(oldSocket.disconnect).toHaveBeenCalledOnce();
    expect(bus.state('realtime.cursor')()).toBeNull();
  });

  it('bounds the receipt queue and requests resync instead of silently skipping overflowed delivery', async () => {
    create();
    socket.server('session.ready.v1', ready());
    for (let i = 0; i < 129; i++) {
      const id = `019aabbc-0000-7000-8000-${(i + 10).toString(16).padStart(12, '0')}`;
      socket.server('notification.created.v1', notification(id, `cursor.${i}`));
    }
    await settle();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socket.commands).toHaveLength(0);
    expect(client.recoveries()[0]?.reason).toBe('REALTIME.CLIENT.BACKPRESSURE');
    expect(client.connection().failure?.code).toBe('REALTIME.CLIENT.BACKPRESSURE');
    expect(bus.state('realtime.cursor')()).toBeNull();
  });

  it('allows an explicit retry after the reconnect budget is exhausted', async () => {
    create();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(client.connection().status).toBe('failed');
    const before = sockets.length;
    client.retry();
    expect(sockets).toHaveLength(before + 1);
  });

  it('routes follower sync/retry requests to the app bus without opening a socket', () => {
    isLeader.set(false);
    create();
    const send = vi.spyOn(bus, 'send');
    client.sync('NOTIFICATIONS');
    client.retry();
    expect(send).toHaveBeenCalledWith('realtime.sync', {
      userId: ID,
      value: { scope: 'NOTIFICATIONS' },
    });
    expect(send).toHaveBeenCalledWith('realtime.retry', { userId: ID, value: null });
    expect(sockets).toHaveLength(0);
  });

  it('requires authoritative resync for scope changes and forwards the real sync acknowledgement', async () => {
    create();
    socket.server('session.ready.v1', ready());
    client.sync('CRM_LEADS');
    expect(socket.commands[0]?.name).toBe('realtime.sync.request.v1');
    socket.acknowledge(0, { snapshotScheduled: false, restResyncRequired: true });
    await settle();
    expect(client.recoveries()[0]?.scope).toBe('CRM_LEADS');
    expect(client.stale()).toBe(true);
  });

  it('stops after server replacement and tenant unavailability', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server(
      'system.connection-replaced.v1',
      envelope({ reason: 'CLIENT_INSTANCE_REPLACED' }),
    );
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
    expect(client.connection().failure?.code).toBe('REALTIME.CLIENT.REPLACED');
    client.retry();
    socket.server('system.tenant-unavailable.v1', envelope({ reason: 'TENANT_MOVED' }));
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(2);
    expect(client.connection().failure?.code).toBe('REALTIME.AUTH.TENANT_INACTIVE');
  });

  it('validates events before fanout and exposes stale state for malformed input', () => {
    create();
    socket.server('session.ready.v1', ready());
    const handler = vi.fn();
    client.on('notification.created.v1', handler);
    socket.server('notification.created.v1', { ...notification(), contractVersion: 2 });
    expect(handler).not.toHaveBeenCalled();
    expect(client.stale()).toBe(true);
    expect(client.connection().failure?.code).toBe('REALTIME.PROTOCOL.INVALID_PAYLOAD');
  });

  it('follower receives only the current signed-in user events and never acknowledges', () => {
    isLeader.set(false);
    create();
    const handler = vi.fn();
    client.onEvent(handler);
    const send = (userId: string) => {
      bus.bindLeader(
        'sender',
        () => true,
        () => undefined,
      );
      bus.publish('realtime.event', {
        userId,
        value: { name: 'notification.created.v1', event: notification() },
      });
    };
    send(ID2);
    expect(handler).not.toHaveBeenCalled();
    send(ID);
    expect(handler).toHaveBeenCalledOnce();
    expect(sockets).toHaveLength(0);
  });

  it('backs off transport failures and stops after six reconnect attempts', async () => {
    create();
    for (let i = 0; i < 7; i++) {
      socket.server('connect_error', new Error('unreachable'));
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(sockets).toHaveLength(7);
    expect(client.connection().status).toBe('failed');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(7);
  });

  it('honors server retryAfterMs and preserves correlation metadata', async () => {
    create();
    socket.server('connect_error', {
      data: {
        contractVersion: 1,
        code: 'REALTIME.LIMIT.RATE_LIMITED',
        message: 'Busy',
        retryable: true,
        correlationId: ID,
        retryAfterMs: 60_000,
      },
    });
    expect(client.connection().failure?.correlationId).toBe(ID);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
  });

  it('never reconnects terminal admission denial', async () => {
    create();
    socket.server('connect_error', {
      data: {
        contractVersion: 1,
        code: 'REALTIME.AUTH.ORIGIN_NOT_ALLOWED',
        message: 'Denied',
        retryable: false,
        correlationId: ID,
        retryAfterMs: null,
      },
    });
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(client.connection().status).toBe('failed');
  });

  it('handles the actual gateway activation admission-error projection without reconnecting terminal denial', async () => {
    create();
    socket.server(
      'realtime.error.v1',
      envelope({
        code: 'REALTIME.AUTH.SESSION_INVALIDATED',
        message: 'Activation rejected',
        retryable: false,
        retryAfterMs: null,
      }),
    );
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
    expect(client.connection().failure?.code).toBe('REALTIME.AUTH.SESSION_INVALIDATED');
  });

  it('stops on the current gateway minimal connect_error data without assuming RT10 metadata is present', async () => {
    create();
    socket.server('connect_error', {
      data: {
        code: 'REALTIME.AUTH.NOT_ALLOWED',
        retryable: false,
        retryAfterMs: null,
      },
    });
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
    expect(client.connection().failure?.code).toBe('REALTIME.AUTH.NOT_ALLOWED');
  });

  it('renews expired cookie auth through AuthSession once then reconnects', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server('system.access-revoked.v1', envelope({ reason: 'TOKEN_EXPIRED' }));
    await settle();
    expect(refresh).toHaveBeenCalledOnce();
    expect(sockets).toHaveLength(2);
    socket.server('system.access-revoked.v1', envelope({ reason: 'TOKEN_EXPIRED' }));
    await settle();
    expect(refresh).toHaveBeenCalledOnce();
    expect(client.connection().status).toBe('failed');
  });

  it('ends revoked sessions and does not reconnect after server replacement', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server('system.access-revoked.v1', envelope({ reason: 'SESSION_INVALIDATED' }));
    await settle();
    expect(sessionEnded).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(1);
  });

  it('does not reopen after a late auth refresh resolves following sign-out', async () => {
    let resolveRefresh: (result: 'ok') => void = () => undefined;
    refresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    create();
    socket.server('system.access-expiring.v1', envelope({ expiresAt: AT }));
    status.set('signed-out');
    TestBed.tick();
    resolveRefresh('ok');
    await settle();
    expect(sockets).toHaveLength(1);
  });

  it('cleans pending acknowledgements, reconnect timers and hooks on destroy', async () => {
    create();
    socket.server('session.ready.v1', ready());
    socket.server('notification.created.v1', notification());
    await settle();
    TestBed.resetTestingModule();
    await settle();
    expect(unregister).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
