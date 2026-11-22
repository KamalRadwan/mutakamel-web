import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelBulkJob,
  getBulkJob,
  listBulkJobItems,
  retryBulkJob,
  submitBulkJob,
} from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BulkJob, BulkJobItem, BulkJobSubmit, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { fakeListReasons } from '../../settings/reasons/reasons.fake';
import { fakeSelectLeads } from '../leads.fake';
import { CRM_LEADS_FAKE_BULK_MODULE, FAKE_CRM_LEADS_BULK } from './leads-bulk.fake-module';

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

let keyCounter = 0;
const nextKey = () => `0190a1b2-c3d4-7e5f-8a9b-${String(++keyCounter).padStart(12, '0')}`;

const SCOPE = { branchId: 'b1' };

/** Backend CREATE_ACTIVITY schedule shape (crm-leads-bulk.schemas.ts). */
function schedule(startAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { startAt, gapMinutes: 15, order: 'TABLE', assignee: { mode: 'LEAD_OWNER' }, spacePerAssignee: true, ...extra };
}

const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString();

function submit(overrides: Partial<BulkJobSubmit> & Pick<BulkJobSubmit, 'action' | 'params'>): BulkJobSubmit {
  return {
    module: 'crm.leads',
    scope: SCOPE,
    selection: { kind: 'IDS', ids: ['lead-001', 'lead-002', 'lead-003'] },
    ...overrides,
  };
}

async function finish(jobId: string): Promise<BulkJob> {
  return settle(getBulkJob('crm', jobId));
}

/**
 * Submits and advances only the submit latency (300ms submit + 300ms selection lookup), so the
 * first 700ms chunk timer has not fired yet and the job is still QUEUED when this returns.
 */
async function submitQueued(body: BulkJobSubmit) {
  const pending = submitBulkJob('crm', body, nextKey());
  await vi.advanceTimersByTimeAsync(650);
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers();
  FAKE_CRM_LEADS_BULK.leadsDisabled = false;
});
afterEach(() => vi.useRealTimers());

