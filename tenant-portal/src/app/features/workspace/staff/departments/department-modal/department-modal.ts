import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerSitemap } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { OrganizationWriteApi, type CreateDepartmentBody, type UpdateDepartmentBody } from '../../shared/organization-write.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { staffErrorMessage } from '../../shared/staff.api';
import { Branch, CODE_PATTERN, Company, Department, OrgCascadeValue, STAFF_LIMITS } from '../../shared/staff.model';

const EMPTY_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

@Component({
  selector: 'app-department-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, ConflictDialog, Field, Modal, OrgCascade, StatusBadge, Switch],
  providers: [provideIcons({ tablerArrowBackUp, tablerSitemap })],
  templateUrl: './department-modal.html',
})
export class DepartmentModal {
  private static nextId = 0;
  protected readonly uid = `department-modal-${++DepartmentModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly organization = inject(OrganizationReadApi);
  private readonly writeApi = inject(OrganizationWriteApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly companies = input.required<readonly Company[]>();
  readonly branches = input.required<readonly Branch[]>();
  readonly createBranches = input.required<readonly Branch[]>();
  readonly canEdit = input(false, { alias: 'canManage' });
  readonly saved = output<Department>();
  readonly deleteRequested = output<Department>();
  readonly deactivateBlocked = output<{ department: Department; blockers: string[] }>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseDepartment = signal<Department | null>(null);
  protected readonly conflictOpen = signal(false);
  protected readonly saving = signal(false);
  readonly canManage = computed(() => this.mode() === 'create' ? this.createBranches().length > 0 : this.canEdit());
  protected readonly branchOptions = computed(() => {
    if (this.mode() === 'edit') return this.branches();
    return this.createBranches();
  });
  protected readonly companyOptions = computed(() => {
    if (this.mode() === 'edit') return this.companies();
    const ids = new Set(this.branchOptions().map((branch) => branch.companyId));
    return this.companies().filter((company) => ids.has(company.id));
  });

  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_CASCADE });
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly isActive = signal(true);

  protected readonly touched = signal<{ code?: boolean; name?: boolean }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
  protected readonly nameServerError = signal<string | null>(null);
  protected readonly branchServerError = signal<string | null>(null);

  private allowClose = false;
  private confirmingDiscard = false;
  private presetCascade: OrgCascadeValue = { ...EMPTY_CASCADE };
  private cascadeEditedByUser = false;
  private lastPayloadSignature = '';
  private lastIdempotencyKey = '';
  private openSeq = 0;

  protected readonly nameCount = computed(() => Array.from(this.name()).length);

  protected readonly dirty = computed(() => {
    if (!this.canManage()) return false;
    const trimmedCode = this.code().trim();
    const trimmedName = this.name().trim();
    if (this.mode() === 'edit') {
      const base = this.baseDepartment();
      return base !== null && (trimmedName !== base.name || (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status);
    }

    const current = this.cascadeValue();
    const cascadeChanged = this.cascadeEditedByUser &&
      (current.companyId !== this.presetCascade.companyId || current.branchId !== this.presetCascade.branchId);
    return cascadeChanged || trimmedCode !== '' || trimmedName !== '';
  });

  protected readonly cascadeErrors = computed<{ company?: string; branch?: string }>(() => {
    this.i18n();
    if (this.mode() !== 'create' || !this.submitAttempted()) return {};
    const current = this.cascadeValue();
    const errors: { company?: string; branch?: string } = {};
    if (!current.companyId) {
      errors.company = this.transloco.translate('departments.validation.companyRequired');
    }
    if (!current.branchId) {
      errors.branch = this.transloco.translate('departments.validation.branchRequired');
    }
    if (this.branchServerError()) errors.branch = this.branchServerError()!;
    return errors;
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server) return server;
    if (this.mode() !== 'create') return null;
    if (!this.submitAttempted() && !this.touched().code) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('departments.validation.codeRequired');
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('departments.validation.codeInvalid');
    }
    return null;
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    if (this.nameServerError()) return this.nameServerError();
    if (!this.submitAttempted() && !this.touched().name) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('departments.validation.nameRequired');
    if (Array.from(trimmed).length > STAFF_LIMITS.name) {
      return this.transloco.translate('departments.validation.nameMaxLength', { max: STAFF_LIMITS.name });
    }
    return null;
  });

  openCreate(preset?: { companyId?: string | null; branchId?: string | null }): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.mode.set('create');
    this.baseDepartment.set(null);
    this.conflictOpen.set(false);
    this.cascadeEditedByUser = false;

    const initialCascade: OrgCascadeValue = {
      ...EMPTY_CASCADE,
      companyId: preset?.companyId || null,
      branchId: preset?.branchId || null,
    };
    this.presetCascade = { ...initialCascade };
    this.cascadeValue.set(initialCascade);
    this.code.set('');
    this.name.set('');
    this.isActive.set(true);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    this.focusControl(initialCascade.branchId ? `#${this.uid}-code` : undefined);

