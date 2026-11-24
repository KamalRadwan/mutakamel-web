import {
  DOCUMENT,
  DestroyRef,
  Service,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AuthSession } from '../auth/auth-session';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import {
  REALTIME_CLIENT_OPTIONS,
  REALTIME_SOCKET_FACTORY,
  assertRealtimeBounds,
  notificationCursorSchema,
  parseRealtimeAck,
  parseRealtimeEvent,
  realtimeCommandSchemas,
  realtimeHandshakeSchema,
  realtimeServerSchemas,
  type RealtimeAcknowledgementData,
  type RealtimeCommand,
  type RealtimeCommandName,
  type RealtimeConnectionState,
  type RealtimeEvent,
  type RealtimeEventData,
  type RealtimeEventName,
  type RealtimeFailure,
  type RealtimeRecovery,
  type RealtimeScope,
  type RealtimeScoped,
  type RealtimeSocket,
} from './realtime-client.model';
import { RealtimeError, realtimeClientFailure, realtimeFailure } from './realtime-errors';

const STATE = 'realtime.connection';
const EVENT = 'realtime.event';
const CURSOR = 'realtime.cursor';
const RECOVERY = 'realtime.recovery';
const RECOVERIES = 'realtime.recoveries';
const RECOVERED = 'realtime.recovered';
const SYNC = 'realtime.sync';
const RETRY = 'realtime.retry';
const SESSION = 'realtime.session';
const ACK_TIMEOUT = 10_000;
const MAX_RECONNECTS = 6;
const MAX_PENDING = 128;
const IDLE: RealtimeConnectionState = { status: 'idle', stale: true, failure: null, at: 0 };

/** One app-level Socket.IO owner. Consumers own authoritative HTTP resync/fallback. */
@Service()
export class RealtimeClient {
  private readonly session = inject(AuthSession);
  private readonly leader = inject(TabLeader);
  private readonly bus = inject(TabBus);
  private readonly document = inject(DOCUMENT);
  private readonly factory = inject(REALTIME_SOCKET_FACTORY);
  private readonly options = inject(REALTIME_CLIENT_OPTIONS);
  private readonly identity = computed(() =>
    this.session.status() === 'signed-in' ? (this.session.me()?.id ?? null) : null,
  );
  private readonly publishedState = this.bus.state<RealtimeScoped<RealtimeConnectionState> | null>(
    STATE,
  );
  private readonly publishedRecoveries = this.bus.state<RealtimeScoped<RealtimeRecovery[]> | null>(
    RECOVERIES,
  );
  private readonly publishedCursor = this.bus.state<RealtimeScoped<string | null> | null>(CURSOR);
  private readonly publishedSession = this.bus.state<RealtimeScoped<
    RealtimeEventData<'session.ready.v1'>['payload']
  > | null>(SESSION);
  private readonly localState = signal<RealtimeConnectionState>(IDLE);
  readonly connection = computed(() => {
    const userId = this.identity();
    if (!userId) return IDLE;
    const shared = this.publishedState();
    return shared?.userId === userId ? shared.value : this.localState();
  });
  readonly state = this.connection;
  readonly recovery = computed(() => this.recoveries().at(-1) ?? null);
  readonly stale = computed(() => this.connection().stale);
  readonly capabilities = computed(() => {
    const shared = this.publishedSession();
    return shared?.userId === this.identity() ? shared.value.capabilities : null;
  });
  readonly recoveries = computed(() => {
    const shared = this.publishedRecoveries();
    return shared?.userId === this.identity() ? shared.value : [];
  });

