import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { pluralKey } from '../../../../../core/i18n/plural';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerCalendarEvent,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Activity, TYPE_LOOK, dueState } from '../../../../../shared/widgets/activities/activities.model';
import {
  DUE_BADGE_CLASSES,
  formatActivityTime,
  primaryTargetOf,
} from '../operations-activities.model';

export interface CalendarCell {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  title: string;
  items: Activity[];
}

const REFERENCE_SUNDAY = new Date(2026, 0, 4);

function formatYmd(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calendarMonthRange(month: Date): {
  gridStart: Date;
  gridEndExclusive: Date;
  days: Date[];
} {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - monthStart.getDay());
  const lastWeekSatOffset = 6 - monthEnd.getDay();
  const lastShown = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + lastWeekSatOffset);
  const gridEndExclusive = new Date(lastShown.getFullYear(), lastShown.getMonth(), lastShown.getDate() + 1);

  const days: Date[] = [];
  for (
    let cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
    cur.getTime() < gridEndExclusive.getTime();
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  ) {
    days.push(cur);
  }

  return { gridStart, gridEndExclusive, days };
}

@Component({
  selector: 'app-activities-calendar',
  imports: [NgIcon, TranslocoPipe, Button, Modal],
  providers: [
    provideIcons({
      tablerChevronLeft,
      tablerChevronRight,
      tablerCalendarEvent,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './activities-calendar.html',
  host: { class: 'flex flex-col gap-8' },
})
export class ActivitiesCalendar {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly dayModal = viewChild.required<Modal>('dayModal');

  readonly month = input.required<Date>();
  readonly items = input.required<readonly Activity[]>();
  readonly loading = input(false);

  readonly monthChange = output<Date>();
  readonly openActivity = output<Activity>();

  protected readonly selectedDayIso = signal<string | null>(null);
  protected readonly typeLook = TYPE_LOOK;
  protected readonly dueBadgeClasses = DUE_BADGE_CLASSES;
  protected readonly primaryTargetOf = primaryTargetOf;
  protected readonly dueState = dueState;

  protected readonly monthTitle = computed(() => {
    const lang = this.language();
    return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      month: 'long',
      year: 'numeric',
    }).format(this.month());
  });

  protected readonly weekdays = computed(() => {
    const lang = this.language();
    const formatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(REFERENCE_SUNDAY.getFullYear(), REFERENCE_SUNDAY.getMonth(), REFERENCE_SUNDAY.getDate() + offset);
      return formatter.format(date);
    });
  });

  protected readonly cells = computed<CalendarCell[]>(() => {
    const month = this.month();
    const lang = this.language();
    const items = this.items();
    const { days } = calendarMonthRange(month);
    const now = new Date();
    const todayIso = formatYmd(now);
    const titleFormatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const parsedItems = items
      .map((item) => {
        const startMs = Date.parse(item.dueAt);
        const endMs = item.endsAt ? Date.parse(item.endsAt) : Number.NaN;
        return { item, startMs, endMs };
      })
      .filter((entry) => !Number.isNaN(entry.startMs))
      .sort((a, b) => a.startMs - b.startMs);

    return days.map((day) => {
      const dayStartMs = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0).getTime();
      const dayEndMs = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0).getTime();
      const dayItems = parsedItems
        .filter(({ startMs, endMs }) => {
          if (!Number.isNaN(endMs) && endMs > startMs) {
            return startMs < dayEndMs && endMs > dayStartMs;
          }
          return startMs >= dayStartMs && startMs < dayEndMs;
        })
        .map((entry) => entry.item);

      const iso = formatYmd(day);
      return {
        iso,
        dayNumber: day.getDate(),
        inMonth: day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth(),
        isToday: iso === todayIso,
        title: titleFormatter.format(day),
        items: dayItems,
      };
    });
  });

  protected readonly selectedDay = computed<CalendarCell | null>(() => {
    const iso = this.selectedDayIso();
    if (!iso) return null;
    return this.cells().find((cell) => cell.iso === iso) ?? null;
  });

  protected readonly dayModalSubtitle = computed(() => {
    this.i18n();
    const day = this.selectedDay();
    if (!day) return '';
    return this.transloco.translate(pluralKey('wsActivities.calendar.dayModalSubtitlePlural', day.items.length, this.language()), { count: day.items.length });
  });

  protected shiftMonth(delta: number): void {
    const current = this.month();
    this.monthChange.emit(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  protected goToday(): void {
    const now = new Date();
    this.monthChange.emit(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  protected formatTime(iso: string): string {
    return formatActivityTime(iso, this.language());
  }

  protected openDayModal(cell: CalendarCell): void {
    this.selectedDayIso.set(cell.iso);
    this.dayModal().open();
  }

  protected openFromDayModal(item: Activity): void {
    this.dayModal().close();
    this.selectedDayIso.set(null);
    this.openActivity.emit(item);
  }
}
