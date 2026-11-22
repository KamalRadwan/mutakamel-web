import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { WidgetFrame } from '../../../../shared/ui/widget-frame/widget-frame';
import { WidgetState } from '../../../../shared/ui/widget-state/widget-state';
import type { GridItem } from '../../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey, type TradeContext } from '../../shared/trade-api';
import { DashboardCanvas, buildDashboardGridItems } from '../dashboard-canvas/dashboard-canvas';
import { DashboardCreateModal } from '../dashboard-create-modal/dashboard-create-modal';
import { DashboardEditBar } from '../dashboard-edit-bar/dashboard-edit-bar';
import {
  DashboardFilters,
  FILTER_PRESETS,
  defaultFilterState,
  filtersEqual,
  toRunFilters,
  toRunScope,
  validateFilterState,
  type DashboardFilterState,
  type DashboardScopeChoice,
} from '../dashboard-filters/dashboard-filters';
import { DashboardHeader, type DashboardHeaderAction } from '../dashboard-header/dashboard-header';
import { DashboardShareModal } from '../dashboard-share-modal/dashboard-share-modal';
import {
  createFromTemplate,
  deleteDashboard,
  duplicateDashboard,
  getCatalog,
  getDashboard,
  getDefault,
  getNavigation,
  removePlacement,
  runDashboard,
  setDefault,
  setFavorite,
  updateLayout,
} from '../trade-dashboard.api';
import type {
  Catalog,
  DashboardDetail,
  NavItem,
  Navigation,
  PreferenceContext,
  RunRequest,
  RunResult,
  ScopeCoverage,
} from '../trade-dashboard.model';
import { fromGridItem, overlaps, snapItems } from '../trade-widget-adapter';
import { WidgetLibraryModal } from '../widget-library-modal/widget-library-modal';

const CAN_MANAGE = true; // later from the session permissions

type PageLoadState = 'loading' | 'ready' | 'empty' | 'forbidden' | 'error';

const MAX_PLACEMENTS = 20;
const MAX_UNDO = 50;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILTER_QUERY_CLEAR = {
  period: null,
  from: null,
  to: null,
  compare: null,
  scope: null,
} as const;

function cloneGridItems(items: readonly GridItem[]): GridItem[] {
  return items.map((item) => ({ ...item }));
}

function gridItemsEqual(a: readonly GridItem[], b: readonly GridItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map<string, GridItem>();
  for (const item of a) {
    byId.set(item.id, item);
  }
  if (byId.size !== a.length) return false;
  for (const item of b) {
    const match = byId.get(item.id);
    if (!match) return false;
    if (
      Math.round(match.x) !== Math.round(item.x) ||
      Math.round(match.y) !== Math.round(item.y) ||
      Math.round(match.w) !== Math.round(item.w) ||
      Math.round(match.h) !== Math.round(item.h)
    ) {
      return false;
    }
  }
  return true;
}

function applyQueryFilters(
  defaults: DashboardFilterState,
  params: ParamMap,
  coverage: ScopeCoverage,
): DashboardFilterState {
  const next: DashboardFilterState = { ...defaults };

  const rawPeriod = params.get('period');
  if (rawPeriod && (FILTER_PRESETS as readonly string[]).includes(rawPeriod)) {
    next.datePreset = rawPeriod as DashboardFilterState['datePreset'];
  }

  if (next.datePreset === 'CUSTOM') {
    const rawFrom = params.get('from');
    const rawTo = params.get('to');
    if (rawFrom && YMD_RE.test(rawFrom)) next.dateFrom = rawFrom;
    if (rawTo && YMD_RE.test(rawTo)) next.dateTo = rawTo;
  } else {
    next.dateFrom = null;
    next.dateTo = null;
  }

  const rawCompare = params.get('compare');
  if (rawCompare === 'NONE' || rawCompare === 'PREVIOUS_PERIOD' || rawCompare === 'PREVIOUS_YEAR') {
    next.comparisonMode = rawCompare;
  }

  const rawScope = params.get('scope');
  if (
    rawScope === 'SAVED_TARGETS' ||
    rawScope === 'COMPANY' ||
    rawScope === 'BRANCH' ||
    (rawScope === 'ALL_ACCESSIBLE' && coverage === 'MULTI_COMPANY_AUTHORIZED_UNION')
  ) {
    next.scopeChoice = rawScope as DashboardScopeChoice;
  }

  return next;
}

