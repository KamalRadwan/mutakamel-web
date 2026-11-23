import { DestroyRef, Injectable, computed, effect, inject, Injector, runInInjectionContext, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import type {
  Catalog,
  DisplaySpec,
  QuerySpec,
  Visualization,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { getWidgetCatalog } from '../../../../../shared/widgets/dashboard/analytics.api';
import {
  ApiError,
  errorCodeOf,
  isConcurrencyError,
  newIdempotencyKey,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import {
  LOADING_VIEW,
  RUN_CONCURRENCY_CODE,
  errorKey,
  viewFromRun,
  type PanelView,
} from '../../../../../shared/widgets/dashboard/panel-state';
import {
  type BranchOption,
  type PipelineOption,
  createWidget,
  getDraft,
  getWidget,
  listGrantedBranches,
  listPipelineOptions,
  loadFilterDomains,
  previewWidget,
  saveDraft as saveWidgetDraft,
} from '../widgets.api';
import type { DraftState, WidgetBody, WidgetDetail } from '../widgets.model';
import { fieldErrorsOf, isRetryableWriteError, isValidationError } from '../../../../../core/api/api-errors';
import type { FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { widgetConflict, widgetErrorMessage, widgetNeedsReload, widgetReadFailure, widgetWriteReadOnly, type WidgetReadFailure } from './builder-errors';
import { detailIssues } from '../../shared/api-error-details';
import {
  STEP_ORDER,
  defaultVisualizationForDraft,
  effectiveSeriesUnit,
  inferSourceFromQuery,
  validateStepWithZod,
  type BuilderDraft,
  type BuilderSource,
  type StepId,
  type ValidationIssue,
} from './builder-schemas';
import { filterTreeMetricKeys, filterTreeSupported, type FilterDomains } from './filter-tree';
import { OrgApi, type OrgTeam } from '../../../../../shared/widgets/dashboard/org.api';
import { listActiveCoreCurrencyCodes } from '../../../../../shared/lookups/core-currencies';

export {
  STEP_ORDER,
  type BuilderDraft,
  type BuilderSource,
  type StepId,
} from './builder-schemas';

const EMPTY_VIEW: PanelView = {
  status: 'EMPTY',
  execution: null,
  reasonCode: 'NO_METRICS',
  sourceKey: null,
  coverage: null,
  receiptId: null,
  computedAt: null,
  experimental: false,
};

/** Outcome of the 409 dialog. Only an explicit choice counts; Esc or closing is a dismissal. */
export type ConflictChoice = 'reload' | 'keep' | 'dismiss';

function createEmptyDraft(): BuilderDraft {
  return {
    source: null,
    name: '',
    description: '',
    visualizationType: null,
    querySpec: {
      series: [],
      filters: { datePreset: 'CURRENT_MONTH' },
      comparison: { type: 'NONE' },
      scopeBinding: { kind: 'VIEWER_RELATIVE' },
    },
    displaySpec: {
      numberFormat: 'auto',
      legendPosition: 'top',
    },
    changeSummary: '',
    internalNotes: '',
  };
}

function stableDraftSnapshot(draft: BuilderDraft): string {
  return JSON.stringify({
    source: draft.source,
    name: draft.name,
    description: draft.description,
    visualizationType: draft.visualizationType,
    querySpec: draft.querySpec,
    displaySpec: draft.displaySpec,
    changeSummary: draft.changeSummary ?? '',
    internalNotes: draft.internalNotes ?? '',
  });
}

function mapDetailFieldToStep(rawPath: string): { step: StepId; field: string } {
  const path = rawPath.replace(/^querySpec\./, '');
  if (path === 'engine' || path === 'source') return { step: 'data', field: 'source' };
  const calcMatch = path.match(/^(series\.\d+\.calculation)(?:\..*)?$/);
  if (calcMatch) {
    return { step: 'metrics', field: calcMatch[1] };
  }
  if (
    path === 'series' || path.startsWith('series.') ||
    /^series\.\d+\.metricKey$/.test(path) ||
    path === 'dimension' ||
    path.startsWith('dimension.') ||
    path === 'breakdown' ||
    path.startsWith('breakdown.')
  ) {
    return {
      step: 'metrics',
      field: path.startsWith('dimension.')
        ? 'dimension'
        : path.startsWith('breakdown.')
          ? 'breakdown'
          : path,
    };
  }
  if (path === 'filterTree' || path.startsWith('filterTree.')) {
    return { step: 'scope', field: 'filterTree' };
  }
  if (path.startsWith('filters.') || path === 'scopeBinding' || path.startsWith('scopeBinding.')) {
    return {
      step: 'scope',
      field: path.startsWith('scopeBinding.') ? 'scopeBinding' : path,
    };
  }
  if (path === 'comparison' || path.startsWith('comparison.')) {
    return { step: 'compare', field: path };
  }
  if (path === 'references' || path.startsWith('references.')) {
    return { step: 'presentation', field: `displaySpec.${path}` };
  }
  if (
    path === 'visualizationType' ||
    path === 'name' ||
    path === 'description' ||
    path.startsWith('displaySpec.')
  ) {
    return { step: 'presentation', field: path };
  }
  return { step: 'review', field: path };
}

/** Unknown action errors stay in toasts; only field-owned codes are attached to a step. */
function mapCodeToTarget(code: string): { step: StepId; field: string } | null {
  switch (code) {
    case 'CRM_WIDGET_ENGINE_INVALID':
      return { step: 'data', field: 'source' };
    case 'CRM_WIDGET_DRAFT_INVALID':
    case 'CRM_WIDGET_PUBLISH_INVALID':
      return { step: 'review', field: 'changeSummary' };
    case 'CRM_WIDGET_UNAVAILABLE':
    case 'CRM_WIDGET_METRIC_INVALID':
      return { step: 'metrics', field: 'series.0.metricKey' };
    case 'CRM_WIDGET_SERIES_INVALID':
    case 'CRM_WIDGET_UNITS_INCOMPATIBLE':
    case 'CRM_WIDGET_AXIS_REQUIRED':
      return { step: 'metrics', field: 'series' };
    case 'CRM_WIDGET_DIMENSION_INVALID':
    case 'CRM_WIDGET_TIME_GRAIN_REQUIRED':
      // Group-by lives in the metrics step, not in scope.
      return { step: 'metrics', field: 'dimension' };
    case 'CRM_WIDGET_FILTER_INVALID':
    case 'CRM_WIDGET_FILTER_TOO_COMPLEX':
      return { step: 'scope', field: 'filterTree' };
    case 'CRM_WIDGET_TARGET_REQUIRED':
    case 'CRM_WIDGET_TARGET_INVALID':
      return { step: 'compare', field: 'comparison.target' };
    case 'CRM_WIDGET_COMPARISON_UNSUPPORTED':
      return { step: 'compare', field: 'comparison' };
    case 'CRM_WIDGET_COMPARISON_DATASETS_INVALID':
      return { step: 'compare', field: 'comparison.datasets' };
    case 'CRM_WIDGET_VISUALIZATION_INVALID':
    case 'CRM_WIDGET_SHAPE_INCOMPATIBLE':
      return { step: 'presentation', field: 'visualizationType' };
    case 'CRM_WIDGET_DISPLAY_INVALID':
      return { step: 'presentation', field: 'displaySpec.references' };
    default:
      if (code.startsWith('CRM_WIDGET_COMPARISON_') || code.startsWith('CRM_WIDGET_TARGET_')) {
        return { step: 'compare', field: 'comparison' };
      }
      return null;
  }
}

@Injectable()
export class BuilderState {
  private readonly transloco = inject(TranslocoService);
  private readonly org = inject(OrgApi);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly destroyRef = inject(DestroyRef);

  readonly teams = signal<readonly OrgTeam[]>([]);
  readonly currencies = signal<readonly string[]>([]);
  readonly filterDomains = signal<FilterDomains>({});

  private readonly _catalog = signal<Catalog | null>(null);
  private readonly _branches = signal<readonly BranchOption[]>([]);
  private readonly _pipelines = signal<readonly PipelineOption[]>([]);
  private readonly _draft = signal<BuilderDraft>(createEmptyDraft());
  private readonly _savedSnapshot = signal<string>(stableDraftSnapshot(createEmptyDraft()));
  private readonly _errors = signal<Partial<Record<StepId, Record<string, string>>>>({});
  private readonly _preview = signal<PanelView>(EMPTY_VIEW);
  private readonly _widgetId = signal<string | null>(null);
  private readonly _draftState = signal<DraftState | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _loadError = signal<FullStateKind | null>(null);
  private readonly _visited = signal<ReadonlySet<StepId>>(new Set<StepId>(['data']));
  private readonly _lastServerErrorStep = signal<StepId | null>(null);
  private readonly _formError = signal<string | null>(null);

  private readonly _widget = signal<WidgetDetail | null>(null);
  private readonly _readFailure = signal<WidgetReadFailure | null>(null);
  private readonly _previewFailure = signal<WidgetReadFailure | null>(null);
  private readonly _writeReadOnly = signal(false);
  private readonly _reloadRequired = signal(false);
  private createAction: { bodyJson: string; key: string } | null = null;
  private previewSeq = 0;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAutoPreviewSignature = '';
  private loadSeq = 0;
  private conflictResolver: (() => Promise<ConflictChoice>) | null = null;
  private onCreatedCallback: ((id: string) => void) | null = null;
  private onPublishedCallback: (() => void) | null = null;

  readonly catalog: Signal<Catalog | null> = this._catalog.asReadonly();
  /** Branches the viewer may pick, already limited to their grants. */
  readonly branches: Signal<readonly BranchOption[]> = this._branches.asReadonly();
  readonly pipelines: Signal<readonly PipelineOption[]> = this._pipelines.asReadonly();
  readonly draft: Signal<BuilderDraft> = this._draft.asReadonly();
  readonly step: WritableSignal<StepId> = signal<StepId>('data');
  readonly errors: Signal<Partial<Record<StepId, Record<string, string>>>> = this._errors.asReadonly();
  readonly preview: Signal<PanelView> = this._preview.asReadonly();
  readonly widgetId: Signal<string | null> = this._widgetId.asReadonly();
  readonly draftState: Signal<DraftState | null> = this._draftState.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly saving: Signal<boolean> = this._saving.asReadonly();
  readonly loadError: Signal<FullStateKind | null> =
    this._loadError.asReadonly();
  readonly visited: Signal<ReadonlySet<StepId>> = this._visited.asReadonly();
  /** Kept for callers; action failures are displayed by Notify, never in the form body. */
  readonly formError: Signal<string | null> = this._formError.asReadonly();
  readonly lastServerErrorStep: Signal<StepId | null> = this._lastServerErrorStep.asReadonly();

  readonly widget = this._widget.asReadonly();
  readonly readFailure = this._readFailure.asReadonly();
  readonly previewFailure = this._previewFailure.asReadonly();
  readonly reloadRequired = this._reloadRequired.asReadonly();
  private readonly hasEditAccess = computed(() => {
    const widget = this._widget();
    return !widget || (widget.status !== 'ARCHIVED' &&
      (widget.accessLevel === 'OWNER' || widget.accessLevel === 'EDIT'));
  });
  readonly canSave = computed(() => {
    if (this._writeReadOnly() || this._reloadRequired()) return false;
    if (!this._widgetId()) return can('crm.widgets.create');
    return can('crm.widgets.update') && this.hasEditAccess();
  });
  readonly canPublish = computed(() => !this._writeReadOnly() && !this._reloadRequired() &&
    this.hasEditAccess() && can('crm.widgets.publish') && (this.canSave() || !!this._draftState()?.draft));
  readonly readOnly = computed(() => !this.canSave());

  readonly isEditing: Signal<boolean> = computed(() => this._widgetId() !== null);

  readonly dirty: Signal<boolean> = computed(
    () => stableDraftSnapshot(this._draft()) !== this._savedSnapshot(),
  );

  readonly publishReady: Signal<boolean> = computed(() => {
    const id = this._widgetId();
    const state = this._draftState();
    const cat = this._catalog();
    const current = this._draft();
    if (!id || !state?.draft || this.dirty() || !this.canPublish()) {
      return false;
    }
    return STEP_ORDER.every((s) => validateStepWithZod(s, current, cat).length === 0);
  });

  private readonly autoPreviewSignature = computed(() => {
    const d = this._draft();
    const cat = this._catalog();
    if (!cat || d.querySpec.series.length === 0) return '';
    if (validateStepWithZod('data', d, cat).length > 0) return '';
    if (validateStepWithZod('metrics', d, cat).length > 0) return '';
    if (validateStepWithZod('scope', d, cat).length > 0) return '';
    if (validateStepWithZod('compare', d, cat).length > 0) return '';
    if (d.visualizationType !== null) {
      const presIssues = validateStepWithZod('presentation', d, cat).filter(
        (iss) => iss.path !== 'name' && iss.path !== 'description',
      );
      if (presIssues.length > 0) return '';
    }
    return JSON.stringify({
      lang: this.language(),
      name: d.name,
      viz: d.visualizationType,
      querySpec: d.querySpec,
      displaySpec: d.displaySpec,
    });
  });

  constructor() {
    effect(() => {
      const active = this.step();
      this._visited.update((prev) => {
        if (prev.has(active)) return prev;
        const next = new Set(prev);
        next.add(active);
        return next;
      });
    });

    effect(() => {
      const sig = this.autoPreviewSignature();
      if (!sig) {
        this.invalidatePreviewRequest();
        if (this.previewTimer) {
          clearTimeout(this.previewTimer);
          this.previewTimer = null;
        }
        if (this._draft().querySpec.series.length === 0) {
          this.invalidatePreviewRequest();
          this._preview.set(EMPTY_VIEW);
          this.lastAutoPreviewSignature = '';
        }
        return;
      }

      if (sig === this.lastAutoPreviewSignature) return;
      this.invalidatePreviewRequest();
      if (this.previewTimer) clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null;
        this.lastAutoPreviewSignature = sig;
        this.refreshPreview();
      }, 600);
    });

    this.destroyRef.onDestroy(() => {
      if (this.previewTimer) clearTimeout(this.previewTimer);
      this.invalidatePreviewRequest();
    });
  }

  registerConflictResolver(fn: () => Promise<ConflictChoice>): void {
    this.conflictResolver = fn;
  }

  registerOnPublished(fn: () => void): void {
    this.onPublishedCallback = fn;
  }

  /** Called by the review step after a successful publish so the page header can refresh. */
  notifyPublished(): void {
    this.onPublishedCallback?.();
  }

  registerOnCreated(fn: (id: string) => void): void {
    this.onCreatedCallback = fn;
  }

  async load(widgetId: string | null, opts?: { keepStep?: boolean }): Promise<void> {
    const seq = ++this.loadSeq;
    this.invalidatePreviewRequest();
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }

    this._loading.set(true);
    if (this._widgetId() !== widgetId) this._widget.set(null);
    this._widgetId.set(widgetId);
    this._writeReadOnly.set(false);
    this._reloadRequired.set(false);
    this.createAction = null;
    this._readFailure.set(null);
    this._previewFailure.set(null);
    this._loadError.set(null);
    this._errors.set({});
    this._lastServerErrorStep.set(null);
    this._formError.set(null);

    try {
      const catalog = this._catalog() ?? (await getWidgetCatalog());
      if (seq !== this.loadSeq) return;
      this._catalog.set(catalog);
      const [branches, pipelines, teams, currencies, domains] = await Promise.all([
        listGrantedBranches(this.org),
        can('crm.pipelines.read') || can('crm.opportunities.read') ? listPipelineOptions() : Promise.resolve([]),
        this.org.listTeams(),
        can('currencies.currency.read')
          ? runInInjectionContext(this.injector, listActiveCoreCurrencyCodes) : Promise.resolve([]),
        loadFilterDomains(this.org),
      ]);
      if (seq !== this.loadSeq) return;
      this._branches.set(branches);
      this._pipelines.set(pipelines);
      this.teams.set(teams);
      this.currencies.set(currencies);
      this.filterDomains.set(domains);

      if (!widgetId) {
        const empty = createEmptyDraft();
        this._widgetId.set(null);
        this._draftState.set(null);
        this._draft.set(empty);
        this._savedSnapshot.set(stableDraftSnapshot(empty));
        this._visited.set(new Set<StepId>(['data']));
        this.step.set('data');
        this.lastAutoPreviewSignature = '';
        this._preview.set(EMPTY_VIEW);
        return;
      }

      const detail = await getWidget(widgetId);
      if (seq !== this.loadSeq) return;
      this._widget.set(detail);
      const ds: DraftState = this.canSave() ? await getDraft(widgetId) : {
        widgetId, widgetRevision: detail.revision, governanceRevision: detail.governanceRevision,
        activeVersionNumber: detail.versionNumber, draft: null,
      };
      if (seq !== this.loadSeq) return;

      let draftName = ds.draft?.name ?? '';
      let draftDescription = ds.draft?.description ?? '';
      let draftViz: Visualization | null = ds.draft?.visualizationType ?? null;
      let querySpec: QuerySpec = ds.draft
        ? structuredClone(ds.draft.querySpec)
        : {
            series: [],
            filters: { datePreset: 'CURRENT_MONTH' },
            comparison: { type: 'NONE' },
            scopeBinding: { kind: 'VIEWER_RELATIVE' },
          };
      let displaySpec: DisplaySpec = ds.draft
        ? structuredClone(ds.draft.displaySpec)
        : { numberFormat: 'auto', legendPosition: 'top' };
      const changeSummary = ds.draft?.changeSummary ?? '';
      const internalNotes = ds.draft?.internalNotes ?? '';

      if (!ds.draft) {
        draftName = detail.name;
        draftViz = detail.visualizationType;
        if (detail.querySpec) querySpec = structuredClone(detail.querySpec);
        if (detail.displaySpec) displaySpec = structuredClone(detail.displaySpec);
      }

      if (!querySpec.filters) {
        querySpec.filters = { datePreset: 'CURRENT_MONTH' };
      } else if (!querySpec.filters.datePreset) {
        querySpec.filters = { ...querySpec.filters, datePreset: 'CURRENT_MONTH' };
      }
      if (!querySpec.comparison) {
        querySpec.comparison = { type: 'NONE' };
      }
      if (!querySpec.scopeBinding) {
        querySpec.scopeBinding = { kind: 'VIEWER_RELATIVE' };
      }

      const legacyRef = displaySpec.options?.['referenceLine'] as
        | { value?: unknown; label?: unknown }
        | undefined;
      if (legacyRef && typeof legacyRef === 'object') {
        if (
          typeof legacyRef.value === 'number' &&
          Number.isFinite(legacyRef.value) &&
          legacyRef.value >= 0 &&
          (!displaySpec.references || displaySpec.references.length === 0)
        ) {
          const fallbackLabel = this.transloco.translate('builder2.presentation.referenceDefaultLabel');
          const resolvedLabel =
            typeof legacyRef.label === 'string' && legacyRef.label.trim()
              ? legacyRef.label.trim().slice(0, 40)
              : fallbackLabel && fallbackLabel !== 'builder2.presentation.referenceDefaultLabel'
                ? fallbackLabel
                : 'Reference';
          displaySpec.references = [
            {
              seriesIndex: 0,
              unit: effectiveSeriesUnit(querySpec.series[0], catalog),
              value: legacyRef.value,
              label: resolvedLabel,
            },
          ];
        }
        if (displaySpec.options) {
          delete displaySpec.options['referenceLine'];
          if (Object.keys(displaySpec.options).length === 0) {
            delete displaySpec.options;
          }
        }
      }

      const loadedDraft: BuilderDraft = {
        source: inferSourceFromQuery(querySpec, catalog),
        name: draftName,
        description: draftDescription ?? '',
        visualizationType: draftViz,
        querySpec,
        displaySpec,
        changeSummary,
        internalNotes,
      };

      this._widgetId.set(widgetId);
      this._draftState.set(ds);
      this._draft.set(loadedDraft);
      this._savedSnapshot.set(stableDraftSnapshot(loadedDraft));
      this._visited.set(new Set<StepId>(STEP_ORDER));
      if (!opts?.keepStep) this.step.set('data');
      this.lastAutoPreviewSignature = this.autoPreviewSignature();

      if (loadedDraft.querySpec.series.length > 0) {
        this.refreshPreview();
      } else {
        this._preview.set(EMPTY_VIEW);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const failure = widgetReadFailure(error, this.transloco, 'builder');
      this._readFailure.set(failure);
      this._loadError.set(failure.kind);
    } finally {
      if (seq === this.loadSeq) {
        this._loading.set(false);
      }
    }
  }

  async reload(opts?: { keepStep?: boolean }): Promise<void> {
    await this.load(this._widgetId(), opts);
  }

  /**
   * Re-reads the server revisions (widget, governance, active version) without touching the
   * unsaved edits. Share, transfer and archive bump these, and a stale value causes a false 409.
   */
  async refreshRevisions(): Promise<void> {
    const id = this._widgetId();
    if (!id) return;
    try {
      const detail = await getWidget(id);
      if (this._widgetId() !== id) return;
      this._widget.set(detail);
      if (!this.canSave()) return;
      const latest = await getDraft(id);
      if (this._widgetId() !== id) return;
      this._draftState.set(latest);
    } catch {
      // Keep the previous revisions; a stale one is reported by the next save as a normal 409.
    }
  }

  goToStep(id: StepId): void {
    this._visited.update((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    this.step.set(id);
  }

  patch(p: Partial<BuilderDraft>): void {
    this._draft.update((prev) => ({ ...prev, ...p }));
    this.revalidateTouched();
  }

  patchQuery(p: Partial<QuerySpec>): void {
    const cat = this._catalog();
    this._draft.update((prev) => {
      const nextQuerySpec: QuerySpec = { ...prev.querySpec, ...p };
      if (nextQuerySpec.filterTree) {
        if (!filterTreeSupported(filterTreeMetricKeys(nextQuerySpec.series))) {
          delete nextQuerySpec.filterTree;
        }
      }

      let nextDisplaySpec = prev.displaySpec;
      if (p.series !== undefined && prev.displaySpec.references?.length) {
        // Follow each series to its new position (a removed series drops its reference, later ones shift down).
        const prevSeries = prev.querySpec.series;
        const nextSeries = nextQuerySpec.series;
        const sameLength = prevSeries.length === nextSeries.length;
        const syncedRefs = prev.displaySpec.references
          .map((r) => {
            const moved = nextSeries.indexOf(prevSeries[r.seriesIndex]);
            // Same length and not found = the series was edited in place: it keeps its position.
            const seriesIndex = moved >= 0 ? moved : sameLength ? r.seriesIndex : -1;
            return { ...r, seriesIndex };
          })
          .filter((r) => r.seriesIndex >= 0 && r.seriesIndex < nextSeries.length)
          .map((r) => ({
            ...r,
            unit: effectiveSeriesUnit(nextSeries[r.seriesIndex], cat),
          }));
        nextDisplaySpec =
          syncedRefs.length > 0
            ? { ...prev.displaySpec, references: syncedRefs }
            : (() => {
                const { references: _drop, ...rest } = prev.displaySpec;
                return rest;
              })();
      }

      return {
        ...prev,
        querySpec: nextQuerySpec,
        displaySpec: nextDisplaySpec,
      };
    });
    this.revalidateTouched();
  }

  patchDisplay(p: Partial<DisplaySpec>): void {
    this._draft.update((prev) => ({
      ...prev,
      displaySpec: { ...prev.displaySpec, ...p },
    }));
    this.revalidateTouched();
  }

  validateStep(id: StepId): boolean {
    const issues = validateStepWithZod(id, this._draft(), this._catalog());
    const map: Record<string, string> = {};
    for (const iss of issues) {
      map[iss.path] = this.translateIssue(iss);
    }

    this._errors.update((prev) => {
      const next = { ...prev };
      if (Object.keys(map).length > 0) {
        next[id] = map;
      } else {
        delete next[id];
      }
      return next;
    });

    return issues.length === 0;
  }

  validateAll(): { step: StepId; field: string } | null {
    const allErrors: Partial<Record<StepId, Record<string, string>>> = {};
    let firstFailure: { step: StepId; field: string } | null = null;

    for (const stepId of STEP_ORDER) {
      const issues = validateStepWithZod(stepId, this._draft(), this._catalog());
      if (issues.length > 0) {
        const map: Record<string, string> = {};
        for (const iss of issues) {
          map[iss.path] = this.translateIssue(iss);
        }
        allErrors[stepId] = map;
        if (!firstFailure) {
          firstFailure = { step: stepId, field: issues[0].path };
        }
      }
    }

    this._errors.set(allErrors);
    return firstFailure;
  }

  validateUpTo(targetStep: StepId): { step: StepId; field: string } | null {
    const endIdx = STEP_ORDER.indexOf(targetStep);
    let firstFailure: { step: StepId; field: string } | null = null;

    for (let i = 0; i <= endIdx; i++) {
      const stepId = STEP_ORDER[i];
      const ok = this.validateStep(stepId);
      if (!ok && !firstFailure) {
        const stepErrors = this._errors()[stepId];
        const firstField = stepErrors ? Object.keys(stepErrors)[0] ?? '' : '';
        firstFailure = { step: stepId, field: firstField };
      }
    }
    return firstFailure;
  }

  setServerErrors(code: string, details?: Record<string, string[]>): void {
    const msg = widgetErrorMessage(new ApiError(422, code, details), this.transloco, 'builder');
    const nextErrors: Partial<Record<StepId, Record<string, string>>> = {};
    let primaryStep: StepId | null = null;
    this._formError.set(null);

    // Business 422s send parallel `path`/`code` arrays; DTO 400s send `{ field: [reason] }`.
    const issuePaths = detailIssues(details).map((issue) => issue.path).filter((path) => path.length > 0);
    const fieldKeys = issuePaths.length > 0 ? issuePaths : Object.keys(details ?? {})
      .filter((key) => !['_', 'path', 'code', 'max', 'limit'].includes(key));
    if (fieldKeys.length > 0) {
      for (const rawKey of fieldKeys) {
        const mapped = mapDetailFieldToStep(rawKey);
        if (!primaryStep) primaryStep = mapped.step;
        nextErrors[mapped.step] = {
          ...(nextErrors[mapped.step] ?? {}),
          [mapped.field]: msg,
        };
      }
    } else {
      const mapped = mapCodeToTarget(code);
      if (mapped) {
        primaryStep = mapped.step;
        nextErrors[mapped.step] = { [mapped.field]: msg };
      } else {
        this.notify.error(msg);
      }
    }

    this._lastServerErrorStep.set(primaryStep);
    this._errors.update((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(nextErrors).map(([k, v]) => [
          k,
          { ...(prev[k as StepId] ?? {}), ...v },
        ]),
      ),
    }));
  }

  refreshPreview(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.invalidatePreviewRequest();

    const current = this._draft();
    const cat = this._catalog();
    if (current.querySpec.series.length === 0) {
      this._previewFailure.set(null);
      this._preview.set(EMPTY_VIEW);
      return;
    }

    const seq = this.previewSeq;
    this._previewFailure.set(null);
    this._preview.set(LOADING_VIEW);

    const viz = defaultVisualizationForDraft(current, cat);
    const firstKey = current.querySpec.series[0]?.metricKey;
    const firstMetric = firstKey ? cat?.metrics.find((m) => m.key === firstKey) : undefined;
    const fallbackName =
      current.name.trim() ||
      (firstMetric
        ? this.language() === 'ar'
          ? firstMetric.labelAr
          : firstMetric.labelEn
        : '') ||
      this.transloco.translate('builder.preview.untitled');

    const querySpecCopy = structuredClone(current.querySpec);
    const displaySpecCopy = structuredClone(current.displaySpec);

    void previewWidget({
      name: fallbackName,
      visualizationType: viz,
      querySpec: querySpecCopy,
      displaySpec: displaySpecCopy,
      filters: querySpecCopy.filters,
      refresh: true,
    })
      .then((exec) => {
        if (seq !== this.previewSeq) return;
        this._preview.set(viewFromRun(exec, exec.panels?.[0]));
      })
      .catch((error: unknown) => {
        if (seq !== this.previewSeq) return;

        const code = errorCodeOf(error);
        if (
          error instanceof ApiError &&
          (error.status === 422 || isValidationError(error))
        ) {
          this.applyValidationError(error);
        }
        const busy = isConcurrencyError(error);
        if (!(error instanceof ApiError) || ![400, 422].includes(error.status)) {
          this._previewFailure.set(widgetReadFailure(error, this.transloco, 'builder'));
        }
        this._preview.set({
          // Heavy reads are retried only by the user's next change or Refresh.
          status: busy ? 'ERROR' : 'UNAVAILABLE',
          execution: null,
          reasonCode: busy ? RUN_CONCURRENCY_CODE : (code ?? 'METRIC_EXECUTION_FAILED'),
          sourceKey: null,
          coverage: null,
          receiptId: null,
          computedAt: null,
          experimental: false,
        });
      });
  }

  async saveDraft(): Promise<boolean> {
    if (this._saving() || !this.canSave()) return false;
    this._saving.set(true);

    try {
      const id = this._widgetId();
      const body = this.buildWidgetBody();
      const sentSnapshot = stableDraftSnapshot(this._draft());

      if (!id) {
        const bodyJson = JSON.stringify(body);
        if (this.createAction?.bodyJson !== bodyJson) this.createAction = { bodyJson, key: newIdempotencyKey() };
        const created = await createWidget(body, this.createAction.key);
        this.createAction = null;
        this.applySavedState(created, sentSnapshot);
        this.notify.success(this.transloco.translate('builder.toasts.draftSaved'));
        this.onCreatedCallback?.(created.widgetId);
        return true;
      }

      const currentDs = this._draftState();
      if (!currentDs) return false;
      const expectedWidgetRevision = currentDs.widgetRevision;
      const expectedDraftId = currentDs?.draft?.draftId ?? null;
      const expectedDraftRevision = currentDs?.draft?.revision ?? 0;

      try {
        const saved = await saveWidgetDraft(id, {
          ...body,
          expectedWidgetRevision,
          expectedDraftId,
          expectedDraftRevision,
        });
        this.applySavedState(saved, sentSnapshot);
        this.notify.success(this.transloco.translate('builder.toasts.draftSaved'));
        return true;
      } catch (error) {
        if (widgetConflict(error)) {
          return await this.handleDraftConflict(id);
        }
        throw error;
      }
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.createAction = null;
      if (widgetWriteReadOnly(error)) this.lockReadOnly();
      if (widgetNeedsReload(error)) this._reloadRequired.set(true);
      if (error instanceof ApiError && (error.status === 422 || isValidationError(error))) {
        this.applyValidationError(error);
        return false;
      }
      this.notify.error(widgetErrorMessage(error, this.transloco, 'builder', true));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private async handleDraftConflict(id: string): Promise<boolean> {
    const choice: ConflictChoice = this.conflictResolver ? await this.conflictResolver() : 'reload';
    if (choice === 'reload') {
      await this.load(id, { keepStep: true });
      if (!this.loadError()) this.notify.info(this.transloco.translate('builder.toasts.conflictReloaded'));
      return false;
    }

    if (choice === 'keep') {
      // Keep the local edits and adopt the latest revisions. Nothing is written here: the user
      // saves again on purpose, which is the only way the other draft gets overwritten.
      try {
        const latest = await getDraft(id);
        if (this._widgetId() === id) this._draftState.set(latest);
        this.notify.info(this.transloco.translate('builder.toasts.conflictKept'));
      } catch (error) {
        this.notify.error(this.translateServerError(errorCodeOf(error)));
      }
    }
    return false;
  }

  private buildWidgetBody(): WidgetBody {
    const current = this._draft();
    const saved = JSON.parse(this._savedSnapshot()) as BuilderDraft;
    const cat = this._catalog();
    const firstKey = current.querySpec.series[0]?.metricKey;
    const firstMetric = firstKey ? cat?.metrics.find((m) => m.key === firstKey) : undefined;
    const metricLabel = firstMetric
      ? this.language() === 'ar'
        ? firstMetric.labelAr
        : firstMetric.labelEn
      : '';
    const resolvedName =
      current.name.trim() ||
      metricLabel ||
      this.transloco.translate('builder.preview.untitled');
    const resolvedViz = defaultVisualizationForDraft(current, cat);

    return {
      name: resolvedName,
      visualizationType: resolvedViz,
      querySpec: structuredClone(current.querySpec),
      displaySpec: {
        ...structuredClone(current.displaySpec),
        title: resolvedName,
      },
      // Published detail omits notes. Omission keeps server values; only an edited field may clear them.
      ...(current.description !== saved.description ? { description: current.description.trim() || null } : {}),
      ...(current.changeSummary !== saved.changeSummary ? { changeSummary: current.changeSummary?.trim() || null } : {}),
      ...(current.internalNotes !== saved.internalNotes ? { internalNotes: current.internalNotes?.trim() || null } : {}),
    };
  }

  private applySavedState(saved: DraftState, sentSnapshot: string): void {
    this._widgetId.set(saved.widgetId);
    this._draftState.set(saved);
    // The form keeps exactly what the user entered, including edits typed while the request was
    // running. The name, title and chart type that Save falls back to are not written back into
    // it, so they stay open for the user to choose.
    this._savedSnapshot.set(sentSnapshot);
    if (!this._widget()) void this.refreshWidgetUsage();
  }

  lockReadOnly(): void {
    this._writeReadOnly.set(true);
  }

  applyValidationError(error: ApiError): void {
    this.setServerErrors(error.code, isValidationError(error) ? fieldErrorsOf(error)
      : error.details as Record<string, string[]> | undefined);
    const step = this._lastServerErrorStep();
    if (step) this.goToStep(step);
  }

  private async refreshWidgetUsage(): Promise<void> {
    const id = this._widgetId();
    if (!id) return;
    try {
      const detail = await getWidget(id);
      if (id === this._widgetId()) this._widget.set(detail);
    } catch (error) {
      this.notify.error(widgetErrorMessage(error, this.transloco, 'builder'));
    }
  }

  private revalidateTouched(): void {
    const existingErrors = this._errors();
    if (Object.keys(existingErrors).length === 0) return;
    for (const stepId of Object.keys(existingErrors) as StepId[]) {
      this.validateStep(stepId);
    }
  }

  private translateIssue(iss: ValidationIssue): string {
    return this.transloco.translate(`builder.errors.${iss.code}`, iss.params);
  }

  private translateServerError(code: string | null): string {
    return this.transloco.translate(errorKey(code));
  }

  private invalidatePreviewRequest(): void {
    this.previewSeq++;
  }
}
