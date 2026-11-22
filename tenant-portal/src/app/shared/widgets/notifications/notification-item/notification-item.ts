import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChecklist,
  tablerCircleCheck,
  tablerCircleX,
  tablerClock,
  tablerInfoCircle,
  tablerPencil,
  tablerTrash,
  tablerUserPlus,
  tablerUserShare,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../ui/button/button';
import { dayGroupOf, formatNotificationTime, isJustNow } from '../notification-time';
import { NotificationView, notificationLook } from '../notifications.model';

@Component({
  selector: 'app-notification-item',
  imports: [TranslocoPipe, NgIcon, Button],
  providers: [
    provideIcons({
      tablerChecklist,
      tablerCircleCheck,
      tablerCircleX,
      tablerClock,
      tablerInfoCircle,
      tablerPencil,
      tablerTrash,
      tablerUserPlus,
      tablerUserShare,
      tablerX,
    }),
  ],
  viewProviders: [provideTranslocoScope({ scope: 'ws-notifications', alias: 'wsNotif' })],
  templateUrl: './notification-item.html',
  host: { class: 'block' },
})
export class NotificationItem {
  private readonly language = inject(LanguageState);

  readonly item = input.required<NotificationView>();
  readonly timeLabel = input.required<string>();
  readonly showAcknowledge = input(false);

  readonly opened = output<void>();
  readonly dismissed = output<void>();
  readonly acknowledged = output<void>();

  protected readonly look = computed(() => notificationLook(this.item().notificationType));

  /** `null` while the acknowledgement is under a minute old, so the line reads "just now". */
  protected readonly acknowledgedTimeLabel = computed(() => {
    const iso = this.item().acknowledgedAt;
    if (!iso) return '';
    const now = new Date();
    if (isJustNow(iso, now.getTime())) return null;
    return formatNotificationTime(iso, dayGroupOf(iso, now), this.language.current(), now.getTime(), true);
  });

  protected onOpen(event: Event): void {
    event.stopPropagation();
    this.opened.emit();
  }

  protected onAcknowledge(event: Event): void {
    event.stopPropagation();
    this.acknowledged.emit();
  }

  protected onDismiss(event: Event): void {
    event.stopPropagation();
    this.dismissed.emit();
  }
}
