import { DOCUMENT, Injectable } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService, type TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../public/i18n/bulk-jobs/en.json';
import ar from '../../../../public/i18n/bulk-jobs/ar.json';
import { ApiError } from '../../core/api/api-errors';
import { newIdempotencyKey } from '../../core/api/idempotency';
import { Notify } from '../../core/notify/notify';
import { provideBulkJobModules } from './bulk-job-modules';
import { BulkJobsTracker } from './bulk-jobs-tracker';
import {
  bindBulkJobsApi, BulkJobsApi, cancelBulkJob, getBulkJob, listBulkJobItems, listBulkJobs, retryBulkJob, submitBulkJob,
} from './bulk-jobs.api';
import { fakeBulkJobsTransport } from './bulk-jobs.fake';
import type { BulkJob, BulkJobItem, BulkJobSubmit, BulkJobSubmitResult } from './bulk-jobs.model';

const job: BulkJob = {
  id: '019af3c0-0000-7000-8000-000000000001', app: 'core', module: 'core.users', action: 'STATUS', scope: {},
  status: 'RUNNING', total: 1, processed: 0,
  counts: { succeeded: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 },
  chunkCount: 1, chunksDone: 0, paramsSummary: {}, createdAt: '2026-11-23T10:00:00.000Z', revision: 1,
};
const body: BulkJobSubmit = {
  module: job.module, action: job.action, scope: {}, selection: { kind: 'IDS', ids: ['user-1'] }, params: { status: 'ACTIVE' },
};
const submitted: BulkJobSubmitResult = {
  jobId: job.id, status: 'QUEUED', total: 1, skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1,
};
const item: BulkJobItem = { ordinal: 1, entityId: 'user-1', label: 'User', status: 'FAILED', code: 'FORBIDDEN' };
const meta = { page: 2, limit: 50, total: 51, totalPages: 2, hasNext: false, hasPrev: true };

@Injectable()
class BulkLoader implements TranslocoLoader {
  getTranslation(path: string) { return of(path === 'bulk-jobs/ar' ? ar : en); }
}

