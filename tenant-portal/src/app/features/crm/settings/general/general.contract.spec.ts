import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../shared/crm-http';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import {
  getCorePhoneSummary,
  getCrmSettings,
  getGeneralPipelines,
  updateCrmSettings,
} from './general.api';
import type { CrmSettings, CrmSettingsPatch } from './general.model';

const settings = CRM_SETTINGS_FIXTURES['/settings'] as CrmSettings;
const path = '/api/tenant/crm/v1/settings';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('GeneralApi', () => {
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

  it('returns the bare CrmSettings body', async () => {
    const pending = getCrmSettings();
    http.expectOne(path).flush(settings);
    await expect(pending).resolves.toEqual(settings);
  });

  it('reads pipelines without requesting configuration', async () => {
    const pending = getGeneralPipelines();
    http.expectOne('/api/tenant/crm/v1/pipelines').flush([]);
    await expect(pending).resolves.toEqual([]);
  });

  it('retention sends days and revision together', async () => {
    const body = {
      outboundEmailContentRetentionDays: 365,
      expectedOutboundEmailRetentionPolicyRevision: 7,
    };
    const pending = updateCrmSettings(body);
    const request = http.expectOne(path);
    expect(request.request.body).toEqual(body);
    expect(request.request.method).toBe('PUT');
    request.flush({
      ...settings,
      outboundEmailContentRetentionDays: 365,
      outboundEmailRetentionPolicyRevision: 8,
    });
    await expect(pending).resolves.toMatchObject({ outboundEmailRetentionPolicyRevision: 8 });
  });

  it('every write sends a key', async () => {
    const actions: CrmSettingsPatch[] = [
      { leadsEnabled: false },
      { opportunitiesEnabled: false },
      { requireQualifiedStageForConversion: true },
      { clickToCallEnabled: false },
      { logCallsAsActivities: false },
      { outboundEmailContentRetentionDays: 365, expectedOutboundEmailRetentionPolicyRevision: 1 },
    ];
    const keys: string[] = [];
    for (const body of actions) {
      const pending = updateCrmSettings(body);
      const request = http.expectOne(path);
      const key = request.request.headers.get('x-idempotency-key')!;
      expect(key).toMatch(uuid);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('If-Match')).toBe(false);
      keys.push(key);
      request.flush(settings);
      await pending;
    }
    expect(new Set(keys).size).toBe(actions.length);
  });

  for (const status of [0, 500, 503, 409, 401]) {
    it(`reuses the key and body after ${status}`, async () => {
      const body = { logCallsAsActivities: false };
      const pending = updateCrmSettings(body);
      const caught = pending.catch((error: unknown) => error);
      const first = http.expectOne(path);
      const key = first.request.headers.get('x-idempotency-key');
      if (status === 0) first.error(new ProgressEvent('error'));
      else
        first.flush(
          { errorCode: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'FAILED' },
          { status, statusText: 'Failed' },
        );
      expect(await caught).toBeInstanceOf(ApiError);
      const retry = updateCrmSettings(body);
      const second = http.expectOne(path);
      expect(second.request.headers.get('x-idempotency-key')).toBe(key);
      expect(second.request.body).toEqual(first.request.body);
      second.flush(settings);
      await retry;
    });
  }

  it('a changed body gets a new key after an uncertain response', async () => {
    const pending = updateCrmSettings({ logCallsAsActivities: false }).catch(
      (error: unknown) => error,
    );
    const first = http.expectOne(path);
    const key = first.request.headers.get('x-idempotency-key');
    first.error(new ProgressEvent('error'));
    await pending;
    const next = updateCrmSettings({ logCallsAsActivities: true });
    const second = http.expectOne(path);
    expect(second.request.headers.get('x-idempotency-key')).not.toBe(key);
    second.flush(settings);
    await next;
  });

  for (const status of [400, 403, 409, 422, 429]) {
    it(`does not automatically retry ${status} and starts a new key on the next action`, async () => {
      const body = { clickToCallEnabled: false };
      const pending = updateCrmSettings(body).catch((error: unknown) => error);
      const first = http.expectOne(path);
      const key = first.request.headers.get('x-idempotency-key');
      first.flush(
        { errorCode: status === 409 ? 'CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE' : 'FAILED' },
        { status, statusText: 'Failed' },
      );
      expect(await pending).toBeInstanceOf(ApiError);
      http.expectNone(path);
      const next = updateCrmSettings(body);
      const second = http.expectOne(path);
      expect(second.request.headers.get('x-idempotency-key')).not.toBe(key);
      second.flush(settings);
      await next;
    });
  }

  it('passes validation field keys and a stale revision without details through', async () => {
    for (const status of [400, 409, 422, 503]) {
      const pending = updateCrmSettings({ outboundEmailContentRetentionDays: 29 }).catch(
        (error: unknown) => error,
      );
      const code =
        status === 400
          ? 'CRM_VALIDATION_FAILED'
          : status === 409
            ? 'CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE'
            : status === 422
              ? 'CRM_SETTING_INVALID'
              : 'CRM_SETTINGS_MISSING';
      const details =
        status === 400
          ? { outboundEmailContentRetentionDays: ['must not be less than 30'] }
          : undefined;
      http
        .expectOne(path)
        .flush(
          { errorCode: code, details, correlationId: 'general-proof' },
          { status, statusText: 'Failed' },
        );
      const error = await pending;
      expect(error).toMatchObject({ status, code, correlationId: 'general-proof' });
      expect(Object.keys(fieldErrorsOf(error))).toEqual(
        status === 400 ? ['outboundEmailContentRetentionDays'] : [],
      );
      if (status === 409) expect((error as ApiError).details).toBeUndefined();
    }
  });

  it('successful writes cancel and invalidate the general queries', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    const pending = updateCrmSettings({ clickToCallEnabled: false });
    http.expectOne(path).flush(settings);
    await pending;
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'general'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'general'] });
  });

  it('composes the phone summary from two Core envelopes', async () => {
    const pending = TestBed.runInInjectionContext(getCorePhoneSummary);
    http
      .expectOne('/api/tenant/webphone/v1/servers')
      .flush({ success: true, data: [{ id: 'one' }, { id: 'two' }] });
    http.expectOne('/api/tenant/webphone/v1/seats').flush({
      success: true,
      data: { allowed: 2, occupied: 3, available: 0, overAllowance: true, graceUntil: null },
    });
    await expect(pending).resolves.toEqual({
      servers: 2,
      allowed: 2,
      occupied: 3,
      available: 0,
      overAllowance: true,
    });
  });

  it('saving settings does not cancel the independent phone load', async () => {
    const phone = TestBed.runInInjectionContext(getCorePhoneSummary);
    http.expectOne('/api/tenant/webphone/v1/servers').flush({ success: true, data: [] });
    const seats = http.expectOne('/api/tenant/webphone/v1/seats');
    const saving = updateCrmSettings({ logCallsAsActivities: false });
    http.expectOne(path).flush(settings);
    await saving;
    expect(seats.cancelled).toBe(false);
    seats.flush({
      success: true,
      data: { allowed: 0, occupied: 0, available: 0, overAllowance: false },
    });
    await expect(phone).resolves.toMatchObject({ servers: 0 });
  });

  for (const [status, errorCode] of [
    [403, 'WEBPHONE_MODULE_NOT_PURCHASED'],
    [409, 'WEBPHONE_PROVISIONING_PENDING'],
    [500, 'FAILED'],
  ] as const) {
    it(`passes through the phone ${errorCode} error`, async () => {
      const pending = TestBed.runInInjectionContext(getCorePhoneSummary).catch(
        (error: unknown) => error,
      );
      http
        .expectOne('/api/tenant/webphone/v1/servers')
        .flush({ errorCode }, { status, statusText: 'Failed' });
      http.expectOne('/api/tenant/webphone/v1/seats').flush({
        success: true,
        data: { allowed: 0, occupied: 0, available: 0, overAllowance: false },
      });
      expect(await pending).toMatchObject({ status, code: errorCode });
    });
  }
});
