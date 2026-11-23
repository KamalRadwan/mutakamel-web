import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { BulkJobsApi } from '../../../../../shared/bulk-jobs/bulk-jobs.api';
import type { BulkJobSubmit, BulkJobSubmitResult } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { AccountSelection } from './account-selection';
import {
  TRADE_ACCOUNTS_BULK_MODULE_ID,
  TRADE_ACCOUNTS_BULK_NOTE_MAX,
  TRADE_ACCOUNTS_BULK_EVIDENCE_MAX,
  type TradeAccountsBulkAction,
  type TradeAccountsBulkParams,
} from './accounts-bulk.descriptor';

const base = '/api/tenant/trade/v1/bulk-jobs';
const accountId = '019af3c0-0000-7000-8000-000000000001';
const companyId = '019af3c0-0000-7000-8000-000000000002';
const reasonCodeId = '019af3c0-0000-7000-8000-000000000003';
const accepted: BulkJobSubmitResult = {
  jobId: '019af3c0-0000-7000-8000-000000000004', status: 'QUEUED',
  total: 1, skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1,
};

function submission(action: TradeAccountsBulkAction): BulkJobSubmit {
  const params: TradeAccountsBulkParams = {
    reasonCodeId, note: 'Reviewed account',
    ...(action === 'BLOCK' ? { evidenceRef: 'INV-9' } : {}),
  };
  return {
    module: TRADE_ACCOUNTS_BULK_MODULE_ID, action, scope: { companyId },
    selection: { kind: 'IDS', ids: [accountId] }, params,
  };
}

describe('trading.commercial-accounts real HTTP contract', () => {
  let api: BulkJobsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: BulkJobsApi, useClass: BulkJobsApi },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:'
      ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);
    api = TestBed.inject(BulkJobsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it.each(['BLOCK', 'UNBLOCK'] as const)('sends %s with note and the supplied intent key', async (action) => {
    const body = submission(action);
    const key = newIdempotencyKey();
    const pending = api.submitBulkJob('trading', body, key);
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.body.params).toHaveProperty('note', 'Reviewed account');
    expect(req.request.body.params).not.toHaveProperty('reasonNote');
    expect(Object.hasOwn(req.request.body.params, 'evidenceRef')).toBe(action === 'BLOCK');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    req.flush({ success: true, data: accepted }, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(accepted);
  });

  it('sends a flat all-matching query and exclusions without resolving local accounts', async () => {
    const selection = new AccountSelection();
    selection.selectAllMatching({ accountRole: 'CUSTOMER', status: 'ACTIVE', search: '  Acme  ' }, 5);
    selection.toggle({ id: accountId, partyId: accountId, displayName: 'Acme', accountRole: 'CUSTOMER', status: 'ACTIVE' });
    const body = { ...submission('BLOCK'), selection: selection.snapshot() };
    const pending = api.submitBulkJob('trading', body, newIdempotencyKey());
    const req = http.expectOne(base);
    expect(req.request.body.selection).toEqual({
      kind: 'QUERY', query: { accountRole: 'CUSTOMER', status: 'ACTIVE', search: 'Acme' }, excludedIds: [accountId],
    });
    req.flush({ success: true, data: { ...accepted, total: 4 } });
    await expect(pending).resolves.toMatchObject({ total: 4 });
  });

  it('preserves note and evidence at the backend length limits', async () => {
    const params: TradeAccountsBulkParams = {
      reasonCodeId, note: 'n'.repeat(TRADE_ACCOUNTS_BULK_NOTE_MAX),
      evidenceRef: 'e'.repeat(TRADE_ACCOUNTS_BULK_EVIDENCE_MAX),
    };
    const pending = api.submitBulkJob('trading', { ...submission('BLOCK'), params }, newIdempotencyKey());
    const req = http.expectOne(base);
    expect(req.request.body.params).toEqual(params);
    req.flush({ success: true, data: accepted });
    await pending;
  });

  it.each([
    [400, 'BULK_JOB_PARAMS_INVALID'], [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    [403, 'TRADE.AUTH.TARGET_DENIED'], [404, 'BULK_JOB_NOT_FOUND'],
    [409, 'BULK_JOB_ACTIVE'], [409, 'TRADE.CONCURRENCY.STALE_VERSION'],
    [422, 'TRADE.REASON.NOTE_REQUIRED'], [429, 'RATE_LIMITED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [503, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ] as const)('preserves %i / %s for existing error handling without simulated success', async (status, code) => {
    const pending = api.submitBulkJob('trading', submission('BLOCK'), newIdempotencyKey());
    const rejected = expect(pending).rejects.toMatchObject({
      name: 'ApiError', status, code, details: { note: ['Review required'] }, correlationId: 'account-trace',
    });
    http.expectOne(base).flush({ errorCode: code, details: { note: ['Review required'] }, correlationId: 'account-trace' },
      { status, statusText: 'Failure' });
    await rejected;
    http.expectNone(base);
  });

  it('keeps the body and intent key on explicit retry after network failure', async () => {
    const body = submission('UNBLOCK');
    const key = newIdempotencyKey();
    const pending = api.submitBulkJob('trading', body, key);
    const rejected = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    http.expectOne(base).error(new ProgressEvent('error'));
    await rejected;
    http.expectNone(base);
    const retried = api.submitBulkJob('trading', body, key);
    const req = http.expectOne(base);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: accepted });
    await expect(retried).resolves.toEqual(accepted);
  });

  it('rejects malformed success instead of manufacturing a job', async () => {
    const pending = api.submitBulkJob('trading', submission('BLOCK'), newIdempotencyKey());
    const rejected = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne(base).flush(accepted);
    await rejected;
  });
});
