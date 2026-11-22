import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerCreditCard,
  tablerFileDescription,
  tablerFileInvoice,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { NotFoundPage } from '../../../../../layout/not-found/not-found-page';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import {
  ApiError,
  InvoiceRead,
  PAYABLE_INVOICE_STATUSES,
  correlationIdOf,
  getInvoice,
} from '../../billing.api';
import { invoicePurposeBadge, invoiceStatusBadge } from '../../shared/billing-badges';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { formatAmount, formatUsd } from '../../shared/money';
import { apiErrorCodeOf, formatInvoiceDate } from '../invoice-dates';
import { InvoiceLines } from '../invoice-lines/invoice-lines';
import { PayModal } from '../pay-modal/pay-modal';

let nextInvoicePageId = 0;

function readListQueryFromHistory(): Record<string, unknown> | null {
  const state = typeof history !== 'undefined' ? (history.state as Record<string, unknown> | null) : null;
  const listQuery = state?.['listQuery'];
  return listQuery && typeof listQuery === 'object' ? (listQuery as Record<string, unknown>) : null;
}

@Component({
  selector: 'app-billing-invoice-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Field,
    NotFoundPage,
    BillingFailed,
    BillingForbidden,
    InvoiceLines,
    PayModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' }, { scope: 'ws-billing-invoices', alias: 'binv' }),
    provideIcons({
      tablerArrowLeft,
      tablerCreditCard,
      tablerFileDescription,
      tablerFileInvoice,
    }),
  ],
  templateUrl: './invoice-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12' },
})
export class InvoicePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(BillingSession);
  private readonly language = inject(LanguageState).current;

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly payModal = viewChild(PayModal);

  protected readonly uid = `invoice-page-${++nextInvoicePageId}`;
  protected readonly invoiceId = computed(() => this.paramMap()?.get('id') ?? '');
  protected readonly payParam = computed(() => this.queryParams()?.get('pay') === '1');

  protected readonly data = signal<InvoiceRead | null>(null);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(!this.session.isOwner());
  protected readonly notFound = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  private readonly reloadTick = signal(0);

  protected readonly invoice = computed(() => this.data()?.invoice ?? null);
  protected readonly statusBadge = invoiceStatusBadge;
  protected readonly purposeBadge = invoicePurposeBadge;
  protected readonly formatAmount = formatAmount;
  protected readonly formatUsd = formatUsd;

  protected readonly canRenderContent = computed(
    () => this.session.isOwner() && !this.forbidden(),
  );

  protected readonly canPay = computed(() => {
    const inv = this.invoice();
    if (!inv) return false;
    return PAYABLE_INVOICE_STATUSES.includes(inv.status) && inv.settlementTotalUsd !== null;
  });

  protected readonly showSettlementCurrency = computed(() => {
    const inv = this.invoice();
    return inv !== null && inv.settlementCurrencyCode !== inv.currencyCode;
  });

  protected readonly showSettlementTotals = computed(() => {
    const inv = this.invoice();
    return (
      inv !== null &&
      inv.currencyCode !== 'USD' &&
      (inv.settlementSubtotalUsd !== null ||
        inv.settlementTaxTotalUsd !== null ||
        inv.settlementTotalUsd !== null)
    );
  });

  private readonly listQuery = readListQueryFromHistory();
  private loadSeq = 0;
  private handledPayForId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.invoiceId();
      this.reloadTick();

      if (!this.session.isOwner()) {
        untracked(() => {
          this.forbidden.set(true);
          this.loading.set(false);
        });
        return;
      }

      if (!id) {
        untracked(() => {
          this.notFound.set(true);
          this.loading.set(false);
        });
        return;
      }

      untracked(() => void this.load(id));
    });

    effect(() => {
      const wantPay = this.payParam();
      const loading = this.loading();
      const inv = this.invoice();
      const modal = this.payModal();

      if (!wantPay) {
        this.handledPayForId = null;
        return;
      }
      if (loading || !inv || !modal) return;
      if (this.handledPayForId === inv.id) return;

      this.handledPayForId = inv.id;
      untracked(() => {
        if (this.canPay()) {
          modal.open(inv.id, inv.number);
        } else {
          this.clearPayParam();
        }
      });
    });
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected goBack(): void {
    void this.router.navigate(['/workspace/billing/invoices'], {
      queryParams: this.listQuery ?? undefined,
    });
  }

  protected openPayModal(): void {
    const inv = this.invoice();
    if (!inv || !this.canPay()) return;
    this.payModal()?.open(inv.id, inv.number);
  }

  protected onPayModalClosed(): void {
    if (this.payParam()) {
      this.clearPayParam();
    }
  }

  protected formatDate(iso: string | null): string {
    return formatInvoiceDate(iso, this.language());
  }

  private clearPayParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pay: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
      state: this.listQuery ? { listQuery: this.listQuery } : undefined,
    });
  }

  private async load(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const result = await getInvoice(id);
      if (seq !== this.loadSeq) return;
      this.forbidden.set(false);
      this.data.set(result);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.data.set(null);
      const code = apiErrorCodeOf(error);
      if ((error instanceof ApiError && error.status === 403) || code === 'TENANT_OWNER_REQUIRED') {
        this.forbidden.set(true);
        return;
      }
      if ((error instanceof ApiError && error.status === 404) || code === 'INVOICE_NOT_FOUND') {
        this.notFound.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.correlationId.set(correlationIdOf(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
