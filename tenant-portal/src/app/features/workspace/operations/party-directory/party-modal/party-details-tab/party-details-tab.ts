import { isPartyTenantWide, canOnPartyBranch } from '../party-modal.util';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, maxLengthError, readonly, requiredError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerLock, tablerPlus, tablerTrash, tablerUser } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../../shared/ui/file-drop/file-drop';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../../core/api/api-errors';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';
import {
  WorkspaceBranch as Branch,
} from '../../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { PartyDirectoryApi, partyImageSrc } from '../../party-directory.api';
import {
  ContactMethodType,
  CreatePartyBody,
  PartyDetail,
  PartyRoleType,
  PartyStatus,
  PartyType,
  UpdatePartyBody,
} from '../../party-directory.model';
import {
  duplicateContactMessage,
  CONTACT_METHOD_TYPES,
  CONTACT_TYPE_META,
  EditableModalTab,
  PARTY_LIMITS,
  PARTY_ROLE_TYPES,
  PARTY_STATUSES,
  PartyDirectoryLimits,
  composePersonDisplayName,
  normalizeContactForCompare,
  resolvePartyError,
  validateContactValue,
} from '../party-modal.util';
import { PartyOwnerPicker } from '../party-owner-picker/party-owner-picker';
import { PartyRoleSelect, RoleSelectOption } from '../party-role-select/party-role-select';

interface DetailsTextDraft {
  displayName: string;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  legalName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
}

interface FirstContactDraft {
  id: number;
  methodType: ContactMethodType;
  value: string;
  label: string;
}

const EMPTY_TEXT_DRAFT: DetailsTextDraft = {
  displayName: '',
  honorificTitle: '',
  firstName: '',
  lastName: '',
  organizationName: '',
  legalName: '',
  taxNumber: '',
  commercialRegistrationNumber: '',
};

@Component({
  selector: 'app-party-details-tab',
  imports: [
    FormField,
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    FileDrop,
    PartyOwnerPicker,
    PartyRoleSelect,
  ],
  providers: [provideIcons({ tablerBuilding, tablerLock, tablerPlus, tablerTrash, tablerUser })],
  templateUrl: './party-details-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
})
export class PartyDetailsTab implements EditableModalTab {
  private static nextId = 0;
  private static nextContactRowId = 0;
  protected readonly uid = `party-details-tab-${++PartyDetailsTab.nextId}`;

