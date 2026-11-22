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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerTrash, tablerUserPlus } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  errorCodeOf,
  getBranch,
  getDepartment,
  getTeam,
  inviteUser,
  newIdempotencyKey,
} from '../../shared/staff.api';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StaffSession } from '../../shared/staff-session';
import {
  Branch,
  EMPLOYEE_CODE_PATTERN,
  OrgCascadeLevel,
  OrgCascadeValue,
  Role,
  STAFF_LIMITS,
  TenantUser,
} from '../../shared/staff.model';
import { UserManagerPicker } from '../user-profile-tab/user-manager-picker';
import { EMAIL_PATTERN, EMPTY_USER_CASCADE, resolveStaffError } from '../users-page/users.model';

interface InviteDraft {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string;
}

interface RoleRowDraft {
  id: number;
  branchId: string;
  roleId: string;
}

const EMPTY_DRAFT: InviteDraft = {
  email: '',
  firstName: '',
  lastName: '',
  employeeCode: '',
  jobTitle: '',
};

const MAX_INVITE_ROLES = 10;

function isAssignableRole(role: Role): boolean {
  if (role.name === 'Tenant Super Admin' || role.nameI18n?.en === 'Tenant Super Admin') {
    return false;
  }
  return !role.isSystem || role.name.toLowerCase() === 'admin';
}

