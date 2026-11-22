import {
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
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
} from '@ng-icons/tabler-icons';
import { errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Modal } from '../../../../shared/ui/modal/modal';
import { NotificationInbox } from '../../../../shared/widgets/notifications/notification-inbox';
import {
  dayGroupOf,
  formatNotificationTime,
  isJustNow,
} from '../../../../shared/widgets/notifications/notification-time';
import { getNotification } from '../../../../shared/widgets/notifications/notifications.api';
import {
  NotificationView,
  entityTypeLabel,
  inAppActionPath,
  notificationLook,
} from '../../../../shared/widgets/notifications/notifications.model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-notification-detail',
  imports: [TranslocoPipe, Modal, Button],
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
    }),
  ],
  viewProviders: [provideTranslocoScope({ scope: 'ws-notifications', alias: 'wsNotif' })],
  templateUrl: './notification-detail.html',
})
export class NotificationDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly inbox = inject(NotificationInbox);
  private readonly language = inject(LanguageState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild(Modal);

  private readonly currentId = signal('');
  private readonly directItem = signal<NotificationView | null>(null);
  private readonly dismissingSnapshot = signal<NotificationView | null>(null);
  private readonly readySeq = signal(0);

  protected readonly actionPath = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly inInbox = computed(() => {
    const id = this.currentId();
    return id ? (this.inbox.items().find((entry) => entry.id === id) ?? null) : null;
  });

  protected readonly item = computed<NotificationView | null>(
    () => this.inInbox() ?? this.directItem() ?? this.dismissingSnapshot(),
  );

  protected readonly look = computed(() => notificationLook(this.item()?.notificationType ?? ''));

  protected readonly subtitle = computed(() => {
    this.i18n();
    const current = this.item();
    if (!current) return '';
    const typeLabel = this.transloco.translate(this.look().labelKey);
    const now = new Date();
    const time = formatNotificationTime(
      current.createdAt,
      dayGroupOf(current.createdAt, now),
      this.language.current(),
      now.getTime(),
      true,
    );
    return `${typeLabel} · ${time}`;
  });

  /** `null` while the acknowledgement is under a minute old, so the line reads "just now". */
  protected readonly acknowledgedTimeLabel = computed(() => {
    const iso = this.item()?.acknowledgedAt;
    if (!iso) return '';
    const now = new Date();
    if (isJustNow(iso, now.getTime())) return null;
    return formatNotificationTime(iso, dayGroupOf(iso, now), this.language.current(), now.getTime(), true);
  });

  protected readonly entityLabelKey = computed(() => {
    const type = this.item()?.entityType;
    return type ? `wsNotif.entityTypes.${entityTypeLabel(type)}` : '';
  });

  private loadSeq = 0;
  private openedForSeq = 0;
  private pendingNavigation: string | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      void this.loadForId(id);
    });

    effect(() => {
      const seq = this.readySeq();
      const modal = this.modal();
      if (seq > 0 && seq !== this.openedForSeq && modal) {
        this.openedForSeq = seq;
        modal.open();
      }
    });

    let prevLang = this.language.current();
    effect(() => {
      const lang = this.language.current();
      if (lang === prevLang) return;
      prevLang = lang;
      const id = untracked(() => this.currentId());
      const hasDirect = untracked(() => this.directItem() !== null);
      if (id && UUID.test(id) && hasDirect) {
        untracked(() => void this.refreshDirectItem(id, this.loadSeq));
      }
    });
  }

  private async loadForId(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.pendingNavigation = null;
    this.directItem.set(null);
    this.dismissingSnapshot.set(null);
    this.actionPath.set(null);
    this.currentId.set(id);

    if (!UUID.test(id)) {
      await Promise.resolve();
      await firstValueFrom(this.transloco.selectTranslation('ws-notifications')).catch(() => undefined);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.notify.error(this.transloco.translate('wsNotif.detail.gone'));
      void this.navigateBack(true);
      return;
    }

    const fromInbox = this.inbox.items().find((entry) => entry.id === id) ?? null;
    let found = fromInbox;
    if (!found) {
      try {
        found = await getNotification(id);
      } catch (error) {
        await firstValueFrom(this.transloco.selectTranslation('ws-notifications')).catch(() => undefined);
        if (this.destroyed || seq !== this.loadSeq) return;
        const code = errorCodeOf(error);
        if (code === 'NOTIFICATION_NOT_FOUND' || code === 'CORE_VALIDATION_FAILED') {
          this.notify.error(this.transloco.translate('wsNotif.detail.gone'));
        } else {
          this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
        }
        void this.navigateBack(true);
        return;
      }
      if (this.destroyed || seq !== this.loadSeq) return;
      this.directItem.set(found);
    }

    const resolvedPath = await inAppActionPath(found.actionUrl, this.router.config, this.injector);
    if (this.destroyed || seq !== this.loadSeq) return;

    this.actionPath.set(resolvedPath);
    this.readySeq.update((value) => value + 1);

    if (found.readAt === null) {
      void this.markReadOnOpen(found, seq);
    }
  }

  private async refreshDirectItem(id: string, seq: number): Promise<void> {
    try {
      const fresh = await getNotification(id);
      if (!this.destroyed && seq === this.loadSeq && this.directItem() !== null) {
        this.directItem.set(fresh);
      }
    } catch {
      // Keep the existing snapshot if a language reload fails transiently.
    }
  }

  private async markReadOnOpen(found: NotificationView, seq: number): Promise<void> {
    const hadDirect = this.directItem() !== null;
    const now = new Date().toISOString();
    if (hadDirect) {
      this.directItem.set({ ...found, readAt: now });
    }
    try {
      await this.inbox.markRead(found.id, found);
    } catch {
      if (!this.destroyed && seq === this.loadSeq && hadDirect) {
        this.directItem.set(found);
      }
    }
  }

  protected openLink(path: string): void {
    this.pendingNavigation = path;
    this.modal()?.close();
  }

  protected async acknowledge(): Promise<void> {
    const current = this.item();
    if (!current || current.acknowledgedAt !== null || this.busy()) return;
    this.busy.set(true);
    const wasInInbox = this.inInbox() !== null;
    const prevDirect = this.directItem();
    const now = new Date().toISOString();
    if (!wasInInbox && prevDirect) {
      this.directItem.set({ ...prevDirect, acknowledgedAt: now, readAt: prevDirect.readAt ?? now });
    }
    try {
      await this.inbox.acknowledge(current.id, current);
      if (wasInInbox && !this.inInbox()) {
        this.notify.error(this.transloco.translate('wsNotif.detail.gone'));
        this.modal()?.close();
      }
    } catch (error) {
      if (!wasInInbox) this.directItem.set(prevDirect);
      this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  protected async dismiss(): Promise<void> {
    const current = this.item();
    if (!current || this.busy()) return;
    this.busy.set(true);
    this.dismissingSnapshot.set(current);
    try {
      await this.inbox.dismiss(current.id, current);
      this.modal()?.close();
    } catch (error) {
      this.dismissingSnapshot.set(null);
      this.notify.error(errorMessage(error, 'wsNotif', this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  protected onClosed(): void {
    this.openedForSeq = 0;
    this.readySeq.set(0);
    const target = this.pendingNavigation;
    this.pendingNavigation = null;
    if (target) {
      void this.router.navigateByUrl(target);
      return;
    }
    void this.navigateBack(false);
  }

  private navigateBack(replaceUrl: boolean): Promise<boolean> {
    return this.router.navigate(['..'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      replaceUrl,
    });
  }
}
