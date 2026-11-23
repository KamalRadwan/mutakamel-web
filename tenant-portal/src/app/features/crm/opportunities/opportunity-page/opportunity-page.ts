import { Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Params,
  Router,
  RouterLink,
} from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerArrowsRightLeft,
  tablerCalendarPlus,
  tablerCloudOff,
  tablerFileInvoice,
  tablerLock,
  tablerPalette,
  tablerPhone,
  tablerRefresh,
  tablerTarget,
  tablerThumbDown,
  tablerTimeline,
  tablerTrash,
  tablerTrophy,
  tablerUserPlus,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { isRetryableWriteError } from '../../../../core/api/api-errors';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { ActionItem, ActionSelection, ActionSwatch } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { listActivities } from '../../../../shared/widgets/activities/activities.api';
import { PartyCalls } from '../../../../shared/widgets/party-calls/party-calls';
import { getPartyCallsSummary } from '../../../../shared/widgets/party-calls/party-calls.api';
import { RecordAttachments } from '../../../../shared/widgets/record-attachments/record-attachments';
import {
  canCreateRecordAttachments,
  canDeleteRecordAttachments,
  countRecordAttachments,
} from '../../../../shared/widgets/record-attachments/record-attachments.api';
import { RecordHistory } from '../../../../shared/widgets/record-history/record-history';
import { HistoryCategoryOption } from '../../../../shared/widgets/record-history/record-history.model';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { RecordActivitiesTab } from '../../shared/record/activities-tab/record-activities-tab';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { RecordNavContext, navPosition, nextNavTarget } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { RecordHeaderOwner, RecordPageHeader } from '../../shared/record/page/record-page-header/record-page-header';
import { RecordTab, RecordTabs } from '../../shared/record/page/record-tabs/record-tabs';
import { createVisitedTabs, syncTabWithQuery } from '../../shared/record/page/record-tabs/visited-tabs';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  createOpportunity,
  attachOpportunityTags,
  deleteOpportunity,
  getCustomerOption,
  getOpportunity,
  getOpportunityCapabilities,
  listOwners,
  listStageHistory,
  patchOpportunity,
} from '../opportunities.api';
import {
  CARD_COLORS,
  CardColor,
  OpportunityCapabilities,
  OpportunityRow,
  OwnerOption,
  PipelineStageView,
  PipelineView,
  formatMoney,
  isClosed,
  nameIn,
  opportunityRef,
  stageLabel,
} from '../opportunities.model';
import {
  canCreateOpportunity,
  canDeleteOpportunity,
  canMoveOpportunity,
  canTransferOpportunity,
  canUpdateOpportunity,
  formatShortDate,
  opportunityErrorMessage,
  stageBadgeClass,
} from '../opportunity-card/opportunity-card';
import {
  DraftErrors,
  OpportunityDraft,
  draftFromRow,
  emptyDraft,
  isDirty,
  toCreateBody,
  toPatchBody,
  validateDraft,
  restoreNonClearableFields,
} from '../opportunity-form/opportunity-draft';
import { OpportunityForm, OpportunitySeedPatch, OpportunityUpdatingState } from '../opportunity-form/opportunity-form';
import { mapOpportunityApiError, opportunityRecordError } from '../opportunity-form/opportunity-form-errors';
import { OpportunityLookups } from '../opportunity-form/opportunity-lookups';
import { diffOpportunityTags, saveTags } from '../opportunity-form/opportunity-tags-diff';
import { CloseDialog } from '../opportunity-moves/close-dialog/close-dialog';
import { MoveOutcome, OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { PipelineMoveDialog } from '../opportunity-moves/pipeline-move-dialog/pipeline-move-dialog';
import { PipelineScope } from '../pipeline-scope';
import { OpportunityQuotationsTab } from './opportunity-quotations-tab/opportunity-quotations-tab';
import { OpportunityStagesTab } from './opportunity-stages-tab/opportunity-stages-tab';
import { getTradeCounts } from './trade-counts.api';

export type OpportunityPageTab =
  | 'overview'
  | 'activities'
  | 'calls'
  | 'attachments'
  | 'history'
  | 'stages'
  | 'quotations';

const ALL_TABS: readonly OpportunityPageTab[] = [
  'overview',
  'activities',
  'calls',
  'attachments',
  'history',
  'stages',
  'quotations',
];

const OPPORTUNITY_RECORD_TYPE = 'opportunity';
const OPPORTUNITY_HISTORY_ENTITY_TYPES: readonly string[] = ['OpportunityEntity', 'Opportunity'];
const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];

const BLANK_DRAFT: OpportunityDraft = emptyDraft({
  branchId: null,
  companyId: null,
  ownerUserId: null,
  pipeline: null,
  stageId: null,
  customer: null,
  defaultCurrency: null,
});

interface OpportunityRouteState {
  createdOpportunity?: OpportunityRow;
  cameFromList?: boolean;
  backQueryParams?: Params;
}

function cleanBackParams(params: Params | undefined): Params {
  if (!params) return {};
  const { open: _, ...rest } = params;
  return rest;
}

/** Full-page workspace for creating, viewing, and editing a CRM opportunity. */
@Component({
  selector: 'app-opportunity-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    FullState,
    UnsavedDialog,
    RecordPageHeader,
    RecordRelatedBadges,
    RecordTabs,
    RecordActivitiesTab,
    RecordAttachments,
    RecordHistory,
    PartyCalls,
    OpportunityForm,
    OpportunityStagesTab,
    OpportunityQuotationsTab,
    CloseDialog,
    PipelineMoveDialog,
  ],
  providers: [
    OpportunityLookups,
    OpportunityMoves,
    provideTranslocoScope(
      'opportunities',
      { scope: 'opportunity-page', alias: 'oppPage' },
      { scope: 'opportunity-form', alias: 'oppForm' },
      { scope: 'opportunity-moves', alias: 'oppMoves' },
      { scope: 'record-page', alias: 'recordPage' },
      { scope: 'record-fields', alias: 'recordFields' },
      { scope: 'record-form', alias: 'recordForm' },
      { scope: 'record-attachments', alias: 'recordAttachments' },
      { scope: 'record-history', alias: 'recordHistory' },
      { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
      { scope: 'record-related', alias: 'recordRelated' },
    ),
    provideIcons({
      tablerArrowLeft,
      tablerArrowsRightLeft,
      tablerCalendarPlus,
      tablerCloudOff,
      tablerFileInvoice,
      tablerLock,
      tablerPalette,
      tablerPhone,
      tablerRefresh,
      tablerTarget,
      tablerThumbDown,
      tablerTimeline,
      tablerTrash,
      tablerTrophy,
      tablerUserPlus,
    }),
  ],
  templateUrl: './opportunity-page.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-10',
    '(document:keydown)': 'onKeydown($event)',
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
})
export class OpportunityPage implements CanLeaveRecord {
  private static nextId = 0;
  protected readonly uid = `opp-page-${++OpportunityPage.nextId}`;
  protected readonly saveBlockedId = `${this.uid}-save-blocked`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly scope = inject(OpportunityLookups).scope;
  private readonly tenantScope = inject(TenantScopeState);
  private readonly crmModules = inject(CrmModules);
  private readonly pipelineScope = inject(PipelineScope);
  private readonly draftStore = inject(RecordDraftStore);
  protected readonly lookups = inject(OpportunityLookups);
  protected readonly moves = inject(OpportunityMoves);

