import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerChevronLeft, tablerChevronRight } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { LanguageState } from '../../../core/i18n/language';
import { Button } from '../button/button';
import { DATE_RANGE_NOW } from './date-range-clock';
import { TimeField } from '../date-time/time-field';
import { Field } from '../field/field';
import { rectInPage, viewport } from '../overlay/zoom';
import {
  DATE_RANGE_PRESETS,
  DEFAULT_FROM_TIME,
  DEFAULT_TO_TIME,
  DateRangePreset,
  DateRangeValue,
  countRangeDays,
  formatDisplayDate,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
  presetRange,
} from './date-range-presets';

export {
  DATE_RANGE_PRESETS,
  presetRange,
  type DateRangePreset,
  type DateRangeValue,
} from './date-range-presets';

interface RangeDay {
  iso: string;
  label: string;
  ariaLabel: string;
  inMonth: boolean;
  isToday: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  bandStart: boolean;
  bandEnd: boolean;
}

interface MonthPane {
  monthIndex: number;
  title: string;
  days: RangeDay[];
}

interface Place {
  top: number;
  start: number;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const PICKER_WIDTH_SINGLE = 348;
const PICKER_WIDTH_DOUBLE = 528;
const ESTIMATED_PICKER_HEIGHT = 330;
const GRID_CELL_COUNT = 42;
const WEEKDAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

@Component({
  selector: 'ui-date-range',
  imports: [NgIcon, TranslocoPipe, Button, Field, TimeField],
  viewProviders: [provideTranslocoScope({ scope: 'date-range', alias: 'dateRange' })],
  providers: [provideIcons({ tablerCalendar, tablerChevronLeft, tablerChevronRight })],
  templateUrl: './date-range.html',
  host: {
    class: 'relative block w-full',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
  },
})
export class DateRange {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');

  readonly value = model<DateRangeValue | null>(null);
  readonly months = input<1 | 2>(2);
  readonly withTime = input(true);
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly today = input('');
  private readonly now = inject(DATE_RANGE_NOW);
  readonly placeholder = input('');

