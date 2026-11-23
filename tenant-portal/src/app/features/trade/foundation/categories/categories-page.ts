import {
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowDown,
  tablerArrowUp,
  tablerArrowsMove,
  tablerCategory,
  tablerChevronRight,
  tablerEye,
  tablerFolderPlus,
  tablerHierarchy,
  tablerLayoutColumns,
  tablerLayoutList,
  tablerListTree,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerToggleRight,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { tenantWide } from '../../shared/trade-access';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey } from '../../shared/trade-api';
import { actionKey } from '../action-keys';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import {
  deleteCategory,
  getCategory,
  listCategories,
  moveCategory,
  reorderCategory,
  searchCategories,
  setCategoryStatus,
  createCategory,
} from './categories.api';
import {
  CATEGORY_NAME_MAX,
  CATEGORY_VIEW_MODES,
  type CategoryActionEvent,
  type CategoryConflictStale,
  type CategoryDetail,
  type CategoryReasonPayload,
  type CategoryReceipt,
  type CategoryReorderEvent,
  type CategoryStatusFilter,
  type CategorySummary,
  type CategoryViewMode,
  type CreateCategoryBody,
  type DeleteCategoryBody,
  type SetCategoryStatusBody,
  categoryNodeTile,
  deleteBlockerKey,
  inactiveAncestorName,
  isMutedByAncestor,
  staleKindOf,
} from './categories.model';
import { CategoriesService } from './categories.service';
import { CategoryChart } from './category-chart/category-chart';
import { CategoryModal, type CategoryModalConflict, type CategoryModalSavedEvent } from './category-modal/category-modal';
import { type CategoryMoveConfirmEvent, CategoryMoveDialog } from './category-move-dialog/category-move-dialog';
import { type CategoryReasonMode, CategoryReasonDialog } from './category-reason-dialog/category-reason-dialog';
import { CategoryTreeColumns } from './category-tree-columns/category-tree-columns';
import { CategoryTreeRows } from './category-tree-rows/category-tree-rows';

const SEARCH_DEBOUNCE_MS = 300;
const RESULTS_PAGE_LIMIT = 100;

const VIEW_ICONS: Record<CategoryViewMode, string> = {
  rows: 'tablerLayoutList',
  columns: 'tablerLayoutColumns',
  chart: 'tablerHierarchy',
};

type PendingReasonAction =
  | { kind: 'activate' | 'deactivate'; node: CategorySummary | CategoryDetail }
  | { kind: 'delete'; node: CategoryDetail };

type PendingConflict =
  | { kind: 'create'; body: CreateCategoryBody; stale: CategoryConflictStale }
  | { kind: 'rename'; id: string; parentId: string | null; stale: CategoryConflictStale }
  | { kind: 'move'; id: string; oldParentId: string | null; newParentId: string | null; stale: CategoryConflictStale }
  | { kind: 'reorder'; id: string; parentId: string | null; beforeId: string | null; stale: CategoryConflictStale }
  | {
      kind: 'status';
      id: string;
      parentId: string | null;
      status: 'ACTIVE' | 'INACTIVE';
      reasonCodeId: string;
      reasonNote?: string;
      stale: CategoryConflictStale;
    }
  | {
      kind: 'delete';
      id: string;
      parentId: string | null;
      reasonCodeId: string;
      reasonNote?: string;
      stale: CategoryConflictStale;
    };

