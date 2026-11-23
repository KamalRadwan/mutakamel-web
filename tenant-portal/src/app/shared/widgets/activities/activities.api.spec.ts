import { DOCUMENT, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { ActivitiesApi, activitySummary, listActivities } from './activities.api';
import { resetActivitiesFake, setFakeActivitiesDelay } from './activities.fake';
import type { Activity, ActivityListParams, ActivitySummaryScope, CreateActivity } from './activities.model';

const path = '/api/tenant/core/v1';
const meta = { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
const body: CreateActivity = { target: { app: 'CRM', type: 'LEAD', id: 'lead-1' }, type: 'CALL',
  subject: 'Call back', dueAt: '2026-12-01T10:00:00.000Z' };
const activity = { id: 'activity-1', version: 3, ...body } as unknown as Activity;
const dayStart = '2026-11-23T00:00:00.000Z';
const dayEnd = '2026-11-24T00:00:00.000Z';

describe('ActivitiesApi', () => {
  let api: ActivitiesApi;
  let http: HttpTestingController;
  let cookie: string;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'user-1' }), selection: signal(null) } },
    ] });
    const document = TestBed.inject(DOCUMENT);
    cookie = `${document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`;
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(ActivitiesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  function request(route: string) {
    const found = http.expectOne((req) => req.url === path + route);
    expect(found.request.withCredentials).toBe(true);
    return found;
  }

  it('listActivities returns a CorePage', async () => {
    const result = api.listActivities({ page: 1, limit: 20, statuses: ['PLANNED', 'IN_PROGRESS'] });
    const req = request('/activities');
    expect(req.request.params.getAll('statuses')).toEqual(['PLANNED', 'IN_PROGRESS']);
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    req.flush({ success: true, data: [], meta });
    await expect(result).resolves.toEqual({ data: [], meta });
  });

  it('summary sends only summary keys', async () => {
    const scope = { statuses: ['DONE'], overdue: true, search: 'Call', types: ['CALL'] } as ActivitySummaryScope;
    const result = api.activitySummary(scope, dayStart, dayEnd);
    const req = request('/activities/summary');
    expect(req.request.params.keys().sort()).toEqual(['dayEnd', 'dayStart', 'search', 'types']);
    req.flush({ success: true, data: { byStatus: [] } });
    await result;
  });

  it('summary maps the target selector to wire keys', async () => {
    const result = api.activitySummary({ app: 'CRM', type: 'LEAD', id: 'lead-1' }, dayStart, dayEnd);
    const req = request('/activities/summary');
    expect(req.request.params.get('targetApp')).toBe('CRM');
    expect(req.request.params.get('targetType')).toBe('LEAD');
    expect(req.request.params.get('targetId')).toBe('lead-1');
    for (const key of ['app', 'type', 'id']) expect(req.request.params.has(key)).toBe(false);
    req.flush({ success: true, data: { byStatus: [] } });
    await result;
  });

  it('calendar strips due dates and uses the range', async () => {
    const result = api.listActivityCalendar({ from: dayStart, to: dayEnd, dueFrom: dayStart, dueTo: dayEnd });
    const req = request('/activities/calendar');
    expect(req.request.params.keys().sort()).toEqual(['from', 'to']);
    req.flush({ success: true, data: { items: [], truncated: false } });
    await expect(result).resolves.toEqual({ items: [], truncated: false });
  });

  it('links targets types assignees and get routes', async () => {
    const targets = api.listActivityTargets({ targetApp: 'CRM', targetType: 'LEAD', search: 'a' });
    request('/activities/targets').flush({ success: true, data: [] });
    await expect(targets).resolves.toEqual([]);
    const types = api.listActivityTypes();
    request('/activity-types').flush({ success: true, data: [{ key: 'CALL', label: 'Call' }] });
    await types;
    const assignees = api.listAssignees({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-1' });
    request('/activities/assignees').flush({ success: true, data: [] });
    await assignees;
    const get = api.getActivity('activity-1');
    request('/activities/activity-1').flush({ success: true, data: activity }, { headers: { ETag: '"3"' } });
    await expect(get).resolves.toEqual(activity);
  });

  it('writes send key CSRF and If-Match', async () => {
    const calls = [
      { route: '/activities', method: 'POST', run: () => api.createActivity(body), body },
      { route: '/activities/activity-1', method: 'PATCH', run: () => api.updateActivity('activity-1', 3, { subject: 'Changed' }), body: { subject: 'Changed' } },
      { route: '/activities/activity-1/status', method: 'POST', run: () => api.setActivityStatus('activity-1', 3, 'IN_PROGRESS'), body: { status: 'IN_PROGRESS' } },
      { route: '/activities/activity-1/complete', method: 'POST', run: () => api.completeActivity('activity-1', 3, 'Done'), body: { outcome: 'Done' } },
      { route: '/activities/activity-1/cancel', method: 'POST', run: () => api.cancelActivity('activity-1', 3, 'Later'), body: { reason: 'Later' } },
    ];
    const keys: string[] = [];
    for (const call of calls) {
      const result = call.run();
      const req = request(call.route);
      const key = req.request.headers.get('x-idempotency-key')!;
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      keys.push(key);
      expect(req.request.headers.get('x-csrf-token')).toBe('proof');
      expect(req.request.headers.get('If-Match')).toBe(call.route === '/activities' ? null : '"3"');
      expect(req.request.method).toBe(call.method);
      expect(req.request.body).toEqual(call.body);
      req.flush({ success: true, data: activity }, { status: call.route === '/activities' ? 201 : 200, statusText: 'OK' });
      await expect(result).resolves.toEqual(activity);
    }
    expect(new Set(keys).size).toBe(calls.length);
  });

  it('a missing CSRF cookie sends no write', async () => {
    cookie = '';
    await expect(api.createActivity(body)).rejects.toEqual(new ApiError(403, 'GW.AUTH.CSRF_INVALID'));
    http.expectNone((req) => req.method !== 'GET');
  });

  it('rejects a malformed success envelope', async () => {
    const result = api.listActivities();
    const rejection = expect(result).rejects.toEqual(new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
    request('/activities').flush({ data: [] });
    await rejection;
  });

  it.each([
    [400, 'CORE_VALIDATION_FAILED'], [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    [403, 'MISSING_REQUIRED_PERMISSIONS'], [404, 'ACTIVITY_NOT_FOUND'],
    [409, 'ACTIVITY_VERSION_CONFLICT'], [409, 'ACTIVITY_TERMINAL'],
    [409, 'ACTIVITY_IDEMPOTENCY_IN_FLIGHT'], [422, 'ACTIVITY_INVALID'],
    [422, 'ACTIVITY_IDEMPOTENCY_MISMATCH'], [428, 'ACTIVITY_VERSION_REQUIRED'],
    [503, 'ACCESS_POLICY_UNAVAILABLE'], [503, 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE'],
  ])('keeps HTTP status %s and code %s', async (status, errorCode) => {
    const result = api.listActivities();
    const rejection = expect(result).rejects.toMatchObject({ status, code: errorCode, correlationId: 'reference-1' });
    request('/activities').flush({ errorCode, correlationId: 'reference-1' }, { status, statusText: 'Error' });
    await rejection;
  });

  it('maps lost connection and Retry-After through CoreHttp', async () => {
    const lost = api.listActivities();
    const rejection = expect(lost).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    request('/activities').error(new ProgressEvent('error'));
    await rejection;
    const limited = api.listActivities({ search: 'other' } satisfies ActivityListParams);
    const limitRejection = expect(limited).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: ['9'] } });
    request('/activities').flush({ code: 'GW.RATE.LIMIT_EXCEEDED' }, { status: 429, statusText: 'Limited', headers: { 'Retry-After': '9' } });
    await limitRejection;
  });
});

describe('activities api', () => {
  it('CRM plain exports stay available', async () => {
    resetActivitiesFake();
    setFakeActivitiesDelay(0);
    const page = await listActivities({ limit: 1 });
    expect(page.data.length).toBeLessThanOrEqual(1);
    await expect(activitySummary({ app: 'CRM', type: 'LEAD', id: 'lead-001' }, dayStart, dayEnd)).resolves.toHaveProperty('byStatus');
    resetActivitiesFake();
  });
});
