import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { DASH, formatDate } from '../../../../ui/chart/chart-format';

interface TimelineItem {
  id: string;
  title: string;
  dateText: string;
  pointKey: string;
  seriesKey?: string;
  entityRef?: EntityRef;
}

@Component({
  selector: 'app-kind-timeline',
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './timeline.html',
  host: { class: 'block size-full overflow-auto' },
})
export class TimelineKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly items = computed<TimelineItem[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    if (exec.result?.shape === 'EVENT_STREAM') {
      const sorted = [...exec.result.events].sort(
        (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
      );
      return sorted.map((event) => ({
        id: event.id,
        title: lang === 'ar' ? (event.titleAr ?? event.title) : event.title,
        dateText: formatDate(event.occurredAt, lang, chartT),
        pointKey: event.id,
        entityRef: event.entityRef,
      }));
    }

    const series0 = exec.series[0];
    if (!series0 || series0.points.length === 0) {
      return [];
    }

    return series0.points.map((point, index) => {
      const start = point.start ? formatDate(point.start, lang, chartT) : '';
      const end = point.end ? formatDate(point.end, lang, chartT) : '';
      let dateText = DASH;
      if (start && end) {
        dateText = start === end ? start : `${start} – ${end}`;
      } else if (start || end) {
        dateText = start || end;
      }

      return {
        id: `${series0.key}:${point.key}:${index}`,
        title: point.label,
        dateText,
        pointKey: point.key,
        seriesKey: series0.key,
      };
    });
  });

  protected onSelect(item: TimelineItem) {
    if (item.entityRef) {
      this.openRecord.emit(item.entityRef);
      return;
    }
    this.pointClick.emit({ pointKey: item.pointKey, seriesKey: item.seriesKey });
  }
}
