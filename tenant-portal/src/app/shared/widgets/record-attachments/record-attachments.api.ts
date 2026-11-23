import { ApiError, isRetryableWriteError } from '../../../core/api/api-errors';
import { crmHttp, crmQueries } from '../../../features/crm/shared/crm-http';
import { can } from '../dashboard/analytics-permissions';
import {
  ATTACHMENT_PAGE_LIMIT,
  AttachmentSourceType,
  RecordAttachment,
  RecordAttachmentPage,
  newAttachmentIdempotencyKey,
  resolveAttachmentMime,
} from './record-attachments.model';

const queryKey = ['crm-record-attachments'] as const;
const deleteKeys = new Map<string, string>();

/** Scope mode: none; branch and source belong in the query, without scope headers. */
export function listRecordAttachments(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  page = 1,
  limit = ATTACHMENT_PAGE_LIMIT,
): Promise<RecordAttachmentPage> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, sourceType, branchId, sourceId, page, limit],
    queryFn: () => crmHttp().read('/attachments', { branchId, sourceType, sourceId, page, limit }),
  });
}

/** Scope mode: none; list total is the count, using limit=1. */
export async function countRecordAttachments(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
): Promise<number> {
  const result = await listRecordAttachments(sourceType, branchId, sourceId, 1, 1);
  return result.total;
}

/**
 * Scope mode: none. POST /attachments/upload multipart -> 201 attachment.
 * Header x-idempotency-key UUIDv7, enforced by the gateway (400 GW.IDEM.MISSING / GW.IDEM.BAD_VALUE,
 * 409 GW.IDEM.IN_FLIGHT, 422 GW.IDEM.MISMATCH; same key + same request replays the 201).
 * 400 CRM_ATTACHMENT_FILE_REQUIRED / CRM_ATTACHMENT_FILE_EMPTY · 413 CRM_ATTACHMENT_FILE_TOO_LARGE (25 MB) ·
 * 415 CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED · 422 CRM_ATTACHMENT_INVALID (extension/MIME, multipart limits) ·
 * 507 STORAGE_CAPACITY_EXCEEDED. Keep the key per file and reuse it on retry.
 */
export async function uploadRecordAttachment(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  file: File,
  onProgress?: (percent: number) => void,
  idempotencyKey = newAttachmentIdempotencyKey(),
): Promise<RecordAttachment> {
  const form = new FormData();
  const mime = resolveAttachmentMime(file);
  form.append('file', mime && mime !== file.type ? file.slice(0, file.size, mime) : file, file.name);
  form.append('branchId', branchId);
  form.append('sourceType', sourceType);
  form.append('sourceId', sourceId);
  // The shared multipart transport exposes completion, but no intermediate progress events.
  onProgress?.(0);
  const result = await crmHttp().writeMultipart<RecordAttachment>('/attachments/upload', form, { key: idempotencyKey });
  await invalidateAttachments();
  onProgress?.(100);
  return result.data;
}

/** Scope mode: none; the browser sends the session cookie with this same-origin download link. */
export function recordAttachmentDownloadUrl(id: string): Promise<string> {
  return Promise.resolve(`/api/tenant/crm/v1/attachments/${encodeURIComponent(id)}/download`);
}

/** Scope mode: none; no stale token exists for attachments. A missing row is already deleted. */
export async function deleteRecordAttachment(id: string): Promise<void> {
  const key = deleteKeys.get(id) ?? newAttachmentIdempotencyKey();
  deleteKeys.set(id, key);
  try {
    await crmHttp().write('DELETE', `/attachments/${encodeURIComponent(id)}`, undefined, { key });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) deleteKeys.delete(id);
      throw error;
    }
  }
  deleteKeys.delete(id);
  await invalidateAttachments();
}

/** Session permission check: crm.attachments.create */
export function canCreateRecordAttachments(): boolean {
  return can('crm.attachments.create');
}

/** Session permission check: crm.attachments.delete */
export function canDeleteRecordAttachments(): boolean {
  return can('crm.attachments.delete');
}

async function invalidateAttachments(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
}
