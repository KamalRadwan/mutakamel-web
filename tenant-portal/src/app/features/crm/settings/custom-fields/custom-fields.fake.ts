import { ApiError, fakeDelay, fakeId } from '../shared/settings-api';
import {
  CREATABLE_OWNER_TYPES,
  CreatableOwnerType,
  CreateCustomFieldInput,
  CustomField,
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldValueRow,
  FIELD_KEY_REGEX,
  FieldOption,
  FieldRequirementRow,
  MAX_DEFINITIONS,
  MAX_KEY_LEN,
  MAX_NAME_LEN,
  MAX_OPTIONS,
  MAX_PLACEHOLDER_LEN,
  RequirementOperation,
  SampleBranch,
  SampleRecord,
  SaveCustomFieldValueInput,
  SetRequirementInput,
  UpdateCustomFieldPatch,
  isChoicesType,
  isClearedValue,
  isRequiredForOperation,
  normalizeFieldKey,
  validateCustomFieldValue,
} from './custom-fields.model';

const NOW = '2026-11-18T10:00:00.000Z';

const BRANCHES: SampleBranch[] = [
  { id: 'b1', nameAr: 'الفرع الرئيسي - القاهرة', nameEn: 'Main Branch - Cairo' },
  { id: 'b2', nameAr: 'فرع الإسكندرية', nameEn: 'Alexandria Branch' },
];

const SAMPLE_RECORDS: SampleRecord[] = [
  { id: 'lead-1', branchId: 'b1', ownerType: 'LEAD', nameAr: 'شركة النيل للتقنية', nameEn: 'Nile Tech Solutions', code: 'LD-1042' },
  { id: 'lead-2', branchId: 'b1', ownerType: 'LEAD', nameAr: 'أحمد منصور', nameEn: 'Ahmed Mansour', code: 'LD-1048' },
  { id: 'lead-3', branchId: 'b2', ownerType: 'LEAD', nameAr: 'مؤسسة الدلتا التجارية', nameEn: 'Delta Trading Co.', code: 'LD-1051' },
  { id: 'party-1', branchId: 'b1', ownerType: 'PARTY', nameAr: 'سارة حسن', nameEn: 'Sara Hassan', code: 'CT-2011' },
  { id: 'party-2', branchId: 'b1', ownerType: 'PARTY', nameAr: 'خالد الشريف', nameEn: 'Khaled El-Sherif', code: 'CT-2019' },
  { id: 'party-3', branchId: 'b2', ownerType: 'PARTY', nameAr: 'مريم عبد الله', nameEn: 'Mariam Abdullah', code: 'CT-2024' },
  { id: 'cust-1', branchId: 'b1', ownerType: 'CUSTOMER_PROFILE', nameAr: 'مجموعة المعادي الصناعية', nameEn: 'Maadi Industrial Group', code: 'CU-3005' },
  { id: 'cust-2', branchId: 'b2', ownerType: 'CUSTOMER_PROFILE', nameAr: 'شركة الميناء للخدمات اللوجستية', nameEn: 'Harbor Logistics LLC', code: 'CU-3012' },
  { id: 'opp-1', branchId: 'b1', ownerType: 'OPPORTUNITY', nameAr: 'تجديد باقة المؤسسات السنوية', nameEn: 'Annual Enterprise Suite Renewal', code: 'OP-4008' },
  { id: 'opp-2', branchId: 'b2', ownerType: 'OPPORTUNITY', nameAr: 'توسعة نظام الفوترة', nameEn: 'Billing System Expansion', code: 'OP-4014' },
];

