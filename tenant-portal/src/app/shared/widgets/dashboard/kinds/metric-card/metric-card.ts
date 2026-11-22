import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, SeriesUnit, WidgetExecution } from '../../../../ui/chart/chart.model';
import {
  formatMoney,
  formatNumber,
  formatPercent,
  formatRateN,
  formatValue,
} from '../../../../ui/chart/chart-format';
import type { SparklineSpec } from '../../../../ui/sparkline/sparkline';
import { StatCard } from '../../../../ui/stat-card/stat-card';

interface MetricCardView {
  key: string;
  label: string;
  value: string;
  valueTitle: string;
  delta: string | null;
  direction: 'up' | 'down' | 'flat' | null;
  chart: SparklineSpec | null;
}

@Component({
  selector: 'app-kind-metric-card',
  imports: [StatCard],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './metric-card.html',
  host: { class: 'block size-full overflow-auto' },
})
export class MetricCardKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly breakdownCards = computed<MetricCardView[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const breakdown = exec.meta.breakdown;
    if (!breakdown || breakdown.length <= 1) return [];

    const MAX_CARDS = 4;
    const lang = this.language();
    const overflow = breakdown.length > MAX_CARDS;
    const items = overflow ? breakdown.slice(0, MAX_CARDS - 1) : breakdown;
    const baseLabel = exec.series[0]?.label || this.title();

    const cards = items.map((item): MetricCardView => {
      const value = formatMoney(item.value, item.currencyCode);
      return {
        key: item.currencyCode,
        label: baseLabel ? `${baseLabel} · ${item.currencyCode}` : item.currencyCode,
        value,
        valueTitle: value,
        delta: null,
        direction: null,
        chart: {
          shape: 'progress',
          // Currencies are never compared with each other: the track stays empty.
          ratio: 0,
        },
      };
    });

    if (overflow) {
      const rest = breakdown.slice(MAX_CARDS - 1);
      cards.push({
        key: '__more',
        label: this.transloco.translate('dashboardKinds.moreCurrencies'),
        value: `⁦+${formatNumber(rest.length, lang, 0)}⁩`,
        valueTitle: rest
          .map((item) => `${item.currencyCode}: ${formatMoney(item.value, item.currencyCode)}`)
          .join('\n'),
        delta: null,
        direction: null,
        chart: { shape: 'progress', ratio: 0 },
      });
    }
    return cards;
  });

  protected readonly gridColsClass = computed(() => {
    switch (this.breakdownCards().length) {
      case 4:
        return 'grid-cols-4';
      case 3:
        return 'grid-cols-3';
      case 2:
        return 'grid-cols-2';
      default:
        return 'grid-cols-1';
    }
  });

  protected readonly singleCard = computed<MetricCardView | null>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    if (this.breakdownCards().length > 1) return null;

    const exec = this.execution();
    const lang = this.language();
    const series0 = exec.series[0];
    if ((!series0 || series0.points.length === 0) && exec.value === undefined) {
      return null;
    }

    const rawValue =
      exec.value !== undefined
        ? exec.value
        : (series0?.points[series0.points.length - 1]?.value ?? null);
    const unit: SeriesUnit = series0?.unit ?? (exec.meta.unit as SeriesUnit | undefined) ?? 'COUNT';
    const currency = series0?.currency ?? exec.meta.currency;
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const label = series0?.label || this.title();
    const value = formatValue(rawValue, unit, currency, lang, chartT);

    const { delta, direction } = this.buildDelta(exec, rawValue, unit, currency, lang, chartT);
    const chart = this.buildChart(exec, rawValue);

    return {
      key: series0?.key ?? 'metric',
      label,
      value,
      valueTitle: value,
      delta,
      direction,
      chart,
    };
  });

  private buildDelta(
    exec: WidgetExecution,
    rawValue: number | null,
    unit: SeriesUnit,
    currency: string | undefined,
    lang: 'ar' | 'en',
    chartT: (key: string, params?: Record<string, unknown>) => string,
  ): { delta: string | null; direction: 'up' | 'down' | 'flat' | null } {
    const numerator = exec.details?.['numerator'];
    const denominator = exec.details?.['denominator'];
    if (typeof numerator === 'number' && typeof denominator === 'number') {
      return {
        delta: formatRateN(numerator, denominator, lang, chartT),
        direction: null,
      };
    }

    const comp = exec.comparison;
    if (!comp) {
      return { delta: null, direction: null };
    }

    const suffix =
      comp.type === 'PREVIOUS_YEAR'
        ? this.transloco.translate('dashboardKinds.vsLastYear')
        : this.transloco.translate('dashboardKinds.vsPrevious');

    if (unit === 'PERCENT') {
      const diff =
        typeof comp.absoluteChange === 'number'
          ? comp.absoluteChange
          : rawValue !== null && typeof comp.previousValue === 'number'
            ? rawValue - comp.previousValue
            : null;
      if (diff !== null && Number.isFinite(diff)) {
        const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
        const pp = this.transloco.translate('chart.pp');
        return {
          delta: `\u2066${sign}${formatNumber(Math.abs(diff), lang, 1)}\u2069 ${pp} ${suffix}`,
          direction,
        };
      }
    }

    const pct =
      typeof comp.percentChange === 'number'
        ? comp.percentChange
        : rawValue !== null && typeof comp.previousValue === 'number' && comp.previousValue !== 0
          ? ((rawValue - comp.previousValue) / Math.abs(comp.previousValue)) * 100
          : null;

    if (pct !== null && Number.isFinite(pct)) {
      const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
      const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
      return {
        delta: `\u2066${sign}${formatPercent(Math.abs(pct), 1)}\u2069 ${suffix}`,
        direction,
      };
    }

    if (typeof comp.absoluteChange === 'number' && Number.isFinite(comp.absoluteChange)) {
      const direction = comp.absoluteChange > 0 ? 'up' : comp.absoluteChange < 0 ? 'down' : 'flat';
      const sign = comp.absoluteChange > 0 ? '+' : comp.absoluteChange < 0 ? '-' : '';
      return {
        delta: `\u2066${sign}${formatValue(Math.abs(comp.absoluteChange), unit, currency, lang, chartT)}\u2069 ${suffix}`,
        direction,
      };
    }

    return { delta: null, direction: null };
  }

  private buildChart(exec: WidgetExecution, rawValue: number | null): SparklineSpec | null {
    const series0 = exec.series[0];
    if (series0 && series0.points.length > 1) {
      return {
        shape: 'line',
        values: series0.points.map((point) => point.value),
      };
    }

    if (typeof exec.target === 'number' && Number.isFinite(exec.target) && exec.target > 0) {
      const ratio = rawValue !== null ? Math.max(0, Math.min(1, rawValue / exec.target)) : 0;
      return { shape: 'progress', ratio };
    }

    const prev = exec.comparison?.previousValue ?? exec.previousValue;
    if (typeof prev === 'number' && Number.isFinite(prev)) {
      return { shape: 'bars', values: [prev, rawValue] };
    }

    return null;
  }
}
