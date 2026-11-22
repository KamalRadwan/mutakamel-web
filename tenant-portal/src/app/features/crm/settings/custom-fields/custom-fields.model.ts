export const CUSTOM_FIELD_OWNER_TYPES = ['LEAD', 'PARTY', 'CUSTOMER_PROFILE', 'OPPORTUNITY', 'LEAD_AND_PARTY'] as const;
export type CustomFieldOwnerType = (typeof CUSTOM_FIELD_OWNER_TYPES)[number];

export const CREATABLE_OWNER_TYPES = ['LEAD', 'PARTY', 'CUSTOMER_PROFILE', 'OPPORTUNITY'] as const;
export type CreatableOwnerType = (typeof CREATABLE_OWNER_TYPES)[number];

export const CUSTOM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'DATETIME',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'URL',
  'EMAIL',
  'PHONE',
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const REQUIREMENT_OPERATIONS = ['CREATE', 'UPDATE', 'CONVERT'] as const;
export type RequirementOperation = (typeof REQUIREMENT_OPERATIONS)[number];

export const MAX_DEFINITIONS = 100;
export const MAX_OPTIONS = 100;
export const MAX_NAME_LEN = 120;
export const MAX_PLACEHOLDER_LEN = 180;
export const MAX_KEY_LEN = 64;
export const MAX_TEXT_LEN = 500;
export const MAX_TEXTAREA_LEN = 5000;
export const MAX_URL_LEN = 2048;
export const MAX_EMAIL_LEN = 254;
export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

export const FIELD_TYPE_ICONS: Record<CustomFieldType, string> = {
  TEXT: 'tablerEdit',
  TEXTAREA: 'tablerLayoutRows',
  NUMBER: 'tablerListNumbers',
  DATE: 'tablerCalendar',
  DATETIME: 'tablerCalendarEvent',
  BOOLEAN: 'tablerCircleDot',
  SELECT: 'tablerHierarchy2',
  MULTI_SELECT: 'tablerSquareCheck',
  URL: 'tablerLink',
  EMAIL: 'tablerMail',
  PHONE: 'tablerPhone',
};

export const OWNER_TYPE_LOOK: Record<CustomFieldOwnerType, { icon: string; tile: string }> = {
  LEAD: { icon: 'tablerUserPlus', tile: 'bg-icon-green' },
  PARTY: { icon: 'tablerUser', tile: 'bg-icon-blue' },
  CUSTOMER_PROFILE: { icon: 'tablerUsers', tile: 'bg-icon-navy' },
  OPPORTUNITY: { icon: 'tablerTarget', tile: 'bg-icon-red' },
  LEAD_AND_PARTY: { icon: 'tablerUsers', tile: 'bg-icon-teal' },
};

export interface FieldOption {
  key: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface EditableFieldOption extends FieldOption {
  uid: string;
  isSaved: boolean;
}

export interface Requirement {
  operation: RequirementOperation;
  entityScope: string | null;
  isRequired: boolean;
}

export interface CustomField {
  id: string;
  ownerType: CustomFieldOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CustomFieldType;
  placeholderAr: string | null;
  placeholderEn: string | null;
  options: FieldOption[];
  isSearchable?: boolean;
  sortOrder: number;
  isActive: boolean;
  requirements: Requirement[];
  createdAt: string;
  updatedAt: string;
}

// POST and PATCH /custom-fields return the saved definition row without requirements
// (backend custom-fields.service.ts createDefinition/updateDefinition).
export type CustomFieldDefinition = Omit<CustomField, 'requirements'>;

// POST /custom-fields/:id/requirements returns only the saved requirement row
// (backend custom-fields.service.ts setRequirement).
export interface FieldRequirementRow extends Requirement {
  id: string;
  fieldDefinitionId: string;
  createdAt: string;
  updatedAt: string;
}

/** Merges a saved requirement row into the field it belongs to. */
export function mergeRequirementRow(field: CustomField, row: FieldRequirementRow): CustomField {
  const next: Requirement = { operation: row.operation, entityScope: row.entityScope ?? null, isRequired: row.isRequired };
  const index = field.requirements.findIndex(
    (req) => req.operation === next.operation && req.entityScope === next.entityScope,
  );
  const requirements =
    index >= 0
      ? field.requirements.map((req, idx) => (idx === index ? next : req))
      : [...field.requirements, next];
  return { ...field, requirements };
}

export interface CreateCustomFieldInput {
  ownerType: CreatableOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CustomFieldType;
  placeholderAr?: string;
  placeholderEn?: string;
  options?: FieldOption[];
  isSearchable?: boolean;
  sortOrder?: number;
}

export interface UpdateCustomFieldPatch {
  fieldKey?: string;
  nameAr?: string;
  nameEn?: string;
  placeholderAr?: string | null;
  placeholderEn?: string | null;
  options?: FieldOption[];
  isSearchable?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SetRequirementInput {
  operation: RequirementOperation;
  entityScope?: string | null;
  isRequired: boolean;
}

export type CustomFieldValueScalar = string | number | boolean | string[] | null;

export interface CustomFieldValueRow {
  id: string;
  branchId: string;
  fieldDefinitionId: string;
  ownerType: CreatableOwnerType;
  ownerId: string;
  value: CustomFieldValueScalar;
  updatedAt: string;
}

export interface SaveCustomFieldValueInput {
  branchId: string;
  fieldDefinitionId: string;
  ownerType: CreatableOwnerType;
  ownerId: string;
  value: CustomFieldValueScalar;
}

export interface SampleBranch {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface SampleRecord {
  id: string;
  branchId: string;
  ownerType: CreatableOwnerType;
  nameAr: string;
  nameEn: string;
  code: string;
}

export function normalizeFieldKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '_').replace(/_+$/, '').toLowerCase();
}

export function liveNormalizeFieldKey(raw: string): string {
  return raw.replace(/^\s+/, '').replace(/\s+/g, '_').toLowerCase();
}

export function autoKeyFromEnglish(nameEn: string): string {
  return nameEn
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, MAX_KEY_LEN);
}

