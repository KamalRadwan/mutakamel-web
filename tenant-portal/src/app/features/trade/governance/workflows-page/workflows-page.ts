import { Component, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerGitBranch,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import { createVersion, getMetadata, getVersion, listDefinitions, setDefinitionStatus } from '../policy.api';
import type {
  DefinitionStatus,
  GovernedDefinition,
  GovernedDefinitionRecord,
  GovernedVersion,
  GovernedVersionDetail,
  PolicyMetadata,
  WorkflowContent,
  WorkflowTestCase,
} from '../policy.model';
import { supportedKinds } from '../policy.model';
import {
  ACTIVE_WORKFLOW_KINDS,
  POLICY_PERMISSIONS,
  PURCHASE_ORDER_WORKFLOW_SHAPE,
  WORKFLOW_KINDS,
  type WorkflowKind,
  hasPolicyGrant,
  operatingScopeTarget,
  operatingTradeContext,
} from '../policy.registry';
import { formatDateOnly, isForbiddenError, isLiveScheduled } from '../pricing.service';
import { WorkflowModal } from '../workflow-modal/workflow-modal';

const PAGE_SIZES = [12, 24, 48, 96];
const DEFAULT_PAGE_SIZE = 12;
const NON_LIVE_IN_PROGRESS = new Set([
  'DRAFT',
  'TESTED',
  'APPROVAL_PENDING',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
]);

function isGovernedLiveScheduled(v: Pick<GovernedVersion, 'status' | 'effectiveFrom' | 'effectiveTo'>): boolean {
  return (
    v.status === 'SCHEDULED' &&
    isLiveScheduled({
      status: 'SCHEDULED',
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
    })
  );
}

function defaultWorkflowSeed(kind: string): { content: WorkflowContent; testCases: WorkflowTestCase[] } {
  if (kind === 'PURCHASE_ORDER') {
    return {
      content: {
        states: [...PURCHASE_ORDER_WORKFLOW_SHAPE.states],
        initialState: PURCHASE_ORDER_WORKFLOW_SHAPE.initialState,
        terminalStates: [...PURCHASE_ORDER_WORKFLOW_SHAPE.terminalStates],
        transitions: PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.map((t) => ({ ...t })),
      },
      testCases: [
        { code: 'HAPPY_APPROVAL', startState: 'PENDING', actions: ['APPROVE'], expectedState: 'APPROVED' },
        { code: 'REJECT_PATH', startState: 'PENDING', actions: ['REJECT'], expectedState: 'REJECTED' },
        { code: 'WITHDRAW_PATH', startState: 'PENDING', actions: ['WITHDRAW'], expectedState: 'WITHDRAWN' },
      ],
    };
  }
  return {
    content: {
      states: ['PENDING', 'APPROVED'],
      initialState: 'PENDING',
      terminalStates: ['APPROVED'],
      transitions: [
        {
          code: 'APPROVE_FLOW',
          from: 'PENDING',
          to: 'APPROVED',
          action: 'APPROVE',
          requiresApproval: true,
        },
      ],
    },
    testCases: [
      { code: 'HAPPY_APPROVAL', startState: 'PENDING', actions: ['APPROVE'], expectedState: 'APPROVED' },
    ],
  };
}

let nextWorkflowsPageId = 0;

@Component({
  selector: 'app-workflows-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConflictDialog,
    Dropdown,
    FullState,
    Pagination,
    ScopeChip,
    Segmented,
    VersionStatusBadge,
    WorkflowModal,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerGitBranch,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
    }),
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-workflows', alias: 'workflows' }),
  ],
  templateUrl: './workflows-page.html',
  host: { class: 'flex min-h-full flex-col gap-12 p-12' },
})
export class WorkflowsPage {
  protected readonly uid = `workflows-page-${++nextWorkflowsPageId}`;
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly scopeState = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly createModal = viewChild(WorkflowModal);
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly canRead = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.read),
  );
  protected readonly canManage = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.manage),
  );
  protected readonly tradeCtx = computed(() => operatingTradeContext(this.tenantScope));
  protected readonly currentScopeTarget = computed(() => operatingScopeTarget(this.tenantScope));

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly definitions = signal<GovernedDefinition[]>([]);
  protected readonly metadata = signal<PolicyMetadata | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly kindFilter = signal<string>('ALL');
  protected readonly statusFilter = signal<'ALL' | DefinitionStatus>('ALL');
  protected readonly page = signal(this.readInitialPage());
  protected readonly pageSize = signal(this.readInitialSize());

  protected readonly activeKinds = computed<readonly WorkflowKind[]>(() => {
    const meta = this.metadata();
    const supported = supportedKinds(meta?.kinds.workflows);
    if (supported.length) {
      return supported.filter((k): k is WorkflowKind =>
        (WORKFLOW_KINDS as readonly string[]).includes(k),
      );
    }
    return ACTIVE_WORKFLOW_KINDS;
  });

  protected readonly kindOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const visibleKinds = [...new Set<string>([...WORKFLOW_KINDS, ...this.activeKinds()])];
    return [
      { value: 'ALL', label: this.transloco.translate('workflows.list.allKinds') },
      ...visibleKinds.map((k) => ({
        value: k,
        label: this.transloco.translate(`workflows.kinds.${k}.name`),
      })),
    ];
  });

  protected readonly statusOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('workflows.list.allStatuses') },
      { value: 'ACTIVE', label: this.transloco.translate('workflows.list.active') },
      { value: 'INACTIVE', label: this.transloco.translate('workflows.list.inactive') },
    ];
  });

  protected readonly filteredDefinitions = computed(() => {
    const q = this.search().trim().toLowerCase();
    const kind = this.kindFilter();
    const status = this.statusFilter();

    return this.definitions().filter((def) => {
      if (q && !def.code.toLowerCase().includes(q)) return false;
      if (kind !== 'ALL' && (def.workflowKind ?? '') !== kind) return false;
      if (status !== 'ALL' && def.status !== status) return false;
      return true;
    });
  });

  protected readonly pagedDefinitions = computed(() => {
    const list = this.filteredDefinitions();
    const size = this.pageSize();
    const maxPage = Math.max(1, Math.ceil(list.length / size));
    const current = Math.min(this.page(), maxPage);
    const start = (current - 1) * size;
    return list.slice(start, start + size);
  });

  protected readonly hasActiveFilters = computed(
    () => this.search().trim() !== '' || this.kindFilter() !== 'ALL' || this.statusFilter() !== 'ALL',
  );

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    if (!this.canRead()) {
      this.forbidden.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadFailed.set(false);
    this.forbidden.set(false);
    const ctx = this.tradeCtx();
    try {
      const [defs, meta] = await Promise.all([
        listDefinitions('workflow', { limit: 100 }, ctx),
        this.metadata() ? Promise.resolve(this.metadata()!) : getMetadata(ctx),
      ]);
      this.definitions.set(defs.items);
      this.metadata.set(meta);
    } catch (err) {
      if (isForbiddenError(err)) {
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreateModal(): void {
    if (!this.canManage()) return;
    this.createModal()?.open();
  }

  protected onModalForbidden(): void {
    this.forbidden.set(true);
  }

  /** Create returns the bare definition row; a new definition has no versions yet. */
  protected onWorkflowCreated(record: GovernedDefinitionRecord): void {
    const def: GovernedDefinition = { ...record, versions: [] };
    this.definitions.update((list) => [def, ...list]);
    void this.router.navigate(['/trade/governance/workflows', def.id]);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.setPage(1);
  }

  protected onKindFilterChange(kind: string): void {
    this.kindFilter.set(kind);
    this.setPage(1);
  }

  protected onStatusFilterChange(status: string | null): void {
    this.statusFilter.set((status ?? 'ALL') as 'ALL' | DefinitionStatus);
    this.setPage(1);
  }

  protected onPageChange(next: number): void {
    this.setPage(next);
  }

  protected onPageSizeChange(next: number): void {
    this.pageSize.set(next);
    this.setPage(1, next);
  }

  protected openWorkflow(def: GovernedDefinition): void {
    void this.router.navigate(['/trade/governance/workflows', def.id]);
  }

  protected liveVersionOf(def: GovernedDefinition): GovernedVersion | null {
    return (
      [...def.versions]
        .filter((v) => v.status === 'PUBLISHED' || isGovernedLiveScheduled(v))
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    );
  }

  protected liveVersionText(version: GovernedVersion): string {
    const date = formatDateOnly(version.effectiveFrom, this.lang());
    return this.transloco.translate('workflows.list.liveVersion', { n: version.versionNumber, date });
  }

  protected inProgressVersionOf(def: GovernedDefinition): GovernedVersion | null {
    return (
      [...def.versions]
        .filter((v) => NON_LIVE_IN_PROGRESS.has(v.status) && !isGovernedLiveScheduled(v))
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    );
  }

  protected isLiveScheduledVersion(version: GovernedVersion): boolean {
    return isGovernedLiveScheduled(version);
  }

  protected actionsFor(def: GovernedDefinition): ActionItem[] {
    this.i18n();
    const isBusy = this.busyId() === def.id;
    const isActive = def.status === 'ACTIVE';
    return [
      {
        id: 'open',
        title: this.transloco.translate('workflows.list.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'newVersion',
        title: this.transloco.translate('workflows.list.actions.newVersion'),
        icon: 'tablerPlus',
        tile: 'bg-icon-teal',
        disabled: !this.canManage() || isBusy,
      },
      {
        id: isActive ? 'deactivate' : 'activate',
        title: this.transloco.translate(
          isActive ? 'workflows.list.actions.deactivate' : 'workflows.list.actions.activate',
        ),
        icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
        tile: isActive ? 'bg-icon-orange' : 'bg-icon-green',
        disabled: !this.canManage() || isBusy,
      },
    ];
  }

  protected onRowAction(def: GovernedDefinition, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openWorkflow(def);
    } else if (selection.id === 'newVersion') {
      void this.createDraftVersion(def);
    } else if (selection.id === 'activate' || selection.id === 'deactivate') {
      void this.toggleDefinitionStatus(def, selection.id === 'activate' ? 'ACTIVE' : 'INACTIVE');
    }
  }

  protected onConflictReload(): void {
    this.conflictDialog().close();
    void this.reload();
  }

  protected onConflictKeep(): void {
    this.conflictDialog().close();
  }

  private async toggleDefinitionStatus(
    def: GovernedDefinition,
    nextStatus: DefinitionStatus,
  ): Promise<void> {
    if (!this.canManage() || this.busyId()) return;
    this.busyId.set(def.id);
    try {
      const updated = await setDefinitionStatus(
        'workflow',
        def.id,
        nextStatus,
        def.version,
        newIdempotencyKey(),
        this.tradeCtx(),
      );
      this.definitions.update((list) => list.map((d) => (d.id === updated.id ? { ...updated, versions: d.versions } : d)));
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'ACTIVE' ? 'workflows.list.toasts.activated' : 'workflows.list.toasts.deactivated',
        ),
      );
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyId.set(null);
    }
  }

  private async createDraftVersion(def: GovernedDefinition): Promise<void> {
    if (!this.canManage() || this.busyId()) return;
    this.busyId.set(def.id);
    const ctx = this.tradeCtx();
    try {
      const live = this.liveVersionOf(def);
      let content: WorkflowContent;
      let testCases: WorkflowTestCase[];

      if (live) {
        const liveDetail = (await getVersion(
          'workflow',
          live.id,
          ctx,
        )) as GovernedVersionDetail<WorkflowContent, WorkflowTestCase>;
        content = structuredClone(liveDetail.content);
        testCases = structuredClone(liveDetail.testCases ?? []);
      } else {
        const seed = defaultWorkflowSeed((def.workflowKind ?? ''));
        content = seed.content;
        testCases = seed.testCases;
      }

      const effectiveFrom = new Date(Date.now() + 86_400_000).toISOString();
      const created = await createVersion<WorkflowContent, WorkflowTestCase>(
        'workflow',
        def.id,
        {
          content,
          testCases,
          effectiveFrom,
          effectiveTo: null,
        },
        def.version,
        newIdempotencyKey(),
        ctx,
      );
      this.notify.success(
        this.transloco.translate('workflows.list.toasts.versionCreated', { n: created.versionNumber }),
      );
      void this.router.navigate(['/trade/governance/workflows', def.id, 'versions', created.id]);
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyId.set(null);
    }
  }

  private handleMutationError(err: unknown): void {
    if (isForbiddenError(err)) {
      this.forbidden.set(true);
      return;
    }
    if (err instanceof ApiError) {
      if (err.code === 'TRADE.CONCURRENCY.STALE_VERSION' || (err.status === 409 && err.code.includes('STALE'))) {
        this.conflictDialog().open();
        return;
      }
      const reason = err.details?.['reason']?.[0];
      if (reason) {
        const reasonKey = `governance.errors.${err.code.replaceAll('.', '_')}_${reason}`;
        const reasonMsg = this.transloco.translate(reasonKey);
        if (reasonMsg !== reasonKey) {
          this.notify.error(reasonMsg);
          return;
        }
      }
      const codeKey = `governance.errors.${err.code.replaceAll('.', '_')}`;
      const codeMsg = this.transloco.translate(codeKey);
      this.notify.error(codeMsg !== codeKey ? codeMsg : this.transloco.translate('tradeShared.errors.generic'));
      return;
    }
    this.notify.error(this.transloco.translate('tradeShared.errors.network'));
  }

  private setPage(nextPage: number, nextSize = this.pageSize()): void {
    this.page.set(nextPage);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: nextPage, size: nextSize },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readInitialPage(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('page'));
    return Number.isInteger(raw) && raw >= 1 ? raw : 1;
  }

  private readInitialSize(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('size'));
    return PAGE_SIZES.includes(raw) ? raw : DEFAULT_PAGE_SIZE;
  }
}
