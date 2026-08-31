// Wire contract for CRM custom fields.
//
// Transcribed from crm-app/src/crm/custom-fields/custom-fields.controller.ts,
// dto/custom-field.dto.ts and custom-fields.service.ts. Split out of
// `hooks/useCrmCustomFields.ts` here rather than as its own task: it is the
// "~310 lines, marginal, split when next edited" entry in
// docs/architecture/file-architecture.md#the-300-line-rule-and-its-three-exemptions,
// and Phase 8 is the phase that next edited it.
//
// `listDefinitions` attaches each definition's `requirements` rows inline —
// there is no GET route for requirements on their own, so the definition list
// IS their read side.
import { isUUIDv7 } from "@/lib/uuid";

export const CRM_CUSTOM_FIELDS_PATH = "/api/tenant/crm/v1/custom-fields";

export const CRM_CUSTOM_FIELD_OWNER_TYPES = [
  "LEAD",
  "PARTY",
  "CUSTOMER_PROFILE",
  "OPPORTUNITY",
] as const;

const CRM_CUSTOM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
] as const;

export const CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "URL",
  "EMAIL",
  "PHONE",
] as const;

const CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES = [
  ...CRM_CUSTOM_FIELD_OWNER_TYPES,
  "LEAD_AND_PARTY",
] as const;
const CRM_CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

type CrmCustomFieldOwnerType =
  (typeof CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES)[number];
export type CrmCustomFieldCreateOwnerType =
  (typeof CRM_CUSTOM_FIELD_OWNER_TYPES)[number];
type CrmCustomFieldType = (typeof CRM_CUSTOM_FIELD_TYPES)[number];
export type CrmCustomFieldSimpleCreateType =
  (typeof CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES)[number];

// CrmFieldRequirementOperationEnum, from the installed
// @mutakamel/crm-app-common declaration.
export const CRM_FIELD_REQUIREMENT_OPERATIONS = [
  "CREATE",
  "UPDATE",
  "CONVERT",
] as const;
export type CrmFieldRequirementOperation =
  (typeof CRM_FIELD_REQUIREMENT_OPERATIONS)[number];

/**
 * One `CrmFieldRequirementEntity` row.
 *
 * There is no GET route for requirements: `listDefinitions` attaches them to
 * each definition, so the list IS the read side.
 */
interface CustomFieldRequirement {
  operation: CrmFieldRequirementOperation;
  entityScope: CrmCustomFieldOwnerType | null;
  isRequired: boolean;
}

/** One entry of a SELECT / MULTI_SELECT definition's `options` array. */
interface CustomFieldOption {
  key: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomFieldItem {
  id: string;
  ownerType: CrmCustomFieldOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CrmCustomFieldType;
  optionsCount: number;
  /** Needed to render a SELECT / MULTI_SELECT value; empty for every other type. */
  options: CustomFieldOption[];
  isSearchable: boolean;
  isActive: boolean;
  sortOrder: number;
  requirements: CustomFieldRequirement[];
}



export interface CreateCustomFieldInput {
  ownerType: CrmCustomFieldCreateOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CrmCustomFieldSimpleCreateType;
  isSearchable: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM custom-fields response.");
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function parseCrmCustomField(payload: unknown): CustomFieldItem {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isMember(CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES, source.ownerType) ||
    typeof source.fieldKey !== "string" ||
    !isValidCrmCustomFieldKey(source.fieldKey) ||
    typeof source.nameAr !== "string" ||
    source.nameAr.length === 0 ||
    source.nameAr.length > 120 ||
    typeof source.nameEn !== "string" ||
    source.nameEn.length === 0 ||
    source.nameEn.length > 120 ||
    !isMember(CRM_CUSTOM_FIELD_TYPES, source.type) ||
    !Array.isArray(source.options) ||
    source.options.length > 100 ||
    typeof source.isSearchable !== "boolean" ||
    typeof source.isActive !== "boolean" ||
    !Number.isSafeInteger(source.sortOrder) ||
    (source.sortOrder as number) < 1
  ) {
    invalidResponse();
  }

  if (
    ((source.type === "SELECT" || source.type === "MULTI_SELECT") &&
      source.options.length === 0)
  ) {
    invalidResponse();
  }

  return {
    id: source.id,
    ownerType: source.ownerType,
    fieldKey: source.fieldKey,
    nameAr: source.nameAr,
    nameEn: source.nameEn,
    type: source.type,
    optionsCount: source.options.length,
    options: source.options.map(parseOption),
    isSearchable: source.isSearchable,
    isActive: source.isActive,
    sortOrder: source.sortOrder as number,
    requirements: parseRequirements(source.requirements),
  };
}

function parseOption(payload: unknown): CustomFieldOption {
  const option = record(payload);
  if (
    !option ||
    typeof option.key !== "string" ||
    option.key.length === 0 ||
    typeof option.nameAr !== "string" ||
    typeof option.nameEn !== "string" ||
    !Number.isSafeInteger(option.sortOrder) ||
    typeof option.isActive !== "boolean"
  ) {
    invalidResponse();
  }
  return {
    key: option.key,
    nameAr: option.nameAr,
    nameEn: option.nameEn,
    sortOrder: option.sortOrder as number,
    isActive: option.isActive,
  };
}

function parseRequirements(payload: unknown): CustomFieldRequirement[] {
  // Absent is legitimate: only listDefinitions attaches them, and a single
  // definition returned by POST or PATCH carries none.
  if (payload === undefined || payload === null) return [];
  if (!Array.isArray(payload) || payload.length > 100) invalidResponse();
  return payload.map((entry) => {
    const requirement = record(entry);
    if (
      !requirement ||
      !isMember(CRM_FIELD_REQUIREMENT_OPERATIONS, requirement.operation) ||
      typeof requirement.isRequired !== "boolean" ||
      !(
        requirement.entityScope === null ||
        requirement.entityScope === undefined ||
        isMember(CRM_CUSTOM_FIELD_RESPONSE_OWNER_TYPES, requirement.entityScope)
      )
    ) {
      invalidResponse();
    }
    return {
      operation: requirement.operation,
      entityScope:
        (requirement.entityScope as CrmCustomFieldOwnerType | null | undefined) ??
        null,
      isRequired: requirement.isRequired,
    };
  });
}

export function parseCrmCustomFieldsResponse(
  payload: unknown,
): CustomFieldItem[] {
  if (!Array.isArray(payload) || payload.length > 100) invalidResponse();
  const definitions = payload.map(parseCrmCustomField);
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const definition of definitions) {
    const identity = `${definition.ownerType}\u0000${definition.fieldKey}`;
    if (ids.has(definition.id) || identities.has(identity)) invalidResponse();
    ids.add(definition.id);
    identities.add(identity);
  }
  return definitions;
}

export function normalizeCrmCustomFieldKey(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLowerCase();
}

export function isValidCrmCustomFieldKey(value: string): boolean {
  return CRM_CUSTOM_FIELD_KEY_PATTERN.test(value);
}
