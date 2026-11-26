import {
  Component,
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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerLayoutGrid,
  tablerLayoutKanban,
  tablerPlus,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { ApiError, correlationIdOf } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { FieldOption, Query } from '../../../../shared/query-builder/query.model';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FacetSearch } from '../../../../shared/ui/facet-search/facet-search';
import {
  SearchFacet,
  SearchField,
  SearchOption,
} from '../../../../shared/ui/facet-search/facet-search.model';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { RecordActivities } from '../../../../shared/widgets/activities/record-activities/record-activities';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { listTags } from '../../settings/tags/tags.api';
import { listReasons } from '../../settings/reasons/reasons.api';
import { assignmentOptions } from '../../settings/pipelines/pipelines.api';
import { settingsTimeZone } from '../../settings/shared/settings-time-zone';
import { runInCrm } from '../../shared/crm-runtime';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { createRecordSearchStore } from '../../shared/record/search/record-search-store';
import {
  getOpportunityCapabilities,
  listCurrencies,
  listOwners,
  listPipelines,
  loadBoard,
  searchCustomerOptions,
} from '../opportunities.api';
import {
  OPPORTUNITY_VIEWS,
  OpportunityRow,
  OpportunitySearchBody,
  OpportunityView,
  stageLabel,
} from '../opportunities.model';
import { canCreateOpportunity, opportunityErrorMessage } from '../opportunity-card/opportunity-card';
import { OpportunityModal } from '../opportunity-modal/opportunity-modal';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { CloseDialog } from '../opportunity-moves/close-dialog/close-dialog';
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
import { OpportunitySearchBuilder } from '../opportunity-search/opportunity-search-builder';
import { withoutPipelineFilter } from '../opportunity-search/opportunity-search-errors';
import { OpportunityTable } from '../opportunity-table/opportunity-table';
import { OpportunityBoard } from '../opportunity-board/opportunity-board';
import { OpportunityCards } from '../opportunity-cards/opportunity-cards';
import { PipelineSwitcher } from '../pipeline-switcher/pipeline-switcher';

const VIEW_STORAGE_KEY = 'opportunities.view';
const VIEW_ICONS = { board: 'tablerLayoutKanban', cards: 'tablerLayoutGrid', table: 'tablerTable' };
const SORT_PATTERN =
  /^(title|importance|amount|probabilityPercent|expectedCloseDate|createdAt|updatedAt|stageEnteredAt):(ASC|DESC)$/;
