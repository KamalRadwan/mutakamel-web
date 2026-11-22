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
  tablerChevronLeft,
  tablerChevronRight,
  tablerDots,
  tablerLoader2,
  tablerRefresh,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { tradeContext } from '../../trade-api';
import { itemName } from '../../trade-foundation.api';
import { getTerm, listTermOptions } from '../terms.api';
import {
  TERM_LIMITS,
  TERM_SIDE_OF,
  type TermDocumentType,
  type TermOptions,
  type TermSelections,
  type TradeTerm,
} from '../terms.model';

export type SingleTermSlot = 'payment' | 'delivery' | 'warranty';
type OpenDropdownKind = SingleTermSlot | 'clauses';

interface PopoverPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

interface ChipMenuState {
  index: number;
  top: number;
  start: number;
  placed: boolean;
}

const PREVIEW_EXPAND_THRESHOLD = 95;

@Component({
  selector: 'app-trade-terms-select',
  imports: [NgIcon, Button, Field, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'trade-settings', alias: 'tset' }),
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerChevronLeft,
      tablerChevronRight,
      tablerDots,
      tablerLoader2,
      tablerRefresh,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './terms-select.html',
  host: {
    class: 'contents',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeAll()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class TradeTermsSelect {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LanguageState);
  private readonly scope = inject(ScopeState);
  protected readonly uid = `trade-terms-select-${++TradeTermsSelect.nextId}`;

  private readonly paymentTrigger = viewChild<ElementRef<HTMLButtonElement>>('paymentTrigger');
  private readonly deliveryTrigger = viewChild<ElementRef<HTMLButtonElement>>('deliveryTrigger');
  private readonly warrantyTrigger = viewChild<ElementRef<HTMLButtonElement>>('warrantyTrigger');
  private readonly clausesFieldBox = viewChild<ElementRef<HTMLElement>>('clausesFieldBox');
  private readonly clausesInput = viewChild<ElementRef<HTMLInputElement>>('clausesInput');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly singleMenuRef = viewChild<ElementRef<HTMLElement>>('singleMenu');
  private readonly clausesMenuRef = viewChild<ElementRef<HTMLElement>>('clausesMenu');
  private readonly chipMenuRef = viewChild<ElementRef<HTMLElement>>('chipMenu');

  readonly documentType = input.required<TermDocumentType>();
  readonly value = model.required<TermSelections>();
  readonly paymentRequired = input(false);
  readonly disabled = input(false);
  readonly idPrefix = input.required<string>();
  readonly showErrors = input(false);

  protected readonly maxClauses = TERM_LIMITS.maxClauses;
  protected readonly options = signal<TermOptions | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  private readonly retryTick = signal(0);

  private readonly resolvedCache = signal<ReadonlyMap<string, TradeTerm>>(new Map());
  private readonly fetchingMissingIds = new Set<string>();
  private loadSeq = 0;
  private popoverSeq = 0;
  private chipMenuSeq = 0;
  private pendingApplyDefaults = false;

  protected readonly openDropdown = signal<OpenDropdownKind | null>(null);
  protected readonly dropdownQuery = signal('');
  protected readonly clausesQuery = signal('');
  protected readonly popoverPlaced = signal(false);
  protected readonly popoverPlace = signal<PopoverPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly activeIndex = signal(0);
  protected readonly chipMenu = signal<ChipMenuState | null>(null);

  protected readonly paymentTouched = signal(false);
  protected readonly expandedPreviews = signal<Record<SingleTermSlot, boolean>>({
    payment: false,
    delivery: false,
    warranty: false,
  });

  protected readonly isPurchaseDoc = computed(() => TERM_SIDE_OF[this.documentType()] === 'PURCHASE');

  protected readonly paymentHintKey = computed(() =>
    this.isPurchaseDoc() ? 'tset.select.paymentHintPurchase' : 'tset.select.paymentHintSales',
  );

  private readonly activeTermById = computed<ReadonlyMap<string, TradeTerm>>(() => {
    const opts = this.options();
    const map = new Map<string, TradeTerm>();
    if (!opts) return map;
    for (const list of Object.values(opts.byType)) {
      for (const term of list) {
        map.set(term.id, term);
      }
    }
    return map;
  });

  protected readonly paymentOptions = computed<TradeTerm[]>(() => this.options()?.byType.PAYMENT ?? []);
  protected readonly deliveryOptions = computed<TradeTerm[]>(() => this.options()?.byType.DELIVERY ?? []);
  protected readonly warrantyOptions = computed<TradeTerm[]>(() => this.options()?.byType.WARRANTY ?? []);
  protected readonly returnsOptions = computed<TradeTerm[]>(() => this.options()?.byType.RETURNS ?? []);
  protected readonly generalOptions = computed<TradeTerm[]>(() => this.options()?.byType.GENERAL ?? []);

  protected readonly filteredSingleOptions = computed<TradeTerm[]>(() => {
    const kind = this.openDropdown();
    if (kind !== 'payment' && kind !== 'delivery' && kind !== 'warranty') return [];
    const list =
      kind === 'payment'
        ? this.paymentOptions()
        : kind === 'delivery'
          ? this.deliveryOptions()
          : this.warrantyOptions();
    const needle = this.dropdownQuery().trim().toLowerCase();
    if (!needle) return list;
    return list.filter((term) => this.matchesTerm(term, needle));
  });

  protected readonly filteredReturns = computed<TradeTerm[]>(() => {
    const needle = this.clausesQuery().trim().toLowerCase();
    const list = this.returnsOptions();
    return needle ? list.filter((term) => this.matchesTerm(term, needle)) : list;
  });

  protected readonly filteredGeneral = computed<TradeTerm[]>(() => {
    const needle = this.clausesQuery().trim().toLowerCase();
    const list = this.generalOptions();
    return needle ? list.filter((term) => this.matchesTerm(term, needle)) : list;
  });

  protected readonly flatClauseOptions = computed<TradeTerm[]>(() => [
    ...this.filteredReturns(),
    ...this.filteredGeneral(),
  ]);

  protected readonly clausesAtMax = computed(() => this.value().clauseIds.length >= TERM_LIMITS.maxClauses);

  protected readonly selectedPaymentTerm = computed(() => this.lookupTerm(this.value().paymentTermId));
  protected readonly selectedDeliveryTerm = computed(() => this.lookupTerm(this.value().deliveryTermId));
  protected readonly selectedWarrantyTerm = computed(() => this.lookupTerm(this.value().warrantyTermId));

  protected readonly paymentInactive = computed(() => this.isSelectionInactive(this.value().paymentTermId));
  protected readonly deliveryInactive = computed(() => this.isSelectionInactive(this.value().deliveryTermId));
  protected readonly warrantyInactive = computed(() => this.isSelectionInactive(this.value().warrantyTermId));
  protected readonly anyClauseInactive = computed(() =>
    this.value().clauseIds.some((id) => this.isSelectionInactive(id)),
  );

  protected readonly paymentErrorKey = computed<string | null>(() => {
    if (this.paymentInactive()) return 'tset.select.noLongerActive';
    if (this.paymentRequired() && !this.value().paymentTermId && (this.paymentTouched() || this.showErrors())) {
      return 'tset.errors.TRADE_TERMS_PAYMENT_REQUIRED';
    }
    return null;
  });

  protected readonly deliveryErrorKey = computed<string | null>(() =>
    this.deliveryInactive() ? 'tset.select.noLongerActive' : null,
  );

  protected readonly warrantyErrorKey = computed<string | null>(() =>
    this.warrantyInactive() ? 'tset.select.noLongerActive' : null,
  );

  protected readonly clausesErrorKey = computed<string | null>(() =>
    this.anyClauseInactive() ? 'tset.select.noLongerActive' : null,
  );

  readonly valid = computed<boolean>(() => {
    const sel = this.value();
    if (this.paymentRequired() && !sel.paymentTermId) return false;
    if (sel.clauseIds.length > TERM_LIMITS.maxClauses) return false;
    const opts = this.options();
    if (!opts) return true;
    const active = this.activeTermById();
    if (sel.paymentTermId && !active.has(sel.paymentTermId)) return false;
    if (sel.deliveryTermId && !active.has(sel.deliveryTermId)) return false;
    if (sel.warrantyTermId && !active.has(sel.warrantyTermId)) return false;
    if (sel.clauseIds.some((id) => !active.has(id))) return false;
    return true;
  });

  constructor() {
    effect(() => {
      const docType = this.documentType();
      const ctx = tradeContext(this.scope, 'COMPANY');
      const _lang = this.lang.current();
      const _retry = this.retryTick();
      untracked(() => void this.loadOptions(docType, ctx.companyId ?? ''));
    });

    effect(() => {
      const sel = this.value();
      const opts = this.options();
      const ctx = tradeContext(this.scope, 'COMPANY');
      const companyId = ctx.companyId ?? '';
      const _lang = this.lang.current();
      if (!opts) return;

      const ids = [sel.paymentTermId, sel.deliveryTermId, sel.warrantyTermId, ...sel.clauseIds].filter(
        (id): id is string => Boolean(id),
      );
      const active = this.activeTermById();
      const cache = untracked(() => this.resolvedCache());

      for (const id of ids) {
        const cacheKey = `${companyId}:${id}`;
        if (active.has(id) || cache.has(cacheKey) || this.fetchingMissingIds.has(cacheKey)) continue;
        this.fetchingMissingIds.add(cacheKey);
        void getTerm(id, ctx)
          .then((term) => {
            this.resolvedCache.update((prev) => {
              const next = new Map(prev);
              next.set(cacheKey, term);
              return next;
            });
          })
          .catch(() => {
            // Deleted or unavailable term: keep fallback inactive chip without blocking.
          })
          .finally(() => {
            this.fetchingMissingIds.delete(cacheKey);
          });
      }
    });

    effect(() => {
      const kind = this.openDropdown();
      this.loading();
      this.loadError();
      this.dropdownQuery();
      this.clausesQuery();
      this.options();
      if (kind) {
        untracked(() => this.schedulePopoverPlace(kind));
      }
    });

    const onScroll = (event: Event) => {
      if (!this.openDropdown() && !this.chipMenu()) return;
      const target = event.target;
      if (target instanceof Node) {
        if (
          this.singleMenuRef()?.nativeElement.contains(target) ||
          this.clausesMenuRef()?.nativeElement.contains(target) ||
          this.chipMenuRef()?.nativeElement.contains(target)
        ) {
          return;
        }
      }
      this.closeAll();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  applyDefaults(): void {
    const opts = this.options();
    if (!opts) {
      this.pendingApplyDefaults = true;
      return;
    }
    this.pendingApplyDefaults = false;
    this.value.update((curr) => ({
      paymentTermId: curr.paymentTermId ?? opts.defaults.PAYMENT ?? null,
      deliveryTermId: curr.deliveryTermId ?? opts.defaults.DELIVERY ?? null,
      warrantyTermId: curr.warrantyTermId ?? opts.defaults.WARRANTY ?? null,
      clauseIds:
        curr.clauseIds.length > 0
          ? curr.clauseIds
          : opts.defaults.GENERAL
            ? [opts.defaults.GENERAL]
            : [],
    }));
  }

  protected fieldId(suffix: SingleTermSlot | 'clauses'): string {
    return `${this.idPrefix()}-${suffix}`;
  }

  protected termName(term: TradeTerm): string {
    return itemName(term, this.lang.current()) || term.displayName || term.code;
  }

  protected termText(term: TradeTerm | null): string {
    if (!term) return '';
    const lang = this.lang.current();
    return (term.localizedTexts[lang] || term.localizedTexts['en'] || term.localizedTexts['ar'] || '').trim();
  }

  protected canExpandPreview(text: string): boolean {
    return text.length > PREVIEW_EXPAND_THRESHOLD || text.includes('\n');
  }

  protected isPreviewExpanded(slot: SingleTermSlot): boolean {
    return this.expandedPreviews()[slot];
  }

  protected togglePreview(slot: SingleTermSlot): void {
    this.expandedPreviews.update((curr) => ({ ...curr, [slot]: !curr[slot] }));
  }

  protected isSelectionInactive(id: string | null): boolean {
    if (!id || this.loading() || this.loadError()) return false;
    const opts = this.options();
    if (!opts) return false;
    return !this.activeTermById().has(id);
  }

  protected isClauseSelected(id: string): boolean {
    return this.value().clauseIds.includes(id);
  }

  protected clauseChipLabel(id: string): string {
    const term = this.lookupTerm(id);
    if (term) return this.termName(term);
    return id;
  }

  protected singleTriggerClasses(slot: SingleTermSlot, hasError: boolean): string {
    const base =
      'flex h-field w-full items-center gap-4 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (hasError) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.openDropdown() === slot) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  }

  protected clausesBoxClasses(): string {
    const base =
      'flex min-h-field flex-wrap items-center gap-2 rounded-8 border px-8 py-border text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.clausesErrorKey()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.openDropdown() === 'clauses') {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  }

  protected optionRowClasses(selected: boolean, index: number, disabledAdd = false): string {
    if (disabledAdd) {
      return 'cursor-not-allowed text-text-placeholder opacity-drag-source';
    }
    const active = this.activeIndex() === index;
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active ? 'cursor-pointer bg-row-hover text-text' : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected singleValueId(slot: SingleTermSlot): string | null {
    const sel = this.value();
    if (slot === 'payment') return sel.paymentTermId;
    if (slot === 'delivery') return sel.deliveryTermId;
    return sel.warrantyTermId;
  }

  protected toggleSingleDropdown(slot: SingleTermSlot): void {
    if (this.disabled()) return;
    this.closeChipMenu();
    if (this.openDropdown() === slot) {
      this.closeDropdown(true);
      return;
    }
    this.dropdownQuery.set('');
    this.activeIndex.set(0);
    this.popoverPlaced.set(false);
    const triggerEl = this.singleTriggerEl(slot);
    if (triggerEl) {
      this.popoverPlace.set(this.initialPlace(triggerEl));
    }
    this.openDropdown.set(slot);
    this.schedulePopoverPlace(slot);
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  protected chooseSingle(slot: SingleTermSlot, id: string | null): void {
    if (this.disabled()) return;
    if (slot === 'payment') {
      this.paymentTouched.set(true);
    }
    this.value.update((curr) => ({
      ...curr,
      paymentTermId: slot === 'payment' ? id : curr.paymentTermId,
      deliveryTermId: slot === 'delivery' ? id : curr.deliveryTermId,
      warrantyTermId: slot === 'warranty' ? id : curr.warrantyTermId,
    }));
    this.expandedPreviews.update((curr) => ({ ...curr, [slot]: false }));
    this.closeDropdown(true);
  }

  protected clearSingle(slot: SingleTermSlot, event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    if (slot === 'payment') {
      this.paymentTouched.set(true);
    }
    this.value.update((curr) => ({
      ...curr,
      paymentTermId: slot === 'payment' ? null : curr.paymentTermId,
      deliveryTermId: slot === 'delivery' ? null : curr.deliveryTermId,
      warrantyTermId: slot === 'warranty' ? null : curr.warrantyTermId,
    }));
    this.expandedPreviews.update((curr) => ({ ...curr, [slot]: false }));
    this.singleTriggerEl(slot)?.focus();
  }

  protected onSearchInput(event: Event): void {
    this.dropdownQuery.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected optionId(kind: OpenDropdownKind, index: number): string {
    return `${this.uid}-${kind}-opt-${index}`;
  }

  protected activeOptionId(kind: OpenDropdownKind): string | null {
    if (this.openDropdown() !== kind || this.disabled() || this.loading() || this.loadError()) return null;
    const count =
      kind === 'clauses' ? this.flatClauseOptions().length : this.filteredSingleOptions().length;
    if (count === 0) return null;
    const idx = this.activeIndex();
    return idx >= 0 && idx < count ? this.optionId(kind, idx) : this.optionId(kind, 0);
  }

  protected onSingleMenuKeydown(event: KeyboardEvent, slot: SingleTermSlot): void {
    const list = this.filteredSingleOptions();
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (list.length > 0) {
          const next = (this.activeIndex() + 1) % list.length;
          this.activeIndex.set(next);
          this.scrollOptionIntoView(slot, next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (list.length > 0) {
          const prev = (this.activeIndex() - 1 + list.length) % list.length;
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(slot, prev);
        }
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (this.loadError()) {
          this.retry();
          return;
        }
        const idx = this.activeIndex();
        const chosen = list[idx];
        if (chosen) {
          this.chooseSingle(slot, chosen.id);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        event.stopPropagation();
        this.closeDropdown(true);
        break;
      }
      case 'Tab': {
        this.closeDropdown(false);
        break;
      }
    }
  }

  protected onClausesFieldClick(): void {
    if (this.disabled()) return;
    this.closeChipMenu();
    this.clausesInput()?.nativeElement.focus();
    if (this.openDropdown() !== 'clauses') {
      this.openClausesDropdown();
    }
  }

  protected onClausesInput(event: Event): void {
    if (this.disabled()) return;
    const text = (event.target as HTMLInputElement).value;
    this.clausesQuery.set(text);
    this.activeIndex.set(0);
    if (this.openDropdown() !== 'clauses') {
      this.openClausesDropdown();
    } else {
      this.schedulePopoverPlace('clauses');
    }
  }

  protected onClausesKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const list = this.flatClauseOptions();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (this.openDropdown() !== 'clauses') {
          this.activeIndex.set(0);
          this.openClausesDropdown();
          return;
        }
        if (list.length > 0) {
          const next = (this.activeIndex() + 1) % list.length;
          this.activeIndex.set(next);
          this.scrollOptionIntoView('clauses', next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (this.openDropdown() !== 'clauses') {
          this.activeIndex.set(0);
          this.openClausesDropdown();
          return;
        }
        if (list.length > 0) {
          const prev = (this.activeIndex() - 1 + list.length) % list.length;
          this.activeIndex.set(prev);
          this.scrollOptionIntoView('clauses', prev);
        }
        break;
      }
      case 'Enter': {
        if (this.openDropdown() !== 'clauses') return;
        event.preventDefault();
        event.stopPropagation();
        if (this.loadError()) {
          this.retry();
          return;
        }
        const chosen = list[this.activeIndex()];
        if (chosen) {
          this.toggleClause(chosen);
        }
        break;
      }
      case 'Backspace': {
        if (this.clausesQuery() === '' && this.value().clauseIds.length > 0) {
          this.value.update((curr) => ({ ...curr, clauseIds: curr.clauseIds.slice(0, -1) }));
          if (this.openDropdown() === 'clauses') {
            this.schedulePopoverPlace('clauses');
          }
        }
        break;
      }
      case 'Escape': {
        if (this.openDropdown() === 'clauses') {
          event.preventDefault();
          event.stopPropagation();
          this.closeDropdown(false);
          this.clausesInput()?.nativeElement.focus();
        }
        break;
      }
      case 'Tab': {
        this.closeDropdown(false);
        break;
      }
    }
  }

  protected toggleClause(term: TradeTerm): void {
    if (this.disabled()) return;
    const currentIds = this.value().clauseIds;
    if (currentIds.includes(term.id)) {
      this.value.update((curr) => ({
        ...curr,
        clauseIds: curr.clauseIds.filter((id) => id !== term.id),
      }));
    } else {
      if (currentIds.length >= TERM_LIMITS.maxClauses) return;
      this.value.update((curr) => ({
        ...curr,
        clauseIds: [...curr.clauseIds, term.id],
      }));
    }
    this.clausesQuery.set('');
    const inputEl = this.clausesInput()?.nativeElement;
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    if (this.openDropdown() === 'clauses') {
      this.schedulePopoverPlace('clauses');
    }
  }

  protected removeClauseAt(index: number, event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.closeChipMenu();
    this.value.update((curr) => ({
      ...curr,
      clauseIds: curr.clauseIds.filter((_, i) => i !== index),
    }));
  }

  protected openChipMenu(index: number, event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.closeDropdown(false);
    const existing = this.chipMenu();
    if (existing && existing.index === index) {
      this.closeChipMenu();
      return;
    }

    const triggerEl = event.currentTarget as HTMLElement;
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(triggerEl).direction === 'rtl';
    const seq = ++this.chipMenuSeq;

    this.chipMenu.set({
      index,
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      placed: false,
    });

    const place = () => this.placeChipMenu(seq, triggerEl);
    queueMicrotask(place);
    afterNextRender(place, { injector: this.injector });
  }

  protected moveClause(index: number, delta: -1 | 1): void {
    if (this.disabled()) return;
    const target = index + delta;
    const ids = this.value().clauseIds;
    if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return;
    const next = ids.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.value.update((curr) => ({ ...curr, clauseIds: next }));
    this.closeChipMenu();
  }

  protected retry(): void {
    this.retryTick.update((n) => n + 1);
  }

  protected onDocumentClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeAll();
      return;
    }
    if (
      this.host.nativeElement.contains(target) ||
      this.singleMenuRef()?.nativeElement.contains(target) ||
      this.clausesMenuRef()?.nativeElement.contains(target) ||
      this.chipMenuRef()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeAll();
  }

  protected onEscape(event: Event): void {
    if (this.chipMenu()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeChipMenu();
      return;
    }
    const kind = this.openDropdown();
    if (kind) {
      event.preventDefault();
      event.stopPropagation();
      if (kind === 'clauses') {
        this.closeDropdown(false);
        this.clausesInput()?.nativeElement.focus();
      } else {
        this.closeDropdown(true);
      }
    }
  }

  protected closeAll(): void {
    this.closeDropdown(false);
    this.closeChipMenu();
  }

  protected generalOptionIndex(localIndex: number): number {
    return this.filteredReturns().length + localIndex;
  }

  private openClausesDropdown(): void {
    if (this.disabled()) return;
    this.activeIndex.set(0);
    this.popoverPlaced.set(false);
    const boxEl = this.clausesFieldBox()?.nativeElement;
    if (boxEl) {
      this.popoverPlace.set(this.initialPlace(boxEl));
    }
    this.openDropdown.set('clauses');
    this.schedulePopoverPlace('clauses');
  }

  private closeDropdown(restoreFocus: boolean): void {
    const current = this.openDropdown();
    this.popoverSeq++;
    this.openDropdown.set(null);
    this.popoverPlaced.set(false);
    this.dropdownQuery.set('');
    if (current === 'payment') {
      this.paymentTouched.set(true);
    }
    if (restoreFocus && current && current !== 'clauses') {
      this.singleTriggerEl(current)?.focus();
    }
  }

  private closeChipMenu(): void {
    this.chipMenuSeq++;
    this.chipMenu.set(null);
  }

  private singleTriggerEl(slot: SingleTermSlot): HTMLButtonElement | undefined {
    if (slot === 'payment') return this.paymentTrigger()?.nativeElement;
    if (slot === 'delivery') return this.deliveryTrigger()?.nativeElement;
    return this.warrantyTrigger()?.nativeElement;
  }

  private lookupTerm(id: string | null): TradeTerm | null {
    if (!id) return null;
    const active = this.activeTermById().get(id);
    if (active) return active;
    const companyId = this.scope.company().id;
    return this.resolvedCache().get(`${companyId}:${id}`) ?? null;
  }

  private matchesTerm(term: TradeTerm, needle: string): boolean {
    if (term.code.toLowerCase().includes(needle)) return true;
    if (term.incotermCode && term.incotermCode.toLowerCase().includes(needle)) return true;
    if (Object.values(term.localizedNames).some((name) => name.toLowerCase().includes(needle))) return true;
    return Object.values(term.localizedTexts).some((text) => text.toLowerCase().includes(needle));
  }

  private async loadOptions(docType: TermDocumentType, companyId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const opts = await listTermOptions(docType, { companyId });
      if (seq !== this.loadSeq) return;
      this.options.set(opts);
      if (this.pendingApplyDefaults) {
        this.applyDefaults();
      }
    } catch {
      if (seq !== this.loadSeq) return;
      this.options.set(null);
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private initialPlace(anchorEl: HTMLElement): PopoverPlace {
    const rect = rectInPage(anchorEl);
    const { width } = viewport();
    const rtl = getComputedStyle(anchorEl).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private schedulePopoverPlace(kind: OpenDropdownKind): void {
    const seq = ++this.popoverSeq;
    const run = () => this.placePopover(seq, kind);
    queueMicrotask(run);
    afterNextRender(run, { injector: this.injector });
  }

  private placePopover(seq: number, kind: OpenDropdownKind): void {
    if (seq !== this.popoverSeq || this.openDropdown() !== kind) return;
    const anchorEl = kind === 'clauses' ? this.clausesFieldBox()?.nativeElement : this.singleTriggerEl(kind)?.parentElement;
    const menuEl =
      kind === 'clauses' ? this.clausesMenuRef()?.nativeElement : this.singleMenuRef()?.nativeElement;
    if (!anchorEl || !menuEl) return;

    menuEl.style.maxHeight = '';
    const rect = rectInPage(anchorEl);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(anchorEl).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = menuRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? menuRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + menuRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - menuRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - menuRect.width));

    this.popoverPlace.set({ top, start, width: rect.width, maxHeight });
    this.popoverPlaced.set(true);

    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineStart = `${start}px`;
    menuEl.style.minWidth = `${rect.width}px`;
    menuEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    menuEl.classList.remove('invisible');
  }

  protected onChipMenuKeydown(event: KeyboardEvent): void {
    const menuEl = this.chipMenuRef()?.nativeElement;
    if (!menuEl) return;
    const buttons = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0 ? 0 : (current + delta + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeChipMenu();
    } else if (event.key === 'Tab') {
      this.closeChipMenu();
    }
  }

  private scrollOptionIntoView(kind: OpenDropdownKind, index: number): void {
    document.getElementById(this.optionId(kind, index))?.scrollIntoView({ block: 'nearest' });
  }

  private placeChipMenu(seq: number, anchorEl: HTMLElement): void {
    if (seq !== this.chipMenuSeq) return;
    const current = this.chipMenu();
    const menuEl = this.chipMenuRef()?.nativeElement;
    if (!current || !menuEl) return;

    const rect = rectInPage(anchorEl);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(anchorEl).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top = belowTop + menuRect.height > height - 8 ? Math.max(8, rect.top - 4 - menuRect.height) : belowTop;
    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + menuRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - menuRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - menuRect.width));

    this.chipMenu.set({ ...current, top, start, placed: true });
    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineStart = `${start}px`;
    menuEl.classList.remove('invisible');
    menuEl.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
}
