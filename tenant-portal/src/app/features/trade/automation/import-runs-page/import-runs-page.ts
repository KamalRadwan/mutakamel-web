import { Component, DestroyRef, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuilding,
  tablerFileSpreadsheet,
  tablerInbox,
  tablerLoader2,
  tablerRefresh,
  tablerSearch,
  tablerUpload,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ActionKeys } from '../automation-shared/action-keys';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { pollWhile } from '../automation-shared/poll';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import { ImportWizard, type WizardPreset } from '../import-wizard/import-wizard';
import { execute, getRunCounts, listMappings, listRuns } from '../imports.api';
import type { ImportMapping, ImportRun } from '../imports.model';
import { RUN_ACTIVE } from '../imports.registry';
import {
  currentScopeTarget,
  formatBytes,
  formatDateTime,
  formatInt,
  isScopeMismatchError,
  isTenantScope,
  normalizePage,
  translateImportError,
} from '../mapping-rows/mapping-rows';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES = [12, 24, 48, 96];

const IN_PROGRESS_STATUS = 'PENDING,PREVIEWING,EXECUTING';
const VALID_STEP_IDS = new Set([
  'ALL',
  IN_PROGRESS_STATUS,
  'PREVIEWED',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
]);
const TERMINAL_STATUSES = new Set(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED']);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function readCountMap(raw: unknown, ...keys: string[]): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const nested = obj['byStatus'];
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number') return val;
    if (nested && typeof nested === 'object') {
      const nVal = (nested as Record<string, unknown>)[key];
      if (typeof nVal === 'number') return nVal;
    }
  }
  return null;
}

function activeRunStatuses(): readonly string[] {
  return Array.isArray(RUN_ACTIVE) && RUN_ACTIVE.length > 0
    ? RUN_ACTIVE
    : ['PENDING', 'PREVIEWING', 'EXECUTING'];
}

