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
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendar,
  tablerChevronDown,
  tablerChevronLeft,
  tablerChevronRight,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';

export interface LibraryDateRangeValue {
  updatedFrom: string | null;
  updatedTo: string | null;
  startIso: string | null;
  endIso: string | null;
  startTime: string;
  endTime: string;
}

type PresetId =
  | 'maximum'
  | 'today'
  | 'yesterday'
  | 'todayAndYesterday'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4';

interface CalendarDay {
  iso: string;
  label: string;
  ariaLabel: string;
  inMonth: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  hasRange: boolean;
}

interface Place {
  top: number;
  start: number;
}

type TimeDropdownId = 'startHour' | 'startMin' | 'endHour' | 'endMin';

const PRESET_IDS: readonly PresetId[] = [
  'maximum',
  'today',
  'yesterday',
  'todayAndYesterday',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
  'q1',
  'q2',
  'q3',
  'q4',
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const GRID_CELL_COUNT = 42;
const REFERENCE_SUNDAY = new Date(2026, 0, 4);
const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const ESTIMATED_WIDTH = 348;
const ESTIMATED_HEIGHT = 336;

export function emptyDateRange(): LibraryDateRangeValue {
  return {
    updatedFrom: null,
    updatedTo: null,
    startIso: null,
    endIso: null,
    startTime: '00:00',
    endTime: '23:59',
  };
}

function formatIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function splitTime(value: string, fallbackHour: string, fallbackMin: string): [string, string] {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? [match[1], match[2]] : [fallbackHour, fallbackMin];
}

function combineIsoLocal(dateIso: string, timeStr: string, addOneMinute = false): string {
  const date = parseIsoDate(dateIso) ?? new Date();
  const [h, m] = splitTime(timeStr, '00', '00');
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(h), Number(m), 0, 0);
  if (addOneMinute) {
    local.setMinutes(local.getMinutes() + 1);
  }
  return local.toISOString();
}

function presetDates(id: PresetId, now: Date): { startIso: string; endIso: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (id) {
    case 'maximum':
      return { startIso: '2020-01-01', endIso: formatIsoDate(today) };
    case 'today':
      return { startIso: formatIsoDate(today), endIso: formatIsoDate(today) };
    case 'yesterday': {
      const prev = addDays(today, -1);
      return { startIso: formatIsoDate(prev), endIso: formatIsoDate(prev) };
    }
    case 'todayAndYesterday':
      return { startIso: formatIsoDate(addDays(today, -1)), endIso: formatIsoDate(today) };
    case 'thisMonth':
      return { startIso: formatIsoDate(new Date(y, m, 1)), endIso: formatIsoDate(today) };
    case 'lastMonth':
      return { startIso: formatIsoDate(new Date(y, m - 1, 1)), endIso: formatIsoDate(new Date(y, m, 0)) };
    case 'thisYear':
      return { startIso: formatIsoDate(new Date(y, 0, 1)), endIso: formatIsoDate(today) };
    case 'lastYear':
      return { startIso: formatIsoDate(new Date(y - 1, 0, 1)), endIso: formatIsoDate(new Date(y - 1, 11, 31)) };
    case 'q1':
      return { startIso: formatIsoDate(new Date(y, 0, 1)), endIso: formatIsoDate(new Date(y, 2, 31)) };
    case 'q2':
      return { startIso: formatIsoDate(new Date(y, 3, 1)), endIso: formatIsoDate(new Date(y, 5, 30)) };
    case 'q3':
      return { startIso: formatIsoDate(new Date(y, 6, 1)), endIso: formatIsoDate(new Date(y, 8, 30)) };
    case 'q4':
      return { startIso: formatIsoDate(new Date(y, 9, 1)), endIso: formatIsoDate(new Date(y, 11, 31)) };
  }
}

export function formatDateRangeLabel(range: LibraryDateRangeValue, lang: 'ar' | 'en'): string {
  const start = parseIsoDate(range.startIso);
  const end = parseIsoDate(range.endIso);
  if (!start || !end) return '';
  const fmt = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const startLabel = fmt.format(start);
  const endLabel = fmt.format(end);
  const customTimes = range.startTime !== '00:00' || range.endTime !== '23:59';
  if (range.startIso === range.endIso && !customTimes) {
    return startLabel;
  }
  const timeSuffixStart = customTimes ? ` ${range.startTime}` : '';
  const timeSuffixEnd = customTimes ? ` ${range.endTime}` : '';
  return `${startLabel}${timeSuffixStart} – ${endLabel}${timeSuffixEnd}`;
}

