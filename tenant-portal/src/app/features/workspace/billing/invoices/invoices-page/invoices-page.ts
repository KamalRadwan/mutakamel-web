import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCreditCard,
  tablerEye,
  tablerFileInvoice,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import {
  ApiError,
  PAYABLE_INVOICE_STATUSES,
  TenantInvoiceView,
  correlationIdOf,
  listInvoices,
} from '../../billing.api';
import { invoicePurposeBadge, invoiceStatusBadge } from '../../shared/billing-badges';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { formatAmount, formatUsd } from '../../shared/money';
import { apiErrorCodeOf, formatInvoiceDate, formatInvoicePeriod } from '../invoice-dates';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100];
const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | null | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-billing-invoices-page',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Pagination, BillingFailed, BillingForbidden],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' }, { scope: 'ws-billing-invoices', alias: 'binv' }),
    provideIcons({ tablerCreditCard, tablerEye, tablerFileInvoice, tablerRefresh }),
  ],
  templateUrl: './invoices-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class InvoicesPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(BillingSession);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly page = linkedSignal<string | null | undefined, number>({
    source: () => this.queryParams()?.get('page'),
    computation: (raw, previous) => {
      if (raw !== previous?.source) return parsePositiveInt(raw, DEFAULT_PAGE);
      return previous?.value ?? parsePositiveInt(raw, DEFAULT_PAGE);
    },
  });

  protected readonly pageSize = linkedSignal<string | null | undefined, number>({
    source: () => this.queryParams()?.get('size'),
    computation: (raw, previous) => {
      if (raw !== previous?.source) return parsePageSize(raw);
      return previous?.value ?? parsePageSize(raw);
    },
  });

  protected readonly rows = signal<TenantInvoiceView[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly forbidden = signal(!this.session.isOwner());
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  private readonly reloadTick = signal(0);

  protected readonly statusBadge = invoiceStatusBadge;
  protected readonly purposeBadge = invoicePurposeBadge;
  protected readonly formatUsd = formatUsd;
  protected readonly formatAmount = formatAmount;

  private loadSeq = 0;

  protected readonly canRenderContent = computed(
    () => this.session.isOwner() && !this.forbidden(),
  );

  constructor() {
    let lastPage = this.page();
    effect(() => {
      const currentPage = this.page();
      if (currentPage === lastPage) return;
      lastPage = currentPage;
      this.host.nativeElement.scrollTo({ top: 0 });
    });

    effect(() => {
      const page = this.page();
      const limit = this.pageSize();
      this.reloadTick();

      if (!this.session.isOwner()) {
        untracked(() => {
          this.forbidden.set(true);
          this.loading.set(false);
        });
        return;
      }

      untracked(() => void this.load(page, limit));
    });
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected onPageChange(next: number): void {
    const target = Math.max(DEFAULT_PAGE, next);
    this.page.set(target);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: target === DEFAULT_PAGE ? null : target },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(next: number): void {
    if (!PAGE_SIZES.includes(next)) return;
    this.pageSize.set(next);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: next === DEFAULT_PAGE_SIZE ? null : next,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected formatDate(iso: string | null): string {
    return formatInvoiceDate(iso, this.language());
  }

  protected formatPeriod(start: string | null, end: string | null): string {
    return formatInvoicePeriod(start, end, this.language());
  }

  protected isPayable(inv: TenantInvoiceView): boolean {
    return inv.canonicalUsd && PAYABLE_INVOICE_STATUSES.includes(inv.status);
  }

  protected actionsFor(inv: TenantInvoiceView): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('bill.common.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.isPayable(inv)) {
      items.push({
        id: 'pay',
        title: this.transloco.translate('bill.common.pay'),
        icon: 'tablerCreditCard',
        tile: 'bg-icon-violet',
      });
    }

    return items;
  }

  protected onAction(inv: TenantInvoiceView, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openInvoice(inv, false);
    } else if (selection.id === 'pay') {
      this.openInvoice(inv, true);
    }
  }

  protected onRowKeydown(event: KeyboardEvent, inv: TenantInvoiceView): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.openInvoice(inv, false);
    }
  }

  protected openInvoice(inv: TenantInvoiceView, pay = false): void {
    const listQuery: Record<string, string | number> = {};
    if (this.page() > DEFAULT_PAGE) listQuery['page'] = this.page();
    if (this.pageSize() !== DEFAULT_PAGE_SIZE) listQuery['size'] = this.pageSize();

    void this.router.navigate(['/workspace/billing/invoices', inv.id], {
      queryParams: pay ? { pay: '1' } : undefined,
      state: Object.keys(listQuery).length > 0 ? { listQuery } : undefined,
    });
  }

  private async load(page: number, limit: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const res = await listInvoices({ page, limit });
      if (seq !== this.loadSeq) return;
      this.forbidden.set(false);
      this.rows.set(res.items);
      this.total.set(res.meta.total);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = apiErrorCodeOf(error);
      if ((error instanceof ApiError && error.status === 403) || code === 'TENANT_OWNER_REQUIRED') {
        this.forbidden.set(true);
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
