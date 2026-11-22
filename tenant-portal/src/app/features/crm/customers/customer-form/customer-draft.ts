import type { AddressValue } from '../../../../shared/ui/address-fields/address-fields';
import { normalizePhone, toAsciiDigits } from '../../../../shared/ui/phone-input/phone';
import { ApiError } from '../../settings/shared/settings-api';
import { ContactChange, ContactDraft, newContact } from '../../shared/record/record-contact';
import {
  AddressBody,
  CUSTOMER_LIMITS,
  CardColor,
  ContactChangeBody,
  ContactPersonBody,
  CreateCustomerBody,
  CustomerAddress,
  CustomerCustomField,
  CustomerDetail,
  CustomerStatus,
  ProfileType,
  UpdateCustomerBody,
} from '../customers.model';

export type { AddressValue, ContactChange, ContactDraft };
export { newContact };

export const CUSTOMER_TAGS_MAX = 50;
export const CUSTOMER_CUSTOM_TEXT_MAX = 500;
export const CUSTOMER_CUSTOM_TEXTAREA_MAX = 5000;

export type DraftErrors = Partial<Record<string, string>>;

export type CustomerCreateBody = CreateCustomerBody & {
  legalName?: string;
};

export interface CustomerDraft {
  profileType: ProfileType;
  companyId: string | null;
  branchId: string | null;
  ownerUserId: string | null;
  status: CustomerStatus;
  acquisitionSourceId: string | null;
  tagIds: string[];
  rating: number;
  cardColor: CardColor | null;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  companyName: string;
  legalName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  companyPhones: string[];
  companyEmail: string;
  companyWebsite: string;
  contacts: ContactDraft[];
  customFields: Record<string, unknown>;
  description: string;
  address: AddressValue;
  legacyAddress?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

export function emptyAddress(): AddressValue {
  return {
    countryId: null,
    stateId: null,
    cityId: null,
    districtId: null,
    street1: '',
    street2: '',
    buildingNo: '',
    floor: '',
    landmark: '',
    postalCode: '',
  };
}

export function hasGeoAddress(address: AddressValue): boolean {
  return Boolean(
    trimOrNull(address.countryId) ||
      trimOrNull(address.stateId) ||
      trimOrNull(address.cityId) ||
      trimOrNull(address.districtId),
  );
}

export function formatLegacyAddress(address: CustomerAddress | null | undefined): string {
  if (!address) return '';
  if (address.countryId || address.stateId || address.cityId || address.districtId) {
    return '';
  }
  const parts = [
    address.street,
    address.buildingNo,
    address.floor,
    address.apartment,
    address.area,
    address.city,
    address.country,
    address.postalCode,
    address.landmark,
  ]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean);
  return parts.join(', ');
}

function cloneCustomFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    out[key] = Array.isArray(val) ? [...val] : val;
  }
  return out;
}

function cloneContactDraft(contact: ContactDraft): ContactDraft {
  return {
    ...contact,
    phones: contact.phones.length > 0 ? [...contact.phones] : [''],
  };
}

export function emptyDraft(preset?: Partial<CustomerDraft>): CustomerDraft {
  const base: CustomerDraft = {
    profileType: preset?.profileType ?? 'INDIVIDUAL',
    companyId: null,
    branchId: null,
    ownerUserId: null,
    status: 'PROSPECT',
    acquisitionSourceId: null,
    tagIds: [],
    rating: 0,
    cardColor: null,
    honorificTitle: '',
    firstName: '',
    lastName: '',
    phones: [''],
    email: '',
    companyName: '',
    legalName: '',
    taxNumber: '',
    commercialRegistrationNumber: '',
    companyPhones: [''],
    companyEmail: '',
    companyWebsite: '',
    contacts: [],
    customFields: {},
    description: '',
    address: emptyAddress(),
    legacyAddress: null,
  };

  if (!preset) return base;

  return {
    ...base,
    ...preset,
    tagIds: preset.tagIds ? [...preset.tagIds] : base.tagIds,
    phones: preset.phones ? (preset.phones.length > 0 ? [...preset.phones] : ['']) : base.phones,
    companyPhones: preset.companyPhones
      ? preset.companyPhones.length > 0
        ? [...preset.companyPhones]
        : ['']
      : base.companyPhones,
    contacts: preset.contacts ? preset.contacts.map(cloneContactDraft) : base.contacts,
    customFields: preset.customFields ? cloneCustomFields(preset.customFields) : base.customFields,
    address: preset.address ? { ...base.address, ...preset.address } : base.address,
  };
}

