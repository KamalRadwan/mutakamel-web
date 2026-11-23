import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { ApiError, isAbortError, queueRun } from '../../../../shared/widgets/dashboard/analytics-api';
import type { FullStateKind } from '../../../../shared/ui/full-state/full-state';
import { reportErrorMessage, reportLoadKind } from './report-errors';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { fieldErrorsOf } from '../../../../core/api/api-errors';
import { getManifest, runReport } from './report.api';
import type { Panel, PanelManifest, ReportRunRequest } from './report.model';

export type ReportPageError = FullStateKind;

function initialRequestFromManifest(manifest: PanelManifest): ReportRunRequest {
  const filters: Record<string, unknown> = {};
  for (const item of manifest.filters.applied) {
    if (item.key === 'period' || item.key === 'comparison') continue;
    filters[item.key] = item.value;
  }

  const comparisonKind = manifest.period.comparison?.kind;
  const compare: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' =
    comparisonKind === 'PREVIOUS_PERIOD' || comparisonKind === 'PREVIOUS_YEAR'
      ? comparisonKind
      : 'NONE';

  return {
    period: manifest.period.kind === 'CUSTOM'
      ? { preset: 'CUSTOM', from: manifest.period.from.slice(0, 10), to: manifest.period.to.slice(0, 10) }
      : { preset: manifest.period.kind },
    includeFilterSchema: true,
    comparison: { kind: compare },
    filters,
    scope: {
      basis: manifest.scope.basis,
      ...(manifest.scope.basis === 'AS_OF' ? { asOf: manifest.scope.asOf } : {}),
      ownerMode: manifest.scope.ownerMode,
      ...(manifest.scope.branchIds !== 'ALL' ? { branchIds: [...manifest.scope.branchIds] } : {}),
    },
  };
}

/** A run returns `filters.schema` empty unless asked; the report's filter schema comes from the manifest GET. */
function withSchemaOf(next: PanelManifest, previous: PanelManifest): PanelManifest {
  if (next.filters.schema.length > 0) return next;
  return { ...next, filters: { ...next.filters, schema: previous.filters.schema } };
}

function mergeRequest(current: ReportRunRequest, patch?: Partial<ReportRunRequest>): ReportRunRequest {
  if (!patch) return { ...current };

  const nextFilters = { ...(current.filters ?? {}) };
  if (patch.filters) {
    for (const [k, v] of Object.entries(patch.filters)) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
        delete nextFilters[k];
      } else {
        nextFilters[k] = v;
      }
    }
  }

  const nextScope = patch.scope ? { ...(current.scope ?? {}), ...patch.scope } : current.scope;
  if (nextScope?.branchIds && nextScope.branchIds.length === 0) {
    delete nextScope.branchIds;
  }

  return {
    ...current,
    ...patch,
    filters: nextFilters,
    ...(nextScope ? { scope: nextScope } : {}),
  };
}

@Injectable()
export class ReportState {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  private readonly reportKeyState = signal('');
  private readonly manifestState = signal<PanelManifest | null>(null);
  private readonly requestState = signal<ReportRunRequest>({});
  private readonly loadingState = signal(false);
  private readonly loadingPanelsState = signal<ReadonlySet<string>>(new Set());
  private readonly errorState = signal<ReportPageError | null>(null);
  readonly errorMessage = signal('');
  readonly errorCode = signal('');
  readonly fieldErrors = signal<Record<string, string[]>>({});

  private loadSeq = 0;
  private runSeq = 0;
  /** Aborted by a newer load or on destroy: the initial run stops waiting in the queue. */
  private loadAbort = new AbortController();
  /** Aborted by a newer run, a newer load or on destroy: pending runs stop at once. */
  private runAbort = new AbortController();

