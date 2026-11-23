import { accessMessage, accessMismatch, accessReadOnly } from '../access-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClipboardCheck,
  tablerKey,
  tablerLayoutDashboard,
  tablerPuzzle,
  tablerRefresh,
  tablerSend,
  tablerUserShare,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState, FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../../shared/ui/tabs/tabs';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import {
  cancelAccessRequest,
  isPersonInactive,
  getAccessRequest,
  listAccessRequests,
  listOwnerReviews,
  personName,
  resourceLabel,
} from '../access.api';
import type {
  AccessRequest,
  AccessRequestStatus,
  OwnerReview,
  OwnerReviewStatus,
} from '../access.model';
import { DecideModal } from '../decide-modal/decide-modal';
import { ReviewModal } from '../review-modal/review-modal';

export type AccessTabId = 'mine' | 'inbox' | 'reviews';

const REQUEST_STATUSES: readonly AccessRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

const REVIEW_STATUSES: readonly OwnerReviewStatus[] = [
  'OPEN',
  'TRANSFERRED',
  'OWNER_REACTIVATED',
  'LAPSED',
  'CANCELLED',
];

@Component({
  selector: 'app-access-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    ConflictDialog,
    DataCell,
    DataTable,
    Dropdown,
    Field,
    FullState,
    Tabs,
    DecideModal,
    ReviewModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-access', alias: 'access' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerKey,
      tablerRefresh,
      tablerLayoutDashboard,
      tablerPuzzle,
      tablerSend,
      tablerClipboardCheck,
      tablerUserShare,
    }),
  ],
  templateUrl: './access-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class AccessPage {
  private static nextId = 0;
  protected readonly uid = `access-page-${++AccessPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly language = inject(LanguageState).current;

  private readonly cancelConfirm = viewChild.required<ConfirmDialog>('cancelConfirm');
  private readonly decideModal = viewChild.required(DecideModal);
  private readonly reviewModal = viewChild.required(ReviewModal);

  protected readonly canDecide = can('crm.dashboards.share');
  protected readonly canReview = can('crm.widgets.transfer_ownership');

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  protected readonly activeTab = signal<AccessTabId>('mine');

  protected readonly mineStatus = signal<AccessRequestStatus | 'ALL'>('ALL');
  protected readonly inboxStatus = signal<AccessRequestStatus | 'ALL'>('PENDING');
  protected readonly reviewStatus = signal<OwnerReviewStatus | 'ALL'>('OPEN');

  protected readonly mineRows = signal<AccessRequest[]>([]);
  protected readonly mineCursor = signal<string | null>(null);
  protected readonly mineHasMore = signal(false);

  protected readonly inboxRows = signal<AccessRequest[]>([]);
  protected readonly inboxCursor = signal<string | null>(null);
  protected readonly inboxHasMore = signal(false);

  protected readonly reviewRows = signal<OwnerReview[]>([]);
  protected readonly reviewCursor = signal<string | null>(null);
  protected readonly reviewHasMore = signal(false);

  protected readonly readOnly = signal(false);
  protected readonly conflictOpen = signal(false);
  private conflictRequest: AccessRequest | null = null;
  protected readonly loadMessage = signal('');
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal<FullStateKind | null>(null);
  protected readonly cancellingId = signal<string | null>(null);

  private loadSeq = 0;
  private initializedTabEffect = false;

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    this.language();
    const list: TabItem[] = [
      {
        id: 'mine',
        label: this.transloco.translate('access.tabs.mine'),
        icon: 'tablerSend',
        color: 'text-icon-blue',
      },
    ];
    if (this.canDecide) {
      list.push({
        id: 'inbox',
        label: this.transloco.translate('access.tabs.inbox'),
        icon: 'tablerClipboardCheck',
        color: 'text-icon-orange',
      });
    }
    if (this.canReview) {
      list.push({
        id: 'reviews',
        label: this.transloco.translate('access.tabs.reviews'),
        icon: 'tablerUserShare',
        color: 'text-icon-violet',
      });
    }
    return list;
  });

  protected readonly requestStatusOptions = computed<DropdownOption<AccessRequestStatus | 'ALL'>[]>(
    () => {
      this.i18n();
      this.language();
      return [
        { value: 'ALL', label: this.transloco.translate('access.toolbar.allStatuses') },
        ...REQUEST_STATUSES.map((status) => ({
          value: status,
          label: this.transloco.translate(`access.status.${status}`),
        })),
      ];
    },
  );

  protected readonly inboxStatusOptions = computed<DropdownOption<AccessRequestStatus | 'ALL'>[]>(
    () => {
      this.i18n();
      this.language();
      return [
        { value: 'ALL', label: this.transloco.translate('access.toolbar.allStatuses') },
        ...REQUEST_STATUSES.map((status) => ({
          value: status,
          label: this.transloco.translate(`access.status.${status}`),
        })),
      ];
    },
  );

  protected readonly reviewStatusOptions = computed<DropdownOption<OwnerReviewStatus | 'ALL'>[]>(
    () => {
      this.i18n();
      this.language();
      return [
        ...REVIEW_STATUSES.map((status) => ({
          value: status,
          label: this.transloco.translate(`access.reviewStatus.${status}`),
        })),
        { value: 'ALL', label: this.transloco.translate('access.toolbar.allStatuses') },
      ];
    },
  );

  protected readonly mineColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'requestNumber', label: this.transloco.translate('access.columns.number'), width: 0.9 },
      { key: 'resource', label: this.transloco.translate('access.columns.resource'), width: 1.8 },
      { key: 'requestedLevel', label: this.transloco.translate('access.columns.requested'), width: 0.8 },
      { key: 'purpose', label: this.transloco.translate('access.columns.purpose'), width: 2.2 },
      { key: 'status', label: this.transloco.translate('access.columns.status'), width: 1.0 },
      { key: 'pendingUntil', label: this.transloco.translate('access.columns.waitingUntil'), width: 1.0 },
      { key: 'actions', label: this.transloco.translate('access.columns.actions'), width: 0.9, align: 'end' },
    ];
  });

  protected readonly inboxColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'requestNumber', label: this.transloco.translate('access.columns.number'), width: 0.8 },
      { key: 'requester', label: this.transloco.translate('access.columns.requester'), width: 1.3 },
      { key: 'resource', label: this.transloco.translate('access.columns.resource'), width: 1.6 },
      { key: 'requestedLevel', label: this.transloco.translate('access.columns.requested'), width: 0.8 },
      { key: 'purpose', label: this.transloco.translate('access.columns.purpose'), width: 1.8 },
      { key: 'heldLevelAtRequest', label: this.transloco.translate('access.columns.heldNow'), width: 0.9 },
      { key: 'pendingUntil', label: this.transloco.translate('access.columns.waitingUntil'), width: 1.0 },
      { key: 'actions', label: this.transloco.translate('access.columns.actions'), width: 0.9, align: 'end' },
    ];
  });

  protected readonly reviewColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'resource', label: this.transloco.translate('access.columns.resource'), width: 1.9 },
      { key: 'owner', label: this.transloco.translate('access.columns.owner'), width: 1.6 },
      { key: 'triggerReason', label: this.transloco.translate('access.columns.reason'), width: 1.3 },
      { key: 'status', label: this.transloco.translate('access.columns.status'), width: 1.1 },
      { key: 'reviewUntil', label: this.transloco.translate('access.columns.reviewUntil'), width: 1.0 },
      { key: 'actions', label: this.transloco.translate('access.columns.actions'), width: 0.9, align: 'end' },
    ];
  });

  protected readonly activeHasMore = computed(() => {
    switch (this.activeTab()) {
      case 'mine':
        return this.mineHasMore();
      case 'inbox':
        return this.inboxHasMore();
      case 'reviews':
        return this.reviewHasMore();
    }
  });

  protected readonly activeRowCount = computed(() => {
    switch (this.activeTab()) {
      case 'mine':
        return this.mineRows().length;
      case 'inbox':
        return this.inboxRows().length;
      case 'reviews':
        return this.reviewRows().length;
    }
  });

  protected readonly inboxHasPending = computed(() =>
    this.inboxRows().some((row) => row.status === 'PENDING'),
  );

  protected readonly requestRowKey = (row: AccessRequest) => row.id;
  protected readonly reviewRowKey = (row: OwnerReview) => row.id;

  constructor() {
    effect(() => {
      const rawTab = this.queryParams()?.get('tab');
      const resolved: AccessTabId =
        rawTab === 'inbox' && this.canDecide
          ? 'inbox'
          : rawTab === 'reviews' && this.canReview
            ? 'reviews'
            : 'mine';
      untracked(() => {
        const shouldLoad = !this.initializedTabEffect || resolved !== this.activeTab();
        this.initializedTabEffect = true;
        if (resolved !== this.activeTab()) {
          this.activeTab.set(resolved);
        }
        if (shouldLoad) {
          void this.loadActiveTab();
        }
      });
    });
  }

  protected onTabChange(next: string): void {
    if (next !== 'mine' && next !== 'inbox' && next !== 'reviews') return;
    if (next === 'inbox' && !this.canDecide) return;
    if (next === 'reviews' && !this.canReview) return;
    if (next === this.activeTab()) return;

    this.activeTab.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'mine' ? null : next },
      queryParamsHandling: 'merge',
    });
    void this.loadActiveTab();
  }

  protected onMineStatusChange(status: AccessRequestStatus | 'ALL'): void {
    this.mineStatus.set(status);
    void this.loadActiveTab();
  }

  protected onInboxStatusChange(status: AccessRequestStatus | 'ALL'): void {
    this.inboxStatus.set(status);
    void this.loadActiveTab();
  }

  protected onReviewStatusChange(status: OwnerReviewStatus | 'ALL'): void {
    this.reviewStatus.set(status);
    void this.loadActiveTab();
  }

  protected reload(): void {
    void this.loadActiveTab();
  }

  protected async loadMore(): Promise<void> {
    if (this.loading() || this.loadingMore() || !this.activeHasMore()) return;
    const tab = this.activeTab();
    const seq = ++this.loadSeq;
    this.loadingMore.set(true);
    try {
      if (tab === 'mine') {
        const res = await listAccessRequests('mine', {
          status: this.mineStatus(),
          cursor: this.mineCursor(),
        });
        if (seq !== this.loadSeq) return;
        this.mineRows.update((prev) => [...prev, ...res.items]);
        this.mineCursor.set(res.pageInfo.nextCursor);
        this.mineHasMore.set(res.pageInfo.hasMore);
      } else if (tab === 'inbox') {
        const res = await listAccessRequests('inbox', {
          status: this.inboxStatus(),
          cursor: this.inboxCursor(),
        });
        if (seq !== this.loadSeq) return;
        this.inboxRows.update((prev) => [...prev, ...res.items]);
        this.inboxCursor.set(res.pageInfo.nextCursor);
        this.inboxHasMore.set(res.pageInfo.hasMore);
      } else {
        const res = await listOwnerReviews({
          status: this.reviewStatus(),
          cursor: this.reviewCursor(),
        });
        if (seq !== this.loadSeq) return;
        this.reviewRows.update((prev) => [...prev, ...res.items]);
        this.reviewCursor.set(res.pageInfo.nextCursor);
        this.reviewHasMore.set(res.pageInfo.hasMore);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(accessMessage(this.transloco, error));
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected openDecideModal(row: AccessRequest): void {
    if (row.status !== 'PENDING' || this.readOnly() || !this.canDecide) return;
    this.decideModal().open(row);
  }

  protected openReviewModal(row: OwnerReview): void {
    if (!this.readOnly() && this.canReview) this.reviewModal().open(row);
  }

  protected async cancelRequest(row: AccessRequest): Promise<void> {
    if (row.status !== 'PENDING' || this.cancellingId() || this.readOnly()) return;
    const confirmed = await this.cancelConfirm().open();
    if (!confirmed) return;

    this.cancellingId.set(row.id);
    try {
      await cancelAccessRequest(row.id, row.revision);
      this.notify.success(this.transloco.translate('access.toast.cancelled'));
      await this.loadActiveTab();
    } catch (error) {
      this.notify.error(accessMessage(this.transloco, error));
      if (accessReadOnly(error) || accessMismatch(error)) this.readOnly.set(true);
      if (/_(STALE|CONFLICT)$/.test(errorCodeOf(error) ?? '')) {
        this.conflictRequest = row;
        this.conflictOpen.set(true);
      }
    } finally {
      this.cancellingId.set(null);
    }
  }

  protected onRequestDecided(): void {
    void this.loadActiveTab();
  }

  protected onReviewUpdated(): void {
    void this.loadActiveTab();
  }

  protected async resolveConflict(reload: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const row = this.conflictRequest;
    if (!row) return;
    try {
      const fresh = await getAccessRequest(row.id);
      this.mineRows.update(rows => rows.map(item => item.id === fresh.id ? fresh : item));
      if (reload) await this.loadActiveTab();
    } catch (error) { this.notify.error(accessMessage(this.transloco, error)); }
  }

  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  protected openReadiness(): void { void this.router.navigateByUrl('/crm/settings/data-readiness'); }

  protected resourceDisplay(row: { resourceName: string | null; resourceId: string }): string {
    return resourceLabel(row);
  }

  protected personDisplay(userId: string): string {
    return personName(userId, this.language());
  }

  protected personInactive(userId: string): boolean {
    return isPersonInactive(userId);
  }

  protected formattedDate(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected requestStatusTone(status: AccessRequestStatus): BadgeTone {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'CANCELLED':
      case 'EXPIRED':
      default:
        return 'none';
    }
  }

  protected reviewStatusTone(status: OwnerReviewStatus): BadgeTone {
    switch (status) {
      case 'OPEN':
        return 'warning';
      case 'TRANSFERRED':
      case 'OWNER_REACTIVATED':
        return 'success';
      case 'LAPSED':
      case 'CANCELLED':
      default:
        return 'none';
    }
  }

  private async loadActiveTab(): Promise<void> {
    const seq = ++this.loadSeq;
    const tab = this.activeTab();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadMessage.set('');
    if (!can('crm.dashboards.read')) {
      this.loadError.set('forbidden');
      this.loading.set(false);
      return;
    }
    try {
      const pageResult = await (
        tab === 'mine'
          ? listAccessRequests('mine', { status: this.mineStatus() })
          : tab === 'inbox'
            ? listAccessRequests('inbox', { status: this.inboxStatus() })
            : listOwnerReviews({ status: this.reviewStatus() })
      );
      if (seq !== this.loadSeq) return;

      if (tab === 'mine') {
        const res = pageResult as Awaited<ReturnType<typeof listAccessRequests>>;
        this.mineRows.set(res.items);
        this.mineCursor.set(res.pageInfo.nextCursor);
        this.mineHasMore.set(res.pageInfo.hasMore);
      } else if (tab === 'inbox') {
        const res = pageResult as Awaited<ReturnType<typeof listAccessRequests>>;
        this.inboxRows.set(res.items);
        this.inboxCursor.set(res.pageInfo.nextCursor);
        this.inboxHasMore.set(res.pageInfo.hasMore);
      } else {
        const res = pageResult as Awaited<ReturnType<typeof listOwnerReviews>>;
        this.reviewRows.set(res.items);
        this.reviewCursor.set(res.pageInfo.nextCursor);
        this.reviewHasMore.set(res.pageInfo.hasMore);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadMessage.set(accessMessage(this.transloco, error));
      const code = errorCodeOf(error);
      if (code && ['CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'CRM_TEAM_SCOPE_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY'].includes(code)) {
        this.loadError.set('provisioning');
      } else if (error instanceof ApiError && error.status === 404) {
        this.loadError.set('not-found');
      } else if (error instanceof ApiError && error.status === 403) {
        this.loadError.set('forbidden');
      } else {
        this.loadError.set('load-failure');
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
