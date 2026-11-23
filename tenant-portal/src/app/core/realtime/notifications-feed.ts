import { DestroyRef, Service, computed, effect, inject, untracked } from '@angular/core';
import { CoreHttp } from '../api/core-http';
import { AuthSession } from '../auth/auth-session';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import type { NotificationsFeedEvent, NotificationsUnreadState } from './notifications-feed.model';

const NOTIFICATIONS_BASE = '/api/tenant/core/v1/notifications';
const DEFAULT_POLL_INTERVAL_MS = 60_000;

@Service()
export class NotificationsFeed {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly leader = inject(TabLeader);
  private readonly bus = inject(TabBus);
  private readonly publishedUnread = this.bus.state<NotificationsUnreadState>('notifications.unread');

  // A follower cannot clear the leader's topic when its own session ends.
  readonly unread = computed(() => this.session.status() === 'signed-in' ? this.publishedUnread() : null);

  private term = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const unregister = this.leader.registerStandDown('notifications-feed', async () => this.stop());
    inject(DestroyRef).onDestroy(() => {
      unregister();
      this.stop();
    });

    effect((onCleanup) => {
      const signedIn = this.session.status() === 'signed-in';
      const isLeader = this.leader.isLeader();
      onCleanup(() => this.stop());
      untracked(() => {
        if (!signedIn) {
          if (isLeader) this.bus.publish('notifications.unread', null);
          return;
        }
        if (isLeader) void this.start(this.term);
      });
    });
  }

  onEvent(handler: (event: NotificationsFeedEvent) => void): () => void {
    return this.bus.on<NotificationsFeedEvent>('notifications.event', (event) => handler(event));
  }

  private async start(term: number): Promise<void> {
    let interval = DEFAULT_POLL_INTERVAL_MS;
    try {
      const config = await this.http.read<{ pollIntervalMs: number }>(`${NOTIFICATIONS_BASE}/config`);
      if (Number.isFinite(config.pollIntervalMs)) {
        interval = Math.max(5_000, Math.min(3_600_000, config.pollIntervalMs));
      }
    } catch {
      // Config is not self-service on older gateway images; use the poll defaults.
    }
    if (!this.isActive(term)) return;

    let polling = false;
    const poll = async () => {
      if (polling || !this.isActive(term)) return;
      polling = true;
      try {
        const { unreadCount } = await this.http.read<{ unreadCount: number }>(`${NOTIFICATIONS_BASE}/unread-count`);
        if (this.isActive(term) && this.publishedUnread()?.unreadCount !== unreadCount) {
          this.bus.publish<NotificationsUnreadState>('notifications.unread', {
            unreadCount, unreadRevision: null, at: Date.now(),
          });
        }
      } catch {
        // Keep the last count and retry on the next tick.
      } finally {
        polling = false;
      }
    };
    this.timer = setInterval(() => void poll(), interval);
    void poll();
  }

  private isActive(term: number): boolean {
    return term === this.term && this.leader.isLeader() && this.session.status() === 'signed-in';
  }

  private stop(): void {
    this.term++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
