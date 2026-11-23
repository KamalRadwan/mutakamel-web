import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import { ThemeState } from '../../../../../../core/theme/theme';
import type {
  CalculationDetails,
  ChartContext,
  DatasetComparisonDetails,
  ExactTable,
  Visualization,
} from '../../../../../../shared/widgets/dashboard/analytics.model';
import { KNOWN_ERRORS, reasonKey } from '../../../../../../shared/widgets/dashboard/panel-state';
import { WidgetBody } from '../../../../../../shared/widgets/dashboard/widget-body/widget-body';
import { WidgetTable } from '../../../../../../shared/widgets/dashboard/widget-table/widget-table';
import {
  DASH,
  formatDate,
  formatMoney,
  formatNumber,
  formatShortDate,
} from '../../../../../../shared/ui/chart/chart-format';
import { toExactTable } from '../../../../../../shared/ui/chart/chart-table';
import { readChartColors } from '../../../../../../shared/ui/chart/chart-theme';
import { Field } from '../../../../../../shared/ui/field/field';
import { WidgetFrame } from '../../../../../../shared/ui/widget-frame/widget-frame';
import { WidgetState } from '../../../../../../shared/ui/widget-state/widget-state';
import { defaultVisualizationForDraft } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';
import { can } from '../../../../../../shared/widgets/dashboard/analytics-permissions';
import { FullState } from '../../../../../../shared/ui/full-state/full-state';
import { RequestModal } from '../../../access/request-modal/request-modal';

const KNOWN_DATE_FIELDS = new Set<string>([
  'CREATED_AT',
  'CONVERTED_AT',
  'WON_AT',
  'CLOSED_AT',
  'EXPECTED_CLOSE_AT',
  'UPDATED_AT',
  'FIRST_RESPONSE_AT',
  'STAGE_CHANGED_AT',
  'COMPLETED_AT',
  'SCHEDULED_START_AT',
  'OCCURRED_AT',
  'TRIGGERED_AT',
  'PERIOD_END_AT',
]);

const KNOWN_ERROR_SET = new Set<string>(KNOWN_ERRORS);
const MAX_PREVIEW_ROWS = 48;

