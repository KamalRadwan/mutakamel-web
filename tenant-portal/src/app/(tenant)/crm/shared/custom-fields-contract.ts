// The read half of CRM custom fields, for the detail-screen rail —
// MASTER-PLAN 8.8, docs/design/detail-screens.md#custom-fields.
//
//   GET /api/tenant/crm/v1/custom-fields            crm.custom_fields.read
//   GET /api/tenant/crm/v1/custom-fields/values     crm.custom_fields.read
//       ?branchId&ownerType&ownerId
//
// This deliberately does not reuse `parseCrmCustomField` from the
// `/crm/custom-fields` list screen: that projection reduces `options` to an
// `optionsCount`, and a rail that renders a `SELECT` value needs the option
// **labels** to turn a stored key into a name. Same endpoint, different
// projection — not duplicated logic.
//
// Shapes verified against `CrmCustomFieldDefinitionEntity` and
// `CrmCustomFieldValueEntity` in @mutakamel/crm-app-database, and against
// `CustomFieldsService.listDefinitions` / `listValues`.

import { isUUIDv7 } from "@/lib/uuid";
import { crmRecord } from "./crm-capabilities";

export const CRM_CUSTOM_FIELDS_READ_PATH = "/api/tenant/crm/v1/custom-fields";

/**
 * `CrmCustomFieldOwnerTypeEnum`. `LEAD_AND_PARTY` is a **definition** scope —
 * a field that applies to both a lead and the party behind it — and never a
 * value's owner type: `UpsertCustomFieldValueDto` restricts values to the four
 * concrete owners.
 */
const CRM_CUSTOM_FIELD_VALUE_OWNER_TYPES = [
  "LEAD",
  "PARTY",
  "CUSTOMER_PROFILE",
  "OPPORTUNITY",
] as const;

const CRM_CUSTOM_FIELD_DEFINITION_OWNER_TYPES = [
  ...CRM_CUSTOM_FIELD_VALUE_OWNER_TYPES,
  "LEAD_AND_PARTY",
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

export type CrmCustomFieldValueOwnerType =
  (typeof CRM_CUSTOM_FIELD_VALUE_OWNER_TYPES)[number];
type CrmCustomFieldDefinitionOwnerType =
  (typeof CRM_CUSTOM_FIELD_DEFINITION_OWNER_TYPES)[number];
type CrmCustomFieldType = (typeof CRM_CUSTOM_FIELD_TYPES)[number];

interface CrmCustomFieldOption {
  key: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CrmCustomFieldDefinition {
  id: string;
  ownerType: CrmCustomFieldDefinitionOwnerType;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CrmCustomFieldType;
  options: CrmCustomFieldOption[];
  isActive: boolean;
  sortOrder: number;
}

export interface CrmCustomFieldValue {
  id: string;
  fieldDefinitionId: string;
  ownerType: CrmCustomFieldValueOwnerType;
  ownerId: string;
  /** Left as `unknown`: the column is JSON and its shape follows `type`. */
  value: unknown;
}

const MAX_DEFINITIONS = 500;
const MAX_VALUES = 500;

function invalid(): never {
  throw new Error("Invalid CRM custom-fields response.");
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function parseOption(payload: unknown): CrmCustomFieldOption {
  const option = crmRecord(payload);
  if (
    !option ||
    typeof option.key !== "string" ||
    option.key.length === 0 ||
    typeof option.nameAr !== "string" ||
    typeof option.nameEn !== "string" ||
    !Number.isSafeInteger(option.sortOrder) ||
    typeof option.isActive !== "boolean"
  ) {
    invalid();
  }
  return {
    key: option.key,
    nameAr: option.nameAr,
    nameEn: option.nameEn,
    sortOrder: option.sortOrder as number,
    isActive: option.isActive,
  };
}

export function parseCrmCustomFieldDefinitions(
  payload: unknown,
): CrmCustomFieldDefinition[] {
  if (!Array.isArray(payload) || payload.length > MAX_DEFINITIONS) invalid();
  return payload.map((entry) => {
    const definition = crmRecord(entry);
    if (
      !definition ||
      !isUUIDv7(definition.id) ||
      !isMember(CRM_CUSTOM_FIELD_DEFINITION_OWNER_TYPES, definition.ownerType) ||
      typeof definition.fieldKey !== "string" ||
      definition.fieldKey.length === 0 ||
      typeof definition.nameAr !== "string" ||
      typeof definition.nameEn !== "string" ||
      !isMember(CRM_CUSTOM_FIELD_TYPES, definition.type) ||
      !Array.isArray(definition.options) ||
      typeof definition.isActive !== "boolean" ||
      !Number.isSafeInteger(definition.sortOrder)
    ) {
      invalid();
    }
    return {
      id: definition.id,
      ownerType: definition.ownerType,
      fieldKey: definition.fieldKey,
      nameAr: definition.nameAr,
      nameEn: definition.nameEn,
      type: definition.type,
      options: definition.options.map(parseOption),
      isActive: definition.isActive,
      sortOrder: definition.sortOrder as number,
    };
  });
}

export function parseCrmCustomFieldValues(
  payload: unknown,
  expected: { ownerType: CrmCustomFieldValueOwnerType; ownerId: string },
): CrmCustomFieldValue[] {
  if (!Array.isArray(payload) || payload.length > MAX_VALUES) invalid();
  return payload.map((entry) => {
    const row = crmRecord(entry);
    if (
      !row ||
      !isUUIDv7(row.id) ||
      !isUUIDv7(row.fieldDefinitionId) ||
      row.ownerType !== expected.ownerType ||
      row.ownerId !== expected.ownerId
    ) {
      invalid();
    }
    return {
      id: row.id,
      fieldDefinitionId: row.fieldDefinitionId,
      ownerType: expected.ownerType,
      ownerId: expected.ownerId,
      value: row.value,
    };
  });
}

export function buildCrmCustomFieldValuesPath(query: {
  branchId: string;
  ownerType: CrmCustomFieldValueOwnerType;
  ownerId: string;
}): string {
  const search = new URLSearchParams({
    branchId: query.branchId,
    ownerType: query.ownerType,
    ownerId: query.ownerId,
  });
  return `${CRM_CUSTOM_FIELDS_READ_PATH}/values?${search.toString()}`;
}

/**
 * The definitions that apply to one owner type.
 *
 * A `LEAD` record also carries every `LEAD_AND_PARTY` field — that scope exists
 * precisely so one definition covers a lead and the party it becomes — while a
 * `CUSTOMER_PROFILE` or `OPPORTUNITY` takes only its own.
 */
export function definitionsForOwnerType(
  definitions: readonly CrmCustomFieldDefinition[],
  ownerType: CrmCustomFieldValueOwnerType,
): CrmCustomFieldDefinition[] {
  const scopes: readonly string[] =
    ownerType === "LEAD" ? ["LEAD", "LEAD_AND_PARTY"] : [ownerType];
  return definitions
    .filter(
      (definition) =>
        definition.isActive && scopes.includes(definition.ownerType),
    )
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