describe.each(['core', 'crm'] as const)('BulkJobsApi: %s HTTP', (app) => {
  const base = `/api/tenant/${app}/v1/bulk-jobs`;
  const wire = <T extends object>(data: T) => app === 'core' ? { success: true, data } : data;
  const pageWire = (items: unknown[], pageMeta = meta) => app === 'core'
    ? { success: true, data: items, meta: pageMeta }
    : { items, total: pageMeta.total, page: pageMeta.page, limit: pageMeta.limit };
  let http: HttpTestingController;
  let notify: { warning: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    notify = { warning: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: BulkJobsApi, useClass: BulkJobsApi },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en' }, loader: BulkLoader }),
      provideBulkJobModules([{ app, module: body.module, i18nScopes: [], actions: {}, codeKeyPrefixes: [] }]),
      { provide: Notify, useValue: notify },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    http = TestBed.inject(HttpTestingController);
    bindBulkJobsApi(() => TestBed.inject(BulkJobsApi));
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); localStorage.removeItem('bulkJobs.recent'); });

  it('submits the exact body and supplied UUID v7 key, unwrapping the app envelope', async () => {
    const key = newIdempotencyKey();
    const pending = submitBulkJob(app, body, key);
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.withCredentials).toBe(true);
    req.flush(wire(submitted), { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(submitted);
  });

  it('gets a job without a body or idempotency header', async () => {
    const pending = getBulkJob(app, job.id);
    const req = http.expectOne(`${base}/${job.id}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush(wire({ ...job, app }));
    await expect(pending).resolves.toEqual({ ...job, app });
  });

  it('maps a list page while keeping every query parameter', async () => {
    const pending = listBulkJobs(app, { scope: 'recent', module: body.module, page: 2, limit: 50 });
    const req = http.expectOne(`${base}?scope=recent&module=core.users&page=2&limit=50`);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush(pageWire([{ ...job, app }]));
    await expect(pending).resolves.toEqual({ items: [{ ...job, app }], total: 51, page: 2, limit: 50 });
  });

  it('maps an items page and sends the single status filter', async () => {
    const pending = listBulkJobItems(app, job.id, { page: 2, limit: 50, status: 'FAILED' });
    const req = http.expectOne(`${base}/${job.id}/items?page=2&limit=50&status=FAILED`);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush(pageWire([item]));
    await expect(pending).resolves.toEqual({ items: [item], total: 51, page: 2, limit: 50 });
  });

  it('cancels with an empty body and no reserved key', async () => {
    const pending = cancelBulkJob(app, job.id);
    const req = http.expectOne(`${base}/${job.id}/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush(wire({ ...job, app, status: 'CANCELLING' }));
    await expect(pending).resolves.toMatchObject({ app, status: 'CANCELLING' });
  });

  it.each([null, { startAt: '2026-11-24T10:00:00.000Z' }])('retries with optional overrides %j and the supplied key', async (overrides) => {
    const key = newIdempotencyKey();
    const pending = retryBulkJob(app, job.id, overrides, key);
    const req = http.expectOne(`${base}/${job.id}/retry`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(overrides === null ? {} : { overrides });
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush(wire(submitted), { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual(submitted);
  });

  it.each([0, 100])('preserves a page with %i items', async (count) => {
    const items = Array.from({ length: count }, (_, i) => ({ ...item, ordinal: i + 1 }));
    const pending = listBulkJobItems(app, job.id, { page: 1, limit: 100 });
    http.expectOne(`${base}/${job.id}/items?page=1&limit=100`).flush(pageWire(items,
      { page: 1, limit: 100, total: count, totalPages: count ? 1 : 0, hasNext: false, hasPrev: false }));
    await expect(pending).resolves.toEqual({ items, page: 1, limit: 100, total: count });
  });

  it.each([
    [400, { code: 'GW.IDEM.MISSING', errors: { key: ['required'] } }, 'GW.IDEM.MISSING'],
    [400, { errorCode: 'BULK_JOB_PARAMS_INVALID', details: { params: ['invalid'] } }, 'BULK_JOB_PARAMS_INVALID'],
    [401, {}, 'COMMON.GENERIC.UNAUTHORIZED'], [403, {}, 'COMMON.GENERIC.FORBIDDEN'],
    [404, { errorCode: 'BULK_JOB_NOT_FOUND' }, 'BULK_JOB_NOT_FOUND'],
    [500, {}, 'COMMON.GENERIC.INTERNAL_ERROR'], [503, {}, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ] as const)('turns %i into ApiError without transport retry', async (status, response, code) => {
    const pending = submitBulkJob(app, body, newIdempotencyKey());
    const rejection = expect(pending).rejects.toMatchObject({ name: 'ApiError', status, code, correlationId: 'trace-1' });
    http.expectOne(base).flush({ ...response, correlationId: 'trace-1' }, { status, statusText: 'Failure' });
    await rejection;
    http.expectNone(base);
  });

  it('reuses the key on manual network retry, then uses a new key for a new intent', async () => {
    const key = newIdempotencyKey();
    const pending = submitBulkJob(app, body, key);
    const rejection = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    http.expectOne(base).error(new ProgressEvent('error'));
    await rejection;
    http.expectNone(base);
    for (const nextKey of [key, newIdempotencyKey()]) {
      const retried = submitBulkJob(app, body, nextKey);
      const req = http.expectOne(base);
      expect(req.request.headers.get('x-idempotency-key')).toBe(nextKey);
      expect(req.request.body).toEqual(body);
      req.flush(wire(submitted));
      await retried;
    }
  });

  it('passes a real HTTP active conflict to the existing tracker handler', async () => {
    localStorage.removeItem('bulkJobs.recent');
    const tracker = TestBed.inject(BulkJobsTracker);
    http.expectOne(`${base}?scope=active&page=1&limit=100`)
      .flush(pageWire([], { ...meta, page: 1, total: 0, totalPages: 0, hasPrev: false }));
    const pending = tracker.submit(app, body);
    const rejection = expect(pending).rejects.toBeInstanceOf(ApiError);
    await vi.waitFor(() => {
      http.expectOne(base).flush({ errorCode: 'BULK_JOB_ACTIVE', details: { activeJobId: [job.id] } },
        { status: 409, statusText: 'Conflict' });
    });
    await rejection;
    expect(tracker.reportTarget()).toMatchObject({ app, jobId: job.id });
    expect(notify.warning).toHaveBeenCalledWith(en.toast.active);
  });

  it.each(['en', 'ar'] as const)('maps service, gateway, and server errors to existing %s bulk texts', async (lang) => {
    const t = TestBed.inject(TranslocoService);
    t.setActiveLang(lang);
    const tracker = TestBed.inject(BulkJobsTracker);
    http.expectOne(`${base}?scope=active&page=1&limit=100`)
      .flush(pageWire([], { ...meta, page: 1, total: 0, totalPages: 0, hasPrev: false }));
    await tracker.ensureScopesForModule(body.module);
    const messages = lang === 'en' ? en : ar;
    for (const code of ['BULK_JOB_PARAMS_INVALID', 'BULK_JOB_NOT_FOUND'] as const) {
      expect(tracker.reasonText(code, null)).toBe(messages.codes[code]);
    }
    for (const code of ['GW.IDEM.MISSING', 'GW.IDEM.BAD_VALUE', 'GW.IDEM.IN_FLIGHT', 'GW.IDEM.MISMATCH', 'COMMON.GENERIC.INTERNAL_ERROR']) {
      expect(tracker.reasonText(code, null)).toBe(messages.codes.generic);
    }
  });
});

describe('BulkJobsApi: missing gateway routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: BulkJobsApi, useClass: BulkJobsApi },
    ] });
    bindBulkJobsApi(() => TestBed.inject(BulkJobsApi));
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.restoreAllMocks(); });

  it.each(['accounting', 'trading'] as const)('%s keeps all six calls on the fake', async (app) => {
    vi.spyOn(fakeBulkJobsTransport, 'submitBulkJob').mockResolvedValue(submitted);
    vi.spyOn(fakeBulkJobsTransport, 'getBulkJob').mockResolvedValue(job);
    vi.spyOn(fakeBulkJobsTransport, 'listBulkJobItems').mockResolvedValue({ items: [item], total: 1, page: 1, limit: 50 });
    vi.spyOn(fakeBulkJobsTransport, 'listBulkJobs').mockResolvedValue({ items: [job], total: 1, page: 1, limit: 50 });
    vi.spyOn(fakeBulkJobsTransport, 'cancelBulkJob').mockResolvedValue(job);
    vi.spyOn(fakeBulkJobsTransport, 'retryBulkJob').mockResolvedValue(submitted);
    const key = newIdempotencyKey();
    await expect(submitBulkJob(app, body, key)).resolves.toEqual(submitted);
    await expect(getBulkJob(app, job.id)).resolves.toEqual(job);
    const itemsQuery = { page: 1, limit: 50 };
    await expect(listBulkJobItems(app, job.id, itemsQuery)).resolves.toMatchObject({ items: [item] });
    const jobsQuery = { scope: 'active' as const };
    await expect(listBulkJobs(app, jobsQuery)).resolves.toMatchObject({ items: [job] });
    await expect(cancelBulkJob(app, job.id)).resolves.toEqual(job);
    await expect(retryBulkJob(app, job.id, null, key)).resolves.toEqual(submitted);
    expect(fakeBulkJobsTransport.submitBulkJob).toHaveBeenCalledWith(app, body, key);
    expect(fakeBulkJobsTransport.getBulkJob).toHaveBeenCalledWith(app, job.id);
    expect(fakeBulkJobsTransport.listBulkJobItems).toHaveBeenCalledWith(app, job.id, itemsQuery);
    expect(fakeBulkJobsTransport.listBulkJobs).toHaveBeenCalledWith(app, jobsQuery);
    expect(fakeBulkJobsTransport.cancelBulkJob).toHaveBeenCalledWith(app, job.id);
    expect(fakeBulkJobsTransport.retryBulkJob).toHaveBeenCalledWith(app, job.id, null, key);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