    if (initialCascade.branchId && !initialCascade.companyId) {
      void this.resolveCompanyFromBranch(initialCascade.branchId, seq);
    }
  }

  openEdit(department: Department, companyId?: string | null): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.mode.set('edit');
    this.baseDepartment.set(department);
    this.conflictOpen.set(false);
    this.cascadeEditedByUser = false;
    this.applyDepartmentToForm(department, companyId ?? null);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    if (this.canManage()) this.focusControl(`#${this.uid}-name`);
    if (!companyId) {
      void this.resolveCompanyFromBranch(department.branchId, seq);
    }
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.conflictOpen.set(false);
    this.modal().close();
  }

  editingId(): string | null {
    return this.baseDepartment()?.id ?? null;
  }

  syncDepartment(updated: Department): void {
    if (this.editingId() !== updated.id) return;
    this.baseDepartment.set(updated);
    this.applyDepartmentToForm(updated, this.cascadeValue().companyId);
    this.resetValidation();
    this.resetIdempotency();
  }

  protected undo(): void {
    const base = this.baseDepartment();
    if (this.saving() || !base) return;
    this.syncDepartment(base);
  }

  protected requestDelete(): void {
    const base = this.baseDepartment();
    if (this.canManage() && !this.saving() && base) this.deleteRequested.emit(base);
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    const prev = this.cascadeValue();
    if (
      this.mode() === 'create' &&
      !this.cascadeEditedByUser &&
      this.code().trim() === '' &&
      this.name().trim() === '' &&
      ((prev.companyId === null && next.companyId !== null) || (prev.branchId === null && next.branchId !== null))
    ) {
      // Absorb initial auto-selection from OrgCascade when a single option is eligible.
      this.presetCascade = { ...next };
      this.cascadeValue.set(next);
      return;
    }
    this.cascadeEditedByUser = true;
    this.cascadeValue.set(next);
    this.branchServerError.set(null);
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
    this.nameServerError.set(null);
  }

  protected markTouched(field: 'code' | 'name'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving() || (this.mode() === 'edit' && !this.dirty())) return;

    this.submitAttempted.set(true);
    this.codeServerError.set(null);
    this.nameServerError.set(null);
    this.branchServerError.set(null);

    const cascadeErrs = this.cascadeErrors();
    if (cascadeErrs.company || cascadeErrs.branch || this.codeError() || this.nameError()) {
      return;
    }

    this.saving.set(true);
    try {
      let updated: Department;
      let toast = 'departments.toast.created';
      const base = this.baseDepartment();
      if (this.mode() === 'edit' && base) {
        const patch: UpdateDepartmentBody = {};
        if (this.name().trim() !== base.name) patch.name = this.name().trim();
        const status = this.isActive() ? 'ACTIVE' : 'INACTIVE';
        if (status !== base.status) patch.status = status;
        updated = await this.writeApi.updateDepartment(base.id, patch, this.idempotencyKeyFor(base.id, patch));
        toast = !patch.name && patch.status
          ? `departments.toast.${patch.status === 'ACTIVE' ? 'activated' : 'deactivated'}`
          : 'departments.toast.saved';
      } else {
        const { companyId, branchId } = this.cascadeValue();
        const branch = this.createBranches().find((item) => item.id === branchId && item.companyId === companyId);
        if (!branch) throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
        const body: CreateDepartmentBody = { branchId: branch.id, code: this.code().trim(), name: this.name().trim() };
        updated = await this.writeApi.createDepartment(body, this.idempotencyKeyFor('create', body));
      }
      this.resetIdempotency();
      this.saved.emit(updated);
      this.notify.success(this.transloco.translate(toast));
      this.closeImmediate();
    } catch (error) {
      await this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.canManage() && this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
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
    this.openSeq++;
    this.presetCascade = { ...EMPTY_CASCADE };
    this.cascadeEditedByUser = false;
    this.resetValidation();
  }

  private async handleSaveError(error: unknown): Promise<void> {
    const code = errorCodeOf(error);
    const message = staffErrorMessage(error, 'staff', this.transloco, 'write');
    if (isValidationError(error)) {
      const fields = fieldErrorsOf(error);
      if (fields['name']) this.nameServerError.set(fields['name'].join(' ') || message);
      if (fields['code']) this.codeServerError.set(fields['code'].join(' ') || message);
      if (fields['branchId']) this.branchServerError.set(fields['branchId'].join(' ') || message);
      if (fields['_'] || !Object.keys(fields).some((key) => ['name', 'code', 'branchId'].includes(key))) {
        this.notify.error(message);
      }
      return;
    }
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(message);
      return;
    }
    if (code === 'ORG_PARENT_INACTIVE') {
      const text = this.transloco.translate('departments.parentInactive');
      if (this.mode() === 'create') this.branchServerError.set(text);
      else this.notify.error(text);
      return;
    }
    const base = this.baseDepartment();
    if (code === 'ORG_NODE_NOT_EMPTY' && base && !this.isActive()) {
      this.isActive.set(true);
      const blockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      this.deactivateBlocked.emit({ department: base, blockers: Array.isArray(blockers) ? blockers.filter((v): v is string => typeof v === 'string') : [] });
      return;
    }
    if (code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      this.conflictOpen.set(true);
      return;
    }
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
    else this.notify.error(message);
    if (error instanceof ApiError && error.status === 404) {
      this.closeImmediate();
      this.staleScopeDetected.emit();
    }
  }

  protected async resolveConflict(keepChanges: boolean): Promise<void> {
    if (this.saving()) return;
    this.conflictOpen.set(false);
    const base = this.baseDepartment();
    const seq = this.openSeq;
    this.saving.set(true);
    try {
      if (base) {
        const fresh = await this.organization.getDepartment(base.id);
        if (seq !== this.openSeq) return;
        if (keepChanges) this.baseDepartment.set(fresh);
        else this.syncDepartment(fresh);
      } else if (!keepChanges) {
        this.code.set('');
        this.name.set('');
        this.cascadeValue.set({ ...this.presetCascade });
      }
      this.resetValidation();
      this.resetIdempotency();
      if (!keepChanges) this.staleScopeDetected.emit();
    } catch (error) {
      this.notify.error(staffErrorMessage(error, 'staff', this.transloco));
      this.closeImmediate();
      this.staleScopeDetected.emit();
    } finally {
      this.saving.set(false);
    }
  }

  private async resolveCompanyFromBranch(branchId: string, seq: number): Promise<void> {
    try {
      const branch = await this.organization.getBranch(branchId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const resolved: OrgCascadeValue = {
        companyId: branch.companyId,
        branchId,
        departmentId: null,
        teamId: null,
      };
      this.presetCascade = { ...resolved };
      this.cascadeValue.set(resolved);
    } catch {
      // OrgCascade or page lookups will remain as fallback.
    }
  }

  private applyDepartmentToForm(department: Department, companyId: string | null): void {
    this.cascadeValue.set({
      companyId,
      branchId: department.branchId,
      departmentId: null,
      teamId: null,
    });
    this.code.set(department.code);
    this.name.set(department.name);
    this.isActive.set(department.status === 'ACTIVE');
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.codeServerError.set(null);
    this.nameServerError.set(null);
    this.branchServerError.set(null);
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(target: string, payload: CreateDepartmentBody | UpdateDepartmentBody): string {
    const signature = JSON.stringify([target, payload]);
    if (signature !== this.lastPayloadSignature) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
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
