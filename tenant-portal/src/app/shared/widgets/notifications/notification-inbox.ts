import {
  DestroyRef,
  Injectable,
  InjectionToken,
  Service,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ApiError, errorCodeOf } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../core/notify/notify';
import { NotificationsFeed } from '../../../core/realtime/notifications-feed';
import type {
  NotificationsFeedEvent,
  NotificationsUnreadState,
} from '../../../core/realtime/notifications-feed.model';
import { NotificationsApi } from './notifications.api';
import {
  NOTIFICATION_LIMITS,
  NotificationListResult,
  NotificationQuery,
  NotificationView,
} from './notifications.model';

export const NOTIFICATION_INBOX_PAGE_SIZE = new InjectionToken<number>(
  'NOTIFICATION_INBOX_PAGE_SIZE',
);

/** Coordinates reloads between independent notification inboxes (bell and page) after writes. */
@Service()
export class NotificationsSync {
  private readonly _revision = signal(0);
  private _origin: NotificationInbox | null = null;

  readonly revision = this._revision.asReadonly();

  changed(origin: NotificationInbox): void {
    this._origin = origin;
    this._revision.update((value) => value + 1);
  }

  isOrigin(inbox: NotificationInbox): boolean {
    return this._origin === inbox;
  }
}

/** Cursor-paged inbox state shared by the top-bar bell and the workspace notifications page. */
@Injectable()
export class NotificationInbox {
  private readonly api = inject(NotificationsApi);
  private readonly feed = inject(NotificationsFeed);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly sync = inject(NotificationsSync);

  readonly pageSize =
    inject(NOTIFICATION_INBOX_PAGE_SIZE, { optional: true }) ?? NOTIFICATION_LIMITS.defaultLimit;

  readonly items = signal<NotificationView[]>([]);
  readonly unreadCount = signal(0);
  readonly unreadRevision = signal(0);
  readonly stale = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly userMissing = signal(false);
  readonly unreadOnly = signal(false);

  private loadSeq = 0;
  private listUnreadCount = 0;
  private destroyed = false;
  /**
   * x-idempotency-key per user action ("read:<id>", "read-all", ...). A failed action keeps its key, so
   * clicking it again is a retry with the same key; a success or a 404 (item gone) forgets it.
   */
  private readonly actionKeys = new Map<string, string>();

