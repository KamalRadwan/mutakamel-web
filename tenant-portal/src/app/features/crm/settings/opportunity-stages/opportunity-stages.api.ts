// Loads the pipelines fake so stage usage is registered.
import '../pipelines/pipelines.fake';
import {
  fakeCreateOpportunityStage,
  fakeDeleteOpportunityStage,
  fakeListOpportunityStages,
  fakeStageUsage,
  fakeUpdateOpportunityStage,
} from './opportunity-stages.fake';
import {
  CreateOpportunityStageInput,
  OpportunityStage,
  StageUsagePipeline,
  UpdateOpportunityStageInput,
} from './opportunity-stages.model';

// GET /api/tenant/crm/v1/opportunity-stages (permission: crm.pipelines.manage)
export function listOpportunityStages(): Promise<OpportunityStage[]> {
  return fakeListOpportunityStages();
}

// POST /api/tenant/crm/v1/opportunity-stages (permission: crm.pipelines.manage)
export function createOpportunityStage(input: CreateOpportunityStageInput): Promise<OpportunityStage> {
  return fakeCreateOpportunityStage(input);
}

// PATCH /api/tenant/crm/v1/opportunity-stages/:id (permission: crm.pipelines.manage)
export function updateOpportunityStage(id: string, changes: UpdateOpportunityStageInput): Promise<OpportunityStage> {
  return fakeUpdateOpportunityStage(id, changes);
}

// DELETE /api/tenant/crm/v1/opportunity-stages/:id (permission: crm.pipelines.manage)
export function deleteOpportunityStage(id: string): Promise<void> {
  return fakeDeleteOpportunityStage(id);
}

// Computed client-side from GET /api/tenant/crm/v1/pipelines/configuration (permission: crm.pipelines.manage)
export function stageUsage(): Promise<Record<string, StageUsagePipeline[]>> {
  return fakeStageUsage();
}
