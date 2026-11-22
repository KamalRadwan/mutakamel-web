import { Component, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBell, tablerRefresh } from '@ng-icons/tabler-icons';
import { errorMessage } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import { NotificationInbox } from '../../../../shared/widgets/notifications/notification-inbox';
import { NotificationItem } from '../../../../shared/widgets/notifications/notification-item/notification-item';
import { dayGroupOf, formatNotificationTime } from '../../../../shared/widgets/notifications/notification-time';
import {
  NotificationDayGroup,
  NotificationView,
  inAppActionPath,
} from '../../../../shared/widgets/notifications/notifications.model';

type NotificationTab = 'all' | 'unread';

interface NotificationGroup {
  key: NotificationDayGroup;
  items: NotificationView[];
}

const DAY_ORDER: readonly NotificationDayGroup[] = ['today', 'yesterday', 'earlier'];
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-notifications-page',
  imports: [RouterOutlet, TranslocoPipe, NgIcon, Button, FullState, Tabs, NotificationItem],
  providers: [NotificationInbox, provideIcons({ tablerBell, tablerRefresh })],
  templateUrl: './notifications-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class NotificationsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly inbox = inject(NotificationInbox);
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  protected readonly tab = signal<NotificationTab>('all');

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    return [
      { id: 'all', label: this.transloco.translate('notifications.tabs.all'), count: null },
      { id: 'unread', label: this.transloco.translate('notifications.tabs.unread'), count: this.inbox.unreadCount() },
    ];
  });

  protected readonly groups = computed<NotificationGroup[]>(() => {
    const now = new Date();
    const buckets: Record<NotificationDayGroup, NotificationView[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const item of this.inbox.items()) {
      buckets[dayGroupOf(item.createdAt, now)].push(item);
    }
    return DAY_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }));
  });

  constructor() {
    const initialTab: NotificationTab = this.route.snapshot.queryParamMap.get('tab') === 'unread' ? 'unread' : 'all';
    this.tab.set(initialTab);
    this.inbox.unreadOnly.set(initialTab === 'unread');

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next: NotificationTab = params.get('tab') === 'unread' ? 'unread' : 'all';
      if (next === this.tab()) return;
      this.tab.set(next);
      this.inbox.unreadOnly.set(next === 'unread');
      void this.inbox.reload();
    });
  }

  protected selectTab(next: string): void {
    if ((next !== 'all' && next !== 'unread') || next === this.tab()) return;
    this.tab.set(next);
    this.inbox.unreadOnly.set(next === 'unread');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'unread' ? 'unread' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.inbox.reload();
  }

  protected formatTime(iso: string, dayGroup: NotificationDayGroup): string {
    return formatNotificationTime(iso, dayGroup, this.language.current(), Date.now(), true);
  }

  protected async openItem(item: NotificationView): Promise<void> {
    void this.inbox.markRead(item.id).catch(() => undefined);
    const path = await inAppActionPath(item.actionUrl, this.router.config, this.injector);
    if (path) {
      void this.router.navigateByUrl(path);
    } else {
      void this.router.navigate([item.id], { relativeTo: this.route, queryParamsHandling: 'preserve' });
    }
  }

  protected async acknowledgeItem(item: NotificationView): Promise<void> {
    try {
      await this.inbox.acknowledge(item.id);
    } catch (error) {
      this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
    }
  }

  protected async dismissItem(item: NotificationView): Promise<void> {
    try {
      await this.inbox.dismiss(item.id);
    } catch (error) {
      this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
    }
  }

  protected async markAllRead(): Promise<void> {
    try {
      await this.inbox.markAllRead();
    } catch (error) {
      this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
    }
  }

  protected async loadMore(): Promise<void> {
    try {
      await this.inbox.loadMore();
    } catch {
      this.notify.error(this.transloco.translate('notifications.loadError'));
    }
  }
}
