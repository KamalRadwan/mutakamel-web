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
  viewChildren,
} from '@angular/core';
import { rectInPage, viewport } from '../overlay/zoom';

type TimePart = 'hour' | 'minute';

interface Place {
  top: number;
  start: number;
  rtl: boolean;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const ESTIMATED_LIST_HEIGHT = 136;
const TYPE_BUFFER_TIMEOUT_MS = 500;

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function parseTime24(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

@Component({
  selector: 'ui-time-field',
  templateUrl: './time-field.html',
  host: {
    class: 'relative inline-flex items-center gap-4',
    dir: 'ltr',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
  },
})
export class TimeField {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly hourBtn = viewChild.required<ElementRef<HTMLButtonElement>>('hourBtn');
  private readonly minuteBtn = viewChild.required<ElementRef<HTMLButtonElement>>('minuteBtn');
  private readonly listEl = viewChild<ElementRef<HTMLElement>>('listEl');
  private readonly optionEls = viewChildren<ElementRef<HTMLButtonElement>>('optionEl');

  readonly value = model<string | null>(null);
  readonly id = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly describedBy = input<string | null>(null);
  readonly placeholder = input('');
  readonly hourLabel = input('Hour');
  readonly minuteLabel = input('Minutes');
  readonly invalid = input(false);
  readonly disabled = input(false);

  protected readonly openPart = signal<TimePart | null>(null);
  protected readonly focusedPart = signal<TimePart | null>(null);
  protected readonly activeIndex = signal(0);
  protected readonly place = signal<Place>({ top: 0, start: 0, rtl: false });

  private typeBuffer = '';
  private typeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly parsed = computed(() => parseTime24(this.value()));

  protected readonly hourText = computed(() => String(this.parsed()?.hours ?? 0).padStart(2, '0'));
  protected readonly minuteText = computed(() => String(this.parsed()?.minutes ?? 0).padStart(2, '0'));

  protected readonly hourAriaLabel = computed(() => {
    const base = this.ariaLabel().trim();
    return base ? `${base} ${this.hourLabel()}` : this.hourLabel();
  });

  protected readonly minuteAriaLabel = computed(() => {
    const base = this.ariaLabel().trim();
    return base ? `${base} ${this.minuteLabel()}` : this.minuteLabel();
  });

  protected readonly activeOptions = computed(() => (this.openPart() === 'minute' ? MINUTES : HOURS));

  protected readonly selectedIndex = computed(() => {
    const part = this.openPart();
    if (!part) return -1;
    const parsed = this.parsed();
    if (!parsed) return -1;
    return part === 'hour' ? parsed.hours : parsed.minutes;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const onScroll = (event: Event) => {
      if (!this.openPart()) return;
      const target = event.target as Node | null;
      if (target && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.resetTypeBuffer();
    });
  }

  protected buttonClasses(part: TimePart): string {
    if (this.disabled()) return 'cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder';
    if (this.invalid()) return 'cursor-pointer border-danger-border bg-surface-field text-text ring-2 ring-danger-halo';
    if (this.openPart() === part || this.focusedPart() === part) {
      return 'cursor-pointer border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo-strong';
    }
    return 'cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover';
  }

  protected togglePart(part: TimePart) {
    if (this.disabled()) return;
    if (this.openPart() === part) {
      this.close();
      return;
    }
    this.openList(part);
  }

  protected onFocus(part: TimePart) {
    if (this.disabled()) return;
    this.focusedPart.set(part);
  }

  protected onBlur(part: TimePart, event: FocusEvent) {
    if (this.focusedPart() === part) this.focusedPart.set(null);
    const related = event.relatedTarget as Node | null;
    const list = this.listEl()?.nativeElement;
    if (list && related && list.contains(related)) return;
    if (this.openPart() === part) this.close();
  }

  protected onKeydown(part: TimePart, event: KeyboardEvent) {
    if (this.disabled()) return;
    const isOpen = this.openPart() === part;
    const options = this.activeOptions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          this.openList(part);
        } else {
          const next = Math.min(this.activeIndex() + 1, options.length - 1);
          this.activeIndex.set(next);
          this.scrollOptionIntoView(next, false);
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          this.openList(part);
        } else {
          const prev = Math.max(this.activeIndex() - 1, 0);
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(prev, false);
        }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          this.openList(part);
        } else {
          this.choosePart(part, this.activeIndex());
        }
        return;
      case 'Escape':
        if (this.openPart()) {
          event.preventDefault();
          event.stopPropagation();
          this.close();
          this.buttonEl(part).focus({ preventScroll: true });
        }
        return;
      case 'Tab':
        this.close();
        return;
    }

    if (/^[0-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.handleDigitKey(part, event.key);
    }
  }

  protected choosePart(part: TimePart, index: number) {
    const current = this.parsed();
    const hours = part === 'hour' ? index : (current?.hours ?? 0);
    const minutes = part === 'minute' ? index : (current?.minutes ?? 0);
    this.value.set(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    this.close();
    this.buttonEl(part).focus({ preventScroll: true });
  }

  protected close() {
    this.openPart.set(null);
    this.resetTypeBuffer();
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private buttonEl(part: TimePart): HTMLButtonElement {
    return (part === 'minute' ? this.minuteBtn() : this.hourBtn()).nativeElement;
  }

  private initialActiveIndex(part: TimePart): number {
    const parsed = this.parsed();
    if (parsed) {
      return part === 'hour' ? parsed.hours : parsed.minutes;
    }
    const now = new Date();
    return part === 'hour' ? now.getHours() : now.getMinutes();
  }

  private openList(part: TimePart, initialIndex?: number) {
    if (initialIndex === undefined) this.resetTypeBuffer();
    const index = initialIndex ?? this.initialActiveIndex(part);
    this.activeIndex.set(index);
    const trigger = this.buttonEl(part);
    const rect = rectInPage(trigger);
    this.place.set(this.measure(trigger, rect.width, ESTIMATED_LIST_HEIGHT));
    this.openPart.set(part);

    afterNextRender(
      () => {
        if (this.openPart() !== part) return;
        const list = this.listEl()?.nativeElement;
        if (list) {
          this.place.set(this.measure(trigger, list.offsetWidth || rect.width, list.offsetHeight || ESTIMATED_LIST_HEIGHT));
        }
        this.scrollOptionIntoView(this.activeIndex(), true);
      },
      { injector: this.injector },
    );
  }

  private handleDigitKey(part: TimePart, digit: string) {
    const max = part === 'hour' ? 23 : 59;
    const combined = this.typeBuffer.length < 2 ? Number(`${this.typeBuffer}${digit}`) : Number.NaN;
    if (this.typeBuffer && !Number.isNaN(combined) && combined <= max) {
      this.typeBuffer = `${this.typeBuffer}${digit}`;
    } else {
      this.typeBuffer = digit;
    }
    this.scheduleTypeBufferReset();

    const target = Number(this.typeBuffer);
    if (this.openPart() !== part) {
      this.openList(part, target);
    } else {
      this.activeIndex.set(target);
      this.scrollOptionIntoView(target, false);
    }
  }

  private scheduleTypeBufferReset() {
    if (this.typeTimer !== null) clearTimeout(this.typeTimer);
    this.typeTimer = setTimeout(() => {
      this.typeBuffer = '';
      this.typeTimer = null;
    }, TYPE_BUFFER_TIMEOUT_MS);
  }

  private resetTypeBuffer() {
    this.typeBuffer = '';
    if (this.typeTimer !== null) {
      clearTimeout(this.typeTimer);
      this.typeTimer = null;
    }
  }

  private scrollOptionIntoView(index: number, center: boolean) {
    const list = this.listEl()?.nativeElement;
    const row = this.optionEls()[index]?.nativeElement;
    if (!list || !row) return;
    if (center) {
      list.scrollTop = Math.max(0, row.offsetTop - (list.clientHeight - row.offsetHeight) / 2);
      return;
    }
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    if (rowTop < list.scrollTop) {
      list.scrollTop = rowTop - 4;
    } else if (rowBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = rowBottom - list.clientHeight + 4;
    }
  }

  private measure(trigger: HTMLElement, width: number, height: number): Place {
    const rect = rectInPage(trigger);
    const vp = viewport();
    const effectiveWidth = Math.max(width, rect.width);
    // The host is dir=ltr; anchor the popover to the page direction instead.
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const rawStart = rtl ? vp.width - rect.right : rect.left;
    const maxStart = Math.max(VIEWPORT_MARGIN, vp.width - effectiveWidth - VIEWPORT_MARGIN);
    const start = Math.min(Math.max(VIEWPORT_MARGIN, rawStart), maxStart);

    const spaceBelow = vp.height - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < height && spaceAbove >= spaceBelow;
    const rawTop = openAbove ? rect.top - POPOVER_GAP - height : rect.bottom + POPOVER_GAP;
    const maxTop = Math.max(VIEWPORT_MARGIN, vp.height - height - VIEWPORT_MARGIN);
    const top = Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop);

    return { top, start, rtl };
  }
}
