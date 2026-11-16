import { PIPELINES_PATH, PIPELINE_CODE_MAX_LENGTH, PIPELINE_CODE_PATTERN, PIPELINE_NAME_MAX_LENGTH,
  PIPELINE_DESCRIPTION_MAX_LENGTH, PIPELINE_COLLECTION_MAX_SIZE, PIPELINE_ACCESS_MODES,
  type PipelineStage, type PipelineAccessMode, type CreatePipelineInput, type UpdatePipelineInput,
} from "./pipeline-types";
import { isUuid, isUuidArray } from "./pipeline-response";
export * from "./pipeline-types";
export { parsePipelinesResponse, parsePipelineResponse, parseAssignmentsResponse, parseAssignmentOptionsResponse,
  parseOpportunityStageDefinitionsResponse, parseOpportunityStageDefinitionResponse } from "./pipeline-response";

export function pipelinePath(id: string): string {
  return `${PIPELINES_PATH}/${encodeUuid(id)}`;
}

export function pipelineConfigurationPath(id: string): string {
  return `${pipelinePath(id)}/configuration`;
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
  if (!PIPELINE_ACCESS_MODES.includes(accessMode) || !isUuidArray(userIds) || !isUuidArray(teamIds)
    || new Set(userIds).size !== userIds.length || new Set(teamIds).size !== teamIds.length
    || (accessMode === "ALL" && userIds.length + teamIds.length > 0)
    || (accessMode === "RESTRICTED" && userIds.length + teamIds.length === 0)) {
    throw new Error("PIPELINE_ASSIGNMENTS_INVALID");
  }
  return { accessMode, userIds: [...userIds], teamIds: [...teamIds] };
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
  // pipelines.service.ts assertValidReorder requires exactly one NEW, first.
  if (
    stages[0]?.flag !== "NEW" ||
    stages.filter(({ flag }) => flag === "NEW").length !== 1
  ) return null;
  if (index === 0 || target === 0) return null;
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

function encodeUuid(id: string): string {
  if (!isUuid(id)) throw new Error("Invalid CRM pipelines response.");
  return encodeURIComponent(id);
}
