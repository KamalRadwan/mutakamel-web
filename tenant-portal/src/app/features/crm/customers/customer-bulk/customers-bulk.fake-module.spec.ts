import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBulkJob,
  listBulkJobItems,
  retryBulkJob,
  submitBulkJob,
} from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BulkJob, BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import {
  ACME_CUSTOMER_ID,
  CUSTOMERS_FAKE_DB,
  DEFAULT_CUSTOMER_BRANCH_ID,
  fakeSearchCustomers,
} from '../customers.fake';
import { fakeSelectCustomers } from './customer-bulk.api';
import { CUSTOMERS_BULK_MODULE_ID, CUSTOMER_SELECTION_LIMIT } from './customer-bulk.model';
import './customers-bulk.fake-module';

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
const nextKey = () => `0190c5d1-a1b2-7c3d-8e4f-${String(++keyCounter).padStart(12, '0')}`;
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString();

function makeSchedule(startAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    startAt,
    gapMinutes: 15,
    order: 'TABLE',
    assignee: { mode: 'LEAD_OWNER' },
    spacePerAssignee: true,
    ...extra,
  };
}

function submitReq(overrides: Partial<BulkJobSubmit> & Pick<BulkJobSubmit, 'action' | 'params'>): BulkJobSubmit {
  return {
    module: CUSTOMERS_BULK_MODULE_ID,
    scope: { branchId: DEFAULT_CUSTOMER_BRANCH_ID },
    selection: { kind: 'IDS', ids: [ACME_CUSTOMER_ID] },
    ...overrides,
  };
}

