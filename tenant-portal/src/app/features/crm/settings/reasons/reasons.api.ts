import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { CreateReasonInput, ListReasonsQuery, Reason, ReasonListResponse, UpdateReasonPatch } from './reasons.model';

const queryKey = ['crm-settings', 'reasons'] as const;
const pendingUpdates = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

// GET /api/tenant/crm/v1/settings/reasons
export function listReasons(query: ListReasonsQuery = {}): Promise<ReasonListResponse> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, query],
    queryFn: () => crmHttp().read('/settings/reasons', { ...query }),
  });
}

// POST /api/tenant/crm/v1/settings/reasons (x-idempotency-key)
export async function createReason(input: CreateReasonInput, idempotencyKey = newIdempotencyKey()): Promise<Reason> {
  const body: CreateReasonInput = {
    reasonKind: input.reasonKind,
    code: input.code,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    sortOrder: input.sortOrder,
  };
  if (input.definitionEn != null) body.definitionEn = input.definitionEn;
  if (input.definitionAr != null) body.definitionAr = input.definitionAr;
  if (input.reasonKind === 'ACTIVITY_OUTCOME') {
    if (input.polarity != null) body.polarity = input.polarity;
    if (input.activityType != null) body.activityType = input.activityType;
  }
  const { data } = await crmHttp().write<Reason>('POST', '/settings/reasons', body, { key: idempotencyKey });
  await invalidateReasons();
  return data;
}

// PATCH /api/tenant/crm/v1/settings/reasons/:id (If-Match and body revision agree)
export async function updateReason(id: string, revision: number, patch: UpdateReasonPatch): Promise<Reason> {
  const http = crmHttp();
  let pending = pendingUpdates.get(http);
  if (!pending) pendingUpdates.set(http, (pending = new Map()));
  const body = { ...patch, revision };
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(id);
  const key = previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
  pending.delete(id);
  let data: Reason;
  try {
    data = (await http.write<Reason>('PATCH', `/settings/reasons/${id}`, body, { key, ifMatch: `"${revision}"` })).data;
  } catch (error) {
    if (isRetryableWriteError(error) || error instanceof ApiError && error.status === 401) {
      pending.set(id, { key, bodyJson });
    }
    throw error;
  }
  await invalidateReasons();
  return data;
}

export function beginReasonEdit(id: string): void {
  pendingUpdates.get(crmHttp())?.delete(id);
}

async function invalidateReasons(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
}
