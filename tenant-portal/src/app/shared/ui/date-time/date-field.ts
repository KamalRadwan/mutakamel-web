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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerChevronDown, tablerChevronLeft, tablerChevronRight } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../core/i18n/language';
import { Button } from '../button/button';
import { rectInPage, viewport } from '../overlay/zoom';

interface CalendarDay {
  iso: string;
  label: string;
  ariaLabel: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
}

interface Place {
  top: number;
  start: number;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const ESTIMATED_PICKER_WIDTH = 348;
const ESTIMATED_PICKER_HEIGHT = 296;
const GRID_CELL_COUNT = 42;
const REFERENCE_SUNDAY = new Date(2026, 0, 4);

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

function formatIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), maxDay));
}

@Component({
  selector: 'ui-date-field',
  imports: [NgIcon, Button],
  providers: [provideIcons({ tablerCalendar, tablerChevronDown, tablerChevronLeft, tablerChevronRight })],
  templateUrl: './date-field.html',
  host: {
    class: 'relative block w-full',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
  },
})
export class DateField {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState).current;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');

  readonly value = model<string | null>(null);
  readonly min = input<string | null>(null);
  readonly id = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly describedBy = input<string | null>(null);
  readonly placeholder = input('');
  readonly todayLabel = input('Today');
  readonly prevMonthLabel = input('Previous month');
  readonly nextMonthLabel = input('Next month');
  readonly invalid = input(false);
  readonly disabled = input(false);

  protected readonly open = signal(false);
  protected readonly viewMonth = signal<Date>(startOfMonth(new Date()));
  protected readonly focusedIso = signal<string>(formatIsoDate(new Date()));
  protected readonly place = signal<Place>({ top: 0, start: 0 });

  private readonly minIso = computed(() => {
    const parsed = parseIsoDate(this.min());
    return parsed ? formatIsoDate(parsed) : null;
  });

  protected readonly todayDisabled = computed(() => {
    const min = this.minIso();
    return Boolean(min && formatIsoDate(new Date()) < min);
  });

  protected readonly displayValue = computed(() => {
    const parsed = parseIsoDate(this.value());
    if (!parsed) return '';
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  });

  protected readonly boxClasses = computed(() => {
    if (this.invalid()) return 'border-danger-border ring-2 ring-danger-halo';
    if (this.open()) return 'border-focus-ring ring-3 ring-focus-halo-strong';
    return 'border-border-field hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo-strong';
  });

  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      month: 'long',
      year: 'numeric',
    }).format(this.viewMonth()),
  );

  protected readonly weekdays = computed(() => {
    const lang = this.language();
    const startDay = lang === 'ar' ? 6 : 1;
    const formatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, offset) => {
      const day = addDays(REFERENCE_SUNDAY, (startDay + offset) % 7);
      return formatter.format(day);
    });
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const lang = this.language();
    const monthDate = this.viewMonth();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const startDay = lang === 'ar' ? 6 : 1;
    const firstOffset = (monthDate.getDay() - startDay + 7) % 7;
    const gridStart = new Date(year, month, 1 - firstOffset);
    const todayIso = formatIsoDate(new Date());
    const selectedDate = parseIsoDate(this.value());
    const selectedIso = selectedDate ? formatIsoDate(selectedDate) : null;
    const minIso = this.minIso();
    const labelFormatter = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return Array.from({ length: GRID_CELL_COUNT }, (_, index) => {
      const date = addDays(gridStart, index);
      const iso = formatIsoDate(date);
      return {
        iso,
        label: String(date.getDate()),
        ariaLabel: labelFormatter.format(date),
        inMonth: date.getMonth() === month && date.getFullYear() === year,
        isToday: iso === todayIso,
        isSelected: iso === selectedIso,
        disabled: Boolean(minIso && iso < minIso),
      };
    });
  });

  protected readonly tabbableIso = computed(() => {
    const days = this.days();
    const focused = this.focusedIso();
    if (days.some((day) => day.iso === focused && !day.disabled)) return focused;
    const firstEnabled = days.find((day) => day.inMonth && !day.disabled) ?? days.find((day) => !day.disabled);
    return firstEnabled?.iso ?? null;
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

  protected toggle() {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.openPicker();
  }

  protected close() {
    this.open.set(false);
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected shiftMonth(delta: number) {
    const nextMonth = new Date(this.viewMonth().getFullYear(), this.viewMonth().getMonth() + delta, 1);
    this.viewMonth.set(nextMonth);
    const currentFocus = parseIsoDate(this.focusedIso()) ?? nextMonth;
    const shifted = addMonthsClamped(currentFocus, delta);
    this.focusedIso.set(this.clampToMinIso(formatIsoDate(shifted)));
  }

  protected selectDay(day: CalendarDay) {
    if (day.disabled) return;
    this.value.set(day.iso);
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected selectToday() {
    const todayIso = formatIsoDate(new Date());
    const min = this.minIso();
    if (min && todayIso < min) return;
    this.value.set(todayIso);
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected dayMarkClasses(day: CalendarDay): string {
    if (day.isSelected) return 'bg-brand font-medium text-on-brand';
    const parts: string[] = [];
    if (day.isToday) parts.push('border border-brand');
    if (day.disabled || !day.inMonth) parts.push('text-text-placeholder');
    else parts.push('text-text');
    if (!day.disabled) parts.push('hover:bg-row-hover');
    return parts.join(' ');
  }

  protected onTriggerKeydown(event: KeyboardEvent) {
    if (this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) this.openPicker();
      else this.focusGridCell(this.tabbableIso());
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  protected onPopoverKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.trigger().nativeElement.focus({ preventScroll: true });
      return;
    }

    const target = event.target as HTMLElement | null;
    const currentIso = target?.getAttribute('data-iso') || this.focusedIso();
    const currentDate = parseIsoDate(currentIso) ?? new Date();
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
        nextDate = addMonthsClamped(currentDate, -1);
        break;
      case 'PageDown':
        nextDate = addMonthsClamped(currentDate, 1);
        break;
      case 'Enter':
      case ' ':
        if (target?.hasAttribute('data-iso')) {
          event.preventDefault();
          const day = this.days().find((item) => item.iso === currentIso);
          if (day) this.selectDay(day);
        }
        return;
      default:
        return;
    }

    event.preventDefault();
    const min = this.minIso();
    const candidateIso = formatIsoDate(nextDate);
    if (min && candidateIso < min) return;
    this.focusedIso.set(candidateIso);
    this.viewMonth.set(startOfMonth(nextDate));
    afterNextRender(() => this.focusGridCell(candidateIso), { injector: this.injector });
  }

  private openPicker() {
    const initialDate = parseIsoDate(this.value()) ?? new Date();
    const initialIso = this.clampToMinIso(formatIsoDate(initialDate));
    const resolvedDate = parseIsoDate(initialIso) ?? initialDate;
    this.focusedIso.set(initialIso);
    this.viewMonth.set(startOfMonth(resolvedDate));
    this.place.set(this.measure(ESTIMATED_PICKER_WIDTH, ESTIMATED_PICKER_HEIGHT));
    this.open.set(true);

    afterNextRender(
      () => {
        if (!this.open()) return;
        const el = this.popover()?.nativeElement;
        if (el) {
          this.place.set(this.measure(el.offsetWidth || ESTIMATED_PICKER_WIDTH, el.offsetHeight || ESTIMATED_PICKER_HEIGHT));
        }
        this.focusGridCell(this.tabbableIso());
      },
      { injector: this.injector },
    );
  }

  private focusGridCell(iso: string | null) {
    if (!iso) return;
    const cell = this.popover()?.nativeElement.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`);
    cell?.focus({ preventScroll: true });
  }

  private clampToMinIso(iso: string): string {
    const min = this.minIso();
    return min && iso < min ? min : iso;
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
