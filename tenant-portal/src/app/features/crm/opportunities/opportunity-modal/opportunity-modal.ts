import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowsExchange,
  tablerCloudOff,
  tablerRotate,
  tablerTarget,
  tablerThumbDown,
  tablerTrophy,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { isRetryableWriteError } from '../../../../core/api/api-errors';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { RecordModalExtraAction, RecordModalFrame } from '../../shared/record/modal/record-modal-frame';
import { createUnsavedGuard } from '../../shared/record/modal/record-unsaved-guard';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { RelatedBadgeClickEvent } from '../../shared/record/related/related-records.model';
import { RecordNavContext, navPosition, nextNavTarget } from '../../shared/record/nav/record-nav';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  createOpportunity,
  attachOpportunityTags,
  deleteOpportunity,
  getCustomerOption,
  getOpportunity,
  getOpportunityCapabilities,
  patchOpportunity,
} from '../opportunities.api';
import {
  type CardColor,
  type CustomerOption,
  type OpportunityCapabilities,
  type OpportunityRow,
  type PipelineStageView,
  type PipelineView,
  isClosed,
} from '../opportunities.model';
import {
  canDeleteOpportunity,
  canMoveOpportunity,
  canTransferOpportunity,
  canUpdateOpportunity,
  opportunityErrorMessage,
} from '../opportunity-card/opportunity-card';
import {
  type DraftErrors,
  type OpportunityDraft,
  draftFromRow,
  emptyDraft,
  isDirty,
  toCreateBody,
  toPatchBody,
  validateDraft,
  restoreNonClearableFields,
} from '../opportunity-form/opportunity-draft';
import {
  OpportunityForm,
  type OpportunitySeedPatch,
  type OpportunityUpdatingState,
} from '../opportunity-form/opportunity-form';
import { mapOpportunityApiError, opportunityRecordError } from '../opportunity-form/opportunity-form-errors';
import { OpportunityLookups } from '../opportunity-form/opportunity-lookups';
import { diffOpportunityTags, saveTags } from '../opportunity-form/opportunity-tags-diff';
import { CloseDialog } from '../opportunity-moves/close-dialog/close-dialog';
import { MoveOutcome, OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { PipelineMoveDialog } from '../opportunity-moves/pipeline-move-dialog/pipeline-move-dialog';
import { PipelineScope } from '../pipeline-scope';

export interface OpenCreateOpportunityOptions {
  pipelineId: string;
  stageId?: string | null;
  customerProfileId?: string | null;
}

const OPPORTUNITY_RECORD_TYPE = 'opportunity';

const BLANK_DRAFT: OpportunityDraft = emptyDraft({
  branchId: null,
  companyId: null,
  ownerUserId: null,
  pipeline: null,
  stageId: null,
  customer: null,
  defaultCurrency: null,
});

@Component({
  selector: 'app-opportunity-modal',
  imports: [
    TranslocoPipe,
    ConfirmDialog,
    ConflictDialog,
    FullState,
    UnsavedDialog,
    RecordModalFrame,
    RecordRelatedBadges,
    OpportunityForm,
    CloseDialog,
    PipelineMoveDialog,
  ],
  providers: [
    OpportunityLookups,
    OpportunityMoves,
    provideTranslocoScope(
      'opportunities',
      { scope: 'opportunity-modal', alias: 'oppModal' },
      { scope: 'opportunity-form', alias: 'oppForm' },
      { scope: 'opportunity-moves', alias: 'oppMoves' },
      { scope: 'record-modal', alias: 'recordModal' },
      { scope: 'record-fields', alias: 'recordFields' },
      { scope: 'record-form', alias: 'recordForm' },
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowsExchange,
      tablerCloudOff,
      tablerRotate,
      tablerTarget,
      tablerThumbDown,
      tablerTrophy,
    }),
  ],
  templateUrl: './opportunity-modal.html',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class OpportunityModal {
  private static nextId = 0;
  protected readonly uid = `opp-modal-${++OpportunityModal.nextId}`;
  protected readonly saveBlockedId = `${this.uid}-save-blocked`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly scope = inject(OpportunityLookups).scope;
  private readonly tenantScope = inject(TenantScopeState);
  private readonly crmModules = inject(CrmModules);
  private readonly draftStore = inject(RecordDraftStore);
  private readonly pipelineScope = inject(PipelineScope);
  protected readonly lookups = inject(OpportunityLookups);
  protected readonly moves = inject(OpportunityMoves);

  private readonly unsavedDialog = viewChild<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialogWrap = viewChild<ElementRef<HTMLElement>>('conflictDialogWrap');
  private readonly deleteDialogWrap = viewChild<ElementRef<HTMLElement>>('deleteDialogWrap');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly reopenDialogWrap = viewChild<ElementRef<HTMLElement>>('reopenDialogWrap');
  private readonly reopenDialog = viewChild<ConfirmDialog>('reopenDialog');
  private readonly opportunityForm = viewChild(OpportunityForm);
  private readonly saveBlockedEl = viewChild<ElementRef<HTMLElement>>('saveBlockedEl');

  readonly saved = output<OpportunityRow>();
  readonly changed = output<OpportunityRow>();
  readonly deleted = output<string>();
  readonly openIdChange = output<string | null>();

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly opportunityId = signal<string | null>(null);
  protected readonly base = signal<OpportunityDraft>(BLANK_DRAFT);
  protected readonly draft = signal<OpportunityDraft>(BLANK_DRAFT);
  protected readonly row = signal<OpportunityRow | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly capabilities = signal<OpportunityCapabilities | null>(null);
  protected readonly nav = signal<RecordNavContext | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly writeReadOnly = signal(false);
  protected readonly createMismatch = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly needsBranch = computed(() => { this.tenantScope.selection(); return !sessionBranch(); });
  protected readonly conflictVisible = signal(false);
  private conflictResolve: ((reload: boolean) => void) | null = null;
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly updatingState = signal<OpportunityUpdatingState>({});
  protected readonly attemptedSubmit = signal(false);
  protected readonly serverErrors = signal<DraftErrors>({});
  protected readonly guardBusy = signal(false);

  private loadSeq = 0;
  private reopenSeq = 0;
  private saveBlockedSyncSeq = 0;
  private lastBodyFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;
  private presetCustomer: CustomerOption | null = null;
  private pendingFocusTitle = false;

  protected readonly scopesReady = computed(() => {
    const lang = this.language();
    this.i18n();
    if (this.transloco.getActiveLang() !== lang) return false;
    const dict = this.transloco.getTranslation(lang);
    return Boolean(dict['oppForm.sections.deal'] && dict['oppModal.typeTitle'] && dict['oppMoves.close.lostTitle'] && dict['recordFields.color.none']);
  });

  protected readonly instantUpdating = computed(() => {
    const state = this.updatingState();
    return Boolean(state.stage || state.rating || state.color);
  });

  protected readonly anyGuardBusy = computed(
    () =>
      this.guardBusy() ||
      this.unsavedGuard.busy() ||
      this.moves.closeRequest() !== null ||
      this.moves.transferRequest() !== null ||
      this.moves.reopenRequest() !== null,
  );

  protected readonly dirty = computed(
    () => !this.loading() && !this.loadFailed() && isDirty(this.base(), this.draft()),
  );

  protected readonly saveBlockedReason = computed<string | null>(
    () => this.opportunityForm()?.saveBlockedReason() ?? this.lookups.saveBlockedReason(),
  );

  protected readonly showSaveBlocked = computed(
    () =>
      this.isOpen() &&
      !this.loading() &&
      !this.loadFailed() &&
      this.canEdit() &&
      Boolean(this.saveBlockedReason()),
  );

  protected readonly unsavedGuard = createUnsavedGuard({
    isDirty: () => this.dirty(),
    save: () => this.save(false),
    discard: () => this.discardUnsavedChanges(),
    dialog: () => this.unsavedDialog(),
    isOpen: () => this.isOpen(),
    isBlocked: () => this.saving() || this.deleting() || this.anyGuardBusy(),
    onLeave: () => this.closeModal(false),
  });

  protected readonly canEdit = computed(() => {
    if (this.writeReadOnly() || this.needsBranch() || this.notFound() || this.forbidden() || !can('crm.opportunities.read')) return false;
    if (this.mode() === 'create') return !!this.lookups.capabilities(this.draft().branchId)?.create && !this.createMismatch();
    const current = this.row();
    return Boolean(current && canUpdateOpportunity(this.capabilities(), current));
  });

  protected readonly canDelete = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    if (this.mode() !== 'edit') return false;
    const current = this.row();
    return Boolean(current && canDeleteOpportunity(this.capabilities(), current));
  });

  protected readonly canMove = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    if (this.mode() !== 'edit') return false;
    const current = this.row();
    return Boolean(current && canMoveOpportunity(this.capabilities(), current));
  });

  protected readonly canTransfer = computed(() => {
    if (this.writeReadOnly() || this.needsBranch()) return false;
    if (this.mode() !== 'edit') return false;
    const current = this.row();
    return Boolean(current && canTransferOpportunity(this.capabilities(), current));
  });

  protected readonly isReadonly = computed(() => !this.canEdit() || this.loading() || this.loadFailed());

  protected readonly subtitle = computed(() => {
    this.i18n();
    const title = this.draft().title.trim();
    if (title) return title;
    // Create mode: the header title already reads "New opportunity", so no fallback subtitle.
    if (this.mode() === 'create') return '';
    return this.row()?.title?.trim() ?? '';
  });

  protected readonly navPos = computed(() =>
    this.mode() === 'edit' ? navPosition(this.nav(), this.opportunityId()) : null,
  );

  protected readonly reopenText = computed(() => {
    this.i18n();
    const req = this.moves.reopenRequest();
    return req ? this.transloco.translate('oppMoves.reopen.body', { stage: req.stageName }) : '';
  });

  protected readonly errors = computed<DraftErrors>(() => {
    const server = this.serverErrors();
    if (!this.attemptedSubmit()) return server;
    const pipeline = this.resolvePipeline(this.draft().pipelineId);
    const client = validateDraft(this.draft(), this.mode(), this.lookups.customFields(), pipeline);
    return { ...server, ...client };
  });

  protected readonly extraActions = computed<RecordModalExtraAction[]>(() => {
    this.i18n();
    if (this.mode() !== 'edit' || this.loading() || this.loadFailed()) return [];
    const current = this.row();
    if (!current) return [];

    const pipeline = this.resolvePipeline(current.pipelineId);
    const busy = this.instantUpdating();
    const actions: RecordModalExtraAction[] = [];

    if (this.canEdit() && this.canMove() && pipeline) {
      if (!isClosed(current)) {
        if (pipeline.stages.some((stage) => stage.isActive && stage.flag === 'WON')) {
          actions.push({
            id: 'won',
            label: this.transloco.translate('oppModal.actions.won'),
            icon: 'tablerTrophy',
            tone: 'success',
            disabled: busy,
          });
        }
        if (pipeline.stages.some((stage) => stage.isActive && stage.flag === 'LOST')) {
          actions.push({
            id: 'lost',
            label: this.transloco.translate('oppModal.actions.lost'),
            icon: 'tablerThumbDown',
            tone: 'danger',
            disabled: busy,
          });
        }
      } else if (this.firstOpenStage(pipeline)) {
        actions.push({
          id: 'reopen',
          label: this.transloco.translate('oppModal.actions.reopen'),
          icon: 'tablerRotate',
          disabled: busy,
        });
      }
    }

    if (this.canTransfer() && this.allPipelines().some((p) => p.isActive && p.id !== current.pipelineId)) {
      actions.push({
        id: 'transfer',
        label: this.transloco.translate('oppModal.actions.transfer'),
        icon: 'tablerArrowsExchange',
        disabled: busy,
      });
    }

    return actions;
  });

  constructor() {
    const onConfirmKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      this.dismissOpenConfirmDialog(event);
    };
    const onConfirmCancel = (event: Event) => {
      this.dismissOpenConfirmDialog(event);
    };
    document.addEventListener('keydown', onConfirmKeydown, { capture: true });
    document.addEventListener('cancel', onConfirmCancel, { capture: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onConfirmKeydown, { capture: true });
      document.removeEventListener('cancel', onConfirmCancel, { capture: true });
    });

    effect(() => {
      const form = this.opportunityForm();
      const open = this.isOpen();
      const m = this.mode();
      if (!form || !open || m !== 'create' || !this.pendingFocusTitle) return;
      this.pendingFocusTitle = false;
      afterNextRender(() => form.focusTitle(), { injector: this.injector });
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
      this.isOpen();
      this.mode();
      this.canEdit();
      this.loading();
      this.loadFailed();
      this.showSaveBlocked();
      this.saveBlockedReason();
      untracked(() => {
        const seq = ++this.saveBlockedSyncSeq;
        afterNextRender(() => this.syncSaveBlockedFooter(seq), { injector: this.injector });
      });
    });
  }

  openCreate(opts: OpenCreateOpportunityOptions): void {
    const seq = ++this.loadSeq;
    this.guardBusy.set(false);
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    this.presetCustomer = null;
    this.pendingFocusTitle = true;

    const selected = sessionBranch();
    const branchId = selected?.branchId ?? null;

    const pipeline = this.resolvePipeline(opts.pipelineId);
    const initial = emptyDraft({
      branchId,
      companyId: selected?.companyId ?? null,
      ownerUserId: this.tenantScope.me()?.id ?? null,
      pipeline,
      stageId: opts.stageId ?? null,
      customer: null,
      defaultCurrency: this.lookups.defaultCurrency(),
    });
    if (!pipeline && opts.pipelineId) {
      initial.pipelineId = opts.pipelineId;
      initial.stageId = opts.stageId ?? null;
    }

    this.mode.set('create');
    this.opportunityId.set(null);
    this.nav.set(null);
    this.row.set(null);
    this.updatedAt.set(null);
    this.capabilities.set(null);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.deleting.set(false);
    this.updatingState.set({});
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.base.set(initial);
    this.draft.set(initial);

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    this.openIdChange.emit(null);

    const customerProfileId = opts.customerProfileId?.trim();
    if (customerProfileId && selected && can('crm.customer_profiles.read')) {
      void getCustomerOption(customerProfileId)
        .then((customer) => {
          if (seq !== this.loadSeq || !this.isOpen() || this.mode() !== 'create') return;
          const currentCustomerId = this.draft().customerProfileId;
          if (currentCustomerId && currentCustomerId !== customer.id) return;
          this.presetCustomer = customer;
          const customerPatch: Partial<OpportunityDraft> = {
            customerProfileId: customer.id,
            customerLabel: customer.displayName,
            customerStatus: customer.status,
            contactPartyId: customer.profileType === 'INDIVIDUAL' ? customer.partyId : null,
          };
          this.base.update((b) => ({ ...b, ...customerPatch }));
          this.draft.update((d) => ({ ...d, ...customerPatch }));
        })
        .catch(() => {
          if (seq !== this.loadSeq || !this.isOpen() || this.mode() !== 'create') return;
          this.notify.warning(this.transloco.translate('oppModal.customerPresetFailed'));
        });
    }
  }

  openRecord(id: string, nav: RecordNavContext | null): Promise<void> {
    this.guardBusy.set(false);
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    this.presetCustomer = null;
    this.pendingFocusTitle = false;

    this.mode.set('edit');
    this.opportunityId.set(id);
    this.nav.set(nav ? { ...nav, ids: [...nav.ids] } : null);

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    this.openIdChange.emit(id);

    return this.loadRecord(id);
  }

  syncClosedFromUrl(): void {
    if (!this.isOpen() || this.mode() !== 'edit') return;
    this.closeModal(false);
  }

  async canDeactivate(): Promise<boolean> {
    return this.unsavedGuard.canDeactivate();
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

  protected retryLoad(): void {
    const id = this.opportunityId();
    if (!id) return;
    void this.loadRecord(id);
  }

  protected async save(addAnother: boolean): Promise<boolean> {
    if (
      this.saving() ||
      this.deleting() ||
      this.loading() ||
      this.loadFailed() ||
      !this.canEdit() ||
      this.saveBlockedReason()
    ) {
      return false;
    }

    this.attemptedSubmit.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(
      this.draft(),
      this.mode(),
      this.lookups.customFields(),
      this.resolvePipeline(this.draft().pipelineId),
    );
    if (Object.keys(validation).length > 0) {
      afterNextRender(() => this.opportunityForm()?.focusFirstError(validation), { injector: this.injector });
      return false;
    }

    if (this.mode() === 'create') {
      return this.submitCreate(addAnother);
    }
    return this.submitEdit();
  }

  protected async onRate(importance: number): Promise<void> {
    const current = this.row();
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

    this.row.set({ ...current, importance });
    this.base.update((b) => ({ ...b, importance }));
    this.draft.update((d) => ({ ...d, importance }));
    this.updatingState.update((s) => ({ ...s, rating: true }));

    try {
      const updated = await patchOpportunity(current.id, { importance, expectedUpdatedAt });
      if (this.row()?.id !== current.id) return;
      this.row.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, importance: updated.importance }));
      this.draft.update((d) => ({ ...d, importance: updated.importance }));
      this.changed.emit(updated);
    } catch (error) {
      if (this.row()?.id !== current.id) return;
      this.row.update((r) => (r ? { ...r, importance: prevImportance } : r));
      this.base.update((b) => ({ ...b, importance: prevBaseImportance }));
      this.draft.update((d) => ({ ...d, importance: prevDraftImportance }));
      this.toastWriteError(error);
    } finally {
      this.updatingState.update((s) => ({ ...s, rating: false }));
    }
  }

  protected async onRecolor(cardColor: CardColor | null): Promise<void> {
    const current = this.row();
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

    this.row.set({ ...current, cardColor });
    this.base.update((b) => ({ ...b, cardColor }));
    this.draft.update((d) => ({ ...d, cardColor }));
    this.updatingState.update((s) => ({ ...s, color: true }));

    try {
      const updated = await patchOpportunity(current.id, { cardColor, expectedUpdatedAt });
      if (this.row()?.id !== current.id) return;
      this.row.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, cardColor: updated.cardColor }));
      this.draft.update((d) => ({ ...d, cardColor: updated.cardColor }));
      this.changed.emit(updated);
    } catch (error) {
      if (this.row()?.id !== current.id) return;
      this.row.update((r) => (r ? { ...r, cardColor: prevColor } : r));
      this.base.update((b) => ({ ...b, cardColor: prevBaseColor }));
      this.draft.update((d) => ({ ...d, cardColor: prevDraftColor }));
      this.toastWriteError(error);
    } finally {
      this.updatingState.update((s) => ({ ...s, color: false }));
    }
  }

  protected async onMoveStage(stageId: string): Promise<void> {
    const current = this.row();
    if (
      this.mode() !== 'edit' ||
      !current ||
      !this.canEdit() ||
      !this.canMove() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    const pipeline = this.resolvePipeline(current.pipelineId);
    const targetStage = pipeline?.stages.find((stage) => stage.id === stageId && stage.isActive);
    if (!targetStage || targetStage.id === current.stageId) return;

    const prevBaseStageId = this.base().stageId;
    const prevDraftStageId = this.draft().stageId;

    this.base.update((b) => ({ ...b, stageId }));
    this.draft.update((d) => ({ ...d, stageId }));
    this.updatingState.update((s) => ({ ...s, stage: true }));

    try {
      const outcome = await this.moves.move(current, targetStage);
      if (this.row()?.id !== current.id) return;
      if (outcome.kind === 'moved') {
        this.applyMovedRow(outcome.row);
        this.changed.emit(outcome.row);
        return;
      }
      this.base.update((b) => ({ ...b, stageId: prevBaseStageId }));
      this.draft.update((d) => ({ ...d, stageId: prevDraftStageId }));
      this.handleMoveFailure(outcome);
    } finally {
      this.updatingState.update((s) => ({ ...s, stage: false }));
    }
  }

  protected async onExtraAction(actionId: string): Promise<void> {
    const current = this.row();
    if (
      this.mode() !== 'edit' ||
      !current ||
      this.loading() ||
      this.loadFailed() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    if (actionId === 'won' || actionId === 'lost') {
      if (!this.canEdit() || !this.canMove() || isClosed(current)) return;
      const pipeline = this.resolvePipeline(current.pipelineId);
      if (!pipeline) return;
      this.updatingState.update((s) => ({ ...s, stage: true }));
      try {
        const outcome = await this.moves.close(current, pipeline, actionId === 'won' ? 'WON' : 'LOST');
        if (this.row()?.id !== current.id) return;
        if (outcome.kind === 'moved') {
          this.applyMovedRow(outcome.row);
          this.changed.emit(outcome.row);
        } else {
          this.handleMoveFailure(outcome);
        }
      } finally {
        this.updatingState.update((s) => ({ ...s, stage: false }));
      }
      return;
    }

    if (actionId === 'reopen') {
      if (!this.canEdit() || !this.canMove() || !isClosed(current)) return;
      const pipeline = this.resolvePipeline(current.pipelineId);
      const targetStage = this.firstOpenStage(pipeline);
      if (!targetStage) return;
      this.updatingState.update((s) => ({ ...s, stage: true }));
      try {
        const outcome = await this.moves.move(current, targetStage);
        if (this.row()?.id !== current.id) return;
        if (outcome.kind === 'moved') {
          this.applyMovedRow(outcome.row);
          this.changed.emit(outcome.row);
        } else {
          this.handleMoveFailure(outcome);
        }
      } finally {
        this.updatingState.update((s) => ({ ...s, stage: false }));
      }
      return;
    }

    if (actionId === 'transfer') {
      if (!this.canTransfer()) return;
      const pipelines = this.allPipelines();
      if (!pipelines.some((p) => p.isActive && p.id !== current.pipelineId)) return;
      this.updatingState.update((s) => ({ ...s, stage: true }));
      try {
        const outcome = await this.moves.transfer(current, pipelines);
        if (this.row()?.id !== current.id) return;
        if (outcome.kind === 'moved') {
          this.applyMovedRow(outcome.row);
          this.changed.emit(outcome.row);
        } else {
          this.handleMoveFailure(outcome);
        }
      } finally {
        this.updatingState.update((s) => ({ ...s, stage: false }));
      }
    }
  }

  protected undoChanges(): void {
    if (!this.dirty() || this.saving() || this.deleting()) return;
    this.draft.set(this.base());
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
  }

  protected continueInFullPage(): void {
    if (this.saving() || this.deleting() || this.loading() || this.loadFailed()) return;
    const isCreate = this.mode() === 'create';
    const recordId = isCreate ? null : this.opportunityId();
    const key = this.draftStore.put<OpportunityDraft>({
      recordType: OPPORTUNITY_RECORD_TYPE,
      draft: this.draft(),
      recordId,
      baseUpdatedAt: isCreate ? null : this.updatedAt(),
      nav: this.nav(),
    });
    const commands = recordId ? ['/crm/opportunities', recordId] : ['/crm/opportunities/new'];
    this.closeModal(false);
    void this.router.navigate(commands, { queryParams: { draft: key } });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal(true);
  }

  protected async onRelatedBadgeClick(click: RelatedBadgeClickEvent): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy()) {
      click.event.preventDefault();
      return;
    }
    if (!this.dirty()) {
      this.closeModal(false);
      return;
    }
    click.event.preventDefault();
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal(false);
    void this.router.navigate(click.target.commands, { queryParams: click.target.queryParams });
  }

  protected async goPrev(): Promise<void> {
    await this.stepNav(-1);
  }

  protected async goNext(): Promise<void> {
    await this.stepNav(1);
  }

  protected async confirmDelete(): Promise<void> {
    const current = this.row();
    if (!this.canDelete() || !current || this.saving() || this.deleting() || this.anyGuardBusy()) return;

    this.guardBusy.set(true);
    let confirmed = false;
    try {
      confirmed = await this.deleteDialog().open();
    } finally {
      this.guardBusy.set(false);
    }
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await deleteOpportunity(current.id);
      this.notify.success(this.transloco.translate('oppModal.deleted'));
      this.deleted.emit(current.id);
      this.closeModal(true);
    } catch (error) {
      this.toastWriteError(error);
      if (error instanceof ApiError && error.status === 404) {
        this.deleted.emit(current.id);
        this.closeModal(true);
      }
    } finally {
      this.deleting.set(false);
    }
  }

  protected onOpenChange(next: boolean): void {
    if (!next && this.isOpen()) {
      this.closeModal(true);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || this.loading() || this.saving() || this.deleting() || this.anyGuardBusy()) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      if (event.defaultPrevented || !this.canEdit() || this.saveBlockedReason()) return;
      event.preventDefault();
      void this.save(false);
      return;
    }
    if (this.mode() !== 'edit') return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const isPrev = rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft';
    event.preventDefault();
    if (isPrev) {
      void this.goPrev();
    } else {
      void this.goNext();
    }
  }

  private dismissOpenConfirmDialog(event: Event): void {
    const wraps = [this.reopenDialogWrap(), this.conflictDialogWrap(), this.deleteDialogWrap()];
    for (const wrap of wraps) {
      const dialog = wrap?.nativeElement.querySelector<HTMLDialogElement>('dialog');
      if (dialog?.open) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        dialog.close();
        return;
      }
    }
  }

  private closeModal(emitUrlClear: boolean): void {
    this.loadSeq++;
    this.pendingFocusTitle = false;
    this.presetCustomer = null;
    this.isOpen.set(false);
    this.nav.set(null);
    this.row.set(null);
    this.opportunityId.set(null);
    this.updatedAt.set(null);
    this.capabilities.set(null);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.deleting.set(false);
    this.updatingState.set({});
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    if (emitUrlClear) {
      this.openIdChange.emit(null);
    }
  }

  private discardUnsavedChanges(): void {
    this.draft.set(this.base());
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
  }

  private async stepNav(dir: -1 | 1): Promise<void> {
    const currentNav = this.nav();
    const currentId = this.opportunityId();
    if (
      this.mode() !== 'edit' ||
      !currentNav ||
      !currentId ||
      this.loading() ||
      this.saving() ||
      this.deleting() ||
      this.anyGuardBusy()
    ) {
      return;
    }

    const pos = navPosition(currentNav, currentId);
    if (!pos) return;
    if (dir === -1 && pos.index <= 1) return;
    if (dir === 1 && pos.index >= pos.total) return;

    if (!(await this.unsavedGuard.confirmLeave())) return;

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});

    let workingNav: RecordNavContext = { ...currentNav, ids: [...currentNav.ids] };
    const cursorId = currentId;

    while (seq === this.loadSeq) {
      let target: { id: string; nav: RecordNavContext } | null = null;
      try {
        target = await nextNavTarget(workingNav, cursorId, dir);
      } catch {
        if (seq === this.loadSeq) {
          this.loading.set(false);
          this.loadFailed.set(true);
        }
        return;
      }

      if (seq !== this.loadSeq) return;
      if (!target) break;

      workingNav = target.nav;
      this.nav.set(workingNav);
      this.opportunityId.set(target.id);

      try {
        const loaded = await getOpportunity(target.id);
        if (seq !== this.loadSeq) return;
        const caps = await getOpportunityCapabilities(loaded.branchId);
        if (seq !== this.loadSeq) return;
        this.applyLoadedRow(loaded, caps);
        this.openIdChange.emit(loaded.id);
        return;
      } catch (error) {
        if (seq !== this.loadSeq) return;
        if (error instanceof ApiError && error.status === 404) {
          this.notify.warning(
            this.transloco.translate(dir === -1 ? 'oppModal.opportunityGonePrev' : 'oppModal.opportunityGone'),
          );
          const nextIds = workingNav.ids.filter((id) => id !== target.id);
          workingNav = {
            ...workingNav,
            ids: nextIds,
            total: Math.max(nextIds.length, workingNav.total - 1),
          };
          this.nav.set(workingNav);
          continue;
        }
        this.loading.set(false);
        this.loadFailed.set(true);
        return;
      }
    }

    if (seq === this.loadSeq) {
      this.opportunityId.set(this.row()?.id ?? currentId);
      this.loading.set(false);
    }
  }

  private async loadRecord(id: string): Promise<void> {
    if (!sessionBranch()) { this.loading.set(false); return; }
    if (!can('crm.opportunities.read')) { this.forbidden.set(true); this.loading.set(false); return; }
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.forbidden.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.updatingState.set({});

    try {
      const loaded = await getOpportunity(id);
      if (seq !== this.loadSeq) return;
      const caps = await getOpportunityCapabilities(loaded.branchId).catch(() => null);
      if (seq !== this.loadSeq) return;
      this.applyLoadedRow(loaded, caps);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (errorCodeOf(error) === 'CRM_OPPORTUNITIES_DISABLED') {
        this.toastWriteError(error);
      }
      this.loading.set(false);
      const state = opportunityRecordError(this.transloco, error, 'oppModal');
      this.notFound.set(state.kind === 'not-found');
      this.forbidden.set(state.kind === 'forbidden');
      this.loadFailed.set(state.kind === 'load-failure');
      this.loadCorrelationId.set(state.correlationId);
    }
  }

  private applyLoadedRow(loaded: OpportunityRow, caps: OpportunityCapabilities | null): void {
    const mapped = draftFromRow(loaded, this.scope.companies());
    this.opportunityId.set(loaded.id);
    this.row.set(loaded);
    this.updatedAt.set(loaded.updatedAt);
    this.capabilities.set(caps);
    this.base.set(mapped);
    this.draft.set(mapped);
    this.loading.set(false);
    this.loadFailed.set(false);
  }

  private applyMovedRow(updated: OpportunityRow): void {
    this.row.set(updated);
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
  }

  private async submitCreate(addAnother: boolean): Promise<boolean> {
    const currentDraft = this.draft();
    const body = toCreateBody(currentDraft);
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastBodyFingerprint || !this.lastIdempotencyKey) {
      this.lastBodyFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      let created = await createOpportunity(body, this.lastIdempotencyKey);
      if (currentDraft.tagIds.length) {
        try { created = { ...created, tags: await attachOpportunityTags(created.id, currentDraft.tagIds) }; }
        catch { this.notify.warning(this.transloco.translate('oppForm.savedWithoutTags')); }
      }
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;
      this.notify.success(this.transloco.translate('oppModal.created'));
      this.saved.emit(created);

      if (addAnother) {
        const pipeline = this.resolvePipeline(currentDraft.pipelineId);
        const customer =
          this.presetCustomer && this.presetCustomer.id === currentDraft.customerProfileId
            ? this.presetCustomer
            : null;
        const next = emptyDraft({
          branchId: currentDraft.branchId,
          companyId: currentDraft.companyId,
          ownerUserId: currentDraft.ownerUserId,
          pipeline,
          stageId: currentDraft.stageId,
          customer,
          defaultCurrency: this.lookups.defaultCurrency() ?? currentDraft.currencyCode,
        });
        if (!pipeline && currentDraft.pipelineId) {
          next.pipelineId = currentDraft.pipelineId;
          next.stageId = currentDraft.stageId;
        }
        if (!customer && currentDraft.customerProfileId) {
          next.customerProfileId = currentDraft.customerProfileId;
          next.customerLabel = currentDraft.customerLabel;
          next.customerStatus = currentDraft.customerStatus;
          next.contactPartyId = currentDraft.contactPartyId;
        }
        this.base.set(next);
        this.draft.set(next);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        afterNextRender(() => this.opportunityForm()?.focusTitle(), { injector: this.injector });
      } else {
        let caps = this.lookups.capabilities(created.branchId);
        try {
          caps = await getOpportunityCapabilities(created.branchId);
        } catch {
          // Keep existing capabilities if refresh fails.
        }
        const mapped = draftFromRow(created, this.scope.companies());
        this.presetCustomer = null;
        this.capabilities.set(caps);
        this.mode.set('edit');
        this.opportunityId.set(created.id);
        this.nav.set(null);
        this.row.set(created);
        this.updatedAt.set(created.updatedAt);
        this.base.set(mapped);
        this.draft.set(mapped);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        this.openIdChange.emit(created.id);
      }
      return true;
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.lastIdempotencyKey = null;
        this.lastBodyFingerprint = null;
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async submitEdit(): Promise<boolean> {
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
    let latest = this.row();

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
        this.row.set(latest);
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
            this.row.set(refreshed);
            this.updatedAt.set(refreshed.updatedAt);
            this.base.set(refreshedMapped);
            this.draft.update((d) => ({ ...refreshedMapped, tagIds: [...d.tagIds] }));
            if (patchBody !== null) {
              this.changed.emit(refreshed);
            }
          } catch {
            if (patchBody !== null && latest) {
              this.changed.emit(latest);
            }
          }
          this.handleSaveError(error);
          return false;
        }
      }

      if (!latest) return false;
      const finalMapped = draftFromRow(latest, this.scope.companies());
      this.row.set(latest);
      this.updatedAt.set(latest.updatedAt);
      this.base.set(finalMapped);
      this.draft.set(finalMapped);
      this.attemptedSubmit.set(false);
      this.serverErrors.set({});
      this.notify.success(this.transloco.translate('oppModal.saved'));
      this.saved.emit(latest);
      return true;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(id: string): Promise<boolean> {
    if (this.guardBusy()) return false;
    this.guardBusy.set(true);
    let reload = false;
    try {
      this.conflictVisible.set(true);
      reload = await new Promise<boolean>((resolve) => { this.conflictResolve = resolve; });
    } finally {
      this.guardBusy.set(false);
    }
    try {
      const fresh = await getOpportunity(id);
      if (this.opportunityId() !== id) return false;
      if (!reload) {
        this.updatedAt.set(fresh.updatedAt);
        this.row.update((row) => row ? { ...row, updatedAt: fresh.updatedAt } : row);
        return false;
      }
      const caps = await getOpportunityCapabilities(fresh.branchId);
      if (this.opportunityId() !== id) return false;
      this.applyLoadedRow(fresh, caps);
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
      afterNextRender(() => this.opportunityForm()?.focusFirstError(mapped), { injector: this.injector });
      return;
    }

    this.toastWriteError(error);
  }

  private handleMoveFailure(outcome: MoveOutcome): void {
    if (outcome.kind === 'failed') {
      if (outcome.code === 'CRM.OPPORTUNITY.STALE_MOVE') void this.handleConflict(this.opportunityId()!);
      if (outcome.code === 'PIPELINE_STAGE_NOT_FOUND' && this.opportunityId()) {
        this.lookups.reloadPipelines();
        void this.loadRecord(this.opportunityId()!);
      }
      if (['CRM_OPPORTUNITIES_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(outcome.code ?? '')) this.writeReadOnly.set(true);
    }
  }

  private toastWriteError(error: unknown): void {
    const state = opportunityRecordError(this.transloco, error, 'oppForm');
    this.notify.error(state.message);
    if (state.readOnly) this.writeReadOnly.set(true);
  }

  private isConcurrentUpdate(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 'CRM.OPPORTUNITY.CONCURRENT_UPDATE'
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

  private syncSaveBlockedFooter(seq: number): void {
    if (seq !== this.saveBlockedSyncSeq) return;
    const footer = this.host.nativeElement.querySelector<HTMLElement>('[modal-footer]');
    if (!footer) return;

    for (const btn of Array.from(footer.querySelectorAll<HTMLButtonElement>('button[aria-describedby]'))) {
      if (btn.getAttribute('aria-describedby') === this.saveBlockedId) {
        btn.removeAttribute('aria-describedby');
      }
    }

    const primaryBtn = footer.querySelector<HTMLButtonElement>('button[variant="primary"]');
    const saveAndNewBtn =
      this.mode() === 'create' ? footer.querySelector<HTMLButtonElement>('button[variant="secondary"]') : null;
    const noteEl = this.saveBlockedEl()?.nativeElement;
    const anchor = saveAndNewBtn ?? primaryBtn;

    if (anchor && noteEl && noteEl.previousElementSibling !== anchor) {
      anchor.after(noteEl);
    }

    if (this.showSaveBlocked()) {
      primaryBtn?.setAttribute('aria-describedby', this.saveBlockedId);
      saveAndNewBtn?.setAttribute('aria-describedby', this.saveBlockedId);
    }
  }
}
