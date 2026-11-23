import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerLayoutGrid,
  tablerLayoutKanban,
  tablerPlus,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { runInCrm } from '../../shared/crm-runtime';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { listAssignableOwners } from '../../shared/lookups/assignable-owners';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { listTags } from '../../settings/tags/tags.api';
import { getCrmStaticData } from '../../settings/static-data/static-data.api';
import { ApiError } from '../../../../core/api/api-errors';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { listBulkJobItems } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { FieldOption, Query, countConditions } from '../../../../shared/query-builder/query.model';
import { Button } from '../../../../shared/ui/button/button';
import { FacetSearch } from '../../../../shared/ui/facet-search/facet-search';
import { SearchFacet, SearchField, SearchOption } from '../../../../shared/ui/facet-search/facet-search.model';
import { QueryBuilder } from '../../../../shared/ui/query-builder/query-builder/query-builder';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { RecordActivities } from '../../../../shared/widgets/activities/record-activities/record-activities';
import { DEFAULT_LIST_PAGE_SIZE, DEFAULT_LIST_PAGE_SIZES } from '../../shared/record/list/page-size';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { CustomerBoard } from '../customer-board/customer-board';
import { CustomerBulkActivityModal } from '../customer-bulk/activity-modal/customer-bulk-activity-modal';
import { CustomerBulkAssignModal } from '../customer-bulk/assign-modal/customer-bulk-assign-modal';
import { CustomerBulkMenu, CustomerBulkMenuAction } from '../customer-bulk/bulk-menu/customer-bulk-menu';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  CUSTOMER_SELECTION_LIMIT,
  SelectedCustomerRow,
} from '../customer-bulk/customer-bulk.model';
import { CustomerSelection, toSelectedCustomerRow } from '../customer-bulk/customer-selection';
import { CustomerBulkDeleteModal } from '../customer-bulk/delete-modal/customer-bulk-delete-modal';
import { CustomerSelectionBar } from '../customer-bulk/selection-bar/customer-selection-bar';
import { CustomerBulkStatusModal } from '../customer-bulk/status-modal/customer-bulk-status-modal';
import { canCreateCustomer } from '../customer-card/customer-card';
import { CustomerCards } from '../customer-cards/customer-cards';
import { CustomerModal } from '../customer-modal/customer-modal';
import { ADVANCED_FACET_FIELD } from '../customer-search/customer-search.chips';
import { createCustomerSearchStore } from '../customer-search/customer-search.store';
import { CUSTOMER_STATUS_ORDER, CUSTOMER_STATUS_TONE } from '../customer-statuses';
import { CustomerTable } from '../customer-table/customer-table';
import {
  getCustomerCapabilities,
  loadStatusPage,
  searchCustomers,
} from '../customers.api';
import {
  BoardLane,
  CUSTOMER_VIEWS,
  CustomerBoardItem,
  CustomerCapabilities,
  CustomerDetail,
  CustomerRow,
  CustomerSearchBody,
  CustomerSort,
  CustomerStatus,
  CustomerView,
} from '../customers.model';

interface BoardViewSnapshot {
  lanes?: () => readonly BoardLane[];
}

interface ListViewSnapshot {
  items?: () => readonly CustomerRow[];
  totalCount?: () => number;
}

const VIEW_ICONS: Record<CustomerView, string> = {
  board: 'tablerLayoutKanban',
  cards: 'tablerLayoutGrid',
  table: 'tablerTable',
};
const VIEW_STORAGE_KEY = 'customers.view';
const PRESETS = ['mine', 'active'] as const;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;
const PAGE_SIZES: readonly number[] = DEFAULT_LIST_PAGE_SIZES;
const SORT_PATTERN = /^(displayName|createdAt|updatedAt|rating|status):(ASC|DESC)$/;

function readStoredView(): CustomerView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return (CUSTOMER_VIEWS as readonly string[]).includes(raw ?? '') ? (raw as CustomerView) : 'board';
  } catch {
    return 'board';
  }
}

function writeStoredView(view: CustomerView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // ignore storage errors
  }
}

function parseView(raw: string | undefined): CustomerView | null {
  return raw && (CUSTOMER_VIEWS as readonly string[]).includes(raw) ? (raw as CustomerView) : null;
}

