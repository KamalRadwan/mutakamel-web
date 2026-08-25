import { isUUIDv7 } from "@/lib/uuid";

export const LEAD_STAGE_FLAGS = [
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONVERTED",
  "NURTURING",
  "ON_HOLD",
] as const;

export const CREATABLE_LEAD_STAGE_FLAGS = LEAD_STAGE_FLAGS.filter(
  (flag) => flag !== "NEW",
);

// CRM rejects OPEN for lead stages; it is reserved for opportunity stages.
export const LEAD_STAGE_CATEGORIES = [
  "IN_PROGRESS",
  "POSITIVE",
  "NEGATIVE",
] as const;

export type LeadStageFlag = (typeof LEAD_STAGE_FLAGS)[number];
export type LeadStageCategory = (typeof LEAD_STAGE_CATEGORIES)[number];

export interface LeadStageItem {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
  category: LeadStageCategory;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface CreateLeadStageFormData {
  nameAr: string;
  nameEn: string;
  flag: Exclude<LeadStageFlag, "NEW">;
  category: LeadStageCategory;
  isDefault: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error("Invalid lead stages response.");
  }
  return candidate;
}

function requiredUuidV7(
  value: Record<string, unknown>,
  key: string,
): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) {
    throw new Error("Invalid lead stages response.");
  }
  return candidate;
}

function member<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function parseLeadStage(value: unknown): LeadStageItem {
  const stage = record(value);
  if (
    !stage ||
    !member(LEAD_STAGE_FLAGS, stage.flag) ||
    !member(LEAD_STAGE_CATEGORIES, stage.category) ||
    !Number.isInteger(stage.sortOrder) ||
    (stage.sortOrder as number) < 1 ||
    typeof stage.isDefault !== "boolean" ||
    typeof stage.isActive !== "boolean"
  ) {
    throw new Error("Invalid lead stages response.");
  }

  return {
    id: requiredUuidV7(stage, "id"),
    nameAr: requiredString(stage, "nameAr"),
    nameEn: requiredString(stage, "nameEn"),
    flag: stage.flag,
    category: stage.category,
    sortOrder: stage.sortOrder as number,
    isDefault: stage.isDefault,
    isActive: stage.isActive,
  };
}

export function parseLeadStageResponse(payload: unknown): LeadStageItem {
  return parseLeadStage(payload);
}

export function parseLeadStageCatalogueResponse(
  payload: unknown,
): LeadStageItem[] {
  if (!Array.isArray(payload) || payload.length > 500) {
    throw new Error("Invalid lead stages response.");
  }

  const stages = payload.map(parseLeadStage);
  if (
    new Set(stages.map(({ id }) => id)).size !== stages.length ||
    new Set(stages.map(({ sortOrder }) => sortOrder)).size !== stages.length ||
    stages.filter(({ isDefault }) => isDefault).length > 1
  ) {
    throw new Error("Invalid lead stages response.");
  }

  return stages.sort((left, right) => left.sortOrder - right.sortOrder);
}

export function buildCreateLeadStageRequest(form: CreateLeadStageFormData) {
  const nameAr = form.nameAr.trim();
  const nameEn = form.nameEn.trim();
  if (
    !nameAr ||
    !nameEn ||
    nameAr.length > 80 ||
    nameEn.length > 80 ||
    !member(CREATABLE_LEAD_STAGE_FLAGS, form.flag) ||
    !member(LEAD_STAGE_CATEGORIES, form.category) ||
    (form.flag === "CONVERTED" && form.isDefault)
  ) {
    throw new Error("Invalid lead stage form.");
  }

  return {
    nameAr,
    nameEn,
    flag: form.flag,
    category: form.category,
    isDefault: form.isDefault,
  };
}