export function draftFromDetail(detail: CustomerDetail, companyId: string | null = null): CustomerDraft {
  const isCorporate = detail.profileType === 'CORPORATE';
  const individualPhones =
    detail.phones.length > 0 ? [...detail.phones] : detail.primaryMobile ? [detail.primaryMobile] : [''];
  const corporatePhones =
    detail.phones.length > 0 ? [...detail.phones] : detail.companyPhone ? [detail.companyPhone] : [''];

  const contacts: ContactDraft[] = isCorporate
    ? detail.contacts.map((c) => ({
        key: c.partyId,
        contactPartyId: c.partyId || null,
        honorificTitle: c.honorificTitle ?? '',
        firstName: c.firstName ?? c.displayName,
        lastName: c.lastName ?? '',
        jobTitle: c.jobTitle ?? '',
        isPrimary: c.isPrimary,
        phones: c.phones.length > 0 ? [...c.phones] : [''],
        email: c.email ?? '',
      }))
    : [];

  return {
    profileType: detail.profileType,
    companyId,
    branchId: detail.branchId,
    ownerUserId: detail.ownerUserId,
    status: detail.status,
    acquisitionSourceId: detail.acquisitionSourceId,
    tagIds: detail.tags.map((t) => t.id),
    rating: detail.rating,
    cardColor: detail.cardColor,
    honorificTitle: isCorporate ? '' : (detail.honorificTitle ?? ''),
    firstName: isCorporate ? '' : (detail.firstName ?? ''),
    lastName: isCorporate ? '' : (detail.lastName ?? ''),
    phones: isCorporate ? [''] : individualPhones,
    email: isCorporate ? '' : (detail.email ?? ''),
    companyName: isCorporate ? (detail.companyName ?? detail.displayName) : '',
    legalName: isCorporate ? (detail.legalName ?? '') : '',
    taxNumber: isCorporate ? (detail.taxNumber ?? '') : '',
    commercialRegistrationNumber: isCorporate ? (detail.commercialRegistrationNumber ?? '') : '',
    companyPhones: isCorporate ? corporatePhones : [''],
    companyEmail: isCorporate ? (detail.companyEmail ?? '') : '',
    companyWebsite: isCorporate ? (detail.companyWebsite ?? '') : '',
    contacts,
    customFields: cloneCustomFields(detail.customFields ?? {}),
    description: detail.description ?? '',
    address: {
      ...emptyAddress(),
      countryId: detail.address?.countryId ?? null,
      stateId: detail.address?.stateId ?? null,
      cityId: detail.address?.cityId ?? null,
      districtId: detail.address?.districtId ?? null,
    },
    legacyAddress: formatLegacyAddress(detail.address) || null,
  };
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function cleanPhones(phones: readonly string[]): string[] {
  return phones.map((p) => p.trim()).filter((p) => p.length > 0);
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function contactsEqual(a: readonly ContactDraft[], b: readonly ContactDraft[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (
      ca.contactPartyId !== cb.contactPartyId ||
      ca.isPrimary !== cb.isPrimary ||
      ca.honorificTitle.trim() !== cb.honorificTitle.trim() ||
      ca.firstName.trim() !== cb.firstName.trim() ||
      ca.lastName.trim() !== cb.lastName.trim() ||
      ca.jobTitle.trim() !== cb.jobTitle.trim() ||
      ca.email.trim() !== cb.email.trim() ||
      !stringArraysEqual(cleanPhones(ca.phones), cleanPhones(cb.phones))
    ) {
      return false;
    }
  }
  return true;
}

function addressesEqual(a: AddressValue, b: AddressValue): boolean {
  return (
    trimOrNull(a.countryId) === trimOrNull(b.countryId) &&
    trimOrNull(a.stateId) === trimOrNull(b.stateId) &&
    trimOrNull(a.cityId) === trimOrNull(b.cityId) &&
    trimOrNull(a.districtId) === trimOrNull(b.districtId)
  );
}

function cleanCustomValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : [...value];
  }
  return value;
}

function cleanCustomFields(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(raw)) {
    const cleaned = cleanCustomValue(val);
    if (cleaned !== undefined) {
      out[key] = cleaned;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

function customValuesEqual(a: unknown, b: unknown): boolean {
  const ca = cleanCustomValue(a);
  const cb = cleanCustomValue(b);
  if (ca === cb) return true;
  if (Array.isArray(ca) && Array.isArray(cb)) {
    return ca.length === cb.length && ca.every((item, index) => item === cb[index]);
  }
  return false;
}

function customFieldsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!customValuesEqual(a[key], b[key])) return false;
  }
  return true;
}

