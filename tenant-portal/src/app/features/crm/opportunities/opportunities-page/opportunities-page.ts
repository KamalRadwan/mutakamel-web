import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerHierarchy2,
  tablerLayoutGrid,
  tablerLayoutKanban,
  tablerPlus,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { listBulkJobItems } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import {
  FieldOption,
  Query,
  rememberFieldOptions,
} from '../../../../shared/query-builder/query.model';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { FacetSearch } from '../../../../shared/ui/facet-search/facet-search';
import { SearchFacet, SearchField, SearchOption } from '../../../../shared/ui/facet-search/facet-search.model';
import { QueryBuilder } from '../../../../shared/ui/query-builder/query-builder/query-builder';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { RecordActivities } from '../../../../shared/widgets/activities/record-activities/record-activities';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { assignmentOptions } from '../../settings/pipelines/pipelines.api';
import { ApiError, errorCodeOf } from '../../settings/shared/settings-api';
import { listTags } from '../../settings/tags/tags.api';
import {
  DEFAULT_LIST_PAGE_SIZE,
  DEFAULT_LIST_PAGE_SIZES,
  createListPageSize,
} from '../../shared/record/list/page-size';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { createRecordSearchStore } from '../../shared/record/search/record-search-store';
import {
  OPPORTUNITY_ERROR_KEYS,
  canManagePipelines as checkCanManagePipelines,
  getOpportunityCapabilities,
  listCurrencies,
  listOwners,
  listPageSizes,
  listReasons,
  loadBoard,
  searchCustomerOptions,
  searchOpportunities,
} from '../opportunities.api';
import {
  OPPORTUNITY_VIEWS,
  OpportunityCapabilities,
  OpportunityRow,
  OpportunitySearchBody,
  OpportunityStatus,
  OpportunityView,
  PipelineStageView,
  WireNode,
  stageLabel,
} from '../opportunities.model';
import { OpportunityBoard } from '../opportunity-board/opportunity-board';
import { OppBulkActivityModal } from '../opportunity-bulk/activity-modal/activity-modal';
import { OppBulkAssignModal } from '../opportunity-bulk/assign-modal/assign-modal';
import { OppBulkDeleteModal } from '../opportunity-bulk/delete-modal/delete-modal';
import { OpportunityBulkMenu, OpportunityBulkMenuAction } from '../opportunity-bulk/bulk-menu/bulk-menu';
import {
  CRM_OPPORTUNITIES_BULK_APP,
  CRM_OPPORTUNITIES_BULK_MODULE_ID,
  translateOpportunityBulkError,
} from '../opportunity-bulk/bulk-runner';
import {
  OPPORTUNITY_SELECTION_LIMIT,
  OpportunitySelection,
  OpportunitySelectionRow,
} from '../opportunity-bulk/opportunity-selection';
import { OpportunitySelectionBar } from '../opportunity-bulk/selection-bar/selection-bar';
import { OppBulkStageModal } from '../opportunity-bulk/stage-modal/stage-modal';
import { canCreateOpportunity } from '../opportunity-card/opportunity-card';
import { OpportunityCards } from '../opportunity-cards/opportunity-cards';
import { OpportunityModal } from '../opportunity-modal/opportunity-modal';
import { CloseDialog } from '../opportunity-moves/close-dialog/close-dialog';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { PipelineMoveDialog } from '../opportunity-moves/pipeline-move-dialog/pipeline-move-dialog';
import {
  ADVANCED_FACET_FIELD,
  CUSTOMER_PARTY_FACET_FIELD,
  OPPORTUNITY_PRESETS,
  defaultOpportunityQuery,
  emptyOpportunityQuery,
  facetsToQuery,
  queryToFacets,
} from '../opportunity-search/opportunity-search.chips';
import {
  compileOpportunityQuery,
  opportunitySearchErrorKey,
} from '../opportunity-search/opportunity-search.compile';
import {
  OpportunitySearchFieldsContext,
  opportunitySearchFields,
} from '../opportunity-search/opportunity-search.fields';
import { stageTone } from '../opportunity-stage-tone';
import { OpportunityTable } from '../opportunity-table/opportunity-table';
import { PipelineScope } from '../pipeline-scope';
import { PipelineSwitcher } from '../pipeline-switcher/pipeline-switcher';

type AllPipelinesStatusFilter = 'all' | 'OPEN' | 'WON' | 'LOST';

interface OpportunitySearchStoreCtx extends Omit<OpportunitySearchFieldsContext, 't' | 'language'> {
  branchId: string;
  pipelineId: string | null;
  customerPartyId: string | null;
  partyLabel: string | null;
}

interface CountsState {
  mode: 'stage' | 'status';
  all: number;
  byKey: Record<string, number>;
}

const VIEW_ICONS: Record<OpportunityView, string> = {
  board: 'tablerLayoutKanban',
  cards: 'tablerLayoutGrid',
  table: 'tablerTable',
};
const VIEW_STORAGE_KEY = 'opportunities.view';
const PAGE_SIZE_STORAGE_KEY = 'opportunities.pageSize';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;
const PAGE_SIZES: readonly number[] = DEFAULT_LIST_PAGE_SIZES;
const SORT_PATTERN = /^(title|amount|probabilityPercent|expectedCloseDate):(ASC|DESC)$/;
const COUNTS_DEBOUNCE_MS = 300;
const STATUS_FILTER_ORDER: readonly Exclude<AllPipelinesStatusFilter, 'all'>[] = ['OPEN', 'WON', 'LOST'];

