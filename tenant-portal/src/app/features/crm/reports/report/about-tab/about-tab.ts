import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerChartBar,
  tablerClock,
  tablerDatabase,
  tablerInfoCircle,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import type { ChartContext, SeriesUnit } from '../../../../../shared/ui/chart/chart.model';
import {
  DASH,
  formatDate,
  formatDateTime,
  formatRateN,
  formatValue,
} from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { explainReceipt, getCatalog, getReceipt, listReadiness } from '../../../../../shared/widgets/dashboard/analytics.api';
import type {
  Catalog,
  Explain,
  Panel,
  PanelManifest,
  Receipt,
  SourceReadiness,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { ReportState } from '../report-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

type SourceMode = 'REQUIRED' | 'OPTIONAL';

interface SourceRow {
  sourceKey: string;
  mode: SourceMode;
  modeLabel: string;
  statusTone: BadgeTone;
  statusLabel: string;
  lastChecked: string;
}

interface FilterPill {
  key: string;
  label: string;
  value: string;
}

const KNOWN_TIME_MODELS = new Set(['EVENT', 'COHORT', 'SNAPSHOT', 'INTERVAL', 'CUSTOM']);
const KNOWN_DATE_FIELDS = new Set([
  'CREATED_AT',
  'CONVERTED_AT',
  'FIRST_RESPONSE_AT',
  'UPDATED_AT',
  'EXPECTED_CLOSE_AT',
  'WON_AT',
  'CLOSED_AT',
  'STAGE_CHANGED_AT',
  'COMPLETED_AT',
  'SCHEDULED_START_AT',
  'OCCURRED_AT',
  'TRIGGERED_AT',
  'PERIOD_END_AT',
  'DUE_AT',
  'SENT_AT',
]);
const KNOWN_FILTER_KEYS = new Set([
  'currencyCode',
  'currency',
  'branchId',
  'branchIds',
  'teamIds',
  'ownerUserId',
  'ownerUserIds',
  'pipelineId',
  'datePreset',
  'compare',
  'source',
  'staleDays',
  'closingWindowDays',
  'limit',
]);
const SERIES_UNITS = new Set<SeriesUnit>(['COUNT', 'MONEY', 'PERCENT', 'RATIO', 'DURATION', 'SCORE']);

function parseDecimal(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSeriesUnit(raw: string | null | undefined): SeriesUnit {
  if (raw && SERIES_UNITS.has(raw as SeriesUnit)) return raw as SeriesUnit;
  return 'COUNT';
}

function resolveCurrency(manifest: PanelManifest | null, receipt: Receipt | null): string {
  const fromReceipt = receipt?.result.currencyCode?.trim();
  if (fromReceipt) return fromReceipt.toUpperCase();
  if (manifest) {
    const currencyDesc = manifest.filters.schema.find((desc) => desc.kind === 'CURRENCY');
    if (currencyDesc) {
      const applied = manifest.filters.applied.find((item) => item.key === currencyDesc.key);
      if (typeof applied?.value === 'string' && applied.value.trim()) {
        return applied.value.trim().toUpperCase();
      }
    }
    const appliedCurrency = manifest.filters.applied.find(
      (item) => item.key === 'currencyCode' || item.key === 'currency',
    );
    if (typeof appliedCurrency?.value === 'string' && appliedCurrency.value.trim()) {
      return appliedCurrency.value.trim().toUpperCase();
    }
  }
  return 'EGP';
}

function statusBadgeTone(status: SourceReadiness['status'] | undefined): BadgeTone {
  if (status === 'READY') return 'success';
  if (status === 'EXPERIMENTAL') return 'warning';
  return 'none';
}

let nextAboutId = 0;

@Component({
  selector: 'app-report-about-tab',
  imports: [RouterLink, NgIcon, TranslocoPipe, Badge, Button, DataCell, DataTable, Field, FullState],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-rep-tabs', alias: 'repTabs' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({ tablerArrowLeft, tablerChartBar, tablerClock, tablerDatabase, tablerInfoCircle }),
  ],
  templateUrl: './about-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-10' },
})
export class AboutTab {
  private readonly org = inject(OrgApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly state = inject(ReportState);
  protected readonly language = inject(LanguageState).current;

  private readonly i18n = translationEvents(this.transloco);
  private readonly tabsScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-tabs', 'repTabs'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly uid = `report-about-${++nextAboutId}`;
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  protected readonly dash = DASH;

  private readonly catalog = signal<Catalog | null>(null);
  private readonly readinessList = signal<SourceReadiness[]>([]);
  protected readonly sourcesLoading = signal(true);
  protected readonly sourcesFailed = signal(false);

  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly explain = signal<Explain | null>(null);
  protected readonly explainLoading = signal(false);
  protected readonly explainFailed = signal(false);
  private readonly explainRetryTick = signal(0);

  private destroyed = false;
  private explainSeq = 0;

  protected readonly manifest = computed(() => this.state.manifest());
  protected readonly isInitialLoading = computed(() => this.state.loading() && !this.manifest());

  private readonly chartTranslator = computed<ChartContext['t']>(() => {
    this.i18n();
    this.chartScope();
    return (key, params) => this.transloco.translate(`chart.${key}`, params);
  });

  protected readonly panelParam = computed(() => this.queryParams()?.get('panel')?.trim() || null);

  protected readonly selectedPanel = computed<Panel | null>(() => {
    const key = this.panelParam();
    if (!key) return null;
    return this.manifest()?.panels.find((panel) => panel.panelKey === key) ?? null;
  });

  protected readonly selectedReceiptId = computed(() => this.selectedPanel()?.receiptId ?? null);

  protected readonly selectedPanelTitle = computed(() => {
    const lang = this.language();
    return this.selectedPanel()?.title[lang] ?? '';
  });

  protected readonly reportTitle = computed(() => {
    const lang = this.language();
    return this.manifest()?.report?.title[lang] ?? DASH;
  });

  protected readonly domainLabel = computed(() => {
    this.i18n();
    this.analyticsScope();
    const domain = this.manifest()?.report?.domain;
    return domain ? this.transloco.translate(`analytics.domain.${domain}`) : DASH;
  });

  protected readonly reportCode = computed(() => this.manifest()?.report?.code || DASH);

  protected readonly methodText = computed(() => {
    const lang = this.language();
    return this.manifest()?.report?.methodCard[lang] ?? '';
  });

  protected readonly basisLabel = computed(() => {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const scope = this.manifest()?.scope;
    if (!scope) return DASH;
    const base = this.transloco.translate(`analytics.basis.${scope.basis}`);
    if (scope.basis === 'AS_OF' && scope.asOf) {
      const asOfText = formatDateTime(scope.asOf, this.language(), this.chartTranslator());
      return `${base} · ${asOfText}`;
    }
    return base;
  });

  protected readonly periodText = computed(() => {
    this.i18n();
    this.chartScope();
    const period = this.manifest()?.period;
    if (!period) return DASH;
    const lang = this.language();
    const chartT = this.chartTranslator();
    return `${formatDate(period.from, lang, chartT)} – ${formatDate(period.to, lang, chartT)}`;
  });

  protected readonly comparisonText = computed(() => {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const comp = this.manifest()?.period.comparison;
    if (!comp) return this.transloco.translate('analytics.compare.NONE');
    const lang = this.language();
    const chartT = this.chartTranslator();
    return `${formatDate(comp.from, lang, chartT)} – ${formatDate(comp.to, lang, chartT)}`;
  });

  protected readonly recordsCountedText = computed(() => {
    this.i18n();
    this.tabsScope();
    this.analyticsScope();
    const scope = this.manifest()?.scope;
    if (!scope) return DASH;
    const lang = this.language();
    const modeKey = scope.ownerMode.toLowerCase();
    const ownerLabel = this.transloco.translate(`analytics.scope.${modeKey}`);

    // Confirm branch name lookup from org store in Phase 5.
    let branchesLabel = this.transloco.translate('repTabs.allBranches');
    if (scope.branchIds !== 'ALL' && scope.branchIds.length > 0) {
      const names = scope.branchIds.map((id) => {
        const branch = this.org.branches.find((item) => item.id === id);
        return branch ? branch.name[lang] : id;
      });
      branchesLabel = names.join(', ');
    }
    return `${ownerLabel} · ${branchesLabel}`;
  });

  protected readonly timeZoneText = computed(() => this.manifest()?.scope.timeZone || DASH);

  protected readonly sourceColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.tabsScope();
    return [
      { key: 'sourceKey', label: this.transloco.translate('repTabs.sourceKey'), width: 1.8, align: 'start' },
      { key: 'mode', label: this.transloco.translate('repTabs.mode'), width: 0.9, align: 'start' },
      { key: 'status', label: this.transloco.translate('repTabs.status'), width: 1.1, align: 'start' },
      { key: 'lastChecked', label: this.transloco.translate('repTabs.lastChecked'), width: 1.2, align: 'start' },
    ];
  });

  protected readonly sourceRows = computed<SourceRow[]>(() => {
    this.i18n();
    this.tabsScope();
    this.analyticsScope();
    this.chartScope();
    const manifest = this.manifest();
    const catalog = this.catalog();
    const readiness = this.readinessList();
    if (!manifest) return [];

    const sourceModeMap = new Map<string, SourceMode>();
    const metricMap = new Map((catalog?.metrics ?? []).map((m) => [m.key, m]));

    for (const panel of manifest.panels) {
      for (const metricKey of panel.metricKeys) {
        const metric = metricMap.get(metricKey);
        for (const src of metric?.readiness.sources ?? []) {
          const existing = sourceModeMap.get(src.sourceKey);
          if (existing !== 'REQUIRED') {
            sourceModeMap.set(src.sourceKey, src.mode);
          }
        }
      }
      const unavailKey = panel.unavailable?.sourceKey;
      if (unavailKey && !sourceModeMap.has(unavailKey)) {
        sourceModeMap.set(unavailKey, 'REQUIRED');
      }
    }

    const readinessMap = new Map(readiness.map((r) => [r.sourceKey, r]));
    const lang = this.language();
    const chartT = this.chartTranslator();

    return Array.from(sourceModeMap.entries()).map(([sourceKey, mode]) => {
      const info = readinessMap.get(sourceKey);
      const statusLabel = info
        ? this.transloco.translate(`analytics.readinessUi.${info.uiState}`)
        : this.transloco.translate('analytics.state.UNAVAILABLE');
      return {
        sourceKey,
        mode,
        modeLabel: this.transloco.translate(mode === 'REQUIRED' ? 'repTabs.required' : 'repTabs.optional'),
        statusTone: statusBadgeTone(info?.status),
        statusLabel,
        lastChecked: info?.lastCheckedAt ? formatDateTime(info.lastCheckedAt, lang, chartT) : DASH,
      };
    });
  });

  protected readonly sourceRowKey = (row: SourceRow): string => row.sourceKey;

  protected readonly whatCountsText = computed(() => {
    this.i18n();
    this.tabsScope();
    const exp = this.explain();
    const rec = this.receipt();
    if (!exp && !rec) return DASH;
    const lang = this.language();
    const metricKey = exp?.definition.metricKey ?? rec?.metricKey ?? '';
    const metric = this.catalog()?.metrics.find((m) => m.key === metricKey);
    const metricLabel = metric
      ? (lang === 'ar' ? metric.labelAr : metric.labelEn)
      : (this.selectedPanelTitle() || DASH);

    const rawTimeModel = exp?.definition.timeModel ?? metric?.timeModel ?? 'UNKNOWN';
    const timeModelKey = KNOWN_TIME_MODELS.has(rawTimeModel) ? rawTimeModel : 'UNKNOWN';
    const timeModel = this.transloco.translate(`repTabs.timeModel.${timeModelKey}`);

    const rawDateField = exp?.definition.dateField ?? metric?.dateField ?? 'UNKNOWN';
    const dateFieldKey = KNOWN_DATE_FIELDS.has(rawDateField) ? rawDateField : 'UNKNOWN';
    const dateField = this.transloco.translate(`repTabs.dateField.${dateFieldKey}`);

    return this.transloco.translate('repTabs.whatCountsFormat', {
      metric: metricLabel,
      timeModel,
      dateField,
    });
  });

  private readonly explainNumbers = computed(() => {
    const exp = this.explain();
    const rec = this.receipt();
    const numerator = parseDecimal(exp?.numerator?.value ?? rec?.result.numerator);
    const denominator = parseDecimal(exp?.denominator?.value ?? rec?.result.denominator);
    const value = parseDecimal(exp?.value.value ?? rec?.result.value);
    const unit = toSeriesUnit(exp?.definition.unit ?? rec?.result.unit);
    const currency = resolveCurrency(this.manifest(), rec);
    return { numerator, denominator, value, unit, currency };
  });

  protected readonly nOfNText = computed(() => {
    this.i18n();
    this.chartScope();
    const { numerator, denominator } = this.explainNumbers();
    if (numerator === null || denominator === null) return DASH;
    return formatRateN(numerator, denominator, this.language(), this.chartTranslator());
  });

  protected readonly explainValueIsLtr = computed(() => {
    const { value, denominator, unit } = this.explainNumbers();
    if (value === null || denominator === 0) return false;
    return !(unit === 'DURATION' && this.language() === 'ar');
  });

  protected readonly explainValueText = computed(() => {
    this.i18n();
    this.chartScope();
    const { value, denominator, unit, currency } = this.explainNumbers();
    if (value === null || denominator === 0) return DASH;
    return formatValue(value, unit, currency, this.language(), this.chartTranslator());
  });

  protected readonly explainValueHint = computed(() => {
    this.i18n();
    this.tabsScope();
    const base = this.transloco.translate('repTabs.valueHint');
    if (this.explainNumbers().denominator === 0) {
      return `${base} ${this.transloco.translate('repTabs.zeroDenominatorHint')}`;
    }
    return base;
  });

  protected readonly coverageText = computed(() => {
    this.i18n();
    this.tabsScope();
    this.chartScope();
    const cov = this.explain()?.coverage ?? this.receipt()?.coverage;
    if (!cov) return DASH;
    const lang = this.language();
    const chartT = this.chartTranslator();
    if (cov.historyIncomplete) {
      return cov.coverageStartedAt
        ? this.transloco.translate('repTabs.historyIncomplete', {
            date: formatDate(cov.coverageStartedAt, lang, chartT),
          })
        : this.transloco.translate('repTabs.historyIncompleteUnknown');
    }
    return cov.coverageStartedAt
      ? this.transloco.translate('repTabs.completeSince', {
          date: formatDate(cov.coverageStartedAt, lang, chartT),
        })
      : this.transloco.translate('repTabs.completeCoverage');
  });

  protected readonly explainAsOfText = computed(() => {
    this.i18n();
    this.chartScope();
    const iso = this.explain()?.scope.asOf ?? this.receipt()?.asOf ?? null;
    return iso ? formatDateTime(iso, this.language(), this.chartTranslator()) : DASH;
  });

  protected readonly filterPills = computed<FilterPill[]>(() => {
    this.i18n();
    this.tabsScope();
    this.analyticsScope();
    this.chartScope();
    const expFilters = this.explain()?.filters;
    const recFilters = this.receipt()?.filters;
    const rawFilters =
      expFilters && Object.keys(expFilters).length > 0 ? expFilters : (recFilters ?? {});

    const manifest = this.manifest();
    const lang = this.language();
    const chartT = this.chartTranslator();

    const pills: FilterPill[] = [];
    for (const [key, val] of Object.entries(rawFilters)) {
      if (val === null || val === undefined || val === '') continue;
      if (Array.isArray(val) && val.length === 0) continue;

      const descriptor = manifest?.filters.schema.find((d) => d.key === key);
      const label = descriptor
        ? descriptor.label[lang]
        : KNOWN_FILTER_KEYS.has(key)
          ? this.transloco.translate(`repTabs.filterKey.${key}`)
          : key;

      pills.push({
        key,
        label,
        value: this.formatFilterValue(key, val, lang, chartT),
      });
    }
    return pills;
  });

  protected readonly dataAsOfText = computed(() => {
    this.i18n();
    this.chartScope();
    const iso = this.manifest()?.freshness.dataAsOf;
    return iso ? formatDateTime(iso, this.language(), this.chartTranslator()) : DASH;
  });

  protected readonly oldestSourceText = computed(() => {
    this.i18n();
    this.chartScope();
    const iso = this.manifest()?.freshness.oldestSourceAsOf;
    return iso ? formatDateTime(iso, this.language(), this.chartTranslator()) : DASH;
  });

  protected readonly isStale = computed(() => Boolean(this.manifest()?.freshness.stale));

  constructor() {
    void Promise.allSettled([this.org.listGrantedBranches(), this.org.listTeams(), this.org.listUsers()]);
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    void this.loadCatalogAndReadiness();

    effect(() => {
      const receiptId = this.selectedReceiptId();
      this.explainRetryTick();

      if (!receiptId) {
        untracked(() => {
          this.explainSeq++;
          this.receipt.set(null);
          this.explain.set(null);
          this.explainLoading.set(false);
          this.explainFailed.set(false);
        });
        return;
      }

      untracked(() => {
        void this.loadExplain(receiptId);
      });
    });
  }

  protected sourceKeyOf(row: unknown): string {
    return (row as SourceRow).sourceKey;
  }

  protected modeLabelOf(row: unknown): string {
    return (row as SourceRow).modeLabel;
  }

  protected statusToneOf(row: unknown): BadgeTone {
    return (row as SourceRow).statusTone;
  }

  protected statusLabelOf(row: unknown): string {
    return (row as SourceRow).statusLabel;
  }

  protected retrySources(): void {
    void this.loadCatalogAndReadiness();
  }

  protected retryExplain(): void {
    this.explainRetryTick.update((n) => n + 1);
  }

  protected backToOverview(): void {
    const panelKey = this.panelParam();
    const cleanPath = this.router.url.split('?')[0]?.split('#')[0] ?? '';
    if (cleanPath.endsWith('/about')) {
      const overviewPath = `${cleanPath.slice(0, -'/about'.length)}/overview`;
      void this.router.navigate([overviewPath], {
        queryParams: panelKey ? { panel: panelKey } : {},
        queryParamsHandling: 'merge',
      });
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: 'overview',
        ...(panelKey ? { panel: panelKey } : {}),
      },
      queryParamsHandling: 'merge',
    });
  }

  private async loadCatalogAndReadiness(): Promise<void> {
    this.sourcesLoading.set(true);
    this.sourcesFailed.set(false);
    try {
      const [catalog, readiness] = await Promise.all([getCatalog(), listReadiness()]);
      if (this.destroyed) return;
      this.catalog.set(catalog);
      this.readinessList.set(readiness.items);
    } catch (error) {
      if (this.destroyed) return;
      this.sourcesFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      if (!this.destroyed) {
        this.sourcesLoading.set(false);
      }
    }
  }

  private async loadExplain(receiptId: string): Promise<void> {
    const seq = ++this.explainSeq;
    this.explainLoading.set(true);
    this.explainFailed.set(false);

    try {
      const [rec, exp] = await Promise.all([getReceipt(receiptId), explainReceipt(receiptId)]);
      if (seq !== this.explainSeq || this.destroyed) return;
      this.receipt.set(rec);
      this.explain.set(exp);
      this.explainLoading.set(false);
    } catch (error) {
      if (seq !== this.explainSeq || this.destroyed) return;
      this.explainLoading.set(false);
      this.explainFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private formatFilterValue(key: string, value: unknown, lang: 'ar' | 'en', chartT: ChartContext['t']): string {
    if (Array.isArray(value)) {
      return value.map((item) => this.formatSingleFilterValue(key, item, lang, chartT)).join(', ');
    }
    return this.formatSingleFilterValue(key, value, lang, chartT);
  }

  private formatSingleFilterValue(
    key: string,
    value: unknown,
    lang: 'ar' | 'en',
    chartT: ChartContext['t'],
  ): string {
    const str = String(value);
    if (key === 'datePreset') {
      // YESTERDAY is new to the backend presets and not in the shared analytics labels yet.
      for (const labelKey of [`repTabs.datePreset.${str}`, `analytics.datePreset.${str}`]) {
        const translated = this.transloco.translate(labelKey);
        if (translated !== labelKey) return translated;
      }
      return str;
    }
    if (key === 'compare') {
      const translated = this.transloco.translate(`analytics.compare.${str}`);
      return translated === `analytics.compare.${str}` ? str : translated;
    }
    if (key === 'branchId' || key === 'branchIds') {
      return this.org.branches.find((b) => b.id === str)?.name[lang] ?? str;
    }
    if (key === 'teamIds') {
      return this.org.teams.find((t) => t.id === str)?.name[lang] ?? str;
    }
    if (key === 'ownerUserId' || key === 'ownerUserIds') {
      const person = this.org.users.find((p) => p.id === str);
      return person ? (lang === 'ar' ? person.nameAr : person.name) : str;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return formatDate(str, lang, chartT);
    }
    return str;
  }
}

export { AboutTab as ReportAboutTab };
