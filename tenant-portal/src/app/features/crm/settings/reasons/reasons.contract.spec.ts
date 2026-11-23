import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { createReason, listReasons, updateReason } from './reasons.api';
import { REASON_KINDS, type CreateReasonInput } from './reasons.model';

const input: CreateReasonInput = {
  reasonKind: 'LOSS', code: 'CONTRACT_SPEC', nameEn: 'Contract spec', nameAr: 'اختبار العقد', sortOrder: 10,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  describe(`ReasonsApi ${lang} ${theme}`, () => {
    let stub: CrmHttpStub;
    let dispose: () => void;
    beforeEach(() => {
      stub = new CrmHttpStub({ '/settings/reasons': { items: [] } });
      dispose = bindCrmHttpForTest(stub);
    });
    afterEach(() => { crmQueries().clear(); dispose(); vi.restoreAllMocks(); });

    it('list returns the bare response and forwards only supplied filters', async () => {
      const read = vi.spyOn(stub, 'read');
      expect(await listReasons()).toEqual({ items: [] });
      expect(read).toHaveBeenLastCalledWith('/settings/reasons', {});
      await listReasons({ kind: 'LOSS', active: 'false' });
      expect(read).toHaveBeenLastCalledWith('/settings/reasons', { kind: 'LOSS', active: 'false' });
    });

    it('create body per kind', async () => {
      for (const reasonKind of REASON_KINDS) {
        await createReason({ ...input, reasonKind, definitionEn: null, definitionAr: null,
          polarity: reasonKind === 'ACTIVITY_OUTCOME' ? 'NEUTRAL' : null, activityType: null });
        const write = stub.recordedWrites().at(-1)!;
        expect(write.method).toBe('POST');
        expect(write.path).toBe('/settings/reasons');
        expect(write.body).toEqual({ ...input, reasonKind, ...(reasonKind === 'ACTIVITY_OUTCOME' ? { polarity: 'NEUTRAL' } : {}) });
        expect(write.options.key).toMatch(uuid);
        expect(write.options.scope).toBeUndefined();
      }
      await createReason({ ...input, reasonKind: 'ACTIVITY_OUTCOME', polarity: 'POSITIVE', activityType: 'CALL', definitionEn: 'Useful', definitionAr: 'مفيد' });
      expect(stub.recordedWrites().at(-1)!.body).toEqual({ ...input, reasonKind: 'ACTIVITY_OUTCOME', polarity: 'POSITIVE', activityType: 'CALL', definitionEn: 'Useful', definitionAr: 'مفيد' });
    });

    it('create sends and reuses the key', async () => {
      const key = newIdempotencyKey();
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'ENTITLEMENT_UNAVAILABLE'));
      await expect(createReason(input, key)).rejects.toMatchObject({ status: 503 });
      await createReason(input, key);
      expect(write.mock.calls[0][3]).toEqual({ key });
      expect(write.mock.calls[1][3]).toEqual({ key });
      expect(key).toMatch(uuid);
      expect(write.mock.calls[1][2]).toEqual(write.mock.calls[0][2]);
    });

    it('update sends if-match and revision', async () => {
      await updateReason('reason-one', 7, { nameEn: 'Updated', definitionAr: null });
      expect(stub.recordedWrites()[0]).toEqual({ method: 'PATCH', path: '/settings/reasons/reason-one',
        body: { nameEn: 'Updated', definitionAr: null, revision: 7 }, options: { key: expect.stringMatching(uuid), ifMatch: '"7"' } });
    });

    it.each([0, 503, 401, 409])('retains update key and body after %s, replaces the key for changed values', async (status) => {
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK_ERROR'));
      await expect(updateReason('one', 1, { nameEn: 'First' })).rejects.toBeInstanceOf(ApiError);
      await expect(updateReason('one', 1, { nameEn: 'First' })).rejects.toBeInstanceOf(ApiError);
      expect(write.mock.calls[1][3].key).toBe(write.mock.calls[0][3].key);
      expect(write.mock.calls[1][2]).toEqual(write.mock.calls[0][2]);
      await expect(updateReason('one', 1, { nameEn: 'Changed' })).rejects.toBeInstanceOf(ApiError);
      expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
      expect(write.mock.calls[2][3].key).toMatch(uuid);
    });

    it('does not retry a 4xx automatically and starts a new update attempt', async () => {
      const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(422, 'CRM_REASON_KIND_MISMATCH'));
      await expect(updateReason('one', 1, { nameEn: 'First' })).rejects.toBeInstanceOf(ApiError);
      expect(write).toHaveBeenCalledTimes(1);
      await expect(updateReason('one', 1, { nameEn: 'First' })).rejects.toBeInstanceOf(ApiError);
      expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
    });

    it('invalidates every reasons query after a successful write', async () => {
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      await createReason(input);
      await updateReason('one', 1, { isActive: false });
      expect(cancel).toHaveBeenCalledTimes(2);
      expect(invalidate).toHaveBeenCalledTimes(2);
      expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['crm-settings', 'reasons'] });
    });
  });
}

describe('ReasonsApi HTTP headers', () => {
  let dispose: () => void;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-proof`);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    dispose();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('POST sends a UUID v7 header, CSRF and the exact same request on an explicit retry', async () => {
    const key = newIdempotencyKey();
    const first = createReason(input, key);
    const guarded = expect(first).rejects.toMatchObject({ status: 503 });
    const request = http.expectOne('/api/tenant/crm/v1/settings/reasons');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    request.flush({ errorCode: 'ENTITLEMENT_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await guarded;
    const retry = createReason(input, key);
    const next = http.expectOne('/api/tenant/crm/v1/settings/reasons');
    expect(next.request.body).toEqual(request.request.body);
    expect(next.request.headers.get('x-idempotency-key')).toBe(key);
    next.flush({ ...input, id: 'created', revision: 1 }, { status: 201, statusText: 'Created' });
    await expect(retry).resolves.toMatchObject({ id: 'created' });
  });

  it('PATCH sends a UUID v7 key and the quoted If-Match matching body revision', async () => {
    const pending = updateReason('reason-one', 3, { isActive: false });
    const request = http.expectOne('/api/tenant/crm/v1/settings/reasons/reason-one');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    expect(request.request.body).toEqual({ isActive: false, revision: 3 });
    request.flush({ id: 'reason-one', revision: 4, isActive: false });
    await expect(pending).resolves.toMatchObject({ revision: 4 });
  });
});