function readStoredView(): OpportunityView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return (OPPORTUNITY_VIEWS as readonly string[]).includes(raw ?? '') ? (raw as OpportunityView) : 'board';
  } catch {
    return 'board';
  }
}

function writeStoredView(view: OpportunityView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // ignore storage errors
  }
}

function parseView(raw: string | undefined): OpportunityView | null {
  return raw && (OPPORTUNITY_VIEWS as readonly string[]).includes(raw) ? (raw as OpportunityView) : null;
}

function parsePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : fallback;
}

function parseSort(raw: string | undefined): string | null {
  if (!raw || !SORT_PATTERN.test(raw)) return null;
  return raw;
}

function parseStatusFilter(raw: string | undefined): AllPipelinesStatusFilter {
  return raw === 'OPEN' || raw === 'WON' || raw === 'LOST' ? raw : 'all';
}

function appendAndLeaf(base: OpportunitySearchBody, leaf: WireNode): OpportunitySearchBody {
  const filterTree: WireNode = base.filterTree
    ? { op: 'AND', children: [base.filterTree, leaf] }
    : leaf;
  return { ...base, filterTree };
}

function statusFilterLeaf(status: Exclude<AllPipelinesStatusFilter, 'all'>): WireNode {
  if (status === 'OPEN') {
    return { field: 'status', operator: 'in', value: ['IN_PROGRESS', 'ON_HOLD'] };
  }
  return { field: 'status', operator: 'eq', value: status };
}