  protected readonly presets = DATE_RANGE_PRESETS;
  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0 });

  private readonly viewMonth = signal<Date>(startOfMonth(new Date(2026, 0, 1)));
  private readonly focusedIso = signal('');
  private readonly draftFromDate = signal<Date | null>(null);
  private readonly draftToDate = signal<Date | null>(null);
  private readonly draftFromTime = signal(DEFAULT_FROM_TIME);
  private readonly draftToTime = signal(DEFAULT_TO_TIME);
  protected readonly draftPreset = signal<DateRangePreset | null>(null);
  private readonly pickingEnd = signal(false);
  protected readonly hoveredIso = signal<string | null>(null);
  private placeSeq = 0;

  private readonly resolvedToday = computed(
    () => parseLocalDate(this.today()) ?? startOfDay(this.now()),
  );

  protected readonly displayText = computed(() => {
    const val = this.value();
    if (!val) return '';
    const parsedFrom = parseLocalDateTime(val.from, DEFAULT_FROM_TIME);
    const parsedTo = parseLocalDateTime(val.to, DEFAULT_TO_TIME);
    if (!parsedFrom || !parsedTo) return '';
    const lang = this.language();
    const showTime =
      this.withTime() &&
      (parsedFrom.time !== DEFAULT_FROM_TIME || parsedTo.time !== DEFAULT_TO_TIME);
    const fromText = showTime
      ? `${formatDisplayDate(parsedFrom.date, lang)} ${parsedFrom.time}`
      : formatDisplayDate(parsedFrom.date, lang);
    const toText = showTime
      ? `${formatDisplayDate(parsedTo.date, lang)} ${parsedTo.time}`
      : formatDisplayDate(parsedTo.date, lang);
    return `${fromText} \u2013 ${toText}`;
  });

  protected readonly placeholderText = computed(() => {
    this.i18n();
    const custom = this.placeholder();
    return custom || this.transloco.translate('dateRange.placeholder');
  });

  protected readonly boxClasses = computed(() => {
    if (this.invalid()) return 'border-danger-border ring-2 ring-danger-halo';
    if (this.open()) return 'border-focus-ring ring-3 ring-focus-halo-strong';
    return 'border-border-field hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo-strong';
  });

  protected readonly weekdays = computed(() => {
    this.i18n();
    this.language();
    return WEEKDAY_KEYS.map((dayIndex) =>
      this.transloco.translate(`dateRange.weekdays.${dayIndex}`),
    );
  });

  private readonly effectiveRange = computed<{ from: Date; to: Date } | null>(() => {
    const from = this.draftFromDate();
    if (!from) return null;
    if (this.pickingEnd()) {
      const hovered = parseLocalDate(this.hoveredIso());
      if (hovered) {
        return isBefore(hovered, from) ? { from: hovered, to: from } : { from, to: hovered };
      }
      return { from, to: from };
    }
    const to = this.draftToDate() ?? from;
    return isBefore(to, from) ? { from: to, to: from } : { from, to };
  });

  protected readonly panes = computed<MonthPane[]>(() => {
    this.i18n();
    const lang = this.language();
    const firstMonth = this.viewMonth();
    const count = this.months();
    const todayDate = this.resolvedToday();
    const range = this.effectiveRange();
    const singleDay = range ? isSameDay(range.from, range.to) : false;

    const ariaFormatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return Array.from({ length: count }, (_, monthIndex) => {
      const monthDate = addMonths(firstMonth, monthIndex);
      const monthNumber = monthDate.getMonth();
      const monthName = this.transloco.translate(`dateRange.months.${monthNumber}`);
      const title = `${monthName} ${monthDate.getFullYear()}`;
      const gridStart = startOfWeek(monthDate, { weekStartsOn: 0 });

      const days: RangeDay[] = Array.from({ length: GRID_CELL_COUNT }, (_, dayIndex) => {
        const date = addDays(gridStart, dayIndex);
        const iso = formatLocalDate(date);
        const inMonth = isSameMonth(date, monthDate);
        const isToday = isSameDay(date, todayDate);
        const isRangeStart = Boolean(inMonth && range && isSameDay(date, range.from));
        const isRangeEnd = Boolean(inMonth && range && isSameDay(date, range.to));
        const isInRange = Boolean(
          inMonth && range && !singleDay && isAfter(date, range.from) && isBefore(date, range.to),
        );
        const bandStart = Boolean(
          inMonth && range && !singleDay && (isInRange || (isRangeEnd && !isRangeStart)),
        );
        const bandEnd = Boolean(
          inMonth && range && !singleDay && (isInRange || (isRangeStart && !isRangeEnd)),
        );

        return {
          iso,
          label: String(date.getDate()),
          ariaLabel: ariaFormatter.format(date),
          inMonth,
          isToday,
          isRangeStart,
          isRangeEnd,
          isInRange,
          bandStart,
          bandEnd,
        };
      });

      return { monthIndex, title, days };
    });
  });

  protected readonly tabbableIso = computed(() => {
    const panes = this.panes();
    const focused = this.focusedIso();
    if (
      focused &&
      panes.some((pane) => pane.days.some((day) => day.inMonth && day.iso === focused))
    ) {
      return focused;
    }
    const firstPane = panes[0];
    const firstInMonth = firstPane?.days.find((day) => day.inMonth);
    return firstInMonth?.iso ?? null;
  });

  protected readonly dayCountText = computed(() => {
    this.i18n();
    this.language();
    const range = this.effectiveRange();
    if (!range) return '';
    const count = countRangeDays(range.from, range.to);
    if (count === 1) return this.transloco.translate('dateRange.day');
    const category = new Intl.PluralRules(this.language()).select(count);
    const key =
      category === 'two'
        ? 'daysTwo'
        : category === 'few'
          ? 'daysFew'
          : category === 'many'
            ? 'daysMany'
            : category === 'other'
              ? 'daysOther'
              : 'days';
    return this.transloco.translate(`dateRange.${key}`, { count });
  });

  protected readonly canApply = computed(() => Boolean(this.draftFromDate()));

  protected readonly draftFromTimeValue = computed(() => this.draftFromTime());
  protected readonly draftToTimeValue = computed(() => this.draftToTime());

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.openPicker();
  }

  protected close(): void {
    this.placeSeq++;
    this.open.set(false);
    this.placed.set(false);
    this.hoveredIso.set(null);
    this.pickingEnd.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.open()) return;
    const hostEl = this.host.nativeElement;
    const path = event.composedPath();
    if (path.includes(hostEl)) return;
    const target = event.target;
    if (target instanceof Node && hostEl.contains(target)) return;
    this.close();
  }

  protected shiftMonth(delta: number): void {
    const nextMonth = addMonths(this.viewMonth(), delta);
    this.viewMonth.set(nextMonth);
    const currentFocus = parseLocalDate(this.focusedIso()) ?? nextMonth;
    const shifted = addMonths(currentFocus, delta);
    this.focusedIso.set(formatLocalDate(shifted));
  }

  protected choosePreset(preset: DateRangePreset): void {
    const range = presetRange(preset, this.resolvedToday());
    const parsedFrom = parseLocalDateTime(range.from, DEFAULT_FROM_TIME);
    const parsedTo = parseLocalDateTime(range.to, DEFAULT_TO_TIME);
    if (!parsedFrom || !parsedTo) return;
    this.draftFromDate.set(parsedFrom.date);
    this.draftToDate.set(parsedTo.date);
    this.draftFromTime.set(DEFAULT_FROM_TIME);
    this.draftToTime.set(DEFAULT_TO_TIME);
    this.draftPreset.set(preset);
    this.pickingEnd.set(false);
    this.hoveredIso.set(null);
    this.viewMonth.set(this.initialViewMonth(parsedFrom.date, parsedTo.date));
    this.focusedIso.set(formatLocalDate(parsedTo.date));
  }

  protected selectDay(day: RangeDay): void {
    const picked = parseLocalDate(day.iso);
    if (!picked) return;

    if (!this.pickingEnd()) {
      this.draftFromDate.set(picked);
      this.draftToDate.set(null);
      this.pickingEnd.set(true);
      this.hoveredIso.set(day.iso);
      this.draftPreset.set(null);
    } else {
      const start = this.draftFromDate() ?? picked;
      if (isBefore(picked, start)) {
        this.draftFromDate.set(picked);
        this.draftToDate.set(start);
      } else {
        this.draftFromDate.set(start);
        this.draftToDate.set(picked);
      }
      this.pickingEnd.set(false);
      this.hoveredIso.set(null);
      this.draftPreset.set(null);
    }

    this.focusedIso.set(day.iso);
    if (!day.inMonth) {
      this.ensureVisibleMonth(picked);
    }
  }

  protected hoverDay(day: RangeDay): void {
    if (!this.pickingEnd()) return;
    this.hoveredIso.set(day.iso);
  }

  protected onTimeChange(which: 'from' | 'to', nextTime: string | null): void {
    if (!nextTime) return;
    if (which === 'from') {
      if (nextTime !== this.draftFromTime()) {
        this.draftFromTime.set(nextTime);
        this.draftPreset.set(null);
      }
    } else if (nextTime !== this.draftToTime()) {
      this.draftToTime.set(nextTime);
      this.draftPreset.set(null);
    }
  }

  protected cancel(): void {
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected apply(): void {
    const from = this.draftFromDate();
    if (!from) return;
    const to = this.draftToDate() ?? from;
    let fromDate = from;
    let toDate = to;
    if (isBefore(toDate, fromDate)) {
      [fromDate, toDate] = [toDate, fromDate];
    }

    let fromTime = this.withTime() ? this.draftFromTime() : DEFAULT_FROM_TIME;
    let toTime = this.withTime() ? this.draftToTime() : DEFAULT_TO_TIME;
    if (isSameDay(fromDate, toDate) && fromTime > toTime) {
      [fromTime, toTime] = [toTime, fromTime];
    }

    this.value.set({
      from: formatLocalDateTime(fromDate, fromTime),
      to: formatLocalDateTime(toDate, toTime),
      preset: this.draftPreset(),
    });
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected dayMarkClasses(day: RangeDay): string {
    if (!day.inMonth) return 'text-text-placeholder hover:bg-row-hover';
    if (day.isRangeStart || day.isRangeEnd) return 'bg-brand font-medium text-on-brand';
    if (day.isInRange) {
      return day.isToday ? 'border border-brand text-on-brand-soft' : 'text-on-brand-soft';
    }
    if (day.isToday) return 'border border-brand text-text hover:bg-row-hover';
    return 'text-text hover:bg-row-hover';
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) {
        this.openPicker();
      } else {
        this.focusGridCell(this.tabbableIso());
      }
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  protected onPopoverKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target?.hasAttribute('data-iso')) return;

    const currentIso = target.getAttribute('data-iso') || this.focusedIso();
    const currentDate = parseLocalDate(currentIso) ?? this.resolvedToday();
    const isRtl = this.isRtl();
    let nextDate: Date | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        nextDate = addDays(currentDate, isRtl ? 1 : -1);
        break;
      case 'ArrowRight':
        nextDate = addDays(currentDate, isRtl ? -1 : 1);
        break;
      case 'ArrowUp':
        nextDate = addDays(currentDate, -7);
        break;
      case 'ArrowDown':
        nextDate = addDays(currentDate, 7);
        break;
      case 'PageUp':
        nextDate = addMonths(currentDate, -1);
        break;
      case 'PageDown':
        nextDate = addMonths(currentDate, 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        for (const pane of this.panes()) {
          const matched = pane.days.find((item) => item.inMonth && item.iso === currentIso);
          if (matched) {
            this.selectDay(matched);
            return;
          }
        }
        return;
      }
      default:
        return;
    }

    event.preventDefault();
    const candidateIso = formatLocalDate(nextDate);
    this.focusedIso.set(candidateIso);
    this.ensureVisibleMonth(nextDate);
    afterNextRender(() => this.focusGridCell(candidateIso), { injector: this.injector });
  }

  private openPicker(): void {
    const val = this.value();
    const todayDate = this.resolvedToday();
    const parsedFrom = parseLocalDateTime(val?.from, DEFAULT_FROM_TIME);
    const parsedTo = parseLocalDateTime(val?.to, DEFAULT_TO_TIME);

    this.draftFromDate.set(parsedFrom?.date ?? null);
    this.draftToDate.set(parsedTo?.date ?? null);
    this.draftFromTime.set(parsedFrom?.time ?? DEFAULT_FROM_TIME);
    this.draftToTime.set(parsedTo?.time ?? DEFAULT_TO_TIME);
    this.draftPreset.set(val?.preset ?? null);
    this.pickingEnd.set(false);
    this.hoveredIso.set(null);

    const viewStart = this.initialViewMonth(parsedFrom?.date ?? null, parsedTo?.date ?? null);
    this.viewMonth.set(viewStart);
    this.focusedIso.set(formatLocalDate(parsedFrom?.date ?? todayDate));

    const estimatedWidth = this.months() === 1 ? PICKER_WIDTH_SINGLE : PICKER_WIDTH_DOUBLE;
    const seq = ++this.placeSeq;
    this.placed.set(false);
    this.place.set(this.measure(estimatedWidth, ESTIMATED_PICKER_HEIGHT));
    this.open.set(true);

    afterNextRender(
      () => {
        if (seq !== this.placeSeq || !this.open()) return;
        const el = this.popover()?.nativeElement;
        if (el) {
          const popRect = rectInPage(el);
          this.place.set(
            this.measure(
              popRect.width || estimatedWidth,
              popRect.height || ESTIMATED_PICKER_HEIGHT,
            ),
          );
        }
        this.placed.set(true);
        this.focusGridCell(this.tabbableIso());
      },
      { injector: this.injector },
    );
  }

  private initialViewMonth(from: Date | null, to: Date | null): Date {
    const todayDate = this.resolvedToday();
    if (this.months() === 1) {
      if (!from) return startOfMonth(todayDate);
      if (to && differenceInCalendarMonths(to, from) > 1) return startOfMonth(to);
      return startOfMonth(from);
    }

    if (from && to) {
      const span = differenceInCalendarMonths(to, from);
      if (span === 1) return startOfMonth(from);
      if (span === 0) {
        return isSameMonth(from, todayDate) ? subMonths(startOfMonth(from), 1) : startOfMonth(from);
      }
      return subMonths(startOfMonth(to), 1);
    }

    if (from) {
      return isSameMonth(from, todayDate) ? subMonths(startOfMonth(from), 1) : startOfMonth(from);
    }

    return subMonths(startOfMonth(todayDate), 1);
  }

  private ensureVisibleMonth(date: Date): void {
    const first = this.viewMonth();
    const span = this.months();
    for (let i = 0; i < span; i++) {
      if (isSameMonth(date, addMonths(first, i))) return;
    }
    if (isBefore(date, first)) {
      this.viewMonth.set(startOfMonth(date));
    } else {
      this.viewMonth.set(subMonths(startOfMonth(date), span - 1));
    }
  }

  private focusGridCell(iso: string | null): void {
    if (!iso) return;
    const cell = this.popover()?.nativeElement.querySelector<HTMLButtonElement>(
      `button[data-iso="${iso}"][data-in-month="true"]`,
    );
    cell?.focus({ preventScroll: true });
  }

  private isRtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }

  private measure(width: number, height: number): Place {
    const rect = rectInPage(this.trigger().nativeElement);
    const vp = viewport();
    const rtl = this.isRtl();
    const rawStart = rtl ? vp.width - rect.right : rect.left;
    const maxStart = Math.max(VIEWPORT_MARGIN, vp.width - width - VIEWPORT_MARGIN);
    const start = Math.min(Math.max(VIEWPORT_MARGIN, rawStart), maxStart);

    const spaceBelow = vp.height - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < height && spaceAbove >= spaceBelow;
    const rawTop = openAbove ? rect.top - POPOVER_GAP - height : rect.bottom + POPOVER_GAP;
    const maxTop = Math.max(VIEWPORT_MARGIN, vp.height - height - VIEWPORT_MARGIN);
    const top = Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop);

    return { top, start };
  }
}