let definitions: CustomField[] = [
  {
    id: 'cf-lead-budget',
    ownerType: 'LEAD',
    fieldKey: 'budget_range',
    nameAr: 'نطاق الميزانية',
    nameEn: 'Budget range',
    type: 'SELECT',
    placeholderAr: 'اختر نطاق الميزانية',
    placeholderEn: 'Select budget range',
    options: [
      { key: 'under_50k', nameAr: 'أقل من 50,000', nameEn: 'Under 50,000', sortOrder: 1, isActive: true },
      { key: '50k_200k', nameAr: '50,000 – 200,000', nameEn: '50,000 – 200,000', sortOrder: 2, isActive: true },
      { key: '200k_500k', nameAr: '200,000 – 500,000', nameEn: '200,000 – 500,000', sortOrder: 3, isActive: true },
      { key: 'over_500k', nameAr: 'أكثر من 500,000', nameEn: 'Over 500,000', sortOrder: 4, isActive: true },
    ],
    sortOrder: 10,
    isActive: true,
    requirements: [{ operation: 'CREATE', entityScope: null, isRequired: true }],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-lead-start',
    ownerType: 'LEAD',
    fieldKey: 'expected_start_date',
    nameAr: 'تاريخ البدء المتوقع',
    nameEn: 'Expected start date',
    type: 'DATE',
    placeholderAr: null,
    placeholderEn: null,
    options: [],
    sortOrder: 20,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-lead-visits',
    ownerType: 'LEAD',
    fieldKey: 'website_visits',
    nameAr: 'زيارات الموقع',
    nameEn: 'Website visits',
    type: 'NUMBER',
    placeholderAr: 'مثال: 12',
    placeholderEn: 'e.g. 12',
    options: [],
    sortOrder: 30,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-lead-notes',
    ownerType: 'LEAD',
    fieldKey: 'qualification_notes',
    nameAr: 'ملاحظات التأهيل',
    nameEn: 'Qualification notes',
    type: 'TEXTAREA',
    placeholderAr: 'أضف ملخص احتياجات العميل المحتمل',
    placeholderEn: 'Summarize prospect requirements',
    options: [],
    sortOrder: 40,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-lead-contacted',
    ownerType: 'LEAD',
    fieldKey: 'last_contacted_at',
    nameAr: 'آخر تواصل',
    nameEn: 'Last contacted at',
    type: 'DATETIME',
    placeholderAr: null,
    placeholderEn: null,
    options: [],
    sortOrder: 50,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-lead-old-score',
    ownerType: 'LEAD',
    fieldKey: 'old_score',
    nameAr: 'التقييم القديم',
    nameEn: 'Old score',
    type: 'NUMBER',
    placeholderAr: null,
    placeholderEn: null,
    options: [],
    sortOrder: 90,
    isActive: false,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-cust-tax',
    ownerType: 'CUSTOMER_PROFILE',
    fieldKey: 'tax_card_number',
    nameAr: 'رقم البطاقة الضريبية',
    nameEn: 'Tax card number',
    type: 'TEXT',
    placeholderAr: 'أدخل رقم البطاقة الضريبية',
    placeholderEn: 'Enter tax card number',
    options: [],
    sortOrder: 10,
    isActive: true,
    requirements: [
      { operation: 'CONVERT', entityScope: null, isRequired: true },
      { operation: 'UPDATE', entityScope: null, isRequired: true },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-cust-industry',
    ownerType: 'CUSTOMER_PROFILE',
    fieldKey: 'industry_segment',
    nameAr: 'قطاع النشاط',
    nameEn: 'Industry segment',
    type: 'MULTI_SELECT',
    placeholderAr: 'اختر قطاعًا واحدًا أو أكثر',
    placeholderEn: 'Select one or more segments',
    options: [
      { key: 'retail', nameAr: 'التجزئة', nameEn: 'Retail', sortOrder: 1, isActive: true },
      { key: 'manufacturing', nameAr: 'التصنيع', nameEn: 'Manufacturing', sortOrder: 2, isActive: true },
      { key: 'healthcare', nameAr: 'الرعاية الصحية', nameEn: 'Healthcare', sortOrder: 3, isActive: true },
      { key: 'technology', nameAr: 'التقنية', nameEn: 'Technology', sortOrder: 4, isActive: true },
    ],
    sortOrder: 20,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-opp-competitor',
    ownerType: 'OPPORTUNITY',
    fieldKey: 'competitor',
    nameAr: 'المنافس',
    nameEn: 'Competitor',
    type: 'TEXT',
    placeholderAr: 'اسم المنافس الرئيسي',
    placeholderEn: 'Primary competitor name',
    options: [],
    sortOrder: 10,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-opp-contract-url',
    ownerType: 'OPPORTUNITY',
    fieldKey: 'contract_url',
    nameAr: 'رابط العقد',
    nameEn: 'Contract URL',
    type: 'URL',
    placeholderAr: 'https://example.com/contract',
    placeholderEn: 'https://example.com/contract',
    options: [],
    sortOrder: 20,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-opp-sponsor',
    ownerType: 'OPPORTUNITY',
    fieldKey: 'executive_approved',
    nameAr: 'موافقة الإدارة التنفيذية',
    nameEn: 'Executive sponsor approved',
    type: 'BOOLEAN',
    placeholderAr: null,
    placeholderEn: null,
    options: [],
    sortOrder: 30,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-party-linkedin',
    ownerType: 'PARTY',
    fieldKey: 'linkedin_url',
    nameAr: 'حساب لينكدإن',
    nameEn: 'LinkedIn',
    type: 'URL',
    placeholderAr: 'https://linkedin.com/in/...',
    placeholderEn: 'https://linkedin.com/in/...',
    options: [],
    sortOrder: 10,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-party-contact-time',
    ownerType: 'PARTY',
    fieldKey: 'preferred_contact_time',
    nameAr: 'وقت التواصل المفضل',
    nameEn: 'Preferred contact time',
    type: 'SELECT',
    placeholderAr: 'اختر الوقت المفضل',
    placeholderEn: 'Select preferred time',
    options: [
      { key: 'morning', nameAr: 'صباحًا (9 ص – 12 م)', nameEn: 'Morning (9 AM – 12 PM)', sortOrder: 1, isActive: true },
      { key: 'afternoon', nameAr: 'ظهرًا (12 م – 4 م)', nameEn: 'Afternoon (12 PM – 4 PM)', sortOrder: 2, isActive: true },
      { key: 'evening', nameAr: 'مساءً (4 م – 8 م)', nameEn: 'Evening (4 PM – 8 PM)', sortOrder: 3, isActive: true },
    ],
    sortOrder: 20,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-party-direct-phone',
    ownerType: 'PARTY',
    fieldKey: 'direct_phone',
    nameAr: 'الهاتف المباشر',
    nameEn: 'Direct phone',
    type: 'PHONE',
    placeholderAr: '+201001234567',
    placeholderEn: '+201001234567',
    options: [],
    sortOrder: 30,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-party-work-email',
    ownerType: 'PARTY',
    fieldKey: 'secondary_email',
    nameAr: 'البريد الإلكتروني البديل',
    nameEn: 'Secondary email',
    type: 'EMAIL',
    placeholderAr: 'name@company.com',
    placeholderEn: 'name@company.com',
    options: [],
    sortOrder: 40,
    isActive: true,
    requirements: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cf-legacy-national-id',
    ownerType: 'LEAD_AND_PARTY',
    fieldKey: 'national_id',
    nameAr: 'الرقم القومي',
    nameEn: 'National ID',
    type: 'TEXT',
    placeholderAr: 'أدخل الرقم القومي',
    placeholderEn: 'Enter national ID',
    options: [],
    sortOrder: 100,
    isActive: true,
    requirements: [{ operation: 'CREATE', entityScope: 'LEAD', isRequired: true }],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

let storedValues: CustomFieldValueRow[] = [
  {
    id: 'val-1',
    branchId: 'b1',
    fieldDefinitionId: 'cf-lead-budget',
    ownerType: 'LEAD',
    ownerId: 'lead-1',
    value: '50k_200k',
    updatedAt: NOW,
  },
  {
    id: 'val-2',
    branchId: 'b1',
    fieldDefinitionId: 'cf-lead-start',
    ownerType: 'LEAD',
    ownerId: 'lead-1',
    value: '2026-12-01',
    updatedAt: NOW,
  },
  {
    id: 'val-3',
    branchId: 'b1',
    fieldDefinitionId: 'cf-lead-visits',
    ownerType: 'LEAD',
    ownerId: 'lead-1',
    value: 14,
    updatedAt: NOW,
  },
  {
    id: 'val-4',
    branchId: 'b1',
    fieldDefinitionId: 'cf-lead-budget',
    ownerType: 'LEAD',
    ownerId: 'lead-2',
    value: '200k_500k',
    updatedAt: NOW,
  },
  {
    id: 'val-5',
    branchId: 'b1',
    fieldDefinitionId: 'cf-cust-tax',
    ownerType: 'CUSTOMER_PROFILE',
    ownerId: 'cust-1',
    value: '402-881-910',
    updatedAt: NOW,
  },
  {
    id: 'val-6',
    branchId: 'b1',
    fieldDefinitionId: 'cf-cust-industry',
    ownerType: 'CUSTOMER_PROFILE',
    ownerId: 'cust-1',
    value: ['manufacturing', 'technology'],
    updatedAt: NOW,
  },
  {
    id: 'val-7',
    branchId: 'b1',
    fieldDefinitionId: 'cf-opp-sponsor',
    ownerType: 'OPPORTUNITY',
    ownerId: 'opp-1',
    value: true,
    updatedAt: NOW,
  },
];

function cloneField(field: CustomField): CustomField {
  return {
    ...field,
    options: field.options.map((option) => ({ ...option })),
    requirements: field.requirements.map((req) => ({ ...req })),
  };
}

// Backend create/update return the definition row only; requirements come from GET /custom-fields.
function toDefinition(field: CustomField): CustomFieldDefinition {
  const { requirements: _requirements, ...definition } = cloneField(field);
  return definition;
}

// Stable id/createdAt per (field, operation, scope) so repeated upserts return the same requirement row.
const requirementRowMeta = new Map<string, { id: string; createdAt: string }>();

function cloneValueRow(row: CustomFieldValueRow): CustomFieldValueRow {
  return {
    ...row,
    value: Array.isArray(row.value) ? [...row.value] : row.value,
  };
}

function validateAndNormalizeOptions(type: CustomFieldType, options: FieldOption[] | undefined): FieldOption[] {
  if (!isChoicesType(type)) return [];
  if (!options || options.length === 0) {
    throw new ApiError(422, 'CUSTOM_FIELD_OPTIONS_REQUIRED');
  }
  if (options.length > MAX_OPTIONS) {
    throw new ApiError(422, 'CUSTOM_FIELD_OPTIONS_INVALID');
  }

  const seenKeys = new Set<string>();
  const normalized: FieldOption[] = [];

  for (const option of options) {
    const key = option.key.trim();
    const nameAr = option.nameAr.trim();
    const nameEn = option.nameEn.trim();
    if (
      !key ||
      key.length > MAX_KEY_LEN ||
      seenKeys.has(key) ||
      !nameAr ||
      nameAr.length > MAX_NAME_LEN ||
      !nameEn ||
      nameEn.length > MAX_NAME_LEN ||
      !Number.isInteger(option.sortOrder) ||
      option.sortOrder < 1
    ) {
      throw new ApiError(422, 'CUSTOM_FIELD_OPTIONS_INVALID');
    }
    seenKeys.add(key);
    normalized.push({
      key,
      nameAr,
      nameEn,
      sortOrder: option.sortOrder,
      isActive: Boolean(option.isActive),
    });
  }

  return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
}

function usedOptionKeysForField(fieldId: string): string[] {
  const keys = new Set<string>();
  for (const row of storedValues) {
    if (row.fieldDefinitionId !== fieldId || row.value === null) continue;
    if (typeof row.value === 'string' && row.value) {
      keys.add(row.value);
    } else if (Array.isArray(row.value)) {
      for (const item of row.value) {
        if (item) keys.add(item);
      }
    }
  }
  return Array.from(keys);
}

export async function fakeListCustomFields(): Promise<CustomField[]> {
  await fakeDelay();
  return [...definitions]
    .sort((a, b) => a.ownerType.localeCompare(b.ownerType) || a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey))
    .map(cloneField);
}

export async function fakeCreateCustomField(input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
  await fakeDelay();

  if (!input.ownerType || !(CREATABLE_OWNER_TYPES as readonly string[]).includes(input.ownerType)) {
    throw new ApiError(422, 'CUSTOM_FIELD_OWNER_TYPE_REQUIRED');
  }
  if (definitions.length >= MAX_DEFINITIONS) {
    throw new ApiError(422, 'CUSTOM_FIELD_LIMIT_EXCEEDED');
  }

  const fieldKey = normalizeFieldKey(input.fieldKey ?? '');
  if (!FIELD_KEY_REGEX.test(fieldKey)) {
    throw new ApiError(422, 'CUSTOM_FIELD_KEY_INVALID');
  }
  if (definitions.some((def) => def.fieldKey === fieldKey)) {
    throw new ApiError(409, 'CUSTOM_FIELD_KEY_TAKEN');
  }

  const nameAr = (input.nameAr ?? '').trim();
  const nameEn = (input.nameEn ?? '').trim();
  if (!nameAr || nameAr.length > MAX_NAME_LEN || !nameEn || nameEn.length > MAX_NAME_LEN) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const placeholderAr = input.placeholderAr?.trim() || null;
  const placeholderEn = input.placeholderEn?.trim() || null;
  if ((placeholderAr && placeholderAr.length > MAX_PLACEHOLDER_LEN) || (placeholderEn && placeholderEn.length > MAX_PLACEHOLDER_LEN)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const sortOrder = input.sortOrder ?? 100;
  if (!Number.isInteger(sortOrder)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const options = validateAndNormalizeOptions(input.type, input.options);
  const now = new Date().toISOString();
  const created: CustomField = {
    id: fakeId(),
    ownerType: input.ownerType,
    fieldKey,
    nameAr,
    nameEn,
    type: input.type,
    placeholderAr,
    placeholderEn,
    options,
    isSearchable: input.isSearchable ?? false,
    sortOrder,
    isActive: true,
    requirements: [],
    createdAt: now,
    updatedAt: now,
  };

  definitions = [...definitions, created];
  return toDefinition(created);
}

export async function fakeUpdateCustomField(id: string, patch: UpdateCustomFieldPatch): Promise<CustomFieldDefinition> {
  await fakeDelay();
  const index = definitions.findIndex((def) => def.id === id);
  if (index === -1) {
    throw new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND');
  }

  const current = definitions[index];
  let nextKey = current.fieldKey;
  if (patch.fieldKey !== undefined) {
    nextKey = normalizeFieldKey(patch.fieldKey);
    if (!FIELD_KEY_REGEX.test(nextKey)) {
      throw new ApiError(422, 'CUSTOM_FIELD_KEY_INVALID');
    }
    if (definitions.some((def) => def.id !== id && def.fieldKey === nextKey)) {
      throw new ApiError(409, 'CUSTOM_FIELD_KEY_TAKEN');
    }
  }

  const nextNameAr = patch.nameAr !== undefined ? patch.nameAr.trim() : current.nameAr;
  const nextNameEn = patch.nameEn !== undefined ? patch.nameEn.trim() : current.nameEn;
  if (!nextNameAr || nextNameAr.length > MAX_NAME_LEN || !nextNameEn || nextNameEn.length > MAX_NAME_LEN) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const nextPlaceholderAr =
    patch.placeholderAr === undefined ? current.placeholderAr : patch.placeholderAr ? patch.placeholderAr.trim() : null;
  const nextPlaceholderEn =
    patch.placeholderEn === undefined ? current.placeholderEn : patch.placeholderEn ? patch.placeholderEn.trim() : null;
  if (
    (nextPlaceholderAr && nextPlaceholderAr.length > MAX_PLACEHOLDER_LEN) ||
    (nextPlaceholderEn && nextPlaceholderEn.length > MAX_PLACEHOLDER_LEN)
  ) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const nextSortOrder = patch.sortOrder !== undefined ? patch.sortOrder : current.sortOrder;
  if (!Number.isInteger(nextSortOrder)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  let nextOptions = current.options;
  if (patch.options !== undefined && isChoicesType(current.type)) {
    const validated = validateAndNormalizeOptions(current.type, patch.options);
    const activeAfter = new Set(validated.filter((opt) => opt.isActive).map((opt) => opt.key));
    const inUseKeys = usedOptionKeysForField(id);
    const conflictingKeys = inUseKeys.filter((key) => !activeAfter.has(key));
    if (conflictingKeys.length > 0) {
      throw new ApiError(409, 'CUSTOM_FIELD_OPTION_IN_USE', { optionKeys: conflictingKeys });
    }
    nextOptions = validated;
  }

  const updated: CustomField = {
    ...current,
    fieldKey: nextKey,
    nameAr: nextNameAr,
    nameEn: nextNameEn,
    placeholderAr: nextPlaceholderAr,
    placeholderEn: nextPlaceholderEn,
    isSearchable: patch.isSearchable !== undefined ? patch.isSearchable : (current.isSearchable ?? false),
    sortOrder: nextSortOrder,
    isActive: patch.isActive !== undefined ? patch.isActive : current.isActive,
    options: nextOptions,
    updatedAt: new Date().toISOString(),
  };

  definitions = definitions.map((def) => (def.id === id ? updated : def));
  return toDefinition(updated);
}

export async function fakeSetRequirement(id: string, input: SetRequirementInput): Promise<FieldRequirementRow> {
  await fakeDelay();
  const current = definitions.find((def) => def.id === id);
  if (!current) {
    throw new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND');
  }
  if (!current.isActive) {
    throw new ApiError(422, 'CUSTOM_FIELD_INACTIVE');
  }
  if (input.operation === 'CONVERT' && current.ownerType === 'OPPORTUNITY') {
    throw new ApiError(422, 'CUSTOM_FIELD_REQUIREMENT_SCOPE_INVALID');
  }

  const scope = input.entityScope ?? null;
  if (input.isRequired) {
    const currentlyRequired = current.requirements.some(
      (req) => req.operation === input.operation && req.entityScope === scope && req.isRequired,
    );
    const totalRequiredForOp = countRequiredRowsForOperation(input.operation) + (currentlyRequired ? 0 : 1);
    if (totalRequiredForOp > MAX_DEFINITIONS) {
      throw new ApiError(422, 'CUSTOM_FIELD_LIMIT_EXCEEDED');
    }
  }

  const existingIndex = current.requirements.findIndex(
    (req) => req.operation === input.operation && req.entityScope === scope,
  );
  const nextRequirements =
    existingIndex >= 0
      ? current.requirements.map((req, idx) => (idx === existingIndex ? { ...req, isRequired: input.isRequired } : req))
      : [...current.requirements, { operation: input.operation, entityScope: scope, isRequired: input.isRequired }];

  // The backend saves only the requirement row; the definition row is not touched.
  definitions = definitions.map((def) => (def.id === id ? { ...current, requirements: nextRequirements } : def));

  const now = new Date().toISOString();
  const metaKey = `${id}|${input.operation}|${scope ?? ''}`;
  let meta = requirementRowMeta.get(metaKey);
  if (!meta) {
    meta = { id: fakeId(), createdAt: now };
    requirementRowMeta.set(metaKey, meta);
  }
  return {
    id: meta.id,
    fieldDefinitionId: id,
    operation: input.operation,
    entityScope: scope,
    isRequired: input.isRequired,
    createdAt: meta.createdAt,
    updatedAt: now,
  };
}

function countRequiredRowsForOperation(operation: RequirementOperation): number {
  let total = 0;
  for (const field of definitions) {
    for (const req of field.requirements) {
      if (req.operation === operation && req.isRequired) total++;
    }
  }
  return total;
}

export async function fakeListValues(
  branchId: string,
  ownerType: CreatableOwnerType,
  ownerId: string,
): Promise<CustomFieldValueRow[]> {
  await fakeDelay();
  return storedValues
    .filter((row) => row.branchId === branchId && row.ownerType === ownerType && row.ownerId === ownerId)
    .slice(0, MAX_DEFINITIONS)
    .map(cloneValueRow);
}

export async function fakeSaveValue(input: SaveCustomFieldValueInput): Promise<CustomFieldValueRow | null> {
  await fakeDelay();
  const field = definitions.find((def) => def.id === input.fieldDefinitionId);
  if (!field) {
    throw new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND');
  }
  if (!field.isActive) {
    throw new ApiError(422, 'CUSTOM_FIELD_INACTIVE');
  }

  if (isClearedValue(input.value, field.type)) {
    if (isRequiredForOperation(field, 'UPDATE', input.ownerType)) {
      throw new ApiError(422, 'CUSTOM_FIELD_REQUIRED');
    }
    storedValues = storedValues.filter(
      (row) =>
        !(
          row.branchId === input.branchId &&
          row.fieldDefinitionId === input.fieldDefinitionId &&
          row.ownerType === input.ownerType &&
          row.ownerId === input.ownerId
        ),
    );
    return null;
  }

  if (!validateCustomFieldValue(field, input.value)) {
    throw new ApiError(422, 'CUSTOM_FIELD_VALUE_INVALID');
  }

  let normalizedValue = input.value;
  if (field.type === 'NUMBER' && typeof normalizedValue === 'string') {
    normalizedValue = Number(normalizedValue);
  } else if (typeof normalizedValue === 'string' && field.type !== 'TEXTAREA') {
    normalizedValue = normalizedValue.trim();
  }

  const now = new Date().toISOString();
  const existingIndex = storedValues.findIndex(
    (row) =>
      row.branchId === input.branchId &&
      row.fieldDefinitionId === input.fieldDefinitionId &&
      row.ownerType === input.ownerType &&
      row.ownerId === input.ownerId,
  );

  if (existingIndex >= 0) {
    const updated: CustomFieldValueRow = {
      ...storedValues[existingIndex],
      value: Array.isArray(normalizedValue) ? [...normalizedValue] : normalizedValue,
      updatedAt: now,
    };
    storedValues = storedValues.map((row, idx) => (idx === existingIndex ? updated : row));
    return cloneValueRow(updated);
  }

  const created: CustomFieldValueRow = {
    id: fakeId(),
    branchId: input.branchId,
    fieldDefinitionId: input.fieldDefinitionId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    value: Array.isArray(normalizedValue) ? [...normalizedValue] : normalizedValue,
    updatedAt: now,
  };
  storedValues = [...storedValues, created];
  return cloneValueRow(created);
}

export async function fakeListBranches(): Promise<SampleBranch[]> {
  await fakeDelay(120);
  return BRANCHES.map((branch) => ({ ...branch }));
}

export async function fakeListSampleRecords(branchId: string, ownerType: CreatableOwnerType): Promise<SampleRecord[]> {
  await fakeDelay(120);
  return SAMPLE_RECORDS.filter((record) => record.branchId === branchId && record.ownerType === ownerType).map(
    (record) => ({ ...record }),
  );
}
