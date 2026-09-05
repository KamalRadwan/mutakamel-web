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
const PIPELINE_COLLECTION_MAX_SIZE = 100;

const MAX_PIPELINES_IN_RESPONSE = 200;
const UUID_V7_PATTERN =
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
  /** Present only on GET /pipelines/configuration — `findViews(…, true)`. */
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

export function pipelinePath(id: string): string {
  return `${PIPELINES_PATH}/${encodeUuid(id)}`;
}

export function pipelineDefaultPath(id: string): string {
  return `${pipelinePath(id)}/default`;
}

export function pipelineResetPath(id: string): string {
  return `${pipelinePath(id)}/reset`;
}

export function pipelineAssignmentsPath(id: string): string {
  return `${pipelinePath(id)}/assignments`;
}

export function pipelineStagesPath(id: string): string {
  return `${pipelinePath(id)}/stages`;
}

export function pipelineStagesReorderPath(id: string): string {
  return `${pipelinePath(id)}/stages/reorder`;
}

export function pipelineStagePath(id: string, pipelineStageId: string): string {
  return `${pipelinePath(id)}/stages/${encodeUuid(pipelineStageId)}`;
}

/**
 * `POST /pipelines` body.
 *
 * Keys omitted rather than sent empty: `forbidNonWhitelisted` rejects an
 * unknown key, and `@IsNotEmpty()` on an optional string rejects `""`.
 *
 * `stageIds` used to be omitted unconditionally, because a 448px drawer could
 * not show what choosing a stage order meant. The create surface is now a
 * full-screen modal with room for the ordered list and its rules, so the choice
 * is offered — and an EMPTY selection still omits the key, which is what makes
 * the service seed the canonical `CRM_DEFAULT_OPPORTUNITY_STAGES`. Sending
 * `[]` instead would be a 400: `@ArrayNotEmpty()` is on the field.
 *
 * Attach, reorder and detach after the fact still live on the pipeline detail
 * screen; this only removes the need to visit it before the pipeline is usable.
 */
export function buildCreatePipelineRequest(
  input: CreatePipelineInput,
): Record<string, unknown> {
  const code = input.code.trim().toUpperCase();
  if (
    code.length === 0 ||
    code.length > PIPELINE_CODE_MAX_LENGTH ||
    !PIPELINE_CODE_PATTERN.test(code)
  ) {
    throw new Error("PIPELINE_CODE_INVALID");
  }
  const body: Record<string, unknown> = {
    code,
    nameAr: requiredName(input.nameAr),
    nameEn: requiredName(input.nameEn),
    isDefault: input.isDefault,
  };
  const description = input.description.trim();
  if (description.length > PIPELINE_DESCRIPTION_MAX_LENGTH) {
    throw new Error("PIPELINE_DESCRIPTION_TOO_LONG");
  }
  if (description.length > 0) body.description = description;
  if (input.stageIds.length > 0) body.stageIds = [...input.stageIds];
  return body;
}

/** `PATCH /pipelines/:id` body. `code` and `isDefault` are not updatable. */
export function buildUpdatePipelineRequest(
  input: UpdatePipelineInput,
): Record<string, unknown> {
  const description = input.description.trim();
  if (description.length > PIPELINE_DESCRIPTION_MAX_LENGTH) {
    throw new Error("PIPELINE_DESCRIPTION_TOO_LONG");
  }
  return {
    nameAr: requiredName(input.nameAr),
    nameEn: requiredName(input.nameEn),
    // An empty description is a legitimate clear: the DTO has no @IsNotEmpty
    // on it, only @MaxLength.
    description,
    isActive: input.isActive,
  };
}

/**
 * `PUT /pipelines/:id/assignments` body.
 *
 * Both arrays are required by the DTO even when empty — they are declared
 * `@IsArray()` without `@IsOptional()`, so omitting one is a 422.
 */
export function buildReplaceAssignmentsRequest(
  accessMode: PipelineAccessMode,
  userIds: readonly string[],
  teamIds: readonly string[],
): Record<string, unknown> {
  if (
    userIds.length > PIPELINE_COLLECTION_MAX_SIZE ||
    teamIds.length > PIPELINE_COLLECTION_MAX_SIZE
  ) {
    throw new Error("PIPELINE_ASSIGNMENTS_TOO_MANY");
  }
  return { accessMode, userIds: [...userIds], teamIds: [...teamIds] };
}

export function parsePipelinesResponse(payload: unknown): Pipeline[] {
  if (!Array.isArray(payload) || payload.length > MAX_PIPELINES_IN_RESPONSE) {
    invalidResponse();
  }
  const pipelines = payload.map(parsePipelineResponse);
  if (new Set(pipelines.map(({ id }) => id)).size !== pipelines.length) {
    invalidResponse();
  }
  return pipelines;
}

export function parsePipelineResponse(payload: unknown): Pipeline {
  const source = record(payload);
  if (
    !source ||
    !isUuid(source.id) ||
    typeof source.code !== "string" ||
    source.code.length === 0 ||
    !validName(source.nameAr) ||
    !validName(source.nameEn) ||
    typeof source.isDefault !== "boolean" ||
    typeof source.isActive !== "boolean" ||
    !isAccessMode(source.accessMode) ||
    !Array.isArray(source.stages) ||
    !validTimestamp(source.createdAt) ||
    !validTimestamp(source.updatedAt)
  ) {
    invalidResponse();
  }
  const description = source.description;
  if (
    description !== null &&
    description !== undefined &&
    typeof description !== "string"
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    code: source.code,
    nameAr: source.nameAr as string,
    nameEn: source.nameEn as string,
    description: (description as string | null | undefined) ?? null,
    isDefault: source.isDefault,
    isActive: source.isActive,
    accessMode: source.accessMode,
    stages: parsePipelineStages(source.stages, source.id as string),
    assignments:
      source.assignments === undefined || source.assignments === null
        ? null
        : parseAssignmentsResponse(source.assignments),
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
  };
}

