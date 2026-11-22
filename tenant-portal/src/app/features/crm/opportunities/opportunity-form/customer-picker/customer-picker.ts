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
  tablerBan,
  tablerBuilding,
  tablerCheck,
  tablerCircleX,
  tablerLoader2,
  tablerUser,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  SuggestionMenuPlace,
  computeSuggestionPlace,
  initialSuggestionPlace,
} from '../../../../../shared/ui/suggest-input/suggestions';
import { searchCustomerOptions } from '../../opportunities.api';
import type { CustomerOption } from '../../opportunities.model';

const SEARCH_DEBOUNCE_MS = 250;
const MAX_RESULTS = 20;

@Component({
  selector: 'app-opportunity-customer-picker',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-form', alias: 'oppForm' }),
  ],
  providers: [
    provideIcons({
      tablerBan,
      tablerBuilding,
      tablerCheck,
      tablerCircleX,
      tablerLoader2,
      tablerUser,
      tablerX,
    }),
  ],
  templateUrl: './customer-picker.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class CustomerPicker {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly fieldBox = viewChild<ElementRef<HTMLElement>>('fieldBox');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('listRef');

  readonly value = model<CustomerOption | null>(null);
  readonly branchId = input<string | null>(null);
  readonly inputId = input.required<string>();
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly placeholder = input('');
  readonly label = input('');
  readonly displayText = input('');

  protected readonly query = signal('');
  protected readonly menuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<SuggestionMenuPlace>({
    top: 0,
    start: 0,
    width: 0,
    maxHeight: null,
  });
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly results = signal<CustomerOption[]>([]);
  protected readonly activeIndex = signal(-1);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;
  private listSeq = 0;
  private lastExternalText = '';
  private prevExtraTokens: string[] = [];

  protected readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  protected readonly trimmedQuery = computed(() => this.query().trim());
  protected readonly canSearch = computed(
    () => !this.disabled() && this.trimmedQuery().length >= 1,
  );
  protected readonly dropdownVisible = computed(
    () => this.menuOpen() && !this.disabled() && this.canSearch(),
  );

  protected readonly activeDescendant = computed(() => {
    if (!this.dropdownVisible() || this.loading() || this.loadError()) return null;
    const items = this.results();
    const idx = this.activeIndex();
    if (idx < 0 || idx >= items.length || items[idx].status === 'BLACKLISTED') return null;
    return this.optionId(idx);
  });

  protected readonly boxClasses = computed(() => {
    const base =
      'flex h-field items-center gap-6 rounded-8 border bg-surface-field px-8 text-12 text-text transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} border-border-field`;
    }
    if (this.invalid()) {
      return `${base} border-danger-border ring-2 ring-danger-halo`;
    }
    if (this.menuOpen()) {
      return `${base} border-focus-ring ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  });

  constructor() {
    effect(() => {
      const externalText = this.value()?.displayName ?? this.displayText();
      if (externalText === this.lastExternalText) return;
      this.lastExternalText = externalText;
      this.query.set(externalText);
    });

    effect(() => {
      const el = this.inputEl()?.nativeElement;
      const raw = this.describedBy();
      if (!el) return;
      const nextExtra = (raw ?? '')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      const stale = new Set(this.prevExtraTokens);
      const existing = (el.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((token) => Boolean(token) && !stale.has(token));
      const merged = Array.from(new Set([...existing, ...nextExtra]));
      const nextAttr = merged.join(' ');
      const currentAttr = el.getAttribute('aria-describedby') ?? '';
      if (nextAttr !== currentAttr) {
        if (nextAttr) {
          el.setAttribute('aria-describedby', nextAttr);
        } else {
          el.removeAttribute('aria-describedby');
        }
      }
      this.prevExtraTokens = nextExtra;
    });

    const onScroll = (event: Event) => {
      if (!this.menuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.listRef()?.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.clearDebounce();
    });
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  protected isBlacklisted(option: CustomerOption): boolean {
    return option.status === 'BLACKLISTED';
  }

  protected optionRowClasses(option: CustomerOption, index: number): string {
    if (this.isBlacklisted(option)) {
      return 'cursor-not-allowed text-text-placeholder opacity-drag-source';
    }
    const selected = this.value()?.id === option.id;
    const active = index === this.activeIndex();
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active
      ? 'cursor-pointer bg-row-hover text-text'
      : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected onFocus(): void {
    if (this.disabled() || !this.canSearch()) return;
    this.openMenu();
    if (this.results().length === 0 && !this.loading()) {
      this.scheduleSearch(this.trimmedQuery());
    }
  }

  protected onInput(event: Event): void {
    if (this.disabled()) return;
    const next = (event.target as HTMLInputElement).value;
    if (this.value() !== null && next.trim() !== this.value()!.displayName.trim()) {
      this.lastExternalText = '';
      this.value.set(null);
    }
    this.query.set(next);
    this.activeIndex.set(-1);
    this.loadError.set(false);

    const q = next.trim();
    if (!q) {
      this.clearDebounce();
      this.searchSeq++;
      this.loading.set(false);
      this.results.set([]);
      this.closeMenu();
      return;
    }

    this.openMenu();
    this.scheduleSearch(q);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const items = this.results();

    switch (event.key) {
      case 'ArrowDown': {
        if (!this.canSearch()) return;
        event.preventDefault();
        if (!this.menuOpen()) {
          this.openMenu();
          if (items.length === 0 && !this.loading()) {
            this.scheduleSearch(this.trimmedQuery());
          }
        }
        const nextIdx = this.findNextEnabledIndex(this.activeIndex(), 1);
        if (nextIdx >= 0) {
          this.activeIndex.set(nextIdx);
          this.scrollIntoView(nextIdx);
        }
        break;
      }
      case 'ArrowUp': {
        if (!this.canSearch()) return;
        event.preventDefault();
        if (!this.menuOpen()) {
          this.openMenu();
          if (items.length === 0 && !this.loading()) {
            this.scheduleSearch(this.trimmedQuery());
          }
        }
        const prevIdx = this.findNextEnabledIndex(this.activeIndex(), -1);
        if (prevIdx >= 0) {
          this.activeIndex.set(prevIdx);
          this.scrollIntoView(prevIdx);
        }
        break;
      }
      case 'Home': {
        if (!this.dropdownVisible() || items.length === 0) return;
        const firstIdx = this.findNextEnabledIndex(-1, 1);
        if (firstIdx >= 0) {
          event.preventDefault();
          this.activeIndex.set(firstIdx);
          this.scrollIntoView(firstIdx);
        }
        break;
      }
      case 'End': {
        if (!this.dropdownVisible() || items.length === 0) return;
        const lastIdx = this.findNextEnabledIndex(items.length, -1);
        if (lastIdx >= 0) {
          event.preventDefault();
          this.activeIndex.set(lastIdx);
          this.scrollIntoView(lastIdx);
        }
        break;
      }
      case 'Enter': {
        if (!this.dropdownVisible() || this.loading() || this.loadError()) return;
        event.preventDefault();
        event.stopPropagation();
        const idx = this.activeIndex();
        const chosen = idx >= 0 && idx < items.length ? items[idx] : undefined;
        if (chosen && !this.isBlacklisted(chosen)) {
          this.selectOption(chosen);
        }
        break;
      }
      case 'Escape': {
        if (!this.menuOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeMenu();
        break;
      }
      case 'Tab': {
        if (this.menuOpen()) {
          this.closeMenu();
        }
        break;
      }
    }
  }

  protected selectOption(option: CustomerOption): void {
    if (this.disabled() || this.isBlacklisted(option)) return;
    this.lastExternalText = option.displayName;
    this.query.set(option.displayName);
    this.value.set(option);
    this.closeMenu();
    this.inputEl()?.nativeElement.focus();
  }

  protected clearSelection(): void {
    if (this.disabled()) return;
    this.clearDebounce();
    this.searchSeq++;
    this.lastExternalText = '';
    this.query.set('');
    this.results.set([]);
    this.loading.set(false);
    this.loadError.set(false);
    this.value.set(null);
    this.closeMenu();
    this.inputEl()?.nativeElement.focus();
  }

  protected closeIfOutside(event: Event): void {
    if (!this.menuOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeMenu();
      return;
    }
    const anchor = this.anchorElement();
    const listEl = this.listRef()?.nativeElement;
    if (anchor?.contains(target) || listEl?.contains(target)) return;
    this.closeMenu();
  }

  protected closeMenu(): void {
    this.listSeq++;
    this.menuOpen.set(false);
    this.menuPlaced.set(false);
    this.activeIndex.set(-1);
  }

  private openMenu(): void {
    if (this.disabled() || !this.canSearch()) return;
    if (!this.menuOpen()) {
      const anchor = this.anchorElement();
      if (!anchor) return;
      this.menuPlaced.set(false);
      this.menuPlace.set(initialSuggestionPlace(anchor, this.host.nativeElement));
      this.menuOpen.set(true);
    }
    this.schedulePlace();
  }

  private scheduleSearch(q: string): void {
    this.clearDebounce();
    const seq = ++this.searchSeq;
    this.loading.set(true);
    this.loadError.set(false);
    this.schedulePlace();

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      const branchId = this.branchId() ?? '';
      void searchCustomerOptions(branchId, q)
        .then((items) => {
          if (seq !== this.searchSeq) return;
          const sliced = items.slice(0, MAX_RESULTS);
          this.results.set(sliced);
          this.loadError.set(false);
          const firstValid = sliced.findIndex((item) => !this.isBlacklisted(item));
          this.activeIndex.set(firstValid);
          this.schedulePlace();
        })
        .catch(() => {
          if (seq !== this.searchSeq) return;
          this.results.set([]);
          this.loadError.set(true);
          this.activeIndex.set(-1);
          this.schedulePlace();
        })
        .finally(() => {
          if (seq === this.searchSeq) {
            this.loading.set(false);
            this.schedulePlace();
          }
        });
    }, SEARCH_DEBOUNCE_MS);
  }

  private clearDebounce(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private findNextEnabledIndex(fromIndex: number, step: 1 | -1): number {
    const items = this.results();
    if (items.length === 0) return -1;
    let cursor = fromIndex;
    for (let i = 0; i < items.length; i++) {
      cursor =
        step === 1
          ? cursor < 0 || cursor >= items.length - 1
            ? 0
            : cursor + 1
          : cursor <= 0 || cursor > items.length - 1
            ? items.length - 1
            : cursor - 1;
      if (!this.isBlacklisted(items[cursor])) {
        return cursor;
      }
    }
    return -1;
  }

  private anchorElement(): HTMLElement | undefined {
    return this.fieldBox()?.nativeElement ?? this.inputEl()?.nativeElement;
  }

  private schedulePlace(): void {
    if (!this.menuOpen()) return;
    const seq = ++this.listSeq;
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  private placeMenu(seq: number): void {
    if (seq !== this.listSeq || !this.menuOpen()) return;
    const anchor = this.anchorElement();
    const listEl = this.listRef()?.nativeElement;
    if (!anchor || !listEl) return;
    const placed = computeSuggestionPlace(anchor, listEl, this.host.nativeElement);
    this.menuPlace.set(placed);
    this.menuPlaced.set(true);
  }

  private scrollIntoView(index: number): void {
    document.getElementById(this.optionId(index))?.scrollIntoView({ block: 'nearest' });
  }
}
