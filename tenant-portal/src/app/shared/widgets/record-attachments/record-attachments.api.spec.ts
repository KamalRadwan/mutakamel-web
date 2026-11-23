import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../core/api/core-http';
import { ApiError } from '../../../core/api/api-errors';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../../features/crm/shared/crm-http';
import { bindAnalyticsPermissions } from '../dashboard/analytics-permissions';
import {
  canCreateRecordAttachments, canDeleteRecordAttachments, countRecordAttachments,
  deleteRecordAttachment, listRecordAttachments, recordAttachmentDownloadUrl, uploadRecordAttachment,
} from './record-attachments.api';
import type { RecordAttachment, RecordAttachmentPage } from './record-attachments.model';

const BRANCH = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01';
const SOURCE = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa02';
const KEY = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa20';
const BASE = '/api/tenant/crm/v1';
const ROW: RecordAttachment = {
  id: KEY, branchId: BRANCH, sourceType: 'LEAD', sourceId: SOURCE,
  fileName: 'offer.pdf', mimeType: 'application/pdf', sizeBytes: 3, uploadedByUserId: SOURCE,
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
};
const PAGE: RecordAttachmentPage = {
  items: [ROW], total: 31, page: 2, limit: 20, totalPages: 2, hasNext: false, hasPrev: true,
};

describe('RecordAttachmentsApi', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), CoreHttp, CrmHttp] });
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    document.cookie = '__Host-mutakamel-tenant-csrf=test-csrf; Path=/; Secure';
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; Path=/';
  });
  afterEach(() => {
    http.verify();
    dispose();
    crmQueries().clear();
    bindAnalyticsPermissions(() => []);
    vi.restoreAllMocks();
    document.cookie = '__Host-mutakamel-tenant-csrf=; Path=/; Secure; Max-Age=0';
    document.cookie = 'mutakamel-http-tenant-csrf=; Path=/; Max-Age=0';
  });

  function noScope(headers: { has(name: string): boolean }): void {
    expect(headers.has('x-mutakamel-company-id')).toBe(false);
    expect(headers.has('x-mutakamel-branch-id')).toBe(false);
  }

  it('lists and counts bare CRM pages by source without scope headers', async () => {
    const page = listRecordAttachments('LEAD', BRANCH, SOURCE, 2);
    const req = http.expectOne(r => r.url === BASE + '/attachments');
    expect(req.request.params.keys().sort()).toEqual(['branchId', 'limit', 'page', 'sourceId', 'sourceType']);
    expect(req.request.params.get('branchId')).toBe(BRANCH);
    expect(req.request.params.get('sourceType')).toBe('LEAD');
    expect(req.request.params.get('sourceId')).toBe(SOURCE);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.withCredentials).toBe(true);
    noScope(req.request.headers);
    req.flush(PAGE);
    expect(await page).toEqual(PAGE);
    const count = countRecordAttachments('CUSTOMER_PROFILE', BRANCH, SOURCE);
    const countReq = http.expectOne(r => r.url === BASE + '/attachments');
    expect(countReq.request.params.get('limit')).toBe('1');
    expect(countReq.request.params.get('page')).toBe('1');
    expect(countReq.request.params.get('sourceType')).toBe('CUSTOMER_PROFILE');
    noScope(countReq.request.headers);
    countReq.flush({ ...PAGE, items: [], total: 31 });
    expect(await count).toBe(31);
  });

  it('upload body and key', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    const progress = vi.fn();
    const file = new File(['pdf'], 'offer.pdf', { type: 'application/pdf' });
    const result = uploadRecordAttachment('OPPORTUNITY', BRANCH, SOURCE, file, progress, KEY);
    const req = http.expectOne(BASE + '/attachments/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-idempotency-key')).toBe(KEY);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    noScope(req.request.headers);
    const body = req.request.body as FormData;
    expect(Array.from(body.keys()).sort()).toEqual(['branchId', 'file', 'sourceId', 'sourceType']);
    for (const name of ['branchId', 'file', 'sourceId', 'sourceType']) expect(body.getAll(name)).toHaveLength(1);
    expect(body.get('branchId')).toBe(BRANCH);
    expect(body.get('sourceType')).toBe('OPPORTUNITY');
    expect(body.get('sourceId')).toBe(SOURCE);
    expect((body.get('file') as File).name).toBe('offer.pdf');
    expect((body.get('file') as File).size).toBe(3);
    expect((body.get('file') as File).type).toBe('application/pdf');
    req.flush(ROW, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(ROW);
    expect(progress.mock.calls).toEqual([[0], [100]]);
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-record-attachments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-record-attachments'] });
  });

  it('download url', async () => {
    const url = await recordAttachmentDownloadUrl(KEY);
    expect(url).toBe(BASE + '/attachments/' + KEY + '/download');
    expect(new URL(url, window.location.href).origin).toBe(window.location.origin);
    expect(await recordAttachmentDownloadUrl('unsafe/id')).toContain('unsafe%2Fid');
    http.expectNone(r => r.url.includes('/download'));
  });

  it('sends a delete key, reuses it after ambiguous failure, and accepts 404', async () => {
    const first = deleteRecordAttachment(KEY);
    const failed = expect(first).rejects.toBeInstanceOf(ApiError);
    const req = http.expectOne(BASE + '/attachments/' + KEY);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    const key = req.request.headers.get('x-idempotency-key');
    expect(key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    noScope(req.request.headers);
    req.flush({ errorCode: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Server Error' });
    await failed;
    const retried = deleteRecordAttachment(KEY);
    const retry = http.expectOne(BASE + '/attachments/' + KEY);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    noScope(retry.request.headers);
    retry.flush({ errorCode: 'CRM_ATTACHMENT_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(retried).resolves.toBeUndefined();
  });

  it('uses real scoped session keys for permission fallbacks', () => {
    expect(canCreateRecordAttachments()).toBe(false);
    expect(canDeleteRecordAttachments()).toBe(false);
    bindAnalyticsPermissions(() => ['crm.attachments.create.own', 'crm.attachments.delete.team']);
    expect(canCreateRecordAttachments()).toBe(true);
    expect(canDeleteRecordAttachments()).toBe(true);
  });
});
