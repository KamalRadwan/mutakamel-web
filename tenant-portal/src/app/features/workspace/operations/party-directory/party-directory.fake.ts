import { ApiError } from '../../../../core/api/api-errors';
import { listAllPages, listBranches, listUsers, newIdempotencyKey } from '../../staff/shared/staff.api';
import { DIRECTORY_SETTINGS_LIMITS } from '../directory-settings/directory-settings.model';
import { fakeGetDirectorySettings as fakeGetSharedDirectorySettings, peekDirectorySettings } from '../directory-settings/directory-settings.fake';
import { fakeActorMe } from '../shared/fake-actor';
import {
  ADDRESS_TYPES,
  AddressType,
  CONTACT_METHOD_TYPES,
  ContactMethodType,
  CreateAddressBody,
  CreateContactMethodBody,
  CreatePartyBody,
  CreateRelationshipBody,
  CreateRoleBody,
  DirectorySettings,
  OrgContact,
  OrgContactPhone,
  PARTY_LIMITS,
  PARTY_ROLE_TYPES,
  PARTY_STATUSES,
  PARTY_TYPES,
  Page,
  PartyAddress,
  PartyBase,
  PartyContactMethod,
  PartyDetail,
  PartyListContactMethod,
  PartyListItem,
  PartyListRole,
  PageMeta,
  PartyRelationship,
  PartyRole,
  PartyRoleType,
  PartySortBy,
  PartyStatus,
  PartyType,
  RELATIONSHIP_TYPES,
  RelationshipType,
  SortDir,
  UpdateAddressBody,
  UpdateContactMethodBody,
  UpdatePartyBody,
  ListOrgContactsQuery,
  ListPartiesQuery,
} from './party-directory.model';

interface DirectoryStore {
  parties: PartyBase[];
  contactMethods: PartyContactMethod[];
  addresses: PartyAddress[];
  roles: PartyRole[];
  relationships: PartyRelationship[];
  images: Map<string, string>;
}

const VALID_SORT_BY = new Set<PartySortBy>(['displayName', 'createdAt', 'updatedAt']);
const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ().-]+$/;
const ORG_CONTACT_REL_TYPES = new Set<RelationshipType>(['CONTACT_PERSON', 'BILLING_CONTACT', 'LEGAL_CONTACT']);

function fakeDelay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function partyUuid(index: number): string {
  return `018f1000-0000-7000-8000-${String(index).padStart(12, '0')}`;
}

function childUuid(prefix: number, index: number): string {
  return `018f2${String(prefix).padStart(3, '0')}-0000-7000-8000-${String(index).padStart(12, '0')}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertMaxLength(value: string | null, max: number): void {
  if (value !== null && Array.from(value).length > max) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
}

function makeAvatarSvgDataUrl(initials: string, bg: string, isOrg: boolean): string {
  const safeText = initials.replace(/[<>&"']/g, '');
  const shape = isOrg
    ? `<rect x="4" y="4" width="56" height="56" rx="12" fill="${bg}"/><rect x="12" y="12" width="40" height="40" rx="8" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>`
    : `<rect x="0" y="0" width="64" height="64" rx="14" fill="${bg}"/><circle cx="32" cy="24" r="10" fill="rgba(255,255,255,0.22)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${shape}<text x="32" y="40" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="#ffffff">${safeText}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function normalizeAndValidateContact(
  methodType: ContactMethodType,
  rawValue: string,
): { value: string; normalizedValue: string; phoneDigits: string | null } {
  const trimmed = rawValue.trim();
  if (!trimmed || Array.from(trimmed).length > PARTY_LIMITS.contactValue) {
    throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
  }

  switch (methodType) {
    case 'EMAIL': {
      if (!EMAIL_PATTERN.test(trimmed)) {
        throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
      }
      return { value: trimmed, normalizedValue: trimmed.toLowerCase(), phoneDigits: null };
    }
    case 'WEBSITE': {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
        }
      } catch {
        throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
      }
      return { value: trimmed, normalizedValue: trimmed.toLowerCase(), phoneDigits: null };
    }
    case 'PHONE':
    case 'MOBILE':
    case 'WHATSAPP': {
      if (!PHONE_PATTERN.test(trimmed) || !/\d/.test(trimmed)) {
        throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
      }
      const digits = trimmed.replace(/\D/g, '');
      if (!digits) {
        throw new ApiError(400, 'PARTY_CONTACT_VALUE_INVALID');
      }
      const normalizedValue = trimmed.startsWith('+') ? `+${digits}` : digits;
      const phoneDigits = digits.replace(/^00/, '') || digits;
      return { value: trimmed, normalizedValue, phoneDigits };
    }
    case 'OTHER':
      return { value: trimmed, normalizedValue: trimmed.toLowerCase(), phoneDigits: null };
  }
}

function validateFlatMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (metadata === undefined || metadata === null) return {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ApiError(422, 'PARTY_ROLE_METADATA_INVALID');
  }
  for (const val of Object.values(metadata)) {
    if (val !== null && typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
      throw new ApiError(422, 'PARTY_ROLE_METADATA_INVALID');
    }
  }
  const encoded = new TextEncoder().encode(JSON.stringify(metadata));
  if (encoded.byteLength > PARTY_LIMITS.roleMetadataBytes) {
    throw new ApiError(422, 'PARTY_ROLE_METADATA_INVALID');
  }
  return { ...metadata };
}

interface SeedPartySpec {
  idx: number;
  partyType: PartyType;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  honorificTitle?: string | null;
  organizationName?: string | null;
  legalName?: string | null;
  taxNumber?: string | null;
  crNumber?: string | null;
  branchId: string | null;
  ownerUserId: string | null;
  status: PartyStatus;
  daysAgoCreated: number;
  daysAgoUpdated: number;
  roles: { roleType: PartyRoleType; branchId: string | null; appSource?: string; status?: PartyStatus }[];
  contacts: { methodType: ContactMethodType; value: string; label?: string | null; isPrimary?: boolean }[];
  addresses?: {
    addressType: AddressType;
    country: string;
    city: string;
    area?: string;
    street: string;
    buildingNo?: string;
    postalCode?: string;
    isPrimary?: boolean;
  }[];
  image?: { initials: string; bg: string };
}

// ---------------------------------------------------------------------------
// Request validation, mirroring Core's global ValidationPipe (whitelist,
// forbidNonWhitelisted, trim transforms) and coreValidationException: a 400
// CORE_VALIDATION_FAILED whose details are keyed by field path, each holding the
// failed class-validator constraints in lowercase snake_case.
// ---------------------------------------------------------------------------

type Rule =
  | { type: 'string'; max: number; required?: boolean; notEmpty?: boolean }
  | { type: 'enum'; values: readonly string[]; required?: boolean }
  | { type: 'boolean' }
  /** IsUUID('7'). Seeded branch/user ids are slugs in the fakes, so only the type is checked. */
  | { type: 'id'; required?: boolean }
  | { type: 'int'; min: number; max?: number }
  | { type: 'object' }
  | { type: 'array'; max: number; item: Schema; unique?: (item: Record<string, unknown>) => string };
type Schema = Readonly<Record<string, Rule>>;
type FieldErrors = Record<string, string[]>;

const CONTACT_METHOD_SCHEMA: Schema = {
  methodType: { type: 'enum', values: CONTACT_METHOD_TYPES, required: true },
  value: { type: 'string', max: PARTY_LIMITS.contactValue, required: true, notEmpty: true },
  label: { type: 'string', max: PARTY_LIMITS.contactLabel },
  isPrimary: { type: 'boolean' },
};
const UPDATE_CONTACT_METHOD_SCHEMA: Schema = {
  ...CONTACT_METHOD_SCHEMA,
  methodType: { type: 'enum', values: CONTACT_METHOD_TYPES },
  value: { type: 'string', max: PARTY_LIMITS.contactValue, notEmpty: true },
};
const ADDRESS_SCHEMA: Schema = {
  addressType: { type: 'enum', values: ADDRESS_TYPES, required: true },
  label: { type: 'string', max: PARTY_LIMITS.addressLabel },
  country: { type: 'string', max: PARTY_LIMITS.addressCountry },
  city: { type: 'string', max: PARTY_LIMITS.addressCity },
  area: { type: 'string', max: PARTY_LIMITS.addressArea },
  street: { type: 'string', max: PARTY_LIMITS.addressStreet },
  buildingNo: { type: 'string', max: PARTY_LIMITS.addressBuildingNo },
  floor: { type: 'string', max: PARTY_LIMITS.addressFloor },
  apartment: { type: 'string', max: PARTY_LIMITS.addressApartment },
  landmark: { type: 'string', max: PARTY_LIMITS.addressLandmark },
  postalCode: { type: 'string', max: PARTY_LIMITS.addressPostalCode },
  isPrimary: { type: 'boolean' },
};
const UPDATE_ADDRESS_SCHEMA: Schema = {
  ...ADDRESS_SCHEMA,
  addressType: { type: 'enum', values: ADDRESS_TYPES },
};
const ROLE_SCHEMA: Schema = {
  roleType: { type: 'enum', values: PARTY_ROLE_TYPES, required: true },
  branchId: { type: 'id' },
  metadata: { type: 'object' },
};
const PARTY_FIELDS_SCHEMA: Schema = {
  legalName: { type: 'string', max: PARTY_LIMITS.legalName },
  firstName: { type: 'string', max: PARTY_LIMITS.firstName },
  lastName: { type: 'string', max: PARTY_LIMITS.lastName },
  honorificTitle: { type: 'string', max: PARTY_LIMITS.honorificTitle },
  organizationName: { type: 'string', max: PARTY_LIMITS.organizationName },
  taxNumber: { type: 'string', max: PARTY_LIMITS.taxNumber },
  commercialRegistrationNumber: { type: 'string', max: PARTY_LIMITS.commercialRegistrationNumber },
  branchId: { type: 'id' },
  ownerUserId: { type: 'id' },
};
const CREATE_PARTY_SCHEMA: Schema = {
  partyType: { type: 'enum', values: PARTY_TYPES, required: true },
  displayName: { type: 'string', max: PARTY_LIMITS.displayName, required: true, notEmpty: true },
  ...PARTY_FIELDS_SCHEMA,
  roles: {
    type: 'array',
    max: PARTY_LIMITS.maxRolesPerParty,
    item: ROLE_SCHEMA,
    unique: (role) => `${String(role['roleType'])}:${typeof role['branchId'] === 'string' ? role['branchId'] : ''}`,
  },
  contactMethods: { type: 'array', max: DIRECTORY_SETTINGS_LIMITS.max, item: CONTACT_METHOD_SCHEMA },
  addresses: { type: 'array', max: DIRECTORY_SETTINGS_LIMITS.max, item: ADDRESS_SCHEMA },
};
const UPDATE_PARTY_SCHEMA: Schema = {
  displayName: { type: 'string', max: PARTY_LIMITS.displayName, notEmpty: true },
  ...PARTY_FIELDS_SCHEMA,
  status: { type: 'enum', values: PARTY_STATUSES },
};
const RELATIONSHIP_SCHEMA: Schema = {
  fromPartyId: { type: 'id', required: true },
  toPartyId: { type: 'id', required: true },
  relationshipType: { type: 'enum', values: RELATIONSHIP_TYPES, required: true },
  label: { type: 'string', max: PARTY_LIMITS.relationshipLabel },
  isPrimary: { type: 'boolean' },
};
/** PaginationQueryDto (page, limit <= 100, sortBy, sortDir, search <= 200). */
const PAGINATION_SCHEMA: Schema = {
  page: { type: 'int', min: 1 },
  limit: { type: 'int', min: 1, max: PARTY_LIMITS.pageSize },
  sortBy: { type: 'string', max: 100 },
  sortDir: { type: 'enum', values: ['ASC', 'DESC'] },
  search: { type: 'string', max: PARTY_LIMITS.search },
};
const PARTY_QUERY_SCHEMA: Schema = {
  ...PAGINATION_SCHEMA,
  partyType: { type: 'enum', values: PARTY_TYPES },
  status: { type: 'enum', values: PARTY_STATUSES },
  roleType: { type: 'enum', values: PARTY_ROLE_TYPES },
  branchId: { type: 'id' },
  ownerUserId: { type: 'id' },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinPath(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

function addError(out: FieldErrors, path: string, constraint: string): void {
  (out[path] ??= []).push(constraint);
}

function missingConstraints(rule: Rule): string[] {
  switch (rule.type) {
    case 'string':
      return ['is_string', ...(rule.notEmpty ? ['is_not_empty'] : []), 'max_length'];
    case 'enum':
      return ['is_enum'];
    case 'id':
      return ['is_uuid'];
    default:
      return [];
  }
}

function checkRule(rule: Rule, value: unknown, path: string, out: FieldErrors): void {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') {
        addError(out, path, 'is_string');
        return;
      }
      const trimmed = value.trim();
      if (rule.notEmpty && trimmed.length === 0) addError(out, path, 'is_not_empty');
      if (Array.from(trimmed).length > rule.max) addError(out, path, 'max_length');
      return;
    }
    case 'enum':
      if (typeof value !== 'string' || !rule.values.includes(value)) addError(out, path, 'is_enum');
      return;
    case 'boolean':
      if (typeof value !== 'boolean') addError(out, path, 'is_boolean');
      return;
    case 'id':
      if (typeof value !== 'string' || value.length === 0) addError(out, path, 'is_uuid');
      return;
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        addError(out, path, 'is_int');
        return;
      }
      if (value < rule.min) addError(out, path, 'min');
      if (rule.max !== undefined && value > rule.max) addError(out, path, 'max');
      return;
    case 'object':
      if (!isPlainRecord(value)) addError(out, path, 'is_object');
      return;
    case 'array': {
      if (!Array.isArray(value)) {
        addError(out, path, 'is_array');
        return;
      }
      if (value.length > rule.max) addError(out, path, 'array_max_size');
      const unique = rule.unique;
      if (unique) {
        const keys = value.map((item) => (isPlainRecord(item) ? unique(item) : String(item)));
        if (new Set(keys).size !== keys.length) addError(out, path, 'array_unique');
      }
      value.forEach((item, index) => {
        const itemPath = `${path}.${index}`;
        if (!isPlainRecord(item)) {
          addError(out, itemPath, 'nested_validation');
          return;
        }
        collectErrors(rule.item, item, itemPath, out);
      });
      return;
    }
  }
}

