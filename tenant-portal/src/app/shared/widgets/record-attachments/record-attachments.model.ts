import { newIdempotencyKey } from '../../../core/api/idempotency';

/** `CrmAttachmentSourceTypeDto` (crm-app notes-attachments.dto.ts). */
export type AttachmentSourceType = 'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY' | 'ACTIVITY' | 'NOTE';

export interface RecordAttachment {
  id: string;
  branchId: string;
  sourceType: AttachmentSourceType;
  sourceId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** `PaginatedResult` (BaseRepository.search): `totalPages` is 0 when empty; `page` is echoed, never clamped. */
export interface RecordAttachmentPage {
  items: RecordAttachment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class RecordAttachmentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'RecordAttachmentError';
  }
}

/** UUIDv7 `x-idempotency-key` for the upload (gateway route crm.attachments.upload.post is WRITE_SENSITIVE). */
export function newAttachmentIdempotencyKey(): string {
  return newIdempotencyKey();
}

/** Extensions the service accepts per MIME (`assertAttachmentAllowed`, else 422 CRM_ATTACHMENT_INVALID). */
export const ATTACHMENT_EXTENSIONS_BY_MIME: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export type AttachmentKind = 'pdf' | 'image' | 'excel' | 'word' | 'csv' | 'text' | 'other';

export interface AttachmentTypeMeta {
  kind: AttachmentKind;
  tileClass: string;
  icon: string;
  labelKey: string;
}

export const ATTACHMENT_MAX_BYTES = 26_214_400; // 25 MB
export const ATTACHMENT_PAGE_LIMIT = 20;
export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,.xlsx,.docx,.csv,.txt';

export const ALLOWED_ATTACHMENT_MIMES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/plain',
]);

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

const KIND_META: Readonly<Record<AttachmentKind, AttachmentTypeMeta>> = {
  pdf: { kind: 'pdf', tileClass: 'bg-icon-red', icon: 'tablerFileTypePdf', labelKey: 'recordAttachments.type.pdf' },
  image: { kind: 'image', tileClass: 'bg-icon-violet', icon: 'tablerPhoto', labelKey: 'recordAttachments.type.image' },
  excel: { kind: 'excel', tileClass: 'bg-icon-green', icon: 'tablerFileSpreadsheet', labelKey: 'recordAttachments.type.excel' },
  word: { kind: 'word', tileClass: 'bg-icon-blue', icon: 'tablerFileWord', labelKey: 'recordAttachments.type.word' },
  csv: { kind: 'csv', tileClass: 'bg-icon-teal', icon: 'tablerFileSpreadsheet', labelKey: 'recordAttachments.type.csv' },
  text: { kind: 'text', tileClass: 'bg-icon-gray', icon: 'tablerFileText', labelKey: 'recordAttachments.type.text' },
  other: { kind: 'other', tileClass: 'bg-icon-gray', icon: 'tablerFile', labelKey: 'recordAttachments.type.other' },
};

function fileExtensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function resolveAttachmentMime(file: { name: string; type: string }): string {
  const rawType = file.type.trim().toLowerCase();
  if (rawType && ALLOWED_ATTACHMENT_MIMES.has(rawType)) {
    return rawType;
  }
  const ext = fileExtensionOf(file.name);
  if (ext && EXTENSION_TO_MIME[ext]) {
    if (!rawType || (ext === '.csv' && rawType === 'application/vnd.ms-excel')) {
      return EXTENSION_TO_MIME[ext];
    }
  }
  return rawType;
}

export function attachmentTypeMeta(mimeType: string, fileName = ''): AttachmentTypeMeta {
  const mime = resolveAttachmentMime({ name: fileName, type: mimeType });
  const ext = fileExtensionOf(fileName);

  if (mime === 'application/pdf' || (!mime && ext === '.pdf')) {
    return KIND_META.pdf;
  }
  if (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/webp' ||
    (!mime && (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp'))
  ) {
    return KIND_META.image;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || (!mime && ext === '.xlsx')) {
    return KIND_META.excel;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (!mime && ext === '.docx')) {
    return KIND_META.word;
  }
  if (mime === 'text/csv' || (!mime && ext === '.csv')) {
    return KIND_META.csv;
  }
  if (mime === 'text/plain' || (!mime && ext === '.txt')) {
    return KIND_META.text;
  }
  return KIND_META.other;
}
