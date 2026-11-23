import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Injector, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerBan,
  tablerCloudOff,
  tablerDownload,
  tablerFileSearch,
  tablerRefresh,
  tablerTrash,
  tablerUpload,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { StatCard } from '../../../../shared/ui/stat-card/stat-card';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { pollWhile } from '../automation-shared/poll';
import { cancelRun, execute, getMapping, getRun, releaseSource, resultsCsvUrl } from '../imports.api';
import type { ImportRun, RowResult } from '../imports.model';
import { RUN_ACTIVE } from '../imports.registry';
import {
  IMPORT_PERMISSIONS,
  hasImportReadGrant,
  hasImportScopeGrant,
  importContext,
  isForbiddenError,
  isIdempotencyMismatch,
} from '../mapping-rows/import-access';
import {
  formatDateTime,
  formatInt,
  translateImportError,
  translateWorkerError,
} from '../mapping-rows/mapping-rows';
import { RunResultsTable } from '../run-results-table/run-results-table';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED']);
type ResultFilter = 'ALL' | RowResult['status'];

function activeRunStatuses(): readonly string[] {
  return Array.isArray(RUN_ACTIVE) && RUN_ACTIVE.length > 0
    ? RUN_ACTIVE
    : ['PENDING', 'PREVIEWING', 'EXECUTING'];
}

let nextImportRunPageId = 0;