@Component({
  selector: 'app-trade-categories-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    FullState,
    Modal,
    StepFilter,
    ViewSwitcher,
    CategoryTreeRows,
    CategoryTreeColumns,
    CategoryChart,
    CategoryModal,
    CategoryMoveDialog,
    CategoryReasonDialog,
  ],
  providers: [
    CategoriesService,
    provideTranslocoScope(
      'settings',
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-categories', alias: 'tradeCategories' },
    ),
    provideIcons({
      tablerPlus,
      tablerListTree,
      tablerLayoutList,
      tablerLayoutColumns,
      tablerHierarchy,
      tablerCategory,
      tablerEye,
      tablerFolderPlus,
      tablerArrowsMove,
      tablerArrowUp,
      tablerArrowDown,
      tablerToggleRight,
      tablerTrash,
      tablerSearch,
      tablerX,
      tablerChevronRight,
      tablerAlertTriangle,
      tablerRefresh,
    }),
  ],
  templateUrl: './categories-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class CategoriesPage {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  protected readonly service = inject(CategoriesService);

  private readonly treeRows = viewChild(CategoryTreeRows);
  private readonly categoryModal = viewChild.required(CategoryModal);
  private readonly moveDialog = viewChild.required(CategoryMoveDialog);
  private readonly reasonDialog = viewChild.required(CategoryReasonDialog);
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');

  /** Bound from `?view=` and `?status=` query parameters. */
  readonly view = input<string>();
  readonly status = input<string>();

  protected readonly canManage = computed(() =>
    runInInjectionContext(this.injector, () => tenantWide('trade.catalog_master.manage')),
  );
  protected readonly searchMax = CATEGORY_NAME_MAX;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly currentView = linkedSignal<string | undefined, CategoryViewMode>({
    source: () => this.view(),
    computation: (param) => (CATEGORY_VIEW_MODES.includes(param as CategoryViewMode) ? (param as CategoryViewMode) : 'rows'),
  });

  protected readonly statusFilter = linkedSignal<string | undefined, CategoryStatusFilter>({
    source: () => this.status(),
    computation: (param) => (param === 'ACTIVE' || param === 'INACTIVE' ? param : 'ALL'),
  });

  protected readonly searchText = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly results = signal<CategorySummary[]>([]);
  protected readonly resultsTotal = signal(0);
  protected readonly resultsPage = signal(1);
  protected readonly resultsLoading = signal(false);
  protected readonly resultsLoadingMore = signal(false);
  protected readonly resultsFailed = signal(false);
  private readonly resultsForbidden = signal(false);

  protected readonly forbidden = computed(() => this.service.forbidden() || this.resultsForbidden());
  protected readonly conflictBusy = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resultsSeq = 0;
  private pendingReasonAction: PendingReasonAction | null = null;
  private readonly pendingConflict = signal<PendingConflict | null>(null);
  private langInitialized = false;

  protected readonly conflictTextKey = computed(() => {
    const stale = this.pendingConflict()?.stale ?? null;
    if (stale === 'TREE') return 'tradeCategories.conflict.tree';
    if (stale === 'NODE') return 'tradeCategories.conflict.node';
    return 'tradeShared.conflict.text';
  });

  protected readonly isResultsMode = computed(
    () => this.debouncedSearch().trim().length > 0 || this.statusFilter() !== 'ALL',
  );

  protected readonly effectiveView = computed<CategoryViewMode>(() =>
    this.isResultsMode() ? 'rows' : this.currentView(),
  );

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return CATEGORY_VIEW_MODES.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`tradeCategories.view.${id}`),
    }));
  });

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.service.counts();
    return [
      { id: 'ALL', label: this.transloco.translate('tradeCategories.filter.all'), count: counts.all },
      {
        id: 'ACTIVE',
        label: this.transloco.translate('tradeCategories.filter.active'),
        count: counts.active,
        tone: 'success',
      },
      { id: 'INACTIVE', label: this.transloco.translate('tradeCategories.filter.inactive'), count: counts.inactive },
    ];
  });

  protected readonly actionsForNode = computed<(node: CategorySummary) => ActionItem[]>(() => {
    this.i18n();
    this.canManage();
    return (node: CategorySummary) => this.buildNodeActions(node);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearSearchTimer());
    void this.service.loadInitial();

    effect(() => {
      const search = this.debouncedSearch().trim();
      const status = this.statusFilter();
      if (!search && status === 'ALL') {
        untracked(() => {
          this.resultsSeq += 1;
          this.results.set([]);
          this.resultsTotal.set(0);
          this.resultsPage.set(1);
          this.resultsLoading.set(false);
          this.resultsLoadingMore.set(false);
          this.resultsFailed.set(false);
          this.resultsForbidden.set(false);
        });
        return;
      }
      untracked(() => void this.loadResults(1, false));
    });

    effect(() => {
      this.language();
      if (!this.langInitialized) {
        this.langInitialized = true;
        return;
      }
      untracked(() => {
        void this.service.reloadAllLoaded().catch((error) => {
          if (error instanceof ApiError && error.status === 403) {
            this.service.forbidden.set(true);
            return;
          }
          this.toastError(error);
        });
        if (this.isResultsMode()) {
          void this.loadResults(1, false);
        }
      });
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/');
  }

  protected reload(): void {
    this.resultsForbidden.set(false);
    if (this.isResultsMode()) {
      void Promise.all([this.loadResults(1, false), this.service.refreshCounts().catch(() => undefined)]);
      return;
    }
    void this.service.loadInitial();
  }

  protected openCreateRoot(): void {
    if (!this.canManage()) return;
    this.categoryModal().openCreate(null);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, this.searchMax);
    this.searchText.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.debouncedSearch.set(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.searchText.set('');
    this.debouncedSearch.set('');
  }

  protected clearFilters(): void {
    this.clearSearch();
    this.setStatusFilter('ALL');
  }

  protected setView(next: string): void {
    const mode: CategoryViewMode = CATEGORY_VIEW_MODES.includes(next as CategoryViewMode)
      ? (next as CategoryViewMode)
      : 'rows';
    this.currentView.set(mode);
    void this.router.navigate([], {
      queryParams: { view: mode === 'rows' ? null : mode },
      queryParamsHandling: 'merge',
    });
  }

  protected setStatusFilter(next: string): void {
    const filter: CategoryStatusFilter = next === 'ACTIVE' || next === 'INACTIVE' ? next : 'ALL';
    this.statusFilter.set(filter);
    void this.router.navigate([], {
      queryParams: { status: filter === 'ALL' ? null : filter },
      queryParamsHandling: 'merge',
    });
  }

  protected expandAll(): void {
    if (this.isResultsMode() || this.service.expandingAll()) return;
    void this.service.expandAll((error) => this.toastError(error));
  }

  protected collapseAll(): void {
    if (this.isResultsMode()) return;
    this.service.collapseAll();
  }

  protected async onToggleNode(id: string): Promise<void> {
    try {
      await this.service.toggleExpand(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        this.service.forbidden.set(true);
        return;
      }
      this.toastError(error);
    }
  }

  protected onResultActionSelected(node: CategorySummary, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'addChild':
      case 'move':
      case 'moveUp':
      case 'moveDown':
      case 'activate':
      case 'deactivate':
      case 'delete':
        void this.onNodeAction({ node, action: selection.id });
        break;
    }
  }

  protected onRowKey(event: Event, node: CategorySummary): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    void this.onNodeAction({ node, action: 'open' });
  }

  protected async onNodeAction(event: CategoryActionEvent): Promise<void> {
    const { node, action } = event;

    switch (action) {
      case 'open':
        this.categoryModal().openEdit(node.id);
        return;

      case 'addChild':
        if (!this.canManage() || node.depth >= 8 || !node.effectiveActive) return;
        this.categoryModal().openCreate(node);
        return;

      case 'move':
        if (!this.canManage()) return;
        this.moveDialog().open(node);
        return;

      case 'moveUp':
        if (!this.canManage()) return;
        await this.stepSibling(node, -1);
        return;

      case 'moveDown':
        if (!this.canManage()) return;
        await this.stepSibling(node, 1);
        return;

      case 'activate':
      case 'deactivate':
        if (!this.canManage()) return;
        if (action === 'activate' && node.inactiveAncestorId !== null) return;
        this.openReasonPrompt(action, node);
        return;

      case 'delete':
        if (!this.canManage()) return;
        await this.startDelete(node);
        return;

      case 'showInTree':
        await this.showNodeInTree(node);
        return;
    }
  }

  protected async onTreeReorder(event: CategoryReorderEvent): Promise<void> {
    if (!this.canManage()) return;
    const node = this.service.nodesById().get(event.id);
    if (!node) return;
    await this.executeReorder(event.id, event.parentId, event.beforeId, node.version, this.service.treeVersion());
  }

  protected async onModalSaved(event: CategoryModalSavedEvent): Promise<void> {
    this.service.observeTreeVersion(event.receipt.treeVersion);

    if (event.kind === 'create') {
      await this.service.reloadParentChain(event.parentId, { forceParent: true });
      if (event.parentId !== null) {
        this.service.expand(event.parentId);
      }
    } else {
      await Promise.all([
        this.service.reloadParentChain(event.parentId, { forceParent: true }),
        this.service.reloadLoadedSubtree(event.id),
      ]);
    }

    await this.afterWriteCommon();
    this.toastReceipt(event.receipt, event.kind === 'create' ? 'tradeCategories.toast.created' : 'tradeCategories.toast.saved');
  }

  protected onModalConflict(conflict: CategoryModalConflict): void {
    this.pendingConflict.set(conflict);
    this.conflictModal().open();
  }

  protected onModalStatusRequested(detail: CategoryDetail): void {
    if (!this.canManage()) return;
    const mode: CategoryReasonMode = detail.status === 'ACTIVE' ? 'deactivate' : 'activate';
    if (mode === 'activate' && detail.inactiveAncestorId !== null) return;
    this.openReasonPrompt(mode, detail);
  }

  protected async onModalDeleteRequested(detail: CategoryDetail): Promise<void> {
    if (!this.canManage()) return;
    if (!detail.usage.canDelete) {
      this.notifyDeleteBlockers(detail);
      return;
    }
    this.openReasonPrompt('delete', detail);
  }

  protected async onMoveConfirmed(event: CategoryMoveConfirmEvent): Promise<void> {
    if (!this.canManage()) return;
    const { source, targetParentId } = event;
    const expectedTreeVersion = Math.max(this.service.treeVersion(), source.treeVersion);
    const body = { expectedTreeVersion, parentId: targetParentId, beforeId: null };
    const action = actionKey('move', source.id, source.version, body);

    this.moveDialog().setSubmitting(true);
    try {
      const receipt = await moveCategory(source.id, body, source.version, action.key);
      action.done();
      this.service.observeTreeVersion(receipt.treeVersion);
      this.moveDialog().close();
      await this.refreshAfterMove(source.id, source.parentId, targetParentId);
      this.toastReceipt(receipt, 'tradeCategories.toast.moved');
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        action.done();
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingConflict.set({
          kind: 'move',
          id: source.id,
          oldParentId: source.parentId,
          newParentId: targetParentId,
          stale: staleKindOf(error),
        });
        this.conflictModal().open();
        return;
      }
      this.toastError(error);
    } finally {
      this.moveDialog().setSubmitting(false);
    }
  }

  protected async onReasonConfirmed(submission: CategoryReasonPayload): Promise<void> {
    const pending = this.pendingReasonAction;
    if (!pending || !this.canManage()) return;

    this.reasonDialog().setSubmitting(true);
    let currentAction: { key: string; done: () => void } | null = null;
    try {
      const expectedTreeVersion = this.service.treeVersion();

      if (pending.kind === 'delete') {
        const body: DeleteCategoryBody = {
          expectedTreeVersion,
          reasonCodeId: submission.reasonCodeId,
          ...(submission.reasonNote ? { reasonNote: submission.reasonNote } : {}),
        };
        const action = actionKey('delete', pending.node.id, pending.node.version, body);
        currentAction = action;
        const receipt = await deleteCategory(pending.node.id, body, pending.node.version, action.key);
        action.done();
        this.service.observeTreeVersion(receipt.treeVersion);
        this.pendingReasonAction = null;
        this.reasonDialog().close();
        await this.refreshAfterDelete(pending.node.id, pending.node.parentId);
        this.notify.success(this.transloco.translate('tradeCategories.toast.deleted'));
        return;
      }

      const nextStatus = pending.kind === 'activate' ? 'ACTIVE' : 'INACTIVE';
      const body: SetCategoryStatusBody = {
        expectedTreeVersion,
        status: nextStatus,
        reasonCodeId: submission.reasonCodeId,
        ...(submission.reasonNote ? { reasonNote: submission.reasonNote } : {}),
      };
      const action = actionKey('status', pending.node.id, pending.node.version, body);
      currentAction = action;
      const receipt = await setCategoryStatus(pending.node.id, body, pending.node.version, action.key);
      action.done();
      this.service.observeTreeVersion(receipt.treeVersion);
      this.pendingReasonAction = null;
      this.reasonDialog().close();
      await this.refreshAfterStatus(pending.node.id, pending.node.parentId);
      this.toastReceipt(receipt, 'tradeCategories.toast.statusChanged');
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        currentAction?.done();
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const stale = staleKindOf(error);
        if (pending.kind === 'delete') {
          this.pendingConflict.set({
            kind: 'delete',
            id: pending.node.id,
            parentId: pending.node.parentId,
            reasonCodeId: submission.reasonCodeId,
            ...(submission.reasonNote ? { reasonNote: submission.reasonNote } : {}),
            stale,
          });
        } else {
          this.pendingConflict.set({
            kind: 'status',
            id: pending.node.id,
            parentId: pending.node.parentId,
            status: pending.kind === 'activate' ? 'ACTIVE' : 'INACTIVE',
            reasonCodeId: submission.reasonCodeId,
            ...(submission.reasonNote ? { reasonNote: submission.reasonNote } : {}),
            stale,
          });
        }
        this.conflictModal().open();
        return;
      }
      this.toastError(error);
    } finally {
      this.reasonDialog().setSubmitting(false);
    }
  }

  protected onConflictClosed(): void {
    if (!this.conflictBusy()) {
      this.pendingConflict.set(null);
    }
  }

  protected async resolveConflictReload(): Promise<void> {
    const conflict = this.pendingConflict();
    if (!conflict || this.conflictBusy()) return;

    this.conflictBusy.set(true);
    try {
      await this.service.reloadAllLoaded();
      if (this.isResultsMode()) {
        await this.loadResults(1, false);
      }

      if (conflict.kind !== 'create' && this.categoryModal().isOpenFor(conflict.id)) {
        try {
          const fresh = await getCategory(conflict.id);
          this.service.observeTreeVersion(fresh.treeVersion);
          this.categoryModal().applyConflictReload(fresh);
        } catch (error) {
          this.toastError(error);
          this.categoryModal().forceClose();
        }
      }

      if (conflict.kind === 'move') {
        this.moveDialog().close();
      } else if (conflict.kind === 'status' || conflict.kind === 'delete') {
        this.pendingReasonAction = null;
        this.reasonDialog().close();
      }

      this.pendingConflict.set(null);
      this.conflictModal().close();
    } catch (error) {
      this.toastError(error);
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async resolveConflictKeepMine(): Promise<void> {
    const conflict = this.pendingConflict();
    if (!conflict || this.conflictBusy()) return;

    this.conflictBusy.set(true);
    try {
      if (conflict.kind === 'rename') {
        const fresh = await getCategory(conflict.id);
        this.service.observeTreeVersion(fresh.treeVersion);
        this.categoryModal().applyConflictKeepMine(fresh);
        this.pendingConflict.set(null);
        this.conflictModal().close();
        await this.service.reloadParentChain(conflict.parentId, { forceParent: true });
        return;
      }

      if (conflict.kind === 'create') {
        const parentId = conflict.body.parentId ?? null;
        await this.service.loadLevel(parentId, { force: true });
        const receipt = await createCategory(
          { ...conflict.body, expectedTreeVersion: this.service.treeVersion() },
          newIdempotencyKey(),
        );
        this.service.observeTreeVersion(receipt.treeVersion);
        this.pendingConflict.set(null);
        this.conflictModal().close();
        this.categoryModal().forceClose();
        await this.service.reloadParentChain(parentId, { forceParent: true });
        if (parentId !== null) {
          this.service.expand(parentId);
        }
        await this.afterWriteCommon();
        this.toastReceipt(receipt, 'tradeCategories.toast.created');
        return;
      }

      const fresh = await getCategory(conflict.id);
      this.service.observeTreeVersion(fresh.treeVersion);
      const retryKey = newIdempotencyKey();

      if (conflict.kind === 'move') {
        const receipt = await moveCategory(
          conflict.id,
          { expectedTreeVersion: fresh.treeVersion, parentId: conflict.newParentId, beforeId: null },
          fresh.version,
          retryKey,
        );
        this.service.observeTreeVersion(receipt.treeVersion);
        this.pendingConflict.set(null);
        this.conflictModal().close();
        this.moveDialog().close();
        await this.refreshAfterMove(conflict.id, fresh.parentId, conflict.newParentId);
        this.toastReceipt(receipt, 'tradeCategories.toast.moved');
        return;
      }

      if (conflict.kind === 'reorder') {
        const receipt = await reorderCategory(
          conflict.id,
          { expectedTreeVersion: fresh.treeVersion, beforeId: conflict.beforeId },
          fresh.version,
          retryKey,
        );
        this.service.observeTreeVersion(receipt.treeVersion);
        this.pendingConflict.set(null);
        this.conflictModal().close();
        await this.service.reloadParentChain(fresh.parentId, { forceParent: true });
        await this.afterWriteCommon();
        this.toastReceipt(receipt, 'tradeCategories.toast.saved');
        return;
      }

      if (conflict.kind === 'status') {
        const receipt = await setCategoryStatus(
          conflict.id,
          {
            expectedTreeVersion: fresh.treeVersion,
            status: conflict.status,
            reasonCodeId: conflict.reasonCodeId,
            ...(conflict.reasonNote ? { reasonNote: conflict.reasonNote } : {}),
          },
          fresh.version,
          retryKey,
        );
        this.service.observeTreeVersion(receipt.treeVersion);
        this.pendingConflict.set(null);
        this.pendingReasonAction = null;
        this.conflictModal().close();
        this.reasonDialog().close();
        await this.refreshAfterStatus(conflict.id, fresh.parentId);
        this.toastReceipt(receipt, 'tradeCategories.toast.statusChanged');
        return;
      }

      if (!fresh.usage.canDelete) {
        this.notifyDeleteBlockers(fresh);
        this.pendingConflict.set(null);
        this.pendingReasonAction = null;
        this.conflictModal().close();
        this.reasonDialog().close();
        await this.service.reloadAllLoaded();
        return;
      }

      const receipt = await deleteCategory(
        conflict.id,
        {
          expectedTreeVersion: fresh.treeVersion,
          reasonCodeId: conflict.reasonCodeId,
          ...(conflict.reasonNote ? { reasonNote: conflict.reasonNote } : {}),
        },
        fresh.version,
        retryKey,
      );
      this.service.observeTreeVersion(receipt.treeVersion);
      this.pendingConflict.set(null);
      this.pendingReasonAction = null;
      this.conflictModal().close();
      this.reasonDialog().close();
      await this.refreshAfterDelete(conflict.id, fresh.parentId);
      this.notify.success(this.transloco.translate('tradeCategories.toast.deleted'));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        // Still stale: keep the conflict modal open with the fresh stale kind (no toast).
        const stale = staleKindOf(error);
        this.pendingConflict.update((curr) => (curr ? { ...curr, stale } : null));
      } else {
        this.toastError(error);
        this.pendingConflict.set(null);
        this.conflictModal().close();
      }
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected loadMoreResults(): void {
    if (this.resultsLoading() || this.resultsLoadingMore()) return;
    if (this.results().length >= this.resultsTotal()) return;
    void this.loadResults(this.resultsPage() + 1, true);
  }

  protected tileClass(node: CategorySummary): string {
    return categoryNodeTile(node);
  }

  protected isMuted(node: CategorySummary): boolean {
    return isMutedByAncestor(node);
  }

  protected ancestorName(node: CategorySummary): string {
    return inactiveAncestorName(node);
  }

  private buildNodeActions(node: CategorySummary): ActionItem[] {
    if (!this.canManage()) {
      return [
        {
          id: 'open',
          title: this.transloco.translate('tradeShared.common.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
      ];
    }

    const selfStep = node.path[node.path.length - 1];
    const siblingPos = selfStep?.siblingPosition ?? 1;
    const siblingTotal = selfStep?.siblingTotal ?? 1;

    const addDisabled = node.depth >= 8 || !node.effectiveActive;
    const addReason =
      node.depth >= 8
        ? this.transloco.translate('tradeCategories.reason.maxDepth')
        : !node.effectiveActive
          ? this.transloco.translate('tradeCategories.reason.parentInactive')
          : undefined;

    const activateDisabled = node.status === 'INACTIVE' && node.inactiveAncestorId !== null;
    const activateReason = activateDisabled
      ? this.transloco.translate('tradeCategories.reason.activateParentFirst', {
          parent: inactiveAncestorName(node),
        })
      : undefined;

    const deleteDisabled = node.status === 'ACTIVE' || node.hasChildren;
    const deleteReason =
      node.status === 'ACTIVE'
        ? this.transloco.translate('tradeCategories.reason.deactivateFirst')
        : node.hasChildren
          ? this.transloco.translate('tradeCategories.reason.hasChildren')
          : undefined;

    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('tradeShared.common.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'addChild',
        title: this.transloco.translate('tradeCategories.actions.addChild'),
        icon: 'tablerFolderPlus',
        tile: 'bg-icon-teal',
        disabled: addDisabled,
        reason: addReason,
      },
      {
        id: 'move',
        title: this.transloco.translate('tradeCategories.actions.move'),
        icon: 'tablerArrowsMove',
        tile: 'bg-icon-navy',
      },
      {
        id: 'moveUp',
        title: this.transloco.translate('tradeCategories.actions.moveUp'),
        icon: 'tablerArrowUp',
        tile: 'bg-icon-gray',
        disabled: siblingPos <= 1,
      },
      {
        id: 'moveDown',
        title: this.transloco.translate('tradeCategories.actions.moveDown'),
        icon: 'tablerArrowDown',
        tile: 'bg-icon-gray',
        disabled: siblingPos >= siblingTotal,
      },
      node.status === 'ACTIVE'
        ? {
            id: 'deactivate',
            title: this.transloco.translate('tradeCategories.actions.deactivate'),
            icon: 'tablerToggleRight',
            tile: 'bg-icon-orange',
          }
        : {
            id: 'activate',
            title: this.transloco.translate('tradeCategories.actions.activate'),
            icon: 'tablerToggleRight',
            tile: 'bg-icon-green',
            disabled: activateDisabled,
            reason: activateReason,
          },
      {
        id: 'delete',
        title: this.transloco.translate('tradeCategories.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: deleteDisabled,
        reason: deleteReason,
      },
    ];

    return items;
  }

  private async stepSibling(node: CategorySummary, delta: -1 | 1): Promise<void> {
    try {
      const siblings = this.service.isLevelLoaded(node.parentId)
        ? this.service.childrenOf(node.parentId)
        : await this.service.loadLevel(node.parentId);
      const index = siblings.findIndex((item) => item.id === node.id);
      if (index < 0) return;

      let beforeId: string | null = null;
      if (delta === -1) {
        if (index === 0) return;
        beforeId = siblings[index - 1].id;
      } else {
        if (index >= siblings.length - 1) return;
        beforeId = index + 2 < siblings.length ? siblings[index + 2].id : null;
      }

      await this.executeReorder(node.id, node.parentId, beforeId, node.version, this.service.treeVersion());
    } catch (error) {
      this.toastError(error);
    }
  }

  private async executeReorder(
    id: string,
    parentId: string | null,
    beforeId: string | null,
    version: number,
    expectedTreeVersion: number,
  ): Promise<void> {
    let currentAction: { key: string; done: () => void } | null = null;
    try {
      const action = actionKey('reorder', id, version, expectedTreeVersion, beforeId);
      currentAction = action;
      const receipt = await reorderCategory(id, { expectedTreeVersion, beforeId }, version, action.key);
      action.done();
      this.service.observeTreeVersion(receipt.treeVersion);
      await this.service.reloadParentChain(parentId, { forceParent: true });
      await this.afterWriteCommon();
      this.toastReceipt(receipt, 'tradeCategories.toast.saved');
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        currentAction?.done();
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingConflict.set({
          kind: 'reorder',
          id,
          parentId,
          beforeId,
          stale: staleKindOf(error),
        });
        this.conflictModal().open();
        return;
      }
      this.toastError(error);
    }
  }

  private openReasonPrompt(mode: CategoryReasonMode, node: CategorySummary | CategoryDetail): void {
    this.pendingReasonAction =
      mode === 'delete' ? { kind: 'delete', node: node as CategoryDetail } : { kind: mode, node };
    this.reasonDialog().open({ mode, name: node.name });
  }

  private async startDelete(node: CategorySummary): Promise<void> {
    try {
      const detail = await getCategory(node.id);
      this.service.observeTreeVersion(detail.treeVersion);
      if (!detail.usage.canDelete) {
        this.notifyDeleteBlockers(detail);
        return;
      }
      this.openReasonPrompt('delete', detail);
    } catch (error) {
      this.toastError(error);
    }
  }

  private async showNodeInTree(node: CategorySummary): Promise<void> {
    this.clearSearchTimer();
    this.searchText.set('');
    this.debouncedSearch.set('');
    this.statusFilter.set('ALL');
    this.currentView.set('rows');

    void this.router.navigate([], {
      queryParams: { view: null, status: null },
      queryParamsHandling: 'merge',
    });

    try {
      await this.service.expandPath(node.path);
      afterNextRender(() => this.treeRows()?.focusNode(node.id), { injector: this.injector });
    } catch (error) {
      this.toastError(error);
    }
  }

  private async refreshAfterStatus(id: string, parentId: string | null): Promise<void> {
    await Promise.all([
      this.service.reloadParentChain(parentId, { forceParent: true }),
      this.service.reloadLoadedSubtree(id),
    ]);
    if (this.categoryModal().isOpenFor(id)) {
      this.categoryModal().refreshDetail();
    }
    await this.afterWriteCommon();
  }

  private async refreshAfterMove(id: string, oldParentId: string | null, newParentId: string | null): Promise<void> {
    await Promise.all([
      this.service.reloadParentChain(oldParentId, { forceParent: true }),
      this.service.reloadParentChain(newParentId, { forceParent: true }),
      this.service.reloadLoadedSubtree(id),
    ]);
    if (newParentId !== null) {
      this.service.expand(newParentId);
    }
    await this.afterWriteCommon();
  }

  private async refreshAfterDelete(id: string, parentId: string | null): Promise<void> {
    // The deleted row held focus: move it to the previous sibling, else the parent, else the next sibling.
    const siblings = this.service.childrenOf(parentId);
    const index = siblings.findIndex((node) => node.id === id);
    const focusTarget = siblings[index - 1]?.id ?? parentId ?? siblings[index + 1]?.id ?? null;
    this.service.pruneNode(id);
    await this.service.reloadParentChain(parentId, { forceParent: true });
    if (this.categoryModal().isOpenFor(id)) {
      this.categoryModal().forceClose();
    }
    await this.afterWriteCommon();
    if (focusTarget) {
      afterNextRender(() => this.treeRows()?.focusNode(focusTarget), { injector: this.injector });
    }
  }

  private async afterWriteCommon(): Promise<void> {
    if (this.isResultsMode()) {
      await Promise.all([this.loadResults(1, false), this.service.refreshCounts()]);
    } else {
      await this.service.refreshCounts();
    }
  }

  private async loadResults(page: number, append: boolean): Promise<void> {
    const search = this.debouncedSearch().trim();
    const status = this.statusFilter();
    if (!search && status === 'ALL') return;

    const seq = ++this.resultsSeq;
    if (append) {
      this.resultsLoadingMore.set(true);
    } else {
      this.resultsLoading.set(true);
      this.resultsFailed.set(false);
      this.resultsForbidden.set(false);
    }

    try {
      const response = search
        ? await searchCategories({
            search,
            ...(status !== 'ALL' ? { status } : {}),
            page,
            limit: RESULTS_PAGE_LIMIT,
          })
        : await listCategories({
            ...(status !== 'ALL' ? { status } : {}),
            page,
            limit: RESULTS_PAGE_LIMIT,
          });

      if (seq !== this.resultsSeq) return;
      this.service.observeTreeVersion(response.treeVersion);
      this.resultsPage.set(response.page);
      this.resultsTotal.set(response.total);
      this.results.update((prev) => (append ? [...prev, ...response.items] : response.items));
    } catch (error) {
      if (seq !== this.resultsSeq) return;
      if (error instanceof ApiError && error.status === 403) {
        this.resultsForbidden.set(true);
        return;
      }
      if (append) {
        this.toastError(error);
      } else {
        this.resultsFailed.set(true);
        this.toastError(error);
      }
    } finally {
      if (seq === this.resultsSeq) {
        this.resultsLoading.set(false);
        this.resultsLoadingMore.set(false);
      }
    }
  }

  private notifyDeleteBlockers(detail: CategoryDetail): void {
    const message = detail.usage.deleteBlockers
      .map((blocker) => this.transloco.translate(deleteBlockerKey(blocker)))
      .join(' · ');
    this.notify.warning(message);
  }

  private toastReceipt(receipt: CategoryReceipt, successKey: string): void {
    if (receipt.changed) {
      this.notify.success(this.transloco.translate(successKey));
    } else {
      this.notify.info(this.transloco.translate('tradeCategories.toast.noChange'));
    }
  }

  private toastError(error: unknown): void {
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
