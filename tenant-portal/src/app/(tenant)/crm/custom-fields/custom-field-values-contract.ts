import { isUUIDv7 } from "@/lib/uuid";
import type { CustomFieldItem } from "./custom-field-contract";

export interface CustomFieldValue {
  fieldDefinitionId: string;
  ownerType: string;
  ownerId: string;
  value: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseCustomFieldValues(payload: unknown, ownerType: string, ownerId: string): CustomFieldValue[] {
  // crm-app custom-field-write.helper.ts: CUSTOM_FIELD_WRITE_MAX_VALUES.
  if (!Array.isArray(payload) || payload.length > 100) throw new Error("Invalid custom-field values");
  const seen = new Set<string>();
  return payload.map((entry) => {
    const row = record(entry);
    if (!row || !isUUIDv7(row.fieldDefinitionId) || row.ownerType !== ownerType || row.ownerId !== ownerId ||
      !("value" in row) || seen.has(row.fieldDefinitionId)) throw new Error("Invalid custom-field values");
    seen.add(row.fieldDefinitionId);
    return { fieldDefinitionId: row.fieldDefinitionId, ownerType, ownerId, value: row.value };
  });
}

export function assertCustomFieldValueWrite(payload: unknown, fieldId: string, ownerType: string, ownerId: string, clearing: boolean) {
  if (clearing && payload === null) return;
  const row = record(payload);
  if (!row || !isUUIDv7(row.id) || row.fieldDefinitionId !== fieldId || row.ownerType !== ownerType ||
    row.ownerId !== ownerId || !("value" in row)) throw new Error("Invalid custom-field value write");
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isBlankFieldValue(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
}

/** Advisory form validation follows custom-field-write.helper.ts; the server remains authoritative. */
export function validateCustomFieldValue(field: CustomFieldItem, value: unknown, ownerType: string): string | null {
  if (isBlankFieldValue(value)) {
    return field.requirements.some((rule) => rule.operation === "UPDATE" && rule.isRequired &&
      (rule.entityScope === null || rule.entityScope === ownerType)) ? "required" : null;
  }
  const fail = field.type;
  switch (field.type) {
    case "TEXT": return typeof value === "string" && value.length <= 500 ? null : fail;
    case "TEXTAREA": return typeof value === "string" && value.length <= 5000 ? null : fail;
    case "NUMBER": return typeof value === "number" && Number.isFinite(value) ? null : fail;
    case "BOOLEAN": return typeof value === "boolean" ? null : fail;
    case "DATE": return typeof value === "string" && validDate(value) ? null : fail;
    case "DATETIME": return typeof value === "string" && value.length <= 35 &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) ? null : fail;
    case "URL": {
      if (typeof value !== "string" || value.length > 2048) return fail;
      try { return ["http:", "https:"].includes(new URL(value).protocol) ? null : fail; } catch { return fail; }
    }
    case "EMAIL": return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : fail;
    case "PHONE": {
      if (typeof value !== "string" || value.length > 64 || !/^\+?[\d\s().-]+$/.test(value)) return fail;
      // Match crm-app common/phone-normalization.ts before counting digits.
      const compact = value.replace(/[\s().-]/g, "").replace(/^00/, "+");
      return /^\+?\d{7,15}$/.test(compact) ? null : fail;
    }
    case "SELECT": return typeof value === "string" && field.options.some((option) => option.isActive && option.key === value) ? null : fail;
    case "MULTI_SELECT": return Array.isArray(value) && value.length <= 100 && new Set(value).size === value.length &&
      value.every((key) => typeof key === "string" && field.options.some((option) => option.isActive && option.key === key)) ? null : fail;
  }
}
