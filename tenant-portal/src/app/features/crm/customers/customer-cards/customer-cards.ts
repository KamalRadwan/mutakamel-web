import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerSearch, tablerUsers } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { listPageSizes } from '../../shared/lookups/page-sizes';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { ApiError } from '../../settings/shared/settings-api';
import {
  DEFAULT_LIST_PAGE_SIZE,
  DEFAULT_LIST_PAGE_SIZES,
  createListPageSize,
} from '../../shared/record/list/page-size';
import {
  CustomerCard,
  canCreateCustomer,
  canDeleteCustomer,
  canUpdateCustomer,
  customerErrorMessage,
  customerReadState,
  customerNeedsReload,
  customerReadOnlyError,
} from '../customer-card/customer-card';
import {
  deleteCustomer,
  searchCustomers,
  setCustomerColor,
  setCustomerRating,
} from '../customers.api';
import {
  CardColor,
  CustomerCapabilities,
  CustomerRow,
  CustomerSearchBody,
  CustomerStatus,
  SearchResponse,
} from '../customers.model';

@Component({
  selector: 'app-customer-cards',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, FullState, Pagination, CustomerCard],
  providers: [provideIcons({ tablerPlus, tablerSearch, tablerUsers })],
  templateUrl: './customer-cards.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class CustomerCards {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  readonly body = input.required<CustomerSearchBody>();
  readonly ready = input(true);
  readonly status = input<'ALL' | CustomerStatus>('ALL');
  readonly hasFilter = input(false);
  readonly capabilities = input<CustomerCapabilities | null>(null);
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);

  readonly view = output<CustomerRow>();
  readonly activities = output<CustomerRow>();
  readonly create = output<void>();
  readonly clearSearch = output<void>();
  readonly readOnlyDetected = output<void>();

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly pageSizePref = createListPageSize({
    storageKey: 'customers.cards.pageSize',
    sizes: DEFAULT_LIST_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });
  private syncedInitialPageSize = false;
  private lastPageResult: SearchResponse | undefined;
  private loadedBranchId: string | undefined;
  private readonly refreshTick = signal(0);
  private readonly readOnly = signal(false);

  private readonly requestBody = computed<CustomerSearchBody>(() => {
    const base = this.body();
    const activeStatus = this.status();
    return {
      ...base,
      ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
    };
  });

  private readonly pageResource = resource({
    params: () =>
      this.ready()
        ? {
            query: this.requestBody(),
            page: this.page(),
            pageSize: this.pageSize(),
            tick: this.refreshTick(),
          }
        : undefined,
    loader: async ({ params }) => {
      if (this.loadedBranchId !== params.query.branchId) {
        this.lastPageResult = undefined;
        this.loadedBranchId = params.query.branchId;
        this.readOnly.set(false);
      }
      try {
        const res = await searchCustomers(params.query, params.page, params.pageSize);
        if (res.items.length === 0 && params.page > 1) {
          const target = Math.max(1, Math.min(params.page - 1, res.totalPages || 1));
          if (target !== params.page) {
            this.page.set(target);
            const fallback = await searchCustomers(params.query, target, params.pageSize);
            if (this.loadedBranchId === params.query.branchId) this.lastPageResult = fallback;
            return fallback;
          }
        }
        if (this.loadedBranchId === params.query.branchId) this.lastPageResult = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          this.notify.error(this.transloco.translate('customers.search.invalid'));
          return this.loadedBranchId === params.query.branchId ? this.lastPageResult : undefined;
        }
        throw error;
      }
    },
  });

  private readonly pageData = linkedSignal<SearchResponse | undefined>(() => this.pageResource.hasValue() ? this.pageResource.value() : undefined);

  protected readonly items = computed(() => this.pageData()?.items ?? []);
  protected readonly loading = this.pageResource.isLoading;
  protected readonly failed = computed(() => !!this.pageResource.error());
  protected readonly failureState = computed(() => customerReadState(this.pageResource.error(), this.transloco));

  protected retryLoad(): void {
    this.pageResource.reload();
  }
  protected readonly canCreate = computed(() => !this.readOnly() && canCreateCustomer(this.capabilities()));

  protected readonly totalCount = linkedSignal<{ total: number; loading: boolean }, number>({
    source: () => ({
      total: this.pageData()?.total ?? 0,
      loading: this.loading(),
    }),
    computation: ({ total, loading }, previous) =>
      loading && total === 0 ? (previous?.value ?? 0) : total,
  });

  protected readonly deletingName = signal('');
  protected readonly deletingError = signal('');

  constructor() {
    let lastPage = this.page();
    effect(() => {
      const current = this.page();
      if (current === lastPage) return;
      lastPage = current;
      this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
    });


    effect(() => {
      const sizes = this.pageSizePref.sizes();
      const preferred = this.pageSizePref.size();
      const current = this.pageSize();
      untracked(() => {
        if (!this.syncedInitialPageSize) {
          this.syncedInitialPageSize = true;
          if (current === DEFAULT_LIST_PAGE_SIZE && preferred !== current && sizes.includes(preferred)) {
            this.pageSize.set(preferred);
          } else if (!sizes.includes(current)) {
            this.pageSize.set(preferred);
          }
          return;
        }
        if (!sizes.includes(current)) {
          this.pageSize.set(preferred);
        }
      });
    });
  }

  refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected canUpdate(customer: CustomerRow): boolean {
    return !this.readOnly() && canUpdateCustomer(this.capabilities(), customer);
  }

  protected canDelete(customer: CustomerRow): boolean {
    return !this.readOnly() && canDeleteCustomer(this.capabilities(), customer);
  }

  protected onPageSizeChange(size: number): void {
    if (!this.pageSizePref.sizes().includes(size)) return;
    this.pageSizePref.set(size);
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
    }
  }

  protected async rate(customer: CustomerRow, rating: number): Promise<void> {
    if (!this.canUpdate(customer)) return;
    const before = this.pageData();
    this.pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === customer.id ? { ...item, rating } : item)),
          }
        : current,
    );
    try {
      const saved = await setCustomerRating(customer.id, rating);
      this.pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === customer.id ? { ...item, rating: saved.rating, updatedAt: saved.updatedAt } : item,
              ),
            }
          : current,
      );
    } catch (error) {
      this.pageData.set(before);
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.rate.failed'));
      this.handleWriteError(error);
    }
  }

  protected async recolor(customer: CustomerRow, cardColor: CardColor | null): Promise<void> {
    if (!this.canUpdate(customer)) return;
    const before = this.pageData();
    this.pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === customer.id ? { ...item, cardColor } : item)),
          }
        : current,
    );
    try {
      const saved = await setCustomerColor(customer.id, cardColor);
      this.pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === customer.id
                  ? { ...item, cardColor: saved.cardColor, updatedAt: saved.updatedAt }
                  : item,
              ),
            }
          : current,
      );
    } catch (error) {
      this.pageData.set(before);
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.color.failed'));
      this.handleWriteError(error);
    }
  }

  protected async remove(customer: CustomerRow): Promise<void> {
    if (!this.canDelete(customer) || customer.status === 'BLACKLISTED') return;
    this.deletingError.set('');
    this.deletingName.set(customer.displayName);
    while (await this.confirmDialog().open()) {
      if (!this.canDelete(customer)) return;
      const before = this.pageData();
      this.pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.id !== customer.id),
              total: Math.max(0, current.total - 1),
            }
          : current,
      );
      try {
        await deleteCustomer(customer.id);
        this.notify.success(this.transloco.translate('customers.delete.done'));
        this.refresh();
        return;
      } catch (error) {
        this.pageData.set(before);
        this.notify.error(customerErrorMessage(error, this.transloco, 'customers.delete.failed'));
        this.handleWriteError(error);
        if (!(error instanceof ApiError) || error.status !== 409 || !error.code.startsWith('CUSTOMER_PROFILE_')) return;
        this.deletingError.set(customerErrorMessage(error, this.transloco, 'customers.delete.failed'));
      }
    }
  }

  private handleWriteError(error: unknown): void {
    if (customerReadOnlyError(error)) {
      this.readOnly.set(true);
      this.readOnlyDetected.emit();
    }
    if (customerNeedsReload(error)) this.refresh();
  }

}
