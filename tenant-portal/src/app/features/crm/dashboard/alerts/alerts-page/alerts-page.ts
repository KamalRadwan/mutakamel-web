import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBellRinging,
  tablerHistory,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTrash,
  tablerUser,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime, formatNumber } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataTable, type DataColumn, type DataSort } from '../../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import type { CatalogMetric } from '../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { getCatalog } from '../../../../../shared/widgets/dashboard/analytics.api';
import { errorKey, reasonKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { AlertModal } from '../alert-modal/alert-modal';
import {
  deleteAlert,
  disableAlert,
  enableAlert,
  listAlerts,
  resumeAlert,
  testAlert,
} from '../alerts.api';
import {
  PHRASE_SENTINEL,
  conditionKeyFor,
  formatAlertAmount,
  minutesToTime24,
  splitPhrase,
  type AlertRule,
  type AlertState,
  type IsolatedPhrase,
} from '../alerts.model';
import { EvaluationsModal } from '../evaluations-modal/evaluations-modal';

type StateFilter = 'ALL' | AlertState;

const STATE_TONES: Record<AlertState, BadgeTone> = {
  ENABLED: 'success',
  DISABLED: 'none',
  SUSPENDED: 'warning',
};

@Component({
  selector: 'app-alerts-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    AlertModal,
    Badge,
    Button,
    ConfirmDialog,
    DataCell,
    DataTable,
    EvaluationsModal,
    Field,
    FullState,
    Segmented,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-alerts', alias: 'alerts' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerBellRinging,
      tablerHistory,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerTrash,
      tablerUser,
      tablerX,
    }),
  ],
  templateUrl: './alerts-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class AlertsPage {
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly alertModal = viewChild.required(AlertModal);
  private readonly evaluationsModal = viewChild.required(EvaluationsModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly allowed = signal(can('crm.alerts.manage'));
  protected readonly catalogMetrics = signal<readonly CatalogMetric[]>([]);
  protected readonly alerts = signal<AlertRule[]>([]);
  protected readonly search = signal('');
  protected readonly stateFilter = signal<StateFilter>('ALL');
  protected readonly mineOnly = signal(false);
  protected readonly sort = signal<DataSort | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadError = signal(false);
  protected readonly busyRuleId = signal<string | null>(null);
  protected readonly pendingDeleteRule = signal<AlertRule | null>(null);

  private loadSeq = 0;

  protected readonly stateOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'ALL', label: this.transloco.translate('alerts.filters.all') },
      { value: 'ENABLED', label: this.transloco.translate('alerts.filters.active') },
      { value: 'DISABLED', label: this.transloco.translate('alerts.filters.paused') },
      { value: 'SUSPENDED', label: this.transloco.translate('alerts.filters.suspended') },
    ];
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'name', label: this.transloco.translate('alerts.table.name'), width: 1.4, sortable: true },
      { key: 'metric', label: this.transloco.translate('alerts.table.metric'), width: 1.4 },
      { key: 'condition', label: this.transloco.translate('alerts.table.condition'), width: 1.3 },
      { key: 'schedule', label: this.transloco.translate('alerts.table.schedule'), width: 1.2 },
      { key: 'state', label: this.transloco.translate('alerts.table.state'), width: 0.9 },
      {
        key: 'lastEvaluatedAt',
        label: this.transloco.translate('alerts.table.lastChecked'),
        width: 1.1,
        sortable: true,
      },
      {
        key: 'nextEvaluationAt',
        label: this.transloco.translate('alerts.table.nextCheck'),
        width: 1.1,
        sortable: true,
      },
      { key: 'actions', label: this.transloco.translate('alerts.table.actions'), width: 0.45, align: 'end' },
    ];
  });

  protected readonly visibleAlerts = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.alerts().filter((rule) => {
      if (!query) return true;
      const nameMatch = (rule.name ?? '').toLowerCase().includes(query);
      const metricMatch = this.metricLabel(rule).toLowerCase().includes(query);
      const keyMatch = (rule.metricKey ?? '').toLowerCase().includes(query);
      return nameMatch || metricMatch || keyMatch;
    });

    const activeSort = this.sort();
    if (!activeSort) return list;

    const dir = activeSort.dir === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      if (activeSort.key === 'name') {
        return (a.name ?? '').localeCompare(b.name ?? '') * dir;
      }
      if (activeSort.key === 'lastEvaluatedAt') {
        return (a.lastEvaluatedAt ?? '').localeCompare(b.lastEvaluatedAt ?? '') * dir;
      }
      if (activeSort.key === 'nextEvaluationAt') {
        return (a.nextEvaluationAt ?? '').localeCompare(b.nextEvaluationAt ?? '') * dir;
      }
      return 0;
    });
  });

  protected readonly showEmptyState = computed(
    () =>
      !this.loading() &&
      !this.loadError() &&
      this.alerts().length === 0 &&
      !this.search().trim() &&
      this.stateFilter() === 'ALL' &&
      !this.mineOnly(),
  );

  protected readonly rowKey = (row: AlertRule): string => row.id;

  constructor() {
    if (this.allowed()) {
      void this.loadInitial();
    }
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/');
  }

  protected reload(): void {
    if (!this.allowed()) return;
    void this.loadPage(true);
  }

  protected loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    void this.loadPage(false);
  }

  protected setStateFilter(value: string | null): void {
    if (value !== 'ALL' && value !== 'ENABLED' && value !== 'DISABLED' && value !== 'SUSPENDED') return;
    this.stateFilter.set(value);
    void this.loadPage(true);
  }

  protected toggleMineOnly(): void {
    this.mineOnly.update((v) => !v);
    void this.loadPage(true);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected openCreate(): void {
    this.alertModal().openCreate();
  }

  protected openEdit(rule: AlertRule): void {
    this.alertModal().openEdit(rule);
  }

  protected metricLabel(rule: AlertRule): string {
    const lang = this.language();
    const metric = this.catalogMetrics().find((m) => m.key === rule.metricKey);
    if (metric) {
      return lang === 'ar' ? metric.labelAr : metric.labelEn;
    }
    return rule.metricKey ?? DASH;
  }

  protected conditionPhrase(rule: AlertRule): IsolatedPhrase {
    this.i18n();
    const lang = this.language();
    const formattedValue = formatAlertAmount(
      rule.threshold,
      rule.valueUnit,
      rule.currencyCode,
      lang,
      rule.conditionKind,
    );
    const key = conditionKeyFor(rule.conditionKind, rule.comparator);
    const template = this.transloco.translate(`alerts.condition.${key}`, { value: PHRASE_SENTINEL });
    return splitPhrase(template, PHRASE_SENTINEL, formattedValue);
  }

  protected schedulePhrase(rule: AlertRule): IsolatedPhrase {
    this.i18n();
    this.language();
    if (rule.scheduleKind === 'HOURLY') {
      const minute = String(rule.scheduleMinute ?? 0).padStart(2, '0');
      const template = this.transloco.translate('alerts.schedule.hourly', { minute: PHRASE_SENTINEL });
      return splitPhrase(template, PHRASE_SENTINEL, minute);
    }
    const time = minutesToTime24(rule.scheduleMinute ?? 540);
    if (rule.scheduleKind === 'WEEKLY') {
      const day = this.transloco.translate(`chart.days.${rule.scheduleWeekday ?? 0}`);
      const template = this.transloco.translate('alerts.schedule.weekly', {
        day,
        time: PHRASE_SENTINEL,
      });
      return splitPhrase(template, PHRASE_SENTINEL, time);
    }
    const template = this.transloco.translate('alerts.schedule.daily', { time: PHRASE_SENTINEL });
    return splitPhrase(template, PHRASE_SENTINEL, time);
  }

  protected stateTone(state: AlertState): BadgeTone {
    return STATE_TONES[state];
  }

  protected suspendedTooltip(rule: AlertRule): string | null {
    if (rule.state !== 'SUSPENDED' || !rule.suspendedReason) return null;
    this.i18n();
    this.language();
    return this.transloco.translate(`alerts.suspendedReason.${rule.suspendedReason}`);
  }

  protected formatTimestamp(iso: string | null | undefined): string {
    if (!iso) return DASH;
    this.i18n();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    return formatDateTime(iso, this.language(), chartT);
  }

  protected rowActions(rule: AlertRule): ActionItem[] {
    this.i18n();
    this.language();
    const items: ActionItem[] = [];
    const busy = this.busyRuleId() === rule.id;

    if (rule.state === 'ENABLED') {
      items.push({
        id: 'pause',
        title: this.transloco.translate('alerts.actions.pause'),
        icon: 'tablerPlayerPause',
        tile: 'bg-icon-orange',
        disabled: busy,
      });
    } else if (rule.state === 'DISABLED') {
      items.push({
        id: 'activate',
        title: this.transloco.translate('alerts.actions.activate'),
        icon: 'tablerPlayerPlay',
        tile: 'bg-icon-green',
        disabled: busy,
      });
    } else {
      items.push({
        id: 'resume',
        title: this.transloco.translate('alerts.actions.resume'),
        icon: 'tablerPlayerPlay',
        tile: 'bg-icon-green',
        disabled: busy,
      });
    }

    items.push(
      {
        id: 'test',
        title: this.transloco.translate('alerts.actions.testNow'),
        icon: 'tablerPlayerPlay',
        tile: 'bg-icon-teal',
        disabled: busy,
      },
      {
        id: 'evaluations',
        title: this.transloco.translate('alerts.actions.evaluations'),
        icon: 'tablerHistory',
        tile: 'bg-icon-navy',
      },
      {
        id: 'delete',
        title: this.transloco.translate('alerts.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: busy,
      },
    );

    return items;
  }

  protected onRowAction(rule: AlertRule, selection: ActionSelection): void {
    switch (selection.id) {
      case 'pause':
        void this.runStateChange(rule, 'pause');
        break;
      case 'activate':
        void this.runStateChange(rule, 'activate');
        break;
      case 'resume':
        void this.runStateChange(rule, 'resume');
        break;
      case 'test':
        void this.runTest(rule);
        break;
      case 'evaluations':
        this.evaluationsModal().open(rule);
        break;
      case 'delete':
        void this.requestDelete(rule);
        break;
    }
  }

  protected onAlertSaved(_rule: AlertRule): void {
    void this.loadPage(true);
  }

  protected onAlertReloaded(rule: AlertRule): void {
    this.alerts.update((list) => list.map((item) => (item.id === rule.id ? rule : item)));
  }

  protected async requestDelete(rule: AlertRule): Promise<void> {
    if (this.busyRuleId()) return;
    this.pendingDeleteRule.set(rule);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDeleteRule.set(null);
      return;
    }

    this.busyRuleId.set(rule.id);
    try {
      await deleteAlert(rule.id, rule.revision);
      this.notify.success(this.transloco.translate('alerts.toasts.deleted'));
      if (this.alertModal().editingId() === rule.id) {
        this.alertModal().close();
      }
      await this.loadPage(true);
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(this.transloco.translate(errorKey(code)));
      if (code === 'CRM_ALERT_NOT_FOUND' || code === 'CRM_ALERT_REVISION_STALE') {
        await this.loadPage(true);
      }
    } finally {
      this.busyRuleId.set(null);
      this.pendingDeleteRule.set(null);
    }
  }

  private async loadInitial(): Promise<void> {
    const [, catalog] = await Promise.allSettled([this.loadPage(true), getCatalog()]);
    if (catalog.status === 'fulfilled' && catalog.value.metrics.length > 0) {
      this.catalogMetrics.set(catalog.value.metrics);
    }
  }

  private async loadPage(reset: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (reset) {
      this.loading.set(true);
      this.loadError.set(false);
    } else {
      this.loadingMore.set(true);
    }

    const filterState = this.stateFilter();
    try {
      const page = await listAlerts({
        mine: this.mineOnly() || undefined,
        state: filterState === 'ALL' ? undefined : filterState,
        cursor: reset ? null : this.nextCursor(),
        limit: 20,
      });
      if (seq !== this.loadSeq) return;
      this.alerts.update((curr) => (reset ? page.items : [...curr, ...page.items]));
      this.hasMore.set(page.pageInfo.hasMore);
      this.nextCursor.set(page.pageInfo.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'CRM_PERMISSION_DENIED' || code === 'CRM_SCOPED_PERMISSION_DENIED') {
        this.allowed.set(false);
      } else if (reset) {
        this.loadError.set(true);
      } else {
        this.notify.error(this.transloco.translate(errorKey(code)));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async runStateChange(rule: AlertRule, action: 'pause' | 'activate' | 'resume'): Promise<void> {
    if (this.busyRuleId()) return;
    this.busyRuleId.set(rule.id);
    try {
      const updated =
        action === 'pause'
          ? await disableAlert(rule.id, rule.revision)
          : action === 'activate'
            ? await enableAlert(rule.id, rule.revision)
            : await resumeAlert(rule.id, rule.revision);

      const toastKey =
        action === 'pause'
          ? 'alerts.toasts.paused'
          : action === 'activate'
            ? 'alerts.toasts.activated'
            : 'alerts.toasts.resumed';
      this.notify.success(this.transloco.translate(toastKey));
      this.alerts.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(this.transloco.translate(errorKey(code)));
      if (code === 'CRM_ALERT_REVISION_STALE' || code === 'CRM_ALERT_NOT_FOUND') {
        await this.loadPage(true);
      }
    } finally {
      this.busyRuleId.set(null);
    }
  }

  private async runTest(rule: AlertRule): Promise<void> {
    if (this.busyRuleId()) return;
    this.busyRuleId.set(rule.id);
    try {
      const res = await testAlert(rule.id);
      const title = this.transloco.translate('alerts.toasts.testTitle');
      const lang = this.language();
      if (res.value === null) {
        const reason = this.transloco.translate(reasonKey(res.reasonCode ?? null));
        this.notify.warning(title, this.transloco.translate('alerts.toasts.testUnavailable', { reason }));
        return;
      }
      const valueText = formatAlertAmount(
        res.value,
        rule.valueUnit,
        rule.currencyCode,
        lang,
        rule.conditionKind,
      );
      const cohortText = res.cohortSize !== null ? formatNumber(res.cohortSize, lang) : null;

      if (res.met && res.wouldNotify) {
        const text = cohortText
          ? this.transloco.translate('alerts.toasts.testMetNotifyCohort', { value: valueText, cohort: cohortText })
          : this.transloco.translate('alerts.toasts.testMetNotify', { value: valueText });
        this.notify.success(title, text);
      } else if (res.met) {
        const text = cohortText
          ? this.transloco.translate('alerts.toasts.testMetSuppressedCohort', { value: valueText, cohort: cohortText })
          : this.transloco.translate('alerts.toasts.testMetSuppressed', { value: valueText });
        this.notify.info(title, text);
      } else {
        const text = cohortText
          ? this.transloco.translate('alerts.toasts.testNotMetCohort', { value: valueText, cohort: cohortText })
          : this.transloco.translate('alerts.toasts.testNotMet', { value: valueText });
        this.notify.info(title, text);
      }
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.busyRuleId.set(null);
    }
  }
}