function collectErrors(schema: Schema, value: Record<string, unknown>, prefix: string, out: FieldErrors): void {
  for (const key of Object.keys(value)) {
    if (!(key in schema)) addError(out, joinPath(prefix, key), 'whitelist_validation');
  }
  for (const [key, rule] of Object.entries(schema)) {
    const path = joinPath(prefix, key);
    const fieldValue = value[key];
    if (fieldValue === undefined || fieldValue === null) {
      if ('required' in rule && rule.required) {
        for (const constraint of missingConstraints(rule)) addError(out, path, constraint);
      }
      continue;
    }
    checkRule(rule, fieldValue, path, out);
  }
}

/** Throws the ValidationPipe 400 for a body or query that breaks its DTO. */
function validateDto(schema: Schema, value: unknown): void {
  const out: FieldErrors = {};
  if (!isPlainRecord(value)) {
    addError(out, '_', 'nested_validation');
  } else {
    collectErrors(schema, value, '', out);
  }
  if (Object.keys(out).length > 0) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', out);
  }
}

/** Drops undefined query values the way a URL query string would. */
function definedQuery(q: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(q).filter(([, value]) => value !== undefined));
}

/**
 * Core's global PermissionsGuard (common/guards/permissions.guard.ts) runs
 * before validation and the service: a caller with no grant of the route
 * permission at any scope gets 403 MISSING_REQUIRED_PERMISSIONS.
 */
function requirePermissionGuard(permission: string): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  if (!me.permissions.includes(permission) && !me.permissionScopes[permission]) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { permissions: [permission] });
  }
}

function isoDaysAgo(days: number): string {
  const base = Date.UTC(2026, 10, 21, 10, 0, 0) - days * 86_400_000;
  return new Date(base).toISOString();
}

