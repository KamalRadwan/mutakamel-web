import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../crm-http';
import { getCrmModules, updateCompanyModules } from './crm-modules.api';
import type { CrmModuleOverride, CrmModulesState } from './crm-modules.model';

const companyId = '01940000-0000-7000-8000-000000000001';
const path = '/api/tenant/crm/v1/settings/modules';
const companyPath = `${path}/companies/${companyId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const state: CrmModulesState & {
  calls: { clickToCallEnabled: boolean; logCallsAsActivities: boolean };
} = {
  revision: 4,
  defaults: { leadsEnabled: false, opportunitiesEnabled: true },
  companies: [
    {
      companyId,
      code: 'CO1',
      name: 'Company One',
      status: 'ACTIVE',
      override: { leadsEnabled: true, opportunitiesEnabled: null },
      effective: { leadsEnabled: true, opportunitiesEnabled: true },
    },
  ],
  calls: { clickToCallEnabled: false, logCallsAsActivities: true },
};

describe('CrmModulesApi', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const doc = TestBed.inject(DOCUMENT);
    const cookie =
      doc.location.protocol === 'https:'
        ? '__Host-mutakamel-tenant-csrf'
        : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-proof`);
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });
  afterEach(() => {
    http.verify();
    dispose();
    vi.restoreAllMocks();
  });

  it('reads the bare state including call flags without a settings permission or scope header', async () => {
    const pending = getCrmModules();
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    request.flush(state);
    await expect(pending).resolves.toEqual(state);
    http.expectNone('/api/tenant/crm/v1/settings');
  });

  it('writes nullable overrides and the revision with a UUID v7 key, CSRF and no scope', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    const patch = { leadsEnabled: null, opportunitiesEnabled: false };
    const pending = updateCompanyModules(companyId, patch, 4);
    const request = http.expectOne(companyPath);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedRevision: 4, ...patch });
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    expect(request.request.headers.has('If-Match')).toBe(false);
    request.flush(state);
    await expect(pending).resolves.toEqual(state);
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'modules'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'modules'] });
  });

  for (const status of [0, 500, 503, 409, 401]) {
    it(`keeps the same body and key on an explicit retry after ${status}`, async () => {
      const patch = { leadsEnabled: false };
      const firstResult = updateCompanyModules(companyId, patch, 4).catch(
        (error: unknown) => error,
      );
      const first = http.expectOne(companyPath);
      const key = first.request.headers.get('x-idempotency-key');
      if (status === 0) first.error(new ProgressEvent('error'));
      else
        first.flush(
          { errorCode: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'FAILED' },
          { status, statusText: 'Failed' },
        );
      expect(await firstResult).toBeInstanceOf(ApiError);
      http.expectNone(companyPath);
      const pending = updateCompanyModules(companyId, patch, 4);
      const second = http.expectOne(companyPath);
      expect(second.request.headers.get('x-idempotency-key')).toBe(key);
      expect(second.request.body).toEqual(first.request.body);
      second.flush(state);
      await pending;
    });
  }

  for (const change of ['override', 'revision'] as const) {
    it(`uses a new key when the ${change} changes after an uncertain write`, async () => {
      const pending = updateCompanyModules(companyId, { leadsEnabled: false }, 4).catch(
        (error: unknown) => error,
      );
      const first = http.expectOne(companyPath);
      const key = first.request.headers.get('x-idempotency-key');
      first.error(new ProgressEvent('error'));
      await pending;
      const next = updateCompanyModules(
        companyId,
        { leadsEnabled: change === 'override' },
        change === 'revision' ? 5 : 4,
      );
      const second = http.expectOne(companyPath);
      expect(second.request.headers.get('x-idempotency-key')).toMatch(uuid);
      expect(second.request.headers.get('x-idempotency-key')).not.toBe(key);
      second.flush(state);
      await next;
    });
  }

  for (const [status, code] of [
    [400, 'CRM_VALIDATION_FAILED'],
    [403, 'CRM_PERMISSION_DENIED'],
    [404, 'CRM_COMPANY_NOT_FOUND'],
    [409, 'CRM_MODULE_SETTINGS_STALE'],
    [409, 'GW.IDEM.MISMATCH'],
    [429, 'GW.RATE.LIMIT_EXCEEDED'],
  ] as const) {
    it(`passes ${code} through without retrying and rotates the key for the next action`, async () => {
      const patch = { leadsEnabled: true };
      const pending = updateCompanyModules(companyId, patch, 4).catch((error: unknown) => error);
      const first = http.expectOne(companyPath);
      const key = first.request.headers.get('x-idempotency-key');
      first.flush(
        {
          errorCode: code,
          details: status === 400 ? { leadsEnabled: ['Invalid value'] } : undefined,
        },
        { status, statusText: 'Failed' },
      );
      const error = await pending;
      expect(error).toMatchObject({ status, code });
      if (status === 400) expect(Object.keys(fieldErrorsOf(error))).toEqual(['leadsEnabled']);
      http.expectNone(companyPath);
      const next = updateCompanyModules(companyId, patch, 4);
      const second = http.expectOne(companyPath);
      expect(second.request.headers.get('x-idempotency-key')).not.toBe(key);
      second.flush(state);
      await next;
    });
  }

  it('starts another action with a fresh key after success', async () => {
    const keys: (string | null)[] = [];
    const patch: Partial<CrmModuleOverride> = { leadsEnabled: null };
    for (let i = 0; i < 2; i++) {
      const pending = updateCompanyModules(companyId, patch, 4);
      const request = http.expectOne(companyPath);
      keys.push(request.request.headers.get('x-idempotency-key'));
      request.flush(state);
      await pending;
    }
    expect(keys[1]).not.toBe(keys[0]);
  });
});