function parseStatus(raw: string | undefined): 'ALL' | CustomerStatus {
  return raw && (CUSTOMER_STATUS_ORDER as readonly string[]).includes(raw)
    ? (raw as CustomerStatus)
    : 'ALL';
}

function parsePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseSort(raw: string | undefined): CustomerSort | null {
  if (!raw || !SORT_PATTERN.test(raw)) return null;
  return raw as CustomerSort;
}

@Component({
  selector: 'app-customers-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    FullState,
    Field,
    FacetSearch,
    QueryBuilder,
    StepFilter,
    ViewSwitcher,
    CustomerBoard,
    CustomerCards,
    CustomerTable,
    CustomerModal,
    RecordActivities,
    CustomerBulkMenu,
    CustomerSelectionBar,
    CustomerBulkAssignModal,
    CustomerBulkStatusModal,
    CustomerBulkActivityModal,
    CustomerBulkDeleteModal,
  ],
  providers: [
    CustomerSelection,
    provideTranslocoScope(
      'customers',
      { scope: 'customer-form', alias: 'customerForm' },
      { scope: 'customer-modal', alias: 'customerModal' },
      { scope: 'record-form', alias: 'recordForm' },
      { scope: 'record-fields', alias: 'recordFields' },
      { scope: 'record-dup', alias: 'recordDup' },
      { scope: 'record-modal', alias: 'recordModal' },
      { scope: 'record-list', alias: 'recordList' },
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'customer-bulk', alias: 'customerBulk' },
      { scope: 'record-bulk', alias: 'recordBulk' },
    ),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerLayoutKanban,
      tablerLayoutGrid,
      tablerTable,
      tablerPlus,
    }),
  ],
  templateUrl: './customers-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class CustomersPage implements CanLeaveRecord {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  protected readonly selection = inject(CustomerSelection);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly customerModal = viewChild(CustomerModal);
  private readonly recordActivities = viewChild.required(RecordActivities);
  private readonly boardView = viewChild(CustomerBoard);
  private readonly cardsView = viewChild(CustomerCards);
  private readonly tableView = viewChild(CustomerTable);
  private readonly queryBuilder = viewChild(QueryBuilder);
  private readonly assignModal = viewChild(CustomerBulkAssignModal);
  private readonly statusModal = viewChild(CustomerBulkStatusModal);
  private readonly activityModal = viewChild(CustomerBulkActivityModal);
  private readonly deleteModal = viewChild(CustomerBulkDeleteModal);

  protected readonly store = createCustomerSearchStore();

  /** Bound from the `?view=` query parameter. */
  readonly view = input<string>();
  /** Bound from the `?status=` query parameter. */
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  /** Bound from the `?page=` query parameter. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from the `?size=` query parameter. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  /** Bound from the `?sort=` query parameter. */
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });
  /** Bound from the `?open=` query parameter. */
  readonly openParam = input<string | undefined>(undefined, { alias: 'open' });

  private syncedOpenId: string | null = null;
  private lastFinishedJobKey = '';
  private lastBodyJson = '';
  private lastHandledSelectJobKey = '';
  private selectFailedSeq = 0;

  private readonly preferredView = signal<CustomerView>(readStoredView());
  protected readonly current = computed<CustomerView>(() => parseView(this.view()) ?? this.preferredView());

  protected readonly advancedOpen = signal(false);
  protected readonly advancedVisible = computed(
    () =>
      this.advancedOpen() ||
      this.store.draftDirty() ||
      this.store.facets().some((facet) => facet.field === ADVANCED_FACET_FIELD),
  );

  protected readonly canRead = computed(() => can('crm.customer_profiles.read'));
  protected readonly branchId = computed(() => runInCrm(() => sessionBranch())?.branchId ?? null);
  protected readonly ready = computed(() => this.canRead() && this.branchId() !== null);

  private readonly sourcesResource = resource({
    params: () => this.ready() || undefined,
    loader: () => listLeadSources(),
  });
  private readonly tagsResource = resource({
    params: () => this.ready() || undefined,
    loader: () => listTags(),
  });
  private readonly staticResource = resource({
    params: () => this.ready() || undefined,
    loader: () => getCrmStaticData(),
  });

  private readonly capabilitiesResource = resource({
    params: () => this.ready() ? this.branchId()! : undefined,
    loader: ({ params }) => getCustomerCapabilities(params).catch(() => null),
  });

  private readonly ownersResource = resource({
    params: () => this.ready() ? this.branchId()! : undefined,
    loader: ({ params }) => listAssignableOwners(params, 'customer_profiles', 'update'),
  });

  protected readonly unavailableCatalogues = computed(() => [
    { id: 'tags', error: this.tagsResource.error() },
    { id: 'acquisitionSourceId', error: this.sourcesResource.error() },
    { id: 'ownerUserId', error: this.ownersResource.error() },
  ].filter(({ error }) => error instanceof ApiError && error.status === 403));

  protected readonly writeReadOnly = signal(false);
  protected readonly capabilities = computed<CustomerCapabilities | null>(() =>
    !this.writeReadOnly() && this.capabilitiesResource.hasValue() ? this.capabilitiesResource.value() : null,
  );

  protected readonly canCreate = computed(() => canCreateCustomer(this.capabilities()));
  protected readonly canUseBulk = computed(() => this.capabilities() !== null);

  protected readonly status = linkedSignal<{ view: CustomerView; param: string | undefined }, 'ALL' | CustomerStatus>({
    source: () => ({ view: this.current(), param: this.statusParam() }),
    computation: ({ view, param }, previous) => {
      if (view === 'board') return 'ALL';
      if (param !== previous?.source.param) return parseStatus(param);
      return previous?.value ?? parseStatus(param);
    },
  });

  protected readonly page = linkedSignal<string | undefined, number>({
    source: () => this.pageParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePage(param);
      return previous?.value ?? parsePage(param);
    },
  });

  protected readonly pageSize = linkedSignal<string | undefined, number>({
    source: () => this.sizeParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePageSize(param);
      return previous?.value ?? parsePageSize(param);
    },
  });

  protected readonly sort = linkedSignal<string | undefined, CustomerSort | null>({
    source: () => this.sortParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseSort(param);
      return previous?.value ?? parseSort(param);
    },
  });

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.statusCounts.hasValue() ? this.statusCounts.value() : undefined;
    return [
      {
        id: 'ALL',
        label: this.transloco.translate('customers.statusFilter.all'),
        count: counts?.ALL ?? null,
      },
      ...CUSTOMER_STATUS_ORDER.map((statusId) => ({
        id: statusId,
        label: this.transloco.translate(`customers.statuses.${statusId}`),
        count: counts?.[statusId] ?? null,
        tone: CUSTOMER_STATUS_TONE[statusId],
      })),
    ];
  });

  protected readonly views = computed<ViewOption[]>(() => {
    this.i18n();
    return CUSTOMER_VIEWS.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`customers.views.${id}`),
    }));
  });

  protected readonly presets = computed<SearchOption[]>(() => {
    this.i18n();
    return PRESETS.map((value) => ({
      value,
      label: this.transloco.translate(`customers.search.presets.${value}`),
    }));
  });

  protected readonly fields = computed<SearchField[]>(() =>
    this.store
      .fields()
      .filter((field) => field.chip)
      .map((field) => ({
        id: field.id,
        label: field.label,
        ...(field.chipHint ? { hint: field.chipHint, chipHint: field.chipHint } : {}),
        ...(field.options ? { options: field.options.map(({ value, label }) => ({ value, label })) } : {}),
      })),
  );

  protected readonly hasSearch = computed(
    () => this.store.facets().length > 0 || countConditions(this.store.applied()) > 0,
  );

  protected readonly hasListFilter = computed(() => this.hasSearch() || this.status() !== 'ALL');

  protected readonly effectiveBody = computed<CustomerSearchBody>(() => {
    const activeStatus = this.status();
    return {
      ...this.store.body(),
      ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
    };
  });

  // Observe the same cached search as the active view; Cards is owned by another package.
  private readonly statusCounts = resource({
    params: () => this.ready() && this.current() !== 'board' ? {
      body: { ...this.effectiveBody(), ...(this.current() === 'table' && this.sort() ? { sort: this.sort()! } : {}) },
      page: this.page(), limit: this.pageSize(),
    } : undefined,
    loader: async ({ params }) => (await searchCustomers(params.body, params.page, params.limit)).counts,
  });

  protected readonly tablePageRows = computed<SelectedCustomerRow[]>(() =>
    (this.tableView()?.items() ?? []).map(toSelectedCustomerRow),
  );
  protected readonly tableTotal = computed(() => this.tableView()?.totalCount() ?? 0);
  protected readonly tableVisibleIds = computed<ReadonlySet<string>>(
    () => new Set((this.tableView()?.items() ?? []).map((row) => row.id)),
  );

  constructor() {
    let lastBranchId: string | null = null;

    effect(() => {
      const branch = this.branchId();
      if (!branch) return;
      const sources = this.sourcesResource.hasValue() ? this.sourcesResource.value() : [];
      const tags = this.tagsResource.hasValue() ? this.tagsResource.value() : [];
      const statuses = this.staticResource.hasValue() ? this.staticResource.value().enumOptions['customerStatuses'] : undefined;
      const unavailable = this.unavailableCatalogues().map(({ id }) => id);
      const ownerOptions: FieldOption[] = (this.ownersResource.hasValue() ? this.ownersResource.value().items : []).map((owner) => ({
        value: owner.id,
        label: owner.displayName,
        ...(owner.avatarUrl ? { icon: owner.avatarUrl } : {}),
      }));

      untracked(() => {
        this.store.init({
          branchId: branch,
          sources,
          tags,
          ownerOptions,
          statuses,
          unavailable,
          owners: async (term: string) => {
            const list = (await listAssignableOwners(branch, 'customer_profiles', 'update', { search: term })).items;
            const mapped: FieldOption[] = list.map((owner) => ({
              value: owner.id,
              label: owner.displayName,
              ...(owner.avatarUrl ? { icon: owner.avatarUrl } : {}),
            }));
            const clean = term.trim().toLowerCase();
            return clean ? mapped.filter((o) => o.label.toLowerCase().includes(clean)) : mapped;
          },
        });

        if (lastBranchId !== null && lastBranchId !== branch) {
          this.selection.clear();
          this.setPage(DEFAULT_PAGE);
        }
        lastBranchId = branch;
      });
    });

    effect(() => {
      const next = this.effectiveBody();
      const nextJson = JSON.stringify(next);
      if (nextJson === this.lastBodyJson) return;
      this.lastBodyJson = nextJson;
      untracked(() => this.selection.onBodyChange(next));
    });

    effect(() => {
      const finished = this.tracker.finished();
      if (!finished || finished.app !== CUSTOMERS_BULK_APP || finished.module !== CUSTOMERS_BULK_MODULE_ID) return;
      const key = `${finished.id}:${finished.revision}`;
      if (key === this.lastFinishedJobKey) return;
      this.lastFinishedJobKey = key;
      untracked(() => this.refreshActiveView());
    });

    effect(() => {
      const qp = this.queryParams();
      if (qp?.get('select') !== 'failed') {
        this.lastHandledSelectJobKey = '';
        return;
      }
      const bulkJobId =
        qp.get('bulkJob') ??
        this.tracker
          .jobs()
          .find(
            (job) =>
              job.app === CUSTOMERS_BULK_APP &&
              job.module === CUSTOMERS_BULK_MODULE_ID &&
              job.counts.failed > 0,
          )?.id ??
        null;
      if (!bulkJobId) {
        untracked(() => void this.clearSelectParam(false));
        return;
      }
      if (this.lastHandledSelectJobKey === bulkJobId) return;
      this.lastHandledSelectJobKey = bulkJobId;
      untracked(() => {
        void this.loadFailedSelection(bulkJobId);
      });
    });

    let seenUrlView = Boolean(parseView(this.view()));
    effect(() => {
      const fromUrl = parseView(this.view());
      if (fromUrl) {
        seenUrlView = true;
        if (fromUrl !== untracked(() => this.preferredView())) {
          this.preferredView.set(fromUrl);
          writeStoredView(fromUrl);
        }
      } else if (seenUrlView) {
        seenUrlView = false;
        if (untracked(() => this.preferredView()) !== 'board') {
          this.preferredView.set('board');
          writeStoredView('board');
        }
      }
    });

    effect(() => {
      const openId = this.openParam()?.trim() || null;
      if (!this.ready() || !this.customerModal()) return;
      if (openId === this.syncedOpenId) return;
      this.syncedOpenId = openId;
      untracked(() => {
        if (openId) {
          this.customerModal()?.openCustomer(openId, null);
        } else {
          this.customerModal()?.syncClosedFromUrl();
        }
      });
    });
  }

  canDeactivate(): Promise<boolean> {
    return this.customerModal()?.canDeactivate() ?? Promise.resolve(true);
  }

  protected show(view: string): void {
    const nextView = parseView(view) ?? 'board';
    if (nextView === this.current()) return;

    this.preferredView.set(nextView);
    writeStoredView(nextView);
    this.page.set(DEFAULT_PAGE);
    this.pageSize.set(DEFAULT_PAGE_SIZE);

    if (nextView === 'board') {
      this.status.set('ALL');
    }
    if (nextView !== 'table') {
      this.sort.set(null);
      this.selection.clear();
    }

    void this.router.navigate([], {
      queryParams: {
        view: nextView === 'board' ? null : nextView,
        status: nextView === 'board' || this.status() === 'ALL' ? null : this.status(),
        page: null,
        size: null,
        sort: nextView === 'table' && this.sort() ? this.sort() : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected filterStatus(next = 'ALL'): void {
    const resolved = parseStatus(next);
    this.status.set(resolved);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        status: resolved === 'ALL' ? null : resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    const next = Math.max(DEFAULT_PAGE, page);
    this.page.set(next);
    void this.router.navigate([], {
      queryParams: { page: next === DEFAULT_PAGE ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        size: size === DEFAULT_PAGE_SIZE ? null : size,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(sort: CustomerSort | null): void {
    this.sort.set(sort);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        sort: sort ?? null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setFacets(facets: SearchFacet[]): void {
    const before = JSON.stringify(this.store.body());
    this.store.setFacets(facets);
    if (JSON.stringify(this.store.body()) !== before) {
      this.setPage(DEFAULT_PAGE);
    }
  }

  protected applyAdvanced(query: Query): void {
    this.store.setApplied(query);
    this.setPage(DEFAULT_PAGE);
  }

  protected clearAdvanced(): void {
    this.store.clear();
    this.setPage(DEFAULT_PAGE);
  }

  protected clearAllFilters(): void {
    this.store.clear();
    if (this.status() !== 'ALL') {
      this.filterStatus('ALL');
    } else {
      this.setPage(DEFAULT_PAGE);
    }
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  protected onFacetChipClick(facet: SearchFacet): void {
    if (facet.field === ADVANCED_FACET_FIELD) {
      this.advancedOpen.set(true);
      this.queryBuilder()?.open();
    }
  }

  protected openCreate(status?: CustomerStatus): void {
    if (!this.canCreate()) return;
    this.customerModal()?.openCreate(status ? { status } : undefined);
  }

  protected openCustomer(customer: CustomerBoardItem): void {
    this.customerModal()?.openCustomer(customer.id, this.buildNavContext(customer));
  }

  protected onModalOpenIdChange(id: string | null): void {
    const normalized = id?.trim() || null;
    this.syncedOpenId = normalized;
    const currentParam = this.openParam()?.trim() || null;
    if (currentParam === normalized) return;
    void this.router.navigate([], {
      queryParams: { open: normalized },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onCustomerSaved(_detail: CustomerDetail): void {
    this.refreshActiveView();
  }

  protected onCustomerChanged(_id: string): void {
    this.refreshActiveView();
  }

  protected onCustomerDeleted(_id: string): void {
    this.refreshActiveView();
  }

  protected openActivities(customer: CustomerBoardItem): void {
    this.recordActivities().open({
      app: 'CRM',
      type: 'CUSTOMER_PROFILE',
      id: customer.id,
      label: customer.displayName,
    });
  }

  protected refreshActiveView(): void {
    this.statusCounts.reload();
    this.boardView()?.refresh();
    this.cardsView()?.refresh();
    this.tableView()?.refresh();
  }

  protected onBulkAction(action: CustomerBulkMenuAction): void {
    if (!this.canUseBulk() || this.selection.count() === 0) return;
    switch (action) {
      case 'assign':
        this.assignModal()?.open();
        break;
      case 'status':
        this.statusModal()?.open();
        break;
      case 'activity':
        this.activityModal()?.open();
        break;
      case 'delete':
        this.deleteModal()?.open();
        break;
    }
  }

  protected onBulkSubmitted(): void {
    this.selection.clear();
  }

  private async loadFailedSelection(jobId: string): Promise<void> {
    const seq = ++this.selectFailedSeq;
    const selectedRows: SelectedCustomerRow[] = [];
    let dropped = 0;
    let page = 1;
    let fetched = 0;

    try {
      while (fetched < CUSTOMER_SELECTION_LIMIT) {
        const res = await listBulkJobItems(CUSTOMERS_BULK_APP, jobId, {
          status: 'FAILED',
          page,
          limit: 100,
        });
        if (seq !== this.selectFailedSeq) return;
        if (res.items.length === 0) break;

        for (const item of res.items) {
          fetched++;
          if (!item.current) {
            dropped++;
            continue;
          }
          selectedRows.push({
            id: item.entityId,
            displayName: item.label,
            ownerUserId: typeof item.current['ownerUserId'] === 'string' ? item.current['ownerUserId'] : null,
            status: (typeof item.current['status'] === 'string' ? item.current['status'] : 'PROSPECT') as CustomerStatus,
            updatedAt: typeof item.current['updatedAt'] === 'string' ? item.current['updatedAt'] : '',
          });
        }

        if (fetched >= res.total || res.items.length < 100) break;
        page++;
      }

      if (seq !== this.selectFailedSeq) return;
      this.selection.replaceWith(selectedRows);

      if (dropped > 0) {
        this.notify.warning(this.transloco.translate('customerBulk.job.unavailable', { n: dropped }));
      }
    } catch {
      if (seq !== this.selectFailedSeq) return;
      this.notify.error(this.transloco.translate('customers.empty.loadFailed'));
    } finally {
      if (seq === this.selectFailedSeq) {
        await this.clearSelectParam(selectedRows.length > 0);
      }
    }
  }

  private async clearSelectParam(switchToTable: boolean): Promise<void> {
    const switchView = switchToTable && this.current() !== 'table';
    if (switchView) {
      this.preferredView.set('table');
      writeStoredView('table');
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        select: null,
        bulkJob: null,
        ...(switchView ? { view: 'table' } : {}),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private buildNavContext(customer: CustomerBoardItem): RecordNavContext | null {
    const view = this.current();
    if (view === 'board') {
      const board = this.boardView() as unknown as BoardViewSnapshot | undefined;
      const lane = board?.lanes?.().find((entry) => entry.items.some((item) => item.id === customer.id));
      if (!lane) return null;
      const laneStatus = lane.status;
      const searchBody = this.store.body();
      let nextPage = lane.page + 1;
      let hasNext = lane.hasNext;
      return {
        ids: lane.items.map((item) => item.id),
        total: lane.total,
        loadMore: hasNext
          ? async () => {
              if (!hasNext) return [];
              const res = await loadStatusPage(laneStatus, searchBody, nextPage);
              hasNext = res.hasNext;
              nextPage += 1;
              return res.items.map((item) => item.id);
            }
          : null,
      };
    }

    const isTable = view === 'table';
    const listView = (isTable ? this.tableView() : this.cardsView()) as unknown as ListViewSnapshot | undefined;
    const rows = listView?.items?.() ?? [];
    if (!rows.some((item) => item.id === customer.id)) return null;

    const ids = rows.map((item) => item.id);
    const currentPage = this.page();
    const limit = this.pageSize();
    const totalMatching = listView?.totalCount?.() ?? ids.length;
    const remainingTotal = Math.max(ids.length, totalMatching - (currentPage - 1) * limit);
    const activeStatus = this.status();
    const activeSort = isTable ? this.sort() : null;
    const queryBody: CustomerSearchBody = {
      ...this.store.body(),
      ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
      ...(activeSort ? { sort: activeSort } : {}),
    };
    let nextPage = currentPage + 1;
    let hasMore = ids.length < remainingTotal;

    return {
      ids,
      total: remainingTotal,
      loadMore: hasMore
        ? async () => {
            if (!hasMore) return [];
            const res = await searchCustomers(queryBody, nextPage, limit);
            hasMore = res.hasNext;
            nextPage += 1;
            return res.items.map((item) => item.id);
          }
        : null,
    };
  }
}
