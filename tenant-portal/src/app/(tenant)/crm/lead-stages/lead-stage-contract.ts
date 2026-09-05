import { isUUIDv7 } from "@/lib/uuid";

const LEAD_STAGE_FLAGS = [
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

/**
 * `PATCH /lead-stages/:id` — `UpdateLeadStageDto`.
 *
 * `isDefault` is absent because the DTO has no such field: the default moves
 * through `POST /lead-stages/:id/default`, and the service explicitly writes
 * `isDefault: stage.isDefault` back over the patch.
 */
export interface UpdateLeadStageFormData {
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
  category: LeadStageCategory;
  isActive: boolean;
}

export function toUpdateLeadStageForm(
  stage: LeadStageItem,
): UpdateLeadStageFormData {
  return {
    nameAr: stage.nameAr,
    nameEn: stage.nameEn,
    flag: stage.flag,
    category: stage.category,
    isActive: stage.isActive,
  };
}

/**
 * The stage flagged `NEW` is protected: `assertNewStageMutation` answers 422
 * `LEAD_STAGE_PROTECTED` for a rename, a flag change or a deactivation, and no
 * other stage may be changed *into* `NEW`. Verified in
 * crm-app/src/crm/lead-stages/lead-stages.service.ts.
 */
export function isProtectedLeadStage(stage: LeadStageItem): boolean {
  return stage.flag === "NEW";
}

/** Only fields that actually changed are sent — an unchanged key is noise. */
export function buildUpdateLeadStageRequest(
  form: UpdateLeadStageFormData,
  stage: LeadStageItem,
): Record<string, unknown> {
  const nameAr = form.nameAr.trim();
  const nameEn = form.nameEn.trim();
  if (
    !nameAr ||
    !nameEn ||
    nameAr.length > 80 ||
    nameEn.length > 80 ||
    !member(LEAD_STAGE_FLAGS, form.flag) ||
    !member(LEAD_STAGE_CATEGORIES, form.category) ||
    // The service refuses both directions of the NEW protection before it
    // looks at anything else.
    (form.flag === "NEW" && stage.flag !== "NEW") ||
    (stage.flag === "NEW" &&
      (nameAr !== stage.nameAr ||
        nameEn !== stage.nameEn ||
        form.flag !== "NEW" ||
        !form.isActive)) ||
    // A default stage may neither be deactivated nor become CONVERTED.
    (stage.isDefault && !form.isActive) ||
    (stage.isDefault && form.flag === "CONVERTED")
  ) {
    throw new Error("Invalid lead stage form.");
  }

  const body: Record<string, unknown> = {};
  if (nameAr !== stage.nameAr) body.nameAr = nameAr;
  if (nameEn !== stage.nameEn) body.nameEn = nameEn;
  if (form.flag !== stage.flag) body.flag = form.flag;
  if (form.category !== stage.category) body.category = form.category;
  if (form.isActive !== stage.isActive) body.isActive = form.isActive;
  return body;
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

/**
 * The complete ordered id list `PATCH /lead-stages/reorder` replaces the dense
 * one-based order with.
 *
 * Two refusals mirror `assertExactOrder` in
 * crm-app/src/crm/lead-stages/lead-stages.service.ts, which answers 422
 * `LEAD_STAGE_REORDER_INVALID`: the payload must carry **every non-deleted
 * stage exactly once** — so it is built from the unfiltered catalogue, never
 * from a searched subset — and the `NEW` stage must stay first at rank 1.
 * Checking both here means an order the server would reject never costs a round
 * trip, and never leaves the table showing an order that was never written.
 */
export function buildLeadStageReorderRequest(
  stages: readonly LeadStageItem[],
  orderedIds: readonly string[],
): { orderedIds: string[] } {
  const known = new Set(stages.map(({ id }) => id));
  const requested = new Set(orderedIds);
  if (
    stages.length === 0 ||
    orderedIds.length !== stages.length ||
    requested.size !== orderedIds.length ||
    orderedIds.some((id) => !known.has(id))
  ) {
    throw new Error("Invalid lead stage order.");
  }

  const entryStage = stages.filter(({ flag }) => flag === "NEW");
  if (entryStage.length !== 1 || orderedIds[0] !== entryStage[0]!.id) {
    throw new Error("Invalid lead stage order.");
  }
  return { orderedIds: [...orderedIds] };
}

/** The stage the entry-stage rule pins to rank 1, when the catalogue has one. */
export function entryLeadStageId(
  stages: readonly LeadStageItem[],
): string | null {
  const entryStages = stages.filter(({ flag }) => flag === "NEW");
  return entryStages.length === 1 ? entryStages[0]!.id : null;
}
