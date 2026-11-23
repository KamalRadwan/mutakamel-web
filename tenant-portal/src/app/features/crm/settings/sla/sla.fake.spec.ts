import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../../../../shared/widgets/dashboard/analytics-permissions.fixture';
import { FAKE_BRANCHES } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { getPolicy, listPolicies, previewClock, publishPolicy } from './sla.api';
import { resetSlaFakeIdempotency } from './sla.fake';
import { PublishSlaPolicy, SlaPolicy, toPublishBody } from './sla.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

/** Keys of `SlaPolicyView` (crm-app governance/sla/sla-policy.service.ts). */
const VIEW_KEYS = [
  'appliesToRecord',
  'branchId',
  'clockKind',
  'compliancePct',
  'effectiveFrom',
  'effectiveTo',
  'id',
  'nameAr',
  'nameEn',
  'nextPolicyId',
  'policyKind',
  'publishedAt',
  'publishedByUserId',
  'qualifying',
  'qualifyingFact',
  'qualifyingTouchBy',
  'requiredTouchCount',
  'startEvent',
  'state',
  'supersedesPolicyId',
  'targetMinutes',
  'versionNumber',
];

const CAIRO = FAKE_BRANCHES[0].id;
const GIZA = FAKE_BRANCHES[2].id;
const UNKNOWN_BRANCH = '01934b10-0000-7000-8000-0000000009ff';

function body(overrides: Partial<PublishSlaPolicy> = {}): PublishSlaPolicy {
  return {
    policyKind: 'FIRST_RESPONSE',
    appliesToRecord: 'LEAD',
    branchId: FAKE_BRANCHES[1].id,
    clockKind: 'WORKING_MINUTES',
    targetMinutes: 30,
    requiredTouchCount: null,
    compliancePct: null,
    qualifyingTouchBy: 'OWNER',
    qualifying: { activityTypes: ['CALL'], directions: null, touchSources: null },
    nameEn: 'Alexandria first response',
    nameAr: 'الاستجابة الأولى للإسكندرية',
    state: 'ACTIVE',
    expectedSupersedesPolicyId: null,
    ...overrides,
  };
}

async function headOf(kind: SlaPolicy['policyKind'], record: SlaPolicy['appliesToRecord'], branchId: string) {
  const page = await settle(listPolicies({ kind, record, branchId }));
  return page.items.find((item) => item.nextPolicyId === null) ?? null;
}

