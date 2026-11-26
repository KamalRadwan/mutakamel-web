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
import { tablerAlertTriangle, tablerCloudOff, tablerTrash } from '@ng-icons/tabler-icons';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FullState, FullStateKind } from '../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { customerRecordError } from '../customer-form/customer-errors';
import { canManageFormStatus } from '../customer-form/customer-lookups.api';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { DuplicateMatch } from '../../shared/record/duplicate-strip/duplicate.model';
import { RecordModalFrame } from '../../shared/record/modal/record-modal-frame';
import { createUnsavedGuard } from '../../shared/record/modal/record-unsaved-guard';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { RecordNavContext, navPosition, nextNavTarget } from '../../shared/record/nav/record-nav';
import { ContactChange, ContactErrors } from '../../shared/record/record-contact';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { invalidateRelatedCounts } from '../../shared/record/related/related-records.api';
import { RelatedBadgeClickEvent } from '../../shared/record/related/related-records.model';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  canDeleteCustomer,
  canUpdateCustomer,
} from '../customer-card/customer-card';
import {
  CustomerDraft,
  DraftErrors,
  diffTags,
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  mapServerErrors,
  validationErrorPath,
  toCreateBody,
  toPatchBody,
  validateDraft,
} from '../customer-form/customer-draft';
import { CustomerForm } from '../customer-form/customer-form';
import { CustomerContactSaveError, contactsAfterChange, hasCustomerContactChanges, saveCustomerContacts } from '../customer-form/customer-contact-save';
import { isManualStatus } from '../customer-statuses';
import {
  attachCustomerTags,
  createCustomer,
  deleteCustomer,
  detachCustomerTag,
  getCustomer,
  getCustomerCapabilities,
  patchCustomer,
  setCustomerColor,
  setCustomerRating,
  setCustomerStatus,
} from '../customers.api';
import {
  CardColor,
  CustomerCapabilities,
  CustomerDetail,
  CustomerStatus,
  ProfileType,
  ownerFullName,
} from '../customers.model';

type ConflictChoice = 'reload' | 'keep' | 'dismiss';

const DELETE_REASON_MAX = 500;
const CUSTOMER_RECORD_TYPE = 'customer';

const CONTACT_FIELD_MAP: Record<string, string> = {
  'contacts.firstName': 'firstName',
  'contacts.fullName': 'firstName',
  'contacts.lastName': 'lastName',
  'contacts.honorificTitle': 'honorificTitle',
  'contacts.jobTitle': 'jobTitle',
  'contacts.email': 'email',
  'contacts.phones': 'phones.0',
};