describe('crm leads bulk worker job: submit validation', () => {
  it('rejects an unknown module', async () => {
    await expect(
      settle(submitBulkJob('crm', submit({ module: 'crm.nope', action: 'DELETE', params: {} }), nextKey())),
    ).rejects.toMatchObject({ code: 'BULK_JOB_MODULE_UNKNOWN' });
  });

  it('rejects an empty id selection', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: [] } }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('rejects ASSIGN without an owner', async () => {
    await expect(settle(submitBulkJob('crm', submit({ action: 'ASSIGN', params: {} }), nextKey()))).rejects.toMatchObject({
      code: 'BULK_JOB_PARAMS_INVALID',
    });
  });

  it('rejects ASSIGN to an owner outside the branch', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({ action: 'ASSIGN', params: { ownerUserId: 'u3' }, scope: { branchId: 'b4' } }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'CRM_SCOPED_PERMISSION_DENIED' });
  });

  it('rejects MOVE_STAGE into Converted', async () => {
    await expect(
      settle(submitBulkJob('crm', submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-converted' } }), nextKey())),
    ).rejects.toMatchObject({ code: 'LEAD_CONVERSION_REQUIRED' });
  });

  it('rejects MOVE_STAGE into Disqualified without a reason', async () => {
    await expect(
      settle(submitBulkJob('crm', submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-disqualified' } }), nextKey())),
    ).rejects.toMatchObject({ code: 'CRM_REASON_REQUIRED' });
  });

  it('rejects CREATE_ACTIVITY with a start time in the past', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({
            action: 'CREATE_ACTIVITY',
            params: {
              activity: { type: 'CALL', subject: 'Follow up' },
              schedule: schedule('2000-01-01T00:00:00.000Z'),
            },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'LEAD_BULK_START_IN_PAST' });
  });

  it('rejects CREATE_ACTIVITY without a subject', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({
            action: 'CREATE_ACTIVITY',
            params: { activity: { type: 'CALL', subject: ' ' }, schedule: schedule(FUTURE()) },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it.each([
    ['the old flat assigneeMode shape', { assignee: undefined, assigneeMode: 'owner' }],
    ['the old assigneeUserId key', { assignee: undefined, assigneeMode: 'other', assigneeUserId: 'u3' }],
    ['a USER assignee without userId', { assignee: { mode: 'USER' } }],
    ['an unknown assignee key', { assignee: { mode: 'ME', userId: 'u3' } }],
    ['a lowercase order', { order: 'table' }],
    ['a missing spacePerAssignee', { spacePerAssignee: undefined }],
  ])('rejects CREATE_ACTIVITY with %s', async (_label, extra) => {
    const body = schedule(FUTURE(), extra);
    for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({ action: 'CREATE_ACTIVITY', params: { activity: { type: 'CALL', subject: 'Follow up' }, schedule: body } }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('accepts CREATE_ACTIVITY with schedule.assignee USER and assigns every item to that user', async () => {
    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'CREATE_ACTIVITY',
          params: {
            activity: { type: 'CALL', subject: 'Follow up' },
            schedule: schedule(FUTURE(), { order: 'OWNER', assignee: { mode: 'USER', userId: 'u3' }, spacePerAssignee: false }),
          },
        }),
        nextKey(),
      ),
    );
    const job = await finish(result.jobId);
    expect(job.processed).toBe(job.total);
    expect(job.counts.failed).toBe(0);
  });

  it('refuses every submit while leads are disabled', async () => {
    FAKE_CRM_LEADS_BULK.leadsDisabled = true;

    await expect(settle(submitBulkJob('crm', submit({ action: 'DELETE', params: {} }), nextKey()))).rejects.toMatchObject({
      status: 403,
      code: 'CRM_LEADS_DISABLED',
      details: { companyId: [] },
    });
  });

  it('rejects a submit without a branch scope (BRANCH scope rule)', async () => {
    await expect(
      settle(submitBulkJob('crm', submit({ action: 'DELETE', params: {}, scope: {} }), nextKey())),
    ).rejects.toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('rejects a QUERY whose search has no branchId', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({ action: 'DELETE', params: {}, selection: { kind: 'QUERY', query: { search: {} } } }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('rejects a QUERY with keys outside { search, sort }', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({
            action: 'DELETE',
            params: {},
            selection: { kind: 'QUERY', query: { search: { branchId: 'b1' }, page: 1 } },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('refuses a QUERY whose search.branchId differs from the scope branch', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({
            action: 'DELETE',
            params: {},
            selection: { kind: 'QUERY', query: { search: { branchId: 'b4' } } },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'CRM_SCOPED_PERMISSION_DENIED' });
  });

  it('rejects the removed skipConverted param (strict params schema)', async () => {
    await expect(
      settle(
        submitBulkJob('crm', submit({ action: 'ASSIGN', params: { ownerUserId: 'u1', skipConverted: false } }), nextKey()),
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('answers an unknown stage with LEAD_CONVERSION_REQUIRED', async () => {
    await expect(
      settle(submitBulkJob('crm', submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-nope' } }), nextKey())),
    ).rejects.toMatchObject({ status: 422, code: 'LEAD_CONVERSION_REQUIRED' });
  });

  it('rejects MOVE_STAGE into Disqualified with a reason that is not a governed disqualification reason', async () => {
    const [loss] = await settle(fakeListReasons('LOSS', true));
    expect(loss).toBeDefined();
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-disqualified', reasonId: loss.id } }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'CRM_REASON_REQUIRED' });
  });

  it('accepts MOVE_STAGE into Disqualified with a governed disqualification reason', async () => {
    const [reason] = await settle(fakeListReasons('DISQUALIFICATION', true));
    const result = await settle(
      submitBulkJob(
        'crm',
        submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-disqualified', reasonId: reason.id } }),
        nextKey(),
      ),
    );
    await finish(result.jobId);
  });

  it('rejects an unknown action', async () => {
    await expect(settle(submitBulkJob('crm', submit({ action: 'EXPLODE', params: {} }), nextKey()))).rejects.toMatchObject({
      code: 'BULK_JOB_PARAMS_INVALID',
    });
  });
});

describe('crm leads bulk worker job: lifecycle', () => {
  it('queues a job, then runs it to a terminal state with item results', async () => {
    const result = await settle(
      submitBulkJob('crm', submit({ action: 'MOVE_STAGE', params: { stageId: 'stage-qualified' } }), nextKey()),
    );

    expect(result.total).toBe(3);
    expect(['QUEUED', 'COMPLETED', 'COMPLETED_WITH_ERRORS']).toContain(result.status);

    const job = await finish(result.jobId);
    expect(isBulkJobActive(job.status)).toBe(false);
    expect(job.processed).toBe(job.total);
    const counts = job.counts;
    expect(counts.succeeded + counts.unchanged + counts.skipped + counts.failed + counts.cancelled).toBe(3);
  });

  it('replays the original submit result for the same idempotency key', async () => {
    const key = nextKey();
    const first = await settle(submitBulkJob('crm', submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['lead-missing-x'] } }), key));
    const second = await settle(submitBulkJob('crm', submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['lead-missing-x'] } }), key));

    expect(second.jobId).toBe(first.jobId);
  });

  it('refuses a second submit while a job is still active', async () => {
    const first = await submitQueued(submit({ action: 'ASSIGN', params: { ownerUserId: 'u1' } }));
    expect(first.status).toBe('QUEUED');

    const second = submitBulkJob(
      'crm',
      submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['lead-missing-y'] } }),
      nextKey(),
    ).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(300);

    expect(await second).toMatchObject({ status: 409, code: 'BULK_JOB_ACTIVE' });
    await finish(first.jobId);
  });

  it('marks unknown ids as failed at submit with LEAD_NOT_FOUND and finishes with errors', async () => {
    const result = await settle(
      submitBulkJob(
        'crm',
        submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['lead-missing-z'] } }),
        nextKey(),
      ),
    );

    expect(result.failedAtSubmit).toBe(1);
    expect(result.status).toBe('COMPLETED_WITH_ERRORS');
    const items = await settle(listBulkJobItems('crm', result.jobId, { page: 1, limit: 10 }));
    expect(items.items[0]).toMatchObject({ entityId: 'lead-missing-z', status: 'FAILED', code: 'LEAD_NOT_FOUND' });
  });

  it('skips converted leads on MOVE_STAGE at submit time', async () => {
    const converted = (await settle(fakeSelectLeads({ branchId: 'b1', filterTree: { field: 'status', operator: 'eq', value: 'CONVERTED' } }, 5)))
      .items[0];
    expect(converted).toBeDefined();

    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'MOVE_STAGE',
          params: { stageId: 'stage-qualified' },
          selection: { kind: 'IDS', ids: [converted.id] },
        }),
        nextKey(),
      ),
    );

    expect(result.skippedAtSubmit).toBe(1);
    expect(result.status).toBe('COMPLETED');
  });

  it('resolves a QUERY selection and honours excluded ids', async () => {
    const all = await settle(fakeSelectLeads({ branchId: 'b1' }, 10000));
    const excluded = all.items.slice(0, 2).map((row) => row.id);

    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'ASSIGN',
          params: { ownerUserId: 'u1' },
          selection: { kind: 'QUERY', query: { search: { branchId: 'b1' } }, excludedIds: excluded },
        }),
        nextKey(),
      ),
    );

    expect(result.total).toBe(all.total - 2);
    await finish(result.jobId);
  });

  it('splits CREATE_ACTIVITY into chunks of twenty and reports chunk progress', async () => {
    const all = await settle(fakeSelectLeads({ branchId: 'b1' }, 10000));
    const ids = all.items.map((row) => row.id);
    expect(ids.length).toBeGreaterThan(40);

    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'CREATE_ACTIVITY',
          params: {
            activity: { type: 'CALL', subject: 'Follow up' },
            schedule: schedule(FUTURE()),
          },
          selection: { kind: 'IDS', ids },
        }),
        nextKey(),
      ),
    );
    expect(result.chunkCount).toBe(Math.ceil(ids.length / 20));

    const job = await finish(result.jobId);
    expect(job.chunksDone).toBe(result.chunkCount);
    expect(job.processed).toBe(job.total);
  });

  it('cancelling a queued job cancels all pending items', async () => {
    const result = await submitQueued(submit({ action: 'ASSIGN', params: { ownerUserId: 'u1' } }));
    expect(result.status).toBe('QUEUED');

    const cancelled = await settle(cancelBulkJob('crm', result.jobId));

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.counts.cancelled).toBe(3);
  });

  it('retry nothing-to-retry is a 422 when the job had no failures', async () => {
    const result = await settle(
      submitBulkJob('crm', submit({ action: 'ASSIGN', params: { ownerUserId: 'u1' } }), nextKey()),
    );
    const job = await finish(result.jobId);
    expect(job.counts.failed).toBe(0);

    await expect(settle(retryBulkJob('crm', result.jobId, null, nextKey()))).rejects.toMatchObject({
      code: 'BULK_JOB_NOTHING_TO_RETRY',
    });
  });

  it('retry resubmits only the failed ids', async () => {
    const failed = await settle(
      submitBulkJob(
        'crm',
        submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['lead-missing-r1', 'lead-missing-r2'] } }),
        nextKey(),
      ),
    );
    expect(failed.failedAtSubmit).toBe(2);

    const retried = await settle(retryBulkJob('crm', failed.jobId, null, nextKey()));

    expect(retried.total).toBe(2);
    expect(retried.jobId).not.toBe(failed.jobId);
  });

  it('returns 404 for an unknown job', async () => {
    await expect(settle(getBulkJob('crm', 'job-nope'))).rejects.toMatchObject({ code: 'BULK_JOB_NOT_FOUND' });
  });
});