@Component({
  selector: 'app-library-date-range',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerCalendar, tablerChevronDown, tablerChevronLeft, tablerChevronRight, tablerX })],
  templateUrl: './date-range-field.html',
  host: {
    class: 'relative block w-full',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class LibraryDateRangeField {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly timeList = viewChild<ElementRef<HTMLElement>>('timeList');

  readonly value = model<LibraryDateRangeValue>(emptyDateRange());
  readonly id = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly describedBy = input<string | null>(null);
  readonly placeholder = input('');
  readonly disabled = input(false);

  protected readonly presets = PRESET_IDS;
  protected readonly hours = HOURS;
  protected readonly minutes = MINUTES;

  protected readonly open = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0 });
  protected readonly viewMonth = signal<Date>(startOfMonth(new Date()));
  protected readonly focusedIso = signal<string>(formatIsoDate(new Date()));

  protected readonly draftStartIso = signal<string | null>(null);
  protected readonly draftEndIso = signal<string | null>(null);
  protected readonly draftStartHour = signal('00');
  protected readonly draftStartMin = signal('00');
  protected readonly draftEndHour = signal('23');
  protected readonly draftEndMin = signal('59');
  protected readonly activePreset = signal<PresetId | null>(null);

  protected readonly openTimeMenu = signal<TimeDropdownId | null>(null);
  protected readonly timeMenuPlace = signal<Place>({ top: 0, start: 0 });

  protected readonly hasValue = computed(() => Boolean(this.value().updatedFrom && this.value().updatedTo));

  protected readonly displayValue = computed(() => {
    this.i18n();
    return formatDateRangeLabel(this.value(), this.language());
  });

  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      month: 'long',
      year: 'numeric',
    }).format(this.viewMonth()),
  );

  /** Design system: week starts on Sunday in both languages. */
  protected readonly weekdays = computed(() => {
    const lang = this.language();
    const formatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, offset) => formatter.format(addDays(REFERENCE_SUNDAY, offset)));
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const lang = this.language();
    const monthDate = this.viewMonth();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstOffset = monthDate.getDay();
    const gridStart = new Date(year, month, 1 - firstOffset);
    const todayIso = formatIsoDate(new Date());
    const startIso = this.draftStartIso();
    const endIso = this.draftEndIso() ?? startIso;
    const hasRange = Boolean(startIso && endIso && startIso !== endIso);
    const labelFormatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return Array.from({ length: GRID_CELL_COUNT }, (_, index) => {
      const date = addDays(gridStart, index);
      const iso = formatIsoDate(date);
      const isStart = Boolean(startIso && iso === startIso);
      const isEnd = Boolean(endIso && iso === endIso);
      const inRange = Boolean(hasRange && startIso && endIso && iso > startIso && iso < endIso);
      return {
        iso,
        label: String(date.getDate()),
        ariaLabel: labelFormatter.format(date),
        inMonth: date.getMonth() === month && date.getFullYear() === year,
        isToday: iso === todayIso,
        isStart,
        isEnd,
        inRange,
        hasRange,
      };
    });
  });

  protected readonly weeks = computed<CalendarDay[][]>(() => {
    const all = this.days();
    const rows: CalendarDay[][] = [];
    for (let i = 0; i < all.length; i += 7) {
      rows.push(all.slice(i, i + 7));
    }
    return rows;
  });

  protected readonly effectiveFocusedIso = computed<string>(() => {
    const all = this.days();
    const target = this.focusedIso();
    if (all.some((d) => d.iso === target)) return target;
    const todayCell = all.find((d) => d.isToday);
    if (todayCell) return todayCell.iso;
    const firstInMonth = all.find((d) => d.inMonth);
    return firstInMonth?.iso ?? all[0]?.iso ?? '';
  });

  protected readonly selectedDaysCount = computed(() => {
    const start = parseIsoDate(this.draftStartIso());
    const end = parseIsoDate(this.draftEndIso() ?? this.draftStartIso());
    if (!start || !end) return 0;
    const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return Math.max(1, diff + 1);
  });

  protected readonly timeOptions = computed<readonly string[]>(() => {
    const menu = this.openTimeMenu();
    if (menu === 'startHour' || menu === 'endHour') return this.hours;
    return this.minutes;
  });

  protected readonly selectedTimeOption = computed(() => {
    switch (this.openTimeMenu()) {
      case 'startHour':
        return this.draftStartHour();
      case 'startMin':
        return this.draftStartMin();
      case 'endHour':
        return this.draftEndHour();
      case 'endMin':
        return this.draftEndMin();
      default:
        return '';
    }
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target as Node | null;
      if (target && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const current = this.value();
    const [sh, sm] = splitTime(current.startTime, '00', '00');
    const [eh, em] = splitTime(current.endTime, '23', '59');
    this.draftStartIso.set(current.startIso);
    this.draftEndIso.set(current.endIso);
    this.draftStartHour.set(sh);
    this.draftStartMin.set(sm);
    this.draftEndHour.set(eh);
    this.draftEndMin.set(em);
    this.activePreset.set(null);
    this.openTimeMenu.set(null);
    const focusDate = parseIsoDate(current.startIso) ?? new Date();
    this.focusedIso.set(current.startIso ?? formatIsoDate(focusDate));
    this.viewMonth.set(startOfMonth(focusDate));
    this.place.set(this.measurePopover(ESTIMATED_WIDTH, ESTIMATED_HEIGHT));
    this.open.set(true);

    afterNextRender(
      () => {
        if (!this.open()) return;
        const el = this.popover()?.nativeElement;
        if (!el) return;
        this.place.set(this.measurePopover(el.offsetWidth || ESTIMATED_WIDTH, el.offsetHeight || ESTIMATED_HEIGHT));
        const targetIso = this.effectiveFocusedIso();
        const dayBtn =
          el.querySelector<HTMLButtonElement>(`button[data-iso="${targetIso}"]`) ??
          el.querySelector<HTMLButtonElement>('button[data-iso]');
        dayBtn?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected close(): void {
    this.openTimeMenu.set(null);
    this.open.set(false);
  }

  protected clearValue(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.value.set(emptyDateRange());
    this.close();
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.openTimeMenu()) {
      this.openTimeMenu.set(null);
      return;
    }
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected shiftMonth(delta: number): void {
    const current = this.viewMonth();
    this.viewMonth.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  protected choosePreset(id: PresetId): void {
    const { startIso, endIso } = presetDates(id, new Date());
    this.activePreset.set(id);
    this.draftStartIso.set(startIso);
    this.draftEndIso.set(endIso);
    this.draftStartHour.set('00');
    this.draftStartMin.set('00');
    this.draftEndHour.set('23');
    this.draftEndMin.set('59');
    this.openTimeMenu.set(null);
    const endMonth = parseIsoDate(endIso) ?? new Date();
    this.viewMonth.set(startOfMonth(endMonth));
  }

  protected selectDay(day: CalendarDay): void {
    this.activePreset.set(null);
    this.openTimeMenu.set(null);
    const start = this.draftStartIso();
    const end = this.draftEndIso();
    if (!start || (start && end)) {
      this.draftStartIso.set(day.iso);
      this.draftEndIso.set(null);
      return;
    }
    if (day.iso < start) {
      this.draftEndIso.set(start);
      this.draftStartIso.set(day.iso);
    } else {
      this.draftEndIso.set(day.iso);
    }
  }

  protected onDayKeydown(event: KeyboardEvent, day: CalendarDay): void {
    const base = parseIsoDate(day.iso);
    if (!base) return;

    const rtl = this.isRtl();
    let nextDate: Date | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextDate = addDays(base, rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        nextDate = addDays(base, rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        nextDate = addDays(base, 7);
        break;
      case 'ArrowUp':
        nextDate = addDays(base, -7);
        break;
      case 'Home':
        nextDate = addDays(base, -base.getDay());
        break;
      case 'End':
        nextDate = addDays(base, 6 - base.getDay());
        break;
      case 'PageUp': {
        const y = base.getFullYear();
        const m = base.getMonth() - 1;
        const maxDay = new Date(y, m + 1, 0).getDate();
        nextDate = new Date(y, m, Math.min(base.getDate(), maxDay));
        break;
      }
      case 'PageDown': {
        const y = base.getFullYear();
        const m = base.getMonth() + 1;
        const maxDay = new Date(y, m + 1, 0).getDate();
        nextDate = new Date(y, m, Math.min(base.getDate(), maxDay));
        break;
      }
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextIso = formatIsoDate(nextDate);
    this.focusedIso.set(nextIso);
    const currentView = this.viewMonth();
    if (nextDate.getFullYear() !== currentView.getFullYear() || nextDate.getMonth() !== currentView.getMonth()) {
      this.viewMonth.set(startOfMonth(nextDate));
    }
    afterNextRender(
      () => {
        if (!this.open()) return;
        this.popover()
          ?.nativeElement.querySelector<HTMLButtonElement>(`button[data-iso="${nextIso}"]`)
          ?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected toggleTimeMenu(menu: TimeDropdownId, buttonEl: HTMLElement): void {
    if (this.openTimeMenu() === menu) {
      this.openTimeMenu.set(null);
      return;
    }
    const maxListH = this.readCssPx('--time-list-max-h', 136);
    this.timeMenuPlace.set(this.measureTimeMenu(buttonEl, maxListH));
    this.openTimeMenu.set(menu);
    afterNextRender(
      () => {
        if (this.openTimeMenu() !== menu) return;
        const listEl = this.timeList()?.nativeElement;
        if (listEl) {
          this.timeMenuPlace.set(this.measureTimeMenu(buttonEl, listEl.offsetHeight || maxListH));
        }
      },
      { injector: this.injector },
    );
  }

  protected chooseTimeOption(val: string): void {
    this.activePreset.set(null);
    switch (this.openTimeMenu()) {
      case 'startHour':
        this.draftStartHour.set(val);
        break;
      case 'startMin':
        this.draftStartMin.set(val);
        break;
      case 'endHour':
        this.draftEndHour.set(val);
        break;
      case 'endMin':
        this.draftEndMin.set(val);
        break;
    }
    this.openTimeMenu.set(null);
  }

  protected applyRange(): void {
    const startIso = this.draftStartIso();
    if (!startIso) {
      this.value.set(emptyDateRange());
      this.close();
      return;
    }
    const endIso = this.draftEndIso() ?? startIso;
    let startTime = `${this.draftStartHour()}:${this.draftStartMin()}`;
    let endTime = `${this.draftEndHour()}:${this.draftEndMin()}`;
    if (startIso === endIso && startTime > endTime) {
      endTime = startTime;
    }
    const updatedFrom = combineIsoLocal(startIso, startTime, false);
    const updatedTo = combineIsoLocal(endIso, endTime, true);

    this.value.set({
      updatedFrom,
      updatedTo,
      startIso,
      endIso,
      startTime,
      endTime,
    });
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected dayMarkClasses(day: CalendarDay): string {
    if (day.isStart || day.isEnd) return 'bg-brand font-medium text-on-brand';
    const parts: string[] = [];
    if (day.isToday) parts.push('border border-brand');
    if (day.inRange) parts.push('text-on-brand-soft font-medium');
    else if (!day.inMonth) parts.push('text-text-placeholder');
    else parts.push('text-text');
    parts.push('hover:bg-row-hover');
    return parts.join(' ');
  }

  private isRtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }

  private measurePopover(width: number, height: number): Place {
    const rect = rectInPage(this.trigger().nativeElement);
    const vp = viewport();
    const rtl = this.isRtl();
    const triggerStart = rtl ? vp.width - rect.right : rect.left;
    const start = Math.min(Math.max(VIEWPORT_MARGIN, triggerStart), Math.max(VIEWPORT_MARGIN, vp.width - width - VIEWPORT_MARGIN));

    const spaceBelow = vp.height - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < height && spaceAbove >= spaceBelow;
    const rawTop = openAbove ? rect.top - POPOVER_GAP - height : rect.bottom + POPOVER_GAP;
    const top = Math.min(Math.max(VIEWPORT_MARGIN, rawTop), Math.max(VIEWPORT_MARGIN, vp.height - height - VIEWPORT_MARGIN));
    return { top, start };
  }

  private readCssPx(token: string, fallback: number): number {
    const raw = getComputedStyle(this.host.nativeElement).getPropertyValue(token).trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private measureTimeMenu(buttonEl: HTMLElement, listHeight: number): Place {
    const rect = rectInPage(buttonEl);
    const vp = viewport();
    const rtl = this.isRtl();
    const menuWidth = this.readCssPx('--time-dd-w', rect.width);
    const rawStart = rtl ? vp.width - rect.right : rect.left;
    const start = Math.min(Math.max(VIEWPORT_MARGIN, rawStart), Math.max(VIEWPORT_MARGIN, vp.width - menuWidth - VIEWPORT_MARGIN));
    const top = Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_GAP - listHeight);
    return { top, start };
  }
}