@Component({
  selector: 'app-opportunities-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    FullState,
    FacetSearch,
    QueryBuilder,
    StepFilter,
    ViewSwitcher,
    RecordActivities,
    PipelineSwitcher,
    OpportunityBoard,
    OpportunityCards,
    OpportunityTable,
    OpportunityModal,
    CloseDialog,
    PipelineMoveDialog,
    OpportunityBulkMenu,
    OpportunitySelectionBar,
    OppBulkAssignModal,
    OppBulkStageModal,
    OppBulkDeleteModal,
    OppBulkActivityModal,
  ],
  providers: [
    OpportunityMoves,
    OpportunitySelection,
    provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerHierarchy2,
      tablerLayoutKanban,
      tablerLayoutGrid,
      tablerTable,
      tablerPlus,
    }),
  ],
  templateUrl: './opportunities-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class OpportunitiesPage implements CanLeaveRecord {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly currentUser = inject(CurrentUser, { optional: true });
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly pipelineScope = inject(PipelineScope);
  protected readonly moves = inject(OpportunityMoves);
  protected readonly selection = inject(OpportunitySelection);

  private readonly recordActivities = viewChild.required(RecordActivities);
  private readonly opportunityModal = viewChild.required(OpportunityModal);
  private readonly reopenDialog = viewChild<ConfirmDialog>('reopenDialog');
  private readonly boardView = viewChild(OpportunityBoard);
  private readonly cardsView = viewChild(OpportunityCards);
  private readonly tableView = viewChild(OpportunityTable);
  private readonly queryBuilder = viewChild(QueryBuilder);
  private readonly assignModal = viewChild(OppBulkAssignModal);
  private readonly stageModal = viewChild(OppBulkStageModal);
  private readonly deleteModal = viewChild(OppBulkDeleteModal);
  private readonly activityModal = viewChild(OppBulkActivityModal);

  /** Bound from `?view=` query parameter. */
  readonly view = input<string>();
  /** Bound from `?stage=` query parameter. */
  readonly stageParam = input<string | undefined>(undefined, { alias: 'stage' });
  /** Bound from `?page=` query parameter. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from `?size=` query parameter. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  /** Bound from `?sort=` query parameter. */
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });
  /** Bound from `?open=` query parameter (used by O5 quick modal). */
  readonly openParam = input<string | undefined>(undefined, { alias: 'open' });
  /** Bound from `?customerPartyId=` query parameter (X-h drill-in). */
  readonly customerPartyIdParam = input<string | undefined>(undefined, { alias: 'customerPartyId' });
  /** Bound from `?partyLabel=` query parameter (X-h drill-in). */
  readonly partyLabelParam = input<string | undefined>(undefined, { alias: 'partyLabel' });

  private readonly pageSizePref = createListPageSize({
    storageKey: PAGE_SIZE_STORAGE_KEY,
    sizes: DEFAULT_LIST_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });

  private readonly preferredView = signal<OpportunityView>(readStoredView());

  protected readonly pipelines = this.pipelineScope.pipelines;
  protected readonly pipelinesLoaded = this.pipelineScope.loaded;
  protected readonly pipelinesFailed = this.pipelineScope.loadFailed;
  protected readonly activePipeline = this.pipelineScope.current;

  protected readonly customerPartyId = computed(() => this.customerPartyIdParam()?.trim() || null);
  protected readonly partyLabel = computed(() => this.partyLabelParam()?.trim() || null);

  protected readonly allPipelines = linkedSignal<string | null, boolean>({
    source: () => this.customerPartyId(),
    computation: (partyId, prev) => {
      if (!partyId) return false;
      if (partyId !== prev?.source) return true;
      return prev?.value ?? true;
    },
  });

  protected readonly current = computed<OpportunityView>(() => {
    const candidate = parseView(this.view()) ?? this.preferredView();
    if (this.allPipelines()) {
      return candidate === 'cards' ? 'cards' : 'table';
    }
    return candidate;
  });

  protected readonly hasNoPipeline = computed(
    () => this.pipelinesLoaded() && !this.pipelinesFailed() && this.pipelines().length === 0,
  );

  protected readonly switcherValue = computed<string | null>(() =>
    this.allPipelines() ? null : (this.activePipeline()?.id ?? null),
  );

  protected readonly branchId = computed(() => this.scope.branch().id);
  protected readonly timeZone = computed(() => this.currentUser?.timeZone() || 'Africa/Cairo');

  private readonly capabilitiesResource = resource({
    params: () => this.branchId(),
    loader: ({ params }) => getOpportunityCapabilities(params).catch(() => null),
  });

  private readonly ownersResource = resource({
    params: () => this.branchId(),
    loader: ({ params }) => listOwners(params).catch(() => []),
  });

  private readonly sourcesResource = resource({
    loader: () => listLeadSources().catch(() => []),
  });

  private readonly tagsResource = resource({
    loader: () => listTags().catch(() => null),
  });

  private readonly currenciesResource = resource({
    loader: () => listCurrencies().catch(() => []),
  });

  private readonly winReasonsResource = resource({
    loader: () => listReasons({ kind: 'WIN' }).then((res) => res.items).catch(() => []),
  });

  private readonly lossReasonsResource = resource({
    loader: () => listReasons({ kind: 'LOSS' }).then((res) => res.items).catch(() => []),
  });

  private readonly teamsResource = resource({
    loader: () =>
      assignmentOptions('')
        .then((res) => res.teams)
        .catch(() => []),
  });

  protected readonly capabilities = computed<OpportunityCapabilities | null>(() =>
    this.capabilitiesResource.hasValue() ? this.capabilitiesResource.value() : null,
  );

  protected readonly canCreate = computed(
    () => !this.hasNoPipeline() && canCreateOpportunity(this.capabilities()),
  );

  protected readonly createTitle = computed(() => {
    this.i18n();
    if (this.hasNoPipeline()) {
      return this.transloco.translate('opportunities.page.noPipeline.title');
    }
    if (!canCreateOpportunity(this.capabilities())) {
      return this.transloco.translate('opportunities.page.noCreatePermission');
    }
    return this.transloco.translate('opportunities.page.newTitle');
  });

  private readonly loadedOwners = signal<FieldOption[]>([]);
  private readonly loadedTeams = signal<FieldOption[]>([]);

  protected readonly store = createRecordSearchStore<OpportunitySearchStoreCtx, OpportunitySearchBody>({
    fields: (ctx, { language, t }) =>
      opportunitySearchFields({
        ...ctx,
        ownerOptions: this.loadedOwners().length > 0 ? this.loadedOwners() : ctx.ownerOptions,
        teamOptions: this.loadedTeams().length > 0 ? this.loadedTeams() : ctx.teamOptions,
        language,
        t,
      }),
    compile: (query, ctx, { currentUserId, timeZone }) =>
      compileOpportunityQuery(query, {
        branchId: this.branchId(),
        pipelineId: this.allPipelines() ? null : (this.activePipeline()?.id ?? ctx.pipelineId),
        customerPartyId: this.customerPartyId(),
        meUserId: currentUserId,
        timeZone,
      }),
    defaultQuery: () => defaultOpportunityQuery(),
    emptyQuery: () => emptyOpportunityQuery(),
    facetsToQuery: (facets, _ctx, { prev, fields }) => {
      const { query, rejected } = facetsToQuery(prev, facets, fields, {
        timeZone: this.timeZone(),
      });
      return {
        query,
        rejected: rejected.map((item) => ({
          field: item.field,
          reasonKey: `search.rejected.${item.code}`,
        })),
      };
    },
    queryToFacets: (query, ctx, { fields, t }) => {
      const base = queryToFacets(query, fields, t, { timeZone: this.timeZone() });
      const partyId = this.customerPartyId() ?? ctx.customerPartyId;
      if (!partyId) return base;
      const label = this.partyLabel() ?? ctx.partyLabel;
      return [
        {
          field: CUSTOMER_PARTY_FACET_FIELD,
          label: t('opportunities.page.customerChip'),
          values: [{ value: partyId, label: label || partyId }],
        },
        ...base,
      ];
    },
    rejectedKeyPrefix: 'opportunities.',
    currentUserId: () => this.currentUser?.userId() ?? '',
    timeZone: () => this.timeZone(),
    initialCtx: {
      branchId: this.branchId(),
      pipelineId: null,
      customerPartyId: this.customerPartyId(),
      partyLabel: this.partyLabel(),
      stages: [],
      sources: [],
      tags: null,
      currencies: [],
      winReasons: [],
      lossReasons: [],
      owners: async () => [],
      teams: async () => [],
      customers: async () => [],
    },
  });

  protected readonly searchBody = computed<OpportunitySearchBody>(
    () => this.store.body(),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly stage = linkedSignal<
    {
      view: OpportunityView;
      param: string | undefined;
      allPipelines: boolean;
      pipelineId: string | null;
      customerPartyId: string | null;
    },
    string
  >({
    source: () => ({
      view: this.current(),
      param: this.stageParam(),
      allPipelines: this.allPipelines(),
      pipelineId: this.activePipeline()?.id ?? null,
      customerPartyId: this.customerPartyId(),
    }),
    computation: ({ view, param, allPipelines, pipelineId, customerPartyId }, previous) => {
      if (view === 'board') return 'all';
      if (
        previous &&
        (previous.source.allPipelines !== allPipelines ||
          previous.source.pipelineId !== pipelineId ||
          previous.source.customerPartyId !== customerPartyId)
      ) {
        return 'all';
      }
      if (allPipelines) {
        if (param !== previous?.source.param) return parseStatusFilter(param);
        return previous ? parseStatusFilter(previous.value) : parseStatusFilter(param);
      }
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

  protected readonly pageSize = linkedSignal<
    { param: string | undefined; preferred: number },
    number
  >({
    source: () => ({ param: this.sizeParam(), preferred: this.pageSizePref.size() }),
    computation: ({ param, preferred }, previous) => {
      if (param !== previous?.source.param) return parsePageSize(param, preferred);
      if (!param && preferred !== previous?.source.preferred) return preferred;
      return previous?.value ?? parsePageSize(param, preferred);
    },
  });

  protected readonly sort = linkedSignal<string | undefined, string | null>({
    source: () => this.sortParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseSort(param);
      return previous?.value ?? parseSort(param);
    },
  });

  protected readonly activeStages = computed<PipelineStageView[]>(() => {
    if (this.allPipelines()) {
      return this.pipelines().flatMap((pipeline) => pipeline.stages);
    }
    return this.activePipeline()?.stages ?? [];
  });

  protected readonly cardsTableBody = computed<OpportunitySearchBody>(
    () => {
      const base = this.searchBody();
      if (!this.allPipelines()) return base;
      const status = parseStatusFilter(this.stage());
      if (status === 'all') return base;
      return appendAndLeaf(base, statusFilterLeaf(status));
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly tableEffectiveBody = computed<OpportunitySearchBody>(
    () => {
      const base = this.cardsTableBody();
      if (this.allPipelines()) return base;
      const stageId = this.stage();
      if (!stageId || stageId === 'all') return base;
      return appendAndLeaf(base, { field: 'stageId', operator: 'eq', value: stageId });
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly advancedOpen = signal(false);
  protected readonly advancedVisible = computed(
    () =>
      this.advancedOpen() ||
      this.store.draftDirty() ||
      this.store.facets().some((facet) => facet.field === ADVANCED_FACET_FIELD),
  );

  protected readonly reloadToken = signal(0);
  protected readonly resolvingBulk = signal(false);
  protected readonly bulkBusy = computed(() =>
    this.tracker.hasActive(CRM_OPPORTUNITIES_BULK_APP, CRM_OPPORTUNITIES_BULK_MODULE_ID),
  );

  private readonly stageCounts = signal<CountsState | null>(null);
  private countsTimer: ReturnType<typeof setTimeout> | null = null;
  private countsSeq = 0;
  private destroyed = false;

  private lastBodyJson = '';
  private readonly refreshedJobIds = new Set<string>();
  private lastHandledSelectJobKey = '';
  private selectFailedSeq = 0;
  private reopenSeq = 0;
  private syncedOpenId: string | null = null;

  protected readonly reopenText = computed(() => {
    this.i18n();
    const req = this.moves.reopenRequest();
    if (!req) return '';
    return this.transloco.translate('oppMoves.reopen.body', { stage: req.stageName });
  });

  protected readonly views = computed<ViewOption[]>(() => {
    this.i18n();
    return OPPORTUNITY_VIEWS.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`opportunities.page.views.${id}`),
    }));
  });

  protected readonly presets = computed<SearchOption[]>(() => {
    this.i18n();
    return OPPORTUNITY_PRESETS.map((value) => ({
      value,
      label: this.transloco.translate(`opportunities.search.presets.${value}`),
    }));
  });

  protected readonly fields = computed<SearchField[]>(() =>
    this.store
      .fields()
      .filter((field) => field.chip)
      .map((field) => {
        const merged = [...(field.specialOptions ?? []), ...(field.options ?? [])];
        const unique = new Map<string, SearchOption>();
        for (const opt of merged) {
          if (!unique.has(opt.value)) {
            unique.set(opt.value, { value: opt.value, label: opt.label });
          }
        }
        const options = unique.size > 0 ? Array.from(unique.values()) : undefined;
        return {
          id: field.id,
          label: field.label,
          ...(field.chipHint ? { hint: field.chipHint, chipHint: field.chipHint } : {}),
          ...(options ? { options } : {}),
        };
      }),
  );

  protected readonly stepFilterLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.allPipelines() ? 'opportunities.page.statusFilter.label' : 'opportunities.page.stageFilter.label',
    );
  });

  protected readonly stepFilterHint = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.allPipelines() ? 'opportunities.page.statusFilter.hint' : 'opportunities.page.stageFilter.hint',
    );
  });

  protected readonly stageSteps = computed<StepOption[]>(() => {
    this.i18n();
    const lang = this.language();
    const counts = this.stageCounts();

    if (this.allPipelines()) {
      const statusCounts = counts?.mode === 'status' ? counts : null;
      return [
        {
          id: 'all',
          label: this.transloco.translate('opportunities.page.statusFilter.all'),
          count: statusCounts ? statusCounts.all : null,
        },
        ...STATUS_FILTER_ORDER.map((statusId) => ({
          id: statusId,
          label: this.transloco.translate(`opportunities.page.statusFilter.${statusId}`),
          count: statusCounts ? (statusCounts.byKey[statusId] ?? 0) : null,
          ...(statusId === 'WON' ? { tone: 'success' as const } : statusId === 'LOST' ? { tone: 'danger' as const } : {}),
        })),
      ];
    }

    const stageCounts = counts?.mode === 'stage' ? counts : null;
    const active = (this.activePipeline()?.stages ?? [])
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.rank - b.rank);

    return [
      {
        id: 'all',
        label: this.transloco.translate('opportunities.page.stageFilter.all'),
        count: stageCounts ? stageCounts.all : null,
      },
      ...active.map((stage) => {
        const mappedTone = stageTone(stage.flag);
        const stepTone = mappedTone === 'success' || mappedTone === 'danger' ? mappedTone : undefined;
        return {
          id: stage.id,
          label: stageLabel(stage, lang),
          count: stageCounts ? (stageCounts.byKey[stage.id] ?? 0) : null,
          ...(stepTone ? { tone: stepTone } : {}),
        };
      }),
    ];
  });

  protected readonly pageRows = computed<OpportunitySelectionRow[]>(
    () => this.tableView()?.items() ?? [],
  );

  protected readonly visibleIds = computed<Set<string> | null>(() => {
    const table = this.tableView();
    const rows = table?.items() ?? [];
    if (rows.length === 0 && table?.list.loading()) return null;
    return new Set(rows.map((row) => row.id));
  });

  protected readonly matchingTotal = computed<number>(() => {
    const table = this.tableView();
    const loading = table?.list.loading() ?? false;
    const fromTable = table?.totalCount();
    if (typeof fromTable === 'number' && (fromTable > 0 || !loading)) {
      return fromTable;
    }
    const counts = this.stageCounts();
    if (!counts) return fromTable ?? 0;
    const activeStage = this.stage();
    return activeStage === 'all' ? counts.all : (counts.byKey[activeStage] ?? 0);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearCountsTimer();
    });

    void this.pipelineScope.ensureLoaded();

    this.lastBodyJson = JSON.stringify(this.tableEffectiveBody());
    this.selection.onBodyChange(this.tableEffectiveBody());

    effect(() => {
      const notice = this.pipelineScope.fallbackNotice();
      if (!notice) return;
      untracked(() => {
        this.notify.info(notice);
        this.pipelineScope.clearFallbackNotice();
      });
    });

    let lastBranchId: string | null = null;
    effect(() => {
      const branch = this.branchId();
      untracked(() => {
        if (lastBranchId !== null && lastBranchId !== branch) {
          this.selection.clear();
          this.setPage(DEFAULT_PAGE);
          this.reloadToken.update((n) => n + 1);
          void this.pipelineScope.ensureLoaded();
        }
        lastBranchId = branch;
      });
    });

    effect(() => {
      const branch = this.branchId();
      const pipelineId = this.allPipelines() ? null : (this.activePipeline()?.id ?? null);
      const customerPartyId = this.customerPartyId();
      const partyLabel = this.partyLabel();
      const stages = this.allPipelines()
        ? this.pipelines().flatMap((p) => p.stages)
        : (this.activePipeline()?.stages ?? []);
      const sources = this.sourcesResource.value() ?? [];
      const tags = this.tagsResource.value() ?? null;
      const currencies = this.currenciesResource.value() ?? [];
      const winReasons = this.winReasonsResource.value() ?? [];
      const lossReasons = this.lossReasonsResource.value() ?? [];

      const ownerOptions: FieldOption[] = (this.ownersResource.value() ?? []).map((owner) => ({
        value: owner.id,
        label: owner.displayName,
        ...(owner.avatarUrl ? { icon: owner.avatarUrl } : {}),
      }));
      const teamOptions: FieldOption[] = (this.teamsResource.value() ?? []).map((team) => ({
        value: team.id,
        label: team.label,
      }));

      untracked(() => {
        this.cacheFieldOptions('owner', ownerOptions, this.loadedOwners);
        this.cacheFieldOptions('createdBy', ownerOptions);
        this.cacheFieldOptions('ownerTeam', teamOptions, this.loadedTeams);

        this.store.init({
          branchId: branch,
          pipelineId,
          customerPartyId,
          partyLabel,
          stages,
          sources,
          tags,
          currencies,
          winReasons,
          lossReasons,
          ownerOptions,
          teamOptions,
          owners: async (term: string) => {
            const list = this.ownersResource.value() ?? (await listOwners(branch).catch(() => []));
            const mapped: FieldOption[] = list.map((owner) => ({
              value: owner.id,
              label: owner.displayName,
              ...(owner.avatarUrl ? { icon: owner.avatarUrl } : {}),
            }));
            this.cacheFieldOptions('owner', mapped, this.loadedOwners);
            this.cacheFieldOptions('createdBy', mapped);
            const clean = term.trim().toLowerCase();
            return clean ? mapped.filter((o) => o.label.toLowerCase().includes(clean)) : mapped;
          },
          teams: async (term: string) => {
            const list =
              this.teamsResource.value() ??
              (await assignmentOptions('')
                .then((res) => res.teams)
                .catch(() => []));
            const mapped: FieldOption[] = list.map((team) => ({
              value: team.id,
              label: team.label,
            }));
            this.cacheFieldOptions('ownerTeam', mapped, this.loadedTeams);
            const clean = term.trim().toLowerCase();
            return clean ? mapped.filter((t) => t.label.toLowerCase().includes(clean)) : mapped;
          },
          customers: async (term: string) => {
            const list = await searchCustomerOptions(branch, term).catch(() => []);
            const mapped: FieldOption[] = list.map((customer) => ({
              value: customer.id,
              label: customer.companyName?.trim() || customer.displayName,
            }));
            rememberFieldOptions('customerRecord', mapped);
            return mapped;
          },
        });
      });
    });

    let seenUrlView = Boolean(parseView(this.view()));
    effect(() => {
      if (this.allPipelines()) return;
      const fromUrl = parseView(this.view());
      if (fromUrl) {
        seenUrlView = true;
        if (fromUrl !== untracked(() => this.preferredView())) {
          this.preferredView.set(fromUrl);
          writeStoredView(fromUrl);
        }
      } else if (seenUrlView) {
        seenUrlView = false;
        if (untracked(() => this.preferredView()) !== 'board') {
          this.preferredView.set('board');
          writeStoredView('board');
        }
      }
    });

    effect(() => {
      const loaded = this.pipelinesLoaded();
      const empty = this.hasNoPipeline();
      const view = this.current();
      const allMode = this.allPipelines();
      const pipelineId = this.activePipeline()?.id ?? null;
      this.searchBody();
      untracked(() => {
        if (!loaded || empty || view === 'board' || (!allMode && !pipelineId)) {
          this.clearCountsTimer();
          return;
        }
        this.loadStageCounts();
      });
    });

    effect(() => {
      this.tableEffectiveBody();
      untracked(() => this.syncBodySelection());
    });

    effect(() => {
      if (this.allPipelines() || (this.current() === 'board' && this.queryParams()?.get('select') !== 'failed')) {
        untracked(() => {
          if (this.selection.count() > 0 || this.selection.mode() === 'all') {
            this.selection.clear();
          }
        });
      }
    });

    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.refreshedJobIds.add(initialFinished.id);
    }

    effect(() => {
      const finished = this.tracker.finished();
      const currentBranch = this.branchId();
      if (!finished || finished.module !== CRM_OPPORTUNITIES_BULK_MODULE_ID) return;
      if (finished.scope.branchId && finished.scope.branchId !== currentBranch) return;
      if (this.refreshedJobIds.has(finished.id)) return;
      this.refreshedJobIds.add(finished.id);
      untracked(() => {
        this.refreshListAndCounts();
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
        this.tracker
          .jobs()
          .find(
            (job) =>
              job.app === CRM_OPPORTUNITIES_BULK_APP &&
              job.module === CRM_OPPORTUNITIES_BULK_MODULE_ID &&
              job.counts.failed > 0,
          )?.id ??
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

    effect(() => {
      const req = this.moves.reopenRequest();
      const seq = ++this.reopenSeq;
      if (!req) return;
      untracked(() => {
        queueMicrotask(() => {
          if (seq !== this.reopenSeq || !this.moves.reopenRequest()) return;
          const dialog = this.reopenDialog();
          if (!dialog) {
            this.moves.resolveReopen(false);
            return;
          }
          void dialog.open().then((confirmed) => {
            if (seq === this.reopenSeq) {
              this.moves.resolveReopen(confirmed);
            }
          });
        });
      });
    });

    effect(() => {
      const openId = this.openParam()?.trim() || null;
      if (openId === this.syncedOpenId) return;
      this.syncedOpenId = openId;
      untracked(() => {
        if (openId) {
          void this.opportunityModal().openRecord(openId, null);
        } else {
          this.opportunityModal().syncClosedFromUrl();
        }
      });
    });
  }

  /** Opens an opportunity record in the quick modal. */
  openRecord(row: OpportunityRow, nav?: RecordNavContext | null): void {
    void this.opportunityModal().openRecord(row.id, nav ?? null);
  }

  /** Opens opportunity creation in the quick modal. */
  openCreate(stageId?: string): void {
    if (!this.canCreate()) return;
    const pipelineId = this.activePipeline()?.id ?? this.pipelines()[0]?.id ?? '';
    if (!pipelineId) return;
    this.opportunityModal().openCreate({ pipelineId, stageId: stageId ?? null });
  }

  /** Route leave guard delegating to the quick modal unsaved-changes check. */
  canDeactivate(): Promise<boolean> {
    return this.opportunityModal().canDeactivate();
  }

  protected onModalOpenIdChange(id: string | null): void {
    const normalized = id?.trim() || null;
    this.syncedOpenId = normalized;
    const currentParam = this.openParam()?.trim() || null;
    if (currentParam === normalized) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: normalized },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected selectPipeline(pipelineId: string | null): void {
    if (pipelineId === null) {
      if (this.allPipelines()) return;
      this.allPipelines.set(true);
      this.selection.clear();
      this.stage.set('all');
      this.page.set(DEFAULT_PAGE);
      this.syncBodySelection();
      void this.router.navigate([], {
        queryParams: {
          view: this.current() === 'cards' ? 'cards' : null,
          stage: null,
          page: null,
        },
        queryParamsHandling: 'merge',
      });
      return;
    }

    const switchingMode = this.allPipelines();
    const switchingPipeline = this.activePipeline()?.id !== pipelineId;
    if (!switchingMode && !switchingPipeline) return;

    this.allPipelines.set(false);
    this.pipelineScope.select(pipelineId);
    this.selection.clear();
    this.stage.set('all');
    this.page.set(DEFAULT_PAGE);
    this.syncBodySelection();
    void this.router.navigate([], {
      queryParams: {
        stage: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected show(view: string): void {
    const parsed = parseView(view);
    if (!parsed) return;
    if (this.allPipelines() && parsed === 'board') return;

    if (!this.allPipelines()) {
      this.preferredView.set(parsed);
      writeStoredView(parsed);
    }

    if (parsed !== this.current()) {
      this.page.set(DEFAULT_PAGE);
    }
    if (parsed === 'board') {
      this.stage.set('all');
      this.page.set(DEFAULT_PAGE);
      this.selection.clear();
      this.syncBodySelection();
    }
    if (parsed !== 'table') {
      this.sort.set(null);
    }

    void this.router.navigate([], {
      queryParams: {
        view: parsed === 'board' ? null : parsed,
        stage: parsed === 'board' || this.stage() === 'all' ? null : this.stage(),
        page: parsed === 'board' || this.page() === DEFAULT_PAGE ? null : this.page(),
        size:
          parsed === 'board' || this.pageSize() === this.pageSizePref.defaultSize()
            ? null
            : this.pageSize(),
        sort: parsed === 'table' && this.sort() ? this.sort() : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected filterStage(stage = 'all'): void {
    const next = this.allPipelines() ? parseStatusFilter(stage) : stage || 'all';
    this.stage.set(next);
    this.page.set(DEFAULT_PAGE);
    this.syncBodySelection();
    void this.router.navigate([], {
      queryParams: {
        stage: next === 'all' ? null : next,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    const next = Math.max(DEFAULT_PAGE, page);
    this.page.set(next);
    void this.router.navigate([], {
      queryParams: { page: next === DEFAULT_PAGE ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number): void {
    if (!PAGE_SIZES.includes(size)) return;
    this.pageSizePref.set(size);
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        size: size === this.pageSizePref.defaultSize() ? null : size,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(sort: string | null): void {
    const next = sort ? parseSort(sort) : null;
    this.sort.set(next);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        sort: next ?? null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setFacets(facets: SearchFacet[]): void {
    const hadCustomer = this.customerPartyId() !== null;
    const hasCustomer = facets.some((item) => item.field === CUSTOMER_PARTY_FACET_FIELD);
    const rest = facets.filter((item) => item.field !== CUSTOMER_PARTY_FACET_FIELD);
    const prevRest = this.store.facets().filter((item) => item.field !== CUSTOMER_PARTY_FACET_FIELD);
    const restChanged =
      JSON.stringify(rest.map((f) => [f.field, f.values.map((v) => v.value)])) !==
      JSON.stringify(prevRest.map((f) => [f.field, f.values.map((v) => v.value)]));

    if (hadCustomer && !hasCustomer) {
      this.allPipelines.set(false);
      this.stage.set('all');
      this.page.set(DEFAULT_PAGE);
      this.selection.clear();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { customerPartyId: null, partyLabel: null, stage: null, page: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    if (restChanged || !hadCustomer) {
      const before = JSON.stringify(this.store.body());
      this.store.setFacets(rest);
      if (JSON.stringify(this.store.body()) !== before) {
        this.syncBodySelection();
        if (!(hadCustomer && !hasCustomer)) {
          this.setPage(DEFAULT_PAGE);
        }
      }
    }
  }

  protected applyAdvanced(query: Query): void {
    this.store.setApplied(query);
    this.syncBodySelection();
    this.setPage(DEFAULT_PAGE);
  }

  protected clearAdvanced(): void {
    this.store.clear();
    this.syncBodySelection();
    this.setPage(DEFAULT_PAGE);
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  protected onFacetChipClick(facet: SearchFacet): void {
    if (facet.field === ADVANCED_FACET_FIELD) {
      this.advancedOpen.set(true);
      this.queryBuilder()?.open();
    }
  }

  protected openActivities(row: OpportunityRow): void {
    this.recordActivities().open({
      app: 'CRM',
      type: 'OPPORTUNITY',
      id: row.id,
      label: row.title,
    });
  }

  protected async transferOpportunity(row: OpportunityRow): Promise<void> {
    const outcome = await this.moves.transfer(row, this.pipelines());
    if (outcome.kind === 'moved') {
      this.refreshListAndCounts();
    }
  }

  protected onViewCountsChanged(): void {
    this.loadStageCounts(true);
  }

  protected refreshListAndCounts(): void {
    this.reloadToken.update((n) => n + 1);
    this.boardView()?.refresh();
    this.cardsView()?.refresh();
    this.tableView()?.refresh();
    this.loadStageCounts(true);
  }

  protected async openBulkAction(action: OpportunityBulkMenuAction): Promise<void> {
    if (this.resolvingBulk() || this.bulkBusy() || this.selection.count() <= 0 || this.allPipelines()) return;
    this.resolvingBulk.set(true);
    let rows: OpportunitySelectionRow[];
    try {
      rows = await this.selection.resolve();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BULK_SELECTION_TOO_LARGE') {
        this.notify.error(this.transloco.translate('oppBulk.bar.tooMany'));
      } else {
        this.notify.error(translateOpportunityBulkError(this.transloco, errorCodeOf(error)));
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

  protected retryPipelines(): void {
    void this.pipelineScope.reload();
  }

  protected canManagePipelines(): boolean {
    return checkCanManagePipelines();
  }

  protected loadStageCounts(immediate = false): void {
    this.clearCountsTimer();
    if (!this.pipelinesLoaded() || this.hasNoPipeline() || this.current() === 'board') return;

    const run = () => {
      const seq = ++this.countsSeq;
      void this.fetchStageCounts(seq);
    };

    if (immediate) {
      run();
      return;
    }

    this.countsTimer = setTimeout(() => {
      this.countsTimer = null;
      run();
    }, COUNTS_DEBOUNCE_MS);
  }

  private async fetchStageCounts(seq: number): Promise<void> {
    const allMode = this.allPipelines();
    const baseBody = this.searchBody();

    try {
      if (allMode) {
        const [allRes, openRes, wonRes, lostRes] = await Promise.all([
          searchOpportunities(baseBody, 1, 1),
          searchOpportunities(appendAndLeaf(baseBody, statusFilterLeaf('OPEN')), 1, 1),
          searchOpportunities(appendAndLeaf(baseBody, statusFilterLeaf('WON')), 1, 1),
          searchOpportunities(appendAndLeaf(baseBody, statusFilterLeaf('LOST')), 1, 1),
        ]);
        if (seq !== this.countsSeq || this.destroyed) return;
        this.stageCounts.set({
          mode: 'status',
          all: allRes.total,
          byKey: {
            OPEN: openRes.total,
            WON: wonRes.total,
            LOST: lostRes.total,
          },
        });
        return;
      }

      const pipeline = this.activePipeline();
      if (!pipeline) return;
      const res = await loadBoard(pipeline.id, { ...baseBody, limitPerStage: 0 });
      if (seq !== this.countsSeq || this.destroyed) return;

      const byKey: Record<string, number> = {};
      let all = 0;
      for (const lane of res.stages) {
        byKey[lane.stage.id] = lane.summary.totalCount;
        all += lane.summary.totalCount;
      }
      this.stageCounts.set({ mode: 'stage', all, byKey });
    } catch (error) {
      if (seq !== this.countsSeq || this.destroyed) return;
      const code = errorCodeOf(error);
      if (code === 'OPPORTUNITY_PIPELINE_MISMATCH') {
        this.notify.error(this.transloco.translate(OPPORTUNITY_ERROR_KEYS['OPPORTUNITY_PIPELINE_MISMATCH']));
        this.refreshListAndCounts();
        return;
      }
      const searchErrKey = opportunitySearchErrorKey(error);
      if (searchErrKey) {
        if (error instanceof ApiError && error.status === 422) {
          this.notify.warning(this.transloco.translate(searchErrKey));
        } else {
          this.notify.error(this.transloco.translate(searchErrKey));
        }
      }
    }
  }

  private clearCountsTimer(): void {
    if (this.countsTimer !== null) {
      clearTimeout(this.countsTimer);
      this.countsTimer = null;
    }
  }

  private cacheFieldOptions(
    fieldId: string,
    list: readonly FieldOption[],
    targetSignal?: typeof this.loadedOwners,
  ): void {
    if (list.length === 0) return;
    rememberFieldOptions(fieldId, list);
    if (!targetSignal) return;
    targetSignal.update((prev) => {
      const merged = new Map(prev.map((item) => [item.value, item]));
      let added = false;
      for (const item of list) {
        const existing = merged.get(item.value);
        if (!existing || existing.label !== item.label) {
          merged.set(item.value, item);
          added = true;
        }
      }
      return added ? Array.from(merged.values()) : prev;
    });
  }

  private async loadFailedSelection(jobId: string): Promise<void> {
    const seq = ++this.selectFailedSeq;
    const selectedRows: OpportunitySelectionRow[] = [];
    let dropped = 0;
    let page = 1;
    let fetched = 0;

    try {
      while (fetched < OPPORTUNITY_SELECTION_LIMIT) {
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
            title: item.label,
            ownerUserId: typeof item.current['ownerUserId'] === 'string' ? item.current['ownerUserId'] : null,
            stageId: typeof item.current['stageId'] === 'string' ? item.current['stageId'] : '',
            status: (typeof item.current['status'] === 'string'
              ? item.current['status']
              : 'IN_PROGRESS') as OpportunityStatus,
            updatedAt: typeof item.current['updatedAt'] === 'string' ? item.current['updatedAt'] : '',
          });
        }

        if (fetched >= res.total || res.items.length < 100) break;
        page++;
      }

      if (seq !== this.selectFailedSeq) return;
      this.selection.replaceWith(selectedRows);

      if (dropped > 0) {
        this.notify.warning(this.transloco.translate('oppBulk.job.unavailable', { n: dropped }));
      }
    } catch {
      if (seq !== this.selectFailedSeq) return;
      this.notify.error(this.transloco.translate('opportunities.page.loadFailed'));
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
    const next = this.tableEffectiveBody();
    const nextJson = JSON.stringify(next);
    if (nextJson === this.lastBodyJson) return;
    this.lastBodyJson = nextJson;
    this.selection.onBodyChange(next);
  }
}