  private socket: RealtimeSocket | null = null;
  private listeners: Array<[string, (value: unknown) => void]> = [];
  private generation = 0;
  private attempt = 0;
  private ready = false;
  private refreshUsed = false;
  private refreshing = false;
  private cursor: string | null = null;
  private receiptChain: Promise<void> = Promise.resolve();
  private receipts = 0;
  private readonly seen = new Set<string>();
  private readonly pending = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; reject: (error: RealtimeError) => void }
  >();
  private readonly recoveryScopes = new Map<string, RealtimeRecovery>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const removeStandDown = this.leader.registerStandDown('realtime-client', async () => {
      this.setState('stale', null);
      this.stop();
    });
    const removeRecovery = this.bus.on<RealtimeScoped<{ id: string }>>(RECOVERED, (message) => {
      if (
        !this.active() ||
        message.userId !== this.identity() ||
        !this.recoveryScopes.has(message.value.id)
      )
        return;
      this.recoveryScopes.delete(message.value.id);
      this.publish(RECOVERIES, [...this.recoveryScopes.values()]);
      const latest = [...this.recoveryScopes.values()].at(-1);
      if (!latest) this.bus.publish(RECOVERY, null);
      if (this.ready && this.recoveryScopes.size === 0) {
        this.attempt = 0;
        this.refreshUsed = false;
        this.setState('connected', null);
      }
    });
    const removeSync = this.bus.on<RealtimeScoped<{ scope: RealtimeScope }>>(SYNC, (message) => {
      if (
        this.active() &&
        message.userId === this.identity() &&
        ['ALL', 'NOTIFICATIONS', 'CRM_LEADS', 'PRESENCE'].includes(message.value.scope)
      ) {
        void this.requestSync(message.value.scope).catch((error: unknown) =>
          this.setState('stale', realtimeFailure(error)),
        );
      }
    });
    const removeRetry = this.bus.on<RealtimeScoped<null>>(RETRY, (message) => {
      if (
        !this.active() ||
        message.userId !== this.identity() ||
        !this.leader.supported ||
        !this.factory
      )
        return;
      this.stop();
      this.attempt = 0;
      this.refreshUsed = false;
      this.cursor =
        this.publishedCursor()?.userId === this.identity()
          ? (this.publishedCursor()?.value ?? null)
          : null;
      this.open();
    });
    inject(DestroyRef).onDestroy(() => {
      removeStandDown();
      removeRecovery();
      removeSync();
      removeRetry();
      this.stop();
    });
    effect((onCleanup) => {
      const userId = this.identity();
      const isLeader = this.leader.isLeader();
      onCleanup(() => this.stop());
      untracked(() => {
        if (!userId) {
          this.localState.set(IDLE);
          if (isLeader) {
            this.bus.publish(STATE, null);
            this.bus.publish(RECOVERY, null);
            this.bus.publish(CURSOR, null);
            this.bus.publish(RECOVERIES, null);
            this.bus.publish(SESSION, null);
          }
          return;
        }
        this.localState.set(IDLE);
        if (!isLeader) return;
        this.attempt = 0;
        this.refreshUsed = false;
        this.cursor =
          this.publishedCursor()?.userId === userId
            ? (this.publishedCursor()?.value ?? null)
            : null;
        // The app leader deliberately fails closed when cross-tab election is unsupported.
        if (!this.leader.supported || !this.factory) {
          this.setState('unavailable', realtimeClientFailure('REALTIME.CLIENT.UNAVAILABLE'));
          return;
        }
        this.open();
      });
    });
  }

  /** Validated server envelopes in every signed-in tab; never synthetic server events. */
  onEvent(handler: (event: RealtimeEvent) => void): () => void {
    return this.bus.on<RealtimeScoped<RealtimeEvent>>(EVENT, (message) => {
      if (!this.identity() || message.userId !== this.identity()) return;
      const { name, event } = message.value;
      if (!Object.hasOwn(realtimeServerSchemas, name)) return;
      let parsed: RealtimeEventData<typeof name>;
      try {
        parsed = parseRealtimeEvent(name, event);
      } catch {
        this.localState.set({
          status: 'stale',
          stale: true,
          failure: realtimeClientFailure('REALTIME.PROTOCOL.INVALID_PAYLOAD'),
          at: Date.now(),
        });
        return;
      }
      handler({ name, event: parsed } as RealtimeEvent);
    });
  }

  on<N extends RealtimeEventName>(
    name: N,
    handler: (event: RealtimeEventData<N>) => void,
  ): () => void {
    return this.onEvent((message) => {
      if (message.name === name) handler(message.event as RealtimeEventData<N>);
    });
  }

  onRecovery(handler: (recovery: RealtimeRecovery) => void): () => void {
    return this.bus.on<RealtimeScoped<RealtimeRecovery>>(RECOVERY, (message) => {
      if (this.identity() && message.userId === this.identity()) handler(message.value);
    });
  }

  /** Called only after the relevant authoritative HTTP refresh has completed successfully. */
  completeRecovery(id: string): void {
    const userId = this.identity();
    if (userId) this.bus.send<RealtimeScoped<{ id: string }>>(RECOVERED, { userId, value: { id } });
  }

  /** Follower requests go to the existing app leader. No tab creates a second transport. */
  sync(scope: RealtimeScope = 'ALL'): void {
    const userId = this.identity();
    if (userId)
      this.bus.send<RealtimeScoped<{ scope: RealtimeScope }>>(SYNC, { userId, value: { scope } });
  }

  retry(): void {
    const userId = this.identity();
    if (userId) this.bus.send<RealtimeScoped<null>>(RETRY, { userId, value: null });
  }

  private active(generation = this.generation): boolean {
    return generation === this.generation && this.leader.isLeader() && this.identity() !== null;
  }

  private open(): void {
    if (!this.active() || !this.factory || this.socket) return;
    const generation = this.generation;
    this.recoveryScopes.clear();
    this.publish(RECOVERIES, []);
    this.bus.publish(RECOVERY, null);
    try {
      const auth = realtimeHandshakeSchema.parse({
        contractVersion: 1,
        platform: 'web',
        appVersion: this.options.appVersion,
        deviceId: this.storedId('mutakamel.realtime.device'),
        clientInstanceId: this.storedId('mutakamel.realtime.instance'),
        tabId: this.leader.tabId,
        ...(this.cursor === null ? {} : { lastNotificationCursor: this.cursor }),
      });
      assertRealtimeBounds(auth, 4_096);
      this.setState('connecting', null);
      const socket = this.factory({
        path: '/realtime/socket.io',
        // WebSocket only: browsers omit Origin on same-origin polling GETs, and Realtime admission requires Origin (REALTIME.AUTH.ORIGIN_NOT_ALLOWED). The upgrade request always carries it.
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
        forceNew: true,
        withCredentials: true,
        auth,
        timeout: ACK_TIMEOUT,
      });
      this.socket = socket;
      const listen = (name: string, callback: (value: unknown) => void) => {
        const listener = (value: unknown) => {
          if (this.active(generation) && this.socket === socket) callback(value);
        };
        this.listeners.push([name, listener]);
        socket.on(name, listener);
      };
      listen('connect_error', (error) => void this.fail(realtimeFailure(error), generation));
      listen('disconnect', () => {
        if (!this.refreshing)
          void this.fail(realtimeClientFailure('NETWORK_ERROR', true), generation);
      });
      for (const name of Object.keys(realtimeServerSchemas) as RealtimeEventName[]) {
        listen(name, (value) => this.receive(name, value, generation));
      }
      this.readyTimer = setTimeout(
        () => void this.fail(realtimeClientFailure('REALTIME.CLIENT.TIMEOUT', true), generation),
        ACK_TIMEOUT,
      );
      socket.connect();
    } catch {
      void this.fail(realtimeClientFailure('REALTIME.HANDSHAKE.INVALID'), generation);
    }
  }

  private receive<N extends RealtimeEventName>(name: N, input: unknown, generation: number): void {
    let event: RealtimeEventData<N>;
    try {
      event = parseRealtimeEvent(name, input);
    } catch {
      this.requireRecovery('ALL', 'REALTIME.PROTOCOL.INVALID_PAYLOAD');
      this.setState('stale', realtimeClientFailure('REALTIME.PROTOCOL.INVALID_PAYLOAD'));
      return;
    }
    const message = { name, event } as RealtimeEvent;
    const eventKey = `${name}:${event.eventId}`;
    const duplicate = this.seen.has(eventKey);
    if (!duplicate) {
      this.seen.add(eventKey);
      if (this.seen.size > 512) {
        const oldest = this.seen.values().next().value;
        if (oldest !== undefined) this.seen.delete(oldest);
      }
      this.publish(EVENT, message);
    }
    switch (message.name) {
      case 'session.ready.v1': {
        clearTimeout(this.readyTimer);
        this.readyTimer = undefined;
        this.ready = true;
        const payload = message.event.payload;
        this.publish(SESSION, payload);
        if (!payload.lastNotificationCursorAccepted) this.commitCursor(null);
        if (!payload.recoveryComplete) {
          if (payload.capabilities.notifications.receive)
            this.requireRecovery('NOTIFICATIONS', 'RECOVERY_INCOMPLETE');
          if (payload.capabilities.crmLeads.receive)
            this.requireRecovery('CRM_LEADS', 'RECOVERY_INCOMPLETE');
          if (payload.capabilities.presence.watchMode !== 'NONE')
            this.requireRecovery('PRESENCE', 'RECOVERY_INCOMPLETE');
          if (this.recoveryScopes.size === 0) this.setState('connected', null);
        } else if (payload.notificationResyncRequired)
          this.requireRecovery('NOTIFICATIONS', 'RECOVERY_INCOMPLETE');
        else if (this.recoveryScopes.size === 0) {
          this.attempt = 0;
          this.refreshUsed = false;
          this.setState('connected', null);
        }
        break;
      }
      case 'notification.created.v1':
        if (this.ready) this.receipt(message.event, duplicate, generation);
        break;
      case 'realtime.sync.required.v1':
        this.requireRecovery(message.event.payload.scope, message.event.payload.reason);
        break;
      case 'crm.leads.scope-resync.v1':
        this.requireRecovery('CRM_LEADS', 'SCOPE_CHANGED');
        break;
      case 'system.access-expiring.v1':
        void this.renew(generation);
        break;
      case 'system.access-revoked.v1':
        if (message.event.payload.reason === 'TOKEN_EXPIRED') {
          void this.fail(realtimeClientFailure('REALTIME.AUTH.TOKEN_EXPIRED'), generation);
        } else {
          void this.fail(realtimeClientFailure('REALTIME.AUTH.ACCESS_REVOKED'), generation);
          void this.session.sessionEnded();
        }
        break;
      case 'system.tenant-unavailable.v1':
      case 'system.connection-replaced.v1':
        void this.fail(
          realtimeClientFailure(
            message.name === 'system.connection-replaced.v1'
              ? 'REALTIME.CLIENT.REPLACED'
              : 'REALTIME.AUTH.TENANT_INACTIVE',
          ),
          generation,
        );
        break;
      case 'system.server-draining.v1':
        void this.fail(
          {
            ...realtimeClientFailure('REALTIME.DEPENDENCY.SERVER_NOT_READY', true),
            retryAfterMs: message.event.payload.retryAfterMs,
          },
          generation,
        );
        break;
      case 'realtime.error.v1':
        void this.fail(
          { ...realtimeFailure(message.event.payload), correlationId: message.event.correlationId },
          generation,
        );
        break;
    }
  }

  private receipt(
    event: RealtimeEventData<'notification.created.v1'>,
    duplicate: boolean,
    generation: number,
  ): void {
    const socket = this.socket;
    if (this.receipts >= MAX_PENDING) {
      this.requireRecovery('NOTIFICATIONS', 'REALTIME.CLIENT.BACKPRESSURE');
      void this.fail(realtimeClientFailure('REALTIME.CLIENT.BACKPRESSURE', true), generation);
      return;
    }
    const payload = event.payload;
    this.receipts++;
    this.receiptChain = this.receiptChain
      .then(async () => {
        if (!this.active(generation) || !this.ready || this.socket !== socket) return;
        await this.command('notification.received.v1', {
          contractVersion: 1,
          requestId: requestId(),
          payload: {
            notificationId: payload.notificationId,
            recipientId: payload.recipientId,
            deliveryEventId: payload.deliveryEventId,
            cursor: payload.cursor,
          },
        });
        if (this.active(generation) && this.socket === socket && !duplicate)
          this.commitCursor(payload.cursor);
      })
      .catch((error: unknown) => {
        if (this.active(generation) && this.socket === socket) {
          this.requireRecovery('NOTIFICATIONS', 'REALTIME.CLIENT.ACK_FAILED');
          // Stop this receipt chain at its first gap; later receipts cannot commit past it.
          void this.fail(realtimeFailure(error), generation);
        }
      })
      .finally(() => {
        if (this.active(generation) && this.socket === socket) this.receipts--;
      });
  }

  private async requestSync(scope: RealtimeScope): Promise<void> {
    this.requireRecovery(scope, 'CLIENT_SYNC');
    const result = await this.command('realtime.sync.request.v1', {
      contractVersion: 1,
      requestId: requestId(),
      payload: { scope, lastNotificationCursor: this.cursor },
    });
    if ('restResyncRequired' in result && result.restResyncRequired)
      this.requireRecovery(scope, 'REST_RESYNC_REQUIRED');
  }

  private command<N extends RealtimeCommandName>(name: N, input: RealtimeCommand<N>) {
    const socket = this.socket;
    if (!socket || !this.ready || !this.active())
      return Promise.reject(
        new RealtimeError(realtimeClientFailure('REALTIME.CLIENT.DISCONNECTED', true)),
      );
    const command = realtimeCommandSchemas[name].parse(input);
    assertRealtimeBounds(command, name === 'notification.received.v1' ? 2_048 : 4_096);
    if (this.pending.size >= MAX_PENDING)
      return Promise.reject(
        new RealtimeError(realtimeClientFailure('REALTIME.CLIENT.BACKPRESSURE', true)),
      );
    return new Promise<RealtimeAcknowledgementData>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.requestId);
        reject(new RealtimeError(realtimeClientFailure('REALTIME.CLIENT.ACK_TIMEOUT', true)));
      }, ACK_TIMEOUT);
      this.pending.set(command.requestId, { timer, reject });
      try {
        socket.emit(name, command, (inputAck) => {
          const pending = this.pending.get(command.requestId);
          if (!pending || this.socket !== socket) return;
          clearTimeout(pending.timer);
          this.pending.delete(command.requestId);
          try {
            const ack = parseRealtimeAck(name, inputAck);
            if (ack.requestId !== command.requestId)
              throw new RealtimeError(realtimeClientFailure('REALTIME.PROTOCOL.INVALID_PAYLOAD'));
            if (ack.ok) resolve(ack.data);
            else reject(new RealtimeError(realtimeFailure(ack.error)));
          } catch (error) {
            reject(
              error instanceof RealtimeError
                ? error
                : new RealtimeError(realtimeClientFailure('REALTIME.PROTOCOL.INVALID_PAYLOAD')),
            );
          }
        });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(command.requestId);
        reject(new RealtimeError(realtimeFailure(error)));
      }
    });
  }

  private requireRecovery(scope: RealtimeScope, reason: string): void {
    if (!this.active()) return;
    // One outstanding refresh per scope; HTTP consumers implement bounded retries/polling.
    const existing = [...this.recoveryScopes.values()].find((value) => value.scope === scope);
    const recovery = existing ?? { id: requestId(), scope, reason, at: Date.now() };
    this.recoveryScopes.set(recovery.id, recovery);
    this.setState('stale', null);
    this.publish(RECOVERIES, [...this.recoveryScopes.values()]);
    this.publish(RECOVERY, recovery);
  }

  private async fail(failure: RealtimeFailure, generation: number): Promise<void> {
    if (!this.active(generation)) return;
    this.closeSocket();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.setState(failure.retryable ? 'stale' : 'failed', failure);
    if (failure.code === 'REALTIME.AUTH.TOKEN_EXPIRED' && !this.refreshUsed) {
      await this.renew(generation);
      return;
    }
    if (!failure.retryable || this.attempt >= MAX_RECONNECTS) {
      this.setState('failed', failure);
      return;
    }
    const delay = Math.max(
      failure.retryAfterMs ?? 0,
      Math.min(30_000, 1_000 * 2 ** this.attempt) * (0.75 + Math.random() * 0.25),
    );
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.active(generation)) this.open();
    }, delay);
  }

  private async renew(generation: number): Promise<void> {
    if (!this.active(generation) || this.refreshUsed) return;
    this.refreshUsed = true;
    this.refreshing = true;
    this.closeSocket();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.setState('stale', realtimeClientFailure('REALTIME.AUTH.TOKEN_EXPIRED'));
    try {
      const result = await this.session.refresh();
      if (!this.active(generation)) return;
      if (result === 'ok') this.open();
      else this.setState('failed', realtimeClientFailure('REALTIME.AUTH.SESSION_INVALIDATED'));
    } catch (error) {
      if (this.active(generation)) await this.fail(realtimeFailure(error), generation);
    } finally {
      if (this.active(generation)) this.refreshing = false;
    }
  }

  private commitCursor(cursor: string | null): void {
    if (cursor !== null && !notificationCursorSchema.safeParse(cursor).success) return;
    this.cursor = cursor;
    this.publish(CURSOR, cursor);
  }

  private storedId(key: string): string {
    // Device and instance metadata are origin-local, contain no token, and survive leader handover.
    const storage = this.document.defaultView?.localStorage;
    if (!storage) throw new Error('Realtime storage unavailable');
    const saved = storage.getItem(key);
    if (saved) return saved;
    const value = crypto.randomUUID();
    storage.setItem(key, value);
    return value;
  }

  private publish<T>(topic: string, value: T): void {
    const userId = this.identity();
    if (userId && this.leader.isLeader())
      this.bus.publish<RealtimeScoped<T>>(topic, { userId, value });
  }

  private setState(
    status: RealtimeConnectionState['status'],
    failure: RealtimeFailure | null,
  ): void {
    const state: RealtimeConnectionState = {
      status,
      stale: status !== 'connected',
      failure,
      at: Date.now(),
    };
    this.localState.set(state);
    this.publish(STATE, state);
  }

  private closeSocket(): void {
    clearTimeout(this.readyTimer);
    this.readyTimer = undefined;
    this.ready = false;
    if (this.leader.isLeader()) this.bus.publish(SESSION, null);
    const socket = this.socket;
    this.socket = null;
    for (const [name, handler] of this.listeners) socket?.off(name, handler);
    this.listeners = [];
    socket?.disconnect();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new RealtimeError(realtimeClientFailure('REALTIME.CLIENT.DISCONNECTED', true)),
      );
    }
    this.pending.clear();
    this.receiptChain = Promise.resolve();
    this.receipts = 0;
  }

  private stop(): void {
    this.generation++;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.closeSocket();
    this.seen.clear();
    this.recoveryScopes.clear();
    this.receiptChain = Promise.resolve();
    this.receipts = 0;
    this.cursor = null;
    this.refreshing = false;
  }
}

/** RT10 requires UUIDv7 request IDs (crypto.randomUUID produces v4). */
function requestId(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = BigInt(Date.now());
  for (let i = 5; i >= 0; i--) {
    random[i] = Number(timestamp & 255n);
    timestamp >>= 8n;
  }
  random[6] = ((random[6] ?? 0) & 15) | 112;
  random[8] = ((random[8] ?? 0) & 63) | 128;
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
