import { Component, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { toAsciiDigits, phoneDigits } from '../../../../../../shared/ui/phone-input/phone';
import { RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { RecordContacts } from '../../../../shared/record/contacts/record-contacts';
import {
  CompanyContactOption,
  ContactChange,
  ContactErrors,
  ContactLimits,
} from '../../../../shared/record/record-contact';
import { errorCodeOf } from '../../../../settings/shared/settings-api';
import { listCompanyContacts } from '../../../leads.api';
import { validationPaths } from '../../../leads.model';
import {
  ContactDraft,
  CreateLeadContactBody,
  DraftErrors,
  LEAD_LIMITS,
  LeadDraft,
  validateDraft,
} from '../../lead-draft';

const PHONE_CHARS_RE = /^[+\d\s().-]+$/;

function cloneContact(contact: ContactDraft): ContactDraft {
  return { ...contact, phones: [...contact.phones] };
}

function cleanPhoneValues(phones: readonly string[]): string[] {
  return phones.map((p) => p.trim()).filter((p) => p.length > 0);
}

function findInvalidPhoneIndex(phones: readonly string[]): number {
  for (let i = 0; i < phones.length; i++) {
    const trimmed = phones[i].trim();
    if (!trimmed) continue;
    const ascii = toAsciiDigits(trimmed);
    if (trimmed.length > LEAD_LIMITS.phoneMax || !PHONE_CHARS_RE.test(ascii) || phoneDigits(ascii) < 5) {
      return i;
    }
  }
  return 0;
}

function findTooLongPhoneIndex(phones: readonly string[]): number {
  const idx = phones.findIndex((p) => p.trim().length > LEAD_LIMITS.phoneMax);
  return idx >= 0 ? idx : 0;
}

export function toPatchContactsBody(
  contacts: readonly ContactDraft[],
  isExistingCompany: boolean,
): CreateLeadContactBody[] {
  return contacts.map((contact) => {
    const honorific = contact.honorificTitle.trim();
    const job = contact.jobTitle.trim();
    const phones = cleanPhoneValues(contact.phones);
    const email = contact.email.trim();

    if (contact.contactPartyId) {
      const body: CreateLeadContactBody = {
        contactPartyId: contact.contactPartyId,
        isPrimary: contact.isPrimary,
        honorificTitle: honorific || null,
        jobTitle: job || null,
        phones,
        email,
      };
      if (!isExistingCompany) {
        body.firstName = contact.firstName.trim();
        body.lastName = contact.lastName.trim();
      }
      return body;
    }

    const body: CreateLeadContactBody = {
      firstName: contact.firstName.trim(),
      isPrimary: contact.isPrimary,
    };
    if (honorific) body.honorificTitle = honorific;
    const last = contact.lastName.trim();
    if (last) body.lastName = last;
    if (job) body.jobTitle = job;
    if (phones.length > 0) body.phones = phones;
    if (email) body.email = email;
    return body;
  });
}

export function mapContactsPatchErrors(
  error: unknown,
  contacts: readonly ContactDraft[],
  editIndex?: number,
): DraftErrors {
  const code = errorCodeOf(error);
  const idx = editIndex !== undefined && editIndex >= 0 ? editIndex : 0;
  const contact = contacts[idx];
  const errors: DraftErrors = {};

  if (code === 'LEAD_CONTACT_NAME_REQUIRED' || code?.endsWith('.LEAD_CONTACT_NAME_REQUIRED')) {
    const missingIdx =
      editIndex !== undefined
        ? idx
        : Math.max(
            0,
            contacts.findIndex((c) => !c.firstName.trim()),
          );
    errors[`contacts.${missingIdx}.firstName`] = 'required';
  } else if (code === 'LEAD_PHONE_INVALID' || code?.endsWith('.LEAD_PHONE_INVALID')) {
    const pIdx = contact ? findInvalidPhoneIndex(contact.phones) : 0;
    errors[`contacts.${idx}.phones.${pIdx}`] = 'phoneInvalid';
  } else if (code === 'PARTY_DUPLICATE_CONTACT_METHOD' && contact) {
    const phones = cleanPhoneValues(contact.phones);
    const hasEmail = !!contact.email.trim();
    if (hasEmail && phones.length === 0) {
      errors[`contacts.${idx}.email`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
    } else if (!hasEmail && phones.length === 1) {
      const pIdx = contact.phones.findIndex((p) => p.trim().length > 0);
      errors[`contacts.${idx}.phones.${pIdx >= 0 ? pIdx : 0}`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
    }
  } else if (code === 'PARTY_CONTACT_LIMIT_EXCEEDED') {
    errors['contacts'] = 'contactsMax';
  } else if (code === 'PARTY_DUPLICATE_CONTACT') {
    errors['contacts'] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
  } else if (code === 'LEAD_CONTACT_PRIMARY_INVALID') {
    errors['contacts'] = 'primaryOne';
  } else if (code === 'LEAD_CONTACT_REQUIRED') {
    errors['contacts'] = 'contactsMin';
  } else if (code === 'CRM_VALIDATION_FAILED') {
    for (const path of validationPaths(error)) {
      const match = /^contacts\.(\d+)\.(\w+)/.exec(path);
      if (!match) continue;
      const at = Number(match[1]);
      const field = match[2];
      if (field === 'honorificTitle' || field === 'jobTitle' || field === 'firstName' || field === 'lastName') {
        errors[`contacts.${at}.${field}`] = 'tooLong';
      } else if (field === 'email') {
        errors[`contacts.${at}.email`] = 'emailInvalid';
      } else if (field === 'phones') {
        const target = contacts[at];
        errors[`contacts.${at}.phones.${target ? findTooLongPhoneIndex(target.phones) : 0}`] = 'tooLong';
      }
    }
  }

  return errors;
}

const LEAD_CONTACT_LIMITS: ContactLimits = {
  honorificTitle: LEAD_LIMITS.honorific,
  firstName: LEAD_LIMITS.name,
  lastName: LEAD_LIMITS.name,
  jobTitle: LEAD_LIMITS.jobTitle,
  email: LEAD_LIMITS.email,
  phones: LEAD_LIMITS.phonesMax,
  phoneLength: LEAD_LIMITS.phoneMax,
  contacts: LEAD_LIMITS.contactsMax,
};

/** Leads contacts wrapper over the shared `<app-record-contacts>` component. */
@Component({
  selector: 'app-lf-contacts',
  imports: [RecordContacts],
  providers: [provideTranslocoScope({ scope: 'lead-form', alias: 'leadForm' })],
  templateUrl: './contacts-section.html',
  host: { class: 'block' },
})
export class ContactsSection {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly recordContacts = viewChild<RecordContacts>('recordContacts');

  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly countries = input<GeoCountry[]>([]);
  readonly leadId = input<string | null>(null);
  readonly revision = input(0);
  readonly saveContacts = input<((contacts: ContactDraft[], editIndex?: number) => Promise<DraftErrors | null>) | null>(
    null,
  );
  readonly layout = input<RecordLayout>('modal');
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  protected readonly limits = LEAD_CONTACT_LIMITS;
  protected readonly resetKey = computed(() => `${this.leadId() ?? ''}|${this.revision()}|${this.mode()}`);

  private readonly companyKey = computed(() => {
    const d = this.draft();
    return d.branchId && d.existingCompanyPartyId ? `${d.branchId}|${d.existingCompanyPartyId}` : null;
  });

  protected readonly companyContactsLoader = computed<((query: string) => Promise<CompanyContactOption[]>) | null>(() => {
    const key = this.companyKey();
    if (!key) return null;
    const [branchId, companyPartyId] = key.split('|');
    return async (query: string) => {
      const items = await listCompanyContacts(branchId, companyPartyId);
      const q = query.trim().toLowerCase();
      const mapped: CompanyContactOption[] = items.map((item) => ({
        partyId: item.partyId,
        displayName: item.displayName,
        jobTitle: item.jobTitle,
        email: item.primaryEmail,
        phones: [...item.phones],
      }));
      return q ? mapped.filter((c) => c.displayName.toLowerCase().includes(q)) : mapped;
    };
  });

  protected readonly mappedErrors = computed<ContactErrors>(() => {
    this.i18n();
    const d = this.draft();
    return this.mapDraftErrors(this.errors(), d.contacts, Boolean(d.existingCompanyPartyId));
  });

  protected readonly saveContactBound = computed<((change: ContactChange) => Promise<ContactErrors | null>) | null>(() => {
    const saveFn = this.saveContacts();
    if (!saveFn) return null;
    return async (change: ContactChange): Promise<ContactErrors | null> => {
      const currentDraft = this.draft();
      const current = currentDraft.contacts;
      let nextContacts: ContactDraft[];
      let editIndex: number | undefined;

      switch (change.op) {
        case 'ADD': {
          const added = cloneContact(change.contact);
          nextContacts = added.isPrimary
            ? [...current.map((c) => ({ ...cloneContact(c), isPrimary: false })), added]
            : [...current.map(cloneContact), added];
          editIndex = nextContacts.length - 1;
          break;
        }
        case 'UPDATE': {
          const idx = current.findIndex(
            (c) =>
              c.key === change.contact.key ||
              (change.contactPartyId !== '' &&
                (c.contactPartyId === change.contactPartyId || c.key === change.contactPartyId)),
          );
          if (idx < 0) return {};
          const updated = cloneContact(change.contact);
          nextContacts = current.map((c, i) => {
            if (i === idx) return updated;
            const copy = cloneContact(c);
            return updated.isPrimary ? { ...copy, isPrimary: false } : copy;
          });
          editIndex = idx;
          break;
        }
        case 'SET_PRIMARY': {
          const idx = current.findIndex(
            (c) => c.contactPartyId === change.contactPartyId || c.key === change.contactPartyId,
          );
          if (idx < 0) return {};
          nextContacts = current.map((c, i) => ({
            ...cloneContact(c),
            isPrimary: i === idx,
          }));
          editIndex = idx;
          break;
        }
        case 'REMOVE': {
          nextContacts = current
            .filter((c) => c.contactPartyId !== change.contactPartyId && c.key !== change.contactPartyId)
            .map(cloneContact);
          if (!nextContacts.some((c) => c.isPrimary) && nextContacts.length > 0) {
            nextContacts[0] = { ...nextContacts[0], isPrimary: true };
          }
          break;
        }
      }

      if ((change.op === 'ADD' || change.op === 'UPDATE') && editIndex !== undefined) {
        const edited = nextContacts[editIndex];
        const hasContactReach = edited.phones.some((p) => p.trim() !== '') || !!edited.email.trim();
        if (!hasContactReach) {
          const draftForValidation: LeadDraft = {
            ...currentDraft,
            contacts: nextContacts.map((c, idx) => (idx === editIndex ? { ...c, contactPartyId: null } : c)),
          };
          const allErrors = validateDraft(draftForValidation, 'edit', []);
          if (allErrors['reach']) {
            return {
              [`${edited.key}.email`]: this.translateError(allErrors['reach'], LEAD_LIMITS.email) ?? '',
            };
          }
        }
      }

      const serverErrs = await saveFn(nextContacts, editIndex);
      if (serverErrs === null) return null;
      if (Object.keys(serverErrs).length === 0) return {};
      return this.mapDraftErrors(serverErrs, nextContacts, Boolean(currentDraft.existingCompanyPartyId));
    };
  });

  readonly dialogBusy = computed(() => this.recordContacts()?.dialogBusy() ?? false);
  readonly isEditingContact = computed(() => this.recordContacts()?.isEditingContact() ?? false);
  readonly hasUnsavedChanges = computed(() => this.recordContacts()?.hasUnsavedChanges() ?? false);

  draftContacts(): ContactDraft[] | null {
    return this.recordContacts()?.draftContacts() ?? null;
  }

  discardEdit(): void {
    this.recordContacts()?.discardEdit();
  }

  saveContact(): Promise<boolean> {
    return this.recordContacts()?.saveCurrentEdit() ?? Promise.resolve(true);
  }

  protected onContactsChange(contacts: ContactDraft[]): void {
    this.draft.update((current) => ({ ...current, contacts }));
  }

  private mapDraftErrors(
    rawErrors: DraftErrors,
    contacts: readonly ContactDraft[],
    hasExistingCompany: boolean,
  ): ContactErrors {
    const out: ContactErrors = {};
    if (rawErrors['contacts']) {
      const msg = this.translateError(rawErrors['contacts'], LEAD_LIMITS.contactsMax);
      if (msg) out['contacts'] = msg;
    }

    for (const [key, raw] of Object.entries(rawErrors)) {
      if (!raw || !key.startsWith('contacts.')) continue;
      const rest = key.slice('contacts.'.length);
      const dot = rest.indexOf('.');
      if (dot < 0) continue;
      const idx = Number(rest.slice(0, dot));
      const contact = Number.isInteger(idx) ? contacts[idx] : undefined;
      if (!contact) continue;
      const fieldPath = rest.slice(dot + 1);
      const max = maxForFieldPath(fieldPath);
      const msg = this.translateError(raw, max);
      if (!msg) continue;

      if (fieldPath === 'phones') {
        out[`${contact.key}.phones.0`] = msg;
      } else if (fieldPath === 'reach') {
        out[`${contact.key}.email`] = out[`${contact.key}.email`] ?? msg;
      } else {
        out[`${contact.key}.${fieldPath}`] = msg;
      }
    }

    if (hasExistingCompany && rawErrors['reach'] && contacts[0]) {
      const firstKey = `${contacts[0].key}.email`;
      if (!out[firstKey]) {
        const msg = this.translateError(rawErrors['reach'], LEAD_LIMITS.email);
        if (msg) out[firstKey] = msg;
      }
    }

    return out;
  }

  private translateError(raw: string | undefined, max?: number): string | null {
    this.i18n();
    if (!raw) return null;
    const [codePart, suffixMax] = raw.split(':');
    const key = codePart.startsWith('leadForm.') ? codePart : `leadForm.errors.${codePart}`;
    const resolvedMax = suffixMax !== undefined ? Number(suffixMax) : max;
    return this.transloco.translate(key, resolvedMax !== undefined ? { max: resolvedMax } : undefined);
  }
}

function maxForFieldPath(fieldPath: string): number | undefined {
  if (fieldPath === 'honorificTitle') return LEAD_LIMITS.honorific;
  if (fieldPath === 'jobTitle') return LEAD_LIMITS.jobTitle;
  if (fieldPath === 'firstName' || fieldPath === 'lastName') return LEAD_LIMITS.name;
  if (fieldPath === 'email' || fieldPath === 'reach') return LEAD_LIMITS.email;
  if (fieldPath === 'phones' || fieldPath.startsWith('phones.')) return LEAD_LIMITS.phoneMax;
  return undefined;
}

export { ContactsSection as LfContacts };
