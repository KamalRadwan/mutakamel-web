import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerInfoCircle,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { DateRange, type DateRangeValue } from '../../../../shared/ui/date-range/date-range';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, type TradeContext, errorCodeOf, tradeContext } from '../../shared/trade-api';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { type PollHandle, pollWhile } from '../automation-shared/poll';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import { DeliveriesTable } from '../deliveries-table/deliveries-table';
import { DeliveryModal } from '../delivery-modal/delivery-modal';
import { SubscriptionModal } from '../subscription-modal/subscription-modal';
import { SubscriptionsTable } from '../subscriptions-table/subscriptions-table';
import { ActionKeys } from '../automation-shared/action-keys';
import {
  WEBHOOK_PERMISSIONS,
  hasWebhookReadGrant,
  hasWebhookScopeGrant,
  isForbiddenError,
  isIdempotencyMismatch,
} from './webhook-access';
import {
  getDeliveryCounts,
  getSubscription,
  listDeliveries,
  listEvents,
  listSubscriptions,
  sendTest,
  updateSubscription,
} from '../webhooks.api';
import {
  type DeliveryCounts,
  type DeliveryFilters,
  type DeliveryStatus,
  type ListDeliveriesQuery,
  type RetryDeliveryAccepted,
  type ScopeTarget,
  type SubscriptionStatus,
  type WebhookDelivery,
  type WebhookEventDefinition,
  type WebhookSubscription,
  type WebhookSubscriptionDetail,
  endpointText,
} from '../webhooks.model';
import { WEBHOOK_EVENTS } from '../webhooks.registry';

type WebhooksView = 'subscriptions' | 'deliveries';
type DeliveryStatusFilter = 'ALL' | DeliveryStatus;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];
const SUB_LIST_LIMIT = 100;
const SUB_POLL_MS = 3000;
const DEL_POLL_MS = 5000;

const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PENDING',
  'RETRY_PENDING',
  'DELIVERED',
  'FAILED',
  'EXHAUSTED',
  'DISABLED',
];

/** The registry list, used until GET /webhooks/events answers. */
const FALLBACK_EVENTS: readonly WebhookEventDefinition[] = WEBHOOK_EVENTS.map((e) => ({
  eventType: e.eventType,
  eventVersion: e.eventVersion,
  fields: [...e.fields],
}));

function parseView(raw: string | undefined): WebhooksView {
  return raw === 'deliveries' ? 'deliveries' : 'subscriptions';
}

