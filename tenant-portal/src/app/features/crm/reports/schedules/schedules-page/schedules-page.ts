import { Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendarTime,
  tablerChartBar,
  tablerHistory,
  tablerLayoutDashboard,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { DeliveriesModal } from '../deliveries-modal/deliveries-modal';
import { ScheduleModal } from '../schedule-modal/schedule-modal';
import {
  deleteSubscription,
  disableSubscription,
  enableSubscription,
  listScheduleTargets,
  listSubscriptions,
  resumeSubscription,
} from '../schedules.api';
import {
  EMPTY_SCHEDULE_TARGETS,
  scheduleTargetName,
  subscriptionTargetType,
  type ScheduleTargets,
  type Subscription,
  type SubscriptionSuspendedReason,
  type SubscriptionTargetType,
} from '../schedules.model';

const PAGE_SIZE = 20;

const KNOWN_SUSPENDED_REASONS = new Set<string>(['OWNER_INACTIVE', 'REPORT_DELETED', 'OWNER_ACCESS_LOST']);

@Component({
  selector: 'app-schedules-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    ConfirmDialog,
    DataTable,
    DataCell,
    DeliveriesModal,
    FullState,
    ScheduleModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-rep-schedules', alias: 'repSchedules' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerRefresh,
      tablerX,
      tablerLayoutDashboard,
      tablerChartBar,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerHistory,
      tablerTrash,
      tablerCalendarTime,
    }),
  ],
  templateUrl: './schedules-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class SchedulesPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly scheduleModal = viewChild.required(ScheduleModal);
  private readonly deliveriesModal = viewChild.required(DeliveriesModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly canManage = can('crm.subscriptions.manage');
  protected readonly subscriptions = signal<Subscription[]>([]);
  protected readonly search = signal('');
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal<'forbidden' | 'load-failure' | null>(null);
  protected readonly busyActionId = signal<string | null>(null);
  protected readonly pendingDelete = signal<Subscription | null>(null);
  /** Target names come from the same lists as the picker (GET dashboards + GET reports/catalogue). */
  private readonly targets = signal<ScheduleTargets>(EMPTY_SCHEDULE_TARGETS);
  private targetsSeq = 0;

  protected readonly filteredSubscriptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.subscriptions();
    if (!query) return list;
    const lang = this.language();
    const targets = this.targets();
    return list.filter((item) => {
      const target = scheduleTargetName(item, targets, lang).toLowerCase();
      return item.name.toLowerCase().includes(query) || target.includes(query);
    });
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'name', label: this.transloco.translate('repSchedules.columns.name'), width: 1.5 },
      { key: 'target', label: this.transloco.translate('repSchedules.columns.target'), width: 1.6 },
      { key: 'cadence', label: this.transloco.translate('repSchedules.columns.cadence'), width: 1.6 },
      { key: 'periodToken', label: this.transloco.translate('repSchedules.columns.period'), width: 1.2 },
      { key: 'recipients', label: this.transloco.translate('repSchedules.columns.recipients'), width: 0.7, align: 'end' },
      { key: 'attachmentFormats', label: this.transloco.translate('repSchedules.columns.formats'), width: 1.0 },
      { key: 'nextRunAt', label: this.transloco.translate('repSchedules.columns.nextRun'), width: 1.2 },
      { key: 'state', label: this.transloco.translate('repSchedules.columns.state'), width: 0.9 },
      { key: 'actions', label: this.transloco.translate('repSchedules.columns.actions'), width: 0.5, align: 'end' },
    ];
  });

  protected readonly rowKey = (row: Subscription): string => row.id;

  private loadSeq = 0;
  private pendingDeepLink: { dashboardId: string | null; reportKey: string | null } | null = null;
  private viewReady = false;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('new') !== '1') return;
      const prefill = {
        dashboardId: params.get('dashboardId'),
        reportKey: params.get('reportKey'),
      };
      if (!this.canManage) {
        void this.clearDeepLinkQuery();
        return;
      }
      if (this.viewReady) {
        this.openCreateFromQuery(prefill);
      } else {
        this.pendingDeepLink = prefill;
      }
    });

    afterNextRender(() => {
      this.viewReady = true;
      if (this.pendingDeepLink) {
        const prefill = this.pendingDeepLink;
        this.pendingDeepLink = null;
        this.openCreateFromQuery(prefill);
      }
    });

    void this.load();

    // Dashboard names are localized by the server: read the lists again when the language changes.
    effect(() => {
      this.language();
      untracked(() => void this.loadTargets());
    });
  }

  private async loadTargets(): Promise<void> {
    const seq = ++this.targetsSeq;
    try {
      const targets = await listScheduleTargets();
      if (seq === this.targetsSeq) this.targets.set(targets);
    } catch {
      // Names fall back to the target id; the list itself still loads.
    }
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const page = await listSubscriptions(null, PAGE_SIZE);
      if (seq !== this.loadSeq) return;
      this.subscriptions.set(page.items);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadError.set(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'load-failure');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listSubscriptions(cursor, PAGE_SIZE);
      if (seq !== this.loadSeq) return;
      const seen = new Set(this.subscriptions().map((item) => item.id));
      const appended = page.items.filter((item) => !seen.has(item.id));
      this.subscriptions.update((list) => [...list, ...appended]);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected openNew(): void {
    if (!this.canManage) return;
    this.scheduleModal().openCreate();
  }

  protected openSchedule(row: Subscription): void {
    this.scheduleModal().openEdit(row);
  }

  protected targetTypeOf(row: Subscription): SubscriptionTargetType {
    return subscriptionTargetType(row);
  }

  protected targetLabel(row: Subscription): string {
    return scheduleTargetName(row, this.targets(), this.language());
  }

  protected cadenceLabel(row: Subscription): string {
    this.i18n();
    const time = this.formatMinute(row.scheduleMinute);
    if (row.recurrence === 'DAILY') {
      return this.transloco.translate('repSchedules.cadence.daily', { time });
    }
    if (row.recurrence === 'WEEKLY') {
      const weekday = this.transloco.translate(`repSchedules.weekdays.${row.scheduleWeekday ?? 0}`);
      return this.transloco.translate('repSchedules.cadence.weekly', { weekday, time });
    }
    if (row.scheduleMonthDay === -1) {
      return this.transloco.translate('repSchedules.cadence.monthlyLastDay', { time });
    }
    return this.transloco.translate('repSchedules.cadence.monthly', {
      day: row.scheduleMonthDay ?? 1,
      time,
    });
  }

  protected nextRunLabel(row: Subscription): string {
    if (!row.enabled || row.suspendedReason || !row.nextRunAt) return DASH;
    return formatDateTime(row.nextRunAt, this.language());
  }

  protected stateKey(row: Subscription): 'ACTIVE' | 'PAUSED' | 'SUSPENDED' {
    if (row.suspendedReason) return 'SUSPENDED';
    return row.enabled ? 'ACTIVE' : 'PAUSED';
  }

  protected stateTone(row: Subscription): BadgeTone {
    if (row.suspendedReason) return 'warning';
    return row.enabled ? 'success' : 'none';
  }

  protected suspendedTooltip(reason: SubscriptionSuspendedReason | null): string | null {
    if (!reason) return null;
    this.i18n();
    if (!KNOWN_SUSPENDED_REASONS.has(reason)) {
      return this.transloco.translate('analytics.error.CRM_SUBSCRIPTION_SUSPENDED');
    }
    return this.transloco.translate(`repSchedules.suspendedReason.${reason}`);
  }

  protected rowActionsFor(row: Subscription): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [];
    if (this.canManage) {
      if (row.enabled && !row.suspendedReason) {
        items.push({
          id: 'pause',
          title: this.transloco.translate('repSchedules.actions.pause'),
          icon: 'tablerPlayerPause',
          tile: 'bg-icon-orange',
        });
      } else {
        items.push({
          id: 'resume',
          title: this.transloco.translate('repSchedules.actions.resume'),
          icon: 'tablerPlayerPlay',
          tile: 'bg-icon-green',
        });
      }
    }
    items.push({
      id: 'deliveries',
      title: this.transloco.translate('repSchedules.actions.deliveries'),
      icon: 'tablerHistory',
      tile: 'bg-icon-navy',
    });
    if (this.canManage) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('repSchedules.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }
    return items;
  }

  protected onRowAction(row: Subscription, selection: ActionSelection): void {
    switch (selection.id) {
      case 'pause':
        void this.toggleState(row, 'pause');
        break;
      case 'resume':
        void this.toggleState(row, 'resume');
        break;
      case 'deliveries':
        this.deliveriesModal().open(row);
        break;
      case 'delete':
        void this.requestDelete(row);
        break;
    }
  }

  protected onScheduleSaved(saved: Subscription): void {
    this.subscriptions.update((list) => {
      const idx = list.findIndex((item) => item.id === saved.id);
      if (idx === -1) return [saved, ...list];
      return list.map((item) => (item.id === saved.id ? saved : item));
    });
  }

  protected onScheduleReloaded(fresh: Subscription): void {
    this.subscriptions.update((list) => list.map((item) => (item.id === fresh.id ? fresh : item)));
  }

  protected onDeletedRemotely(): void {
    void this.refreshList();
  }

  protected async requestDelete(row: Subscription): Promise<void> {
    if (!this.canManage || this.busyActionId()) return;
    this.pendingDelete.set(row);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDelete.set(null);
      return;
    }

    this.busyActionId.set(row.id);
    try {
      await deleteSubscription(row.id, row.revision);
      this.notify.success(this.transloco.translate('repSchedules.toasts.deleted'));
      this.subscriptions.update((list) => list.filter((item) => item.id !== row.id));
      if (this.scheduleModal().editingId() === row.id) {
        this.scheduleModal().close();
      }
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(this.transloco.translate(errorKey(code)));
      if (code === 'CRM_SUBSCRIPTION_NOT_FOUND' || code === 'CRM_SUBSCRIPTION_REVISION_STALE') {
        if (code === 'CRM_SUBSCRIPTION_NOT_FOUND' && this.scheduleModal().editingId() === row.id) {
          this.scheduleModal().close();
        }
        await this.refreshList();
      }
    } finally {
      this.busyActionId.set(null);
      this.pendingDelete.set(null);
    }
  }

  private async toggleState(row: Subscription, action: 'pause' | 'resume'): Promise<void> {
    if (!this.canManage || this.busyActionId()) return;
    this.busyActionId.set(row.id);
    try {
      let updated: Subscription;
      if (action === 'pause') {
        updated = await disableSubscription(row.id, row.revision);
        this.notify.success(this.transloco.translate('repSchedules.toasts.paused'));
      } else if (row.suspendedReason) {
        updated = await resumeSubscription(row.id, row.revision);
        this.notify.success(this.transloco.translate('repSchedules.toasts.resumed'));
      } else {
        updated = await enableSubscription(row.id, row.revision);
        this.notify.success(this.transloco.translate('repSchedules.toasts.resumed'));
      }
      this.subscriptions.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(this.transloco.translate(errorKey(code)));
      if (code === 'CRM_SUBSCRIPTION_REVISION_STALE' || code === 'CRM_SUBSCRIPTION_NOT_FOUND') {
        await this.refreshList();
      }
    } finally {
      this.busyActionId.set(null);
    }
  }

  private openCreateFromQuery(prefill: { dashboardId: string | null; reportKey: string | null }): void {
    this.scheduleModal().openCreate(prefill);
    void this.clearDeepLinkQuery();
  }

  private clearDeepLinkQuery(): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  private formatMinute(scheduleMinute: number): string {
    const safe = Math.max(0, Math.min(1439, Math.trunc(scheduleMinute)));
    const hh = String(Math.floor(safe / 60)).padStart(2, '0');
    const mm = String(safe % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private async refreshList(): Promise<void> {
    const seq = ++this.loadSeq;
    const limit = Math.max(PAGE_SIZE, this.subscriptions().length);
    try {
      const page = await listSubscriptions(null, limit);
      if (seq !== this.loadSeq) return;
      this.subscriptions.set(page.items);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
      this.loadError.set(null);
    } catch (error) {
      if (seq === this.loadSeq) {
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      }
    }
  }
}
