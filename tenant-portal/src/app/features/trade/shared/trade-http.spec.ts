import { APP_INITIALIZER, DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../core/api/core-http';
import { ApiError as CoreApiError } from '../../../core/api/api-errors';
import { ApiError, newIdempotencyKey } from './trade-api';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeCore, tradeHttp, tradeQueries } from './trade-http';
import { TradeCoreStub, TradeHttpStub } from './testing/trade-http-testing';

const base = '/api/tenant/trade/v1';
const scope = { companyId: 'company-a', branchId: 'branch-a' };
const envelope = (data: unknown) => ({ success: true, data, correlationId: 'corr', timestamp: '2026-11-23' });

describe('TradeHttp', () => {
  let api: TradeHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    api = TestBed.inject(TradeHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('read unwraps under /api/tenant/trade/v1', async () => {
    const page = { items: [{ id: 'one' }], total: 1, page: 1, limit: 20 };
    const pending = api.read('/items', { page: 1, limit: 20, active: false, ids: ['a', 'b'] });
    const request = http.expectOne(`${base}/items?page=1&limit=20&active=false&ids=a&ids=b`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(envelope(page));
    await expect(pending).resolves.toEqual(page);
  });

  it('read unwraps the trade envelope', async () => {
    const pending = api.read('/items/one');
    http.expectOne(`${base}/items/one`).flush(envelope({ id: 'one' }));
    await expect(pending).resolves.toEqual({ id: 'one' });
  });

  it('read forwards scope headers', async () => {
    const pending = api.read('/items', undefined, { scope });
    const request = http.expectOne(`${base}/items`);
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe(scope.companyId);
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(scope.branchId);
    request.flush(envelope([]));
    await pending;
  });

  it('read stays header-free by default', async () => {
    for (const options of [undefined, {}, { scope: {} }]) {
      const pending = api.read('/categories', undefined, options);
      const request = http.expectOne(`${base}/categories`);
      expect(request.request.headers.keys()).toEqual([]);
      request.flush(envelope([]));
      await pending;
    }
  });

  it('blob read forwards scope', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const pending = api.readBlob('/artifacts/one', { download: true }, { scope });
    const request = http.expectOne(`${base}/artifacts/one?download=true`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe(scope.companyId);
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(scope.branchId);
    request.flush(blob);
    await expect(pending).resolves.toBe(blob);
  });

  it('write forwards key, If-Match, scope and query', async () => {
    const key = newIdempotencyKey();
    const body = { name: 'One' };
    const pending = api.write('PATCH', '/items/one', body, { key, ifMatch: 'W/"3"', scope, query: { validate: true } });
    const request = http.expectOne(`${base}/items/one?validate=true`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.get('If-Match')).toBe('W/"3"');
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe(scope.companyId);
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(scope.branchId);
    request.flush(envelope({ id: 'one' }));
    await pending;
  });

  it('write unwraps data and keeps the ETag', async () => {
    const pending = api.write('POST', '/items', {}, { key: newIdempotencyKey() });
    const request = http.expectOne(`${base}/items`);
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    request.flush(envelope({ id: 'one', version: 4 }), {
      status: 201, statusText: 'Created', headers: { ETag: '"4"', Location: '/items/one', 'Idempotency-Replayed': 'true' },
    });
    await expect(pending).resolves.toEqual({ status: 201, data: { id: 'one', version: 4 }, etag: '"4"', location: '/items/one' });
  });

  it('a body without success is a 502', async () => {
    for (const write of [false, true]) {
      const pending = write ? api.write('PUT', '/items/one', {}, { key: newIdempotencyKey() }) : api.read('/items/one');
      const rejection = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
      http.expectOne(`${base}/items/one`).flush({ data: { id: 'one' } });
      await rejection;
      await expect(pending).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('write without a key fails before any request', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      await expect(api.write(method, '/items', {}, { key: '' })).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });
    }
    await expect(api.writeMultipart('/image', new FormData(), { key: '' })).rejects.toBeInstanceOf(ApiError);
    http.expectNone(() => true);
  });

  it('write without body sends noBody', async () => {
    const core = TestBed.inject(CoreHttp);
    const spy = vi.spyOn(core, 'write');
    const key = newIdempotencyKey();
    const pending = api.write('DELETE', '/items/one', undefined, { key });
    const request = http.expectOne(`${base}/items/one`);
    expect(spy).toHaveBeenCalledWith('DELETE', `${base}/items/one`, undefined,
      { key, ifMatch: undefined, scope: undefined, query: undefined, noBody: true });
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toEqual({ status: 204, data: undefined, etag: null, location: null });
  });

  it('multipart posts the form with a key', async () => {
    const form = new FormData();
    form.append('image', new Blob(['image']), 'item.png');
    const key = newIdempotencyKey();
    const pending = api.writeMultipart('/items/one/image', form, { key, scope });
    const request = http.expectOne(`${base}/items/one/image`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(form);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-mutakamel-company-id')).toBe(scope.companyId);
    expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(scope.branchId);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush(envelope({ imageId: 'one' }));
    await expect(pending).resolves.toMatchObject({ data: { imageId: 'one' } });
  });

  it('maps core errors to trade errors with details and correlation id', async () => {
    const pending = api.read('/items');
    const rejection = expect(pending).rejects.toMatchObject({
      status: 400, code: 'TRADE.VALIDATION_FAILED', details: { name: ['Required'], quantity: ['3'] }, correlationId: 'corr-trade',
    });
    http.expectOne(`${base}/items`).flush({ success: false, errorCode: 'TRADE.VALIDATION_FAILED',
      details: { name: 'Required', quantity: [3] }, correlationId: 'corr-trade' }, { status: 400, statusText: 'Bad Request' });
    await rejection;
    await expect(pending).rejects.toBeInstanceOf(ApiError);
  });

  it('maps core errors from every method', async () => {
    const core = TestBed.inject(CoreHttp);
    const error = new CoreApiError(403, 'FORBIDDEN', undefined, { correlationId: 'denied' });
    vi.spyOn(core, 'readBlob').mockRejectedValue(error);
    vi.spyOn(core, 'write').mockRejectedValue(error);
    for (const pending of [api.readBlob('/pdf'), api.write('PATCH', '/items/one', {}, { key: newIdempotencyKey() }),
      api.writeMultipart('/image', new FormData(), { key: newIdempotencyKey() })]) {
      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status: 403, correlationId: 'denied' });
    }
  });

  it('non-api errors pass through', async () => {
    const core = TestBed.inject(CoreHttp);
    const error = new Error('aborted');
    vi.spyOn(core, 'read').mockRejectedValue(error);
    vi.spyOn(core, 'readBlob').mockRejectedValue(error);
    vi.spyOn(core, 'write').mockRejectedValue(error);
    for (const pending of [api.read('/items'), api.readBlob('/pdf'),
      api.write('PATCH', '/items/one', {}, { key: newIdempotencyKey() }),
      api.writeMultipart('/image', new FormData(), { key: newIdempotencyKey() })]) {
      await expect(pending).rejects.toBe(error);
    }
  });

  it('omitted test transports remain unbound instead of installing default responses', () => {
    const restore = bindTradeHttpForTest();
    try {
      expect(() => tradeHttp()).toThrow('TradeHttp is not bound');
      expect(() => tradeCore()).toThrow('Trade CoreHttp is not bound');
    } finally { restore(); }
  });

  it('bindTradeHttpForTest restores the previous binding', () => {
    bindTradeHttp(api, tradeQueries(), TestBed.inject(CoreHttp));
    const previous = { http: tradeHttp(), core: tradeCore(), queries: tradeQueries() };
    const stub = new TradeHttpStub();
    const core = new TradeCoreStub();
    const restore = bindTradeHttpForTest(stub, core);
    try {
      expect(tradeHttp()).toBe(stub);
      expect(tradeCore()).toBe(core);
      const outerQueries = tradeQueries();
      const custom = new QueryClient();
      bindTradeHttp(stub, custom, core);
      const restoreNested = bindTradeHttpForTest();
      expect(tradeQueries()).toBe(outerQueries);
      restoreNested();
      expect(tradeQueries()).toBe(custom);
    } finally { restore(); }
    expect(tradeHttp()).toBe(previous.http);
    expect(tradeCore()).toBe(previous.core);
    expect(tradeQueries()).toBe(previous.queries);
  });

  it('tradeCore returns the bound core http', () => {
    const restore = bindTradeHttpForTest();
    try {
      bindTradeHttp(api, tradeQueries(), TestBed.inject(CoreHttp));
      expect(tradeCore()).toBe(TestBed.inject(CoreHttp));
    } finally { restore(); }
  });

  it('query client defaults match CRM and caches are independent', async () => {
    const { crmQueries } = await import('../../crm/shared/crm-http');
    const defaults = tradeQueries().getDefaultOptions();
    expect(defaults.queries).toEqual({ retry: false, gcTime: 0, networkMode: 'always' });
    expect(defaults.mutations).toEqual({ retry: false, gcTime: 0, networkMode: 'always' });
    expect(tradeQueries()).not.toBe(crmQueries());
    tradeQueries().setQueryData(['transport-cache'], 'trade');
    expect(crmQueries().getQueryData(['transport-cache'])).toBeUndefined();
  });
});

