import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatesApi } from './updates.api';
import { ApplyUpdatesBody, OperationDetailResponse } from './updates.model';

const path = '/api/v1/core/tenant/provisioning';
const meta = { page: 2, limit: 25, total: 26, totalPages: 2, hasNext: false, hasPrev: true };
const operation: OperationDetailResponse = {
  id: '01934b10-0000-7000-8000-000000000101', type: 'UPDATE', status: 'WAITING_RETRY',
  currentPhase: 'AWAITING_PREREQUISITES', requestedAt: '2026-11-23T00:00:00Z',
  updatedAt: '2026-11-23T00:00:00Z', completedAt: null,
  safeError: { code: 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE', message: null },
  progress: { totalSteps: 1, completedSteps: 0, failedSteps: 0, percent: 0 },
  steps: [{ id: 'step', componentKey: null, stepKey: 'verify', status: 'PENDING',
    fromVersion: null, targetVersion: null, safeError: { code: null, message: null } }],
};
const body: ApplyUpdatesBody = { selections: [{
  componentKey: 'crm.core', targetReleaseId: '01934b10-0000-7000-8000-000000000102',
  targetReleaseVersion: '2.0', targetManifestChecksum: 'a'.repeat(64),
  currentAppliedReleaseId: '01934b10-0000-7000-8000-000000000103',
  currentAppliedManifestChecksum: 'b'.repeat(64),
}] };

describe('UpdatesApi HTTP contract', () => {
  let api: UpdatesApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=proof`);
    api = TestBed.inject(UpdatesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('reads CorePage and serializes false filters without company or branch scope', async () => {
    const pending = api.listUpdates({ page: 2, limit: 25, sortBy: 'publishedAt', sortDir: 'DESC',
      componentKey: 'crm.core', requiresBackup: false, requiresMaintenance: false });
    const req = http.expectOne((r) => r.url === `${path}/updates`);
    expect(req.request.params.get('requiresBackup')).toBe('false');
    expect(req.request.params.get('requiresMaintenance')).toBe('false');
    expect(req.request.params.get('componentKey')).toBe('crm.core');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.keys()).toEqual([]);
    req.flush({ success: true, data: [], meta });
    await expect(pending).resolves.toEqual({ data: [], meta });
  });

  it('does not invent page extras dropped by the envelope', async () => {
    const pending = api.listUpdates({ page: 1, limit: 25, sortBy: 'componentKey', sortDir: 'ASC' });
    http.expectOne((r) => r.url === `${path}/updates`).flush({ success: true, data: [], meta });
    const result = await pending;
    expect(result).not.toHaveProperty('checkedAt');
    expect(result.meta).not.toHaveProperty('adminManagedPending');
  });

  it('preserves all six selection fields and the same key on a 202 replay', async () => {
    const key = '01934b10-0000-7000-8000-000000000104';
    for (const replayed of [false, true]) {
      const pending = api.applyUpdates(body, key);
      const req = http.expectOne(`${path}/updates/apply`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      expect(Object.keys(req.request.body.selections[0])).toHaveLength(6);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      expect(req.request.headers.get('x-csrf-token')).toBe('proof');
      expect(req.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(req.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      req.flush({ success: true, data: { replayed, operation } }, { status: 202, statusText: 'Accepted' });
      const result = await pending;
      expect(result.replayed).toBe(replayed);
      expect(result.operation.status).toBe('WAITING_RETRY');
      expect(result.operation.safeError?.code).toBe(operation.safeError?.code);
    }
  });

  it('adapts nullable backend evidence for polling without changing progress or status', async () => {
    const pending = api.getOperation(operation.id);
    http.expectOne(`${path}/operations/${operation.id}`).flush({ success: true, data: operation });
    const result = await pending;
    expect(result.progress).toEqual(operation.progress);
    expect(result.status).toBe('WAITING_RETRY');
    expect(result.safeError?.message).toBe('');
    expect(result.steps[0].componentKey).toBe('');
    expect(result.steps[0].safeError).toEqual({ code: '', message: '' });
  });

  it.each([403, 409, 422, 503])('preserves backend codes for existing error handling (%s)', async (status) => {
    const pending = api.applyUpdates(body, 'key');
    const assertion = expect(pending).rejects.toMatchObject({ status,
      code: 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES', correlationId: 'trace' });
    http.expectOne(`${path}/updates/apply`).flush({ success: false,
      errorCode: 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES', correlationId: 'trace' },
    { status, statusText: 'Error' });
    await assertion;
  });

  it('rejects malformed accepted responses rather than starting polling', async () => {
    const pending = api.applyUpdates(body, 'key');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'API_RESPONSE_INVALID' });
    http.expectOne(`${path}/updates/apply`).flush({ success: true, data: { replayed: false } },
      { status: 202, statusText: 'Accepted' });
    await assertion;
  });
});