  private readonly session = inject(TenantScopeState);
  private readonly api = inject(PartyDirectoryApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly ownerPicker = viewChild(PartyOwnerPicker);
  private readonly roleSelect = viewChild(PartyRoleSelect);

  readonly mode = input.required<'create' | 'edit'>();
  readonly partyType = input.required<PartyType>();
  readonly party = input<PartyDetail | null>(null);
  readonly branches = input<Branch[]>([]);
  readonly limits = input.required<PartyDirectoryLimits>();
  readonly readonly = input(false);

  readonly created = output<PartyDetail>();
  readonly saved = output<PartyDetail>();
  readonly imageChanged = output<PartyDetail>();
  readonly deletedRemotely = output<void>();

  protected readonly limitsConst = PARTY_LIMITS;

  private readonly textDraft = signal<DetailsTextDraft>({ ...EMPTY_TEXT_DRAFT });
  protected readonly branchId = signal<string | null>(null);
  private readonly baselineBranchId = signal<string | null>(null);
  protected readonly ownerUserId = signal<string | null>(null);
  protected readonly status = signal<PartyStatus>('ACTIVE');
  protected readonly contactRows = signal<FirstContactDraft[]>([]);
  protected readonly selectedRoles = signal<PartyRoleType[]>([]);
  protected readonly submitAttempted = signal(false);

  protected readonly imageError = signal<string | null>(null);
  private readonly brokenImageUrl = signal<string | null>(null);
  private readonly serverFields = signal<Record<string, { message: string; value: string }>>({});
  protected readonly roleError = signal<string | null>(null);
  protected readonly uploadingImage = signal(false);
  protected readonly removingImage = signal(false);
  protected readonly imageBusy = computed(() => this.uploadingImage() || this.removingImage());

  private readonly fieldsServerError = signal<{ message: string; value: string } | null>(null);
  private readonly branchServerError = signal<{ message: string; value: string | null } | null>(null);
  private readonly ownerServerError = signal<{ message: string; value: string | null } | null>(null);
  private readonly contactServerErrors = signal<Record<number, { value?: string; label?: string }>>({});

  private displayNameEditedByUser = false;
  private syncedMode: 'create' | 'edit' | null = null;
  private syncedType: PartyType | null = null;
  private syncedPartyId: string | null = null;
  private syncedUpdatedAt: string | null = null;

  protected readonly detailsForm = form(this.textDraft, (path) => {
    validate(path.displayName, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return requiredError();
      if (Array.from(trimmed).length > PARTY_LIMITS.displayName) {
        return maxLengthError(PARTY_LIMITS.displayName);
      }
      return undefined;
    });
    validate(path.honorificTitle, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.honorificTitle
        ? maxLengthError(PARTY_LIMITS.honorificTitle)
        : undefined,
    );
    validate(path.firstName, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.firstName
        ? maxLengthError(PARTY_LIMITS.firstName)
        : undefined,
    );
    validate(path.lastName, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.lastName
        ? maxLengthError(PARTY_LIMITS.lastName)
        : undefined,
    );
    validate(path.organizationName, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.organizationName
        ? maxLengthError(PARTY_LIMITS.organizationName)
        : undefined,
    );
    validate(path.legalName, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.legalName
        ? maxLengthError(PARTY_LIMITS.legalName)
        : undefined,
    );
    validate(path.taxNumber, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.taxNumber
        ? maxLengthError(PARTY_LIMITS.taxNumber)
        : undefined,
    );
    validate(path.commercialRegistrationNumber, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.commercialRegistrationNumber
        ? maxLengthError(PARTY_LIMITS.commercialRegistrationNumber)
        : undefined,
    );
    readonly(path.displayName, { when: () => this.readonly() });
    readonly(path.honorificTitle, { when: () => this.readonly() });
    readonly(path.firstName, { when: () => this.readonly() });
    readonly(path.lastName, { when: () => this.readonly() });
    readonly(path.organizationName, { when: () => this.readonly() });
    readonly(path.legalName, { when: () => this.readonly() });
    readonly(path.taxNumber, { when: () => this.readonly() });
    readonly(path.commercialRegistrationNumber, { when: () => this.readonly() });
  });

  readonly saving = computed(() => this.detailsForm().submitting());

  protected readonly imageSrc = computed(() => {
    const current = this.party();
    const url = current ? partyImageSrc(current) : null;
    return url && url !== this.brokenImageUrl() ? url : null;
  });

  protected readonly maxCreateContacts = computed(() =>
    Math.max(0, Math.min(PARTY_LIMITS.createContactsCap, (this.limits().maxContactMethodsPerParty ?? PARTY_LIMITS.createContactsCap))),
  );

  protected readonly displayNameCount = computed(() => Array.from(this.textDraft().displayName).length);
  protected readonly honorificTitleCount = computed(() => Array.from(this.textDraft().honorificTitle).length);
  protected readonly firstNameCount = computed(() => Array.from(this.textDraft().firstName).length);
  protected readonly lastNameCount = computed(() => Array.from(this.textDraft().lastName).length);
  protected readonly organizationNameCount = computed(() => Array.from(this.textDraft().organizationName).length);
  protected readonly legalNameCount = computed(() => Array.from(this.textDraft().legalName).length);
  protected readonly taxNumberCount = computed(() => Array.from(this.textDraft().taxNumber).length);
  protected readonly commercialRegistrationCount = computed(
    () => Array.from(this.textDraft().commercialRegistrationNumber).length,
  );

