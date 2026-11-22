import {
  fakeCanCreateRecordAttachments,
  fakeCanDeleteRecordAttachments,
  fakeDeleteRecordAttachment,
  fakeListRecordAttachments,
  fakeRecordAttachmentDownloadUrl,
  fakeUploadRecordAttachment,
} from '../../../../../shared/widgets/record-attachments/record-attachments.fake';
import {
  ATTACHMENT_PAGE_LIMIT,
  RecordAttachment,
  RecordAttachmentPage,
  newAttachmentIdempotencyKey,
} from '../../../../../shared/widgets/record-attachments/record-attachments.model';

export {
  FAKE_CAN_CREATE_ATTACHMENTS,
  FAKE_CAN_DELETE_ATTACHMENTS,
  FAKE_CAN_READ_ATTACHMENTS,
  FAKE_READ_ONLY,
} from '../../../../../shared/widgets/record-attachments/record-attachments.fake';

export function fakeCanCreateLeadAttachments(): boolean {
  return fakeCanCreateRecordAttachments();
}

export function fakeCanDeleteLeadAttachments(): boolean {
  return fakeCanDeleteRecordAttachments();
}

export function fakeListLeadAttachments(
  branchId: string,
  leadId: string,
  page = 1,
  limit = ATTACHMENT_PAGE_LIMIT,
): Promise<RecordAttachmentPage> {
  return fakeListRecordAttachments('LEAD', branchId, leadId, page, limit);
}

export function fakeUploadLeadAttachment(
  branchId: string,
  leadId: string,
  file: File,
  onProgress?: (percent: number) => void,
  idempotencyKey = newAttachmentIdempotencyKey(),
): Promise<RecordAttachment> {
  return fakeUploadRecordAttachment('LEAD', branchId, leadId, file, onProgress, idempotencyKey);
}

export function fakeLeadAttachmentDownloadUrl(id: string): Promise<string> {
  return fakeRecordAttachmentDownloadUrl(id);
}

export function fakeDeleteLeadAttachment(id: string): Promise<void> {
  return fakeDeleteRecordAttachment(id);
}
