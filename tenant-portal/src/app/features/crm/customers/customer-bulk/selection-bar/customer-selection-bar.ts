import { Component, computed, input, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import { CustomerSearchBody } from '../../customers.model';
import { CUSTOMER_SELECTION_LIMIT, CustomerBulkSort, SelectedCustomerRow } from '../customer-bulk.model';
import { CustomerSelection } from '../customer-selection';

@Component({
  selector: 'app-customer-selection-bar',
  imports: [TranslocoPipe, Button],
  templateUrl: './customer-selection-bar.html',
  host: { class: 'block shrink-0' },
})
export class CustomerSelectionBar {
  protected readonly selection = inject(CustomerSelection);

  readonly body = input.required<CustomerSearchBody>();
  readonly sort = input<CustomerBulkSort | null>(null);
  readonly pageRows = input<readonly SelectedCustomerRow[]>([]);
  readonly total = input(0);
  readonly visibleIds = input<ReadonlySet<string> | null>(null);

  private readonly pageRowIds = computed(() => this.pageRows().map((row) => row.id));

  private readonly resolvedVisibleIds = computed<ReadonlySet<string> | null>(() => {
    const explicit = this.visibleIds();
    if (explicit !== null) return explicit;
    const ids = this.pageRowIds();
    return ids.length > 0 ? new Set(ids) : null;
  });

  protected readonly hidden = computed(() => this.selection.hiddenCount(this.resolvedVisibleIds()));

  protected readonly canOfferSelectAll = computed(
    () =>
      this.selection.mode() === 'ids' &&
      this.pageRows().length > 0 &&
      this.selection.pageState(this.pageRowIds()) === 'all' &&
      this.total() > this.pageRows().length,
  );

  protected readonly tooMany = computed(() => this.total() > CUSTOMER_SELECTION_LIMIT);
  protected readonly allTotal = computed(() => this.selection.allTotal() || this.total());

  protected selectAllMatching(): void {
    if (this.tooMany()) return;
    this.selection.selectAllMatching(this.body(), this.total(), this.sort() ?? undefined);
  }

  protected selectOnlyPage(): void {
    this.selection.replaceWith(this.pageRows());
  }

  protected clear(): void {
    this.selection.clear();
  }
}
