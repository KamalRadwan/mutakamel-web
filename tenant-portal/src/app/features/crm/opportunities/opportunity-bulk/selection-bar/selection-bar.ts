import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import type { OpportunitySearchBody } from '../../opportunities.model';
import { translateOpportunityBulkError } from '../bulk-runner';
import {
  OPPORTUNITY_SELECTION_LIMIT,
  OpportunitySelection,
  type OpportunitySelectionRow,
} from '../opportunity-selection';
import { errorCodeOf } from '../../../settings/shared/settings-api';

@Component({
  selector: 'app-opportunity-selection-bar',
  imports: [TranslocoPipe, PluralKeyPipe, Button],
  viewProviders: [provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' })],
  templateUrl: './selection-bar.html',
  host: { class: 'block shrink-0' },
})
export class OpportunitySelectionBar {
  protected readonly selection = inject(OpportunitySelection);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  readonly body = input<OpportunitySearchBody>({ branchId: '' });
  readonly pageRows = input<readonly OpportunitySelectionRow[]>([]);
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

  protected readonly tooMany = computed(() => this.total() > OPPORTUNITY_SELECTION_LIMIT);
  protected readonly allTotal = computed(() => this.selection.allTotal() || this.total());

  protected async selectAllMatching(): Promise<void> {
    if (this.tooMany() || this.selection.selectingAll()) return;
    try {
      const res = await this.selection.selectAllMatching(this.body(), this.total());
      if (res.truncated) {
        this.notify.warning(this.transloco.translate('oppBulk.bar.truncated'));
      }
    } catch (error) {
      this.notify.error(translateOpportunityBulkError(this.transloco, errorCodeOf(error)));
    }
  }

  protected selectOnlyPage(): void {
    this.selection.replaceWith(this.pageRows());
  }

  protected clear(): void {
    this.selection.clear();
  }
}
