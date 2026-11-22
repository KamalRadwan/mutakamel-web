import { Component, ElementRef, Injector, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBell } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../core/i18n/language';
import { Button } from '../../shared/ui/button/button';
import { NotificationItem } from '../../shared/widgets/notifications/notification-item/notification-item';
import { dayGroupOf, formatNotificationTime } from '../../shared/widgets/notifications/notification-time';
import { NotificationsState } from '../../shared/widgets/notifications/notifications-state';
import { NotificationDayGroup, NotificationView, inAppActionPath } from '../../shared/widgets/notifications/notifications.model';

type NotificationTab = 'all' | 'unread';

interface NotificationGroup {
  key: NotificationDayGroup;
  items: NotificationView[];
}

const DAY_ORDER: readonly NotificationDayGroup[] = ['today', 'yesterday', 'earlier'];

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button, NotificationItem],
  providers: [provideIcons({ tablerBell })],
  templateUrl: './notification-bell.html',
  host: {
    class: 'relative inline-flex shrink-0',
    '(document:click)': 'closeIfOutside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class NotificationBell {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageState);
  protected readonly state = inject(NotificationsState);

  protected readonly open = signal(false);
  protected readonly tab = signal<NotificationTab>('all');

  protected readonly badgeText = computed(() => {
    const count = this.state.unreadCount();
    return count > 99 ? '99+' : String(count);
  });

  protected readonly visibleItems = computed(() => {
    const items = this.state.items();
    return this.tab() === 'unread' ? items.filter((item) => item.readAt === null) : items;
  });

  protected readonly groups = computed<NotificationGroup[]>(() => {
    const now = new Date();
    const buckets: Record<NotificationDayGroup, NotificationView[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const item of this.visibleItems()) {
      buckets[dayGroupOf(item.createdAt, now)].push(item);
    }
    return DAY_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }));
  });

  protected toggle() {
    this.open.update((value) => !value);
  }

  protected formatTime(iso: string, dayGroup: NotificationDayGroup): string {
    return formatNotificationTime(iso, dayGroup, this.language.current(), Date.now(), false);
  }

  /** Opening an item marks it read; an `actionUrl` is followed only when it matches a registered route. */
  protected async openItem(item: NotificationView) {
    void this.state.markRead(item.id);
    const path = await inAppActionPath(item.actionUrl, this.router.config, this.injector);
    this.open.set(false);
    if (path) {
      void this.router.navigateByUrl(path);
    } else {
      void this.router.navigate(['/workspace/notifications', item.id]);
    }
  }

  protected dismissItem(item: NotificationView) {
    void this.state.dismiss(item.id);
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