describe('sla fake (backend contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    resetSlaFakeIdempotency();
    bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE);
  });
  afterEach(() => {
    vi.useRealTimers();
    bindAnalyticsPermissions(() => []);
  });

  describe('GET crm/sla/policies', () => {
    it('returns an InfoPage of SlaPolicyView rows ordered by id DESC, 25 by default', async () => {
      const page = await settle(listPolicies());
      expect(Object.keys(page.pageInfo).sort()).toEqual(['hasMore', 'limit', 'nextCursor']);
      expect(page.pageInfo.limit).toBe(25);
      for (const row of page.items) expect(Object.keys(row).sort()).toEqual(VIEW_KEYS);
      const ids = page.items.map((row) => row.id);
      expect(ids).toEqual([...ids].sort().reverse());
    });

    it('keeps superseded versions in their own state and RETIRED versions without a target', async () => {
      const page = await settle(listPolicies({ limit: 100 }));
      for (const row of page.items) {
        expect(row.effectiveFrom).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        if (row.state === 'RETIRED') expect(row.targetMinutes).toBeNull();
        if (row.qualifyingFact === 'PLANNED_ACTIVITY') {
          expect(row.qualifying.directions).toBeNull();
          expect(row.qualifying.touchSources).toBeNull();
        }
      }
    });

    it('rejects bad filters through the ValidationPipe with property-path details', async () => {
      const error = await errorOf(listPolicies({ branchId: 'cairo' }));
      expect(error.status).toBe(400);
      expect(error.code).toBe('CRM_VALIDATION_FAILED');
      expect(error.details).toEqual({ branchId: ['matches'] });
    });

    it('answers a bad cursor with 400 CRM_DASHBOARD_LIST_CURSOR_INVALID before the reader check', async () => {
      bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE.filter((key) => !['crm.sla.manage', 'crm.dashboards.read.all'].includes(key)));
      const error = await errorOf(listPolicies({ cursor: '%%%' }));
      expect(error.code).toBe('CRM_DASHBOARD_LIST_CURSOR_INVALID');
      const denied = await errorOf(listPolicies());
      expect([denied.status, denied.code]).toEqual([403, 'CRM_PERMISSION_DENIED']);
    });

    it('filters tenant-default lineages with branchId=tenant', async () => {
      const page = await settle(listPolicies({ branchId: 'tenant', limit: 100 }));
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((row) => row.branchId === null)).toBe(true);
    });
  });

  describe('GET crm/sla/policies/:id', () => {
    it('validates the id, then answers 404 CRM_DASHBOARD_RESOURCE_NOT_FOUND without details', async () => {
      const invalid = await errorOf(getPolicy('nope'));
      expect(invalid.details).toEqual({ id: ['is_uuid'] });
      const missing = await errorOf(getPolicy('01934b20-0000-7000-8000-0000000000ff'));
      expect([missing.status, missing.code, missing.details]).toEqual([404, 'CRM_DASHBOARD_RESOURCE_NOT_FOUND', undefined]);
    });
  });

  describe('POST crm/sla/policies', () => {
    it('needs a UUIDv7 x-idempotency-key at the gateway', async () => {
      expect((await errorOf(publishPolicy(body(), ''))).code).toBe('GW.IDEM.MISSING');
      expect((await errorOf(publishPolicy(body(), 'not-a-uuid'))).code).toBe('GW.IDEM.BAD_VALUE');
    });

    it('runs the permission guard before the ValidationPipe', async () => {
      bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE.filter((key) => key !== 'crm.sla.manage'));
      const error = await errorOf(publishPolicy(body({ nameEn: 5 as unknown as string }), newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([403, 'CRM_PERMISSION_DENIED']);
    });

    it('rejects an empty qualifier list and a non-v7 branch with property-path details', async () => {
      const error = await errorOf(
        publishPolicy(
          body({ branchId: 'abc', qualifying: { activityTypes: [] }, nameAr: 'x'.repeat(121) }),
          newIdempotencyKey(),
        ),
      );
      expect(error.code).toBe('CRM_VALIDATION_FAILED');
      expect(error.details).toEqual({
        branchId: ['is_uuid'],
        'qualifying.activityTypes': ['array_min_size'],
        nameAr: ['max_length'],
      });
    });

    it('answers shape rules with 422 CRM_SLA_POLICY_SHAPE_INVALID and no details', async () => {
      const cases: Partial<PublishSlaPolicy>[] = [
        { appliesToRecord: 'OPPORTUNITY' },
        { state: 'RETIRED' },
        { policyKind: 'FOLLOW_UP_CADENCE', clockKind: 'WORKING_MINUTES' },
        { requiredTouchCount: 3 },
        { expectedSupersedesPolicyId: undefined as unknown as null },
      ];
      for (const overrides of cases) {
        const error = await errorOf(publishPolicy(body(overrides), newIdempotencyKey()));
        expect([error.status, error.code, error.details]).toEqual([422, 'CRM_SLA_POLICY_SHAPE_INVALID', undefined]);
      }
    });

    it('answers an unknown qualifier with 422 CRM_SLA_QUALIFIER_UNKNOWN', async () => {
      const planned = await errorOf(
        publishPolicy(
          body({ policyKind: 'NEXT_STEP', appliesToRecord: 'OPPORTUNITY', qualifying: { activityTypes: ['NOTE'] } }),
          newIdempotencyKey(),
        ),
      );
      expect(planned.code).toBe('CRM_SLA_QUALIFIER_UNKNOWN');
      const directions = await errorOf(
        publishPolicy(
          body({ policyKind: 'NEXT_STEP', appliesToRecord: 'OPPORTUNITY', qualifying: { directions: ['OUTBOUND'] } }),
          newIdempotencyKey(),
        ),
      );
      expect(directions.code).toBe('CRM_SLA_POLICY_SHAPE_INVALID');
    });

    it('checks branch authority, then the stale head, then backdating', async () => {
      const branch = await errorOf(publishPolicy(body({ branchId: UNKNOWN_BRANCH }), newIdempotencyKey()));
      expect([branch.status, branch.code]).toEqual([403, 'BRANCH_PERMISSION_DENIED']);

      const stale = await errorOf(publishPolicy(body({ branchId: CAIRO }), newIdempotencyKey()));
      expect([stale.status, stale.code, stale.details]).toEqual([409, 'CRM_SLA_POLICY_STALE', undefined]);

      const head = await headOf('FIRST_RESPONSE', 'LEAD', CAIRO);
      const backdated = await errorOf(
        publishPolicy(
          body({ branchId: CAIRO, expectedSupersedesPolicyId: head!.id, effectiveFrom: '2026-11-20T00:00:00.000Z' }),
          newIdempotencyKey(),
        ),
      );
      expect([backdated.status, backdated.code]).toEqual([422, 'CRM_SLA_BACKDATED']);
    });

    it('publishes the next version, replays the same key and rejects the key with another body', async () => {
      const head = await headOf('FIRST_RESPONSE', 'LEAD', CAIRO);
      const key = newIdempotencyKey();
      const request = body({
        branchId: CAIRO,
        expectedSupersedesPolicyId: head!.id,
        qualifying: { activityTypes: ['EMAIL', 'CALL'], directions: ['OUTBOUND'], touchSources: null },
      });
      const created = await settle(publishPolicy(request, key));
      expect(Object.keys(created).sort()).toEqual(VIEW_KEYS);
      expect(created.versionNumber).toBe(head!.versionNumber + 1);
      expect(created.supersedesPolicyId).toBe(head!.id);
      expect(created.qualifying).toEqual({ activityTypes: ['CALL', 'EMAIL'], directions: ['OUTBOUND'], touchSources: null });
      expect(created.effectiveFrom).toBe('2026-11-21T09:00:00.000Z');

      const replay = await settle(publishPolicy(request, key));
      expect(replay.id).toBe(created.id);

      const reused = await errorOf(publishPolicy({ ...request, nameEn: 'Other name' }, key));
      expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);

      const previous = await settle(getPolicy(head!.id));
      expect(previous.nextPolicyId).toBe(created.id);
      expect(previous.state).toBe(head!.state);
      expect(previous.effectiveTo).toBe(created.effectiveFrom);
    });
  });

  describe('POST crm/sla/clock/preview', () => {
    it('validates ISO instants and a v7 branch id', async () => {
      const error = await errorOf(previewClock({ branchId: 'x', from: '2026-13-01T09:00', minutes: 1.5 }));
      expect(error.details).toEqual({ branchId: ['is_uuid'], from: ['is_iso8601'], minutes: ['is_int'] });
    });

    it('answers range problems with 422 CRM_SLA_CLOCK_RANGE_EXCEEDED, then branch authority', async () => {
      const from = '2026-11-22T09:00:00.000Z';
      expect((await errorOf(previewClock({ branchId: CAIRO, from }))).code).toBe('CRM_SLA_CLOCK_RANGE_EXCEEDED');
      expect((await errorOf(previewClock({ branchId: CAIRO, from, minutes: 100001 }))).code).toBe(
        'CRM_SLA_CLOCK_RANGE_EXCEEDED',
      );
      expect((await errorOf(previewClock({ branchId: CAIRO, from, to: from }))).code).toBe('CRM_SLA_CLOCK_RANGE_EXCEEDED');
      const branch = await errorOf(previewClock({ branchId: UNKNOWN_BRANCH, from, minutes: 30 }));
      expect([branch.status, branch.code]).toEqual([403, 'BRANCH_PERMISSION_DENIED']);
    });

    it('returns a deadline with to/workingMinutes null for a minutes preview', async () => {
      const result = await settle(previewClock({ branchId: CAIRO, from: '2026-11-22T09:00:00.000Z', minutes: 30 }));
      expect(result).toEqual({
        branchId: CAIRO,
        from: '2026-11-22T09:00:00.000Z',
        to: null,
        minutes: 30,
        asOf: '2026-11-21T09:00:00.000Z',
        deadline: '2026-11-22T09:30:00.000Z',
        workingMinutes: null,
        missingReason: null,
      });
    });

    it('returns working minutes with deadline/minutes null for a range preview', async () => {
      const result = await settle(
        previewClock({ branchId: CAIRO, from: '2026-11-22T09:00:00.000Z', to: '2026-11-22T10:00:00.000Z' }),
      );
      expect([result.minutes, result.deadline, result.workingMinutes, result.missingReason]).toEqual([null, null, 60, null]);
    });

    it('reports a missing calendar as missingReason, not an error', async () => {
      const result = await settle(previewClock({ branchId: GIZA, from: '2026-11-22T09:00:00.000Z', minutes: 30 }));
      expect([result.deadline, result.missingReason]).toEqual([null, 'CALENDAR_HOURS_MISSING']);
    });
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
    expect(result.qualifying).toEqual({ activityTypes: ['CALL', 'MEETING'], directions: null, touchSources: null });
    expect(result.requiredTouchCount).toBeNull();
    expect(result.compliancePct).toBeNull();
    expect(result.nameEn).toBe('Next step');
    expect('effectiveFrom' in result).toBe(false);
  });

  it('sends a later date as an instant, empty lists as null and no target for a RETIRED version', () => {
    const result = toPublishBody(
      { ...form, policyKind: 'FIRST_RESPONSE', appliesToRecord: 'LEAD', state: 'RETIRED', effectiveFrom: '2026-12-01' },
      '2026-11-21',
    );
    expect(result.effectiveFrom).toBe('2026-12-01T00:00:00.000Z');
    expect(result.targetMinutes).toBeNull();
    expect(result.qualifying?.touchSources).toBeNull();
    expect(result.qualifying?.activityTypes).toEqual(['CALL', 'MEETING', 'NOTE']);
  });
});
