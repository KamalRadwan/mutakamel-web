import { Service } from '@angular/core';
import { NotificationInbox } from './notification-inbox';

/** Inbox state for the top-bar bell. Reads and writes go through `notifications.api`. */
@Service()
export class NotificationsState {
  private readonly inbox = new NotificationInbox();

  readonly items = this.inbox.items;
  readonly unreadCount = this.inbox.unreadCount;
  readonly nextCursor = this.inbox.nextCursor;
  readonly loading = this.inbox.loading;
  readonly loadFailed = this.inbox.loadFailed;

  reload(): Promise<void> {
    return this.inbox.reload();
  }

  loadMore(): Promise<void> {
    return this.inbox.loadMore().catch(() => undefined);
  }

  markRead(id: string): Promise<void> {
    return this.inbox.markRead(id).catch(() => undefined);
  }

  acknowledge(id: string): Promise<void> {
    return this.inbox.acknowledge(id).catch(() => undefined);
  }

  dismiss(id: string): Promise<void> {
    return this.inbox.dismiss(id).catch(() => undefined);
  }

  markAllRead(): Promise<void> {
    return this.inbox.markAllRead().catch(() => undefined);
  }
}
