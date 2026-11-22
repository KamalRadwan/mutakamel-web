import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../../shared/ui/button/button';
import {
  ACCOUNT_SELECTION_LIMIT,
  type AccountListFilter,
  AccountSelection,
  type AccountSelectionRow,
} from '../account-selection';

@Component({
  selector: 'app-account-selection-bar',
  imports: [TranslocoPipe, Button],
  providers: [provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-accounts-bulk', alias: 'accountsBulk' })],
  templateUrl: './account-selection-bar.html',
  host: { class: 'block shrink-0' },
})
export class AccountSelectionBar {
  private readonly injectedSelection = inject(AccountSelection, { optional: true });

  readonly selection = input<AccountSelection | null>(null);
  readonly filter = input<AccountListFilter>({});
  readonly pageRows = input<readonly AccountSelectionRow[]>([]);
  readonly total = input(0);
  readonly visibleIds = input<ReadonlySet<string> | null>(null);

  protected readonly resolvedSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly count = computed(() => this.resolvedSelection()?.count() ?? 0);
  protected readonly mode = computed<'ids' | 'all'>(() => this.resolvedSelection()?.mode() ?? 'ids');

  private readonly pageRowIds = computed(() => this.pageRows().map((row) => row.id));

  private readonly resolvedVisibleIds = computed<ReadonlySet<string> | null>(() => {
    const explicit = this.visibleIds();
    if (explicit !== null) return explicit;
    const ids = this.pageRowIds();
    return ids.length > 0 ? new Set(ids) : null;
  });

  protected readonly hidden = computed(
    () => this.resolvedSelection()?.hiddenCount(this.resolvedVisibleIds()) ?? 0,
  );

  protected readonly canOfferSelectAll = computed(() => {
    const sel = this.resolvedSelection();
    if (!sel || sel.mode() !== 'ids' || this.total() <= 0) return false;
    const rows = this.pageRows();
    if (rows.length > 0) {
      return sel.pageState(this.pageRowIds()) === 'all' && this.total() > rows.length;
    }
    return sel.count() > 0 && this.total() > sel.count();
  });

  protected readonly tooMany = computed(() => this.total() > ACCOUNT_SELECTION_LIMIT);
  protected readonly allTotal = computed(() => this.resolvedSelection()?.allTotal() || this.total());

  protected selectAllMatching(): void {
    if (this.tooMany()) return;
    this.resolvedSelection()?.selectAllMatching(this.filter(), this.total());
  }

  protected selectOnlyPage(): void {
    this.resolvedSelection()?.replaceWith([...this.pageRows()]);
  }

  protected clear(): void {
    this.resolvedSelection()?.clear();
  }
}
