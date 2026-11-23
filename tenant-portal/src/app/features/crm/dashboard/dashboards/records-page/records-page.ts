import { Component, DestroyRef, Injector, computed, effect, inject, runInInjectionContext, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { hasTenantWidePermission } from '../../../../../core/auth/tenant-wide-permission';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { listActiveCoreCurrencyCodes } from '../../../../../shared/lookups/core-currencies';
import { Breadcrumbs, type Crumb } from '../../../../../shared/ui/breadcrumbs/breadcrumbs';
import {
  DASH,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../../../../shared/ui/chart/chart-format';
import {
  DataCell,
  type DataColumn,
  DataTable,
} from '../../../../../shared/ui/data-table/data-table';
import { FullState, type FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import {
  ApiError,
  errorCodeOf,
  isAbortError,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import type { RuntimeFilters } from '../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { drilldown, getDashboard } from '../dashboards.api';
import type { DashboardDetail, DrillRecord } from '../dashboards.model';
import { decodeRuntimeFilters } from '../records-link';
import { dashboardReadError } from '../dashboard-page/dashboard-read-error';

const PAGE_LIMIT = 25;
const FALLBACK_COLUMNS: readonly (keyof DrillRecord)[] = [
  'title',
  'status',
  'ownerName',
  'amount',
  'createdAt',
];
const COLUMN_ORDER: readonly { key: keyof DrillRecord; width: number; numeric?: boolean }[] = [
  { key: 'title', width: 2 },
  { key: 'status', width: 1 },
  { key: 'stageName', width: 1.2 },
  { key: 'ownerName', width: 1.3 },
  { key: 'branchName', width: 1.2 },
  { key: 'pipelineName', width: 1.2 },
  { key: 'sourceName', width: 1.2 },
  { key: 'activityType', width: 1.1 },
  { key: 'reason', width: 1.4 },
  { key: 'amount', width: 1.3, numeric: true },
  { key: 'value', width: 1, numeric: true },
  { key: 'createdAt', width: 1.1 },
  { key: 'convertedAt', width: 1.1 },
  { key: 'closedAt', width: 1.1 },
  { key: 'dueAt', width: 1.1 },
];

interface ErrorStateModel {
  kind: FullStateKind;
  titleKey: string;
  textKey: string;
  retryable: boolean;
  message?: string;
}

function parsePageParam(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

@Component({
  selector: 'app-records-page',
  imports: [TranslocoPipe, Badge, Breadcrumbs, Button, Field, Dropdown, DataCell, DataTable, FullState, Pagination],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-filters', alias: 'dashFilters' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  templateUrl: './records-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class RecordsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);

  protected readonly dashboardId = computed(() => this.paramMap()?.get('id') ?? '');
  protected readonly widgetId = computed(() => this.queryParamMap()?.get('widget') ?? '');
  protected readonly pointKey = computed(() => this.queryParamMap()?.get('point') ?? '');
  protected readonly seriesKey = computed(() => this.queryParamMap()?.get('series') ?? '');
  protected readonly rawFilters = computed(() => this.queryParamMap()?.get('f') ?? '');
  protected readonly titleParam = computed(() => this.queryParamMap()?.get('title') ?? '');
  protected readonly requestedPage = computed(() =>
    parsePageParam(this.queryParamMap()?.get('page') ?? null),
  );
  protected readonly filters = computed<RuntimeFilters>(() => {
    const filters = decodeRuntimeFilters(this.rawFilters());
    const currencyCode = this.queryParamMap()?.get('currency');
    return currencyCode && /^[A-Z]{3}$/.test(currencyCode) ? { ...filters, currencyCode } : filters;
  });

  protected readonly dashboardName = signal<string | null>(null);
  private readonly dashboardDetail = signal<DashboardDetail | null>(null);
  protected readonly needsCurrency = signal(false);
  private readonly currencyCodes = signal<string[]>([]);
  private readonly currencyLookupFailed = signal(false);
  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    const detail = this.dashboardDetail();
    const ownCurrency = detail?.placements.find((p) => p.widgetId === this.widgetId())?.widget.querySpec.filters?.currencyCode
      ?? detail?.defaultFilters.currencyCode;
    const codes = [...new Set([...this.currencyCodes(), ...(ownCurrency ? [ownCurrency] : [])])];
    return codes.map((value) => ({ value, label: value }));
  });
  protected readonly currencyHint = computed(() => {
    this.i18n();
    return this.transloco.translate(this.currencyLookupFailed() || this.currencyOptions().length === 0
      ? 'dashFilters.currencyUnavailable' : 'dashFilters.currencyHint');
  });
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  protected readonly records = signal<DrillRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorState = signal<ErrorStateModel | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = PAGE_LIMIT;
  protected readonly pageSizes = [PAGE_LIMIT];
  private readonly exactTotal = signal<number | null>(null);
  private readonly highestKnownTotal = signal(0);
  private readonly reloadToken = signal(0);

  private cursorStack = new Map<number, string | null>([[1, null]]);
  private lastQuerySignature = '';
  private lastDashboardId = '';
  private loadSeq = 0;
  /** Aborted when a newer page load starts or the page is destroyed: queued and retrying calls stop at once. */
  private loadAbort = new AbortController();

  protected readonly widgetTitle = computed(() => {
    this.i18n();
    const raw = this.titleParam().trim();
    return raw || this.transloco.translate('dashFilters.defaultWidgetTitle');
  });

  protected readonly breadcrumbs = computed<Crumb[]>(() => {
    this.i18n();
    this.language();
    const id = this.dashboardId();
    const dashTitle =
      this.dashboardName() || this.transloco.translate('dashFilters.dashboardFallback');
    return [
      {
        label: this.transloco.translate('dashFilters.dashboards'),
        link: '/crm/dashboard/dashboards',
      },
      {
        label: dashTitle ?? '',
        link: id ? ['/crm/dashboard/dashboards', id] : undefined,
      },
      {
        label: this.transloco.translate('dashFilters.recordsBehind', {
          title: this.widgetTitle(),
        }),
      },
    ];
  });

  protected readonly filterChips = computed<string[]>(() => {
    this.i18n();
    const lang = this.language();
    const f = this.filters();
    const chips: string[] = [];

    if (f.dateFrom && f.dateTo) {
      chips.push(`${formatDate(f.dateFrom, lang)} – ${formatDate(f.dateTo, lang)}`);
    } else if (f.datePreset && f.datePreset !== 'CUSTOM') {
      chips.push(this.transloco.translate(`analytics.datePreset.${f.datePreset}`));
    }

    const scopeKey =
      f.ownerUserIds && f.ownerUserIds.length > 0
        ? 'own'
        : f.teamIds && f.teamIds.length > 0
          ? 'team'
          : 'all';
    const scopeText = this.transloco.translate(`analytics.scope.${scopeKey}`);

    const branchIds =
      f.branchIds && f.branchIds.length > 0
        ? f.branchIds
        : f.branchId
          ? [f.branchId]
          : [];
    if (branchIds.length > 0) {
      const sep = lang === 'ar' ? '، ' : ', ';
      const branchNames = branchIds.join(sep);
      chips.push(`${scopeText} · ${branchNames}`);
    } else {
      chips.push(scopeText);
    }

    const point = this.pointKey().trim();
    if (point) {
      chips.push(this.transloco.translate('dashFilters.pointChip', { point }));
    }

    const series = this.seriesKey().trim();
    if (series) {
      chips.push(this.transloco.translate('dashFilters.seriesChip', { series }));
    }
    if (f.currencyCode) chips.push(f.currencyCode);

    return chips;
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    const rows = this.records();

    const activeSpecs =
      rows.length > 0
        ? COLUMN_ORDER.filter((spec) =>
            rows.some((row) => {
              const val = row[spec.key];
              return val !== undefined && val !== null && val !== '';
            }),
          )
        : COLUMN_ORDER.filter((spec) => FALLBACK_COLUMNS.includes(spec.key));

    const resolvedSpecs =
      activeSpecs.length > 0
        ? activeSpecs
        : COLUMN_ORDER.filter((spec) => FALLBACK_COLUMNS.includes(spec.key));

    return resolvedSpecs.map((spec) => ({
      key: String(spec.key),
      label: this.transloco.translate(`dashFilters.columns.${String(spec.key)}`),
      width: spec.width,
      ...(spec.numeric ? { align: 'end' as const, numeric: true } : {}),
    }));
  });

  protected readonly paginationTotal = computed(() => {
    const exact = this.exactTotal();
    if (exact !== null) return exact;
    return Math.max(this.highestKnownTotal(), this.currentPage() * PAGE_LIMIT + 1);
  });

  protected readonly showPagination = computed(
    () =>
      !this.errorState() &&
      !this.loading() &&
      (this.records().length > 0 || this.currentPage() > 1),
  );

  protected readonly rowKeyFn = (row: DrillRecord) => row.id;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSeq++;
      this.loadAbort.abort();
    });

    effect(() => {
      const id = this.dashboardId();
      const widget = this.widgetId();
      const point = this.pointKey();
      const series = this.seriesKey();
      const filters = this.filters();
      const targetPage = this.requestedPage();
      this.reloadToken();
      const signature = JSON.stringify([id, widget, point, series, filters]);
      untracked(() => {
        if (signature !== this.lastQuerySignature) {
          this.lastQuerySignature = signature;
          this.resetCursors();
        }
        void this.loadPage(id, widget, point, series, filters, targetPage);
      });
    });
  }

  protected onPageChange(nextPage: number): void {
    if (nextPage === this.currentPage() || nextPage < 1) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: nextPage <= 1 ? null : String(nextPage) },
      queryParamsHandling: 'merge',
    });
  }

  protected onRowClick(record: DrillRecord): void {
    if (record.entityType?.toUpperCase() === 'LEAD' && record.id) {
      void this.router.navigate(['/crm/leads', record.id]);
      return;
    }
    if (record.entityType?.toUpperCase() === 'OPPORTUNITY' && record.id) {
      void this.router.navigate(['/crm/opportunities', record.id]);
      return;
    }
    if (['CUSTOMER', 'CUSTOMER_PROFILE'].includes(record.entityType?.toUpperCase() ?? '') && record.id) {
      void this.router.navigate(['/crm/customers', record.id]);
      return;
    }
    this.notify.info(this.transloco.translate('dashFilters.notAvailableYet'));
  }

  protected onErrorAction(): void {
    const err = this.errorState();
    if (!err) return;
    if (err.kind === 'provisioning' && this.canViewReadiness) {
      void this.router.navigate(['/crm/settings/data-readiness']);
      return;
    }
    if (err.retryable) {
      this.reloadToken.update((v) => v + 1);
      return;
    }
    const id = this.dashboardId();
    void this.router.navigate(
      id ? ['/crm/dashboard/dashboards', id] : ['/crm/dashboard/dashboards'],
    );
  }

  protected statusLabel(code: string): string {
    const key = `dashFilters.statuses.${code}`;
    const text = this.transloco.translate(key);
    return text === key ? this.transloco.translate('dashFilters.statuses.UNKNOWN') : text;
  }

  protected statusTone(code: string): BadgeTone {
    if (code === 'WON' || code === 'CONVERTED' || code === 'DONE') return 'success';
    if (code === 'LOST' || code === 'CANCELLED' || code === 'OVERDUE') return 'danger';
    return 'none';
  }

  protected formatRecordMoney(record: DrillRecord): string {
    if (record.amount === undefined || record.amount === null) return DASH;
    return record.currencyCode ? formatMoney(record.amount, record.currencyCode) : DASH;
  }

  protected formatRecordValue(record: DrillRecord): string {
    if (record.value === undefined || record.value === null) return DASH;
    return formatNumber(record.value, this.language(), Number.isInteger(record.value) ? 0 : 1);
  }

  protected formatRecordDate(iso: string | undefined): string {
    if (!iso) return DASH;
    return formatDate(iso, this.language());
  }

  private resetCursors(): void {
    this.cursorStack = new Map([[1, null]]);
    this.exactTotal.set(null);
    this.highestKnownTotal.set(0);
  }

  protected onCurrencyChange(currency: string | null): void {
    if (!currency || !this.currencyOptions().some((option) => option.value === currency)) return;
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { currency, page: null }, queryParamsHandling: 'merge',
    });
  }

  protected onRefresh(): void {
    this.reloadToken.update((value) => value + 1);
  }

  private async loadPage(
    dashboardId: string, widgetId: string, pointKey: string, seriesKey: string,
    filters: RuntimeFilters, targetPage: number,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadAbort.abort();
    this.loadAbort = new AbortController();
    const signal = this.loadAbort.signal;
    this.errorState.set(null);
    this.needsCurrency.set(false);
    this.loading.set(true);
    this.records.set([]);
    try {
      if (!can('crm.dashboards.read')) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
      if (!dashboardId || !widgetId) throw new ApiError(404, 'CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND');
      if (!this.cursorStack.has(targetPage)) {
        await this.router.navigate([], {
          relativeTo: this.route, queryParams: { page: null }, queryParamsHandling: 'merge', replaceUrl: true,
        });
        return;
      }
      if (this.lastDashboardId !== dashboardId) {
        const detail = await getDashboard(dashboardId);
        if (seq !== this.loadSeq) return;
        this.lastDashboardId = dashboardId;
        this.dashboardDetail.set(detail);
        this.dashboardName.set(detail.name);
      }
      const placement = this.dashboardDetail()?.placements.find((item) => item.widgetId === widgetId);
      const selection = pointKey || (placement?.widget.querySpec.dimension ? '' : 'value');
      if (!selection) throw new ApiError(422, 'CRM_DASHBOARD_DRILLDOWN_SELECTION_INVALID');
      const result = await drilldown(dashboardId, widgetId, {
        pointKey: selection, ...(seriesKey ? { seriesKey } : {}),
        cursor: this.cursorStack.get(targetPage), limit: PAGE_LIMIT, filters,
      }, signal);
      if (seq !== this.loadSeq) return;
      if (result.pageInfo.hasMore && result.pageInfo.nextCursor) {
        this.cursorStack.set(targetPage + 1, result.pageInfo.nextCursor);
        this.exactTotal.set(null);
        this.highestKnownTotal.update((previous) => Math.max(previous, targetPage * PAGE_LIMIT + 1));
      } else {
        this.exactTotal.set((targetPage - 1) * PAGE_LIMIT + result.records.length);
      }
      this.records.set(result.records);
      this.currentPage.set(targetPage);
    } catch (error) {
      if (isAbortError(error) || seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'CRM_DASHBOARD_DRILLDOWN_CURSOR_INVALID' && this.cursorStack.get(targetPage)) {
        this.resetCursors();
        this.currentPage.set(1);
        void this.router.navigate([], {
          relativeTo: this.route, queryParams: { page: null }, queryParamsHandling: 'merge', replaceUrl: true,
        });
        return;
      }
      if (code === 'CRM_DASHBOARD_DRILLDOWN_CURRENCY_REQUIRED') {
        this.needsCurrency.set(true);
        this.currencyLookupFailed.set(false);
        if (hasTenantWidePermission(this.tenantScope.me(), 'currencies.currency.read')) {
          try {
            const codes = await runInInjectionContext(this.injector, () => listActiveCoreCurrencyCodes());
            if (seq !== this.loadSeq) return;
            this.currencyCodes.set(codes);
          } catch {
            if (seq !== this.loadSeq) return;
            this.currencyLookupFailed.set(true);
          }
        }
        return;
      }
      this.errorState.set(this.mapError(error));
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  private mapError(error: unknown): ErrorStateModel {
    const state = dashboardReadError(error, this.transloco, 'dashFilters');
    return {
      kind: state.kind,
      titleKey: state.kind === 'forbidden' ? 'dashFilters.accessDeniedTitle'
        : state.kind === 'not-found' ? 'dashFilters.notFoundTitle'
        : state.kind === 'provisioning' ? 'dashFilters.provisioningTitle' : 'analytics.common.loadFailed',
      textKey: errorKey(state.code), message: state.message,
      retryable: state.kind === 'load-failure' && !(error instanceof ApiError && error.status === 422),
    };
  }
}
