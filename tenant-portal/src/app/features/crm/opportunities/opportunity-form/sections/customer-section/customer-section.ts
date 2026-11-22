import { Component, computed, inject, input, model, signal } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExternalLink } from '@ng-icons/tabler-icons';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../../shared/widgets/phone-list/phone-list';
import type { CustomerOption, OpportunityRow } from '../../../opportunities.model';
import { CustomerPicker } from '../../customer-picker/customer-picker';
import { DraftErrors, OpportunityDraft, resolveOpportunityError } from '../../opportunity-draft';
import { LookupRetry } from '../../lookup-retry/lookup-retry';
import { OpportunityLookups } from '../../opportunity-lookups';

interface ContactCardView {
  displayName: string;
  jobTitle: string | null;
  phones: string[];
  email: string | null;
}

@Component({
  selector: 'app-opp-customer-section',
  imports: [RouterLink, NgIcon, TranslocoPipe, Dropdown, Field, PhoneList, CustomerPicker, LookupRetry],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-form', alias: 'oppForm' }),
    provideIcons({ tablerExternalLink }),
  ],
  templateUrl: './customer-section.html',
  host: { class: 'block min-w-0' },
})
export class CustomerSection {
  private static nextId = 0;
  protected readonly uid = `opp-customer-${++CustomerSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lookups = inject(OpportunityLookups);

  readonly draft = model.required<OpportunityDraft>();
  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly row = input<OpportunityRow | null>(null);

  protected readonly pageGrid = RECORD_PAGE_GRID;
  protected readonly emptyCountries: GeoCountry[] = [];
  protected readonly pickedCustomer = signal<CustomerOption | null>(null);

  protected readonly canPickCustomer = computed(() => this.mode() === 'create' && !this.readonly());

  protected readonly customerDisplayName = computed(() => {
    const label = this.draft().customerLabel.trim();
    if (label) return label;
    return this.row()?.customerDisplayName?.trim() ?? '';
  });

  protected readonly selectedCustomerOption = computed<CustomerOption | null>(() => {
    const picked = this.pickedCustomer();
    const id = this.draft().customerProfileId;
    return picked && id && picked.id === id ? picked : null;
  });

  protected readonly isIndividualCustomer = computed(() => {
    const picked = this.selectedCustomerOption();
    if (picked) return picked.profileType === 'INDIVIDUAL';
    const r = this.row();
    if (r && r.customerProfileId === this.draft().customerProfileId) {
      return r.customerProfileType === 'INDIVIDUAL';
    }
    return this.lookups.contacts().some((c) => c.isCustomerParty);
  });

  private readonly individualPartyId = computed(() => {
    const picked = this.selectedCustomerOption();
    if (picked?.profileType === 'INDIVIDUAL') return picked.partyId;
    const customerContact = this.lookups.contacts().find((c) => c.isCustomerParty);
    if (customerContact) return customerContact.partyId;
    const r = this.row();
    if (r && r.customerProfileType === 'INDIVIDUAL' && r.customerProfileId === this.draft().customerProfileId) {
      return r.customerPartyId;
    }
    return this.draft().contactPartyId;
  });

  protected readonly customerError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['customerProfileId'], this.transloco);
  });

  protected readonly contactError = computed(() => {
    this.i18n();
    return resolveOpportunityError(this.errors()['contactPartyId'], this.transloco);
  });

  protected readonly contactsPending = computed(
    () => !!this.draft().customerProfileId && !this.isIndividualCustomer() && this.lookups.contactsLoading(),
  );

  protected readonly showContactsRetry = computed(
    () =>
      !this.readonly() && !!this.draft().customerProfileId && !this.isIndividualCustomer() && this.lookups.contactsFailed(),
  );

  protected readonly contactDisabled = computed(
    () => this.readonly() || !this.draft().customerProfileId || this.contactsPending(),
  );

  protected readonly contactOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    if (!this.draft().customerProfileId) {
      return [{ value: '', label: this.transloco.translate('oppForm.customer.contactNone') }];
    }

    if (this.isIndividualCustomer()) {
      const partyId = this.individualPartyId() ?? '__customer__';
      return [{ value: partyId, label: this.transloco.translate('oppForm.customer.theCustomer') }];
    }

    if (this.contactsPending()) {
      return [
        { value: this.draft().contactPartyId ?? '', label: this.transloco.translate('oppForm.customer.contactsLoading') },
      ];
    }

    const items = this.lookups.contacts().map((contact) => ({
      value: contact.partyId,
      label: contact.jobTitle ? `${contact.displayName} — ${contact.jobTitle}` : contact.displayName,
    }));

    const currentId = this.draft().contactPartyId;
    const rowContact = this.row()?.primaryContact;
    if (currentId && !items.some((opt) => opt.value === currentId) && rowContact && rowContact.partyId === currentId) {
      items.unshift({
        value: rowContact.partyId,
        label: rowContact.jobTitle ? `${rowContact.displayName} — ${rowContact.jobTitle}` : rowContact.displayName,
      });
    }

    return [{ value: '', label: this.transloco.translate('oppForm.customer.contactNone') }, ...items];
  });

  protected readonly contactDropdownValue = computed(() => {
    if (!this.draft().customerProfileId) return '';
    if (this.isIndividualCustomer()) {
      return this.draft().contactPartyId || this.individualPartyId() || '__customer__';
    }
    return this.draft().contactPartyId ?? '';
  });

  protected readonly readonlyContactLabel = computed(() => {
    this.i18n();
    const val = this.contactDropdownValue();
    return this.contactOptions().find((opt) => opt.value === val)?.label ?? this.transloco.translate('oppForm.customer.contactNone');
  });

  protected readonly resolvedReadContact = computed<ContactCardView | null>(() => {
    const customerId = this.draft().customerProfileId;
    if (!customerId) return null;

    const contacts = this.lookups.contacts();
    const chosenId = this.draft().contactPartyId;

    if (chosenId) {
      const exact = contacts.find((c) => c.partyId === chosenId);
      if (exact) {
        return {
          displayName: exact.displayName,
          jobTitle: exact.jobTitle,
          phones: [...exact.phones],
          email: exact.email,
        };
      }
    }

    if (this.isIndividualCustomer()) {
      const customerParty = contacts.find((c) => c.isCustomerParty);
      if (customerParty) {
        return {
          displayName: customerParty.displayName,
          jobTitle: customerParty.jobTitle,
          phones: [...customerParty.phones],
          email: customerParty.email,
        };
      }
      const picked = this.selectedCustomerOption();
      if (picked) {
        return {
          displayName: picked.displayName,
          jobTitle: null,
          phones: picked.phone ? [picked.phone] : [],
          email: picked.email,
        };
      }
    }

    if (!chosenId) {
      const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
      if (primary) {
        return {
          displayName: primary.displayName,
          jobTitle: primary.jobTitle,
          phones: [...primary.phones],
          email: primary.email,
        };
      }
    }

    const r = this.row();
    if (r && r.customerProfileId === customerId && r.primaryContact) {
      return {
        displayName: r.primaryContact.displayName,
        jobTitle: r.primaryContact.jobTitle,
        phones: [...r.primaryContact.phones],
        email: r.primaryContact.email,
      };
    }

    return null;
  });

  protected readonly phoneSource = computed<PhoneActionSource | null>(() => {
    const r = this.row();
    if (this.mode() === 'create' || !r) return null;
    const label = this.draft().title.trim() || r.title;
    return { type: 'OPPORTUNITY', id: r.id, label };
  });

  protected fieldDescribedBy(controlId: string, hasError: boolean): string {
    return hasError ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected onCustomerChange(option: CustomerOption | null): void {
    if (!this.canPickCustomer()) return;
    this.pickedCustomer.set(option);
    this.lookups.setCustomerProfile(option?.id ?? null);
    this.draft.update((current) => ({
      ...current,
      customerProfileId: option?.id ?? null,
      customerLabel: option?.displayName ?? '',
      customerStatus: option?.status ?? null,
      contactPartyId: option?.profileType === 'INDIVIDUAL' ? option.partyId : null,
    }));
  }

  protected onContactChange(value: string): void {
    if (this.contactDisabled()) return;
    if (this.isIndividualCustomer()) {
      const partyId = this.individualPartyId();
      this.draft.update((current) => ({
        ...current,
        contactPartyId: partyId ?? (value === '__customer__' ? null : value || null),
      }));
      return;
    }
    this.draft.update((current) => ({
      ...current,
      contactPartyId: value || null,
    }));
  }
}
