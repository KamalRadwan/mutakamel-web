import { Component, Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../core/api/api-errors';
import { Notify } from '../../core/notify/notify';
import { CRM_LEADS_BULK_MODULE } from '../../features/crm/leads/lead-bulk/leads-bulk.descriptor';
import { CRM_OPPORTUNITIES_BULK_MODULE } from '../../features/crm/opportunities/opportunity-bulk/opportunities-bulk.descriptor';
import { TRADE_ACCOUNTS_BULK_MODULE } from '../../features/trade/foundation/commercial-accounts/account-bulk/accounts-bulk.descriptor';
import { TRADE_ITEMS_BULK_MODULE } from '../../features/trade/foundation/items/item-bulk/items-bulk.descriptor';
import { submitItemsBulkJob } from '../../features/trade/foundation/items/item-bulk/item-bulk.model';
import { type BulkJobModuleDescriptor, provideBulkJobModules } from './bulk-job-modules';
import { FAKE_BULK, type FakeBulkModule, fakeBulkJobsTransport, fakeCancelBulkJob, fakeListBulkJobs, fakeSubmitBulkJob, registerFakeBulkModule, resetBulkJobsFake } from './bulk-jobs.fake';
import { BulkJobsTracker } from './bulk-jobs-tracker';
import { submitBulkJob } from './bulk-jobs.api';
import type { BulkJob, BulkJobItem, BulkJobItemStatus, BulkJobSubmit } from './bulk-jobs.model';

/*
 * The test setup binds the function facade to the fixture transport. The separate API spec exercises
 * the injected HTTP service. A test-only module on app 'core' records fixture calls through vi.fn hooks.
 */

const TEST_MODULE = 'core.bulk-test';
const OTHER_MODULE = 'core.bulk-other';

const TEST_DESCRIPTOR: BulkJobModuleDescriptor = {
  app: 'core',
  module: TEST_MODULE,
  i18nScopes: [],
  actions: { RUN: { titleKey: 'bt.run', icon: 'tablerCheck', tone: 'blue', succeededKey: 'bt.ok' } },
  codeKeyPrefixes: ['bt.codes.'],
  selectFailedRoute: (job) => ({ commands: ['/test'], queryParams: { bulkJob: job.id, bulkApp: 'core', select: 'failed' } }),
};

const OTHER_DESCRIPTOR: BulkJobModuleDescriptor = { ...TEST_DESCRIPTOR, module: OTHER_MODULE };

const hooks = {
  chunkSize: 1,
  validate: vi.fn<(body: BulkJobSubmit) => void>(),
  validateAsync: vi.fn<(body: BulkJobSubmit) => Promise<void>>(),
  resolve: vi.fn<(body: BulkJobSubmit) => void>(),
  executeChunk: vi.fn<(items: BulkJobItem[]) => void | Promise<void>>(),
};

function testModule(module: string): FakeBulkModule {
  return {
    module,
    chunkSize: () => hooks.chunkSize,
    validate: (body) => hooks.validate(body),
    validateAsync: async (body) => {
      await hooks.validateAsync(body);
    },
    resolve: async (body) => {
      hooks.resolve(body);
      const ids = body.selection.kind === 'IDS' ? body.selection.ids : [];
      return ids.map((id) => ({
        entityId: id,
        label: `Record ${id}`,
        ...(id.startsWith('skip-') ? { preStatus: 'SKIPPED' as const, code: 'BT_SKIPPED' } : {}),
      }));
    },
    executeChunk: async (_job, _params, items) => {
      await hooks.executeChunk(items);
      return items.map((item) => {
        const status: BulkJobItemStatus = item.entityId.startsWith('fail-')
          ? 'FAILED'
          : item.entityId.startsWith('same-')
            ? 'UNCHANGED'
            : 'SUCCEEDED';
        return { ordinal: item.ordinal, status, ...(status === 'FAILED' ? { code: 'BT_FAILED' } : {}) };
      });
    },
    paramsSummary: () => ({}),
  };
}

registerFakeBulkModule('core', testModule(TEST_MODULE));
registerFakeBulkModule('core', testModule(OTHER_MODULE));
registerFakeBulkModule('trading', testModule('trading.items'));

const BULK_EN: Translation = {
  codes: {
    generic: 'Something went wrong.',
    BULK_JOB_CHUNK_STALLED: 'The batch stopped responding and was ended.',
  },
  toast: { started: 'Started', active: 'Already running', stopped: 'Stopped', partial: '{{ok}} done, {{failed}} failed.' },
};

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(path === 'bulk-jobs/en' ? BULK_EN : {});
  }
}

function body(ids: string[], module = TEST_MODULE): BulkJobSubmit {
  return { module, action: 'RUN', scope: {}, selection: { kind: 'IDS', ids }, params: { flag: true } };
}

function makeJob(overrides: Partial<BulkJob> = {}): BulkJob {
  return {
    id: 'job-1',
    app: 'crm',
    module: 'crm.leads',
    action: 'ASSIGN',
    scope: { branchId: 'b1' },
    status: 'RUNNING',
    total: 3,
    processed: 0,
    counts: { succeeded: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 },
    chunkCount: 1,
    chunksDone: 0,
    paramsSummary: {},
    createdAt: '2026-11-21T10:00:00.000Z',
    revision: 1,
    ...overrides,
  };
}

