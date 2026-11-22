import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerCheck,
  tablerChevronDown,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: string;
  tile?: string;
  dot?: string;
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const MAX_VISIBLE_CHIPS = 2;

@Component({
  selector: 'app-activities-multi-select',
  imports: [NgIcon],
  providers: [
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerX,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './activities-multi-select.html',
  host: {
    class: 'relative block w-full min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class ActivitiesMultiSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('popover');

  readonly options = input.required<readonly MultiSelectOption[]>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly selectAllLabel = input('');
  readonly clearAllLabel = input('');
  readonly removeItemLabel = input('');
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);
  readonly values = model<string[]>([]);

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private listSeq = 0;

  protected readonly selectedSet = computed(() => new Set(this.values()));

  protected readonly selectedItems = computed<MultiSelectOption[]>(() => {
    const opts = this.options();
    return this.values().map((val) => opts.find((opt) => opt.value === val) ?? { value: val, label: val });
  });

  protected readonly visibleChips = computed(() => this.selectedItems().slice(0, MAX_VISIBLE_CHIPS));
  protected readonly overflowCount = computed(() => Math.max(0, this.selectedItems().length - MAX_VISIBLE_CHIPS));

  protected readonly allSelected = computed(() => {
    const opts = this.options();
    if (opts.length === 0) return false;
    const selected = this.selectedSet();
    return opts.every((opt) => selected.has(opt.value));
  });

  protected readonly triggerClasses = computed(() => {
    const base =
      'flex min-h-field w-full items-center gap-4 rounded-8 border ps-6 pe-8 py-0 text-12 outline-none transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder`;
    }
    if (this.open()) {
      return `${base} cursor-pointer border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo`;
  });

  constructor() {
    effect(() => {
      this.options();
      if (!this.open() || !this.placed()) return;
      const seq = this.listSeq;
      afterNextRender(() => this.placeList(seq, true), { injector: this.injector });
    });

    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.openList();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) this.openList();
    }
  }

  protected close(): void {
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected toggleOption(option: MultiSelectOption): void {
    if (this.disabled()) return;
    const current = this.values();
    if (current.includes(option.value)) {
      this.values.set(current.filter((item) => item !== option.value));
    } else {
      this.values.set([...current, option.value]);
    }
  }

  protected removeValue(val: string): void {
    if (this.disabled()) return;
    this.values.set(this.values().filter((item) => item !== val));
  }

  protected selectAll(): void {
    if (this.disabled()) return;
    this.values.set(this.options().map((opt) => opt.value));
  }

  protected clearAll(): void {
    if (this.disabled()) return;
    this.values.set([]);
  }

  private openList(): void {
    const seq = ++this.listSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placeList(seq, false));
    afterNextRender(() => this.placeList(seq, false), { injector: this.injector });
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeList(seq: number, forceReposition: boolean): void {
    if (seq !== this.listSeq || !this.open() || (!forceReposition && this.placed())) return;
    const listEl = this.listRef()?.nativeElement;
    if (!listEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const prevMax = listEl.style.maxHeight;
    listEl.style.maxHeight = '';
    const listRect = rectInPage(listEl);
    listEl.style.maxHeight = prevMax;

    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const listWidth = Math.max(rect.width, listRect.width);
    const alignEnd = triggerStart + listWidth > width - 8;
    const rawStart = alignEnd ? triggerEnd - listWidth : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listWidth));

    this.place.set({ top, start, width: rect.width, maxHeight });
    this.placed.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