export function isChoicesType(type: CustomFieldType): boolean {
  return type === 'SELECT' || type === 'MULTI_SELECT';
}

export function matchesOwnerType(fieldOwner: CustomFieldOwnerType, target: CreatableOwnerType): boolean {
  if (fieldOwner === target) return true;
  return fieldOwner === 'LEAD_AND_PARTY' && (target === 'LEAD' || target === 'PARTY');
}

export function localizedName(item: { nameAr: string; nameEn: string }, language: string): string {
  return language === 'ar' ? item.nameAr : item.nameEn;
}

export function globalRequirement(field: CustomField, operation: RequirementOperation): boolean {
  return field.requirements.some((req) => req.operation === operation && req.entityScope === null && req.isRequired);
}

export function scopedRequirements(field: CustomField): Requirement[] {
  return field.requirements.filter((req) => req.entityScope !== null);
}

export function isRequiredForOperation(
  field: CustomField,
  operation: RequirementOperation,
  ownerType?: CreatableOwnerType,
): boolean {
  return field.requirements.some((req) => {
    if (req.operation !== operation || !req.isRequired) return false;
    if (req.entityScope === null) return true;
    return ownerType ? req.entityScope === ownerType : true;
  });
}

export function isClearedValue(value: CustomFieldValueScalar, type: CustomFieldType): boolean {
  if (value === null || value === undefined) return true;
  if (type === 'BOOLEAN') return false;
  if (type === 'NUMBER') return typeof value === 'string' && value.trim() === '';
  if (type === 'MULTI_SELECT') return Array.isArray(value) && value.length === 0;
  return typeof value === 'string' && value.trim() === '';
}

export function validateCustomFieldValue(field: CustomField, value: CustomFieldValueScalar): boolean {
  if (value === null) return true;
  switch (field.type) {
    case 'TEXT':
      return typeof value === 'string' && value.length <= MAX_TEXT_LEN;
    case 'TEXTAREA':
      return typeof value === 'string' && value.length <= MAX_TEXTAREA_LEN;
    case 'NUMBER': {
      const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
      return Number.isFinite(num);
    }
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'DATE':
      return typeof value === 'string' && isValidIsoDate(value);
    case 'DATETIME':
      return typeof value === 'string' && isValidIsoDateTime(value);
    case 'URL':
      return typeof value === 'string' && value.length <= MAX_URL_LEN && isValidHttpUrl(value);
    case 'EMAIL':
      return typeof value === 'string' && value.length <= MAX_EMAIL_LEN && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'PHONE': {
      if (typeof value !== 'string' || !/^[+\d\s().-]+$/.test(value)) return false;
      const digits = value.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    }
    case 'SELECT':
      return typeof value === 'string' && field.options.some((opt) => opt.isActive && opt.key === value);
    case 'MULTI_SELECT': {
      if (!Array.isArray(value) || value.length === 0) return false;
      if (new Set(value).size !== value.length) return false;
      const activeKeys = new Set(field.options.filter((opt) => opt.isActive).map((opt) => opt.key));
      return value.every((item) => typeof item === 'string' && activeKeys.has(item));
    }
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

function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
