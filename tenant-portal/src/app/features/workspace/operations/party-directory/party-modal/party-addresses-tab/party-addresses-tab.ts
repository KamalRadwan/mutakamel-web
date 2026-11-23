import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, maxLengthError, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerMapPin,
  tablerPencil,
  tablerPlus,
  tablerStar,
  tablerTrash,
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
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../../core/api/api-errors';
import { PartyDirectoryApi } from '../../party-directory.api';
import {
  AddressType,
  CreateAddressBody,
  PartyAddress,
  PartyDetail,
  UpdateAddressBody,
} from '../../party-directory.model';
import {
  ADDRESS_TYPES,
  EditableModalTab,
  PARTY_LIMITS,
  formatAddressOneLine,
  resolvePartyError,
} from '../party-modal.util';

interface AddressTextDraft {
  label: string;
  country: string;
  city: string;
  area: string;
  street: string;
  buildingNo: string;
  floor: string;
  apartment: string;
  landmark: string;
  postalCode: string;
}

interface AddressSnapshot extends AddressTextDraft {
  addressType: AddressType;
  isPrimary: boolean;
}

const EMPTY_TEXT_DRAFT: AddressTextDraft = {
  label: '',
  country: '',
  city: '',
  area: '',
  street: '',
  buildingNo: '',
  floor: '',
  apartment: '',
  landmark: '',
  postalCode: '',
};

@Component({
  selector: 'app-party-addresses-tab',
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
    UnsavedDialog,
  ],
  providers: [
    provideIcons({
      tablerCheck,
      tablerMapPin,
      tablerPencil,
      tablerPlus,
      tablerStar,
      tablerStarFill,
      tablerTrash,
      tablerX,
    }),
  ],
  templateUrl: './party-addresses-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
})
export class PartyAddressesTab implements EditableModalTab {
  private static nextId = 0;
  protected readonly uid = `party-addresses-tab-${++PartyAddressesTab.nextId}`;

