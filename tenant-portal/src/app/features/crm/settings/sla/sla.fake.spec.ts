import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { listPolicies, getPolicy, publishPolicy, previewClock } from './sla.api';
import type { PublishSlaPolicy } from './sla.model';
import { toPublishBody } from './sla.model';

describe('SlaApi', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  const page = { items: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null } };
  const body: PublishSlaPolicy = {
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: null,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 30,
    nameEn: 'Response',
    nameAr: 'الاستجابة',
    state: 'ACTIVE',
    expectedSupersedesPolicyId: null,
  };
  beforeEach(() => {
    stub = new CrmHttpStub({ '/sla/policies': page, '/sla/policies/policy-1': { id: 'policy-1' } });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => {
    dispose();
    vi.restoreAllMocks();
  });

  it('load more resends the filters', async () => {
    const read = vi.spyOn(stub, 'read');
    const filters = {
      kind: 'NEXT_STEP' as const,
      record: 'OPPORTUNITY' as const,
      branchId: 'tenant',
      state: 'ACTIVE' as const,
      limit: 25,
    };
    await listPolicies(filters);
    await listPolicies({ ...filters, cursor: 'next' });
    expect(read.mock.calls).toEqual([
      ['/sla/policies', filters],
      ['/sla/policies', { ...filters, cursor: 'next' }],
    ]);
  });

  it('publish always sends the head id', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    for (const head of [null, '01934b10-0000-7000-8000-000000000001']) {
      await publishPolicy({ ...body, expectedSupersedesPolicyId: head }, newIdempotencyKey());
      expect(stub.recordedWrites().at(-1)?.body).toEqual({
        ...body,
        expectedSupersedesPolicyId: head,
      });
    }
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'sla'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'sla'] });
    for (const write of stub.recordedWrites()) {
      expect(write.path).toBe('/sla/policies');
      expect(write.options.key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(write.options.scope).toBeUndefined();
    }
  });

  it('publish key reuse', async () => {
    const key = newIdempotencyKey();
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
    await expect(publishPolicy(body, key)).rejects.toMatchObject({ status: 503 });
    expect(write).toHaveBeenCalledTimes(1);
    await publishPolicy(body, key);
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    await publishPolicy({ ...body, nameEn: 'Changed' }, newIdempotencyKey());
    expect(write.mock.calls[2][3].key).not.toBe(key);
  });

  it('returns bare list and version bodies', async () => {
    await expect(listPolicies()).resolves.toEqual(page);
    await expect(getPolicy('policy-1')).resolves.toEqual({ id: 'policy-1' });
  });

  it('preserves server validation field keys and policy errors without automatic retries', async () => {
    const write = vi.spyOn(stub, 'write');
    const errors = [
      new ApiError(400, 'CRM_VALIDATION_FAILED', {
        'qualifying.activityTypes': ['Select a supported type'],
      }),
      new ApiError(403, 'BRANCH_PERMISSION_DENIED'),
      new ApiError(409, 'CRM_SLA_POLICY_STALE'),
      new ApiError(422, 'CRM_SLA_BACKDATED'),
      new ApiError(422, 'CRM_SLA_POLICY_SHAPE_INVALID'),
      new ApiError(422, 'CRM_SLA_QUALIFIER_UNKNOWN'),
      new ApiError(422, 'GW.IDEM.MISMATCH'),
    ];
    for (const error of errors) {
      write.mockRejectedValueOnce(error);
      await expect(publishPolicy(body, newIdempotencyKey())).rejects.toBe(error);
    }
    expect(write).toHaveBeenCalledTimes(errors.length);
  });

  it('preview sends a key, preserves missing reasons and reuses transport retries', async () => {
    const request = { branchId: 'branch-1', from: '2026-11-23T09:00:00.000Z', minutes: 30 };
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await expect(previewClock(request)).rejects.toMatchObject({ status: 0 });
    write.mockResolvedValueOnce({
      status: 200,
      data: { missingReason: 'CALENDAR_UNAVAILABLE' },
      etag: null,
      location: null,
    });
    await expect(previewClock(request)).resolves.toEqual({ missingReason: 'CALENDAR_UNAVAILABLE' });
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    expect(write.mock.calls[1][3].key).toMatch(/-7[0-9a-f]{3}-[89ab]/);
    await previewClock({ ...request, minutes: 60 });
    expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
  });
});

describe('toPublishBody', () => {
  const form = {
    policyKind: 'NEXT_STEP' as const,
    appliesToRecord: 'OPPORTUNITY' as const,
    branchId: null,
    clockKind: 'WORKING_MINUTES' as const,
    targetMinutes: 60,
    requiredTouchCount: 3,
    compliancePct: 80,
    qualifyingTouchBy: 'OWNER' as const,
    activityTypes: ['NOTE', 'MEETING', 'CALL'],
    directions: ['OUTBOUND' as const],
    touchSources: [],
    nameEn: ' Next step ',
    nameAr: ' الخطوة التالية ',
    effectiveFrom: '2026-11-21',
    state: 'ACTIVE' as const,
    expectedSupersedesPolicyId: null,
  };

  it('drops what the planned-activity shape forbids and omits an effective date of today', () => {
    const result = toPublishBody(form, '2026-11-21');
    expect(result.qualifying).toEqual({
      activityTypes: ['CALL', 'MEETING'],
      directions: null,
      touchSources: null,
    });
    expect(result.requiredTouchCount).toBeNull();
    expect(result.compliancePct).toBeNull();
    expect(result.nameEn).toBe('Next step');
    expect('effectiveFrom' in result).toBe(false);
  });

  it('sends a later date as an instant, empty lists as null and no target for a RETIRED version', () => {
    const result = toPublishBody(
      {
        ...form,
        policyKind: 'FIRST_RESPONSE',
        appliesToRecord: 'LEAD',
        state: 'RETIRED',
        effectiveFrom: '2026-12-01',
      },
      '2026-11-21',
    );
    expect(result.effectiveFrom).toBe('2026-12-01T00:00:00.000Z');
    expect(result.targetMinutes).toBeNull();
    expect(result.qualifying?.touchSources).toBeNull();
    expect(result.qualifying?.activityTypes).toEqual(['CALL', 'MEETING', 'NOTE']);
  });
});
