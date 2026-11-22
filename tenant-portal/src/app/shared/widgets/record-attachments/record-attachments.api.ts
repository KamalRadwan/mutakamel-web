import {
  fakeCanCreateRecordAttachments,
  fakeCanDeleteRecordAttachments,
  fakeDeleteRecordAttachment,
  fakeListRecordAttachments,
  fakeRecordAttachmentDownloadUrl,
  fakeUploadRecordAttachment,
} from './record-attachments.fake';
import {
  ATTACHMENT_PAGE_LIMIT,
  AttachmentSourceType,
  RecordAttachment,
  RecordAttachmentPage,
  newAttachmentIdempotencyKey,
} from './record-attachments.model';

// Backend: crm-app/src/crm/notes-attachments (controller + service); gateway crm.route-contracts.ts.
// Errors `{ statusCode, errorCode, message, details? }` -> RecordAttachmentError(status, code, details).
// 400 CRM_VALIDATION_FAILED (DTO: branchId/sourceId UUIDv7, page >= 1, limit 1..100) · 403 CRM_PERMISSION_DENIED
// (route permission) / CRM_SCOPED_PERMISSION_DENIED (owner scope) / CRM_SUBSCRIPTION_READ_ONLY · 404 CRM_SOURCE_NOT_FOUND /
// CRM_ATTACHMENT_NOT_FOUND / CRM_ATTACHMENT_FILE_NOT_FOUND · 422 CRM_SOURCE_BRANCH_MISMATCH.

/** GET /api/tenant/crm/v1/attachments?branchId&sourceType&sourceId&page&limit (upstream /api/v1/crm/attachments; offset page, default limit 20) */
export function listRecordAttachments(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  page = 1,
  limit = ATTACHMENT_PAGE_LIMIT,
): Promise<RecordAttachmentPage> {
  return fakeListRecordAttachments(sourceType, branchId, sourceId, page, limit);
}

/** GET /api/tenant/crm/v1/attachments?branchId&sourceType&sourceId&page=1&limit=1 (upstream /api/v1/crm/attachments) */
export async function countRecordAttachments(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
): Promise<number> {
  const result = await listRecordAttachments(sourceType, branchId, sourceId, 1, 1);
  return result.total;
}

/**
 * POST /api/tenant/crm/v1/attachments/upload multipart (file, branchId, sourceType, sourceId) -> 201 attachment.
 * Header x-idempotency-key UUIDv7, enforced by the gateway (400 GW.IDEM.MISSING / GW.IDEM.BAD_VALUE,
 * 409 GW.IDEM.IN_FLIGHT, 422 GW.IDEM.MISMATCH; same key + same request replays the 201).
 * 400 CRM_ATTACHMENT_FILE_REQUIRED / CRM_ATTACHMENT_FILE_EMPTY · 413 CRM_ATTACHMENT_FILE_TOO_LARGE (25 MB) ·
 * 415 CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED · 422 CRM_ATTACHMENT_INVALID (extension/MIME, multipart limits) ·
 * 507 STORAGE_CAPACITY_EXCEEDED. Keep the key per file and reuse it on retry.
 */
export function uploadRecordAttachment(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  file: File,
  onProgress?: (percent: number) => void,
  idempotencyKey = newAttachmentIdempotencyKey(),
): Promise<RecordAttachment> {
  return fakeUploadRecordAttachment(sourceType, branchId, sourceId, file, onProgress, idempotencyKey);
}

/** GET /api/tenant/crm/v1/attachments/:id/download -> binary stream (Content-Disposition attachment; 404 CRM_ATTACHMENT_NOT_FOUND / CRM_ATTACHMENT_FILE_NOT_FOUND) */
export function recordAttachmentDownloadUrl(id: string): Promise<string> {
  return fakeRecordAttachmentDownloadUrl(id);
}

/** DELETE /api/tenant/crm/v1/attachments/:id -> 204 (soft delete; no idempotency key on this route) */
export function deleteRecordAttachment(id: string): Promise<void> {
  return fakeDeleteRecordAttachment(id);
}

/** Session permission check: crm.attachments.create */
export function canCreateRecordAttachments(): boolean {
  return fakeCanCreateRecordAttachments();
}

/** Session permission check: crm.attachments.delete */
export function canDeleteRecordAttachments(): boolean {
  return fakeCanDeleteRecordAttachments();
}
