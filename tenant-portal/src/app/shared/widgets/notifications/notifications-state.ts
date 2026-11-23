import { Service, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../core/notify/notify';
import { notificationsErrorMessage } from './notifications.api';
import { NotificationInbox } from './notification-inbox';

/** Inbox state for the top-bar bell. Reads and writes go through `notifications.api`. */
@Service()
export class NotificationsState {
  private readonly inbox = new NotificationInbox();
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  readonly items = this.inbox.items;
  readonly unreadCount = this.inbox.unreadCount;
  readonly unreadRevision = this.inbox.unreadRevision;
  readonly stale = this.inbox.stale;
  readonly userMissing = this.inbox.userMissing;
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
    return this.inbox.markRead(id).catch((error) => this.writeError(error));
  }

  acknowledge(id: string): Promise<void> {
    return this.inbox.acknowledge(id).catch((error) => this.writeError(error));
  }

  dismiss(id: string): Promise<void> {
    return this.inbox.dismiss(id).catch((error) => this.writeError(error));
  }

  markAllRead(): Promise<void> {
    return this.inbox.markAllRead().catch((error) => this.writeError(error));
  }

  private writeError(error: unknown): void {
    this.notify.error(notificationsErrorMessage(error, 'wsNotif', this.transloco, 'write'));
  }
}
