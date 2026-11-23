import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import {
  createAlert, deleteAlert, disableAlert, enableAlert, getAlert, listAlerts, listEvaluations,
  resetAlertWriteConflicts, resumeAlert, testAlert, updateAlert,
} from './alerts.api';

describe('AlertsApi transport', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  beforeEach(() => {
    bindAnalyticsPermissions(() => ['crm.alerts.manage']);
    crmQueries().clear();
    resetAlertWriteConflicts();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    const cookie = document.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${cookie}=alerts-test; Path=/`;
  });
  afterEach(() => { try { http.verify(); } finally { dispose(); bindAnalyticsPermissions(() => []); vi.restoreAllMocks(); } });

  it('reads bare cursor pages and records without organization headers', async () => {
    for (const [call, path, response] of [
      [() => listAlerts({ mine: true, state: 'SUSPENDED', cursor: 'next', limit: 20 }), '', { items: [], pageInfo: { limit: 20, hasMore: false, nextCursor: null } }],
      [() => getAlert('a'), '/a', { id: 'a', revision: 3 }],
      [() => listEvaluations('a', { cursor: 'evaluation', limit: 15 }), '/a/evaluations', { items: [], pageInfo: { limit: 15, hasMore: false, nextCursor: null } }],
    ] as const) {
      const result = call();
      const request = http.expectOne((req) => req.url === `/api/tenant/crm/v1/analytics/alerts${path}`);
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      if (path === '') expect(request.request.params.get('state')).toBe('SUSPENDED');
      request.flush(response);
      await expect(result).resolves.toEqual(response);
    }
  });

  it('sends a key on every write and the loaded token in body/query and If-Match', async () => {
    const key = newIdempotencyKey();
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    for (const [call, method, suffix] of [
      [() => createAlert({ name: 'Rule' }, key), 'POST', ''],
      [() => updateAlert('a', { revision: 3, name: 'Changed' }), 'PATCH', '/a'],
      [() => enableAlert('a', 3), 'POST', '/a/enable'],
      [() => disableAlert('a', 3), 'POST', '/a/disable'],
      [() => resumeAlert('a', 3), 'POST', '/a/resume'],
      [() => deleteAlert('a', 3), 'DELETE', '/a'],
      [() => testAlert('a'), 'POST', '/a/test'],
    ] as const) {
      const result = call();
      const request = await vi.waitFor(() => http.expectOne((req) => req.url === `/api/tenant/crm/v1/analytics/alerts${suffix}` && req.method === method));
      expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      if (suffix === '') expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      else if (suffix !== '/a/test') {
        expect(request.request.headers.get('If-Match')).toBe('"3"');
        if (method === 'DELETE') expect(request.request.params.get('revision')).toBe('3');
        else expect(request.request.body.revision).toBe(3);
      }
      request.flush(method === 'DELETE' ? null : { id: 'a', revision: 4 }, method === 'DELETE' ? { status: 204, statusText: 'No Content' } : {});
      await result;
    }
    expect(cancel).toHaveBeenCalledTimes(6);
    expect(invalidate).toHaveBeenCalledTimes(6);
    vi.restoreAllMocks();
  });
});

describe('AlertsApi retry receipts', () => {
  let dispose: () => void;
  afterEach(() => { dispose(); crmQueries().clear(); vi.restoreAllMocks(); bindAnalyticsPermissions(() => []); resetAlertWriteConflicts(); });
  for (const status of [0, 401, 503]) it(`retains the key and body after ${status}, and changes the key for changed bodies`, async () => {
    bindAnalyticsPermissions(() => ['crm.alerts.manage']);
    const stub = new CrmHttpStub();
    dispose = bindCrmHttpForTest(stub);
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(status, 'TRANSIENT'));
    const body = { revision: 3, name: 'Retry' };
    await expect(updateAlert('retry', body)).rejects.toMatchObject({ status });
    await updateAlert('retry', body);
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    expect(write.mock.calls[0][2]).toEqual(write.mock.calls[1][2]);
    await updateAlert('retry', { ...body, name: 'New body' });
    expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
  });
  it('never resends an idempotency mismatch before explicit reload', async () => {
    bindAnalyticsPermissions(() => ['crm.alerts.manage']);
    const stub = new CrmHttpStub();
    dispose = bindCrmHttpForTest(stub);
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
    const body = { revision: 4, name: 'Blocked' };
    await expect(updateAlert('mismatch', body)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    await expect(updateAlert('mismatch', body)).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    expect(write).toHaveBeenCalledTimes(1);
    resetAlertWriteConflicts();
    await updateAlert('mismatch', body);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
