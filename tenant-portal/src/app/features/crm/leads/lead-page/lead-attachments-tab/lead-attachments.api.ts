import {
  canCreateRecordAttachments,
  canDeleteRecordAttachments,
  countRecordAttachments,
  deleteRecordAttachment,
  listRecordAttachments,
  recordAttachmentDownloadUrl,
  uploadRecordAttachment,
} from '../../../../../shared/widgets/record-attachments/record-attachments.api';
import {
  ATTACHMENT_PAGE_LIMIT,
  RecordAttachment,
  RecordAttachmentPage,
  newAttachmentIdempotencyKey,
} from '../../../../../shared/widgets/record-attachments/record-attachments.model';

/** GET /api/tenant/crm/v1/attachments?branchId&sourceType=LEAD&sourceId=<leadId>&page&limit (upstream /api/v1/crm/attachments) */
export function listLeadAttachments(
  branchId: string,
  leadId: string,
  page = 1,
  limit = ATTACHMENT_PAGE_LIMIT,
): Promise<RecordAttachmentPage> {
  return listRecordAttachments('LEAD', branchId, leadId, page, limit);
}

/** GET /api/tenant/crm/v1/attachments?branchId&sourceType=LEAD&sourceId=<leadId>&page=1&limit=1 (upstream /api/v1/crm/attachments) */
export function countLeadAttachments(branchId: string, leadId: string): Promise<number> {
  return countRecordAttachments('LEAD', branchId, leadId);
}

/** POST /api/tenant/crm/v1/attachments/upload multipart (file, branchId, sourceType=LEAD, sourceId; header x-idempotency-key; upstream /api/v1/crm/attachments/upload) */
export function uploadLeadAttachment(
  branchId: string,
  leadId: string,
  file: File,
  onProgress?: (percent: number) => void,
  idempotencyKey = newAttachmentIdempotencyKey(),
): Promise<RecordAttachment> {
  return uploadRecordAttachment('LEAD', branchId, leadId, file, onProgress, idempotencyKey);
}

/** GET /api/tenant/crm/v1/attachments/:id/download (upstream /api/v1/crm/attachments/:id/download) */
export function leadAttachmentDownloadUrl(id: string): Promise<string> {
  return recordAttachmentDownloadUrl(id);
}

/** DELETE /api/tenant/crm/v1/attachments/:id (upstream /api/v1/crm/attachments/:id) */
export function deleteLeadAttachment(id: string): Promise<void> {
  return deleteRecordAttachment(id);
}

/** Session permission check: crm.attachments.create */
export function canCreateLeadAttachments(): boolean {
  return canCreateRecordAttachments();
}

/** Session permission check: crm.attachments.delete */
export function canDeleteLeadAttachments(): boolean {
  return canDeleteRecordAttachments();
}
