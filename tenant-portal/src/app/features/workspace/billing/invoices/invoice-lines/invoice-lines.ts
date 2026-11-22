import { Component, input, signal } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerChevronRight } from '@ng-icons/tabler-icons';
import { InvoiceLine } from '../../billing.model';
import { formatAmount, formatUnitPrice, formatUsd } from '../../shared/money';

@Component({
  selector: 'app-invoice-lines',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' }, { scope: 'ws-billing-invoices', alias: 'binv' }),
    provideIcons({ tablerChevronDown, tablerChevronRight }),
  ],
  templateUrl: './invoice-lines.html',
  host: { class: 'block min-w-0' },
})
export class InvoiceLines {
  readonly lines = input.required<InvoiceLine[]>();
  readonly currencyCode = input.required<string>();

  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly formatAmount = formatAmount;
  protected readonly formatUnitPrice = formatUnitPrice;
  protected readonly formatUsd = formatUsd;

  protected isExpandable(line: InvoiceLine): boolean {
    return (
      (line.sourceKind === 'APPLICATION' || line.sourceKind === 'ADDON') &&
      line.acceptedPricingSnapshot !== null
    );
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected toggle(id: string): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