function parseScope(raw: string | undefined, hasCompany: boolean): ScopeTarget {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'tenant') return 'TENANT';
  if (normalized === 'branch') return 'BRANCH';
  if (normalized === 'company') return 'COMPANY';
  return hasCompany ? 'COMPANY' : 'TENANT';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseDeliveryStatus(raw: string | undefined): DeliveryStatusFilter {
  if (!raw) return 'ALL';
  const upper = raw.trim().toUpperCase() as DeliveryStatus;
  return DELIVERY_STATUSES.includes(upper) ? upper : 'ALL';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A date-range day (yyyy-mm-dd) as the local start or end instant the backend filters on. */
function dayBound(day: string, end: boolean): string {
  const date = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? day : date.toISOString();
}

function readEventType(def: WebhookEventDefinition): string {
  const rec = readRecord(def);
  const raw = rec?.['eventType'] ?? rec?.['type'] ?? rec?.['code'];
  return typeof raw === 'string' ? raw : '';
}

function readEventVersion(def: WebhookEventDefinition): number {
  const rec = readRecord(def);
  const raw = rec?.['eventVersion'] ?? rec?.['version'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
}

let nextWebhooksPageId = 0;

@Component({
  selector: 'app-webhooks-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    DateRange,
    Dropdown,
    FullState,
    Pagination,
    Segmented,
    StepFilter,
    ScopeChip,
    ConflictDialog,
    SubscriptionsTable,
    DeliveriesTable,
    SubscriptionModal,
    DeliveryModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-auto-webhooks', alias: 'webhooks' },
      { scope: 'trade-automation', alias: 'automation' },
      { scope: 'trade-shared', alias: 'tradeShared' },
    ),
    provideIcons({
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerX,
      tablerInfoCircle,
    }),
  ],
  templateUrl: './webhooks-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class WebhooksPage {
  protected readonly uid = `webhooks-page-${++nextWebhooksPageId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly subscriptionModal = viewChild(SubscriptionModal);
  private readonly rowConflictDialog = viewChild.required<ConflictDialog>('rowConflictDialog');

  /** Bound from `?view=subscriptions|deliveries`. */
  readonly viewParam = input<string | undefined>(undefined, { alias: 'view' });
  /** Bound from `?id=` (`new` or subscription id). */
  readonly idParam = input<string | undefined>(undefined, { alias: 'id' });
  /** Bound from `?delivery=` (delivery id). */
  readonly deliveryParam = input<string | undefined>(undefined, { alias: 'delivery' });
  /** Bound from `?page=`. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from `?size=`. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  /** Bound from `?scope=`. */
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });
  /** Bound from `?status=` (deliveries filter). */
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  /** Bound from `?sub=` (deliveries subscription filter). */
  readonly subParam = input<string | undefined>(undefined, { alias: 'sub' });
  /** Bound from `?event=` (deliveries event filter). */
  readonly eventParam = input<string | undefined>(undefined, { alias: 'event' });
  /** Bound from `?from=` / `?to=` (deliveries date range filter). */
  readonly fromParam = input<string | undefined>(undefined, { alias: 'from' });
  readonly toParam = input<string | undefined>(undefined, { alias: 'to' });

  protected readonly pageSizes = [...PAGE_SIZES];

  protected readonly searchText = signal('');
  protected readonly openRotateForId = signal<string | null>(null);
  protected readonly eventsCatalogue = signal<readonly WebhookEventDefinition[]>(FALLBACK_EVENTS);
  /** Subscriptions whose secret operation is still with the worker (the list does not say so). */
  protected readonly pendingSecretIds = signal<readonly string[]>([]);

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasWebhookReadGrant(this.injector));
  protected readonly isForbidden = computed(() => !this.canRead() || this.forbidden());

  protected readonly subscriptions = signal<WebhookSubscription[]>([]);
  protected readonly subscriptionsLoading = signal(true);
  protected readonly subscriptionsFailed = signal(false);
  protected readonly busySubscriptionId = signal<string | null>(null);

  protected readonly deliveries = signal<WebhookDelivery[]>([]);
  protected readonly deliveriesTotal = signal(0);
  protected readonly deliveriesLoading = signal(false);
  protected readonly deliveriesFailed = signal(false);
  protected readonly deliveryCounts = signal<DeliveryCounts | null>(null);

  private destroyed = false;
  private readonly keys = new ActionKeys();
  private subsLoadSeq = 0;
  private delLoadSeq = 0;
  private subPollSeq = 0;
  private delPollSeq = 0;
  private activeSubPollKey = '';
  private activeDelPollKey = '';
  private stopSubPollHandle: PollHandle<unknown> | null = null;
  private stopDelPollHandle: PollHandle<unknown> | null = null;
  private pendingConflictToggle: { row: WebhookSubscription; nextStatus: 'ACTIVE' | 'DISABLED' } | null = null;
  private lastDeliveryFilterKey = '';
  private lastScopeKey: string | null = null;

  protected readonly activeView = computed<WebhooksView>(() => parseView(this.viewParam()));

  protected readonly scopeTarget = computed<ScopeTarget>(() =>
    parseScope(this.scopeParam(), !!this.scopeState.company()?.id),
  );
  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scopeState, this.scopeTarget()));

  protected readonly isBranchScope = computed(() => this.scopeTarget() === 'BRANCH');
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      !this.isBranchScope() &&
      hasWebhookScopeGrant(this.injector, this.scopeState, WEBHOOK_PERMISSIONS.manage, this.scopeTarget()),
  );
  protected readonly canTest = computed(() => this.canManage());
  protected readonly canReplay = computed(
    () =>
      !this.isForbidden() &&
      hasWebhookScopeGrant(this.injector, this.scopeState, WEBHOOK_PERMISSIONS.replay, this.scopeTarget()),
  );

  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));
  protected readonly pageSize = computed(() => parsePageSize(this.sizeParam()));

  protected readonly deliveryStatus = computed<DeliveryStatusFilter>(() =>
    parseDeliveryStatus(this.statusParam()),
  );
  protected readonly deliverySubFilter = computed(() => this.subParam()?.trim() ?? '');
  protected readonly deliveryEventFilter = computed(() => this.eventParam()?.trim() ?? '');
  protected readonly deliveryDateRange = computed<DateRangeValue | null>(() => {
    const from = this.fromParam()?.trim();
    const to = this.toParam()?.trim();
    if (!from || !to) return null;
    return { from, to, preset: null };
  });

  protected readonly subscriptionModalOpen = computed(() => !!this.idParam()?.trim());
  protected readonly activeSubscriptionId = computed<string | null>(() => {
    const raw = this.idParam()?.trim();
    return !raw || raw === 'new' ? null : raw;
  });

  protected readonly deliveryModalOpen = computed(() => !!this.deliveryParam()?.trim());
  protected readonly activeDeliveryId = computed(() => this.deliveryParam()?.trim() ?? '');

  protected readonly activeDeliverySubscriptionStatus = computed<SubscriptionStatus | null>(() => {
    const delId = this.activeDeliveryId();
    if (!delId) return null;
    const delivery = this.deliveries().find((d) => d.id === delId);
    if (!delivery) return null;
    const sub = this.subscriptions().find((s) => s.id === delivery.subscriptionId);
    return sub?.status ?? null;
  });

  protected readonly viewOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      {
        value: 'subscriptions',
        label: this.transloco.translate('webhooks.view.subscriptions'),
      },
      {
        value: 'deliveries',
        label: this.transloco.translate('webhooks.view.deliveries'),
      },
    ];
  });

  protected readonly filteredSubscriptions = computed<WebhookSubscription[]>(() => {
    const needle = this.searchText().trim().toLowerCase();
    const list = this.subscriptions();
    if (!needle) return list;
    return list.filter(
      (item) =>
        item.code.toLowerCase().includes(needle) ||
        endpointText(item.endpoint).toLowerCase().includes(needle),
    );
  });

  protected readonly pagedSubscriptions = computed<WebhookSubscription[]>(() => {
    const filtered = this.filteredSubscriptions();
    const size = this.pageSize();
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    const currentPage = Math.min(this.page(), totalPages);
    const start = (currentPage - 1) * size;
    return filtered.slice(start, start + size);
  });

  protected readonly deliverySteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.deliveryCounts();
    return [
      {
        id: 'ALL',
        label: this.transloco.translate('webhooks.deliveries.steps.all'),
        count: counts ? counts.total : null,
      },
      {
        id: 'PENDING',
        label: this.transloco.translate('webhooks.deliveries.steps.PENDING'),
        count: counts ? counts.byStatus.PENDING : null,
      },
      {
        id: 'RETRY_PENDING',
        label: this.transloco.translate('webhooks.deliveries.steps.RETRY_PENDING'),
        count: counts ? counts.byStatus.RETRY_PENDING : null,
      },
      {
        id: 'DELIVERED',
        label: this.transloco.translate('webhooks.deliveries.steps.DELIVERED'),
        count: counts ? counts.byStatus.DELIVERED : null,
        tone: 'success',
      },
      {
        id: 'FAILED',
        label: this.transloco.translate('webhooks.deliveries.steps.FAILED'),
        count: counts ? counts.byStatus.FAILED : null,
        tone: 'danger',
      },
      {
        id: 'EXHAUSTED',
        label: this.transloco.translate('webhooks.deliveries.steps.EXHAUSTED'),
        count: counts ? counts.byStatus.EXHAUSTED : null,
        tone: 'danger',
      },
      {
        id: 'DISABLED',
        label: this.transloco.translate('webhooks.deliveries.steps.DISABLED'),
        count: counts ? counts.byStatus.DISABLED : null,
      },
    ];
  });

  protected readonly subscriptionFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      {
        value: '',
        label: this.transloco.translate('webhooks.deliveries.filters.allSubscriptions'),
      },
      ...this.subscriptions().map((sub) => ({
        value: sub.id,
        label: sub.code,
      })),
    ];
  });

  protected readonly eventFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    return [
      {
        value: '',
        label: this.transloco.translate('webhooks.deliveries.filters.allEvents'),
      },
      ...this.eventsCatalogue().map((def) => {
        const type = readEventType(def);
        const ver = readEventVersion(def);
        const fullCode = /\.v\d+$/.test(type) ? type : `${type}.v${ver}`;
        const fullKey = `webhooks.events.${fullCode}`;
        const fullTranslated = this.transloco.translate(fullKey);
        let label = fullTranslated !== fullKey ? fullTranslated : '';
        if (!label) {
          const bareKey = `webhooks.events.${type}`;
          const bareTranslated = this.transloco.translate(bareKey);
          label = bareTranslated !== bareKey ? bareTranslated : '';
        }
        if (!label) {
          const rec = readRecord(def);
          const lbl = readRecord(rec?.['label'] ?? rec?.['localizedNames']);
          const localized = lbl?.[lang] ?? lbl?.['en'] ?? lbl?.['ar'];
          label = typeof localized === 'string' && localized.trim() ? localized : type;
        }
        return { value: type, label };
      }),
    ];
  });

  protected readonly hasDeliveryFilters = computed(
    () =>
      this.deliveryStatus() !== 'ALL' ||
      this.deliverySubFilter() !== '' ||
      this.deliveryEventFilter() !== '' ||
      this.deliveryDateRange() !== null,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.stopSubPolling();
      this.stopDelPolling();
    });

    if (!this.isForbidden()) {
      void this.loadCatalogue();
      void this.loadSubscriptions();
    } else {
      this.subscriptionsLoading.set(false);
    }

    let prevPage = this.page();
    effect(() => {
      const next = this.page();
      if (next !== prevPage) {
        prevPage = next;
        this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
      }
    });

    effect(() => {
      const target = this.scopeTarget();
      const currentCtx = this.ctx();
      const key = `${target}|${currentCtx.companyId ?? ''}|${currentCtx.branchId ?? ''}`;
      if (this.lastScopeKey === null) {
        this.lastScopeKey = key;
        return;
      }
      if (key === this.lastScopeKey) return;
      this.lastScopeKey = key;
      untracked(() => {
        this.forbidden.set(false);
        if (!this.canRead()) {
          this.subscriptionsLoading.set(false);
          return;
        }
        void this.loadCatalogue();
        void this.loadSubscriptions();
        if (this.activeView() === 'deliveries') {
          void this.loadDeliveries(true);
        }
      });
    });

    effect(() => {
      if (this.activeView() !== 'deliveries' || this.isForbidden()) {
        untracked(() => this.stopDelPolling());
        return;
      }

      const status = this.deliveryStatus();
      const subId = this.deliverySubFilter();
      const eventType = this.deliveryEventFilter();
      const range = this.deliveryDateRange();
      const page = this.page();
      const size = this.pageSize();
      const key = `${status}|${subId}|${eventType}|${range?.from ?? ''}|${range?.to ?? ''}|${page}|${size}`;

      if (key === this.lastDeliveryFilterKey) return;
      this.lastDeliveryFilterKey = key;
      untracked(() => {
        void this.loadDeliveries(true);
      });
    });

    effect(() => {
      const isSubsView = this.activeView() === 'subscriptions' && !this.isForbidden();
      const pendingIds = isSubsView ? [...this.pendingSecretIds()] : [];
      const key = pendingIds.join(',');

      if (!key) {
        if (this.activeSubPollKey) {
          untracked(() => this.stopSubPolling());
        }
        return;
      }

      if (key === this.activeSubPollKey) return;
      untracked(() => this.startSubPolling(pendingIds, key));
    });

    effect(() => {
      const isDelView = this.activeView() === 'deliveries' && !this.isForbidden();
      const inProgressIds = isDelView
        ? this.deliveries()
            .filter((row) => row.status === 'PENDING' || row.status === 'RETRY_PENDING')
            .map((row) => row.id)
        : [];
      const key = inProgressIds.length > 0 ? `${this.lastDeliveryFilterKey}::${inProgressIds.join(',')}` : '';

      if (!key) {
        if (this.activeDelPollKey) {
          untracked(() => this.stopDelPolling());
        }
        return;
      }

      if (key === this.activeDelPollKey) return;
      untracked(() => this.startDelPolling(key));
    });
  }

  async canDeactivate(): Promise<boolean> {
    return (await this.subscriptionModal()?.canDeactivate()) ?? true;
  }

  protected onViewChange(next: string | null): void {
    const view = parseView(next ?? undefined);
    if (view === this.activeView()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: view === 'subscriptions' ? null : view,
        page: null,
        status: view === 'subscriptions' ? null : (this.statusParam() ?? null),
        sub: view === 'subscriptions' ? null : (this.subParam() ?? null),
        event: view === 'subscriptions' ? null : (this.eventParam() ?? null),
        from: view === 'subscriptions' ? null : (this.fromParam() ?? null),
        to: view === 'subscriptions' ? null : (this.toParam() ?? null),
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
    if (this.page() !== DEFAULT_PAGE) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected clearSearch(): void {
    this.searchText.set('');
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
    this.stopSubPolling();
    this.stopDelPolling();
  }

  protected reload(): void {
    if (this.isForbidden()) return;
    if (this.activeView() === 'subscriptions') {
      void this.loadSubscriptions();
    } else {
      void this.loadDeliveries(true);
    }
  }

  protected openNewSubscription(): void {
    if (!this.canManage()) return;
    this.openRotateForId.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: 'new' },
      queryParamsHandling: 'merge',
    });
  }

  protected openSubscription(row: WebhookSubscription): void {
    this.openRotateForId.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected openRotateSecret(row: WebhookSubscription): void {
    if (!this.canManage()) return;
    this.openRotateForId.set(row.id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected onSubscriptionModalSaved(detail: WebhookSubscriptionDetail): void {
    this.trackSecretOperation(detail);
    if (this.idParam() === 'new') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { id: detail.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    void this.loadSubscriptions();
  }

  protected onSubscriptionModalClosed(): void {
    this.openRotateForId.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onOpenDeliveryFromSubModal(deliveryId: string): void {
    this.openRotateForId.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        id: null,
        view: 'deliveries',
        delivery: deliveryId,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openDelivery(row: WebhookDelivery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { delivery: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected onDeliveryModalClosed(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { delivery: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onDeliveryRetried(_accepted: RetryDeliveryAccepted): void {
    if (this.activeView() === 'deliveries') {
      void this.loadDeliveries(true);
    }
  }

  protected async onSendTestRow(row: WebhookSubscription): Promise<void> {
    if (!this.canTest() || row.status !== 'ACTIVE' || this.busySubscriptionId()) return;
    this.busySubscriptionId.set(row.id);
    const action = `test:${row.id}`;
    try {
      await sendTest(row.id, this.keys.for(action, row.id), this.ctx());
      this.keys.done(action);
      if (this.destroyed) return;
      this.notify.success(this.transloco.translate('webhooks.toast.testSent'));
      if (this.activeView() === 'deliveries') {
        void this.loadDeliveries(true);
      }
    } catch (error) {
      if (this.destroyed) return;
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.busySubscriptionId.set(null);
    }
  }

  protected async onToggleStatusRow(row: WebhookSubscription): Promise<void> {
    if (!this.canManage() || this.busySubscriptionId()) return;
    const nextStatus: 'ACTIVE' | 'DISABLED' = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    this.busySubscriptionId.set(row.id);
    const action = `status:${row.id}`;
    try {
      await updateSubscription(
        row.id,
        { status: nextStatus },
        row.version,
        this.keys.for(action, { status: nextStatus, ifMatch: row.version }),
        this.ctx(),
      );
      this.keys.done(action);
      if (this.destroyed) return;
      void this.loadSubscriptions();
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'DISABLED' ? 'webhooks.toast.disabled' : 'webhooks.toast.enabled',
        ),
      );
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (isIdempotencyMismatch(code)) {
        this.keys.done(action);
      }
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        code === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        this.pendingConflictToggle = { row, nextStatus };
        this.rowConflictDialog().open();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.busySubscriptionId.set(null);
    }
  }

  protected onRowConflictReload(): void {
    this.pendingConflictToggle = null;
    void this.loadSubscriptions();
  }

  protected async onRowConflictKeep(): Promise<void> {
    const pending = this.pendingConflictToggle;
    this.pendingConflictToggle = null;
    if (!pending) return;

    this.busySubscriptionId.set(pending.row.id);
    let action: string | null = null;
    try {
      const ctx = this.ctx();
      const fresh = await getSubscription(pending.row.id, ctx);
      if (this.destroyed) return;
      if (fresh.status === pending.nextStatus) {
        void this.loadSubscriptions();
        return;
      }
      action = `status:${fresh.id}`;
      await updateSubscription(
        fresh.id,
        { status: pending.nextStatus },
        fresh.version,
        this.keys.for(action, { status: pending.nextStatus, ifMatch: fresh.version }),
        ctx,
      );
      this.keys.done(action);
      if (this.destroyed) return;
      void this.loadSubscriptions();
      this.notify.success(
        this.transloco.translate(
          pending.nextStatus === 'DISABLED' ? 'webhooks.toast.disabled' : 'webhooks.toast.enabled',
        ),
      );
    } catch (error) {
      if (this.destroyed) return;
      if (action && isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.busySubscriptionId.set(null);
    }
  }

  protected onDeliveryStatusChange(next: string): void {
    const parsed = parseDeliveryStatus(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: parsed === 'ALL' ? null : parsed,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onDeliverySubFilterChange(subId: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sub: subId || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onDeliveryEventFilterChange(eventType: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        event: eventType || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onDeliveryDateRangeChange(range: DateRangeValue | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        from: range?.from ?? null,
        to: range?.to ?? null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearDeliveryFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: null,
        sub: null,
        event: null,
        from: null,
        to: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const safePage = Math.max(DEFAULT_PAGE, nextPage);
    if (safePage === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safePage === DEFAULT_PAGE ? null : safePage },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private async loadCatalogue(): Promise<void> {
    try {
      const catalogue = await listEvents(this.ctx());
      if (!this.destroyed && catalogue.items.length > 0) {
        this.eventsCatalogue.set(catalogue.items);
      }
    } catch (error) {
      if (!this.destroyed && isForbiddenError(error)) {
        this.onForbidden();
      }
      // Keep the registry list if the catalogue request fails.
    }
  }

  protected async loadSubscriptions(): Promise<void> {
    if (this.isForbidden()) {
      this.subscriptionsLoading.set(false);
      return;
    }
    const seq = ++this.subsLoadSeq;
    this.subscriptionsLoading.set(true);
    this.subscriptionsFailed.set(false);

    try {
      const res = await listSubscriptions({ page: 1, limit: SUB_LIST_LIMIT }, this.ctx());
      if (seq !== this.subsLoadSeq || this.destroyed) return;
      this.subscriptions.set(res.items);
      this.subscriptionsLoading.set(false);
    } catch (error) {
      if (seq !== this.subsLoadSeq || this.destroyed) return;
      this.subscriptionsLoading.set(false);
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      this.subscriptionsFailed.set(true);
      this.notify.error(this.translateError(error));
    }
  }

  /** Filters other than status: the step counts use them too. */
  private buildDeliveryFilters(): DeliveryFilters {
    const subId = this.deliverySubFilter();
    const eventType = this.deliveryEventFilter();
    const range = this.deliveryDateRange();
    return {
      ...(subId ? { subscriptionId: subId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(range ? { createdFrom: dayBound(range.from, false), createdTo: dayBound(range.to, true) } : {}),
    };
  }

  private buildDeliveriesQuery(): ListDeliveriesQuery {
    const status = this.deliveryStatus();
    return {
      page: this.page(),
      limit: this.pageSize(),
      ...this.buildDeliveryFilters(),
      ...(status !== 'ALL' ? { status: [status] } : {}),
    };
  }

  protected async loadDeliveries(includeCounts: boolean): Promise<void> {
    if (this.isForbidden()) {
      this.deliveriesLoading.set(false);
      return;
    }
    const seq = ++this.delLoadSeq;
    const query = this.buildDeliveriesQuery();
    const ctx = this.ctx();
    this.deliveriesLoading.set(true);
    this.deliveriesFailed.set(false);

    try {
      const [listRes, countsRes] = await Promise.all([
        listDeliveries(query, ctx),
        includeCounts ? getDeliveryCounts(this.buildDeliveryFilters(), ctx) : Promise.resolve(null),
      ]);
      if (seq !== this.delLoadSeq || this.destroyed) return;
      this.deliveries.set(listRes.items);
      this.deliveriesTotal.set(listRes.total);
      if (countsRes) {
        this.deliveryCounts.set(countsRes);
      }
      this.deliveriesLoading.set(false);
    } catch (error) {
      if (seq !== this.delLoadSeq || this.destroyed) return;
      this.deliveriesLoading.set(false);
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      this.deliveriesFailed.set(true);
      this.notify.error(this.translateError(error));
    }
  }

  private startSubPolling(ids: readonly string[], key: string): void {
    this.stopSubPolling();
    const seq = ++this.subPollSeq;
    this.activeSubPollKey = key;
    const ctx = this.ctx();

    this.stopSubPollHandle = pollWhile(
      async () => {
        const refreshed = await Promise.all(ids.map((id) => getSubscription(id, ctx)));
        if (!this.destroyed && seq === this.subPollSeq) {
          for (const detail of refreshed) {
            this.trackSecretOperation(detail);
          }
          if (this.pendingSecretIds().length === 0) {
            void this.loadSubscriptions();
          }
        }
        return refreshed;
      },
      (refreshed) =>
        !this.destroyed &&
        seq === this.subPollSeq &&
        this.activeView() === 'subscriptions' &&
        !this.isForbidden() &&
        refreshed.some((detail) => detail.secretOperation?.status === 'PENDING'),
      SUB_POLL_MS,
      this.destroyRef,
      undefined,
      (error) => {
        if (!this.destroyed && isForbiddenError(error)) {
          this.onForbidden();
        }
      },
    );
  }

  private stopSubPolling(): void {
    this.subPollSeq++;
    this.activeSubPollKey = '';
    const handle = this.stopSubPollHandle;
    this.stopSubPollHandle = null;
    handle?.stop();
  }

  private startDelPolling(key: string): void {
    this.stopDelPolling();
    const seq = ++this.delPollSeq;
    this.activeDelPollKey = key;
    const query = this.buildDeliveriesQuery();
    const ctx = this.ctx();

    this.stopDelPollHandle = pollWhile(
      async () => {
        const [listRes, countsRes] = await Promise.all([
          listDeliveries(query, ctx),
          getDeliveryCounts(this.buildDeliveryFilters(), ctx),
        ]);
        if (!this.destroyed && seq === this.delPollSeq) {
          this.deliveries.set(listRes.items);
          this.deliveriesTotal.set(listRes.total);
          this.deliveryCounts.set(countsRes);
        }
        return listRes.items;
      },
      (items) =>
        !this.destroyed &&
        seq === this.delPollSeq &&
        this.activeView() === 'deliveries' &&
        !this.isForbidden() &&
        items.some((row) => row.status === 'PENDING' || row.status === 'RETRY_PENDING'),
      DEL_POLL_MS,
      this.destroyRef,
      undefined,
      (error) => {
        if (!this.destroyed && isForbiddenError(error)) {
          this.onForbidden();
        }
      },
    );
  }

  private stopDelPolling(): void {
    this.delPollSeq++;
    this.activeDelPollKey = '';
    const handle = this.stopDelPollHandle;
    this.stopDelPollHandle = null;
    handle?.stop();
  }

  private trackSecretOperation(detail: WebhookSubscriptionDetail): void {
    const pending = detail.secretOperation?.status === 'PENDING';
    this.pendingSecretIds.update((ids) => {
      const without = ids.filter((id) => id !== detail.id);
      return pending ? [...without, detail.id] : without;
    });
  }

  private translateError(error: unknown): string {
    if (error instanceof ApiError) {
      const reason = error.details?.['reason']?.[0];
      if (reason) {
        const reasonKey = `webhooks.errors.${error.code}.${reason}`;
        const reasonText = this.transloco.translate(reasonKey);
        if (reasonText !== reasonKey) return reasonText;
      }
      const codeKey = `webhooks.errors.${error.code}`;
      const codeText = this.transloco.translate(codeKey);
      if (codeText !== codeKey) return codeText;

      const shortCode = error.code.split('.').at(-1) ?? error.code;
      const shortKey = `webhooks.errors.${shortCode}`;
      const shortText = this.transloco.translate(shortKey);
      if (shortText !== shortKey) return shortText;

      const autoKey = `automation.errors.${error.code}`;
      const autoText = this.transloco.translate(autoKey);
      if (autoText !== autoKey) return autoText;

      const sharedKey = `tradeShared.errors.${error.code.replaceAll('.', '_')}`;
      const sharedText = this.transloco.translate(sharedKey);
      if (sharedText !== sharedKey) return sharedText;
    }
    return this.transloco.translate('webhooks.errors.generic');
  }
}
