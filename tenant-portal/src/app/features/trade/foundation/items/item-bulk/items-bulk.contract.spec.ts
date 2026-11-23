import { DOCUMENT, Injectable } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService, type TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import bulkEn from '../../../../../../../public/i18n/bulk-jobs/en.json';
import itemsEn from '../../../../../../../public/i18n/trade-items-bulk/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Notify } from '../../../../../core/notify/notify';
import { provideBulkJobModules } from '../../../../../shared/bulk-jobs/bulk-job-modules';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { bindBulkJobsApi, BulkJobsApi } from '../../../../../shared/bulk-jobs/bulk-jobs.api';
import type { BulkJob, BulkJobSelection, BulkJobSubmitResult } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { bulkErrorInfo, submitItemsBulkJob, toBulkScope, translateBulkError,
  type ItemBulkAction, type ItemBulkParamsByAction } from './item-bulk.model';
import { TRADE_ITEMS_BULK_MODULE } from './items-bulk.descriptor';

type Intent = { [A in ItemBulkAction]: { action: A; params: ItemBulkParamsByAction[A] } }[ItemBulkAction];
const companyId = '019af3c0-0000-7000-8000-000000000001';
const branchId = '019af3c0-0000-7000-8000-000000000002';
const itemId = '019af3c0-0000-7000-8000-000000000003';
const reasonCodeId = '019af3c0-0000-7000-8000-000000000004';
const jobId = '019af3c0-0000-7000-8000-000000000005';
const categoryId = '019af3c0-0000-7000-8000-000000000006';
const channelId = '019af3c0-0000-7000-8000-000000000007';
const context = { companyId, branchId };
const base = '/api/tenant/trade/v1/bulk-jobs';
const ids: BulkJobSelection = { kind: 'IDS', ids: [itemId] };
const enabled = { canSell: true, canPurchase: false, canPos: false, trackInventory: true,
  trackingMode: 'LOT', salesTaxId: null, purchaseTaxId: null } as const;
const intents: Intent[] = [
  { action: 'SET_STATUS', params: { status: 'DISCONTINUED', reasonCodeId, reasonNote: 'Owner reason' } },
  { action: 'SET_STATUS', params: { status: 'ACTIVE' } },
  { action: 'SET_CATEGORY', params: { categoryId } },
  { action: 'SET_CATEGORY', params: { categoryId: null } },
  { action: 'ENABLE_FOR_COMPANY', params: enabled },
  { action: 'ENABLE_FOR_COMPANY', params: { ...enabled, salesTaxId: categoryId, purchaseTaxId: reasonCodeId } },
  { action: 'SET_CAPABILITIES', params: { canSell: false, canPos: false } },
];
const result: BulkJobSubmitResult = { jobId, status: 'COMPLETED', total: 1,
  skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1 };
const job: BulkJob = { id: jobId, app: 'trading', module: 'trading.items', action: 'SET_STATUS',
  scope: {}, status: 'COMPLETED', total: 1, processed: 1,
  counts: { succeeded: 1, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 },
  chunkCount: 1, chunksDone: 1, paramsSummary: {}, revision: 1,
  createdAt: '2026-11-23T10:00:00.000Z', finishedAt: '2026-11-23T10:00:01.000Z' };

@Injectable()
class BulkLoader implements TranslocoLoader {
  getTranslation(path: string) { return of(path.startsWith('trade-items-bulk/') ? itemsEn : bulkEn); }
}

/** Real helper -> shared tracker -> BulkJobsApi -> CoreHttp; only HTTP responses are fixtures.
 * Backend contract: trade-items-bulk.schemas.ts and TradeItemsBulkHandler.authorizeSubmit/resolve.
 * Database-backed reason/channel validity remains authoritative on the server.
 */
