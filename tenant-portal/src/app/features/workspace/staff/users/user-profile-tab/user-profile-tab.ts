import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { FormField, form, maxLengthError, patternError, readonly, requiredError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/staff.api';
import { fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { StaffUsersApi, type UpdateUserBody } from '../users.api';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StaffSession } from '../../shared/staff-session';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import {
  EMPLOYEE_CODE_PATTERN,
  OrgCascadeLevel,
  OrgCascadeValue,
  STAFF_LIMITS,
  TenantUser,
} from '../../shared/staff.model';
import { EMPTY_USER_CASCADE, formatStaffDate, resolveStaffError } from '../users-page/users.model';
import { UserManagerPicker } from './user-manager-picker';

interface ProfileDraft {
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string;
}

type UserPatch = UpdateUserBody;

const EMPTY_DRAFT: ProfileDraft = {
  firstName: '',
  lastName: '',
  employeeCode: '',
  jobTitle: '',
};

@Component({
  selector: 'app-user-profile-tab',
  imports: [FormField, TranslocoPipe, NgIcon, Button, Field, OrgCascade, StatusBadge, UserManagerPicker],
  providers: [provideIcons({ tablerLock })],
  // viewProviders: this tab projects <ng-content>; keep the scope off the parent's host and projected pipes.
  viewProviders: [
    provideTranslocoScopeInherited('settings', { scope: 'staff', alias: 'staff' }, { scope: 'staff-users', alias: 'users' }),
  ],
  templateUrl: './user-profile-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UserProfileTab {
  private static nextId = 0;
  protected readonly uid = `user-profile-tab-${++UserProfileTab.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly notify = inject(Notify);
  private readonly usersApi = inject(StaffUsersApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly managerPicker = viewChild(UserManagerPicker);

  readonly user = input.required<TenantUser>();
  readonly knownUsers = input<TenantUser[]>([]);

  readonly saved = output<TenantUser>();
  readonly closeRequested = output<void>();
  readonly deletedRemotely = output<void>();
  readonly reloadRequested = output<void>();
  private readonly fieldServerErrors = signal<Record<string, { value: string; message: string }>>({});

  protected readonly limits = STAFF_LIMITS;

  private readonly draft = signal<ProfileDraft>({ ...EMPTY_DRAFT });
  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_USER_CASCADE });
  private readonly baselineCascade = signal<OrgCascadeValue>({ ...EMPTY_USER_CASCADE });
  protected readonly managerId = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);

  private readonly codeServerError = signal<{ message: string; value: string } | null>(null);
  private readonly managerServerError = signal<{ message: string; value: string | null } | null>(null);
  private readonly placementServerError = signal<string | null>(null);

  protected readonly isSelf = computed(() => this.session.me()?.id === this.user().id);
  protected readonly canUpdateCurrent = computed(() =>
    this.session.can('users.user.update', {
      companyId: this.user().companyId,
      branchId: this.user().branchId,
    }),
  );

  protected readonly isReadonly = computed(
    () => this.user().isTenantOwner || this.isSelf() || !this.canUpdateCurrent(),
  );

  protected readonly readonlyReason = computed<string | null>(() => {
    this.i18n();
    if (this.user().isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (this.isSelf()) return this.transloco.translate('staff.protected.self');
    if (!this.canUpdateCurrent()) return this.transloco.translate('staff.protected.scope');
    return null;
  });

  protected readonly profileForm = form(this.draft, (path) => {
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
    readonly(path.firstName, { when: () => this.isReadonly() });
    readonly(path.lastName, { when: () => this.isReadonly() });
    readonly(path.employeeCode, { when: () => this.isReadonly() });
    readonly(path.jobTitle, { when: () => this.isReadonly() });
  });

  readonly saving = computed(() => this.profileForm().submitting());
  protected readonly firstNameCount = computed(() => Array.from(this.draft().firstName).length);
  protected readonly lastNameCount = computed(() => Array.from(this.draft().lastName).length);
  protected readonly codeCount = computed(() => Array.from(this.draft().employeeCode).length);
  protected readonly jobTitleCount = computed(() => Array.from(this.draft().jobTitle).length);

  readonly dirty = computed(() => {
    if (this.isReadonly()) return false;
    const base = this.user();
    const d = this.draft();
    const c = this.cascadeValue();
    const b = this.baselineCascade();
    return (
      d.firstName.trim() !== base.firstName ||
      d.lastName.trim() !== base.lastName ||
      (d.employeeCode.trim() || null) !== base.employeeCode ||
      (d.jobTitle.trim() || null) !== base.jobTitle ||
      c.companyId !== b.companyId ||
      c.branchId !== b.branchId ||
      c.departmentId !== b.departmentId ||
      (c.teamId || null) !== (b.teamId || null) ||
      (this.managerId() || null) !== base.managerId
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

  protected readonly firstNameError = computed(() => {
    this.i18n();
    const server = this.fieldServerErrors()['firstName'];
    if (server && server.value === this.draft().firstName.trim()) return server.message;
    const state = this.profileForm.firstName();
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
    const server = this.fieldServerErrors()['lastName'];
    if (server && server.value === this.draft().lastName.trim()) return server.message;
    const state = this.profileForm.lastName();
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
    const state = this.profileForm.employeeCode();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'maxLength' || error.kind === 'pattern') {
      return this.transloco.translate('users.validation.codeInvalid');
    }
    return null;
  });

  protected readonly jobTitleError = computed(() => {
    this.i18n();
    const server = this.fieldServerErrors()['jobTitle'];
    if (server && server.value === this.draft().jobTitle.trim()) return server.message;
    const state = this.profileForm.jobTitle();
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

  private syncedUserId: string | null = null;
  private syncedUpdatedAt: string | null = null;
  private cascadeInteracted = false;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  constructor() {
    effect(() => {
      const u = this.user();
      const isNewUser = this.syncedUserId !== u.id;
      const updatedChanged = this.syncedUpdatedAt !== u.updatedAt;
      if (isNewUser || (updatedChanged && !this.dirty())) {
        this.syncedUserId = u.id;
        this.syncedUpdatedAt = u.updatedAt;
        untracked(() => this.applyUserToForm(u));
      }
    });
  }

  protected formatDate(iso: string): string {
    return formatStaffDate(iso, this.language());
  }

  protected markCascadeInteracted(): void {
    this.cascadeInteracted = true;
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    const prev = this.cascadeValue();
    if (
      !this.cascadeInteracted &&
      prev.companyId === next.companyId &&
      prev.branchId === next.branchId &&
      prev.departmentId === next.departmentId &&
      prev.teamId === null &&
      next.teamId !== null
    ) {
      // Absorb OrgCascade single-team auto-selection on open so viewing a user doesn't mark Profile dirty.
      this.baselineCascade.set({ ...next });
    }
    this.cascadeValue.set(next);
    this.placementServerError.set(null);
  }

  protected onManagerChange(next: string | null): void {
    this.managerId.set(next);
    this.managerServerError.set(null);
  }

  undo(): void {
    this.managerPicker()?.close();
    this.applyUserToForm(this.user());
  }

  async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (this.isReadonly() || this.saving()) return false;
    if (!this.dirty()) return true;

    this.fieldServerErrors.set({});
    this.submitAttempted.set(true);
    this.codeServerError.set(null);
    this.managerServerError.set(null);
    this.placementServerError.set(null);

    let savedOk = false;

    await submit(this.profileForm, async () => {
      const cascade = this.cascadeValue();
      if (!cascade.companyId || !cascade.branchId || !cascade.departmentId) {
        return undefined;
      }

      const base = this.user();
      const d = this.draft();
      const patch: UserPatch = {};

      const firstName = d.firstName.trim();
      const lastName = d.lastName.trim();
      const employeeCode = d.employeeCode.trim() || null;
      const jobTitle = d.jobTitle.trim() || null;
      const managerId = this.managerId() || null;
      const teamId = cascade.teamId || null;

      if (firstName !== base.firstName) patch.firstName = firstName;
      if (lastName !== base.lastName) patch.lastName = lastName;
      if (employeeCode !== base.employeeCode) patch.employeeCode = employeeCode;
      if (jobTitle !== base.jobTitle) patch.jobTitle = jobTitle;
      if (managerId !== base.managerId) patch.managerId = managerId;

      if (
        cascade.companyId !== base.companyId ||
        cascade.branchId !== base.branchId ||
        cascade.departmentId !== base.departmentId ||
        teamId !== base.teamId
      ) {
        patch.companyId = cascade.companyId;
        patch.branchId = cascade.branchId;
        patch.departmentId = cascade.departmentId;
        patch.teamId = teamId;
      }

      if (Object.keys(patch).length === 0) {
        savedOk = true;
        return undefined;
      }

      try {
        const key = this.idempotencyKeyFor(base.id, patch);
        const updated = await this.usersApi.updateUser(base.id, patch, key);
        this.clearIdempotency();
        this.syncedUserId = updated.id;
        this.syncedUpdatedAt = updated.updatedAt;
        this.applyUserToForm(updated);
        this.notify.success(this.transloco.translate('users.toast.saved'));
        this.saved.emit(updated);
        savedOk = true;
      } catch (error) {
        const code = errorCodeOf(error);
        if (isValidationError(error)) {
          const fields = fieldErrorsOf(error);
          const message = resolveStaffError(error, this.transloco);
          const errors: Record<string, { value: string; message: string }> = {};
          for (const field of ['firstName', 'lastName', 'jobTitle'] as const) {
            if (fields[field]) errors[field] = { value: d[field].trim(), message: fields[field][0] || message };
          }
          this.fieldServerErrors.set(errors);
          if (fields['employeeCode']) this.codeServerError.set({ value: employeeCode ?? '', message: fields['employeeCode'][0] || message });
          if (fields['managerId']) this.managerServerError.set({ value: managerId, message: fields['managerId'][0] || message });
          const placement = ['companyId', 'branchId', 'departmentId', 'teamId'].find((field) => fields[field]);
          if (placement) this.placementServerError.set(fields[placement][0] || message);
          if (fields['_'] || Object.keys(fields).length === 0) this.notify.error(fields['_']?.join(' ') || message);
          return undefined;
        }
        if (code === 'GW.IDEM.IN_FLIGHT') {
          this.notify.info(resolveStaffError(error, this.transloco));
          return undefined;
        }
        if (code === 'GW.IDEM.MISMATCH') {
          this.notify.warning(resolveStaffError(error, this.transloco));
          this.reloadRequested.emit();
          return undefined;
        }
        if (error instanceof ApiError && error.status === 0) return undefined;
        if (code === 'MANAGER_CYCLE') {
          this.managerServerError.set({
            message: this.transloco.translate('users.errors.cycle'),
            value: managerId,
          });
          return undefined;
        }
        if (code === 'MANAGER_NOT_FOUND') {
          this.managerServerError.set({
            message: resolveStaffError(error, this.transloco),
            value: managerId,
          });
          return undefined;
        }
        if (code === 'PLACEMENT_INCONSISTENT') {
          this.placementServerError.set(resolveStaffError(error, this.transloco));
          return undefined;
        }
        if (code === 'EMPLOYEE_CODE_TAKEN') {
          this.codeServerError.set({
            message: resolveStaffError(error, this.transloco),
            value: employeeCode ?? '',
          });
          return undefined;
        }
        this.notify.error(resolveStaffError(error, this.transloco));
        if (code === 'USER_SELF_FORBIDDEN' || code === 'TENANT_OWNER_PROTECTED') this.reloadRequested.emit();
        if (code === 'TENANT_USER_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
          this.deletedRemotely.emit();
        }
      }
      return undefined;
    });

    return savedOk;
  }

  private applyUserToForm(u: TenantUser): void {
    this.cascadeInteracted = false;
    this.fieldServerErrors.set({});
    this.submitAttempted.set(false);
    this.codeServerError.set(null);
    this.managerServerError.set(null);
    this.placementServerError.set(null);
    this.clearIdempotency();
    this.profileForm().reset({
      firstName: u.firstName,
      lastName: u.lastName,
      employeeCode: u.employeeCode ?? '',
      jobTitle: u.jobTitle ?? '',
    });
    const placement: OrgCascadeValue = {
      companyId: u.companyId,
      branchId: u.branchId,
      departmentId: u.departmentId,
      teamId: u.teamId,
    };
    this.baselineCascade.set(placement);
    this.cascadeValue.set({ ...placement });
    this.managerId.set(u.managerId);
  }

  private idempotencyKeyFor(userId: string, body: unknown): string {
    const fingerprint = `${userId}:${JSON.stringify(body)}`;
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
}
