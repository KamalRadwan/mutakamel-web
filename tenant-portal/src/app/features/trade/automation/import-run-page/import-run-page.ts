import { Component, DestroyRef, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
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
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { StatCard } from '../../../../shared/ui/stat-card/stat-card';
import { ApiError, TRADE_API_BASE } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { pollWhile } from '../automation-shared/poll';
import { cancelRun, execute, getMapping, getRun, releaseSource } from '../imports.api';
import type { ImportRun, RowResult } from '../imports.model';
import { RUN_ACTIVE } from '../imports.registry';
import {
  formatDateTime,
  formatInt,
  translateImportError,
  translateWorkerError,
} from '../mapping-rows/mapping-rows';
import { RunResultsTable } from '../run-results-table/run-results-table';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly bulkJobs = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);

  private readonly cancelDialog = viewChild<ConfirmDialog>('cancelDialog');
  private readonly releaseDialog = viewChild<ConfirmDialog>('releaseDialog');

  protected readonly lang = inject(LanguageState).current;
  protected readonly can = CAN;

  readonly runId = input.required<string>();

  protected readonly resultStatus = signal<ResultFilter>('ALL');
  protected readonly resultsTick = signal(0);
  protected readonly acting = signal(false);
  protected readonly sourceReleased = signal(false);
  private readonly refreshTick = signal(0);
  private readonly liveRunOverride = signal<ImportRun | null>(null);

  private pollDisposed = false;
  private stopPollFn: (() => void) | null = null;

  private readonly runResource = resource({
    params: () => ({ id: this.runId(), tick: this.refreshTick() }),
    loader: ({ params }) => getRun(params.id),
  });

  protected readonly run = computed<ImportRun | null>(
    () => this.liveRunOverride() ?? (this.runResource.hasValue() ? this.runResource.value() : null),
  );

  private readonly mappingResource = resource({
    params: () => this.run()?.mappingId,
    loader: async ({ params }) => {
      if (!params) return null;
      try {
        return await getMapping(params);
      } catch {
        return null;
      }
    },
  });

  protected readonly loading = computed(() => this.runResource.isLoading() && !this.runResource.hasValue());
  protected readonly notFound = computed(() => {
    const err = this.runResource.error();
    return err instanceof ApiError && err.status === 404;
  });
  protected readonly loadFailed = computed(() => !!this.runResource.error() && !this.notFound());

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
    if (!this.can.manage || !current) return false;
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
    if (!this.can.manage || !current || this.isActive() || this.sourceReleased() || !current.sourceId) {
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

  protected readonly downloadUrl = computed(() => {
    const current = this.run();
    if (!current) return '#';
    const filter = this.resultStatus();
    const query = filter !== 'ALL' ? `?status=${encodeURIComponent(filter)}` : '';
    return `${TRADE_API_BASE}/imports/${encodeURIComponent(current.id)}/results.csv${query}`;
  });

  protected readonly downloadFilename = computed(() => {
    const current = this.run();
    return current ? `import-run-${current.id}-results.csv` : 'results.csv';
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());

    effect(() => {
      this.runResource.value();
      untracked(() => this.liveRunOverride.set(null));
    });

    effect(() => {
      const id = this.runId();
      const current = this.run();
      const active = !!current && activeRunStatuses().includes(current.status);
      untracked(() => {
        if (active && id) {
          this.startPolling(id);
        } else {
          this.stopPolling();
        }
      });
    });
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

  protected async startImport(): Promise<void> {
    const current = this.run();
    if (!current || !this.canStartImport() || this.acting()) return;
    this.acting.set(true);
    try {
      const action = `execute:${current.id}`;
      const res: unknown = await execute(current.id, current.version, this.keys.for(action, { ifMatch: current.version }));
      this.keys.done(action);
      if (res && typeof res === 'object' && 'jobId' in res) {
        void this.bulkJobs.loadRecent();
      }
      this.notify.success(this.transloco.translate('imports.runPage.startedToast'));
      this.refreshTick.update((n) => n + 1);
      this.resultsTick.update((n) => n + 1);
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.acting.set(false);
    }
  }

  protected runAgain(): void {
    const current = this.run();
    if (!current || !this.can.manage) return;
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
    if (!current || !this.isActive() || this.acting()) return;
    const confirmed = await this.cancelDialog()?.open();
    if (!confirmed) return;

    this.acting.set(true);
    try {
      const action = `cancel:${current.id}`;
      await cancelRun(current.id, current.version, this.keys.for(action, { ifMatch: current.version }));
      this.keys.done(action);
      this.notify.success(this.transloco.translate('imports.runPage.cancelledToast'));
      this.refreshTick.update((n) => n + 1);
      this.resultsTick.update((n) => n + 1);
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.acting.set(false);
    }
  }

  protected async onOverflowAction(selection: ActionSelection): Promise<void> {
    if (selection.id !== 'release') return;
    const current = this.run();
    if (!current || this.isActive() || !current.sourceId || this.acting()) return;
    const confirmed = await this.releaseDialog()?.open();
    if (!confirmed) return;

    this.acting.set(true);
    try {
      const action = `release:${current.sourceId}`;
      await releaseSource(current.sourceId, this.keys.for(action, {}));
      this.keys.done(action);
      this.sourceReleased.set(true);
      this.notify.success(this.transloco.translate('imports.runPage.releasedToast'));
    } catch (error) {
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
    const handle: unknown = pollWhile(
      async () => {
        const fresh = await getRun(runId);
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
        return fresh;
      },
      (fresh) => !this.pollDisposed && this.runId() === runId && activeRunStatuses().includes(fresh.status),
      3000,
      this.destroyRef,
    );
    if (typeof handle === 'function') {
      this.stopPollFn = handle as () => void;
    }
  }

  private stopPolling(): void {
    this.pollDisposed = true;
    this.stopPollFn?.();
    this.stopPollFn = null;
  }
}
