import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { LedgerReason, WalletLedgerEntry, correlationIdOf, listWalletLedger } from '../../billing.api';
import { BillingBadge, ledgerReasonBadge } from '../../shared/billing-badges';
import { formatAmount, formatUsd, isZero } from '../../shared/money';
import { formatBillingDate } from '../overview-dates';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const PAGE_SIZES = [20, 50, 100];

@Component({
  selector: 'app-billing-ledger-table',
  imports: [NgIcon, TranslocoPipe, Button, Pagination],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './ledger-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class LedgerTable {
  private readonly language = inject(LanguageState).current;

  readonly reloadToken = input(0);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly items = signal<WalletLedgerEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);

  protected readonly formatUsd = formatUsd;

  private loadSeq = 0;

  constructor() {
    effect(() => {
      const page = this.page();
      const limit = this.pageSize();
      this.reloadToken();
      untracked(() => {
        void this.load(page, limit);
      });
    });
  }

  protected reload(): void {
    void this.load(this.page(), this.pageSize());
  }

  protected onPageSizeChange(size: number): void {
    if (!PAGE_SIZES.includes(size) || size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected formatDate(iso: string): string {
    return formatBillingDate(iso, this.language());
  }

  protected reasonBadge(reason: LedgerReason): BillingBadge {
    return ledgerReasonBadge(reason);
  }

  protected formattedDelta(entry: WalletLedgerEntry): string {
    const raw = entry.amountUsd.trim();
    const signedRaw =
      entry.direction === 'DEBIT' && !raw.startsWith('-') && !raw.startsWith('\u2212')
        ? `-${raw}`
        : raw;
    return formatUsd(signedRaw, { signed: true });
  }

  protected deltaToneClass(entry: WalletLedgerEntry): string {
    if (isZero(entry.amountUsd)) return 'text-text-muted';
    return entry.direction === 'CREDIT' ? 'text-success-text' : 'text-danger-text';
  }

  protected formattedSourceAmount(entry: WalletLedgerEntry): string | null {
    if (entry.sourceCurrencyCode === 'USD') return null;
    return formatAmount(entry.sourceAmount, entry.sourceCurrencyCode);
  }

  private async load(page: number, limit: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const res = await listWalletLedger({ page, limit });
      if (seq !== this.loadSeq) return;
      this.items.set(res.items);
      this.total.set(res.meta.total);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.correlationId.set(correlationIdOf(error));
      this.items.set([]);
      this.total.set(0);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
