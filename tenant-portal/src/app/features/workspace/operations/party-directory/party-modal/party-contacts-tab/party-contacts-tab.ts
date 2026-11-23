import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, maxLengthError, requiredError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAddressBook,
  tablerBrandWhatsapp,
  tablerCheck,
  tablerMail,
  tablerMessage,
  tablerPencil,
  tablerPhone,
  tablerPlus,
  tablerStar,
  tablerTrash,
  tablerWorld,
  tablerX,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { UnsavedDialog } from '../../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { PhoneActionSource, PhoneActions } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../../core/api/api-errors';
import { PartyDirectoryApi } from '../../party-directory.api';
import {
  ContactMethodType,
  CreateContactMethodBody,
  PartyContactMethod,
  PartyDetail,
  UpdateContactMethodBody,
} from '../../party-directory.model';
import {
  duplicateContactMessage,
  CONTACT_METHOD_TYPES,
  CONTACT_TYPE_META,
  EditableModalTab,
  PARTY_LIMITS,
  resolvePartyError,
  safeWebsiteHref,
  validateContactValue,
} from '../party-modal.util';

interface ContactDraft {
  value: string;
  label: string;
}

interface ContactSnapshot extends ContactDraft {
  methodType: ContactMethodType;
  isPrimary: boolean;
}

const EMPTY_DRAFT: ContactDraft = { value: '', label: '' };

@Component({
  selector: 'app-party-contacts-tab',
  imports: [
    FormField,
    NgIcon,
    NgTemplateOutlet,
    TranslocoPipe,
    Button,
    Checkbox,
    ConfirmDialog,
    Dropdown,
    Field,
    PhoneActions,
    UnsavedDialog,
  ],
  providers: [
    provideIcons({
      tablerAddressBook,
      tablerBrandWhatsapp,
      tablerCheck,
      tablerMail,
      tablerMessage,
      tablerPencil,
      tablerPhone,
      tablerPlus,
      tablerStar,
      tablerStarFill,
      tablerTrash,
      tablerWorld,
      tablerX,
    }),
  ],
  templateUrl: './party-contacts-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
})
export class PartyContactsTab implements EditableModalTab {
  private static nextId = 0;
  protected readonly uid = `party-contacts-tab-${++PartyContactsTab.nextId}`;

