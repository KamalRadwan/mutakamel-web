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
import { tablerCheck } from '@ng-icons/tabler-icons';
import {
  SuggestionMenuPlace,
  computeSuggestionPlace,
  filterSuggestions,
  initialSuggestionPlace,
} from './suggestions';

/** Free-text combobox with a positioned suggestion listbox. */
@Component({
  selector: 'ui-suggest-input',
  imports: [NgIcon],
  providers: [provideIcons({ tablerCheck })],
  templateUrl: './suggest-input.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class SuggestInput {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly fieldBox = viewChild<ElementRef<HTMLElement>>('fieldBox');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('listRef');

  readonly value = model('');
  readonly options = input.required<readonly string[]>();
  readonly maxLength = input.required<number>();
  readonly inputId = input.required<string>();
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);
  readonly readonly = input(false);
  readonly placeholder = input('');
  readonly label = input('');

  protected readonly menuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<SuggestionMenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly activeIndex = signal(-1);
  private listSeq = 0;
  private prevExtraTokens: string[] = [];

  protected readonly filtered = computed(() => filterSuggestions(this.options(), this.value()));
  protected readonly dropdownVisible = computed(
    () => this.menuOpen() && !this.readonly() && this.filtered().length > 0,
  );
  protected readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  protected readonly activeDescendant = computed(() => {
    if (!this.dropdownVisible()) return null;
    const idx = this.activeIndex();
    return idx >= 0 && idx < this.filtered().length ? this.optionId(idx) : null;
  });
  protected readonly boxClasses = computed(() =>
    [
      'flex h-field items-center gap-6 rounded-8 border bg-surface-field px-8 text-12 text-text transition-colors duration-fast',
      this.invalid()
        ? 'border-danger-border ring-2 ring-danger-halo'
        : 'border-border-field hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong',
    ].join(' '),
  );

  constructor() {
    effect(() => {
      const el = this.inputEl()?.nativeElement;
      const raw = this.describedBy();
      if (!el) return;
      const nextExtra = (raw ?? '')
        .split(/\s+/)
        .map((t) => t.trim())
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
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  protected openMenu(): void {
    if (this.readonly() || this.menuOpen()) return;
    const anchor = this.anchorElement();
    if (!anchor) return;
    this.activeIndex.set(-1);
    this.menuPlaced.set(false);
    this.menuPlace.set(initialSuggestionPlace(anchor, this.host.nativeElement));
    this.menuOpen.set(true);
    this.schedulePlace();
  }

  protected closeMenu(): void {
    this.listSeq++;
    this.menuOpen.set(false);
    this.menuPlaced.set(false);
    this.activeIndex.set(-1);
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

  protected onBlur(): void {
    this.closeMenu();
  }

  protected onInput(event: Event): void {
    if (this.readonly()) return;
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.activeIndex.set(-1);
    if (!this.menuOpen()) {
      this.openMenu();
    } else {
      this.schedulePlace();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
    const items = this.filtered();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.menuOpen()) {
          this.openMenu();
          if (items.length > 0) this.activeIndex.set(0);
          return;
        }
        if (items.length > 0) {
          const next = this.activeIndex() < 0 ? 0 : (this.activeIndex() + 1) % items.length;
          this.activeIndex.set(next);
          this.scrollIntoView(next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.menuOpen()) {
          this.openMenu();
          if (items.length > 0) this.activeIndex.set(items.length - 1);
          return;
        }
        if (items.length > 0) {
          const prev = this.activeIndex() <= 0 ? items.length - 1 : this.activeIndex() - 1;
          this.activeIndex.set(prev);
          this.scrollIntoView(prev);
        }
        break;
      }
      case 'Enter': {
        if (!this.dropdownVisible()) return;
        event.preventDefault();
        event.stopPropagation();
        const idx = this.activeIndex();
        if (idx >= 0 && idx < items.length) {
          this.pick(items[idx]);
        } else {
          this.closeMenu();
        }
        break;
      }
      case 'Escape': {
        if (!this.dropdownVisible()) {
          if (this.menuOpen()) this.closeMenu();
          return;
        }
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

  protected pick(item: string): void {
    if (this.readonly()) return;
    this.value.set(item);
    this.closeMenu();
    this.inputEl()?.nativeElement.focus();
  }

  private anchorElement(): HTMLElement | undefined {
    return this.fieldBox()?.nativeElement ?? this.inputEl()?.nativeElement;
  }

  private schedulePlace(): void {
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
