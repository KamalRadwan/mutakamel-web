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
import { NotificationsApi, notificationsErrorMessage } from './notifications.api';
import {
  NOTIFICATION_LIMITS,
  NotificationListResult,
  NotificationQuery,
  NotificationView,
} from './notifications.model';

export const NOTIFICATION_INBOX_PAGE_SIZE = new InjectionToken<number>(
  'NOTIFICATION_INBOX_PAGE_SIZE',
);

type RecipientUpdate = Extract<NotificationsFeedEvent, { kind: 'updated' }>;
type ChangeKind = 'read' | 'acknowledge' | 'dismiss' | 'read-all';
interface PendingChange {
  kind: ChangeKind;
  ids: ReadonlySet<string>;
  at: string;
  unreadDelta: number;
  countEpoch: number;
}

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
  private rows: NotificationView[] = [];
  private readonly recipientUpdates = new Map<string, RecipientUpdate>();
  private readonly dismissed = new Set<string>();
  private readonly pending = new Map<string, PendingChange>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly changedRows = new Map<string, number>();
  private changeEpoch = 0;
  private countEpoch = 0;
  private countBase = 0;
  private countSeq = 0;
  private countRefresh: Promise<void> | null = null;
  private countRefreshAgain = false;
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
    if (this.destroyed) return;
    const seq = ++this.loadSeq;
    const epoch = this.changeEpoch;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.userMissing.set(false);
    try {
      const query: NotificationQuery = { limit: this.pageSize };
      if (this.unreadOnly()) query.unreadOnly = true;
      const page = await this.api.listNotifications(query);
      if (seq !== this.loadSeq) return;
      const changed = this.rows.filter((row) => (this.changedRows.get(row.id) ?? 0) > epoch);
      this.mergeRows([...changed, ...page.items], true);
      this.applyListSnapshot(page, true, epoch);
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
    if (this.destroyed || !cursor || this.loading()) return;
    const seq = ++this.loadSeq;
    const epoch = this.changeEpoch;
    this.loading.set(true);
    let shouldReloadOnce = false;
    let failed: unknown = null;
    try {
      const query: NotificationQuery = { limit: this.pageSize, cursor };
      if (this.unreadOnly()) query.unreadOnly = true;
      const page = await this.api.listNotifications(query);
      if (seq !== this.loadSeq) return;
      this.mergeRows(page.items, false);
      this.applyListSnapshot(page, false, epoch);
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

  markRead(id: string, known?: NotificationView): Promise<void> {
    return this.change('read', id, known);
  }

  acknowledge(id: string, known?: NotificationView): Promise<void> {
    return this.change('acknowledge', id, known);
  }

  dismiss(id: string, known?: NotificationView): Promise<void> {
    return this.change('dismiss', id, known);
  }

  markAllRead(): Promise<void> {
    return this.change('read-all');
  }

  private change(kind: ChangeKind, id?: string, known?: NotificationView): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const action = kind === 'read-all' ? kind : `${kind}:${id}`;
    const inFlight = this.writes.get(action);
    if (inFlight) return inFlight;
    const item = this.items().find((row) => row.id === id) ?? known;
    if (kind !== 'read-all') {
      if (!item || this.dismissed.has(item.id)) return Promise.resolve();
      if (kind === 'read' && item.readAt !== null) return Promise.resolve();
      if (kind === 'acknowledge' && item.acknowledgedAt !== null) return Promise.resolve();
    }
    const change: PendingChange = {
      kind,
      ids: new Set(kind === 'read-all' ? this.rows.map((row) => row.id) : item ? [item.id] : []),
      at: new Date().toISOString(),
      unreadDelta:
        kind === 'read-all'
          ? this.countBase
          : (this.rows.find((row) => row.id === id) ?? item)?.readAt === null
            ? 1
            : 0,
      countEpoch: this.countEpoch,
    };
    this.pending.set(action, change);
    this.changeEpoch++;
    this.publish();
    const done = this.writeChange(action, change, id).finally(() => this.writes.delete(action));
    this.writes.set(action, done);
    return done;
  }

  private async writeChange(action: string, change: PendingChange, id?: string): Promise<void> {
    try {
      const key = this.keyFor(action);
      if (change.kind === 'read-all') await this.api.markAllNotificationsRead(key);
      else if (id !== undefined) {
        if (change.kind === 'read') await this.api.markNotificationRead(id, key);
        else if (change.kind === 'acknowledge') await this.api.acknowledgeNotification(id, key);
        else await this.api.dismissNotification(id, key);
      }
      if (this.destroyed) return;
      this.actionKeys.delete(action);
      if (change.countEpoch === this.countEpoch) {
        this.countBase = Math.max(0, this.countBase - this.unreadDelta(change));
      }
      if (change.kind === 'dismiss') {
        for (const changedId of change.ids) this.dismissed.add(changedId);
      } else {
        this.rows = this.rows.map((row) =>
          change.ids.has(row.id) ? this.applyChange(row, change) : row,
        );
      }
      for (const changedId of change.ids) this.changedRows.set(changedId, ++this.changeEpoch);
      this.sync.changed(this);
    } catch (error) {
      if (this.destroyed) return;
      this.connectionError(error);
      if (error instanceof ApiError && error.status === 404) this.actionKeys.delete(action);
      if (errorCodeOf(error) === 'NOTIFICATION_USER_NOT_FOUND') this.userMissing.set(true);
      if (id !== undefined && errorCodeOf(error) === 'NOTIFICATION_NOT_FOUND') {
        if (change.countEpoch === this.countEpoch) {
          this.countBase = Math.max(0, this.countBase - this.unreadDelta(change));
        }
        this.dismissed.add(id);
        this.actionKeys.delete(action);
        this.sync.changed(this);
      } else {
        this.stale.set(true);
        throw error;
      }
    } finally {
      if (!this.destroyed) {
        this.pending.delete(action);
        this.changeEpoch++;
        this.publish();
      }
    }
    if (!this.destroyed) await this.refreshUnreadCount();
  }

  private refreshUnreadCount(): Promise<void> {
    if (this.countRefresh) {
      this.countRefreshAgain = true;
      return this.countRefresh;
    }
    this.countRefresh = (async () => {
      do {
        this.countRefreshAgain = false;
        await this.readUnreadCount();
      } while (this.countRefreshAgain && !this.destroyed);
    })().finally(() => {
      this.countRefresh = null;
    });
    return this.countRefresh;
  }

  private async readUnreadCount(): Promise<void> {
    const seq = ++this.countSeq;
    const epoch = this.changeEpoch;
    const load = this.loadSeq;
    const revision = this.unreadRevision();
    try {
      const result = await this.api.getUnreadNotificationCount();
      if (!Number.isSafeInteger(result.unreadCount) || result.unreadCount < 0) {
        throw new ApiError(502, 'GENERIC');
      }
      if (this.destroyed || seq !== this.countSeq) return;
      if (
        epoch !== this.changeEpoch ||
        load !== this.loadSeq ||
        revision !== this.unreadRevision() ||
        this.loading() ||
        this.pending.size > 0
      ) {
        this.stale.set(true);
        return;
      }
      this.countBase = result.unreadCount;
      this.countEpoch++;
      this.publish();
      this.notify.connectionRestored();
    } catch (error) {
      if (this.destroyed || seq !== this.countSeq) return;
      this.recoveryError(error);
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

  /** Keep server rows separate from pending intent so one failure cannot undo another write. */
  private publish(): void {
    let rows = this.rows.filter((row) => !this.dismissed.has(row.id));
    let allDelta = 0;
    const unreadIds = new Set<string>();
    for (const change of this.pending.values()) {
      rows = rows.flatMap((row) => {
        if (!change.ids.has(row.id)) return [row];
        return change.kind === 'dismiss' ? [] : [this.applyChange(row, change)];
      });
      if (change.countEpoch === this.countEpoch) {
        if (change.kind === 'read-all') allDelta = Math.max(allDelta, this.unreadDelta(change));
        else if (this.unreadDelta(change) > 0) {
          for (const id of change.ids) unreadIds.add(id);
        }
      }
    }
    this.items.set(this.unreadOnly() ? rows.filter((row) => row.readAt === null) : rows);
    this.unreadCount.set(Math.max(0, this.countBase - Math.max(allDelta, unreadIds.size)));
  }

  private unreadDelta(change: PendingChange): number {
    if (change.kind === 'read-all') return Math.min(this.countBase, change.unreadDelta);
    for (const id of change.ids) {
      if (this.dismissed.has(id)) return 0;
      const row = this.rows.find((item) => item.id === id);
      if (row) return row.readAt === null ? 1 : 0;
    }
    return change.unreadDelta;
  }

  private applyChange(row: NotificationView, change: PendingChange): NotificationView {
    return {
      ...row,
      readAt: row.readAt ?? change.at,
      acknowledgedAt:
        change.kind === 'acknowledge' ? (row.acknowledgedAt ?? change.at) : row.acknowledgedAt,
    };
  }

  private mergeRows(incoming: NotificationView[], reset: boolean): void {
    const previous = new Map(this.rows.map((row) => [row.id, row]));
    const merged = new Map<string, NotificationView>();
    for (const item of reset ? incoming : [...this.rows, ...incoming]) {
      if (this.dismissed.has(item.id)) continue;
      const old = merged.get(item.id) ?? previous.get(item.id);
      const row =
        old && old.recipientStateVersion > item.recipientStateVersion
          ? old
          : {
              ...item,
              // Recipient reads and acknowledgements are monotonic, including HTTP 204 confirmations.
              readAt: item.readAt ?? old?.readAt ?? null,
              acknowledgedAt: item.acknowledgedAt ?? old?.acknowledgedAt ?? null,
            };
      const update = this.recipientUpdates.get(item.id);
      merged.set(
        item.id,
        update && update.recipientStateVersion > row.recipientStateVersion
          ? {
              ...row,
              readAt: update.readAt,
              acknowledgedAt: update.acknowledgedAt,
              recipientStateVersion: update.recipientStateVersion,
            }
          : row,
      );
    }
    this.rows = [...merged.values()];
    this.publish();
  }

  private applyListSnapshot(page: NotificationListResult, reset: boolean, epoch: number): void {
    this.listUnreadCount = page.unreadCount;
    if (
      page.unreadRevision > this.unreadRevision() ||
      (page.unreadRevision === this.unreadRevision() && epoch === this.changeEpoch)
    ) {
      this.countBase = page.unreadCount;
      this.countEpoch++;
      this.unreadRevision.set(page.unreadRevision);
    }
    this.changeEpoch++;
    this.publish();
    if (reset) this.stale.set(this.unreadCount() > page.unreadCount);
    this.notify.connectionRestored();
  }

  private applyUnread(state: NotificationsUnreadState): void {
    if (
      this.destroyed ||
      (state.unreadRevision === null
        ? this.loading()
        : state.unreadRevision <= this.unreadRevision())
    )
      return;
    this.countBase = state.unreadCount;
    this.countEpoch++;
    this.changeEpoch++;
    if (state.unreadRevision !== null) this.unreadRevision.set(state.unreadRevision);
    this.publish();
    if (state.unreadCount > this.listUnreadCount) this.stale.set(true);
  }

  private async onFeedEvent(event: NotificationsFeedEvent): Promise<void> {
    if (this.destroyed) return;
    if (event.kind === 'sync') {
      await this.reload();
    } else if (event.kind === 'created') {
      const seq = this.loadSeq;
      try {
        const item = await this.api.getNotification(event.notificationId);
        if (this.destroyed) return;
        if (seq !== this.loadSeq) {
          this.stale.set(true);
          return;
        }
        this.changedRows.set(item.id, ++this.changeEpoch);
        this.mergeRows([item, ...this.rows], true);
      } catch (error) {
        if (this.destroyed || seq !== this.loadSeq) return;
        if (errorCodeOf(error) === 'NOTIFICATION_NOT_FOUND') {
          this.dismissed.add(event.notificationId);
          if (this.rows.some((row) => row.id === event.notificationId)) this.stale.set(true);
          this.publish();
          return;
        }
        this.recoveryError(error);
      }
    } else {
      const row = this.rows.find((item) => item.id === event.notificationId);
      const previous = this.recipientUpdates.get(event.notificationId);
      const version = Math.max(
        row?.recipientStateVersion ?? -1,
        previous?.recipientStateVersion ?? -1,
      );
      if (event.recipientStateVersion <= version) return;
      this.recipientUpdates.set(event.notificationId, event);
      this.changedRows.set(event.notificationId, ++this.changeEpoch);
      if (event.change === 'DISMISSED') this.dismissed.add(event.notificationId);
      this.mergeRows(this.rows, true);
    }
  }
  private recoveryError(error: unknown): void {
    this.stale.set(true);
    if (errorCodeOf(error) === 'NOTIFICATION_USER_NOT_FOUND') this.userMissing.set(true);
    this.connectionError(error);
    if (!(error instanceof ApiError && error.status === 0)) {
      this.notify.error(notificationsErrorMessage(error, 'wsNotif', this.transloco));
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
