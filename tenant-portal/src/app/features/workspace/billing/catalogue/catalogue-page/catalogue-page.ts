import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerApps, tablerRefresh } from '@ng-icons/tabler-icons';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Button } from '../../../../../shared/ui/button/button';
import { Notify } from '../../../../../core/notify/notify';
import { ApiError, BillingApi, billingErrorMessage, correlationIdOf } from '../../billing.api';
import { BillingCycle } from '../../billing.model';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { catalogueNames } from '../../shared/catalogue-names';
import { AppOfferCard } from '../app-offer-card/app-offer-card';
import {
  CatalogueAppGroup,
  CatalogueTooLargeError,
  PriceLadderTarget,
  filterAppGroups,
  groupCatalogueOffers,
  localizeCatalogueGroups,
  loadAllCatalogue,
} from '../catalogue.service';
import { PriceLadderModal } from '../price-ladder-modal/price-ladder-modal';

function isForbiddenError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 403 || error.code === 'TENANT_OWNER_REQUIRED')
  );
}

@Component({
  selector: 'app-billing-catalogue-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    Dropdown,
    Button,
    BillingForbidden,
    BillingFailed,
    AppOfferCard,
    PriceLadderModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'ws-billing', alias: 'bill' },
      { scope: 'ws-billing-catalogue', alias: 'bcat' },
    ),
    provideIcons({ tablerApps, tablerRefresh }),
  ],
  templateUrl: './catalogue-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12' },
})
export class CataloguePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(BillingSession);
  private readonly api = inject(BillingApi);
  private readonly notify = inject(Notify);
  private readonly i18n = translationEvents(this.transloco);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly priceLadderModal = viewChild(PriceLadderModal);

  private loadSeq = 0;

  protected readonly skeletonCards = [1, 2, 3];
  protected readonly loading = signal(false);
  protected readonly groups = signal<readonly CatalogueAppGroup[]>([]);
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  protected readonly apiForbidden = signal(false);
  protected readonly loadError = signal<unknown>(null);

  protected readonly isForbidden = computed(() => !this.session.isOwner() || this.apiForbidden());
  protected readonly failed = computed(() => !this.isForbidden() && this.loadError() !== null);
  protected readonly errorCorrelationId = computed(() => correlationIdOf(this.loadError()));
  protected readonly tooLarge = computed(() => this.loadError() instanceof CatalogueTooLargeError);

  protected readonly selectedAppKey = computed(() => {
    const raw = this.queryParams()?.get('app') ?? '';
    if (!raw) return '';
    return this.groups().some((group) => group.application.key === raw) ? raw : '';
  });

  private readonly localizedGroups = computed(() => {
    this.i18n();
    return localizeCatalogueGroups(this.groups(), catalogueNames(this.transloco));
  });

  protected readonly appFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('bcat.toolbar.allApplications') },
      ...this.localizedGroups().map((group) => ({
        value: group.application.key,
        label: group.application.name,
      })),
    ];
  });

  protected readonly visibleGroups = computed(() =>
    filterAppGroups(this.localizedGroups(), this.selectedAppKey()),
  );

  constructor() {
    if (this.session.isOwner()) {
      void this.load();
    }
  }

  protected onAppFilterChange(appKey: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { app: appKey || null },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    if (this.loading()) return;
    void this.load();
  }

  protected openPrices(target: PriceLadderTarget): void {
    this.priceLadderModal()?.open(target);
  }

  private async load(): Promise<void> {
    if (!this.session.isOwner()) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.apiForbidden.set(false);
    this.loadError.set(null);

    try {
      const [offers, subscription] = await Promise.all([
        loadAllCatalogue(this.api),
        this.api.getSubscription().catch(() => null),
      ]);
      if (seq !== this.loadSeq) return;
      this.notify.connectionRestored();
      this.cycle.set(subscription?.subscription.billingCycle ?? 'MONTHLY');
      this.groups.set(groupCatalogueOffers(offers, subscription));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.apiForbidden.set(true);
      } else {
        this.loadError.set(error);
        if (error instanceof ApiError && error.status === 0) {
          this.notify.connectionLost(billingErrorMessage(error, this.transloco), '');
        }
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
