import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { type CoreQuery, type CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
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

const queryKey = ['crm-settings', 'pipelines'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { bodyJson: string | undefined; key: string }>>();

function read<T>(path: string, query?: CoreQuery): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, path, query],
    queryFn: () => crmHttp().read<T>(path, query),
  });
}

async function write<T>(method: CoreWriteMethod, path: string, body: unknown, key?: string): Promise<T> {
  const http = crmHttp();
  let pendingWrites = retries.get(http);
  if (!pendingWrites) retries.set(http, (pendingWrites = new Map()));
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body);
  const pending = pendingWrites.get(action);
  const request = {
    bodyJson,
    key: key ?? (pending && pending.bodyJson === bodyJson ? pending.key : newIdempotencyKey()),
  };
  pendingWrites.set(action, request);
  let data: T;
  try {
    const result = await http.write<T>(method, path, bodyJson === undefined ? undefined : JSON.parse(bodyJson), {
      key: request.key,
    });
    data = result.data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      if (pendingWrites.get(action) === request) pendingWrites.delete(action);
    }
    throw error;
  }
  if (pendingWrites.get(action) === request) pendingWrites.delete(action);
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return data;
}

// A reopened form is a new user action, even if the previous response was uncertain.
export function beginPipelineEdit(id: string | null): void {
  retries.get(crmHttp())?.delete(id ? `PATCH /pipelines/${id}` : 'POST /pipelines');
}

// Read-level list for record pickers; assignments are available only on configuration routes.
export function listPipelinesForRead(): Promise<PipelineReadView[]> {
  return read('/pipelines');
}

export async function listPipelinesConfiguration(): Promise<Pipeline[]> {
  const pipelines = await read<Pipeline[]>('/pipelines/configuration');
  return pipelines.slice().sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.code.localeCompare(b.code, 'en'));
}

export function getPipelineConfiguration(id: string): Promise<Pipeline> {
  return read(`/pipelines/${id}/configuration`);
}

export function getPipelineAssignments(id: string): Promise<PipelineAssignments> {
  return read(`/pipelines/${id}/assignments`);
}

export function createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
  return write('POST', '/pipelines', input);
}

export function updatePipeline(id: string, changes: UpdatePipelineInput): Promise<Pipeline> {
  return write('PATCH', `/pipelines/${id}`, changes);
}

export function deletePipeline(id: string): Promise<void> {
  return write('DELETE', `/pipelines/${id}`, undefined);
}

export function setDefaultPipeline(id: string, idempotencyKey: string): Promise<Pipeline> {
  return write('PUT', `/pipelines/${id}/default`, undefined, idempotencyKey);
}

export function resetPipeline(id: string): Promise<Pipeline> {
  return write('POST', `/pipelines/${id}/reset`, undefined);
}

export function addPipelineStage(id: string, opportunityStageId: string): Promise<PipelineStage> {
  return write('POST', `/pipelines/${id}/stages`, { opportunityStageId });
}

export function reorderPipelineStages(
  id: string,
  orderedMembershipIds: string[],
  idempotencyKey: string,
): Promise<PipelineStage[]> {
  return write('PATCH', `/pipelines/${id}/stages/reorder`, { orderedIds: orderedMembershipIds }, idempotencyKey);
}

export function removePipelineStage(id: string, membershipId: string): Promise<void> {
  return write('DELETE', `/pipelines/${id}/stages/${membershipId}`, undefined);
}

export function assignmentOptions(search = '', limit = 50): Promise<AssignmentOptions> {
  return read('/pipelines/assignment-options', { search, limit });
}

export function replaceAssignments(
  id: string,
  input: ReplaceAssignmentsInput,
  idempotencyKey: string,
): Promise<PipelineAssignments> {
  return write('PUT', `/pipelines/${id}/assignments`, {
    accessMode: input.accessMode,
    userIds: [...new Set(input.userIds)],
    teamIds: [...new Set(input.teamIds)],
  }, idempotencyKey);
}