@Component({
  selector: 'app-builder-preview',
  imports: [TranslocoPipe, Field, WidgetFrame, WidgetState, WidgetBody, WidgetTable, FullState, RequestModal],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder', alias: 'builder' },
      { scope: 'chart', alias: 'chart' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  templateUrl: './builder-preview.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class BuilderPreview {
  protected readonly state = inject(BuilderState);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageState).current;
  private readonly theme = inject(ThemeState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly builderScope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder', 'builder'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));
  private readonly requestModal = viewChild(RequestModal);
  protected readonly canOpenReadiness = computed(() => can('crm.analytics.readiness.view'));
  protected readonly failureText = computed(() => {
    this.i18n();
    const failure = this.state.previewFailure();
    return (failure?.message ?? '') + (failure?.correlationId
      ? ' ' + this.transloco.translate('builder.requests.correlation', { id: failure.correlationId }) : '');
  });

  protected retryPreview(): void {
    const failure = this.state.previewFailure();
    if (failure?.kind === 'provisioning' && this.canOpenReadiness()) {
      void this.router.navigateByUrl('/crm/settings/data-readiness');
    } else if (failure?.requestAccess && this.state.widgetId()) {
      this.requestModal()?.open('WIDGET', this.state.widgetId()!);
    } else {
      this.state.refreshPreview();
    }
  }

  protected readonly firstMetric = computed(() => {
    const key = this.state.draft().querySpec.series[0]?.metricKey;
    if (!key) return undefined;
    return this.state.catalog()?.metrics.find((m) => m.key === key);
  });

  protected readonly effectiveKind = computed<Visualization>(() => {
    const draft = this.state.draft();
    if (draft.visualizationType) return draft.visualizationType;
    return defaultVisualizationForDraft(draft, this.state.catalog());
  });

  protected readonly previewRows = computed(() => {
    const kind = this.effectiveKind();
    const viz = this.state.catalog()?.visualizations.find((v) => v.key === kind);
    const raw = viz?.defaultSize.h ?? 40;
    return Math.min(raw, MAX_PREVIEW_ROWS);
  });

  protected readonly previewTitle = computed(() => {
    this.i18n();
    this.builderScope();
    const draft = this.state.draft();
    const trimmed = draft.name.trim();
    if (trimmed) return trimmed;
    const metric = this.firstMetric();
    if (metric) {
      return this.language() === 'ar' ? metric.labelAr : metric.labelEn;
    }
    return this.transloco.translate('builder.preview.untitled');
  });

  protected readonly frameHint = computed(() => {
    this.i18n();
    this.analyticsScope();
    this.builderScope();
    const metric = this.firstMetric();
    if (!metric) return this.transloco.translate('builder.preview.hint');
    const lang = this.language();
    const parts = [this.transloco.translate(`analytics.basis.${metric.readiness.basis}`)];
    const exec = this.state.preview().execution;

    // Same calculation and Union/Overlap lines as the dashboard panel hint.
    const calc = exec?.details?.['calculation'] as CalculationDetails | undefined;
    if (calc && (calc.operation === 'RATIO' || calc.operation === 'DIFFERENCE')) {
      const currency =
        exec?.meta.currency ?? exec?.series[0]?.currency ?? this.state.draft().querySpec.filters?.currencyCode ?? null;
      const formatOperand = (v: number | null): string => {
        if (v === null) return DASH;
        return metric.unit === 'MONEY' && currency
          ? formatMoney(v, currency)
          : formatNumber(v, lang, Number.isInteger(v) ? 0 : 2);
      };
      const symbol = calc.operation === 'RATIO' ? '÷' : '−';
      parts.push(`${formatOperand(calc.numerator)} ${symbol} ${formatOperand(calc.denominator)}`);
    }
    const dc = exec?.details?.['datasetComparison'] as DatasetComparisonDetails | undefined;
    if (dc && typeof dc.unionCount === 'number' && typeof dc.overlapCount === 'number') {
      parts.push(
        this.transloco.translate('analytics.common.teamComparisonHint', {
          u: formatNumber(dc.unionCount, lang, 0),
          o: formatNumber(dc.overlapCount, lang, 0),
        }),
      );
    }
    return parts.join(' · ');
  });

  protected readonly periodTag = computed<string | null>(() => {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const eff = this.state.preview().execution?.meta.effectivePeriod;
    if (eff?.from && eff?.to) {
      return this.formatShortRange(eff.from, eff.to, lang, chartT);
    }

    const filters = this.state.draft().querySpec.filters;
    const preset = filters?.datePreset ?? 'CURRENT_MONTH';
    if (preset === 'CUSTOM' && filters?.dateFrom && filters?.dateTo) {
      return this.formatShortRange(filters.dateFrom, filters.dateTo, lang, chartT);
    }
    return this.transloco.translate(`analytics.datePreset.${preset}`);
  });

  protected readonly definitionEmpty = computed(() => !this.firstMetric());

  protected readonly definitionText = computed(() => {
    this.i18n();
    this.builderScope();
    this.analyticsScope();
    const lang = this.language();
    const metric = this.firstMetric();
    if (!metric) {
      return this.transloco.translate('builder.definition.emptyShort');
    }

    const draft = this.state.draft();
    const metricName = lang === 'ar' ? metric.labelAr : metric.labelEn;
    const model = this.transloco.translate(`builder.definition.timeModel.${metric.timeModel}`);
    const dfKey = KNOWN_DATE_FIELDS.has(metric.dateField) ? metric.dateField : 'DEFAULT';
    const dateField = this.transloco.translate(`builder.definition.dateField.${dfKey}`);

    const dim = draft.querySpec.dimension;
    let grouping: string;
    if (dim?.key && dim.key !== 'none') {
      if (dim.key === 'time' && dim.grain) {
        grouping = this.transloco.translate(`builder.definition.byGrain.${dim.grain}`);
      } else {
        const dimMeta = this.state.catalog()?.dimensions.find((d) => d.key === dim.key);
        const dimLabel =
          (lang === 'ar' ? dimMeta?.labelAr : dimMeta?.labelEn) ?? dim.key;
        grouping = this.transloco.translate('builder.definition.groupedBy', {
          dimension: dimLabel,
        });
      }
    } else {
      grouping = this.transloco.translate('builder.definition.overall');
    }

    const filters = draft.querySpec.filters;
    const preset = filters?.datePreset ?? 'CURRENT_MONTH';
    const period =
      preset === 'CUSTOM' && filters?.dateFrom && filters?.dateTo
        ? `${formatDate(filters.dateFrom, lang)} – ${formatDate(filters.dateTo, lang)}`
        : this.transloco.translate(`analytics.datePreset.${preset}`);

    return this.transloco.translate('builder.definition.sentence', {
      metric: metricName,
      model,
      dateField,
      grouping,
      period,
    });
  });

  protected readonly serverErrorReasonText = computed<string | null>(() => {
    this.i18n();
    this.analyticsScope();
    const view = this.state.preview();
    if (view.status !== 'UNAVAILABLE' || !view.reasonCode) return null;
    const base = view.reasonCode.split(':')[0] ?? '';
    if (!KNOWN_ERROR_SET.has(base)) return null;
    return this.transloco.translate(`analytics.error.${base}`);
  });

  protected readonly exactTable = computed<ExactTable | null>(() => {
    this.i18n();
    this.chartScope();
    this.theme();
    const lang = this.language();
    const view = this.state.preview();
    if ((view.status !== 'READY' && view.status !== 'PARTIAL') || !view.execution) {
      return null;
    }

    const ctx: ChartContext = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      colors: readChartColors(),
      t: (key, params) => this.transloco.translate(`chart.${key}`, params),
      reasonLabel: (code) => this.transloco.translate(reasonKey(code)),
    };
    const table = toExactTable(this.effectiveKind(), view.execution, ctx);
    return table.columns.length > 0 ? table : null;
  });

  protected openReadiness(source: string): void {
    void this.router.navigate(['/crm/settings/data-readiness'], { queryParams: { source } });
  }

  private formatShortRange(
    fromIso: string,
    toIso: string,
    lang: 'ar' | 'en',
    chartT: (key: string, params?: Record<string, unknown>) => string,
  ): string {
    const sameYear = fromIso.slice(0, 4) === toIso.slice(0, 4);
    const fromText = formatShortDate(fromIso, lang, sameYear ? 'DAY' : 'MONTH_YEAR', chartT);
    const toText = formatShortDate(toIso, lang, sameYear ? 'DAY' : 'MONTH_YEAR', chartT);
    return `${fromText} – ${toText}`;
  }
}
