// Wire contract for the pipeline configuration screens.
//
// Every field, limit and enum below is transcribed from
// crm-app/src/crm/pipelines/dto/pipeline.dto.ts, pipeline.types.ts and
// pipelines.controller.ts. There is no docs/api/*.md semantic page for the
// write side of this family, so the controller and DTO are the contract.

export const PIPELINES_PATH = "/api/tenant/crm/v1/pipelines";
export const PIPELINES_CONFIGURATION_PATH =
  "/api/tenant/crm/v1/pipelines/configuration";
export const PIPELINE_ASSIGNMENT_OPTIONS_PATH =
  "/api/tenant/crm/v1/pipelines/assignment-options";
// The reusable stage catalogue lives at its own route, but its DTOs are
// declared in pipelines/dto/pipeline.dto.ts and a pipeline cannot be composed
// without reading it — so its vocabulary is owned here and the
// /crm/opportunity-stages screen imports it, never the reverse.
export const OPPORTUNITY_STAGES_PATH = "/api/tenant/crm/v1/opportunity-stages";

// CreatePipelineDto: @MaxLength(48) + @Matches(/^[A-Z][A-Z0-9_-]*$/) on `code`,
// @MaxLength(80) on both names, @MaxLength(2000) on description.
export const PIPELINE_CODE_MAX_LENGTH = 48;
export const PIPELINE_NAME_MAX_LENGTH = 80;
export const PIPELINE_DESCRIPTION_MAX_LENGTH = 2000;
export const PIPELINE_CODE_PATTERN = /^[A-Z][A-Z0-9_-]*$/u;
// ArrayMaxSize(100) on stageIds, orderedIds, userIds and teamIds.
export const PIPELINE_COLLECTION_MAX_SIZE = 100;

export const MAX_PIPELINES_IN_RESPONSE = 200;
export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

// OpportunityStageFlagEnum / StageCategoryEnum / PipelineAccessModeEnum, from
// the installed @mutakamel/crm-app-common declaration.
export const OPPORTUNITY_STAGE_FLAGS = [
  "NEW",
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
  "ON_HOLD",
  "WON",
  "LOST",
] as const;
export type OpportunityStageFlag = (typeof OPPORTUNITY_STAGE_FLAGS)[number];

export const STAGE_CATEGORIES = [
  "OPEN",
  "POSITIVE",
  "NEGATIVE",
  "IN_PROGRESS",
] as const;
export type StageCategory = (typeof STAGE_CATEGORIES)[number];

export const PIPELINE_ACCESS_MODES = ["ALL", "RESTRICTED"] as const;
export type PipelineAccessMode = (typeof PIPELINE_ACCESS_MODES)[number];

export interface PipelineStage {
  id: string;
  pipelineId: string;
  opportunityStageId: string;
  rank: number;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
  isSystem: boolean;
}

export interface PipelineAssignments {
  accessMode: PipelineAccessMode;
  userIds: string[];
  teamIds: string[];
}

export interface Pipeline {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  accessMode: PipelineAccessMode;
  stages: PipelineStage[];
  /** Included on configuration reads and pipeline mutation responses. */
  assignments: PipelineAssignments | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineInput {
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  isDefault: boolean;
  /**
   * Catalogue stage ids, in the order they will rank.
   *
   * Empty means "seed the canonical six" — the request omits the key entirely,
   * because `@ArrayNotEmpty()` makes `[]` a 400 rather than a shorthand for the
   * default.
   */
  stageIds: string[];
}

/** `@ArrayMaxSize(100)` on `stageIds`. */
export const PIPELINE_STAGE_IDS_MAX = 100;

/**
 * `assertValidStageDefinitions`, mirrored.
 *
 * The server requires **exactly one** stage of each of these flags, and the
 * `NEW` one must rank first — two separate throws, `PIPELINE_STAGES_REQUIRED`
 * and `PIPELINE_STAGE_REORDER_INVALID`. Both are cheap to check here and
 * expensive to discover from a rejected create.
 */
const PIPELINE_REQUIRED_STAGE_FLAGS = ["NEW", "WON", "LOST"] as const;

export type PipelineStageSelectionProblem =
  | "MISSING_NEW"
  | "MISSING_WON"
  | "MISSING_LOST"
  | "DUPLICATE_NEW"
  | "DUPLICATE_WON"
  | "DUPLICATE_LOST"
  | "NEW_NOT_FIRST"
  | "TOO_MANY";

/**
 * Why the chosen stage order would be refused, or `null` when it would be
 * accepted. An empty selection is accepted: it means the canonical six.
 */
export function validatePipelineStageSelection(
  selected: ReadonlyArray<{ flag: OpportunityStageFlag }>,
): PipelineStageSelectionProblem | null {
  if (selected.length === 0) return null;
  if (selected.length > PIPELINE_STAGE_IDS_MAX) return "TOO_MANY";
  for (const flag of PIPELINE_REQUIRED_STAGE_FLAGS) {
    const count = selected.filter((stage) => stage.flag === flag).length;
    if (count === 0) return `MISSING_${flag}` as PipelineStageSelectionProblem;
    if (count > 1) return `DUPLICATE_${flag}` as PipelineStageSelectionProblem;
  }
  if (selected[0].flag !== "NEW") return "NEW_NOT_FIRST";
  return null;
}

/** One entry of the reusable catalogue — `CrmOpportunityStageEntity`. */
export interface OpportunityStageDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePipelineInput {
  nameAr: string;
  nameEn: string;
  description: string;
  isActive: boolean;
}

export interface PipelineAssignmentOption {
  id: string;
  label: string;
  /** Users are ACTIVE or INVITED; teams are always ACTIVE. */
  status: string;
  /** Teams only. */
  code: string | null;
}

export interface PipelineAssignmentOptions {
  users: PipelineAssignmentOption[];
  teams: PipelineAssignmentOption[];
}

