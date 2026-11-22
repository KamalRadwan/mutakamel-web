import { fakeId } from '../../settings/shared/settings-api';
import {
  CardColor,
  CurrencyCode,
  LeadCustomField,
  LeadDetail,
  LeadProfileType,
} from '../leads.model';

export interface ContactDraft {
  key: string;
  contactPartyId: string | null;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  isPrimary: boolean;
  phones: string[];
  email: string;
}

export interface AddressDraft {
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  street1: string;
  street2: string;
  buildingNo: string;
  floor: string;
  landmark: string;
  postalCode: string;
}

export interface LeadDraft {
  leadProfileType: LeadProfileType;
  branchId: string | null;
  stageId: string | null;
  ownerUserId: string | null;
  acquisitionSourceId: string | null;
  tagIds: string[];
  rating: number;
  cardColor: CardColor | null;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  existingCompanyPartyId: string | null;
  existingCompanyName: string | null;
  companyName: string;
  legalName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  companyPhones: string[];
  companyEmail: string;
  companyWebsite: string;
  contacts: ContactDraft[];
  address: AddressDraft;
  description: string;
  interestSummary: string;
  expectedNeed: string;
  expectedValue: string;
  currencyCode: CurrencyCode | null;
  customFields: Record<string, unknown>;
}

export type DraftErrors = Partial<Record<string, string>>;

export interface CreateLeadContactBody {
  contactPartyId?: string;
  honorificTitle?: string | null;
  firstName?: string;
  lastName?: string;
  jobTitle?: string | null;
  isPrimary: boolean;
  phones?: string[];
  email?: string;
}

export interface LeadAddressBody {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  street1?: string | null;
  street2?: string | null;
  buildingNo?: string | null;
  floor?: string | null;
  landmark?: string | null;
  postalCode?: string | null;
}

export interface CreateLeadBody {
  leadProfileType: LeadProfileType;
  branchId?: string;
  stageId?: string;
  ownerUserId?: string;
  acquisitionSourceId?: string;
  tagIds?: string[];
  rating?: number;
  cardColor?: CardColor;
  honorificTitle?: string;
  firstName?: string;
  lastName?: string;
  phones?: string[];
  email?: string;
  existingCompanyPartyId?: string;
  companyName?: string;
  legalName?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  companyPhones?: string[];
  companyEmail?: string;
  companyWebsite?: string;
  contacts?: CreateLeadContactBody[];
  address?: LeadAddressBody;
  description?: string;
  interestSummary?: string;
  expectedNeed?: string;
  expectedValue?: string;
  currencyCode?: CurrencyCode;
  customFields?: Record<string, unknown>;
}

export interface UpdateLeadBody {
  /** Optional on the backend: the concurrency check runs only when it is sent. */
  expectedUpdatedAt?: string;
  ownerUserId?: string | null;
  acquisitionSourceId?: string | null;
  tagIds?: string[];
  rating?: number;
  cardColor?: CardColor | null;
  honorificTitle?: string | null;
  firstName?: string;
  lastName?: string | null;
  phones?: string[];
  email?: string | null;
  companyName?: string;
  legalName?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  companyPhones?: string[];
  companyEmail?: string | null;
  companyWebsite?: string | null;
  contacts?: CreateLeadContactBody[];
  address?: LeadAddressBody;
  description?: string | null;
  interestSummary?: string | null;
  expectedNeed?: string | null;
  expectedValue?: string | null;
  currencyCode?: CurrencyCode | null;
  customFields?: Record<string, unknown>;
}

