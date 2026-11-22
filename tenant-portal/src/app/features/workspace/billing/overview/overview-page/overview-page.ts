import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowRight,
  tablerArrowsExchange,
  tablerCircleCheck,
  tablerCreditCard,
  tablerExclamationCircle,
  tablerFileInvoice,
  tablerRepeat,
  tablerWallet,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import {
  ApiError,
  BillingSummary,
  PAYABLE_INVOICE_STATUSES,
  TenantInvoiceView,
  correlationIdOf,
  getBillingSummary,
} from '../../billing.api';
import {
  accessModeBadge,
  invoiceStatusBadge,
  subscriptionStatusBadge,
  walletStatusBadge,
} from '../../shared/billing-badges';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { formatUsd } from '../../shared/money';
import { LedgerTable } from '../ledger-table/ledger-table';
import { formatBillingDate } from '../overview-dates';
import { PaymentsTable } from '../payments-table/payments-table';
import { TopupModal } from '../topup-modal/topup-modal';

type OverviewTab = 'payments' | 'wallet';

interface OverviewTabItem {
  readonly id: OverviewTab;
  readonly icon: string;
  readonly labelKey: string;
}

const OVERVIEW_TABS: readonly OverviewTabItem[] = [
  { id: 'payments', icon: 'tablerCreditCard', labelKey: 'bov.tabs.payments' },
  { id: 'wallet', icon: 'tablerArrowsExchange', labelKey: 'bov.tabs.wallet' },
];

@Component({
  selector: 'app-billing-overview-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    BillingFailed,
    BillingForbidden,
    LedgerTable,
    PaymentsTable,
    TopupModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'ws-billing', alias: 'bill' },
      { scope: 'ws-billing-overview', alias: 'bov' },
    ),
    provideIcons({
      tablerRepeat,
      tablerWallet,
      tablerFileInvoice,
      tablerCircleCheck,
      tablerArrowRight,
      tablerExclamationCircle,
      tablerCreditCard,
      tablerArrowsExchange,
    }),
  ],
  templateUrl: './overview-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12' },
})
export class OverviewPage {
  private static nextId = 0;
  protected readonly uid = `billing-overview-${++OverviewPage.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(BillingSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly topupModal = viewChild(TopupModal);
  private readonly tabBtns = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  private readonly reservedTipRef = viewChild<ElementRef<HTMLElement>>('reservedTip');

  protected readonly tabs = OVERVIEW_TABS;
  protected readonly skeletonCards = [0, 1, 2] as const;

  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  protected readonly tablesReloadToken = signal(0);
  protected readonly reservedTipPlace = signal({ top: 0, start: 0 });
  protected readonly reservedTipPlaced = signal(false);

  protected readonly activeTab = computed<OverviewTab>(() =>
    this.queryParams()?.get('tab') === 'wallet' ? 'wallet' : 'payments',
  );

  protected readonly formatUsd = formatUsd;
  protected readonly subscriptionStatusBadge = subscriptionStatusBadge;
  protected readonly accessModeBadge = accessModeBadge;
  protected readonly walletStatusBadge = walletStatusBadge;
  protected readonly invoiceStatusBadge = invoiceStatusBadge;

  private loadSeq = 0;
  private lastHandledTopup: string | null = null;

  constructor() {
    if (this.session.isOwner()) {
      void this.loadSummary();
    } else {
      this.loading.set(false);
    }

    effect(() => {
      const params = this.queryParams();
      const summary = this.summary();
      const modal = this.topupModal();

      if (!params?.has('topup')) {
        this.lastHandledTopup = null;
        return;
      }
      if (!this.isOwner() || !summary || !modal) return;

      const raw = params.get('topup') ?? '';
      if (this.lastHandledTopup === raw) return;
      this.lastHandledTopup = raw;

      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { topup: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        if (summary.wallet.status !== 'ACTIVE') {
          this.notify.warning(this.transloco.translate('bill.errors.WALLET_NOT_ACTIVE'));
          return;
        }
        modal.open({ amount: raw, currentBalanceUsd: summary.wallet.balanceUsd });
      });
    });
  }

  protected isOwner(): boolean {
    return !this.forbidden() && this.session.isOwner();
  }

  protected async loadSummary(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const data = await getBillingSummary();
      if (seq !== this.loadSeq) return;
      this.summary.set(data);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.code === 'TENANT_OWNER_REQUIRED') {
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

  protected openTopup(): void {
    const current = this.summary();
    if (!current || current.wallet.status !== 'ACTIVE') return;
    this.topupModal()?.open({ currentBalanceUsd: current.wallet.balanceUsd });
  }

  protected onTopupCompleted(): void {
    void this.loadSummary();
    this.tablesReloadToken.update((n) => n + 1);
  }

  protected selectTab(tab: OverviewTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    const buttons = this.tabBtns();
    if (!buttons.length) return;

    const activeEl = this.document.activeElement;
    let currentIdx = buttons.findIndex((ref) => ref.nativeElement === activeEl);
    if (currentIdx < 0) {
      currentIdx = buttons.findIndex((ref) => ref.nativeElement.getAttribute('aria-selected') === 'true');
    }
    if (currentIdx < 0) currentIdx = 0;

    const rtl = this.language() === 'ar';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === nextKey) nextIdx = (currentIdx + 1) % buttons.length;
    else if (event.key === prevKey) nextIdx = (currentIdx - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = buttons.length - 1;
    else return;

    event.preventDefault();
    const target = buttons[nextIdx]?.nativeElement;
    if (target) {
      target.focus();
      target.click();
    }
  }

  protected canPayInvoice(inv: TenantInvoiceView): boolean {
    return inv.canonicalUsd && PAYABLE_INVOICE_STATUSES.includes(inv.status);
  }

  protected formatDate(iso: string | null | undefined): string {
    return formatBillingDate(iso, this.language());
  }

  protected placeReservedTip(triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipEl = this.reservedTipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 220, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.reservedTipPlace.set({ top, start });
    this.reservedTipPlaced.set(true);
  }

  protected hideReservedTip(): void {
    this.reservedTipPlaced.set(false);
  }
}
