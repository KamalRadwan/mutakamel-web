import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChecklist,
  tablerCloudOff,
  tablerFileDescription,
  tablerUserPlus,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AccountSection } from '../../shared/account-section/account-section';
import { NotificationPreferencesApi, notificationsErrorMessage } from '../notifications.api';
import {
  NOTIFICATION_GROUPS,
  effectivePreferences,
  notificationTypeI18nKey,
  type NotificationType,
} from '../notifications.model';

@Component({
  selector: 'app-notifications-page',
  imports: [NgIcon, TranslocoPipe, Button, Field, Switch, AccountSection],
  providers: [
    provideTranslocoScope({ scope: 'ws-account-notifications', alias: 'wsAccNotif' }),
    provideIcons({
      tablerChecklist,
      tablerUserPlus,
      tablerFileDescription,
      tablerCloudOff,
    }),
  ],
  templateUrl: './notifications-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class NotificationsPage {
  private static nextId = 0;
  protected readonly uid = `notifications-page-${++NotificationsPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly api = inject(NotificationPreferencesApi);

  protected readonly groups = NOTIFICATION_GROUPS;
  protected readonly skeletonCards = [0, 1, 2] as const;

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly values = signal<Record<NotificationType, boolean>>(effectivePreferences([]));
  private readonly pendingTypes = signal<ReadonlySet<NotificationType>>(new Set());

  private loadSeq = 0;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const rows = await this.api.listNotificationPreferences();
      if (seq !== this.loadSeq) return;
      this.values.set(effectivePreferences(rows));
      this.notify.connectionRestored();
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(
          this.transloco.translate('session.connectionLost.title'),
          this.transloco.translate('session.connectionLost.text'),
        );
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected typeKey(type: NotificationType): string {
    return notificationTypeI18nKey(type);
  }

  protected rowId(type: NotificationType): string {
    return `${this.uid}-${notificationTypeI18nKey(type)}`;
  }

  protected isPending(type: NotificationType): boolean {
    return this.pendingTypes().has(type);
  }

  protected async onToggle(type: NotificationType, next: boolean): Promise<void> {
    if (this.isPending(type) || next === this.values()[type]) return;

    const previous = this.values()[type];
    this.values.update((current) => ({ ...current, [type]: next }));
    this.setPending(type, true);

    try {
      // One toggle is one user action: a fresh key per toggle (a failed toggle reverts, so there is no retry).
      const saved = await this.api.upsertNotificationPreference(
        { notificationType: type, inAppEnabled: next },
        newIdempotencyKey(),
      );
      this.values.update((current) => ({ ...current, [type]: saved.inAppEnabled }));
      this.notify.success(this.transloco.translate('wsAccNotif.toast.saved'));
    } catch (error) {
      this.values.update((current) => ({ ...current, [type]: previous }));
      this.notify.error(notificationsErrorMessage(error, 'wsAccNotif', this.transloco, 'write'));
    } finally {
      this.setPending(type, false);
    }
  }

  private setPending(type: NotificationType, pending: boolean): void {
    this.pendingTypes.update((current) => {
      const next = new Set(current);
      if (pending) next.add(type);
      else next.delete(type);
      return next;
    });
  }
}