describe('Trade test-setup', () => {
  const leakedStub = new TradeHttpStub({ 'GET /items': [] });
  const leakedCore = new TradeCoreStub({ 'GET /parties': [] });
  const leakedQueries = new QueryClient();

  it('leaves custom recordings and cache for reset', async () => {
    bindTradeHttp(leakedStub, leakedQueries, leakedCore);
    await tradeHttp().read('/items');
    await tradeCore().read('/parties');
    leakedStub.register('POST', '/items', { id: 'one' });
    await tradeHttp().write('POST', '/items', {}, { key: newIdempotencyKey() });
    tradeQueries().setQueryData(['trade-leaked'], 'cached');
    expect(leakedStub.recordedWrites()).toHaveLength(1);
  });

  it('resets current and default Trade and Core stubs and query caches', () => {
    expect(tradeHttp()).not.toBe(leakedStub);
    expect(tradeCore()).not.toBe(leakedCore);
    for (const stub of [leakedStub, leakedCore, tradeHttp() as TradeHttpStub, tradeCore() as TradeCoreStub]) {
      expect(stub.recordedReads()).toEqual([]);
      expect(stub.recordedWrites()).toEqual([]);
    }
    expect(leakedQueries.getQueryCache().getAll()).toEqual([]);
    expect(tradeQueries().getQueryCache().getAll()).toEqual([]);
  });
});

