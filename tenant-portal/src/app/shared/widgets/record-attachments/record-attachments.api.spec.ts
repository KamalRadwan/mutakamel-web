import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { deleteRecordAttachment, listRecordAttachments, uploadRecordAttachment } from './record-attachments.api';
import {
  resetRecordAttachmentsFake,
  setFakeAttachmentFlags,
  setFakeAttachmentsDelay,
} from './record-attachments.fake';
import { RecordAttachmentError } from './record-attachments.model';

const BRANCH = FAKE_COMPANIES[0].branches[0].id;
const OTHER_BRANCH = FAKE_COMPANIES[0].branches[1].id;
const KEY = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa20';

function pdf(name = 'offer.pdf', size = 10): File {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

async function rejection(promise: Promise<unknown>): Promise<RecordAttachmentError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RecordAttachmentError);
    return error as RecordAttachmentError;
  }
  throw new Error('expected a rejection');
}

describe('record-attachments.api contract (crm-app notes-attachments)', () => {
  beforeEach(() => {
    resetRecordAttachmentsFake();
    setFakeAttachmentsDelay(0);
  });
  afterEach(() => resetRecordAttachmentsFake());

  it('lists the seeded lead files on the session branch with the PaginatedResult shape', async () => {
    const page = await listRecordAttachments('LEAD', BRANCH, 'lead-001', 1, 2);
    expect(page).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2, hasNext: true, hasPrev: false });
    const empty = await listRecordAttachments('LEAD', BRANCH, 'lead-404');
    expect([empty.total, empty.totalPages, empty.hasNext]).toEqual([0, 0, false]);
    const beyond = await listRecordAttachments('LEAD', BRANCH, 'lead-001', 5, 2);
    expect([beyond.page, beyond.items.length, beyond.hasPrev]).toEqual([5, 0, true]);
  });

  it('rejects an out-of-range limit (400) and a source in another branch (422)', async () => {
    const limit = await rejection(listRecordAttachments('LEAD', BRANCH, 'lead-001', 1, 101));
    expect([limit.status, limit.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    const branch = await rejection(listRecordAttachments('LEAD', OTHER_BRANCH, 'lead-001'));
    expect([branch.status, branch.code]).toEqual([422, 'CRM_SOURCE_BRANCH_MISMATCH']);
  });

  it('maps file errors to the controller statuses', async () => {
    expect((await rejection(uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf('a.pdf', 0)))).status).toBe(400);
    const invalid = await rejection(uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf('a.png')));
    expect([invalid.status, invalid.code]).toEqual([422, 'CRM_ATTACHMENT_INVALID']);
    const type = await rejection(
      uploadRecordAttachment('LEAD', BRANCH, 'lead-001', new File(['x'], 'a.exe', { type: 'application/x-msdownload' })),
    );
    expect([type.status, type.code]).toEqual([415, 'CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED']);
  });

  it('enforces the gateway idempotency key and replays the stored 201', async () => {
    const missing = await rejection(uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf(), undefined, ''));
    expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
    const bad = await rejection(uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf(), undefined, 'abc'));
    expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);
    const first = await uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf(), undefined, KEY);
    const replay = await uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf(), undefined, KEY);
    expect(replay.id).toBe(first.id);
    const mismatch = await rejection(uploadRecordAttachment('LEAD', BRANCH, 'lead-001', pdf('other.pdf'), undefined, KEY));
    expect([mismatch.status, mismatch.code]).toEqual([422, 'GW.IDEM.MISMATCH']);
    expect((await listRecordAttachments('LEAD', BRANCH, 'lead-001')).total).toBe(4);
  });

  it('uses CRM_PERMISSION_DENIED for a missing route permission and the read-only code first', async () => {
    setFakeAttachmentFlags({ canRead: false });
    expect((await rejection(listRecordAttachments('LEAD', BRANCH, 'lead-001'))).code).toBe('CRM_PERMISSION_DENIED');
    setFakeAttachmentFlags({ canRead: true, readOnly: true });
    expect((await rejection(deleteRecordAttachment('att-001'))).code).toBe('CRM_SUBSCRIPTION_READ_ONLY');
    setFakeAttachmentFlags({ readOnly: false, canDelete: false });
    expect((await rejection(deleteRecordAttachment('att-001'))).code).toBe('CRM_PERMISSION_DENIED');
  });
});