/** Advances fake time in small steps until the promise settles. */
async function settle<T>(promise: Promise<T>, maxMs = 2_000): Promise<T> {
  const state: { done: boolean; ok: boolean; value?: T; error?: unknown } = { done: false, ok: false };
  promise.then(
    (value) => Object.assign(state, { done: true, ok: true, value }),
    (error: unknown) => Object.assign(state, { done: true, ok: false, error }),
  );
  for (let t = 0; t < maxMs && !state.done; t += 10) {
    await vi.advanceTimersByTimeAsync(10);
  }
  if (!state.done) throw new Error('promise did not settle');
  if (!state.ok) throw state.error;
  return state.value as T;
}

let notify: Record<'info' | 'success' | 'warning' | 'error', ReturnType<typeof vi.fn>>;
let visibility: DocumentVisibilityState;

async function setup(extraProviders: unknown[] = []): Promise<BulkJobsTracker> {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en' }, loader: TestLoader }),
      provideBulkJobModules([
        TEST_DESCRIPTOR,
        OTHER_DESCRIPTOR,
        CRM_LEADS_BULK_MODULE,
        CRM_OPPORTUNITIES_BULK_MODULE,
        TRADE_ITEMS_BULK_MODULE,
        TRADE_ACCOUNTS_BULK_MODULE,
      ]),
      { provide: Notify, useValue: notify },
      ...(extraProviders as never[]),
    ],
  });
  const tracker = TestBed.inject(BulkJobsTracker);
  await vi.advanceTimersByTimeAsync(500); // restoreOnStart (fake list/get delays)
  return tracker;
}

/** Ends every fake job that is still active so the next test can submit (one active job per app). */
async function drainFakeJobs(): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const active = [
      ...(await settle(fakeListBulkJobs('core', { scope: 'active', page: 1, limit: 100 }))).items,
      ...(await settle(fakeListBulkJobs('trading', { scope: 'active', page: 1, limit: 100 }))).items,
    ];
    if (active.length === 0) return;
    for (const job of active) {
      await settle(fakeCancelBulkJob(job.app, job.id).catch(() => null));
    }
    await vi.advanceTimersByTimeAsync(FAKE_BULK.chunkMs + 10);
  }
}

beforeEach(() => {
  resetBulkJobsFake();
  vi.useFakeTimers();
  localStorage.clear();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  hooks.chunkSize = 1;
  hooks.validate.mockReset();
  hooks.validateAsync.mockReset();
  hooks.resolve.mockReset();
  hooks.executeChunk.mockReset();
  FAKE_BULK.chunkMs = 500;
  FAKE_BULK.stallAfterChunk = -1;
  FAKE_BULK.getFailures = 0;
});

afterEach(async () => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
  FAKE_BULK.getFailures = 0;
  await drainFakeJobs();
  FAKE_BULK.chunkMs = 700;
  FAKE_BULK.stallAfterChunk = -1;
  vi.useRealTimers();
  localStorage.clear();
});