describe('crm leads bulk worker job: execution', () => {
  const job = (action: string): BulkJob => ({ id: 'job-x', action, scope: { branchId: 'b1' } }) as unknown as BulkJob;
  const item = (entityId: string, ordinal = 1): BulkJobItem => ({ ordinal, entityId, label: entityId, status: 'PENDING' });

  it.each(['ASSIGN', 'MOVE_STAGE'])('fails a lead converted after submit with LEAD_ALREADY_CONVERTED on %s', async (action) => {
    const converted = (
      await settle(fakeSelectLeads({ branchId: 'b1', filterTree: { field: 'status', operator: 'eq', value: 'CONVERTED' } }, 5))
    ).items[0];
    const params = action === 'ASSIGN' ? { ownerUserId: 'u1' } : { stageId: 'stage-qualified', reasonId: null };

    const results = await settle(CRM_LEADS_FAKE_BULK_MODULE.executeChunk(job(action), params, [item(converted.id)]));

    expect(results).toEqual([{ ordinal: 1, status: 'FAILED', code: 'LEAD_ALREADY_CONVERTED' }]);
  });

  it('fails every item when the stage is no longer valid at execution', async () => {
    const results = await settle(
      CRM_LEADS_FAKE_BULK_MODULE.executeChunk(job('MOVE_STAGE'), { stageId: 'stage-converted' }, [item('lead-001', 1), item('lead-002', 2)]),
    );

    expect(results).toEqual([
      { ordinal: 1, status: 'FAILED', code: 'LEAD_CONVERSION_REQUIRED' },
      { ordinal: 2, status: 'FAILED', code: 'LEAD_CONVERSION_REQUIRED' },
    ]);
  });
});
