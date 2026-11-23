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
import {
  FormField,
  form,
  maxLengthError,
  readonly,
  requiredError,
  submit,
  validate,
} from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingStore,
  tablerLock,
  tablerShieldLock,
  tablerWorld,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  errorCodeOf,
  staffErrorMessage,
  newIdempotencyKey,
} from '../../shared/staff.api';
import { fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { StaffSession } from '../../shared/staff-session';
import { Role, RoleDetail, STAFF_LIMITS } from '../../shared/staff.model';
import { RolesApi, type CreateRoleBody, type UpdateRoleBody } from '../roles.api';

interface RoleDraft {
  name: string;
  description: string;
}

const EMPTY_DRAFT: RoleDraft = { name: '', description: '' };

function validateRoleName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return requiredError();
  if (Array.from(trimmed).length > STAFF_LIMITS.roleName)
    return maxLengthError(STAFF_LIMITS.roleName);
  return undefined;
}

function validateRoleDescription(value: string) {
  if (Array.from(value.trim()).length > STAFF_LIMITS.roleDescription) {
    return maxLengthError(STAFF_LIMITS.roleDescription);
  }
  return undefined;
}

function resolveRoleText(role: Role, language: 'ar' | 'en'): string {
  const localized = language === 'ar' ? role.nameI18n?.ar : role.nameI18n?.en;
  return localized?.trim() || role.name;
}

function resolveRoleDescription(role: Role, language: 'ar' | 'en'): string {
  const localized = language === 'ar' ? role.descriptionI18n?.ar : role.descriptionI18n?.en;
  return localized?.trim() || role.description || '';
}

