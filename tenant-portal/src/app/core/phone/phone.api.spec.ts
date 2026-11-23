import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-errors';
import { CoreHttp } from '../api/core-http';
import { AuthSession } from '../auth/auth-session';
import { sessionRecoveryInterceptor } from '../auth/session-recovery.interceptor';
import { createCallLog, getMe, listCallLogs, lookupNumber, toCallLogTypeParam } from './phone.api';
import { fakeGetMe, resetPhoneFake, setFakePhoneDelay } from './phone.fake';
import { CallLogRecord, CreateCallLogInput, PhoneMeErrorAction, classifyMeError, meErrorBlock } from './phone.model';

const path = '/api/tenant/webphone/v1/me';
const input: CreateCallLogInput = {
  type: 'OUT_ANS', displayName: null, phoneNumber: '+20 100 555 0199',
  startedAt: '2026-11-22T10:00:00.000Z', answeredAt: '2026-11-22T10:00:05.000Z',
  endedAt: '2026-11-22T10:01:00.000Z', durationSeconds: 55, cause: null,
  sourceType: null, sourceId: null, sourceLabel: null,
};
const saved: CallLogRecord = {
  ...input, id: '019f0000-0000-7000-8000-000000000001', tenantId: null,
  extensionId: null, ownerId: '019f0000-0000-7000-8000-000000000002',
  createdAt: '2026-11-22T10:01:00.000Z', transferKind: null, conferenceId: null,
};

describe('phone API over the real CoreHttp transport', () => {
  let http: HttpTestingController;
  const recoverRequest = vi.fn(async () => true);

  beforeEach(() => {
    resetPhoneFake();
    setFakePhoneDelay(0);
    recoverRequest.mockReset().mockResolvedValue(false);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([sessionRecoveryInterceptor])), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { requestVersion: () => 1, recoverRequest } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    resetPhoneFake();
  });

  it('builds the type query as one comma list', () => {
    expect(toCallLogTypeParam(['IN_NOANS', 'IN_BUSY'])).toBe('IN_NOANS,IN_BUSY');
    expect(toCallLogTypeParam([])).toBeUndefined();
    expect(toCallLogTypeParam(undefined)).toBeUndefined();
  });

  it('unwraps runtime configuration once, preserves secrets/nulls, and fetches afresh', async () => {
    const me = await fakeGetMe();
    for (const data of [me, { ...me, enabled: false, reason: 'DISABLED', sipPassword: null, servers: [],
      turnCredentials: { enabled: false, iceServers: [], expiresAt: null } }]) {
      const pending = getMe();
      const request = http.expectOne(path);
      expect(request.request.method).toBe('GET');
      expect(request.request.withCredentials).toBe(true);
      request.flush({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
      await expect(pending).resolves.toEqual(data);
    }
  });

  it('always sends page=1 and reads the nested history page without readPage', async () => {
    const readPage = vi.spyOn(TestBed.inject(CoreHttp), 'readPage');
    const data = { data: [], meta: { page: 1, limit: 20, total: 0 } };
    for (const query of [undefined, {}, { page: undefined }]) {
      const pending = listCallLogs(query);
      const request = http.expectOne(`${path}/call-logs?page=1`);
      request.flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
    expect(readPage).not.toHaveBeenCalled();
  });

  it('sends only supported filters, with type as a single comma-list parameter', async () => {
    const query = { page: 3, limit: 100, type: 'IN_NOANS,IN_BUSY', from: '2026-11-01T00:00:00Z',
      to: '2026-11-23T00:00:00Z', q: '+20 100' };
    const pending = listCallLogs({ ...query, ownerId: 'never-send' } as typeof query);
    const request = http.expectOne((req) => req.url === `${path}/call-logs`);
    expect(request.request.params.keys().sort()).toEqual(Object.keys(query).sort());
    for (const [key, value] of Object.entries(query)) expect(request.request.params.getAll(key)).toEqual([String(value)]);
    const row = { ...saved, ownerName: 'Owner', phoneDigits: '201005550199' };
    const data = { data: [row], meta: { page: 3, limit: 100, total: 201 } };
    request.flush({ success: true, data });
    await expect(pending).resolves.toEqual(data);
  });

  it.each([saved, null])('accepts a raw stored row or an intentional dropped result', async (data) => {
    const pending = createCallLog(input);
    const request = http.expectOne(`${path}/call-logs`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    request.flush({ success: true, data }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(data);
  });

  it.each([401, 422, 500, 0])('never retries or replays an append after HTTP %i', async (status) => {
    if (status === 401) recoverRequest.mockResolvedValue(true);
    const pending = createCallLog(input);
    const rejected = expect(pending).rejects.toBeInstanceOf(ApiError);
    const request = http.expectOne(`${path}/call-logs`);
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({ errorCode: status === 422 ? 'CORE_VALIDATION_FAILED' : 'COMMON.GENERIC.UNAUTHORIZED' },
      { status, statusText: 'Failed' });
    await rejected;
    http.expectNone(`${path}/call-logs`);
  });

  it.each([
    { match: null, count: 0 }, { match: null, count: 2 },
    { match: { type: 'LEAD', id: saved.id, name: 'Caller' }, count: 1 },
  ])('preserves bare CRM lookup results: %j', async (data) => {
    const pending = lookupNumber('+20 100 & 555');
    const request = http.expectOne((req) => req.url === '/api/tenant/crm/v1/phone-lookup');
    expect(request.request.params.get('number')).toBe('+20 100 & 555');
    request.flush(data);
    await expect(pending).resolves.toEqual(data);
  });

  it.each<[number, string, PhoneMeErrorAction]>([
    [403, 'WEBPHONE_MODULE_NOT_PURCHASED', 'hide'], [409, 'WEBPHONE_PROVISIONING_PENDING', 'hide'],
    [403, 'WEBPHONE_MODULE_INACTIVE', 'block'], [403, 'WEBPHONE_SCOPE_MISMATCH', 'block'],
    [403, 'FORBIDDEN', 'error'], [500, 'WEBPHONE_INTERNAL_ERROR', 'error'],
    [422, 'CORE_VALIDATION_FAILED', 'error'], [409, 'WEBPHONE_EXTENSION_TAKEN', 'error'],
  ])('classifies real transport error %i %s as %s', async (status, code, action) => {
    const pending = getMe().catch((error: unknown) => error);
    http.expectOne(path).flush({ errorCode: code, details: { field: ['invalid'] }, correlationId: 'correlation' },
      { status, statusText: 'Failed' });
    const error = await pending;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, details: { field: ['invalid'] }, correlationId: 'correlation' });
    expect(classifyMeError(error)).toBe(action);
    expect(meErrorBlock(error)).toBe(code === 'WEBPHONE_MODULE_INACTIVE' ? 'suspended'
      : code === 'WEBPHONE_SCOPE_MISMATCH' ? 'scopeMismatch' : null);
  });

  it('treats network and uncoded failures as generic rather than hiding by status', async () => {
    const pending = getMe().catch((error: unknown) => error);
    http.expectOne(path).error(new ProgressEvent('error'));
    const error = await pending;
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(classifyMeError(error)).toBe('error');
    expect(classifyMeError(new ApiError(409, 'UNKNOWN'))).toBe('error');
    expect(classifyMeError(new TypeError('Failed to fetch'))).toBe('error');
  });
});
