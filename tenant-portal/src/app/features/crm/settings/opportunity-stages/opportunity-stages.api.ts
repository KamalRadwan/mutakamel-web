import { InjectionToken } from '@angular/core';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import type { CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { listPipelinesConfiguration } from '../pipelines/pipelines.api';
import {
  CreateOpportunityStageInput,
  OpportunityStage,
  StageUsagePipeline,
  UpdateOpportunityStageInput,
} from './opportunity-stages.model';

const queryKey = ['crm-settings', 'opportunity-stages'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string | undefined }>>();
export const OPPORTUNITY_STAGE_USAGE_READER = new InjectionToken<typeof stageUsage>('Opportunity stage usage reader', {
  factory: () => stageUsage,
});

// GET /api/tenant/crm/v1/opportunity-stages (permission: crm.pipelines.manage)
export function listOpportunityStages(): Promise<OpportunityStage[]> {
  return crmQueries().fetchQuery({
    queryKey,
    queryFn: () => crmHttp().read<OpportunityStage[]>('/opportunity-stages'),
  });
}

// POST /api/tenant/crm/v1/opportunity-stages (permission: crm.pipelines.manage)
export function createOpportunityStage(input: CreateOpportunityStageInput): Promise<OpportunityStage> {
  return writeStage('POST', '/opportunity-stages', input);
}

// PATCH /api/tenant/crm/v1/opportunity-stages/:id (permission: crm.pipelines.manage)
export function updateOpportunityStage(id: string, changes: UpdateOpportunityStageInput): Promise<OpportunityStage> {
  return writeStage('PATCH', `/opportunity-stages/${id}`, changes);
}

// DELETE /api/tenant/crm/v1/opportunity-stages/:id (permission: crm.pipelines.manage)
export function deleteOpportunityStage(id: string): Promise<void> {
  return writeStage('DELETE', `/opportunity-stages/${id}`, undefined);
}

// Computed client-side from GET /api/tenant/crm/v1/pipelines/configuration (permission: crm.pipelines.manage)
export async function stageUsage(): Promise<Record<string, StageUsagePipeline[]>> {
  const pipelines = await listPipelinesConfiguration();
  const usage: Record<string, StageUsagePipeline[]> = {};
  for (const pipeline of pipelines) {
    const summary = { id: pipeline.id, nameAr: pipeline.nameAr, nameEn: pipeline.nameEn };
    for (const stageId of new Set(pipeline.stages.map((stage) => stage.opportunityStageId))) {
      (usage[stageId] ??= []).push(summary);
    }
  }
  return usage;
}

/** Opening a different form starts a new action, even after an uncertain response. */
export function beginOpportunityStageEdit(id: string | null): void {
  retries.get(crmHttp())?.delete(id ? `PATCH /opportunity-stages/${id}` : 'POST /opportunity-stages');
}

async function writeStage<T>(method: CoreWriteMethod, path: string, body: unknown): Promise<T> {
  const http = crmHttp();
  let pending = retries.get(http);
  if (!pending) retries.set(http, (pending = new Map()));
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(action);
  const key = previous && previous.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
  pending.delete(action);
  let data: T;
  try {
    data = (await http.write<T>(method, path, body, { key })).data;
  } catch (error) {
    if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401)) {
      pending.set(action, { key, bodyJson });
    }
    throw error;
  }
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return data;
}