export const LEAD_LIMITS: {
  name: 80;
  displayName: 180;
  company: 180;
  honorific: 40;
  jobTitle: 120;
  phonesMax: 10;
  phoneMax: 32;
  email: 180;
  website: 255;
  tax: 64;
  contactsMax: 20;
  tagsMax: 50;
  description: 2000;
  longText: 4000;
  street1: 160;
  street2: 80;
  building: 80;
  floor: 80;
  landmark: 160;
  postal: 40;
  valueIntegerDigits: 16;
  valueDecimals: 8;
} = {
  name: 80,
  displayName: 180,
  company: 180,
  honorific: 40,
  jobTitle: 120,
  phonesMax: 10,
  phoneMax: 32,
  email: 180,
  website: 255,
  tax: 64,
  contactsMax: 20,
  tagsMax: 50,
  description: 2000,
  longText: 4000,
  street1: 160,
  street2: 80,
  building: 80,
  floor: 80,
  landmark: 160,
  postal: 40,
  valueIntegerDigits: 16,
  valueDecimals: 8,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALUE_RE = /^\d{1,16}(\.\d{1,8})?$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;

export function newContact(primary: boolean): ContactDraft {
  return {
    key: fakeId(),
    contactPartyId: null,
    honorificTitle: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    isPrimary: primary,
    phones: [''],
    email: '',
  };
}

function emptyAddress(): AddressDraft {
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

export function emptyDraft(preset?: Partial<LeadDraft>): LeadDraft {
  const leadProfileType: LeadProfileType = preset?.leadProfileType ?? 'INDIVIDUAL';
  const base: LeadDraft = {
    leadProfileType,
    branchId: null,
    stageId: null,
    ownerUserId: null,
    acquisitionSourceId: null,
    tagIds: [],
    rating: 0,
    cardColor: null,
    honorificTitle: '',
    firstName: '',
    lastName: '',
    phones: [''],
    email: '',
    existingCompanyPartyId: null,
    existingCompanyName: null,
    companyName: '',
    legalName: '',
    taxNumber: '',
    commercialRegistrationNumber: '',
    companyPhones: [''],
    companyEmail: '',
    companyWebsite: '',
    contacts: leadProfileType === 'CORPORATE' ? [newContact(true)] : [],
    address: emptyAddress(),
    description: '',
    interestSummary: '',
    expectedNeed: '',
    expectedValue: '',
    currencyCode: null,
    customFields: {},
  };

  if (!preset) return base;

  return {
    ...base,
    ...preset,
    tagIds: preset.tagIds ? [...preset.tagIds] : base.tagIds,
    phones: preset.phones ? [...preset.phones] : base.phones,
    companyPhones: preset.companyPhones ? [...preset.companyPhones] : base.companyPhones,
    contacts: preset.contacts
      ? preset.contacts.map((c) => ({ ...c, phones: [...c.phones] }))
      : base.contacts,
    address: preset.address ? { ...base.address, ...preset.address } : base.address,
    customFields: preset.customFields ? { ...preset.customFields } : base.customFields,
  };
}

export function draftFromDetail(detail: LeadDetail): LeadDraft {
  const corporate = detail.leadProfileType === 'CORPORATE';
  const contacts: ContactDraft[] = corporate
    ? detail.contacts.length > 0
      ? detail.contacts.map((c) => ({
          key: c.partyId || fakeId(),
          contactPartyId: c.partyId || null,
          honorificTitle: c.honorificTitle ?? '',
          firstName: c.firstName ?? c.displayName,
          lastName: c.lastName ?? '',
          jobTitle: c.jobTitle ?? '',
          isPrimary: c.isPrimary,
          phones: c.phones.length > 0 ? [...c.phones] : [''],
          email: c.email ?? '',
        }))
      : [newContact(true)]
    : [];

  return {
    leadProfileType: detail.leadProfileType,
    branchId: detail.branchId,
    stageId: detail.stageId,
    ownerUserId: detail.ownerUserId,
    acquisitionSourceId: detail.acquisitionSourceId,
    tagIds: detail.tags.map((t) => t.id),
    rating: detail.rating,
    cardColor: detail.cardColor,
    honorificTitle: detail.honorificTitle ?? '',
    firstName: detail.firstName ?? '',
    lastName: detail.lastName ?? '',
    phones: detail.phones.length > 0 ? [...detail.phones] : [''],
    email: detail.email ?? '',
    existingCompanyPartyId: detail.existingCompany ? detail.partyId : null,
    existingCompanyName: detail.existingCompany ? (detail.companyName ?? detail.displayName) : null,
    companyName: detail.companyName ?? '',
    legalName: detail.legalName ?? '',
    taxNumber: detail.taxNumber ?? '',
    commercialRegistrationNumber: detail.commercialRegistrationNumber ?? '',
    companyPhones: detail.companyPhones.length > 0 ? [...detail.companyPhones] : [''],
    companyEmail: detail.companyEmail ?? '',
    companyWebsite: detail.companyWebsite ?? '',
    contacts,
    address: {
      countryId: detail.address?.countryId ?? null,
      stateId: detail.address?.stateId ?? null,
      cityId: detail.address?.cityId ?? null,
      districtId: detail.address?.districtId ?? null,
      street1: detail.address?.street ?? '',
      street2: detail.address?.apartment ?? '',
      buildingNo: detail.address?.buildingNo ?? '',
      floor: detail.address?.floor ?? '',
      landmark: detail.address?.landmark ?? '',
      postalCode: detail.address?.postalCode ?? '',
    },
    description: detail.description ?? '',
    interestSummary: detail.interestSummary ?? '',
    expectedNeed: detail.expectedNeed ?? '',
    expectedValue: detail.expectedValue ?? '',
    currencyCode: detail.currencyCode,
    customFields: { ...detail.customFields },
  };
}

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[^\d+]/g, '');
  const withPlus = stripped.startsWith('00') ? '+' + stripped.slice(2) : stripped;
  return withPlus.startsWith('+') ? '+' + withPlus.slice(1).replace(/\+/g, '') : withPlus.replace(/\+/g, '');
}

