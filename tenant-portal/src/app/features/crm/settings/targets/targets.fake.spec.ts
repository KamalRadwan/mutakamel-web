import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CoreHttp } from '../../../../core/api/core-http';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import {
  approveTarget,
  beginTargetAction,
  correctTarget,
  createTarget,
  deleteTarget,
  getTarget,
  listReleases,
  listTargets,
  rejectTarget,
  submitTarget,
  targetableMetrics,
  targetCurrencies,
  targetFieldErrors,
  targetSubjectOptions,
  updateTarget,
} from './targets.api';
import type { CreateTargetBody } from './targets.model';

const body: CreateTargetBody = {
  subjectType: 'BRANCH',
  branchId: 'branch',
  subjectId: 'branch',
  metricKey: 'crm.leads.created.count',
  periodGrain: 'MONTH',
  periodStart: '2027-01-01',
  targetValue: 50,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let stub: CrmHttpStub;
let dispose: () => void;
beforeEach(() => {
  stub = new CrmHttpStub({
    '/targets': { items: [], total: 0, page: 1, limit: 12 },
    '/targets/id': { id: 'id' },
    '/targets/id/releases': { items: [], pageInfo: { hasMore: false } },
    '/targets/metrics': [],
    '/targets/subject-options': { users: [], teams: [] },
  });
  dispose = bindCrmHttpForTest(stub);
});
afterEach(() => {
  dispose();
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  crmQueries().clear();
});

describe('TargetsApi', () => {
  it('reads the real routes and passes list, subject and cursor filters without a scope header', async () => {
    await listTargets({
      branchId: 'branch',
      page: 3,
      limit: 24,
      sortDir: 'DESC',
      approvalState: 'DRAFT',
    });
    await getTarget('id');
    await listReleases('id', 'cursor', 10);
    await targetableMetrics();
    await targetSubjectOptions('branch', 'Ali', 50);
    expect(stub.recordedReads().map((r) => r.path)).toEqual([
      '/targets',
      '/targets/id',
      '/targets/id/releases',
      '/targets/metrics',
      '/targets/subject-options',
    ]);
    expect(stub.recordedReads()[0].query).toEqual({
      branchId: 'branch',
      page: 3,
      limit: 24,
      sortDir: 'DESC',
      approvalState: 'DRAFT',
    });
    expect(stub.recordedReads()[2].query).toEqual({ cursor: 'cursor', limit: 10 });
    expect(stub.recordedReads()[4].query).toEqual({ branchId: 'branch', search: 'Ali', limit: 50 });
    expect(stub.recordedReads().every((r) => r.scope === undefined)).toBe(true);
  });
  it('approve and correct keys', async () => {
    const key = newIdempotencyKey();
    await approveTarget('id', { revision: 2, note: 'Reviewed' }, key);
    await correctTarget('id', { revision: 2, value: 75.25, reason: 'Correction' }, key);
    expect(stub.recordedWrites().map((w) => [w.path, w.options.key])).toEqual([
      ['/targets/id/approve', key],
      ['/targets/id/corrections', key],
    ]);
    expect(key).toMatch(uuid);
    expect(stub.recordedWrites()[1].body).toEqual({
      revision: 2,
      value: 75.25,
      reason: 'Correction',
    });
  });
  it('sends every other write with UUID v7 and revision bodies, accepting 204 deletion', async () => {
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    await createTarget(body);
    await updateTarget('id', { revision: 3, targetValue: 60.5 });
    await submitTarget('id', { revision: 4 });
    await rejectTarget('id', { revision: 4, note: 'Update it' });
    await expect(deleteTarget('id', 5)).resolves.toBeUndefined();
    const writes = stub.recordedWrites();
    expect(writes.map((w) => w.method)).toEqual(['POST', 'PATCH', 'POST', 'POST', 'DELETE']);
    expect(writes.every((w) => uuid.test(w.options.key) && !w.options.scope)).toBe(true);
    expect(writes[1].body).toEqual({ revision: 3, targetValue: 60.5 });
    expect(writes[1].options.ifMatch).toBe('"3"');
    expect(writes[4].options.ifMatch).toBe('"5"');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'targets'] });
  });
  it.each([0, 503, 409, 401])(
    'reuses the key and body after a retryable failure or 401 (%s)',
    async (status) => {
      const original = stub.write.bind(stub);
      const seen: { key: string; body: unknown }[] = [];
      let fail = true;
      vi.spyOn(stub, 'write').mockImplementation(async (method, path, payload, options) => {
        seen.push({ key: options.key, body: structuredClone(payload) });
        if (fail) {
          fail = false;
          throw new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK');
        }
        return original(method, path, payload, options);
      });
      await expect(createTarget(body)).rejects.toBeInstanceOf(ApiError);
      await createTarget(body);
      expect(seen[1]).toEqual(seen[0]);
    },
  );
  it.each(['patch', 'delete', 'submit', 'reject', 'approve', 'correct'] as const)(
    'keeps the key and exact body on a manual %s retry after 5xx',
    async (kind) => {
      const seen: { key: string; body: unknown }[] = [];
      const original = stub.write.bind(stub);
      let failed = false;
      vi.spyOn(stub, 'write').mockImplementation(async (method, path, payload, options) => {
        seen.push({ key: options.key, body: structuredClone(payload) });
        if (!failed) {
          failed = true;
          throw new ApiError(503, 'NETWORK');
        }
        return original(method, path, payload, options);
      });
      const key = newIdempotencyKey();
      const calls = {
        patch: () => updateTarget('retry', { revision: 3, targetValue: 60 }),
        delete: () => deleteTarget('retry', 3),
        submit: () => submitTarget('retry', { revision: 3 }),
        reject: () => rejectTarget('retry', { revision: 3, note: 'Retry' }),
        approve: () => approveTarget('retry', { revision: 3 }, key),
        correct: () => correctTarget('retry', { revision: 3, value: 60, reason: 'Retry' }, key),
      };
      await expect(calls[kind]()).rejects.toBeInstanceOf(ApiError);
      expect(seen).toHaveLength(1);
      await calls[kind]();
      expect(seen[1]).toEqual(seen[0]);
      expect(seen[0].key).toMatch(uuid);
    },
  );
  it('uses a new key for changed bodies and after a non-retryable 4xx, with no automatic resend', async () => {
    const seen: string[] = [];
    vi.spyOn(stub, 'write').mockImplementation(async (_method, _path, _body, options) => {
      seen.push(options.key);
      throw new ApiError(422, 'CRM_TARGET_VALUE_INVALID');
    });
    await expect(createTarget(body)).rejects.toBeInstanceOf(ApiError);
    expect(seen).toHaveLength(1);
    await expect(createTarget(body)).rejects.toBeInstanceOf(ApiError);
    expect(seen[1]).not.toBe(seen[0]);
    await expect(createTarget({ ...body, targetValue: 51 })).rejects.toBeInstanceOf(ApiError);
    expect(seen[2]).not.toBe(seen[1]);
  });
  it('changes the key when the body changes after a 5xx', async () => {
    const seen: string[] = [];
    vi.spyOn(stub, 'write').mockImplementation(async (_method, _path, _body, options) => {
      seen.push(options.key);
      throw new ApiError(503, 'CRM_TARGET_SOURCE_NOT_READY');
    });
    await expect(updateTarget('id', { revision: 2, targetValue: 20 })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(updateTarget('id', { revision: 2, targetValue: 21 })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(seen[1]).not.toBe(seen[0]);
  });
  it('sends enforced approve and correction HTTP headers without organization scope', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const doc = TestBed.inject(DOCUMENT);
    const name =
      doc.location.protocol === 'https:'
        ? '__Host-mutakamel-tenant-csrf'
        : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=target-csrf`);
    const http = TestBed.inject(HttpTestingController);
    const restore = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    try {
      const key = newIdempotencyKey();
      for (const action of ['approve', 'corrections'] as const) {
        const pending =
          action === 'approve'
            ? approveTarget('wire', { revision: 2 }, key)
            : correctTarget('wire', { revision: 2, value: 51, reason: 'Correct' }, key);
        const request = http.expectOne(`/api/tenant/crm/v1/targets/wire/${action}`);
        expect(request.request.headers.get('x-idempotency-key')).toBe(key);
        expect(request.request.headers.get('x-csrf-token')).toBe('target-csrf');
        expect(request.request.headers.get('x-mutakamel-company-id')).toBeNull();
        expect(request.request.headers.get('x-mutakamel-branch-id')).toBeNull();
        expect(request.request.body.revision).toBe(2);
        expect(request.request.headers.get('If-Match')).toBe('"2"');
        request.flush({ target: { id: 'wire' }, release: { id: 'release' } });
        await pending;
      }
      http.verify();
    } finally {
      restore();
    }
  });
  it('starts a new key when the failed form is explicitly reopened', async () => {
    const keys: string[] = [];
    vi.spyOn(stub, 'write').mockImplementation(async (_method, _path, _body, options) => {
      keys.push(options.key);
      throw new ApiError(503, 'NETWORK');
    });
    await expect(createTarget(body)).rejects.toBeInstanceOf(ApiError);
    beginTargetAction('create');
    await expect(createTarget(body)).rejects.toBeInstanceOf(ApiError);
    expect(keys[1]).not.toBe(keys[0]);
  });
  it('reads currencies through the enveloped Core boundary', async () => {
    const read = vi
      .fn()
      .mockResolvedValue([
        { code: 'JPY', nameEn: 'Yen', nameAr: 'ين', decimals: 0, isDefault: true },
      ]);
    await expect(targetCurrencies({ read } as unknown as CoreHttp)).resolves.toEqual([
      expect.objectContaining({ code: 'JPY' }),
    ]);
    expect(read).toHaveBeenCalledWith('/api/tenant/core/v1/currencies/options');
  });
  it('reads validation field keys from message arrays', () => {
    expect(
      Object.keys(
        targetFieldErrors(
          new ApiError(400, 'CRM_VALIDATION_FAILED', {
            targetValue: ['Enter a number'],
            periodStart: ['Invalid date'],
          }),
        ),
      ),
    ).toEqual(['targetValue', 'periodStart']);
  });
});
