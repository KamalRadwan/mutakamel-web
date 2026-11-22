import { Component, computed, effect, inject, input, linkedSignal, output, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerSearch, tablerUsers } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ApiError } from '../../settings/shared/settings-api';
import { RecordBoard } from '../../shared/record/board/record-board';
import { BoardLabels, BoardLane, BoardMoveEvent } from '../../shared/record/board/record-board.model';
import {
  CustomerCard,
  canCreateCustomer,
  canDeleteCustomer,
  canUpdateCustomer,
  customerErrorMessage,
} from '../customer-card/customer-card';
import { CUSTOMER_STATUS_TONE } from '../customer-statuses';
import {
  canManageStatus,
  deleteCustomer,
  getCustomer,
  loadBoard,
  loadStatusPage,
  setCustomerColor,
  setCustomerRating,
  setCustomerStatus,
} from '../customers.api';
import {
  ActivityBucket,
  BoardResponse,
  CardColor,
  CustomerBoardItem,
  CustomerCapabilities,
  BoardLane as CustomerBoardLane,
  CustomerSearchBody,
  CustomerStatus,
  StatusCounts,
} from '../customers.model';

const DUE_SEGMENTS: readonly { bucket: ActivityBucket | 'NONE'; color: string }[] = [
  { bucket: 'OVERDUE', color: 'bg-danger' },
  { bucket: 'TODAY', color: 'bg-warning' },
  { bucket: 'FUTURE', color: 'bg-success' },
  { bucket: 'NONE', color: 'bg-status-none' },
];

const COLLAPSED_KEY = 'crm.customers.board.collapsed';

function dueCounts(items: readonly CustomerBoardItem[]): Record<ActivityBucket | 'NONE', number> {
  const counts: Record<ActivityBucket | 'NONE', number> = { OVERDUE: 0, TODAY: 0, FUTURE: 0, NONE: 0 };
  for (const item of items) {
    counts[item.nextActivity?.bucket ?? 'NONE']++;
  }
  return counts;
}

@Component({
  selector: 'app-customer-board',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, CustomerCard, RecordBoard],
  providers: [provideIcons({ tablerPlus, tablerSearch, tablerUsers })],
  templateUrl: './customer-board.html',
  host: { class: 'flex shrink-0 flex-col' },
})
export class CustomerBoard {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly blacklistDialog = viewChild.required<ConfirmDialog>('blacklistDialog');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly recordBoard = viewChild<RecordBoard<CustomerBoardItem>>(RecordBoard);

  readonly body = input.required<CustomerSearchBody>();
  readonly ready = input(true);
  readonly hasFilter = input(false);
  readonly capabilities = input<CustomerCapabilities | null>(null);

  readonly create = output<CustomerStatus>();
  readonly view = output<CustomerBoardItem>();
  readonly activities = output<CustomerBoardItem>();
  readonly clearSearch = output<void>();
  readonly countsLoaded = output<StatusCounts>();

  protected readonly skeletonLanes = [1, 2, 3, 4];
  protected readonly skeletonCards = [1, 2, 3];
  protected readonly collapseStorageKey = COLLAPSED_KEY;
  protected readonly itemId = (item: CustomerBoardItem) => item.id;

  private readonly refreshTick = signal(0);
  private lastBoard: BoardResponse | undefined;
  private deleteInFlight = false;

