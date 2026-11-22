import { DestroyRef, Injectable, computed, effect, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import type {
  Catalog,
  DisplaySpec,
  QuerySpec,
  Visualization,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { getCatalog } from '../../../../../shared/widgets/dashboard/analytics.api';
import {
  ApiError,
  errorCodeOf,
  isConcurrencyError,
  newIdempotencyKey,
  queueRun,
  retryWhenBusy,
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
  previewWidget,
  saveDraft as saveWidgetDraft,
} from '../widgets.api';
import type { DraftState, WidgetBody } from '../widgets.model';
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
import { filterTreeMetricKeys, filterTreeSupported } from './filter-tree';

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
  if (path === 'source') return { step: 'data', field: 'source' };
  const calcMatch = path.match(/^(series\.\d+\.calculation)(?:\..*)?$/);
  if (calcMatch) {
    return { step: 'metrics', field: calcMatch[1] };
  }
  if (
    path === 'series' ||
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

/** Returns null for a code with no known field, so the caller shows it as a form-level banner. */
function mapCodeToTarget(code: string): { step: StepId; field: string } | null {
  switch (code) {
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
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly destroyRef = inject(DestroyRef);

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
  private readonly _loadError = signal<'not-found' | 'forbidden' | 'load-failure' | null>(null);
  private readonly _visited = signal<ReadonlySet<StepId>>(new Set<StepId>(['data']));
  private readonly _lastServerErrorStep = signal<StepId | null>(null);
  private readonly _formError = signal<string | null>(null);

  private previewController: AbortController | null = null;
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
  readonly loadError: Signal<'not-found' | 'forbidden' | 'load-failure' | null> =
    this._loadError.asReadonly();
  readonly visited: Signal<ReadonlySet<StepId>> = this._visited.asReadonly();
  /** Message for a server error with no known field; shown as a banner above the form. */
  readonly formError: Signal<string | null> = this._formError.asReadonly();
  readonly lastServerErrorStep: Signal<StepId | null> = this._lastServerErrorStep.asReadonly();

  readonly isEditing: Signal<boolean> = computed(() => this._widgetId() !== null);

  readonly dirty: Signal<boolean> = computed(
    () => stableDraftSnapshot(this._draft()) !== this._savedSnapshot(),
  );

  readonly publishReady: Signal<boolean> = computed(() => {
    const id = this._widgetId();
    const state = this._draftState();
    const cat = this._catalog();
    const current = this._draft();
    if (!id || !state?.draft || this.dirty() || !can('crm.widgets.publish')) {
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
        if (this.previewTimer) {
          clearTimeout(this.previewTimer);
          this.previewTimer = null;
        }
        if (this._draft().querySpec.series.length === 0) {
          this.abortPreviewRequest();
          this._preview.set(EMPTY_VIEW);
          this.lastAutoPreviewSignature = '';
        }
        return;
      }

      if (sig === this.lastAutoPreviewSignature) return;
      if (this.previewTimer) clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null;
        this.lastAutoPreviewSignature = sig;
        this.refreshPreview();
      }, 600);
    });

    this.destroyRef.onDestroy(() => {
      if (this.previewTimer) clearTimeout(this.previewTimer);
      this.abortPreviewRequest();
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
    this.abortPreviewRequest();
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }

    this._loading.set(true);
    this._loadError.set(null);
    this._errors.set({});
    this._lastServerErrorStep.set(null);
    this._formError.set(null);

    try {
      const catalog = this._catalog() ?? (await getCatalog());
      if (seq !== this.loadSeq) return;
      this._catalog.set(catalog);
      if (this._branches().length === 0 || this._pipelines().length === 0) {
        const [branches, pipelines] = await Promise.all([listGrantedBranches(), listPipelineOptions()]);
        if (seq !== this.loadSeq) return;
        this._branches.set(branches);
        this._pipelines.set(pipelines);
      }

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

      const ds = await getDraft(widgetId);
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
        const detail = await getWidget(widgetId);
        if (seq !== this.loadSeq) return;
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
      if (error instanceof ApiError) {
        if (error.status === 404) {
          this._loadError.set('not-found');
        } else if (error.status === 403) {
          this._loadError.set('forbidden');
        } else {
          this._loadError.set('load-failure');
        }
      } else {
        this._loadError.set('load-failure');
      }
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
      const latest = await getDraft(id);
      if (this._widgetId() !== id) return;
      const current = this._draftState();
      this._draftState.set({
        ...latest,
        draft: current?.draft ?? latest.draft,
      });
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
    const msg = this.translateServerError(code);
    const nextErrors: Partial<Record<StepId, Record<string, string>>> = {};
    let primaryStep: StepId | null = null;
    this._formError.set(null);

    // Business 422s send parallel `path`/`code` arrays; DTO 400s send `{ field: [reason] }`.
    const issuePaths = detailIssues(details).map((issue) => issue.path).filter((path) => path.length > 0);
    const fieldKeys = issuePaths.length > 0 ? issuePaths : Object.keys(details ?? {});
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
        this._formError.set(msg);
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
    this.abortPreviewRequest();

    const current = this._draft();
    const cat = this._catalog();
    if (current.querySpec.series.length === 0) {
      this._preview.set(EMPTY_VIEW);
      return;
    }

    const controller = new AbortController();
    this.previewController = controller;
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

    // The preview waits in the shared run queue; a 429 shows "retrying" and a newer preview aborts it.
    void retryWhenBusy(
      () =>
        queueRun(
          () =>
            previewWidget(
              {
                name: fallbackName,
                visualizationType: viz,
                querySpec: querySpecCopy,
                displaySpec: displaySpecCopy,
                filters: querySpecCopy.filters,
                refresh: true,
              },
              controller.signal,
            ),
          controller.signal,
        ),
      {
        signal: controller.signal,
        onRetry: () => {
          if (this.previewController === controller) this._preview.set({ ...LOADING_VIEW, retrying: true });
        },
      },
    )
      .then((exec) => {
        if (controller.signal.aborted || this.previewController !== controller) return;
        this._preview.set(viewFromRun(exec, exec.panels?.[0]));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || this.previewController !== controller) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        const code = errorCodeOf(error);
        if (
          error instanceof ApiError &&
          (error.status === 422 || (code && code.startsWith('CRM_WIDGET_')))
        ) {
          this.setServerErrors(
            error.code,
            error.details as Record<string, string[]> | undefined,
          );
        }
        const busy = isConcurrencyError(error);
        this._preview.set({
          // 429 after the retries ran out: the busy state ("too many reports are running", with Retry), never an
          // error or an unavailable metric. The widget body shows busy for ERROR + RUN_CONCURRENCY_CODE.
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
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const id = this._widgetId();
      const body = this.buildWidgetBody();
      const sentSnapshot = stableDraftSnapshot(this._draft());

      if (!id) {
        const created = await createWidget(body, newIdempotencyKey());
        this.applySavedState(created, sentSnapshot);
        this.notify.success(this.transloco.translate('builder.toasts.draftSaved'));
        this.onCreatedCallback?.(created.widgetId);
        return true;
      }

      const currentDs = this._draftState();
      const expectedWidgetRevision = currentDs?.widgetRevision ?? 1;
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
        const code = errorCodeOf(error);
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          (code === 'CRM_WIDGET_DRAFT_CONFLICT' ||
            code === 'CRM_WIDGET_REVISION_CONFLICT' ||
            code === 'CRM_WIDGET_DRAFT_BASE_CONFLICT')
        ) {
          return await this.handleDraftConflict(id);
        }
        throw error;
      }
    } catch (error) {
      const code = errorCodeOf(error);
      if (error instanceof ApiError && error.status === 422) {
        this.setServerErrors(
          error.code,
          error.details as Record<string, string[]> | undefined,
        );
        const errStep = this._lastServerErrorStep();
        if (errStep) this.goToStep(errStep);
        this.notify.error(this.translateServerError(error.code));
        return false;
      }
      this.notify.error(this.translateServerError(code));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private async handleDraftConflict(id: string): Promise<boolean> {
    const choice: ConflictChoice = this.conflictResolver ? await this.conflictResolver() : 'reload';
    if (choice === 'reload') {
      await this.load(id, { keepStep: true });
      this.notify.info(this.transloco.translate('builder.toasts.conflictReloaded'));
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
      description: current.description.trim() || null,
      changeSummary: current.changeSummary?.trim() || null,
      internalNotes: current.internalNotes?.trim() || null,
    };
  }

  private applySavedState(saved: DraftState, sentSnapshot: string): void {
    this._widgetId.set(saved.widgetId);
    this._draftState.set(saved);
    // The form keeps exactly what the user entered, including edits typed while the request was
    // running. The name, title and chart type that Save falls back to are not written back into
    // it, so they stay open for the user to choose.
    this._savedSnapshot.set(sentSnapshot);
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

  private abortPreviewRequest(): void {
    if (this.previewController) {
      this.previewController.abort();
      this.previewController = null;
    }
  }
}
