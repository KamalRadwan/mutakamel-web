import { newIdempotencyKey } from '../shared/settings-api';
import { fakeCreateReason, fakeGetReasons, fakeUpdateReason } from './reasons.fake';
import { CreateReasonInput, ListReasonsQuery, Reason, ReasonListResponse, UpdateReasonPatch } from './reasons.model';

// GET /api/tenant/crm/v1/settings/reasons?kind=&active=true|false -> { items }
export function listReasons(query: ListReasonsQuery = {}): Promise<ReasonListResponse> {
  return fakeGetReasons(query);
}

// POST /api/tenant/crm/v1/settings/reasons (x-idempotency-key)
export function createReason(input: CreateReasonInput, idempotencyKey = newIdempotencyKey()): Promise<Reason> {
  return fakeCreateReason(input, idempotencyKey);
}

// PATCH /api/tenant/crm/v1/settings/reasons/:id (If-Match: "<revision>")
export function updateReason(id: string, revision: number, patch: UpdateReasonPatch): Promise<Reason> {
  return fakeUpdateReason(id, revision, patch);
}
