import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { PaymentStatus, PaymentStatusView, correlationIdOf, listPayments } from '../../billing.api';
import { BILLING_BADGE_BASE, BillingBadge, paymentStatusBadge } from '../../shared/billing-badges';
import { formatAmount, formatUsd } from '../../shared/money';
import { formatBillingDateTime } from '../overview-dates';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const PAGE_SIZES = [20, 50, 100];

@Component({
  selector: 'app-billing-payments-table',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button, Pagination],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './payments-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class PaymentsTable {
  private readonly language = inject(LanguageState).current;

  readonly reloadToken = input(0);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly purposeBadgeClasses = `${BILLING_BADGE_BASE} bg-neutral-soft text-on-neutral-soft`;

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly items = signal<PaymentStatusView[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);

  protected readonly formatAmount = formatAmount;
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

  protected formatDateTime(iso: string): string {
    return formatBillingDateTime(iso, this.language());
  }

  protected statusBadge(status: PaymentStatus): BillingBadge {
    return paymentStatusBadge(status);
  }

  private async load(page: number, limit: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const res = await listPayments({ page, limit });
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
