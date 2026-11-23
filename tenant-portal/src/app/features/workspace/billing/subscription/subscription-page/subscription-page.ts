import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerRefresh, tablerRepeat } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Field } from '../../../../../shared/ui/field/field';
import { Button } from '../../../../../shared/ui/button/button';
import { getSeatUsage } from '../../../seats/seats.api';
import { SeatUsage } from '../../../seats/seats.model';
import {
  ApiError,
  BillingApi,
  billingErrorMessage,
  BillingSummary,
  SubscriptionView,
  correlationIdOf,
} from '../../billing.api';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { accessModeBadge, subscriptionStatusBadge } from '../../shared/billing-badges';
import { BillingSession } from '../../shared/billing-session';
import { formatUsd } from '../../shared/money';
import { SeatsSection } from '../../seats/seats-section/seats-section';
import { hasChangeJournal } from '../change-journal';
import { ItemsTable } from '../items-table/items-table';

const SKELETON_GRID_FIELDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const SKELETON_TABLE_ROWS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-billing-subscription-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    Field,
    BillingForbidden,
    BillingFailed,
    ItemsTable,
    SeatsSection,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'ws-billing', alias: 'bill' },
      { scope: 'ws-billing-subscription', alias: 'bsub' },
    ),
    provideIcons({ tablerArrowRight, tablerRefresh, tablerRepeat }),
  ],
  templateUrl: './subscription-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12' },
})
export class SubscriptionPage {
  private static nextId = 0;
  protected readonly uid = `billing-sub-${++SubscriptionPage.nextId}`;

  private readonly router = inject(Router);
  private readonly api = inject(BillingApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(BillingSession);
  private readonly language = inject(LanguageState).current;

  protected readonly skeletonFields = SKELETON_GRID_FIELDS;
  protected readonly skeletonRows = SKELETON_TABLE_ROWS;
  protected readonly formatUsd = formatUsd;

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly empty = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  protected readonly subscription = signal<SubscriptionView | null>(null);
  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly seatUsage = signal<SeatUsage | null>(null);
  protected readonly hasUnfinishedChange = signal(hasChangeJournal());

  private loadSeq = 0;

  protected readonly forbidden = signal(false);

  protected get isOwner(): boolean {
    return !this.forbidden() && this.session.isOwner();
  }

  protected readonly statusBadge = computed(() => {
    const sub = this.subscription();
    return sub ? subscriptionStatusBadge(sub.subscription.status) : null;
  });

  protected readonly accessBadge = computed(() => {
    const sum = this.summary();
    return sum ? accessModeBadge(sum.subscription.accessMode) : null;
  });

  protected readonly changeDisabled = computed(() => {
    if (this.summary()?.subscription.accessMode === 'DUNNING') return true;
    const sub = this.subscription()?.subscription;
    if (!sub) return true;
    if (sub.currentCollectionInvoiceId) return true;
    return sub.status !== 'TRIAL' && sub.status !== 'ACTIVE';
  });

  protected readonly changeDisabledReasonKey = computed<string | null>(() => {
    if (this.summary()?.subscription.accessMode === 'DUNNING') return 'bsub.dunning.settleFirst';
    const sub = this.subscription()?.subscription;
    if (!sub) return null;
    if (sub.currentCollectionInvoiceId) {
      return 'bsub.toolbar.disabledReasons.collection';
    }
    if (sub.status !== 'TRIAL' && sub.status !== 'ACTIVE') {
      return `bsub.toolbar.disabledReasons.${sub.status}`;
    }
    return null;
  });

  protected readonly cycleUnitKey = computed(() =>
    this.subscription()?.subscription.billingCycle === 'ANNUAL'
      ? 'bill.common.perYear'
      : 'bill.common.perMonth',
  );

  constructor() {
    if (this.isOwner) {
      void this.load();
    }
  }

  protected reload(): void {
    if (!this.isOwner) return;
    this.hasUnfinishedChange.set(hasChangeJournal());
    void this.load();
  }

  protected goToChange(): void {
    if (this.changeDisabled()) return;
    void this.router.navigate(['/workspace/billing/subscription/change']);
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    this.empty.set(false);
    this.correlationId.set(null);
    this.hasUnfinishedChange.set(hasChangeJournal());

    try {
      const [sub, sum, usage] = await Promise.all([
        this.api.getSubscription(),
        this.api.getBillingSummary(),
        getSeatUsage().catch(() => null),
      ]);
      if (seq !== this.loadSeq) return;
      this.subscription.set(sub);
      this.summary.set(sum);
      this.seatUsage.set(usage);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 404) {
        this.subscription.set(null);
        this.empty.set(true);
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        this.forbidden.set(true);
        return;
      }
      this.failed.set(true);
      this.correlationId.set(correlationIdOf(error));
      if (error instanceof ApiError && error.status === 0) {
        this.notify.error(billingErrorMessage(error, this.transloco));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
