import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronLeft,
  tablerChevronRight,
  tablerChevronsLeft,
  tablerChevronsRight,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

export type PaginationItem =
  { kind: 'page'; page: number; key: string } | { kind: 'ellipsis'; key: string };

@Component({
  selector: 'ui-pagination',
  imports: [NgIcon, TranslocoPipe, Dropdown],
  viewProviders: [provideTranslocoScope({ scope: 'ui-pagination', alias: 'pagination' })],
  providers: [
    provideIcons({
      tablerChevronLeft,
      tablerChevronRight,
      tablerChevronsLeft,
      tablerChevronsRight,
    }),
  ],
  templateUrl: './pagination.html',
  host: { class: 'block min-w-0' },
})
export class Pagination {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly total = input.required<number>();
  readonly page = model.required<number>();
  readonly pageSize = model.required<number>();
  readonly pageSizes = input<number[]>([12, 24, 48, 96]);
  readonly label = input('');

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(Math.max(0, this.total()) / Math.max(1, this.pageSize()))),
  );

  protected readonly currentPage = computed(() =>
    Math.min(Math.max(1, this.page()), this.totalPages()),
  );

  protected readonly rangeStart = computed(() =>
    this.total() <= 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  protected readonly rangeEnd = computed(() =>
    this.total() <= 0 ? 0 : Math.min(this.total(), this.currentPage() * this.pageSize()),
  );

  protected readonly ariaLabel = computed(() => {
    this.i18n();
    return this.label() || this.transloco.translate('pagination.label');
  });

  protected readonly items = computed<PaginationItem[]>(() => {
    const last = this.totalPages();
    const current = this.currentPage();
    const pages = Array.from(
      new Set([1, current - 1, current, current + 1, last].filter((p) => p >= 1 && p <= last)),
    ).sort((a, b) => a - b);

    const list: PaginationItem[] = [];
    let prev = 0;
    for (const p of pages) {
      if (prev > 0 && p - prev > 1) {
        list.push({ kind: 'ellipsis', key: `e-${prev}` });
      }
      list.push({ kind: 'page', page: p, key: `p-${p}` });
      prev = p;
    }
    return list;
  });

  protected readonly sizeOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    return this.pageSizes().map((count) => ({
      value: count,
      label: this.transloco.translate('pagination.perPage', { count }),
    }));
  });

  protected goTo(target: number) {
    const clamped = Math.min(Math.max(1, target), this.totalPages());
    if (clamped !== this.page()) {
      this.page.set(clamped);
    }
  }

  protected changePageSize(size: number) {
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
    }
  }
}