  readonly reportKey = this.reportKeyState.asReadonly();
  readonly manifest = this.manifestState.asReadonly();
  readonly request = this.requestState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadingPanels = this.loadingPanelsState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSeq++;
      this.runSeq++;
      this.loadAbort.abort();
      this.runAbort.abort();
    });
  }

  /** Shared concurrency queue; a refused run is retried only by the user. */
  private queuedRun(key: string, req: ReportRunRequest, signal: AbortSignal): Promise<PanelManifest> {
    return queueRun(() => runReport(key, req, signal), signal);
  }

  readonly hasPageablePanels = computed(() =>
    Boolean(this.manifestState()?.panels.some((p) => Boolean(p.pageable))),
  );

  readonly pinnablePanels = computed<Panel[]>(() =>
    (this.manifestState()?.panels ?? []).filter((p) => Boolean(p.pinnable)),
  );

  async load(key: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.runSeq++;
    this.loadAbort.abort();
    this.runAbort.abort();
    this.loadAbort = new AbortController();
    this.runAbort = new AbortController();
    const loadSignal = this.loadAbort.signal;

    this.reportKeyState.set(key);
    this.manifestState.set(null);
    this.requestState.set({});
    this.errorState.set(null);
    this.errorMessage.set('');
    this.errorCode.set('');
    this.fieldErrors.set({});
    this.loadingState.set(true);
    this.loadingPanelsState.set(new Set());

    if (!can('crm.dashboards.read')) {
      this.errorState.set(this.classifyError(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED')));
      this.loadingState.set(false);
      return;
    }

    let initialManifest: PanelManifest;
    try {
      initialManifest = await getManifest(key);
    } catch (err) {
      if (seq !== this.loadSeq) return;
      this.loadingState.set(false);
      this.errorState.set(this.classifyError(err));
      return;
    }

    if (seq !== this.loadSeq) return;
    const initialReq = initialRequestFromManifest(initialManifest);
    this.manifestState.set(initialManifest);
    this.requestState.set(initialReq);
    this.loadingState.set(false);

    const panelKeys = new Set(initialManifest.panels.map((p) => p.panelKey));
    const runSnapshot = this.runSeq;
    this.loadingPanelsState.set(panelKeys);

    try {
      const freshManifest = await this.queuedRun(key, initialReq, loadSignal);
      if (seq !== this.loadSeq || runSnapshot !== this.runSeq) return;
      this.manifestState.set(withSchemaOf(freshManifest, initialManifest));
    } catch (err) {
      if (isAbortError(err) || seq !== this.loadSeq || runSnapshot !== this.runSeq) return;
      this.errorState.set(this.classifyError(err));
    } finally {
      if (seq === this.loadSeq && runSnapshot === this.runSeq) {
        this.loadingPanelsState.set(new Set());
      }
    }
  }

  async run(patch?: Partial<ReportRunRequest>): Promise<void> {
    const key = this.reportKeyState();
    const currentManifest = this.manifestState();
    if (!key || !currentManifest) return;
    this.fieldErrors.set({});

    const retryKeys = patch?.panelKeys;
    if (retryKeys && retryKeys.length > 0) {
      await this.retryPanels(key, retryKeys);
      return;
    }

    const seq = ++this.runSeq;
    this.loadAbort.abort();
    const loadSnapshot = this.loadSeq;
    this.runAbort.abort();
    this.runAbort = new AbortController();
    const runSignal = this.runAbort.signal;
    const nextReq = mergeRequest(this.requestState(), patch);
    this.loadingState.set(true);
    this.loadingPanelsState.set(new Set(currentManifest.panels.map((p) => p.panelKey)));

    try {
      const isCurrent = () => seq === this.runSeq && loadSnapshot === this.loadSeq;
      const nextManifest = await this.queuedRun(key, nextReq, runSignal);
      if (!isCurrent()) return;
      // The request is committed only after the run succeeded, so filters and panels never disagree.
      this.requestState.set(nextReq);
      this.manifestState.set(withSchemaOf(nextManifest, currentManifest));
    } catch (err) {
      if (isAbortError(err) || seq !== this.runSeq || loadSnapshot !== this.loadSeq) return;
      this.fieldErrors.set(fieldErrorsOf(err));
      if (reportLoadKind(err) !== 'load-failure' || (err instanceof ApiError && (err.status === 0 || err.status >= 500))) {
        this.errorState.set(this.classifyError(err));
      } else if (Object.keys(this.fieldErrors()).length === 0) {
        this.notifyError(err);
      }
    } finally {
      if (seq === this.runSeq && loadSnapshot === this.loadSeq) {
        this.loadingState.set(false);
        this.loadingPanelsState.set(new Set());
      }
    }
  }

  private async retryPanels(key: string, panelKeys: string[]): Promise<void> {
    const loadSnapshot = this.loadSeq;
    const runSnapshot = this.runSeq;
    const keySet = new Set(panelKeys);
    this.loadingPanelsState.update((prev) => {
      const next = new Set(prev);
      for (const k of keySet) next.add(k);
      return next;
    });

    try {
      const isCurrent = () => loadSnapshot === this.loadSeq && runSnapshot === this.runSeq;
      const partialManifest = await this.queuedRun(
        key,
        { ...this.requestState(), panelKeys, refresh: true },
        this.runAbort.signal,
      );
      if (!isCurrent()) return;

      const updatedByKey = new Map(partialManifest.panels.map((p) => [p.panelKey, p]));
      this.manifestState.update((curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          panels: curr.panels.map((p) => updatedByKey.get(p.panelKey) ?? p),
          receipts: {
            runId: partialManifest.receipts.runId,
            receiptIds: [...new Set([...curr.receipts.receiptIds, ...partialManifest.receipts.receiptIds])],
          },
          freshness: partialManifest.freshness,
        };
      });
    } catch (err) {
      if (isAbortError(err) || loadSnapshot !== this.loadSeq || runSnapshot !== this.runSeq) return;
      this.notifyError(err);
    } finally {
      if (loadSnapshot === this.loadSeq && runSnapshot === this.runSeq) {
        this.loadingPanelsState.update((prev) => {
          const next = new Set(prev);
          for (const k of keySet) next.delete(k);
          return next;
        });
      }
    }
  }

  /** Uses the error's details where its code has them (date range: "up to N days"). */
  private notifyError(err: unknown): void {
    this.notify.error(reportErrorMessage(this.transloco, err, 'repReport'));
  }

  private classifyError(err: unknown): ReportPageError {
    this.errorMessage.set(reportErrorMessage(this.transloco, err, 'repReport'));
    this.errorCode.set(err instanceof ApiError ? err.code : '');
    return reportLoadKind(err);
  }
}
