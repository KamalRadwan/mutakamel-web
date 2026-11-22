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
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerRefresh,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import type { TradeContext } from '../../trade-api';
import { itemName, listUoms, uomById } from '../../trade-foundation.api';
import type { Uom } from '../../trade-foundation.model';
import { BADGE_CLASS, UOM_STATUS_TONE } from '../../trade-labels';

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const DEBOUNCE_MS = 250;

@Component({
  selector: 'app-trade-uom-picker',
  imports: [NgIcon, Button, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }),
    provideIcons({ tablerCheck, tablerChevronDown, tablerX, tablerLoader2, tablerRefresh }),
  ],
  templateUrl: './uom-picker.html',
  host: {
    class: 'relative block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu(true)',
  },
})
export class TradeUomPicker {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LanguageState);

  private readonly fieldBox = viewChild.required<ElementRef<HTMLElement>>('fieldBox');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly uid = `trade-uom-picker-${++TradeUomPicker.nextId}`;
  protected readonly listId = `${this.uid}-list`;
  protected readonly retiredBadgeClass = BADGE_CLASS[UOM_STATUS_TONE.RETIRED];

  private listSeq = 0;
  private fetchSeq = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private prevDescribedTokens: string[] = [];

  readonly value = model<string | null>(null);
  readonly includeRetired = input(false);
  /** Optional: limit the list to the units of this item (with `purpose`, uses the company in `context`). */
  readonly itemId = input<string | null>(null);
  readonly purpose = input<'ANY' | 'SALES' | 'PURCHASE' | undefined>(undefined);
  readonly context = input<TradeContext>({});
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);
  readonly disabled = input(false);

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly activeIndex = signal(0);

  private readonly editing = signal(false);
  private readonly query = signal('');
  private readonly debouncedQuery = signal('');
  private readonly allUoms = signal<Uom[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);

  protected readonly filteredUoms = computed<Uom[]>(() => {
    const includeRetired = this.includeRetired();
    const needle = this.debouncedQuery().trim().toLowerCase();

    return this.allUoms().filter((uom) => {
      if (!includeRetired && uom.status === 'RETIRED') return false;
      if (!needle) return true;
      if (uom.code.toLowerCase().includes(needle)) return true;
      if (uom.displayName.toLowerCase().includes(needle)) return true;
      return Object.values(uom.localizedNames).some((name) => name.toLowerCase().includes(needle));
    });
  });

  private readonly selectedUom = computed<Uom | null>(() => {
    const id = this.value();
    if (!id) return null;
    return this.allUoms().find((uom) => uom.id === id) ?? uomById(id) ?? null;
  });

  protected readonly selectedLabel = computed(() => {
    const uom = this.selectedUom();
    if (!uom) return '';
    // An input cannot hold <bdi>; U+2066 (LRI) ... U+2069 (PDI) isolate the code the same way.
    return `⁦${uom.code}⁩ — ${this.uomName(uom)}`;
  });

  protected readonly inputText = computed(() => (this.editing() ? this.query() : this.selectedLabel()));

  protected readonly safeActiveIndex = computed(() => {
    const count = this.filteredUoms().length;
    if (count === 0) return -1;
    const idx = this.activeIndex();
    return idx >= 0 && idx < count ? idx : 0;
  });

  protected readonly activeDescendantId = computed(() => {
    if (!this.open() || this.disabled() || this.loading() || this.loadError()) return null;
    const idx = this.safeActiveIndex();
    return idx >= 0 ? this.optionId(idx) : null;
  });

  protected readonly fieldBoxClasses = computed(() => {
    const base =
      'flex h-field w-full items-center gap-4 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.invalid()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.open()) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  });

  constructor() {
    effect(() => {
      this.itemId();
      this.purpose();
      this.context();
      untracked(() => void this.loadUoms());
    });

    // Merge external describedBy tokens without overwriting ui-field's <id>-hint / <id>-error.
    effect(() => {
      const input = this.inputEl()?.nativeElement;
      const incoming = (this.describedBy() ?? '').split(/\s+/).filter(Boolean);
      if (!input) return;

      const prevSet = new Set(this.prevDescribedTokens);
      const existing = (input.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((token) => Boolean(token) && !prevSet.has(token));

      const merged = [...existing];
      for (const token of incoming) {
        if (!merged.includes(token)) merged.push(token);
      }

      this.prevDescribedTokens = incoming;
      const next = merged.join(' ');
      const current = input.getAttribute('aria-describedby') ?? '';
      if (next === current) return;
      if (next) {
        input.setAttribute('aria-describedby', next);
      } else {
        input.removeAttribute('aria-describedby');
      }
    });

    effect(() => {
      const isOpen = this.open();
      this.loading();
      this.loadError();
      this.filteredUoms();
      if (isOpen) {
        untracked(() => this.schedulePlace());
      }
    });

    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeMenu(true);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    this.destroyRef.onDestroy(() => {
      this.clearDebounce();
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  protected optionId(index: number): string {
    return `${this.uid}-opt-${index}`;
  }

  protected uomName(uom: Uom): string {
    return itemName(uom, this.lang.current()) || uom.displayName;
  }

  protected rowClasses(uom: Uom, index: number): string {
    const selected = this.value() === uom.id;
    const active = this.safeActiveIndex() === index;
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active ? 'cursor-pointer bg-row-hover text-text' : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected onBoxClick(): void {
    if (this.disabled()) return;
    this.inputEl()?.nativeElement.focus();
    this.openMenu();
  }

  protected onInput(event: Event): void {
    if (this.disabled()) return;
    const text = (event.target as HTMLInputElement).value;
    this.editing.set(true);
    this.query.set(text);
    this.activeIndex.set(0);
    if (!this.open()) {
      this.openMenu();
    }
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.debouncedQuery.set(text);
    }, DEBOUNCE_MS);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.open()) {
          this.activeIndex.set(0);
          this.openMenu();
          return;
        }
        const count = this.filteredUoms().length;
        if (count > 0) {
          const next = (this.safeActiveIndex() + 1) % count;
          this.activeIndex.set(next);
          this.scrollOptionIntoView(next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.activeIndex.set(0);
          this.openMenu();
          return;
        }
        const count = this.filteredUoms().length;
        if (count > 0) {
          const prev = (this.safeActiveIndex() - 1 + count) % count;
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(prev);
        }
        break;
      }
      case 'Enter': {
        if (!this.open()) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.loadError()) {
          this.retry();
          return;
        }
        const uoms = this.filteredUoms();
        const idx = this.safeActiveIndex();
        if (idx >= 0 && idx < uoms.length) {
          this.choose(uoms[idx]);
        }
        break;
      }
      case 'Escape': {
        if (!this.open()) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeMenu(true);
        break;
      }
      case 'Tab': {
        this.closeMenu(true);
        break;
      }
    }
  }

  protected choose(uom: Uom): void {
    if (this.disabled()) return;
    this.value.set(uom.id);
    this.closeMenu(true);
    this.inputEl()?.nativeElement.focus();
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.clearDebounce();
    this.value.set(null);
    this.editing.set(false);
    this.query.set('');
    this.debouncedQuery.set('');
    const input = this.inputEl()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  protected retry(): void {
    void this.loadUoms();
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu(true);
    }
  }

  protected closeMenu(restore: boolean): void {
    this.clearDebounce();
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
    if (restore) {
      this.editing.set(false);
      this.query.set('');
      this.debouncedQuery.set('');
      const input = this.inputEl()?.nativeElement;
      if (input) {
        input.value = this.selectedLabel();
      }
    }
  }

  private openMenu(): void {
    if (this.open() || this.disabled()) return;
    if (this.loadError()) {
      void this.loadUoms();
    }
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    this.schedulePlace();
  }

  private async loadUoms(): Promise<void> {
    const seq = ++this.fetchSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const itemId = this.itemId();
      const list = itemId
        ? await listUoms({ itemId, purpose: this.purpose() }, this.context())
        : await listUoms();
      if (seq !== this.fetchSeq) return;
      this.allUoms.set(list);
    } catch {
      if (seq !== this.fetchSeq) return;
      this.allUoms.set([]);
      this.loadError.set(true);
    } finally {
      if (seq === this.fetchSeq) {
        this.loading.set(false);
      }
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scrollOptionIntoView(index: number): void {
    document.getElementById(this.optionId(index))?.scrollIntoView({ block: 'nearest' });
  }

  private schedulePlace(): void {
    const seq = ++this.listSeq;
    queueMicrotask(() => this.placeList(seq));
    afterNextRender(() => this.placeList(seq), { injector: this.injector });
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.fieldBox().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeList(seq: number): void {
    if (seq !== this.listSeq || !this.open()) return;
    const listEl = this.listRef()?.nativeElement;
    if (!listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(this.fieldBox().nativeElement);
    const listRect = rectInPage(listEl);
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
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.place.set({ top, start, width: rect.width, maxHeight });
    this.placed.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