@Component({
  selector: 'app-customer-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Field,
    UnsavedDialog,
    RecordModalFrame,
    RecordRelatedBadges,
    CustomerForm,
    FullState,
    ConflictDialog,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'record-modal', alias: 'recordModal' },
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'customer-modal', alias: 'customerModal' },
      { scope: 'customer-form', alias: 'customerForm' },
      { scope: 'customers', alias: 'customers' },
    ),
    provideIcons({ tablerAlertTriangle, tablerCloudOff, tablerTrash }),
  ],
  templateUrl: './customer-modal.html',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class CustomerModal {
  private static nextId = 0;
  protected readonly uid = `customer-modal-${++CustomerModal.nextId}`;
  protected readonly deleteReasonMax = DELETE_REASON_MAX;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tenant = inject(TenantScopeState);
  private readonly draftStore = inject(RecordDraftStore);

  private readonly unsavedDialog = viewChild<UnsavedDialog>('unsavedDialog');
  private readonly blacklistDialogWrap = viewChild<ElementRef<HTMLElement>>('blacklistDialogWrap');
  private readonly blacklistDialog = viewChild.required<ConfirmDialog>('blacklistDialog');
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly deleteCancelBtn = viewChild<Button, ElementRef<HTMLButtonElement>>('deleteCancelBtn', {
    read: ElementRef,
  });
  private readonly customerForm = viewChild(CustomerForm);
  private readonly formLookups = computed(() => this.customerForm()?.lookups);

  readonly saved = output<CustomerDetail>();
  readonly changed = output<string>();
  readonly deleted = output<string>();
  readonly openIdChange = output<string | null>();

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly customerId = signal<string | null>(null);
  protected readonly base = signal<CustomerDraft>(emptyDraft());
  protected readonly draft = signal<CustomerDraft>(emptyDraft());
  protected readonly detail = signal<CustomerDetail | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly capabilities = signal<CustomerCapabilities | null>(null);
  protected readonly nav = signal<RecordNavContext | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadKind = signal<FullStateKind>('load-failure');
  protected readonly loadCorrelation = signal<string | null>(null);
  protected readonly loadMessage = signal('');
  protected readonly writeReadonly = signal(false);
  protected readonly reloadRequired = signal(false);
  protected readonly branchMissing = computed(() => { this.tenant.selection(); return !sessionBranch(); });
  protected readonly canRead = computed(() => { this.tenant.me(); return can('crm.customer_profiles.read'); });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly instantUpdating = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly serverErrors = signal<DraftErrors>({});
  protected readonly formRevision = signal(0);
  protected readonly conflictOpen = signal(false);
  protected readonly guardBusy = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly deleteReason = signal('');
  protected readonly deleteConflictError = signal<string | null>(null);

  private loadSeq = 0;
  private lastBodyFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;
  private conflictResolver: ((choice: ConflictChoice) => void) | null = null;

  protected readonly dirty = computed(() => !draftsEqual(this.base(), this.draft()));
  protected readonly hasUnsavedContact = computed(() => this.customerForm()?.contactUnsaved() ?? false);
  protected readonly hasAnyUnsaved = computed(() => this.dirty() || this.hasUnsavedContact());
  protected readonly isSwitchingType = computed(() => this.customerForm()?.switchingType() ?? false);
  protected readonly anyGuardBusy = computed(
    () => this.guardBusy() || this.unsavedGuard.busy() || this.conflictOpen() || this.deleteOpen(),
  );

  protected readonly unsavedGuard = createUnsavedGuard({
    isDirty: () => this.hasAnyUnsaved(),
    save: () => this.saveForLeave(),
    discard: () => this.discardUnsavedChanges(),
    dialog: () => this.unsavedDialog(),
    isOpen: () => this.isOpen(),
    isBlocked: () =>
      this.saving() || this.deleting() || this.guardBusy() || this.conflictOpen() || this.deleteOpen(),
    onLeave: () => this.closeModal(false),
  });

  protected readonly saveContactBound = (change: ContactChange) => this.onSaveContact(change);

  protected readonly canEdit = computed(() => {
    this.tenant.me();
    if (!this.canRead() || this.branchMissing() || this.writeReadonly() || this.reloadRequired()) return false;
    if (this.mode() === 'create') {
      const caps = this.capabilities();
      return caps?.branchId === this.draft().branchId
        ? !!caps?.customerProfiles.create
        : this.formLookups()?.canCreate() ?? false;
    }
    const current = this.detail();
    return !!current && canUpdateCustomer(this.capabilities(), current);
  });

  protected readonly canDelete = computed(() => {
    if (!this.canRead() || this.writeReadonly() || this.reloadRequired() || this.branchMissing()) return false;
    if (this.mode() !== 'edit') return false;
    const current = this.detail();
    return !!current && canDeleteCustomer(this.capabilities(), current);
  });

  protected readonly isReadonly = computed(() => !this.canEdit() || this.loading() || this.loadFailed());

  protected readonly currentStatus = computed<CustomerStatus>(() =>
    this.mode() === 'create' ? this.draft().status : (this.detail()?.status ?? this.draft().status),
  );

  protected readonly typeIcon = computed(() =>
    this.draft().profileType === 'CORPORATE' ? 'tablerBuilding' : 'tablerUser',
  );

  protected readonly displayName = computed(() => {
    if (this.mode() !== 'edit') return '';
    const d = this.draft();
    if (d.profileType === 'INDIVIDUAL') {
      const name = [d.honorificTitle.trim(), d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
      if (name) return name;
    } else {
      const name = d.companyName.trim();
      if (name) return name;
    }
    return this.detail()?.displayName ?? '';
  });

  protected readonly fallbackOwnerName = computed(() => ownerFullName(this.detail()?.owner ?? null) || null);

  protected readonly navPos = computed(() =>
    this.mode() === 'edit' ? navPosition(this.nav(), this.customerId()) : null,
  );

  protected readonly deleteCustomerName = computed(() => {
    const current = this.detail();
    if (!current) return this.displayName();
    return current.profileType === 'CORPORATE'
      ? (current.companyName ?? current.displayName)
      : current.displayName;
  });

  protected readonly deleteDisabledReason = computed(() => {
    this.i18n();
    if (!this.canDelete() || this.currentStatus() !== 'BLACKLISTED') return null;
    return this.transloco.translate('customerModal.delete.blacklistedReason');
  });

  protected readonly deleteReasonCount = computed(() => [...this.deleteReason()].length);

  protected readonly deleteReasonError = computed(() => {
    this.i18n();
    if ([...this.deleteReason().trim()].length <= DELETE_REASON_MAX) return null;
    return this.transloco.translate('customerForm.errors.tooLong', { max: DELETE_REASON_MAX });
  });

  protected readonly errors = computed<DraftErrors>(() => {
    const server = this.serverErrors();
    if (!this.attemptedSubmit()) return server;
    const customFields = this.formLookups()?.customFields() ?? [];
    const client = validateDraft(this.draft(), this.mode(), customFields);
    return { ...server, ...client };
  });

  constructor() {
    const onBlacklistKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.guardBusy()) return;
      this.dismissBlacklistDialog(event);
    };
    const onBlacklistCancel = (event: Event) => {
      if (!this.guardBusy()) return;
      this.dismissBlacklistDialog(event);
    };
    document.addEventListener('keydown', onBlacklistKeydown, { capture: true });
    document.addEventListener('cancel', onBlacklistCancel, { capture: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onBlacklistKeydown, { capture: true });
      document.removeEventListener('cancel', onBlacklistCancel, { capture: true });
      this.closeNestedDialogs();
      this.settleConflict('dismiss');
    });
  }

  openCreate(
    preset?: { status?: CustomerStatus; profileType?: ProfileType },
    capabilities: CustomerCapabilities | null = null,
  ): void {
    this.loadSeq++;
    this.guardBusy.set(false);
    this.closeNestedDialogs();
    this.settleConflict('dismiss');
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;

    const status: CustomerStatus =
      preset?.status && preset.status !== 'PROSPECT' && isManualStatus(preset.status) && canManageFormStatus()
        ? preset.status
        : 'PROSPECT';

    const selected = sessionBranch();

    const initial = emptyDraft({
      profileType: preset?.profileType ?? 'INDIVIDUAL',
      companyId: selected?.companyId ?? null,
      branchId: selected?.branchId ?? null,
      status,
    });

    this.mode.set('create');
    this.customerId.set(null);
    this.nav.set(null);
    this.detail.set(null);
    this.updatedAt.set(null);
    this.capabilities.set(capabilities);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.reloadRequired.set(false);
    this.writeReadonly.set(false);
    this.saving.set(false);
    this.deleting.set(false);
    this.instantUpdating.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.base.set(initial);
    this.draft.set(initial);
    this.formRevision.update((v) => v + 1);

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    this.openIdChange.emit(null);
    afterNextRender(() => this.customerForm()?.focusName(), { injector: this.injector });
  }

  openCustomer(id: string, nav: RecordNavContext | null): void {
    this.guardBusy.set(false);
    this.closeNestedDialogs();
    this.settleConflict('dismiss');
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;

    this.mode.set('edit');
    this.customerId.set(id);
    this.nav.set(nav ? { ...nav, ids: [...nav.ids] } : null);

    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    this.openIdChange.emit(id);
    void this.loadCustomer(id);
  }

  syncClosedFromUrl(): void {
    if (!this.isOpen() || this.mode() !== 'edit') return;
    this.closeModal(false);
  }

  async canDeactivate(): Promise<boolean> {
    return this.unsavedGuard.canDeactivate();
  }

  protected onFormDraftChange(next: CustomerDraft): void {
    const prev = this.draft();
    if (draftsEqual(prev, next)) {
      this.draft.set(next);
      return;
    }

    if (this.mode() === 'create' && this.onlyNullScopeAdded(prev, next)) {
      const currentBase = this.base();
      this.base.set({
        ...currentBase,
        companyId: currentBase.companyId ?? next.companyId,
        branchId: currentBase.branchId ?? next.branchId,
      });
      this.draft.set(next);
      return;
    }

    this.serverErrors.set({});
    this.draft.set(next);
  }

  protected retryLoad(): void {
    if (this.reloadRequired()) { window.location.reload(); return; }
    const id = this.customerId();
    if (!id) return;
    void this.loadCustomer(id);
  }

  protected async save(addAnother: boolean): Promise<boolean> {
    if (this.saving() || this.deleting() || this.loading() || this.loadFailed() || !this.canEdit()) return false;

    if (this.mode() === 'edit' && this.hasUnsavedContact()) {
      const contactSaved = await (this.customerForm()?.saveEditingContact() ?? Promise.resolve(true));
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
    if (
      this.mode() !== 'edit' ||
      !current ||
      !this.canEdit() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting()
    ) {
      return;
    }

    const prevRating = current.rating;
    const prevBaseRating = this.base().rating;
    const prevDraftRating = this.draft().rating;

    this.detail.set({ ...current, rating });
    this.base.update((b) => ({ ...b, rating }));
    this.draft.update((d) => ({ ...d, rating }));
    this.instantUpdating.set(true);

    try {
      const updated = await setCustomerRating(current.id, rating);
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, rating: updated.rating }));
      this.draft.update((d) => ({ ...d, rating: updated.rating }));
      this.changed.emit(updated.id);
    } catch (error) {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, rating: prevRating } : d));
      this.base.update((b) => ({ ...b, rating: prevBaseRating }));
      this.draft.update((d) => ({ ...d, rating: prevDraftRating }));
      this.toastServerError(error);
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async onRecolor(cardColor: CardColor | null): Promise<void> {
    const current = this.detail();
    if (
      this.mode() !== 'edit' ||
      !current ||
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
    this.instantUpdating.set(true);

    try {
      const updated = await setCustomerColor(current.id, cardColor);
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, cardColor: updated.cardColor }));
      this.draft.update((d) => ({ ...d, cardColor: updated.cardColor }));
      this.changed.emit(updated.id);
    } catch (error) {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, cardColor: prevColor } : d));
      this.base.update((b) => ({ ...b, cardColor: prevBaseColor }));
      this.draft.update((d) => ({ ...d, cardColor: prevDraftColor }));
      this.toastServerError(error);
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async onStatusChange(status: CustomerStatus): Promise<void> {
    const current = this.detail();
    if (
      this.mode() !== 'edit' ||
      !current ||
      !this.canEdit() ||
      this.instantUpdating() ||
      this.saving() ||
      this.deleting() ||
      this.anyGuardBusy()
    ) {
      return;
    }

    if (status === 'ACTIVE_CUSTOMER') {
      this.notify.warning(this.transloco.translate('customers.activeHint'));
      return;
    }
    if (status === current.status) return;

    if (status === 'BLACKLISTED') {
      this.guardBusy.set(true);
      let confirmed = false;
      try {
        confirmed = await this.blacklistDialog().open();
      } finally {
        this.guardBusy.set(false);
      }
      if (!confirmed) return;
      if (
        this.detail()?.id !== current.id ||
        !this.canEdit() ||
        this.instantUpdating() ||
        this.saving() ||
        this.deleting()
      ) {
        return;
      }
    }

    const latest = this.detail();
    if (!latest || latest.id !== current.id) return;
    const prevStatus = latest.status;
    const prevBaseStatus = this.base().status;
    const prevDraftStatus = this.draft().status;
    const expectedUpdatedAt = this.updatedAt() ?? latest.updatedAt;

    this.detail.set({ ...latest, status });
    this.base.update((b) => ({ ...b, status }));
    this.draft.update((d) => ({ ...d, status }));
    this.instantUpdating.set(true);

    try {
      const updated = await setCustomerStatus(current.id, status, expectedUpdatedAt);
      if (this.detail()?.id !== current.id) return;
      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, status: updated.status }));
      this.draft.update((d) => ({ ...d, status: updated.status }));
      this.changed.emit(updated.id);
      const statusLabel = this.transloco.translate(`customers.statuses.${updated.status}`);
      this.notify.success(this.transloco.translate('customers.board.moved', { status: statusLabel }));
    } catch (error) {
      if (this.detail()?.id !== current.id) return;
      this.detail.update((d) => (d ? { ...d, status: prevStatus } : d));
      this.base.update((b) => ({ ...b, status: prevBaseStatus }));
      this.draft.update((d) => ({ ...d, status: prevDraftStatus }));
      this.toastServerError(error);
    } finally {
      this.instantUpdating.set(false);
    }
  }

  protected async undoChanges(): Promise<void> {
    if (!this.hasAnyUnsaved() || this.saving() || this.deleting()) return;
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
        const saved = await (this.customerForm()?.saveEditingContact() ?? Promise.resolve(true));
        if (!saved) return;
      } else {
        this.customerForm()?.discardContactEdit();
      }
    }
    this.draft.set(this.base());
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.formRevision.update((v) => v + 1);
  }

  protected continueInFullPage(): void {
    if (this.saving() || this.deleting() || this.loading() || this.loadFailed()) return;
    const isCreate = this.mode() === 'create';
    const recordId = isCreate ? null : this.customerId();
    const key = this.draftStore.put<CustomerDraft>({
      recordType: CUSTOMER_RECORD_TYPE,
      draft: this.customerForm()?.draftWithEditingContact() ?? this.draft(),
      recordId,
      baseUpdatedAt: isCreate ? null : this.updatedAt(),
      nav: this.nav(),
    });
    const targetId = recordId ?? 'new';
    this.closeModal(false);
    void this.router.navigate(['/crm/customers', targetId], { queryParams: { draft: key } });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy() || this.isSwitchingType()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal(true);
  }

  protected async goPrev(): Promise<void> {
    await this.stepNav(-1);
  }

  protected async goNext(): Promise<void> {
    await this.stepNav(1);
  }

  protected openDeleteDialog(): void {
    const current = this.detail();
    if (
      !this.canDelete() ||
      !current ||
      current.status === 'BLACKLISTED' ||
      this.saving() ||
      this.deleting() ||
      this.anyGuardBusy()
    ) {
      return;
    }

    this.deleteReason.set('');
    this.deleteConflictError.set(null);
    this.deleteOpen.set(true);
    const dialogEl = this.deleteDialog()?.nativeElement;
    if (dialogEl && !dialogEl.open) {
      dialogEl.showModal();
    }
    this.deleteCancelBtn()?.nativeElement.focus();
  }

  protected onDeleteReasonInput(event: Event): void {
    if (this.deleting()) return;
    this.deleteReason.set((event.target as HTMLTextAreaElement).value);
    if (this.deleteConflictError()) {
      this.deleteConflictError.set(null);
    }
  }

  protected closeDeleteDialog(): void {
    if (this.deleting()) return;
    const dialogEl = this.deleteDialog()?.nativeElement;
    if (dialogEl?.open) {
      dialogEl.close();
    }
    this.deleteOpen.set(false);
    this.deleteConflictError.set(null);
  }

  protected onDeleteEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.deleting()) return;
    this.closeDeleteDialog();
  }

  protected onDeleteNativeClose(): void {
    const dialogEl = this.deleteDialog()?.nativeElement;
    if (dialogEl && !dialogEl.open && this.deleteOpen()) {
      this.deleteOpen.set(false);
      this.deleteConflictError.set(null);
    }
  }

  protected async submitDelete(): Promise<void> {
    const current = this.detail();
    if (!this.canDelete() || !current || this.deleting() || this.deleteReasonError()) return;

    const trimmedReason = this.deleteReason().trim();
    this.deleting.set(true);
    this.deleteConflictError.set(null);

    try {
      await deleteCustomer(current.id, trimmedReason || undefined);
      const dialogEl = this.deleteDialog()?.nativeElement;
      if (dialogEl?.open) {
        dialogEl.close();
      }
      this.deleteOpen.set(false);
      this.deleteConflictError.set(null);
      this.notify.success(this.transloco.translate('customerModal.deleted'));
      this.deleted.emit(current.id);
      this.closeModal(true);
    } catch (error) {
      const mapped = customerRecordError(error, this.transloco);
      if (mapped.readOnly) this.writeReadonly.set(true);
      if (mapped.reloadRequired) this.reloadRequired.set(true);
      if (error instanceof ApiError && error.status === 409) {
        this.deleteConflictError.set(mapped.message);
        return;
      }
      const dialogEl = this.deleteDialog()?.nativeElement;
      if (dialogEl?.open) {
        dialogEl.close();
      }
      this.deleteOpen.set(false);
      this.deleteConflictError.set(null);
      this.toastServerError(error);
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

  protected onConflictChoice(choice: 'reload' | 'keep'): void {
    this.conflictOpen.set(false);
    this.settleConflict(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    this.conflictOpen.set(open);
    if (!open) this.settleConflict('dismiss');
  }

  protected onBlacklistDialogEscape(event: Event): void {
    this.dismissBlacklistDialog(event);
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
    if (this.hasAnyUnsaved()) {
      click.event.preventDefault();
      void this.leaveForRelatedBadge(click);
      return;
    }
    this.closeModal(false);
  }

  protected async onOpenDuplicate(match: DuplicateMatch): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy() || this.isSwitchingType()) return;

    const leads = match.leads ?? [];
    const leadIds = new Set(leads.map((item) => item.id));
    const customerMatchId = !match.restricted && match.recordId && !leadIds.has(match.recordId) ? match.recordId : null;

    if (customerMatchId) {
      if (customerMatchId === this.customerId()) return;
      if (!(await this.unsavedGuard.confirmLeave())) return;
      const currentNav = this.nav();
      const nextNav = currentNav && currentNav.ids.includes(customerMatchId) ? currentNav : null;
      this.openCustomer(customerMatchId, nextNav);
      return;
    }

    if (leads.length > 0) {
      if (!(await this.unsavedGuard.confirmLeave())) return;
      this.closeModal(false);
      void this.router.navigate(['/crm/leads', leads[0].id]);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || this.loading() || this.saving() || this.deleting() || this.anyGuardBusy()) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (this.customerForm()?.isEditingContact()) {
        void this.customerForm()!.saveEditingContact();
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

  private async leaveForRelatedBadge(click: RelatedBadgeClickEvent): Promise<void> {
    if (this.saving() || this.deleting() || this.anyGuardBusy() || this.isSwitchingType()) return;
    if (!(await this.unsavedGuard.confirmLeave())) return;
    this.closeModal(false);
    void this.router.navigate(click.target.commands, { queryParams: click.target.queryParams });
  }

  private closeModal(emitUrlClear: boolean): void {
    this.loadSeq++;
    this.isOpen.set(false);
    this.closeNestedDialogs();
    this.settleConflict('dismiss');
    this.nav.set(null);
    this.detail.set(null);
    this.customerId.set(null);
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
    if (emitUrlClear) {
      this.openIdChange.emit(null);
    }
  }

  private closeNestedDialogs(): void {
    this.conflictOpen.set(false);

    const deleteEl = this.deleteDialog()?.nativeElement;
    if (deleteEl?.open) {
      deleteEl.close();
    }
    this.deleteOpen.set(false);
    this.deleteReason.set('');
    this.deleteConflictError.set(null);
  }

  private dismissBlacklistDialog(event: Event): void {
    const dialog = this.blacklistDialogWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  private async saveForLeave(): Promise<boolean> {
    if (this.hasUnsavedContact()) {
      const contactSaved = await (this.customerForm()?.saveEditingContact() ?? Promise.resolve(true));
      if (!contactSaved) return false;
    }
    if (this.dirty()) {
      return this.save(false);
    }
    return true;
  }

  private discardUnsavedChanges(): void {
    this.customerForm()?.discardContactEdit();
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
    const currentId = this.customerId();
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
      this.customerId.set(target.id);

      try {
        const loaded = await getCustomer(target.id);
        if (seq !== this.loadSeq) return;
        const caps = await getCustomerCapabilities(loaded.branchId);
        if (seq !== this.loadSeq) return;
        this.applyLoadedCustomer(loaded, caps);
        this.openIdChange.emit(loaded.id);
        return;
      } catch (error) {
        if (seq !== this.loadSeq) return;
        if (error instanceof ApiError && error.status === 404) {
          this.notify.warning(
            this.transloco.translate(dir === -1 ? 'customerModal.customerGonePrev' : 'customerModal.customerGone'),
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
      this.customerId.set(this.detail()?.id ?? currentId);
      this.loading.set(false);
    }
  }

  private async loadCustomer(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.reloadRequired.set(false);
    this.writeReadonly.set(false);
    this.loadCorrelation.set(null);
    this.loadMessage.set('');
    if (this.branchMissing() || !can('crm.customer_profiles.read')) {
      this.loadKind.set('forbidden');
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.instantUpdating.set(false);

    try {
      const loaded = await getCustomer(id);
      if (seq !== this.loadSeq) return;
      const caps = await getCustomerCapabilities(loaded.branchId);
      if (seq !== this.loadSeq) return;
      this.applyLoadedCustomer(loaded, caps);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      this.loadFailed.set(true);
      const failure = customerRecordError(error, this.transloco);
      this.loadKind.set(failure.kind);
      this.loadCorrelation.set(failure.correlationId);
      this.loadMessage.set(failure.message);
    }
  }

  private resolveCompanyIdForBranch(branchId: string, fallbackCompanyId: string | null = null): string | null {
    return this.tenant.branchCompanies().get(branchId) ?? fallbackCompanyId;
  }

  private applyLoadedCustomer(loaded: CustomerDetail, caps: CustomerCapabilities): void {
    const companyId = this.resolveCompanyIdForBranch(loaded.branchId, this.draft().companyId);
    const mapped = draftFromDetail(loaded, companyId);
    this.customerId.set(loaded.id);
    this.detail.set(loaded);
    this.updatedAt.set(loaded.updatedAt);
    this.capabilities.set(caps);
    this.base.set(mapped);
    this.draft.set(mapped);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.formRevision.update((v) => v + 1);
  }

  private async submitCreate(addAnother: boolean): Promise<boolean> {
    if (this.formLookups()?.loading() || this.formLookups()?.customFieldsUnavailable()) return false;
    const currentDraft = this.draft();
    const body = toCreateBody(currentDraft);
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastBodyFingerprint || !this.lastIdempotencyKey) {
      this.lastBodyFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createCustomer(body, this.lastIdempotencyKey);
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;
      this.notify.success(this.transloco.translate('customerModal.created'));
      this.saved.emit(created);

      if (addAnother) {
        const next = emptyDraft({
          companyId: currentDraft.companyId,
          branchId: currentDraft.branchId,
          ownerUserId: currentDraft.ownerUserId,
        });
        this.base.set(next);
        this.draft.set(next);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        this.formRevision.update((v) => v + 1);
        afterNextRender(() => this.customerForm()?.focusName(), { injector: this.injector });
      } else {
        let caps = this.formLookups()?.capabilities() ?? null;
        try {
          caps = await getCustomerCapabilities(created.branchId);
        } catch {
          // Keep existing capabilities if refresh fails.
        }
        const companyId = this.resolveCompanyIdForBranch(created.branchId, currentDraft.companyId);
        const mapped = draftFromDetail(created, companyId);
        this.capabilities.set(caps);
        this.mode.set('edit');
        this.customerId.set(created.id);
        this.nav.set(null);
        this.detail.set(created);
        this.updatedAt.set(created.updatedAt);
        this.base.set(mapped);
        this.draft.set(mapped);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        this.formRevision.update((v) => v + 1);
        this.openIdChange.emit(created.id);
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
    if (this.formLookups()?.loading() || this.formLookups()?.customFieldsUnavailable()) return false;
    const id = this.customerId();
    const expectedUpdatedAt = this.updatedAt();
    if (!id || !expectedUpdatedAt) return false;
    if (!this.dirty()) return true;

    const baseDraft = this.base();
    const currentDraft = this.draft();
    const patchBody = toPatchBody(baseDraft, currentDraft, expectedUpdatedAt);
    const tagDiff = diffTags(baseDraft.tagIds, currentDraft.tagIds);
    const hasPatchFields = Object.keys(patchBody).length > 1;
    const hasTagChanges = tagDiff.added.length > 0 || tagDiff.removed.length > 0;

    if (!hasPatchFields && !hasTagChanges && !hasCustomerContactChanges(baseDraft.contacts, currentDraft.contacts)) return true;

    const companyId = this.resolveCompanyIdForBranch(
      currentDraft.branchId ?? this.detail()?.branchId ?? '',
      currentDraft.companyId,
    );

    this.saving.set(true);
    let latest = this.detail();

    try {
      if (hasPatchFields) {
        try {
          latest = await patchCustomer(id, patchBody);
        } catch (error) {
          if (this.isConcurrentUpdate(error)) {
            this.saving.set(false);
            return this.handleConflict(id);
          }
          this.handleSaveError(error);
          return false;
        }
        const patchedMapped = draftFromDetail(latest, companyId);
        this.detail.set(latest);
        this.updatedAt.set(latest.updatedAt);
        this.base.set(patchedMapped);
        if (hasTagChanges) {
          this.draft.set({ ...patchedMapped, tagIds: [...currentDraft.tagIds] });
        }
      }

      latest = await saveCustomerContacts({ ...latest!, updatedAt: hasPatchFields ? latest!.updatedAt : expectedUpdatedAt },
        baseDraft.contacts, currentDraft.contacts);

      if (hasTagChanges) {
        try {
          if (tagDiff.added.length > 0) {
            await attachCustomerTags(id, tagDiff.added);
          }
          for (const tagId of tagDiff.removed) {
            await detachCustomerTag(id, tagId);
          }
          latest = await getCustomer(id);
        } catch (error) {
          try {
            const refreshed = await getCustomer(id);
            const refreshedMapped = draftFromDetail(refreshed, companyId);
            this.detail.set(refreshed);
            this.updatedAt.set(refreshed.updatedAt);
            this.base.set(refreshedMapped);
            this.draft.update((d) => ({ ...refreshedMapped, tagIds: [...d.tagIds] }));
          } catch {
            // Keep current state if refresh fails.
          }
          if (hasPatchFields) {
            this.changed.emit(id);
          }
          this.handleSaveError(error);
          return false;
        }
      }

      if (!latest) return false;
      const finalMapped = draftFromDetail(latest, companyId);
      this.detail.set(latest);
      this.updatedAt.set(latest.updatedAt);
      this.base.set(finalMapped);
      this.draft.set(finalMapped);
      this.attemptedSubmit.set(false);
      this.serverErrors.set({});
      invalidateRelatedCounts('CUSTOMER_PROFILE', latest.id);
      this.notify.success(this.transloco.translate('customerModal.saved'));
      this.saved.emit(latest);
      return true;
    } catch (error) {
      if (error instanceof CustomerContactSaveError) {
        await this.handlePartialContacts(error);
      } else {
        this.handleSaveError(error);
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(id: string): Promise<boolean> {
    if (this.conflictOpen() || this.deleteOpen()) return false;
    const choice = await this.openConflictDialog();
    if (choice === 'dismiss') return false;

    try {
      const fresh = await getCustomer(id);
      if (choice === 'keep') {
        this.updatedAt.set(fresh.updatedAt);
        return false;
      }
      const caps = await getCustomerCapabilities(fresh.branchId);
      if (this.customerId() !== id) return false;
      this.applyLoadedCustomer(fresh, caps);
      return false;
    } catch (error) {
      this.toastServerError(error);
      return false;
    }
  }

  protected async onSaveContact(change: ContactChange): Promise<ContactErrors | null> {
    const current = this.detail();
    const id = this.customerId();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !id || !expectedUpdatedAt || !this.canEdit() || this.saving() || this.deleting()) {
      return {};
    }

    this.instantUpdating.set(true);
    try {
      const updated = await saveCustomerContacts({ ...current, updatedAt: expectedUpdatedAt },
        this.base().contacts, contactsAfterChange(this.draft().contacts, change));
      if (this.customerId() !== id) return {};

      const companyId = this.resolveCompanyIdForBranch(updated.branchId, this.draft().companyId);
      const freshMapped = draftFromDetail(updated, companyId);
      const nextContactsBase = freshMapped.contacts.map((c) => ({ ...c, phones: [...c.phones] }));
      const nextContactsDraft = freshMapped.contacts.map((c) => ({ ...c, phones: [...c.phones] }));

      this.detail.set(updated);
      this.updatedAt.set(updated.updatedAt);
      this.base.update((b) => ({ ...b, contacts: nextContactsBase }));
      this.draft.update((d) => ({ ...d, contacts: nextContactsDraft }));
      invalidateRelatedCounts('CUSTOMER_PROFILE', updated.id);

      // RecordContacts shows its own saved toast for ADD/UPDATE/SET_PRIMARY, but not REMOVE.
      if (change.op === 'REMOVE') {
        this.notify.success(this.transloco.translate('customerModal.contactSaved'));
      }
      this.changed.emit(updated.id);
      return null;
    } catch (error) {
      if (error instanceof CustomerContactSaveError) {
        await this.handlePartialContacts(error);
        return this.mapContactActionErrors(error.error, change);
      }
      if (this.isConcurrentUpdate(error)) {
        this.instantUpdating.set(false);
        await this.handleConflict(id);
        return {};
      }
      this.toastServerError(error);
      return this.mapContactActionErrors(error, change);
    } finally {
      this.instantUpdating.set(false);
    }
  }

  private async handlePartialContacts(error: CustomerContactSaveError): Promise<void> {
    if (error.fresh) {
      const freshBase = draftFromDetail(error.fresh, this.base().companyId);
      // Preserve non-contact edits while rebasing the remaining operations onto the server list.
      this.detail.set(error.fresh);
      this.updatedAt.set(error.fresh.updatedAt);
      this.base.update((base) => ({ ...base, contacts: freshBase.contacts }));
      this.draft.update((draft) => ({ ...draft, contacts: error.remaining }));
      this.changed.emit(error.fresh.id);
      invalidateRelatedCounts('CUSTOMER_PROFILE', error.fresh.id);
    } else {
      this.draft.update((draft) => ({ ...draft, contacts: error.remaining }));
    }
    this.toastServerError(error.error, error.saved);
    if (this.isConcurrentUpdate(error.error)) {
      this.instantUpdating.set(false);
      this.saving.set(false);
      await this.handleConflict(this.customerId()!);
    }
  }

  private mapContactActionErrors(error: unknown, change: ContactChange): ContactErrors {
    const mapped = mapServerErrors(error, this.draft());
    const out: ContactErrors = {};
    const code = errorCodeOf(error);
    const details = error instanceof ApiError ? error.details : undefined;

    if (change.op === 'ADD' || change.op === 'UPDATE') {
      const key = change.contact.key;
      if (
        code === 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED' ||
        code?.endsWith('.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED')
      ) {
        out[`${key}.firstName`] = this.translateFormError('required');
        return out;
      }
      if (code === 'CRM_VALIDATION_FAILED') {
        const field = validationErrorPath(details);
        const targetField = CONTACT_FIELD_MAP[field];
        if (targetField) {
          const errorKey =
            field === 'contacts.email'
              ? 'emailInvalid'
              : field === 'contacts.phones'
                ? 'phoneInvalid'
                : 'tooLong';
          out[`${key}.${targetField}`] = this.translateFormError(errorKey);
          return out;
        }
      }
    }

    if (mapped['contacts']) {
      out['contacts'] = this.translateFormError(mapped['contacts']);
    }
    return out;
  }

  private translateFormError(raw: string): string {
    const key = raw.startsWith('customerForm.') ? raw : `customerForm.errors.${raw}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : raw;
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') {
      this.toastServerError(error);
      return;
    }

    const result = customerRecordError(error, this.transloco, this.draft());
    if (this.mode() === 'create' && !result.keepKey) {
      this.lastIdempotencyKey = null;
      this.lastBodyFingerprint = null;
    }
    if (result.readOnly) this.writeReadonly.set(true);
    if (result.reloadRequired) this.reloadRequired.set(true);
    const mapped = result.fields;
    if (Object.keys(mapped).length > 0) {
      this.serverErrors.set(mapped);
      this.toastServerError(error);
      afterNextRender(() => this.focusFirstValidationError(mapped), { injector: this.injector });
      return;
    }

    this.toastServerError(error);
  }

  private focusFirstValidationError(errors: DraftErrors): void {
    if (errors['firstName'] || errors['lastName'] || errors['companyName']) {
      this.customerForm()?.focusName();
      return;
    }
    this.customerForm()?.focusFirstError();
  }

  private isConcurrentUpdate(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    return error.status === 409 && error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE';
  }

  private onlyNullScopeAdded(prev: CustomerDraft, next: CustomerDraft): boolean {
    const companyDefaulted = prev.companyId === null && next.companyId !== null && this.base().companyId === null;
    const branchDefaulted = prev.branchId === null && next.branchId !== null && this.base().branchId === null;
    if (!companyDefaulted && !branchDefaulted) return false;
    const normalized: CustomerDraft = {
      ...prev,
      companyId: companyDefaulted ? next.companyId : prev.companyId,
      branchId: branchDefaulted ? next.branchId : prev.branchId,
    };
    return draftsEqual(normalized, next);
  }

  private toastServerError(error: unknown, saved?: readonly string[]): void {
    const mapped = customerRecordError(error, this.transloco, this.draft());
    if (mapped.readOnly) this.writeReadonly.set(true);
    if (mapped.reloadRequired) this.reloadRequired.set(true);
    this.notify.error(mapped.message, saved
      ? [this.transloco.translate('customerForm.server.notSaved'),
        ...(saved.length ? [`${this.transloco.translate('recordForm.contacts.saved')}: ${saved.join('; ')}`] : [])].join(' ')
      : '');
  }
}
