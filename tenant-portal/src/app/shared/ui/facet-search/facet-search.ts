import { Component, ElementRef, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerChevronRight, tablerFilter, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { PRESET_FIELD, SearchFacet, SearchField, SearchOption, addToFacets } from './facet-search.model';

type Row =
  | { kind: 'field'; field: SearchField; matches: SearchOption[] }
  | { kind: 'option'; field: SearchField; option: SearchOption }
  | { kind: 'preset'; option: SearchOption };

let nextFacetSearchId = 0;

@Component({
  selector: 'ui-facet-search',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerSearch, tablerX, tablerChevronDown, tablerChevronRight, tablerFilter })],
  templateUrl: './facet-search.html',
  host: {
    class: 'relative block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
  },
})
export class FacetSearch {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly listId = `facet-search-list-${nextFacetSearchId++}`;

  readonly fields = input.required<SearchField[]>();
  readonly presets = input<SearchOption[]>([]);
  readonly placeholder = input('');
  readonly facets = model<SearchFacet[]>([]);
  readonly chipClick = output<SearchFacet>();

  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed<Row[]>(() => {
    const term = this.text().trim().toLowerCase();
    if (!term) {
      return this.presets()
        .filter((preset) => !this.isPresetOn(preset.value))
        .map((option) => ({ kind: 'preset', option }));
    }
    return this.fields().flatMap((field): Row[] => {
      if (!field.options) return [{ kind: 'field', field, matches: [] }];
      const matches = field.options.filter((option) => option.label.toLowerCase().includes(term));
      if (!matches.length) return [];
      const children: Row[] = this.expanded().has(field.id) ? matches.map((option) => ({ kind: 'option', field, option })) : [];
      return [{ kind: 'field', field, matches }, ...children];
    });
  });

  protected readonly showList = computed(() => this.open() && (this.rows().length > 0 || this.facets().length > 0));

  /** Keyboard-reachable entries: the rows, then "Clear all" when any facet exists. */
  private readonly itemCount = computed(() => this.rows().length + (this.facets().length ? 1 : 0));

  /** Index of the "Clear all" option, or -1 when it is not shown. */
  protected readonly clearAllIndex = computed(() => (this.facets().length ? this.rows().length : -1));

  protected readonly activeId = computed(() => (this.showList() && this.itemCount() > 0 ? this.optionId(Math.min(this.active(), this.itemCount() - 1)) : null));

  protected optionId(index: number) {
    return `${this.listId}-opt-${index}`;
  }

  protected facetName(facet: SearchFacet) {
    return facet.label || facet.values.map((value) => value.label).join(', ');
  }

  protected typed(value: string) {
    this.text.set(value);
    this.active.set(0);
    this.expanded.set(new Set());
    this.open.set(true);
  }

  protected keydown(event: KeyboardEvent) {
    const rows = this.rows();
    const row = rows[this.active()];
    const last = this.itemCount() - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.active.set(Math.min(this.active() + 1, Math.max(last, 0)));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.active() === this.clearAllIndex()) this.clearAll();
        else if (row) this.choose(row);
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (row?.kind === 'field' && row.field.options && this.caretAtEnd()) {
          event.preventDefault();
          this.toggle(row.field.id, (event.key === 'ArrowRight') !== this.isRtl());
        }
        break;
      case 'Backspace':
        if (!this.text()) this.facets.update((facets) => facets.slice(0, -1));
        break;
      case 'Escape':
        this.open.set(false);
        break;
    }
  }

  protected choose(row: Row) {
    if (row.kind === 'preset') this.add(PRESET_FIELD, '', [row.option]);
    else if (row.kind === 'option') this.add(row.field.id, row.field.label, [row.option]);
    else if (row.field.options) this.add(row.field.id, row.field.label, row.matches);
    else this.add(row.field.id, row.field.label, [{ value: this.text().trim(), label: this.text().trim() }]);
  }

  protected toggle(fieldId: string, open?: boolean) {
    const next = new Set(this.expanded());
    const shouldOpen = open ?? !next.has(fieldId);
    if (shouldOpen) next.add(fieldId);
    else next.delete(fieldId);
    this.expanded.set(next);
  }

  protected onChipClick(facet: SearchFacet) {
    this.open.set(false);
    this.chipClick.emit(facet);
  }

  protected remove(facet: SearchFacet) {
    this.facets.update((facets) => facets.filter((item) => item !== facet));
    // Keep the keyboard focus in the box, but do not open the list: removing a chip is not a request to search (owner 2026-11-21).
    this.focus(false);
    this.open.set(false);
  }

  protected clearAll() {
    this.facets.set([]);
    this.clearText();
    this.open.set(false);
  }

  /** The DOM value is cleared too: when the signal already holds '' the binding would not write it again. */
  private clearText() {
    this.text.set('');
    this.input().nativeElement.value = '';
  }

  /** Skips the open-on-focus once when the box is focused by code (after removing a chip or adding a facet). */
  private quietFocus = false;

  protected focus(openList = true) {
    const input = this.input().nativeElement;
    if (!openList) this.quietFocus = true;
    input.focus();
    this.quietFocus = false;
    if (openList) this.open.set(true);
  }

  protected onFocus() {
    if (!this.quietFocus) this.open.set(true);
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private add(field: string, label: string, values: SearchOption[]) {
    this.facets.update((facets) => addToFacets(facets, field, label, values));
    this.clearText();
    this.open.set(false);
    this.focus(false);
  }

  private isPresetOn(value: string) {
    return this.facets().some((facet) => facet.field === PRESET_FIELD && facet.values.some((item) => item.value === value));
  }

  private caretAtEnd() {
    const element = this.input().nativeElement;
    return element.selectionStart === element.value.length;
  }

  private isRtl() {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }
}
