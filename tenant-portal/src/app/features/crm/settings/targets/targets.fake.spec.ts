import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_BRANCHES, FAKE_PEOPLE, FAKE_TEAMS } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { isTargetGone, targetFieldErrors } from './targets.api';
import {
  fakeApproveTarget,
  fakeCorrectTarget,
  fakeCreateTarget,
  fakeDeleteTarget,
  fakeGetTarget,
  fakeListReleases,
  fakeListTargets,
  fakeRejectTarget,
  fakeSubmitTarget,
  fakeUpdateTarget,
  resetTargetsFake,
} from './targets.fake';
import type { CreateTargetBody } from './targets.model';

// Contract: crm-app crm/dashboards/dashboard-sales-targets.controller.ts, dashboard-sales-targets.service.ts,
// dto/dashboard-sales-target.dto.ts, governance/targets/target-approval.service.ts and targets-approval.dto.ts.

const CAIRO = FAKE_BRANCHES[0].id;
const APPROVED_CLOSED = '01934c00-0000-7000-8000-000000000001'; // APPROVED, 2026-09, rev 3
const SUBMITTED_OPEN = '01934c00-0000-7000-8000-000000000006'; // SUBMITTED, 2026-12, rev 2
const SUBMITTED_CLOSED = '01934c00-0000-7000-8000-000000000010'; // SUBMITTED, 2026-10, rev 2
const DRAFT_OPEN = '01934c00-0000-7000-8000-000000000014'; // DRAFT, 2026-12, rev 1
const UNKNOWN = '01934c00-0000-7000-8000-0000000000ff';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.catch((error: unknown) => {
    throw error;
  });
  await vi.advanceTimersByTimeAsync(1000);
  return guarded;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const outcome = promise.then(
    () => {
      throw new Error('expected an ApiError');
    },
    (error: unknown) => {
      if (error instanceof ApiError) return error;
      throw error;
    },
  );
  await vi.advanceTimersByTimeAsync(1000);
  return outcome;
}