  protected readonly branchDropdownValue = computed(() => this.branchId() ?? '');

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.session.me();
    const list = this.branches();
    const currentBranchId = this.party()?.branchId ?? null;
    const tenantWide = isPartyTenantWide(this.session, 'directory.party.manage');
    const options: DropdownOption<string>[] = [];

    if (tenantWide || (this.mode() === 'edit' && currentBranchId === null)) {
      options.push({
        value: '',
        label: this.transloco.translate('wsPartyModal.fields.sharedBranch'),
      });
    }

    for (const branch of list) {
      const permitted = canOnPartyBranch(this.session, 'directory.party.manage', branch.id);
      const isExisting = this.mode() === 'edit' && branch.id === currentBranchId;
      if ((branch.status === 'ACTIVE' && permitted) || isExisting) {
        options.push({ value: branch.id, label: branch.name });
      }
    }

    if (
      this.mode() === 'edit' &&
      currentBranchId &&
      !options.some((opt) => opt.value === currentBranchId)
    ) {
      options.push({ value: currentBranchId, label: currentBranchId });
    }

    return options;
  });

  protected readonly readonlyBranchLabel = computed(() => {
    this.i18n();
    const id = this.branchId();
    if (!id) return this.transloco.translate('wsPartyModal.fields.sharedBranch');
    return this.branches().find((b) => b.id === id)?.name ?? id;
  });

  protected readonly statusOptions = computed<DropdownOption<PartyStatus>[]>(() => {
    this.i18n();
    return PARTY_STATUSES.map((item) => ({
      value: item,
      label: this.transloco.translate(`wsParty.status.${item}`),
    }));
  });

  protected readonly readonlyStatusLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`wsParty.status.${this.status()}`);
  });

  protected readonly contactTypeOptions = computed<DropdownOption<ContactMethodType>[]>(() => {
    this.i18n();
    return CONTACT_METHOD_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`wsParty.contactTypes.${type}`),
    }));
  });

  protected readonly roleOptions = computed<RoleSelectOption[]>(() => {
    this.i18n();
    return PARTY_ROLE_TYPES.map((role) => ({
      value: role,
      label: this.transloco.translate(`wsParty.roles.${role}`),
    }));
  });

  protected readonly contactValidationMap = computed<Record<number, { value?: string; label?: string }>>(() => {
    this.i18n();
    const rows = this.contactRows();
    const serverErrs = this.contactServerErrors();
    const attempted = this.submitAttempted();
    const seen = new Map<string, number>();
    const map: Record<number, { value?: string; label?: string }> = {};

    for (const row of rows) {
      const entry: { value?: string; label?: string } = {};
      const val = row.value.trim();
      const lbl = row.label.trim();

      if (Array.from(lbl).length > PARTY_LIMITS.contactLabel) {
        entry.label = this.transloco.translate('wsPartyModal.validation.maxLength', {
          max: PARTY_LIMITS.contactLabel,
        });
      }

      if (attempted) {
        if (!val) {
          entry.value = this.transloco.translate('wsPartyModal.validation.required');
        } else if (Array.from(val).length > PARTY_LIMITS.contactValue) {
          entry.value = this.transloco.translate('wsPartyModal.validation.maxLength', {
            max: PARTY_LIMITS.contactValue,
          });
        } else if (!validateContactValue(row.methodType, val)) {
          entry.value = this.transloco.translate('wsPartyModal.validation.contactValueInvalid');
        } else {
          const family = row.methodType === 'MOBILE' ? 'PHONE' : row.methodType;
          const norm = `${family}:${normalizeContactForCompare(row.methodType, val)}`;
          if (seen.has(norm)) {
            entry.value = this.transloco.translate('wsPartyModal.validation.contactDuplicateInForm');
          } else {
            seen.set(norm, row.id);
          }
        }
      }

      if (!entry.value && serverErrs[row.id]) {
        entry.value = serverErrs[row.id].value;
        entry.label ??= serverErrs[row.id].label;
      }

      if (entry.value || entry.label) {
        map[row.id] = entry;
      }
    }

    return map;
  });

  readonly dirty = computed(() => {
    if (this.readonly()) return false;
    const d = this.textDraft();
    const type = this.partyType();

    if (this.mode() === 'create') {
      const hasText =
        d.displayName.trim() !== '' ||
        (type === 'PERSON'
          ? d.honorificTitle.trim() !== '' || d.firstName.trim() !== '' || d.lastName.trim() !== ''
          : d.organizationName.trim() !== '' ||
            d.legalName.trim() !== '' ||
            d.taxNumber.trim() !== '' ||
            d.commercialRegistrationNumber.trim() !== '');
      return (
        hasText ||
        this.branchId() !== this.baselineBranchId() ||
        this.ownerUserId() !== null ||
        this.contactRows().length > 0 ||
        this.selectedRoles().length > 0
      );
    }

    const base = this.party();
    if (!base) return false;
    if (d.displayName.trim() !== base.displayName) return true;
    if (type === 'PERSON') {
      if (d.honorificTitle.trim() !== (base.honorificTitle ?? '')) return true;
      if (d.firstName.trim() !== (base.firstName ?? '')) return true;
      if (d.lastName.trim() !== (base.lastName ?? '')) return true;
    } else {
      if (d.organizationName.trim() !== (base.organizationName ?? '')) return true;
      if (d.legalName.trim() !== (base.legalName ?? '')) return true;
      if (d.taxNumber.trim() !== (base.taxNumber ?? '')) return true;
      if (d.commercialRegistrationNumber.trim() !== (base.commercialRegistrationNumber ?? '')) return true;
    }
    return (
      this.branchId() !== base.branchId ||
      (this.ownerUserId() || null) !== base.ownerUserId ||
      this.status() !== base.status
    );
  });

  protected readonly displayNameError = computed(() => {
    this.i18n();
    const field = this.serverFields()['displayName'];
    if (field && field.value === this.textDraft().displayName) return field.message;
    const server = this.fieldsServerError();
    if (server && server.value === this.textDraft().displayName.trim()) return server.message;
    const state = this.detailsForm.displayName();
    const err = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!err) return null;
    if (err.kind === 'required') return this.transloco.translate('wsPartyModal.validation.required');
    if (err.kind === 'maxLength') {
      return this.transloco.translate('wsPartyModal.validation.maxLength', { max: PARTY_LIMITS.displayName });
    }
    return null;
  });

  protected readonly branchError = computed(() => {
    const server = this.branchServerError();
    return server && server.value === this.branchId() ? server.message : null;
  });

  protected readonly ownerError = computed(() => {
    const server = this.ownerServerError();
    return server && server.value === this.ownerUserId() ? server.message : null;
  });

  constructor() {
    effect(() => {
      const m = this.mode();
      const type = this.partyType();
      const p = this.party();
      const branchCount = this.branches().length;
      const modeOrTypeChanged = this.syncedMode !== m || this.syncedType !== type;
      const partyId = p?.id ?? null;
      const updatedAt = p?.updatedAt ?? null;
      const isNewParty = this.syncedPartyId !== partyId;
      const updatedChanged = this.syncedUpdatedAt !== updatedAt;

      if (modeOrTypeChanged || (m === 'edit' && (isNewParty || (updatedChanged && !this.dirty())))) {
        this.syncedMode = m;
        this.syncedType = type;
        this.syncedPartyId = partyId;
        this.syncedUpdatedAt = updatedAt;
        untracked(() => this.resetFromInputs());
      } else if (m === 'edit' && updatedChanged) {
        this.syncedUpdatedAt = updatedAt;
      } else if (m === 'create' && !this.dirty() && branchCount > 0) {
        untracked(() => {
          const defaultBranch = this.computeDefaultCreateBranch();
          if (this.baselineBranchId() === null && defaultBranch !== null && !isPartyTenantWide(this.session, 'directory.party.manage')) {
            this.baselineBranchId.set(defaultBranch);
            this.branchId.set(defaultBranch);
          }
        });
      }
    });
  }

  protected fieldError(
    field: keyof DetailsTextDraft,
    fieldState: { touched(): boolean; errors(): readonly { kind: string }[] },
    max: number,
  ): string | null {
    this.i18n();
    const server = this.serverFields()[field];
    if (server && server.value === this.textDraft()[field]) return server.message;
    const err = fieldState.touched() || this.submitAttempted() ? fieldState.errors()[0] : undefined;
    if (!err) return null;
    if (err.kind === 'maxLength') {
      return this.transloco.translate('wsPartyModal.validation.maxLength', { max });
    }
    return null;
  }

  protected isContactLtr(type: ContactMethodType): boolean {
    return CONTACT_TYPE_META[type].ltr;
  }

  protected onPersonNameInput(): void {
    this.fieldsServerError.set(null);
    if (this.mode() !== 'create' || this.displayNameEditedByUser) return;
    const d = this.textDraft();
    const composed = composePersonDisplayName(d.honorificTitle, d.firstName, d.lastName).slice(
      0,
      PARTY_LIMITS.displayName,
    );
    this.textDraft.update((current) => ({ ...current, displayName: composed }));
  }

  protected onOrganizationNameInput(): void {
    this.fieldsServerError.set(null);
    if (this.mode() !== 'create' || this.displayNameEditedByUser) return;
    const composed = this.textDraft().organizationName.trim().slice(0, PARTY_LIMITS.displayName);
    this.textDraft.update((current) => ({ ...current, displayName: composed }));
  }

  protected onDisplayNameInput(): void {
    this.displayNameEditedByUser = true;
    this.fieldsServerError.set(null);
  }

  protected onBranchChange(value: string): void {
    this.branchId.set(value || null);
    this.branchServerError.set(null);
  }

  protected onOwnerChange(value: string | null): void {
    this.ownerUserId.set(value);
    this.ownerServerError.set(null);
  }

  protected onStatusChange(value: PartyStatus): void {
    this.status.set(value);
  }

  protected addContactRow(): void {
    if (this.readonly() || this.saving() || this.contactRows().length >= this.maxCreateContacts()) return;
    this.contactRows.update((rows) => [
      ...rows,
      {
        id: ++PartyDetailsTab.nextContactRowId,
        methodType: 'MOBILE',
        value: '',
        label: '',
      },
    ]);
  }

  protected removeContactRow(rowId: number): void {
    if (this.readonly() || this.saving()) return;
    this.contactRows.update((rows) => rows.filter((row) => row.id !== rowId));
    this.contactServerErrors.update((errs) => {
      if (!(rowId in errs)) return errs;
      const next = { ...errs };
      delete next[rowId];
      return next;
    });
  }

  protected updateContactRowType(rowId: number, methodType: ContactMethodType): void {
    this.contactRows.update((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, methodType } : row)),
    );
    this.clearContactRowServerError(rowId);
  }

  protected updateContactRowField(rowId: number, field: 'value' | 'label', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.contactRows.update((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, [field]: val } : row)),
    );
    if (field === 'value') {
      this.clearContactRowServerError(rowId);
    }
  }

  protected async onImagePicked(file: File): Promise<void> {
    const current = this.party();
    if (!current || this.readonly() || this.imageBusy()) return;
    this.imageError.set(null);
    this.uploadingImage.set(true);
    try {
      const updated = await this.api.uploadPartyImage(current.id, file);
      this.brokenImageUrl.set(null);
      this.notify.success(this.transloco.translate('wsPartyModal.image.uploaded'));
      this.imageChanged.emit(updated);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PARTY_IMAGE_REQUIRED' || code === 'PARTY_IMAGE_INVALID' || error instanceof ApiError && [413, 415].includes(error.status)) {
        this.imageError.set(resolvePartyError(error, this.transloco));
        return;
      }
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.deletedRemotely.emit();
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.uploadingImage.set(false);
    }
  }

  protected onImageError(): void {
    this.brokenImageUrl.set(this.imageSrc());
  }

  protected onImageRejected(reason: 'type' | 'size'): void {
    if (reason === 'size') {
      this.imageError.set(this.transloco.translate('wsPartyModal.image.tooLarge'));
    } else {
      this.imageError.set(this.transloco.translate('wsPartyModal.image.invalidType'));
    }
  }

  protected async removeImage(): Promise<void> {
    const current = this.party();
    if (!current || this.readonly() || this.imageBusy() || !this.imageSrc()) return;
    this.removingImage.set(true);
    try {
      await this.api.deletePartyImage(current.id);
      const fresh = await this.api.getParty(current.id).catch(() => ({
        ...current,
        imageUrl: null,
        imageRevision: null,
      }));
      this.notify.success(this.transloco.translate('wsPartyModal.image.removed'));
      this.imageChanged.emit(fresh);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PARTY_IMAGE_NOT_FOUND') {
        this.imageChanged.emit({ ...current, imageUrl: null, imageRevision: null });
        return;
      }
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.deletedRemotely.emit();
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.removingImage.set(false);
    }
  }

  undo(): void {
    this.ownerPicker()?.close();
    this.roleSelect()?.close();
    this.resetFromInputs();
  }

  async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (this.readonly() || this.saving()) return false;
    if (this.mode() === 'edit' && !this.dirty()) return true;

    this.ownerPicker()?.close();
    this.roleSelect()?.close();
    this.submitAttempted.set(true);
    this.clearServerErrors();

    let savedOk = false;

    await submit(this.detailsForm, async () => {
      if (this.mode() === 'create' && Object.keys(this.contactValidationMap()).length > 0) {
        return undefined;
      }

      if (this.mode() === 'create') {
        savedOk = await this.submitCreate();
      } else {
        savedOk = await this.submitUpdate();
      }
      return undefined;
    });

    return savedOk;
  }

  private async submitCreate(): Promise<boolean> {
    const d = this.textDraft();
    const type = this.partyType();
    const branchId = this.branchId();
    const ownerUserId = this.ownerUserId();
    const body: CreatePartyBody = {
      partyType: type,
      displayName: d.displayName.trim(),
      branchId,
    };

    if (type === 'PERSON') {
      const honorific = d.honorificTitle.trim();
      const first = d.firstName.trim();
      const last = d.lastName.trim();
      if (honorific) body.honorificTitle = honorific;
      if (first) body.firstName = first;
      if (last) body.lastName = last;
    } else {
      const orgName = d.organizationName.trim();
      const legalName = d.legalName.trim();
      const tax = d.taxNumber.trim();
      const cr = d.commercialRegistrationNumber.trim();
      if (orgName) body.organizationName = orgName;
      if (legalName) body.legalName = legalName;
      if (tax) body.taxNumber = tax;
      if (cr) body.commercialRegistrationNumber = cr;
    }

    if (ownerUserId) {
      body.ownerUserId = ownerUserId;
    }

    const contacts = this.contactRows();
    if (contacts.length > 0) {
      body.contactMethods = contacts.map((row) => {
        const lbl = row.label.trim();
        return {
          methodType: row.methodType,
          value: row.value.trim(),
          ...(lbl ? { label: lbl } : {}),
        };
      });
    }

    const roles = this.selectedRoles();
    if (roles.length > 0) {
      body.roles = roles.map((roleType) => ({
        roleType,
        ...(branchId ? { branchId } : {}),
      }));
    }

    try {
      const createdParty = await this.api.createParty(body);
      this.notify.success(this.transloco.translate('wsPartyModal.toast.created'));
      this.syncedMode = 'edit';
      this.syncedType = createdParty.partyType;
      this.syncedPartyId = createdParty.id;
      this.syncedUpdatedAt = createdParty.updatedAt;
      this.applyPartyToForm(createdParty);
      this.created.emit(createdParty);
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    }
  }

  private async submitUpdate(): Promise<boolean> {
    const base = this.party();
    if (!base) return false;
    const d = this.textDraft();
    const type = this.partyType();
    const patch: UpdatePartyBody = {};

    const displayName = d.displayName.trim();
    if (displayName !== base.displayName) {
      patch.displayName = displayName;
    }

    if (type === 'PERSON') {
      const honorific = d.honorificTitle.trim();
      const first = d.firstName.trim();
      const last = d.lastName.trim();
      if (honorific !== (base.honorificTitle ?? '')) patch.honorificTitle = honorific;
      if (first !== (base.firstName ?? '')) patch.firstName = first;
      if (last !== (base.lastName ?? '')) patch.lastName = last;
    } else {
      const orgName = d.organizationName.trim();
      const legalName = d.legalName.trim();
      const tax = d.taxNumber.trim();
      const cr = d.commercialRegistrationNumber.trim();
      if (orgName !== (base.organizationName ?? '')) patch.organizationName = orgName;
      if (legalName !== (base.legalName ?? '')) patch.legalName = legalName;
      if (tax !== (base.taxNumber ?? '')) patch.taxNumber = tax;
      if (cr !== (base.commercialRegistrationNumber ?? '')) patch.commercialRegistrationNumber = cr;
    }

    const nextBranch = this.branchId();
    if (nextBranch !== base.branchId) {
      patch.branchId = nextBranch;
    }

    const nextOwner = this.ownerUserId() || null;
    if (nextOwner !== base.ownerUserId) {
      patch.ownerUserId = nextOwner;
    }

    const nextStatus = this.status();
    if (nextStatus !== base.status) {
      patch.status = nextStatus;
    }

    if (Object.keys(patch).length === 0) {
      return true;
    }

    try {
      const updated = await this.api.updateParty(base.id, patch);
      this.notify.success(this.transloco.translate('wsPartyModal.toast.saved'));
      this.syncedMode = 'edit';
      this.syncedType = updated.partyType;
      this.syncedPartyId = updated.id;
      this.syncedUpdatedAt = updated.updatedAt;
      this.applyPartyToForm(updated);
      this.saved.emit(updated);
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.deletedRemotely.emit();
        return false;
      }
      this.handleSaveError(error);
      return false;
    }
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (isValidationError(error)) {
      const fields = fieldErrorsOf(error);
      const message = resolvePartyError(error, this.transloco);
      const textErrors: Record<string, { message: string; value: string }> = {};
      const contactErrors: Record<number, { value?: string; label?: string }> = {};
      for (const field of Object.keys(fields)) {
        if (field in this.textDraft()) textErrors[field] = { message, value: this.textDraft()[field as keyof DetailsTextDraft] };
        else if (field === 'branchId') this.branchServerError.set({ message, value: this.branchId() });
        else if (field === 'ownerUserId') this.ownerServerError.set({ message, value: this.ownerUserId() });
        else if (field.startsWith('roles')) this.roleError.set(message);
        else {
          const match = /^contactMethods\.(\d+)(?:\.|$)/.exec(field);
          const row = match ? this.contactRows()[Number(match[1])] : null;
          if (row) contactErrors[row.id] = { ...contactErrors[row.id], [field.endsWith('.label') ? 'label' : 'value']: message };
          else this.notify.error(message);
        }
      }
      this.serverFields.set(textErrors);
      this.contactServerErrors.set(contactErrors);
      if (!Object.keys(fields).length) this.notify.error(message);
      return;
    }
    if (code === 'PARTY_FIELDS_INVALID') {
      this.fieldsServerError.set({
        message: resolvePartyError(error, this.transloco),
        value: this.textDraft().displayName.trim(),
      });
      return;
    }
    if (code === 'PARTY_ROLE_ALREADY_EXISTS' || code === 'PARTY_ROLE_METADATA_INVALID') {
      this.roleError.set(resolvePartyError(error, this.transloco));
      return;
    }
    if (code === 'PARTY_BRANCH_INVALID') {
      this.branchServerError.set({
        message: resolvePartyError(error, this.transloco),
        value: this.branchId(),
      });
      return;
    }
    if (code === 'PARTY_OWNER_INVALID') {
      this.ownerServerError.set({
        message: resolvePartyError(error, this.transloco),
        value: this.ownerUserId(),
      });
      return;
    }
    if (
      this.mode() === 'create' &&
      (code === 'PARTY_CONTACT_VALUE_INVALID' || code === 'PARTY_DUPLICATE_CONTACT_METHOD')
    ) {
      const rows = this.contactRows();
      if (rows.length > 0) {
        const methodType = error instanceof ApiError ? error.details?.['methodType'] : null;
        const target = rows.find((row) => Array.isArray(methodType) && methodType.includes(row.methodType))
          ?? rows.find((row) => !validateContactValue(row.methodType, row.value)) ?? rows[0];
        const message = code === 'PARTY_DUPLICATE_CONTACT_METHOD'
          ? duplicateContactMessage(target.methodType, this.transloco) : resolvePartyError(error, this.transloco);
        this.contactServerErrors.set({ [target.id]: { value: message } });
        return;
      }
    }
    this.notify.error(resolvePartyError(error, this.transloco));
  }

  private resetFromInputs(): void {
    this.submitAttempted.set(false);
    this.clearServerErrors();
    const current = this.party();
    if (this.mode() === 'edit' && current) {
      this.applyPartyToForm(current);
      return;
    }

    this.displayNameEditedByUser = false;
    const defaultBranch = this.computeDefaultCreateBranch();
    this.baselineBranchId.set(defaultBranch);
    this.branchId.set(defaultBranch);
    this.ownerUserId.set(null);
    this.status.set('ACTIVE');
    this.contactRows.set([]);
    this.selectedRoles.set([]);
    this.detailsForm().reset({ ...EMPTY_TEXT_DRAFT });
  }

  private applyPartyToForm(p: PartyDetail): void {
    this.submitAttempted.set(false);
    this.clearServerErrors();
    this.displayNameEditedByUser = true;
    this.baselineBranchId.set(p.branchId);
    this.branchId.set(p.branchId);
    this.ownerUserId.set(p.ownerUserId);
    this.status.set(p.status);
    this.contactRows.set([]);
    this.selectedRoles.set([]);
    this.detailsForm().reset({
      displayName: p.displayName,
      honorificTitle: p.honorificTitle ?? '',
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      organizationName: p.organizationName ?? '',
      legalName: p.legalName ?? '',
      taxNumber: p.taxNumber ?? '',
      commercialRegistrationNumber: p.commercialRegistrationNumber ?? '',
    });
  }

  private computeDefaultCreateBranch(): string | null {
    if (isPartyTenantWide(this.session, 'directory.party.manage')) {
      return null;
    }
    const activePermitted = this.branches().filter(
      (b) => b.status === 'ACTIVE' && canOnPartyBranch(this.session, 'directory.party.manage', b.id),
    );
    const scopeBranchId = this.session.selection()?.branchId;
    if (scopeBranchId && activePermitted.some((b) => b.id === scopeBranchId)) {
      return scopeBranchId;
    }
    return activePermitted[0]?.id ?? null;
  }

  private clearServerErrors(): void {
    this.serverFields.set({});
    this.roleError.set(null);
    this.fieldsServerError.set(null);
    this.branchServerError.set(null);
    this.ownerServerError.set(null);
    this.contactServerErrors.set({});
  }

  private clearContactRowServerError(rowId: number): void {
    this.contactServerErrors.update((errs) => {
      if (!(rowId in errs)) return errs;
      const next = { ...errs };
      delete next[rowId];
      return next;
    });
  }
}