@Component({
  selector: 'app-role-modal',
  imports: [FormField, TranslocoPipe, NgIcon, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerShieldLock, tablerLock, tablerWorld, tablerBuildingStore })],
  templateUrl: './role-modal.html',
})
export class RoleModal {
  private static nextId = 0;
  protected readonly uid = `role-modal-${++RoleModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly api = inject(RolesApi);
  private readonly session = inject(StaffSession);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly canCreate = input(false);
  readonly created = output<RoleDetail>();
  readonly saved = output<RoleDetail>();
  readonly deletedRemotely = output<void>();
  readonly deleteRequested = output<Role>();
  readonly permissionsRequested = output<Role>();
  readonly editingId = computed(() => this.editingRole()?.id ?? null);
  protected readonly canDelete = computed(() => this.session.isTenantWide('roles.role.delete'));
  protected readonly canReadPermissions = computed(() =>
    this.editingRole()?.permissionMode === 'BRANCH'
      ? this.session.canReadBranchPermissions()
      : this.session.canReadRolePermissions(),
  );

  protected readonly maxName = STAFF_LIMITS.roleName;
  protected readonly maxDescription = STAFF_LIMITS.roleDescription;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly editingRole = signal<Role | null>(null);
  protected readonly submitAttempted = signal(false);
  private readonly nameServerError = signal<{ code: string; value: string } | null>(null);

  private readonly draft = signal<RoleDraft>({ ...EMPTY_DRAFT });
  private readonly baseline = signal<RoleDraft>({ ...EMPTY_DRAFT });
  private readonly fieldMessages = signal<{
    value: RoleDraft;
    fields: Record<string, string[]>;
  } | null>(null);
  protected readonly isReadonly = computed(() =>
    this.mode() === 'create'
      ? !this.canCreate()
      : Boolean(this.editingRole()?.isSystem) || !this.session.isTenantWide('roles.role.update'),
  );

  protected readonly roleForm = form(this.draft, (path) => {
    validate(path.name, ({ value }) => validateRoleName(value()));
    validate(path.description, ({ value }) => validateRoleDescription(value()));
    readonly(path.name, { when: () => this.isReadonly() });
    readonly(path.description, { when: () => this.isReadonly() });
  });

  protected readonly saving = computed(() => this.roleForm().submitting());
  protected readonly nameCount = computed(() => Array.from(this.draft().name).length);
  protected readonly descriptionCount = computed(() => Array.from(this.draft().description).length);

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'create') {
      return this.transloco.translate('roles.modal.new');
    }
    const role = this.editingRole();
    return role
      ? resolveRoleText(role, this.language())
      : this.transloco.translate('roles.modal.title');
  });

  protected readonly dirty = computed(() => {
    const current = this.draft();
    return (
      !this.isReadonly() &&
      (current.name.trim() !== this.baseline().name.trim() ||
        current.description.trim() !== this.baseline().description.trim())
    );
  });

  private allowClose = false;
  private confirmingDiscard = false;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  openCreate(): void {
    this.allowClose = false;
    this.mode.set('create');
    this.editingRole.set(null);
    this.submitAttempted.set(false);
    this.nameServerError.set(null);
    this.clearIdempotency();
    this.baseline.set({ ...EMPTY_DRAFT });
    this.fieldMessages.set(null);
    this.roleForm().reset({ ...EMPTY_DRAFT });
    this.modal().open();
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name`)?.focus(),
      { injector: this.injector },
    );
  }

  openDetails(role: Role): void {
    this.allowClose = false;
    this.mode.set('edit');
    this.editingRole.set(role);
    this.submitAttempted.set(false);
    this.nameServerError.set(null);
    this.clearIdempotency();
    this.fieldMessages.set(null);
    const baseline = {
      name: role.isSystem ? resolveRoleText(role, this.language()) : role.name,
      description: role.isSystem
        ? resolveRoleDescription(role, this.language())
        : (role.description ?? ''),
    };
    this.baseline.set(baseline);
    this.roleForm().reset({ ...baseline });
    this.modal().open();
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name`)?.focus(),
      { injector: this.injector },
    );
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected nameError(): string | null {
    this.i18n();
    const server = this.nameServerError();
    if (server && server.value === this.draft().name.trim()) {
      return this.transloco.translate(`roles.errors.${server.code}`);
    }
    const messages = this.fieldMessages();
    if (messages?.value.name === this.draft().name && messages.fields['name']?.length)
      return messages.fields['name'][0];
    const state = this.roleForm.name();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'required') {
      return this.transloco.translate('roles.validation.nameRequired');
    }
    if (error.kind === 'maxLength') {
      return this.transloco.translate('roles.validation.nameMaxLength', {
        max: STAFF_LIMITS.roleName,
      });
    }
    return null;
  }

  protected descriptionError(): string | null {
    this.i18n();
    const messages = this.fieldMessages();
    if (
      messages?.value.description === this.draft().description &&
      messages.fields['description']?.length
    )
      return messages.fields['description'][0];
    const state = this.roleForm.description();
    const error = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!error) return null;
    if (error.kind === 'maxLength') {
      return this.transloco.translate('roles.validation.descriptionMaxLength', {
        max: STAFF_LIMITS.roleDescription,
      });
    }
    return null;
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    if (this.isReadonly() || this.saving()) return;
    this.submitAttempted.set(true);

    void submit(this.roleForm, async () => {
      const value = this.draft();
      const trimmedName = value.name.trim();
      const trimmedDescription = value.description.trim();

      const creating = this.mode() === 'create';
      const role = this.editingRole();
      const payload: CreateRoleBody | UpdateRoleBody = {};
      if (creating || trimmedName !== this.baseline().name.trim()) payload.name = trimmedName;
      if (creating) {
        if (trimmedDescription) payload.description = trimmedDescription;
      } else if (trimmedDescription !== this.baseline().description.trim()) {
        payload.description = trimmedDescription || null;
      }
      if (!creating && (!role || !this.dirty())) return undefined;
      this.fieldMessages.set(null);
      try {
        const key = this.idempotencyKeyFor(payload);
        const updated = creating
          ? await this.api.create(payload as CreateRoleBody, key)
          : await this.api.update(role!.id, payload, key);
        this.clearIdempotency();
        this.nameServerError.set(null);
        this.notify.success(
          this.transloco.translate(creating ? 'roles.toast.created' : 'roles.toast.saved'),
        );
        if (creating) {
          this.closeImmediate();
          this.created.emit(updated);
        } else {
          this.editingRole.set(updated);
          const baseline = { name: updated.name, description: updated.description ?? '' };
          this.baseline.set(baseline);
          this.roleForm().reset({ ...baseline });
          this.saved.emit(updated);
        }
      } catch (error) {
        const code = errorCodeOf(error);
        if (code === 'ROLE_NAME_TAKEN' || code === 'ROLE_NAME_RESERVED') {
          this.nameServerError.set({ code, value: trimmedName });
        } else if (isValidationError(error)) {
          const fields = fieldErrorsOf(error);
          this.fieldMessages.set({ value: { ...value }, fields });
          if (fields['_']?.length) this.notify.error(fields['_'].join(' '));
          else if (!Object.keys(fields).length)
            this.notify.error(staffErrorMessage(error, 'roles', this.transloco, 'write'));
        } else {
          const message = staffErrorMessage(error, 'roles', this.transloco, 'write');
          if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
          else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
          else this.notify.error(message);
          if (
            !creating &&
            (code === 'ROLE_NOT_FOUND' || (error instanceof ApiError && error.status === 404))
          ) {
            this.closeImmediate();
            this.deletedRemotely.emit();
          }
        }
      }
      return undefined;
    });
  }

  protected undo(): void {
    if (this.saving()) return;
    this.roleForm().reset({ ...this.baseline() });
    this.fieldMessages.set(null);
    this.nameServerError.set(null);
    this.clearIdempotency();
  }

  protected requestDelete(): void {
    const role = this.editingRole();
    if (role && !role.isSystem && this.canDelete() && !this.saving())
      this.deleteRequested.emit(role);
  }

  protected async openPermissions(): Promise<void> {
    const role = this.editingRole();
    if (!role || !this.canReadPermissions() || this.saving()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
    this.permissionsRequested.emit(role);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
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
    this.editingRole.set(null);
    this.submitAttempted.set(false);
    this.nameServerError.set(null);
    this.clearIdempotency();
  }

  private idempotencyKeyFor(body: CreateRoleBody | UpdateRoleBody): string {
    const fingerprint = JSON.stringify(body);
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
