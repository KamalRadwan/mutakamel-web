import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../../features/crm/shared/crm-http';
import { getPartyCallsSummary, listPartyCalls, toCallLogTypeParam } from './party-calls.api';

const IDENTITY = { partyType: 'LEAD' as const, partyId: '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa02' };
const BASE = '/api/tenant/crm/v1/calls';

describe('PartyCalls API', () => {
  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), CrmHttp] });
    http = TestBed.inject(HttpTestingController);
    crmQueries().clear();
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });
  afterEach(() => {
    http.verify();
    crmQueries().clear();
    dispose();
    TestBed.resetTestingModule();
  });

  function request(path: string) {
    const req = http.expectOne((value) => value.url === path);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('x-company-id')).toBe(false);
    expect(req.request.headers.has('x-branch-id')).toBe(false);
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    return req;
  }

  it('lists calls', async () => {
    const query = { ...IDENTITY, page: 2, limit: 50, type: toCallLogTypeParam(['IN_NOANS', 'IN_BUSY']),
      from: '2026-11-01T00:00:00Z', to: '2026-11-23T23:59:59Z', q: 'Amal' };
    const pending = listPartyCalls(query);
    const req = request(BASE);
    for (const [key, value] of Object.entries(query)) expect(req.request.params.get(key)).toBe(String(value));
    expect(req.request.params.keys().sort()).toEqual(Object.keys(query).sort());
    const response = { data: [], meta: { page: 2, limit: 50, total: 71 } };
    req.flush(response);
    expect(await pending).toEqual(response);

    const next = listPartyCalls({ ...IDENTITY, page: 3, limit: 50 });
    const nextReq = request(BASE);
    expect(nextReq.request.params.has('type')).toBe(false);
    expect(nextReq.request.params.get('page')).toBe('3');
    nextReq.flush({ data: [], meta: { page: 3, limit: 50, total: 71 } });
    await next;
  });

  it('summary', async () => {
    const pending = getPartyCallsSummary(IDENTITY);
    const req = request(BASE + '/summary');
    expect(req.request.params.keys().sort()).toEqual(['partyId', 'partyType']);
    const response = { total: 21, missed: 3, lastCallAt: '2026-11-23T10:45:00Z' };
    req.flush(response);
    expect(await pending).toEqual(response);
  });

  it.each(['list', 'summary'] as const)('preserves plain 404: %s', async (kind) => {
    const pending = kind === 'list' ? listPartyCalls(IDENTITY) : getPartyCallsSummary(IDENTITY);
    const rejected = expect(pending).rejects.toMatchObject({ status: 404, code: 'COMMON.GENERIC.NOT_FOUND' });
    request(BASE + (kind === 'summary' ? '/summary' : '')).flush(
      { statusCode: 404, message: 'CRM record not found', error: 'Not Found' }, { status: 404, statusText: 'Not Found' },
    );
    await rejected;
  });

  it.each([0, 400, 401, 403, 429, 500])('preserves read failure %s without automatic retry', async (status) => {
    const pending = listPartyCalls(IDENTITY);
    const rejected = expect(pending).rejects.toBeInstanceOf(ApiError);
    const req = request(BASE);
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({ correlationId: 'call-request', errorCode: 'CRM_TEST_ERROR' }, { status, statusText: 'Error' });
    await rejected;
    http.expectNone((value) => value.url === BASE);
  });
});