async function finish(jobId: string): Promise<BulkJob> {
  return settle(getBulkJob('crm', jobId));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('crm customers bulk fake module', () => {
  it('throws CUSTOMER_PROFILE_SELECTION_TOO_LARGE when selection preview limit > 10_000', async () => {
    await expect(
      settle(fakeSelectCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, undefined, CUSTOMER_SELECTION_LIMIT + 1)),
    ).rejects.toMatchObject({ code: 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE' });
  });

  it('rejects ACTIVE_CUSTOMER on SET_STATUS', async () => {
    await expect(
      settle(submitBulkJob('crm', submitReq({ action: 'SET_STATUS', params: { status: 'ACTIVE_CUSTOMER' } }), nextKey())),
    ).rejects.toMatchObject({ code: 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON' });
  });

  it('rejects past startAt and legacy flat assignee shapes on CREATE_ACTIVITY', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submitReq({
            action: 'CREATE_ACTIVITY',
            params: {
              activity: { type: 'CALL', subject: 'Follow up', durationMinutes: null },
              schedule: makeSchedule(new Date(Date.now() - 60_000).toISOString()),
            },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'CUSTOMER_BULK_START_IN_PAST' });

    await expect(
      settle(
        submitBulkJob(
          'crm',
          submitReq({
            action: 'CREATE_ACTIVITY',
            params: {
              activity: { type: 'CALL', subject: 'Follow up', durationMinutes: null },
              schedule: {
                startAt: FUTURE(),
                gapMinutes: 15,
                order: 'TABLE',
                assigneeMode: 'ME',
                spacePerAssignee: false,
              },
            },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('skips rows already at target status with UNCHANGED on SET_STATUS', async () => {
    const page = await settle(fakeSearchCustomers({ branchId: DEFAULT_CUSTOMER_BRANCH_ID }, 1, 20));
    const prospect = page.items.find((c) => c.status === 'PROSPECT');
    const inactive = page.items.find((c) => c.status === 'INACTIVE');
    expect(prospect).toBeDefined();

    const targetIds = [prospect!.id, ...(inactive ? [inactive.id] : [])];
    const submitted = await settle(
      submitBulkJob(
        'crm',
        submitReq({
          action: 'SET_STATUS',
          selection: { kind: 'IDS', ids: targetIds },
          params: { status: 'PROSPECT' },
        }),
        nextKey(),
      ),
    );
    const done = await finish(submitted.jobId);
    expect(done.counts.skipped).toBeGreaterThanOrEqual(1);
    const skipped = await settle(listBulkJobItems('crm', submitted.jobId, { status: 'SKIPPED', page: 1, limit: 50 }));
    expect(skipped.items.some((item) => item.entityId === prospect!.id && item.code === 'UNCHANGED')).toBe(true);
  });

  it('skips blacklisted rows on DELETE and fails ACME_CUSTOMER_ID with CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES', async () => {
    const blacklisted = CUSTOMERS_FAKE_DB.find((c) => c.branchId === DEFAULT_CUSTOMER_BRANCH_ID && c.status === 'BLACKLISTED');
    const ids = [ACME_CUSTOMER_ID, ...(blacklisted ? [blacklisted.id] : []), 'non-existent-customer-id'];

    const submitted = await settle(
      submitBulkJob(
        'crm',
        submitReq({
          action: 'DELETE',
          selection: { kind: 'IDS', ids },
          params: { reason: 'Cleanup' },
        }),
        nextKey(),
      ),
    );
    const done = await finish(submitted.jobId);
    expect(done.status).toBe('COMPLETED_WITH_ERRORS');

    const failed = await settle(listBulkJobItems('crm', submitted.jobId, { status: 'FAILED', page: 1, limit: 50 }));
    expect(failed.items.some((item) => item.entityId === ACME_CUSTOMER_ID && item.code === 'CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES')).toBe(true);
    expect(failed.items.some((item) => item.entityId === 'non-existent-customer-id' && item.code === 'CUSTOMER_PROFILE_NOT_FOUND')).toBe(true);

    if (blacklisted) {
      const skipped = await settle(listBulkJobItems('crm', submitted.jobId, { status: 'SKIPPED', page: 1, limit: 50 }));
      expect(skipped.items.some((item) => item.entityId === blacklisted.id && item.code === 'BLACKLISTED')).toBe(true);
    }
  });

  it('assigns via QUERY selection and respects excludedIds', async () => {
    const searchBody = { branchId: DEFAULT_CUSTOMER_BRANCH_ID, status: 'PROSPECT' as const };
    const matched = await settle(fakeSelectCustomers(searchBody, undefined, 10_000));
    expect(matched.items.length).toBeGreaterThanOrEqual(2);
    const excludedId = matched.items[0].id;

    const submitted = await settle(
      submitBulkJob(
        'crm',
        submitReq({
          action: 'ASSIGN',
          selection: {
            kind: 'QUERY',
            query: { search: searchBody, sort: 'createdAt:DESC' },
            excludedIds: [excludedId],
          },
          params: { ownerUserId: 'u2' },
        }),
        nextKey(),
      ),
    );
    const done = await finish(submitted.jobId);
    expect(done.total).toBe(matched.items.length - 1);
    expect(done.counts.succeeded).toBe(matched.items.length - 1);
    expect(done.paramsSummary['ownerName']).toBe('Mona Adel');
  });

  it('computes firstDueAt/lastDueAt summary for CREATE_ACTIVITY and supports START_AT retry', async () => {
    const startAt = FUTURE();
    const submitted = await settle(
      submitBulkJob(
        'crm',
        submitReq({
          action: 'CREATE_ACTIVITY',
          selection: { kind: 'IDS', ids: [ACME_CUSTOMER_ID] },
          params: {
            activity: { type: 'CALL', subject: 'Quarterly check-in', direction: 'OUTBOUND', durationMinutes: null },
            schedule: makeSchedule(startAt, { assignee: { mode: 'ME' }, order: 'OWNER', spacePerAssignee: false }),
          },
        }),
        nextKey(),
      ),
    );
    expect(submitted.summary?.['firstDueAt']).toBeTruthy();
    expect(submitted.summary?.['lastDueAt']).toBeTruthy();
    const done = await finish(submitted.jobId);
    expect(done.counts.succeeded).toBe(1);

    // Retry with START_AT override rejects when nothing failed cleanly.
    await expect(
      settle(retryBulkJob('crm', submitted.jobId, { startAt: FUTURE() }, nextKey())),
    ).rejects.toMatchObject({ code: 'BULK_JOB_NOTHING_TO_RETRY' });
  });
});
