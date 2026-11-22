import { Component, ElementRef, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import { TradeItemPicker } from '../../../shared/pickers/item-picker/item-picker';
import type { TradeContext } from '../../../shared/trade-api';
import { formatQty } from '../../../shared/trade-format';
import { getItemSummary } from '../../../shared/trade-foundation.api';
import type { ItemSummary, TaxDefault } from '../../../shared/trade-foundation.model';

export interface ItemCellPick {
  itemId: string | null;
  summary: ItemSummary | null;
}

@Component({
  selector: 'app-item-cell',
  imports: [TradeItemPicker, TranslocoPipe],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-lines', alias: 'tdlines' },
    ),
  ],
  templateUrl: './item-cell.html',
  host: { class: 'block min-w-0 w-full' },
})
export class ItemCell {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  private loadSeq = 0;

  readonly itemId = input<string | null>(null);
  readonly itemLabel = input<string>('');
  readonly purpose = input.required<'SALES' | 'PURCHASE'>();
  readonly context = input.required<TradeContext>();
  readonly editable = input(true);
  readonly disabled = input(false);
  readonly showTaxDefault = input(false);
  readonly taxDefault = input<TaxDefault | null | undefined>(undefined);
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);

  readonly picked = output<ItemCellPick>();

  protected readonly formatQty = formatQty;

  focus(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  }

  protected async onValueChange(nextId: string | null): Promise<void> {
    if (nextId === this.itemId()) return;
    const seq = ++this.loadSeq;

    if (!nextId) {
      this.picked.emit({ itemId: null, summary: null });
      return;
    }

    try {
      const summary = await getItemSummary(this.context(), nextId);
      if (seq !== this.loadSeq) return;
      this.picked.emit({ itemId: nextId, summary });
    } catch {
      if (seq !== this.loadSeq) return;
      this.notify.error(this.transloco.translate('td.errors.generic'));
      this.picked.emit({ itemId: nextId, summary: null });
    }
  }
}
