import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerUserPlus } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { RecordModalFrame } from '../../shared/record/modal/record-modal-frame';
import { createUnsavedGuard } from '../../shared/record/modal/record-unsaved-guard';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { invalidateRelatedCounts } from '../../shared/record/related/related-records.api';
import { RelatedBadgeClickEvent } from '../../shared/record/related/related-records.model';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  ContactDraft,
  DraftErrors,
  LeadDraft,
  UpdateLeadBody,
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  toCreateBody,
  toPatchBody,
  validateDraft,
} from '../lead-form/lead-draft';
import { LeadDraftStore } from '../lead-form/lead-draft-store';
import { LeadForm } from '../lead-form/lead-form';
import { LeadLookups } from '../lead-form/lead-lookups';
import { mapContactsPatchErrors, toPatchContactsBody } from '../lead-form/sections/contacts-section/contacts-section';
import {
  createLead,
  deleteLead,
  getLead,
  getLeadCapabilities,
  loadSearchOptions,
  moveLead,
  patchLead,
  setLeadColor,
  setLeadRating,
} from '../leads.api';
import {
  CardColor,
  LeadsCapabilities,
  LeadDetail,
  LeadNavContext,
  LeadStage,
  nameIn,
} from '../leads.model';

type ConflictChoice = 'reload' | 'keep' | 'dismiss';

