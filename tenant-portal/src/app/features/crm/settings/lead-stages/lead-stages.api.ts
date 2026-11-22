import {
  fakeCreateLeadStage,
  fakeDeleteLeadStage,
  fakeListLeadStages,
  fakeReorderLeadStages,
  fakeRequireQualifiedForConversion,
  fakeSetDefaultLeadStage,
  fakeUpdateLeadStage,
} from './lead-stages.fake';
import { CreateLeadStageInput, LeadStage, UpdateLeadStagePatch } from './lead-stages.model';

/** GET /api/tenant/crm/v1/lead-stages */
export function listLeadStages(): Promise<LeadStage[]> {
  return fakeListLeadStages();
}

/** POST /api/tenant/crm/v1/lead-stages */
export function createLeadStage(input: CreateLeadStageInput): Promise<LeadStage> {
  return fakeCreateLeadStage(input);
}

/** PATCH /api/tenant/crm/v1/lead-stages/:id */
export function updateLeadStage(id: string, patch: UpdateLeadStagePatch): Promise<LeadStage> {
  return fakeUpdateLeadStage(id, patch);
}

/** POST /api/tenant/crm/v1/lead-stages/:id/default */
export function setDefaultLeadStage(id: string): Promise<LeadStage> {
  return fakeSetDefaultLeadStage(id);
}

/** PATCH /api/tenant/crm/v1/lead-stages/reorder (header x-idempotency-key: one per reorder, the same on a retry) */
export function reorderLeadStages(
  orderedIds: readonly string[],
  idempotencyKey: string,
): Promise<LeadStage[]> {
  return fakeReorderLeadStages(orderedIds, idempotencyKey);
}

/** DELETE /api/tenant/crm/v1/lead-stages/:id */
export function deleteLeadStage(id: string): Promise<void> {
  return fakeDeleteLeadStage(id);
}

/** CRM general settings flag: require an active QUALIFIED stage to convert leads. */
export function requireQualifiedForConversion(): boolean {
  return fakeRequireQualifiedForConversion();
}
