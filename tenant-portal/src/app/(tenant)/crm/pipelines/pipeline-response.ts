import { MAX_PIPELINES_IN_RESPONSE, PIPELINE_COLLECTION_MAX_SIZE, PIPELINE_NAME_MAX_LENGTH, UUID_V7_PATTERN,
  OPPORTUNITY_STAGE_FLAGS, STAGE_CATEGORIES, PIPELINE_ACCESS_MODES,
  type Pipeline, type PipelineStage, type PipelineAssignments, type PipelineAssignmentOptions,
  type PipelineAssignmentOption, type OpportunityStageDefinition, type OpportunityStageFlag, type StageCategory, type PipelineAccessMode,
} from "./pipeline-types";

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
    || new Set(source.userIds as string[]).size !== (source.userIds as string[]).length
    || new Set(source.teamIds as string[]).size !== (source.teamIds as string[]).length
    || (source.accessMode === "ALL" && (source.userIds as string[]).length + (source.teamIds as string[]).length > 0)
    || (source.accessMode === "RESTRICTED" && (source.userIds as string[]).length + (source.teamIds as string[]).length === 0)
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

export function parsePipelineStages(
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

export function parsePipelineStage(
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

function validName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= PIPELINE_NAME_MAX_LENGTH
  );
}

export function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

export function isUuidArray(value: unknown): boolean {
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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM pipelines response.");
}