function phoneDigits(normalized: string): number {
  return normalized.replace(/\D/g, '').length;
}

function validatePhoneList(
  phones: string[],
  prefix: string,
  errors: DraftErrors,
  seenAcrossLists?: Set<string>,
): void {
  const seen = new Set<string>();
  for (let i = 0; i < phones.length; i++) {
    const trimmed = phones[i].trim();
    if (!trimmed) continue;
    if (trimmed.length > LEAD_LIMITS.phoneMax) {
      errors[`${prefix}.${i}`] = 'tooLong';
      continue;
    }
    if (!PHONE_CHARS_RE.test(trimmed)) {
      errors[`${prefix}.${i}`] = 'phoneInvalid';
      continue;
    }
    const normalized = normalizePhone(trimmed);
    if (phoneDigits(normalized) < 5) {
      errors[`${prefix}.${i}`] = 'phoneInvalid';
      continue;
    }
    if (seen.has(normalized)) {
      errors[`${prefix}.${i}`] = 'phoneDuplicate';
      continue;
    }
    if (seenAcrossLists?.has(normalized)) {
      errors[`${prefix}.${i}`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
      continue;
    }
    seen.add(normalized);
    seenAcrossLists?.add(normalized);
  }
}

function checkMaxLength(value: string, max: number, key: string, errors: DraftErrors): void {
  if (!errors[key] && value.trim().length > max) {
    errors[key] = 'tooLong';
  }
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

function isEmptyCustomValue(value: unknown, type: LeadCustomField['type']): boolean {
  if (value === null || value === undefined) return true;
  if (type === 'BOOLEAN') return false;
  if (type === 'MULTI_SELECT') return Array.isArray(value) && value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function validateCustomField(cf: LeadCustomField, value: unknown, required: boolean): string | null {
  if (isEmptyCustomValue(value, cf.type)) {
    return required ? 'required' : null;
  }
  switch (cf.type) {
    case 'TEXT':
    case 'TEXTAREA':
      return typeof value === 'string' && value.trim().length > LEAD_LIMITS.longText ? 'tooLong' : null;
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
      if (!PHONE_CHARS_RE.test(trimmed)) return 'cfPhone';
      return phoneDigits(normalizePhone(trimmed)) >= 5 ? null : 'cfPhone';
    }
    case 'BOOLEAN':
    case 'SELECT':
    case 'MULTI_SELECT':
      return null;
  }
}

export function validateDraft(draft: LeadDraft, mode: 'create' | 'edit', fields: LeadCustomField[]): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.branchId?.trim()) {
    errors['branchId'] = 'required';
  }

  if (draft.leadProfileType === 'INDIVIDUAL') {
    if (!draft.firstName.trim()) errors['firstName'] = 'required';
    checkMaxLength(draft.firstName, LEAD_LIMITS.name, 'firstName', errors);
    checkMaxLength(draft.lastName, LEAD_LIMITS.name, 'lastName', errors);
    checkMaxLength(draft.honorificTitle, LEAD_LIMITS.honorific, 'honorificTitle', errors);

    validatePhoneList(draft.phones, 'phones', errors);

    const email = draft.email.trim();
    if (email) {
      if (email.length > LEAD_LIMITS.email) errors['email'] = 'tooLong';
      else if (!EMAIL_RE.test(email)) errors['email'] = 'emailInvalid';
    }

    const hasPhone = draft.phones.some((p) => p.trim() !== '');
    if (!hasPhone && !email) {
      errors['reach'] = 'reachRequired';
    }
  } else {
    const isExistingCompany = !!draft.existingCompanyPartyId?.trim();
    const seenCorporatePhones = new Set<string>();
    const seenCorporateEmails = new Set<string>();
    const seenContactPartyIds = new Set<string>();

    if (draft.contacts.length === 0) {
      errors['contacts'] = 'contactsMin';
    } else if (draft.contacts.length > LEAD_LIMITS.contactsMax) {
      errors['contacts'] = 'contactsMax';
    } else if (draft.contacts.filter((c) => c.isPrimary).length !== 1) {
      errors['contacts'] = 'primaryOne';
    }

    for (let i = 0; i < draft.contacts.length; i++) {
      const c = draft.contacts[i];
      if (!c.contactPartyId) continue;
      if (seenContactPartyIds.has(c.contactPartyId)) {
        if (!errors['contacts']) {
          errors['contacts'] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
        }
      } else {
        seenContactPartyIds.add(c.contactPartyId);
      }
      for (let pIdx = 0; pIdx < c.phones.length; pIdx++) {
        const trimmed = c.phones[pIdx].trim();
        if (!trimmed) continue;
        const normalized = normalizePhone(trimmed);
        if (seenCorporatePhones.has(normalized)) {
          if (!errors[`contacts.${i}.phones.${pIdx}`]) {
            errors[`contacts.${i}.phones.${pIdx}`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
          }
        } else {
          seenCorporatePhones.add(normalized);
        }
      }
      const cEmail = c.email.trim().toLowerCase();
      if (cEmail) {
        if (seenCorporateEmails.has(cEmail)) {
          if (!errors[`contacts.${i}.email`]) {
            errors[`contacts.${i}.email`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
          }
        } else {
          seenCorporateEmails.add(cEmail);
        }
      }
    }

    if (!isExistingCompany) {
      if (!draft.companyName.trim()) errors['companyName'] = 'required';
      checkMaxLength(draft.companyName, LEAD_LIMITS.company, 'companyName', errors);
      checkMaxLength(draft.legalName, LEAD_LIMITS.company, 'legalName', errors);
      checkMaxLength(draft.taxNumber, LEAD_LIMITS.tax, 'taxNumber', errors);
      checkMaxLength(draft.commercialRegistrationNumber, LEAD_LIMITS.tax, 'commercialRegistrationNumber', errors);

      validatePhoneList(draft.companyPhones, 'companyPhones', errors, seenCorporatePhones);

      const companyEmail = draft.companyEmail.trim();
      if (companyEmail) {
        if (companyEmail.length > LEAD_LIMITS.email) errors['companyEmail'] = 'tooLong';
        else if (!EMAIL_RE.test(companyEmail)) errors['companyEmail'] = 'emailInvalid';
        else {
          const lower = companyEmail.toLowerCase();
          if (seenCorporateEmails.has(lower)) {
            errors['companyEmail'] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
          } else {
            seenCorporateEmails.add(lower);
          }
        }
      }

      const website = draft.companyWebsite.trim();
      if (website) {
        if (website.length > LEAD_LIMITS.website) errors['companyWebsite'] = 'tooLong';
        else if (!isValidHttpUrl(website)) errors['companyWebsite'] = 'websiteInvalid';
      }
    }

    let hasReach =
      (!isExistingCompany && draft.companyPhones.some((p) => p.trim() !== '')) ||
      (!isExistingCompany && !!draft.companyEmail.trim());

    for (let i = 0; i < draft.contacts.length; i++) {
      const c = draft.contacts[i];
      checkMaxLength(c.honorificTitle, LEAD_LIMITS.honorific, `contacts.${i}.honorificTitle`, errors);
      checkMaxLength(c.jobTitle, LEAD_LIMITS.jobTitle, `contacts.${i}.jobTitle`, errors);

      if (c.phones.some((p) => p.trim() !== '') || !!c.email.trim()) {
        hasReach = true;
      }

      if (!c.contactPartyId) {
        if (!c.firstName.trim()) errors[`contacts.${i}.firstName`] = 'required';
        checkMaxLength(c.firstName, LEAD_LIMITS.name, `contacts.${i}.firstName`, errors);
        checkMaxLength(c.lastName, LEAD_LIMITS.name, `contacts.${i}.lastName`, errors);
      }

      validatePhoneList(c.phones, `contacts.${i}.phones`, errors, c.contactPartyId ? undefined : seenCorporatePhones);

      const cEmail = c.email.trim();
      if (cEmail) {
        if (cEmail.length > LEAD_LIMITS.email) errors[`contacts.${i}.email`] = 'tooLong';
        else if (!EMAIL_RE.test(cEmail)) errors[`contacts.${i}.email`] = 'emailInvalid';
        else if (!c.contactPartyId) {
          const lower = cEmail.toLowerCase();
          if (seenCorporateEmails.has(lower)) {
            errors[`contacts.${i}.email`] = 'leadForm.server.PARTY_DUPLICATE_CONTACT_METHOD';
          } else {
            seenCorporateEmails.add(lower);
          }
        }
      }
    }

    if (!hasReach) {
      errors['reach'] = 'reachRequired';
    }
  }

  if (draft.leadProfileType === 'INDIVIDUAL' || !draft.existingCompanyPartyId?.trim()) {
    checkMaxLength(draft.address.street1, LEAD_LIMITS.street1, 'address.street1', errors);
    checkMaxLength(draft.address.street2, LEAD_LIMITS.street2, 'address.street2', errors);
    checkMaxLength(draft.address.buildingNo, LEAD_LIMITS.building, 'address.buildingNo', errors);
    checkMaxLength(draft.address.floor, LEAD_LIMITS.floor, 'address.floor', errors);
    checkMaxLength(draft.address.landmark, LEAD_LIMITS.landmark, 'address.landmark', errors);
    checkMaxLength(draft.address.postalCode, LEAD_LIMITS.postal, 'address.postalCode', errors);
  }

  checkMaxLength(draft.description, LEAD_LIMITS.description, 'description', errors);
  checkMaxLength(draft.interestSummary, LEAD_LIMITS.longText, 'interestSummary', errors);
  checkMaxLength(draft.expectedNeed, LEAD_LIMITS.longText, 'expectedNeed', errors);

  const val = draft.expectedValue.trim();
  const cur = draft.currencyCode?.trim() ?? '';
  if (val) {
    if (!VALUE_RE.test(val)) {
      errors['expectedValue'] = 'valueInvalid';
    }
    if (!cur) {
      errors['currencyCode'] = 'valueCurrencyRequired';
    }
  } else if (cur) {
    errors['expectedValue'] = 'currencyValueRequired';
  }

  for (const cf of fields) {
    const required = mode === 'create' ? cf.requiredOnCreate : cf.requiredOnUpdate;
    const cfError = validateCustomField(cf, draft.customFields[cf.fieldKey], required);
    if (cfError) {
      errors[`customFields.${cf.fieldKey}`] = cfError;
    }
  }

  return errors;
}

function cleanPhones(phones: string[]): string[] {
  return phones.map((p) => p.trim()).filter((p) => p.length > 0);
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function buildCreateContact(contact: ContactDraft): CreateLeadContactBody {
  const honorificTitle = trimOrUndefined(contact.honorificTitle);
  const jobTitle = trimOrUndefined(contact.jobTitle);
  if (contact.contactPartyId) {
    const body: CreateLeadContactBody = {
      contactPartyId: contact.contactPartyId,
      isPrimary: contact.isPrimary,
    };
    if (jobTitle) body.jobTitle = jobTitle;
    if (honorificTitle) body.honorificTitle = honorificTitle;
    return body;
  }

  const phones = cleanPhones(contact.phones);
  const lastName = trimOrUndefined(contact.lastName);
  const email = trimOrUndefined(contact.email);
  const body: CreateLeadContactBody = {
    firstName: contact.firstName.trim(),
    isPrimary: contact.isPrimary,
  };
  if (honorificTitle) body.honorificTitle = honorificTitle;
  if (lastName) body.lastName = lastName;
  if (jobTitle) body.jobTitle = jobTitle;
  if (phones.length > 0) body.phones = phones;
  if (email) body.email = email;
  return body;
}

function buildCreateAddress(address: AddressDraft): LeadAddressBody | undefined {
  const out: LeadAddressBody = {};
  let hasAny = false;

  const set = <K extends keyof LeadAddressBody>(key: K, value: string | null | undefined) => {
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
  set('street1', address.street1);
  set('street2', address.street2);
  set('buildingNo', address.buildingNo);
  set('floor', address.floor);
  set('landmark', address.landmark);
  set('postalCode', address.postalCode);

  return hasAny ? out : undefined;
}

function buildFullAddress(address: AddressDraft): LeadAddressBody {
  return {
    countryId: trimOrNull(address.countryId),
    stateId: trimOrNull(address.stateId),
    cityId: trimOrNull(address.cityId),
    districtId: trimOrNull(address.districtId),
    street1: trimOrNull(address.street1),
    street2: trimOrNull(address.street2),
    buildingNo: trimOrNull(address.buildingNo),
    floor: trimOrNull(address.floor),
    landmark: trimOrNull(address.landmark),
    postalCode: trimOrNull(address.postalCode),
  };
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

export function toCreateBody(draft: LeadDraft): CreateLeadBody {
  const body: CreateLeadBody = {
    leadProfileType: draft.leadProfileType,
    rating: draft.rating,
  };

  const branchId = trimOrUndefined(draft.branchId);
  const stageId = trimOrUndefined(draft.stageId);
  const ownerUserId = trimOrUndefined(draft.ownerUserId);
  const acquisitionSourceId = trimOrUndefined(draft.acquisitionSourceId);
  if (branchId) body.branchId = branchId;
  if (stageId) body.stageId = stageId;
  if (ownerUserId) body.ownerUserId = ownerUserId;
  if (acquisitionSourceId) body.acquisitionSourceId = acquisitionSourceId;
  if (draft.tagIds.length > 0) body.tagIds = [...draft.tagIds];
  if (draft.cardColor !== null) body.cardColor = draft.cardColor;

  if (draft.leadProfileType === 'INDIVIDUAL') {
    const honorificTitle = trimOrUndefined(draft.honorificTitle);
    const firstName = trimOrUndefined(draft.firstName);
    const lastName = trimOrUndefined(draft.lastName);
    const phones = cleanPhones(draft.phones);
    const email = trimOrUndefined(draft.email);
    if (honorificTitle) body.honorificTitle = honorificTitle;
    if (firstName) body.firstName = firstName;
    if (lastName) body.lastName = lastName;
    if (phones.length > 0) body.phones = phones;
    if (email) body.email = email;
  } else {
    const existingCompanyPartyId = trimOrUndefined(draft.existingCompanyPartyId);
    if (existingCompanyPartyId) {
      body.existingCompanyPartyId = existingCompanyPartyId;
    } else {
      const companyName = trimOrUndefined(draft.companyName);
      const legalName = trimOrUndefined(draft.legalName);
      const taxNumber = trimOrUndefined(draft.taxNumber);
      const cr = trimOrUndefined(draft.commercialRegistrationNumber);
      const companyPhones = cleanPhones(draft.companyPhones);
      const companyEmail = trimOrUndefined(draft.companyEmail);
      const companyWebsite = trimOrUndefined(draft.companyWebsite);
      if (companyName) body.companyName = companyName;
      if (legalName) body.legalName = legalName;
      if (taxNumber) body.taxNumber = taxNumber;
      if (cr) body.commercialRegistrationNumber = cr;
      if (companyPhones.length > 0) body.companyPhones = companyPhones;
      if (companyEmail) body.companyEmail = companyEmail;
      if (companyWebsite) body.companyWebsite = companyWebsite;
    }
    body.contacts = draft.contacts.map(buildCreateContact);
  }

  if (draft.leadProfileType === 'INDIVIDUAL' || !trimOrUndefined(draft.existingCompanyPartyId)) {
    const address = buildCreateAddress(draft.address);
    if (address) body.address = address;
  }

  const description = trimOrUndefined(draft.description);
  const interestSummary = trimOrUndefined(draft.interestSummary);
  const expectedNeed = trimOrUndefined(draft.expectedNeed);
  if (description) body.description = description;
  if (interestSummary) body.interestSummary = interestSummary;
  if (expectedNeed) body.expectedNeed = expectedNeed;

  const expectedValue = trimOrUndefined(draft.expectedValue);
  const currencyCode = trimOrUndefined(draft.currencyCode);
  if (expectedValue && currencyCode) {
    body.expectedValue = expectedValue;
    body.currencyCode = currencyCode;
  }

  const customFields = cleanCustomFields(draft.customFields);
  if (customFields) body.customFields = customFields;

  return body;
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function contactSignature(c: ContactDraft, baseContact?: ContactDraft): CreateLeadContactBody {
  const honorificTitle = trimOrUndefined(c.honorificTitle);
  const jobTitle = trimOrUndefined(c.jobTitle);
  if (c.contactPartyId) {
    const out: CreateLeadContactBody = {
      contactPartyId: c.contactPartyId,
      isPrimary: c.isPrimary,
    };
    if (jobTitle) {
      out.jobTitle = jobTitle;
    } else if (baseContact && trimOrUndefined(baseContact.jobTitle)) {
      out.jobTitle = null;
    }
    if (honorificTitle) {
      out.honorificTitle = honorificTitle;
    } else if (baseContact && trimOrUndefined(baseContact.honorificTitle)) {
      out.honorificTitle = null;
    }
    return out;
  }
  const phones = cleanPhones(c.phones);
  const lastName = trimOrUndefined(c.lastName);
  const email = trimOrUndefined(c.email);
  const out: CreateLeadContactBody = {
    firstName: c.firstName.trim(),
    isPrimary: c.isPrimary,
  };
  if (honorificTitle) out.honorificTitle = honorificTitle;
  if (lastName) out.lastName = lastName;
  if (jobTitle) out.jobTitle = jobTitle;
  if (phones.length > 0) out.phones = phones;
  if (email) out.email = email;
  return out;
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

function addressesEqual(a: AddressDraft, b: AddressDraft): boolean {
  return (
    trimOrNull(a.countryId) === trimOrNull(b.countryId) &&
    trimOrNull(a.stateId) === trimOrNull(b.stateId) &&
    trimOrNull(a.cityId) === trimOrNull(b.cityId) &&
    trimOrNull(a.districtId) === trimOrNull(b.districtId) &&
    a.street1.trim() === b.street1.trim() &&
    a.street2.trim() === b.street2.trim() &&
    a.buildingNo.trim() === b.buildingNo.trim() &&
    a.floor.trim() === b.floor.trim() &&
    a.landmark.trim() === b.landmark.trim() &&
    a.postalCode.trim() === b.postalCode.trim()
  );
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

export function toPatchBody(base: LeadDraft, draft: LeadDraft, expectedUpdatedAt: string): UpdateLeadBody {
  const body: UpdateLeadBody = { expectedUpdatedAt };

  const patchNullable = (
    key:
      | 'acquisitionSourceId'
      | 'honorificTitle'
      | 'lastName'
      | 'email'
      | 'legalName'
      | 'taxNumber'
      | 'commercialRegistrationNumber'
      | 'companyEmail'
      | 'companyWebsite'
      | 'description'
      | 'interestSummary'
      | 'expectedNeed'
      | 'expectedValue'
      | 'currencyCode',
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
  patchNullable('acquisitionSourceId', base.acquisitionSourceId, draft.acquisitionSourceId);
  if (!stringArraysEqual(base.tagIds, draft.tagIds)) {
    body.tagIds = [...draft.tagIds];
  }
  if (base.rating !== draft.rating) {
    body.rating = draft.rating;
  }
  if (base.cardColor !== draft.cardColor) {
    body.cardColor = draft.cardColor;
  }

  if (draft.leadProfileType === 'INDIVIDUAL') {
    patchNullable('honorificTitle', base.honorificTitle, draft.honorificTitle);
    if (base.firstName.trim() !== draft.firstName.trim()) {
      body.firstName = draft.firstName.trim();
    }
    patchNullable('lastName', base.lastName, draft.lastName);
    const basePhones = cleanPhones(base.phones);
    const draftPhones = cleanPhones(draft.phones);
    if (!stringArraysEqual(basePhones, draftPhones)) {
      body.phones = draftPhones;
    }
    patchNullable('email', base.email, draft.email);
  } else {
    const isExistingCompany = !!draft.existingCompanyPartyId?.trim();
    if (!isExistingCompany) {
      if (base.companyName.trim() !== draft.companyName.trim()) {
        body.companyName = draft.companyName.trim();
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

    if (!contactsEqual(base.contacts, draft.contacts)) {
      const baseByPartyId = new Map(
        base.contacts.filter((c) => !!c.contactPartyId).map((c) => [c.contactPartyId!, c]),
      );
      body.contacts = draft.contacts.map((c) =>
        contactSignature(c, c.contactPartyId ? baseByPartyId.get(c.contactPartyId) : undefined),
      );
    }
  }

  if (draft.leadProfileType === 'INDIVIDUAL' || !draft.existingCompanyPartyId?.trim()) {
    if (!addressesEqual(base.address, draft.address)) {
      body.address = buildFullAddress(draft.address);
    }
  }

  patchNullable('description', base.description, draft.description);
  patchNullable('interestSummary', base.interestSummary, draft.interestSummary);
  patchNullable('expectedNeed', base.expectedNeed, draft.expectedNeed);
  patchNullable('expectedValue', base.expectedValue, draft.expectedValue);
  patchNullable('currencyCode', base.currencyCode, draft.currencyCode);

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

export function draftsEqual(a: LeadDraft, b: LeadDraft): boolean {
  return (
    a.leadProfileType === b.leadProfileType &&
    trimOrNull(a.branchId) === trimOrNull(b.branchId) &&
    trimOrNull(a.stageId) === trimOrNull(b.stageId) &&
    trimOrNull(a.ownerUserId) === trimOrNull(b.ownerUserId) &&
    trimOrNull(a.acquisitionSourceId) === trimOrNull(b.acquisitionSourceId) &&
    stringArraysEqual(a.tagIds, b.tagIds) &&
    a.rating === b.rating &&
    a.cardColor === b.cardColor &&
    a.honorificTitle.trim() === b.honorificTitle.trim() &&
    a.firstName.trim() === b.firstName.trim() &&
    a.lastName.trim() === b.lastName.trim() &&
    stringArraysEqual(cleanPhones(a.phones), cleanPhones(b.phones)) &&
    a.email.trim() === b.email.trim() &&
    trimOrNull(a.existingCompanyPartyId) === trimOrNull(b.existingCompanyPartyId) &&
    trimOrNull(a.existingCompanyName) === trimOrNull(b.existingCompanyName) &&
    a.companyName.trim() === b.companyName.trim() &&
    a.legalName.trim() === b.legalName.trim() &&
    a.taxNumber.trim() === b.taxNumber.trim() &&
    a.commercialRegistrationNumber.trim() === b.commercialRegistrationNumber.trim() &&
    stringArraysEqual(cleanPhones(a.companyPhones), cleanPhones(b.companyPhones)) &&
    a.companyEmail.trim() === b.companyEmail.trim() &&
    a.companyWebsite.trim() === b.companyWebsite.trim() &&
    contactsEqual(a.contacts, b.contacts) &&
    addressesEqual(a.address, b.address) &&
    a.description.trim() === b.description.trim() &&
    a.interestSummary.trim() === b.interestSummary.trim() &&
    a.expectedNeed.trim() === b.expectedNeed.trim() &&
    a.expectedValue.trim() === b.expectedValue.trim() &&
    trimOrNull(a.currencyCode) === trimOrNull(b.currencyCode) &&
    customFieldsEqual(a.customFields, b.customFields)
  );
}
