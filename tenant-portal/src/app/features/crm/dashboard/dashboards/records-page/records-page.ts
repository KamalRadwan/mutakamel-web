import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
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
  queueRun,
  retryWhenBusy,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import type { RuntimeFilters } from '../../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_BRANCHES } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { drilldown, getDashboard } from '../dashboards.api';
import type { DrillRecord } from '../dashboards.model';
import { decodeRuntimeFilters } from '../records-link';

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
}

function parsePageParam(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

@Component({
  selector: 'app-records-page',
  imports: [TranslocoPipe, Badge, Breadcrumbs, DataCell, DataTable, FullState, Pagination],
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
  protected readonly filters = computed<RuntimeFilters>(() =>
    decodeRuntimeFilters(this.rawFilters()),
  );

  protected readonly dashboardName = signal<string | null>(null);
  protected readonly records = signal<DrillRecord[]>([]);
  protected readonly loading = signal(false);
  /** A drill-down call was refused (429) and waits to retry: shown as a status line above the table. */
  protected readonly retrying = signal(false);
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
      const branchMap = new Map(
        FAKE_BRANCHES.map((b) => [b.id, lang === 'ar' ? b.name.ar : b.name.en]),
      );
      const sep = lang === 'ar' ? '، ' : ', ';
      const branchNames = branchIds.map((id) => branchMap.get(id) ?? id).join(sep);
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
      if (!id || id === this.lastDashboardId) return;
      this.lastDashboardId = id;
      untracked(() => {
        this.dashboardName.set(null);
        void getDashboard(id)
          .then((detail) => {
            if (this.dashboardId() === id) {
              this.dashboardName.set(detail.name);
            }
          })
          .catch(() => {
            // Keep fallback dashboard label in breadcrumbs if metadata fails.
          });
      });
    });

    effect(() => {
      const id = this.dashboardId();
      const widget = this.widgetId();
      const point = this.pointKey();
      const series = this.seriesKey();
      const rawF = this.rawFilters();
      const targetPage = this.requestedPage();
      const lang = this.language();
      this.reloadToken();

      const signature = `${id}|${widget}|${point}|${series}|${rawF}|${lang}`;
      untracked(() => {
        if (signature !== this.lastQuerySignature) {
          this.lastQuerySignature = signature;
          this.cursorStack = new Map<number, string | null>([[1, null]]);
          this.exactTotal.set(null);
          this.highestKnownTotal.set(0);
        }
        void this.loadPage(id, widget, point, series, this.filters(), targetPage);
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
    this.notify.info(this.transloco.translate('dashFilters.notAvailableYet'));
  }

  protected onErrorAction(): void {
    const err = this.errorState();
    if (!err) return;
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
    return formatMoney(record.amount, record.currencyCode ?? 'EGP');
  }

  protected formatRecordValue(record: DrillRecord): string {
    if (record.value === undefined || record.value === null) return DASH;
    return formatNumber(record.value, this.language(), Number.isInteger(record.value) ? 0 : 1);
  }

  protected formatRecordDate(iso: string | undefined): string {
    if (!iso) return DASH;
    return formatDate(iso, this.language());
  }

  private async loadPage(
    dashboardId: string,
    widgetId: string,
    pointKey: string,
    seriesKey: string,
    filters: RuntimeFilters,
    targetPage: number,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadAbort.abort();
    this.loadAbort = new AbortController();
    const signal = this.loadAbort.signal;
    const busyOptions = {
      signal,
      onRetry: () => {
        if (seq === this.loadSeq) this.retrying.set(true);
      },
    };
    this.errorState.set(null);
    this.retrying.set(false);

    if (!dashboardId || !widgetId) {
      this.records.set([]);
      this.loading.set(false);
      this.errorState.set({
        kind: 'not-found',
        titleKey: 'dashFilters.notFoundTitle',
        textKey: errorKey('CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND'),
        retryable: false,
      });
      return;
    }

    this.loading.set(true);

    try {
      let pageToFetch = targetPage;
      if (!this.cursorStack.has(pageToFetch)) {
        const cachedPages = Array.from(this.cursorStack.keys()).sort((a, b) => a - b);
        let cursorPage = cachedPages[cachedPages.length - 1] ?? 1;

        while (cursorPage < targetPage) {
          const cursor = this.cursorStack.get(cursorPage) ?? null;
          const stepRes = await retryWhenBusy(
            () =>
              queueRun(
                () =>
                  drilldown(
                    dashboardId,
                    widgetId,
                    {
                      pointKey,
                      ...(seriesKey ? { seriesKey } : {}),
                      cursor,
                      limit: PAGE_LIMIT,
                      filters,
                    },
                    signal,
                  ),
                signal,
              ),
            busyOptions,
          );
          if (seq !== this.loadSeq) return;
          this.retrying.set(false);

          if (stepRes.pageInfo.hasMore && stepRes.pageInfo.nextCursor) {
            this.cursorStack.set(cursorPage + 1, stepRes.pageInfo.nextCursor);
            this.highestKnownTotal.update((prev) =>
              Math.max(prev, cursorPage * PAGE_LIMIT + 1),
            );
            cursorPage++;
          } else {
            this.exactTotal.set((cursorPage - 1) * PAGE_LIMIT + stepRes.records.length);
            this.records.set(stepRes.records);
            this.currentPage.set(cursorPage);
            this.loading.set(false);
            if (cursorPage !== targetPage) {
              void this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { page: cursorPage <= 1 ? null : String(cursorPage) },
                queryParamsHandling: 'merge',
                replaceUrl: true,
              });
            }
            return;
          }
        }
        pageToFetch = cursorPage;
      }

      const cursor = this.cursorStack.get(pageToFetch) ?? null;
      const result = await retryWhenBusy(
        () =>
          queueRun(
            () =>
              drilldown(
                dashboardId,
                widgetId,
                {
                  pointKey,
                  ...(seriesKey ? { seriesKey } : {}),
                  cursor,
                  limit: PAGE_LIMIT,
                  filters,
                },
                signal,
              ),
            signal,
          ),
        busyOptions,
      );
      if (seq !== this.loadSeq) return;
      this.retrying.set(false);

      if (result.pageInfo.hasMore && result.pageInfo.nextCursor) {
        this.cursorStack.set(pageToFetch + 1, result.pageInfo.nextCursor);
        this.exactTotal.set(null);
        this.highestKnownTotal.update((prev) => Math.max(prev, pageToFetch * PAGE_LIMIT + 1));
      } else {
        this.exactTotal.set((pageToFetch - 1) * PAGE_LIMIT + result.records.length);
      }

      this.records.set(result.records);
      this.currentPage.set(pageToFetch);
      this.loading.set(false);
    } catch (error: unknown) {
      if (isAbortError(error) || seq !== this.loadSeq) return;
      this.retrying.set(false);
      this.loading.set(false);
      this.records.set([]);
      this.errorState.set(this.mapError(error));
    }
  }

  private mapError(error: unknown): ErrorStateModel {
    const code = errorCodeOf(error);
    const status = error instanceof ApiError ? error.status : 0;

    if (status === 403 || code === 'CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED') {
      return {
        kind: 'forbidden',
        titleKey: 'dashFilters.accessDeniedTitle',
        textKey: errorKey(code ?? 'CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED'),
        retryable: false,
      };
    }

    if (status === 404) {
      return {
        kind: 'not-found',
        titleKey: 'dashFilters.notFoundTitle',
        textKey: errorKey(code),
        retryable: false,
      };
    }

    if (status === 422 || (code && code.startsWith('CRM_DASHBOARD_DRILLDOWN_'))) {
      return {
        kind: 'load-failure',
        titleKey: 'dashFilters.drillUnavailableTitle',
        textKey: errorKey(code),
        retryable: false,
      };
    }

    return {
      kind: 'load-failure',
      titleKey: 'analytics.common.loadFailed',
      textKey: errorKey(code),
      retryable: true,
    };
  }
}
