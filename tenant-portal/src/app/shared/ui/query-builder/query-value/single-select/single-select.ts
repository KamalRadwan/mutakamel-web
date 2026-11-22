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
import { tablerCheck, tablerChevronDown, tablerLoader2, tablerSearch } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { FieldOption, QueryField, getCachedFieldOption, rememberFieldOptions } from '../../../../query-builder/query.model';
import { rectInPage, viewport } from '../../../overlay/zoom';
import { isHexColor, isIconUrl } from '../tag-color';

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const SEARCH_THRESHOLD = 8;
const REMOTE_DEBOUNCE_MS = 250;

@Component({
  selector: 'ui-query-single-select',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerLoader2, tablerSearch })],
  templateUrl: './single-select.html',
  host: {
    class: 'relative block w-full min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class QuerySingleSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchEl');

  readonly field = input.required<QueryField>();
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);
  readonly value = model<string | null>(null);

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly searchTerm = signal('');
  protected readonly remoteLoading = signal(false);
  protected readonly remoteOptions = signal<FieldOption[]>([]);
  private readonly cachedOptions = signal<Record<string, FieldOption>>({});

  protected readonly isHexColor = isHexColor;
  protected readonly isIconUrl = isIconUrl;

  private listSeq = 0;
  private remoteSeq = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly showSearch = computed(() => {
    const f = this.field();
    if (f.searchOptions) return true;
    return (f.options?.length ?? 0) + (f.specialOptions?.length ?? 0) > SEARCH_THRESHOLD;
  });

  protected readonly visibleSpecials = computed<FieldOption[]>(() => {
    const specials = this.field().specialOptions ?? [];
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return specials;
    return specials.filter((opt) => opt.label.toLowerCase().includes(term));
  });

  protected readonly visibleRegulars = computed<FieldOption[]>(() => {
    const f = this.field();
    const specialValues = new Set((f.specialOptions ?? []).map((opt) => opt.value));
    const source = f.searchOptions ? this.remoteOptions() : (f.options ?? []);
    const deduped = source.filter((opt) => !specialValues.has(opt.value));
    if (f.searchOptions) return deduped;
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return deduped;
    return deduped.filter((opt) => opt.label.toLowerCase().includes(term));
  });

  protected readonly showDivider = computed(
    () => this.visibleSpecials().length > 0 && this.visibleRegulars().length > 0,
  );

  protected readonly selectedOption = computed<FieldOption | null>(() => {
    const val = this.value();
    if (val === null || val === undefined || val === '') return null;
    const f = this.field();
    return (
      f.specialOptions?.find((opt) => opt.value === val) ??
      f.options?.find((opt) => opt.value === val) ??
      this.remoteOptions().find((opt) => opt.value === val) ??
      this.cachedOptions()[val] ??
      getCachedFieldOption(f.id, val) ??
      null
    );
  });

  protected readonly triggerClasses = computed(() => {
    const base =
      'flex h-field w-full items-center justify-between gap-6 rounded-8 border px-8 text-12 outline-none transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder`;
    }
    if (this.invalid()) {
      return `${base} cursor-pointer border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.open()) {
      return `${base} cursor-pointer border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo-strong`;
    }
    return `${base} cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo-strong`;
  });

  constructor() {
    effect(() => {
      const f = this.field();
      this.rememberOptions(f.specialOptions ?? []);
      this.rememberOptions(f.options ?? []);
    });

    effect(() => {
      this.visibleSpecials();
      this.visibleRegulars();
      this.remoteLoading();
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
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.clearDebounce();
      this.remoteSeq++;
    });
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.openList();
  }

  protected close(): void {
    this.listSeq++;
    this.clearDebounce();
    this.open.set(false);
    this.placed.set(false);
    this.searchTerm.set('');
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

  protected onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    if (!this.field().searchOptions) return;

    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.fetchRemote(term);
    }, REMOTE_DEBOUNCE_MS);
  }

  protected choose(option: FieldOption): void {
    this.rememberOptions([option]);
    this.value.set(option.value);
    this.close();
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  private openList(): void {
    const seq = ++this.listSeq;
    this.searchTerm.set('');
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);

    if (this.field().searchOptions) {
      void this.fetchRemote('');
    }

    queueMicrotask(() => this.placeList(seq, false));
    afterNextRender(
      () => {
        this.placeList(seq, false);
        if (this.showSearch()) {
          this.searchInput()?.nativeElement.focus({ preventScroll: true });
        }
      },
      { injector: this.injector },
    );
  }

  private async fetchRemote(term: string): Promise<void> {
    const searchFn = this.field().searchOptions;
    if (!searchFn) return;
    const seq = ++this.remoteSeq;
    this.remoteLoading.set(true);
    try {
      const results = await searchFn(term);
      if (seq !== this.remoteSeq) return;
      this.remoteOptions.set(results);
      this.rememberOptions(results);
    } catch {
      if (seq !== this.remoteSeq) return;
      this.remoteOptions.set([]);
    } finally {
      if (seq === this.remoteSeq) {
        this.remoteLoading.set(false);
      }
    }
  }

  private rememberOptions(options: FieldOption[]): void {
    if (!options.length) return;
    rememberFieldOptions(this.field().id, options);
    this.cachedOptions.update((prev) => {
      const next = { ...prev };
      for (const opt of options) {
        next[opt.value] = opt;
      }
      return next;
    });
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
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
