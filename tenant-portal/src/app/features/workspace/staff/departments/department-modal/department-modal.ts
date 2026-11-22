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
import { provideIcons } from '@ng-icons/core';
import { tablerSitemap } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { OrganizationCreateApi, type CreateDepartmentBody } from '../../shared/organization-create.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { errorCodeOf, errorMessage } from '../../shared/staff.api';
import { Branch, CODE_PATTERN, Company, Department, OrgCascadeValue, STAFF_LIMITS } from '../../shared/staff.model';

const EMPTY_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

@Component({
  selector: 'app-department-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Field, Modal, OrgCascade, StatusBadge],
  providers: [provideIcons({ tablerSitemap })],
  templateUrl: './department-modal.html',
})
export class DepartmentModal {
  private static nextId = 0;
  protected readonly uid = `department-modal-${++DepartmentModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly organization = inject(OrganizationReadApi);
  private readonly createApi = inject(OrganizationCreateApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly staleDialog = viewChild.required<ConfirmDialog>('staleDialog');

  readonly companies = input.required<readonly Company[]>();
  readonly branches = input.required<readonly Branch[]>();
  readonly createBranches = input.required<readonly Branch[]>();
  readonly saved = output<Department>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'details'>('create');
  protected readonly saving = signal(false);
  protected readonly canManage = computed(() => this.mode() === 'create' && this.createBranches().length > 0);
  protected readonly branchOptions = computed(() => {
    if (this.mode() === 'details') return this.branches();
    return this.createBranches();
  });
  protected readonly companyOptions = computed(() => {
    if (this.mode() === 'details') return this.companies();
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

  openDetails(department: Department, companyId?: string | null): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.mode.set('details');
    this.cascadeEditedByUser = false;
    this.applyDepartmentToForm(department, companyId ?? null);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    if (!companyId) {
      void this.resolveCompanyFromBranch(department.branchId, seq);
    }
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
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

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving()) return;

    this.submitAttempted.set(true);
    this.codeServerError.set(null);

    const cascadeErrs = this.cascadeErrors();
    if (cascadeErrs.company || cascadeErrs.branch || this.codeError() || this.nameError()) {
      return;
    }

    const { companyId, branchId } = this.cascadeValue();
    const branch = this.createBranches().find((item) => item.id === branchId && item.companyId === companyId);
    if (!branch) {
      this.notify.error(this.transloco.translate('apiErrors.permission'));
      return;
    }
    const body: CreateDepartmentBody = { branchId: branch.id, code: this.code().trim(), name: this.name().trim() };

    this.saving.set(true);
    try {
      const created = await this.createApi.createDepartment(body, this.idempotencyKeyFor(body));
      this.saved.emit(created);
      this.notify.success(this.transloco.translate('departments.toast.created'));
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
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      if (await this.staleDialog().open()) this.staleScopeDetected.emit();
      return;
    }
    this.notify.error(this.resolveError(error));
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
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(payload: CreateDepartmentBody): string {
    const signature = JSON.stringify(payload);
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
