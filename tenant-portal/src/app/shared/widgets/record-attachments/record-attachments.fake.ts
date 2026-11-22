import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import {
  ALLOWED_ATTACHMENT_MIMES,
  ATTACHMENT_EXTENSIONS_BY_MIME,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_PAGE_LIMIT,
  AttachmentSourceType,
  RecordAttachment,
  RecordAttachmentError,
  RecordAttachmentPage,
  newAttachmentIdempotencyKey,
  resolveAttachmentMime,
} from './record-attachments.model';

export let FAKE_READ_ONLY = false;
export let FAKE_CAN_READ_ATTACHMENTS = true;
export let FAKE_CAN_CREATE_ATTACHMENTS = true;
export let FAKE_CAN_DELETE_ATTACHMENTS = true;

const FAKE_CURRENT_USER_ID = 'u1';
/** CRM fakes share the session branches (core/scope FAKE_COMPANIES); lead-001 lives in the first one. */
const LEAD_BRANCH_ID = FAKE_COMPANIES[0].branches[0].id;
/** customers.fake DEFAULT_CUSTOMER_BRANCH_ID (Acme Retail's branch). */
const CUSTOMER_BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let fakeDelayMs = 300;

/** Test hook: 0 resolves on the next tick. */
export function setFakeAttachmentsDelay(ms: number): void {
  fakeDelayMs = ms;
}

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms, fakeDelayMs)));
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1' || localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function fakeCanCreateRecordAttachments(): boolean {
  return !FAKE_READ_ONLY && FAKE_CAN_CREATE_ATTACHMENTS && !readFlag('fake.attachments.noCreate');
}

export function fakeCanDeleteRecordAttachments(): boolean {
  return !FAKE_READ_ONLY && FAKE_CAN_DELETE_ATTACHMENTS && !readFlag('fake.attachments.noDelete');
}

function seedAttachments(): RecordAttachment[] {
  return [
    {
      id: 'att-001',
      branchId: LEAD_BRANCH_ID,
      sourceType: 'LEAD',
      sourceId: 'lead-001',
      fileName: 'nile-logistics-fleet-proposal.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1_258_291,
      uploadedByUserId: 'u1',
      createdAt: '2026-11-19T14:20:00.000Z',
      updatedAt: '2026-11-19T14:20:00.000Z',
    },
    {
      id: 'att-002',
      branchId: LEAD_BRANCH_ID,
      sourceType: 'LEAD',
      sourceId: 'lead-001',
      fileName: 'warehouse-layout-cairo-hq.png',
      mimeType: 'image/png',
      sizeBytes: 865_280,
      uploadedByUserId: 'u2',
      createdAt: '2026-11-18T11:05:00.000Z',
      updatedAt: '2026-11-18T11:05:00.000Z',
    },
    {
      id: 'att-003',
      branchId: LEAD_BRANCH_ID,
      sourceType: 'LEAD',
      sourceId: 'lead-001',
      fileName: 'annual-shipment-volumes-2026.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 248_832,
      uploadedByUserId: 'u1',
      createdAt: '2026-11-16T09:40:00.000Z',
      updatedAt: '2026-11-16T09:40:00.000Z',
    },
    {
      id: 'att-cust-001',
      branchId: CUSTOMER_BRANCH_ID,
      sourceType: 'CUSTOMER_PROFILE',
      sourceId: '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01',
      fileName: 'acme-retail-master-agreement-2026.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1_482_752,
      uploadedByUserId: 'u1',
      createdAt: '2026-11-19T15:10:00.000Z',
      updatedAt: '2026-11-19T15:10:00.000Z',
    },
    {
      id: 'att-cust-002',
      branchId: CUSTOMER_BRANCH_ID,
      sourceType: 'CUSTOMER_PROFILE',
      sourceId: '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01',
      fileName: 'acme-retail-commercial-registration.png',
      mimeType: 'image/png',
      sizeBytes: 642_048,
      uploadedByUserId: 'u2',
      createdAt: '2026-11-17T10:30:00.000Z',
      updatedAt: '2026-11-17T10:30:00.000Z',
    },
  ];
}

let attachments: RecordAttachment[] = seedAttachments();

const uploadedBlobs = new Map<string, Blob>();
/** Gateway idempotency store: key -> request fingerprint + stored 201 response. */
const uploadedByIdemKey = new Map<string, { fingerprint: string; response: RecordAttachment }>();

/** Test hook: restores the seed and clears the idempotency store and flags. */
export function resetRecordAttachmentsFake(): void {
  attachments = seedAttachments();
  uploadedBlobs.clear();
  uploadedByIdemKey.clear();
  FAKE_READ_ONLY = false;
  FAKE_CAN_READ_ATTACHMENTS = true;
  FAKE_CAN_CREATE_ATTACHMENTS = true;
  FAKE_CAN_DELETE_ATTACHMENTS = true;
  fakeDelayMs = 300;
}

export function setFakeAttachmentFlags(flags: {
  readOnly?: boolean;
  canRead?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
}): void {
  if (flags.readOnly !== undefined) FAKE_READ_ONLY = flags.readOnly;
  if (flags.canRead !== undefined) FAKE_CAN_READ_ATTACHMENTS = flags.canRead;
  if (flags.canCreate !== undefined) FAKE_CAN_CREATE_ATTACHMENTS = flags.canCreate;
  if (flags.canDelete !== undefined) FAKE_CAN_DELETE_ATTACHMENTS = flags.canDelete;
}