describe('BulkJobsTracker: submit', () => {
  it('sends one submit per action: the server resolves the whole selection once', async () => {
    const tracker = await setup();
    const res = await settle(tracker.submit('core', body(['a', 'b', 'c'])));

    expect(hooks.validate).toHaveBeenCalledTimes(1);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
    expect(hooks.resolve.mock.calls[0][0]).toEqual(body(['a', 'b', 'c']));
    expect(tracker.hasActive('core', TEST_MODULE)).toBe(true);
    expect(tracker.jobs()[0].id).toBe(res.jobId);
    expect(notify.info).toHaveBeenCalledWith('Started');
  });

  it('uses a new idempotency key per new action (the fake replays a reused key, so a new job proves a new key)', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 10;
    const first = await settle(tracker.submit('core', body(['a'])));
    await vi.advanceTimersByTimeAsync(3_000);
    const second = await settle(tracker.submit('core', body(['a'])));

    expect(second.jobId).not.toBe(first.jobId);
    expect(hooks.resolve).toHaveBeenCalledTimes(2);
  });

  // Contract (bulk-jobs.api.ts): "same key on network retry, new key per new intent".
  it('reuses one idempotency key when the same intent is retried after a network failure', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    hooks.validate.mockImplementationOnce(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(settle(tracker.submit('core', body(['a']), { idempotencyKey: 'intent-1' }))).rejects.toBeInstanceOf(
      TypeError,
    );
    const first = await settle(tracker.submit('core', body(['a']), { idempotencyKey: 'intent-1' }));
    const replay = await settle(tracker.submit('core', body(['a']), { idempotencyKey: 'intent-1' }));

    expect(replay.jobId).toBe(first.jobId);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
    expect(notify.warning).not.toHaveBeenCalled();
    expect(tracker.activeCount()).toBe(1);
  });

  it('does not loop per record in the browser: one submit for 1,000 ids, chunking happens server side', async () => {
    const tracker = await setup();
    hooks.chunkSize = 100;
    FAKE_BULK.chunkMs = 10;
    const ids = Array.from({ length: 1_000 }, (_, i) => `r-${i}`);

    await settle(tracker.submit('core', body(ids)));
    await vi.advanceTimersByTimeAsync(5_000);

    expect(hooks.resolve).toHaveBeenCalledTimes(1);
    expect(hooks.executeChunk).toHaveBeenCalledTimes(10);
    expect(tracker.jobs()[0]).toMatchObject({ status: 'COMPLETED', total: 1_000, processed: 1_000 });
  });

  it('a job that ends at submit (every item skipped) is finished at once and never polled', async () => {
    const tracker = await setup();
    await settle(tracker.submit('core', body(['skip-1', 'skip-2'])));

    expect(tracker.finished()).toMatchObject({ status: 'COMPLETED', counts: { skipped: 2 } });
    expect(tracker.activeCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('BulkJobsTracker: 409 BULK_JOB_ACTIVE', () => {
  it('warns, opens the active job from details.activeJobId and rethrows', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = await settle(tracker.submit('core', body(['a'])));

    await expect(settle(tracker.submit('core', body(['b'])))).rejects.toMatchObject({ status: 409, code: 'BULK_JOB_ACTIVE' });

    expect(hooks.resolve).toHaveBeenCalledTimes(1);
    expect(notify.warning).toHaveBeenCalledWith('Already running');
    expect(tracker.reportTarget()).toMatchObject({ app: 'core', jobId: first.jobId });
  });

  it('without details, finds the active job of the module and opens it', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = await settle(fakeSubmitBulkJob('core', body(['a']), 'seed-key-1'));
    hooks.validate.mockImplementation(() => {
      throw new ApiError(409, 'BULK_JOB_ACTIVE');
    });

    await expect(settle(tracker.submit('core', body(['b'])))).rejects.toBeInstanceOf(ApiError);

    expect(tracker.reportTarget()).toMatchObject({ app: 'core', jobId: first.jobId });
    expect(tracker.hasActive('core', TEST_MODULE)).toBe(true);
  });

  it('without details, falls back to the active job of another module in the same app', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    const other = await settle(fakeSubmitBulkJob('core', body(['a'], OTHER_MODULE), 'seed-key-2'));
    hooks.validate.mockImplementation((b) => {
      if (b.module === TEST_MODULE) throw new ApiError(409, 'BULK_JOB_ACTIVE', {});
    });

    await expect(settle(tracker.submit('core', body(['b'])))).rejects.toBeInstanceOf(ApiError);
    expect(tracker.reportTarget()).toMatchObject({ jobId: other.jobId });
  });

  it('other errors are not treated as an active conflict', async () => {
    const tracker = await setup();
    hooks.validate.mockImplementation(() => {
      throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    });

    await expect(settle(tracker.submit('core', body(['a'])))).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
    expect(notify.warning).not.toHaveBeenCalled();
    expect(tracker.reportTarget()).toBeNull();
    expect(tracker.jobs()).toEqual([]);
  });
});

describe('BulkJobsTracker: polling', () => {
  // 3 items, 1 per chunk, a chunk every 500 ms: the fake job completes about 1.5 s after submit.
  async function submitThree(tracker: BulkJobsTracker): Promise<string> {
    const res = await settle(tracker.submit('core', body(['a', 'fail-b', 'skip-c'])));
    return res.jobId;
  }

  it('polls every 2 s while visible and stops at the terminal state', async () => {
    const tracker = await setup();
    await submitThree(tracker);

    await vi.advanceTimersByTimeAsync(1_800);
    expect(tracker.activeCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(tracker.activeCount()).toBe(0);
    expect(tracker.finished()?.status).toBe('COMPLETED_WITH_ERRORS');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls every 10 s while hidden', async () => {
    const tracker = await setup();
    visibility = 'hidden';
    await submitThree(tracker);

    await vi.advanceTimersByTimeAsync(9_800);
    expect(tracker.activeCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(tracker.activeCount()).toBe(0);
  });

  it('polls every 2 s while hidden if the popover is open', async () => {
    const tracker = await setup();
    visibility = 'hidden';
    tracker.setPopoverOpen(true);
    await submitThree(tracker);

    await vi.advanceTimersByTimeAsync(2_400);
    expect(tracker.activeCount()).toBe(0);
  });

  it('exposes succeeded / failed / skipped / unchanged counts and the partial toast', async () => {
    const tracker = await setup();
    hooks.chunkSize = 10;
    await settle(tracker.submit('core', body(['a', 'b', 'same-c', 'fail-d', 'skip-e'])));

    const seeded = tracker.jobs()[0];
    expect(seeded.counts.skipped).toBe(1);
    expect(seeded.processed).toBe(1);

    await vi.advanceTimersByTimeAsync(2_500);
    const done = tracker.jobs()[0];
    expect(done.status).toBe('COMPLETED_WITH_ERRORS');
    expect(done.counts).toEqual({ succeeded: 2, unchanged: 1, skipped: 1, failed: 1, cancelled: 0 });
    expect(done.processed).toBe(5);
    expect(notify.warning).toHaveBeenCalledWith('3 done, 1 failed.');
  });

  it('reports a FAILED job (stalled) and stops polling', async () => {
    const tracker = await setup();
    FAKE_BULK.stallAfterChunk = 1;
    await submitThree(tracker);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(tracker.finished()).toMatchObject({ status: 'FAILED', failureCode: 'BULK_JOB_CHUNK_STALLED' });
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('notifies a finished job only once', async () => {
    const tracker = await setup();
    await submitThree(tracker);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(notify.warning).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially while reads fail, capped at 60 s, and resets after a success', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 600_000;
    await settle(tracker.submit('core', body(['a'])));
    FAKE_BULK.getFailures = 100;

    // Each read takes 120 ms; a failed read doubles the next delay (2 s, 4 s, 8 s ... capped at 60 s):
    // failures land at about 2.1 s, 6.2 s, 14.4 s, 30.5 s, 62.6 s, 122.7 s, 182.8 s.
    let now = 0;
    const failuresAt = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms - now);
      now = ms;
      return 100 - FAKE_BULK.getFailures;
    };
    expect(await failuresAt(2_200)).toBe(1);
    expect(await failuresAt(6_000)).toBe(1);
    expect(await failuresAt(6_400)).toBe(2);
    expect(await failuresAt(15_000)).toBe(3);
    expect(await failuresAt(31_000)).toBe(4);
    expect(await failuresAt(63_000)).toBe(5);
    expect(await failuresAt(123_000)).toBe(6);
    expect(await failuresAt(183_000)).toBe(7); // uncapped, the 7th read would come at about 186.8 s
    expect(tracker.activeCount()).toBe(1);

    FAKE_BULK.getFailures = 0;
    await vi.advanceTimersByTimeAsync(243_100 - now); // the successful read at about 243 s resets the streak
    now = 243_100;
    FAKE_BULK.getFailures = 100;
    expect(await failuresAt(245_200)).toBe(1);
    expect(await failuresAt(247_000)).toBe(1);
  });

  it('stops polling on destroy, even while backing off', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 600_000;
    await settle(tracker.submit('core', body(['a'])));
    FAKE_BULK.getFailures = 100;
    await vi.advanceTimersByTimeAsync(2_200);
    expect(FAKE_BULK.getFailures).toBe(99);
    expect(tracker.activeCount()).toBe(1);

    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(FAKE_BULK.getFailures).toBe(99);
    FAKE_BULK.getFailures = 0;
  });

  it('drops an unknown job on 404 and stops polling', async () => {
    const tracker = await setup();
    tracker.syncExternalJob(makeJob({ id: 'ghost', app: 'core', module: TEST_MODULE, action: 'RUN' }));
    expect(tracker.activeCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(tracker.jobs()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('BulkJobsTracker: cancel', () => {
  it('cancels a QUEUED job at once: CANCELLED, no more polling', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    await settle(tracker.submit('core', body(['a', 'b'])));

    await settle(tracker.cancel(tracker.jobs()[0]));
    await vi.advanceTimersByTimeAsync(100);

    expect(tracker.jobs()[0]).toMatchObject({ status: 'CANCELLED', counts: { cancelled: 2 } });
    expect(tracker.activeCount()).toBe(0);
  });

  it('a RUNNING job goes to CANCELLING, keeps polling, and ends CANCELLED after the running chunk', async () => {
    const tracker = await setup();
    // Chunk 2 blocks on a gate, so the job stays RUNNING however long the fake chunk delay is.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    hooks.executeChunk.mockImplementationOnce(() => undefined).mockImplementationOnce(() => gate);
    await settle(tracker.submit('core', body(['a', 'b', 'c'])));

    for (let i = 0; i < 300; i++) {
      if (hooks.executeChunk.mock.calls.length >= 2 && tracker.jobs()[0].status === 'RUNNING') break;
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(hooks.executeChunk).toHaveBeenCalledTimes(2);
    expect(tracker.jobs()[0].status).toBe('RUNNING');

    await settle(tracker.cancel(tracker.jobs()[0]));
    expect(tracker.jobs()[0].status).toBe('CANCELLING');
    expect(tracker.hasActive('core')).toBe(true);

    release();
    for (let i = 0; i < 300 && tracker.activeCount() > 0; i++) {
      await vi.advanceTimersByTimeAsync(100);
    }
    const job = tracker.jobs()[0];
    expect(job.status).toBe('CANCELLED');
    expect(job.counts).toMatchObject({ succeeded: 2, cancelled: 1 });
    expect(hooks.executeChunk).toHaveBeenCalledTimes(2);
    expect(notify.info).toHaveBeenLastCalledWith('Stopped');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with 409 BULK_JOB_FINISHED on a finished job', async () => {
    const tracker = await setup();
    await settle(tracker.submit('core', body(['skip-a'])));

    await expect(settle(tracker.cancel(tracker.jobs()[0]))).rejects.toMatchObject({ code: 'BULK_JOB_FINISHED' });
    expect(tracker.jobs()[0].status).toBe('COMPLETED');
  });
});

describe('BulkJobsTracker: retry', () => {
  it('retries only the failed items in one call and tracks the new job', async () => {
    const tracker = await setup();
    hooks.chunkSize = 10;
    await settle(tracker.submit('core', body(['a', 'fail-b', 'fail-c'])));
    await vi.advanceTimersByTimeAsync(2_500);
    const original = tracker.jobs()[0];
    expect(original.status).toBe('COMPLETED_WITH_ERRORS');

    const newId = await settle(tracker.retry(original, null));

    expect(newId).not.toBe(original.id);
    expect(hooks.resolve).toHaveBeenCalledTimes(2);
    expect(hooks.resolve.mock.calls[1][0].selection).toEqual({ kind: 'IDS', ids: ['fail-b', 'fail-c'] });
    expect(tracker.hasActive('core', TEST_MODULE)).toBe(true);
  });
});

describe('BulkJobsTracker: real transport preconditions and failures', () => {
  const completed = makeJob({ app: 'trading', status: 'COMPLETED_WITH_ERRORS', revision: 7,
    counts: { succeeded: 2, unchanged: 0, skipped: 0, failed: 1, cancelled: 0 } });
  const accepted = { jobId: 'retry-job', status: 'QUEUED' as const, total: 1,
    skippedAtSubmit: 0, failedAtSubmit: 0, chunkCount: 1 };

  it('sends the revision the user saw when cancelling', async () => {
    const tracker = await setup();
    const cancel = vi.spyOn(fakeBulkJobsTransport, 'cancelBulkJob')
      .mockResolvedValue({ ...completed, status: 'CANCELLED', revision: 8 });
    await tracker.cancel(completed);
    expect(cancel).toHaveBeenCalledWith('trading', completed.id, 7);
  });

  it('retains the retry key, body and original revision after network and server failures', async () => {
    const tracker = await setup();
    const retry = vi.spyOn(fakeBulkJobsTransport, 'retryBulkJob')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'))
      .mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'))
      .mockResolvedValue(accepted);
    vi.spyOn(fakeBulkJobsTransport, 'getBulkJob').mockResolvedValue({ ...completed, id: accepted.jobId });
    const overrides = { startAt: '2026-11-24T10:00:00.000Z' };
    await expect(tracker.retry(completed, overrides)).rejects.toMatchObject({ status: 0 });
    await expect(tracker.retry({ ...completed, revision: 8 }, { ...overrides })).rejects.toMatchObject({ status: 503 });
    await expect(tracker.retry({ ...completed, revision: 9 }, overrides)).resolves.toBe(accepted.jobId);
    expect(retry).toHaveBeenCalledTimes(3);
    expect(retry.mock.calls[1]).toEqual(retry.mock.calls[0]);
    expect(retry.mock.calls[2]).toEqual(retry.mock.calls[0]);
    expect(retry.mock.calls[0][4]).toBe(7);
  });

  it('uses a new retry intent when the overrides change', async () => {
    const tracker = await setup();
    const retry = vi.spyOn(fakeBulkJobsTransport, 'retryBulkJob').mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await expect(tracker.retry(completed, null)).rejects.toBeInstanceOf(ApiError);
    await expect(tracker.retry({ ...completed, revision: 8 }, { startAt: '2026-11-24T12:00:00.000Z' }))
      .rejects.toBeInstanceOf(ApiError);
    expect(retry.mock.calls[1][3]).not.toBe(retry.mock.calls[0][3]);
    expect(retry.mock.calls[1][4]).toBe(8);
  });

  it('does not replay stale conflicts and clears the rejected retry intent', async () => {
    const tracker = await setup();
    const retry = vi.spyOn(fakeBulkJobsTransport, 'retryBulkJob')
      .mockRejectedValue(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
    await expect(tracker.retry(completed, null)).rejects.toMatchObject({ status: 409 });
    expect(retry).toHaveBeenCalledTimes(1);
    await expect(tracker.retry({ ...completed, revision: 8 }, null)).rejects.toMatchObject({ status: 409 });
    expect(retry.mock.calls[1][3]).not.toBe(retry.mock.calls[0][3]);
    expect(retry.mock.calls[1][4]).toBe(8);
  });

  it('excludes accounting descriptors and persisted accounting job references', async () => {
    localStorage.setItem('bulkJobs.recent', JSON.stringify([{ app: 'accounting', id: 'old-simulation' }]));
    const get = vi.spyOn(fakeBulkJobsTransport, 'getBulkJob');
    const tracker = await setup([provideBulkJobModules([{ ...TEST_DESCRIPTOR, app: 'accounting' }])]);
    expect(tracker.registeredApps()).not.toContain('accounting');
    expect(get).not.toHaveBeenCalled();
    expect(localStorage.getItem('bulkJobs.recent')).toBe('[]');
  });

  it('preserves full API errors for status-based shared translations', async () => {
    const tracker = await setup();
    TestBed.inject(TranslocoService).setTranslation({ apiErrors: { network: 'Offline', permission: 'Access denied',
      rateLimited: 'Try later', generic: 'Server failure' } }, 'en', { merge: true });
    expect(tracker.errorText(new ApiError(0, 'NETWORK_ERROR'), null)).toBe('Offline');
    expect(tracker.errorText(new ApiError(403, 'UNKNOWN'), null)).toBe('Access denied');
    expect(tracker.errorText(new ApiError(429, 'UNKNOWN'), null)).toBe('Try later');
    expect(tracker.errorText(new ApiError(503, 'UNKNOWN'), null)).toBe('Server failure');
    expect(tracker.errorText(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'), completed))
      .toBe('The batch changed. Reload its report before trying again.');
    expect(tracker.reasonText('BULK_JOBS_UNAVAILABLE', null)).toBe('Batch operations are unavailable for this app.');
  });

  it('shows one read-failure toast while stale and clears stale on recovery', async () => {
    const tracker = await setup();
    const list = vi.spyOn(fakeBulkJobsTransport, 'listBulkJobs').mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await tracker.loadRecent();
    await tracker.loadRecent();
    expect(tracker.stale()).toBe(true);
    expect(notify.error).toHaveBeenCalledTimes(1);
    list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await tracker.loadRecent();
    expect(tracker.stale()).toBe(false);
  });

  it('provides MSA fallback messages while the unowned translation keys are pending', async () => {
    const tracker = await setup();
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await tracker.ensureScopesLoaded(['bulk-jobs']);
    expect(tracker.reasonText('BULK_JOBS_UNAVAILABLE', null)).toBe('العمليات المجمّعة غير متاحة لهذا التطبيق.');
    expect(tracker.reasonText('TRADE.CONCURRENCY.STALE_VERSION', completed))
      .toBe('تغيّرت العملية. أعد تحميل التقرير قبل المحاولة مجددًا.');
  });
});

describe('Trade items bulk: goes through the tracker', () => {
  it('submits one job with the caller key under the items descriptor and shows the module toasts', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    TestBed.inject(TranslocoService).setTranslation(
      { itemsBulk: { started: 'Items batch started', activeJob: { title: 'Items busy', open: 'Open it' } } },
      'en',
      { merge: true },
    );
    const opts = {
      action: 'SET_STATUS' as const,
      context: { companyId: 'c1' },
      selection: { kind: 'IDS' as const, ids: ['a', 'b'] },
      params: { status: 'ACTIVE' as const },
      idempotencyKey: 'items-key',
      tracker,
    };

    const outcome = await settle(submitItemsBulkJob(opts));

    expect(outcome).toEqual({ jobId: expect.any(String), finishedJob: null });
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
    expect(hooks.resolve.mock.calls[0][0]).toMatchObject({ module: 'trading.items', action: 'SET_STATUS' });
    // Item master actions run in tenant scope only (backend 403 otherwise).
    expect(hooks.resolve.mock.calls[0][0].scope).toEqual({});
    expect(tracker.hasActive('trading', 'trading.items')).toBe(true);
    expect(tracker.descriptorFor(tracker.jobs()[0].module)).toBe(TRADE_ITEMS_BULK_MODULE);
    expect(notify.info).toHaveBeenCalledTimes(1);
    expect(notify.info).toHaveBeenCalledWith('Items batch started');

    const replay = await settle(submitItemsBulkJob(opts));
    expect(replay?.jobId).toBe(outcome?.jobId);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);

    expect(await settle(submitItemsBulkJob({ ...opts, idempotencyKey: 'items-key-2' }))).toBeNull();
    expect(notify.warning).toHaveBeenCalledWith('Items busy', 'Open it');
    expect(tracker.reportTarget()).toMatchObject({ app: 'trading', jobId: outcome?.jobId });
  });

  it('returns the finished job when every item ends at submit', async () => {
    const tracker = await setup();
    const outcome = await settle(
      submitItemsBulkJob({
        action: 'SET_CATEGORY',
        context: {},
        selection: { kind: 'IDS', ids: ['skip-a'] },
        params: { categoryId: null },
        idempotencyKey: 'items-done',
        tracker,
      }),
    );

    expect(outcome?.finishedJob).toMatchObject({ status: 'COMPLETED', module: 'trading.items' });
    expect(tracker.finished()?.id).toBe(outcome?.jobId);
  });
});

describe('BulkJobsTracker: reason code key prefixes', () => {
  async function withCodes(): Promise<BulkJobsTracker> {
    const tracker = await setup();
    TestBed.inject(TranslocoService).setTranslation(
      {
        leadBulk: {
          codes: { LEAD_LOCKED: 'Lead is locked', BOTH: 'From codes' },
          skip: { ALREADY_ASSIGNED: 'Already assigned', BOTH: 'From skip' },
        },
        bulkAct: { codes: { ACT_ONLY: 'Activity code' } },
        itemsBulk: { codes: { ITEM_ARCHIVED: 'Item archived' } },
      },
      'en',
      { merge: true },
    );
    return tracker;
  }

  const lead = makeJob();

  it('resolves through each code and skip prefix of the module, first match wins', async () => {
    const tracker = await withCodes();
    expect(tracker.reasonText('LEAD_LOCKED', lead)).toBe('Lead is locked');
    expect(tracker.reasonText('ALREADY_ASSIGNED', lead)).toBe('Already assigned');
    expect(tracker.reasonText('ACT_ONLY', lead)).toBe('Activity code');
    expect(tracker.reasonText('BOTH', lead)).toBe('From codes');
  });

  it('uses only the prefixes of the job module', async () => {
    const tracker = await withCodes();
    const item = makeJob({ app: 'trading', module: 'trading.items', action: 'SET_STATUS' });
    expect(tracker.reasonText('ITEM_ARCHIVED', item)).toBe('Item archived');
    expect(tracker.reasonText('LEAD_LOCKED', item)).toBe('Something went wrong.');
  });

  it('falls back to bulkJobs.codes.<code>, then to the generic text', async () => {
    const tracker = await withCodes();
    expect(tracker.reasonText('BULK_JOB_CHUNK_STALLED', lead)).toBe('The batch stopped responding and was ended.');
    expect(tracker.reasonText('NOT_A_CODE', lead)).toBe('Something went wrong.');
    expect(tracker.reasonText(undefined, lead)).toBe('Something went wrong.');
    expect(tracker.reasonText('BULK_JOB_CHUNK_STALLED', makeJob({ module: 'unknown.module' }))).toBe(
      'The batch stopped responding and was ended.',
    );
  });
});

describe('BulkJobsTracker: select-failed route', () => {
  const job = makeJob({ id: 'j-42', status: 'COMPLETED_WITH_ERRORS' });

  it('leads: /crm/leads with bulkJob, bulkApp and select=failed', async () => {
    const tracker = await setup();
    expect(tracker.descriptorFor('crm.leads')?.selectFailedRoute?.(job)).toEqual({
      commands: ['/crm/leads'],
      queryParams: { bulkJob: 'j-42', bulkApp: 'crm', select: 'failed' },
    });
  });

  it('opportunities: the table view', async () => {
    const tracker = await setup();
    expect(tracker.descriptorFor('crm.opportunities')?.selectFailedRoute?.(job)).toEqual({
      commands: ['/crm/opportunities'],
      queryParams: { bulkJob: 'j-42', bulkApp: 'crm', select: 'failed', view: 'table' },
    });
  });

  it('trade items: keeps the company scope', async () => {
    const tracker = await setup();
    const itemJob = makeJob({ id: 'j-7', app: 'trading', module: 'trading.items', scope: { companyId: 'c1' } });
    expect(tracker.descriptorFor('trading.items')?.selectFailedRoute?.(itemJob)).toEqual({
      commands: ['/trade/foundation/items'],
      queryParams: { bulkJob: 'j-7', bulkApp: 'trading', select: 'failed', view: 'table', scope: 'company' },
    });
  });

  it('trade accounts: no select-failed route', async () => {
    const tracker = await setup();
    expect(tracker.descriptorFor('trading.commercial-accounts')?.selectFailedRoute).toBeUndefined();
  });
});

@Component({ selector: 'bt-page-a', template: 'page A' })
class PageA {
  readonly tracker = inject(BulkJobsTracker);
}

@Component({ selector: 'bt-page-b', template: 'page B' })
class PageB {
  readonly tracker = inject(BulkJobsTracker);
}

describe('BulkJobsTracker: lifetime', () => {
  it('survives navigation: the job keeps being tracked after the submitting page is destroyed', async () => {
    await setup([
      provideRouter([
        { path: 'a', component: PageA },
        { path: 'b', component: PageB },
      ]),
    ]);
    const harness = await RouterTestingHarness.create();
    const pageA = await harness.navigateByUrl('/a', PageA);
    await settle(pageA.tracker.submit('core', body(['a', 'b'])));

    const pageB = await harness.navigateByUrl('/b', PageB);
    expect(pageB.tracker).toBe(pageA.tracker);
    expect(pageB.tracker.activeCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(pageB.tracker.finished()?.status).toBe('COMPLETED');
    expect(notify.success).toHaveBeenCalledTimes(1);
  });

  it('restores active jobs and recent finished jobs on start without re-notifying finished ones', async () => {
    FAKE_BULK.chunkMs = 500;
    const done = await settle(fakeSubmitBulkJob('core', body(['skip-x']), 'seed-done'));
    const running = await settle(fakeSubmitBulkJob('core', body(['a', 'b']), 'seed-running'));
    localStorage.setItem('bulkJobs.recent', JSON.stringify([{ app: 'core', id: done.jobId }, { app: 'nope', id: 'x' }]));

    const tracker = await setup();

    expect(tracker.jobs().map((j) => j.id)).toEqual([running.jobId, done.jobId]);
    expect(tracker.finished()).toBeNull();
    expect(notify.success).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_500);
    expect(tracker.finished()?.id).toBe(running.jobId);
    expect(notify.success).toHaveBeenCalledTimes(1);
  });
});

describe('bulk-jobs API (fake backend): idempotency key', () => {
  it('replays the first result when the same key is resent (network retry): no second job', async () => {
    await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = await settle(submitBulkJob('core', body(['a']), 'same-key'));
    const replay = await settle(submitBulkJob('core', body(['a']), 'same-key'));

    expect(replay).toEqual(first);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
  });

  it('a new key for a new intent while a job is active gets 409 BULK_JOB_ACTIVE with activeJobId', async () => {
    await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = await settle(submitBulkJob('core', body(['a']), 'key-1'));

    await expect(settle(submitBulkJob('core', body(['b']), 'key-2'))).rejects.toMatchObject({
      status: 409,
      code: 'BULK_JOB_ACTIVE',
      details: { activeJobId: [first.jobId] },
    });
  });
});

describe('bulk-jobs API (fake backend): backend submit order and codes', () => {
  it('same key with a different body is 422 GW.IDEM.MISMATCH, and no job is created', async () => {
    await setup();
    FAKE_BULK.chunkMs = 60_000;
    await settle(submitBulkJob('core', body(['a']), 'mismatch-key'));

    await expect(settle(submitBulkJob('core', body(['b']), 'mismatch-key'))).rejects.toMatchObject({
      status: 422,
      code: 'GW.IDEM.MISMATCH',
    });
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
  });

  it('a key still being processed is 409 GW.IDEM.IN_FLIGHT', async () => {
    await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = submitBulkJob('core', body(['a']), 'flight-key');
    const second = submitBulkJob('core', body(['a']), 'flight-key');

    await expect(settle(second)).rejects.toMatchObject({ status: 409, code: 'GW.IDEM.IN_FLIGHT' });
    await settle(first);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
  });

  it('an oversized IDS selection is 422 BULK_SELECTION_TOO_LARGE with max as a string array (backend target shape), before the module runs', async () => {
    await setup();
    const ids = Array.from({ length: 10_001 }, (_, i) => `r-${i}`);

    await expect(settle(submitBulkJob('core', body(ids), 'big-key'))).rejects.toMatchObject({
      status: 422,
      code: 'BULK_SELECTION_TOO_LARGE',
      details: { max: ['10000'] },
    });
    expect(hooks.validate).not.toHaveBeenCalled();
  });

  it('duplicate ids are 400 BULK_JOB_PARAMS_INVALID (envelope schema)', async () => {
    await setup();
    await expect(settle(submitBulkJob('core', body(['a', 'a']), 'dup-key'))).rejects.toMatchObject({
      status: 400,
      code: 'BULK_JOB_PARAMS_INVALID',
    });
    expect(hooks.validate).not.toHaveBeenCalled();
  });

  it('runs validate, then validateAsync, before the active-job conflict; resolve only after it', async () => {
    await setup();
    FAKE_BULK.chunkMs = 60_000;
    await settle(submitBulkJob('core', body(['a']), 'order-key-1'));
    hooks.validateAsync.mockImplementationOnce(async () => {
      throw new ApiError(422, 'CRM_REASON_REQUIRED');
    });

    // A module error from authorizeSubmit wins over 409 BULK_JOB_ACTIVE, as in the backend.
    await expect(settle(submitBulkJob('core', body(['b']), 'order-key-2'))).rejects.toMatchObject({
      status: 422,
      code: 'CRM_REASON_REQUIRED',
    });
    expect(hooks.validate).toHaveBeenCalledTimes(2);
    expect(hooks.validateAsync).toHaveBeenCalledTimes(2);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);

    await expect(settle(submitBulkJob('core', body(['b']), 'order-key-3'))).rejects.toMatchObject({
      status: 409,
      code: 'BULK_JOB_ACTIVE',
    });
    expect(hooks.validateAsync).toHaveBeenCalledTimes(3);
    expect(hooks.resolve).toHaveBeenCalledTimes(1);
  });

  it('retry of a job that is still active is 409 BULK_JOB_ACTIVE with that job id', async () => {
    const tracker = await setup();
    FAKE_BULK.chunkMs = 60_000;
    const first = await settle(submitBulkJob('core', body(['fail-a']), 'retry-active-key'));

    const job = makeJob({ id: first.jobId, app: 'core', module: TEST_MODULE, action: 'RUN', scope: {} });
    await expect(settle(tracker.retry(job, null))).rejects.toMatchObject({
      status: 409,
      code: 'BULK_JOB_ACTIVE',
      details: { activeJobId: [first.jobId] },
    });
  });
});

describe('BulkJobsTracker: job title params', () => {
  const TITLED_MODULE = 'core.bulk-titled';
  const TITLED_DESCRIPTOR: BulkJobModuleDescriptor = {
    ...TEST_DESCRIPTOR,
    module: TITLED_MODULE,
    actions: {
      RUN: {
        titleKey: 'bt.title',
        icon: 'tablerCheck',
        tone: 'blue',
        succeededKey: 'bt.ok',
        titleParams: (params): Record<string, string> => (typeof params['status'] === 'string' ? { statusLabel: `bt.status.${params['status']}` } : {}),
      },
    },
  };

  it('translates the params a descriptor names and leaves descriptors without the hook unchanged', async () => {
    const tracker = await setup([provideBulkJobModules([TITLED_DESCRIPTOR])]);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ bt: { title: 'Set to {{statusLabel}}', run: 'Run {{name}}', status: { DONE: 'Done' } } }, 'en', { merge: true });

    expect(tracker.jobTitle(makeJob({ module: TITLED_MODULE, action: 'RUN', paramsSummary: { status: 'DONE' } }))).toBe('Set to Done');
    expect(tracker.jobTitle(makeJob({ module: TEST_MODULE, action: 'RUN', paramsSummary: { name: 'X' } }))).toBe('Run X');
  });
});