@Component({
  selector: 'app-import-runs-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Pagination,
    StepFilter,
    AutomationBadge,
    ScopeChip,
    ImportWizard,
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
      tablerBuilding,
      tablerFileSpreadsheet,
      tablerInbox,
      tablerLoader2,
      tablerRefresh,
      tablerSearch,
      tablerUpload,
      tablerX,
    }),
  ],
  templateUrl: './import-runs-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ImportRunsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly bulkJobs = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);
  private readonly wizard = viewChild(ImportWizard);

  protected readonly lang = inject(LanguageState).current;
  protected readonly can = CAN;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });
  readonly mappingParam = input<string | undefined>(undefined, { alias: 'mapping' });
  readonly predecessorParam = input<string | undefined>(undefined, { alias: 'predecessor' });

  protected readonly search = signal('');
  /** The backend searches runs by file name only (`q`). */
  private readonly searchQuery = computed(() => this.search().trim());
  private readonly refreshTick = signal(0);
  private readonly liveRunsOverride = signal<ImportRun[] | null>(null);
  private readonly liveCountsOverride = signal<unknown>(null);

  private handledNewTrigger = false;
  private pollDisposed = false;
  private stopPollFn: (() => void) | null = null;

  protected readonly stepValue = computed<string>(() => {
    const raw = this.statusParam()?.toUpperCase() ?? 'ALL';
    return VALID_STEP_IDS.has(raw) ? raw : 'ALL';
  });

  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));

  protected readonly pageSize = computed(() => {
    const parsed = parsePositiveInt(this.sizeParam(), DEFAULT_PAGE_SIZE);
    return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
  });

  protected readonly scopeTarget = computed(() => currentScopeTarget(this.scopeState));
  protected readonly tenantBlockedByScope = computed(() => isTenantScope(this.scopeState));

  private readonly mappingsResource = resource({
    params: () => {
      if (this.tenantBlockedByScope()) return undefined;
      return {
        companyId: this.scopeState.company()?.id ?? '',
        branchId: this.scopeState.branch()?.id ?? '',
      };
    },
    loader: async () => {
      const res = await listMappings({ limit: 100 });
      return normalizePage<ImportMapping>(res, 1, 100).items;
    },
  });

  private readonly countsResource = resource({
    params: () => {
      if (this.tenantBlockedByScope()) return undefined;
      return {
        companyId: this.scopeState.company()?.id ?? '',
        branchId: this.scopeState.branch()?.id ?? '',
        q: this.searchQuery(),
        tick: this.refreshTick(),
      };
    },
    loader: ({ params }) => getRunCounts(params.q ? { q: params.q } : {}),
  });

  private readonly runsResource = resource({
    params: () => {
      if (this.tenantBlockedByScope()) return undefined;
      return {
        companyId: this.scopeState.company()?.id ?? '',
        branchId: this.scopeState.branch()?.id ?? '',
        status: this.stepValue(),
        q: this.searchQuery(),
        page: this.page(),
        limit: Math.min(100, this.pageSize()),
        tick: this.refreshTick(),
      };
    },
    loader: async ({ params }) => {
      const res = await listRuns({
        ...(params.status !== 'ALL' ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        page: params.page,
        limit: params.limit,
      });
      return normalizePage<ImportRun>(res, params.page, params.limit);
    },
  });

  protected readonly mappingCodeMap = computed<ReadonlyMap<string, string>>(() => {
    const items = this.mappingsResource.hasValue() ? this.mappingsResource.value() : [];
    return new Map(items.map((m) => [m.id, m.code]));
  });

  protected readonly tenantBlocked = computed(
    () =>
      this.tenantBlockedByScope() ||
      isScopeMismatchError(this.runsResource.error()) ||
      isScopeMismatchError(this.countsResource.error()),
  );

  protected readonly loading = computed(
    () => !this.tenantBlocked() && this.runsResource.isLoading() && !this.runsResource.hasValue(),
  );
  protected readonly refreshing = computed(() => this.runsResource.isLoading());
  protected readonly failed = computed(() => !this.tenantBlocked() && !!this.runsResource.error());

  protected readonly loadedRuns = computed<ImportRun[]>(
    () => this.liveRunsOverride() ?? (this.runsResource.hasValue() ? this.runsResource.value().items : []),
  );

  protected readonly total = computed(() =>
    this.runsResource.hasValue() ? this.runsResource.value().total : 0,
  );

  protected readonly visibleRuns = computed<ImportRun[]>(() => this.loadedRuns());

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.liveCountsOverride() ?? (this.countsResource.hasValue() ? this.countsResource.value() : null);

    const pending = readCountMap(counts, 'PENDING', 'pending') ?? 0;
    const previewing = readCountMap(counts, 'PREVIEWING', 'previewing') ?? 0;
    const executing = readCountMap(counts, 'EXECUTING', 'executing') ?? 0;
    const previewed = readCountMap(counts, 'PREVIEWED', 'previewed');
    const completed = readCountMap(counts, 'COMPLETED', 'completed');
    const withErrors = readCountMap(counts, 'COMPLETED_WITH_ERRORS', 'completedWithErrors');
    const failed = readCountMap(counts, 'FAILED', 'failed');
    const cancelled = readCountMap(counts, 'CANCELLED', 'cancelled');
    const total =
      readCountMap(counts, 'total') ??
      (counts
        ? pending + previewing + executing + (previewed ?? 0) + (completed ?? 0) + (withErrors ?? 0) + (failed ?? 0) + (cancelled ?? 0)
        : null);

    return [
      { id: 'ALL', label: this.transloco.translate('imports.runs.steps.all'), count: total },
      {
        id: IN_PROGRESS_STATUS,
        label: this.transloco.translate('imports.runs.steps.inProgress'),
        count: counts ? pending + previewing + executing : null,
      },
      { id: 'PREVIEWED', label: this.transloco.translate('imports.runs.steps.ready'), count: previewed },
      {
        id: 'COMPLETED',
        label: this.transloco.translate('imports.runs.steps.completed'),
        tone: 'success',
        count: completed,
      },
      {
        id: 'COMPLETED_WITH_ERRORS',
        label: this.transloco.translate('imports.runs.steps.withErrors'),
        count: withErrors,
      },
      {
        id: 'FAILED',
        label: this.transloco.translate('imports.runs.steps.failed'),
        tone: 'danger',
        count: failed,
      },
      { id: 'CANCELLED', label: this.transloco.translate('imports.runs.steps.cancelled'), count: cancelled },
    ];
  });

  protected readonly hasFilters = computed(() => this.stepValue() !== 'ALL' || this.search().trim() !== '');

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());

    effect(() => {
      this.runsResource.value();
      untracked(() => {
        this.liveRunsOverride.set(null);
      });
    });

    effect(() => {
      this.countsResource.value();
      untracked(() => {
        this.liveCountsOverride.set(null);
      });
    });

    effect(() => {
      const blocked = this.tenantBlocked();
      const rows = this.loadedRuns();
      const status = this.stepValue();
      const page = this.page();
      const limit = Math.min(100, this.pageSize());
      const hasActive = !blocked && rows.some((run) => activeRunStatuses().includes(run.status));

      untracked(() => {
        if (hasActive) {
          this.startPolling(status, page, limit);
        } else {
          this.stopPolling();
        }
      });
    });

    effect(() => {
      const isNew = this.newParam() === '1';
      const mappingId = this.mappingParam() ?? null;
      const predecessorRunId = this.predecessorParam() ?? null;
      const wiz = this.wizard();
      const blocked = this.tenantBlocked();

      if (isNew && wiz && !blocked && !this.handledNewTrigger) {
        this.handledNewTrigger = true;
        untracked(() => wiz.open({ mappingId, predecessorRunId }));
      } else if (!isNew) {
        this.handledNewTrigger = false;
      }
    });
  }

  protected openWizard(preset: WizardPreset = {}): void {
    if (!this.can.manage || this.tenantBlocked()) return;
    this.wizard()?.open(preset);
  }

  protected onWizardStarted(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected onWizardClosed(): void {
    if (this.newParam() === '1' || this.mappingParam() || this.predecessorParam()) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { new: null, mapping: null, predecessor: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    this.refreshTick.update((n) => n + 1);
  }

  protected reload(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    if (this.page() !== DEFAULT_PAGE) this.setPage(DEFAULT_PAGE);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected setStep(next: string): void {
    const resolved = VALID_STEP_IDS.has(next) ? next : 'ALL';
    if (resolved === this.stepValue()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: resolved === 'ALL' ? null : resolved, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearAllFilters(): void {
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    const safe = Math.max(DEFAULT_PAGE, page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number): void {
    if (!PAGE_SIZES.includes(size)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { size: size === DEFAULT_PAGE_SIZE ? null : size, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openRun(run: ImportRun): void {
    void this.router.navigate(['/trade/automation/import-runs', run.id]);
  }

  protected onRowKeydown(event: KeyboardEvent, run: ImportRun): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openRun(run);
    }
  }

  protected mappingCodeFor(mappingId: string): string {
    return this.mappingCodeMap().get(mappingId) ?? mappingId;
  }

  protected isActiveRun(status: string): boolean {
    return activeRunStatuses().includes(status);
  }

  protected formatCreated(iso: string): string {
    return formatDateTime(iso, this.lang());
  }

  protected formatNum(val: string | number): string {
    return formatInt(val);
  }

  protected isZero(val: string | number): boolean {
    return Number(val) === 0;
  }

  protected rowsBreakdownTitle(run: ImportRun): string {
    return this.transloco.translate('imports.runs.table.rowsBreakdown', {
      total: this.formatNum(run.totalCount),
      valid: this.formatNum(run.validCount),
      invalid: this.formatNum(run.invalidCount),
      imported: this.formatNum(run.succeededCount),
      failed: this.formatNum(run.failedCount),
    });
  }

  protected formatFileSize(bytes: string): string {
    return formatBytes(bytes);
  }

  protected menuActions(run: ImportRun): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('imports.runs.menu.openReport'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];
    if (
      this.can.manage &&
      run.status === 'PREVIEWED' &&
      Number(run.invalidCount) === 0 &&
      Number(run.validCount) > 0
    ) {
      items.push({
        id: 'importNow',
        title: this.transloco.translate('imports.runs.menu.importNow'),
        icon: 'tablerFileImport',
        tile: 'bg-icon-green',
      });
    }
    if (this.can.manage && TERMINAL_STATUSES.has(run.status)) {
      items.push({
        id: 'runAgain',
        title: this.transloco.translate('imports.runs.menu.runAgain'),
        icon: 'tablerRefresh',
        tile: 'bg-icon-teal',
      });
    }
    return items;
  }

  protected async onMenuSelected(run: ImportRun, selection: ActionSelection): Promise<void> {
    if (selection.id === 'open') {
      this.openRun(run);
      return;
    }
    if (selection.id === 'runAgain') {
      this.openWizard({ mappingId: run.mappingId, predecessorRunId: run.id });
      return;
    }
    if (selection.id === 'importNow') {
      try {
        const action = `execute:${run.id}`;
        const res: unknown = await execute(run.id, run.version, this.keys.for(action, { ifMatch: run.version }));
        this.keys.done(action);
        if (res && typeof res === 'object' && 'jobId' in res) {
          void this.bulkJobs.loadRecent();
        }
        this.notify.success(this.transloco.translate('imports.runs.startedToast'));
        this.refreshTick.update((n) => n + 1);
      } catch (error) {
        this.notify.error(translateImportError(this.transloco, error));
      }
    }
  }

  private startPolling(status: string, page: number, limit: number): void {
    this.stopPolling();
    this.pollDisposed = false;
    const handle: unknown = pollWhile(
      async () => {
        const q = this.searchQuery();
        const [runsRes, countsRes] = await Promise.all([
          listRuns({ ...(status !== 'ALL' ? { status } : {}), ...(q ? { q } : {}), page, limit }),
          getRunCounts(q ? { q } : {}),
        ]);
        if (this.pollDisposed) return runsRes;
        const normalized = normalizePage<ImportRun>(runsRes, page, limit);
        this.liveRunsOverride.set(normalized.items);
        this.liveCountsOverride.set(countsRes);
        const stillActive = normalized.items.some((r) => activeRunStatuses().includes(r.status));
        if (!stillActive) {
          this.refreshTick.update((n) => n + 1);
        }
        return normalized.items;
      },
      (items) => {
        if (this.pollDisposed) return false;
        const rows = Array.isArray(items) ? items : normalizePage<ImportRun>(items).items;
        return rows.some((r) => activeRunStatuses().includes(r.status));
      },
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
