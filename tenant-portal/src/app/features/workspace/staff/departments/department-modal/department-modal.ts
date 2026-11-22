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
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import {
  ApiError,
  createDepartment,
  errorCodeOf,
  errorMessage,
  getBranch,
  getDepartment,
  newIdempotencyKey,
  updateDepartment,
} from '../../shared/staff.api';
import { CODE_PATTERN, Department, OrgCascadeValue, OrgStatus, STAFF_LIMITS } from '../../shared/staff.model';

interface DepartmentPatch {
  name?: string;
  status?: OrgStatus;
}

const EMPTY_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

@Component({
  selector: 'app-department-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal, OrgCascade, StatusBadge, Switch],
  providers: [provideIcons({ tablerArrowBackUp, tablerSitemap })],
  templateUrl: './department-modal.html',
})
export class DepartmentModal {
  private static nextId = 0;
  protected readonly uid = `department-modal-${++DepartmentModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly staleDialog = viewChild.required<ConfirmDialog>('staleDialog');

  readonly canManage = input(true);
  readonly saved = output<{ department: Department; isNew: boolean }>();
  readonly deleteRequested = output<Department>();
  readonly deactivateBlocked = output<{ department: Department; blockers: string[] }>();
  readonly deletedRemotely = output<void>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseDepartment = signal<Department | null>(null);
  protected readonly saving = signal(false);

  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_CASCADE });
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly isActive = signal(true);

  protected readonly touched = signal<{ code?: boolean; name?: boolean }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly codeServerError = signal<string | null>(null);

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

    if (this.mode() === 'create') {
      const current = this.cascadeValue();
      const cascadeChanged =
        this.cascadeEditedByUser &&
        (current.companyId !== this.presetCascade.companyId || current.branchId !== this.presetCascade.branchId);
      return cascadeChanged || trimmedCode !== '' || trimmedName !== '';
    }

    const base = this.baseDepartment();
    if (!base) return false;
    return trimmedName !== base.name || (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status;
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
    this.cascadeEditedByUser = false;
    this.baseDepartment.set(department);
    this.applyDepartmentToForm(department, companyId ?? null);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    if (this.canManage()) {
      this.focusControl(`#${this.uid}-name`);
    }
    if (!companyId) {
      void this.resolveCompanyFromBranch(department.branchId, seq);
    }
  }

  syncDepartment(updated: Department, companyId?: string | null): void {
    if (this.baseDepartment()?.id !== updated.id) return;
    const resolvedCompanyId = companyId ?? this.cascadeValue().companyId;
    this.baseDepartment.set(updated);
    this.applyDepartmentToForm(updated, resolvedCompanyId);
    this.resetValidation();
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.baseDepartment()?.id ?? null;
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

  protected markTouched(field: 'code' | 'name'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected undo(): void {
    const base = this.baseDepartment();
    if (!base) return;
    this.applyDepartmentToForm(base, this.cascadeValue().companyId);
    this.resetValidation();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving()) return;

    this.submitAttempted.set(true);
    this.codeServerError.set(null);

    const cascadeErrs = this.cascadeErrors();
    if (cascadeErrs.company || cascadeErrs.branch || this.codeError() || this.nameError()) {
      return;
    }

    const trimmedName = this.name().trim();

    if (this.mode() === 'create') {
      const branchId = this.cascadeValue().branchId;
      if (!branchId) return;

      const body = {
        branchId,
        code: this.code().trim(),
        name: trimmedName,
      };

      this.saving.set(true);
      try {
        const created = await createDepartment(body, this.idempotencyKeyFor('create', body));
        this.saved.emit({ department: created, isNew: true });
        this.notify.success(this.transloco.translate('departments.toast.created'));
        this.closeImmediate();
      } catch (error) {
        await this.handleSaveError(error, false);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const base = this.baseDepartment();
    if (!base) return;

    const patch: DepartmentPatch = {};
    if (trimmedName !== base.name) patch.name = trimmedName;
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    const isDeactivating = base.status === 'ACTIVE' && nextStatus === 'INACTIVE';
    const isActivating = base.status === 'INACTIVE' && nextStatus === 'ACTIVE';
    if (nextStatus !== base.status) patch.status = nextStatus;

    if (Object.keys(patch).length === 0) return;

    this.saving.set(true);
    try {
      const updated = await updateDepartment(base.id, patch, this.idempotencyKeyFor(base.id, patch));
      this.saved.emit({ department: updated, isNew: false });
      this.notify.success(this.transloco.translate('departments.toast.saved'));
      this.closeImmediate();
    } catch (error) {
      await this.handleSaveError(error, isDeactivating, isActivating, base);
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
    const base = this.baseDepartment();
    if (!base || !this.canManage() || this.saving()) return;
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
    this.baseDepartment.set(null);
    this.presetCascade = { ...EMPTY_CASCADE };
    this.cascadeEditedByUser = false;
    this.resetValidation();
  }

  private async handleSaveError(
    error: unknown,
    isDeactivating: boolean,
    isActivating = false,
    base?: Department,
  ): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      if (await this.staleDialog().open()) {
        this.staleScopeDetected.emit();
        if (base) {
          try {
            const fresh = await getDepartment(base.id);
            this.syncDepartment(fresh);
          } catch (reloadError) {
            this.notify.error(this.resolveError(reloadError));
            this.closeImmediate();
          }
        }
      }
      return;
    }
    if (code === 'ORG_PARENT_INACTIVE') {
      if (isActivating) {
        this.isActive.set(false);
      }
      this.notify.error(this.resolveError(error));
      return;
    }
    if (code === 'ORG_NODE_NOT_EMPTY' && isDeactivating && base) {
      this.isActive.set(true);
      const rawBlockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      const blockers = Array.isArray(rawBlockers) ? rawBlockers.map(String) : [];
      this.deactivateBlocked.emit({ department: base, blockers });
      return;
    }
    this.notify.error(this.resolveError(error));
    if (code === 'ORG_NODE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
      this.deletedRemotely.emit();
      this.closeImmediate();
    }
  }

  private async resolveCompanyFromBranch(branchId: string, seq: number): Promise<void> {
    try {
      const branch = await getBranch(branchId);
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