  private readonly boardResource = resource({
    params: () => (this.ready() ? { body: this.body(), tick: this.refreshTick() } : undefined),
    loader: async ({ params }) => {
      try {
        const res = await loadBoard(params.body);
        this.lastBoard = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          this.notify.error(this.transloco.translate('customers.search.invalid'));
          return this.lastBoard;
        }
        throw error;
      }
    },
  });

  protected readonly lanes = linkedSignal<BoardResponse | undefined, CustomerBoardLane[]>({
    source: () => this.boardResource.value(),
    computation: (res, previous) => res?.statuses ?? previous?.value ?? [],
  });

  private readonly counts = linkedSignal<BoardResponse | undefined, StatusCounts | null>({
    source: () => this.boardResource.value(),
    computation: (res, previous) => res?.counts ?? previous?.value ?? null,
  });

  protected readonly openCards = signal<Record<string, string>>({});
  protected readonly loadingMore = signal<CustomerStatus | null>(null);
  protected readonly blacklistingName = signal('');
  protected readonly deletingName = signal('');
  protected readonly deletingHasSourceLead = signal(false);

  protected readonly loading = this.boardResource.isLoading;
  protected readonly failed = computed(() => !!this.boardResource.error());

  protected retryLoad(): void {
    this.boardResource.reload();
  }
  protected readonly canCreate = computed(() => canCreateCustomer(this.capabilities()));
  protected readonly totalItems = computed(() => this.lanes().reduce((sum, lane) => sum + lane.total, 0));

  protected readonly canDragItem = (item: CustomerBoardItem): boolean =>
    canManageStatus() && canUpdateCustomer(this.capabilities(), item);

  protected readonly boardLanes = computed<BoardLane<CustomerBoardItem>[]>(() => {
    this.i18n();
    const loadingStatus = this.loadingMore();
    const statusAllowed = canManageStatus();
    const createAllowed = this.canCreate();

    return this.lanes().map((lane) => {
      const label = this.transloco.translate(`customers.statuses.${lane.status}`);
      const tone = CUSTOMER_STATUS_TONE[lane.status];
      const dropRule = !statusAllowed
        ? 'deny'
        : lane.status === 'ACTIVE_CUSTOMER'
          ? 'deny'
          : lane.status === 'BLACKLISTED'
            ? 'confirm'
            : 'allow';
      const denyReason = !statusAllowed
        ? this.transloco.translate('customers.board.deniedStatus')
        : lane.status === 'ACTIVE_CUSTOMER'
          ? this.transloco.translate('customers.activeHint')
          : undefined;
      const laneCanCreate =
        lane.status === 'ACTIVE_CUSTOMER'
          ? false
          : lane.status === 'PROSPECT'
            ? createAllowed
            : createAllowed && statusAllowed;

      return {
        id: lane.status,
        label,
        tone,
        total: lane.total,
        items: lane.items,
        hasNext: lane.hasNext,
        loading: loadingStatus === lane.status,
        canCreate: laneCanCreate,
        dropRule,
        ...(denyReason ? { denyReason } : {}),
        statusSegments: this.segments(lane).map((segment) => ({
          key: segment.bucket,
          count: segment.count,
          color: segment.color,
        })),
        statusSummary: this.dueSummary(lane),
      };
    });
  });

  protected readonly boardLabels = computed<BoardLabels>(() => {
    this.i18n();
    return {
      add: (status: string) => this.transloco.translate('customers.board.add', { status }),
      empty: this.transloco.translate('customers.board.empty'),
      emptyHelp: this.transloco.translate('customers.board.emptyHelp'),
      allShown: this.transloco.translate('customers.board.allShown'),
    };
  });

  constructor() {
    effect(() => {
      const current = this.counts();
      if (current) {
        untracked(() => this.countsLoaded.emit(current));
      }
    });
  }

  refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected canUpdate(item: CustomerBoardItem): boolean {
    return canUpdateCustomer(this.capabilities(), item);
  }

  protected canDelete(item: CustomerBoardItem): boolean {
    return canDeleteCustomer(this.capabilities(), item);
  }

  protected setExpanded(status: string, customerId: string, expanded: boolean): void {
    this.openCards.update((current) => {
      if (expanded) return { ...current, [status]: customerId };
      if (current[status] !== customerId) return current;
      const { [status]: _, ...rest } = current;
      return rest;
    });
  }

  protected onCreate(laneId: string): void {
    this.create.emit(laneId as CustomerStatus);
  }

  protected onLoadMore(laneId: string): void {
    const lane = this.lanes().find((item) => item.status === laneId);
    if (lane) void this.loadMore(lane);
  }

  protected onMove(event: BoardMoveEvent): void {
    void this.move(event.id, event.from, event.to, Boolean(event.needsConfirm));
  }

  private segments(lane: CustomerBoardLane) {
    const bucketCounts = dueCounts(lane.items);
    return DUE_SEGMENTS.map(({ bucket, color }) => ({
      bucket,
      count: bucketCounts[bucket],
      color,
    })).filter((segment) => segment.count > 0);
  }

  private dueSummary(lane: CustomerBoardLane): string {
    this.i18n();
    const active = this.segments(lane);
    if (!active.length) return this.transloco.translate('customers.due.NONE');
    return active
      .map((segment) => `${this.transloco.translate(`customers.due.${segment.bucket}`)} ${segment.count}`)
      .join(' · ');
  }

  private async loadMore(lane: CustomerBoardLane): Promise<void> {
    this.loadingMore.set(lane.status);
    try {
      const next = await loadStatusPage(lane.status, this.body(), lane.page + 1);
      this.lanes.update((lanes) =>
        lanes.map((item) =>
          item.status === lane.status ? { ...next, items: [...item.items, ...next.items] } : item,
        ),
      );
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 400
          ? this.transloco.translate('customers.search.invalid')
          : customerErrorMessage(error, this.transloco, 'customers.empty.loadFailed');
      this.notify.error(message);
    } finally {
      this.loadingMore.set(null);
    }
  }

  protected async rate(customer: CustomerBoardItem, rating: number): Promise<void> {
    if (!this.canUpdate(customer)) return;
    const prevRating = customer.rating;
    this.lanes.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === customer.id ? { ...item, rating } : item)),
      })),
    );
    try {
      const saved = await setCustomerRating(customer.id, rating);
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) =>
            item.id === customer.id ? { ...item, rating: saved.rating, updatedAt: saved.updatedAt } : item,
          ),
        })),
      );
    } catch (error) {
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) => (item.id === customer.id ? { ...item, rating: prevRating } : item)),
        })),
      );
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.rate.failed'));
    }
  }

  protected async recolor(customer: CustomerBoardItem, cardColor: CardColor | null): Promise<void> {
    if (!this.canUpdate(customer)) return;
    const prevColor = customer.cardColor;
    this.lanes.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === customer.id ? { ...item, cardColor } : item)),
      })),
    );
    try {
      const saved = await setCustomerColor(customer.id, cardColor);
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) =>
            item.id === customer.id ? { ...item, cardColor: saved.cardColor, updatedAt: saved.updatedAt } : item,
          ),
        })),
      );
    } catch (error) {
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) => (item.id === customer.id ? { ...item, cardColor: prevColor } : item)),
        })),
      );
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.color.failed'));
    }
  }

  protected async remove(customer: CustomerBoardItem): Promise<void> {
    if (!this.canDelete(customer) || customer.status === 'BLACKLISTED' || this.deleteInFlight) return;
    this.deleteInFlight = true;
    try {
      let hasSourceLead = false;
      try {
        const detail = await getCustomer(customer.id);
        hasSourceLead = Boolean(detail.sourceLeadId);
      } catch (error) {
        this.notify.error(customerErrorMessage(error, this.transloco, 'customers.delete.failed'));
        if (error instanceof ApiError && error.status === 404) {
          this.refresh();
        }
        return;
      }

      this.deletingName.set(customer.displayName);
      this.deletingHasSourceLead.set(hasSourceLead);
      if (!(await this.deleteDialog().open())) return;

      const beforeLanes = this.lanes();
      const beforeCounts = this.counts();
      this.lanes.update((lanes) =>
        lanes.map((lane) =>
          lane.items.some((item) => item.id === customer.id)
            ? {
                ...lane,
                items: lane.items.filter((item) => item.id !== customer.id),
                total: Math.max(0, lane.total - 1),
              }
            : lane,
        ),
      );
      if (beforeCounts) {
        this.counts.set({
          ...beforeCounts,
          ALL: Math.max(0, beforeCounts.ALL - 1),
          [customer.status]: Math.max(0, beforeCounts[customer.status] - 1),
        });
      }

      try {
        await deleteCustomer(customer.id);
        this.notify.success(this.transloco.translate('customers.delete.done'));
      } catch (error) {
        this.lanes.set(beforeLanes);
        this.counts.set(beforeCounts);
        this.notify.error(customerErrorMessage(error, this.transloco, 'customers.delete.failed'));
      }
    } finally {
      this.deleteInFlight = false;
    }
  }

  private async move(
    customerId: string,
    fromId: string,
    toId: string,
    needsConfirm: boolean,
  ): Promise<void> {
    const board = this.recordBoard();
    const beforeLanes = this.lanes();
    const fromLane = beforeLanes.find((lane) => lane.status === fromId);
    const toLane = beforeLanes.find((lane) => lane.status === toId);
    const item = fromLane?.items.find((entry) => entry.id === customerId);

    if (!fromLane || !toLane || !item || fromLane === toLane) {
      board?.revert(customerId);
      return;
    }

    if (!canManageStatus()) {
      board?.revert(customerId);
      this.notify.error(this.transloco.translate('customers.board.deniedStatus'));
      return;
    }

    if (toLane.status === 'ACTIVE_CUSTOMER') {
      board?.revert(customerId);
      this.notify.warning(this.transloco.translate('customers.activeHint'));
      return;
    }

    if (needsConfirm) {
      this.blacklistingName.set(item.displayName);
      if (!(await this.blacklistDialog().open())) {
        board?.revert(customerId);
        return;
      }
    }

    board?.applyMove(customerId, fromLane.status, toLane.status);

    const statusLabel = this.transloco.translate(`customers.statuses.${toLane.status}`);
    try {
      const saved = await setCustomerStatus(customerId, toLane.status, item.updatedAt);
      const updatedItem: CustomerBoardItem = {
        ...item,
        status: saved.status,
        updatedAt: saved.updatedAt,
      };
      this.lanes.update((currentLanes) =>
        currentLanes.map((lane) => {
          if (lane.status === fromLane.status) {
            return {
              ...lane,
              items: lane.items.filter((entry) => entry.id !== customerId),
              total: Math.max(0, lane.total - 1),
            };
          }
          if (lane.status === toLane.status) {
            return {
              ...lane,
              items: [updatedItem, ...lane.items],
              total: lane.total + 1,
            };
          }
          return lane;
        }),
      );
      this.counts.update((currentCounts) =>
        currentCounts
          ? {
              ...currentCounts,
              [fromLane.status]: Math.max(0, currentCounts[fromLane.status] - 1),
              [toLane.status]: currentCounts[toLane.status] + 1,
            }
          : currentCounts,
      );
      this.notify.success(this.transloco.translate('customers.board.moved', { status: statusLabel }));
    } catch (error) {
      board?.revert(customerId);
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE')
      ) {
        this.notify.error(this.transloco.translate('customers.board.concurrentUpdate'));
        return;
      }
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.board.moveFailed'));
    }
  }
}
