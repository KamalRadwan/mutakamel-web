import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { formatValue } from '../../../../ui/chart/chart-format';
import type { SparklineSpec } from '../../../../ui/sparkline/sparkline';
import { StatCard } from '../../../../ui/stat-card/stat-card';

interface MultiKpiItem {
  key: string;
  label: string;
  value: string;
  chart: SparklineSpec;
}

@Component({
  selector: 'app-kind-multi-kpi',
  imports: [StatCard],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './multi-kpi.html',
  host: { class: 'block size-full overflow-auto' },
})
export class MultiKpiKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly items = computed<MultiKpiItem[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const list = exec.series.slice(0, 4);
    if (list.length === 0 || list.every((s) => s.points.length === 0)) {
      return [];
    }

    const rawValues = list.map((s) =>
      s.points.length > 0 ? (s.points[s.points.length - 1]?.value ?? null) : null,
    );
    const maxVal = Math.max(0, ...rawValues.map((v) => (v !== null && Number.isFinite(v) ? Math.max(0, v) : 0)));

    return list.map((s, index) => {
      const raw = rawValues[index];
      const value = formatValue(raw, s.unit, s.currency ?? exec.meta.currency, lang, chartT);
      const chart: SparklineSpec =
        s.points.length > 1
          ? { shape: 'smooth', values: s.points.map((p) => p.value) }
          : {
              shape: 'progress',
              ratio: maxVal > 0 && raw !== null && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw / maxVal)) : 0,
            };

      return {
        key: s.key,
        label: s.label,
        value,
        chart,
      };
    });
  });

  protected readonly gridColsClass = computed(() => {
    switch (this.items().length) {
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
}
