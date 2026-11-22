import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudOff,
  tablerLoader2,
  tablerLock,
  tablerSortAscending,
  tablerSortDescending,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { ApiError, errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { ApplyDialog } from '../apply-dialog/apply-dialog';
import { OperationStatusDialog } from '../operation-status-dialog/operation-status-dialog';
import { applyUpdates, getOperation, listUpdates } from '../updates.api';
import {
  badgeClassForTone,
  buildSnapshot,
  classifyApplyError,
  eligibilityOf,
  findInitialTrackedOperationId,
  formatDateTime,
  guidanceKeyForStatus,
  isTerminal,
  isValidComponentKey,
  snapshotDiverges,
  statusLabelKey,
  statusTone,
  toApplySelections,
} from '../updates.logic';
import {
  ApplyDialogPhase,
  ComponentRisk,
  MAX_SELECTIONS,
  PAGE_SIZE,
  SnapshotItem,
  SortDir,
  TenantOperationDetail,
  UpdateSortBy,
  UpdatesPageResult,
  UpdatesQuery,
} from '../updates.model';
import { UpdatesTable } from '../updates-table/updates-table';

const CAN_READ = true;   // later: workspace.read TENANT-WIDE (company/branch grants do not count)
const CAN_MANAGE = true; // later: workspace.manage tenant-wide and the session may mutate

const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 5_000;

type RiskFilter = 'ALL' | ComponentRisk;
type BooleanFilter = 'ALL' | 'REQUIRED' | 'NOT_REQUIRED';

interface ApplyAttemptState {
  snapshot: readonly SnapshotItem[];
  key: string;
  phase: ApplyDialogPhase;
  errorCode: string | null;
}

interface ReconcileState {
  snapshot: readonly SnapshotItem[];
  key: string;
  lastError: string | null;
}

@Component({
  selector: 'app-updates-page',
  imports: [
    NgIcon,
    TranslocoPipe, PluralKeyPipe,
    Button,
    Dropdown,
    Field,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    UpdatesTable,
    ApplyDialog,
    OperationStatusDialog,
  ],
  providers: [
    provideIcons({
      tablerCloudOff,
      tablerLoader2,
      tablerLock,
      tablerSortAscending,
      tablerSortDescending,
    }),
  ],
  templateUrl: './updates-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UpdatesPage {
  private static nextId = 0;
  protected readonly uid = `updates-page-${++UpdatesPage.nextId}`;

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly applyDialog = viewChild(ApplyDialog);
  private readonly statusDialog = viewChild(OperationStatusDialog);

  protected readonly defaultPageSize = PAGE_SIZE;
  protected readonly pageSize = signal(PAGE_SIZE);
  protected readonly maxSelections = MAX_SELECTIONS;

  // Permission state
  protected readonly permissionDenied = signal(false);
  protected readonly canRead = computed(() => CAN_READ && !this.permissionDenied());
  protected readonly canManage = computed(() => CAN_MANAGE && this.canRead());

  // Query state
  protected readonly searchInput = signal('');
  private readonly appliedSearch = signal('');
  protected readonly riskFilter = signal<RiskFilter>('ALL');
  protected readonly backupFilter = signal<BooleanFilter>('ALL');
  protected readonly maintenanceFilter = signal<BooleanFilter>('ALL');
  protected readonly sortBy = signal<UpdateSortBy>('publishedAt');
  protected readonly sortDir = signal<SortDir>('DESC');
  protected readonly page = signal(1);
  private readonly reloadTick = signal(0);

  // Selection state
  protected readonly selectedKeys = signal<ReadonlySet<string>>(new Set());

  // Apply / lost-answer / reconcile state
  protected readonly attempt = signal<ApplyAttemptState | null>(null);
  protected readonly reconcile = signal<ReconcileState | null>(null);
  protected readonly submittingApply = signal(false);
  protected readonly reconciling = signal(false);
  protected readonly applyDialogOpen = signal(false);

  // Operation tracking & polling state
  protected readonly trackedOperationId = signal<string | null>(null);
  protected readonly trackedOperation = signal<TenantOperationDetail | null>(null);
  protected readonly trackedSnapshot = signal<readonly SnapshotItem[] | null>(null);
  protected readonly operationLoading = signal(false);
  protected readonly operationError = signal<string | null>(null);
  protected readonly statusDialogOpen = signal(false);
  protected readonly autoRefreshStopped = signal(false);
  private readonly pollCount = signal(0);
  private readonly documentVisible = signal(this.document.visibilityState !== 'hidden');

  private opFetchSeq = 0;
  private waitingTerminalListReload = false;
  private terminalListReloaded = false;
  private readonly reloadedOnTerminalForId = new Set<string>();
  private readonly dismissedTerminalOperationIds = new Set<string>();

  // Filter dropdown options
  protected readonly riskOptions = computed<DropdownOption<RiskFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsUpdates.filters.all') },
      { value: 'LOW', label: this.transloco.translate('wsUpdates.risk.LOW') },
      { value: 'MEDIUM', label: this.transloco.translate('wsUpdates.risk.MEDIUM') },
      { value: 'HIGH', label: this.transloco.translate('wsUpdates.risk.HIGH') },
    ];
  });

  protected readonly requirementOptions = computed<DropdownOption<BooleanFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsUpdates.filters.all') },
      { value: 'REQUIRED', label: this.transloco.translate('wsUpdates.filters.required') },
      { value: 'NOT_REQUIRED', label: this.transloco.translate('wsUpdates.filters.notRequired') },
    ];
  });

  protected readonly sortOptions = computed<DropdownOption<UpdateSortBy>[]>(() => {
    this.i18n();
    return [
      { value: 'publishedAt', label: this.transloco.translate('wsUpdates.filters.publishedAt') },
      { value: 'componentKey', label: this.transloco.translate('wsUpdates.table.component') },
      { value: 'riskLevel', label: this.transloco.translate('wsUpdates.table.risk') },
    ];
  });

  private readonly queryParams = computed<UpdatesQuery | undefined>(() => {
    if (!this.canRead()) return undefined;
    this.reloadTick();
    const risk = this.riskFilter();
    const backup = this.backupFilter();
    const maintenance = this.maintenanceFilter();
    const key = this.appliedSearch();
    return {
      page: this.page(),
      limit: PAGE_SIZE,
      componentKey: key || undefined,
      riskLevel: risk === 'ALL' ? undefined : risk,
      requiresBackup: backup === 'ALL' ? undefined : backup === 'REQUIRED',
      requiresMaintenance: maintenance === 'ALL' ? undefined : maintenance === 'REQUIRED',
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
  });

  private readonly listResource = resource({
    params: () => this.queryParams(),
    loader: async ({ params }) => listUpdates(params),
  });

  private readonly lastResult = signal<UpdatesPageResult | null>(null);

  protected readonly listLoading = this.listResource.isLoading;
  protected readonly firstLoadLoading = computed(
    () => this.listLoading() && this.lastResult() === null,
  );
  protected readonly listError = this.listResource.error;
  protected readonly rows = computed(() => this.lastResult()?.data ?? []);
  protected readonly total = computed(() => this.lastResult()?.meta.total ?? 0);
  protected readonly loadFailedWithoutRows = computed(
    () => !this.listLoading() && !!this.listError() && this.lastResult() === null,
  );
  protected readonly refreshFailed = computed(
    () => !this.listLoading() && !!this.listError() && this.lastResult() !== null,
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchInput().trim() !== '' ||
      this.appliedSearch() !== '' ||
      this.riskFilter() !== 'ALL' ||
      this.backupFilter() !== 'ALL' ||
      this.maintenanceFilter() !== 'ALL',
  );

  protected readonly hasClearableFilters = computed(
    () =>
      this.hasActiveFilters() ||
      this.sortBy() !== 'publishedAt' ||
      this.sortDir() !== 'DESC',
  );

  protected readonly selectedCount = computed(() => this.selectedKeys().size);
  protected readonly capReached = computed(() => this.selectedCount() >= MAX_SELECTIONS);
  protected readonly locked = computed(
    () => this.attempt()?.phase === 'ambiguous' || this.reconcile() !== null,
  );
  protected readonly showAmbiguousNotice = computed(
    () => this.attempt()?.phase === 'ambiguous',
  );

  protected readonly showOperationStrip = computed(() => this.trackedOperationId() !== null);

  protected readonly stripBadgeClass = computed(() =>
    badgeClassForTone(statusTone(this.trackedOperation()?.status ?? '')),
  );

  protected readonly stripStatusText = computed(() => {
    this.i18n();
    const op = this.trackedOperation();
    if (!op) return '';
    const statusText = this.transloco.translate(statusLabelKey(op.status));
    return this.transloco.translate('wsUpdates.operation.strip', { status: statusText });
  });

  protected readonly stripGuidanceKey = computed(() =>
    guidanceKeyForStatus(this.trackedOperation()?.status ?? ''),
  );

  protected readonly stripUpdatedText = computed(() => {
    this.i18n();
    const op = this.trackedOperation();
    if (!op) return '';
    return this.transloco.translate('wsUpdates.operation.updated', {
      time: formatDateTime(op.updatedAt, this.language()),
    });
  });

  protected readonly stripIsActive = computed(() => {
    const status = this.trackedOperation()?.status;
    return status === 'REQUESTED' || status === 'PLANNING' || status === 'QUEUED' || status === 'RUNNING';
  });

  constructor() {
    const onVisibilityChange = () => {
      this.documentVisible.set(this.document.visibilityState !== 'hidden');
    };
    this.document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibilityChange);
    });

    // Debounced component-key search (300 ms); invalid keys send no request and keep rows.
    effect((onCleanup) => {
      const normalized = this.searchInput().trim().toLowerCase();
      const timer = setTimeout(() => {
        if (normalized !== '' && !isValidComponentKey(normalized)) {
          return;
        }
        if (normalized !== untracked(() => this.appliedSearch())) {
          this.appliedSearch.set(normalized);
          this.page.set(1);
          this.selectedKeys.set(new Set());
        }
      }, 300);
      onCleanup(() => clearTimeout(timer));
    });

    // Handle list resource errors (including 403 dropping all state)
    effect(() => {
      const err = this.listResource.error();
      if (!err) return;
      if (this.isForbiddenError(err)) {
        untracked(() => this.handleForbidden());
      }
    });

    // Handle list resource results: keep cached rows, unlock reconcile when planned, start/complete tracking
    effect(() => {
      if (!this.listResource.hasValue()) return;
      const result = this.listResource.value();
      if (!result) return;

      untracked(() => {
        this.lastResult.set(result);

        // Drop selected keys that are no longer shown or no longer eligible.
        const eligibleKeys = new Set(
          result.data.filter((row) => eligibilityOf(row) === 'ELIGIBLE').map((row) => row.componentKey),
        );
        this.selectedKeys.update((prev) => {
          const kept = [...prev].filter((key) => eligibleKeys.has(key));
          return kept.length === prev.size ? prev : new Set(kept);
        });

        // Reconcile check on reload: unlock only when a snapshot component is updateAlreadyPlanned
        const rec = this.reconcile();
        if (rec) {
          const snapshotKeys = new Set(rec.snapshot.map((s) => s.selection.componentKey));
          const plannedMatch = result.data.find(
            (row) => snapshotKeys.has(row.componentKey) && row.updateAlreadyPlanned,
          );
          if (plannedMatch) {
            this.reconcile.set(null);
            this.selectedKeys.set(new Set());
            if (plannedMatch.lastOperationId) {
              this.startTrackingOperation(plannedMatch.lastOperationId, rec.snapshot);
            }
          }
        }

        // Complete terminal strip dismissal once the post-terminal list reload finishes
        const activeOp = this.trackedOperation();
        if (this.waitingTerminalListReload && activeOp && isTerminal(activeOp.status)) {
          this.waitingTerminalListReload = false;
          this.terminalListReloaded = true;
          this.dismissedTerminalOperationIds.add(activeOp.id);
          if (!this.statusDialogOpen()) {
            this.clearTracking();
          }
          return;
        }

        // Initial tracking on page load when a planned row points to an operation
        if (!this.trackedOperationId()) {
          const initialOpId = findInitialTrackedOperationId(result.data);
          if (initialOpId && !this.dismissedTerminalOperationIds.has(initialOpId)) {
            this.startTrackingOperation(initialOpId, null);
          }
        }
      });
    });

    // Keep parent attempt phase aligned if live rows diverge while dialog is open in confirm
    effect(() => {
      const current = this.attempt();
      if (!current || current.phase !== 'confirm' || !this.applyDialogOpen() || this.submittingApply()) {
        return;
      }
      if (snapshotDiverges(current.snapshot, this.rows())) {
        untracked(() => {
          this.attempt.set({
            ...current,
            phase: 'stale',
            errorCode: 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE',
          });
        });
      }
    });

    // Polling effect: ONLY active while status dialog open, tab visible, non-terminal, no error, not in flight, <= 12 polls
    effect((onCleanup) => {
      if (!this.canRead()) return;
      if (!this.statusDialogOpen()) return;
      if (!this.documentVisible()) return;

      const opId = this.trackedOperationId();
      if (!opId) return;
      if (this.operationLoading()) return;
      if (this.operationError() !== null) return;
      if (this.autoRefreshStopped()) return;

      const op = this.trackedOperation();
      if (op && isTerminal(op.status)) return;

      if (this.pollCount() >= MAX_POLL_ATTEMPTS) {
        untracked(() => this.autoRefreshStopped.set(true));
        return;
      }

      const timer = setTimeout(() => {
        this.pollCount.update((c) => c + 1);
        void this.fetchOperation(opId);
      }, POLL_INTERVAL_MS);

      onCleanup(() => clearTimeout(timer));
    });
  }

  protected reloadList(): void {
    if (!this.canRead()) return;
    this.reloadTick.update((n) => n + 1);
  }

  protected onRiskChange(next: RiskFilter): void {
    if (next === this.riskFilter()) return;
    this.riskFilter.set(next);
    this.resetPageAndSelection();
  }

  protected onBackupChange(next: BooleanFilter): void {
    if (next === this.backupFilter()) return;
    this.backupFilter.set(next);
    this.resetPageAndSelection();
  }

  protected onMaintenanceChange(next: BooleanFilter): void {
    if (next === this.maintenanceFilter()) return;
    this.maintenanceFilter.set(next);
    this.resetPageAndSelection();
  }

  protected onSortByChange(next: UpdateSortBy): void {
    if (next === this.sortBy()) return;
    this.sortBy.set(next);
    this.resetPageAndSelection();
  }

  protected toggleSortDir(): void {
    this.sortDir.update((dir) => (dir === 'DESC' ? 'ASC' : 'DESC'));
    this.resetPageAndSelection();
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.riskFilter.set('ALL');
    this.backupFilter.set('ALL');
    this.maintenanceFilter.set('ALL');
    this.sortBy.set('publishedAt');
    this.sortDir.set('DESC');
    this.resetPageAndSelection();
  }

  protected onPageChange(nextPage: number): void {
    if (nextPage === this.page()) return;
    this.page.set(nextPage);
    this.selectedKeys.set(new Set());
  }

  protected toggleRowSelection(componentKey: string): void {
    if (!this.canManage() || this.locked()) return;
    const row = this.rows().find((r) => r.componentKey === componentKey);
    if (!row) return;

    this.selectedKeys.update((prev) => {
      const next = new Set(prev);
      if (next.has(componentKey)) {
        next.delete(componentKey);
        return next;
      }
      if (eligibilityOf(row) !== 'ELIGIBLE' || next.size >= MAX_SELECTIONS) {
        return prev;
      }
      next.add(componentKey);
      return next;
    });
  }

  protected togglePageSelection(selectAll: boolean): void {
    if (!this.canManage() || this.locked()) return;
    const eligible = this.rows().filter((r) => eligibilityOf(r) === 'ELIGIBLE');
    this.selectedKeys.update((prev) => {
      const next = new Set(prev);
      if (!selectAll) {
        for (const row of eligible) {
          next.delete(row.componentKey);
        }
        return next;
      }
      for (const row of eligible) {
        if (next.size >= MAX_SELECTIONS) break;
        next.add(row.componentKey);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    if (this.locked()) return;
    this.selectedKeys.set(new Set());
  }

  protected openApplyDialog(): void {
    if (!this.canManage() || this.locked()) return;
    const selected = this.selectedKeys();
    const chosenRows = this.rows().filter((r) => selected.has(r.componentKey));
    const snapshot = buildSnapshot(chosenRows);
    if (snapshot.length === 0) return;

    this.attempt.set({
      snapshot,
      key: newIdempotencyKey(),
      phase: 'confirm',
      errorCode: null,
    });
    this.applyDialogOpen.set(true);
    this.applyDialog()?.open();
  }

  protected onApplyDiverged(): void {
    const current = this.attempt();
    if (!current || current.phase !== 'confirm') return;
    this.attempt.set({
      ...current,
      phase: 'stale',
      errorCode: 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE',
    });
  }

  protected onApplyReload(): void {
    this.selectedKeys.set(new Set());
    this.attempt.set(null);
    this.applyDialogOpen.set(false);
    this.applyDialog()?.close();
    this.reloadList();
  }

  protected onApplyDialogClosed(): void {
    this.applyDialogOpen.set(false);
    const current = this.attempt();
    if (current && current.phase !== 'ambiguous') {
      this.attempt.set(null);
    }
  }

  protected async submitApply(): Promise<void> {
    const current = this.attempt();
    if (!this.canManage() || !current || current.snapshot.length === 0 || this.submittingApply()) {
      return;
    }

    this.submittingApply.set(true);
    try {
      const res = await applyUpdates(
        { selections: toApplySelections(current.snapshot) },
        current.key,
      );
      this.handleApplySuccess(res.operation, res.replayed, current.snapshot);
    } catch (error) {
      this.handleApplyFailure(error, current);
    } finally {
      this.submittingApply.set(false);
    }
  }

  protected async retryAmbiguousApply(): Promise<void> {
    const current = this.attempt();
    if (!this.canManage() || !current || current.phase !== 'ambiguous' || this.submittingApply()) {
      return;
    }
    this.submittingApply.set(true);
    try {
      const res = await applyUpdates(
        { selections: toApplySelections(current.snapshot) },
        current.key,
      );
      this.handleApplySuccess(res.operation, res.replayed, current.snapshot);
    } catch (error) {
      this.handleApplyFailure(error, current);
    } finally {
      this.submittingApply.set(false);
    }
  }

  protected async checkReconcileStatus(): Promise<void> {
    const rec = this.reconcile();
    if (!this.canManage() || !rec || this.reconciling()) return;

    this.reconciling.set(true);
    try {
      const res = await applyUpdates(
        { selections: toApplySelections(rec.snapshot) },
        rec.key,
      );
      this.reconcile.set(null);
      this.handleApplySuccess(res.operation, res.replayed, rec.snapshot);
    } catch (error) {
      const kind = classifyApplyError(error);
      if (kind === 'forbidden') {
        this.handleForbidden();
        return;
      }
      const message = this.resolveError(error);
      this.reconcile.set({ ...rec, lastError: message });
      this.notify.error(message);
    } finally {
      this.reconciling.set(false);
    }
  }

  protected openStatusDialog(): void {
    const opId = this.trackedOperationId();
    if (!opId) return;
    this.pollCount.set(0);
    this.autoRefreshStopped.set(false);
    this.statusDialogOpen.set(true);
    this.statusDialog()?.open();
    if (!this.trackedOperation() || !isTerminal(this.trackedOperation()!.status)) {
      void this.fetchOperation(opId);
    }
  }

  protected onStatusDialogClosed(): void {
    this.statusDialogOpen.set(false);
    const op = this.trackedOperation();
    if (op && isTerminal(op.status) && this.terminalListReloaded) {
      this.clearTracking();
    }
  }

  protected refreshTrackedOperation(): void {
    const opId = this.trackedOperationId();
    if (!opId || this.operationLoading()) return;
    // Manual refresh always works and is uncounted
    void this.fetchOperation(opId);
  }

  private handleApplySuccess(
    operation: TenantOperationDetail,
    replayed: boolean,
    snapshot: readonly SnapshotItem[],
  ): void {
    this.notify.success(
      this.transloco.translate(replayed ? 'wsUpdates.apply.replayed' : 'wsUpdates.apply.accepted'),
    );
    this.selectedKeys.set(new Set());
    this.attempt.set(null);
    this.reconcile.set(null);
    this.applyDialogOpen.set(false);
    this.applyDialog()?.close();

    this.startTrackingOperation(operation.id, snapshot, operation);
    this.reloadList();
  }

  private handleApplyFailure(error: unknown, current: ApplyAttemptState): void {
    const kind = classifyApplyError(error);
    const code = errorCodeOf(error);

    if (kind === 'forbidden') {
      this.applyDialogOpen.set(false);
      this.applyDialog()?.close();
      this.handleForbidden();
      return;
    }

    if (kind === 'unreadable') {
      this.attempt.set(null);
      this.applyDialogOpen.set(false);
      this.applyDialog()?.close();
      this.reconcile.set({
        snapshot: current.snapshot,
        key: current.key,
        lastError: null,
      });
      return;
    }

    if (kind === 'ambiguous') {
      this.attempt.set({
        ...current,
        phase: 'ambiguous',
        errorCode: code,
      });
      return;
    }

    if (kind === 'stale') {
      this.attempt.set({
        ...current,
        phase: 'stale',
        errorCode: code,
      });
      return;
    }

    if (kind === 'blocked' || kind === 'refused') {
      this.attempt.set({
        ...current,
        phase: kind,
        errorCode: code,
      });
      return;
    }

    // Toast error: if coming from an ambiguous retry, drop ambiguous attempt; in confirm, keep confirm + same key
    if (current.phase === 'ambiguous') {
      this.attempt.set(null);
      this.applyDialogOpen.set(false);
      this.applyDialog()?.close();
    }
    this.notify.error(this.resolveError(error));
  }

  private startTrackingOperation(
    operationId: string,
    snapshot: readonly SnapshotItem[] | null,
    initialDetail?: TenantOperationDetail,
  ): void {
    this.opFetchSeq++;
    this.trackedOperationId.set(operationId);
    this.trackedSnapshot.set(snapshot);
    this.operationError.set(null);
    this.pollCount.set(0);
    this.autoRefreshStopped.set(false);
    this.waitingTerminalListReload = false;
    this.terminalListReloaded = false;

    if (initialDetail && initialDetail.id === operationId) {
      this.trackedOperation.set(initialDetail);
      if (isTerminal(initialDetail.status)) {
        this.reloadedOnTerminalForId.add(initialDetail.id);
        this.dismissedTerminalOperationIds.add(initialDetail.id);
        this.waitingTerminalListReload = true;
      }
      return;
    }

    this.trackedOperation.set(null);
    void this.fetchOperation(operationId);
  }

  private async fetchOperation(operationId: string): Promise<void> {
    const seq = ++this.opFetchSeq;
    this.operationLoading.set(true);
    try {
      const detail = await getOperation(operationId);
      if (seq !== this.opFetchSeq || this.trackedOperationId() !== operationId) return;

      if (detail.id !== operationId) {
        this.operationError.set(this.transloco.translate('wsUpdates.operation.loadFailed'));
        return;
      }

      this.trackedOperation.set(detail);
      this.operationError.set(null);

      if (isTerminal(detail.status)) {
        this.autoRefreshStopped.set(false);
        this.dismissedTerminalOperationIds.add(detail.id);
        if (!this.reloadedOnTerminalForId.has(detail.id)) {
          this.reloadedOnTerminalForId.add(detail.id);
          this.waitingTerminalListReload = true;
          this.reloadList();
        }
      }
    } catch (error) {
      if (seq !== this.opFetchSeq || this.trackedOperationId() !== operationId) return;

      if (this.isForbiddenError(error)) {
        this.clearTracking();
        this.handleForbidden();
        return;
      }

      if (
        (error instanceof ApiError && error.status === 404) ||
        errorCodeOf(error) === 'TENANT_OPERATION_NOT_FOUND'
      ) {
        this.clearTracking();
        this.statusDialogOpen.set(false);
        this.statusDialog()?.close();
        this.notify.error(this.resolveError(error));
        return;
      }

      this.operationError.set(this.transloco.translate('wsUpdates.operation.loadFailed'));
    } finally {
      if (seq === this.opFetchSeq) {
        this.operationLoading.set(false);
      }
    }
  }

  private clearTracking(): void {
    this.opFetchSeq++;
    this.trackedOperationId.set(null);
    this.trackedOperation.set(null);
    this.trackedSnapshot.set(null);
    this.operationLoading.set(false);
    this.operationError.set(null);
    this.pollCount.set(0);
    this.autoRefreshStopped.set(false);
    this.waitingTerminalListReload = false;
    this.terminalListReloaded = false;
  }

  private handleForbidden(): void {
    this.lastResult.set(null);
    this.selectedKeys.set(new Set());
    this.attempt.set(null);
    this.reconcile.set(null);
    this.clearTracking();
    this.permissionDenied.set(true);
    this.notify.error(this.transloco.translate('settings.errors.permission'));
  }

  private isForbiddenError(error: unknown): boolean {
    return (error instanceof ApiError && error.status === 403) || errorCodeOf(error) === 'FORBIDDEN';
  }

  private resolveError(error: unknown): string {
    if (error instanceof ApiError && error.status === 401) {
      return this.transloco.translate('settings.errors.session');
    }
    return errorMessage(error, 'wsUpdates', this.transloco);
  }

  private resetPageAndSelection(): void {
    this.page.set(1);
    this.selectedKeys.set(new Set());
  }
}