describe('appConfig', () => {
  it('binds TradeHttp', async () => {
    const { appConfig } = await import('../../../app.config');
    const { crmHttp } = await import('../../crm/shared/crm-http');
    const { CrmHttp } = await import('../../crm/shared/crm-http');
    const restore = bindTradeHttpForTest();
    try {
      TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
      const initializers = TestBed.inject(APP_INITIALIZER).filter((initializer) => initializer.toString().includes('bindTradeHttp'));
      expect(initializers).toHaveLength(1);
      TestBed.runInInjectionContext(() => initializers[0]());
      expect(tradeHttp()).toBe(TestBed.inject(TradeHttp));
      expect(tradeCore()).toBe(TestBed.inject(CoreHttp));
      expect(crmHttp()).toBe(TestBed.inject(CrmHttp));
    } finally { restore(); }
  });
});

describe('TradeHttpStub', () => {
  it('records calls and resets', async () => {
    const stub = new TradeHttpStub({ 'GET /items/:id': { id: 'pattern' }, 'GET /items/one': { id: 'one' } });
    stub.register('PATCH', '/items/:id', { id: 'one', version: 2 });
    const query = { limit: 20 };
    await expect(stub.read('/items/one', query, { scope })).resolves.toEqual({ id: 'one' });
    await expect(stub.read('/items/two')).resolves.toEqual({ id: 'pattern' });
    const key = newIdempotencyKey();
    const body = { name: 'One' };
    await expect(stub.write('PATCH', '/items/one', body, { key, ifMatch: '"1"', scope, query }))
      .resolves.toMatchObject({ status: 200, data: { id: 'one', version: 2 } });
    body.name = 'Changed';
    query.limit = 50;
    expect(stub.recordedReads()[0]).toEqual({ path: '/items/one', query: { limit: 20 }, scope });
    expect(stub.recordedWrites()).toEqual([{ method: 'PATCH', path: '/items/one', body: { name: 'One' }, key,
      ifMatch: '"1"', scope, query: { limit: 20 } }]);
    stub.reset();
    expect(stub.recordedReads()).toEqual([]);
    expect(stub.recordedWrites()).toEqual([]);
    await expect(stub.read('/items/one')).resolves.toEqual({ id: 'one' });
  });

  it('unknown call throws', async () => {
    const stub = new TradeHttpStub({ 'GET /items/:id': {} });
    await expect(stub.read('/items')).rejects.toThrow('TradeHttpStub: no fixture for GET /items');
    await expect(stub.read('/items/one/extra')).rejects.toThrow('TradeHttpStub: no fixture for GET /items/one/extra');
    await expect(stub.write('POST', '/items/one', {}, { key: newIdempotencyKey() }))
      .rejects.toThrow('TradeHttpStub: no fixture for POST /items/one');
  });

  it('records blobs, multipart and fixture errors', async () => {
    const stub = new TradeHttpStub();
    stub.register('GET', '/pdf', new Blob(['pdf'], { type: 'application/pdf' }));
    const blob = await stub.readBlob('/pdf', { download: true }, { scope });
    expect(blob.size).toBe(3);
    expect(blob.type).toBe('application/pdf');
    expect(stub.recordedReads()).toEqual([{ path: '/pdf', query: { download: true }, scope }]);
    stub.register('POST', '/image', { id: 'image' });
    const form = new FormData();
    form.append('name', 'one');
    await stub.writeMultipart('/image', form, { key: newIdempotencyKey(), scope });
    form.set('name', 'changed');
    expect((stub.recordedWrites()[0].body as FormData).get('name')).toBe('one');
    const error = new ApiError(422, 'TRADE.VALIDATION_FAILED', { name: ['Required'] });
    stub.register('GET', '/denied', error);
    await expect(stub.read('/denied')).rejects.toBe(error);
    await expect(stub.write('POST', '/image', {}, { key: '' })).rejects.toBeInstanceOf(ApiError);
    expect(stub.recordedWrites()).toHaveLength(1);
  });

  it('TradeCoreStub preserves Core pages and records external paths', async () => {
    const page = { data: [{ id: 'party' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false } };
    const stub = new TradeCoreStub({ 'GET /api/tenant/core/v1/directory/parties': page });
    await expect(stub.readPage('/api/tenant/core/v1/directory/parties', { page: 1 }, { scope })).resolves.toEqual(page);
    expect(stub.recordedReads()).toEqual([{ path: '/api/tenant/core/v1/directory/parties', query: { page: 1 }, scope }]);
  });
});