@Component({
  selector: 'app-lead-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    UnsavedDialog,
    RecordModalFrame,
    RecordRelatedBadges,
    LeadForm,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'record-modal', alias: 'recordModal' },
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'lead-modal', alias: 'leadModal' },
      { scope: 'lead-form', alias: 'leadForm' },
    ),
    provideIcons({ tablerCloudOff, tablerUserPlus }),
  ],
  templateUrl: './lead-modal.html',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class LeadModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly draftStore = inject(LeadDraftStore);

  private readonly unsavedDialog = viewChild<UnsavedDialog>('unsavedDialog');
  private readonly deleteDialogWrap = viewChild<ElementRef<HTMLElement>>('deleteDialogWrap');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly leadForm = viewChild(LeadForm);
  private readonly formLookups = viewChild<LeadForm, LeadLookups>(LeadForm, { read: LeadLookups });

  readonly saved = output<LeadDetail>();
  readonly changed = output<LeadDetail>();
  readonly deleted = output<string>();

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly leadId = signal<string | null>(null);
  protected readonly base = signal<LeadDraft>(emptyDraft());
  protected readonly draft = signal<LeadDraft>(emptyDraft());
  protected readonly detail = signal<LeadDetail | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly capabilities = signal<LeadsCapabilities | null>(null);
  protected readonly nav = signal<LeadNavContext | null>(null);
  protected readonly fallbackStages = signal<LeadStage[]>([]);

  protected readonly loading = signal(false);
  private readonly i18nEvents = translationEvents(this.transloco);
  /** The form renders only once the lead-form and lead-modal texts are loaded, so no raw keys flash. */
  protected readonly scopesReady = computed(() => {
    const lang = this.language();
    this.i18nEvents();
    if (this.transloco.getActiveLang() !== lang) return false;
    const dict = this.transloco.getTranslation(lang);
    return Boolean(dict['leadForm.basics.individual'] && dict['leadModal.title']);
  });
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly instantUpdating = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly serverErrors = signal<DraftErrors>({});
  protected readonly formRevision = signal(0);
  protected readonly conflictOpen = signal(false);
  protected readonly guardBusy = signal(false);

  private loadSeq = 0;
  private restoredFromPreset = false;
  private lastBodyFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;
  private conflictResolver: ((choice: ConflictChoice) => void) | null = null;

  protected readonly unsavedGuard = createUnsavedGuard({
    isDirty: () => this.dirty() || this.hasUnsavedContact(),
    save: () => this.saveForLeave(),
    discard: () => this.discardUnsavedChanges(),
    dialog: () => this.unsavedDialog(),
    isOpen: () => this.isOpen(),
    isBlocked: () => this.saving() || this.deleting() || this.guardBusy() || this.conflictOpen(),
    onLeave: () => this.closeModal(),
  });

  protected readonly anyGuardBusy = computed(
    () => this.guardBusy() || this.unsavedGuard.busy() || this.conflictOpen(),
  );

  constructor() {
    const onDeleteKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.guardBusy()) return;
      this.dismissDeleteDialog(event);
    };
    const onDeleteCancel = (event: Event) => {
      if (!this.guardBusy()) return;
      this.dismissDeleteDialog(event);
    };
    document.addEventListener('keydown', onDeleteKeydown, { capture: true });
    document.addEventListener('cancel', onDeleteCancel, { capture: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onDeleteKeydown, { capture: true });
      document.removeEventListener('cancel', onDeleteCancel, { capture: true });
      this.settleConflict('dismiss');
    });
  }

  protected readonly dirty = computed(() => !draftsEqual(this.base(), this.draft()));
  protected readonly hasUnsavedContact = computed(() => this.leadForm()?.contactUnsaved() ?? false);
  protected readonly saveContactsBound = (contacts: ContactDraft[], editIndex?: number) =>
    this.onSaveContacts(contacts, editIndex);

  protected readonly canEdit = computed(() => {
    if (this.mode() === 'create') return true;
    const current = this.detail();
    const caps = this.capabilities();
    return !!current && !!caps?.leads.update && current.status !== 'CONVERTED';
  });

  protected readonly canDelete = computed(() => {
    if (this.mode() !== 'edit') return false;
    return !!this.detail() && !!this.capabilities()?.leads.delete;
  });

  protected readonly isReadonly = computed(() => !this.canEdit() || this.loading() || this.loadFailed());

  protected readonly headerStages = computed<LeadStage[]>(() => {
    const lookups = this.formLookups();
    if (this.mode() === 'create') {
      const stages = lookups?.stages();
      if (stages && stages.length > 0) return stages;
      return this.fallbackStages().filter((s) => s.isActive && s.flag !== 'DISQUALIFIED' && s.flag !== 'CONVERTED');
    }
    const allStages = lookups?.allStages();
    if (allStages && allStages.length > 0) return allStages;
    return this.fallbackStages().filter((s) => s.isActive);
  });

  protected readonly currentStageId = computed(() =>
    this.mode() === 'create' ? this.draft().stageId : (this.detail()?.stageId ?? this.draft().stageId),
  );

  protected readonly errors = computed<DraftErrors>(() => {
    const server = this.serverErrors();
    if (!this.attemptedSubmit()) return server;
    const customFields = this.formLookups()?.customFields() ?? [];
    const client = validateDraft(this.draft(), this.mode(), customFields);
    return { ...server, ...client };
  });

  protected readonly isSwitchingType = computed(() => this.leadForm()?.switchingType() ?? false);

  protected readonly displayName = computed(() => {
    if (this.mode() !== 'edit') return '';
    const d = this.draft();
    if (d.leadProfileType === 'INDIVIDUAL') {
      const name = [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
      if (name) return name;
    } else {
      const name = d.existingCompanyPartyId ? (d.existingCompanyName ?? '').trim() : d.companyName.trim();
      if (name) return name;
    }
    return this.detail()?.displayName ?? '';
  });

  protected readonly navPosition = computed(() => {
    if (this.mode() !== 'edit') return null;
    const currentNav = this.nav();
    const id = this.leadId();
    if (!currentNav || !id || currentNav.ids.length === 0) return null;
    const index = currentNav.ids.indexOf(id);
    if (index < 0) return null;
    const total = currentNav.loadMore ? Math.max(currentNav.total, currentNav.ids.length) : currentNav.ids.length;
    return { index: index + 1, total };
  });

  protected readonly deleteLeadName = computed(() => {
    const d = this.detail();
    if (!d) return '';
    return d.leadProfileType === 'CORPORATE' ? (d.companyName ?? d.displayName) : d.displayName;
  });

  openCreate(preset?: { stageId?: string; draft?: LeadDraft }): void {
    this.loadSeq++;
    this.guardBusy.set(false);
    this.conflictOpen.set(false);
    this.settleConflict('dismiss');
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    this.restoredFromPreset = !!preset?.draft;

    const initial = preset?.draft
      ? preset.draft
      : emptyDraft(preset?.stageId ? { stageId: preset.stageId } : undefined);
    const baseline = preset?.draft ? emptyDraft() : initial;

    this.mode.set('create');
    this.leadId.set(null);
    this.nav.set(null);
    this.detail.set(null);
    this.updatedAt.set(null);
    this.capabilities.set(null);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.deleting.set(false);
    this.instantUpdating.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.base.set(baseline);
    this.draft.set(initial);
    this.formRevision.update((v) => v + 1);

    void this.ensureFallbackStages();

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    afterNextRender(() => this.leadForm()?.focusName(), { injector: this.injector });
  }

  openLead(id: string, nav: LeadNavContext | null): void {
    this.guardBusy.set(false);
    this.conflictOpen.set(false);
    this.settleConflict('dismiss');
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    this.restoredFromPreset = false;

    this.mode.set('edit');
    this.leadId.set(id);
    this.nav.set(nav ? { ...nav, ids: [...nav.ids] } : null);

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }

    void this.loadLead(id);
  }

  async canDeactivate(): Promise<boolean> {
    return this.unsavedGuard.canDeactivate();
  }

  protected onFormDraftChange(next: LeadDraft): void {
    const prev = this.draft();
    if (draftsEqual(prev, next)) {
      this.draft.set(next);
      return;
    }

    if (this.mode() === 'create' && !this.restoredFromPreset && this.onlyNullBranchOrStageAdded(prev, next)) {
      const currentBase = this.base();
      this.base.set({
        ...currentBase,
        branchId: currentBase.branchId ?? next.branchId,
        stageId: currentBase.stageId ?? next.stageId,
      });
      this.draft.set(next);
      return;
    }

    this.serverErrors.set({});
    this.draft.set(next);
  }

  protected retryLoad(): void {
    const id = this.leadId();
    if (!id) return;
    void this.loadLead(id);
  }

  protected async save(addAnother: boolean): Promise<boolean> {
    if (this.saving() || this.deleting() || this.loading() || this.loadFailed() || !this.canEdit()) return false;

    if (this.mode() === 'edit' && this.hasUnsavedContact()) {
      const contactSaved = await (this.leadForm()?.saveEditingContact() ?? Promise.resolve(true));
      if (!contactSaved) return false;
      if (!this.dirty()) return true;
    }

    this.attemptedSubmit.set(true);
    this.serverErrors.set({});
    const customFields = this.formLookups()?.customFields() ?? [];
    const validation = validateDraft(this.draft(), this.mode(), customFields);
    if (Object.keys(validation).length > 0) {
      this.focusFirstValidationError(validation);
      return false;
    }

    if (this.mode() === 'create') {
      return this.submitCreate(addAnother);
    }
    return this.submitEdit();
  }

  protected async onRate(rating: number): Promise<void> {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current || !this.canEdit() || this.instantUpdating() || this.saving() || this.deleting()) return;

    const prevRating = current.rating;
    const prevBaseRating = this.base().rating;
    const prevDraftRating = this.draft().rating;

    this.detail.set({ ...current, rating });
    this.base.update((b) => ({ ...b, rating }));
    this.draft.update((d) => ({ ...d, rating }));
    this.instantUpdating.set(true);

    try {
      const updated = await setLeadRating(current.id, rating);
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, rating: updated.rating }));
      this.draft.update((d) => ({ ...d, rating: updated.rating }));
      this.changed.emit(updated);
    } catch {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, rating: prevRating } : d));
      this.base.update((b) => ({ ...b, rating: prevBaseRating }));
      this.draft.update((d) => ({ ...d, rating: prevDraftRating }));
      this.notify.error(this.transloco.translate('recordModal.instant.failed'));
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async onRecolor(cardColor: CardColor | null): Promise<void> {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current || !this.canEdit() || this.instantUpdating() || this.saving() || this.deleting()) return;

    const prevColor = current.cardColor;
    const prevBaseColor = this.base().cardColor;
    const prevDraftColor = this.draft().cardColor;

    this.detail.set({ ...current, cardColor });
    this.base.update((b) => ({ ...b, cardColor }));
    this.draft.update((d) => ({ ...d, cardColor }));
    this.instantUpdating.set(true);

    try {
      const updated = await setLeadColor(current.id, cardColor);
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, cardColor: updated.cardColor }));
      this.draft.update((d) => ({ ...d, cardColor: updated.cardColor }));
      this.changed.emit(updated);
    } catch {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, cardColor: prevColor } : d));
      this.base.update((b) => ({ ...b, cardColor: prevBaseColor }));
      this.draft.update((d) => ({ ...d, cardColor: prevDraftColor }));
      this.notify.error(this.transloco.translate('recordModal.instant.failed'));
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async onMoveStage(stageId: string): Promise<void> {
    const current = this.detail();
    if (this.mode() !== 'edit' || !current || !this.canEdit() || this.instantUpdating() || this.saving() || this.deleting()) return;

    const targetStage = this.headerStages().find((s) => s.id === stageId);
    const prevStageId = current.stageId;
    const prevStageFlag = current.stageFlag;
    const prevStatus = current.status;
    const prevBaseStageId = this.base().stageId;
    const prevDraftStageId = this.draft().stageId;

    this.detail.set({
      ...current,
      stageId,
      stageFlag: targetStage?.flag ?? current.stageFlag,
    });
    this.base.update((b) => ({ ...b, stageId }));
    this.draft.update((d) => ({ ...d, stageId }));
    this.instantUpdating.set(true);

    try {
      const movedRow = await moveLead(current.id, stageId);
      if (this.detail()?.id !== current.id) return;
      const updatedDetail: LeadDetail = {
        ...current,
        stageId: movedRow.stageId,
        stageFlag: movedRow.stageFlag,
        status: movedRow.status,
        updatedAt: movedRow.updatedAt,
      };
      this.detail.set(updatedDetail);
      this.updatedAt.set(movedRow.updatedAt);
      this.base.update((b) => ({ ...b, stageId: movedRow.stageId }));
      this.draft.update((d) => ({ ...d, stageId: movedRow.stageId }));
      if (updatedDetail.status === 'CONVERTED') {
        invalidateRelatedCounts('LEAD', updatedDetail.id);
      }
      this.changed.emit(updatedDetail);
      const stageName = targetStage ? nameIn(targetStage, this.language()) : '';
      this.notify.success(this.transloco.translate('leadModal.stage.done', { stage: stageName }));
    } catch {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) =>
        d ? { ...d, stageId: prevStageId, stageFlag: prevStageFlag, status: prevStatus } : d,
      );
      this.base.update((b) => ({ ...b, stageId: prevBaseStageId }));
      this.draft.update((d) => ({ ...d, stageId: prevDraftStageId }));
      this.notify.error(this.transloco.translate('recordModal.instant.failed'));
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async undoChanges(): Promise<void> {
    if (!this.dirty() || this.saving() || this.deleting()) return;
    if (this.hasUnsavedContact()) {
      if (this.anyGuardBusy()) return;
      const dialog = this.unsavedDialog();
      if (!dialog) return;
      this.guardBusy.set(true);
      let choice: 'save' | 'discard' | 'cancel' = 'cancel';
      try {
        choice = await dialog.open();
      } finally {
        this.guardBusy.set(false);
      }
      if (choice === 'cancel') return;
      if (choice === 'save') {
        const saved = await (this.leadForm()?.saveEditingContact() ?? Promise.resolve(true));
        if (!saved) return;
      } else {
        this.leadForm()?.discardContactEdit();
      }
    }
    this.draft.set(this.base());
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.formRevision.update((v) => v + 1);
  }

  protected continueInFullPage(): void {
    if (this.saving() || this.deleting() || this.loading() || this.loadFailed()) return;
    const key = this.draftStore.put({
      draft: this.leadForm()?.draftWithEditingContact() ?? this.draft(),
      leadId: this.leadId(),
      baseUpdatedAt: this.updatedAt(),
      nav: this.nav(),
    });
    const targetId = this.leadId() ?? 'new';
    this.closeModal();
    void this.router.navigate(['/crm/leads', targetId], { queryParams: { draft: key } });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy() || this.isSwitchingType()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal();
  }

  protected async navigateTo(targetId: string): Promise<void> {
    if (!targetId || targetId === this.leadId() || this.saving() || this.deleting()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    const currentNav = this.nav();
    const nextNav = currentNav && currentNav.ids.includes(targetId) ? currentNav : null;
    this.openLead(targetId, nextNav);
  }

  protected async goPrev(): Promise<void> {
    await this.stepNav(-1);
  }

  protected async goNext(): Promise<void> {
    await this.stepNav(1);
  }

  protected async confirmDelete(): Promise<void> {
    const current = this.detail();
    if (!this.canDelete() || !current || this.saving() || this.deleting() || this.anyGuardBusy()) return;
    this.guardBusy.set(true);
    try {
      const confirmed = await this.deleteDialog().open();
      if (!confirmed) return;
    } finally {
      this.guardBusy.set(false);
    }

    this.deleting.set(true);
    try {
      await deleteLead(current.id);
      this.notify.success(this.transloco.translate('leadModal.delete.done'));
      this.deleted.emit(current.id);
      this.closeModal();
    } catch (error) {
      this.toastServerError(errorCodeOf(error));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onDeleteDialogEscape(event: Event): void {
    this.dismissDeleteDialog(event);
  }

  protected onOpenChange(next: boolean): void {
    if (!next && this.isOpen()) {
      this.closeModal();
    }
  }

  protected onConflictChoice(choice: 'reload' | 'keep'): void {
    this.conflictOpen.set(false);
    this.settleConflict(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    this.conflictOpen.set(open);
    if (!open) {
      this.settleConflict('dismiss');
    }
  }

  protected onRelatedBadgeClick(click: RelatedBadgeClickEvent): void {
    if (
      click.event.button !== 0 ||
      click.event.ctrlKey ||
      click.event.metaKey ||
      click.event.shiftKey ||
      click.event.altKey
    ) {
      return;
    }
    if (this.dirty() || this.hasUnsavedContact()) {
      click.event.preventDefault();
      void this.leaveForRelatedBadge(click);
      return;
    }
    this.closeModal();
  }

  private async leaveForRelatedBadge(click: RelatedBadgeClickEvent): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy() || this.isSwitchingType()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal();
    void this.router.navigate(click.target.commands, { queryParams: click.target.queryParams });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || this.loading() || this.saving() || this.deleting() || this.anyGuardBusy()) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (this.leadForm()?.isEditingContact()) {
        void this.leadForm()!.saveEditingContact();
        return;
      }
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

  private closeModal(): void {
    this.loadSeq++;
    this.isOpen.set(false);
    this.conflictOpen.set(false);
    this.settleConflict('dismiss');
    this.nav.set(null);
    this.detail.set(null);
    this.leadId.set(null);
    this.updatedAt.set(null);
    this.capabilities.set(null);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.deleting.set(false);
    this.instantUpdating.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
  }

  private dismissDeleteDialog(event: Event): void {
    const dialog = this.deleteDialogWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  private async saveForLeave(): Promise<boolean> {
    if (this.hasUnsavedContact()) {
      const contactSaved = await (this.leadForm()?.saveEditingContact() ?? Promise.resolve(true));
      if (!contactSaved) return false;
    }
    if (this.dirty()) {
      return this.save(false);
    }
    return true;
  }

  private discardUnsavedChanges(): void {
    this.leadForm()?.discardContactEdit();
    this.draft.set(this.base());
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
  }

  private openConflictDialog(): Promise<ConflictChoice> {
    this.settleConflict('dismiss');
    this.conflictOpen.set(true);
    return new Promise<ConflictChoice>((resolve) => {
      this.conflictResolver = resolve;
    });
  }

  private settleConflict(choice: ConflictChoice): void {
    const resolve = this.conflictResolver;
    this.conflictResolver = null;
    resolve?.(choice);
  }

  private async stepNav(dir: -1 | 1): Promise<void> {
    const currentNav = this.nav();
    const currentId = this.leadId();
    if (this.mode() !== 'edit' || !currentNav || !currentId || this.loading() || this.saving() || this.deleting()) return;

    const currentIdx = currentNav.ids.indexOf(currentId);
    if (currentIdx < 0) return;

    let targetIndex = currentIdx + dir;
    if (dir === -1 && targetIndex < 0) return;
    if (dir === 1 && targetIndex >= currentNav.ids.length) {
      if (!currentNav.loadMore || currentNav.ids.length >= currentNav.total) return;
    }

    if (!(await this.unsavedGuard.confirmLeave())) return;

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});

    let navState: LeadNavContext = { ...currentNav, ids: [...currentNav.ids] };

    while (seq === this.loadSeq) {
      if (dir === 1 && targetIndex >= navState.ids.length) {
        if (!navState.loadMore || navState.ids.length >= navState.total) break;
        try {
          const more = await navState.loadMore();
          if (seq !== this.loadSeq) return;
          const appended = more.filter((id) => !navState.ids.includes(id));
          if (appended.length === 0) break;
          navState = { ...navState, ids: [...navState.ids, ...appended] };
          this.nav.set(navState);
        } catch {
          if (seq === this.loadSeq) {
            this.loading.set(false);
            this.loadFailed.set(true);
          }
          return;
        }
      }

      if (targetIndex < 0 || targetIndex >= navState.ids.length) break;
      const candidateId = navState.ids[targetIndex];
      this.leadId.set(candidateId);

      try {
        const [loaded] = await Promise.all([getLead(candidateId), this.ensureFallbackStages()]);
        if (seq !== this.loadSeq) return;
        const caps = await getLeadCapabilities(loaded.branchId);
        if (seq !== this.loadSeq) return;
        this.applyLoadedLead(loaded, caps);
        return;
      } catch (error) {
        if (seq !== this.loadSeq) return;
        if (error instanceof ApiError && error.status === 404) {
          this.notify.warning(
            this.transloco.translate(dir === -1 ? 'leadModal.leadGonePrev' : 'leadModal.leadGone'),
          );
          const nextIds = [...navState.ids.slice(0, targetIndex), ...navState.ids.slice(targetIndex + 1)];
          navState = {
            ...navState,
            ids: nextIds,
            total: Math.max(nextIds.length, navState.total - 1),
          };
          this.nav.set(navState);
          if (dir === -1) {
            targetIndex -= 1;
          }
          continue;
        }
        this.loading.set(false);
        this.loadFailed.set(true);
        return;
      }
    }

    if (seq === this.loadSeq) {
      this.leadId.set(this.detail()?.id ?? currentId);
      this.loading.set(false);
    }
  }

  private async loadLead(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.instantUpdating.set(false);

    try {
      const [loaded] = await Promise.all([getLead(id), this.ensureFallbackStages()]);
      if (seq !== this.loadSeq) return;
      const caps = await getLeadCapabilities(loaded.branchId);
      if (seq !== this.loadSeq) return;
      this.applyLoadedLead(loaded, caps);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      this.loadFailed.set(true);
    }
  }

  private applyLoadedLead(loaded: LeadDetail, caps: LeadsCapabilities): void {
    const mapped = draftFromDetail(loaded);
    this.leadId.set(loaded.id);
    this.detail.set(loaded);
    this.updatedAt.set(loaded.updatedAt);
    this.capabilities.set(caps);
    this.base.set(mapped);
    this.draft.set(mapped);
    this.restoredFromPreset = false;
    this.loading.set(false);
    this.loadFailed.set(false);
    this.formRevision.update((v) => v + 1);
  }

  private async ensureFallbackStages(): Promise<void> {
    if (this.fallbackStages().length > 0) return;
    try {
      const options = await loadSearchOptions();
      this.fallbackStages.set(options.stages);
    } catch {
      // Stages from LeadLookups remain available when LeadForm mounts.
    }
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
      const created = await createLead(body, this.lastIdempotencyKey);
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;
      this.notify.success(this.transloco.translate('leadModal.created', { name: created.displayName }));
      this.saved.emit(created);

      if (addAnother) {
        const next = emptyDraft({
          branchId: currentDraft.branchId,
          ownerUserId: currentDraft.ownerUserId,
          acquisitionSourceId: currentDraft.acquisitionSourceId,
          stageId: currentDraft.stageId,
          tagIds: [...currentDraft.tagIds],
        });
        this.restoredFromPreset = false;
        this.base.set(next);
        this.draft.set(next);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        afterNextRender(() => this.leadForm()?.focusName(), { injector: this.injector });
      } else {
        let caps = this.formLookups()?.capabilities() ?? null;
        try {
          caps = await getLeadCapabilities(created.branchId);
        } catch {
          // Keep existing capabilities if refresh fails.
        }
        const mapped = draftFromDetail(created);
        this.capabilities.set(caps);
        this.mode.set('edit');
        this.leadId.set(created.id);
        this.nav.set(null);
        this.detail.set(created);
        this.updatedAt.set(created.updatedAt);
        this.base.set(mapped);
        this.draft.set(mapped);
        this.restoredFromPreset = false;
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        this.formRevision.update((v) => v + 1);
      }
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async submitEdit(): Promise<boolean> {
    const id = this.leadId();
    const expectedUpdatedAt = this.updatedAt();
    if (!id || !expectedUpdatedAt) return false;
    if (!this.dirty()) return true;

    const prevPartyId = this.detail()?.partyId;
    const prevStatus = this.detail()?.status;
    const patchBody = toPatchBody(this.base(), this.draft(), expectedUpdatedAt);
    this.saving.set(true);
    try {
      const updated = await patchLead(id, patchBody);
      const mapped = draftFromDetail(updated);
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.set(mapped);
      this.draft.set(mapped);
      this.attemptedSubmit.set(false);
      this.serverErrors.set({});
      if (updated.partyId !== prevPartyId || updated.status !== prevStatus) {
        invalidateRelatedCounts('LEAD', updated.id);
      }
      this.notify.success(this.transloco.translate('recordModal.saved'));
      this.saved.emit(updated);
      return true;
    } catch (error) {
      if (this.isConcurrentUpdate(error)) {
        this.saving.set(false);
        return this.handleConflict(id);
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(id: string): Promise<boolean> {
    if (this.anyGuardBusy()) return false;
    const choice = await this.openConflictDialog();
    if (choice === 'dismiss') return false;

    try {
      const fresh = await getLead(id);
      const caps = await getLeadCapabilities(fresh.branchId);
      if (choice === 'reload') {
        this.applyLoadedLead(fresh, caps);
        return false;
      }

      const oldBase = this.base();
      const userDraft = this.draft();
      const freshBase = draftFromDetail(fresh);
      const rebased = this.rebaseDraft(oldBase, userDraft, freshBase);

      this.detail.set(fresh);
      this.updatedAt.set(fresh.updatedAt);
      this.capabilities.set(caps);
      this.base.set(freshBase);
      this.draft.set(rebased);
      return await this.save(false);
    } catch (error) {
      this.toastServerError(errorCodeOf(error));
      return false;
    }
  }

  private rebaseDraft(oldBase: LeadDraft, userDraft: LeadDraft, freshBase: LeadDraft): LeadDraft {
    const keys = Object.keys(freshBase) as (keyof LeadDraft)[];
    const merged: Record<string, unknown> = { ...freshBase };
    for (const key of keys) {
      if (JSON.stringify(userDraft[key]) !== JSON.stringify(oldBase[key])) {
        merged[key] = userDraft[key];
      }
    }
    return merged as unknown as LeadDraft;
  }

  protected async onSaveContacts(nextContacts: ContactDraft[], editIndex?: number): Promise<DraftErrors | null> {
    const current = this.detail();
    const id = this.leadId();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !id || !expectedUpdatedAt || !this.canEdit() || this.saving() || this.deleting()) {
      return {};
    }

    const body: UpdateLeadBody = {
      expectedUpdatedAt,
      contacts: toPatchContactsBody(nextContacts, current.existingCompany),
    };

    this.instantUpdating.set(true);
    try {
      const updated = await patchLead(id, body);
      if (this.leadId() !== id) return {};
      this.applyPatchedContacts(updated);
      return null;
    } catch (error) {
      if (this.isConcurrentUpdate(error)) {
        this.instantUpdating.set(false);
        return await this.handleContactsConflict(id, nextContacts, editIndex);
      }
      this.toastServerError(errorCodeOf(error));
      return mapContactsPatchErrors(error, nextContacts, editIndex);
    } finally {
      this.instantUpdating.set(false);
    }
  }

  private applyPatchedContacts(updated: LeadDetail): void {
    const prevContactIds = this.detail()?.contacts.map((c) => c.partyId).join(',') ?? '';
    const nextContactIds = updated.contacts.map((c) => c.partyId).join(',');
    const oldBase = this.base();
    const userDraft = this.draft();
    const freshBase = draftFromDetail(updated);
    const rebased = this.rebaseDraft(oldBase, userDraft, freshBase);
    rebased.contacts = freshBase.contacts.map((c) => ({ ...c, phones: [...c.phones] }));
    this.detail.set(updated);
    this.updatedAt.set(updated.updatedAt);
    this.base.set(freshBase);
    this.draft.set(rebased);
    if (prevContactIds !== nextContactIds) {
      invalidateRelatedCounts('LEAD', updated.id);
    }
    this.saved.emit(updated);
  }

  private async handleContactsConflict(
    id: string,
    nextContacts: ContactDraft[],
    editIndex?: number,
  ): Promise<DraftErrors | null> {
    if (this.anyGuardBusy()) return {};
    const choice = await this.openConflictDialog();
    if (choice === 'dismiss') return {};

    try {
      const fresh = await getLead(id);
      const caps = await getLeadCapabilities(fresh.branchId);
      if (choice === 'reload') {
        this.applyLoadedLead(fresh, caps);
        return {};
      }
      if (fresh.status === 'CONVERTED' || !caps.leads.update) {
        this.toastServerError(fresh.status === 'CONVERTED' ? 'LEAD_ALREADY_CONVERTED' : 'CRM_SCOPED_PERMISSION_DENIED');
        this.applyLoadedLead(fresh, caps);
        return {};
      }

      const oldBase = this.base();
      const userDraft = this.draft();
      const freshBase = draftFromDetail(fresh);
      const rebased = this.rebaseDraft(oldBase, userDraft, freshBase);
      rebased.contacts = freshBase.contacts.map((c) => ({ ...c, phones: [...c.phones] }));

      this.detail.set(fresh);
      this.updatedAt.set(fresh.updatedAt);
      this.capabilities.set(caps);
      this.base.set(freshBase);
      this.draft.set(rebased);
      return await this.onSaveContacts(nextContacts, editIndex);
    } catch (error) {
      this.toastServerError(errorCodeOf(error));
      return {};
    }
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') {
      this.toastServerError(code);
      return;
    }

    const details = error instanceof ApiError ? error.details : undefined;
    if (error instanceof ApiError && error.status === 422 && code) {
      const nextErrors: DraftErrors = {};
      let fieldLabel = '';

      if (code === 'CUSTOM_FIELD_REQUIRED' || code.endsWith('.CUSTOM_FIELD_REQUIRED')) {
        const fieldKey = typeof details?.['fieldKey'] === 'string' ? details['fieldKey'] : '';
        if (fieldKey) {
          nextErrors[`customFields.${fieldKey}`] = this.pickFormErrorKey(['required'], 'required');
          fieldLabel = this.customFieldLabel(fieldKey);
        }
      } else if (code.endsWith('_VALUE_INVALID') || code === 'CUSTOM_FIELD_VALUE_INVALID') {
        const fieldKey = typeof details?.['fieldKey'] === 'string' ? details['fieldKey'] : '';
        if (fieldKey) {
          nextErrors[`customFields.${fieldKey}`] = this.customFieldErrorKey(fieldKey);
          fieldLabel = this.customFieldLabel(fieldKey);
        }
      } else if (code === 'LEAD_PHONE_INVALID' || code.endsWith('.LEAD_PHONE_INVALID')) {
        nextErrors['reach'] = this.pickFormErrorKey(['phoneInvalid', 'reachRequired'], 'phoneInvalid');
      } else if (code === 'LEAD_COMPANY_NAME_REQUIRED' || code.endsWith('.LEAD_COMPANY_NAME_REQUIRED')) {
        nextErrors['companyName'] = 'required';
      } else if (code === 'LEAD_CONTACT_NAME_REQUIRED' || code.endsWith('.LEAD_CONTACT_NAME_REQUIRED')) {
        const contactIndex = this.draft().contacts.findIndex((c) => !c.contactPartyId && !c.firstName.trim());
        nextErrors[`contacts.${contactIndex >= 0 ? contactIndex : 0}.firstName`] = 'required';
      }

      if (Object.keys(nextErrors).length > 0) {
        this.serverErrors.set(nextErrors);
        this.toastServerError(code, fieldLabel ? { field: fieldLabel } : undefined);
        afterNextRender(() => this.focusFirstValidationError(nextErrors), { injector: this.injector });
        return;
      }
    }

    this.toastServerError(code);
  }

  private focusFirstValidationError(errors: DraftErrors): void {
    if (errors['firstName'] || errors['lastName'] || errors['companyName']) {
      this.leadForm()?.focusName();
      return;
    }
    this.leadForm()?.focusFirstError();
  }

  private isConcurrentUpdate(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    return error.status === 409 && error.code === 'CRM.LEAD.CONCURRENT_UPDATE';
  }

  private onlyNullBranchOrStageAdded(prev: LeadDraft, next: LeadDraft): boolean {
    const branchDefaulted = prev.branchId === null && next.branchId !== null && this.base().branchId === null;
    const stageDefaulted = prev.stageId === null && next.stageId !== null && this.base().stageId === null;
    if (!branchDefaulted && !stageDefaulted) return false;
    const normalized: LeadDraft = {
      ...prev,
      branchId: branchDefaulted ? next.branchId : prev.branchId,
      stageId: stageDefaulted ? next.stageId : prev.stageId,
    };
    return draftsEqual(normalized, next);
  }

  private customFieldErrorKey(fieldKey: string): string {
    const field = (this.formLookups()?.customFields() ?? []).find((item) => item.fieldKey === fieldKey);
    switch (field?.type) {
      case 'NUMBER':
        return 'cfNumber';
      case 'DATE':
      case 'DATETIME':
        return 'cfDate';
      case 'URL':
        return 'cfUrl';
      case 'EMAIL':
        return 'cfEmail';
      case 'PHONE':
        return 'cfPhone';
      default:
        return this.pickFormErrorKey(['cfInvalid', 'valueInvalid', 'invalid', 'required'], 'required');
    }
  }

  private customFieldLabel(fieldKey: string): string {
    const field = (this.formLookups()?.customFields() ?? []).find((item) => item.fieldKey === fieldKey);
    return field ? nameIn(field, this.language()) : fieldKey;
  }

  private pickFormErrorKey(candidates: readonly string[], fallback: string): string {
    for (const key of candidates) {
      const full = `leadForm.errors.${key}`;
      const translated = this.transloco.translate(full);
      if (translated && translated !== full) return key;
    }
    return fallback;
  }

  private toastServerError(code: string | null, params?: Record<string, string>): void {
    if (code) {
      const scoped = `leadForm.server.${code}`;
      const message = this.transloco.translate(scoped, params);
      if (message && message !== scoped) {
        this.notify.error(message);
        return;
      }
    }
    const genericKey = 'leadForm.server.generic';
    const genericMsg = this.transloco.translate(genericKey);
    this.notify.error(
      genericMsg && genericMsg !== genericKey ? genericMsg : this.transloco.translate('recordModal.instant.failed'),
    );
  }
}