export function draftsEqual(a: CustomerDraft, b: CustomerDraft): boolean {
  return (
    a.profileType === b.profileType &&
    trimOrNull(a.companyId) === trimOrNull(b.companyId) &&
    trimOrNull(a.branchId) === trimOrNull(b.branchId) &&
    trimOrNull(a.ownerUserId) === trimOrNull(b.ownerUserId) &&
    a.status === b.status &&
    trimOrNull(a.acquisitionSourceId) === trimOrNull(b.acquisitionSourceId) &&
    stringArraysEqual(a.tagIds, b.tagIds) &&
    a.rating === b.rating &&
    a.cardColor === b.cardColor &&
    a.honorificTitle.trim() === b.honorificTitle.trim() &&
    a.firstName.trim() === b.firstName.trim() &&
    a.lastName.trim() === b.lastName.trim() &&
    stringArraysEqual(cleanPhones(a.phones), cleanPhones(b.phones)) &&
    a.email.trim() === b.email.trim() &&
    a.companyName.trim() === b.companyName.trim() &&
    a.legalName.trim() === b.legalName.trim() &&
    a.taxNumber.trim() === b.taxNumber.trim() &&
    a.commercialRegistrationNumber.trim() === b.commercialRegistrationNumber.trim() &&
    stringArraysEqual(cleanPhones(a.companyPhones), cleanPhones(b.companyPhones)) &&
    a.companyEmail.trim() === b.companyEmail.trim() &&
    a.companyWebsite.trim() === b.companyWebsite.trim() &&
    contactsEqual(a.contacts, b.contacts) &&
    customFieldsEqual(a.customFields, b.customFields) &&
    a.description.trim() === b.description.trim() &&
    addressesEqual(a.address, b.address)
  );
}

export function diffTags(
  baseTagIds: readonly string[],
  draftTagIds: readonly string[],
): { added: string[]; removed: string[] } {
  const baseSet = new Set(baseTagIds);
  const draftSet = new Set(draftTagIds);
  const added = draftTagIds.filter((id) => !baseSet.has(id));
  const removed = baseTagIds.filter((id) => !draftSet.has(id));
  return { added, removed };
}

function isValidE164(raw: string): string | null {
  const ascii = toAsciiDigits(raw.trim());
  if (!PHONE_CHARS_RE.test(ascii)) return null;
  const normalized = normalizePhone(ascii);
  return E164_RE.test(normalized) ? normalized : null;
}

function isValidHttpUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidIsoDate(raw: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidIsoDateTime(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(raw)) {
    return false;
  }
  return !Number.isNaN(Date.parse(raw));
}

function checkMaxLength(value: string, max: number, key: string, errors: DraftErrors): void {
  if (!errors[key] && value.trim().length > max) {
    errors[key] = 'tooLong';
  }
}

function validatePhoneList(
  phones: readonly string[],
  prefix: string,
  errors: DraftErrors,
  seenAcrossLists?: Set<string>,
): void {
  const nonEmptyCount = phones.filter((p) => p.trim().length > 0).length;
  if (nonEmptyCount > CUSTOMER_LIMITS.phonesMax) {
    errors[prefix] = 'phonesMax';
  }

  const seen = new Set<string>();
  for (let i = 0; i < phones.length; i++) {
    const trimmed = phones[i].trim();
    if (!trimmed) continue;
    if (trimmed.length > CUSTOMER_LIMITS.phoneMax) {
      errors[`${prefix}.${i}`] = 'tooLong';
      continue;
    }
    const normalized = isValidE164(trimmed);
    if (!normalized) {
      errors[`${prefix}.${i}`] = 'phoneInvalid';
      continue;
    }
    if (seen.has(normalized)) {
      errors[`${prefix}.${i}`] = 'phoneDuplicate';
      continue;
    }
    if (seenAcrossLists?.has(normalized)) {
      errors[`${prefix}.${i}`] = 'customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
      continue;
    }
    seen.add(normalized);
    seenAcrossLists?.add(normalized);
  }
}

function isEmptyCustomValue(value: unknown, type: CustomerCustomField['type']): boolean {
  if (value === null || value === undefined) return true;
  if (type === 'BOOLEAN') return false;
  if (type === 'MULTI_SELECT') return Array.isArray(value) && value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function validateCustomField(cf: CustomerCustomField, value: unknown, required: boolean): string | null {
  if (isEmptyCustomValue(value, cf.type)) {
    return required ? 'required' : null;
  }
  switch (cf.type) {
    case 'TEXT':
      return typeof value === 'string' && value.trim().length > CUSTOMER_CUSTOM_TEXT_MAX ? 'tooLong' : null;
    case 'TEXTAREA':
      return typeof value === 'string' && value.trim().length > CUSTOMER_CUSTOM_TEXTAREA_MAX ? 'tooLong' : null;
    case 'NUMBER': {
      const num =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value.trim())
            : Number.NaN;
      return Number.isFinite(num) ? null : 'cfNumber';
    }
    case 'DATE':
      return typeof value === 'string' && isValidIsoDate(value.trim()) ? null : 'cfDate';
    case 'DATETIME':
      return typeof value === 'string' && isValidIsoDateTime(value.trim()) ? null : 'cfDate';
    case 'URL':
      return typeof value === 'string' && isValidHttpUrl(value.trim()) ? null : 'cfUrl';
    case 'EMAIL':
      return typeof value === 'string' && EMAIL_RE.test(value.trim()) ? null : 'cfEmail';
    case 'PHONE': {
      if (typeof value !== 'string') return 'cfPhone';
      const trimmed = value.trim();
      if (trimmed.length > CUSTOMER_LIMITS.phoneMax) return 'tooLong';
      return isValidE164(trimmed) ? null : 'cfPhone';
    }
    case 'BOOLEAN':
    case 'SELECT':
    case 'MULTI_SELECT':
      return null;
  }
}

