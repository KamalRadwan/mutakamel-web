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

export const PROTECTED_LEAD_STAGE_FLAGS = [
  "NEW",
  "DISQUALIFIED",
  "CONVERTED",
] as const satisfies readonly (typeof LEAD_STAGE_FLAGS)[number][];

export const CREATABLE_LEAD_STAGE_FLAGS = LEAD_STAGE_FLAGS.filter(
  (flag) => !PROTECTED_LEAD_STAGE_FLAGS.includes(
    flag as (typeof PROTECTED_LEAD_STAGE_FLAGS)[number],
  ),
) as Exclude<
  (typeof LEAD_STAGE_FLAGS)[number],
  (typeof PROTECTED_LEAD_STAGE_FLAGS)[number]
>[];

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
  flag: Exclude<
    LeadStageFlag,
    (typeof PROTECTED_LEAD_STAGE_FLAGS)[number]
  >;
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
 * The three lifecycle anchors are server-owned. They cannot be edited or
 * deleted, and a tenant stage cannot be changed into one of their flags.
 * Verified in
 * crm-app/src/crm/lead-stages/lead-stages.service.ts.
 */
export function isProtectedLeadStage(stage: LeadStageItem): boolean {
  return PROTECTED_LEAD_STAGE_FLAGS.includes(
    stage.flag as (typeof PROTECTED_LEAD_STAGE_FLAGS)[number],
  );
}

export function canBeDefaultLeadStage(stage: LeadStageItem): boolean {
  return (
    stage.isActive &&
    stage.flag !== "DISQUALIFIED" &&
    stage.flag !== "CONVERTED"
  );
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
    // Reserved lifecycle flags belong only to the canonical stages.
    (PROTECTED_LEAD_STAGE_FLAGS.includes(
      form.flag as (typeof PROTECTED_LEAD_STAGE_FLAGS)[number],
    ) &&
      form.flag !== stage.flag) ||
    // A protected stage is entirely read-only. Its default designation, when
    // eligible, moves through the dedicated set-default endpoint.
    (isProtectedLeadStage(stage) &&
      (nameAr !== stage.nameAr ||
        nameEn !== stage.nameEn ||
        form.flag !== stage.flag ||
        form.category !== stage.category ||
        form.isActive !== stage.isActive)) ||
    // A default stage may not be deactivated.
    (stage.isDefault && !form.isActive) ||
    (stage.isDefault &&
      (form.flag === "DISQUALIFIED" || form.flag === "CONVERTED"))
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
    !member(LEAD_STAGE_CATEGORIES, form.category)
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
 * from a searched subset — `NEW` stays first while `DISQUALIFIED` and
 * `CONVERTED` stay penultimate and last.
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

  const entryStages = stages.filter(({ flag }) => flag === "NEW");
  const disqualifiedStages = stages.filter(
    ({ flag }) => flag === "DISQUALIFIED",
  );
  const convertedStages = stages.filter(({ flag }) => flag === "CONVERTED");
  if (
    entryStages.length !== 1 ||
    disqualifiedStages.length !== 1 ||
    convertedStages.length !== 1 ||
    orderedIds[0] !== entryStages[0]!.id ||
    orderedIds.at(-2) !== disqualifiedStages[0]!.id ||
    orderedIds.at(-1) !== convertedStages[0]!.id
  ) {
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

/** IDs whose rank is fixed by the server-owned lifecycle order. */
export function protectedLeadStageIds(
  stages: readonly LeadStageItem[],
): ReadonlySet<string> {
  return new Set(
    stages.filter(isProtectedLeadStage).map(({ id }) => id),
  );
}