  private readonly opportunityForm = viewChild(OpportunityForm);
  private readonly unsavedDialog = viewChild(UnsavedDialog);
  private readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');
  private readonly reopenDialog = viewChild<ConfirmDialog>('reopenDialog');

  protected readonly opportunityId = signal<string | null>(null);
  protected readonly mode = computed<'create' | 'edit'>(() => (this.opportunityId() ? 'edit' : 'create'));

  protected readonly base = signal<OpportunityDraft>(BLANK_DRAFT);
  protected readonly draft = signal<OpportunityDraft>(BLANK_DRAFT);
  protected readonly detail = signal<OpportunityRow | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  private readonly capabilities = signal<OpportunityCapabilities | null>(null);
  protected readonly nav = signal<RecordNavContext | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly scopeDenied = signal(false);
  protected readonly notFound = signal(false);
  protected readonly writeReadOnly = signal(false);
  protected readonly createMismatch = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly needsBranch = computed(() => { this.tenantScope.selection(); return !sessionBranch(); });
  protected readonly conflictVisible = signal(false);
  private conflictResolve: ((reload: boolean) => void) | null = null;
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly updatingState = signal<OpportunityUpdatingState>({});

  private readonly submitted = signal(false);
  private readonly serverErrors = signal<DraftErrors>({});

  protected readonly activityCount = signal(0);
  protected readonly attachmentCount = signal(0);
  protected readonly callsTotal = signal(0);
  protected readonly callsMissed = signal(0);
  protected readonly callsReload = signal(0);
  protected readonly stagesCount = signal<number | null>(null);
  protected readonly loadTradeCounts = getTradeCounts;
  protected readonly tradeCountsRecord = computed(() => {
    const row = this.detail();
    return this.mode() === 'edit' && row?.id === this.opportunityId() && row?.branchId === sessionBranch()?.branchId
      ? row : null;
  });
  protected readonly newActivityRequest = signal(0);
  protected readonly historyRefresh = signal(0);
  protected readonly stagesRefresh = signal(0);

  private readonly branchOwners = signal<readonly OwnerOption[]>([]);

  protected readonly opportunityHistoryEntityTypes = OPPORTUNITY_HISTORY_ENTITY_TYPES;
  protected readonly historyCategories: readonly HistoryCategoryOption[] = [
    { id: 'record', labelKey: 'oppPage.history.filter.details' },
    { id: 'stages', labelKey: 'oppPage.history.filter.stages' },
    { id: 'activity', labelKey: 'recordHistory.filter.activity' },
  ];


  private readonly allowedTabs = computed<readonly OpportunityPageTab[]>(() => {
    if (this.mode() === 'create') return ['overview'];
    return ALL_TABS;
  });

  protected readonly activeTab = signal<OpportunityPageTab>('overview');
  protected readonly visited = createVisitedTabs(this.activeTab, ['overview']);

  private initializedRoute = false;
  private cameFromList = false;
  private backQueryParams: Params = {};
  private bypassGuard = false;
  private guardBusy = false;
  private conflictOpen = false;
  private loadSeq = 0;
  private capSeq = 0;
  private ownersSeq = 0;
  private loadedOwnersKey: string | null = null;
  private createIdempotencyKey: string | null = null;
  private lastCreateFingerprint: string | null = null;
  private lastNavStep: { dir: -1 | 1; fromId: string } | null = null;
  private reopenPromptSeq = 0;

  private activityCountFromTab = false;
  private attachmentCountFromTab = false;
  private callsCountFromTab = false;
  private stagesCountFromTab = false;

  private readonly scopesReady = computed(() => {
    const lang = this.language();
    const active = this.transloco.activeLang();
    this.i18n();
    if (active !== lang) return false;
    const dict = this.transloco.getTranslation(lang);
    return Boolean(
      dict['opportunities.record'] &&
        dict['oppPage.back'] &&
        dict['oppForm.sections.classification'] &&
        dict['oppMoves.close.lostTitle'] &&
        dict['recordPage.save'] &&
        dict['recordFields.scope.branch'],
    );
  });

  protected readonly showSkeleton = computed(
    () =>
      this.loading() ||
      (!this.loadFailed() && !this.scopeDenied() && !this.notFound() && !this.scopesReady()),
  );

  private readonly instantUpdating = computed(() => {
    const u = this.updatingState();
    return Boolean(u.rating || u.color || u.stage);
  });

  protected readonly instantBusy = computed(() => this.instantUpdating());

  private readonly currentBranchId = computed(() => {
    if (this.mode() === 'edit') {
      const current = this.detail();
      return current && current.id === this.opportunityId() ? current.branchId : null;
    }
    return this.draft().branchId;
  });

  protected readonly dirty = computed(() => isDirty(this.base(), this.draft()));

  protected readonly saveBlockedReason = computed<string | null>(
    () => this.opportunityForm()?.saveBlockedReason() ?? null,
  );

  protected readonly canEdit = computed(() => {
    if (this.writeReadOnly() || this.needsBranch() || !can('crm.opportunities.read')) return false;
    if (this.mode() === 'create') {
      const caps = this.capabilities();
      return !!caps && canCreateOpportunity(caps) && !this.createMismatch();
    }
    const current = this.detail();
    const caps = this.capabilities();
    if (!current || !caps) return false;
    return canUpdateOpportunity(caps, current);
  });

