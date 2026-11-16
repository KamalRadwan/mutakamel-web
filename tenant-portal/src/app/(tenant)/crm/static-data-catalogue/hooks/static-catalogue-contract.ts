import type { Language } from "@/i18n/I18nContext";

interface StaticDataOption {
  value: string;
  label: Record<Language, string>;
}

export interface CrmStaticData {
  enumOptions: Record<string, StaticDataOption[]>;
  permissionOptions: StaticDataOption[];
  ownerTypeOptions: StaticDataOption[];
  eventOptions: StaticDataOption[];
  attachmentPolicy: {
    maxSizeBytes: number;
    familyLabels: StaticDataOption[];
    rejectedFamilyLabels: StaticDataOption[];
  };
  derivedRules: {
    opportunityStatusByStageFlag: Record<string, string>;
    leadConversionCopiesCustomFieldOwnerType: string;
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>) : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM static-data response.");
}

function options(value: unknown): StaticDataOption[] {
  if (!Array.isArray(value)) invalidResponse();
  const seen = new Set<string>();
  return value.map((item) => {
    const source = record(item);
    const label = source && record(source.label);
    if (!source || typeof source.value !== "string" || !source.value.trim() ||
      seen.has(source.value) || !label || typeof label.en !== "string" ||
      !label.en.trim() || typeof label.ar !== "string" || !label.ar.trim()) invalidResponse();
    seen.add(source.value);
    return { value: source.value, label: { en: label.en, ar: label.ar } };
  });
}

function optionGroups(value: unknown): Record<string, StaticDataOption[]> {
  const source = record(value);
  if (!source) invalidResponse();
  return Object.fromEntries(Object.entries(source).map(([key, items]) => [key, options(items)]));
}

function stringMap(value: unknown): Record<string, string> {
  const source = record(value);
  if (!source || Object.values(source).some((item) => typeof item !== "string" || !item.trim())) invalidResponse();
  return source as Record<string, string>;
}

export function parseCrmStaticDataResponse(payload: unknown): CrmStaticData {
  const source = record(payload);
  const attachment = source && record(source.attachmentPolicy);
  const rules = source && record(source.derivedRules);
  if (!source || !attachment || !Number.isSafeInteger(attachment.maxSizeBytes) ||
    (attachment.maxSizeBytes as number) <= 0 || !rules ||
    typeof rules.leadConversionCopiesCustomFieldOwnerType !== "string" ||
    !rules.leadConversionCopiesCustomFieldOwnerType.trim()) invalidResponse();
  return {
    enumOptions: optionGroups(source.enumOptions),
    permissionOptions: options(source.permissionOptions),
    ownerTypeOptions: options(source.ownerTypeOptions),
    eventOptions: options(source.eventOptions),
    attachmentPolicy: {
      maxSizeBytes: attachment.maxSizeBytes as number,
      familyLabels: options(attachment.familyLabels),
      rejectedFamilyLabels: options(attachment.rejectedFamilyLabels),
    },
    derivedRules: {
      opportunityStatusByStageFlag: stringMap(rules.opportunityStatusByStageFlag),
      leadConversionCopiesCustomFieldOwnerType: rules.leadConversionCopiesCustomFieldOwnerType,
    },
  };
}
