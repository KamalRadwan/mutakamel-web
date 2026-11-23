import { type CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { CreateLeadSourceInput, LeadSource, UpdateLeadSourceInput, keepSourceWriteKey } from './lead-sources.model';

const queryKey = ['crm-settings', 'lead-sources'] as const;
const path = '/acquisition-sources';
// Preserve the public signatures while keeping retry actions local to their transport binding.
const pendingWrites = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

export function listLeadSources(): Promise<LeadSource[]> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read<LeadSource[]>(path) });
}

export function createLeadSource(input: CreateLeadSourceInput): Promise<LeadSource> {
  return writeSource('POST', path, { ...input, nameAr: input.nameAr.trim(), nameEn: input.nameEn.trim() });
}

export function updateLeadSource(id: string, changes: UpdateLeadSourceInput): Promise<LeadSource> {
  const body = { ...changes };
  if (body.nameAr !== undefined) body.nameAr = body.nameAr.trim();
  if (body.nameEn !== undefined) body.nameEn = body.nameEn.trim();
  return writeSource('PATCH', `${path}/${id}`, body);
}

export function reorderLeadSources(orderedIds: readonly string[], idempotencyKey: string): Promise<LeadSource[]> {
  return writeSource('PATCH', `${path}/reorder`, { orderedIds: [...orderedIds] }, idempotencyKey);
}

export function deleteLeadSource(id: string): Promise<void> {
  return writeSource('DELETE', `${path}/${id}`, undefined);
}

export async function uploadLeadSourceIcon(id: string, file: File, idempotencyKey: string): Promise<LeadSource> {
  const form = new FormData();
  form.append('file', file);
  const result = await crmHttp().writeMultipart<LeadSource>(`${path}/${id}/icon`, form, { key: idempotencyKey });
  await refreshSources();
  return result.data;
}

async function writeSource<T>(method: CoreWriteMethod, url: string, body: unknown, suppliedKey?: string): Promise<T> {
  const http = crmHttp();
  let actions = pendingWrites.get(http);
  if (!actions) {
    actions = new Map();
    pendingWrites.set(http, actions);
  }
  const action = `${method} ${url}`;
  const bodyJson = JSON.stringify(body) ?? '';
  const previous = actions.get(action);
  const key = suppliedKey ?? (previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey());
  if (!suppliedKey) actions.set(action, { key, bodyJson });
  try {
    const result = await http.write<T>(method, url, bodyJson ? JSON.parse(bodyJson) : undefined, { key });
    actions.delete(action);
    await refreshSources();
    return result.data;
  } catch (error) {
    if (!keepSourceWriteKey(error)) actions.delete(action);
    throw error;
  }
}

async function refreshSources(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
}
