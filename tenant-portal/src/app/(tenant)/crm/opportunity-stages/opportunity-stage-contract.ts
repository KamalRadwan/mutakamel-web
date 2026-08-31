// Write contract for the reusable opportunity-stage catalogue.
//
// Transcribed from crm-app/src/crm/pipelines/opportunity-stages.controller.ts,
// opportunity-stages.service.ts and dto/pipeline.dto.ts
// (CreateOpportunityStageDto / UpdateOpportunityStageDto).
//
// The route path, the read model and the flag/category unions come from the
// pipelines module: the backend declares these stages' DTOs inside
// `pipelines/dto/pipeline.dto.ts`, so the two screens read the SAME resource.
// That is the one cross-screen import
// docs/architecture/file-architecture.md#dependency-direction permits — narrow,
// named types and constants, never a hook or a component, and one-directional
// so the two contracts cannot form a cycle.
import {
  OPPORTUNITY_STAGES_PATH,
  STAGE_CATEGORIES,
  type OpportunityStageDefinition,
  type OpportunityStageFlag,
  type StageCategory,
} from "../pipelines/pipeline-contract";

// @MaxLength(80) on nameAr and nameEn.
export const OPPORTUNITY_STAGE_NAME_MAX_LENGTH = 80;

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface OpportunityStageFormInput {
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
}

export function opportunityStagePath(id: string): string {
  if (typeof id !== "string" || !UUID_V7_PATTERN.test(id)) {
    throw new Error("Invalid CRM opportunity-stage id.");
  }
  return `${OPPORTUNITY_STAGES_PATH}/${encodeURIComponent(id)}`;
}

/**
 * The categories a flag is allowed to carry.
 *
 * `OpportunityStagesService.assertCategory` rejects any other pairing with a
 * 422 `OPPORTUNITY_STAGE_CATEGORY_INVALID`: NEW must be OPEN, WON must be
 * POSITIVE, LOST must be NEGATIVE, and OPEN cannot be used by another flag.
 * Enforcing it in the form turns a round-trip rejection into an inline hint.
 */
export function allowedCategoriesForFlag(
  flag: OpportunityStageFlag,
): readonly StageCategory[] {
  if (flag === "NEW") return ["OPEN"];
  if (flag === "WON") return ["POSITIVE"];
  if (flag === "LOST") return ["NEGATIVE"];
  return STAGE_CATEGORIES.filter((category) => category !== "OPEN");
}

export function defaultCategoryForFlag(
  flag: OpportunityStageFlag,
): StageCategory {
  return allowedCategoriesForFlag(flag)[0];
}

export function isCategoryAllowedForFlag(
  flag: OpportunityStageFlag,
  category: StageCategory,
): boolean {
  return allowedCategoriesForFlag(flag).includes(category);
}

/** `POST /opportunity-stages` body. `isActive` is server-set to true. */
export function buildCreateOpportunityStageRequest(
  input: OpportunityStageFormInput,
): Record<string, unknown> {
  assertPairing(input.flag, input.category);
  return {
    nameAr: requiredName(input.nameAr),
    nameEn: requiredName(input.nameEn),
    flag: input.flag,
    category: input.category,
  };
}

/**
 * `PATCH /opportunity-stages/:id` body.
 *
 * A system stage refuses a flag change or a deactivation with a 422
 * `OPPORTUNITY_STAGE_SYSTEM_PROTECTED`, and any stage assigned to a pipeline
 * refuses both with a 409 `OPPORTUNITY_STAGE_IN_USE` — so those two fields are
 * dropped from the body when the stage cannot accept them, leaving the rename
 * that is always legal.
 */
export function buildUpdateOpportunityStageRequest(
  input: OpportunityStageFormInput,
  stage: OpportunityStageDefinition,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    nameAr: requiredName(input.nameAr),
    nameEn: requiredName(input.nameEn),
  };
  if (input.flag !== stage.flag) {
    assertPairing(input.flag, input.category);
    body.flag = input.flag;
  }
  if (input.category !== stage.category) {
    assertPairing(input.flag, input.category);
    body.category = input.category;
  }
  if (input.isActive !== stage.isActive) body.isActive = input.isActive;
  return body;
}

export function toOpportunityStageForm(
  stage: OpportunityStageDefinition,
): OpportunityStageFormInput {
  return {
    nameAr: stage.nameAr,
    nameEn: stage.nameEn,
    flag: stage.flag,
    category: stage.category,
    isActive: stage.isActive,
  };
}

function assertPairing(
  flag: OpportunityStageFlag,
  category: StageCategory,
): void {
  if (!isCategoryAllowedForFlag(flag, category)) {
    throw new Error("OPPORTUNITY_STAGE_CATEGORY_INVALID");
  }
}

function requiredName(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > OPPORTUNITY_STAGE_NAME_MAX_LENGTH
  ) {
    throw new Error("OPPORTUNITY_STAGE_NAME_INVALID");
  }
  return trimmed;
}
