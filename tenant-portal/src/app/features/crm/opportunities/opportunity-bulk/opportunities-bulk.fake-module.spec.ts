import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBulkJobsFake } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import { fakeGetBulkJob as getBulkJob, fakeListBulkJobItems as listBulkJobItems, fakeSubmitBulkJob as submitBulkJob } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import type { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { toOpportunitySelectionRequest } from '../opportunities.api';
import {
  RENEWALS_PIPELINE_ID,
  SALES_PIPELINE_ID,
  fakeListPipelines,
  fakeListStageHistory,
  fakeSelectOpportunities,
} from '../opportunities.fake';
import { buildMoveStageBulkJob, moveStageParamsFor } from './bulk-runner';
import { FAKE_CRM_OPPORTUNITIES_BULK } from './opportunities-bulk.fake-module';

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

const BRANCH = 'b1';

function submit(overrides: Partial<BulkJobSubmit> & Pick<BulkJobSubmit, 'action' | 'params'>): BulkJobSubmit {
  return {
    module: 'crm.opportunities',
    scope: { branchId: BRANCH },
    selection: { kind: 'IDS', ids: [] },
    ...overrides,
  };
}

async function salesOpenStageId(): Promise<string> {
  const pipelines = await settle(fakeListPipelines());
  const sales = pipelines.find((p) => p.id === SALES_PIPELINE_ID)!;
  return sales.stages.find((s) => s.isActive && s.flag !== 'WON' && s.flag !== 'LOST')!.id;
}

beforeEach(() => {
  resetBulkJobsFake();
  vi.useFakeTimers();
  FAKE_CRM_OPPORTUNITIES_BULK.opportunitiesDisabled = false;
});
afterEach(() => vi.useRealTimers());

describe('crm opportunities bulk worker job: backend alignment', () => {
  it('refuses a QUERY whose branchId differs from the job scope with CRM_SCOPED_PERMISSION_DENIED', async () => {
    await expect(
      settle(
        submitBulkJob(
          'crm',
          submit({
            action: 'ASSIGN',
            params: { ownerUserId: 'u1' },
            selection: { kind: 'QUERY', query: { branchId: 'b2' } },
          }),
          nextKey(),
        ),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'CRM_SCOPED_PERMISSION_DENIED' });
  });

  it('marks MOVE_STAGE items of another pipeline as SKIPPED at submit with OPPORTUNITY_PIPELINE_MISMATCH', async () => {
    const renewal = (
      await settle(
        fakeSelectOpportunities(
          { branchId: BRANCH, filterTree: { field: 'pipelineId', operator: 'eq', value: RENEWALS_PIPELINE_ID } },
          5,
        ),
      )
    ).items[0];
    expect(renewal).toBeDefined();
    const stageId = await salesOpenStageId();

    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'MOVE_STAGE',
          params: { pipelineId: SALES_PIPELINE_ID, stageId },
          selection: { kind: 'IDS', ids: [renewal.id] },
        }),
        nextKey(),
      ),
    );

    expect(result.skippedAtSubmit).toBe(1);
    const items = await settle(listBulkJobItems('crm', result.jobId, { page: 1, limit: 10 }));
    expect(items.items[0]).toMatchObject({
      entityId: renewal.id,
      status: 'SKIPPED',
      code: 'OPPORTUNITY_PIPELINE_MISMATCH',
    });
  });

  it('gives a missing id an empty label, not the id', async () => {
    const result = await settle(
      submitBulkJob(
        'crm',
        submit({ action: 'DELETE', params: {}, selection: { kind: 'IDS', ids: ['opp-missing-z'] } }),
        nextKey(),
      ),
    );

    expect(result.failedAtSubmit).toBe(1);
    const items = await settle(listBulkJobItems('crm', result.jobId, { page: 1, limit: 10 }));
    expect(items.items[0]).toMatchObject({ entityId: 'opp-missing-z', status: 'FAILED', code: 'OPPORTUNITY_NOT_FOUND' });
    expect(items.items[0].label).toBe('');
  });
});