/** Another attachment of the same source in another branch means the source lives there (422). */
function assertSourceBranch(sourceType: AttachmentSourceType, sourceId: string, branchId: string): void {
  const sameSource = attachments.filter((item) => item.sourceType === sourceType && item.sourceId === sourceId);
  if (sameSource.length > 0 && sameSource.every((item) => item.branchId !== branchId)) {
    throw new RecordAttachmentError(422, 'CRM_SOURCE_BRANCH_MISMATCH');
  }
}

function cloneRow(row: RecordAttachment): RecordAttachment {
  return { ...row };
}

export async function fakeListRecordAttachments(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  page = 1,
  limit = ATTACHMENT_PAGE_LIMIT,
): Promise<RecordAttachmentPage> {
  await delay();
  // ListAttachmentsQueryDto / PaginationQueryDto (ValidationPipe -> 400 CRM_VALIDATION_FAILED).
  if (!Number.isInteger(page) || page < 1) {
    throw new RecordAttachmentError(400, 'CRM_VALIDATION_FAILED', { page: ['page must not be less than 1'] });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RecordAttachmentError(400, 'CRM_VALIDATION_FAILED', { limit: ['limit must not be greater than 100'] });
  }
  if (!FAKE_CAN_READ_ATTACHMENTS || readFlag('fake.attachments.noRead')) {
    throw new RecordAttachmentError(403, 'CRM_PERMISSION_DENIED');
  }
  assertSourceBranch(sourceType, sourceId, branchId);
  const matching = attachments
    .filter((item) => item.sourceType === sourceType && item.sourceId === sourceId && item.branchId === branchId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const total = matching.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return {
    items: matching.slice(offset, offset + limit).map(cloneRow),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Order: gateway idempotency (400/409/422, replay) -> subscription guard (403 read-only) -> permission guard
 * (403 CRM_PERMISSION_DENIED) -> Multer (413/415) -> file checks (400) -> extension/MIME (422) -> source (422).
 */
export async function fakeUploadRecordAttachment(
  sourceType: AttachmentSourceType,
  branchId: string,
  sourceId: string,
  file: File,
  onProgress?: (percent: number) => void,
  idempotencyKey = newAttachmentIdempotencyKey(),
): Promise<RecordAttachment> {
  if (!idempotencyKey) {
    await delay(150);
    throw new RecordAttachmentError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7.test(idempotencyKey)) {
    await delay(150);
    throw new RecordAttachmentError(400, 'GW.IDEM.BAD_VALUE');
  }
  const mimeType = resolveAttachmentMime(file);
  const fingerprint = JSON.stringify([branchId, sourceType, sourceId, file.name, file.size, mimeType]);
  const replayed = uploadedByIdemKey.get(idempotencyKey);
  if (replayed) {
    await delay(150);
    if (replayed.fingerprint !== fingerprint) {
      throw new RecordAttachmentError(422, 'GW.IDEM.MISMATCH');
    }
    onProgress?.(100);
    return cloneRow(replayed.response);
  }
  if (FAKE_READ_ONLY) {
    await delay(150);
    throw new RecordAttachmentError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
  if (!fakeCanCreateRecordAttachments()) {
    await delay(150);
    throw new RecordAttachmentError(403, 'CRM_PERMISSION_DENIED');
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    await delay(150);
    throw new RecordAttachmentError(413, 'CRM_ATTACHMENT_FILE_TOO_LARGE');
  }
  if (!ALLOWED_ATTACHMENT_MIMES.has(mimeType)) {
    await delay(150);
    throw new RecordAttachmentError(415, 'CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED');
  }
  if (file.size === 0) {
    await delay(150);
    throw new RecordAttachmentError(400, 'CRM_ATTACHMENT_FILE_EMPTY');
  }
  const lowerName = file.name.trim().toLowerCase();
  if (!(ATTACHMENT_EXTENSIONS_BY_MIME[mimeType] ?? []).some((ext) => lowerName.endsWith(ext))) {
    await delay(150);
    throw new RecordAttachmentError(422, 'CRM_ATTACHMENT_INVALID');
  }
  assertSourceBranch(sourceType, sourceId, branchId);

  for (const step of [20, 45, 75, 100]) {
    await delay(100);
    onProgress?.(step);
  }

  const now = new Date().toISOString();
  const created: RecordAttachment = {
    id: newAttachmentIdempotencyKey(),
    branchId,
    sourceType,
    sourceId,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
    uploadedByUserId: FAKE_CURRENT_USER_ID,
    createdAt: now,
    updatedAt: now,
  };

  uploadedBlobs.set(created.id, file);
  attachments = [created, ...attachments];
  uploadedByIdemKey.set(idempotencyKey, { fingerprint, response: cloneRow(created) });
  return cloneRow(created);
}

export async function fakeRecordAttachmentDownloadUrl(id: string): Promise<string> {
  await delay(150);
  const existing = attachments.find((item) => item.id === id);
  if (!existing) {
    throw new RecordAttachmentError(404, 'CRM_ATTACHMENT_NOT_FOUND');
  }
  const stored = uploadedBlobs.get(id);
  const blob =
    stored ??
    new Blob([`Preview file: ${existing.fileName}\nSize: ${existing.sizeBytes} bytes\n`], {
      type: existing.mimeType || 'application/octet-stream',
    });
  return URL.createObjectURL(blob);
}

export async function fakeDeleteRecordAttachment(id: string): Promise<void> {
  await delay();
  if (FAKE_READ_ONLY) {
    throw new RecordAttachmentError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
  if (!fakeCanDeleteRecordAttachments()) {
    throw new RecordAttachmentError(403, 'CRM_PERMISSION_DENIED');
  }
  const index = attachments.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new RecordAttachmentError(404, 'CRM_ATTACHMENT_NOT_FOUND');
  }
  attachments = attachments.filter((item) => item.id !== id);
  uploadedBlobs.delete(id);
}