  constructor() {
    effect(() => untracked(() => void this.reload()));
    effect(() => {
      const state = this.feed.unread();
      if (state) untracked(() => this.applyUnread(state));
    });
    const unsubscribe = this.feed.onEvent((event) => void this.onFeedEvent(event));
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq++;
      unsubscribe();
    });

    let seenRevision = this.sync.revision();
    effect(() => {
      const revision = this.sync.revision();
      if (revision === seenRevision) return;
      seenRevision = revision;
      if (this.sync.isOrigin(this)) return;
      untracked(() => void this.reload());
    });
  }

  async reload(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.userMissing.set(false);
    try {
      const query: NotificationQuery = { limit: this.pageSize };
      if (this.unreadOnly()) query.unreadOnly = true;
      const page = await this.api.listNotifications(query);
      if (seq !== this.loadSeq) return;
      this.items.set(page.items);
      this.applyListSnapshot(page, true);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.connectionError(error);
      if (errorCodeOf(error) === 'NOTIFICATION_USER_NOT_FOUND') {
        this.userMissing.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loading()) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    let shouldReloadOnce = false;
    let failed: unknown = null;
    try {
      const query: NotificationQuery = { limit: this.pageSize, cursor };
      if (this.unreadOnly()) query.unreadOnly = true;
      const page = await this.api.listNotifications(query);
      if (seq !== this.loadSeq) return;
      const seen = new Set(this.items().map((item) => item.id));
      this.items.update((items) => [
        ...items,
        ...page.items.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }),
      ]);
      this.applyListSnapshot(page, false);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.connectionError(error);
      const code = errorCodeOf(error);
      if (code === 'NOTIFICATION_CURSOR_INVALID') {
        shouldReloadOnce = true;
      } else if (code === 'NOTIFICATION_USER_NOT_FOUND') {
        this.userMissing.set(true);
      } else {
        this.loadFailed.set(true);
        failed = error;
      }
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
    if (shouldReloadOnce) {
      await this.reload();
      return;
    }
    if (failed !== null) throw failed;
  }

  async markRead(id: string, known?: NotificationView): Promise<void> {
    const existing = this.items().find((entry) => entry.id === id);
    const item = existing ?? known;
    if (!item || item.readAt !== null) return;
    const prevUnread = this.unreadCount();
    const readAt = new Date().toISOString();
    if (existing) this.patch(id, { readAt });
    this.unreadCount.update((count) => Math.max(0, count - 1));
    const action = `read:${id}`;
    let failed: unknown = null;
    try {
      await this.api.markNotificationRead(id, this.keyFor(action));
      this.actionKeys.delete(action);
      this.patch(id, { readAt });
      this.sync.changed(this);
    } catch (error) {
      failed = this.recover(error, id, action, () => {
        if (existing) this.patch(id, { readAt: null });
        this.unreadCount.set(prevUnread);
      });
    }
    if (failed === null) await this.refreshUnreadCount();
    if (failed !== null) throw failed;
  }

  async acknowledge(id: string, known?: NotificationView): Promise<void> {
    const existing = this.items().find((entry) => entry.id === id);
    const item = existing ?? known;
    if (!item || item.acknowledgedAt !== null) return;
    const prevUnread = this.unreadCount();
    const wasUnread = item.readAt === null;
    const now = new Date().toISOString();
    if (existing) this.patch(id, { acknowledgedAt: now, readAt: item.readAt ?? now });
    if (wasUnread) this.unreadCount.update((count) => Math.max(0, count - 1));
    const action = `acknowledge:${id}`;
    let failed: unknown = null;
    try {
      await this.api.acknowledgeNotification(id, this.keyFor(action));
      this.actionKeys.delete(action);
      const after = this.items().find((entry) => entry.id === id);
      if (after) this.patch(id, { acknowledgedAt: now, readAt: after.readAt ?? now });
      this.sync.changed(this);
    } catch (error) {
      failed = this.recover(error, id, action, () => {
        if (existing) this.patch(id, { acknowledgedAt: null, readAt: item.readAt });
        if (wasUnread) this.unreadCount.set(prevUnread);
      });
    }
    if (failed === null) await this.refreshUnreadCount();
    if (failed !== null) throw failed;
  }

  async dismiss(id: string, known?: NotificationView): Promise<void> {
    const before = this.items();
    const existing = before.find((entry) => entry.id === id);
    const item = existing ?? known;
    if (!item) return;
    const prevUnread = this.unreadCount();
    const wasUnread = item.readAt === null;
    if (existing) this.items.set(before.filter((entry) => entry.id !== id));
    if (wasUnread) this.unreadCount.update((count) => Math.max(0, count - 1));
    const action = `dismiss:${id}`;
    let failed: unknown = null;
    try {
      await this.api.dismissNotification(id, this.keyFor(action));
      this.actionKeys.delete(action);
      this.items.update((items) => items.filter((entry) => entry.id !== id));
      this.sync.changed(this);
    } catch (error) {
      failed = this.recover(error, id, action, () => {
        if (existing) this.items.set(before);
        if (wasUnread) this.unreadCount.set(prevUnread);
      });
    }
    if (failed === null) await this.refreshUnreadCount();
    if (failed !== null) throw failed;
  }

  async markAllRead(): Promise<void> {
    const before = this.items();
    const prevUnread = this.unreadCount();
    const now = new Date().toISOString();
    this.items.set(before.map((item) => (item.readAt === null ? { ...item, readAt: now } : item)));
    this.unreadCount.set(0);
    let failed: unknown = null;
    try {
      await this.api.markAllNotificationsRead(this.keyFor('read-all'));
      this.actionKeys.delete('read-all');
      this.items.update((items) =>
        items.map((item) => (item.readAt === null ? { ...item, readAt: now } : item)),
      );
      this.sync.changed(this);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) this.actionKeys.delete('read-all');
      if (errorCodeOf(error) === 'NOTIFICATION_USER_NOT_FOUND') this.userMissing.set(true);
      this.items.set(before);
      this.unreadCount.set(prevUnread);
      failed = error;
    }
    if (failed === null) await this.refreshUnreadCount();
    if (failed !== null) throw failed;
  }

  private async refreshUnreadCount(): Promise<void> {
    try {
      const seq = this.loadSeq;
      const revision = this.unreadRevision();
      const result = await this.api.getUnreadNotificationCount();
      if (
        !this.destroyed &&
        seq === this.loadSeq &&
        revision === this.unreadRevision() &&
        !this.loading()
      ) {
        this.unreadCount.set(result.unreadCount);
      }
    } catch {
      // Keep the local count; the next list load returns the server snapshot.
    }
  }

  private keyFor(action: string): string {
    let key = this.actionKeys.get(action);
    if (!key) {
      key = newIdempotencyKey();
      this.actionKeys.set(action, key);
    }
    return key;
  }

  /**
   * 404 NOTIFICATION_NOT_FOUND means the item is gone or out of scope: drop it and its key. Anything else
   * rolls back, keeps the key for a retry, and returns the error.
   */
  private recover(error: unknown, id: string, action: string, rollback: () => void): unknown {
    if (error instanceof ApiError && error.status === 404) this.actionKeys.delete(action);
    if (errorCodeOf(error) === 'NOTIFICATION_USER_NOT_FOUND') this.userMissing.set(true);
    if (errorCodeOf(error) === 'NOTIFICATION_NOT_FOUND') {
      this.actionKeys.delete(action);
      this.items.update((items) => items.filter((entry) => entry.id !== id));
      return null;
    }
    rollback();
    return error;
  }

  private patch(id: string, changes: Partial<NotificationView>): void {
    this.items.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  private applyListSnapshot(page: NotificationListResult, reset: boolean): void {
    this.listUnreadCount = page.unreadCount;
    if (page.unreadRevision >= this.unreadRevision()) {
      this.unreadCount.set(page.unreadCount);
      this.unreadRevision.set(page.unreadRevision);
    }
    if (reset) this.stale.set(this.unreadCount() > page.unreadCount);
    this.notify.connectionRestored();
  }

  private applyUnread(state: NotificationsUnreadState): void {
    if (
      state.unreadRevision === null ? this.loading() : state.unreadRevision <= this.unreadRevision()
    )
      return;
    this.unreadCount.set(state.unreadCount);
    if (state.unreadRevision !== null) this.unreadRevision.set(state.unreadRevision);
    if (state.unreadCount > this.listUnreadCount) this.stale.set(true);
  }

  private async onFeedEvent(event: NotificationsFeedEvent): Promise<void> {
    if (event.kind === 'sync') {
      await this.reload();
    } else if (event.kind === 'created') {
      try {
        const item = await this.api.getNotification(event.notificationId);
        if (this.destroyed || (this.unreadOnly() && item.readAt !== null)) return;
        this.items.update((items) =>
          items.some((row) => row.id === item.id) ? items : [item, ...items],
        );
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) this.connectionError(error);
      }
    } else {
      const row = this.items().find((item) => item.id === event.notificationId);
      if (!row || event.recipientStateVersion <= row.recipientStateVersion) return;
      if (event.change === 'DISMISSED') {
        this.items.update((items) => items.filter((item) => item.id !== event.notificationId));
      } else {
        this.patch(event.notificationId, {
          readAt: event.readAt,
          acknowledgedAt: event.acknowledgedAt,
          recipientStateVersion: event.recipientStateVersion,
        });
      }
    }
  }

  private connectionError(error: unknown): void {
    if (error instanceof ApiError && error.status === 0) {
      this.notify.connectionLost(
        this.transloco.translate('session.connectionLost.title'),
        this.transloco.translate('session.connectionLost.text'),
      );
    }
  }
}
