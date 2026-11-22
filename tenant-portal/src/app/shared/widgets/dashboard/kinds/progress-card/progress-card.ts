import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, SeriesUnit, WidgetExecution } from '../../../../ui/chart/chart.model';
import { DASH, formatPercent, formatValue } from '../../../../ui/chart/chart-format';
import type { SparklineSpec } from '../../../../ui/sparkline/sparkline';
import { StatCard } from '../../../../ui/stat-card/stat-card';

interface ProgressCardView {
  label: string;
  value: string;
  delta: string;
  chart: SparklineSpec;
}

@Component({
  selector: 'app-kind-progress-card',
  imports: [StatCard],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './progress-card.html',
  host: { class: 'block size-full overflow-auto' },
})
export class ProgressCardKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly card = computed<ProgressCardView | null>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const series0 = exec.series[0];
    if ((!series0 || series0.points.length === 0) && exec.value === undefined) {
      return null;
    }

    const unit: SeriesUnit = series0?.unit ?? (exec.meta.unit as SeriesUnit | undefined) ?? 'COUNT';
    const currency = series0?.currency ?? exec.meta.currency;
    const label = series0?.label || this.title();
    const actual =
      exec.value !== undefined
        ? exec.value
        : (series0?.points[series0.points.length - 1]?.value ?? null);
    const target =
      typeof exec.target === 'number' && Number.isFinite(exec.target) ? exec.target : null;

    const value = formatValue(actual, unit, currency, lang, chartT);

    let ratio = 0;
    let delta = DASH;

    if (target !== null && target > 0) {
      const rawRatio = actual !== null && Number.isFinite(actual) ? actual / target : 0;
      ratio = Math.max(0, Math.min(1, rawRatio));
      const pct = actual !== null && Number.isFinite(actual) ? `\u2066${formatPercent(rawRatio * 100, 1)}\u2069` : DASH;
      const targetStr = `\u2066${formatValue(target, unit, currency, lang, chartT)}\u2069`;
      delta = this.transloco.translate('dashboardKinds.ofTarget', { pct, target: targetStr });
    }

    return {
      label,
      value,
      delta,
      chart: { shape: 'progress', ratio },
    };
  });
}
