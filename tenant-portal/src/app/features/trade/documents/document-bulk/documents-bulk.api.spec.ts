import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { BULK_JOB_MODULES, provideBulkJobModules } from '../../../../shared/bulk-jobs/bulk-job-modules';
import { BulkJobsApi } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import type { BulkJob, BulkJobSubmit, BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { KIND_CONFIG } from '../shared/document-kinds';
import { DOCUMENT_BULK_ACTIONS, TRADE_DOCUMENT_BULK_MODULES } from './documents-bulk.descriptor';

const BASE = '/api/tenant/trade/v1/bulk-jobs';
const JOB_ID = '019a0000-0000-7000-8000-000000000010';
const DOCUMENT_ID = '019a0000-0000-7000-8000-000000000011';
const SCOPE = {
  companyId: '019a0000-0000-7000-8000-000000000001',
  branchId: '019a0000-0000-7000-8000-000000000002',
};
const RECEIPT: BulkJobSubmitResult = {
  jobId: JOB_ID, status: 'QUEUED', total: 1, skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1,
};
const JOB: BulkJob = {
  id: JOB_ID, app: 'trading', module: 'trading.quotations', action: 'PRINT', scope: SCOPE,
  status: 'RUNNING', total: 1, processed: 0,
  counts: { succeeded: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 },
  chunkCount: 1, chunksDone: 0, paramsSummary: {}, createdAt: '2026-11-24T00:00:00Z', revision: 3,
};

const ACTIONS = TRADE_DOCUMENT_BULK_MODULES.flatMap((descriptor) => {
  const kind = Object.values(KIND_CONFIG).find((config) => `trading.${config.segment}` === descriptor.module)?.kind;
  if (kind === undefined) throw new Error(`Missing document kind for ${descriptor.module}`);
  return DOCUMENT_BULK_ACTIONS[kind].map((spec) => ({ module: descriptor.module, action: spec.id, reason: spec.reasonKind }));
});

describe('Trade document jobs use the real bulk platform', () => {
  let http: HttpTestingController;
  let api: BulkJobsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), BulkJobsApi,
      provideBulkJobModules(TRADE_DOCUMENT_BULK_MODULES),
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-proof`);
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(BulkJobsApi);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('provides all four real module descriptors', () => {
    expect(TestBed.inject(BULK_JOB_MODULES).map((module) => module.module)).toEqual([
      'trading.quotations', 'trading.sales-orders', 'trading.purchase-orders', 'trading.purchase-quotations',
    ]);
  });

  it.each(ACTIONS)('submits $module $action as an asynchronous worker job', async ({ module, action, reason }) => {
    const key = newIdempotencyKey();
    const body: BulkJobSubmit = {
      module, action, scope: SCOPE, selection: { kind: 'IDS', ids: [DOCUMENT_ID] },
      params: reason ? { reasonCode: 'OWNER_MANAGED_REASON', reasonNote: 'Requested change' }
        : action === 'PRINT' ? { templateChoice: 'BUILT_IN', locale: 'en-US' } : {},
    };
    const pending = api.submitBulkJob('trading', body, key);
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: RECEIPT }, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(RECEIPT);
  });

  it('keeps QUERY selection filters in the job body', async () => {
    const body: BulkJobSubmit = {
      module: 'trading.sales-orders', action: 'HOLD', scope: SCOPE,
      selection: { kind: 'QUERY', query: { partyId: DOCUMENT_ID, status: 'CONFIRMED' }, excludedIds: [DOCUMENT_ID] },
      params: { reasonCode: 'OWNER_MANAGED_REASON' },
    };
    const pending = api.submitBulkJob('trading', body, newIdempotencyKey());
    const req = http.expectOne(BASE);
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: RECEIPT }, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(RECEIPT);
  });

  it('reads job progress and item pages without lifting the Trade page envelope', async () => {
    const pendingJob = api.getBulkJob('trading', JOB_ID);
    http.expectOne(`${BASE}/${JOB_ID}`).flush({ success: true, data: JOB });
    await expect(pendingJob).resolves.toEqual(JOB);
    const page = { items: [{ ordinal: 1, entityId: DOCUMENT_ID, label: 'QT-1', status: 'SUCCEEDED' }], total: 1, page: 1, limit: 100 };
    const pendingItems = api.listBulkJobItems('trading', JOB_ID, { page: 1, limit: 100, status: 'SUCCEEDED' });
    http.expectOne(`${BASE}/${JOB_ID}/items?page=1&limit=100&status=SUCCEEDED`).flush({ success: true, data: page });
    await expect(pendingItems).resolves.toEqual(page);
  });

  it('uses the observed revision for cancellation and retry, with an idempotency key for retry', async () => {
    const cancelling = api.cancelBulkJob('trading', JOB_ID, JOB.revision);
    await Promise.resolve();
    const cancel = http.expectOne(`${BASE}/${JOB_ID}/cancel`);
    expect(cancel.request.headers.get('If-Match')).toBe('"3"');
    expect(cancel.request.body).toEqual({});
    cancel.flush({ success: true, data: { ...JOB, status: 'CANCELLING', revision: 4 } });
    await expect(cancelling).resolves.toMatchObject({ status: 'CANCELLING', revision: 4 });

    const key = newIdempotencyKey();
    const retrying = api.retryBulkJob('trading', JOB_ID, null, key, 4);
    await Promise.resolve();
    const retry = http.expectOne(`${BASE}/${JOB_ID}/retry`);
    expect(retry.request.headers.get('If-Match')).toBe('"4"');
    expect(retry.request.headers.get('x-idempotency-key')).toBe(key);
    expect(retry.request.body).toEqual({});
    retry.flush({ success: true, data: RECEIPT }, { status: 202, statusText: 'Accepted' });
    await expect(retrying).resolves.toEqual(RECEIPT);
  });
});