function parseView(raw: string | null | undefined): OpportunityView | null {
  return OPPORTUNITY_VIEWS.find((view) => view === raw) ?? null;
}
function storedView(): OpportunityView {
  try {
    return parseView(localStorage.getItem(VIEW_STORAGE_KEY)) ?? 'table';
  } catch {
    return 'table';
  }
}
function parsePage(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
type SearchContext = Omit<OpportunitySearchFieldsContext, 't' | 'language'>;

@Component({
  selector: 'app-opportunities-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    FacetSearch,
    Field,
    FullState,
    ViewSwitcher,
    OpportunitySearchBuilder,
    OpportunityTable,
    OpportunityBoard,
    OpportunityCards,
    PipelineSwitcher,
    StepFilter,
    OpportunityModal,
    RecordActivities,
    CloseDialog,
    PipelineMoveDialog,
  ],
  providers: [
    OpportunityMoves,
    provideTranslocoScope('opportunities', { scope: 'opportunity-moves', alias: 'oppMoves' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerLayoutGrid,
      tablerLayoutKanban,
      tablerPlus,
      tablerTable,
    }),
  ],
  templateUrl: './opportunities-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class OpportunitiesPage implements CanLeaveRecord {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild(OpportunityModal);
  private readonly activities = viewChild(RecordActivities);
  private readonly builder = viewChild(OpportunitySearchBuilder);
  private readonly table = viewChild(OpportunityTable);
  private readonly board = viewChild(OpportunityBoard);
  private readonly cards = viewChild(OpportunityCards);
  private readonly language = inject(LanguageState).current;
  private readonly reopenDialog = viewChild<ConfirmDialog>('reopenDialog');
  protected readonly moves = inject(OpportunityMoves);
  private syncedOpenId: string | null = null;

  readonly view = input<string>();
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });
  readonly openParam = input<string | undefined>(undefined, { alias: 'open' });
  readonly customerPartyIdParam = input<string | undefined>(undefined, {
    alias: 'customerPartyId',
  });
  readonly partyLabelParam = input<string | undefined>(undefined, { alias: 'partyLabel' });

  private readonly preferredView = signal(storedView());
  protected readonly current = computed(() => parseView(this.view()) ?? this.preferredView());
  protected readonly branch = computed(() => runInCrm(() => sessionBranch()));
  protected readonly readable = computed(() => {
    this.tenantScope.me();
    return can('crm.opportunities.read');
  });
  private readonly requestBranch = computed(() =>
    this.readable() ? this.branch()?.branchId : undefined,
  );
  protected readonly page = linkedSignal(() => parsePage(this.pageParam()));
  protected readonly pageSize = linkedSignal(() =>
    [20, 50, 100].includes(Number(this.sizeParam())) ? Number(this.sizeParam()) : 20,
  );
  protected readonly sort = linkedSignal(() =>
    SORT_PATTERN.test(this.sortParam() ?? '') ? this.sortParam()! : null,
  );
  protected readonly advancedOpen = signal(false);
  protected readonly searchError = signal<unknown>(null);
  protected readonly writeDenied = signal(false);
  protected readonly activityTarget = signal<OpportunityRow | null>(null);
  protected readonly modalMounted = signal(false);
  private readonly createPipeline = signal<string | null>(null);
  private readonly createStage = signal<string | undefined>(undefined);
  private readonly customerDenied = signal(false);
  private readonly resetPipeline = signal(false);
  private readonly capabilitiesResource = resource({
    params: this.requestBranch,
    loader: ({ params }) => getOpportunityCapabilities(params),
  });
  private readonly pipelinesResource = resource({
    params: this.requestBranch,
    loader: () => listPipelines(),
  });
  private readonly tagsResource = resource({
    params: this.requestBranch,
    loader: () => listTags(),
  });
  private readonly sourcesResource = resource({
    params: this.requestBranch,
    loader: () => listLeadSources(),
  });
  private readonly ownersResource = resource({
    params: this.requestBranch,
    loader: ({ params }) => listOwners(params),
  });
  private readonly currenciesResource = resource({
    params: this.requestBranch,
    loader: () => listCurrencies(),
  });
  private readonly zoneResource = resource({
    params: this.requestBranch,
    loader: () => runInCrm(() => settingsTimeZone()),
  });
  private readonly reasonsResource = resource({
    params: this.requestBranch,
    loader: () => listReasons({ active: 'true' }),
  });
  private readonly teamsResource = resource({
    params: this.requestBranch,
    loader: () => assignmentOptions(),
  });
  protected readonly timeZone = computed(() =>
    this.zoneResource.hasValue() ? (this.zoneResource.value() ?? 'UTC') : 'UTC',
  );
  protected readonly pipelines = computed(() =>
    this.pipelinesResource.hasValue() ? this.pipelinesResource.value() : [],
  );
  protected readonly stages = computed(() =>
    this.pipelines().flatMap((pipeline) => pipeline.stages),
  );
  private readonly selectedPipeline = signal<string | null>(readPipeline());
  protected readonly currentPipeline = computed(() => {
    const pipelines = this.pipelines();
    return pipelines.find((pipeline) => pipeline.id === this.selectedPipeline())
      ?? pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0] ?? null;
  });
  protected readonly pipelineLoading = this.pipelinesResource.isLoading;
  protected readonly pipelineError = this.pipelinesResource.error;
  protected readonly pipelineDenied = computed(() => {
    const error = this.pipelineError();
    return error instanceof ApiError && error.status === 403;
  });
  protected readonly stage = linkedSignal(() => {
    this.currentPipeline();
    return 'all';
  });
  protected readonly capabilities = computed(() =>
    !this.writeDenied() && this.capabilitiesResource.hasValue()
      ? this.capabilitiesResource.value()
      : null,
  );
  protected readonly canCreate = computed(
    () => !!this.currentPipeline()?.isActive && canCreateOpportunity(this.capabilities()),
  );
  protected readonly forbidden = computed(
    () =>
      this.capabilitiesResource.error() instanceof ApiError &&
      (this.capabilitiesResource.error() as ApiError).status === 403,
  );

  protected readonly store = createRecordSearchStore<SearchContext, OpportunitySearchBody>({
    fields: (ctx, { language, t }) => opportunitySearchFields({ ...ctx, language, t }),
    compile: (query, _ctx, { currentUserId, timeZone }) =>
      compileOpportunityQuery(query, {
        branchId: this.branch()?.branchId ?? '',
        pipelineId: null,
        customerPartyId: this.customerPartyIdParam(),
        meUserId: currentUserId,
        timeZone,
      }),
    defaultQuery: () => defaultOpportunityQuery(),
    emptyQuery: () => emptyOpportunityQuery(),
    facetsToQuery: (facets, _ctx, { prev, fields }) => {
      const result = facetsToQuery(prev, facets, fields, { timeZone: this.timeZone() });
      return {
        query: result.query,
        rejected: result.rejected.map((item) => ({
          field: item.field,
          reasonKey: `search.rejected.${item.code}`,
        })),
      };
    },
    queryToFacets: (query, _ctx, { fields, t }) => {
      const facets = queryToFacets(query, fields, t, { timeZone: this.timeZone() });
      const party = this.customerPartyIdParam();
      return party
        ? [
            {
              field: CUSTOMER_PARTY_FACET_FIELD,
              label: t('opportunities.page.customerChip'),
              values: [{ value: party, label: this.partyLabelParam() || party }],
            },
            ...facets,
          ]
        : facets;
    },
    rejectedKeyPrefix: 'opportunities.',
    currentUserId: () => this.tenantScope.me()?.id ?? '',
    timeZone: () => this.timeZone(),
    initialCtx: {
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
  protected readonly searchBody = computed(() => {
    const body = this.store.body();
    const filterTree = this.resetPipeline()
      ? withoutPipelineFilter(body.filterTree)
      : body.filterTree;
    return { ...body, filterTree, ...(this.sort() ? { sort: this.sort()! } : {}) };
  });
  private readonly summaries = resource({
    params: () => this.current() === 'cards' && this.currentPipeline() && this.requestBranch()
      ? { pipelineId: this.currentPipeline()!.id, body: this.searchBody() } : undefined,
    loader: ({ params }) => loadBoard(params.pipelineId, { ...params.body, limitPerStage: 0 }),
  });
  protected readonly summaryFailure = computed(() => {
    const error = this.summaries.error();
    return error && !opportunitySearchErrorKey(error) ? error : null;
  });
  protected readonly summaryForbidden = computed(() => {
    const error = this.summaryFailure();
    return error instanceof ApiError && error.status === 403;
  });
  protected retrySummaries(): void { this.summaries.reload(); }
  protected correlationId(error: unknown): string { return correlationIdOf(error) ?? ''; }
  protected readErrorTitle(error: unknown, key: string): string {
    this.i18n();
    return error instanceof ApiError && error.status === 429
      ? opportunityErrorMessage(error, this.transloco, key) : this.transloco.translate(key);
  }
  protected readonly stageSteps = computed<StepOption[]>(() => {
    this.i18n();
    const lanes = this.summaries.hasValue() ? this.summaries.value().stages : [];
    return [
      { id: 'all', label: this.transloco.translate('opportunities.page.stageFilter.all'), count: this.summaries.hasValue() ? lanes.reduce((n, lane) => n + lane.summary.totalCount, 0) : null },
      ...(this.currentPipeline()?.stages ?? []).map((stage): StepOption => ({
        id: stage.id, label: stageLabel(stage, this.language()),
        count: lanes.find((lane) => lane.stage.id === stage.id)?.summary.totalCount,
        tone: stage.flag === 'LOST' ? 'danger' : stage.flag === 'WON' ? 'success' : 'brand',
      })),
    ];
  });
  protected readonly advancedVisible = computed(
    () =>
      this.advancedOpen() ||
      this.store.draftDirty() ||
      this.store.facets().some((facet) => facet.field === ADVANCED_FACET_FIELD),
  );
  protected readonly views = computed(() => {
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
  private readonly deniedFieldIds = computed(() => {
    const denied = (error: unknown) => error instanceof ApiError && error.status === 403;
    return new Set([
      ...(denied(this.pipelinesResource.error()) ? ['stage'] : []),
      ...(denied(this.tagsResource.error()) ? ['tags'] : []),
      ...(denied(this.sourcesResource.error()) ? ['leadSource'] : []),
      ...(denied(this.reasonsResource.error()) ? ['winReason', 'lostReason'] : []),
      ...(denied(this.ownersResource.error()) ? ['owner', 'createdBy'] : []),
      ...(denied(this.teamsResource.error()) ? ['ownerTeam'] : []),
      ...(this.customerDenied() || !can('crm.customer_profiles.read') ? ['customerRecord'] : []),
    ]);
  });
  protected readonly restrictedFields = computed(() =>
    this.store.fields().filter((field) => this.deniedFieldIds().has(field.id)),
  );
  protected readonly availableFields = computed(() =>
    this.store.fields().filter((field) => !this.deniedFieldIds().has(field.id)),
  );
  protected readonly fields = computed<SearchField[]>(() =>
    this.availableFields()
      .filter((field) => field.chip)
      .map((field) => ({
        id: field.id,
        label: field.label,
        hint: field.chipHint || field.hint,
        chipHint: field.chipHint || field.hint,
        options: [...(field.specialOptions ?? []), ...(field.options ?? [])],
      })),
  );

  constructor() {
    effect(() => {
      const error = this.summaries.error();
      if (error) untracked(() => this.onSearchError(error));
    });
    effect(() => {
      const pipelineId = this.createPipeline();
      const modal = this.modal();
      if (pipelineId && modal)
        untracked(() => {
          this.createPipeline.set(null);
          modal.openCreate({ pipelineId, ...(this.createStage() ? { stageId: this.createStage() } : {}) });
        });
    });
    effect(() => {
      const target = this.activityTarget();
      const activities = this.activities();
      if (target && activities)
        untracked(() =>
          activities.open({ app: 'CRM', type: 'OPPORTUNITY', id: target.id, label: target.title }),
        );
    });
    effect(() => {
      const owners = this.ownersResource.hasValue() ? this.ownersResource.value() : [];
      const teams = this.teamsResource.hasValue() ? this.teamsResource.value().teams : [];
      const reasons = this.reasonsResource.hasValue() ? this.reasonsResource.value().items : [];
      const branchId = this.requestBranch();
      const ctx: SearchContext = {
        stages: this.stages(),
        sources: this.sourcesResource.hasValue() ? this.sourcesResource.value() : [],
        tags: this.tagsResource.hasValue() ? this.tagsResource.value() : [],
        currencies: this.currenciesResource.hasValue() ? this.currenciesResource.value() : [],
        winReasons: reasons
          .filter((reason) => reason.reasonKind === 'WIN')
          .map((reason) => ({ ...reason, reasonKind: 'WIN' })),
        lossReasons: reasons
          .filter((reason) => reason.reasonKind === 'LOSS')
          .map((reason) => ({ ...reason, reasonKind: 'LOSS' })),
        owners: async (term) =>
          owners
            .filter((owner) => owner.displayName.toLowerCase().includes(term.toLowerCase()))
            .map((owner) => ({ value: owner.id, label: owner.displayName })),
        teams: async (term) =>
          teams
            .filter((team) => team.label.toLowerCase().includes(term.toLowerCase()))
            .map((team) => ({ value: team.id, label: team.label })),
        customers: async (term): Promise<FieldOption[]> => {
          if (!branchId || this.customerDenied() || !can('crm.customer_profiles.read')) return [];
          try {
            return (await searchCustomerOptions(branchId, term)).map((customer) => ({
              value: customer.id,
              label: customer.companyName || customer.displayName,
            }));
          } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
              this.customerDenied.set(true);
              return [];
            }
            throw error;
          }
        },
      };
      untracked(() => this.store.init(ctx));
    });
    effect(() => {
      const request = this.moves.reopenRequest();
      const dialog = this.reopenDialog();
      if (request && dialog)
        untracked(
          () => void dialog.open().then((confirmed) => this.moves.resolveReopen(confirmed)),
        );
    });
    effect(() => {
      const branch = this.branch()?.branchId;
      const modal = this.modal();
      const id = this.openParam()?.trim() || null;
      if (!branch || !this.readable() || !modal || id === this.syncedOpenId) return;
      this.syncedOpenId = id;
      untracked(() => {
        if (id) void modal.openRecord(id, null);
        else modal.syncClosedFromUrl();
      });
    });
    let previousBranch = this.branch()?.branchId;
    effect(() => {
      const branch = this.branch()?.branchId;
      if (branch === previousBranch) return;
      previousBranch = branch;
      untracked(() => {
        this.searchError.set(null);
        this.customerDenied.set(false);
        this.writeDenied.set(false);
        this.setPage(1);
      });
    });
  }
  openRecord(row: OpportunityRow, _nav?: RecordNavContext | null): void {
    void this.router.navigate(['/crm/opportunities', row.id]);
  }
  openCreate(stageId?: string): void {
    if (!this.canCreate()) return;
    const pipeline = this.currentPipeline();
    if (!pipeline) return;
    this.createPipeline.set(pipeline.id);
    this.createStage.set(stageId);
    this.modalMounted.set(true);
  }
  canDeactivate(): Promise<boolean> {
    return this.modal()?.canDeactivate() ?? Promise.resolve(true);
  }
  protected onModalOpenIdChange(open: string | null): void {
    this.syncedOpenId = open;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected show(raw: string): void {
    const view = parseView(raw);
    if (!view) return;
    this.preferredView.set(view);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* Storage is optional. */
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
    });
  }
  protected setPage(page: number): void {
    this.page.set(page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }
  protected setPageSize(size: number): void {
    if (![20, 50, 100].includes(size)) return;
    this.pageSize.set(size);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { size, page: null },
      queryParamsHandling: 'merge',
    });
  }
  protected setSort(sort: string | null): void {
    this.sort.set(sort && SORT_PATTERN.test(sort) ? sort : null);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: this.sort(), page: null },
      queryParamsHandling: 'merge',
    });
  }
  protected setFacets(facets: SearchFacet[]): void {
    if (
      this.customerPartyIdParam() &&
      !facets.some((facet) => facet.field === CUSTOMER_PARTY_FACET_FIELD)
    ) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { customerPartyId: null, partyLabel: null },
        queryParamsHandling: 'merge',
      });
    }
    this.searchError.set(null);
    this.store.setFacets(facets.filter((facet) => facet.field !== CUSTOMER_PARTY_FACET_FIELD));
    this.setPage(1);
  }
  protected applyAdvanced(query: Query): void {
    this.searchError.set(null);
    this.store.setApplied(query);
    this.setPage(1);
  }
  protected clearAdvanced(): void {
    this.searchError.set(null);
    this.store.clear();
    this.setPage(1);
  }
  protected onFacetChipClick(facet: SearchFacet): void {
    if (facet.field === ADVANCED_FACET_FIELD || facet.field === 'tags') {
      this.advancedOpen.set(true);
      this.builder()?.open(facet.field === 'tags' ? 'tags' : undefined);
    }
  }
  protected onSearchError(error: unknown): void {
    this.searchError.set(error);
    if (opportunitySearchErrorKey(error)) {
      this.advancedOpen.set(true);
      if (error instanceof ApiError && error.code === 'OPPORTUNITY_FILTER_TAGS_CONFLICT')
        this.builder()?.open('tags');
    }
    if (error instanceof ApiError && error.code === 'PIPELINE_NOT_FOUND') {
      const tree = this.store.body().filterTree;
      if (JSON.stringify(withoutPipelineFilter(tree)) !== JSON.stringify(tree))
        this.resetPipeline.set(true);
    }
  }
  protected openActivities(row: OpportunityRow): void {
    this.activityTarget.set({ ...row });
  }
  protected async transferOpportunity(row: OpportunityRow): Promise<void> {
    const result = await this.moves.transfer(row, this.pipelines());
    if (result.kind === 'moved') this.refresh();
    if (
      result.kind === 'failed' &&
      [
        'CRM_OPPORTUNITIES_DISABLED',
        'CRM_SUBSCRIPTION_READ_ONLY',
        'SEAT_OVER_CAPACITY_READ_ONLY',
      ].includes(result.code ?? '')
    )
      this.writeDenied.set(true);
  }
  protected refresh(): void {
    this.table()?.refresh();
    this.board()?.refresh();
    this.cards()?.refresh();
    this.summaries.reload();
  }
  protected selectPipeline(id: string | null): void {
    this.selectedPipeline.set(id);
    try { if (id) localStorage.setItem('crm.pipeline', id); } catch { /* Storage is optional. */ }
    this.setPage(1);
  }
  protected filterStage(id: string): void {
    this.stage.set(id);
    this.setPage(1);
  }
  protected retryPipelines(): void { this.pipelinesResource.reload(); }
}

function readPipeline(): string | null {
  try { return localStorage.getItem('crm.pipeline'); } catch { return null; }
}