@Component({
  selector: 'app-invite-modal',
  imports: [
    FormField,
    TranslocoPipe,
    NgIcon,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    OrgCascade,
    SeatImpact,
    UserManagerPicker,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerUserPlus, tablerPlus, tablerTrash }),
  ],
  templateUrl: './invite-modal.html',
})
export class InviteModal {
  private static nextId = 0;
  protected readonly uid = `invite-modal-${++InviteModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly session = inject(StaffSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly managerPicker = viewChild(UserManagerPicker);

  readonly knownUsers = input<TenantUser[]>([]);
  readonly branches = input<Branch[]>([]);
  readonly roles = input<Role[]>([]);

  readonly invited = output<TenantUser>();

  protected readonly limits = STAFF_LIMITS;
  protected readonly maxRoleRows = MAX_INVITE_ROLES;

  private readonly draft = signal<InviteDraft>({ ...EMPTY_DRAFT });
  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_USER_CASCADE });
  protected readonly managerId = signal<string | null>(null);
  protected readonly roleRows = signal<RoleRowDraft[]>([]);
  protected readonly submitAttempted = signal(false);
  protected readonly seatBlocked = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());

  protected readonly uniqueRoleItems = computed<{ branchId: string; roleId: string }[]>(() => {
    const seen = new Set<string>();
    const items: { branchId: string; roleId: string }[] = [];
    for (const row of this.roleRows()) {
      if (!row.branchId || !row.roleId) continue;
      const key = `${row.branchId}:${row.roleId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ branchId: row.branchId, roleId: row.roleId });
    }
    return items;
  });

  protected readonly seatChanges = computed<SeatChange[] | null>(() => {
    const items = this.uniqueRoleItems();
    if (items.length === 0) return null;
    const d = this.draft();
    const email = d.email.trim().toLowerCase();
    const firstName = d.firstName.trim();
    const lastName = d.lastName.trim();
    if (!email || !EMAIL_PATTERN.test(email) || !firstName || !lastName) {
      return null;
    }
    const cascade = this.cascadeValue();
    const employeeCode = d.employeeCode.trim();
    const jobTitle = d.jobTitle.trim();
    const managerId = this.managerId();
    return [
      {
        kind: 'IMPORT',
        rows: [
          {
            email,
            firstName,
            lastName,
            ...(cascade.companyId ? { companyId: cascade.companyId } : {}),
            ...(cascade.branchId ? { branchId: cascade.branchId } : {}),
            ...(cascade.departmentId ? { departmentId: cascade.departmentId } : {}),
            ...(cascade.teamId ? { teamId: cascade.teamId } : {}),
            ...(employeeCode ? { employeeCode } : {}),
            ...(jobTitle ? { jobTitle } : {}),
            ...(managerId ? { managerId } : {}),
            roleAssignments: items,
          },
        ],
      },
    ];
  });


  private readonly emailServerError = signal<{ message: string; value: string } | null>(null);
  private readonly codeServerError = signal<{ message: string; value: string } | null>(null);
  private readonly placementServerError = signal<string | null>(null);
  private readonly managerServerError = signal<{ message: string; value: string | null } | null>(null);
  private readonly rolesServerError = signal<string | null>(null);

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

  protected readonly assignableBranches = computed<Branch[]>(() => {
    this.session.me();
    return this.branches().filter(
      (b) =>
        b.status === 'ACTIVE' &&
        this.session.can('users.user.assign_roles', { companyId: b.companyId, branchId: b.id }),
    );
  });

  protected readonly assignableRoles = computed<Role[]>(() => {
    return this.roles().filter(isAssignableRole);
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() =>
    this.assignableBranches().map((b) => ({ value: b.id, label: b.name })),
  );

  protected readonly roleOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.assignableRoles().map((r) => ({
      value: r.id,
      label: r.nameI18n?.[lang] || r.name,
    }));
  });

  protected readonly canAddRoleRow = computed(
    () =>
      this.roleRows().length < MAX_INVITE_ROLES &&
      this.assignableBranches().length > 0 &&
      this.assignableRoles().length > 0,
  );

  protected readonly dirty = computed(() => {
    const d = this.draft();
    const c = this.cascadeValue();
    const cascadeChanged =
      this.cascadeEditedByUser &&
      (c.companyId !== this.presetCascade.companyId ||
        c.branchId !== this.presetCascade.branchId ||
        c.departmentId !== this.presetCascade.departmentId ||
        c.teamId !== this.presetCascade.teamId);
    return (
      d.email.trim() !== '' ||
      d.firstName.trim() !== '' ||
      d.lastName.trim() !== '' ||
      d.employeeCode.trim() !== '' ||
      d.jobTitle.trim() !== '' ||
      cascadeChanged ||
      this.managerId() !== null ||
      this.roleRows().length > 0
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

  protected readonly rolesError = computed(() => this.rolesServerError());

  private allowClose = false;
  private confirmingDiscard = false;
  private cascadeEditedByUser = false;
  private presetCascade: OrgCascadeValue = { ...EMPTY_USER_CASCADE };
  private openSeq = 0;
  private rowCounter = 0;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  open(preset?: Partial<OrgCascadeValue>): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.cascadeEditedByUser = false;

    const initialCascade: OrgCascadeValue = {
      companyId: preset?.companyId || null,
      branchId: preset?.branchId || null,
      departmentId: preset?.departmentId || null,
      teamId: preset?.teamId || null,
    };
    this.presetCascade = { ...initialCascade };
    this.cascadeValue.set(initialCascade);
    this.managerId.set(null);
    this.roleRows.set([]);
    this.seatBlocked.set(false);
    this.submitAttempted.set(false);
    this.clearServerErrors();
    this.clearIdempotency();
    this.inviteForm().reset({ ...EMPTY_DRAFT });
    this.modal().open();
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-email`)?.focus(),
      { injector: this.injector },
    );

    if (initialCascade.teamId && (!initialCascade.departmentId || !initialCascade.branchId || !initialCascade.companyId)) {
      void this.resolveChainFromTeam(initialCascade.teamId, seq);
    } else if (initialCascade.departmentId && (!initialCascade.branchId || !initialCascade.companyId)) {
      void this.resolveChainFromDepartment(initialCascade.departmentId, seq);
    } else if (initialCascade.branchId && !initialCascade.companyId) {
      void this.resolveCompanyFromBranch(initialCascade.branchId, seq);
    }
  }

  closeImmediate(): void {
    this.managerPicker()?.close();
    this.allowClose = true;
    this.modal().close();
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    const prev = this.cascadeValue();
    const formPristine =
      this.draft().email.trim() === '' &&
      this.draft().firstName.trim() === '' &&
      this.draft().lastName.trim() === '' &&
      this.draft().employeeCode.trim() === '' &&
      this.draft().jobTitle.trim() === '' &&
      this.managerId() === null &&
      this.roleRows().length === 0;

    if (
      !this.cascadeEditedByUser &&
      formPristine &&
      ((prev.companyId === null && next.companyId !== null) ||
        (prev.branchId === null && next.branchId !== null) ||
        (prev.departmentId === null && next.departmentId !== null) ||
        (prev.teamId === null && next.teamId !== null))
    ) {
      this.presetCascade = { ...next };
      this.cascadeValue.set(next);
      return;
    }

    this.cascadeEditedByUser = true;
    this.cascadeValue.set(next);
    this.placementServerError.set(null);
  }

  protected onManagerChange(next: string | null): void {
    this.managerId.set(next);
    this.managerServerError.set(null);
  }

  protected addRoleRow(): void {
    if (!this.canAddRoleRow() || this.saving()) return;
    const branches = this.assignableBranches();
    const roles = this.assignableRoles();
    if (!branches.length || !roles.length) return;

    const placementBranchId = this.cascadeValue().branchId;
    const defaultBranch =
      (placementBranchId && branches.find((b) => b.id === placementBranchId)?.id) || branches[0].id;
    const defaultRole = roles[0].id;

    this.rolesServerError.set(null);
    this.roleRows.update((current) => [
      ...current,
      { id: ++this.rowCounter, branchId: defaultBranch, roleId: defaultRole },
    ]);
  }

  protected updateRoleRowBranch(rowId: number, branchId: string): void {
    this.rolesServerError.set(null);
    this.roleRows.update((current) =>
      current.map((row) => (row.id === rowId ? { ...row, branchId } : row)),
    );
  }

  protected updateRoleRowRole(rowId: number, roleId: string): void {
    this.rolesServerError.set(null);
    this.roleRows.update((current) =>
      current.map((row) => (row.id === rowId ? { ...row, roleId } : row)),
    );
  }

  protected removeRoleRow(rowId: number): void {
    this.rolesServerError.set(null);
    this.roleRows.update((current) => current.filter((row) => row.id !== rowId));
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    if (this.saving() || this.seatBlocked()) return;

    this.submitAttempted.set(true);
    this.clearServerErrors();

    void submit(this.inviteForm, async () => {
      const cascade = this.cascadeValue();
      if (!cascade.companyId || !cascade.branchId || !cascade.departmentId) {
        return undefined;
      }
      if (!this.session.can('users.user.invite', { companyId: cascade.companyId, branchId: cascade.branchId })) {
        return undefined;
      }

      const d = this.draft();
      const email = d.email.trim().toLowerCase();
      const firstName = d.firstName.trim();
      const lastName = d.lastName.trim();
      const employeeCode = d.employeeCode.trim();
      const jobTitle = d.jobTitle.trim();
      const managerId = this.managerId();

      const seenPairs = new Set<string>();
      const roleAssignments: { branchId: string; roleId: string }[] = [];
      for (const row of this.roleRows()) {
        if (!row.branchId || !row.roleId) continue;
        if (!this.session.isOwner() || !this.session.can('users.user.assign_roles', { branchId: row.branchId })) {
          return undefined;
        }
        const pairKey = `${row.branchId}:${row.roleId}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        roleAssignments.push({ branchId: row.branchId, roleId: row.roleId });
      }

      const body: Parameters<typeof inviteUser>[0] = {
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
        ...(roleAssignments.length ? { roleAssignments } : {}),
      };

      try {
        const key = this.idempotencyKeyFor(body);
        const created = await inviteUser(body, key);
        this.clearIdempotency();
        this.notify.success(this.transloco.translate('users.toast.invited', { email: created.email }));
        this.closeImmediate();
        this.invited.emit(created);
      } catch (error) {
        const code = errorCodeOf(error);
        if (code === 'TENANT_EMAIL_TAKEN' || code === 'INVITE_EMAIL_UNDELIVERABLE') {
          this.emailServerError.set({ message: resolveStaffError(error, this.transloco), value: email });
          return undefined;
        }
        if (code === 'EMPLOYEE_CODE_TAKEN') {
          this.codeServerError.set({ message: resolveStaffError(error, this.transloco), value: employeeCode });
          return undefined;
        }
        if (code === 'PLACEMENT_INCONSISTENT') {
          this.placementServerError.set(resolveStaffError(error, this.transloco));
          return undefined;
        }
        if (code === 'MANAGER_NOT_FOUND') {
          this.managerServerError.set({
            message: resolveStaffError(error, this.transloco),
            value: managerId,
          });
          return undefined;
        }
        if (
          code === 'ROLE_PRIVILEGE_ESCALATION' ||
          code === 'ROLE_BRANCH_SCOPE_INVALID' ||
          code === 'BRANCH_OR_ROLE_INVALID' ||
          code === 'ROLE_RESERVED_FOR_OWNER' ||
          (code === 'BRANCH_ACCESS_DENIED' && roleAssignments.length > 0)
        ) {
          this.rolesServerError.set(resolveStaffError(error, this.transloco));
          return undefined;
        }
        const seatMsg = seatErrorMessage(this.transloco, error);
        if (seatMsg) {
          this.rolesServerError.set(seatMsg);
          return undefined;
        }
        this.notify.error(resolveStaffError(error, this.transloco));
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
    this.cascadeEditedByUser = false;
    this.roleRows.set([]);
    this.seatBlocked.set(false);
    this.submitAttempted.set(false);
    this.clearServerErrors();
    this.clearIdempotency();
  }

  private async resolveChainFromTeam(teamId: string, seq: number): Promise<void> {
    try {
      const team = await getTeam(teamId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const dept = await getDepartment(team.departmentId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const branch = await getBranch(dept.branchId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const resolved: OrgCascadeValue = {
        companyId: branch.companyId,
        branchId: dept.branchId,
        departmentId: team.departmentId,
        teamId,
      };
      this.presetCascade = { ...resolved };
      this.cascadeValue.set(resolved);
    } catch {
      // Fallback to OrgCascade or page filters.
    }
  }

  private async resolveChainFromDepartment(departmentId: string, seq: number): Promise<void> {
    try {
      const dept = await getDepartment(departmentId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const branch = await getBranch(dept.branchId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const resolved: OrgCascadeValue = {
        companyId: branch.companyId,
        branchId: dept.branchId,
        departmentId,
        teamId: null,
      };
      this.presetCascade = { ...resolved };
      this.cascadeValue.set(resolved);
    } catch {
      // Fallback to OrgCascade or page filters.
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
      // Fallback to OrgCascade or page filters.
    }
  }

  private clearServerErrors(): void {
    this.emailServerError.set(null);
    this.codeServerError.set(null);
    this.placementServerError.set(null);
    this.managerServerError.set(null);
    this.rolesServerError.set(null);
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