export function validateDraft(
  draft: CustomerDraft,
  mode: 'create' | 'edit' | 'view',
  fields: readonly CustomerCustomField[],
): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.branchId?.trim()) {
    errors['branchId'] = 'required';
  }
  if (draft.tagIds.length > CUSTOMER_TAGS_MAX) {
    errors['tagIds'] = 'tooLong';
  }
  checkMaxLength(draft.description, CUSTOMER_LIMITS.description, 'description', errors);

  if (draft.profileType === 'INDIVIDUAL') {
    if (!draft.firstName.trim()) errors['firstName'] = 'required';
    checkMaxLength(draft.firstName, CUSTOMER_LIMITS.contactFirstName, 'firstName', errors);
    checkMaxLength(draft.lastName, CUSTOMER_LIMITS.contactLastName, 'lastName', errors);
    checkMaxLength(draft.honorificTitle, CUSTOMER_LIMITS.honorificTitle, 'honorificTitle', errors);

    validatePhoneList(draft.phones, 'phones', errors);

    const email = draft.email.trim();
    if (email) {
      if (email.length > CUSTOMER_LIMITS.email) errors['email'] = 'tooLong';
      else if (!EMAIL_RE.test(email)) errors['email'] = 'emailInvalid';
    }

    const hasPhone = draft.phones.some((p) => p.trim() !== '');
    if (!hasPhone && !email) {
      errors['reach'] = 'reachRequired';
    }
  } else {
    if (!draft.companyName.trim()) errors['companyName'] = 'required';
    checkMaxLength(draft.companyName, CUSTOMER_LIMITS.companyName, 'companyName', errors);
    checkMaxLength(draft.legalName, CUSTOMER_LIMITS.legalName, 'legalName', errors);
    checkMaxLength(draft.taxNumber, CUSTOMER_LIMITS.taxNumber, 'taxNumber', errors);
    checkMaxLength(
      draft.commercialRegistrationNumber,
      CUSTOMER_LIMITS.commercialRegistrationNumber,
      'commercialRegistrationNumber',
      errors,
    );

    const seenCorporatePhones = new Set<string>();
    const seenCorporateEmails = new Set<string>();

    validatePhoneList(draft.companyPhones, 'companyPhones', errors, seenCorporatePhones);

    const companyEmail = draft.companyEmail.trim();
    if (companyEmail) {
      if (companyEmail.length > CUSTOMER_LIMITS.email) errors['companyEmail'] = 'tooLong';
      else if (!EMAIL_RE.test(companyEmail)) errors['companyEmail'] = 'emailInvalid';
      else seenCorporateEmails.add(companyEmail.toLowerCase());
    }

    const website = draft.companyWebsite.trim();
    if (website) {
      if (website.length > CUSTOMER_LIMITS.website) errors['companyWebsite'] = 'tooLong';
      else if (!isValidHttpUrl(website)) errors['companyWebsite'] = 'websiteInvalid';
    }

    if (draft.contacts.length > CUSTOMER_LIMITS.contactsMax) {
      errors['contacts'] = 'contactsMax';
    } else if (draft.contacts.length > 0 && draft.contacts.filter((c) => c.isPrimary).length !== 1) {
      errors['contacts'] = 'primaryOne';
    }

    for (let i = 0; i < draft.contacts.length; i++) {
      const c = draft.contacts[i];
      if (!c.firstName.trim()) errors[`contacts.${i}.firstName`] = 'required';
      checkMaxLength(c.firstName, CUSTOMER_LIMITS.contactFirstName, `contacts.${i}.firstName`, errors);
      checkMaxLength(c.lastName, CUSTOMER_LIMITS.contactLastName, `contacts.${i}.lastName`, errors);
      checkMaxLength(c.honorificTitle, CUSTOMER_LIMITS.honorificTitle, `contacts.${i}.honorificTitle`, errors);
      checkMaxLength(c.jobTitle, CUSTOMER_LIMITS.jobTitle, `contacts.${i}.jobTitle`, errors);

      validatePhoneList(c.phones, `contacts.${i}.phones`, errors, seenCorporatePhones);

      const cEmail = c.email.trim();
      if (cEmail) {
        if (cEmail.length > CUSTOMER_LIMITS.email) errors[`contacts.${i}.email`] = 'tooLong';
        else if (!EMAIL_RE.test(cEmail)) errors[`contacts.${i}.email`] = 'emailInvalid';
        else {
          const lower = cEmail.toLowerCase();
          if (seenCorporateEmails.has(lower)) {
            errors[`contacts.${i}.email`] = 'customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
          } else {
            seenCorporateEmails.add(lower);
          }
        }
      }
    }

    const hasCompanyReach = draft.companyPhones.some((p) => p.trim() !== '') || !!companyEmail;
    const primaryContact = draft.contacts.find((c) => c.isPrimary) ?? null;
    const hasPrimaryContactReach =
      primaryContact !== null &&
      (primaryContact.phones.some((p) => p.trim() !== '') || !!primaryContact.email.trim());

    if (!hasCompanyReach && !hasPrimaryContactReach) {
      errors['reach'] = 'reachRequired';
    }
  }

  for (const cf of fields) {
    const required = mode === 'create' ? cf.requiredOnCreate : mode === 'edit' ? cf.requiredOnUpdate : false;
    const cfError = validateCustomField(cf, draft.customFields[cf.fieldKey], required);
    if (cfError) {
      errors[`customFields.${cf.fieldKey}`] = cfError;
    }
  }

  return errors;
}

