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
import { tablerCheck, tablerChevronDown, tablerSearch } from '@ng-icons/tabler-icons';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../core/geo/geo.model';
import { LanguageState } from '../../../core/i18n/language';
import { rectInPage, viewport } from '../overlay/zoom';
import {
  MAX_PHONE_LENGTH,
  dialDigits,
  joinPhone,
  normalizePhone,
  splitPhone,
  toAsciiDigits,
} from './phone';

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'ui-phone-input',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideTranslocoScope({ scope: 'ui-phone', alias: 'phone' })],
  providers: [provideIcons({ tablerChevronDown, tablerCheck, tablerSearch })],
  templateUrl: './phone-input.html',
  host: {
    class: 'relative block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeList()',
    '(keydown.escape)': 'onEscape($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class PhoneInput {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly language = inject(LanguageState).current;

  protected readonly uid = `ui-phone-${++PhoneInput.nextId}`;
  protected readonly listId = `${this.uid}-list`;

  private readonly fieldBox = viewChild.required<ElementRef<HTMLElement>>('fieldBox');
  private readonly dialTrigger = viewChild<ElementRef<HTMLButtonElement>>('dialTrigger');
  private readonly numberInput = viewChild<ElementRef<HTMLInputElement>>('numberInput');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  readonly countries = input.required<GeoCountry[]>();
  readonly defaultIso2 = input('EG');
  readonly label = input.required<string>();
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  /** Space-separated ids of the hint and error elements that describe this control. */
  readonly describedBy = input('');
  readonly value = model<string>('');

  protected readonly focused = signal(false);
  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({
    top: 0,
    start: 0,
    width: 0,
    maxHeight: null,
  });
  protected readonly search = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly selectedCountry = signal<GeoCountry | null>(null);
  protected readonly localNumber = signal('');

  private listSeq = 0;
  private lastSyncedValue: string | undefined = undefined;
  private countryPicked = false;
  private transitioningFocus = false;
  private pendingEditTarget: 'dial' | 'number' | null = null;
  private lastTabShift = false;
  private openedFrom: 'dial' | 'number' = 'dial';

  /** Core's GET countries already returns active countries only. */
  protected readonly activeCountries = this.countries;

  protected readonly defaultCountry = computed(() => {
    const iso = this.defaultIso2().toUpperCase();
    const active = this.activeCountries();
    return (
      active.find((c) => c.iso2.toUpperCase() === iso) ??
      this.countries().find((c) => c.iso2.toUpperCase() === iso) ??
      active[0] ??
      null
    );
  });

  protected readonly isEditing = computed(
    () => !this.readonly() && (this.focused() || this.open() || !this.value()),
  );

  protected readonly displayValue = computed(() => normalizePhone(this.value()));

  protected readonly viewCountry = computed(
    () => this.selectedCountry() ?? splitPhone(this.value(), this.countries()).country,
  );

  protected readonly dialPrefix = computed(() => {
    const country = this.selectedCountry();
    const code = country ? dialDigits(country.dialCode) : '';
    return code ? `+${code}` : '';
  });

  protected readonly maxLocalLength = computed(() => {
    const prefix = this.dialPrefix();
    return Math.max(0, MAX_PHONE_LENGTH - prefix.length);
  });

  protected readonly filteredCountries = computed(() => {
    const list = this.activeCountries();
    const rawTerm = this.search().trim();
    if (!rawTerm) return list;

    const term = normalizeSearchText(rawTerm);
    const digitsTerm = dialDigits(rawTerm);
    const hasLetters = /[a-z\u0600-\u06FF]/i.test(rawTerm);

    return list.filter((country) => {
      const code = dialDigits(country.dialCode);
      if (normalizeSearchText(country.nameEn).includes(term)) return true;
      if (normalizeSearchText(country.nameAr).includes(term)) return true;
      if (country.iso2.toLowerCase().includes(term)) return true;
      if (country.iso3.toLowerCase().includes(term)) return true;
      if (`+${code}`.includes(term)) return true;
      if (!hasLetters && digitsTerm && code.includes(digitsTerm)) return true;
      return false;
    });
  });

  protected readonly activeDescendantId = computed(() => {
    if (!this.open()) return null;
    const list = this.filteredCountries();
    const idx = this.activeIndex();
    return idx >= 0 && idx < list.length ? this.optionId(idx) : null;
  });

  protected readonly fieldBoxClasses = computed(() => {
    const base =
      'flex h-field items-center rounded-8 border text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.invalid()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.open() || this.focused()) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo-strong`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  });

  constructor() {
    effect(() => {
      const val = this.value();
      const list = this.countries();
      const fallback = this.defaultCountry();

      if (val === this.lastSyncedValue) {
        if (!val && !this.countryPicked && fallback) {
          this.selectedCountry.set(fallback);
        } else if (val && !this.selectedCountry() && list.length > 0) {
          const split = splitPhone(val, list);
          if (split.country) {
            this.selectedCountry.set(split.country);
            this.localNumber.set(split.number);
          }
        }
        return;
      }

      this.lastSyncedValue = val;
      this.countryPicked = false;

      if (!val) {
        this.localNumber.set('');
        this.selectedCountry.set(fallback);
        return;
      }

      const split = splitPhone(val, list);
      this.selectedCountry.set(split.country);
      this.localNumber.set(split.number);
    });

    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeList();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        this.lastTabShift = event.shiftKey;
      } else if (
        event.key !== 'Shift' &&
        event.key !== 'Control' &&
        event.key !== 'Alt' &&
        event.key !== 'Meta'
      ) {
        this.lastTabShift = false;
      }
    };
    const onPointerDown = () => {
      this.lastTabShift = false;
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    });
  }

  protected optionId(index: number): string {
    return `${this.uid}-opt-${index}`;
  }

  protected dialText(country: GeoCountry): string {
    const code = dialDigits(country.dialCode);
    return code ? `+${code}` : '';
  }

  protected countryName(country: GeoCountry): string {
    return this.language() === 'ar' ? country.nameAr : country.nameEn;
  }

  protected onContainerMouseDown(event: MouseEvent): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('input, button')) {
      event.preventDefault();
      const editTarget = this.pendingEditTarget ?? 'number';
      this.pendingEditTarget = null;
      if (!this.isEditing()) {
        this.enterEditMode(editTarget);
      } else {
        this.numberInput()?.nativeElement.focus();
      }
    }
  }

  protected onViewPointerDown(target: 'dial' | 'number'): void {
    if (this.disabled() || this.readonly()) return;
    this.pendingEditTarget = target;
  }

  protected onViewFocus(): void {
    if (this.disabled() || this.readonly()) return;
    const target = this.pendingEditTarget ?? (this.lastTabShift ? 'number' : 'dial');
    this.pendingEditTarget = null;
    this.lastTabShift = false;
    this.enterEditMode(target);
  }

  protected onPopoverMouseDown(event: MouseEvent): void {
    const searchEl = this.searchInput()?.nativeElement;
    if (searchEl && (event.target === searchEl || searchEl.contains(event.target as Node))) {
      return;
    }
    event.preventDefault();
  }

  protected onEditFocus(): void {
    if (!this.readonly() && !this.disabled()) {
      this.focused.set(true);
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    if (this.transitioningFocus) return;
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.focused.set(false);
    this.closeList();
  }

  protected toggleList(): void {
    if (this.disabled() || this.readonly()) return;
    if (this.open()) {
      this.closeList();
      return;
    }
    this.openList('dial');
  }

  protected closeList(): void {
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeList();
      this.focused.set(false);
    }
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    const returnTo = this.openedFrom;
    this.closeList();
    if (returnTo === 'number') {
      this.numberInput()?.nativeElement.focus();
    } else {
      this.dialTrigger()?.nativeElement.focus();
    }
  }

  protected onDialKeyDown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    if (
      (event.altKey && event.key === 'ArrowDown') ||
      (!event.altKey && event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      this.openList('dial');
    }
  }

  protected onNumberKeyDown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      this.openList('number');
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (ALLOWED_CONTROL_KEYS.has(event.key)) return;

    if (event.key.length === 1) {
      const ascii = toAsciiDigits(event.key);
      if (!/^\d$/.test(ascii)) {
        event.preventDefault();
        return;
      }
      const inputEl = event.target as HTMLInputElement;
      const selLen = (inputEl.selectionEnd ?? 0) - (inputEl.selectionStart ?? 0);
      if (inputEl.value.length - selLen >= this.maxLocalLength()) {
        event.preventDefault();
      }
    }
  }

  protected onNumberPaste(event: ClipboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    const raw = event.clipboardData?.getData('text') ?? '';
    event.preventDefault();
    if (!raw) return;

    const cleaned = toAsciiDigits(raw).replace(/[\s()[\].-]+/g, '');
    if (cleaned.startsWith('+') || cleaned.startsWith('00')) {
      const normalized = normalizePhone(cleaned);
      const split = splitPhone(normalized, this.countries());
      this.selectedCountry.set(split.country);
      this.countryPicked = split.country !== null;
      this.localNumber.set(split.number);
      const inputEl = event.target as HTMLInputElement;
      inputEl.value = split.number;
      this.emitValue(joinPhone(split.country, split.number));
      return;
    }

    const pastedDigits = toAsciiDigits(cleaned).replace(/\D+/g, '');
    if (!pastedDigits) return;

    const inputEl = event.target as HTMLInputElement;
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    const combined = `${inputEl.value.slice(0, start)}${pastedDigits}${inputEl.value.slice(end)}`;
    this.applyLocalText(combined, inputEl);
  }

  protected onNumberInput(event: Event): void {
    if (this.disabled() || this.readonly()) return;
    const inputEl = event.target as HTMLInputElement;
    const raw = inputEl.value;

    const trimmed = toAsciiDigits(raw).replace(/[\s()[\].-]+/g, '');
    const inputType = (event as InputEvent).inputType;
    if (
      (trimmed.startsWith('+') && (this.selectedCountry() !== null || trimmed.length > 1)) ||
      (inputType === 'insertFromPaste' && trimmed.startsWith('00') && trimmed.length > 2)
    ) {
      const normalized = normalizePhone(trimmed);
      const split = splitPhone(normalized, this.countries());
      if (split.country) {
        this.selectedCountry.set(split.country);
        this.countryPicked = true;
        this.localNumber.set(split.number);
        inputEl.value = split.number;
        this.emitValue(joinPhone(split.country, split.number));
        return;
      }
    }

    this.applyLocalText(raw, inputEl);
  }

  protected onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.search.set(val);
    this.activeIndex.set(0);
    if (this.open()) {
      const seq = ++this.listSeq;
      afterNextRender(() => this.placeList(seq), { injector: this.injector });
    }
  }

  protected onSearchKeyDown(event: KeyboardEvent): void {
    const list = this.filteredCountries();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (list.length > 0) {
          const next = Math.min(this.activeIndex() + 1, list.length - 1);
          this.activeIndex.set(next);
          this.scrollOptionIntoView(next);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (list.length > 0) {
          const prev = Math.max(this.activeIndex() - 1, 0);
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(prev);
        }
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (list[this.activeIndex()]) {
          this.chooseCountry(list[this.activeIndex()]);
        }
        break;
      case 'Tab':
        this.closeList();
        break;
    }
  }

  protected chooseCountry(country: GeoCountry): void {
    this.selectedCountry.set(country);
    this.countryPicked = true;
    const code = dialDigits(country.dialCode);
    const maxLocal = Math.max(0, MAX_PHONE_LENGTH - (code ? code.length + 1 : 0));
    const cleaned = toAsciiDigits(this.localNumber())
      .replace(/\D+/g, '')
      .replace(/^0+/, '')
      .slice(0, maxLocal);
    this.localNumber.set(cleaned);
    this.emitValue(joinPhone(country, cleaned));
    this.closeList();
    this.focused.set(true);
    this.numberInput()?.nativeElement.focus();
  }

  private applyLocalText(raw: string, inputEl: HTMLInputElement): void {
    const country = this.selectedCountry();
    const ascii = toAsciiDigits(raw);
    const hasLeadingPlus = !country && ascii.trimStart().startsWith('+');
    const digits = ascii.replace(/\D+/g, '');

    let nextLocal: string;
    if (country) {
      nextLocal = digits.replace(/^0+/, '').slice(0, this.maxLocalLength());
    } else if (hasLeadingPlus) {
      nextLocal = digits ? `+${digits}`.slice(0, MAX_PHONE_LENGTH) : '';
    } else {
      nextLocal = digits.slice(0, MAX_PHONE_LENGTH);
    }

    inputEl.value = nextLocal;
    this.localNumber.set(nextLocal);
    this.emitValue(joinPhone(country, nextLocal));
  }

  private emitValue(next: string): void {
    this.lastSyncedValue = next;
    this.value.set(next);
  }

  private enterEditMode(target: 'dial' | 'number'): void {
    this.transitioningFocus = true;
    this.focused.set(true);
    afterNextRender(
      () => {
        const el =
          target === 'dial' ? this.dialTrigger()?.nativeElement : this.numberInput()?.nativeElement;
        if (el) {
          el.focus();
        } else {
          this.focused.set(false);
        }
        this.transitioningFocus = false;
      },
      { injector: this.injector },
    );
  }

  private openList(from: 'dial' | 'number'): void {
    this.openedFrom = from;
    this.focused.set(true);
    this.search.set('');
    const selectedId = this.selectedCountry()?.id;
    const idx = selectedId ? this.activeCountries().findIndex((c) => c.id === selectedId) : -1;
    this.activeIndex.set(idx >= 0 ? idx : 0);

    const seq = ++this.listSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);

    afterNextRender(
      () => {
        this.placeList(seq);
        this.searchInput()?.nativeElement.focus();
        if (idx >= 0) {
          this.scrollOptionIntoView(idx);
        }
      },
      { injector: this.injector },
    );
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

  private scrollOptionIntoView(index: number): void {
    document.getElementById(this.optionId(index))?.scrollIntoView({ block: 'nearest' });
  }
}

const ALLOWED_CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

function normalizeSearchText(text: string): string {
  return toAsciiDigits(text).toLowerCase().replace(/[أإآ]/g, 'ا');
}