describe('stage modal: the note on a normal stage', () => {
  it('keeps the typed note as reason on a normal stage, trimmed, and drops an empty one', () => {
    const stage = { id: 'st-1', flag: 'PROPOSAL' };
    const params = moveStageParamsFor(stage, SALES_PIPELINE_ID, 'ignored-reason', '  call back next week  ');
    expect(params).toEqual({ pipelineId: SALES_PIPELINE_ID, stageId: 'st-1', reason: 'call back next week' });
    expect(buildMoveStageBulkJob(BRANCH, { kind: 'IDS', ids: ['x'] }, params).params).toEqual({
      pipelineId: SALES_PIPELINE_ID,
      stageId: 'st-1',
      reason: 'call back next week',
    });
    expect(moveStageParamsFor(stage, SALES_PIPELINE_ID, '', '   ')).toEqual({
      pipelineId: SALES_PIPELINE_ID,
      stageId: 'st-1',
    });
  });

  it('keeps WON and LOST params unchanged', () => {
    expect(moveStageParamsFor({ id: 'w', flag: 'WON' }, 'p', 'r1', 'n')).toEqual({
      pipelineId: 'p', stageId: 'w', winReasonId: 'r1', reason: 'n',
    });
    expect(moveStageParamsFor({ id: 'l', flag: 'LOST' }, 'p', '', 'n')).toEqual({
      pipelineId: 'p', stageId: 'l', lostReason: 'n',
    });
  });

  it('the worker job moves the opportunity and stores the note on its stage history', async () => {
    const pipelines = await settle(fakeListPipelines());
    const sales = pipelines.find((p) => p.id === SALES_PIPELINE_ID)!;
    const open = (
      await settle(
        fakeSelectOpportunities(
          { branchId: BRANCH, filterTree: { field: 'pipelineId', operator: 'eq', value: SALES_PIPELINE_ID } },
          50,
        ),
      )
    ).items.find((row) => row.status === 'IN_PROGRESS')!;
    expect(open).toBeDefined();
    const target = sales.stages.find(
      (s) => s.isActive && s.flag !== 'WON' && s.flag !== 'LOST' && s.id !== open.stageId,
    )!;

    const result = await settle(
      submitBulkJob(
        'crm',
        submit({
          action: 'MOVE_STAGE',
          params: buildMoveStageBulkJob(
            BRANCH,
            { kind: 'IDS', ids: [open.id] },
            moveStageParamsFor(target, SALES_PIPELINE_ID, '', 'bulk note'),
          ).params,
          selection: { kind: 'IDS', ids: [open.id] },
        }),
        nextKey(),
      ),
    );
    await settle(getBulkJob('crm', result.jobId));
    const items = await settle(listBulkJobItems('crm', result.jobId, { page: 1, limit: 10 }));
    expect(items.items[0]).toMatchObject({ entityId: open.id, status: 'SUCCEEDED' });

    const history = await settle(fakeListStageHistory(open.id, null));
    expect(history.items.find((h) => h.toStageId === target.id)?.reason).toBe('bulk note');
  });
});

describe('selectOpportunities: POST /opportunities/selection shape', () => {
  it('sends the search filters plus limit, never a page', () => {
    const body = { branchId: BRANCH, search: 'acme', sort: 'title:ASC', page: 3 } as Parameters<
      typeof toOpportunitySelectionRequest
    >[0];
    expect(toOpportunitySelectionRequest(body, 500)).toEqual({
      branchId: BRANCH,
      search: 'acme',
      sort: 'title:ASC',
      limit: 500,
    });
  });

  it('returns items, total and truncated from the fake in fake mode', async () => {
    const res = await settle(fakeSelectOpportunities({ branchId: BRANCH }, 1));
    expect(res.items).toHaveLength(1);
    expect(Object.keys(res.items[0]).sort()).toEqual(['id', 'ownerUserId', 'stageId', 'status', 'title', 'updatedAt']);
    expect(res.total).toBeGreaterThan(1);
    expect(res.truncated).toBe(true);
  });
});
