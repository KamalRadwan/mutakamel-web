import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../ui/badge/badge';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { formatValue } from '../../../../ui/chart/chart-format';

interface LeaderboardItem {
  id: string;
  rank: number;
  label: string;
  formattedValue: string;
  percent: number;
  tooltip: string;
  pointKey: string;
  seriesKey?: string;
  entityRef?: EntityRef;
}

@Component({
  selector: 'app-kind-leaderboard',
  imports: [Badge],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './leaderboard.html',
  host: { class: 'block size-full overflow-auto' },
})
export class LeaderboardKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly ariaLabel = computed(() => {
    this.i18n();
    this.kindsScope();
    return this.title() || this.transloco.translate('dashboardKinds.rank');
  });

  protected readonly items = computed<LeaderboardItem[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    if (exec.result?.shape === 'ROWS' && exec.result.rowKind === 'RANKED') {
      const rows = exec.result.rows;
      if (rows.length === 0) return [];
      const maxVal = Math.max(0, ...rows.map((r) => Math.max(0, r.primaryMeasure.value)));

      return rows.map((row) => {
        const val = row.primaryMeasure.value;
        const formattedValue = formatValue(
          val,
          row.primaryMeasure.unit,
          row.primaryMeasure.currencyCode,
          lang,
          chartT,
        );
        const secondaryParts = row.secondaryMeasures.map(
          (m) => `${m.label}: ${formatValue(m.value, m.unit, m.currencyCode, lang, chartT)}`,
        );
        const tooltip = secondaryParts.length > 0 ? secondaryParts.join(' · ') : row.label;

        return {
          id: row.id,
          rank: row.rank,
          label: row.label,
          formattedValue,
          percent: maxVal > 0 && val > 0 ? Math.min(100, (val / maxVal) * 100) : 0,
          tooltip,
          pointKey: row.id,
          entityRef: row.entityRef,
        };
      });
    }

    const series0 = exec.series[0];
    if (!series0 || series0.points.length === 0) return [];

    const sorted = [...series0.points].sort((a, b) => {
      const av = a.value ?? Number.NEGATIVE_INFINITY;
      const bv = b.value ?? Number.NEGATIVE_INFINITY;
      return bv - av;
    });
    const maxVal = Math.max(0, ...sorted.map((p) => (p.value !== null && p.value > 0 ? p.value : 0)));

    return sorted.map((point, index) => {
      const val = point.value;
      const formattedValue = formatValue(
        val,
        series0.unit,
        series0.currency ?? exec.meta.currency,
        lang,
        chartT,
      );
      return {
        id: `${series0.key}:${point.key}:${index}`,
        rank: index + 1,
        label: point.label,
        formattedValue,
        percent: maxVal > 0 && val !== null && val > 0 ? Math.min(100, (val / maxVal) * 100) : 0,
        tooltip: `${point.label} · ${formattedValue}`,
        pointKey: point.key,
        seriesKey: series0.key,
      };
    });
  });

  protected onSelect(item: LeaderboardItem) {
    if (item.entityRef) {
      this.openRecord.emit(item.entityRef);
      return;
    }
    this.pointClick.emit({ pointKey: item.pointKey, seriesKey: item.seriesKey });
  }
}
