import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { getPolicy, putBranch, putCompany, putDefaults } from './duplicates.api';
import { PolicyTree } from './duplicates.model';
import { resetsFromDetails } from './duplicates.policy';

const path = '/settings/duplicate-policy';
const EG = '01950000-0000-7000-8000-000000000501';
const CAIRO_HQ = '01950000-0000-7000-8000-000000000601';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('duplicate policy contract (crm settings/duplicate-policy)', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  let tree: PolicyTree;
  beforeEach(() => {
    tree = structuredClone(CRM_SETTINGS_FIXTURES[path]) as PolicyTree;
    stub = new CrmHttpStub({ [path]: tree });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => { dispose(); vi.restoreAllMocks(); });

  it('reads the bare tree through the CRM query client without scope headers', async () => {
    expect(await getPolicy()).toEqual(tree);
    expect(stub.recordedReads()).toEqual([{ path, query: undefined, scope: undefined }]);
    expect(crmQueries().getQueryData(['crm-settings', 'duplicates'])).toEqual(tree);
  });

  it.each([
    ['defaults', () => putDefaults({ checkEmail: false }, 1), { checkEmail: false, expectedRevision: 1 }],
    [`companies/${EG}`, () => putCompany(EG, { allowAcrossUsers: null }, 1), { allowAcrossUsers: null, expectedRevision: 1 }],
    [`branches/${CAIRO_HQ}`, () => putBranch(CAIRO_HQ, { allowAcrossUsers: null }, 1, true), { allowAcrossUsers: null, expectedRevision: 1, confirmResets: true }],
  ] as const)('links PUT %s with a UUID v7 key, exact body and no scope or If-Match', async (suffix, send, body) => {
    const result = { ...tree, revision: 2, resets: [] };
    const write = vi.spyOn(stub, 'write').mockResolvedValue({ status: 200, data: result, etag: null, location: null });
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    expect(await send()).toEqual(result);
    expect(write).toHaveBeenCalledWith('PUT', `${path}/${suffix}`, body, { key: expect.stringMatching(uuidV7) });
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'duplicates'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'duplicates'] });
  });

  it.each([0, 500, 503, 401, 409])('keeps the same key and exact body for an explicit retry after %s', async (status) => {
    const error = new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'TEST_ERROR');
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(error)
      .mockResolvedValue({ status: 200, data: { ...tree, resets: [] }, etag: null, location: null });
    await expect(putDefaults({ checkEmail: false }, 1)).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(1);
    await putDefaults({ checkEmail: false }, 1);
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    expect(write.mock.calls[0][3].key).toMatch(uuidV7);
  });

  it('uses a new key whenever the body changes or the previous write succeeded', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR'))
      .mockResolvedValue({ status: 200, data: { ...tree, resets: [] }, etag: null, location: null });
    await expect(putDefaults({ checkEmail: false }, 1)).rejects.toBeInstanceOf(ApiError);
    await putDefaults({ checkEmail: true }, 1);
    await putDefaults({ checkEmail: true }, 1);
    expect(new Set(write.mock.calls.map((call) => call[3].key)).size).toBe(3);
  });

  it.each([
    [409, 'CRM_DUPLICATE_POLICY_STALE'], [409, 'CRM_DUPLICATE_POLICY_RESETS_REQUIRED'],
    [422, 'CRM_DUPLICATE_POLICY_CONFLICT'], [404, 'CRM_COMPANY_NOT_FOUND'], [404, 'CRM_BRANCH_NOT_FOUND'],
    [403, 'CRM_SUBSCRIPTION_READ_ONLY'], [429, 'COMMON.GENERIC.RATE_LIMITED'],
  ])('propagates %s %s without an automatic retry and retires its key', async (status, code) => {
    const error = new ApiError(status as number, code as string);
    const write = vi.spyOn(stub, 'write').mockRejectedValue(error);
    await expect(putDefaults({ checkEmail: false }, 1)).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(1);
    await expect(putDefaults({ checkEmail: false }, 1)).rejects.toBe(error);
    expect(write.mock.calls[0][3].key).not.toBe(write.mock.calls[1][3].key);
  });

  it('preserves validation message text keyed by field', async () => {
    const error = new ApiError(400, 'CRM_VALIDATION_FAILED', { checkEmail: ['Enter a boolean value.'] });
    vi.spyOn(stub, 'write').mockRejectedValue(error);
    await expect(putDefaults({ checkEmail: false }, 1)).rejects.toBe(error);
    expect(Object.keys(fieldErrorsOf(error))).toEqual(['checkEmail']);
  });

  describe('resetsFromDetails', () => {
    it('zips the parallel arrays and uppercases the scope type', () => {
      expect(
        resetsFromDetails({
          scopeType: ['company', 'branch'],
          id: [EG, CAIRO_HQ],
          name: ['Mutakamel Egypt', 'Cairo HQ'],
          switch: ['b', 'u'],
        }),
      ).toEqual([
        { scopeType: 'COMPANY', id: EG, name: 'Mutakamel Egypt', switch: 'b' },
        { scopeType: 'BRANCH', id: CAIRO_HQ, name: 'Cairo HQ', switch: 'u' },
      ]);
    });

    it('skips unknown entries and returns [] without details', () => {
      expect(resetsFromDetails(undefined)).toEqual([]);
      expect(
        resetsFromDetails({ scopeType: ['tenant', 'branch'], id: ['a', 'b'], name: ['A', 'B'], switch: ['b', 'c'] }),
      ).toEqual([]);
      expect(resetsFromDetails({ resets: [{ scopeType: 'BRANCH' }] })).toEqual([]);
    });
  });
});