describe('trading.items real HTTP contract', () => {
  let http: HttpTestingController;
  let tracker: BulkJobsTracker;
  let key: string;
  let notify: { info: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.removeItem('bulkJobs.recent');
    key = newIdempotencyKey();
    notify = { info: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: BulkJobsApi, useClass: BulkJobsApi },
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' }, loader: BulkLoader }),
      provideBulkJobModules([TRADE_ITEMS_BULK_MODULE]), { provide: Notify, useValue: notify },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);
    http = TestBed.inject(HttpTestingController);
    bindBulkJobsApi(() => TestBed.inject(BulkJobsApi));
    tracker = TestBed.inject(BulkJobsTracker);
    http.expectOne(`${base}?scope=active&page=1&limit=100`).flush({ success: true,
      data: { items: [], total: 0, page: 1, limit: 100 } });
    await tracker.ensureScopesLoaded(['bulk-jobs', 'trade-items-bulk'], TRADE_ITEMS_BULK_MODULE);
  });

  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.restoreAllMocks();
    localStorage.removeItem('bulkJobs.recent'); });

  function submit(intent: Intent, selection = ids, scope: { companyId?: string; branchId?: string } = context) {
    return submitItemsBulkJob({ ...intent, context: scope, selection, idempotencyKey: key, tracker });
  }

  async function finish(intent: Intent, status: BulkJob['status'] = 'COMPLETED') {
    const req = await vi.waitFor(() => http.expectOne(`${base}/${jobId}`));
    req.flush({ success: true, data: { ...job, action: intent.action, status,
      scope: toBulkScope(context, intent.action) } });
  }

  it.each(intents)('sends $action with its exact backend DTO: $params', async (intent) => {
    const pending = submit(intent);
    const req = await vi.waitFor(() => http.expectOne(base));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ module: 'trading.items', action: intent.action,
      scope: toBulkScope(context, intent.action), selection: ids, params: intent.params });
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: result }, { status: 202, statusText: 'Accepted' });
    await finish(intent);
    await expect(pending).resolves.toMatchObject({ jobId, finishedJob: { action: intent.action, status: 'COMPLETED' } });
  });

  it('uses tenant scope for master actions and company/branch scope for profile actions', () => {
    expect(toBulkScope(context, 'SET_STATUS')).toEqual({});
    expect(toBulkScope(context, 'SET_CATEGORY')).toEqual({});
    expect(toBulkScope(context, 'ENABLE_FOR_COMPANY')).toEqual(context);
    expect(toBulkScope(context, 'SET_CAPABILITIES')).toEqual(context);
  });

  it('sends the real QUERY DTO including POS channel, booleans, array and exclusions', async () => {
    const intent: Intent = { action: 'SET_CAPABILITIES', params: { canPos: true } };
    const selection: BulkJobSelection = { kind: 'QUERY', query: { purpose: 'POS', channelId,
      categoryIds: [categoryId], hasImage: false, includeSubcategories: true, scope: 'COMPANY',
      sort: 'canonicalCode', direction: 'asc' }, excludedIds: [itemId] };
    const pending = submit(intent, selection);
    const req = await vi.waitFor(() => http.expectOne(base));
    expect(req.request.body.selection).toEqual(selection);
    req.flush({ success: true, data: result });
    await finish(intent);
    await pending;
  });

  it.each([
    [400, 'BULK_JOB_PARAMS_INVALID'], [400, 'BULK_SELECTION_INVALID'],
    [400, 'TRADE.IDEMPOTENCY.KEY_MISSING'], [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    [403, 'TRADE.AUTH.TARGET_DENIED'], [403, 'GW.AUTH.CSRF_INVALID'],
    [404, 'TRADE.CATALOG.ITEM_NOT_FOUND'], [409, 'TRADE.CONCURRENCY.VERSION_CONFLICT'],
    [409, 'GW.IDEM.MISMATCH'], [422, 'BULK_SELECTION_TOO_LARGE'],
    [422, 'TRADE.CONTEXT.COMPANY_REQUIRED'], [422, 'TRADE.CATALOG.CHANNEL_INVALID'],
    [422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID'], [422, 'TRADE.REASON.NOT_FOUND'],
    [422, 'TRADE.REASON.INACTIVE'], [422, 'TRADE.REASON.KIND_INVALID'],
    [422, 'TRADE.REASON.NOTE_REQUIRED'], [429, 'GW.RATE.LIMIT_EXCEEDED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [503, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ] as const)('preserves server error %i %s without simulating acceptance', async (status, code) => {
    const companyAction = code === 'TRADE.CONTEXT.COMPANY_REQUIRED'
      || code === 'TRADE.CATALOG.CHANNEL_INVALID' || code === 'TRADE.CATALOG.COMPANY_PROFILE_INVALID';
    const intent: Intent = companyAction ? { action: 'SET_CAPABILITIES', params: { canPos: true } }
      : { action: 'SET_STATUS', params: { status: 'DISCONTINUED', reasonCodeId } };
    const selection: BulkJobSelection = code === 'TRADE.CATALOG.CHANNEL_INVALID'
      ? { kind: 'QUERY', query: { purpose: 'POS' }, excludedIds: [] } : ids;
    const pending = submit(intent, selection, code === 'TRADE.CONTEXT.COMPANY_REQUIRED' ? {} : context);
    const rejection = expect(pending).rejects.toMatchObject({ status, code, correlationId: 'trace-items' });
    const req = await vi.waitFor(() => http.expectOne(base));
    req.flush({ errorCode: code, details: { field: ['reasonCodeId'] }, correlationId: 'trace-items' },
      { status, statusText: 'Failure' });
    await rejection;
    expect(tracker.jobs()).toEqual([]);
    http.expectNone(base);
  });

  it('returns null only after the real tracker warns and opens an active-job conflict', async () => {
    const pending = submit({ action: 'SET_CATEGORY', params: { categoryId: null } });
    const req = await vi.waitFor(() => http.expectOne(base));
    req.flush({ errorCode: 'BULK_JOB_ACTIVE', details: { activeJobId: [jobId] } },
      { status: 409, statusText: 'Conflict' });
    await expect(pending).resolves.toBeNull();
    expect(notify.warning).toHaveBeenCalledOnce();
    expect(tracker.reportTarget()).toMatchObject({ app: 'trading', jobId });
    expect(tracker.jobs()).toEqual([]);
  });

  it('keeps a queued job pending instead of inventing item results', async () => {
    const intent: Intent = { action: 'SET_CATEGORY', params: { categoryId: null } };
    const pending = submit(intent);
    const req = await vi.waitFor(() => http.expectOne(base));
    req.flush({ success: true, data: { ...result, status: 'QUEUED' } });
    await finish(intent, 'RUNNING');
    await expect(pending).resolves.toEqual({ jobId, finishedJob: null });
    expect(tracker.jobs()[0]?.status).toBe('RUNNING');
  });

  it('propagates an ambiguous network write and reuses the supplied intent key on manual retry', async () => {
    const intent: Intent = { action: 'ENABLE_FOR_COMPANY', params: enabled };
    const pending = submit(intent);
    const rejection = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    const first = await vi.waitFor(() => http.expectOne(base));
    const body: unknown = first.request.body;
    first.error(new ProgressEvent('error'));
    await rejection;
    expect(tracker.jobs()).toEqual([]);
    http.expectNone(base);
    const retried = submit(intent);
    const second = await vi.waitFor(() => http.expectOne(base));
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    expect(second.request.body).toEqual(body);
    second.flush({ success: true, data: result });
    await finish(intent);
    await expect(retried).resolves.toMatchObject({ jobId });
  });

  it('keeps real API error details available to the existing translation resolver', () => {
    const error = new ApiError(422, 'TRADE.REASON.NOTE_REQUIRED', { field: ['reasonNote'] });
    expect(bulkErrorInfo(error)).toEqual({ status: 422, code: error.code, details: error.details });
    expect(translateBulkError(TestBed.inject(TranslocoService), error.code, error.details))
      .toBe(itemsEn.codes.TRADE_REASON_NOTE_REQUIRED);
  });
});