function buildCreateContactPerson(contact: ContactDraft): ContactPersonBody {
  const honorificTitle = trimOrUndefined(contact.honorificTitle);
  const firstName = trimOrUndefined(contact.firstName);
  const lastName = trimOrUndefined(contact.lastName);
  const jobTitle = trimOrUndefined(contact.jobTitle);
  const email = trimOrUndefined(contact.email);
  const phones = cleanPhones(contact.phones);

  const body: ContactPersonBody = {
    isPrimary: contact.isPrimary,
  };
  if (contact.contactPartyId) body.contactPartyId = contact.contactPartyId;
  if (honorificTitle) body.honorificTitle = honorificTitle;
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (jobTitle) body.jobTitle = jobTitle;
  if (email) body.email = email;
  if (phones.length > 0) body.phones = phones;
  return body;
}

function buildUpdateContactPerson(contact: ContactDraft): ContactPersonBody {
  const body: ContactPersonBody = {
    honorificTitle: contact.honorificTitle.trim(),
    firstName: contact.firstName.trim(),
    lastName: contact.lastName.trim(),
    jobTitle: contact.jobTitle.trim(),
    isPrimary: contact.isPrimary,
    email: contact.email.trim() || null,
    phones: cleanPhones(contact.phones),
  };
  if (contact.contactPartyId) {
    body.contactPartyId = contact.contactPartyId;
  }
  return body;
}

function buildCreateAddress(address: AddressValue): AddressBody | undefined {
  const out: AddressBody = {};
  let hasAny = false;

  const set = <K extends keyof AddressBody>(key: K, value: string | null | undefined) => {
    const trimmed = trimOrUndefined(value);
    if (trimmed) {
      out[key] = trimmed;
      hasAny = true;
    }
  };

  set('countryId', address.countryId);
  set('stateId', address.stateId);
  set('cityId', address.cityId);
  set('districtId', address.districtId);

  return hasAny ? out : undefined;
}

function buildFullGeoAddress(address: AddressValue): AddressBody {
  return {
    countryId: trimOrNull(address.countryId),
    stateId: trimOrNull(address.stateId),
    cityId: trimOrNull(address.cityId),
    districtId: trimOrNull(address.districtId),
  };
}