  private readonly api = inject(PartyDirectoryApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');

  readonly party = input.required<PartyDetail>();
  readonly maxContacts = input<number | null>(null);
  readonly readonly = input(false);

  readonly partyUpdated = output<PartyDetail>();
  readonly deletedRemotely = output<void>();

  protected readonly limits = PARTY_LIMITS;
  protected readonly typeMeta = CONTACT_TYPE_META;
  protected readonly safeWebsiteHref = safeWebsiteHref;

  protected readonly editingKey = signal<string | null>(null);
  private readonly draft = signal<ContactDraft>({ ...EMPTY_DRAFT });
  protected readonly methodType = signal<ContactMethodType>('MOBILE');
  protected readonly isPrimary = signal(false);
  private readonly snapshot = signal<ContactSnapshot>({
    methodType: 'MOBILE',
    value: '',
    label: '',
    isPrimary: false,
  });

  protected readonly submitAttempted = signal(false);
  protected readonly busyRowId = signal<string | null>(null);
  protected readonly deletingValue = signal('');
  protected readonly labelServerError = signal<string | null>(null);
  private readonly valueServerError = signal<{ message: string; value: string; type: ContactMethodType } | null>(
    null,
  );
  private confirmingUnsaved = false;
  private syncedPartyId: string | null = null;

  protected readonly contactForm = form(this.draft, (path) => {
    validate(path.value, ({ value }) => {
      const trimmed = value().trim();
      if (!trimmed) return requiredError();
      if (Array.from(trimmed).length > PARTY_LIMITS.contactValue) {
        return maxLengthError(PARTY_LIMITS.contactValue);
      }
      if (!validateContactValue(this.methodType(), trimmed)) {
        return { kind: 'contactValue' };
      }
      return undefined;
    });
    validate(path.label, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.contactLabel
        ? maxLengthError(PARTY_LIMITS.contactLabel)
        : undefined,
    );
  });

  readonly saving = computed(() => this.contactForm().submitting() || this.busyRowId() !== null);

  readonly dirty = computed(() => {
    if (this.readonly() || this.editingKey() === null) return false;
    const d = this.draft();
    const s = this.snapshot();
    return (
      this.methodType() !== s.methodType ||
      d.value.trim() !== s.value.trim() ||
      d.label.trim() !== s.label.trim() ||
      this.isPrimary() !== s.isPrimary
    );
  });

  protected readonly contacts = computed(() => this.party().contactMethods);
  protected readonly atLimit = computed(() => this.maxContacts() !== null && this.contacts().length >= this.maxContacts()!);

  protected readonly phoneSource = computed<PhoneActionSource>(() => ({
    type: 'PARTY',
    id: this.party().id,
    label: this.party().displayName,
  }));

  protected readonly typeOptions = computed<DropdownOption<ContactMethodType>[]>(() => {
    this.i18n();
    return CONTACT_METHOD_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`wsParty.contactTypes.${type}`),
    }));
  });

  protected readonly valueError = computed(() => {
    this.i18n();
    const server = this.valueServerError();
    if (
      server &&
      server.value === this.draft().value.trim() &&
      server.type === this.methodType()
    ) {
      return server.message;
    }
    const state = this.contactForm.value();
    const err = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!err) return null;
    if (err.kind === 'required') return this.transloco.translate('wsPartyModal.validation.required');
    if (err.kind === 'maxLength') {
      return this.transloco.translate('wsPartyModal.validation.maxLength', {
        max: PARTY_LIMITS.contactValue,
      });
    }
    if (err.kind === 'contactValue') {
      return this.transloco.translate('wsPartyModal.validation.contactValueInvalid');
    }
    return null;
  });

  protected readonly labelError = computed(() => {
    if (this.labelServerError()) return this.labelServerError();
    this.i18n();
    const state = this.contactForm.label();
    const err = state.touched() || this.submitAttempted() ? state.errors()[0] : undefined;
    if (!err) return null;
    if (err.kind === 'maxLength') {
      return this.transloco.translate('wsPartyModal.validation.maxLength', {
        max: PARTY_LIMITS.contactLabel,
      });
    }
    return null;
  });

  constructor() {
    effect(() => {
      const id = this.party().id;
      if (id !== this.syncedPartyId) {
        this.syncedPartyId = id;
        untracked(() => this.resetEditState());
      }
    });
  }

  protected isLtr(type: ContactMethodType): boolean {
    return CONTACT_TYPE_META[type].ltr;
  }

  protected onMethodTypeChange(next: ContactMethodType): void {
    this.methodType.set(next);
    this.valueServerError.set(null);
  }

  protected async startAdd(): Promise<void> {
    if (this.readonly() || this.saving() || this.atLimit() || this.editingKey() === 'new') return;
    if (!(await this.resolveActiveEdit())) return;

    this.submitAttempted.set(false);
    this.valueServerError.set(null);
    const snap: ContactSnapshot = { methodType: 'MOBILE', value: '', label: '', isPrimary: false };
    this.snapshot.set(snap);
    this.methodType.set(snap.methodType);
    this.isPrimary.set(snap.isPrimary);
    this.contactForm().reset({ value: '', label: '' });
    this.editingKey.set('new');
  }

  protected async startEdit(item: PartyContactMethod): Promise<void> {
    if (this.readonly() || this.saving() || this.editingKey() === item.id) return;
    if (!(await this.resolveActiveEdit())) return;

    this.submitAttempted.set(false);
    this.valueServerError.set(null);
    const snap: ContactSnapshot = {
      methodType: item.methodType,
      value: item.value,
      label: item.label ?? '',
      isPrimary: item.isPrimary,
    };
    this.snapshot.set(snap);
    this.methodType.set(snap.methodType);
    this.isPrimary.set(snap.isPrimary);
    this.contactForm().reset({ value: snap.value, label: snap.label });
    this.editingKey.set(item.id);
  }

  protected cancelEdit(): void {
    if (this.saving()) return;
    this.resetEditState();
  }

  undo(): void {
    this.resetEditState();
  }

  async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    const key = this.editingKey();
    if (this.readonly() || this.contactForm().submitting() || key === null) return false;

    this.labelServerError.set(null);
    this.submitAttempted.set(true);
    this.valueServerError.set(null);
    const trimmedVal = this.draft().value.trim();
    const trimmedLabel = this.draft().label.trim();
    const type = this.methodType();
    const primary = this.isPrimary();

    let ok = false;
    await submit(this.contactForm, async () => {
      try {
        if (key === 'new') {
          const body: CreateContactMethodBody = {
            methodType: type,
            value: trimmedVal,
            ...(trimmedLabel ? { label: trimmedLabel } : {}),
            ...(primary ? { isPrimary: true } : {}),
          };
          await this.api.addContactMethod(this.party().id, body);
          this.notify.success(this.transloco.translate('wsPartyModal.contacts.added'));
        } else {
          const existing = this.contacts().find((c) => c.id === key);
          if (!existing) return undefined;
          const patch: UpdateContactMethodBody = {};
          if (type !== existing.methodType) patch.methodType = type;
          if (trimmedVal !== existing.value) patch.value = trimmedVal;
          if (trimmedLabel !== (existing.label ?? '')) patch.label = trimmedLabel;
          if (primary !== existing.isPrimary) patch.isPrimary = primary;
          if (Object.keys(patch).length > 0) {
            await this.api.updateContactMethod(existing.id, patch);
            this.notify.success(this.transloco.translate('wsPartyModal.contacts.saved'));
          }
        }
        await this.reloadParty();
        this.resetEditState();
        ok = true;
      } catch (error) {
        this.handleMutationError(error, trimmedVal, type);
      }
      return undefined;
    });

    return ok;
  }

  protected async makePrimary(item: PartyContactMethod): Promise<void> {
    if (this.readonly() || this.saving() || item.isPrimary) return;
    if (!(await this.resolveActiveEdit())) return;

    this.busyRowId.set(item.id);
    try {
      await this.api.updateContactMethod(item.id, { isPrimary: true });
      await this.reloadParty();
      this.notify.success(this.transloco.translate('wsPartyModal.contacts.primaryUpdated'));
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.busyRowId.set(null);
    }
  }

  protected async remove(item: PartyContactMethod): Promise<void> {
    if (this.readonly() || this.saving()) return;
    this.deletingValue.set(item.value);
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) return;

    this.busyRowId.set(item.id);
    try {
      await this.api.deleteContactMethod(item.id);
      if (this.editingKey() === item.id) {
        this.resetEditState();
      }
      await this.reloadParty();
      this.notify.success(this.transloco.translate('wsPartyModal.contacts.deleted'));
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.busyRowId.set(null);
    }
  }

  private async reloadParty(): Promise<void> {
    const fresh = await this.api.getParty(this.party().id);
    this.partyUpdated.emit(fresh);
  }

  private handleMutationError(error: unknown, value = '', type: ContactMethodType = 'MOBILE'): void {
    const code = errorCodeOf(error);
    if (isValidationError(error)) {
      const fields = fieldErrorsOf(error);
      const message = resolvePartyError(error, this.transloco);
      if (fields['label']) this.labelServerError.set(message);
      if (fields['value'] || fields['methodType']) this.valueServerError.set({ message, value, type });
      if (!fields['label'] && !fields['value'] && !fields['methodType']) this.notify.error(message);
      return;
    }
    if (code === 'PARTY_CONTACT_VALUE_INVALID') {
      this.valueServerError.set({
        message: resolvePartyError(error, this.transloco),
        value,
        type,
      });
      return;
    }
    if (code === 'PARTY_DUPLICATE_CONTACT_METHOD') {
      this.valueServerError.set({
        message: duplicateContactMessage(type, this.transloco),
        value,
        type,
      });
      return;
    }
    if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404 && !code?.includes('CONTACT_METHOD'))) {
      this.notify.error(resolvePartyError(error, this.transloco));
      this.deletedRemotely.emit();
      return;
    }
    this.notify.error(resolvePartyError(error, this.transloco));
    if (code === 'PARTY_CONTACT_METHOD_NOT_FOUND') {
      this.resetEditState();
      void this.reloadParty().catch((failure) => this.notify.error(resolvePartyError(failure, this.transloco, 'read')));
    }
  }

  private async resolveActiveEdit(): Promise<boolean> {
    if (!this.dirty()) {
      this.resetEditState();
      return true;
    }
    if (this.confirmingUnsaved) return false;
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.resetEditState();
        return true;
      }
      return await this.save();
    } finally {
      this.confirmingUnsaved = false;
    }
  }

  private resetEditState(): void {
    this.labelServerError.set(null);
    this.editingKey.set(null);
    this.submitAttempted.set(false);
    this.valueServerError.set(null);
    this.methodType.set('MOBILE');
    this.isPrimary.set(false);
    this.snapshot.set({ methodType: 'MOBILE', value: '', label: '', isPrimary: false });
    this.contactForm().reset({ ...EMPTY_DRAFT });
  }
}
