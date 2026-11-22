import { TranslocoService } from '@jsverse/transloco';
import { errorCodeOf, errorMessage } from '../../../staff/shared/staff.api';
import { StaffSession } from '../../../staff/shared/staff-session';
import { TenantUser } from '../../../staff/shared/staff.model';
import {
  AddressType,
  ContactMethodType,
  PartyAddress,
  PartyRoleType,
  PartyStatus,
  RelationshipType,
} from '../party-directory.model';

export const PARTY_LIMITS = {
  displayName: 200,
  legalName: 240,
  firstName: 120,
  lastName: 120,
  honorificTitle: 40,
  organizationName: 200,
  taxNumber: 80,
  commercialRegistrationNumber: 80,
  contactValue: 255,
  contactLabel: 80,
  addressLabel: 80,
  country: 120,
  city: 120,
  area: 120,
  street: 160,
  buildingNo: 80,
  floor: 80,
  apartment: 80,
  landmark: 160,
  postalCode: 40,
  relationshipLabel: 120,
  imageMaxBytes: 2 * 1024 * 1024,
  createContactsCap: 3,
  defaultMaxContacts: 20,
  defaultMaxAddresses: 20,
} as const;

export const PARTY_STATUSES: readonly PartyStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

export const CONTACT_METHOD_TYPES: readonly ContactMethodType[] = [
  'MOBILE',
  'PHONE',
  'EMAIL',
  'WHATSAPP',
  'WEBSITE',
  'OTHER',
];

export const ADDRESS_TYPES: readonly AddressType[] = [
  'WORK',
  'HOME',
  'BILLING',
  'SHIPPING',
  'LEGAL',
  'OTHER',
];

export const PARTY_ROLE_TYPES: readonly PartyRoleType[] = [
  'CUSTOMER',
  'SUPPLIER',
  'EMPLOYEE',
  'LEAD',
  'SHIPPING_RECIPIENT',
  'CONTACT_PERSON',
  'BILLING_CONTACT',
  'LEGAL_ENTITY',
  'GUARANTOR',
  'PARTNER',
];

export const ORG_RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  'CONTACT_PERSON',
  'BILLING_CONTACT',
  'LEGAL_CONTACT',
];

export const PARTY_STATUS_BADGE: Record<PartyStatus, string> = {
  ACTIVE: 'bg-success text-on-success',
  INACTIVE: 'bg-neutral-soft text-text-muted',
  BLOCKED: 'bg-danger text-on-danger',
};

export const CONTACT_TYPE_META: Record<
  ContactMethodType,
  { icon: string; tile: string; isPhone: boolean; ltr: boolean }
> = {
  MOBILE: { icon: 'tablerPhone', tile: 'bg-icon-green', isPhone: true, ltr: true },
  PHONE: { icon: 'tablerPhone', tile: 'bg-icon-teal', isPhone: true, ltr: true },
  WHATSAPP: { icon: 'tablerBrandWhatsapp', tile: 'bg-icon-green', isPhone: true, ltr: true },
  EMAIL: { icon: 'tablerMail', tile: 'bg-icon-blue', isPhone: false, ltr: true },
  WEBSITE: { icon: 'tablerWorld', tile: 'bg-icon-teal', isPhone: false, ltr: true },
  OTHER: { icon: 'tablerMessage', tile: 'bg-icon-gray', isPhone: false, ltr: false },
};

export interface PartyDirectoryLimits {
  maxContactMethodsPerParty: number;
  maxAddressesPerParty: number;
}

export const DEFAULT_PARTY_LIMITS: PartyDirectoryLimits = {
  maxContactMethodsPerParty: PARTY_LIMITS.defaultMaxContacts,
  maxAddressesPerParty: PARTY_LIMITS.defaultMaxAddresses,
};

export interface EditableModalTab {
  dirty(): boolean;
  saving(): boolean;
  save(): Promise<boolean>;
  undo(): void;
}

const PHONE_VALUE_PATTERN = /^\+?[0-9 ().-]+$/;
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canOnPartyBranch(
  session: StaffSession,
  permission: string,
  branchId: string | null,
): boolean {
  return branchId === null ? session.isTenantWide(permission) : session.can(permission, { branchId });
}

export function composePersonDisplayName(title: string, first: string, last: string): string {
  return [title.trim(), first.trim(), last.trim()].filter(Boolean).join(' ');
}

export function formatAddressOneLine(address: PartyAddress): string {
  const primary = [
    address.street,
    address.buildingNo,
    address.area,
    address.city,
    address.country,
  ]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean);
  if (primary.length > 0) return primary.join(', ');

  const secondary = [address.floor, address.apartment, address.landmark, address.postalCode]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean);
  return secondary.length > 0 ? secondary.join(', ') : '—';
}

export function validateContactValue(type: ContactMethodType, raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || Array.from(trimmed).length > PARTY_LIMITS.contactValue) return false;
  switch (type) {
    case 'EMAIL':
      return EMAIL_VALUE_PATTERN.test(trimmed);
    case 'WEBSITE': {
      if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
      try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }
    case 'PHONE':
    case 'MOBILE':
    case 'WHATSAPP':
      return PHONE_VALUE_PATTERN.test(trimmed) && /\d/.test(trimmed);
    case 'OTHER':
      return true;
  }
}

export function normalizeContactForCompare(type: ContactMethodType, raw: string): string {
  const trimmed = raw.trim();
  if (type === 'EMAIL') return trimmed.toLowerCase();
  if (type === 'PHONE' || type === 'MOBILE' || type === 'WHATSAPP') {
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D+/g, '');
    return hasPlus ? `+${digits}` : digits;
  }
  return trimmed;
}

export function safeWebsiteHref(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * A role is owned by another app only when app_source is set and is not core-app
 * (DirectoryService.deleteRole; a NULL app_source is core-manageable).
 */
export function isAppManagedRole(appSource: string | null): boolean {
  return appSource !== null && appSource !== 'core-app';
}

export function appSourceLabel(appSource: string | null, transloco: TranslocoService): string {
  if (appSource === null || appSource === 'core-app') return transloco.translate('wsPartyModal.roles.sourceCore');
  if (appSource === 'crm-app') return 'CRM';
  const stripped = appSource.replace(/-app$/i, '').trim();
  return stripped ? stripped.toUpperCase() : appSource;
}

export function tenantUserName(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const full = `${user.firstName} ${user.lastName}`.trim();
  return full || user.email;
}

export function resolvePartyError(error: unknown, transloco: TranslocoService): string {
  const code = errorCodeOf(error);
  if (code) {
    const listKey = `wsParty.errors.${code}`;
    const listMsg = transloco.translate(listKey);
    if (listMsg && listMsg !== listKey) return listMsg;

    const modalKey = `wsPartyModal.errors.${code}`;
    const modalMsg = transloco.translate(modalKey);
    if (modalMsg && modalMsg !== modalKey) return modalMsg;
  }
  return errorMessage(error, 'wsParty', transloco);
}
