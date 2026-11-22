import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsSort, tablerPlus, tablerRefresh, tablerSearch, tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { StaffListFilter, StaffListSortOption } from '../staff.model';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZES = [20, 50, 100];

interface ActiveChip {
  id: string;
  filterLabel: string;
  valueLabel: string;
}

@Component({
  selector: 'app-staff-list',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Pagination],
  providers: [provideIcons({ tablerArrowsSort, tablerPlus, tablerRefresh, tablerSearch, tablerX })],
  templateUrl: './staff-list.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class StaffList {
  private static nextId = 0;
  protected readonly uid = `staff-list-${++StaffList.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly addLabel = input('');
  readonly showAdd = input(true);
  readonly addDisabled = input(false);
  readonly addHint = input<string | null>(null);
  readonly searchPlaceholder = input.required<string>();
  readonly loading = input(false);
  readonly total = input(0);
  readonly filters = input<StaffListFilter[]>([]);
  readonly sortOptions = input<StaffListSortOption[]>([]);

  readonly search = model('');
  readonly page = model(1);
  readonly pageSize = model(20);
  readonly sort = model('');
  readonly filterValues = model<Record<string, string | null>>({});

  readonly add = output<void>();
  readonly reload = output<void>();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly draftSearch = signal('');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private prevFilterInputs = new Map<string, string | null>();

  protected readonly activeChips = computed<ActiveChip[]>(() => {
    const values = this.filterValues();
    const chips: ActiveChip[] = [];
    for (const filter of this.filters()) {
      const current = filter.id in values ? values[filter.id] : filter.value;
      if (!current) continue;
      const option = filter.options.find((o) => o.value === current);
      chips.push({
        id: filter.id,
        filterLabel: filter.label,
        valueLabel: option?.label ?? current,
      });
    }
    return chips;
  });

  protected readonly sortDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.sortOptions().map((o) => ({ value: o.value, label: o.label })),
  );

  protected readonly activeSortValue = computed(() => this.sort() || this.sortOptions()[0]?.value || '');

  constructor() {
    effect(() => {
      const filters = this.filters();
      untracked(() => {
        const current = this.filterValues();
        let changed = false;
        const next: Record<string, string | null> = { ...current };
        for (const f of filters) {
          const hadPrev = this.prevFilterInputs.has(f.id);
          const prevVal = this.prevFilterInputs.get(f.id) ?? null;
          if ((!hadPrev && !(f.id in current) && f.value !== null) || (hadPrev && prevVal !== f.value)) {
            next[f.id] = f.value ?? null;
            changed = true;
          }
          this.prevFilterInputs.set(f.id, f.value ?? null);
        }
        if (changed) {
          this.filterValues.set(next);
        }
      });
    });

    effect(() => {
      const external = this.search();
      untracked(() => {
        if (this.searchTimer === null && external !== this.draftSearch()) {
          this.draftSearch.set(external);
        }
      });
    });

    inject(DestroyRef).onDestroy(() => this.clearSearchTimer());
  }

  protected onAddClick(): void {
    if (!this.addDisabled()) {
      this.add.emit();
    }
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.draftSearch.set(next);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      if (this.search() !== next) {
        this.search.set(next);
        this.page.set(1);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.draftSearch.set('');
    if (this.search() !== '') {
      this.search.set('');
      this.page.set(1);
    }
  }

  protected filterDropdownOptions(filter: StaffListFilter): DropdownOption<string | null>[] {
    this.i18n();
    const allLabel = this.transloco.translate('staff.list.all');
    return [
      { value: null, label: `${filter.label}: ${allLabel}` },
      ...filter.options.map((o) => ({ value: o.value, label: o.label })),
    ];
  }

  protected currentFilterValue(filter: StaffListFilter): string | null {
    const values = this.filterValues();
    return filter.id in values ? values[filter.id] : (filter.value ?? null);
  }

  protected onFilterChange(filterId: string, nextValue: string | null): void {
    const prev = this.filterValues();
    const current = filterId in prev ? prev[filterId] : (this.filters().find((f) => f.id === filterId)?.value ?? null);
    if (current === nextValue) return;
    this.filterValues.set({ ...prev, [filterId]: nextValue });
    this.page.set(1);
  }

  protected clearAllFilters(): void {
    const next: Record<string, string | null> = { ...this.filterValues() };
    for (const filter of this.filters()) {
      next[filter.id] = null;
    }
    this.filterValues.set(next);
    this.page.set(1);
  }

  protected onSortChange(nextSort: string): void {
    if (nextSort === this.sort()) return;
    this.sort.set(nextSort);
    this.page.set(1);
  }

  protected onPageSizeChange(nextSize: number): void {
    if (nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(1);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
