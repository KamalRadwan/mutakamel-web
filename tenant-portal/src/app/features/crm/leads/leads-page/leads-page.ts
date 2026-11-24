import { Component, computed, effect, inject, input, linkedSignal, resource, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAdjustmentsHorizontal, tablerLayoutGrid, tablerLayoutKanban, tablerPlus, tablerTable } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope, translateObjectSignal } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { runInCrm } from '../../shared/crm-runtime';
import { listAssignableOwners } from '../../shared/lookups/assignable-owners';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { listBulkJobItems } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { FieldOption, Query } from '../../../../shared/query-builder/query.model';
import { FacetSearch } from '../../../../shared/ui/facet-search/facet-search';
import { SearchFacet, SearchField, SearchOption } from '../../../../shared/ui/facet-search/facet-search.model';
import { QueryBuilder } from '../../../../shared/ui/query-builder/query-builder/query-builder';
import { StepFilter } from '../../../../shared/ui/step-filter/step-filter';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { RecordActivities } from '../../../../shared/widgets/activities/record-activities/record-activities';
import { ApiError } from '../../settings/shared/settings-api';
import { BulkActivityModal } from '../lead-bulk/activity-modal/activity-modal';
import { BulkAssignModal } from '../lead-bulk/assign-modal/assign-modal';
import { BulkActionId, BulkMenu } from '../lead-bulk/bulk-menu/bulk-menu';
import { BulkDeleteModal } from '../lead-bulk/delete-modal/delete-modal';
import { SELECTION_LIMIT, SelectedRow } from '../lead-bulk/lead-bulk.model';
import { LeadSelection, toSelectedRow } from '../lead-bulk/lead-selection';
import { SelectionBar } from '../lead-bulk/selection-bar/selection-bar';
import { BulkStageModal } from '../lead-bulk/stage-modal/stage-modal';
import { DEFAULT_LIST_PAGE_SIZE, DEFAULT_LIST_PAGE_SIZES } from '../../shared/record/list/page-size';
import { LeadBoard } from '../lead-board/lead-board';
import { LeadCards } from '../lead-cards/lead-cards';
import { LeadModal } from '../lead-modal/lead-modal';
import { ADVANCED_FACET_FIELD } from '../lead-search/lead-search.chips';
import { LeadSearchBody, WireNode } from '../lead-search/lead-search.compile';
import { LeadSearchStore } from '../lead-search/lead-search.store';
import { LeadTable } from '../lead-table/lead-table';
import { getLeadCapabilities, loadLeadKpis, loadSearchOptions } from '../leads.api';
import { LEAD_VIEWS, LeadDetail, LeadRow, LeadStatus, LeadView, LeadsCapabilities, StageCounts, StageFlag, nameIn } from '../leads.model';

const VIEW_ICONS: Record<LeadView, string> = { board: 'tablerLayoutKanban', cards: 'tablerLayoutGrid', table: 'tablerTable' };
const PRESETS = ['mine', 'unassigned', 'overdue', 'hot'];
const GROUPS = ['views', 'presets', 'stageFilter'];
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;
const PAGE_SIZES: readonly number[] = DEFAULT_LIST_PAGE_SIZES;

interface TableViewSnapshot {
  items?: () => readonly LeadRow[];
  totalCount?: () => number;
  list?: { loading?: () => boolean };
}

function parsePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-leads-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    FullState,
    Button,
    Field,
    FacetSearch,
    QueryBuilder,
    StepFilter,
    ViewSwitcher,
    LeadBoard,
    LeadCards,
    LeadTable,
    LeadModal,
    RecordActivities,
    BulkMenu,
    SelectionBar,
    BulkAssignModal,
    BulkStageModal,
    BulkDeleteModal,
    BulkActivityModal,
  ],
  providers: [
    LeadSearchStore,
    LeadSelection,
    provideTranslocoScope(
      'leads',
      'settings',
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'lead-search', alias: 'leadSearch' },
      { scope: 'lead-bulk-bar', alias: 'bulkBar' },
      { scope: 'lead-bulk-actions', alias: 'leadBulk' },
    ),
    provideIcons({ tablerAdjustmentsHorizontal, tablerLayoutKanban, tablerLayoutGrid, tablerPlus, tablerTable }),
  ],
  templateUrl: './leads-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class LeadsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scope = inject(TenantScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly tracker = inject(BulkJobsTracker);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly texts = translateObjectSignal(GROUPS, {}, 'leads');
  protected readonly canRead = computed(() => { this.scope.me(); return can('crm.leads.read'); });
  private readonly options = resource({
    params: () => this.canRead() && this.branchId() ? this.branchId() : undefined,
    loader: () => loadSearchOptions(),
  });
  protected readonly unavailable = computed(() => this.options.value()?.unavailable ?? []);
  protected readonly ownersUnavailable = signal(false);
  protected readonly unavailableFacets = computed(() => [...this.unavailable(), ...(this.ownersUnavailable() ? ['owner'] : [])]);
  private readonly searchOwners = async (term: string): Promise<FieldOption[]> => {
    const branchId = this.branchId();
    if (!branchId || !this.canRead()) return [];
    try {
      const page = await listAssignableOwners(branchId, 'leads', 'update');
      this.ownersUnavailable.set(false);
      return page.items.filter((owner) => owner.displayName.toLowerCase().includes(term.trim().toLowerCase()))
        .map((owner) => ({ value: owner.id, label: owner.displayName }));
    } catch {
      this.ownersUnavailable.set(true);
      return [];
    }
  };
  private readonly recordActivities = viewChild.required(RecordActivities);
  protected readonly store = inject(LeadSearchStore);
  protected readonly selection = inject(LeadSelection);
  readonly leadModal = viewChild.required(LeadModal);
  private readonly boardView = viewChild(LeadBoard);
  private readonly cardsView = viewChild(LeadCards);
  private readonly tableView = viewChild(LeadTable);
  private readonly queryBuilder = viewChild(QueryBuilder);
  private readonly assignModal = viewChild(BulkAssignModal);
  private readonly stageModal = viewChild(BulkStageModal);
  private readonly deleteModal = viewChild(BulkDeleteModal);
  private readonly activityModal = viewChild(BulkActivityModal);

  /** Bound from the `?view=` query parameter. */
  readonly view = input<string>();
  /** Bound from the `?stage=` query parameter. */
  readonly stageParam = input<string | undefined>(undefined, { alias: 'stage' });
  /** Bound from the `?page=` query parameter. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from the `?size=` query parameter. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly current = computed<LeadView>(() => (LEAD_VIEWS as readonly string[]).find((view) => view === this.view()) as LeadView ?? 'board');
  protected readonly advancedOpen = signal(false);
  protected readonly advancedVisible = computed(
    () =>
      this.advancedOpen() ||
      this.store.draftDirty() ||
      this.store.facets().some((facet) => facet.field === ADVANCED_FACET_FIELD),
  );
  protected readonly stages = computed(() => this.options.value()?.stages ?? []);

  private lastCounts: StageCounts | undefined;
  private countsBranch = '';
  private readonly counts = resource({
    params: () => this.canRead() && this.branchId() ? this.store.body() : undefined,
    loader: async ({ params }) => {
      if (this.countsBranch !== params.branchId) { this.lastCounts = undefined; this.countsBranch = params.branchId; }
      try {
        const kpis = await loadLeadKpis(params);
        const res: StageCounts = { total: kpis.totalLeads,
          byStage: Object.fromEntries(kpis.byStage.map(({ stageId, count }) => [stageId, count])) };
        this.lastCounts = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          return this.lastCounts;
        }
        throw error;
      }
    },
  });

  protected readonly stage = linkedSignal<{ view: LeadView; param: string | undefined }, string>({
    source: () => ({ view: this.current(), param: this.stageParam() }),
    computation: ({ view, param }, previous) => {
      if (view === 'board') return 'all';
      if (param !== previous?.source.param) return param || 'all';
      return previous?.value ?? (param || 'all');
    },
  });

  protected readonly page = linkedSignal<string | undefined, number>({
    source: () => this.pageParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePage(param);
      return previous?.value ?? parsePage(param);
    },
  });

  protected readonly pageSize = linkedSignal<string | undefined, number>({
    source: () => this.sizeParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePageSize(param);
      return previous?.value ?? parsePageSize(param);
    },
  });

  protected readonly stageSteps = computed(() => {
    const language = this.language();
    const counts = this.counts.value();
    const active = this.stages()
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return [
      { id: 'all', label: this.text('stageFilter')['all'] ?? '', count: counts?.total ?? null },
      ...active.map((stage) => ({
        id: stage.id,
        label: nameIn(stage, language),
        count: counts ? (counts.byStage[stage.id] ?? 0) : null,
        tone: stage.flag === 'DISQUALIFIED' ? 'danger' as const : stage.flag === 'CONVERTED' ? 'success' as const : undefined,
      })),
    ];
  });

  protected readonly views = computed<ViewOption[]>(() => {
    const texts = this.text('views');
    return LEAD_VIEWS.map((id) => ({ id, icon: VIEW_ICONS[id], label: texts[id] ?? id }));
  });

  protected readonly presets = computed<SearchOption[]>(() => {
    const texts = this.text('presets');
    return PRESETS.map((value) => ({ value, label: texts[value] ?? value }));
  });

  protected readonly fields = computed<SearchField[]>(() =>
    this.store
      .fields()
      .filter((field) => field.chip)
      .map((field) => ({
        id: field.id,
        label: field.label,
        ...(field.chipHint ? { hint: field.chipHint, chipHint: field.chipHint } : {}),
        ...(field.options ? { options: field.options.map(({ value, label }) => ({ value, label })) } : {}),
      })),
  );

  protected readonly resolvingBulk = signal(false);
  protected readonly bulkBusy = computed(() => this.tracker.hasActive('crm', 'crm.leads'));
  private lastBodyJson = '';
  private readonly refreshedJobIds = new Set<string>();
  private lastHandledSelectJobKey = '';
  private selectFailedSeq = 0;

  protected readonly branchId = computed<string>(() => {
    return runInCrm(() => sessionBranch())?.branchId ?? '';
  });

  private readonly capabilitiesResource = resource({
    params: () => this.canRead() && this.branchId() ? this.branchId() : undefined,
    loader: ({ params }) => getLeadCapabilities(params).catch(() => null),
  });

  protected readonly readOnly = signal(false);
  protected readonly capabilities = computed<LeadsCapabilities | null>(() =>
    this.readOnly() ? null :
    this.capabilitiesResource.hasValue() ? this.capabilitiesResource.value() : null,
  );
  protected readonly canCreate = computed(() => !!this.capabilities()?.leads?.create);

  protected readonly effectiveBody = computed<LeadSearchBody>(() => {
    const base = this.store.body();
    const stageId = this.stage();
    if (!stageId || stageId === 'all') return base;
    const stageLeaf: WireNode = { field: 'stageId', operator: 'eq', value: stageId };
    const filterTree: WireNode = base.filterTree
      ? { op: 'AND', children: [base.filterTree, stageLeaf] }
      : stageLeaf;
    return { ...base, filterTree };
  });

  protected readonly pageRows = computed<SelectedRow[]>(() => {
    const table = this.tableView() as unknown as TableViewSnapshot | undefined;
    const rows = table?.items?.() ?? [];
    return rows.map(toSelectedRow);
  });

  protected readonly visibleIds = computed<Set<string> | null>(() => {
    const table = this.tableView() as unknown as TableViewSnapshot | undefined;
    const rows = table?.items?.() ?? [];
    if (rows.length === 0 && table?.list?.loading?.()) return null;
    return new Set(rows.map((row) => row.id));
  });

  protected readonly matchingTotal = computed<number>(() => {
    const table = this.tableView() as unknown as TableViewSnapshot | undefined;
    const loading = table?.list?.loading?.() ?? false;
    const fromTable = table?.totalCount?.();
    if (typeof fromTable === 'number' && (fromTable > 0 || !loading)) {
      return fromTable;
    }
    const counts = this.counts.value();
    if (!counts) return fromTable ?? 0;
    const stageId = this.stage();
    return stageId === 'all' ? counts.total : (counts.byStage[stageId] ?? 0);
  });

  constructor() {
    effect(() => { this.branchId(); untracked(() => this.readOnly.set(false)); });
    this.lastBodyJson = JSON.stringify(this.effectiveBody());
    this.selection.onBodyChange(this.effectiveBody());
    this.store.init({ branchId: this.canRead() ? this.branchId() : '', stages: [], sources: [], tags: [], owners: this.searchOwners });
    effect(() => {
      const options = this.options.value();
      this.store.init({
        branchId: this.canRead() ? this.branchId() : '',
        stages: options?.stages ?? [],
        sources: options?.sources ?? [],
        tags: options?.tags ?? [],
        owners: this.searchOwners,
        unavailable: [...(options?.unavailable ?? []), ...(this.ownersUnavailable() ? ['owner' as const] : [])],
      });
    });
    effect(() => {
      this.effectiveBody();
      untracked(() => this.syncBodySelection());
    });
    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.refreshedJobIds.add(initialFinished.id);
    }

    effect(() => {
      if (this.current() === 'board' && this.queryParams()?.get('select') !== 'failed') {
        untracked(() => {
          if (this.selection.count() > 0 || this.selection.mode() === 'all') {
            this.selection.clear();
          }
        });
      }
    });

    effect(() => {
      const finished = this.tracker.finished();
      const currentBranch = this.branchId();
      if (!finished || finished.module !== 'crm.leads') return;
      if (finished.scope.branchId !== currentBranch) return;
      if (this.refreshedJobIds.has(finished.id)) return;
      this.refreshedJobIds.add(finished.id);
      untracked(() => {
        this.refreshActiveView();
        this.reloadCounts();
      });
    });

    effect(() => {
      const qp = this.queryParams();
      if (qp?.get('select') !== 'failed') {
        this.lastHandledSelectJobKey = '';
        return;
      }
      const bulkJobId =
        qp.get('bulkJob') ??
        this.tracker.jobs().find((job) => job.app === 'crm' && job.module === 'crm.leads' && job.counts.failed > 0)?.id ??
        null;
      if (!bulkJobId) {
        untracked(() => void this.clearSelectParam(false));
        return;
      }
      if (this.lastHandledSelectJobKey === bulkJobId) return;
      this.lastHandledSelectJobKey = bulkJobId;
      untracked(() => {
        void this.loadFailedSelection(bulkJobId);
      });
    });
  }

  protected show(view: string) {
    if (view !== this.current()) {
      this.page.set(DEFAULT_PAGE);
      this.pageSize.set(DEFAULT_PAGE_SIZE);
    }
    if (view === 'board') {
      this.stage.set('all');
      this.page.set(DEFAULT_PAGE);
      this.selection.clear();
      this.syncBodySelection();
    }
    this.router.navigate([], {
      queryParams: {
        view: view === 'board' ? null : view,
        stage: view === 'board' || this.stage() === 'all' ? null : this.stage(),
        page: view === 'board' || this.page() === DEFAULT_PAGE ? null : this.page(),
        size: view === 'board' || this.pageSize() === DEFAULT_PAGE_SIZE ? null : this.pageSize(),
      },
      queryParamsHandling: 'merge',
    });
  }

  protected filterStage(stage = 'all') {
    this.stage.set(stage);
    this.page.set(DEFAULT_PAGE);
    this.syncBodySelection();
    this.router.navigate([], {
      queryParams: {
        stage: stage === 'all' ? null : stage,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number) {
    const next = Math.max(DEFAULT_PAGE, page);
    this.page.set(next);
    this.router.navigate([], {
      queryParams: { page: next === DEFAULT_PAGE ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number) {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(DEFAULT_PAGE);
    this.router.navigate([], {
      queryParams: {
        size: size === DEFAULT_PAGE_SIZE ? null : size,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setFacets(facets: SearchFacet[]) {
    const before = JSON.stringify(this.store.body());
    this.store.setFacets(facets);
    if (JSON.stringify(this.store.body()) !== before) {
      this.syncBodySelection();
      this.setPage(DEFAULT_PAGE);
    }
  }

  protected applyAdvanced(query: Query) {
    this.store.setApplied(query);
    this.syncBodySelection();
    this.setPage(DEFAULT_PAGE);
  }

  protected clearAdvanced() {
    this.store.clear();
    this.syncBodySelection();
    this.setPage(DEFAULT_PAGE);
  }

  protected reloadCounts() {
    this.counts.reload();
  }

  protected toggleAdvanced() {
    this.advancedOpen.update((open) => !open);
  }

  protected onFacetChipClick(facet: SearchFacet) {
    if (facet.field === ADVANCED_FACET_FIELD) {
      this.advancedOpen.set(true);
      this.queryBuilder()?.open();
    }
  }

  protected openCreate(stageId?: string) {
    if (!this.canCreate()) return;
    this.leadModal().openCreate(stageId ? { stageId } : undefined);
  }

  protected openLead(lead: LeadRow) {
    const view = this.current();
    const nav =
      view === 'board'
        ? (this.boardView()?.navContextFor(lead.id) ?? null)
        : view === 'cards'
          ? (this.cardsView()?.navContext() ?? null)
          : (this.tableView()?.navContext() ?? null);
    this.leadModal().openLead(lead.id, nav);
  }

  protected onLeadSaved(detail: LeadDetail) {
    if (this.activeViewHasItem(detail.id)) {
      const patch = this.patchFromDetail(detail);
      this.boardView()?.patchItem(patch);
      this.cardsView()?.patchItem(patch);
      this.tableView()?.patchItem(patch);
    } else {
      this.refreshActiveView();
    }
    this.reloadCounts();
  }

  private activeViewHasItem(id: string): boolean {
    const view = this.current();
    if (view === 'board') return this.boardView()?.hasItem(id) ?? false;
    if (view === 'cards') return this.cardsView()?.hasItem(id) ?? false;
    return this.tableView()?.hasItem(id) ?? false;
  }

  private patchFromDetail(detail: LeadDetail): Partial<LeadRow> & { id: string } {
    return {
      id: detail.id,
      leadProfileType: detail.leadProfileType,
      displayName: detail.displayName,
      companyName: detail.companyName,
      companyPhone: detail.companyPhone,
      companyEmail: detail.companyEmail,
      email: detail.email,
      primaryMobile: detail.primaryMobile,
      phones: [...detail.phones],
      stageId: detail.stageId,
      stageFlag: detail.stageFlag,
      status: detail.status,
      rating: detail.rating,
      cardColor: detail.cardColor,
      owner: detail.owner ? { ...detail.owner } : null,
      nextActivity: detail.nextActivity ? { ...detail.nextActivity } : null,
      acquisitionSource: detail.acquisitionSource ? { ...detail.acquisitionSource } : null,
      address: detail.address ? structuredClone(detail.address) : null,
      primaryContact: detail.primaryContact
        ? { ...detail.primaryContact, phones: [...detail.primaryContact.phones] }
        : null,
      interestSummary: detail.interestSummary,
      tags: detail.tags.map((tag) => ({ ...tag })),
      updatedAt: detail.updatedAt,
    };
  }

  protected onLeadChanged(detail: LeadDetail) {
    const patch = this.patchFromDetail(detail);
    this.boardView()?.patchItem(patch);
    this.cardsView()?.patchItem(patch);
    this.tableView()?.patchItem(patch);
    this.reloadCounts();
  }

  protected onLeadDeleted() {
    this.refreshActiveView();
    this.reloadCounts();
  }

  private refreshActiveView() {
    this.boardView()?.refresh();
    this.cardsView()?.refresh();
    this.tableView()?.refresh();
  }

  protected openActivities(lead: LeadRow) {
    this.recordActivities().open({ app: 'CRM', type: 'LEAD', id: lead.id, label: lead.displayName });
  }

  protected async openBulkAction(action: BulkActionId): Promise<void> {
    if (!this.capabilities() || this.readOnly() || this.resolvingBulk() || this.bulkBusy() || this.selection.count() <= 0) return;
    this.resolvingBulk.set(true);
    let rows: SelectedRow[];
    try {
      rows = await this.selection.resolve();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LEAD_SELECTION_TOO_LARGE') {
        this.notify.error(this.transloco.translate('bulkBar.bar.tooMany'));
      } else {
        this.notify.error(this.transloco.translate('leads.loadFailed'));
      }
      return;
    } finally {
      this.resolvingBulk.set(false);
    }

    if (!rows.length) return;

    switch (action) {
      case 'assign':
        this.assignModal()?.open(rows);
        break;
      case 'stage':
        this.stageModal()?.open(rows);
        break;
      case 'activity':
        this.activityModal()?.open(rows);
        break;
      case 'delete':
        this.deleteModal()?.open(rows);
        break;
    }
  }

  protected onBulkSubmitted(): void {
    this.selection.clear();
  }

  private async loadFailedSelection(jobId: string): Promise<void> {
    const seq = ++this.selectFailedSeq;
    const selectedRows: SelectedRow[] = [];
    let dropped = 0;
    let page = 1;
    let fetched = 0;

    try {
      while (fetched < SELECTION_LIMIT) {
        const res = await listBulkJobItems('crm', jobId, { status: 'FAILED', page, limit: 100 });
        if (seq !== this.selectFailedSeq) return;
        if (res.items.length === 0) break;

        for (const item of res.items) {
          fetched++;
          if (!item.current) {
            dropped++;
            continue;
          }
          selectedRows.push({
            id: item.entityId,
            displayName: item.label,
            ownerUserId: typeof item.current['ownerUserId'] === 'string' ? item.current['ownerUserId'] : null,
            stageId: typeof item.current['stageId'] === 'string' ? item.current['stageId'] : '',
            stageFlag: (typeof item.current['stageFlag'] === 'string' ? item.current['stageFlag'] : 'NEW') as StageFlag,
            status: (typeof item.current['status'] === 'string' ? item.current['status'] : 'OPEN') as LeadStatus,
            ...(typeof item.current['updatedAt'] === 'string' ? { updatedAt: item.current['updatedAt'] } : {}),
          });
        }

        if (fetched >= res.total || res.items.length < 100) break;
        page++;
      }

      if (seq !== this.selectFailedSeq) return;
      this.selection.replaceWith(selectedRows);

      if (dropped > 0) {
        this.notify.warning(this.transloco.translate('leadBulk.job.unavailable', { n: dropped }));
      }
    } catch {
      if (seq !== this.selectFailedSeq) return;
      this.notify.error(this.transloco.translate('leads.loadFailed'));
    } finally {
      if (seq === this.selectFailedSeq) {
        await this.clearSelectParam(selectedRows.length > 0);
      }
    }
  }

  private async clearSelectParam(switchToTable: boolean): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        select: null,
        ...(switchToTable && this.current() !== 'table' ? { view: 'table' } : {}),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private syncBodySelection(): void {
    const next = this.effectiveBody();
    const nextJson = JSON.stringify(next);
    if (nextJson === this.lastBodyJson) return;
    this.lastBodyJson = nextJson;
    this.selection.onBodyChange(next);
  }

  private text(group: string): Record<string, string> {
    return (this.texts()[GROUPS.indexOf(group)] ?? {}) as Record<string, string>;
  }
}
