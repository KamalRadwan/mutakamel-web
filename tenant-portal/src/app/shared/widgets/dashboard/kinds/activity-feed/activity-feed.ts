import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { format, isSameDay, parseISO } from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, WidgetExecution } from '../../../../ui/chart/chart.model';
import { DASH, formatDate } from '../../../../ui/chart/chart-format';
import { analyticsNow } from '../../analytics-api';

interface ActivityFeedItem {
  id: string;
  initials: string;
  text: string;
  time: string;
  isClockOnly: boolean;
  entityRef: EntityRef;
}

@Component({
  selector: 'app-kind-activity-feed',
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './activity-feed.html',
  host: { class: 'block size-full overflow-auto' },
})
export class ActivityFeedKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly items = computed<ActivityFeedItem[]>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    if (exec.result?.shape !== 'EVENT_STREAM') {
      return [];
    }

    const nowDate = parseISO(analyticsNow());
    return exec.result.events.map((event) => {
      const text = lang === 'ar' ? (event.titleAr ?? event.title) : event.title;
      const formatted = formatEventTime(event.occurredAt, nowDate, lang, chartT);
      return {
        id: event.id,
        initials: extractInitials(event.title || text),
        text,
        time: formatted.time,
        isClockOnly: formatted.isClockOnly,
        entityRef: event.entityRef,
      };
    });
  });
}

function extractInitials(rawTitle: string): string {
  const words = rawTitle.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatEventTime(
  occurredAt: string,
  nowDate: Date,
  lang: 'ar' | 'en',
  t: (key: string, params?: Record<string, unknown>) => string,
): { time: string; isClockOnly: boolean } {
  const evDate = parseISO(occurredAt);
  if (Number.isNaN(evDate.getTime())) {
    return { time: DASH, isClockOnly: false };
  }
  if (!Number.isNaN(nowDate.getTime()) && isSameDay(evDate, nowDate)) {
    return { time: format(evDate, 'HH:mm'), isClockOnly: true };
  }
  return { time: formatDate(occurredAt, lang, t), isClockOnly: false };
}
