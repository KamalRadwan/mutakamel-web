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
import { FormField, form, maxLengthError, patternError, requiredError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerUserPlus } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { errorCodeOf, errorMessage, fieldErrorsOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StaffSession } from '../../shared/staff-session';
import {
  Branch,
  Company,
  Department,
  EMPLOYEE_CODE_PATTERN,
  OrgCascadeLevel,
  OrgCascadeValue,
  STAFF_LIMITS,
  TenantUser,
  Team,
} from '../../shared/staff.model';
import { StaffUsersApi, type InviteUserBody } from '../users.api';
import { UserManagerPicker } from '../user-profile-tab/user-manager-picker';
import { EMAIL_PATTERN, EMPTY_USER_CASCADE } from '../users-page/users.model';

interface InviteDraft {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string;
}

const EMPTY_DRAFT: InviteDraft = {
  email: '',
  firstName: '',
  lastName: '',
  employeeCode: '',
  jobTitle: '',
};

@Component({
  selector: 'app-invite-modal',
  imports: [
    FormField,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Field,
    Modal,
    OrgCascade,
    UserManagerPicker,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerUserPlus }),
  ],
  templateUrl: './invite-modal.html',
})
export class InviteModal {
  private static nextId = 0;
  protected readonly uid = `invite-modal-${++InviteModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly session = inject(StaffSession);
  private readonly api = inject(StaffUsersApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly managerPicker = viewChild(UserManagerPicker);

  readonly companies = input<Company[]>([]);
  readonly branches = input<Branch[]>([]);
  readonly departments = input<Department[]>([]);
  readonly teams = input<Team[]>([]);

  readonly invited = output<TenantUser>();

  protected readonly limits = STAFF_LIMITS;

  private readonly draft = signal<InviteDraft>({ ...EMPTY_DRAFT });
  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_USER_CASCADE });
  protected readonly managerId = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);
  protected readonly placementSource = computed(() => ({
    branches: this.branches(),
    departments: this.departments(),
    teams: this.teams(),
  }));
  protected readonly canReadManagers = computed(() => this.session.can('users.user.read'));

  private readonly emailServerError = signal<{ message: string; value: string } | null>(null);
  private readonly codeServerError = signal<{ message: string; value: string } | null>(null);
  private readonly placementServerError = signal<string | null>(null);
  private readonly managerServerError = signal<{ message: string; value: string | null } | null>(null);

  protected readonly inviteForm = form(this.draft, (path) => {
    validate(path.email, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return requiredError();
      if (Array.from(trimmed).length > STAFF_LIMITS.email) return maxLengthError(STAFF_LIMITS.email);
      if (!EMAIL_PATTERN.test(trimmed)) return patternError(EMAIL_PATTERN);
      return undefined;
    });
    validate(path.firstName, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return requiredError();
      if (Array.from(trimmed).length > STAFF_LIMITS.personName) return maxLengthError(STAFF_LIMITS.personName);
      return undefined;
    });
    validate(path.lastName, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return requiredError();
      if (Array.from(trimmed).length > STAFF_LIMITS.personName) return maxLengthError(STAFF_LIMITS.personName);
      return undefined;
    });
    validate(path.employeeCode, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return undefined;
      if (Array.from(trimmed).length > STAFF_LIMITS.employeeCode) return maxLengthError(STAFF_LIMITS.employeeCode);
      if (!EMPLOYEE_CODE_PATTERN.test(trimmed)) return patternError(EMPLOYEE_CODE_PATTERN);
      return undefined;
    });
    validate(path.jobTitle, ({ value }) => {
      const trimmed = value().trim();
      if (Array.from(trimmed).length > STAFF_LIMITS.jobTitle) return maxLengthError(STAFF_LIMITS.jobTitle);
      return undefined;
    });
  });

  protected readonly saving = computed(() => this.inviteForm().submitting());
  protected readonly emailCount = computed(() => Array.from(this.draft().email).length);
  protected readonly firstNameCount = computed(() => Array.from(this.draft().firstName).length);
  protected readonly lastNameCount = computed(() => Array.from(this.draft().lastName).length);
  protected readonly codeCount = computed(() => Array.from(this.draft().employeeCode).length);
  protected readonly jobTitleCount = computed(() => Array.from(this.draft().jobTitle).length);

  protected readonly dirty = computed(() => {
    const d = this.draft();
    const c = this.cascadeValue();
    const cascadeChanged = c.companyId !== this.presetCascade.companyId ||
      c.branchId !== this.presetCascade.branchId ||
      c.departmentId !== this.presetCascade.departmentId ||
      c.teamId !== this.presetCascade.teamId;
    return (
      d.email.trim() !== '' ||
      d.firstName.trim() !== '' ||
      d.lastName.trim() !== '' ||
      d.employeeCode.trim() !== '' ||
      d.jobTitle.trim() !== '' ||
      cascadeChanged ||
      this.managerId() !== null
    );
  });

  protected readonly cascadeErrors = computed<Partial<Record<OrgCascadeLevel, string>>>(() => {
    this.i18n();
    const server = this.placementServerError();
    const current = this.cascadeValue();
    const errors: Partial<Record<OrgCascadeLevel, string>> = {};
    if (this.submitAttempted()) {
      if (!current.companyId) errors.company = this.transloco.translate('users.validation.companyRequired');
      if (!current.branchId) errors.branch = this.transloco.translate('users.validation.branchRequired');
      if (!current.departmentId) errors.department = this.transloco.translate('users.validation.departmentRequired');
    }
    if (server && !errors.company && !errors.branch && !errors.department) {
      errors.department = server;
    }
    return errors;
  });

  protected readonly emailError = computed(() => {
    this.i18n();
    const server = this.emailServerError();
    if (server && server.value === this.draft().email.trim().toLowerCase()) return server.message;
    const state = this.inviteForm.email();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'required') return this.transloco.translate('users.validation.emailRequired');
    if (error.kind === 'maxLength') {
      return this.transloco.translate('users.validation.emailMaxLength', { max: STAFF_LIMITS.email });
    }
    if (error.kind === 'pattern') return this.transloco.translate('users.validation.emailInvalid');
    return null;
  });

  protected readonly firstNameError = computed(() => {
    this.i18n();
    const state = this.inviteForm.firstName();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'required') return this.transloco.translate('users.validation.firstNameRequired');
    if (error.kind === 'maxLength') {
      return this.transloco.translate('users.validation.firstNameMaxLength', { max: STAFF_LIMITS.personName });
    }
    return null;
  });

  protected readonly lastNameError = computed(() => {
    this.i18n();
    const state = this.inviteForm.lastName();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'required') return this.transloco.translate('users.validation.lastNameRequired');
    if (error.kind === 'maxLength') {
      return this.transloco.translate('users.validation.lastNameMaxLength', { max: STAFF_LIMITS.personName });
    }
    return null;
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server && server.value === this.draft().employeeCode.trim()) return server.message;
    const state = this.inviteForm.employeeCode();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'maxLength' || error.kind === 'pattern') {
      return this.transloco.translate('users.validation.codeInvalid');
    }
    return null;
  });

  protected readonly jobTitleError = computed(() => {
    this.i18n();
    const state = this.inviteForm.jobTitle();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'maxLength') {
      return this.transloco.translate('users.validation.jobTitleMaxLength', { max: STAFF_LIMITS.jobTitle });
    }
    return null;
  });

  protected readonly managerError = computed(() => {
    const server = this.managerServerError();
    return server && server.value === this.managerId() ? server.message : null;
  });

  private allowClose = false;
  private confirmingDiscard = false;
  private presetCascade: OrgCascadeValue = { ...EMPTY_USER_CASCADE };
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  open(preset?: Partial<OrgCascadeValue>): void {
    this.allowClose = false;

    const companies = this.companies();
    const company = preset?.companyId ? companies.find((item) => item.id === preset.companyId) :
      companies.length === 1 ? companies[0] : undefined;
    const branches = this.branches().filter((item) => item.companyId === company?.id);
    const branch = preset?.branchId ? branches.find((item) => item.id === preset.branchId) :
      branches.length === 1 ? branches[0] : undefined;
    const departments = this.departments().filter((item) => item.branchId === branch?.id);
    const department = preset?.departmentId ? departments.find((item) => item.id === preset.departmentId) :
      departments.length === 1 ? departments[0] : undefined;
    const team = this.teams().find((item) => item.id === preset?.teamId && item.departmentId === department?.id);
    const initialCascade: OrgCascadeValue = {
      companyId: company?.id ?? null,
      branchId: branch?.id ?? null,
      departmentId: department?.id ?? null,
      teamId: team?.id ?? null,
    };
    this.presetCascade = { ...initialCascade };
    this.cascadeValue.set(initialCascade);
    this.managerId.set(null);
    this.submitAttempted.set(false);
    this.clearServerErrors();
    this.clearIdempotency();
    this.inviteForm().reset({ ...EMPTY_DRAFT });
    this.modal().open();
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-email`)?.focus(),
      { injector: this.injector },
    );
  }

  closeImmediate(): void {
    this.managerPicker()?.close();
    this.allowClose = true;
    this.modal().close();
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    this.cascadeValue.set(next);
    this.placementServerError.set(null);
  }

  protected onManagerChange(next: string | null): void {
    this.managerId.set(next);
    this.managerServerError.set(null);
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    if (this.saving()) return;

    this.submitAttempted.set(true);
    this.clearServerErrors();

    void submit(this.inviteForm, async () => {
      const cascade = this.cascadeValue();
      if (!cascade.companyId || !cascade.branchId || !cascade.departmentId) {
        return undefined;
      }
      const branch = this.branches().find((item) => item.id === cascade.branchId && item.companyId === cascade.companyId);
      const department = this.departments().find((item) => item.id === cascade.departmentId && item.branchId === branch?.id);
      const teamIsValid = !cascade.teamId ||
        this.teams().some((item) => item.id === cascade.teamId && item.departmentId === department?.id);
      if (!branch || !department || !teamIsValid || !this.session.can('users.user.invite', cascade)) {
        this.placementServerError.set(this.transloco.translate('users.invite.placementUnavailable'));
        return undefined;
      }

      const d = this.draft();
      const email = d.email.trim().toLowerCase();
      const firstName = d.firstName.trim();
      const lastName = d.lastName.trim();
      const employeeCode = d.employeeCode.trim();
      const jobTitle = d.jobTitle.trim();
      const managerId = this.managerId();

      const body: InviteUserBody = {
        email,
        firstName,
        lastName,
        companyId: cascade.companyId,
        branchId: cascade.branchId,
        departmentId: cascade.departmentId,
        ...(cascade.teamId ? { teamId: cascade.teamId } : {}),
        ...(employeeCode ? { employeeCode } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        ...(managerId ? { managerId } : {}),
      };

      try {
        const key = this.idempotencyKeyFor(body);
        const created = await this.api.inviteUser(body, key);
        this.clearIdempotency();
        this.notify.success(this.transloco.translate('users.toast.invited', { email: created.email }));
        this.closeImmediate();
        this.invited.emit(created);
      } catch (error) {
        const code = errorCodeOf(error);
        const fields = fieldErrorsOf(error);
        const message = errorMessage(error, 'staff', this.transloco);
        if (code === 'TENANT_EMAIL_TAKEN' || code === 'INVITE_EMAIL_UNDELIVERABLE' || fields['email']) {
          this.emailServerError.set({ message, value: email });
          return undefined;
        }
        if (code === 'EMPLOYEE_CODE_TAKEN' || fields['employeeCode']) {
          this.codeServerError.set({ message, value: employeeCode });
          return undefined;
        }
        if (code === 'PLACEMENT_INCONSISTENT' || fields['companyId'] || fields['branchId'] ||
            fields['departmentId'] || fields['teamId']) {
          this.placementServerError.set(message);
          return undefined;
        }
        if (code === 'MANAGER_NOT_FOUND' || fields['managerId']) {
          this.managerServerError.set({ message, value: managerId });
          return undefined;
        }
        this.notify.error(seatErrorMessage(this.transloco, error) ?? message);
      }
      return undefined;
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    this.managerPicker()?.close();
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    this.managerPicker()?.close();
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.presetCascade = { ...EMPTY_USER_CASCADE };
    this.submitAttempted.set(false);
    this.clearServerErrors();
    this.clearIdempotency();
  }

  private clearServerErrors(): void {
    this.emailServerError.set(null);
    this.codeServerError.set(null);
    this.placementServerError.set(null);
    this.managerServerError.set(null);
  }

  private idempotencyKeyFor(body: unknown): string {
    const fingerprint = `invite:${JSON.stringify(body)}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private clearIdempotency(): void {
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
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
