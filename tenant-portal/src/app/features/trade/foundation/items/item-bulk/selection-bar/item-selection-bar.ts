import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../../shared/ui/button/button';
import {
  ITEM_BULK_SELECTION_LIMIT,
  type ItemBulkFilter,
  type SelectedItemRow,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';

@Component({
  selector: 'app-item-selection-bar',
  imports: [TranslocoPipe, Button],
  providers: [provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-items-bulk', alias: 'itemsBulk' })],
  templateUrl: './item-selection-bar.html',
  host: {
    '[class]': "selectedCount() > 0 ? 'block shrink-0' : 'hidden'",
  },
})
export class ItemSelectionBar {
  private readonly injectedSelection = inject(ItemSelection, { optional: true });

  readonly selection = input<ItemSelection | null>(null);
  readonly filter = input<ItemBulkFilter>({});
  readonly pageRows = input<readonly SelectedItemRow[]>([]);
  readonly total = input(0);
  readonly visibleIds = input<ReadonlySet<string> | null>(null);

  protected readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);
  protected readonly selectionMode = computed(() => this.activeSelection()?.mode() ?? 'ids');

  private readonly pageRowIds = computed(() => this.pageRows().map((row) => row.id));

  private readonly resolvedVisibleIds = computed<ReadonlySet<string> | null>(() => {
    const explicit = this.visibleIds();
    if (explicit !== null) return explicit;
    const ids = this.pageRowIds();
    return ids.length > 0 ? new Set(ids) : null;
  });

  protected readonly hidden = computed(() => this.activeSelection()?.hiddenCount(this.resolvedVisibleIds()) ?? 0);

  protected readonly canOfferSelectAll = computed(() => {
    const sel = this.activeSelection();
    if (!sel) return false;
    return (
      sel.mode() === 'ids' &&
      this.pageRows().length > 0 &&
      sel.pageState(this.pageRowIds()) === 'all' &&
      this.total() > this.pageRows().length
    );
  });

  protected readonly maxLimit = ITEM_BULK_SELECTION_LIMIT;
  protected readonly tooMany = computed(() => this.total() > ITEM_BULK_SELECTION_LIMIT);
  protected readonly allTotal = computed(() => this.activeSelection()?.allTotal() || this.total());

  protected selectAllMatching(): void {
    const sel = this.activeSelection();
    if (!sel || this.tooMany()) return;
    sel.selectAllMatching(this.filter(), this.total());
  }

  protected selectOnlyPage(): void {
    const sel = this.activeSelection();
    if (!sel) return;
    sel.replaceWith(this.pageRows());
  }

  protected clear(): void {
    this.activeSelection()?.clear();
  }
}