@Component({
  selector: 'app-import-run-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    FullState,
    Segmented,
    StatCard,
    AutomationBadge,
    RunResultsTable,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-auto-imports', alias: 'imports' },
      { scope: 'trade-automation', alias: 'automation' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowLeft,
      tablerBan,
      tablerCloudOff,
      tablerDownload,
      tablerFileSearch,
      tablerRefresh,
      tablerTrash,
      tablerUpload,
    }),
  ],
  templateUrl: './import-run-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-10 p-12' },
})
export class ImportRunPage {
  protected readonly uid = `import-run-page-${++nextImportRunPageId}`;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly bulkJobs = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);

  private readonly cancelDialog = viewChild<ConfirmDialog>('cancelDialog');
  private readonly releaseDialog = viewChild<ConfirmDialog>('releaseDialog');

  protected readonly lang = inject(LanguageState).current;
  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasImportReadGrant(this.injector));

  readonly runId = input.required<string>();

  protected readonly resultStatus = signal<ResultFilter>('ALL');
  protected readonly resultsTick = signal(0);
  protected readonly acting = signal(false);
  protected readonly downloadingCsv = signal(false);
  protected readonly sourceReleased = signal(false);
  private readonly refreshTick = signal(0);
  private readonly liveRunOverride = signal<ImportRun | null>(null);

  private pollDisposed = false;
  private stopPollFn: (() => void) | null = null;
  private activeCsvBlobUrl: string | null = null;

  private readonly runResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return { id: this.runId(), ctx: importContext(this.scopeState), tick: this.refreshTick() };
    },
    loader: ({ params }) => getRun(params.id, params.ctx),
  });

  private readonly runForbidden = computed(
    () => this.runResource.status() === 'error' && isForbiddenError(this.runResource.error()),
  );
  protected readonly isForbidden = computed(
    () => !this.canRead() || this.forbidden() || this.runForbidden(),
  );
  protected readonly canExecute = computed(
    () =>
      !this.isForbidden() &&
      hasImportScopeGrant(this.injector, this.scopeState, IMPORT_PERMISSIONS.execute),
  );
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasImportScopeGrant(this.injector, this.scopeState, IMPORT_PERMISSIONS.manage),
  );

  protected readonly run = computed<ImportRun | null>(
    () => this.liveRunOverride() ?? (this.runResource.hasValue() ? this.runResource.value() : null),
  );

  private readonly mappingResource = resource({
    params: () => {
      const mappingId = this.run()?.mappingId;
      if (this.isForbidden() || !mappingId) return undefined;
      return { id: mappingId, ctx: importContext(this.scopeState) };
    },
    loader: async ({ params }) => {
      try {
        return await getMapping(params.id, params.ctx);
      } catch {
        return null;
      }
    },
  });

  protected readonly loading = computed(
    () => !this.isForbidden() && this.runResource.isLoading() && !this.runResource.hasValue(),
  );
  protected readonly notFound = computed(() => {
    if (this.isForbidden()) return false;
    const err = this.runResource.error();
    return err instanceof ApiError && err.status === 404;
  });
  protected readonly loadFailed = computed(
    () => !this.isForbidden() && !!this.runResource.error() && !this.notFound(),
  );

  protected readonly mappingCode = computed(() => {
    const mapping = this.mappingResource.hasValue() ? this.mappingResource.value() : null;
    return mapping?.code ?? this.run()?.mappingId ?? '';
  });

  protected readonly subtitleText = computed(() => {
    this.i18n();
    const current = this.run();
    if (!current) return '';
    return this.transloco.translate('imports.runPage.subtitle', {
      code: this.mappingCode(),
      date: formatDateTime(current.createdAt, this.lang()),
    });
  });

  protected readonly isActive = computed(() => {
    const status = this.run()?.status;
    return !!status && activeRunStatuses().includes(status);
  });

  protected readonly isExecuting = computed(() => this.run()?.status === 'EXECUTING');
  protected readonly isTerminal = computed(() => {
    const status = this.run()?.status;
    return !!status && TERMINAL_STATUSES.has(status);
  });

  protected readonly canStartImport = computed(() => {
    const current = this.run();
    if (!this.canExecute() || !current) return false;
    return current.status === 'PREVIEWED' && Number(current.invalidCount) === 0 && Number(current.validCount) > 0;
  });

  protected readonly execDoneCount = computed(() => this.run()?.progress.processed ?? 0);

  protected readonly execValidCount = computed(() => {
    const current = this.run();
    return current?.progress.total ?? Number(current?.validCount ?? '0');
  });

  protected readonly execProgressPercent = computed(() => {
    const valid = this.execValidCount();
    if (valid <= 0) return 0;
    return Math.min(100, Math.round((this.execDoneCount() / valid) * 100));
  });

  protected readonly overflowActions = computed<ActionItem[]>(() => {
    this.i18n();
    const current = this.run();
    if (!this.canManage() || !current || this.isActive() || this.sourceReleased() || !current.sourceId) {
      return [];
    }
    return [
      {
        id: 'release',
        title: this.transloco.translate('imports.runPage.releaseFile'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  protected readonly filterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const statuses: ResultFilter[] = ['ALL', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED'];
    return statuses.map((value) => ({
      value,
      label: this.transloco.translate(`imports.runPage.filters.${value}`),
    }));
  });

  protected readonly downloadFilename = computed(() => {
    const current = this.run();
    return current ? `import-run-${current.id}-results.csv` : 'results.csv';
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopPolling();
      if (this.activeCsvBlobUrl) {
        URL.revokeObjectURL(this.activeCsvBlobUrl);
        this.activeCsvBlobUrl = null;
      }
    });

    effect(() => {
      if (this.runResource.hasValue()) this.runResource.value();
      untracked(() => this.liveRunOverride.set(null));
    });

    effect(() => {
      const id = this.runId();
      const current = this.run();
      const active = !this.isForbidden() && !!current && activeRunStatuses().includes(current.status);
      untracked(() => {
        if (active && id) {
          this.startPolling(id);
        } else {
          this.stopPolling();
        }
      });
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.stopPolling();
    this.forbidden.set(true);
  }

  protected goBack(): void {
    void this.router.navigate(['/trade/automation/import-runs']);
  }

  protected retryLoad(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected onFilterChange(value: string | null): void {
    const allowed: ResultFilter[] = ['ALL', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED'];
    const next = allowed.includes(value as ResultFilter) ? (value as ResultFilter) : 'ALL';
    this.resultStatus.set(next);
  }

  protected async downloadResults(): Promise<void> {
    const current = this.run();
    if (!current || this.downloadingCsv()) return;
    this.downloadingCsv.set(true);
    try {
      const filter = this.resultStatus();
      const url = await resultsCsvUrl(
        current.id,
        filter === 'ALL' ? null : filter,
        importContext(this.scopeState),
      );
      if (this.activeCsvBlobUrl) {
        URL.revokeObjectURL(this.activeCsvBlobUrl);
      }
      this.activeCsvBlobUrl = url;
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = this.downloadFilename();
      anchor.style.display = 'none';
      this.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.downloadingCsv.set(false);
    }
  }

  protected async startImport(): Promise<void> {
    const current = this.run();
    if (!current || !this.canStartImport() || this.acting()) return;
    this.acting.set(true);
    const action = `execute:${current.id}`;
    try {
      const res: unknown = await execute(
        current.id,
        current.version,
        this.keys.for(action, { ifMatch: current.version }),
        importContext(this.scopeState),
      );
      this.keys.done(action);
      if (res && typeof res === 'object' && 'jobId' in res) {
        void this.bulkJobs.loadRecent();
      }
      this.notify.success(this.transloco.translate('imports.runPage.startedToast'));
      this.refreshTick.update((n) => n + 1);
      this.resultsTick.update((n) => n + 1);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(action);
        this.onForbidden();
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.acting.set(false);
    }
  }

  protected runAgain(): void {
    const current = this.run();
    if (!current || !this.canExecute()) return;
    void this.router.navigate(['/trade/automation/import-runs'], {
      queryParams: {
        new: '1',
        mapping: current.mappingId,
        predecessor: current.id,
      },
    });
  }

  protected async promptCancel(): Promise<void> {
    const current = this.run();
    if (!current || !this.canExecute() || !this.isActive() || this.acting()) return;
    const confirmed = await this.cancelDialog()?.open();
    if (!confirmed) return;

    this.acting.set(true);
    const action = `cancel:${current.id}`;
    try {
      await cancelRun(
        current.id,
        current.version,
        this.keys.for(action, { ifMatch: current.version }),
        importContext(this.scopeState),
      );
      this.keys.done(action);
      this.notify.success(this.transloco.translate('imports.runPage.cancelledToast'));
      this.refreshTick.update((n) => n + 1);
      this.resultsTick.update((n) => n + 1);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(action);
        this.onForbidden();
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.acting.set(false);
    }
  }

  protected async onOverflowAction(selection: ActionSelection): Promise<void> {
    if (selection.id !== 'release') return;
    const current = this.run();
    if (!current || !this.canManage() || this.isActive() || !current.sourceId || this.acting()) return;
    const confirmed = await this.releaseDialog()?.open();
    if (!confirmed) return;

    this.acting.set(true);
    const action = `release:${current.sourceId}`;
    try {
      await releaseSource(
        current.sourceId,
        this.keys.for(action, {}),
        importContext(this.scopeState),
      );
      this.keys.done(action);
      this.sourceReleased.set(true);
      this.notify.success(this.transloco.translate('imports.runPage.releasedToast'));
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(action);
        this.onForbidden();
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.acting.set(false);
    }
  }

  protected formatCount(value: string | number | null | undefined): string {
    return formatInt(value);
  }

  protected failurePhaseLabel(): string {
    const phase = this.run()?.failure?.phase;
    const key =
      phase === 'PREVIEW' || phase === 'EXECUTE'
        ? `imports.runPage.failurePhase.${phase}`
        : 'imports.runPage.failurePhase.DEFAULT';
    return this.transloco.translate(key);
  }

  protected failureMessage(): string {
    return translateWorkerError(this.transloco, this.run()?.failure?.code);
  }

  private startPolling(runId: string): void {
    this.stopPolling();
    this.pollDisposed = false;
    const ctx = importContext(this.scopeState);
    const handle = pollWhile(
      async () => {
        const fresh = await getRun(runId, ctx);
        if (this.pollDisposed || this.runId() !== runId) return fresh;
        const prev = this.run();
        this.liveRunOverride.set(fresh);
        if (
          !prev ||
          prev.status !== fresh.status ||
          prev.succeededCount !== fresh.succeededCount ||
          prev.failedCount !== fresh.failedCount ||
          prev.validCount !== fresh.validCount ||
          prev.invalidCount !== fresh.invalidCount
        ) {
          this.resultsTick.update((n) => n + 1);
        }
        if (prev && activeRunStatuses().includes(prev.status) && !activeRunStatuses().includes(fresh.status)) {
          this.notifyRunFinished(fresh);
        }
        return fresh;
      },
      (fresh) => !this.pollDisposed && this.runId() === runId && activeRunStatuses().includes(fresh.status),
      3000,
      this.destroyRef,
      undefined,
      (err) => {
        if (isForbiddenError(err)) {
          this.onForbidden();
        }
      },
    );
    this.stopPollFn = () => handle.stop();
  }

  private notifyRunFinished(run: ImportRun): void {
    const name = run.fileName || run.id;
    const openLabel = this.translateOrFallback('automation.watch.openReport', 'Open report');
    switch (run.status) {
      case 'PREVIEWED': {
        const invalid = Number(run.invalidCount);
        const valid = Number(run.validCount);
        if (invalid > 0) {
          this.notify.warning(
            this.translateOrFallback('automation.watch.previewErrorsTitle', 'Check finished with errors'),
            this.translateOrFallback(
              'automation.watch.previewErrorsText',
              `${name}: ${valid} valid, ${invalid} invalid. ${openLabel}.`,
              { name, valid, invalid, action: openLabel },
            ),
          );
        } else {
          this.notify.success(
            this.translateOrFallback('automation.watch.previewReadyTitle', 'File check finished'),
            this.translateOrFallback(
              'automation.watch.previewReadyText',
              `${name}: ${valid} rows ready to import. ${openLabel}.`,
              { name, valid, action: openLabel },
            ),
          );
        }
        return;
      }
      case 'COMPLETED': {
        const count = Number(run.succeededCount);
        this.notify.success(
          this.translateOrFallback('automation.watch.finishedTitle', 'Import finished'),
          this.translateOrFallback(
            'automation.watch.finishedText',
            `${name}: ${count} rows imported. ${openLabel}.`,
            { name, count, action: openLabel },
          ),
        );
        return;
      }
      case 'COMPLETED_WITH_ERRORS': {
        const succeeded = Number(run.succeededCount);
        const failed = Number(run.failedCount);
        this.notify.warning(
          this.translateOrFallback('automation.watch.finishedWithErrorsTitle', 'Import finished with errors'),
          this.translateOrFallback(
            'automation.watch.finishedWithErrorsText',
            `${name}: ${succeeded} imported, ${failed} failed. ${openLabel}.`,
            { name, succeeded, failed, action: openLabel },
          ),
        );
        return;
      }
      case 'FAILED': {
        this.notify.error(
          this.translateOrFallback('automation.watch.failedTitle', 'Import failed'),
          this.translateOrFallback(
            'automation.watch.failedText',
            `${name} could not be processed. ${openLabel}.`,
            { name, action: openLabel },
          ),
        );
        return;
      }
      case 'CANCELLED': {
        this.notify.info(
          this.translateOrFallback('automation.watch.cancelledTitle', 'Import cancelled'),
          this.translateOrFallback(
            'automation.watch.cancelledText',
            `${name} was cancelled. ${openLabel}.`,
            { name, action: openLabel },
          ),
        );
        return;
      }
      default:
        return;
    }
  }

  private translateOrFallback(key: string, fallback: string, params?: Record<string, unknown>): string {
    const translated = this.transloco.translate(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  private stopPolling(): void {
    this.pollDisposed = true;
    this.stopPollFn?.();
    this.stopPollFn = null;
  }
}