export function parseAssignmentsResponse(
  payload: unknown,
): PipelineAssignments {
  const source = record(payload);
  if (
    !source ||
    !isAccessMode(source.accessMode) ||
    !isUuidArray(source.userIds) ||
    !isUuidArray(source.teamIds)
  ) {
    invalidResponse();
  }
  return {
    accessMode: source.accessMode,
    userIds: [...(source.userIds as string[])],
    teamIds: [...(source.teamIds as string[])],
  };
}

export function parseAssignmentOptionsResponse(
  payload: unknown,
): PipelineAssignmentOptions {
  const source = record(payload);
  if (!source || !Array.isArray(source.users) || !Array.isArray(source.teams)) {
    invalidResponse();
  }
  return {
    users: source.users.map(parseAssignmentOption),
    teams: source.teams.map(parseAssignmentOption),
  };
}

export function parseOpportunityStageDefinitionsResponse(
  payload: unknown,
): OpportunityStageDefinition[] {
  if (!Array.isArray(payload) || payload.length > MAX_PIPELINES_IN_RESPONSE) {
    invalidResponse();
  }
  const stages = payload.map(parseOpportunityStageDefinitionResponse);
  if (new Set(stages.map(({ id }) => id)).size !== stages.length) {
    invalidResponse();
  }
  return stages;
}

export function parseOpportunityStageDefinitionResponse(
  payload: unknown,
): OpportunityStageDefinition {
  const source = record(payload);
  if (
    !source ||
    !isUuid(source.id) ||
    !validName(source.nameAr) ||
    !validName(source.nameEn) ||
    !isStageFlag(source.flag) ||
    !isStageCategory(source.category) ||
    typeof source.isActive !== "boolean" ||
    typeof source.isSystem !== "boolean" ||
    !validTimestamp(source.createdAt) ||
    !validTimestamp(source.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    nameAr: source.nameAr as string,
    nameEn: source.nameEn as string,
    flag: source.flag,
    category: source.category,
    isActive: source.isActive,
    isSystem: source.isSystem,
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
  };
}

function parseAssignmentOption(payload: unknown): PipelineAssignmentOption {
  const source = record(payload);
  if (
    !source ||
    typeof source.id !== "string" ||
    source.id.length === 0 ||
    typeof source.label !== "string" ||
    typeof source.status !== "string"
  ) {
    invalidResponse();
  }
  return {
    id: source.id,
    label: source.label,
    status: source.status,
    code: typeof source.code === "string" ? source.code : null,
  };
}

function parsePipelineStages(
  payload: unknown,
  pipelineId: string | null,
): PipelineStage[] {
  if (!Array.isArray(payload) || payload.length > PIPELINE_COLLECTION_MAX_SIZE) {
    invalidResponse();
  }
  const stages = payload.map((entry) => parsePipelineStage(entry, pipelineId));
  if (new Set(stages.map(({ id }) => id)).size !== stages.length) {
    invalidResponse();
  }
  // Ranks are dense and one-based on the server; render order is `rank`, never
  // a client sort by name.
  return [...stages].sort((left, right) => left.rank - right.rank);
}

function parsePipelineStage(
  payload: unknown,
  pipelineId: string | null,
): PipelineStage {
  const source = record(payload);
  if (
    !source ||
    !isUuid(source.id) ||
    !isUuid(source.pipelineId) ||
    (pipelineId !== null && source.pipelineId !== pipelineId) ||
    !isUuid(source.opportunityStageId) ||
    !Number.isSafeInteger(source.rank) ||
    (source.rank as number) < 1 ||
    !validName(source.nameAr) ||
    !validName(source.nameEn) ||
    !isStageFlag(source.flag) ||
    !isStageCategory(source.category) ||
    typeof source.isActive !== "boolean" ||
    typeof source.isSystem !== "boolean"
  ) {
    invalidResponse();
  }
  return {
    id: source.id as string,
    pipelineId: source.pipelineId as string,
    opportunityStageId: source.opportunityStageId as string,
    rank: source.rank as number,
    nameAr: source.nameAr as string,
    nameEn: source.nameEn as string,
    flag: source.flag,
    category: source.category,
    isActive: source.isActive,
    isSystem: source.isSystem,
  };
}

/** The ordered id list `PATCH /:id/stages/reorder` replaces ranks with. */
export function moveStageOrder(
  stages: readonly PipelineStage[],
  stageId: string,
  direction: -1 | 1,
): string[] | null {
  const index = stages.findIndex(({ id }) => id === stageId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stages.length) return null;
  const ordered = stages.map(({ id }) => id);
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

function requiredName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > PIPELINE_NAME_MAX_LENGTH) {
    throw new Error("PIPELINE_NAME_INVALID");
  }
  return trimmed;
}

function validName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= PIPELINE_NAME_MAX_LENGTH
  );
}

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

function isUuidArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= PIPELINE_COLLECTION_MAX_SIZE &&
    value.every(isUuid)
  );
}

function isStageFlag(value: unknown): value is OpportunityStageFlag {
  return OPPORTUNITY_STAGE_FLAGS.includes(value as OpportunityStageFlag);
}

function isStageCategory(value: unknown): value is StageCategory {
  return STAGE_CATEGORIES.includes(value as StageCategory);
}

function isAccessMode(value: unknown): value is PipelineAccessMode {
  return PIPELINE_ACCESS_MODES.includes(value as PipelineAccessMode);
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function encodeUuid(id: string): string {
  if (!isUuid(id)) invalidResponse();
  return encodeURIComponent(id);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM pipelines response.");
}