function createBody(overrides: Partial<CreateTargetBody> = {}): CreateTargetBody {
  return {
    subjectType: 'USER',
    branchId: CAIRO,
    subjectId: FAKE_PEOPLE[0].id,
    metricKey: 'crm.leads.created.count',
    periodGrain: 'MONTH',
    periodStart: '2027-01-01',
    targetValue: 40,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  resetTargetsFake();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('targets fake: list', () => {
  it('returns the flat page shape with decimal text values and backend labels', async () => {
    const page = await settle(fakeListTargets({ branchId: CAIRO, limit: 5 }));
    expect(Object.keys(page).sort()).toEqual(['hasNext', 'hasPrev', 'items', 'limit', 'page', 'total', 'totalPages']);
    const first = page.items[0];
    expect(typeof first.targetValue).toBe('string');
    expect(first.targetValue).toMatch(/^\d+\.\d{2}$/);
    expect(Array.isArray(first.subjects)).toBe(true);
    expect(first).toHaveProperty('metricLabel');
    expect(first).toHaveProperty('periodEndExclusive');
  });

  it('requires branchId (400 is_uuid)', async () => {
    const error = await rejection(fakeListTargets({ branchId: '' }));
    expect(error.status).toBe(400);
    expect(error.code).toBe('CRM_VALIDATION_FAILED');
    expect(error.details).toEqual({ branchId: ['is_uuid'] });
  });

  it('takes upper-case sortDir and rejects lower case (is_enum)', async () => {
    await settle(fakeListTargets({ branchId: CAIRO, sortDir: 'ASC' }));
    const error = await rejection(fakeListTargets({ branchId: CAIRO, sortDir: 'asc' as never }));
    expect(error.details).toEqual({ sortDir: ['is_enum'] });
  });

  it('rejects limit above 100 and reversed period bounds', async () => {
    expect((await rejection(fakeListTargets({ branchId: CAIRO, limit: 101 }))).details).toEqual({ limit: ['max'] });
    const reversed = await rejection(fakeListTargets({ branchId: CAIRO, periodFrom: '2026-12-01', periodTo: '2026-01-01' }));
    expect([reversed.status, reversed.code]).toEqual([422, 'CRM_TARGET_PERIOD_INVALID']);
  });

  it('does not clamp a page past the end (empty items, totalPages from the total)', async () => {
    const page = await settle(fakeListTargets({ branchId: CAIRO, page: 99, limit: 10 }));
    expect(page.items).toEqual([]);
    expect(page.page).toBe(99);
    expect(page.totalPages).toBe(Math.ceil(page.total / 10));
  });

  it('shows TEAM_SET heads in the branches of their member teams', async () => {
    const giza = await settle(fakeListTargets({ branchId: FAKE_BRANCHES[2].id, subjectType: 'TEAM_SET' }));
    const cairo = await settle(fakeListTargets({ branchId: CAIRO, subjectType: 'TEAM_SET' }));
    expect(giza.total).toBe(0);
    expect(cairo.total).toBe(1);
  });
});

describe('targets fake: read', () => {
  it('answers an unknown id with 403 BRANCH_CONTEXT_REQUIRED, which the UI treats as gone', async () => {
    const error = await rejection(fakeGetTarget(UNKNOWN));
    expect([error.status, error.code]).toEqual([403, 'BRANCH_CONTEXT_REQUIRED']);
    expect(isTargetGone(error)).toBe(true);
  });

  it('validates the id param (is_uuid)', async () => {
    expect((await rejection(fakeGetTarget('nope'))).details).toEqual({ id: ['is_uuid'] });
  });

  it('pages releases with pageInfo, newest first', async () => {
    const page = await settle(fakeListReleases(APPROVED_CLOSED));
    expect(page.items.map((r) => r.releaseNumber)).toEqual([2, 1]);
    expect(page.pageInfo.hasMore).toBe(false);
    expect(page.items[0]).toHaveProperty('legacyLastEditedAt', null);
    expect((await rejection(fakeListReleases(APPROVED_CLOSED, null, 101))).details).toEqual({ limit: ['max'] });
  });
});

describe('targets fake: create', () => {
  it('runs the pipe first: every failing property path with its constraints', async () => {
    const error = await rejection(
      fakeCreateTarget(createBody({ targetValue: Number.NaN, periodStart: '2027/01/01', teamIds: [FAKE_TEAMS[0].id] })),
    );
    expect(error.code).toBe('CRM_VALIDATION_FAILED');
    expect(error.details).toEqual({
      targetValue: ['is_number'],
      teamIds: ['array_min_size'],
      periodStart: ['matches', 'is_date_string'],
    });
  });

  it('checks metric, value, currency, period, then subject, in the service order', async () => {
    const metric = await rejection(fakeCreateTarget(createBody({ metricKey: 'crm.opportunities.won.value' })));
    expect(metric.code).toBe('CRM_TARGET_METRIC_NOT_TARGETABLE');
    const value = await rejection(fakeCreateTarget(createBody({ targetValue: 1.5 })));
    expect(value.code).toBe('CRM_TARGET_VALUE_INVALID');
    const currency = await rejection(fakeCreateTarget(createBody({ currencyCode: 'EGP' })));
    expect(currency.code).toBe('CRM_TARGET_CURRENCY_INVALID');
    const period = await rejection(fakeCreateTarget(createBody({ periodGrain: 'QUARTER', periodStart: '2027-02-01' })));
    expect(period.code).toBe('CRM_TARGET_PERIOD_INVALID');
    const subject = await rejection(fakeCreateTarget(createBody({ subjectId: FAKE_PEOPLE.find((p) => p.branchId !== CAIRO)!.id })));
    expect(subject.code).toBe('CRM_TARGET_SUBJECT_INVALID');
  });

  it('needs branchId and subjectId for single subjects and teamIds only for TEAM_SET', async () => {
    const noBranch = await rejection(fakeCreateTarget(createBody({ branchId: undefined })));
    expect(noBranch.code).toBe('CRM_TARGET_SUBJECT_INVALID');
    const setWithBranch = await rejection(
      fakeCreateTarget(createBody({ subjectType: 'TEAM_SET', subjectId: undefined, teamIds: [FAKE_TEAMS[0].id, FAKE_TEAMS[2].id] })),
    );
    expect(setWithBranch.code).toBe('CRM_TARGET_TEAM_SET_INVALID');
  });

  it('creates a DRAFT at revision 1 and refuses the same tuple (409)', async () => {
    const created = await settle(fakeCreateTarget(createBody()));
    expect(created).toMatchObject({ approvalState: 'DRAFT', revision: 1, targetValue: '40.00', unit: 'COUNT', subjects: [] });
    const duplicate = await rejection(fakeCreateTarget(createBody()));
    expect([duplicate.status, duplicate.code]).toEqual([409, 'CRM_TARGET_DUPLICATE']);
  });
});

describe('targets fake: update, delete, submit, reject', () => {
  it('needs a revision (400 CRM_DASHBOARD_REVISION_MISMATCH) and checks it after authority', async () => {
    expect((await rejection(fakeUpdateTarget(DRAFT_OPEN, { targetValue: 20 }))).code).toBe('CRM_DASHBOARD_REVISION_MISMATCH');
    expect((await rejection(fakeUpdateTarget(UNKNOWN, { revision: 1, targetValue: 20 }))).code).toBe('BRANCH_CONTEXT_REQUIRED');
    expect((await rejection(fakeUpdateTarget(DRAFT_OPEN, { revision: 9, targetValue: 20 }))).code).toBe('CRM_TARGET_REVISION_CONFLICT');
  });

  it('locks a SUBMITTED value only when it changes', async () => {
    const locked = await rejection(fakeUpdateTarget(SUBMITTED_OPEN, { revision: 2, targetValue: 1 }));
    expect(locked.code).toBe('CRM_TARGET_LOCKED_SUBMITTED');
    const same = await settle(fakeUpdateTarget(SUBMITTED_OPEN, { revision: 2, targetValue: 1_400_000 }));
    expect(same).toMatchObject({ revision: 3, approvalState: 'SUBMITTED' });
  });

  it('drops a changed APPROVED head to DRAFT', async () => {
    const updated = await settle(fakeUpdateTarget(APPROVED_CLOSED, { revision: 3, targetValue: 1_900_000 }));
    expect(updated).toMatchObject({ revision: 4, approvalState: 'DRAFT', targetValue: '1900000.00' });
  });

  it('deletes with an optional revision, then the id reads as gone', async () => {
    expect((await rejection(fakeDeleteTarget(DRAFT_OPEN, 5))).code).toBe('CRM_TARGET_REVISION_CONFLICT');
    await settle(fakeDeleteTarget(DRAFT_OPEN));
    expect((await rejection(fakeGetTarget(DRAFT_OPEN))).code).toBe('BRANCH_CONTEXT_REQUIRED');
  });

  it('submits a DRAFT and answers LOCKED_SUBMITTED for a submitted one', async () => {
    expect((await rejection(fakeSubmitTarget(SUBMITTED_OPEN, { revision: 2 }))).code).toBe('CRM_TARGET_LOCKED_SUBMITTED');
    expect((await rejection(fakeSubmitTarget(APPROVED_CLOSED, { revision: 3 }))).code).toBe('CRM_TARGET_NOT_DRAFT');
    const submitted = await settle(fakeSubmitTarget(DRAFT_OPEN, { revision: 1 }));
    expect(submitted).toMatchObject({ approvalState: 'SUBMITTED', revision: 2, reviewNote: null });
  });

  it('checks the revision before the reject note, and keeps the submitter on reject', async () => {
    expect((await rejection(fakeRejectTarget(SUBMITTED_OPEN, { note: '' }))).code).toBe('CRM_DASHBOARD_REVISION_MISMATCH');
    expect((await rejection(fakeRejectTarget(SUBMITTED_OPEN, { revision: 2, note: '  ' }))).code).toBe(
      'CRM_TARGET_REJECT_NOTE_REQUIRED',
    );
    const rejected = await settle(fakeRejectTarget(SUBMITTED_OPEN, { revision: 2, note: 'Too high' }));
    expect(rejected).toMatchObject({ approvalState: 'DRAFT', revision: 3, reviewNote: 'Too high' });
    expect(rejected.submittedByUserId).not.toBeNull();
  });

  it('rejects a note over 500 characters in the pipe', async () => {
    const error = await rejection(fakeRejectTarget(SUBMITTED_OPEN, { revision: 2, note: 'x'.repeat(501) }));
    expect(error.details).toEqual({ note: ['max_length'] });
    expect(targetFieldErrors(error)).toEqual({ note: ['max_length'] });
  });
});

describe('targets fake: approve and corrections (x-idempotency-key)', () => {
  it('enforces the Gateway key before anything else', async () => {
    expect((await rejection(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2 }, ''))).code).toBe('GW.IDEM.MISSING');
    expect((await rejection(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2 }, 'abc'))).code).toBe('GW.IDEM.BAD_VALUE');
    expect((await rejection(fakeCorrectTarget(APPROVED_CLOSED, { revision: 3, value: 1 }, ''))).code).toBe('GW.IDEM.MISSING');
  });

  it('approves at the same revision with a REVIEWED release', async () => {
    const result = await settle(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2, note: ' ok ' }, newIdempotencyKey()));
    expect(result.target).toMatchObject({ approvalState: 'APPROVED', revision: 2, reviewNote: 'ok' });
    expect(result.release).toMatchObject({ approvalBasis: 'REVIEWED', headRevision: 2, targetValue: '1400000.00' });
    expect(result.target.latestRelease?.id).toBe(result.release.id);
  });

  it('replays the same key and body, and refuses the same key with another body (422)', async () => {
    const key = newIdempotencyKey();
    const first = await settle(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2 }, key));
    const replay = await settle(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2 }, key));
    expect(replay.release.id).toBe(first.release.id);
    const reused = await rejection(fakeApproveTarget(SUBMITTED_OPEN, { revision: 2, note: 'x' }, key));
    expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);
  });

  it('stores nothing on failure, so a retry with the same key runs again', async () => {
    const key = newIdempotencyKey();
    expect((await rejection(fakeApproveTarget(SUBMITTED_CLOSED, { revision: 2 }, key))).code).toBe('CRM_TARGET_PERIOD_CLOSED');
    expect((await rejection(fakeApproveTarget(SUBMITTED_CLOSED, { revision: 2 }, key))).code).toBe('CRM_TARGET_PERIOD_CLOSED');
  });

  it('approve answers NOT_SUBMITTED for a draft', async () => {
    expect((await rejection(fakeApproveTarget(DRAFT_OPEN, { revision: 1 }, newIdempotencyKey()))).code).toBe(
      'CRM_TARGET_NOT_SUBMITTED',
    );
  });

  it('corrections: revision, then reason, then period and value', async () => {
    const key = newIdempotencyKey();
    expect((await rejection(fakeCorrectTarget(APPROVED_CLOSED, { value: 1, reason: 'r' }, key))).code).toBe(
      'CRM_DASHBOARD_REVISION_MISMATCH',
    );
    expect((await rejection(fakeCorrectTarget(APPROVED_CLOSED, { revision: 3, value: 1 }, key))).code).toBe(
      'CRM_TARGET_CORRECTION_REASON_REQUIRED',
    );
    expect((await rejection(fakeCorrectTarget(SUBMITTED_OPEN, { revision: 2, value: 1, reason: 'r' }, newIdempotencyKey()))).code).toBe(
      'CRM_TARGET_PERIOD_OPEN',
    );
    expect(
      (await rejection(fakeCorrectTarget(APPROVED_CLOSED, { revision: 3, value: 1_850_000, reason: 'r' }, newIdempotencyKey()))).code,
    ).toBe('CRM_TARGET_VALUE_INVALID');
  });

  it('corrects an APPROVED head (+1 revision) and a SUBMITTED one (+2) with a CORRECTION release', async () => {
    const approved = await settle(fakeCorrectTarget(APPROVED_CLOSED, { revision: 3, value: 1_900_000, reason: 'Re-split' }, newIdempotencyKey()));
    expect(approved.target).toMatchObject({ approvalState: 'APPROVED', revision: 4, targetValue: '1900000.00' });
    expect(approved.release).toMatchObject({ approvalBasis: 'CORRECTION', headRevision: 4, correctionReason: 'Re-split', releaseNumber: 3 });

    const submitted = await settle(fakeCorrectTarget(SUBMITTED_CLOSED, { revision: 2, value: 420_000, reason: 'Late deal' }, newIdempotencyKey()));
    expect(submitted.target).toMatchObject({ approvalState: 'APPROVED', revision: 4 });
    expect(submitted.release.headRevision).toBe(4);
  });
});
