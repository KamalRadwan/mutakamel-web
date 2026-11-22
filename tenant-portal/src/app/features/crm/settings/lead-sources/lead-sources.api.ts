import {
  fakeCreateLeadSource,
  fakeDeleteLeadSource,
  fakeListLeadSources,
  fakeReorderLeadSources,
  fakeUpdateLeadSource,
  fakeUploadLeadSourceIcon,
} from './lead-sources.fake';
import { CreateLeadSourceInput, LeadSource, UpdateLeadSourceInput } from './lead-sources.model';

/** GET /api/tenant/crm/v1/acquisition-sources */
export function listLeadSources(): Promise<LeadSource[]> {
  return fakeListLeadSources();
}

/** POST /api/tenant/crm/v1/acquisition-sources */
export function createLeadSource(input: CreateLeadSourceInput): Promise<LeadSource> {
  return fakeCreateLeadSource(input);
}

/** PATCH /api/tenant/crm/v1/acquisition-sources/:id */
export function updateLeadSource(id: string, changes: UpdateLeadSourceInput): Promise<LeadSource> {
  return fakeUpdateLeadSource(id, changes);
}

/**
 * PATCH /api/tenant/crm/v1/acquisition-sources/reorder.
 * Header x-idempotency-key (UUID v7) is required: the gateway enforces it (WRITE_SENSITIVE route), not crm-app.
 * New key per user action, same key on retry.
 */
export function reorderLeadSources(orderedIds: readonly string[], idempotencyKey: string): Promise<LeadSource[]> {
  return fakeReorderLeadSources(orderedIds, idempotencyKey);
}

/** DELETE /api/tenant/crm/v1/acquisition-sources/:id */
export function deleteLeadSource(id: string): Promise<void> {
  return fakeDeleteLeadSource(id);
}

/**
 * POST /api/tenant/crm/v1/acquisition-sources/:id/icon (multipart).
 * Header x-idempotency-key (UUID v7) is required: the gateway enforces it and stores the replay.
 */
export function uploadLeadSourceIcon(id: string, file: File, idempotencyKey: string): Promise<LeadSource> {
  return fakeUploadLeadSourceIcon(id, file, idempotencyKey);
}
