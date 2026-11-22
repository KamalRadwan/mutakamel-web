import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChartDots3,
  tablerInfoCircle,
  tablerTable,
  tablerTableShortcut,
  tablerTrash,
  tablerVersions,
  tablerExclamationCircle,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import type { ActionItem } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../../shared/ui/badge/badge';
import type { EntityRef, Visualization, WidgetExecution } from '../../../../../shared/ui/chart/chart.model';
import { DASH, formatDate, formatMoney, formatNumber, formatRateN, formatShortDate } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { WidgetFrame } from '../../../../../shared/ui/widget-frame/widget-frame';
import { WidgetState } from '../../../../../shared/ui/widget-state/widget-state';
import { getCatalog, listShareTargets } from '../../../../../shared/widgets/dashboard/analytics.api';
import { OTHER_BUCKET_KEY } from '../../../../../shared/widgets/dashboard/analytics.model';
import type {
  CalculationDetails,
  Catalog,
  CrossFilter,
  DashboardRun,
  DatasetComparisonDetails,
  PanelCoverage,
  PanelOutcome,
  RuntimeFilters,
  UnavailablePlacement,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import {
  ApiError,
  errorCodeOf,
  newIdempotencyKey,
  isAbortError,
  queueRun,
  retryWhenBusy,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { can, scopeLevels } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES, FAKE_ME, FAKE_TEAMS } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { DashboardGrid, type GridItem } from '../../../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';
import { governedTargetParts } from '../../../../../shared/widgets/dashboard/governed-target';
import {
  LOADING_VIEW,
  errorKey,
  reasonKey,
  viewFromRun,
  warningReasonKeys,
  type PanelView,
} from '../../../../../shared/widgets/dashboard/panel-state';
import { WidgetBody } from '../../../../../shared/widgets/dashboard/widget-body/widget-body';
import type { ExportPeriod } from '../../../../../shared/widgets/dashboard/exports/exports.model';
import { ShareModal, type ShareApi } from '../../shared/share-modal/share-modal';
import { AddWidgetModal } from '../add-widget-modal/add-widget-modal';
import { CreateDashboardModal } from '../create-dashboard-modal/create-dashboard-modal';
import { CrossFilterChips, type CrossFilterSelection } from '../cross-filter-chips/cross-filter-chips';
import {
  DashboardFilters,
  defaultFilterValue,
  toRuntimeFilters,
  type DashboardFilterValue,
  type FilterOptionItem,
} from '../dashboard-filters/dashboard-filters';
import { DashboardHeader } from '../dashboard-header/dashboard-header';
import {
  addDashboardShare,
  deleteDashboard,
  duplicateDashboard,
  getDashboard,
  getDefaultDashboard,
  getNavigation,
  getScopeInspector,
  listAddableWidgets,
  listDashboardShares,
  previewDashboardShare,
  revokeDashboardShare,
  runDashboard,
  setDefaultDashboard,
  setFavoriteDashboard,
  updateDashboardShare,
} from '../dashboards.api';
import type { DashboardDetail, DetailUnavailablePlacement, Placement, ScopeInspector } from '../dashboards.model';
import { EditBar } from '../edit-bar/edit-bar';
import { ExplainModal } from '../explain-modal/explain-modal';
import { LayoutEditor } from '../layout-editor';
import {
  LayoutSizeInvalidError,
  isLayoutSizeInvalid,
  saveLayoutResolving,
  type PendingAdd,
} from '../layout-save';
import { recordsLink } from '../records-link';
import { VersionPolicyModal } from '../version-policy-modal/version-policy-modal';
import { WhyNumbersModal } from '../why-numbers-modal/why-numbers-modal';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

type PageLoadStatus = 'loading' | 'ready' | 'not-found' | 'no-dashboards' | 'forbidden' | 'load-failure';

const GRID_COLUMNS = 48;
const UNAVAIL_COLS_PER_ROW = 3;
const UNAVAIL_W = 16;
const UNAVAIL_H = 37;

@Component({
  selector: 'app-dashboard-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    FullState,
    WidgetFrame,
    WidgetState,
    ConfirmDialog,
    UnsavedDialog,
    DashboardGrid,
    WidgetBody,
    DashboardHeader,
    DashboardFilters,
    CrossFilterChips,
    EditBar,
    AddWidgetModal,
    VersionPolicyModal,
    WhyNumbersModal,
    ExplainModal,
    ShareModal,
    CreateDashboardModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-page', alias: 'dashPage' },
      { scope: 'crm-dash-edit', alias: 'dashEdit' },
      { scope: 'dashboard-widgets', alias: 'dashboardWidgets' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerExclamationCircle,
      tablerTable,
      tablerTableShortcut,
      tablerInfoCircle,
      tablerChartDots3,
      tablerVersions,
      tablerTrash,
    }),
  ],
  templateUrl: './dashboard-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class DashboardPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly pageScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-page', 'dashPage'));
  private readonly editScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-edit', 'dashEdit'));
  private readonly widgetsScope = toSignal(this.transloco.selectTranslation('dashboard-widgets'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  private readonly routeParams = toSignal(this.route.paramMap);
  private readonly whyModal = viewChild(WhyNumbersModal);
  private readonly explainModal = viewChild(ExplainModal);
  private readonly addWidgetModal = viewChild(AddWidgetModal);
  private readonly versionPolicyModal = viewChild(VersionPolicyModal);
  private readonly shareModal = viewChild(ShareModal);
  private readonly createModal = viewChild(CreateDashboardModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly conflictConfirm = viewChild.required<ConfirmDialog>('conflictConfirm');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);

  protected readonly editor = new LayoutEditor([]);

  /** Widgets added in this edit session. They exist only in the browser until Save. */
  private readonly localAdds = signal<(PendingAdd & { placement: Placement })[]>([]);
  /** Unavailable placements removed in this edit session (they are not part of the layout editor). */
  private readonly removedUnavailable = signal<string[]>([]);

  /** Server placements plus the ones added locally and not yet saved. */
  protected readonly allPlacements = computed<Placement[]>(() => [
    ...(this.detail()?.placements ?? []),
    ...this.localAdds().map((add) => add.placement),
  ]);

  /** The placements currently on the canvas: in edit mode, what the editor still holds. */
  private readonly shownPlacements = computed<Placement[]>(() => {
    if (!this.editing()) return this.detail()?.placements ?? [];
    const shown = new Set(this.editor.items().map((item) => item.id));
    return this.allPlacements().filter((p) => shown.has(p.id));
  });

  /** True when edit mode holds any change that Save would send. */
  protected readonly editDirty = computed(() => this.editor.dirty() || this.removedUnavailable().length > 0);

  protected readonly pageStatus = signal<PageLoadStatus>('loading');
  protected readonly detail = signal<DashboardDetail | null>(null);
  protected readonly catalog = signal<Catalog | null>(null);
  protected readonly scopeInspector = signal<ScopeInspector | null>(null);
  protected readonly widgetAccessMap = signal<Record<string, 'OWNER' | 'EDIT' | 'VIEW'>>({});

  protected readonly filterValue = signal<DashboardFilterValue>(defaultFilterValue({}));
  protected readonly crossFilters = signal<CrossFilterSelection[]>([]);
  /** Placement whose partial-data tooltip was closed with Escape; reset when focus or the pointer leaves. */
  protected readonly partialTipDismissed = signal<string | null>(null);
  protected readonly panelViews = signal<Record<string, PanelView>>({});
  protected readonly showTableMap = signal<Record<string, boolean>>({});
  protected readonly lastRun = signal<DashboardRun | null>(null);
  protected readonly latestGeneratedAt = signal<string | null>(null);

  protected readonly editing = signal(false);
  protected readonly savingLayout = signal(false);
  protected readonly headerBusy = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  private readonly layoutSizeError = signal<
    { minW: number; minH: number } | { fallbackKey: string } | null
  >(null);
  protected readonly switcherRefresh = signal(0);
  protected readonly skeletonItems = [0, 1, 2, 3, 4, 5] as const;

  protected readonly editSizeError = computed<string | null>(() => {
    this.i18n();
    this.editScope();
    this.analyticsScope();
    const err = this.layoutSizeError();
    if (!err) return null;
    if ('fallbackKey' in err) {
      return this.transloco.translate(err.fallbackKey);
    }
    return this.transloco.translate('dashEdit.sizeTooSmall', { w: err.minW, h: err.minH });
  });

  private loadSeq = 0;
  private runSeq = 0;
  private initializedLang: string | null = null;
  private destroyed = false;
  /** Aborted when a newer run starts or the page is destroyed: queued and retrying calls stop at once. */
  private runAbort = new AbortController();

  protected readonly canCreate = can('crm.dashboards.create');

  protected readonly canCustomize = computed(() => {
    const d = this.detail();
    return Boolean(
      d && d.kind === 'DASHBOARD' && d.blueprintKey && d.accessLevel === 'VIEW' && can('crm.dashboards.create'),
    );
  });

  protected readonly canEdit = computed(() => {
    const d = this.detail();
    return Boolean(
      d &&
        !d.isLayoutLocked &&
        (d.accessLevel === 'OWNER' || d.accessLevel === 'MANAGE' || d.accessLevel === 'EDIT') &&
        can('crm.dashboards.update'),
    );
  });

  protected readonly canAddWidget = computed(() => {
    const max = this.catalog()?.grid.maxWidgets ?? 20;
    return this.shownPlacements().length < max;
  });

  protected readonly showTeams = computed(() => {
    const levels = scopeLevels();
    const insp = this.scopeInspector();
    if (insp) return insp.ownerMode !== 'OWN' && (levels.includes('team') || levels.includes('all'));
    return levels.includes('team') || levels.includes('all');
  });

  protected readonly branchOptions = computed<FilterOptionItem[]>(() => {
    const lang = this.language();
    const org = this.lastRun()?.organizationScope;
    if (org) {
      if (org.branches.length <= 1) return [];
      const manyCompanies = org.companies.length > 1;
      return org.branches.map((b) => ({ id: b.id, name: manyCompanies ? `${b.companyName} · ${b.name}` : b.name }));
    }
    const insp = this.scopeInspector();
    if (!insp) return [];
    const allowed =
      insp.branches === 'ALL'
        ? FAKE_BRANCHES
        : FAKE_BRANCHES.filter((b) => insp.branches.includes(b.id));
    if (allowed.length <= 1) return [];
    return allowed.map((b) => ({
      id: b.id,
      name: lang === 'ar' ? b.name.ar : b.name.en,
    }));
  });

  protected readonly partialAccess = computed(() => this.lastRun()?.organizationScope.partialAccess ?? false);

  protected readonly teamOptions = computed<FilterOptionItem[]>(() => {
    const lang = this.language();
    const runTeams = this.lastRun()?.populationScope?.teams;
    if (runTeams && runTeams.length > 0) {
      return runTeams.map((t) => ({ id: t.id, name: t.name }));
    }
    const insp = this.scopeInspector();
    const allowedBranches =
      !insp || insp.branches === 'ALL' ? null : new Set(insp.branches);
    return FAKE_TEAMS.filter((t) => (allowedBranches ? allowedBranches.has(t.branchId) : true)).map(
      (t) => ({
        id: t.id,
        name: lang === 'ar' ? t.name.ar : t.name.en,
      }),
    );
  });

  protected readonly runtimeFilters = computed<RuntimeFilters>(() =>
    toRuntimeFilters(
      this.filterValue(),
      this.teamOptions().map((t) => t.id),
    ),
  );

  protected readonly exportPeriod = computed<ExportPeriod>(() => {
    const rf = this.runtimeFilters();
    const period = this.filterValue().period;
    const from = period?.from.slice(0, 10) ?? rf.dateFrom?.slice(0, 10) ?? '';
    const to = period?.to.slice(0, 10) ?? rf.dateTo?.slice(0, 10) ?? '';
    return {
      ...(rf.datePreset ? { kind: rf.datePreset } : {}),
      from,
      to,
    };
  });

  protected readonly viewGridItems = computed<GridItem[]>(() => {
    const d = this.detail();
    const cat = this.catalog();
    if (!d || !cat) return [];
    const layoutMap = new Map(
      (d.layouts['desktop']?.items ?? []).map((item) => [item.placementId, item]),
    );
    const items: GridItem[] = [];
    for (let idx = 0; idx < d.placements.length; idx++) {
      const p = d.placements[idx];
      const box = layoutMap.get(p.id);
      const spec = cat.visualizations.find((v) => v.key === p.widget.visualizationType);
      if (!spec) continue;
      const w = box?.w ?? spec.defaultSize.w;
      const h = box?.h ?? spec.defaultSize.h;
      // Preserve stored width/height as the grid floor for PRE_Q16 undersized placements so users can move without resizing.
      const minW = box && box.w < spec.minSize.w ? box.w : spec.minSize.w;
      const minH = box && box.h < spec.minSize.h ? box.h : spec.minSize.h;
      items.push({
        id: p.id,
        x: box?.x ?? 0,
        y: box?.y ?? idx * spec.defaultSize.h,
        w,
        h,
        minW,
        minH,
        ...(spec.maxSize?.w !== undefined ? { maxW: spec.maxSize.w } : {}),
        ...(spec.maxSize?.h !== undefined ? { maxH: spec.maxSize.h } : {}),
      });
    }
    return items;
  });

  protected readonly activePlacementItems = computed<GridItem[]>(() =>
    this.editing() ? this.editor.items() : this.viewGridItems(),
  );

  protected readonly unavailableGridItems = computed<GridItem[]>(() => {
    const d = this.detail();
    if (!d || d.unavailablePlacements.length === 0) return [];
    const baseItems = this.activePlacementItems();
    const startY = baseItems.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    const removed = new Set(this.removedUnavailable());
    return d.unavailablePlacements.filter((u) => !removed.has(u.id)).map((u, idx) => ({
      id: u.id,
      x: (idx % UNAVAIL_COLS_PER_ROW) * UNAVAIL_W,
      y: startY + Math.floor(idx / UNAVAIL_COLS_PER_ROW) * UNAVAIL_H,
      w: UNAVAIL_W,
      h: UNAVAIL_H,
      minW: UNAVAIL_W,
      minH: UNAVAIL_H,
      maxW: UNAVAIL_W,
      maxH: UNAVAIL_H,
    }));
  });

  protected readonly gridItems = computed<GridItem[]>(() => [
    ...this.activePlacementItems(),
    ...this.unavailableGridItems(),
  ]);

  protected readonly placementById = computed<Record<string, Placement>>(() => {
    const d = this.detail();
    if (!d) return {};
    const map: Record<string, Placement> = {};
    for (const p of this.allPlacements()) {
      map[p.id] = p;
    }
    return map;
  });

  protected readonly unavailableById = computed<Record<string, DetailUnavailablePlacement>>(() => {
    const d = this.detail();
    if (!d) return {};
    const map: Record<string, DetailUnavailablePlacement> = {};
    for (const u of d.unavailablePlacements) {
      map[u.id] = u;
    }
    return map;
  });

  protected readonly selectedWidgetName = computed<string | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.placementById()[id]?.widget.name ?? null;
  });

  protected readonly selectedWidgetSize = computed<{ w: number; h: number } | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    const item = this.activePlacementItems().find((it) => it.id === id);
    if (!item) return null;
    return { w: Math.round(item.w), h: Math.round(item.h) };
  });

  protected readonly frameTagByPlacement = computed<Record<string, string | null>>(() => {
    this.i18n();
    this.chartScope();
    const lang = this.language();
    const d = this.detail();
    if (!d) return {};
    const views = this.panelViews();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const tags: Record<string, string | null> = {};
    for (const p of this.allPlacements()) {
      const view = views[p.widgetId];
      const exec = view?.execution;
      if (!exec) {
        tags[p.id] = null;
        continue;
      }

      const parts: string[] = [];
      const period = exec.meta.effectivePeriod;
      if (period?.from && period?.to) {
        const sameMonthYear = period.from.slice(0, 7) === period.to.slice(0, 7);
        parts.push(
          sameMonthYear
            ? formatShortDate(period.from, lang, 'MONTH_YEAR', chartT)
            : `${formatShortDate(period.from, lang, 'DAY', chartT)} – ${formatShortDate(period.to, lang, 'DAY', chartT)}`,
        );
      }

      const hasMoney =
        exec.meta.unit === 'MONEY' ||
        exec.series.some((s) => s.unit === 'MONEY') ||
        (exec.result?.shape === 'ROWS' &&
          exec.result.rowKind === 'RANKED' &&
          exec.result.rows.some((r) => r.primaryMeasure.unit === 'MONEY'));
      const currency = exec.meta.currency ?? exec.series.find((s) => s.currency)?.currency;
      if (hasMoney && currency) {
        parts.push(currency);
      }

      tags[p.id] = parts.length > 0 ? parts.join(' · ') : null;
    }
    return tags;
  });

  protected readonly canEditWidgetByPlacement = computed<Record<string, boolean>>(() => {
    const d = this.detail();
    if (!d) return {};
    const accessMap = this.widgetAccessMap();
    const hasWidgetRead = can('crm.widgets.read');
    const result: Record<string, boolean> = {};
    for (const p of this.allPlacements()) {
      const widgetAccess =
        accessMap[p.widgetId] ?? (p.widget.ownerUserId === FAKE_ME.id ? 'OWNER' : 'VIEW');
      result[p.id] = hasWidgetRead && (widgetAccess === 'OWNER' || widgetAccess === 'EDIT');
    }
    return result;
  });

  protected readonly partialTooltipByPlacement = computed<Record<string, string>>(() => {
    this.i18n();
    this.analyticsScope();
    const lang = this.language();
    const d = this.detail();
    if (!d) return {};
    const views = this.panelViews();
    const tooltips: Record<string, string> = {};
    for (const p of this.allPlacements()) {
      const view = views[p.widgetId];
      if (view?.status !== 'PARTIAL' && !view?.partialAccess) continue;
      const parts = this.coverageParts(view.coverage, lang);
      if (view.partialAccess) {
        parts.push(this.transloco.translate('analytics.common.partialAccess'));
      }
      parts.push(...warningReasonKeys(view).map((key) => this.transloco.translate(key)));
      tooltips[p.id] =
        parts.length > 0 ? parts.join(' · ') : this.transloco.translate('analytics.state.PARTIAL');
    }
    return tooltips;
  });

  protected readonly frameHintByPlacement = computed<Record<string, string>>(() => {
    this.i18n();
    this.analyticsScope();
    this.chartScope();
    const lang = this.language();
    const d = this.detail();
    const cat = this.catalog();
    if (!d) return {};
    const views = this.panelViews();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const hints: Record<string, string> = {};
    for (const p of this.allPlacements()) {
      const view = views[p.widgetId];
      const exec = view?.execution;
      const metricKey = p.widget.querySpec.series[0]?.metricKey;
      const metric = cat?.metrics.find((m) => m.key === metricKey);

      const parts: string[] = [];
      const timeBasis = exec?.meta.timeBasis ?? metric?.timeModel;
      if (timeBasis === 'COHORT' && exec?.meta.effectivePeriod?.from && exec.meta.effectivePeriod.to) {
        const month = formatShortDate(exec.meta.effectivePeriod.from, lang, 'MONTH', chartT);
        const date = formatShortDate(exec.meta.effectivePeriod.to, lang, 'DAY', chartT);
        parts.push(this.transloco.translate('analytics.common.cohortObserved', { month, date }));
        parts.push(this.transloco.translate('analytics.common.maturing', { month }));
      } else if (timeBasis && timeBasis !== 'UNKNOWN' && timeBasis !== 'CUSTOM') {
        const basisKey = `analytics.basis.${timeBasis}`;
        const translated = this.transloco.translate(basisKey);
        if (translated !== basisKey) {
          parts.push(translated);
        }
      }

      const num = exec?.details?.['numerator'];
      const den = exec?.details?.['denominator'];
      if (typeof num === 'number' && typeof den === 'number') {
        parts.push(formatRateN(num, den, lang, chartT));
      }

      const calc = exec?.details?.['calculation'] as CalculationDetails | undefined;
      if (calc && (calc.operation === 'RATIO' || calc.operation === 'DIFFERENCE')) {
        const operandUnit = metric?.unit ?? 'COUNT';
        // No hard-coded currency: without one from the run or the filters the operand shows as a plain number.
        const currency =
          exec?.meta.currency ?? exec?.series[0]?.currency ?? this.runtimeFilters().currencyCode ?? null;
        const formatOperand = (v: number | null): string => {
          if (v === null) return DASH;
          return operandUnit === 'MONEY' && currency
            ? formatMoney(v, currency)
            : formatNumber(v, lang, Number.isInteger(v) ? 0 : 2);
        };
        const symbol = calc.operation === 'RATIO' ? '÷' : '−';
        parts.push(`${formatOperand(calc.numerator)} ${symbol} ${formatOperand(calc.denominator)}`);
      }

      const dc = exec?.details?.['datasetComparison'] as DatasetComparisonDetails | undefined;
      if (dc && typeof dc.unionCount === 'number' && typeof dc.overlapCount === 'number') {
        parts.push(
          this.transloco.translate('analytics.common.teamComparisonHint', {
            u: formatNumber(dc.unionCount, lang, 0),
            o: formatNumber(dc.overlapCount, lang, 0),
          }),
        );
      }

      parts.push(...this.coverageParts(view?.coverage, lang));

      if (view?.partialAccess) {
        parts.push(this.transloco.translate('analytics.common.partialAccess'));
      }

      parts.push(...governedTargetParts(exec, (key, params) => this.transloco.translate(key, params)));

      if (view && (view.status === 'READY' || view.status === 'PARTIAL')) {
        const targetShown = new Set(['TARGET_NOT_SET', 'SOURCE_PERMISSION_REQUIRED', 'CALENDAR_HOURS_MISSING']);
        for (const key of warningReasonKeys(view)) {
          if (!targetShown.has(key.slice(key.lastIndexOf('.') + 1))) {
            parts.push(this.transloco.translate(key));
          }
        }
      }

      hints[p.id] = parts.join(' · ');
    }
    return hints;
  });

  protected readonly frameMenuByPlacement = computed<Record<string, ActionItem[]>>(() => {
    this.i18n();
    this.widgetsScope();
    const d = this.detail();
    const cat = this.catalog();
    if (!d) return {};

    const views = this.panelViews();
    const tableMap = this.showTableMap();
    const canEditByPlacement = this.canEditWidgetByPlacement();
    const editing = this.editing();
    const editable = this.canEdit();

    const result: Record<string, ActionItem[]> = {};
    for (const p of this.allPlacements()) {
      const items: ActionItem[] = [];
      const view = views[p.widgetId];
      const metricKey = p.widget.querySpec.series[0]?.metricKey;
      const metric = cat?.metrics.find((m) => m.key === metricKey);
      const isReady = view?.status === 'READY' || view?.status === 'PARTIAL';

      if (!editing && metric?.drilldown && view?.status !== 'DENIED') {
        items.push({
          id: 'viewData',
          title: this.transloco.translate('dashboardWidgets.menu.viewData'),
          icon: 'tablerTable',
          tile: 'bg-icon-blue',
        });
      }

      if (!editing && isReady) {
        const showingTable = Boolean(tableMap[p.widgetId]);
        items.push({
          id: 'toggleTable',
          title: this.transloco.translate(
            showingTable ? 'dashboardWidgets.menu.hideTable' : 'dashboardWidgets.menu.showTable',
          ),
          icon: 'tablerTableShortcut',
          tile: 'bg-icon-teal',
        });
      }

      if (!editing && view?.receiptId) {
        items.push({
          id: 'explain',
          title: this.transloco.translate('dashboardWidgets.menu.explain'),
          icon: 'tablerInfoCircle',
          tile: 'bg-icon-violet',
        });
      }

      if (canEditByPlacement[p.id]) {
        items.push({
          id: 'openBuilder',
          title: this.transloco.translate('dashboardWidgets.menu.openBuilder'),
          icon: 'tablerChartDots3',
          tile: 'bg-icon-violet',
        });
      }

      if (editable) {
        items.push({
          id: 'versionPolicy',
          title: this.transloco.translate('dashboardWidgets.menu.versionPolicy'),
          icon: 'tablerVersions',
          tile: 'bg-icon-gray',
        });
      }

      if (editing) {
        items.push({
          id: 'remove',
          title: this.transloco.translate('dashboardWidgets.menu.remove'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
        });
      }

      result[p.id] = items;
    }

    for (const u of d.unavailablePlacements) {
      result[u.id] = editing
        ? [
            {
              id: 'remove',
              title: this.transloco.translate('dashboardWidgets.menu.remove'),
              icon: 'tablerTrash',
              tile: 'bg-icon-red',
              danger: true,
            },
          ]
        : [];
    }

    return result;
  });

  protected readonly notAvailableText = computed(() => {
    this.i18n();
    this.pageScope();
    return this.transloco.translate('dashPage.notAvailableYet');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq++;
      this.runSeq++;
      this.runAbort.abort();
    });

    effect(() => {
      const id = this.routeParams()?.get('id') ?? null;
      untracked(() => {
        void this.loadDashboardRoute(id);
      });
    });

    effect(() => {
      const lang = this.language();
      if (this.initializedLang === null) {
        this.initializedLang = lang;
        return;
      }
      if (lang === this.initializedLang) return;
      this.initializedLang = lang;

      untracked(() => {
        const current = this.detail();
        if (!current) return;
        this.switcherRefresh.update((v) => v + 1);
        if (!this.editing() || !this.editDirty()) {
          void this.refreshLocalizedDetail(current.id);
        } else {
          void this.runAllWidgets(current, this.runtimeFilters(), false);
        }
      });
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.editing() || !this.editDirty()) {
      return true;
    }
    const choice = await this.unsavedDialog().open();
    if (choice === 'save') {
      return await this.onSaveLayout(true);
    }
    if (choice === 'discard') {
      this.resetLocalEdits();
      this.editing.set(false);
      this.selectedId.set(null);
      return true;
    }
    return false;
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editing() && this.editDirty()) {
      event.preventDefault();
    }
  }

  protected retryPageLoad(): void {
    const id = this.routeParams()?.get('id') ?? null;
    void this.loadDashboardRoute(id);
  }

  protected goHome(): void {
    void this.router.navigate(['/workspace/home']);
  }

  protected async openCreateFromEmpty(): Promise<void> {
    const modal = this.createModal();
    if (!modal || !this.canCreate) return;
    const createdId = await modal.open();
    if (!createdId) return;
    const isBlank = modal.lastCreatedKind() === 'blank';
    await this.router.navigate(['/crm/dashboard/dashboards', createdId], {
      ...(isBlank ? { queryParams: { edit: '1' } } : {}),
    });
  }

  protected onSwitchDashboard(id: string): void {
    void this.router.navigate(['/crm/dashboard/dashboards', id]);
  }

  protected onFiltersChange(next: DashboardFilterValue): void {
    const before = this.runtimeFilters() as unknown as Record<string, unknown>;
    this.filterValue.set(next);
    const after = this.runtimeFilters();
    const current = this.detail();
    if (!current) return;

    const afterRecord = after as unknown as Record<string, unknown>;
    const changed = new Set<string>();
    for (const key of new Set([...Object.keys(before), ...Object.keys(afterRecord)])) {
      if (JSON.stringify(before[key] ?? null) !== JSON.stringify(afterRecord[key] ?? null)) changed.add(key);
    }
    if (changed.size === 0) return;

    // Rerun only the widgets that use a changed filter (the others reported it as ignored).
    const views = this.panelViews();
    const affected = current.placements.filter((p) => {
      const ignored = views[p.widgetId]?.execution?.meta.ignoredFilters;
      return views[p.widgetId]?.status === 'loading' || !ignored || [...changed].some((key) => !ignored.includes(key));
    });
    const seq = ++this.runSeq;
    const nextViews = { ...views };
    for (const p of affected) nextViews[p.widgetId] = LOADING_VIEW;
    this.panelViews.set(nextViews);
    for (const p of affected) {
      void this.runSingleWidget(current.id, p.widgetId, false, seq, after);
    }
  }

  protected onOpenWhy(): void {
    const current = this.detail();
    if (!current) return;
    this.whyModal()?.open(current.id, this.lastRun());
  }

  protected onRefresh(): void {
    const current = this.detail();
    if (!current) return;
    void this.runAllWidgets(current, this.runtimeFilters(), true);
  }

  protected async onCustomize(): Promise<void> {
    const current = this.detail();
    if (!current || !this.canCustomize() || this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const copy = await duplicateDashboard(current.id, null, newIdempotencyKey());
      this.notify.success(this.transloco.translate('dashPage.copied'));
      const omitted = copy.duplication?.omittedUnavailableWidgetCount ?? 0;
      if (omitted > 0) {
        this.notify.warning(
          this.transloco.translate('dashPage.omittedWidgets', { count: omitted }),
        );
      }
      this.switcherRefresh.update((v) => v + 1);
      await this.router.navigate(['/crm/dashboard/dashboards', copy.id], {
        queryParams: { edit: '1' },
      });
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.headerBusy.set(false);
    }
  }

  protected onEnterEditMode(): void {
    if (!this.canEdit() || this.editing()) return;
    const hadCrossFilters = this.crossFilters().length > 0;
    if (hadCrossFilters) {
      this.crossFilterChange = null;
      this.crossFilters.set([]);
      const d = this.detail();
      if (d) {
        void this.runAllWidgets(d, this.runtimeFilters(), false);
      }
    }
    this.resetLocalEdits();
    this.editor.reset(this.viewGridItems());
    this.selectedId.set(null);
    this.layoutSizeError.set(null);
    this.editing.set(true);
  }

  protected onSelectedChange(id: string | null): void {
    if (this.selectedId() !== id) {
      this.layoutSizeError.set(null);
    }
    this.selectedId.set(id);
  }

  protected async onAddWidget(): Promise<void> {
    const current = this.detail();
    const modal = this.addWidgetModal();
    if (!current || !modal || !this.editing()) return;

    const usedIds = this.shownPlacements().map((p) => p.widgetId);
    const added = await modal.open(current.id, current.revision, usedIds);
    if (!added || this.detail()?.id !== current.id || !this.editing()) return;

    const spec = this.catalog()?.visualizations.find((v) => v.key === added.widget.visualizationType);
    if (!spec) {
      this.notify.error(this.transloco.translate('analytics.error.GENERIC'));
      return;
    }

    // Nothing goes to the server here: the placement exists only in the browser (and can be undone) until Save.
    const tempId = `local-${newIdempotencyKey()}`;
    const bottom = this.editor.items().reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    const placement: Placement = {
      id: tempId,
      dashboardId: current.id,
      widgetId: added.widget.id,
      sortOrder: this.shownPlacements().length,
      versionPolicy: added.versionMode,
      pinnedVersionNumber: added.pinnedVersionNumber,
      widget: added.widget,
    };
    this.localAdds.update((list) => [
      ...list,
      { tempId, widgetId: added.widget.id, pinnedVersionNumber: added.pinnedVersionNumber, placement },
    ]);

    const nextGridItem: GridItem = {
      id: tempId,
      x: 0,
      y: bottom,
      w: spec.defaultSize.w,
      h: spec.defaultSize.h,
      minW: spec.minSize.w,
      minH: spec.minSize.h,
      ...(spec.maxSize?.w !== undefined ? { maxW: spec.maxSize.w } : {}),
      ...(spec.maxSize?.h !== undefined ? { maxH: spec.maxSize.h } : {}),
    };
    this.editor.add(nextGridItem);
    this.layoutSizeError.set(null);
    this.selectedId.set(tempId);
  }

  protected onGridLayoutChange(items: GridItem[]): void {
    if (!this.editing()) return;
    const realIds = new Set(this.allPlacements().map((p) => p.id));
    const realItems = items.filter((item) => realIds.has(item.id));
    const prevItems = this.editor.items();
    this.editor.apply(realItems);
    if (this.editor.items() !== prevItems) {
      this.layoutSizeError.set(null);
    }
  }

  protected onSaveUndo(): void {
    if (!this.editing() || this.savingLayout()) return;
    this.layoutSizeError.set(null);
    this.editor.undo();
  }

  /** @param fromGuard true when the leave guard asked for the save: the navigation must then continue untouched. */
  protected async onSaveLayout(fromGuard = false): Promise<boolean> {
    const current = this.detail();
    if (!current || !this.editing() || this.savingLayout()) return false;

    const shown = new Set(this.editor.items().map((item) => item.id));
    const adds = this.localAdds()
      .filter((add) => shown.has(add.tempId))
      .map(({ tempId, widgetId, pinnedVersionNumber }) => ({ tempId, widgetId, pinnedVersionNumber }));
    const removedPlacementIds = [
      ...current.placements.filter((p) => !shown.has(p.id)).map((p) => p.id),
      ...this.removedUnavailable(),
    ];

    this.layoutSizeError.set(null);
    this.savingLayout.set(true);
    try {
      const res = await saveLayoutResolving(
        current.id,
        current.revision,
        this.editor.payload(),
        this.conflictConfirm(),
        { removedPlacementIds, adds },
      );
      if (!res) return false;

      if ('reload' in res) {
        this.resetLocalEdits();
        this.editing.set(false);
        this.selectedId.set(null);
        this.layoutSizeError.set(null);
        await this.loadDashboardRoute(current.id);
        return false;
      }

      this.resetLocalEdits();
      this.detail.set(res.detail);
      this.editor.reset(this.viewGridItems());
      this.editing.set(false);
      this.selectedId.set(null);
      this.layoutSizeError.set(null);
      if (!fromGuard) this.clearEditQueryParam();
      if (adds.length > 0 || removedPlacementIds.length > 0) {
        void this.runAllWidgets(res.detail, this.runtimeFilters(), false);
      }
      this.notify.success(this.transloco.translate('dashPage.layoutSaved'));
      if (res.detail.adjusted) {
        this.notify.info(this.transloco.translate('dashPage.layoutAdjusted'));
      }
      return true;
    } catch (error) {
      if (isLayoutSizeInvalid(error)) {
        const sizeError =
          error instanceof LayoutSizeInvalidError
            ? error
            : new LayoutSizeInvalidError(error, {
                removedPlacementIds: [],
                addedIdMap: {},
                revision: current.revision,
              });
        await this.handleLayoutSizeInvalid(current.id, sizeError);
        return false;
      }
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      if (adds.length > 0 || removedPlacementIds.length > 0) {
        // Some structural calls may already have been applied, so the local revision is no longer trustworthy.
        this.resetLocalEdits();
        this.editing.set(false);
        this.selectedId.set(null);
        this.layoutSizeError.set(null);
        await this.loadDashboardRoute(current.id);
      }
      return false;
    } finally {
      this.savingLayout.set(false);
    }
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
    this.resetLocalEdits();
    this.editor.reset(this.viewGridItems());
    this.editing.set(false);
    this.selectedId.set(null);
    this.layoutSizeError.set(null);
    this.clearEditQueryParam();
  }

  private resetLocalEdits(): void {
    this.localAdds.set([]);
    this.removedUnavailable.set([]);
    this.layoutSizeError.set(null);
  }

  protected async onHeaderMenu(actionId: string): Promise<void> {
    const current = this.detail();
    if (!current) return;

    switch (actionId) {
      case 'duplicate':
        await this.duplicateCurrent(current);
        break;
      case 'share':
        this.openShare(current);
        break;
      case 'setDefault':
        await this.makeDefault(current);
        break;
      case 'toggleFavorite':
        await this.toggleFavorite(current);
        break;
      case 'schedule':
        void this.router.navigate(['/crm/reports/schedules'], {
          queryParams: { dashboardId: current.id, new: '1' },
        });
        break;
      case 'delete':
        await this.deleteCurrent(current);
        break;
    }
  }

  protected async onWidgetMenu(placementId: string, actionId: string): Promise<void> {
    const current = this.detail();
    if (!current) return;

    if (actionId === 'remove') {
      this.onRemovePlacement(placementId);
      return;
    }

    const placement = this.placementById()[placementId];
    if (!placement) return;

    switch (actionId) {
      case 'viewData': {
        const target = recordsLink(
          current.id,
          placement.widgetId,
          placement.widget.name,
          this.runtimeFilters(),
        );
        void this.router.navigate(target.commands, { queryParams: target.queryParams });
        break;
      }
      case 'toggleTable': {
        this.showTableMap.update((map) => ({
          ...map,
          [placement.widgetId]: !map[placement.widgetId],
        }));
        break;
      }
      case 'explain': {
        const view = this.panelViews()[placement.widgetId];
        if (!view?.receiptId) return;
        const target = recordsLink(
          current.id,
          placement.widgetId,
          placement.widget.name,
          this.runtimeFilters(),
        );
        this.explainModal()?.open(view.receiptId, target);
        break;
      }
      case 'openBuilder': {
        void this.router.navigate(['/crm/dashboard/widgets', placement.widgetId, 'builder']);
        break;
      }
      case 'versionPolicy': {
        const modal = this.versionPolicyModal();
        if (!modal) return;
        const updatedBinding = await modal.open(current.id, placement.id);
        if (!updatedBinding || this.detail()?.id !== current.id) return;
        await this.syncAfterVersionPolicy(current.id, updatedBinding.widgetId);
        break;
      }
    }
  }

  /** Removal is local until Save, so it can be undone. */
  protected onRemovePlacement(placementId: string): void {
    const current = this.detail();
    if (!current || !this.editing()) return;

    const isLayoutItem = this.editor.items().some((item) => item.id === placementId);
    const isUnavail = current.unavailablePlacements.some((u) => u.id === placementId);
    if (isLayoutItem) {
      this.editor.remove(placementId);
    } else if (isUnavail) {
      this.removedUnavailable.update((list) => (list.includes(placementId) ? list : [...list, placementId]));
    } else {
      return;
    }
    this.layoutSizeError.set(null);
    if (this.selectedId() === placementId) {
      this.selectedId.set(null);
    }
  }

  protected onOpenWidgetBuilder(widgetId: string): void {
    void this.router.navigate(['/crm/dashboard/widgets', widgetId, 'builder']);
  }

  protected onOpenReadiness(source: string): void {
    void this.router.navigate(['/crm/settings/data-readiness'], { queryParams: { source } });
  }

  protected onRetryWidget(widgetId: string): void {
    const current = this.detail();
    if (!current) return;
    this.panelViews.update((map) => ({
      ...map,
      [widgetId]: LOADING_VIEW,
    }));
    void this.runSingleWidget(current.id, widgetId, true, this.runSeq);
  }

  protected onPointClick(placement: Placement, point: { pointKey: string; seriesKey?: string }): void {
    if (this.editing()) return;
    const current = this.detail();
    if (!current) return;

    const dimKey = placement.widget.querySpec.dimension?.key;
    // OTHER is the folded Top-N tail, not a real value to filter by: it goes straight to the drill-down,
    // where the server recomputes the complement from pointKey alone.
    if (point.pointKey !== OTHER_BUCKET_KEY && (dimKey === 'branch' || dimKey === 'company' || dimKey === 'owner')) {
      this.toggleCrossFilter(current, placement, dimKey, point.pointKey);
      return;
    }

    const metricKey = placement.widget.querySpec.series[0]?.metricKey;
    const metric = this.catalog()?.metrics.find((m) => m.key === metricKey);
    if (!metric?.drilldown) return;

    const target = recordsLink(
      current.id,
      placement.widgetId,
      placement.widget.name,
      this.runtimeFilters(),
      point,
    );
    void this.router.navigate(target.commands, { queryParams: target.queryParams });
  }

  protected onRemoveCrossFilter(event: { index: number; value: string }): void {
    const current = this.detail();
    if (!current) return;
    const next: CrossFilterSelection[] = [];
    const list = this.crossFilters();
    for (let i = 0; i < list.length; i++) {
      const sel = list[i];
      if (i !== event.index) {
        next.push(sel);
        continue;
      }
      const nextValues = sel.values.filter((v) => v !== event.value);
      if (nextValues.length > 0) {
        const nextLabels = { ...sel.labels };
        delete nextLabels[event.value];
        next.push({ ...sel, values: nextValues, labels: nextLabels });
      }
    }
    this.applyCrossFilters(current, next);
  }

  protected onPartialTipEscape(placementId: string, event: Event): void {
    if (this.partialTipDismissed() === placementId) return;
    event.stopPropagation();
    this.partialTipDismissed.set(placementId);
  }

  protected onClearCrossFilters(): void {
    const current = this.detail();
    if (current) {
      this.applyCrossFilters(current, []);
    } else {
      this.crossFilterChange = null;
      this.crossFilters.set([]);
    }
  }

  /**
   * The last cross-filter change: the selection before it and the run it started. Only a 422 FILTER_INVALID from
   * that run reverts it; once every widget of that run settles without 422, the change is accepted and cleared.
   */
  private crossFilterChange: { previous: CrossFilterSelection[]; seq: number; pending: number } | null = null;

  private applyCrossFilters(current: DashboardDetail, next: CrossFilterSelection[]): void {
    const previous = this.crossFilters();
    this.crossFilters.set(next);
    void this.runAllWidgets(current, this.runtimeFilters(), false);
    this.crossFilterChange =
      current.placements.length > 0 ? { previous, seq: this.runSeq, pending: current.placements.length } : null;
  }

  /** A widget of run `seq` finished without 422: once the whole change run has, the new selection stands. */
  private settleCrossFilterChange(seq: number): void {
    const change = this.crossFilterChange;
    if (!change) return;
    if (change.seq !== seq) {
      if (seq > change.seq) this.crossFilterChange = null;
      return;
    }
    change.pending -= 1;
    if (change.pending <= 0) this.crossFilterChange = null;
  }

  /** 422 on the run that followed a cross-filter change: put the previous selection back, say so once, run again. */
  private revertInvalidCrossFilters(dashboardId: string, seq: number): boolean {
    const change = this.crossFilterChange;
    const current = this.detail();
    if (change === null || change.seq !== seq || !current || current.id !== dashboardId) return false;
    this.crossFilterChange = null;
    this.crossFilters.set(change.previous);
    this.notify.error(this.transloco.translate('analytics.error.CRM_DASHBOARD_FILTER_INVALID'));
    void this.runAllWidgets(current, this.runtimeFilters(), false);
    return true;
  }

  /** Label of a chart value for its chip: series points first, then result rows (row.id to row.label). */
  private crossFilterLabel(exec: WidgetExecution | null | undefined, value: string): string {
    if (!exec) return value;
    for (const s of exec.series) {
      const found = s.points.find((pt) => pt.key === value);
      if (found?.label) return found.label;
    }
    const result = exec.result;
    if (result && result.shape === 'ROWS') {
      for (const row of result.rows) {
        if (row.id === value && 'label' in row && row.label) return row.label;
      }
    }
    return value;
  }

  private toggleCrossFilter(
    current: DashboardDetail,
    placement: Placement,
    field: 'branch' | 'company' | 'owner',
    value: string,
  ): void {
    if (!value || value.length > 200) {
      this.notify.warning(this.transloco.translate('dashPage.crossFilterValueInvalid'));
      return;
    }
    const label = this.crossFilterLabel(this.panelViews()[placement.widgetId]?.execution, value);

    const prev = this.crossFilters();
    const existingIdx = prev.findIndex((s) => s.placementId === placement.id && s.field === field);
    if (existingIdx >= 0) {
      const target = prev[existingIdx];
      if (target.values.includes(value)) {
        const nextValues = target.values.filter((v) => v !== value);
        const nextLabels = { ...target.labels };
        delete nextLabels[value];
        const next = nextValues.length > 0
          ? prev.map((s, i) => (i === existingIdx ? { ...s, values: nextValues, labels: nextLabels } : s))
          : prev.filter((_, i) => i !== existingIdx);
        this.applyCrossFilters(current, next);
        return;
      }
      if (target.values.length >= 50) {
        this.notify.warning(this.transloco.translate('dashPage.crossFilterLimit'));
        return;
      }
      const next = prev.map((s, i) =>
        i === existingIdx
          ? { ...s, values: [...s.values, value], labels: { ...s.labels, [value]: label } }
          : s,
      );
      this.applyCrossFilters(current, next);
      return;
    }

    if (prev.length >= 10) {
      this.notify.warning(this.transloco.translate('dashPage.crossFilterLimit'));
      return;
    }
    this.applyCrossFilters(current, [
      ...prev,
      {
        placementId: placement.id,
        field,
        values: [value],
        labels: { [value]: label },
      },
    ]);
  }

  protected onOpenRecord(ref: EntityRef): void {
    if (ref.type === 'LEAD') {
      void this.router.navigate(['/crm/leads', ref.id]);
      return;
    }
    this.notify.info(this.notAvailableText());
  }

  protected viewForWidget(widgetId: string): PanelView {
    return this.panelViews()[widgetId] ?? LOADING_VIEW;
  }

  protected showTableForWidget(widgetId: string): boolean {
    return Boolean(this.showTableMap()[widgetId]);
  }

  protected unavailableReasonKey(reason: UnavailablePlacement['reason']): string {
    return reasonKey(reason);
  }

  private async loadDashboardRoute(routeId: string | null): Promise<void> {
    if (!can('crm.dashboards.read')) {
      this.pageStatus.set('forbidden');
      this.detail.set(null);
      return;
    }

    const seq = ++this.loadSeq;
    this.pageStatus.set('loading');
    this.editing.set(false);
    this.selectedId.set(null);
    this.detail.set(null);
    this.crossFilterChange = null;
    this.crossFilters.set([]);
    this.panelViews.set({});
    this.showTableMap.set({});
    this.lastRun.set(null);
    this.latestGeneratedAt.set(null);
    this.scopeInspector.set(null);
    this.resetLocalEdits();

    try {
      const catPromise = this.catalog()
        ? Promise.resolve(this.catalog()!)
        : getCatalog();

      void catPromise.catch(() => undefined);

      const loadedDetail = routeId
        ? await getDashboard(routeId)
        : await this.resolveDefaultDashboard();

      const cat = await catPromise;
      if (seq !== this.loadSeq || this.destroyed) return;

      if (cat) {
        this.catalog.set(cat);
      }

      if (!loadedDetail) {
        this.pageStatus.set('no-dashboards');
        return;
      }

      this.detail.set(loadedDetail);
      this.filterValue.set(defaultFilterValue(loadedDetail.defaultFilters));
      this.editor.reset(this.viewGridItems());
      this.pageStatus.set('ready');

      const wantsEdit = this.route.snapshot.queryParamMap.get('edit') === '1';
      if (wantsEdit && this.canEdit()) {
        this.editing.set(true);
      }

      void this.loadAuxiliary(loadedDetail.id, seq);
      void this.runAllWidgets(loadedDetail, this.runtimeFilters(), false);
    } catch (error) {
      if (seq !== this.loadSeq || this.destroyed) return;
      if (error instanceof ApiError) {
        if (error.status === 403) {
          this.pageStatus.set('forbidden');
          return;
        }
        if (error.status === 404) {
          this.pageStatus.set('not-found');
          return;
        }
      }
      this.pageStatus.set('load-failure');
    }
  }

  private async resolveDefaultDashboard(): Promise<DashboardDetail | null> {
    try {
      return await getDefaultDashboard();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
      const nav = await getNavigation();
      const firstId = nav.activeDashboardId ?? nav.items[0]?.id ?? null;
      if (!firstId) {
        return null;
      }
      return await getDashboard(firstId);
    }
  }

  private async loadAuxiliary(dashboardId: string, seq: number): Promise<void> {
    try {
      const [inspector, addable] = await Promise.all([
        getScopeInspector(dashboardId).catch(() => null),
        listAddableWidgets({ limit: 100 }).catch(() => null),
      ]);
      if (seq !== this.loadSeq || this.destroyed) return;
      if (inspector) {
        this.scopeInspector.set(inspector);
      }
      if (addable) {
        const accessMap: Record<string, 'OWNER' | 'EDIT' | 'VIEW'> = {};
        for (const item of addable.items) {
          accessMap[item.id] = item.accessLevel;
        }
        this.widgetAccessMap.set(accessMap);
      }
    } catch {
      // Non-blocking metadata; page remains functional.
    }
  }

  private async refreshLocalizedDetail(dashboardId: string): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const fresh = await getDashboard(dashboardId);
      if (seq !== this.loadSeq || this.destroyed) return;
      this.detail.set(fresh);
      if (!this.editing()) {
        this.editor.reset(this.viewGridItems());
      }
      void this.runAllWidgets(fresh, this.runtimeFilters(), false);
    } catch {
      // Keep existing detail on transient refresh error.
    }
  }

  private async syncAfterVersionPolicy(dashboardId: string, widgetId: string): Promise<void> {
    try {
      const fresh = await getDashboard(dashboardId);
      if (this.detail()?.id !== dashboardId || this.destroyed) return;
      this.detail.set(fresh);
      const freshGrid = this.viewGridItems();
      if (!this.editing() || !this.editDirty()) {
        this.editor.reset(freshGrid);
      } else {
        const freshMap = new Map(freshGrid.map((item) => [item.id, item]));
        const nextItems = this.editor.items().map((item) => {
          const updated = freshMap.get(item.id);
          return updated
            ? {
                ...item,
                w: Math.max(item.w, updated.minW),
                h: Math.max(item.h, updated.minH),
                minW: updated.minW,
                minH: updated.minH,
                ...(updated.maxW !== undefined ? { maxW: updated.maxW } : {}),
                ...(updated.maxH !== undefined ? { maxH: updated.maxH } : {}),
              }
            : item;
        });
        this.editor.apply(nextItems);
      }
      this.panelViews.update((map) => ({
        ...map,
        [widgetId]: LOADING_VIEW,
      }));
      void this.runSingleWidget(dashboardId, widgetId, false, this.runSeq);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private async runAllWidgets(
    detail: DashboardDetail,
    filters: RuntimeFilters,
    refresh: boolean,
  ): Promise<void> {
    const seq = ++this.runSeq;
    this.runAbort.abort();
    this.runAbort = new AbortController();
    const initialViews: Record<string, PanelView> = {};
    for (const p of detail.placements) {
      initialViews[p.widgetId] = LOADING_VIEW;
    }
    this.panelViews.set(initialViews);
    this.lastRun.set(null);

    if (detail.placements.length === 0) {
      this.latestGeneratedAt.set(detail.updatedAt);
      return;
    }

    for (const placement of detail.placements) {
      void this.runSingleWidget(detail.id, placement.widgetId, refresh, seq, filters);
    }
  }

  private async runSingleWidget(
    dashboardId: string,
    widgetId: string,
    refresh: boolean,
    seq: number,
    explicitFilters?: RuntimeFilters,
  ): Promise<void> {
    const filters = explicitFilters ?? this.runtimeFilters();
    const wireCrossFilters: CrossFilter[] = this.crossFilters().map(({ placementId, field, values }) => ({
      placementId,
      field,
      values,
    }));
    try {
      // One user may have 3 runs in flight: widgets wait in the shared queue; a refused call (429) still retries
      // while the panel shows "retrying"; a newer run or leaving the page aborts both.
      const signal = this.runAbort.signal;
      const run = await retryWhenBusy(
        () =>
          queueRun(
            () =>
              runDashboard(dashboardId, {
                filters,
                ...(wireCrossFilters.length > 0 ? { crossFilters: wireCrossFilters } : {}),
                widgetIds: [widgetId],
                refresh,
              }, signal),
            signal,
          ),
        {
          signal,
          onRetry: () => {
            if (seq !== this.runSeq || this.destroyed) return;
            this.panelViews.update((map) => ({ ...map, [widgetId]: { ...LOADING_VIEW, retrying: true } }));
          },
        },
      );
      if (seq !== this.runSeq || this.detail()?.id !== dashboardId || this.destroyed) return;
      this.settleCrossFilterChange(seq);

      const exec: WidgetExecution | undefined = run.widgets[widgetId];
      const outcome: PanelOutcome | undefined =
        run.panels.find((p) => p.panelKey === widgetId) ?? run.panels[0];

      const view = exec
        ? viewFromRun(exec, outcome, run.budget)
        : ({ ...LOADING_VIEW, status: 'ERROR' } as PanelView);

      this.panelViews.update((map) => ({
        ...map,
        [widgetId]: view,
      }));

      this.latestGeneratedAt.update((prev) =>
        !prev || run.generatedAt > prev ? run.generatedAt : prev,
      );

      this.lastRun.update((prev) => {
        if (!prev) return run;
        const nextPanels = prev.panels.filter((p) => p.panelKey !== widgetId);
        if (outcome) nextPanels.push(outcome);
        return {
          ...prev,
          revision: run.revision,
          filters: run.filters,
          generatedAt: run.generatedAt > prev.generatedAt ? run.generatedAt : prev.generatedAt,
          populationScope: run.populationScope ?? prev.populationScope,
          organizationScope: run.organizationScope,
          budget: run.budget ?? prev.budget,
          widgets: {
            ...prev.widgets,
            ...run.widgets,
          },
          panels: nextPanels,
        };
      });
    } catch (error) {
      if (isAbortError(error) || seq !== this.runSeq || this.detail()?.id !== dashboardId || this.destroyed) return;
      if (errorCodeOf(error) === 'CRM_DASHBOARD_FILTER_INVALID' && this.revertInvalidCrossFilters(dashboardId, seq)) {
        return;
      }
      this.settleCrossFilterChange(seq);
      this.panelViews.update((map) => ({
        ...map,
        [widgetId]: {
          ...LOADING_VIEW,
          status: 'ERROR',
          reasonCode: errorCodeOf(error),
        },
      }));
    }
  }

  private async duplicateCurrent(current: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const copy = await duplicateDashboard(current.id, null, newIdempotencyKey());
      this.notify.success(this.transloco.translate('dashPage.copied'));
      const omitted = copy.duplication?.omittedUnavailableWidgetCount ?? 0;
      if (omitted > 0) {
        this.notify.warning(
          this.transloco.translate('dashPage.omittedWidgets', { count: omitted }),
        );
      }
      this.switcherRefresh.update((v) => v + 1);
      await this.router.navigate(['/crm/dashboard/dashboards', copy.id]);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private openShare(current: DashboardDetail): void {
    const shareModal = this.shareModal();
    if (!shareModal) return;
    const api: ShareApi = {
      list: () => listDashboardShares(current.id),
      add: (body, key) => addDashboardShare(current.id, body, key),
      update: (shareId, body) => updateDashboardShare(current.id, shareId, body),
      revoke: (shareId, reason) => revokeDashboardShare(current.id, shareId, reason),
      targets: async (search) => (await listShareTargets('dashboards', search)).items,
      preview: (subjectType, subjectId) => previewDashboardShare(current.id, subjectType, subjectId),
    };
    shareModal.open(api, current.name, can('crm.dashboards.share') && scopeLevels().includes('all'));
  }

  protected async onSharesChanged(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    try {
      const shares = await listDashboardShares(current.id);
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, isShared: shares.length > 0 } : d));
    } catch {
      // Ignore share-badge refresh failure.
    }
  }

  private async makeDefault(current: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const updated = await setDefaultDashboard(current.id, newIdempotencyKey());
      this.detail.set(updated);
      this.switcherRefresh.update((v) => v + 1);
      this.notify.success(this.transloco.translate('dashPage.defaultUpdated'));
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async toggleFavorite(current: DashboardDetail): Promise<void> {
    if (this.headerBusy()) return;
    this.headerBusy.set(true);
    try {
      const updated = await setFavoriteDashboard(
        current.id,
        !current.isFavorite,
        newIdempotencyKey(),
      );
      this.detail.set(updated);
      this.switcherRefresh.update((v) => v + 1);
      this.notify.success(
        this.transloco.translate(
          updated.isFavorite ? 'dashPage.favouriteAdded' : 'dashPage.favouriteRemoved',
        ),
      );
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async deleteCurrent(current: DashboardDetail): Promise<void> {
    if (current.accessLevel !== 'OWNER' || !can('crm.dashboards.delete')) return;
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) return;

    this.headerBusy.set(true);
    try {
      await deleteDashboard(current.id);
      this.notify.success(this.transloco.translate('dashPage.deleted'));
      this.switcherRefresh.update((v) => v + 1);
      await this.router.navigate(['/crm/dashboard/home']);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.headerBusy.set(false);
    }
  }

  private async handleLayoutSizeInvalid(
    dashboardId: string,
    error: LayoutSizeInvalidError,
  ): Promise<void> {
    const { applied, sizeDetails } = error;
    const addedMap = applied.addedIdMap;
    const removedSet = new Set(applied.removedPlacementIds);
    const hasStructuralChanges =
      applied.removedPlacementIds.length > 0 || Object.keys(addedMap).length > 0;

    const remappedItems = this.editor.items().map((item) => {
      const mappedId = addedMap[item.id];
      return mappedId ? { ...item, id: mappedId } : item;
    });

    if (hasStructuralChanges) {
      this.localAdds.update((list) => list.filter((add) => !(add.tempId in addedMap)));
      this.removedUnavailable.update((list) => list.filter((id) => !removedSet.has(id)));
      try {
        const fresh = await getDashboard(dashboardId);
        if (this.detail()?.id !== dashboardId || !this.editing() || this.destroyed) return;
        this.detail.set(fresh);
        this.editor.reset(this.viewGridItems());
        this.editor.apply(remappedItems);
        for (const realId of Object.values(addedMap)) {
          const addedPlacement = fresh.placements.find((p) => p.id === realId);
          if (addedPlacement && !this.panelViews()[addedPlacement.widgetId]) {
            this.panelViews.update((map) => ({ ...map, [addedPlacement.widgetId]: LOADING_VIEW }));
            void this.runSingleWidget(fresh.id, addedPlacement.widgetId, false, this.runSeq);
          }
        }
      } catch {
        if (this.detail()?.id !== dashboardId || !this.editing() || this.destroyed) return;
        this.editor.apply(remappedItems);
      }
    }

    const rawPlacementId = sizeDetails.placementId;
    const mappedPlacementId = rawPlacementId ? (addedMap[rawPlacementId] ?? rawPlacementId) : null;
    const hasTargetOnCanvas =
      mappedPlacementId !== null && this.editor.items().some((item) => item.id === mappedPlacementId);

    let minW = sizeDetails.minW;
    let minH = sizeDetails.minH;
    if (mappedPlacementId && (minW === null || minH === null)) {
      const placement = this.placementById()[mappedPlacementId];
      const spec = placement
        ? this.catalog()?.visualizations.find((v) => v.key === placement.widget.visualizationType)
        : undefined;
      if (spec) {
        minW ??= spec.minSize.w;
        minH ??= spec.minSize.h;
      }
    }

    if (hasTargetOnCanvas && mappedPlacementId) {
      this.selectedId.set(mappedPlacementId);
      this.layoutSizeError.set(
        minW !== null && minH !== null
          ? { minW, minH }
          : { fallbackKey: 'analytics.error.CRM_DASHBOARD_LAYOUT_SIZE_INVALID' },
      );
      return;
    }

    this.layoutSizeError.set(null);
    const message =
      minW !== null && minH !== null
        ? this.transloco.translate('dashEdit.sizeTooSmall', { w: minW, h: minH })
        : this.transloco.translate('analytics.error.CRM_DASHBOARD_LAYOUT_SIZE_INVALID');
    this.notify.error(message);
  }

  private coverageParts(
    coverage: PanelCoverage | null | undefined,
    lang: 'ar' | 'en',
  ): string[] {
    if (!coverage) return [];
    const parts: string[] = [];
    const tiers = coverage.tiers;
    const verified = tiers.VERIFIED ?? 0;
    const total =
      verified +
      (tiers.DERIVED ?? 0) +
      (tiers.UNVERIFIED ?? 0) +
      (tiers.BEFORE_TRACKING ?? 0) +
      (tiers.HISTORY_INCOMPLETE ?? 0);
    if (total > 0) {
      parts.push(
        this.transloco.translate('analytics.common.coverage', {
          n: formatNumber(verified, lang),
          total: formatNumber(total, lang),
        }),
      );
    }
    const note = coverage.note?.[lang];
    if (note) {
      parts.push(note);
    }
    return parts;
  }

  private clearEditQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.has('edit')) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