function composeIndividualDisplayName(draft: CustomerDraft): string {
  return [draft.honorificTitle.trim(), draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(' ');
}

export function toCreateBody(draft: CustomerDraft): CustomerCreateBody {
  const body: CustomerCreateBody = {
    branchId: draft.branchId?.trim() ?? '',
    profileType: draft.profileType,
  };

  if (draft.status !== 'PROSPECT' && draft.status !== 'ACTIVE_CUSTOMER') {
    body.status = draft.status;
  }

  const ownerUserId = trimOrUndefined(draft.ownerUserId);
  const acquisitionSourceId = trimOrUndefined(draft.acquisitionSourceId);
  const description = trimOrUndefined(draft.description);
  if (ownerUserId) body.ownerUserId = ownerUserId;
  if (acquisitionSourceId) body.acquisitionSourceId = acquisitionSourceId;
  if (description) body.description = description;

  if (draft.rating > 0) body.rating = draft.rating;
  if (draft.cardColor !== null) body.cardColor = draft.cardColor;
  if (draft.tagIds.length > 0) body.tagIds = [...draft.tagIds];

  const address = buildCreateAddress(draft.address);
  if (address) body.address = address;

  const customFields = cleanCustomFields(draft.customFields);
  if (customFields) body.customFields = customFields;

  if (draft.profileType === 'INDIVIDUAL') {
    const primaryContact: ContactPersonBody = {};
    const honorificTitle = trimOrUndefined(draft.honorificTitle);
    const firstName = trimOrUndefined(draft.firstName);
    const lastName = trimOrUndefined(draft.lastName);
    const email = trimOrUndefined(draft.email);
    const phones = cleanPhones(draft.phones);

    if (honorificTitle) primaryContact.honorificTitle = honorificTitle;
    if (firstName) primaryContact.firstName = firstName;
    if (lastName) primaryContact.lastName = lastName;
    if (email) primaryContact.email = email;
    if (phones.length > 0) primaryContact.phones = phones;

    body.primaryContact = primaryContact;
  } else {
    const companyName = trimOrUndefined(draft.companyName);
    const legalName = trimOrUndefined(draft.legalName);
    const taxNumber = trimOrUndefined(draft.taxNumber);
    const crNumber = trimOrUndefined(draft.commercialRegistrationNumber);
    const companyPhones = cleanPhones(draft.companyPhones);
    const companyEmail = trimOrUndefined(draft.companyEmail);
    const companyWebsite = trimOrUndefined(draft.companyWebsite);

    if (companyName) body.companyName = companyName;
    if (legalName) body.legalName = legalName;
    if (taxNumber) body.taxNumber = taxNumber;
    if (crNumber) body.commercialRegistrationNumber = crNumber;
    if (companyPhones.length > 0) body.companyPhones = companyPhones;
    if (companyEmail) body.companyEmail = companyEmail;
    if (companyWebsite) body.companyWebsite = companyWebsite;

    if (draft.contacts.length > 0) {
      body.contacts = draft.contacts.map(buildCreateContactPerson);
    }
  }

  return body;
}

export function toPatchBody(
  base: CustomerDraft,
  draft: CustomerDraft,
  expectedUpdatedAt: string,
): UpdateCustomerBody {
  const body: UpdateCustomerBody = { expectedUpdatedAt };

  const patchNullable = (
    key:
      | 'acquisitionSourceId'
      | 'legalName'
      | 'taxNumber'
      | 'commercialRegistrationNumber'
      | 'companyEmail'
      | 'companyWebsite',
    baseVal: string | null,
    draftVal: string | null,
  ) => {
    const bNorm = trimOrNull(baseVal);
    const dNorm = trimOrNull(draftVal);
    if (bNorm !== dNorm) {
      body[key] = dNorm;
    }
  };

  const nextOwnerId = trimOrUndefined(draft.ownerUserId);
  if (nextOwnerId && nextOwnerId !== trimOrUndefined(base.ownerUserId)) {
    body.ownerUserId = nextOwnerId;
  }

  if (base.status !== draft.status && draft.status !== 'ACTIVE_CUSTOMER') {
    body.status = draft.status;
  }

  patchNullable('acquisitionSourceId', base.acquisitionSourceId, draft.acquisitionSourceId);

  if (base.rating !== draft.rating) {
    body.rating = draft.rating;
  }
  if (base.cardColor !== draft.cardColor) {
    body.cardColor = draft.cardColor;
  }

  if (base.description.trim() !== draft.description.trim()) {
    body.description = draft.description.trim();
  }

  if (draft.profileType === 'INDIVIDUAL') {
    const basePhones = cleanPhones(base.phones);
    const draftPhones = cleanPhones(draft.phones);
    const identityChanged =
      base.honorificTitle.trim() !== draft.honorificTitle.trim() ||
      base.firstName.trim() !== draft.firstName.trim() ||
      base.lastName.trim() !== draft.lastName.trim() ||
      base.email.trim() !== draft.email.trim() ||
      !stringArraysEqual(basePhones, draftPhones);

    if (identityChanged) {
      body.primaryContact = {
        honorificTitle: draft.honorificTitle.trim(),
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        // IsOptional + IsEmail: '' is a 400, null clears the Party email.
        email: draft.email.trim() || null,
        phones: draftPhones,
      };
      const displayName = composeIndividualDisplayName(draft);
      if (displayName) {
        body.displayName = displayName;
      }
    }
  } else {
    const nextCompanyName = draft.companyName.trim();
    if (base.companyName.trim() !== nextCompanyName) {
      body.companyName = nextCompanyName;
      body.displayName = nextCompanyName;
    }
    patchNullable('legalName', base.legalName, draft.legalName);
    patchNullable('taxNumber', base.taxNumber, draft.taxNumber);
    patchNullable(
      'commercialRegistrationNumber',
      base.commercialRegistrationNumber,
      draft.commercialRegistrationNumber,
    );

    const baseCompanyPhones = cleanPhones(base.companyPhones);
    const draftCompanyPhones = cleanPhones(draft.companyPhones);
    if (!stringArraysEqual(baseCompanyPhones, draftCompanyPhones)) {
      body.companyPhones = draftCompanyPhones;
    }

    patchNullable('companyEmail', base.companyEmail, draft.companyEmail);
    patchNullable('companyWebsite', base.companyWebsite, draft.companyWebsite);
  }

  if (!addressesEqual(base.address, draft.address)) {
    body.address = buildFullGeoAddress(draft.address);
  }

  const changedCustomFields: Record<string, unknown> = {};
  let hasCustomChanges = false;
  const cfKeys = new Set([...Object.keys(base.customFields), ...Object.keys(draft.customFields)]);
  for (const key of cfKeys) {
    if (!customValuesEqual(base.customFields[key], draft.customFields[key])) {
      const cleaned = cleanCustomValue(draft.customFields[key]);
      changedCustomFields[key] = cleaned === undefined ? null : cleaned;
      hasCustomChanges = true;
    }
  }
  if (hasCustomChanges) {
    body.customFields = changedCustomFields;
  }

  return body;
}

export function toContactChangeBody(change: ContactChange): ContactChangeBody {
  switch (change.op) {
    case 'ADD':
      return {
        op: 'ADD',
        contact: buildCreateContactPerson(change.contact),
      };
    case 'UPDATE':
      return {
        op: 'UPDATE',
        contactPartyId: change.contactPartyId,
        contact: buildUpdateContactPerson(change.contact),
      };
    case 'REMOVE':
      return {
        op: 'REMOVE',
        contactPartyId: change.contactPartyId,
      };
    case 'SET_PRIMARY':
      return {
        op: 'SET_PRIMARY',
        contactPartyId: change.contactPartyId,
      };
  }
}

/** Form field that shows a server error about one contact method (details.methodType). */
function contactMethodErrorField(methodType: string, corporate: boolean): string {
  switch (methodType) {
    case 'PHONE':
    case 'MOBILE':
    case 'WHATSAPP':
      return corporate ? 'companyPhones' : 'phones';
    case 'EMAIL':
      return corporate ? 'companyEmail' : 'email';
    case 'WEBSITE':
      return corporate ? 'companyWebsite' : 'form';
    default:
      return corporate ? 'contacts' : 'form';
  }
}

/**
 * CRM_VALIDATION_FAILED details are the ValidationPipe property paths, each mapped to a message
 * array (`{ "contacts.0.email": ["..."] }`). Returns the first path with array indexes removed and a
 * contactChange contact folded onto `contacts.` (`contactChange.contact.email` -> `contacts.email`).
 */
export function validationErrorPath(details: Record<string, unknown> | undefined): string {
  const path = Object.keys(details ?? {}).find((key) => Array.isArray(details?.[key])) ?? '';
  return path.replace(/^contactChange\.contact\./, 'contacts.').replace(/\.\d+(?=\.|$)/g, '');
}

/** LEAD_ADDRESS_GEO_* details: { field: ['stateId'] }. */
function geoErrorField(details: Record<string, unknown> | undefined): string {
  const raw = details?.['field'];
  const field = Array.isArray(raw) && typeof raw[0] === 'string' ? raw[0] : 'countryId';
  return ['countryId', 'stateId', 'cityId', 'districtId'].includes(field) ? field : 'countryId';
}

export function mapServerErrors(error: unknown, draft?: CustomerDraft): DraftErrors {
  const code =
    error instanceof ApiError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : typeof error === 'string'
          ? error
          : null;
  const details =
    error instanceof ApiError
      ? error.details
      : typeof error === 'object' && error !== null && 'details' in error
        ? (error.details as Record<string, unknown> | undefined)
        : undefined;

  if (!code) return {};

  const errors: DraftErrors = {};
  const fieldKey = typeof details?.['fieldKey'] === 'string' ? details['fieldKey'] : '';
  const field = code === 'CRM_VALIDATION_FAILED' ? validationErrorPath(details) : '';

  if (code === 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED' || code.endsWith('.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED')) {
    errors['contacts'] = 'customerForm.server.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED';
    if (draft) {
      const missingIdx = draft.contacts.findIndex((c) => !c.firstName.trim());
      if (missingIdx >= 0) {
        errors[`contacts.${missingIdx}.firstName`] = 'required';
      }
    }
    return errors;
  }

  if (code === 'CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED' || code.endsWith('.CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED')) {
    errors['form'] = 'customerForm.server.CUSTOMER_PROFILE_PARTY_MANAGE_REQUIRED';
    return errors;
  }

  if (code === 'CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED') {
    errors[draft?.profileType === 'CORPORATE' ? 'companyName' : 'firstName'] = 'required';
    return errors;
  }

  if (code === 'CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID') {
    errors['contacts'] = 'primaryOne';
    return errors;
  }

  if (code === 'PARTY_CONTACT_LIMIT_EXCEEDED') {
    errors['contacts'] = 'contactsMax';
    return errors;
  }

  if (code === 'LEAD_PHONE_INVALID') {
    errors[draft?.profileType === 'CORPORATE' ? 'companyPhones.0' : 'phones.0'] = 'phoneInvalid';
    return errors;
  }

  if (code === 'PARTY_DUPLICATE_CONTACT_METHOD' || code === 'PARTY_CONTACT_METHOD_REPEATED') {
    // 409 details { methodType: ['phone' | 'email' | 'whatsapp'], level: ['company' | 'branch' | 'user' | 'same_owner'] }:
    // lowercase string arrays. The level does not change the field, so only methodType is read.
    const rawMethod = details?.['methodType'];
    const methodType = (Array.isArray(rawMethod) ? String(rawMethod[0] ?? '') : '').toUpperCase();
    errors[contactMethodErrorField(methodType, draft?.profileType === 'CORPORATE')] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'PARTY_DUPLICATE_CONTACT') {
    errors['contacts'] = 'customerForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
    return errors;
  }

  if (
    code === 'PARTY_CONTACT_INVALID' ||
    code === 'PARTY_CONTACT_LIMIT_EXCEEDED' ||
    code === 'CRM_CONTACT_NOT_LINKED' ||
    code === 'CRM_CONTACT_CHANGE_CONFLICT'
  ) {
    errors['contacts'] = `customerForm.server.${code}`;
    return errors;
  }

  if (
    code === 'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED' ||
    code === 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON'
  ) {
    errors['status'] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'CRM_ACQUISITION_SOURCE_NOT_FOUND' || code === 'CRM_ACQUISITION_SOURCE_INACTIVE') {
    errors['acquisitionSourceId'] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'CRM_RECORD_TAG_NOT_FOUND') {
    errors['tagIds'] = 'customerForm.server.CRM_TAG_NOT_FOUND';
    return errors;
  }

  if (code === 'CRM_TAG_NOT_FOUND' || code === 'CRM_RECORD_TAG_ALREADY_ATTACHED' || code === 'CRM_TAG_UNKNOWN') {
    errors['tagIds'] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'LEAD_ADDRESS_GEO_INVALID' || code === 'LEAD_ADDRESS_GEO_INCOMPLETE') {
    errors[`address.${geoErrorField(details)}`] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'BRANCH_CONTEXT_REQUIRED') {
    errors['branchId'] = 'required';
    return errors;
  }

  if (code === 'BRANCH_PERMISSION_DENIED' || code === 'BRANCH_ACCESS_DENIED') {
    errors['form'] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'CUSTOM_FIELD_REQUIRED' || code.endsWith('.CUSTOM_FIELD_REQUIRED')) {
    errors[fieldKey ? `customFields.${fieldKey}` : 'customFields'] = 'required';
    return errors;
  }

  if (code === 'CUSTOM_FIELD_VALUE_INVALID' || code.endsWith('_VALUE_INVALID')) {
    errors[fieldKey ? `customFields.${fieldKey}` : 'customFields'] = 'customerForm.server.CUSTOM_FIELD_VALUE_INVALID';
    return errors;
  }

  if (
    code === 'CRM_SCOPED_PERMISSION_DENIED' ||
    code === 'CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN' ||
    code === 'CUSTOMER_PROFILE_PRIMARY_CONTACT_FORBIDDEN' ||
    code === 'CUSTOMER_PROFILE_REFERENCE_CONFLICT'
  ) {
    errors['form'] = `customerForm.server.${code}`;
    return errors;
  }

  if (code === 'CRM_VALIDATION_FAILED') {
    switch (field) {
      case 'branchId':
        errors['branchId'] = 'required';
        break;
      case 'status':
        errors['status'] = 'customerForm.server.CRM_VALIDATION_FAILED';
        break;
      case 'companyName':
      case 'displayName':
        errors[draft?.profileType === 'CORPORATE' ? 'companyName' : 'firstName'] = 'tooLong';
        break;
      case 'legalName':
      case 'taxNumber':
      case 'commercialRegistrationNumber':
      case 'description':
        errors[field] = 'tooLong';
        break;
      case 'companyEmail':
        errors['companyEmail'] = 'emailInvalid';
        break;
      case 'companyWebsite':
        errors['companyWebsite'] = 'websiteInvalid';
        break;
      case 'companyPhones':
        errors['companyPhones.0'] = 'phoneInvalid';
        break;
      case 'primaryContact.honorificTitle':
        errors['honorificTitle'] = 'tooLong';
        break;
      case 'primaryContact.email':
        errors['email'] = 'emailInvalid';
        break;
      case 'primaryContact.phones':
        errors['phones.0'] = 'phoneInvalid';
        break;
      case 'tagIds':
        errors['tagIds'] = 'customerForm.server.CRM_TAG_NOT_FOUND';
        break;
      case 'address.countryId':
      case 'address.stateId':
      case 'address.cityId':
      case 'address.districtId':
        errors[field] = 'customerForm.server.CRM_VALIDATION_FAILED';
        break;
      case 'contacts.firstName':
      case 'contacts.lastName':
      case 'contacts.honorificTitle':
      case 'contacts.jobTitle':
      case 'contacts.email':
      case 'contacts.phones':
      case 'contacts.fullName':
        errors['contacts'] = 'customerForm.server.CRM_VALIDATION_FAILED';
        break;
      default:
        errors['form'] = 'customerForm.server.CRM_VALIDATION_FAILED';
        break;
    }
    return errors;
  }

  return errors;
}
