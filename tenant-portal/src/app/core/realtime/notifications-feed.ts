import { DestroyRef, Service, computed, effect, inject, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../api/api-errors';
import { CoreHttp } from '../api/core-http';
import { AuthSession } from '../auth/auth-session';
import { Notify } from '../notify/notify';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import { NotificationPresentation } from './notification-presentation';
import { RealtimeClient } from './realtime-client';
import type { RealtimeEvent, RealtimeFailure, RealtimeScoped } from './realtime-client.model';
import { realtimeErrorMessage, realtimeFailure } from './realtime-errors';
import {
  notificationFeedConfigSchema,
  notificationFeedSnapshotSchema,
  type NotificationsFeedConfig,
  type NotificationsFeedEvent,
  type NotificationsFeedState,
  type NotificationsUnreadState,
} from './notifications-feed.model';

const BASE = '/api/tenant/core/v1/notifications';
const UNREAD = 'notifications.unread';
const EVENT = 'notifications.event';
const STATE = 'notifications.feed.state';
const RETRY = 'notifications.feed.retry';
const MAX_FAILURES = 6;
const IDLE: NotificationsFeedState = { status: 'idle', stale: true, failure: null, at: 0 };

/** Notification adapter; RealtimeClient owns the only app socket and receipt acknowledgements. */
@Service()
export class NotificationsFeed {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly leader = inject(TabLeader);
  private readonly bus = inject(TabBus);
  private readonly realtime = inject(RealtimeClient);
  private readonly presentation = inject(NotificationPresentation);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly identity = computed(() =>
    this.session.status() === 'signed-in' ? (this.session.me()?.id ?? null) : null,
  );
  private readonly publishedUnread =
    this.bus.state<RealtimeScoped<NotificationsUnreadState>>(UNREAD);
  private readonly publishedState = this.bus.state<RealtimeScoped<NotificationsFeedState>>(STATE);

  readonly unread = computed(() => {
    const shared = this.publishedUnread();
    return this.identity() && shared?.userId === this.identity() ? shared.value : null;
  });
  readonly state = computed(() => {
    const shared = this.publishedState();
    return this.identity() && shared?.userId === this.identity() ? shared.value : IDLE;
  });
  readonly stale = computed(() => this.state().stale);
  readonly failed = computed(() => this.state().status === 'failed');

  private term = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestDeadline: ReturnType<typeof setTimeout> | undefined;
  private config: NotificationsFeedConfig | null = null;
  private inFlight = false;
  private initialized = false;
  private suspended = false;
  private failures = 0;
  private failure: RealtimeFailure | null = null;
  private readonly handledRecoveries = new Set<string>();
  private readonly versions = new Map<string, number>();

  constructor() {
    const unregister = this.leader.registerStandDown('notifications-feed', async () => {
      this.suspended = true;
      this.stop();
    });
    const offEvent = this.realtime.onEvent((event) => this.receive(event));
    const seenNotices = new Set<string>();
    let noticeUser: string | null = null;
    const offNotice = this.onEvent((event) => {
      if (event.kind !== 'created' || !event.notice) return;
      const userId = this.identity();
      if (userId !== noticeUser) seenNotices.clear();
      noticeUser = userId;
      if (seenNotices.has(event.notice.eventId)) return;
      seenNotices.add(event.notice.eventId);
      if (seenNotices.size > 512) {
        const oldest = seenNotices.values().next().value;
        if (oldest !== undefined) seenNotices.delete(oldest);
      }
      this.notify.info(event.notice.title, event.notice.body);
      if (this.leader.isLeader()) {
        this.presentation.playSound();
        this.presentation.showDesktop(
          this.transloco.translate('notifications.title'),
          event.notice.eventId,
        );
      }
    });
    const offRetry = this.bus.on<RealtimeScoped<null>>(RETRY, (message) => {
      if (!this.active() || message.userId !== this.identity()) return;
      const retrySocket = this.config?.realtimeEnabled === true;
      this.stop();
      if (retrySocket) this.realtime.retry();
      void this.refresh(this.term);
    });
    inject(DestroyRef).onDestroy(() => {
      unregister();
      offEvent();
      offNotice();
      offRetry();
      this.suspended = true;
      this.stop();
    });

    effect((onCleanup) => {
      const userId = this.identity();
      const isLeader = this.leader.isLeader();
      onCleanup(() => this.stop());
      untracked(() => {
        this.suspended = false;
        if (!userId) {
          if (isLeader) {
            this.bus.publish(UNREAD, null);
            this.bus.publish(STATE, null);
            this.bus.publish(EVENT, null);
          }
        } else if (isLeader) {
          if (this.publishedUnread()?.userId !== userId) this.bus.publish(UNREAD, null);
          void this.refresh(this.term);
        }
      });
    });
    effect(() => {
      this.identity();
      this.leader.isLeader();
      this.realtime.connection();
      this.realtime.capabilities();
      this.realtime.recoveries();
      untracked(() => this.reconcile());
    });
    let showingFailure = false;
    let lastNotice: string | null = null;
    effect(() => {
      const state = this.state();
      const pinned = this.notify.toasts().some((toast) => toast.pinned);
      untracked(() => {
        if (state.status === 'stale' || state.status === 'failed') {
          const text = state.failure
            ? realtimeErrorMessage(state.failure, this.transloco)
            : this.transloco.translate('session.connectionLost.text');
          if (!pinned || text !== lastNotice) {
            this.notify.connectionLost(this.transloco.translate('notifications.title'), text);
          }
          lastNotice = text;
          showingFailure = true;
        } else if (showingFailure && state.status !== 'loading') {
          this.notify.connectionRestored();
          showingFailure = false;
          lastNotice = null;
        }
      });
    });
  }

  onEvent(handler: (event: NotificationsFeedEvent) => void): () => void {
    return this.bus.on<RealtimeScoped<NotificationsFeedEvent> | null>(EVENT, (message) => {
      if (this.identity() && message?.userId === this.identity()) handler(message.value);
    });
  }

  /** An explicit user retry starts a fresh bounded attempt in the elected leader. */
  retry(): void {
    const userId = this.identity();
    if (userId) this.bus.send<RealtimeScoped<null>>(RETRY, { userId, value: null });
  }

  private receive(message: RealtimeEvent): void {
    if (
      !this.active() ||
      !this.enabled() ||
      !this.config?.realtimeEnabled ||
      this.realtime.capabilities()?.notifications.receive !== true ||
      this.authFailure()
    )
      return;
    switch (message.name) {
      case 'notification.created.v1': {
        const payload = message.event.payload;
        this.publish(EVENT, {
          kind: 'created',
          notificationId: payload.notificationId,
          ...(payload.silent
            ? {}
            : {
                notice: {
                  eventId: message.event.eventId,
                  title: payload.title,
                  body: payload.body,
                },
              }),
        });
        break;
      }
      case 'notification.updated.v1': {
        const payload = message.event.payload;
        const previous = this.versions.get(payload.notificationId);
        if (previous !== undefined && payload.recipientStateVersion <= previous) return;
        this.versions.set(payload.notificationId, payload.recipientStateVersion);
        if (this.versions.size > 512) {
          const oldest = this.versions.keys().next().value;
          if (oldest !== undefined) this.versions.delete(oldest);
        }
        this.publish(EVENT, {
          kind: 'updated',
          notificationId: payload.notificationId,
          change: payload.change,
          readAt: payload.state.readAt,
          acknowledgedAt: payload.state.acknowledgedAt,
          recipientStateVersion: payload.recipientStateVersion,
        });
        break;
      }
      case 'notification.unread-count.changed.v1':
        this.applyUnread(message.event.payload.unreadCount, message.event.payload.unreadRevision);
        break;
      // RealtimeClient translates ready/sync-required (including read-all) into recovery tokens.
    }
  }

  private async refresh(term: number): Promise<void> {
    if (!this.active(term) || this.inFlight || this.authFailure()) {
      this.updateState();
      return;
    }
    this.clearTimer();
    this.inFlight = true;
    // A stalled request stays single-flight, but must never leave the feed looking fresh.
    this.requestDeadline = setTimeout(() => {
      if (!this.active(term)) return;
      this.failure = realtimeFailure(new ApiError(0, 'REALTIME.CLIENT.TIMEOUT'));
      this.updateState();
    }, 10_000);
    this.updateState();
    try {
      if (this.config === null) {
        const parsed = notificationFeedConfigSchema.safeParse(
          await this.http.read<unknown>(`${BASE}/config`),
        );
        if (!this.active(term)) return;
        if (!parsed.success) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        this.config = parsed.data;
      }
      if (!this.enabled()) {
        this.bus.publish(UNREAD, null);
        this.failure = null;
        this.failures = 0;
        return;
      }
      if (this.authFailure()) return;
      const recoveries = this.pendingRecoveries();
      // The count-only endpoint has no revision. A one-item list supplies an authoritative snapshot.
      const parsed = notificationFeedSnapshotSchema.safeParse(
        await this.http.read<unknown>(BASE, { limit: 1 }),
      );
      if (!this.active(term) || this.authFailure()) return;
      if (!parsed.success) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      this.applyUnread(parsed.data.unreadCount, parsed.data.unreadRevision);
      this.initialized = true;
      this.failure = null;
      this.failures = 0;
      this.publish(EVENT, { kind: 'sync' });
      for (const recovery of recoveries) {
        this.handledRecoveries.add(recovery.id);
        // ALL also belongs to CRM/presence; this adapter cannot acknowledge their HTTP refreshes.
        const capabilities = this.realtime.capabilities();
        const notificationsOnly =
          capabilities !== null &&
          !capabilities.crmLeads.receive &&
          !capabilities.presence.publishSelf &&
          capabilities.presence.watchMode === 'NONE';
        if (recovery.scope === 'NOTIFICATIONS' || notificationsOnly) {
          this.realtime.completeRecovery(recovery.id);
        }
      }
      const outstanding = new Set(this.realtime.recoveries().map((recovery) => recovery.id));
      for (const id of this.handledRecoveries) {
        if (!outstanding.has(id)) this.handledRecoveries.delete(id);
      }
    } catch (error) {
      if (!this.active(term)) return;
      this.failure = realtimeFailure(error);
      if (error instanceof ApiError) {
        const seconds = error.details?.['retryAfterSeconds'];
        const delay = Number(Array.isArray(seconds) ? seconds[0] : NaN);
        if (Number.isFinite(delay) && delay > 0)
          this.failure.retryAfterMs = Math.min(delay * 1_000, 3_600_000);
      }
      this.failures = this.failure.retryable ? this.failures + 1 : MAX_FAILURES;
    } finally {
      if (this.active(term)) {
        clearTimeout(this.requestDeadline);
        this.requestDeadline = undefined;
        this.inFlight = false;
        this.reconcile();
      }
    }
  }

  private reconcile(): void {
    if (!this.active()) return;
    this.clearTimer();
    this.updateState();
    if (
      this.authFailure() ||
      this.failures >= MAX_FAILURES ||
      (this.config !== null && !this.enabled()) ||
      this.inFlight
    )
      return;
    if (this.config === null || !this.initialized || this.pendingRecoveries().length > 0) {
      if (this.failures === 0) {
        void this.refresh(this.term);
        return;
      }
    } else if (this.live() && this.failure === null) return;
    const interval = Math.max(5_000, Math.min(3_600_000, this.config?.pollIntervalMs ?? 60_000));
    const delay = Math.max(
      Math.min(Math.max(interval, 300_000), interval * 2 ** Math.min(this.failures, MAX_FAILURES)),
      this.failure?.retryAfterMs ?? 0,
    );
    const term = this.term;
    this.timer = setTimeout(() => void this.refresh(term), delay);
  }

  private applyUnread(unreadCount: number, unreadRevision: number): void {
    const previous = this.unread();
    if (
      previous !== null &&
      previous.unreadRevision !== null &&
      unreadRevision <= previous.unreadRevision
    )
      return;
    this.publish(UNREAD, { unreadCount, unreadRevision, at: Date.now() });
  }

  private pendingRecoveries() {
    return this.realtime
      .recoveries()
      .filter(
        (recovery) =>
          (recovery.scope === 'NOTIFICATIONS' || recovery.scope === 'ALL') &&
          !this.handledRecoveries.has(recovery.id),
      );
  }

  private enabled(): boolean {
    return this.config?.enabled === true && this.config.inAppEnabled;
  }

  private live(): boolean {
    const connection = this.realtime.connection();
    return (
      this.config?.realtimeEnabled === true &&
      this.realtime.capabilities()?.notifications.receive === true &&
      connection.status === 'connected' &&
      !connection.stale
    );
  }

  private authFailure(): RealtimeFailure | null {
    const connection = this.realtime.connection();
    return connection.status === 'failed' && connection.failure?.code.includes('.AUTH.')
      ? connection.failure
      : null;
  }

  private updateState(): void {
    if (!this.active()) return;
    const connection = this.realtime.connection();
    const failure = this.failure ?? this.authFailure();
    let status: NotificationsFeedState['status'];
    if (this.config !== null && !this.enabled()) status = 'disabled';
    else if (this.authFailure() || this.failures >= MAX_FAILURES) status = 'failed';
    else if (failure) status = 'stale';
    else if (!this.initialized) status = 'loading';
    else if (this.live()) status = 'live';
    else if (
      !this.config?.realtimeEnabled ||
      this.realtime.capabilities()?.notifications.receive === false
    )
      status = 'polling';
    else status = 'stale';
    this.publish(STATE, {
      status,
      stale: !['live', 'polling', 'disabled'].includes(status),
      failure: failure ?? (status === 'stale' ? connection.failure : null),
      at: Date.now(),
    });
  }

  private publish<T>(topic: string, value: T): void {
    const userId = this.identity();
    if (userId && this.active()) this.bus.publish<RealtimeScoped<T>>(topic, { userId, value });
  }

  private active(term = this.term): boolean {
    return (
      term === this.term && !this.suspended && this.leader.isLeader() && this.identity() !== null
    );
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private stop(): void {
    this.term++;
    this.clearTimer();
    clearTimeout(this.requestDeadline);
    this.requestDeadline = undefined;
    this.inFlight = false;
    this.initialized = false;
    this.config = null;
    this.failures = 0;
    this.failure = null;
    this.handledRecoveries.clear();
    this.versions.clear();
  }
}