  protected readonly canDelete = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    if (this.mode() !== 'edit') return false;
    const current = this.detail();
    const caps = this.capabilities();
    if (!current || !caps) return false;
    return canDeleteOpportunity(caps, current);
  });

  private readonly canMove = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    const current = this.detail();
    const caps = this.capabilities();
    if (!current || !caps) return false;
    return canMoveOpportunity(caps, current);
  });

  private readonly canTransfer = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    const current = this.detail();
    const caps = this.capabilities();
    if (!current || !caps) return false;
    return canTransferOpportunity(caps, current);
  });

  protected readonly canUploadAttachments = computed(
    () => this.mode() === 'edit' && this.canEdit() && canCreateRecordAttachments(),
  );

  protected readonly canDeleteAttachments = computed(
    () => this.mode() === 'edit' && this.canEdit() && canDeleteRecordAttachments(),
  );

  protected readonly canCreateQuotation = computed(
    () => this.mode() === 'edit' && can('trade.quotation.create'),
  );

  protected readonly errors = computed<DraftErrors>(() => {
    const server = this.serverErrors();
    if (!this.submitted()) return server;
    const local = validateDraft(
      this.draft(),
      this.mode(),
      this.lookups.customFields(),
      this.resolvePipeline(this.draft().pipelineId),
    );
    return { ...local, ...server };
  });

  protected readonly overviewHasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly headerTitle = computed(() => {
    this.i18n();
    const current = this.detail();
    if (this.mode() === 'edit' && current) {
      return current.title;
    }
    const typed = this.draft().title.trim();
    return typed || this.transloco.translate('oppPage.newTitle');
  });

  protected readonly displayName = computed(() => this.detail()?.title ?? '');

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    const lang = this.language();
    const parts: string[] = [];

    if (this.mode() === 'edit') {
      const current = this.detail();
      if (current) {
        parts.push(current.customerDisplayName?.trim() || 'â€”');
        parts.push(`\u2066${opportunityRef(current.id)}\u2069`);
        const branchName = this.branchNameIn(current.branchId, lang);
        if (branchName) parts.push(branchName);
        const created = formatShortDate(current.createdAt, lang);
        if (created) {
          parts.push(this.transloco.translate('recordPage.createdOn', { date: created }));
        }
      }
      return parts.join(' Â· ');
    }

    const d = this.draft();
    if (d.customerLabel?.trim()) parts.push(d.customerLabel.trim());
    if (d.branchId) {
      const branchName = this.branchNameIn(d.branchId, lang);
      if (branchName) parts.push(branchName);
    }
    return parts.join(' Â· ');
  });

  protected readonly edgeClass = computed(() => {
    const color = this.draft().cardColor ?? this.detail()?.cardColor ?? null;
    return color ? CARD_COLORS[color] : null;
  });

  protected readonly headerOwner = computed<RecordHeaderOwner | null>(() => {
    const current = this.detail();
    if (this.mode() === 'edit' && current?.ownerDisplayName) {
      return {
        name: current.ownerDisplayName,
        avatarUrl: current.ownerAvatarUrl,
      };
    }
    const ownerId = this.draft().ownerUserId;
    if (!ownerId) return null;
    const owner = this.lookups.owners().find((item) => item.id === ownerId);
    if (!owner) return null;
    return {
      name: owner.displayName,
      avatarUrl: owner.avatarUrl,
    };
  });

  protected readonly navPos = computed(() => navPosition(this.nav(), this.opportunityId()));

  protected readonly stageBadge = computed<{ label: string; toneClass: string } | null>(() => {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return null;
    const lang = this.language();
    const pipeline = this.resolvePipeline(current.pipelineId);
    const stage = pipeline?.stages.find((s) => s.id === current.stageId) ?? null;
    if (!stage) return null;
    return {
      label: stageLabel(stage, lang),
      toneClass: stageBadgeClass(current.stageFlag),
    };
  });

  protected readonly pipelineBadgeLabel = computed<string | null>(() => {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return null;
    const pipeline = this.resolvePipeline(current.pipelineId);
    return pipeline ? nameIn(pipeline, this.language()) : null;
  });

  protected readonly amountBadgeText = computed<string | null>(() => {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current || !current.amount?.trim()) return null;
    return formatMoney(current.amount, current.currencyCode, this.language());
  });

  protected readonly sourceLeadId = computed<string | null>(() => {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current?.leadId) return null;
    return this.crmModules.leadsEnabled() ? current.leadId : null;
  });

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.i18n();
    this.language();
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return [];

    const pipeline = this.resolvePipeline(current.pipelineId);
    const canMoveOpp = this.canMove();
    const items: ActionItem[] = [];

    if (canMoveOpp && pipeline) {
      if (isClosed(current)) {
        if (this.firstOpenStage(pipeline)) {
          items.push({
            id: 'reopen',
            title: this.transloco.translate('oppPage.header.reopen'),
            icon: 'tablerRefresh',
            tile: 'bg-icon-blue',
          });
        }
      } else {
        if (this.firstTerminalStage(pipeline, 'WON')) {
          items.push({
            id: 'markWon',
            title: this.transloco.translate('oppPage.header.markWon'),
            icon: 'tablerTrophy',
            tile: 'bg-icon-green',
          });
        }
        if (this.firstTerminalStage(pipeline, 'LOST')) {
          items.push({
            id: 'markLost',
            title: this.transloco.translate('oppPage.header.markLost'),
            icon: 'tablerThumbDown',
            tile: 'bg-icon-red',
          });
        }
      }
    }

    if (this.canTransfer()) {
      items.push({
        id: 'transfer',
        title: this.transloco.translate('oppPage.header.movePipeline'),
        icon: 'tablerArrowsRightLeft',
        tile: 'bg-icon-navy',
      });
    }

    if (this.canEdit()) {
      const currentColor = this.draft().cardColor ?? current.cardColor;
      const swatches: ActionSwatch[] = [
        ...COLOR_KEYS.map((color) => ({
          id: color,
          label: this.transloco.translate(`opportunities.card.color.${color}`),
          color: CARD_COLORS[color],
          selected: currentColor === color,
        })),
        {
          id: null,
          label: this.transloco.translate('opportunities.card.color.none'),
          color: null,
          selected: currentColor === null,
        },
      ];
      items.push({
        id: 'color',
        title: this.transloco.translate('oppPage.header.changeColour'),
        icon: 'tablerPalette',
        tile: 'bg-icon-violet',
        swatches,
      });
    }

    if (this.canDelete()) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('oppPage.header.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  });

  protected readonly reopenText = computed(() => {
    this.i18n();
    const req = this.moves.reopenRequest();
    if (!req) return '';
    return this.transloco.translate('oppMoves.reopen.body', { stage: req.stageName });
  });

  /** `oppMoves` is loaded by OpportunityMoves, not by this component's scopes, so read it reactively. */
  protected readonly reopenLabels = computed(() => {
    this.i18n();
    this.language();
    return {
      title: this.transloco.translate('oppMoves.reopen.title'),
      confirm: this.transloco.translate('oppMoves.reopen.confirm'),
      cancel: this.transloco.translate('oppMoves.common.cancel'),
    };
  });

  protected readonly historyPartyIds = computed<readonly string[]>(() => {
    const current = this.detail();
    if (!current || current.id !== this.opportunityId()) return [];
    return [current.customerPartyId, current.contactPartyId].filter((id): id is string => Boolean(id));
  });

  protected readonly uploaderNameFn = computed(() => {
    const map = new Map<string, string>();
    for (const owner of this.branchOwners()) {
      map.set(owner.id, owner.displayName);
    }
    const current = this.detail();
    if (current?.ownerUserId && current.ownerDisplayName && !map.has(current.ownerUserId)) {
      map.set(current.ownerUserId, current.ownerDisplayName);
    }
    return (userId: string) => map.get(userId) ?? null;
  });

  protected readonly historyValueLabel = computed(() => {
    this.i18n();
    const lang = this.language();
    const current = this.detail();
    const pipelines = this.allPipelines();

    const pipelineById = new Map<string, PipelineView>(pipelines.map((p) => [p.id, p]));
    const stageById = new Map<string, PipelineStageView>();
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        stageById.set(stage.id, stage);
      }
    }

    const ownerById = new Map<string, string>();
    for (const owner of this.lookups.owners()) {
      ownerById.set(owner.id, owner.displayName);
    }
    for (const owner of this.branchOwners()) {
      if (!ownerById.has(owner.id)) ownerById.set(owner.id, owner.displayName);
    }
    if (current?.ownerUserId && current.ownerDisplayName && !ownerById.has(current.ownerUserId)) {
      ownerById.set(current.ownerUserId, current.ownerDisplayName);
    }

    const none = this.transloco.translate('recordHistory.none');
    const currencyCode = current?.currencyCode ?? this.draft().currencyCode;

    return (field: string, value: unknown): string | null => {
      if (field === 'stageId') {
        if (value === null || value === undefined || value === '') return none;
        const stage = stageById.get(String(value));
        return stage ? stageLabel(stage, lang) : none;
      }
      if (field === 'pipelineId') {
        if (value === null || value === undefined || value === '') return none;
        const pipeline = pipelineById.get(String(value));
        return pipeline ? nameIn(pipeline, lang) : none;
      }
      if (field === 'status') {
        if (value === null || value === undefined || value === '') return none;
        const key = `opportunities.status.${String(value)}`;
        const translated = this.transloco.translate(key);
        return translated && translated !== key ? translated : null;
      }
      if (field === 'ownerUserId') {
        if (value === null || value === undefined || value === '') return none;
        const ownerId = String(value);
        return ownerById.get(ownerId) ?? `${ownerId.slice(0, 8)}â€¦`;
      }
      if (field === 'cardColor') {
        if (value === null || value === undefined || value === '' || value === 'none') {
          return this.transloco.translate('opportunities.card.color.none');
        }
        const key = `opportunities.card.color.${String(value)}`;
        const translated = this.transloco.translate(key);
        return translated && translated !== key ? translated : null;
      }
      if (field === 'amount') {
        if (value === null || value === undefined || value === '') return none;
        return formatMoney(String(value), currencyCode, lang);
      }
      if (field === 'importance') {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) return none;
        if (num === 0) return this.transloco.translate('oppPage.history.stars0');
        if (num === 1) return this.transloco.translate('oppPage.history.stars1');
        if (num === 2) return this.transloco.translate('oppPage.history.stars2');
        return this.transloco.translate('oppPage.history.starsOther', { n: num });
      }
      return null;
    };
  });

  protected readonly tabs = computed<RecordTab[]>(() => {
    this.i18n();
    this.language();
    const overview: RecordTab = {
      id: 'overview',
      icon: 'tablerLayoutList',
      label: this.transloco.translate('oppPage.tabs.overview'),
      errorDot: this.overviewHasErrors(),
    };
    if (this.mode() === 'create') {
      return [overview];
    }

    const missed = this.callsMissed();
    const list: RecordTab[] = [
      overview,
      {
        id: 'activities',
        icon: 'tablerCalendarEvent',
        label: this.transloco.translate('oppPage.tabs.activities'),
        count: this.activityCount(),
      },
      {
        id: 'calls',
        icon: 'tablerPhone',
        label: this.transloco.translate('oppPage.tabs.calls'),
        count: this.callsTotal(),
        alert: missed > 0 ? this.transloco.translate('oppPage.tabs.missed', { n: missed }) : null,
      },
      {
        id: 'attachments',
        icon: 'tablerPaperclip',
        label: this.transloco.translate('oppPage.tabs.attachments'),
        count: this.attachmentCount(),
      },
      {
        id: 'history',
        icon: 'tablerHistory',
        label: this.transloco.translate('oppPage.tabs.history'),
      },
      {
        id: 'stages',
        icon: 'tablerTimeline',
        label: this.transloco.translate('oppPage.tabs.stages'),
        count: this.stagesCount(),
      },
    ];

    list.push({ id: 'quotations', icon: 'tablerFileInvoice', label: this.transloco.translate('oppPage.tabs.quotations') });

    return list;
  });

  constructor() {
    void this.crmModules.ensureLoaded();

    effect(() => {
      if (this.crmModules.loaded() && !this.crmModules.opportunitiesEnabled()) {
        untracked(() => this.writeReadOnly.set(true));
      }
    });

    const initialNav = this.router.currentNavigation();
    const initialState = initialNav?.extras?.state as OpportunityRouteState | undefined;
    if (initialState?.cameFromList) {
      this.cameFromList = true;
      this.backQueryParams = cleanBackParams(initialState.backQueryParams);
    } else {
      const prevUrl = initialNav?.previousNavigation?.extractedUrl;
      if (prevUrl) {
        const path = '/' + prevUrl.root.children['primary']?.segments.map((s) => s.path).join('/');
        if (path === '/crm/opportunities') {
          this.cameFromList = true;
          this.backQueryParams = cleanBackParams(prevUrl.queryParams);
        }
      }
    }

    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.bypassGuard = false;
      });

    syncTabWithQuery(this.route, this.router, this.activeTab, this.allowedTabs, 'overview', {
      onBeforeNavigate: () => {
        this.bypassGuard = true;
      },
      onAfterNavigate: () => {
        this.bypassGuard = false;
      },
    });

    effect(() => {
      const req = this.moves.reopenRequest();
      if (!req) return;
      const dialog = this.reopenDialog();
      if (!dialog) return;

      untracked(() => {
        const promptSeq = ++this.reopenPromptSeq;
        void dialog.open().then((confirmed) => {
          if (promptSeq !== this.reopenPromptSeq) return;
          this.moves.resolveReopen(confirmed);
        });
      });
    });

    effect(() => {
      const currentMode = this.mode();
      const branchId = this.currentBranchId();
      if (currentMode === 'create') {
        untracked(() => {
          if (branchId) {
            void this.refreshCapabilities(branchId);
          } else {
            this.capabilities.set(null);
          }
        });
      }
    });

    effect(() => {
      const branchId = this.currentBranchId();
      const action = this.mode() === 'create' ? 'create' : 'update';
      untracked(() => {
        if (!branchId) {
          this.ownersSeq++;
          this.loadedOwnersKey = null;
          this.branchOwners.set([]);
          return;
        }
        const key = `${action}:${branchId}`;
        if (this.loadedOwnersKey === key) return;
        this.loadedOwnersKey = key;
        const seq = ++this.ownersSeq;
        void listOwners(branchId, action)
          .then((list) => {
            if (seq !== this.ownersSeq) return;
            this.branchOwners.set(list);
          })
          .catch(() => {
            if (seq !== this.ownersSeq) return;
            this.branchOwners.set([]);
          });
      });
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextId = params.get('id');
      const snapshot = this.route.snapshot;
      const draftKey = snapshot.queryParamMap.get('draft');
      if (this.initializedRoute && nextId === this.opportunityId() && !draftKey) {
        return;
      }

      this.initializedRoute = true;
      this.opportunityId.set(nextId);

      const navState = this.router.currentNavigation()?.extras.state as OpportunityRouteState | undefined;
      if (navState?.cameFromList) {
        this.cameFromList = true;
        this.backQueryParams = cleanBackParams(navState.backQueryParams);
      }

      const carried = draftKey ? this.draftStore.take<OpportunityDraft>(draftKey, OPPORTUNITY_RECORD_TYPE) : null;
      if (draftKey) {
        this.bypassGuard = true;
        void this.router
          .navigate([], {
            relativeTo: this.route,
            queryParams: { draft: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          })
          .finally(() => {
            this.bypassGuard = false;
          });
      }

      this.submitted.set(false);
      this.serverErrors.set({});
      this.updatingState.set({});
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
      this.loadFailed.set(false);
      this.scopeDenied.set(false);
      this.notFound.set(false);
      this.activityCountFromTab = false;
      this.attachmentCountFromTab = false;
      this.callsCountFromTab = false;
      this.stagesCountFromTab = false;
      this.activityCount.set(0);
      this.attachmentCount.set(0);
      this.callsTotal.set(0);
      this.callsMissed.set(0);
      this.stagesCount.set(null);
      this.newActivityRequest.set(0);
      this.historyRefresh.set(0);
      this.stagesRefresh.set(0);

      if (nextId) {
        const matchedCarried = carried && (carried.recordId === nextId || carried.recordId === null) ? carried : null;
        if (matchedCarried?.nav) {
          this.nav.set({ ...matchedCarried.nav, ids: [...matchedCarried.nav.ids] });
        } else if (navState?.createdOpportunity?.id === nextId || (this.nav() && !this.nav()!.ids.includes(nextId))) {
          this.nav.set(null);
        }

        if (!matchedCarried && navState?.createdOpportunity?.id === nextId) {
          const created = navState.createdOpportunity;
          const seq = ++this.loadSeq;
          this.lastNavStep = null;
          this.loading.set(false);
          this.detail.set(created);
          const mapped = draftFromRow(created, this.scope.companies());
          this.base.set(mapped);
          this.draft.set(structuredClone(mapped));
          this.updatedAt.set(created.updatedAt);
          void this.refreshCapabilities(created.branchId);
          void this.loadInitialTabCounts(created, seq);
        } else {
          void this.loadRecord(nextId, matchedCarried);
        }
      } else {
        const stageParam = snapshot.queryParamMap.get('stage')?.trim() || null;
        const customerParam = snapshot.queryParamMap.get('customerProfileId')?.trim() || null;
        this.lastNavStep = null;
        this.nav.set(null);
        this.activeTab.set('overview');
        void this.initCreateMode(carried, stageParam, customerParam);
      }
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.bypassGuard || !this.dirty()) return true;
    const dialog = this.unsavedDialog();
    if (!dialog) return true;
    if (this.guardBusy) return false;

    this.guardBusy = true;
    try {
      const choice = await dialog.open();
      if (choice === 'discard') {
        return true;
      }
      if (choice === 'save') {
        return await this.save();
      }
      return false;
    } finally {
      this.guardBusy = false;
    }
  }

  protected onFormDraftChange(next: OpportunityDraft): void {
    const result = this.mode() === 'edit' ? restoreNonClearableFields(this.base(), next) : { draft: next, errors: {} };
    this.serverErrors.set(result.errors);
    this.draft.set(result.draft);
  }

  protected onFormSeeded(patch: OpportunitySeedPatch): void {
    if (this.mode() !== 'create') return;
    this.base.update((current) => ({ ...current, ...patch }));
  }

  protected selectTab(tabId: string): void {
    const next = tabId as OpportunityPageTab;
    if (!this.allowedTabs().includes(next)) return;
    this.activeTab.set(next);
  }

  protected goBack(): void {
    if (this.cameFromList) {
      void this.router.navigate(['/crm/opportunities'], { queryParams: this.backQueryParams });
      return;
    }
    void this.canDeactivate().then((allowed) => {
      if (!allowed) return;
      this.bypassGuard = true;
      if (window.history.length > 1) {
        this.location.back();
        return;
      }
      void this.router.navigate(['/crm/opportunities'], { queryParams: this.backQueryParams });
    });
  }

  protected retryLoad(): void {
    const id = this.opportunityId();
    if (!id) return;
    void this.loadRecord(id, null);
  }

  protected undo(): void {
    if (!this.dirty() || this.saving() || this.deleting()) return;
    this.draft.set(structuredClone(this.base()));
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  protected logActivity(): void {
    if (this.mode() !== 'edit' || !this.canEdit() || this.saving() || this.deleting()) return;
    this.selectTab('activities');
    this.newActivityRequest.update((v) => v + 1);
  }

  protected async save(): Promise<boolean> {
    if (
      this.saving() ||
      this.deleting() ||
      this.loading() ||
      this.loadFailed() ||
      this.scopeDenied() ||
      this.notFound() ||
      !this.canEdit() ||
      this.saveBlockedReason()
    ) {
      return false;
    }

    this.submitted.set(true);
    this.serverErrors.set({});

    const validation = validateDraft(
      this.draft(),
      this.mode(),
      this.lookups.customFields(),
      this.resolvePipeline(this.draft().pipelineId),
    );
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.opportunityForm()?.focusFirstError(validation), { injector: this.injector });
      return false;
    }

    if (this.mode() === 'create') {
      return this.saveCreate();
    }
    return this.saveEdit();
  }

  protected async onRate(importance: number): Promise<void> {
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (
      this.mode() !== 'edit' ||
      !current ||
      !expectedUpdatedAt ||
      !this.canEdit() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    const prevImportance = current.importance;
    const prevBaseImportance = this.base().importance;
    const prevDraftImportance = this.draft().importance;

    this.detail.set({ ...current, importance });
    this.base.update((b) => ({ ...b, importance }));
    this.draft.update((d) => ({ ...d, importance }));
    this.updatingState.update((s) => ({ ...s, rating: true }));

    try {
      const updated = await patchOpportunity(current.id, { importance, expectedUpdatedAt });
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, importance: updated.importance }));
      this.draft.update((d) => ({ ...d, importance: updated.importance }));
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((r) => (r ? { ...r, importance: prevImportance } : r));
      this.base.update((b) => ({ ...b, importance: prevBaseImportance }));
      this.draft.update((d) => ({ ...d, importance: prevDraftImportance }));
      this.toastWriteError(error);
    } finally {
      this.updatingState.update((s) => ({ ...s, rating: false }));
    }
  }

  protected async onRecolor(cardColor: CardColor | null): Promise<void> {
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (
      this.mode() !== 'edit' ||
      !current ||
      !expectedUpdatedAt ||
      !this.canEdit() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    const prevColor = current.cardColor;
    const prevBaseColor = this.base().cardColor;
    const prevDraftColor = this.draft().cardColor;

    this.detail.set({ ...current, cardColor });
    this.base.update((b) => ({ ...b, cardColor }));
    this.draft.update((d) => ({ ...d, cardColor }));
    this.updatingState.update((s) => ({ ...s, color: true }));

    try {
      const updated = await patchOpportunity(current.id, { cardColor, expectedUpdatedAt });
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, cardColor: updated.cardColor }));
      this.draft.update((d) => ({ ...d, cardColor: updated.cardColor }));
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((r) => (r ? { ...r, cardColor: prevColor } : r));
      this.base.update((b) => ({ ...b, cardColor: prevBaseColor }));
      this.draft.update((d) => ({ ...d, cardColor: prevDraftColor }));
      this.toastWriteError(error);
    } finally {
      this.updatingState.update((s) => ({ ...s, color: false }));
    }
  }

  protected async onMoveStage(stageId: string): Promise<void> {
    const current = this.detail();
    if (
      this.mode() !== 'edit' ||
      !current ||
      !this.canMove() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    const pipeline = this.resolvePipeline(current.pipelineId);
    const target = pipeline?.stages.find((stage) => stage.id === stageId);
    if (!target || target.id === current.stageId) return;

    this.updatingState.update((s) => ({ ...s, stage: true }));
    try {
      const outcome = await this.moves.move(current, target);
      if (this.detail()?.id !== current.id) return;
      this.applyMoveOutcome(outcome);
    } finally {
      this.updatingState.update((s) => ({ ...s, stage: false }));
    }
  }

  protected onActionSelected(selection: ActionSelection): void {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return;

    switch (selection.id) {
      case 'markWon':
        void this.closeAs('WON');
        break;
      case 'markLost':
        void this.closeAs('LOST');
        break;
      case 'reopen': {
        const pipeline = this.resolvePipeline(current.pipelineId);
        const openStage = this.firstOpenStage(pipeline);
        if (openStage) void this.onMoveStage(openStage.id);
        break;
      }
      case 'transfer':
        void this.transferToPipeline();
        break;
      case 'color':
        void this.onRecolor((selection.value as CardColor | null) ?? null);
        break;
      case 'delete':
        void this.confirmDelete();
        break;
    }
  }

  protected async stepNav(dir: -1 | 1): Promise<void> {
    const currentNav = this.nav();
    const currentId = this.opportunityId();
    const pos = this.navPos();
    if (!currentNav || !currentId || !pos || this.loading() || this.saving() || this.deleting()) return;
    if (dir === -1 && pos.index <= 1) return;
    if (dir === 1 && pos.index >= pos.total) return;

    if (!(await this.canDeactivate())) return;

    const target = await nextNavTarget(currentNav, currentId, dir).catch(() => null);
    if (!target) return;

    this.nav.set(target.nav);
    this.lastNavStep = { dir, fromId: currentId };

    const tab = this.activeTab();
    const queryParams: Params = tab === 'overview' ? {} : { tab };
    this.bypassGuard = true;
    await this.router.navigate(['/crm/opportunities', target.id], { queryParams });
  }

  protected onActivityCountChange(event: { open: number; total: number }): void {
    this.activityCountFromTab = true;
    this.activityCount.set(event.open);
    this.historyRefresh.update((v) => v + 1);
  }

  protected onCallsTotal(count: number): void {
    this.callsCountFromTab = true;
    this.callsTotal.set(count);
  }

  protected onCallsMissed(count: number): void {
    this.callsCountFromTab = true;
    this.callsMissed.set(count);
  }

  protected onAttachmentCountChange(count: number): void {
    this.attachmentCountFromTab = true;
    this.attachmentCount.set(count);
    this.historyRefresh.update((v) => v + 1);
  }

  protected onStagesCountChange(count: number): void {
    this.stagesCountFromTab = true;
    this.stagesCount.set(count);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.loading() || this.saving() || this.deleting() || this.guardBusy) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      if (event.defaultPrevented || !this.canEdit() || this.saveBlockedReason()) return;
      event.preventDefault();
      void this.save();
    }
  }

  protected onVisibilityChange(): void {
    if (document.visibilityState !== 'visible') return;
    if (this.mode() === 'edit' && this.activeTab() === 'calls' && this.opportunityId()) {
      this.callsReload.update((v) => v + 1);
    }
  }

  private async closeAs(kind: 'WON' | 'LOST'): Promise<void> {
    const current = this.detail();
    if (!current || !this.canMove() || this.instantUpdating() || this.saving() || this.deleting()) return;
    const pipeline = this.resolvePipeline(current.pipelineId);
    if (!pipeline) return;

    this.updatingState.update((s) => ({ ...s, stage: true }));
    try {
      const outcome = await this.moves.close(current, pipeline, kind);
      if (this.detail()?.id !== current.id) return;
      this.applyMoveOutcome(outcome);
    } finally {
      this.updatingState.update((s) => ({ ...s, stage: false }));
    }
  }

  private async transferToPipeline(): Promise<void> {
    const current = this.detail();
    if (!current || !this.canTransfer() || this.instantUpdating() || this.saving() || this.deleting()) return;

    this.updatingState.update((s) => ({ ...s, stage: true }));
    try {
      const outcome = await this.moves.transfer(current, this.allPipelines());
      if (this.detail()?.id !== current.id) return;
      this.applyMoveOutcome(outcome);
    } finally {
      this.updatingState.update((s) => ({ ...s, stage: false }));
    }
  }

  private applyMoveOutcome(outcome: MoveOutcome): void {
    if (outcome.kind === 'moved') {
      const updated = outcome.row;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({
        ...b,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
      }));
      this.draft.update((d) => ({
        ...d,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
      }));
      this.stagesRefresh.update((v) => v + 1);
      this.historyRefresh.update((v) => v + 1);
      return;
    }

    if (outcome.kind === 'failed') {
      if (outcome.code === 'CRM.OPPORTUNITY.STALE_MOVE') void this.handleConflict(this.opportunityId()!);
      if (outcome.code === 'PIPELINE_STAGE_NOT_FOUND' && this.opportunityId()) {
        this.lookups.reloadPipelines();
        void this.loadRecord(this.opportunityId()!, null);
      }
      if (['CRM_OPPORTUNITIES_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(outcome.code ?? '')) this.writeReadOnly.set(true);
    }
  }

  private async confirmDelete(): Promise<void> {
    const current = this.detail();
    const dialog = this.deleteDialog();
    if (!current || !dialog || !this.canDelete() || this.saving() || this.deleting() || this.guardBusy) return;

    this.guardBusy = true;
    let confirmed = false;
    try {
      confirmed = await dialog.open();
    } finally {
      this.guardBusy = false;
    }
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await deleteOpportunity(current.id);
      this.notify.success(this.transloco.translate('oppPage.delete.done'));
      this.bypassGuard = true;
      await this.router.navigate(['/crm/opportunities'], { queryParams: this.backQueryParams });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        this.bypassGuard = true;
        await this.router.navigate(['/crm/opportunities'], { queryParams: this.backQueryParams });
        return;
      }
      this.toastWriteError(error);
    } finally {
      this.deleting.set(false);
    }
  }

  private async initCreateMode(
    carried: { draft: OpportunityDraft } | null,
    stageParam: string | null,
    customerParam: string | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    const branch = sessionBranch();
    if (!branch || !can('crm.opportunities.read')) { this.loading.set(false); return; }

    const initialDraft = emptyDraft({
      branchId: branch.branchId,
      companyId: branch.companyId,
      ownerUserId: this.tenantScope.me()?.id ?? null,
      pipeline: this.pipelineScope.current(),
      stageId: stageParam,
      customer: null,
      defaultCurrency: this.lookups.defaultCurrency(),
    });

    this.loading.set(false);
    this.detail.set(null);
    this.updatedAt.set(null);
    this.base.set(initialDraft);
    this.draft.set(carried ? structuredClone(carried.draft) : structuredClone(initialDraft));

    if (initialDraft.branchId) {
      void this.refreshCapabilities(initialDraft.branchId);
    }

    await this.pipelineScope.ensureLoaded();
    if (seq !== this.loadSeq || this.mode() !== 'create') return;

    const pipeline =
      this.pipelineScope.current() ??
      this.pipelineScope.pipelines().find((p) => p.isDefault && p.isActive) ??
      this.pipelineScope.pipelines().find((p) => p.isActive) ??
      null;

    if (pipeline) {
      const stageMatch = stageParam
        ? pipeline.stages.find((s) => s.id === stageParam && s.isActive && s.flag !== 'WON' && s.flag !== 'LOST')
        : null;
      const defaultStage = stageMatch ?? this.firstOpenStage(pipeline);
      const currentDraft = this.draft();
      if (!carried && (!currentDraft.pipelineId || currentDraft.pipelineId === pipeline.id)) {
        const resolvedStageId = stageMatch?.id ?? (currentDraft.stageId || defaultStage?.id || '');
        const pipePatch: Partial<OpportunityDraft> = {
          pipelineId: pipeline.id,
          ...(resolvedStageId ? { stageId: resolvedStageId } : {}),
        };
        this.base.update((b) => ({ ...b, ...pipePatch }));
        this.draft.update((d) => ({ ...d, ...pipePatch }));
      }
    }

    if (customerParam && can('crm.customer_profiles.read')) {
      try {
        const customer = await getCustomerOption(customerParam);
        if (seq !== this.loadSeq || this.mode() !== 'create') return;
        if (customer.status === 'BLACKLISTED') {
          this.serverErrors.set({ customerProfileId: 'oppPage.errors.customerCannotCreate' });
          return;
        }
        const currentCustomerId = this.draft().customerProfileId;
        if (currentCustomerId && currentCustomerId !== customer.id) return;

        const customerPatch: Partial<OpportunityDraft> = {
          customerProfileId: customer.id,
          customerLabel: customer.displayName,
          customerStatus: customer.status,
          contactPartyId: customer.profileType === 'INDIVIDUAL' ? customer.partyId : null,
        };
        this.base.update((b) => ({ ...b, ...customerPatch }));
        this.draft.update((d) => ({ ...d, ...customerPatch }));
      } catch (error) {
        if (seq !== this.loadSeq || this.mode() !== 'create') return;
        if (errorCodeOf(error) === 'CRM_OPPORTUNITIES_DISABLED') {
          this.toastWriteError(error);
          return;
        }
        this.serverErrors.set({ customerProfileId: 'oppPage.errors.customerCannotCreate' });
      }
    }
  }

  private async loadRecord(
    id: string,
    carried: { draft: OpportunityDraft; baseUpdatedAt: string | null } | null,
  ): Promise<void> {
    if (!sessionBranch()) { this.loading.set(false); return; }
    if (!can('crm.opportunities.read')) { this.scopeDenied.set(true); this.loading.set(false); return; }
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.scopeDenied.set(false);
    this.notFound.set(false);
    this.submitted.set(false);
    this.serverErrors.set({});

    try {
      const fresh = await getOpportunity(id);
      if (seq !== this.loadSeq) return;
      this.lastNavStep = null;

      let caps: OpportunityCapabilities | null = null;
      try {
        caps = await getOpportunityCapabilities(fresh.branchId);
      } catch {
        // Keep null if capabilities fail; read-only fallback applies.
      }
      if (seq !== this.loadSeq) return;

      this.capabilities.set(caps);
      this.detail.set(fresh);
      const mapped = draftFromRow(fresh, this.scope.companies());
      this.base.set(mapped);
      this.draft.set(carried ? structuredClone(carried.draft) : structuredClone(mapped));
      this.updatedAt.set(carried?.baseUpdatedAt ?? fresh.updatedAt);
      void this.loadInitialTabCounts(fresh, seq);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (errorCodeOf(error) === 'CRM_OPPORTUNITIES_DISABLED') {
        void this.crmModules.reload();
        this.enterReadOnlyMode();
        return;
      }

      if (error instanceof ApiError && (error.status === 404 || error.code === 'OPPORTUNITY_NOT_FOUND')) {
        const handledByNav = await this.handleMissingNavRecord(id);
        if (!handledByNav && seq === this.loadSeq) {
          this.notFound.set(true);
        }
        return;
      }

      if (error instanceof ApiError && (error.status === 403 || error.code === 'CRM_SCOPED_PERMISSION_DENIED')) {
        this.scopeDenied.set(true);
        return;
      }

      this.loadFailed.set(true);
      this.loadCorrelationId.set(opportunityRecordError(this.transloco, error, 'oppPage').correlationId);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async handleMissingNavRecord(missingId: string): Promise<boolean> {
    const currentNav = this.nav();
    const navIdx = currentNav ? currentNav.ids.indexOf(missingId) : -1;
    if (!currentNav || navIdx < 0) return false;

    this.notify.warning(this.transloco.translate('oppPage.navGone'));
    const nextIds = [...currentNav.ids.slice(0, navIdx), ...currentNav.ids.slice(navIdx + 1)];
    const updatedNav: RecordNavContext | null =
      nextIds.length > 0
        ? { ...currentNav, ids: nextIds, total: Math.max(nextIds.length, currentNav.total - 1) }
        : null;
    this.nav.set(updatedNav);

    const step = this.lastNavStep;
    this.lastNavStep = null;

    let fallbackId: string | null = null;
    if (updatedNav) {
      if (step?.dir === 1 && navIdx < updatedNav.ids.length) {
        fallbackId = updatedNav.ids[navIdx];
      } else if (step?.dir === -1 && navIdx - 1 >= 0) {
        fallbackId = updatedNav.ids[navIdx - 1];
      } else if (step?.fromId && updatedNav.ids.includes(step.fromId)) {
        fallbackId = step.fromId;
      } else {
        fallbackId = updatedNav.ids[Math.min(navIdx, updatedNav.ids.length - 1)] ?? null;
      }
    }

    if (!fallbackId) return false;

    const tab = this.activeTab();
    this.bypassGuard = true;
    try {
      await this.router.navigate(['/crm/opportunities', fallbackId], {
        queryParams: tab === 'overview' ? {} : { tab },
        replaceUrl: true,
      });
    } finally {
      this.bypassGuard = false;
    }
    return true;
  }

  private async loadInitialTabCounts(row: OpportunityRow, seq: number): Promise<void> {
    const [openResult, attachmentResult, callsResult, stagesResult] = await Promise.allSettled([
      listActivities({
        targetApp: 'CRM',
        targetType: 'OPPORTUNITY',
        targetId: row.id,
        statuses: ['PLANNED', 'IN_PROGRESS'],
        page: 1,
        limit: 1,
      }),
      countRecordAttachments('OPPORTUNITY', row.branchId, row.id),
      getPartyCallsSummary({ partyType: 'OPPORTUNITY', partyId: row.id }),
      listStageHistory(row.id, null),
    ]);

    if (seq !== this.loadSeq) return;

    if (!this.activityCountFromTab) {
      this.activityCount.set(openResult.status === 'fulfilled' ? openResult.value.meta.total : row.openActivityCount);
    }
    if (attachmentResult.status === 'fulfilled' && !this.attachmentCountFromTab) {
      this.attachmentCount.set(attachmentResult.value);
    }
    if (callsResult.status === 'fulfilled' && !this.callsCountFromTab) {
      this.callsTotal.set(callsResult.value.total);
      this.callsMissed.set(callsResult.value.missed);
    }
    if (stagesResult.status === 'fulfilled' && !this.stagesCountFromTab) {
      this.stagesCount.set(stagesResult.value.items.length);
    }
  }

  private async refreshCapabilities(branchId: string): Promise<void> {
    const seq = ++this.capSeq;
    try {
      const caps = await getOpportunityCapabilities(branchId);
      if (seq === this.capSeq) {
        this.capabilities.set(caps);
      }
    } catch {
      if (seq === this.capSeq) {
        this.capabilities.set(null);
      }
    }
  }

  private async saveCreate(): Promise<boolean> {
    const body = toCreateBody(this.draft());
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastCreateFingerprint || !this.createIdempotencyKey) {
      this.createIdempotencyKey = newIdempotencyKey();
      this.lastCreateFingerprint = fingerprint;
    }

    this.saving.set(true);
    try {
      let created = await createOpportunity(body, this.createIdempotencyKey);
      const tagIds = [...this.draft().tagIds];
      if (tagIds.length) {
        try { created = { ...created, tags: await attachOpportunityTags(created.id, tagIds) }; }
        catch { this.notify.warning(this.transloco.translate('oppForm.savedWithoutTags')); }
      }
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
      const mapped = draftFromRow(created, this.scope.companies());
      this.detail.set(created);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.updatedAt.set(created.updatedAt);
      this.submitted.set(false);
      this.serverErrors.set({});
      this.notify.success(this.transloco.translate('oppPage.created', { name: created.title }));

      this.bypassGuard = true;
      await this.router.navigate(['/crm/opportunities', created.id], {
        replaceUrl: true,
        state: {
          createdOpportunity: created,
          cameFromList: this.cameFromList,
          backQueryParams: this.backQueryParams,
        } satisfies OpportunityRouteState,
      });
      return true;
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.createIdempotencyKey = null;
        this.lastCreateFingerprint = null;
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
      this.bypassGuard = false;
    }
  }

  private async saveEdit(): Promise<boolean> {
    const id = this.opportunityId();
    const expectedUpdatedAt = this.updatedAt();
    if (!id || !expectedUpdatedAt) return false;
    if (!this.dirty()) return true;

    const baseDraft = this.base();
    const currentDraft = this.draft();
    const patchBody = toPatchBody(baseDraft, currentDraft, expectedUpdatedAt);
    const tagDiff = diffOpportunityTags(baseDraft.tagIds, currentDraft.tagIds);
    const hasTagChanges = tagDiff.attach.length > 0 || tagDiff.detach.length > 0;

    if (!patchBody && !hasTagChanges) return true;

    this.saving.set(true);
    let latest = this.detail();

    try {
      if (patchBody !== null) {
        try {
          latest = await patchOpportunity(id, patchBody);
        } catch (error) {
          if (this.isConcurrentUpdate(error)) {
            this.saving.set(false);
            return this.handleConflict(id);
          }
          this.handleSaveError(error);
          return false;
        }
        const patchedMapped = draftFromRow(latest, this.scope.companies());
        this.detail.set(latest);
        this.updatedAt.set(latest.updatedAt);
        this.base.set(patchedMapped);
        if (hasTagChanges) {
          this.draft.set({ ...patchedMapped, tagIds: [...currentDraft.tagIds] });
        }
      }

      if (hasTagChanges) {
        try {
          await saveTags(id, baseDraft.tagIds, currentDraft.tagIds);
          latest = await getOpportunity(id);
        } catch (error) {
          try {
            const refreshed = await getOpportunity(id);
            const refreshedMapped = draftFromRow(refreshed, this.scope.companies());
            this.detail.set(refreshed);
            this.updatedAt.set(refreshed.updatedAt);
            this.base.set(refreshedMapped);
            this.draft.update((d) => ({ ...refreshedMapped, tagIds: [...d.tagIds] }));
          } catch {
            // Preserve current local state on refresh failure.
          }
          if (patchBody !== null) {
            this.historyRefresh.update((v) => v + 1);
          }
          this.handleSaveError(error);
          return false;
        }
      }

      if (!latest) return false;
      const finalMapped = draftFromRow(latest, this.scope.companies());
      this.detail.set(latest);
      this.updatedAt.set(latest.updatedAt);
      this.base.set(finalMapped);
      this.draft.set(structuredClone(finalMapped));
      this.submitted.set(false);
      this.serverErrors.set({});
      this.historyRefresh.update((v) => v + 1);
      this.notify.success(this.transloco.translate('recordPage.saved'));
      return true;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(id: string): Promise<boolean> {
    if (this.conflictOpen) return false;

    this.conflictOpen = true;
    let reload = false;
    try {
      this.conflictVisible.set(true);
      reload = await new Promise<boolean>((resolve) => { this.conflictResolve = resolve; });
    } finally {
      this.conflictOpen = false;
    }

    try {
      const fresh = await getOpportunity(id);
      if (this.opportunityId() !== id) return false;
      const freshMapped = draftFromRow(fresh, this.scope.companies());

      if (reload) {
        let caps = this.capabilities();
        try {
          caps = await getOpportunityCapabilities(fresh.branchId);
        } catch {
          // Keep current capabilities if refresh fails.
        }
        if (this.opportunityId() !== id) return false;
        this.capabilities.set(caps);
        this.detail.set(fresh);
        this.base.set(freshMapped);
        this.draft.set(structuredClone(freshMapped));
        this.updatedAt.set(fresh.updatedAt);
        this.submitted.set(false);
        this.serverErrors.set({});
        this.historyRefresh.update((v) => v + 1);
        return false;
      }

      this.updatedAt.set(fresh.updatedAt);
      this.detail.update((row) => row ? { ...row, updatedAt: fresh.updatedAt } : row);
      return false;
    } catch (error) {
      this.toastWriteError(error);
      return false;
    }
  }

  protected resolveConflict(reload: boolean): void {
    this.conflictVisible.set(false);
    this.conflictResolve?.(reload);
    this.conflictResolve = null;
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH')) this.createMismatch.set(true);
    if (errorCodeOf(error) === 'CRM_OPPORTUNITIES_DISABLED') {
      this.toastWriteError(error);
      return;
    }

    const mapped = mapOpportunityApiError(error);
    if (mapped) {
      this.serverErrors.set(mapped);
      this.selectTab('overview');
      afterNextRender(() => this.opportunityForm()?.focusFirstError(mapped), { injector: this.injector });
      return;
    }

    this.toastWriteError(error);
  }

  private toastWriteError(error: unknown): void {
    const state = opportunityRecordError(this.transloco, error, 'oppForm');
    this.notify.error(state.message);
    if (state.readOnly) this.writeReadOnly.set(true);
  }

  private enterReadOnlyMode(): void {
    this.writeReadOnly.set(true);
  }

  private isConcurrentUpdate(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      error.status === 409 &&
      (error.code === 'CRM.OPPORTUNITY.CONCURRENT_UPDATE' || !error.code)
    );
  }

  private allPipelines(): PipelineView[] {
    const fromLookups = this.lookups.pipelines();
    return fromLookups.length > 0 ? fromLookups : this.pipelineScope.pipelines();
  }

  private resolvePipeline(pipelineId: string | null | undefined): PipelineView | null {
    if (!pipelineId) return null;
    return (
      this.lookups.pipeline(pipelineId) ??
      this.pipelineScope.pipelines().find((pipeline) => pipeline.id === pipelineId) ??
      null
    );
  }

  private firstOpenStage(pipeline: PipelineView | null): PipelineStageView | null {
    if (!pipeline) return null;
    return (
      pipeline.stages
        .filter((stage) => stage.isActive && stage.flag !== 'WON' && stage.flag !== 'LOST')
        .slice()
        .sort((a, b) => a.rank - b.rank)[0] ?? null
    );
  }

  private firstTerminalStage(pipeline: PipelineView | null, flag: 'WON' | 'LOST'): PipelineStageView | null {
    if (!pipeline) return null;
    return (
      pipeline.stages
        .filter((stage) => stage.isActive && stage.flag === flag)
        .slice()
        .sort((a, b) => a.rank - b.rank)[0] ?? null
    );
  }

  private branchNameIn(branchId: string, lang: 'ar' | 'en'): string | null {
    for (const company of this.scope.companies()) {
      const branch = company.branches.find((b) => b.id === branchId);
      if (branch) return lang === 'ar' ? branch.nameAr : branch.nameEn;
    }
    return null;
  }
}
