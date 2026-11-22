import {
  fakeAddPipelineStage,
  fakeAssignmentOptions,
  fakeCreatePipeline,
  fakeDeletePipeline,
  fakeGetPipelineConfiguration,
  fakeListPipelinesConfiguration,
  fakeListPipelinesForRead,
  fakeRemovePipelineStage,
  fakeReorderPipelineStages,
  fakeReplaceAssignments,
  fakeResetPipeline,
  fakeSetDefaultPipeline,
  fakeUpdatePipeline,
} from './pipelines.fake';
import {
  AssignmentOptions,
  CreatePipelineInput,
  Pipeline,
  PipelineAssignments,
  PipelineReadView,
  PipelineStage,
  ReplaceAssignmentsInput,
  UpdatePipelineInput,
} from './pipelines.model';

// GET /api/tenant/crm/v1/pipelines (permission: crm.pipelines.read). Read-level list for consumers (filters,
// pickers): active pipelines the actor can reach via ALL, a direct user or a team assignment; ordered by code;
// no `assignments`. Gateway AUTHENTICATED.
export function listPipelinesForRead(): Promise<PipelineReadView[]> {
  return fakeListPipelinesForRead();
}

// GET /api/tenant/crm/v1/pipelines/configuration (permission: crm.pipelines.manage)
export function listPipelinesConfiguration(): Promise<Pipeline[]> {
  return fakeListPipelinesConfiguration();
}

// GET /api/tenant/crm/v1/pipelines/:id/configuration (permission: crm.pipelines.manage)
export function getPipelineConfiguration(id: string): Promise<Pipeline> {
  return fakeGetPipelineConfiguration(id);
}

// POST /api/tenant/crm/v1/pipelines (permission: crm.pipelines.manage)
export function createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
  return fakeCreatePipeline(input);
}

// PATCH /api/tenant/crm/v1/pipelines/:id (permission: crm.pipelines.manage)
export function updatePipeline(id: string, changes: UpdatePipelineInput): Promise<Pipeline> {
  return fakeUpdatePipeline(id, changes);
}

// DELETE /api/tenant/crm/v1/pipelines/:id (permission: crm.pipelines.manage)
export function deletePipeline(id: string): Promise<void> {
  return fakeDeletePipeline(id);
}

// PUT /api/tenant/crm/v1/pipelines/:id/default (x-idempotency-key: gateway WRITE_SENSITIVE + idempotent; permission: crm.pipelines.manage)
export function setDefaultPipeline(id: string, idempotencyKey: string): Promise<Pipeline> {
  return fakeSetDefaultPipeline(id, idempotencyKey);
}

// POST /api/tenant/crm/v1/pipelines/:id/reset (permission: crm.pipelines.manage)
export function resetPipeline(id: string): Promise<Pipeline> {
  return fakeResetPipeline(id);
}

// POST /api/tenant/crm/v1/pipelines/:id/stages (permission: crm.pipelines.manage)
export function addPipelineStage(id: string, opportunityStageId: string): Promise<PipelineStage> {
  return fakeAddPipelineStage(id, opportunityStageId);
}

// PATCH /api/tenant/crm/v1/pipelines/:id/stages/reorder (body { orderedIds }; x-idempotency-key: gateway WRITE_SENSITIVE + idempotent; permission: crm.pipelines.manage)
export function reorderPipelineStages(
  id: string,
  orderedMembershipIds: string[],
  idempotencyKey: string,
): Promise<PipelineStage[]> {
  return fakeReorderPipelineStages(id, orderedMembershipIds, idempotencyKey);
}

// DELETE /api/tenant/crm/v1/pipelines/:id/stages/:pipelineStageId (permission: crm.pipelines.manage)
export function removePipelineStage(id: string, membershipId: string): Promise<void> {
  return fakeRemovePipelineStage(id, membershipId);
}

// GET /api/tenant/crm/v1/pipelines/assignment-options?search=...&limit=50 (permission: crm.pipelines.manage)
export function assignmentOptions(search = '', limit = 50): Promise<AssignmentOptions> {
  return fakeAssignmentOptions(search, limit);
}

// PUT /api/tenant/crm/v1/pipelines/:id/assignments (answers {accessMode,userIds,teamIds}; x-idempotency-key: gateway WRITE_SENSITIVE + idempotent; permission: crm.pipelines.manage)
export function replaceAssignments(
  id: string,
  input: ReplaceAssignmentsInput,
  idempotencyKey: string,
): Promise<PipelineAssignments> {
  return fakeReplaceAssignments(id, input, idempotencyKey);
}
