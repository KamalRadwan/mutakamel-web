import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerBuildingStore, tablerStar } from '@ng-icons/tabler-icons';
import { GeoCountry } from '../../../../../core/geo/geo.model';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { PhoneInput } from '../../../../../shared/ui/phone-input/phone-input';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StaffSession } from '../../shared/staff-session';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import {
  ApiError,
  createBranch,
  errorCodeOf,
  errorMessage,
  getBranch,
  newIdempotencyKey,
  updateBranch,
} from '../../shared/staff.api';
import { Branch, CODE_PATTERN, Company, OrgCascadeValue, OrgStatus, STAFF_LIMITS } from '../../shared/staff.model';

interface BranchPatch {
  name?: string;
  phone?: string | null;
  address?: string | null;
  status?: OrgStatus;
}

const EMPTY_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

@Component({
  selector: 'app-branch-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal, OrgCascade, PhoneInput, SeatImpact, StatusBadge, Switch],
  providers: [provideIcons({ tablerArrowBackUp, tablerBuildingStore, tablerStar })],
  templateUrl: './branch-modal.html',
})
export class BranchModal {
  private static nextId = 0;
  protected readonly uid = `branch-modal-${++BranchModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly staleDialog = viewChild.required<ConfirmDialog>('staleDialog');

  readonly canManage = input(true);
  readonly companies = input<Company[]>([]);
  readonly branches = input<Branch[]>([]);
  readonly countries = input<GeoCountry[]>([]);

  readonly saved = output<{ branch: Branch; isNew: boolean }>();
  readonly deleteRequested = output<Branch>();
  readonly deactivateBlocked = output<{ branch: Branch; blockers: string[] }>();
  readonly hqTransferRequired = output<{ branch: Branch; action: 'deactivate' | 'delete' }>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseBranch = signal<Branch | null>(null);
  protected readonly saving = signal(false);
  protected readonly seatBlocked = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly statusSeatChanges = computed<SeatChange[] | null>(() => {
    const base = this.baseBranch();
    if (this.mode() !== 'edit' || !base) return null;
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    if (nextStatus === base.status) return null;
    return [{ kind: 'ORG_STATUS', branchId: base.id, status: nextStatus }];
  });
  protected readonly statusBlocked = computed(
    () => this.mode() === 'edit' && this.baseBranch()?.status === 'INACTIVE' && this.isActive() && this.seatBlocked(),
  );

  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_CASCADE });
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly address = signal('');
  protected readonly isHeadquarters = signal(false);
  protected readonly isActive = signal(true);

  protected readonly touched = signal<{
    company?: boolean;
    code?: boolean;
    name?: boolean;
    phone?: boolean;
    address?: boolean;
  }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly companyServerError = signal<string | null>(null);
  protected readonly codeServerError = signal<string | null>(null);
  protected readonly hqServerError = signal<string | null>(null);

  private allowClose = false;
  private confirmingDiscard = false;
  private presetCompanyId: string | null = null;
  private lastPayloadSignature = '';
  private lastIdempotencyKey = '';

  protected readonly selectedCompanyId = computed(() =>
    this.mode() === 'edit' ? (this.baseBranch()?.companyId ?? null) : this.cascadeValue().companyId,
  );

  protected readonly selectedCompany = computed(() => {
    const companyId = this.selectedCompanyId();
    return companyId ? (this.companies().find((c) => c.id === companyId) ?? null) : null;
  });

  protected readonly selectedCompanyName = computed(() => this.selectedCompany()?.name ?? '');

  protected readonly defaultCountryIso2 = computed(() => this.selectedCompany()?.countryCode || 'EG');

  protected readonly currentCompanyHq = computed(() => {
    const companyId = this.selectedCompanyId();
    if (!companyId) return null;
    const currentId = this.baseBranch()?.id;
    return (
      this.branches().find((branch) => branch.companyId === companyId && branch.isHeadquarters && branch.id !== currentId) ??
      null
    );
  });

  protected readonly hqSwitchDisabled = computed(
    () => !this.canManage() || this.saving() || this.mode() === 'edit' || this.currentCompanyHq() !== null ||
      !this.session.can('org.branch.manage', { companyId: this.selectedCompanyId() }),
  );

  protected readonly allowCompany = (company: Company): boolean => this.session.canCreateBranch(company.id);

  protected readonly canChangeLifecycle = computed(() => {
    const branch = this.baseBranch();
    return this.canManage() && Boolean(branch && (!branch.isHeadquarters ||
      this.session.can('org.branch.manage', { companyId: branch.companyId })));
  });

  protected readonly hqHintText = computed(() => {
    this.i18n();
    const existingHq = this.currentCompanyHq();
    if (existingHq) {
      return this.transloco.translate('branches.fields.hqTaken', { name: existingHq.name });
    }
    return this.transloco.translate('branches.fields.hqHelp');
  });

  protected readonly nameCount = computed(() => Array.from(this.name()).length);
  protected readonly addressCount = computed(() => Array.from(this.address()).length);

  protected readonly dirty = computed(() => {
    if (!this.canManage()) return false;
    const trimmedName = this.name().trim();
    const trimmedPhone = this.phone().trim();
    const trimmedAddress = this.address().trim();

    if (this.mode() === 'create') {
      return (
        (this.cascadeValue().companyId ?? null) !== this.presetCompanyId ||
        this.code().trim() !== '' ||
        trimmedName !== '' ||
        trimmedPhone !== '' ||
        trimmedAddress !== '' ||
        this.isHeadquarters()
      );
    }

    const base = this.baseBranch();
    if (!base) return false;
    return (
      trimmedName !== base.name ||
      (trimmedPhone || null) !== base.phone ||
      (trimmedAddress || null) !== base.address ||
      (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status
    );
  });

  protected readonly companyError = computed(() => {
    this.i18n();
    const server = this.companyServerError();
    if (server) return server;
    if (this.mode() !== 'create') return null;
    if (!this.submitAttempted() && !this.touched().company) return null;
    if (!this.cascadeValue().companyId) {
      return this.transloco.translate('branches.validation.required');
    }
    return null;
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server) return server;
    if (this.mode() !== 'create') return null;
    if (!this.submitAttempted() && !this.touched().code) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('branches.validation.required');
    if (trimmed.length > STAFF_LIMITS.code) {
      return this.transloco.translate('branches.validation.maxLength', { max: STAFF_LIMITS.code });
    }
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('branches.validation.codePattern');
    }
    return null;
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    if (!this.submitAttempted() && !this.touched().name) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('branches.validation.required');
    if (Array.from(trimmed).length > STAFF_LIMITS.name) {
      return this.transloco.translate('branches.validation.maxLength', { max: STAFF_LIMITS.name });
    }
    return null;
  });

  protected readonly phoneError = computed(() => {
    this.i18n();
    if (!this.submitAttempted() && !this.touched().phone) return null;
    const trimmed = this.phone().trim();
    if (trimmed.length > STAFF_LIMITS.phone) {
      return this.transloco.translate('branches.validation.maxLength', { max: STAFF_LIMITS.phone });
    }
    return null;
  });

  protected readonly addressError = computed(() => {
    this.i18n();
    if (!this.submitAttempted() && !this.touched().address) return null;
    const trimmed = this.address().trim();
    if (Array.from(trimmed).length > STAFF_LIMITS.address) {
      return this.transloco.translate('branches.validation.maxLength', { max: STAFF_LIMITS.address });
    }
    return null;
  });

  protected readonly hqError = computed(() => this.hqServerError());

  openCreate(presetCompanyId?: string | null): void {
    this.allowClose = false;
    this.mode.set('create');
    this.baseBranch.set(null);
    this.presetCompanyId = presetCompanyId || null;
    this.cascadeValue.set({ ...EMPTY_CASCADE, companyId: this.presetCompanyId });
    this.code.set('');
    this.name.set('');
    this.phone.set('');
    this.address.set('');
    this.isHeadquarters.set(false);
    this.isActive.set(true);
    this.seatBlocked.set(false);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    this.focusControl(this.presetCompanyId ? `#${this.uid}-code` : undefined);
  }

  openEdit(branch: Branch): void {
    this.allowClose = false;
    this.mode.set('edit');
    this.presetCompanyId = null;
    this.baseBranch.set(branch);
    this.seatBlocked.set(false);
    this.applyBranchToForm(branch);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    if (this.canManage()) {
      this.focusControl(`#${this.uid}-name`);
    }
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.baseBranch()?.id ?? null;
  }

  syncBranch(updated: Branch): void {
    if (this.baseBranch()?.id !== updated.id) return;
    this.baseBranch.set(updated);
    this.applyBranchToForm(updated);
    this.resetValidation();
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    this.cascadeValue.set(next);
    this.companyServerError.set(null);
    this.hqServerError.set(null);
    if (this.mode() === 'create' && this.currentCompanyHq()) {
      this.isHeadquarters.set(false);
    }
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() !== 'create') return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      inputEl.value = upper;
    }
    this.code.set(upper);
    this.codeServerError.set(null);
  }

  protected onNameInput(event: Event): void {
    if (!this.canManage()) return;
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onPhoneChange(next: string): void {
    if (!this.canManage()) return;
    this.phone.set(next);
  }

  protected onAddressInput(event: Event): void {
    if (!this.canManage()) return;
    this.address.set((event.target as HTMLTextAreaElement).value);
  }

  protected onHqChange(next: boolean): void {
    if (next && this.hqSwitchDisabled()) return;
    this.isHeadquarters.set(next);
    this.hqServerError.set(null);
  }

  protected markTouched(field: 'company' | 'code' | 'name' | 'phone' | 'address'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected undo(): void {
    const base = this.baseBranch();
    if (!base) return;
    this.seatBlocked.set(false);
    this.applyBranchToForm(base);
    this.resetValidation();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving() || this.statusBlocked()) return;

    this.submitAttempted.set(true);
    this.companyServerError.set(null);
    this.codeServerError.set(null);
    this.hqServerError.set(null);

    if (this.companyError() || this.codeError() || this.nameError() || this.phoneError() || this.addressError()) {
      return;
    }

    const trimmedName = this.name().trim();
    const trimmedPhone = this.phone().trim();
    const trimmedAddress = this.address().trim();

    if (this.mode() === 'create') {
      const companyId = this.cascadeValue().companyId;
      if (!companyId || !this.session.canCreateBranch(companyId)) return;
      if (this.isHeadquarters() && !this.session.can('org.branch.manage', { companyId })) return;

      const body: {
        companyId: string;
        code: string;
        name: string;
        phone?: string;
        address?: string;
        isHeadquarters?: boolean;
      } = {
        companyId,
        code: this.code().trim(),
        name: trimmedName,
        isHeadquarters: this.isHeadquarters(),
      };
      if (trimmedPhone) body.phone = trimmedPhone;
      if (trimmedAddress) body.address = trimmedAddress;

      this.saving.set(true);
      try {
        const created = await createBranch(body, this.idempotencyKeyFor('create', body));
        this.saved.emit({ branch: created, isNew: true });
        this.notify.success(this.transloco.translate('branches.toast.created'));
        this.closeImmediate();
      } catch (error) {
        await this.handleSaveError(error, false);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const base = this.baseBranch();
    if (!base || !this.session.can('org.branch.manage', { companyId: base.companyId, branchId: base.id })) return;

    const patch: BranchPatch = {};
    if (trimmedName !== base.name) patch.name = trimmedName;
    const nextPhone = trimmedPhone || null;
    if (nextPhone !== base.phone) patch.phone = nextPhone;
    const nextAddress = trimmedAddress || null;
    if (nextAddress !== base.address) patch.address = nextAddress;
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    const isDeactivating = base.status === 'ACTIVE' && nextStatus === 'INACTIVE';
    if (nextStatus !== base.status) {
      if (!this.canChangeLifecycle()) return;
      patch.status = nextStatus;
    }

    if (Object.keys(patch).length === 0) return;

    this.saving.set(true);
    try {
      let updated: Branch;
      try {
        updated = await updateBranch(base.id, patch, this.idempotencyKeyFor(base.id, patch));
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        this.saving.set(false);
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed || !this.canChangeLifecycle() ||
            !this.session.can('org.branch.manage', { companyId: base.companyId, branchId: base.id })) return;
        this.saving.set(true);
        updated = await updateBranch(base.id, patch, this.idempotencyKeyFor(base.id, patch), {
          confirmAddonCascade: true,
        });
      }
      this.saved.emit({ branch: updated, isNew: false });
      this.notify.success(this.transloco.translate('branches.toast.saved'));
      this.closeImmediate();
    } catch (error) {
      await this.handleSaveError(error, isDeactivating, base);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.canManage() && this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected requestDelete(): void {
    const base = this.baseBranch();
    if (!base || !this.canChangeLifecycle() || this.saving() ||
        !this.session.can('org.branch.manage', { companyId: base.companyId, branchId: base.id })) return;
    this.deleteRequested.emit(base);
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.baseBranch.set(null);
    this.presetCompanyId = null;
    this.seatBlocked.set(false);
    this.resetValidation();
  }

  private async handleSaveError(error: unknown, isDeactivating: boolean, base?: Branch): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_HQ_EXISTS') {
      this.hqServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_PARENT_INACTIVE') {
      this.companyServerError.set(this.transloco.translate('branches.parentInactive'));
      return;
    }
    if (code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      if (await this.staleDialog().open()) {
        this.staleScopeDetected.emit();
        if (base) {
          try {
            const fresh = await getBranch(base.id);
            this.syncBranch(fresh);
          } catch (reloadError) {
            this.notify.error(this.resolveError(reloadError));
            this.closeImmediate();
          }
        }
      }
      return;
    }
    if (code === 'ORG_HQ_TRANSFER_REQUIRED' && isDeactivating && base) {
      this.isActive.set(true);
      if (this.canChangeLifecycle()) this.hqTransferRequired.emit({ branch: base, action: 'deactivate' });
      return;
    }
    if (code === 'ORG_NODE_NOT_EMPTY' && isDeactivating && base) {
      this.isActive.set(true);
      const rawBlockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      const blockers = Array.isArray(rawBlockers) ? rawBlockers.map(String) : [];
      this.deactivateBlocked.emit({ branch: base, blockers });
      return;
    }
    this.notify.error(this.resolveError(error));
  }

  private applyBranchToForm(branch: Branch): void {
    this.cascadeValue.set({ ...EMPTY_CASCADE, companyId: branch.companyId });
    this.code.set(branch.code);
    this.name.set(branch.name);
    this.phone.set(branch.phone ?? '');
    this.address.set(branch.address ?? '');
    this.isHeadquarters.set(branch.isHeadquarters);
    this.isActive.set(branch.status === 'ACTIVE');
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.companyServerError.set(null);
    this.codeServerError.set(null);
    this.hqServerError.set(null);
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(target: string, payload: unknown): string {
    const signature = `${target}:${JSON.stringify(payload)}`;
    if (signature !== this.lastPayloadSignature) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private resolveError(error: unknown): string {
    const seatMsg = seatErrorMessage(this.transloco, error);
    if (seatMsg) return seatMsg;
    const msg = errorMessage(error, 'staff', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('staff.errors.generic');
    return fallback !== 'staff.errors.generic' ? fallback : msg;
  }

  private focusControl(selector?: string): void {
    if (!selector) return;
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
