import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../ui/badge/badge';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { formatDate } from '../../../../ui/chart/chart-format';

interface CalendarDayCell {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  count: number;
  tooltip: string;
  ariaLabel: string;
}

interface NormalizedInterval {
  fromIso: string;
  toIso: string;
  label: string;
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;

@Component({
  selector: 'app-kind-calendar',
  imports: [Badge],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './calendar.html',
  host: { class: 'block size-full overflow-auto' },
})
export class CalendarKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly weekdays = computed<string[]>(() => {
    this.i18n();
    this.chartScope();
    return Array.from({ length: 7 }, (_, idx) => this.transloco.translate(`chart.daysShort.${idx}`));
  });

  protected readonly days = computed<CalendarDayCell[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const plural = new Intl.PluralRules(lang);
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const points = exec.series[0]?.points ?? [];
    if (points.length === 0) return [];

    const anchor =
      parseYmd(exec.meta.effectivePeriod?.from) ??
      parseYmd(points[0]?.start ?? points[0]?.end ?? points[0]?.key);
    if (!anchor) return [];

    const intervals: NormalizedInterval[] = [];
    for (const point of points) {
      const startDate = parseYmd(point.start ?? point.key) ?? parseYmd(point.end);
      const endDate = parseYmd(point.end ?? point.start ?? point.key) ?? startDate;
      if (!startDate || !endDate) continue;

      const a = format(startDate, 'yyyy-MM-dd');
      const b = format(endDate, 'yyyy-MM-dd');
      intervals.push(
        a <= b ? { fromIso: a, toIso: b, label: point.label } : { fromIso: b, toIso: a, label: point.label },
      );
    }

    const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => {
      const iso = format(date, 'yyyy-MM-dd');
      const touching = intervals.filter((iv) => iv.fromIso <= iso && iso <= iv.toIso);
      const count = touching.length;
      return {
        iso,
        dayNumber: date.getDate(),
        inMonth: isSameMonth(date, anchor),
        count,
        tooltip: touching.map((iv) => iv.label).join(' · '),
        ariaLabel: `${formatDate(iso, lang, chartT)} · ${this.transloco.translate(`dashboardKinds.items${plural.select(count).replace(/^./, (c) => c.toUpperCase())}`, { count })}`,
      };
    });
  });
}

function parseYmd(raw: string | undefined): Date | null {
  if (!raw) return null;
  const match = YMD_RE.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