function createSeedStore(): DirectoryStore {
  const specs: SeedPartySpec[] = [
    {
      idx: 1,
      partyType: 'ORGANIZATION',
      displayName: 'Nile Delta Trading Co.',
      organizationName: 'Nile Delta Trading Co.',
      legalName: 'Nile Delta Trading S.A.E.',
      taxNumber: '301-884-210',
      crNumber: 'CR-EG-11420',
      branchId: 'br-cai',
      ownerUserId: 'u-mona',
      status: 'ACTIVE',
      daysAgoCreated: 95,
      daysAgoUpdated: 2,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'PARTNER', branchId: null },
        { roleType: 'LEGAL_ENTITY', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201005550101', label: 'Procurement desk', isPrimary: true },
        { methodType: 'PHONE', value: '+20225550101', label: 'Head office', isPrimary: true },
        { methodType: 'EMAIL', value: 'orders@niledelta.example.com', label: 'Orders', isPrimary: true },
        { methodType: 'WEBSITE', value: 'https://niledelta.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'LEGAL',
          country: 'Egypt',
          city: 'Cairo',
          area: 'Nasr City',
          street: 'Abbas El Akkad St',
          buildingNo: '48',
          postalCode: '11371',
          isPrimary: true,
        },
        {
          addressType: 'SHIPPING',
          country: 'Egypt',
          city: 'Cairo',
          area: '10th of Ramadan',
          street: 'Industrial Zone B2',
          buildingNo: '14',
          isPrimary: true,
        },
      ],
      image: { initials: 'ND', bg: '#0f2f78' },
    },
    {
      idx: 2,
      partyType: 'ORGANIZATION',
      displayName: 'شركة النيل للتوريدات الهندسية',
      organizationName: 'شركة النيل للتوريدات الهندسية',
      legalName: 'شركة النيل للتوريدات الهندسية ش.م.م',
      taxNumber: '412-905-118',
      crNumber: 'CR-EG-29811',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 88,
      daysAgoUpdated: 4,
      roles: [
        { roleType: 'SUPPLIER', branchId: 'br-cai' },
        { roleType: 'SHIPPING_RECIPIENT', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'PHONE', value: '+20227741102', label: 'المبيعات', isPrimary: true },
        { methodType: 'EMAIL', value: 'sales@nile-eng.example.com', label: 'المبيعات', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'WORK',
          country: 'Egypt',
          city: 'Giza',
          area: 'Smart Village',
          street: 'Building B104',
          postalCode: '12577',
          isPrimary: true,
        },
      ],
    },
    {
      idx: 3,
      partyType: 'PERSON',
      displayName: 'أحمد عبد الرحمن منصور',
      honorificTitle: 'أ.',
      firstName: 'أحمد',
      lastName: 'منصور',
      branchId: 'br-cai',
      ownerUserId: 'u-mona',
      status: 'ACTIVE',
      daysAgoCreated: 86,
      daysAgoUpdated: 1,
      roles: [
        { roleType: 'CONTACT_PERSON', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'BILLING_CONTACT', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201012340003', label: 'العمل', isPrimary: true },
        { methodType: 'EMAIL', value: 'ahmed.mansour@niledelta.example.com', isPrimary: true },
        { methodType: 'WHATSAPP', value: '+201012340003', isPrimary: true },
      ],
      image: { initials: 'أم', bg: '#1d56c9' },
    },
    {
      idx: 4,
      partyType: 'PERSON',
      displayName: 'Layla Hassan El-Sharif',
      honorificTitle: 'Ms.',
      firstName: 'Layla',
      lastName: 'El-Sharif',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 82,
      daysAgoUpdated: 3,
      roles: [
        { roleType: 'LEAD', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'CONTACT_PERSON', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201122330004', isPrimary: true },
        { methodType: 'EMAIL', value: 'layla.sharif@example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'HOME',
          country: 'Egypt',
          city: 'Cairo',
          area: 'Maadi',
          street: 'Road 9',
          buildingNo: '22',
          isPrimary: true,
        },
      ],
      image: { initials: 'LE', bg: '#0b7a85' },
    },
    {
      idx: 5,
      partyType: 'ORGANIZATION',
      displayName: 'Horizon Medical Supplies',
      organizationName: 'Horizon Medical Supplies',
      legalName: 'Horizon Healthcare Supplies LLC',
      taxNumber: '310445901200003',
      crNumber: 'CR-SA-40129',
      branchId: 'br-ruh',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 79,
      daysAgoUpdated: 5,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-ruh', appSource: 'crm-app' },
        { roleType: 'SUPPLIER', branchId: 'br-ruh' },
        { roleType: 'SHIPPING_RECIPIENT', branchId: 'br-ruh' },
        { roleType: 'GUARANTOR', branchId: null },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966501110005', label: 'Direct', isPrimary: true },
        { methodType: 'PHONE', value: '+966114440005', label: 'Reception', isPrimary: true },
        { methodType: 'EMAIL', value: 'procurement@horizonmed.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'BILLING',
          country: 'Saudi Arabia',
          city: 'Riyadh',
          area: 'Al Olaya',
          street: 'King Fahd Rd',
          buildingNo: '712',
          postalCode: '12214',
          isPrimary: true,
        },
      ],
      image: { initials: 'HM', bg: '#067d4d' },
    },
    {
      idx: 6,
      partyType: 'PERSON',
      displayName: 'د. طارق حسن العتيبي',
      honorificTitle: 'د.',
      firstName: 'طارق',
      lastName: 'العتيبي',
      branchId: 'br-ruh',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 76,
      daysAgoUpdated: 6,
      roles: [{ roleType: 'CONTACT_PERSON', branchId: 'br-ruh' }],
      contacts: [
        { methodType: 'MOBILE', value: '+966552220006', isPrimary: true },
        { methodType: 'EMAIL', value: 'tariq.otaibi@horizonmed.example.com', isPrimary: true },
      ],
    },
    {
      idx: 7,
      partyType: 'ORGANIZATION',
      displayName: 'مؤسسة الرواد للتجارة والتوزيع',
      organizationName: 'مؤسسة الرواد للتجارة والتوزيع',
      legalName: 'مؤسسة الرواد التجارية',
      taxNumber: '300987654300003',
      crNumber: 'CR-SA-88210',
      branchId: 'br-jed',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 74,
      daysAgoUpdated: 7,
      roles: [
        { roleType: 'SUPPLIER', branchId: 'br-jed' },
        { roleType: 'PARTNER', branchId: 'br-jed' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966503330007', isPrimary: true },
        { methodType: 'EMAIL', value: 'info@alrowad.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'WORK',
          country: 'Saudi Arabia',
          city: 'Jeddah',
          area: 'Al Rawdah',
          street: 'Prince Saud Al Faisal St',
          buildingNo: '19',
          postalCode: '23434',
          isPrimary: true,
        },
      ],
    },
    {
      idx: 8,
      partyType: 'PERSON',
      displayName: 'Karim Mohamed El-Gendy',
      honorificTitle: 'Eng.',
      firstName: 'Karim',
      lastName: 'El-Gendy',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'ACTIVE',
      daysAgoCreated: 70,
      daysAgoUpdated: 2,
      roles: [{ roleType: 'EMPLOYEE', branchId: 'br-alx' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201224440008', isPrimary: true },
        { methodType: 'EMAIL', value: 'karim.elgendy@example.com', isPrimary: true },
      ],
      image: { initials: 'KE', bg: '#6b3fc4' },
    },
    {
      idx: 9,
      partyType: 'ORGANIZATION',
      displayName: 'Atlas Maritime Logistics LLC',
      organizationName: 'Atlas Maritime Logistics LLC',
      legalName: 'Atlas Maritime & Freight Logistics LLC',
      taxNumber: '204-551-909',
      crNumber: 'CR-EG-77310',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'ACTIVE',
      daysAgoCreated: 68,
      daysAgoUpdated: 8,
      roles: [
        { roleType: 'SUPPLIER', branchId: 'br-alx' },
        { roleType: 'SHIPPING_RECIPIENT', branchId: 'br-alx' },
        { roleType: 'CUSTOMER', branchId: 'br-alx', appSource: 'crm-app' },
      ],
      contacts: [
        { methodType: 'PHONE', value: '+2034801009', label: 'Port desk', isPrimary: true },
        { methodType: 'EMAIL', value: 'dispatch@atlas-logistics.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'SHIPPING',
          country: 'Egypt',
          city: 'Alexandria',
          area: 'Smouha',
          street: 'Fawzy Moaz St',
          buildingNo: '105',
          isPrimary: true,
        },
      ],
      image: { initials: 'AM', bg: '#0f2f78' },
    },
    {
      idx: 10,
      partyType: 'PERSON',
      displayName: 'سارة محمود الشريف',
      firstName: 'سارة',
      lastName: 'الشريف',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'ACTIVE',
      daysAgoCreated: 66,
      daysAgoUpdated: 9,
      roles: [
        { roleType: 'CONTACT_PERSON', branchId: 'br-alx' },
        { roleType: 'LEGAL_ENTITY', branchId: 'br-alx' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201095550010', isPrimary: true },
        { methodType: 'EMAIL', value: 'sara.sharif@atlas-logistics.example.com', isPrimary: true },
      ],
    },
    {
      idx: 11,
      partyType: 'ORGANIZATION',
      displayName: 'Arabian Gulf Tech Solutions',
      organizationName: 'Arabian Gulf Tech Solutions',
      legalName: 'Arabian Gulf Information Systems Co.',
      taxNumber: '311223344500003',
      crNumber: 'CR-SA-55011',
      branchId: null,
      ownerUserId: 'u-owner',
      status: 'ACTIVE',
      daysAgoCreated: 64,
      daysAgoUpdated: 1,
      roles: [
        { roleType: 'PARTNER', branchId: null },
        { roleType: 'SUPPLIER', branchId: null },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966541000011', isPrimary: true },
        { methodType: 'EMAIL', value: 'partners@gulftech.example.com', isPrimary: true },
        { methodType: 'WEBSITE', value: 'https://gulftech.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'LEGAL',
          country: 'Saudi Arabia',
          city: 'Riyadh',
          area: 'King Abdullah Financial District',
          street: 'Al Thumamah Rd',
          buildingNo: '4',
          isPrimary: true,
        },
      ],
      image: { initials: 'AG', bg: '#0b7a85' },
    },
    {
      idx: 12,
      partyType: 'PERSON',
      displayName: 'Nadia Samir Iskander',
      firstName: 'Nadia',
      lastName: 'Iskander',
      branchId: null,
      ownerUserId: 'u-nada',
      status: 'ACTIVE',
      daysAgoCreated: 62,
      daysAgoUpdated: 10,
      roles: [
        { roleType: 'BILLING_CONTACT', branchId: null },
        { roleType: 'CONTACT_PERSON', branchId: null },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201007770012', isPrimary: true },
        { methodType: 'EMAIL', value: 'nadia.iskander@gulftech.example.com', isPrimary: true },
      ],
    },
    {
      idx: 13,
      partyType: 'ORGANIZATION',
      displayName: 'شركة المدار للصناعات الغذائية',
      organizationName: 'شركة المدار للصناعات الغذائية',
      legalName: 'المدار للصناعات الغذائية ش.م.م',
      taxNumber: '519-220-341',
      crNumber: 'CR-EG-90122',
      branchId: 'br-cai',
      ownerUserId: 'u-mona',
      status: 'INACTIVE',
      daysAgoCreated: 60,
      daysAgoUpdated: 12,
      roles: [{ roleType: 'CUSTOMER', branchId: 'br-cai', status: 'INACTIVE' }],
      contacts: [
        { methodType: 'PHONE', value: '+20224010013', isPrimary: true },
        { methodType: 'EMAIL', value: 'accounts@almadar-food.example.com', isPrimary: true },
      ],
    },
    {
      idx: 14,
      partyType: 'PERSON',
      displayName: 'Mostafa Adel El-Masry',
      firstName: 'Mostafa',
      lastName: 'El-Masry',
      branchId: 'br-cai',
      ownerUserId: null,
      status: 'BLOCKED',
      daysAgoCreated: 58,
      daysAgoUpdated: 14,
      roles: [{ roleType: 'LEAD', branchId: 'br-cai', appSource: 'crm-app', status: 'BLOCKED' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201118880014', isPrimary: true },
        { methodType: 'EMAIL', value: 'mostafa.masry@example.com', isPrimary: true },
      ],
    },
    {
      idx: 15,
      partyType: 'ORGANIZATION',
      displayName: 'Red Sea Packaging Industries',
      organizationName: 'Red Sea Packaging Industries',
      legalName: 'Red Sea Packaging & Cartons Co.',
      taxNumber: '312009988700003',
      crNumber: 'CR-SA-66315',
      branchId: 'br-jed',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 56,
      daysAgoUpdated: 6,
      roles: [
        { roleType: 'SUPPLIER', branchId: 'br-jed' },
        { roleType: 'GUARANTOR', branchId: 'br-jed' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966561110015', isPrimary: true },
        { methodType: 'EMAIL', value: 'supply@redseapack.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'WORK',
          country: 'Saudi Arabia',
          city: 'Jeddah',
          area: 'Industrial Phase 3',
          street: 'Street 44',
          buildingNo: '81',
          isPrimary: true,
        },
      ],
    },
    {
      idx: 16,
      partyType: 'PERSON',
      displayName: 'خالد بن سعيد الغامدي',
      honorificTitle: 'أ.',
      firstName: 'خالد',
      lastName: 'الغامدي',
      branchId: 'br-jed',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 55,
      daysAgoUpdated: 5,
      roles: [{ roleType: 'CONTACT_PERSON', branchId: 'br-jed' }],
      contacts: [
        { methodType: 'MOBILE', value: '+966509990016', isPrimary: true },
        { methodType: 'EMAIL', value: 'khalid.ghamdi@redseapack.example.com', isPrimary: true },
      ],
    },
    {
      idx: 17,
      partyType: 'PERSON',
      displayName: 'Mariam Tarek Nassar',
      firstName: 'Mariam',
      lastName: 'Nassar',
      branchId: null,
      ownerUserId: 'u-nada',
      status: 'ACTIVE',
      daysAgoCreated: 53,
      daysAgoUpdated: 3,
      roles: [{ roleType: 'EMPLOYEE', branchId: null }],
      contacts: [
        { methodType: 'MOBILE', value: '+201020300017', isPrimary: true },
        { methodType: 'EMAIL', value: 'mariam.nassar@example.com', isPrimary: true },
      ],
    },
    {
      idx: 18,
      partyType: 'ORGANIZATION',
      displayName: 'مكتب الشهاب للاستشارات القانونية',
      organizationName: 'مكتب الشهاب للاستشارات القانونية',
      legalName: 'الشهاب للمحاماة والاستشارات',
      taxNumber: '701-334-890',
      crNumber: 'CR-EG-44918',
      branchId: null,
      ownerUserId: 'u-owner',
      status: 'ACTIVE',
      daysAgoCreated: 51,
      daysAgoUpdated: 7,
      roles: [
        { roleType: 'LEGAL_ENTITY', branchId: null },
        { roleType: 'SUPPLIER', branchId: null },
      ],
      contacts: [
        { methodType: 'PHONE', value: '+20225750018', isPrimary: true },
        { methodType: 'EMAIL', value: 'legal@alshihab-law.example.com', isPrimary: true },
      ],
    },
    {
      idx: 19,
      partyType: 'PERSON',
      displayName: 'حسام الدين فؤاد',
      honorificTitle: 'المستشار',
      firstName: 'حسام الدين',
      lastName: 'فؤاد',
      branchId: null,
      ownerUserId: 'u-owner',
      status: 'ACTIVE',
      daysAgoCreated: 50,
      daysAgoUpdated: 7,
      roles: [{ roleType: 'CONTACT_PERSON', branchId: null }],
      contacts: [
        { methodType: 'MOBILE', value: '+201001120019', isPrimary: true },
        { methodType: 'EMAIL', value: 'hossam.fouad@alshihab-law.example.com', isPrimary: true },
      ],
    },
    {
      idx: 20,
      partyType: 'ORGANIZATION',
      displayName: 'Pyramid Construction Group',
      organizationName: 'Pyramid Construction Group',
      legalName: 'Pyramid Engineering & Construction S.A.E.',
      taxNumber: '618-221-405',
      crNumber: 'CR-EG-55120',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 48,
      daysAgoUpdated: 4,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'GUARANTOR', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201204560020', isPrimary: true },
        { methodType: 'EMAIL', value: 'tenders@pyramidbuild.example.com', isPrimary: true },
      ],
      addresses: [
        {
          addressType: 'BILLING',
          country: 'Egypt',
          city: 'New Cairo',
          area: 'Fifth Settlement',
          street: '90th North St',
          buildingNo: '312',
          isPrimary: true,
        },
      ],
    },
    {
      idx: 21,
      partyType: 'PERSON',
      displayName: 'Yasser Ibrahim El-Kholy',
      firstName: 'Yasser',
      lastName: 'El-Kholy',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 47,
      daysAgoUpdated: 4,
      roles: [
        { roleType: 'LEAD', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'BILLING_CONTACT', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201145670021', isPrimary: true },
        { methodType: 'EMAIL', value: 'yasser.kholy@pyramidbuild.example.com', isPrimary: true },
      ],
    },
    {
      idx: 22,
      partyType: 'ORGANIZATION',
      displayName: 'مجموعة المشرق للأجهزة الكهربائية',
      organizationName: 'مجموعة المشرق للأجهزة الكهربائية',
      legalName: 'شركة المشرق التجارية',
      taxNumber: '842-119-007',
      crNumber: 'CR-EG-60222',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'ACTIVE',
      daysAgoCreated: 45,
      daysAgoUpdated: 9,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-alx' },
        { roleType: 'SHIPPING_RECIPIENT', branchId: 'br-alx' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201288990022', isPrimary: true },
        { methodType: 'EMAIL', value: 'purchasing@almashreq-elec.example.com', isPrimary: true },
      ],
    },
    {
      idx: 23,
      partyType: 'PERSON',
      displayName: 'Rania Gamal Abdelaziz',
      firstName: 'Rania',
      lastName: 'Abdelaziz',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'INACTIVE',
      daysAgoCreated: 43,
      daysAgoUpdated: 15,
      roles: [{ roleType: 'SUPPLIER', branchId: 'br-alx', status: 'INACTIVE' }],
      contacts: [{ methodType: 'EMAIL', value: 'rania.abdelaziz@example.com', isPrimary: true }],
    },
    {
      idx: 24,
      partyType: 'ORGANIZATION',
      displayName: 'Najd Oasis Hospitality LLC',
      organizationName: 'Najd Oasis Hospitality LLC',
      legalName: 'Najd Oasis Hotels & Resorts Co.',
      taxNumber: '313556677800003',
      crNumber: 'CR-SA-71024',
      branchId: 'br-ruh',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 41,
      daysAgoUpdated: 3,
      roles: [{ roleType: 'CUSTOMER', branchId: 'br-ruh', appSource: 'crm-app' }],
      contacts: [
        { methodType: 'MOBILE', value: '+966537770024', isPrimary: true },
        { methodType: 'EMAIL', value: 'procurement@najdoasis.example.com', isPrimary: true },
      ],
    },
    {
      idx: 25,
      partyType: 'PERSON',
      displayName: 'عبد الله بن فهد الدوسري',
      firstName: 'عبد الله',
      lastName: 'الدوسري',
      branchId: 'br-ruh',
      ownerUserId: null,
      status: 'ACTIVE',
      daysAgoCreated: 39,
      daysAgoUpdated: 11,
      roles: [{ roleType: 'PARTNER', branchId: 'br-ruh' }],
      contacts: [
        { methodType: 'MOBILE', value: '+966508880025', isPrimary: true },
        { methodType: 'WHATSAPP', value: '+966508880025', isPrimary: true },
      ],
    },
    {
      idx: 26,
      partyType: 'ORGANIZATION',
      displayName: 'Sinai Renewable Energy Co.',
      organizationName: 'Sinai Renewable Energy Co.',
      legalName: 'Sinai Solar & Wind Energy S.A.E.',
      taxNumber: '910-445-612',
      crNumber: 'CR-EG-80526',
      branchId: null,
      ownerUserId: 'u-mona',
      status: 'ACTIVE',
      daysAgoCreated: 37,
      daysAgoUpdated: 2,
      roles: [
        { roleType: 'PARTNER', branchId: null },
        { roleType: 'CUSTOMER', branchId: null },
        { roleType: 'SUPPLIER', branchId: null },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201061230026', isPrimary: true },
        { methodType: 'EMAIL', value: 'projects@sinairenewables.example.com', isPrimary: true },
        { methodType: 'WEBSITE', value: 'https://sinairenewables.example.com', isPrimary: true },
      ],
    },
    {
      idx: 27,
      partyType: 'PERSON',
      displayName: 'Dina Wael Mansour',
      honorificTitle: 'Dr.',
      firstName: 'Dina',
      lastName: 'Mansour',
      branchId: 'br-cai',
      ownerUserId: 'u-nada',
      status: 'ACTIVE',
      daysAgoCreated: 35,
      daysAgoUpdated: 8,
      roles: [{ roleType: 'SHIPPING_RECIPIENT', branchId: 'br-cai' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201552220027', isPrimary: true },
        { methodType: 'EMAIL', value: 'dina.mansour@example.com', isPrimary: true },
      ],
    },
    {
      idx: 28,
      partyType: 'ORGANIZATION',
      displayName: 'شركة البيان للخدمات المالية',
      organizationName: 'شركة البيان للخدمات المالية',
      legalName: 'البيان للاستشارات المالية والمحاسبية',
      taxNumber: '314998877600003',
      crNumber: 'CR-SA-92028',
      branchId: 'br-ruh',
      ownerUserId: 'u-faisal',
      status: 'BLOCKED',
      daysAgoCreated: 33,
      daysAgoUpdated: 16,
      roles: [{ roleType: 'SUPPLIER', branchId: 'br-ruh', status: 'BLOCKED' }],
      contacts: [
        { methodType: 'PHONE', value: '+966112000028', isPrimary: true },
        { methodType: 'EMAIL', value: 'billing@albayan-fin.example.com', isPrimary: true },
      ],
    },
    {
      idx: 29,
      partyType: 'PERSON',
      displayName: 'أمنية صلاح الدين',
      firstName: 'أمنية',
      lastName: 'صلاح الدين',
      branchId: 'br-cai',
      ownerUserId: 'u-mona',
      status: 'ACTIVE',
      daysAgoCreated: 31,
      daysAgoUpdated: 5,
      roles: [{ roleType: 'LEAD', branchId: 'br-cai', appSource: 'crm-app' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201033440029', isPrimary: true },
        { methodType: 'EMAIL', value: 'omnia.salah@example.com', isPrimary: true },
      ],
    },
    {
      idx: 30,
      partyType: 'ORGANIZATION',
      displayName: 'Mediterranean Textiles Export',
      organizationName: 'Mediterranean Textiles Export',
      legalName: 'Mediterranean Cotton & Textiles Co.',
      taxNumber: '722-331-815',
      crNumber: 'CR-EG-12930',
      branchId: 'br-alx',
      ownerUserId: 'u-hany',
      status: 'ACTIVE',
      daysAgoCreated: 29,
      daysAgoUpdated: 6,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-alx' },
        { roleType: 'SUPPLIER', branchId: 'br-alx' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201277660030', isPrimary: true },
        { methodType: 'EMAIL', value: 'export@medtextiles.example.com', isPrimary: true },
      ],
    },
    {
      idx: 31,
      partyType: 'PERSON',
      displayName: 'Sherif Magdy Botros',
      firstName: 'Sherif',
      lastName: 'Botros',
      branchId: null,
      ownerUserId: null,
      status: 'ACTIVE',
      daysAgoCreated: 27,
      daysAgoUpdated: 10,
      roles: [{ roleType: 'GUARANTOR', branchId: null }],
      contacts: [
        { methodType: 'MOBILE', value: '+201089990031', isPrimary: true },
        { methodType: 'EMAIL', value: 'sherif.botros@example.com', isPrimary: true },
      ],
    },
    {
      idx: 32,
      partyType: 'ORGANIZATION',
      displayName: 'مؤسسة أفق الخليج للنقليات',
      organizationName: 'مؤسسة أفق الخليج للنقليات',
      legalName: 'أفق الخليج للنقل البري',
      taxNumber: '315887766500003',
      crNumber: 'CR-SA-33132',
      branchId: 'br-jed',
      ownerUserId: 'u-faisal',
      status: 'ACTIVE',
      daysAgoCreated: 25,
      daysAgoUpdated: 3,
      roles: [
        { roleType: 'SUPPLIER', branchId: 'br-jed' },
        { roleType: 'SHIPPING_RECIPIENT', branchId: 'br-jed' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966554440032', isPrimary: true },
        { methodType: 'EMAIL', value: 'fleet@gulfhorizon.example.com', isPrimary: true },
      ],
    },
    {
      idx: 33,
      partyType: 'PERSON',
      displayName: 'ماجد بن ناصر القحطاني',
      firstName: 'ماجد',
      lastName: 'القحطاني',
      branchId: 'br-jed',
      ownerUserId: 'u-faisal',
      status: 'INACTIVE',
      daysAgoCreated: 23,
      daysAgoUpdated: 12,
      roles: [{ roleType: 'CUSTOMER', branchId: 'br-jed', status: 'INACTIVE' }],
      contacts: [{ methodType: 'MOBILE', value: '+966563330033', isPrimary: true }],
    },
    {
      idx: 34,
      partyType: 'ORGANIZATION',
      displayName: 'Oasis Digital Commerce Ltd.',
      organizationName: 'Oasis Digital Commerce Ltd.',
      legalName: 'Oasis E-Commerce Solutions Ltd.',
      taxNumber: '488-902-117',
      crNumber: 'CR-EG-74034',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 21,
      daysAgoUpdated: 2,
      roles: [
        { roleType: 'CUSTOMER', branchId: 'br-cai', appSource: 'crm-app' },
        { roleType: 'PARTNER', branchId: 'br-cai' },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+201055110034', isPrimary: true },
        { methodType: 'EMAIL', value: 'hello@oasisdigital.example.com', isPrimary: true },
      ],
    },
    {
      idx: 35,
      partyType: 'PERSON',
      displayName: 'Heba Nabil Tawfik',
      firstName: 'Heba',
      lastName: 'Tawfik',
      branchId: 'br-cai',
      ownerUserId: 'u-mona',
      status: 'ACTIVE',
      daysAgoCreated: 19,
      daysAgoUpdated: 4,
      roles: [{ roleType: 'EMPLOYEE', branchId: 'br-cai' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201166220035', isPrimary: true },
        { methodType: 'EMAIL', value: 'heba.tawfik@example.com', isPrimary: true },
      ],
    },
    {
      idx: 36,
      partyType: 'ORGANIZATION',
      displayName: 'شركة القمة لمواد البناء',
      organizationName: 'شركة القمة لمواد البناء',
      legalName: 'القمة للتجارة والمقاولات',
      taxNumber: '590-123-778',
      crNumber: 'CR-EG-88236',
      branchId: 'br-cai',
      ownerUserId: null,
      status: 'ACTIVE',
      daysAgoCreated: 17,
      daysAgoUpdated: 9,
      roles: [{ roleType: 'SUPPLIER', branchId: 'br-cai' }],
      contacts: [
        { methodType: 'PHONE', value: '+20226330036', isPrimary: true },
        { methodType: 'EMAIL', value: 'orders@alqimma-build.example.com', isPrimary: true },
      ],
    },
    {
      idx: 37,
      partyType: 'PERSON',
      displayName: 'إيهاب مصطفى زكي',
      firstName: 'إيهاب',
      lastName: 'زكي',
      branchId: 'br-alx',
      ownerUserId: null,
      status: 'BLOCKED',
      daysAgoCreated: 15,
      daysAgoUpdated: 13,
      roles: [{ roleType: 'SHIPPING_RECIPIENT', branchId: 'br-alx', status: 'BLOCKED' }],
      contacts: [{ methodType: 'MOBILE', value: '+201299000037', isPrimary: true }],
    },
    {
      idx: 38,
      partyType: 'ORGANIZATION',
      displayName: 'Crescent Industrial Automation',
      organizationName: 'Crescent Industrial Automation',
      legalName: 'Crescent Robotics & Control Co.',
      taxNumber: '316001122300003',
      crNumber: 'CR-SA-99138',
      branchId: null,
      ownerUserId: 'u-owner',
      status: 'ACTIVE',
      daysAgoCreated: 12,
      daysAgoUpdated: 1,
      roles: [
        { roleType: 'PARTNER', branchId: null },
        { roleType: 'LEGAL_ENTITY', branchId: null },
        { roleType: 'SUPPLIER', branchId: null },
      ],
      contacts: [
        { methodType: 'MOBILE', value: '+966558800038', isPrimary: true },
        { methodType: 'EMAIL', value: 'support@crescentauto.example.com', isPrimary: true },
      ],
      image: { initials: 'CI', bg: '#b45309' },
    },
    {
      idx: 39,
      partyType: 'PERSON',
      displayName: 'Salma Ashraf El-Naggar',
      firstName: 'Salma',
      lastName: 'El-Naggar',
      branchId: 'br-cai',
      ownerUserId: 'u-omar',
      status: 'ACTIVE',
      daysAgoCreated: 10,
      daysAgoUpdated: 2,
      roles: [{ roleType: 'CUSTOMER', branchId: 'br-cai', appSource: 'crm-app' }],
      contacts: [
        { methodType: 'MOBILE', value: '+201071110039', isPrimary: true },
        { methodType: 'EMAIL', value: 'salma.naggar@example.com', isPrimary: true },
      ],
    },
    {
      idx: 40,
      partyType: 'ORGANIZATION',
      displayName: 'دار النور للطباعة والنشر',
      organizationName: 'دار النور للطباعة والنشر',
      legalName: 'دار النور للطباعة والتغليف',
      taxNumber: '215-667-432',
      crNumber: 'CR-EG-11040',
      branchId: 'br-cai',
      ownerUserId: 'u-nada',
      status: 'INACTIVE',
      daysAgoCreated: 8,
      daysAgoUpdated: 7,
      roles: [{ roleType: 'SUPPLIER', branchId: 'br-cai', status: 'INACTIVE' }],
      contacts: [{ methodType: 'EMAIL', value: 'print@darnour.example.com', isPrimary: true }],
    },
    {
      idx: 41,
      partyType: 'PERSON',
      displayName: 'Ziad Hisham El-Sawi',
      firstName: 'Ziad',
      lastName: 'El-Sawi',
      branchId: null,
      ownerUserId: 'u-owner',
      status: 'ACTIVE',
      daysAgoCreated: 5,
      daysAgoUpdated: 1,
      roles: [{ roleType: 'EMPLOYEE', branchId: null }],
      contacts: [
        { methodType: 'MOBILE', value: '+201092220041', isPrimary: true },
        { methodType: 'EMAIL', value: 'ziad.sawi@example.com', isPrimary: true },
      ],
    },
    {
      idx: 42,
      partyType: 'PERSON',
      displayName: 'نورهان عادل كامل',
      firstName: 'نورهان',
      lastName: 'كامل',
      branchId: 'br-ruh',
      ownerUserId: 'u-faisal',
      status: 'INACTIVE',
      daysAgoCreated: 3,
      daysAgoUpdated: 2,
      roles: [{ roleType: 'BILLING_CONTACT', branchId: 'br-ruh', status: 'INACTIVE' }],
      contacts: [
        { methodType: 'MOBILE', value: '+966549990042', isPrimary: true },
        { methodType: 'EMAIL', value: 'nourhan.kamel@example.com', isPrimary: true },
      ],
    },
  ];

  const parties: PartyBase[] = [];
  const contactMethods: PartyContactMethod[] = [];
  const addresses: PartyAddress[] = [];
  const roles: PartyRole[] = [];
  const images = new Map<string, string>();

  let cmSeq = 1;
  let addrSeq = 1;
  let roleSeq = 1;

  for (const spec of specs) {
    const id = partyUuid(spec.idx);
    const createdAt = isoDaysAgo(spec.daysAgoCreated);
    const updatedAt = isoDaysAgo(spec.daysAgoUpdated);
    let imageUrl: string | null = null;
    let imageRevision: string | null = null;

    if (spec.image) {
      imageRevision = String(Date.parse(updatedAt));
      imageUrl = `/api/v1/tenant/directory/parties/${id}/image?v=${imageRevision}`;
      images.set(imageUrl, makeAvatarSvgDataUrl(spec.image.initials, spec.image.bg, spec.partyType === 'ORGANIZATION'));
    }

    parties.push({
      id,
      partyType: spec.partyType,
      displayName: spec.displayName,
      legalName: spec.legalName ?? null,
      firstName: spec.firstName ?? null,
      lastName: spec.lastName ?? null,
      honorificTitle: spec.honorificTitle ?? null,
      jobTitle: null,
      organizationName: spec.organizationName ?? null,
      taxNumber: spec.taxNumber ?? null,
      commercialRegistrationNumber: spec.crNumber ?? null,
      branchId: spec.branchId,
      ownerUserId: spec.ownerUserId,
      status: spec.status,
      imageUrl,
      imageKind: spec.partyType === 'ORGANIZATION' ? 'LOGO' : 'PHOTO',
      imageRevision,
      createdAt,
      updatedAt,
      deletedAt: null,
    });

    for (const cm of spec.contacts) {
      const normalized = normalizeAndValidateContact(cm.methodType, cm.value);
      contactMethods.push({
        id: childUuid(1, cmSeq++),
        partyId: id,
        methodType: cm.methodType,
        value: normalized.value,
        normalizedValue: normalized.normalizedValue,
        phoneDigits: normalized.phoneDigits,
        label: cm.label ?? null,
        isPrimary: cm.isPrimary ?? false,
        isVerified: false,
        createdAt,
        updatedAt,
        deletedAt: null,
      });
    }

    for (const addr of spec.addresses ?? []) {
      addresses.push({
        id: childUuid(2, addrSeq++),
        partyId: id,
        addressType: addr.addressType,
        countryId: null,
        stateId: null,
        cityId: null,
        districtId: null,
        label: null,
        country: addr.country,
        city: addr.city,
        area: addr.area ?? null,
        street: addr.street,
        buildingNo: addr.buildingNo ?? null,
        floor: null,
        apartment: null,
        landmark: null,
        postalCode: addr.postalCode ?? null,
        isPrimary: addr.isPrimary ?? false,
        createdAt,
        updatedAt,
        deletedAt: null,
      });
    }

    for (const role of spec.roles) {
      roles.push({
        id: childUuid(3, roleSeq++),
        partyId: id,
        roleType: role.roleType,
        branchId: role.branchId,
        status: role.status ?? 'ACTIVE',
        appSource: role.appSource ?? 'core-app',
        metadata: {},
        createdAt,
        updatedAt,
        deletedAt: null,
      });
    }
  }

  const relationships: PartyRelationship[] = [
    {
      id: childUuid(4, 1),
      fromPartyId: partyUuid(1),
      toPartyId: partyUuid(3),
      relationshipType: 'CONTACT_PERSON',
      label: 'مدير المشتريات',
      isPrimary: true,
      createdAt: isoDaysAgo(85),
      updatedAt: isoDaysAgo(85),
      deletedAt: null,
    },
    {
      id: childUuid(4, 2),
      fromPartyId: partyUuid(1),
      toPartyId: partyUuid(4),
      relationshipType: 'BILLING_CONTACT',
      label: 'Accounts Payable Lead',
      isPrimary: true,
      createdAt: isoDaysAgo(80),
      updatedAt: isoDaysAgo(80),
      deletedAt: null,
    },
    {
      id: childUuid(4, 3),
      fromPartyId: partyUuid(5),
      toPartyId: partyUuid(6),
      relationshipType: 'CONTACT_PERSON',
      label: 'مدير التوريد الطبي',
      isPrimary: true,
      createdAt: isoDaysAgo(75),
      updatedAt: isoDaysAgo(75),
      deletedAt: null,
    },
    {
      id: childUuid(4, 4),
      fromPartyId: partyUuid(9),
      toPartyId: partyUuid(10),
      relationshipType: 'LEGAL_CONTACT',
      label: 'المستشارة القانونية',
      isPrimary: true,
      createdAt: isoDaysAgo(65),
      updatedAt: isoDaysAgo(65),
      deletedAt: null,
    },
    {
      id: childUuid(4, 5),
      fromPartyId: partyUuid(11),
      toPartyId: partyUuid(12),
      relationshipType: 'BILLING_CONTACT',
      label: 'Finance Manager',
      isPrimary: true,
      createdAt: isoDaysAgo(60),
      updatedAt: isoDaysAgo(60),
      deletedAt: null,
    },
    {
      id: childUuid(4, 6),
      fromPartyId: partyUuid(15),
      toPartyId: partyUuid(16),
      relationshipType: 'CONTACT_PERSON',
      label: 'مشرف سلسلة الإمداد',
      isPrimary: true,
      createdAt: isoDaysAgo(54),
      updatedAt: isoDaysAgo(54),
      deletedAt: null,
    },
    {
      id: childUuid(4, 7),
      fromPartyId: partyUuid(18),
      toPartyId: partyUuid(19),
      relationshipType: 'LEGAL_CONTACT',
      label: 'الشريك الإداري',
      isPrimary: true,
      createdAt: isoDaysAgo(49),
      updatedAt: isoDaysAgo(49),
      deletedAt: null,
    },
    {
      id: childUuid(4, 8),
      fromPartyId: partyUuid(20),
      toPartyId: partyUuid(21),
      relationshipType: 'CONTACT_PERSON',
      label: 'Procurement Director',
      isPrimary: true,
      createdAt: isoDaysAgo(46),
      updatedAt: isoDaysAgo(46),
      deletedAt: null,
    },
  ];

  return {
    parties,
    contactMethods,
    addresses,
    roles,
    relationships,
    images,
  };
}

const store: DirectoryStore = createSeedStore();

function liveParties(): PartyBase[] {
  return store.parties.filter((p) => p.deletedAt === null);
}

function liveContactsFor(partyId: string): PartyContactMethod[] {
  return store.contactMethods
    .filter((c) => c.partyId === partyId && !c.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function liveAddressesFor(partyId: string): PartyAddress[] {
  return store.addresses
    .filter((a) => a.partyId === partyId && !a.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function liveRolesFor(partyId: string): PartyRole[] {
  return store.roles
    .filter((r) => r.partyId === partyId && !r.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function canReadBranch(branchId: string | null): boolean {
  const me = fakeActorMe();
  if (me.isTenantOwner) return true;
  const entry = me.permissionScopes['directory.party.read'];
  if (!entry) return false;
  if (entry.tenantWide) return true;
  if (branchId === null) return true;
  return entry.branchIds.includes(branchId);
}

function requireReadPermission(): void {
  requirePermissionGuard('directory.party.read');
}

/**
 * DirectoryService.assertBranchWritePermission: a shared party (no branch) needs
 * the permission tenant-wide (TENANT_WIDE_PERMISSION_REQUIRED); a branch party
 * needs it for that branch (BRANCH_PERMISSION_DENIED).
 */
function requireBranchPermission(permission: string, branchId: string | null): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  const entry = me.permissionScopes[permission];
  if (entry?.tenantWide) return;
  if (branchId === null) {
    throw new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
  }
  if (!entry || !entry.branchIds.includes(branchId)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
}

function emptyPage<T>(page: number, limit: number): Page<T> {
  return { data: [], meta: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
}

/** The Core response envelope turns a paginated result into { data, meta }. */
function toPage<T>(items: T[], page: number, limit: number): Page<T> {
  const total = items.length;
  if (total === 0) return emptyPage(page, limit);
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const meta: PageMeta = { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
  return { data: clone(items.slice(start, start + limit)), meta };
}

function requirePartyExists(id: string): PartyBase {
  const party = liveParties().find((p) => p.id === id);
  if (!party) {
    throw new ApiError(404, 'PARTY_NOT_FOUND');
  }
  return party;
}

function buildPartyListItem(party: PartyBase): PartyListItem {
  const contacts = liveContactsFor(party.id);
  const preferredByType = new Map<ContactMethodType, PartyListContactMethod>();
  const grouped = new Map<ContactMethodType, PartyContactMethod[]>();

  for (const cm of contacts) {
    const list = grouped.get(cm.methodType) ?? [];
    list.push(cm);
    grouped.set(cm.methodType, list);
  }

  for (const [type, list] of grouped.entries()) {
    const sorted = [...list].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
    const best = sorted[0];
    preferredByType.set(type, {
      id: best.id,
      partyId: best.partyId,
      methodType: best.methodType,
      value: best.value,
      label: best.label,
      isPrimary: best.isPrimary,
      isVerified: best.isVerified,
    });
  }

  const listRoles: PartyListRole[] = liveRolesFor(party.id).map((r) => ({
    id: r.id,
    partyId: r.partyId,
    roleType: r.roleType,
    branchId: r.branchId,
    status: r.status,
    appSource: r.appSource,
  }));

  return clone({
    ...party,
    roles: listRoles,
    contactMethods: Array.from(preferredByType.values()),
  });
}

function buildPartyDetail(party: PartyBase): PartyDetail {
  return clone({
    ...party,
    roles: liveRolesFor(party.id),
    contactMethods: liveContactsFor(party.id),
    addresses: liveAddressesFor(party.id),
  });
}

function assertTypeFieldCompatibility(
  partyType: PartyType,
  fields: {
    legalName: string | null;
    firstName: string | null;
    lastName: string | null;
    honorificTitle: string | null;
    organizationName: string | null;
    taxNumber: string | null;
    commercialRegistrationNumber: string | null;
  },
): void {
  if (partyType === 'PERSON') {
    if (
      fields.organizationName !== null ||
      fields.legalName !== null ||
      fields.taxNumber !== null ||
      fields.commercialRegistrationNumber !== null
    ) {
      throw new ApiError(422, 'PARTY_FIELDS_INVALID');
    }
  } else {
    if (fields.firstName !== null || fields.lastName !== null || fields.honorificTitle !== null) {
      throw new ApiError(422, 'PARTY_FIELDS_INVALID');
    }
  }
}

async function assertValidBranch(branchId: string | null): Promise<void> {
  if (branchId === null) return;
  try {
    const branches = await listAllPages(listBranches, { limit: 100 });
    const match = branches.find((b) => b.id === branchId && b.status === 'ACTIVE');
    if (!match) {
      throw new ApiError(422, 'PARTY_BRANCH_INVALID');
    }
  } catch (err) {
    if (err instanceof ApiError && err.code === 'PARTY_BRANCH_INVALID') throw err;
  }
}

async function assertValidOwner(ownerUserId: string | null): Promise<void> {
  if (ownerUserId === null) return;
  try {
    const users = await listAllPages(listUsers, { limit: 100 });
    const match = users.find((u) => u.id === ownerUserId && u.status === 'ACTIVE');
    if (!match) {
      throw new ApiError(422, 'PARTY_OWNER_INVALID');
    }
  } catch (err) {
    if (err instanceof ApiError && err.code === 'PARTY_OWNER_INVALID') throw err;
  }
}

function duplicateFamily(methodType: ContactMethodType): string | null {
  if (methodType === 'EMAIL') return peekDirectorySettings().preventDuplicateEmail ? 'EMAIL' : null;
  if (methodType === 'PHONE' || methodType === 'MOBILE') {
    return peekDirectorySettings().preventDuplicatePhone ? 'PHONE' : null;
  }
  if (methodType === 'WHATSAPP') return peekDirectorySettings().preventDuplicateWhatsapp ? 'WHATSAPP' : null;
  return null;
}

function sharesActiveRole(partyIdA: string, partyIdB: string): boolean {
  const rolesA = new Set(liveRolesFor(partyIdA).filter((r) => r.status === 'ACTIVE').map((r) => r.roleType));
  if (rolesA.size === 0) return true;
  const rolesB = liveRolesFor(partyIdB).filter((r) => r.status === 'ACTIVE');
  return rolesB.some((r) => rolesA.has(r.roleType));
}

function partiesInDuplicateScope(party: PartyBase, overrideBranchId?: string | null): PartyBase[] {
  const targetBranch = overrideBranchId !== undefined ? overrideBranchId : party.branchId;
  const others = liveParties().filter((p) => p.id !== party.id);

  switch (peekDirectorySettings().duplicateScope) {
    case 'TENANT':
      return others;
    case 'BRANCH':
      if (targetBranch === null) return others;
      return others.filter((other) => other.branchId === targetBranch || other.branchId === null);
    case 'PARTY_ROLE': {
      const ownRoles = liveRolesFor(party.id).filter((r) => r.status === 'ACTIVE');
      if (ownRoles.length === 0) return others;
      return others.filter((other) => sharesActiveRole(party.id, other.id));
    }
  }
}

function assertContactNoDuplicate(
  party: PartyBase,
  methodType: ContactMethodType,
  normalizedValue: string,
  ignoreMethodId?: string,
  overrideBranchId?: string | null,
): void {
  // Unique active (partyId, methodType, normalizedValue) inside the same party
  const intraDuplicate = liveContactsFor(party.id).some(
    (c) => c.id !== ignoreMethodId && c.methodType === methodType && c.normalizedValue === normalizedValue,
  );
  if (intraDuplicate) {
    throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD');
  }

  const family = duplicateFamily(methodType);
  if (!family) return;

  const scopedParties = partiesInDuplicateScope(party, overrideBranchId);
  for (const other of scopedParties) {
    const otherContacts = liveContactsFor(other.id);
    const conflict = otherContacts.some((c) => {
      if (c.normalizedValue !== normalizedValue) return false;
      if (family === 'PHONE') return c.methodType === 'PHONE' || c.methodType === 'MOBILE';
      return c.methodType === family;
    });
    if (conflict) {
      throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD');
    }
  }
}

function promoteOldestPrimaryContact(partyId: string, methodType: ContactMethodType): void {
  const sameType = liveContactsFor(partyId).filter((c) => c.methodType === methodType);
  if (sameType.length === 0 || sameType.some((c) => c.isPrimary)) return;
  sameType[0].isPrimary = true;
}

function promoteOldestPrimaryAddress(partyId: string, addressType: AddressType): void {
  const sameType = liveAddressesFor(partyId).filter((a) => a.addressType === addressType);
  if (sameType.length === 0 || sameType.some((a) => a.isPrimary)) return;
  sameType[0].isPrimary = true;
}

export function fakePartyImageDataUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return imageUrl;
  const exact = store.images.get(imageUrl);
  if (exact) return exact;
  const base = imageUrl.split('?')[0];
  for (const [key, value] of store.images.entries()) {
    if (key.split('?')[0] === base) return value;
  }
  return null;
}

export async function fakeListParties(q: ListPartiesQuery = {}): Promise<Page<PartyListItem>> {
  await fakeDelay();
  requireReadPermission();
  validateDto(PARTY_QUERY_SCHEMA, definedQuery(q));

  // safeSortBy: unknown sort fields are a 400 INVALID_FIELD from the query engine.
  const sortBy = q.sortBy ?? 'displayName';
  if (!VALID_SORT_BY.has(sortBy)) {
    throw new ApiError(400, 'INVALID_FIELD');
  }
  const sortDir: SortDir = q.sortDir ?? 'ASC';
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const search = (q.search ?? '').trim();

  let items = liveParties().filter((p) => canReadBranch(p.branchId));

  if (q.partyType) {
    items = items.filter((p) => p.partyType === q.partyType);
  }
  if (q.status) {
    items = items.filter((p) => p.status === q.status);
  }
  if (q.branchId) {
    if (!canReadBranch(q.branchId)) {
      return emptyPage(page, limit);
    }
    items = items.filter((p) => p.branchId === q.branchId);
  }
  if (q.ownerUserId) {
    items = items.filter((p) => p.ownerUserId === q.ownerUserId);
  }
  if (q.roleType) {
    items = items.filter((p) =>
      liveRolesFor(p.id).some((r) => r.roleType === q.roleType && r.status === 'ACTIVE'),
    );
  }
  if (search) {
    const lower = search.toLowerCase();
    const rawDigits = search.replace(/\D/g, '').replace(/^00/, '');
    const checkDigits = rawDigits.length >= 3;

    items = items.filter((p) => {
      const textFields = [
        p.displayName,
        p.legalName,
        p.firstName,
        p.lastName,
        p.organizationName,
        p.taxNumber,
        p.commercialRegistrationNumber,
      ];
      if (textFields.some((f) => f && f.toLowerCase().includes(lower))) {
        return true;
      }
      const contacts = liveContactsFor(p.id);
      return contacts.some((cm) => {
        if (cm.value.toLowerCase().includes(lower) || cm.normalizedValue.toLowerCase().includes(lower)) {
          return true;
        }
        return checkDigits && cm.phoneDigits ? cm.phoneDigits.includes(rawDigits) : false;
      });
    });
  }

  items.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'displayName') {
      cmp = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
    } else if (sortBy === 'createdAt') {
      cmp = a.createdAt.localeCompare(b.createdAt);
    } else {
      cmp = a.updatedAt.localeCompare(b.updatedAt);
    }
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return sortDir === 'DESC' ? -cmp : cmp;
  });

  const result = toPage(items, page, limit);
  return { data: result.data.map(buildPartyListItem), meta: result.meta };
}

export async function fakeGetParty(id: string): Promise<PartyDetail> {
  await fakeDelay();
  requireReadPermission();
  const party = requirePartyExists(id);
  if (!canReadBranch(party.branchId)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
  return buildPartyDetail(party);
}

export async function fakeCreateParty(body: CreatePartyBody): Promise<PartyDetail> {
  await fakeDelay();
  requirePermissionGuard('directory.party.manage');
  validateDto(CREATE_PARTY_SCHEMA, body);
  if (!PARTY_TYPES.includes(body.partyType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const displayName = (body.displayName ?? '').trim();
  if (!displayName) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const branchId = body.branchId ?? null;
  const ownerUserId = body.ownerUserId ?? null;

  requireBranchPermission('directory.party.manage', branchId);
  for (const role of body.roles ?? []) {
    requireBranchPermission('directory.party.manage', role.branchId ?? null);
  }

  await assertValidBranch(branchId);
  await assertValidOwner(ownerUserId);

  const fields = {
    legalName: trimNullable(body.legalName),
    firstName: trimNullable(body.firstName),
    lastName: trimNullable(body.lastName),
    honorificTitle: trimNullable(body.honorificTitle),
    organizationName: trimNullable(body.organizationName),
    taxNumber: trimNullable(body.taxNumber),
    commercialRegistrationNumber: trimNullable(body.commercialRegistrationNumber),
  };

  assertMaxLength(displayName, PARTY_LIMITS.displayName);
  assertMaxLength(fields.legalName, PARTY_LIMITS.legalName);
  assertMaxLength(fields.firstName, PARTY_LIMITS.firstName);
  assertMaxLength(fields.lastName, PARTY_LIMITS.lastName);
  assertMaxLength(fields.honorificTitle, PARTY_LIMITS.honorificTitle);
  assertMaxLength(fields.organizationName, PARTY_LIMITS.organizationName);
  assertMaxLength(fields.taxNumber, PARTY_LIMITS.taxNumber);
  assertMaxLength(fields.commercialRegistrationNumber, PARTY_LIMITS.commercialRegistrationNumber);

  assertTypeFieldCompatibility(body.partyType, fields);

  const rawContacts = body.contactMethods ?? [];
  const rawAddresses = body.addresses ?? [];
  const rawRoles = body.roles ?? [];

  if (rawContacts.length > peekDirectorySettings().maxContactMethodsPerParty) {
    throw new ApiError(422, 'PARTY_CONTACT_METHOD_LIMIT_EXCEEDED');
  }
  if (rawAddresses.length > peekDirectorySettings().maxAddressesPerParty) {
    throw new ApiError(422, 'PARTY_ADDRESS_LIMIT_EXCEEDED');
  }
  if (rawRoles.length > PARTY_LIMITS.maxRolesPerParty) {
    throw new ApiError(422, 'PARTY_ROLE_LIMIT_EXCEEDED');
  }

  // Validate child batches before writing
  const primaryContactTypes = new Set<ContactMethodType>();
  const seenContactsInBatch = new Set<string>();
  for (const cm of rawContacts) {
    if (!CONTACT_METHOD_TYPES.includes(cm.methodType)) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    const normalized = normalizeAndValidateContact(cm.methodType, cm.value);
    assertMaxLength(trimNullable(cm.label), PARTY_LIMITS.contactLabel);
    const key = `${cm.methodType}:${normalized.normalizedValue}`;
    if (seenContactsInBatch.has(key)) {
      throw new ApiError(409, 'PARTY_DUPLICATE_CONTACT_METHOD');
    }
    seenContactsInBatch.add(key);
    if (cm.isPrimary) {
      if (primaryContactTypes.has(cm.methodType)) {
        throw new ApiError(422, 'PARTY_CHILD_BATCH_INVALID');
      }
      primaryContactTypes.add(cm.methodType);
    }
  }

  const primaryAddressTypes = new Set<AddressType>();
  for (const addr of rawAddresses) {
    if (!ADDRESS_TYPES.includes(addr.addressType)) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (addr.isPrimary) {
      if (primaryAddressTypes.has(addr.addressType)) {
        throw new ApiError(422, 'PARTY_CHILD_BATCH_INVALID');
      }
      primaryAddressTypes.add(addr.addressType);
    }
  }

  const seenRolesInBatch = new Set<string>();
  for (const role of rawRoles) {
    if (!PARTY_ROLE_TYPES.includes(role.roleType)) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    const roleBranch = role.branchId ?? null;
    await assertValidBranch(roleBranch);
    validateFlatMetadata(role.metadata);
    const roleKey = `${role.roleType}:${roleBranch ?? ''}`;
    if (seenRolesInBatch.has(roleKey)) {
      throw new ApiError(409, 'PARTY_ROLE_ALREADY_EXISTS');
    }
    seenRolesInBatch.add(roleKey);
  }

  const now = nowIso();
  const id = newIdempotencyKey();
  const newParty: PartyBase = {
    id,
    partyType: body.partyType,
    displayName,
    legalName: fields.legalName,
    firstName: fields.firstName,
    lastName: fields.lastName,
    honorificTitle: fields.honorificTitle,
    jobTitle: null,
    organizationName: fields.organizationName,
    taxNumber: fields.taxNumber,
    commercialRegistrationNumber: fields.commercialRegistrationNumber,
    branchId,
    ownerUserId,
    status: 'ACTIVE',
    imageUrl: null,
    imageKind: body.partyType === 'ORGANIZATION' ? 'LOGO' : 'PHOTO',
    imageRevision: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // Validate cross-party duplicates after preparing party/roles (needed if duplicateScope = PARTY_ROLE)
  const tempRoles: PartyRole[] = rawRoles.map((r) => ({
    id: newIdempotencyKey(),
    partyId: id,
    roleType: r.roleType,
    branchId: r.branchId ?? null,
    status: 'ACTIVE',
    appSource: 'core-app',
    metadata: validateFlatMetadata(r.metadata),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  store.parties.push(newParty);
  store.roles.push(...tempRoles);

  try {
    for (const cm of rawContacts) {
      const normalized = normalizeAndValidateContact(cm.methodType, cm.value);
      assertContactNoDuplicate(newParty, cm.methodType, normalized.normalizedValue);
    }
  } catch (err) {
    // Rollback on failure
    store.parties = store.parties.filter((p) => p.id !== id);
    store.roles = store.roles.filter((r) => r.partyId !== id);
    throw err;
  }

  const hasExplicitPrimaryByContactType = new Map<ContactMethodType, boolean>();
  for (const cm of rawContacts) {
    const normalized = normalizeAndValidateContact(cm.methodType, cm.value);
    const hasPrimaryAlready = hasExplicitPrimaryByContactType.get(cm.methodType) ?? false;
    const isPrimary = cm.isPrimary ?? (!primaryContactTypes.has(cm.methodType) && !hasPrimaryAlready);
    if (isPrimary) hasExplicitPrimaryByContactType.set(cm.methodType, true);
    store.contactMethods.push({
      id: newIdempotencyKey(),
      partyId: id,
      methodType: cm.methodType,
      value: normalized.value,
      normalizedValue: normalized.normalizedValue,
      phoneDigits: normalized.phoneDigits,
      label: trimNullable(cm.label),
      isPrimary,
      isVerified: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
  for (const type of new Set(rawContacts.map((cm) => cm.methodType))) {
    promoteOldestPrimaryContact(id, type);
  }

  const hasExplicitPrimaryByAddrType = new Map<AddressType, boolean>();
  for (const addr of rawAddresses) {
    const hasPrimaryAlready = hasExplicitPrimaryByAddrType.get(addr.addressType) ?? false;
    const isPrimary = addr.isPrimary ?? (!primaryAddressTypes.has(addr.addressType) && !hasPrimaryAlready);
    if (isPrimary) hasExplicitPrimaryByAddrType.set(addr.addressType, true);
    store.addresses.push({
      id: newIdempotencyKey(),
      partyId: id,
      addressType: addr.addressType,
      countryId: null,
      stateId: null,
      cityId: null,
      districtId: null,
      label: trimNullable(addr.label),
      country: trimNullable(addr.country),
      city: trimNullable(addr.city),
      area: trimNullable(addr.area),
      street: trimNullable(addr.street),
      buildingNo: trimNullable(addr.buildingNo),
      floor: trimNullable(addr.floor),
      apartment: trimNullable(addr.apartment),
      landmark: trimNullable(addr.landmark),
      postalCode: trimNullable(addr.postalCode),
      isPrimary,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
  for (const type of new Set(rawAddresses.map((addr) => addr.addressType))) {
    promoteOldestPrimaryAddress(id, type);
  }

  return buildPartyDetail(newParty);
}

export async function fakeUpdateParty(id: string, body: UpdatePartyBody): Promise<PartyDetail> {
  await fakeDelay();
  requirePermissionGuard('directory.party.manage');
  validateDto(UPDATE_PARTY_SCHEMA, body);
  const party = requirePartyExists(id);
  requireBranchPermission('directory.party.manage', party.branchId);

  const nextBranchId = body.branchId !== undefined ? body.branchId : party.branchId;
  if (body.branchId !== undefined && body.branchId !== party.branchId) {
    requireBranchPermission('directory.party.manage', nextBranchId);
    await assertValidBranch(nextBranchId);
  }

  const nextOwnerId = body.ownerUserId !== undefined ? body.ownerUserId : party.ownerUserId;
  if (body.ownerUserId !== undefined && body.ownerUserId !== party.ownerUserId) {
    await assertValidOwner(nextOwnerId);
  }

  if (body.status !== undefined && !PARTY_STATUSES.includes(body.status)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const nextDisplayName = body.displayName !== undefined ? body.displayName.trim() : party.displayName;
  if (!nextDisplayName) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const nextFields = {
    legalName: body.legalName !== undefined ? trimNullable(body.legalName) : party.legalName,
    firstName: body.firstName !== undefined ? trimNullable(body.firstName) : party.firstName,
    lastName: body.lastName !== undefined ? trimNullable(body.lastName) : party.lastName,
    honorificTitle: body.honorificTitle !== undefined ? trimNullable(body.honorificTitle) : party.honorificTitle,
    organizationName: body.organizationName !== undefined ? trimNullable(body.organizationName) : party.organizationName,
    taxNumber: body.taxNumber !== undefined ? trimNullable(body.taxNumber) : party.taxNumber,
    commercialRegistrationNumber:
      body.commercialRegistrationNumber !== undefined
        ? trimNullable(body.commercialRegistrationNumber)
        : party.commercialRegistrationNumber,
  };

  assertMaxLength(nextDisplayName, PARTY_LIMITS.displayName);
  assertMaxLength(nextFields.legalName, PARTY_LIMITS.legalName);
  assertMaxLength(nextFields.firstName, PARTY_LIMITS.firstName);
  assertMaxLength(nextFields.lastName, PARTY_LIMITS.lastName);
  assertMaxLength(nextFields.honorificTitle, PARTY_LIMITS.honorificTitle);
  assertMaxLength(nextFields.organizationName, PARTY_LIMITS.organizationName);
  assertMaxLength(nextFields.taxNumber, PARTY_LIMITS.taxNumber);
  assertMaxLength(nextFields.commercialRegistrationNumber, PARTY_LIMITS.commercialRegistrationNumber);

  assertTypeFieldCompatibility(party.partyType, nextFields);

  if (body.branchId !== undefined && body.branchId !== party.branchId && peekDirectorySettings().duplicateScope === 'BRANCH') {
    for (const cm of liveContactsFor(party.id)) {
      assertContactNoDuplicate(party, cm.methodType, cm.normalizedValue, cm.id, nextBranchId);
    }
  }

  party.displayName = nextDisplayName;
  party.legalName = nextFields.legalName;
  party.firstName = nextFields.firstName;
  party.lastName = nextFields.lastName;
  party.honorificTitle = nextFields.honorificTitle;
  party.organizationName = nextFields.organizationName;
  party.taxNumber = nextFields.taxNumber;
  party.commercialRegistrationNumber = nextFields.commercialRegistrationNumber;
  party.branchId = nextBranchId;
  party.ownerUserId = nextOwnerId;
  if (body.status !== undefined) {
    party.status = body.status;
  }
  party.updatedAt = nowIso();

  return buildPartyDetail(party);
}

export async function fakeDeleteParty(id: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.party.manage');
  const party = requirePartyExists(id);
  requireBranchPermission('directory.party.manage', party.branchId);

  const hasNonCoreRole = liveRolesFor(id).some(
    (r) => r.status === 'ACTIVE' && r.appSource !== null && r.appSource !== 'core-app',
  );
  const hasRelationships = store.relationships.some(
    (rel) => !rel.deletedAt && (rel.fromPartyId === id || rel.toPartyId === id),
  );

  if (hasNonCoreRole || hasRelationships) {
    throw new ApiError(409, 'DIRECTORY_PARTY_IN_USE');
  }

  const now = nowIso();
  party.deletedAt = now;
  party.updatedAt = now;
  if (party.imageUrl) {
    store.images.delete(party.imageUrl);
    party.imageUrl = null;
    party.imageRevision = null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new ApiError(415, 'PARTY_IMAGE_INVALID'));
      }
    };
    reader.onerror = () => reject(new ApiError(415, 'PARTY_IMAGE_INVALID'));
    reader.readAsDataURL(file);
  });
}

export async function fakeUploadPartyImage(id: string, file: File): Promise<PartyDetail> {
  await fakeDelay();
  requirePermissionGuard('directory.party.manage');
  const party = requirePartyExists(id);
  requireBranchPermission('directory.party.manage', party.branchId);

  if (!file) {
    throw new ApiError(400, 'PARTY_IMAGE_REQUIRED');
  }
  if (!ALLOWED_IMAGE_MIME.has(file.type)) {
    throw new ApiError(415, 'PARTY_IMAGE_INVALID');
  }
  if (file.size > PARTY_LIMITS.maxImageBytes) {
    throw new ApiError(413, 'PARTY_IMAGE_TOO_LARGE');
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (party.imageUrl) {
    store.images.delete(party.imageUrl);
  }
  const rev = String(Date.now());
  const imageUrl = `/api/v1/tenant/directory/parties/${party.id}/image?v=${rev}`;
  store.images.set(imageUrl, dataUrl);
  party.imageUrl = imageUrl;
  party.imageRevision = rev;
  party.updatedAt = nowIso();

  return buildPartyDetail(party);
}

export async function fakeDeletePartyImage(id: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.party.manage');
  const party = requirePartyExists(id);
  requireBranchPermission('directory.party.manage', party.branchId);

  if (!party.imageUrl) {
    throw new ApiError(404, 'PARTY_IMAGE_NOT_FOUND');
  }
  store.images.delete(party.imageUrl);
  party.imageUrl = null;
  party.imageRevision = null;
  party.updatedAt = nowIso();
}

export async function fakeListOrgContacts(id: string, q: ListOrgContactsQuery = {}): Promise<Page<OrgContact>> {
  await fakeDelay();
  requireReadPermission();
  validateDto(PAGINATION_SCHEMA, definedQuery(q));
  const org = requirePartyExists(id);
  if (!canReadBranch(org.branchId)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }

  const page = q.page ?? 1;
  const limit = q.limit ?? 20;

  if (org.partyType !== 'ORGANIZATION') {
    return emptyPage(page, limit);
  }

  // Contacts outside the actor's read branches are left out (shared contacts stay).
  const livePersonMap = new Map(
    liveParties()
      .filter((p) => p.partyType === 'PERSON' && canReadBranch(p.branchId))
      .map((p) => [p.id, p]),
  );

  // DISTINCT ON (to_party_id): one row per person, the primary then the oldest link.
  const relsByPerson = new Map<string, PartyRelationship>();
  store.relationships
    .filter(
      (rel) =>
        !rel.deletedAt &&
        rel.fromPartyId === id &&
        ORG_CONTACT_REL_TYPES.has(rel.relationshipType) &&
        livePersonMap.has(rel.toPartyId),
    )
    .sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
    .forEach((rel) => {
      if (!relsByPerson.has(rel.toPartyId)) relsByPerson.set(rel.toPartyId, rel);
    });
  const rels = Array.from(relsByPerson.values());

  const items: OrgContact[] = rels.map((rel) => {
    const person = livePersonMap.get(rel.toPartyId)!;
    const contacts = liveContactsFor(person.id);
    const preferred = (type: ContactMethodType) => {
      const ofType = contacts.filter((c) => c.methodType === type);
      ofType.sort((a, b) => (a.isPrimary === b.isPrimary ? a.createdAt.localeCompare(b.createdAt) : a.isPrimary ? -1 : 1));
      return ofType[0]?.value ?? null;
    };
    const phones: OrgContactPhone[] = contacts
      .filter((c) => c.methodType === 'PHONE' || c.methodType === 'MOBILE')
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        methodType: c.methodType,
        value: c.value,
        label: c.label,
        isPrimary: c.isPrimary,
        isVerified: c.isVerified,
      }));

    return {
      relationshipId: rel.id,
      relationshipType: rel.relationshipType,
      relationshipLabel: rel.label,
      isPrimary: rel.isPrimary,
      partyId: person.id,
      displayName: person.displayName,
      firstName: person.firstName,
      lastName: person.lastName,
      honorificTitle: person.honorificTitle,
      email: preferred('EMAIL'),
      mobile: preferred('MOBILE'),
      phone: preferred('PHONE'),
      phones,
      imageUrl: person.imageUrl,
      imageKind: 'PHOTO',
      imageRevision: person.imageRevision,
    };
  });

  items.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const nameCmp = a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    return nameCmp !== 0 ? nameCmp : a.partyId.localeCompare(b.partyId);
  });

  return toPage(items, page, limit);
}

export async function fakeAddContactMethod(id: string, body: CreateContactMethodBody): Promise<PartyContactMethod> {
  await fakeDelay();
  requirePermissionGuard('directory.contact.manage');
  validateDto(CONTACT_METHOD_SCHEMA, body);
  const party = requirePartyExists(id);
  requireBranchPermission('directory.contact.manage', party.branchId);

  if (!CONTACT_METHOD_TYPES.includes(body.methodType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const existing = liveContactsFor(id);
  if (existing.length >= peekDirectorySettings().maxContactMethodsPerParty) {
    throw new ApiError(422, 'PARTY_CONTACT_METHOD_LIMIT_EXCEEDED');
  }

  const normalized = normalizeAndValidateContact(body.methodType, body.value);
  const label = trimNullable(body.label);
  assertMaxLength(label, PARTY_LIMITS.contactLabel);
  assertContactNoDuplicate(party, body.methodType, normalized.normalizedValue);

  const sameType = existing.filter((c) => c.methodType === body.methodType);
  const isPrimary = sameType.length === 0 ? true : Boolean(body.isPrimary);
  if (isPrimary) {
    for (const cm of sameType) cm.isPrimary = false;
  }

  const now = nowIso();
  const created: PartyContactMethod = {
    id: newIdempotencyKey(),
    partyId: id,
    methodType: body.methodType,
    value: normalized.value,
    normalizedValue: normalized.normalizedValue,
    phoneDigits: normalized.phoneDigits,
    label,
    isPrimary,
    isVerified: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  store.contactMethods.push(created);
  party.updatedAt = now;
  return clone(created);
}

export async function fakeUpdateContactMethod(
  methodId: string,
  body: UpdateContactMethodBody,
): Promise<PartyContactMethod> {
  await fakeDelay();
  requirePermissionGuard('directory.contact.manage');
  validateDto(UPDATE_CONTACT_METHOD_SCHEMA, body);
  const cm = store.contactMethods.find((c) => c.id === methodId && !c.deletedAt);
  if (!cm) {
    throw new ApiError(404, 'PARTY_CONTACT_METHOD_NOT_FOUND');
  }
  const party = requirePartyExists(cm.partyId);
  requireBranchPermission('directory.contact.manage', party.branchId);

  const nextType = body.methodType ?? cm.methodType;
  if (!CONTACT_METHOD_TYPES.includes(nextType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  const nextRawValue = body.value !== undefined ? body.value : cm.value;
  const normalized = normalizeAndValidateContact(nextType, nextRawValue);
  const nextLabel = body.label !== undefined ? trimNullable(body.label) : cm.label;
  assertMaxLength(nextLabel, PARTY_LIMITS.contactLabel);

  assertContactNoDuplicate(party, nextType, normalized.normalizedValue, cm.id);

  const oldType = cm.methodType;
  const wasPrimary = cm.isPrimary;

  cm.methodType = nextType;
  cm.value = normalized.value;
  cm.normalizedValue = normalized.normalizedValue;
  cm.phoneDigits = normalized.phoneDigits;
  cm.label = nextLabel;

  if (body.isPrimary === true) {
    for (const other of liveContactsFor(party.id)) {
      if (other.id !== cm.id && other.methodType === nextType) {
        other.isPrimary = false;
      }
    }
    cm.isPrimary = true;
  } else if (body.isPrimary === false) {
    cm.isPrimary = false;
    promoteOldestPrimaryContact(party.id, nextType);
  } else if (oldType !== nextType) {
    const targetSameType = liveContactsFor(party.id).filter((c) => c.id !== cm.id && c.methodType === nextType);
    if (targetSameType.length === 0) {
      cm.isPrimary = true;
    } else if (cm.isPrimary) {
      for (const other of targetSameType) other.isPrimary = false;
    }
    if (wasPrimary) {
      promoteOldestPrimaryContact(party.id, oldType);
    }
  }

  const now = nowIso();
  cm.updatedAt = now;
  party.updatedAt = now;
  return clone(cm);
}

export async function fakeDeleteContactMethod(methodId: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.contact.manage');
  const cm = store.contactMethods.find((c) => c.id === methodId && !c.deletedAt);
  if (!cm) {
    throw new ApiError(404, 'PARTY_CONTACT_METHOD_NOT_FOUND');
  }
  const party = requirePartyExists(cm.partyId);
  requireBranchPermission('directory.contact.manage', party.branchId);

  const now = nowIso();
  cm.deletedAt = now;
  cm.updatedAt = now;
  if (cm.isPrimary) {
    promoteOldestPrimaryContact(party.id, cm.methodType);
  }
  party.updatedAt = now;
}

export async function fakeAddAddress(id: string, body: CreateAddressBody): Promise<PartyAddress> {
  await fakeDelay();
  requirePermissionGuard('directory.address.manage');
  validateDto(ADDRESS_SCHEMA, body);
  const party = requirePartyExists(id);
  requireBranchPermission('directory.address.manage', party.branchId);

  if (!ADDRESS_TYPES.includes(body.addressType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const existing = liveAddressesFor(id);
  if (existing.length >= peekDirectorySettings().maxAddressesPerParty) {
    throw new ApiError(422, 'PARTY_ADDRESS_LIMIT_EXCEEDED');
  }

  const fields = {
    label: trimNullable(body.label),
    country: trimNullable(body.country),
    city: trimNullable(body.city),
    area: trimNullable(body.area),
    street: trimNullable(body.street),
    buildingNo: trimNullable(body.buildingNo),
    floor: trimNullable(body.floor),
    apartment: trimNullable(body.apartment),
    landmark: trimNullable(body.landmark),
    postalCode: trimNullable(body.postalCode),
  };

  assertMaxLength(fields.label, PARTY_LIMITS.addressLabel);
  assertMaxLength(fields.country, PARTY_LIMITS.addressCountry);
  assertMaxLength(fields.city, PARTY_LIMITS.addressCity);
  assertMaxLength(fields.area, PARTY_LIMITS.addressArea);
  assertMaxLength(fields.street, PARTY_LIMITS.addressStreet);
  assertMaxLength(fields.buildingNo, PARTY_LIMITS.addressBuildingNo);
  assertMaxLength(fields.floor, PARTY_LIMITS.addressFloor);
  assertMaxLength(fields.apartment, PARTY_LIMITS.addressApartment);
  assertMaxLength(fields.landmark, PARTY_LIMITS.addressLandmark);
  assertMaxLength(fields.postalCode, PARTY_LIMITS.addressPostalCode);

  const sameType = existing.filter((a) => a.addressType === body.addressType);
  const isPrimary = sameType.length === 0 ? true : Boolean(body.isPrimary);
  if (isPrimary) {
    for (const addr of sameType) addr.isPrimary = false;
  }

  const now = nowIso();
  const created: PartyAddress = {
    id: newIdempotencyKey(),
    partyId: id,
    addressType: body.addressType,
    countryId: null,
    stateId: null,
    cityId: null,
    districtId: null,
    ...fields,
    isPrimary,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  store.addresses.push(created);
  party.updatedAt = now;
  return clone(created);
}

export async function fakeUpdateAddress(addressId: string, body: UpdateAddressBody): Promise<PartyAddress> {
  await fakeDelay();
  requirePermissionGuard('directory.address.manage');
  validateDto(UPDATE_ADDRESS_SCHEMA, body);
  const addr = store.addresses.find((a) => a.id === addressId && !a.deletedAt);
  if (!addr) {
    throw new ApiError(404, 'PARTY_ADDRESS_NOT_FOUND');
  }
  const party = requirePartyExists(addr.partyId);
  requireBranchPermission('directory.address.manage', party.branchId);

  const nextType = body.addressType ?? addr.addressType;
  if (!ADDRESS_TYPES.includes(nextType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  const nextFields = {
    label: body.label !== undefined ? trimNullable(body.label) : addr.label,
    country: body.country !== undefined ? trimNullable(body.country) : addr.country,
    city: body.city !== undefined ? trimNullable(body.city) : addr.city,
    area: body.area !== undefined ? trimNullable(body.area) : addr.area,
    street: body.street !== undefined ? trimNullable(body.street) : addr.street,
    buildingNo: body.buildingNo !== undefined ? trimNullable(body.buildingNo) : addr.buildingNo,
    floor: body.floor !== undefined ? trimNullable(body.floor) : addr.floor,
    apartment: body.apartment !== undefined ? trimNullable(body.apartment) : addr.apartment,
    landmark: body.landmark !== undefined ? trimNullable(body.landmark) : addr.landmark,
    postalCode: body.postalCode !== undefined ? trimNullable(body.postalCode) : addr.postalCode,
  };

  assertMaxLength(nextFields.label, PARTY_LIMITS.addressLabel);
  assertMaxLength(nextFields.country, PARTY_LIMITS.addressCountry);
  assertMaxLength(nextFields.city, PARTY_LIMITS.addressCity);
  assertMaxLength(nextFields.area, PARTY_LIMITS.addressArea);
  assertMaxLength(nextFields.street, PARTY_LIMITS.addressStreet);
  assertMaxLength(nextFields.buildingNo, PARTY_LIMITS.addressBuildingNo);
  assertMaxLength(nextFields.floor, PARTY_LIMITS.addressFloor);
  assertMaxLength(nextFields.apartment, PARTY_LIMITS.addressApartment);
  assertMaxLength(nextFields.landmark, PARTY_LIMITS.addressLandmark);
  assertMaxLength(nextFields.postalCode, PARTY_LIMITS.addressPostalCode);

  const oldType = addr.addressType;
  const wasPrimary = addr.isPrimary;

  addr.addressType = nextType;
  Object.assign(addr, nextFields);

  if (body.isPrimary === true) {
    for (const other of liveAddressesFor(party.id)) {
      if (other.id !== addr.id && other.addressType === nextType) {
        other.isPrimary = false;
      }
    }
    addr.isPrimary = true;
  } else if (body.isPrimary === false) {
    addr.isPrimary = false;
    promoteOldestPrimaryAddress(party.id, nextType);
  } else if (oldType !== nextType) {
    const targetSameType = liveAddressesFor(party.id).filter((a) => a.id !== addr.id && a.addressType === nextType);
    if (targetSameType.length === 0) {
      addr.isPrimary = true;
    } else if (addr.isPrimary) {
      for (const other of targetSameType) other.isPrimary = false;
    }
    if (wasPrimary) {
      promoteOldestPrimaryAddress(party.id, oldType);
    }
  }

  const now = nowIso();
  addr.updatedAt = now;
  party.updatedAt = now;
  return clone(addr);
}

export async function fakeDeleteAddress(addressId: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.address.manage');
  const addr = store.addresses.find((a) => a.id === addressId && !a.deletedAt);
  if (!addr) {
    throw new ApiError(404, 'PARTY_ADDRESS_NOT_FOUND');
  }
  const party = requirePartyExists(addr.partyId);
  requireBranchPermission('directory.address.manage', party.branchId);

  const now = nowIso();
  addr.deletedAt = now;
  addr.updatedAt = now;
  if (addr.isPrimary) {
    promoteOldestPrimaryAddress(party.id, addr.addressType);
  }
  party.updatedAt = now;
}

export async function fakeAddRole(id: string, body: CreateRoleBody): Promise<PartyRole> {
  await fakeDelay();
  requirePermissionGuard('directory.role.manage');
  validateDto(ROLE_SCHEMA, body);
  const party = requirePartyExists(id);
  const roleBranchId = body.branchId ?? null;
  requireBranchPermission('directory.role.manage', party.branchId);
  requireBranchPermission('directory.role.manage', roleBranchId);

  if (!PARTY_ROLE_TYPES.includes(body.roleType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  await assertValidBranch(roleBranchId);
  const metadata = validateFlatMetadata(body.metadata);

  const existing = liveRolesFor(id);
  if (existing.length >= PARTY_LIMITS.maxRolesPerParty) {
    throw new ApiError(422, 'PARTY_ROLE_LIMIT_EXCEEDED');
  }

  const duplicate = existing.some((r) => r.roleType === body.roleType && r.branchId === roleBranchId);
  if (duplicate) {
    throw new ApiError(409, 'PARTY_ROLE_ALREADY_EXISTS');
  }

  const now = nowIso();
  const created: PartyRole = {
    id: newIdempotencyKey(),
    partyId: id,
    roleType: body.roleType,
    branchId: roleBranchId,
    status: 'ACTIVE',
    appSource: 'core-app',
    metadata,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  store.roles.push(created);

  if (peekDirectorySettings().duplicateScope === 'PARTY_ROLE') {
    try {
      for (const cm of liveContactsFor(id)) {
        assertContactNoDuplicate(party, cm.methodType, cm.normalizedValue, cm.id);
      }
    } catch (err) {
      store.roles = store.roles.filter((r) => r.id !== created.id);
      throw err;
    }
  }

  party.updatedAt = now;
  return clone(created);
}

export async function fakeDeleteRole(roleId: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.role.manage');
  const role = store.roles.find((r) => r.id === roleId && !r.deletedAt);
  if (!role) {
    throw new ApiError(404, 'PARTY_ROLE_NOT_FOUND');
  }
  const party = requirePartyExists(role.partyId);
  requireBranchPermission('directory.role.manage', party.branchId);
  requireBranchPermission('directory.role.manage', role.branchId);

  if (role.appSource && role.appSource !== 'core-app') {
    throw new ApiError(409, 'PARTY_ROLE_MANAGED_BY_APP');
  }

  const now = nowIso();
  role.deletedAt = now;
  role.updatedAt = now;
  party.updatedAt = now;
}

export async function fakeAddRelationship(body: CreateRelationshipBody): Promise<PartyRelationship> {
  await fakeDelay();
  requirePermissionGuard('directory.relationship.manage');
  validateDto(RELATIONSHIP_SCHEMA, body);
  if (!RELATIONSHIP_TYPES.includes(body.relationshipType)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  if (body.fromPartyId === body.toPartyId) {
    throw new ApiError(422, 'PARTY_RELATIONSHIP_INVALID');
  }

  const fromParty = requirePartyExists(body.fromPartyId);
  const toParty = requirePartyExists(body.toPartyId);

  requireBranchPermission('directory.relationship.manage', fromParty.branchId);
  if (!canReadBranch(toParty.branchId)) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }

  const label = trimNullable(body.label);
  assertMaxLength(label, PARTY_LIMITS.relationshipLabel);

  const duplicate = store.relationships.some(
    (rel) =>
      !rel.deletedAt &&
      rel.fromPartyId === body.fromPartyId &&
      rel.toPartyId === body.toPartyId &&
      rel.relationshipType === body.relationshipType,
  );
  if (duplicate) {
    throw new ApiError(409, 'PARTY_RELATIONSHIP_ALREADY_EXISTS');
  }

  const isPrimary = Boolean(body.isPrimary);
  if (isPrimary) {
    for (const rel of store.relationships) {
      if (!rel.deletedAt && rel.fromPartyId === body.fromPartyId && rel.relationshipType === body.relationshipType) {
        rel.isPrimary = false;
      }
    }
  }

  const now = nowIso();
  const created: PartyRelationship = {
    id: newIdempotencyKey(),
    fromPartyId: body.fromPartyId,
    toPartyId: body.toPartyId,
    relationshipType: body.relationshipType,
    label,
    isPrimary,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  store.relationships.push(created);
  fromParty.updatedAt = now;
  return clone(created);
}

export async function fakeDeleteRelationship(relationshipId: string): Promise<void> {
  await fakeDelay();
  requirePermissionGuard('directory.relationship.manage');
  const rel = store.relationships.find((r) => r.id === relationshipId && !r.deletedAt);
  if (!rel) {
    throw new ApiError(404, 'PARTY_RELATIONSHIP_NOT_FOUND');
  }
  const fromParty = requirePartyExists(rel.fromPartyId);
  requireBranchPermission('directory.relationship.manage', fromParty.branchId);

  const now = nowIso();
  rel.deletedAt = now;
  rel.updatedAt = now;
  fromParty.updatedAt = now;
}

/** GET /directory/settings: the same singleton the directory-settings screen edits. */
export function fakeGetDirectorySettings(): Promise<DirectorySettings> {
  return fakeGetSharedDirectorySettings();
}
