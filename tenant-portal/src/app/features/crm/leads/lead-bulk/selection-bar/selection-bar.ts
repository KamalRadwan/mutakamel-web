import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import { LeadSearchBody } from '../../lead-search/lead-search.compile';
import { SELECTION_LIMIT, SelectedRow } from '../lead-bulk.model';
import { LeadSelection } from '../lead-selection';

@Component({
  selector: 'app-lead-selection-bar',
  imports: [TranslocoPipe, Button],
  providers: [provideTranslocoScope('leads', { scope: 'record-related', alias: 'recordRelated' }, { scope: 'lead-bulk-bar', alias: 'bulkBar' })],
  templateUrl: './selection-bar.html',
  host: { class: 'block shrink-0' },
})
export class SelectionBar {
  protected readonly selection = inject(LeadSelection);

  readonly body = input<LeadSearchBody>({ branchId: '' });
  readonly pageRows = input<readonly SelectedRow[]>([]);
  readonly total = input(0);
  readonly visibleIds = input<Set<string> | null>(null);

  private readonly pageRowIds = computed(() => this.pageRows().map((row) => row.id));

  private readonly resolvedVisibleIds = computed<Set<string> | null>(() => {
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

  protected readonly tooMany = computed(() => this.total() > SELECTION_LIMIT);
  protected readonly allTotal = computed(() => this.selection.allTotal() || this.total());

  protected selectAllMatching(): void {
    if (this.tooMany()) return;
    this.selection.selectAllMatching(this.body(), this.total());
  }

  protected selectOnlyPage(): void {
    this.selection.replaceWith([...this.pageRows()]);
  }

  protected clear(): void {
    this.selection.clear();
  }
}
