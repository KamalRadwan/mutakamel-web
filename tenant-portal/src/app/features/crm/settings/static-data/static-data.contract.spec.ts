import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { ApiError } from '../../../../core/api/api-errors';
import { getCrmStaticData, sanitizeStaticData } from './static-data.api';
import { CrmStaticData, ENUM_KEYS } from './static-data.model';

/** A raw body as a careless server could send it: partial, with junk entries. */
function raw(patch: Record<string, unknown>): CrmStaticData {
  return patch as unknown as CrmStaticData;
}

describe('static data contract (GET crm/v1/static-data)', () => {
  let dispose: () => void;
  let stub: CrmHttpStub;

  beforeEach(() => {
    stub = new CrmHttpStub();
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => {
    dispose();
    vi.restoreAllMocks();
  });

  it('returns the bare static-data body with every section', async () => {
    const data = await getCrmStaticData();
    expect(Object.keys(data).sort()).toEqual(
      [
        'attachmentPolicy',
        'derivedRules',
        'enumOptions',
        'enums',
        'eventOptions',
        'ownerTypeOptions',
        'pagination',
        'permissionOptions',
        'permissions',
      ].sort(),
    );
    expect(data.pagination).toEqual({ pageSizes: [20, 50, 100], defaultPageSize: 20, maxPageSize: 100 });
    expect(data.attachmentPolicy.maxSizeBytes).toBe(26214400);
    expect(Object.keys(data.attachmentPolicy.allowedMimeTypes).sort()).toEqual(['excel', 'images', 'pdf', 'text', 'word']);
    expect(data.derivedRules).toEqual({
      opportunityStatusByStageFlag: { WON: 'WON', LOST: 'LOST', ON_HOLD: 'ON_HOLD', default: 'IN_PROGRESS' },
      leadConversionCopiesCustomFieldOwnerType: 'LEAD_AND_PARTY',
    });
  });

  it('has an options list for every enum key, with the same values as the enum', async () => {
    const data = await getCrmStaticData();
    for (const key of ENUM_KEYS) {
      const values = data.enums[key];
      expect(values, key).toBeDefined();
      expect(data.enumOptions[key]?.map((option) => option.value), key).toEqual(values);
    }
  });

  it('labels every option in both languages', async () => {
    const data = await getCrmStaticData();
    const options = [
      ...Object.values(data.enumOptions).flat(),
      ...data.permissionOptions,
      ...data.ownerTypeOptions,
      ...data.eventOptions,
      ...data.attachmentPolicy.familyLabels,
      ...data.attachmentPolicy.rejectedFamilyLabels,
    ];
    for (const option of options) {
      expect(option.label.en.trim(), option.value).not.toBe('');
      expect(option.label.ar.trim(), option.value).not.toBe('');
    }
  });

  it('every event option has an Arabic label', async () => {
    const data = await getCrmStaticData();
    for (const option of data.eventOptions) {
      expect(option.label.ar, option.value).toMatch(/[؀-ۿ]/);
    }
  });

  it('returns a copy, so editing the result never changes the next read', async () => {
    const first = await getCrmStaticData();
    first.permissions.length = 0;
    first.pagination.pageSizes.push(999);
    const second = await getCrmStaticData();
    expect(second.permissions.length).toBeGreaterThan(0);
    expect(second.pagination.pageSizes).not.toContain(999);
  });

  it('passes 503 ENTITLEMENT_UNAVAILABLE through once, then succeeds', async () => {
    const error = new ApiError(503, 'ENTITLEMENT_UNAVAILABLE');
    vi.spyOn(stub, 'read').mockRejectedValueOnce(error);
    await expect(getCrmStaticData()).rejects.toBe(error);
    await expect(getCrmStaticData()).resolves.toBeDefined();
  });

  describe('StaticDataApi', () => {
    it('one request per session', async () => {
      const read = vi.spyOn(stub, 'read');
      await Promise.all([getCrmStaticData(), getCrmStaticData()]);
      // Retain an unobserved catalogue beyond the shared client's gcTime: 0.
      await new Promise(resolve => setTimeout(resolve, 10));
      await getCrmStaticData();
      expect(read).toHaveBeenCalledExactlyOnceWith('/static-data');
      const query = crmQueries().getQueryCache().find({ queryKey: ['crm-settings', 'static-data'] });
      expect(query?.gcTime).toBe(Infinity);
    });

    it('failures are not cached', async () => {
      const failure = new ApiError(0, 'NETWORK_ERROR');
      const read = vi.spyOn(stub, 'read').mockRejectedValueOnce(failure);
      await expect(getCrmStaticData()).rejects.toBe(failure);
      await expect(getCrmStaticData()).resolves.toBeDefined();
      expect(read).toHaveBeenCalledTimes(2);
    });
  });

  describe('sanitizeStaticData', () => {
    it('fills every section with safe defaults from an empty body', () => {
      const clean = sanitizeStaticData(raw({}));
      expect(clean).toEqual({
        pagination: { pageSizes: [100], defaultPageSize: 100, maxPageSize: 100 },
        enums: {},
        enumOptions: {},
        attachmentPolicy: {
          maxSizeBytes: 0,
          allowedMimeTypes: { pdf: [], images: [], word: [], excel: [], text: [] },
          allowedExtensions: { pdf: [], images: [], word: [], excel: [], text: [] },
          rejectedFamilies: [],
          familyLabels: [],
          rejectedFamilyLabels: [],
        },
        permissions: [],
        permissionOptions: [],
        ownerTypeOptions: [],
        eventOptions: [],
        derivedRules: {
          opportunityStatusByStageFlag: { WON: 'WON', LOST: 'LOST', ON_HOLD: 'ON_HOLD', default: 'IN_PROGRESS' },
          leadConversionCopiesCustomFieldOwnerType: 'LEAD_AND_PARTY',
        },
      });
    });

    it('trims values and drops blanks, duplicates and non-strings', () => {
      const clean = sanitizeStaticData(
        raw({ enums: { leadStatuses: [' OPEN ', 'OPEN', '', 7, null, 'WON'] }, permissions: ['a', ' a', 'b'] }),
      );
      expect(clean.enums['leadStatuses']).toEqual(['OPEN', 'WON']);
      expect(clean.permissions).toEqual(['a', 'b']);
    });

    it('falls back to the value for a missing or blank label and drops options without a value', () => {
      const clean = sanitizeStaticData(
        raw({
          ownerTypeOptions: [
            { value: 'LEAD', label: { en: 'Lead', ar: '  ' } },
            { value: 'PARTY' },
            { value: '  ', label: { en: 'Blank', ar: 'فارغ' } },
            { value: 'LEAD', label: { en: 'Again', ar: 'مرة' } },
            null,
          ],
        }),
      );
      expect(clean.ownerTypeOptions).toEqual([
        { value: 'LEAD', label: { en: 'Lead', ar: 'LEAD' } },
        { value: 'PARTY', label: { en: 'PARTY', ar: 'PARTY' } },
      ]);
    });

    it('keeps only page sizes within the max and picks a valid default', () => {
      const clean = sanitizeStaticData(
        raw({ pagination: { pageSizes: [10, 0, 2.5, 50, 500, -1], defaultPageSize: 500, maxPageSize: 50 } }),
      );
      expect(clean.pagination).toEqual({ pageSizes: [10, 50], defaultPageSize: 10, maxPageSize: 50 });

      const kept = sanitizeStaticData(raw({ pagination: { pageSizes: [20, 50], defaultPageSize: 50, maxPageSize: 100 } }));
      expect(kept.pagination.defaultPageSize).toBe(50);
    });

    it('treats a non-positive or non-finite attachment size as 0', () => {
      for (const maxSizeBytes of [-5, 0, Number.NaN, Number.POSITIVE_INFINITY, '100']) {
        const clean = sanitizeStaticData(raw({ attachmentPolicy: { maxSizeBytes } }));
        expect(clean.attachmentPolicy.maxSizeBytes).toBe(0);
      }
      expect(sanitizeStaticData(raw({ attachmentPolicy: { maxSizeBytes: 1024 } })).attachmentPolicy.maxSizeBytes).toBe(1024);
    });

    it('cleans the attachment family records', () => {
      const clean = sanitizeStaticData(
        raw({ attachmentPolicy: { allowedExtensions: { pdf: [' .pdf ', '.pdf', ''], images: 'x' } } }),
      );
      expect(clean.attachmentPolicy.allowedExtensions.pdf).toEqual(['.pdf']);
      expect(clean.attachmentPolicy.allowedExtensions.images).toEqual([]);
    });
  });
});