  private readonly api = inject(PartyDirectoryApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');

  readonly party = input.required<PartyDetail>();
  readonly maxAddresses = input<number | null>(null);
  readonly readonly = input(false);

  readonly partyUpdated = output<PartyDetail>();
  readonly deletedRemotely = output<void>();

  protected readonly limits = PARTY_LIMITS;
  protected readonly formatOneLine = formatAddressOneLine;

  protected readonly editingKey = signal<string | null>(null);
  private readonly draft = signal<AddressTextDraft>({ ...EMPTY_TEXT_DRAFT });
  protected readonly addressType = signal<AddressType>('WORK');
  protected readonly isPrimary = signal(false);
  private readonly snapshot = signal<AddressSnapshot>({
    ...EMPTY_TEXT_DRAFT,
    addressType: 'WORK',
    isPrimary: false,
  });

  private readonly serverFields = signal<Record<string, string>>({});
  protected readonly submitAttempted = signal(false);
  protected readonly busyRowId = signal<string | null>(null);
  private confirmingUnsaved = false;
  private syncedPartyId: string | null = null;

  protected readonly addressForm = form(this.draft, (path) => {
    validate(path.label, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.addressLabel
        ? maxLengthError(PARTY_LIMITS.addressLabel)
        : undefined,
    );
    validate(path.country, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.country
        ? maxLengthError(PARTY_LIMITS.country)
        : undefined,
    );
    validate(path.city, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.city
        ? maxLengthError(PARTY_LIMITS.city)
        : undefined,
    );
    validate(path.area, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.area
        ? maxLengthError(PARTY_LIMITS.area)
        : undefined,
    );
    validate(path.street, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.street
        ? maxLengthError(PARTY_LIMITS.street)
        : undefined,
    );
    validate(path.buildingNo, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.buildingNo
        ? maxLengthError(PARTY_LIMITS.buildingNo)
        : undefined,
    );
    validate(path.floor, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.floor
        ? maxLengthError(PARTY_LIMITS.floor)
        : undefined,
    );
    validate(path.apartment, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.apartment
        ? maxLengthError(PARTY_LIMITS.apartment)
        : undefined,
    );
    validate(path.landmark, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.landmark
        ? maxLengthError(PARTY_LIMITS.landmark)
        : undefined,
    );
    validate(path.postalCode, ({ value }) =>
      Array.from(value().trim()).length > PARTY_LIMITS.postalCode
        ? maxLengthError(PARTY_LIMITS.postalCode)
        : undefined,
    );
  });

  readonly saving = computed(() => this.addressForm().submitting() || this.busyRowId() !== null);

  readonly dirty = computed(() => {
    if (this.readonly() || this.editingKey() === null) return false;
    const d = this.draft();
    const s = this.snapshot();
    return (
      this.addressType() !== s.addressType ||
      this.isPrimary() !== s.isPrimary ||
      d.label.trim() !== s.label.trim() ||
      d.country.trim() !== s.country.trim() ||
      d.city.trim() !== s.city.trim() ||
      d.area.trim() !== s.area.trim() ||
      d.street.trim() !== s.street.trim() ||
      d.buildingNo.trim() !== s.buildingNo.trim() ||
      d.floor.trim() !== s.floor.trim() ||
      d.apartment.trim() !== s.apartment.trim() ||
      d.landmark.trim() !== s.landmark.trim() ||
      d.postalCode.trim() !== s.postalCode.trim()
    );
  });

  protected readonly addresses = computed(() => this.party().addresses);
  protected readonly atLimit = computed(() => this.maxAddresses() !== null && this.addresses().length >= this.maxAddresses()!);

  protected readonly typeOptions = computed<DropdownOption<AddressType>[]>(() => {
    this.i18n();
    return ADDRESS_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`wsParty.addressTypes.${type}`),
    }));
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

  protected maxErr(
    field: string,
    fieldState: { touched(): boolean; errors(): readonly { kind: string }[] },
    max: number,
  ): string | null {
    this.i18n();
    if (this.serverFields()[field]) return this.serverFields()[field];
    const err = fieldState.touched() || this.submitAttempted() ? fieldState.errors()[0] : undefined;
    if (!err) return null;
    if (err.kind === 'maxLength') {
      return this.transloco.translate('wsPartyModal.validation.maxLength', { max });
    }
    return null;
  }

  protected async startAdd(): Promise<void> {
    if (this.readonly() || this.saving() || this.atLimit() || this.editingKey() === 'new') return;
    if (!(await this.resolveActiveEdit())) return;

    this.submitAttempted.set(false);
    this.snapshot.set({ ...EMPTY_TEXT_DRAFT, addressType: 'WORK', isPrimary: false });
    this.addressType.set('WORK');
    this.isPrimary.set(false);
    this.addressForm().reset({ ...EMPTY_TEXT_DRAFT });
    this.editingKey.set('new');
  }

  protected async startEdit(item: PartyAddress): Promise<void> {
    if (this.readonly() || this.saving() || this.editingKey() === item.id) return;
    if (!(await this.resolveActiveEdit())) return;

    this.submitAttempted.set(false);
    const text: AddressTextDraft = {
      label: item.label ?? '',
      country: item.country ?? '',
      city: item.city ?? '',
      area: item.area ?? '',
      street: item.street ?? '',
      buildingNo: item.buildingNo ?? '',
      floor: item.floor ?? '',
      apartment: item.apartment ?? '',
      landmark: item.landmark ?? '',
      postalCode: item.postalCode ?? '',
    };
    this.snapshot.set({ ...text, addressType: item.addressType, isPrimary: item.isPrimary });
    this.addressType.set(item.addressType);
    this.isPrimary.set(item.isPrimary);
    this.addressForm().reset(text);
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
    if (this.readonly() || this.addressForm().submitting() || key === null) return false;

    this.serverFields.set({});
    this.submitAttempted.set(true);
    let ok = false;

    await submit(this.addressForm, async () => {
      const d = this.draft();
      const type = this.addressType();
      const primary = this.isPrimary();

      try {
        if (key === 'new') {
          const body: CreateAddressBody = {
            addressType: type,
            ...(d.label.trim() ? { label: d.label.trim() } : {}),
            ...(d.country.trim() ? { country: d.country.trim() } : {}),
            ...(d.city.trim() ? { city: d.city.trim() } : {}),
            ...(d.area.trim() ? { area: d.area.trim() } : {}),
            ...(d.street.trim() ? { street: d.street.trim() } : {}),
            ...(d.buildingNo.trim() ? { buildingNo: d.buildingNo.trim() } : {}),
            ...(d.floor.trim() ? { floor: d.floor.trim() } : {}),
            ...(d.apartment.trim() ? { apartment: d.apartment.trim() } : {}),
            ...(d.landmark.trim() ? { landmark: d.landmark.trim() } : {}),
            ...(d.postalCode.trim() ? { postalCode: d.postalCode.trim() } : {}),
            ...(primary ? { isPrimary: true } : {}),
          };
          await this.api.addAddress(this.party().id, body);
          this.notify.success(this.transloco.translate('wsPartyModal.addresses.added'));
        } else {
          const existing = this.addresses().find((a) => a.id === key);
          if (!existing) return undefined;
          const patch: UpdateAddressBody = {};
          if (type !== existing.addressType) patch.addressType = type;
          if (primary !== existing.isPrimary) patch.isPrimary = primary;
          if (d.label.trim() !== (existing.label ?? '')) patch.label = d.label.trim();
          if (d.country.trim() !== (existing.country ?? '')) patch.country = d.country.trim();
          if (d.city.trim() !== (existing.city ?? '')) patch.city = d.city.trim();
          if (d.area.trim() !== (existing.area ?? '')) patch.area = d.area.trim();
          if (d.street.trim() !== (existing.street ?? '')) patch.street = d.street.trim();
          if (d.buildingNo.trim() !== (existing.buildingNo ?? '')) patch.buildingNo = d.buildingNo.trim();
          if (d.floor.trim() !== (existing.floor ?? '')) patch.floor = d.floor.trim();
          if (d.apartment.trim() !== (existing.apartment ?? '')) patch.apartment = d.apartment.trim();
          if (d.landmark.trim() !== (existing.landmark ?? '')) patch.landmark = d.landmark.trim();
          if (d.postalCode.trim() !== (existing.postalCode ?? '')) patch.postalCode = d.postalCode.trim();

          if (Object.keys(patch).length > 0) {
            await this.api.updateAddress(existing.id, patch);
            this.notify.success(this.transloco.translate('wsPartyModal.addresses.saved'));
          }
        }
        await this.reloadParty();
        this.resetEditState();
        ok = true;
      } catch (error) {
        this.handleMutationError(error);
      }
      return undefined;
    });

    return ok;
  }

  protected async makePrimary(item: PartyAddress): Promise<void> {
    if (this.readonly() || this.saving() || item.isPrimary) return;
    if (!(await this.resolveActiveEdit())) return;

    this.busyRowId.set(item.id);
    try {
      await this.api.updateAddress(item.id, { isPrimary: true });
      await this.reloadParty();
      this.notify.success(this.transloco.translate('wsPartyModal.addresses.primaryUpdated'));
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.busyRowId.set(null);
    }
  }

  protected async remove(item: PartyAddress): Promise<void> {
    if (this.readonly() || this.saving()) return;
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) return;

    this.busyRowId.set(item.id);
    try {
      await this.api.deleteAddress(item.id);
      if (this.editingKey() === item.id) {
        this.resetEditState();
      }
      await this.reloadParty();
      this.notify.success(this.transloco.translate('wsPartyModal.addresses.deleted'));
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

  private handleMutationError(error: unknown): void {
    const code = errorCodeOf(error);
    if (isValidationError(error) || code === 'PARTY_ADDRESS_GEO_INVALID' || code === 'PARTY_ADDRESS_GEO_INCOMPLETE') {
      const fields = Object.keys(fieldErrorsOf(error));
      const message = resolvePartyError(error, this.transloco);
      this.serverFields.set(Object.fromEntries((fields.length ? fields : ['country', 'city', 'area']).map((field) => {
        const visible = ({ countryId: 'country', stateId: 'country', cityId: 'city', districtId: 'area' } as Record<string, string>)[field] ?? field;
        return [visible, message];
      })));
      return;
    }
    if (code === 'PARTY_NOT_FOUND'  || (error instanceof ApiError && error.status === 404 && !code?.includes('ADDRESS'))) {
      this.notify.error(resolvePartyError(error, this.transloco));
      this.deletedRemotely.emit();
      return;
    }
    this.notify.error(resolvePartyError(error, this.transloco));
    if (code === 'PARTY_ADDRESS_NOT_FOUND') {
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
    this.serverFields.set({});
    this.editingKey.set(null);
    this.submitAttempted.set(false);
    this.addressType.set('WORK');
    this.isPrimary.set(false);
    this.snapshot.set({ ...EMPTY_TEXT_DRAFT, addressType: 'WORK', isPrimary: false });
    this.addressForm().reset({ ...EMPTY_TEXT_DRAFT });
  }
}