@Component({
  selector: 'app-trade-dashboard-page',
  imports: [
    TranslocoPipe,
    FullState,
    ConfirmDialog,
    UnsavedDialog,
    WidgetFrame,
    WidgetState,
    DashboardHeader,
    DashboardFilters,
    DashboardEditBar,
    DashboardCanvas,
    DashboardCreateModal,
    DashboardShareModal,
    WidgetLibraryModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-dashboard', alias: 'tradeDashboard' },
      { scope: 'trade-shared', alias: 'tradeShared' },
    ),
  ],
  templateUrl: './dashboard-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-10 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class TradeDashboardPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly createModal = viewChild.required(DashboardCreateModal);
  private readonly shareModal = viewChild.required(DashboardShareModal);
  private readonly libraryModal = viewChild.required(WidgetLibraryModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly removeConfirm = viewChild.required<ConfirmDialog>('removeConfirm');
  private readonly conflictConfirm = viewChild.required<ConfirmDialog>('conflictConfirm');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);

  protected readonly canManage = CAN_MANAGE;
  protected readonly maxPlacements = MAX_PLACEMENTS;
  protected readonly skeletonCards = [0, 1, 2, 3] as const;
  protected readonly skeletonCharts = [0, 1, 2, 3] as const;

  protected readonly ctx = computed<TradeContext>(() => ({
    companyId: this.scope.company().id,
  }));

  private readonly pref = computed<PreferenceContext>(() => ({
    kind: 'COMPANY',
    companyId: this.scope.company().id,
  }));

  protected readonly pageState = signal<PageLoadState>('loading');
  protected readonly catalog = signal<Catalog | null>(null);
  protected readonly navigation = signal<Navigation | null>(null);
  protected readonly detail = signal<DashboardDetail | null>(null);
  protected readonly runResult = signal<RunResult | null>(null);
  protected readonly loadingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly sourcesDown = signal(false);

  protected readonly filterState = signal<DashboardFilterState>({
    datePreset: 'CURRENT_MONTH',
    dateFrom: null,
    dateTo: null,
    comparisonMode: 'NONE',
    scopeChoice: 'SAVED_TARGETS',
  });

  protected readonly editing = signal(false);
  protected readonly savingLayout = signal(false);
  protected readonly headerBusy = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly gridItems = signal<GridItem[]>([]);
  private readonly editBaseline = signal<GridItem[]>([]);
  private readonly editHistory = signal<GridItem[][]>([]);

  protected readonly canEdit = computed(() => {
    const d = this.detail();
    return Boolean(
      CAN_MANAGE && d && (d.accessLevel === 'OWNER' || d.accessLevel === 'EDIT'),
    );
  });

  protected readonly isOwner = computed(() => this.detail()?.accessLevel === 'OWNER');

  protected readonly navigationItems = computed<readonly NavItem[]>(
    () => this.navigation()?.items ?? [],
  );

  protected readonly canResetFilters = computed(() => {
    const d = this.detail();
    if (!d) return false;
    return !filtersEqual(this.filterState(), defaultFilterState(d));
  });

  protected readonly editDirty = computed(
    () => this.editing() && !gridItemsEqual(this.gridItems(), this.editBaseline()),
  );

  protected readonly canUndo = computed(() => this.editHistory().length > 0);

  protected readonly removeDisabledReason = computed(() => {
    this.i18n();
    return this.editDirty()
      ? this.transloco.translate('tradeDashboard.editBar.removeDisabledDirty')
      : '';
  });

  private loadSeq = 0;
  private runSeq = 0;
  private destroyed = false;
  private lastCompanyId: string | null = null;
  private lastBranchId: string | null = null;
  private currentUrlDashboardId: string | null =
    this.route.snapshot.queryParamMap.get('d');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq++;
      this.runSeq++;
    });

    effect(() => {
      const companyId = this.scope.company().id;
      untracked(() => {
        const isCompanySwitch = this.lastCompanyId !== null && this.lastCompanyId !== companyId;
        this.lastCompanyId = companyId;
        this.lastBranchId = this.scope.branch().id;
        if (isCompanySwitch) {
          this.exitEditState();
          this.updateUrlQuery({ d: null, ...FILTER_QUERY_CLEAR });
        }
        const requestedId = isCompanySwitch
          ? null
          : this.route.snapshot.queryParamMap.get('d');
        this.currentUrlDashboardId = requestedId;
        void this.loadForCompany(companyId, requestedId, !isCompanySwitch);
      });
    });

    effect(() => {
      const branchId = this.scope.branch().id;
      untracked(() => {
        if (this.lastBranchId === null || branchId === this.lastBranchId) return;
        this.lastBranchId = branchId;
        const d = this.detail();
        const filters = this.filterState();
        if (
          this.pageState() === 'ready' &&
          d &&
          filters.scopeChoice === 'BRANCH' &&
          validateFilterState(filters).valid
        ) {
          void this.runAll(d, filters);
        }
      });
    });

    effect(() => {
      const qId = this.queryParams()?.get('d') ?? null;
      untracked(() => {
        if (this.lastCompanyId === null) return;
        if (qId === this.currentUrlDashboardId) return;
        this.currentUrlDashboardId = qId;
        void this.loadExternalDashboard(qId);
      });
    });
  }

  async canDeactivate(): Promise<boolean> {
    return this.confirmLeaveEditMode();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editDirty()) {
      event.preventDefault();
    }
  }

  protected retryLoad(): void {
    const companyId = this.scope.company().id;
    const requestedId = this.route.snapshot.queryParamMap.get('d');
    void this.loadForCompany(companyId, requestedId, true);
  }

  protected openCreateFromEmpty(): void {
    if (!CAN_MANAGE) return;
    this.createModal().openCreate('blank');
  }

  protected async onSwitchDashboard(targetId: string): Promise<void> {
    if (targetId === this.detail()?.id) return;
    if (!(await this.confirmLeaveEditMode())) return;

    this.exitEditState();
    this.updateUrlQuery({ d: targetId, ...FILTER_QUERY_CLEAR });
    await this.openDashboardById(targetId, false);
  }

  protected onFiltersChange(next: DashboardFilterState): void {
    this.filterState.set(next);
    this.updateUrlQuery({
      period: next.datePreset,
      from: next.datePreset === 'CUSTOM' ? next.dateFrom : null,
      to: next.datePreset === 'CUSTOM' ? next.dateTo : null,
      compare: next.comparisonMode,
      scope: next.scopeChoice,
    });

    const d = this.detail();
    if (!d) return;
    if (!validateFilterState(next).valid) return;
    void this.runAll(d, next);
  }

  protected onResetFilters(): void {
    const d = this.detail();
    if (!d) return;
    const defaults = defaultFilterState(d);
    this.filterState.set(defaults);
    this.updateUrlQuery(FILTER_QUERY_CLEAR);
    void this.runAll(d, defaults);
  }

  protected onRefresh(): void {
    const d = this.detail();
    if (!d) return;
    const filters = this.filterState();
    if (!validateFilterState(filters).valid) return;
    void this.runAll(d, filters);
  }

  protected onEnterEditMode(): void {
    const d = this.detail();
    if (!this.canEdit() || !d || this.editing()) return;
    const items = buildDashboardGridItems(
      d,
      this.catalog(),
      this.transloco.translate('tradeDashboard.frame.unavailable'),
    );
    this.editBaseline.set(cloneGridItems(items));
    this.gridItems.set(cloneGridItems(items));
    this.editHistory.set([]);
    this.selectedId.set(null);
    this.editing.set(true);
  }

  protected onOpenLibrary(): void {
    const d = this.detail();
    if (!d || !this.editing() || this.editDirty()) return;
    this.libraryModal().open(d);
  }

  protected onGridLayoutChange(rawItems: GridItem[]): void {
    const d = this.detail();
    if (!d || !this.editing()) return;

    const prevItems = this.gridItems();
    const prevById = new Map(prevItems.map((item) => [item.id, item]));
    const unavailIds = new Set(d.unavailablePlacements.map((u) => u.placementId));
    const baselineUnavail = new Map(
      this.editBaseline()
        .filter((item) => unavailIds.has(item.id))
        .map((item) => [item.id, item]),
    );

    const snapped = snapItems(rawItems).map((item) => {
      const savedUnavail = baselineUnavail.get(item.id);
      if (savedUnavail) return { ...savedUnavail };
      const prev = prevById.get(item.id);
      return prev?.label ? { ...item, label: prev.label } : item;
    });

    const unavailRects = Array.from(baselineUnavail.values()).map((item) => fromGridItem(item));
    let reverted = false;

    const validated = snapped.map((item) => {
      if (unavailIds.has(item.id)) return item;
      const cell = fromGridItem(item);
      if (unavailRects.some((uRect) => overlaps(cell, uRect))) {
        reverted = true;
        const prev = prevById.get(item.id);
        return prev ? { ...prev } : item;
      }
      return item;
    });

    if (reverted) {
      this.notify.warning(this.transloco.translate('tradeDashboard.toast.coverUnavailable'));
    }

    if (!gridItemsEqual(prevItems, validated)) {
      this.editHistory.update((stack) => {
        const trimmed = stack.length >= MAX_UNDO ? stack.slice(-(MAX_UNDO - 1)) : stack;
        return [...trimmed, cloneGridItems(prevItems)];
      });
    }

    this.gridItems.set(cloneGridItems(validated));
  }

  protected onUndoLayout(): void {
    if (!this.editing() || this.savingLayout()) return;
    const stack = this.editHistory();
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    this.editHistory.set(stack.slice(0, -1));
    this.gridItems.set(cloneGridItems(prev));
  }

  protected async onCancelEdit(): Promise<void> {
    if (!this.editing() || this.savingLayout()) return;
    if (this.editDirty()) {
      const choice = await this.unsavedDialog().open();
      if (choice === 'save') {
        await this.onSaveLayout();
        return;
      }
      if (choice === 'cancel') return;
    }
    this.gridItems.set(cloneGridItems(this.editBaseline()));
    this.exitEditState();
  }

  protected async onSaveLayout(): Promise<boolean> {
    const d = this.detail();
    if (!d || !this.editing() || this.savingLayout()) return false;

    const unavailIds = new Set(d.unavailablePlacements.map((u) => u.placementId));
    const placed = this.gridItems()
      .filter((item) => !unavailIds.has(item.id))
      .map((item) => ({
        placementId: item.id,
        ...fromGridItem(item),
      }))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((item, index) => ({
        placementId: item.placementId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        sortOrder: index,
      }));

    const rects = this.gridItems().map((item) => fromGridItem(item));
    const hasOverlap = rects.some((a, i) => rects.some((b, j) => j > i && overlaps(a, b)));
    if (hasOverlap) {
      this.notify.error(this.transloco.translate('tradeDashboard.toast.layoutOverlap'));
      return false;
    }

    this.savingLayout.set(true);
    try {
      const updated = await updateLayout(this.ctx(), d.id, d.revision, placed);
      if (this.detail()?.id !== d.id || this.destroyed) return false;

      this.detail.set(updated);
      this.syncNavItem(updated);
      const freshItems = buildDashboardGridItems(
        updated,
        this.catalog(),
        this.transloco.translate('tradeDashboard.frame.unavailable'),
      );
      this.gridItems.set(freshItems);
      this.editBaseline.set(cloneGridItems(freshItems));
      this.editHistory.set([]);
      this.editing.set(false);
      this.selectedId.set(null);
      this.notify.success(this.transloco.translate('tradeDashboard.toast.layoutSaved'));
      return true;
    } catch (err) {
      if (errorCodeOf(err) === 'TRADE.DASHBOARD.REVISION_CONFLICT') {
        return await this.resolveLayoutConflict(d.id);
      }
      this.notify.error(this.transloco.translate(errorKey(err)));
      return false;
    } finally {
      this.savingLayout.set(false);
    }
  }

  protected async onRemovePlacement(placementId: string): Promise<void> {
    const d = this.detail();
    if (!d || !this.editing() || this.savingLayout()) return;
    if (this.editDirty()) {
      this.notify.warning(this.transloco.translate('tradeDashboard.editBar.removeDisabledDirty'));
      return;
    }

    const confirmed = await this.removeConfirm().open();
    if (!confirmed || this.detail()?.id !== d.id || this.destroyed) return;

    this.savingLayout.set(true);
    try {
      const res = await removePlacement(this.ctx(), d.id, placementId, d.revision);
      if (this.detail()?.id !== d.id || this.destroyed) return;

      const updated: DashboardDetail = {
        ...d,
        revision: res.revision,
        placements: d.placements.filter((p) => p.id !== placementId),
        unavailablePlacements: d.unavailablePlacements.filter(
          (u) => u.placementId !== placementId,
        ),
      };
      this.detail.set(updated);
      this.syncNavItem(updated);
      const items = buildDashboardGridItems(
        updated,
        this.catalog(),
        this.transloco.translate('tradeDashboard.frame.unavailable'),
      );
      this.gridItems.set(items);
      this.editBaseline.set(cloneGridItems(items));
      this.editHistory.set([]);
      if (this.selectedId() === placementId) {
        this.selectedId.set(null);
      }
      this.notify.success(this.transloco.translate('tradeDashboard.toast.widgetRemoved'));
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    } finally {
      this.savingLayout.set(false);
    }
  }

  protected async onWidgetAdded(added: {
    placementId: string;
    widgetId: string;
    dashboardRevision: number;
  }): Promise<void> {
    const current = this.detail();
    if (!current) return;

    try {
      const fresh = await getDashboard(this.ctx(), current.id);
      if (this.detail()?.id !== current.id || this.destroyed) return;

      this.detail.set(fresh);
      this.syncNavItem(fresh);
      const items = buildDashboardGridItems(
        fresh,
        this.catalog(),
        this.transloco.translate('tradeDashboard.frame.unavailable'),
      );
      this.gridItems.set(items);
      this.editBaseline.set(cloneGridItems(items));
      this.editHistory.set([]);
      this.selectedId.set(added.placementId);
      void this.runSingleWidget(fresh, added.widgetId);
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    }
  }

  protected onRetryWidget(widgetId: string): void {
    const d = this.detail();
    if (!d) return;
    if (!validateFilterState(this.filterState()).valid) return;
    void this.runSingleWidget(d, widgetId);
  }

  protected async onHeaderAction(action: DashboardHeaderAction): Promise<void> {
    const d = this.detail();
    if (!d || !CAN_MANAGE) return;

    switch (action) {
      case 'newBlank':
        this.createModal().openCreate('blank');
        break;
      case 'newTemplate':
        this.createModal().openCreate('template');
        break;
      case 'editDetails':
        if (this.canEdit()) this.createModal().openEdit(d);
        break;
      case 'duplicate':
        await this.handleDuplicate(d);
        break;
      case 'share':
        if (this.isOwner()) this.shareModal().open(d);
        break;
      case 'setDefault':
        await this.handleSetDefault(d);
        break;
      case 'toggleFavorite':
        await this.handleToggleFavorite(d);
        break;
      case 'delete':
        if (this.isOwner()) await this.handleDelete(d);
        break;
    }
  }

  protected async onDashboardCreated(event: {
    dashboard: DashboardDetail;
    existed: boolean;
  }): Promise<void> {
    await this.refreshNavigation();
    if (!(await this.confirmLeaveEditMode())) return;

    this.exitEditState();
    this.updateUrlQuery({ d: event.dashboard.id, ...FILTER_QUERY_CLEAR });
    this.activateDashboard(event.dashboard, this.catalog(), false);
    void this.runAll(event.dashboard, this.filterState());
  }

  protected onDashboardUpdated(updated: DashboardDetail): void {
    const current = this.detail();
    if (!current || current.id !== updated.id) return;
    this.detail.set(updated);
    this.syncNavItem(updated);
  }

  protected onShareRevisionChange(revision: number): void {
    this.detail.update((d) => (d ? { ...d, revision } : d));
    void this.refreshNavigation();
  }

  private async loadForCompany(
    companyId: string,
    requestedId: string | null,
    useUrlFilters: boolean,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    const ctx: TradeContext = { companyId };
    const pref: PreferenceContext = { kind: 'COMPANY', companyId };

    this.pageState.set('loading');
    this.exitEditState();
    this.detail.set(null);
    this.runResult.set(null);
    this.sourcesDown.set(false);
    this.loadingIds.set(new Set());
    this.gridItems.set([]);
    this.editBaseline.set([]);
    this.editHistory.set([]);

    try {
      const [catalog, navigation, defResult] = await Promise.all([
        getCatalog(ctx),
        getNavigation(ctx, pref),
        getDefault(ctx, pref),
      ]);
      if (seq !== this.loadSeq || this.destroyed) return;

      this.catalog.set(catalog);
      this.navigation.set(navigation);

      let resolved: DashboardDetail | null = null;
      if (requestedId) {
        try {
          resolved = await getDashboard(ctx, requestedId);
        } catch (err) {
          if (seq !== this.loadSeq || this.destroyed) return;
          if (this.isForbiddenError(err)) {
            this.pageState.set('forbidden');
            return;
          }
          if (err instanceof ApiError && err.status === 404) {
            this.notify.error(this.transloco.translate(errorKey(err)));
            this.updateUrlQuery({ d: null });
          } else {
            throw err;
          }
        }
      }

      if (!resolved) {
        if (defResult.dashboard) {
          resolved = defResult.dashboard;
        } else if (catalog.templates.some((t) => t.key === 'TRADE_EXECUTIVE')) {
          try {
            const created = await createFromTemplate(
              ctx,
              'TRADE_EXECUTIVE',
              { preferenceContext: pref },
              newIdempotencyKey(),
              this.language(),
            );
            if (seq !== this.loadSeq || this.destroyed) return;
            resolved = created.dashboard;
            void this.refreshNavigation();
          } catch (err) {
            if (seq !== this.loadSeq || this.destroyed) return;
            if (this.isForbiddenError(err)) {
              this.pageState.set('forbidden');
              return;
            }
            if (errorCodeOf(err) === 'TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED') {
              this.pageState.set('empty');
              return;
            }
            throw err;
          }
        }
      }

      if (seq !== this.loadSeq || this.destroyed) return;

      if (!resolved) {
        this.pageState.set('empty');
        return;
      }

      this.activateDashboard(resolved, catalog, useUrlFilters);
      void this.runAll(resolved, this.filterState());
    } catch (err) {
      if (seq !== this.loadSeq || this.destroyed) return;
      if (this.isForbiddenError(err)) {
        this.pageState.set('forbidden');
        return;
      }
      this.pageState.set('error');
      this.notify.error(this.transloco.translate(errorKey(err)));
    }
  }

  private async loadExternalDashboard(requestedId: string | null): Promise<void> {
    if (requestedId) {
      await this.openDashboardById(requestedId, true);
      return;
    }
    await this.loadForCompany(this.scope.company().id, null, true);
  }

  private async openDashboardById(id: string, useUrlFilters: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    this.pageState.set('loading');
    this.exitEditState();
    this.runResult.set(null);
    this.sourcesDown.set(false);
    this.loadingIds.set(new Set());

    try {
      const d = await getDashboard(this.ctx(), id);
      if (seq !== this.loadSeq || this.destroyed) return;
      this.activateDashboard(d, this.catalog(), useUrlFilters);
      void this.runAll(d, this.filterState());
    } catch (err) {
      if (seq !== this.loadSeq || this.destroyed) return;
      if (this.isForbiddenError(err)) {
        this.pageState.set('forbidden');
        return;
      }
      this.pageState.set('error');
      this.notify.error(this.transloco.translate(errorKey(err)));
    }
  }

  private activateDashboard(
    d: DashboardDetail,
    cat: Catalog | null,
    useUrlFilters: boolean,
  ): void {
    const defaults = defaultFilterState(d);
    const nextFilters = useUrlFilters
      ? applyQueryFilters(defaults, this.route.snapshot.queryParamMap, d.scopeCoverage)
      : defaults;

    this.detail.set(d);
    this.filterState.set(nextFilters);
    this.runResult.set(null);
    this.sourcesDown.set(false);
    const items = buildDashboardGridItems(
      d,
      cat,
      this.transloco.translate('tradeDashboard.frame.unavailable'),
    );
    this.gridItems.set(items);
    this.editBaseline.set(cloneGridItems(items));
    this.editHistory.set([]);
    this.editing.set(false);
    this.selectedId.set(null);
    this.pageState.set('ready');
  }

  private async runAll(d: DashboardDetail, filtersState: DashboardFilterState): Promise<void> {
    if (!validateFilterState(filtersState).valid) return;

    const seq = ++this.runSeq;
    this.sourcesDown.set(false);
    this.runResult.set(null);
    const ids = new Set(d.placements.map((p) => p.widgetId));
    this.loadingIds.set(ids);

    if (d.placements.length === 0) {
      this.loadingIds.set(new Set());
      return;
    }

    const req: RunRequest = {
      requestId: newIdempotencyKey(),
      scope: toRunScope(
        filtersState.scopeChoice,
        d.scopeCoverage,
        this.scope.company().id,
        this.scope.branch().id,
      ),
      filters: toRunFilters(filtersState, d.defaultFilters),
    };

    try {
      const res = await runDashboard(this.ctx(), d.id, req);
      if (seq !== this.runSeq || this.detail()?.id !== d.id || this.destroyed) return;
      this.loadingIds.set(new Set());
      this.runResult.set(res);
      this.emitRunWarnings(res.warnings);
    } catch (err) {
      if (seq !== this.runSeq || this.detail()?.id !== d.id || this.destroyed) return;
      this.loadingIds.set(new Set());
      if (this.isSourcesUnavailableError(err)) {
        this.sourcesDown.set(true);
        this.notify.error(this.transloco.translate('tradeDashboard.toast.sourcesDown'));
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(err)));
    }
  }

  private async runSingleWidget(d: DashboardDetail, widgetId: string): Promise<void> {
    const filtersState = this.filterState();
    if (!validateFilterState(filtersState).valid) return;

    const seq = this.runSeq;
    this.loadingIds.update((cur) => new Set([...cur, widgetId]));

    const req: RunRequest = {
      requestId: newIdempotencyKey(),
      scope: toRunScope(
        filtersState.scopeChoice,
        d.scopeCoverage,
        this.scope.company().id,
        this.scope.branch().id,
      ),
      filters: toRunFilters(filtersState, d.defaultFilters),
      widgetIds: [widgetId],
    };

    try {
      const res = await runDashboard(this.ctx(), d.id, req);
      if (seq !== this.runSeq || this.detail()?.id !== d.id || this.destroyed) return;

      this.loadingIds.update((cur) => {
        const next = new Set(cur);
        next.delete(widgetId);
        return next;
      });
      this.sourcesDown.set(false);
      const widgetResult = res.widgets[widgetId];
      this.runResult.update((prev) => {
        if (!prev) {
          return {
            ...res,
            widgets: widgetResult ? { [widgetId]: widgetResult } : {},
          };
        }
        return {
          ...prev,
          generatedAt: res.generatedAt,
          widgets: {
            ...prev.widgets,
            ...(widgetResult ? { [widgetId]: widgetResult } : {}),
          },
        };
      });
      this.emitRunWarnings(res.warnings);
    } catch (err) {
      if (seq !== this.runSeq || this.detail()?.id !== d.id || this.destroyed) return;
      this.loadingIds.update((cur) => {
        const next = new Set(cur);
        next.delete(widgetId);
        return next;
      });
      if (this.isSourcesUnavailableError(err)) {
        this.runResult.update((prev) => {
          if (!prev || !(widgetId in prev.widgets)) return prev;
          const rest = { ...prev.widgets };
          delete rest[widgetId];
          return { ...prev, widgets: rest };
        });
        this.notify.error(this.transloco.translate('tradeDashboard.toast.sourcesDown'));
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(err)));
    }
  }

  private async resolveLayoutConflict(dashboardId: string): Promise<boolean> {
    const reload = await this.conflictConfirm().open();
    try {
      const fresh = await getDashboard(this.ctx(), dashboardId);
      if (this.detail()?.id !== dashboardId || this.destroyed) return false;

      const freshItems = buildDashboardGridItems(
        fresh,
        this.catalog(),
        this.transloco.translate('tradeDashboard.frame.unavailable'),
      );
      this.detail.set(fresh);
      this.syncNavItem(fresh);

      if (reload) {
        this.gridItems.set(freshItems);
        this.editBaseline.set(cloneGridItems(freshItems));
        this.editHistory.set([]);
        this.editing.set(false);
        this.selectedId.set(null);
        void this.runAll(fresh, this.filterState());
        return false;
      }

      const localMap = new Map(this.gridItems().map((item) => [item.id, item]));
      const freshUnavailIds = new Set(fresh.unavailablePlacements.map((u) => u.placementId));
      const merged = freshItems.map((freshItem) => {
        if (freshUnavailIds.has(freshItem.id)) return freshItem;
        const local = localMap.get(freshItem.id);
        return local
          ? { ...freshItem, x: local.x, y: local.y, w: local.w, h: local.h }
          : freshItem;
      });
      this.editBaseline.set(cloneGridItems(freshItems));
      this.gridItems.set(cloneGridItems(merged));
      this.editHistory.set([]);
      return false;
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
      return false;
    }
  }

  private async handleDuplicate(d: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    if (!(await this.confirmLeaveEditMode())) return;

    this.headerBusy.set(true);
    try {
      const res = await duplicateDashboard(this.ctx(), d.id, {}, newIdempotencyKey());
      if (this.destroyed) return;

      const omitted = res.duplication.omittedUnavailableWidgetCount;
      if (omitted > 0) {
        this.notify.info(this.transloco.translate('tradeDashboard.toast.omitted', { n: omitted }));
      } else {
        this.notify.success(this.transloco.translate('tradeDashboard.toast.duplicated'));
      }

      await this.refreshNavigation();
      this.exitEditState();
      this.updateUrlQuery({ d: res.dashboard.id, ...FILTER_QUERY_CLEAR });
      this.activateDashboard(res.dashboard, this.catalog(), false);
      void this.runAll(res.dashboard, this.filterState());
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async handleSetDefault(d: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const prefRow = await setDefault(this.ctx(), d.id, this.pref(), newIdempotencyKey());
      if (this.detail()?.id !== d.id || this.destroyed) return;

      this.detail.update((cur) =>
        cur ? { ...cur, isDefault: prefRow.isDefault, revision: prefRow.revision } : cur,
      );
      this.navigation.update((nav) =>
        nav
          ? {
              ...nav,
              items: nav.items.map((item) => ({
                ...item,
                isDefault: item.id === d.id ? prefRow.isDefault : false,
                ...(item.id === d.id ? { revision: prefRow.revision } : {}),
              })),
            }
          : nav,
      );
      this.notify.success(this.transloco.translate('tradeDashboard.toast.defaultSet'));
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async handleToggleFavorite(d: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const prefRow = await setFavorite(
        this.ctx(),
        d.id,
        this.pref(),
        !d.isFavorite,
        newIdempotencyKey(),
      );
      if (this.detail()?.id !== d.id || this.destroyed) return;

      this.detail.update((cur) =>
        cur ? { ...cur, isFavorite: prefRow.isFavorite, revision: prefRow.revision } : cur,
      );
      this.navigation.update((nav) =>
        nav
          ? {
              ...nav,
              items: nav.items.map((item) =>
                item.id === d.id
                  ? { ...item, isFavorite: prefRow.isFavorite, revision: prefRow.revision }
                  : item,
              ),
            }
          : nav,
      );
      this.notify.success(
        this.transloco.translate(
          prefRow.isFavorite
            ? 'tradeDashboard.toast.favoriteAdded'
            : 'tradeDashboard.toast.favoriteRemoved',
        ),
      );
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async handleDelete(d: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed || this.detail()?.id !== d.id || this.destroyed) return;

    this.headerBusy.set(true);
    try {
      await deleteDashboard(this.ctx(), d.id, d.revision);
      if (this.destroyed) return;

      this.notify.success(this.transloco.translate('tradeDashboard.toast.deleted'));
      this.exitEditState();
      this.updateUrlQuery({ d: null, ...FILTER_QUERY_CLEAR });
      await this.loadForCompany(this.scope.company().id, null, false);
    } catch (err) {
      this.notify.error(this.transloco.translate(errorKey(err)));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async confirmLeaveEditMode(): Promise<boolean> {
    if (!this.editDirty()) return true;
    const choice = await this.unsavedDialog().open();
    if (choice === 'save') {
      return await this.onSaveLayout();
    }
    if (choice === 'discard') {
      this.gridItems.set(cloneGridItems(this.editBaseline()));
      this.exitEditState();
      return true;
    }
    return false;
  }

  private exitEditState(): void {
    this.editing.set(false);
    this.selectedId.set(null);
    this.editHistory.set([]);
  }

  private async refreshNavigation(): Promise<void> {
    try {
      const nav = await getNavigation(this.ctx(), this.pref());
      if (!this.destroyed) {
        this.navigation.set(nav);
      }
    } catch {
      // Keep existing switcher list if navigation refresh fails.
    }
  }

  private syncNavItem(d: DashboardDetail): void {
    this.navigation.update((nav) =>
      nav
        ? {
            ...nav,
            items: nav.items.map((item) =>
              item.id === d.id
                ? {
                    ...item,
                    name: d.name,
                    isDefault: d.isDefault,
                    isFavorite: d.isFavorite,
                    isShared: d.isShared,
                    revision: d.revision,
                    updatedAt: d.updatedAt,
                  }
                : item,
            ),
          }
        : nav,
    );
  }

  private emitRunWarnings(warnings: readonly { code: string }[]): void {
    const codes = new Set(warnings.map((w) => w.code));
    if (codes.has('TRADE.DASHBOARD.SCOPE_TARGET_OMITTED')) {
      this.notify.info(
        this.transloco.translate('tradeShared.errors.TRADE_DASHBOARD_SCOPE_TARGET_OMITTED'),
      );
    }
    if (codes.has('TRADE.DASHBOARD.SCOPE_TRUNCATED')) {
      this.notify.info(
        this.transloco.translate('tradeShared.errors.TRADE_DASHBOARD_SCOPE_TRUNCATED'),
      );
    }
  }

  private isForbiddenError(err: unknown): boolean {
    return (
      errorCodeOf(err) === 'TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED' ||
      (err instanceof ApiError && err.status === 403)
    );
  }

  private isSourcesUnavailableError(err: unknown): boolean {
    return (
      errorCodeOf(err) === 'TRADE.DASHBOARD.SOURCE_UNAVAILABLE' ||
      (err instanceof ApiError && err.status === 503)
    );
  }

  private updateUrlQuery(params: Record<string, string | null>): void {
    if ('d' in params) {
      this.currentUrlDashboardId = params['d'] ?? null;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
