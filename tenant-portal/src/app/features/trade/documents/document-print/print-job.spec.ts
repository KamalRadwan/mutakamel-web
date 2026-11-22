import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderJob } from '../shared/document.model';
import { PrintAbortError, PrintTimeoutError, runPrint } from './print-job';

function makeJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    renderJobId: 'job-1',
    status: 'PENDING',
    attemptCount: 1,
    statusUrl: '/api/tenant/trade/v1/quotations/q-1/render-jobs/job-1',
    ...overrides,
  };
}

describe('print-job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes after retrying and reports updates in order', async () => {
    const pending = makeJob({ status: 'PENDING', attemptCount: 1 });
    const retrying = makeJob({ status: 'RETRYING', attemptCount: 2 });
    const completed = makeJob({
      status: 'COMPLETED',
      attemptCount: 2,
      artifact: {
        downloadUrl: 'https://example.test/doc.pdf',
        downloadExpiresAt: '2026-11-21T16:05:00.000Z',
        pageCount: 2,
        sizeBytes: 1024,
      },
    });

    const start = vi.fn<() => Promise<RenderJob>>().mockResolvedValue(pending);
    const poll = vi
      .fn<(jobId: string) => Promise<RenderJob>>()
      .mockResolvedValueOnce(retrying)
      .mockResolvedValueOnce(completed);
    const updates: RenderJob[] = [];

    const promise = runPrint(start, poll, {
      intervalMs: 2000,
      timeoutMs: 120_000,
      onUpdate: (job) => updates.push(job),
    });

    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual(completed);
    expect(start).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledTimes(2);
    expect(poll).toHaveBeenCalledWith('job-1');
    expect(updates).toEqual([pending, retrying, completed]);
  });

  it('resolves when polling reaches a terminal FAILED status and stops polling', async () => {
    const pending = makeJob({ status: 'PENDING', attemptCount: 1 });
    const failed = makeJob({
      status: 'FAILED',
      attemptCount: 3,
      failure: {
        code: 'TRADE.PURCHASE_ORDER.DELIVERY_PDF_FAILED',
        terminal: true,
      },
    });

    const start = vi.fn<() => Promise<RenderJob>>().mockResolvedValue(pending);
    const poll = vi.fn<(jobId: string) => Promise<RenderJob>>().mockResolvedValueOnce(failed);
    const updates: RenderJob[] = [];

    const promise = runPrint(start, poll, {
      intervalMs: 2000,
      timeoutMs: 120_000,
      onUpdate: (job) => updates.push(job),
    });

    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toEqual(failed);
    expect(updates).toEqual([pending, failed]);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('rejects with PrintTimeoutError when polling exceeds timeoutMs', async () => {
    const pending = makeJob({ status: 'PENDING', attemptCount: 1 });
    const retrying = makeJob({ status: 'RETRYING', attemptCount: 2 });

    const start = vi.fn<() => Promise<RenderJob>>().mockResolvedValue(pending);
    const poll = vi.fn<(jobId: string) => Promise<RenderJob>>().mockResolvedValue(retrying);
    const updates: RenderJob[] = [];

    const caught = runPrint(start, poll, {
      intervalMs: 2000,
      timeoutMs: 5000,
      onUpdate: (job) => updates.push(job),
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(5000);

    const err = await caught;
    expect(err).toBeInstanceOf(PrintTimeoutError);
    expect((err as PrintTimeoutError).lastJob).toEqual(retrying);
    expect(poll).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([pending, retrying, retrying]);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('rejects with PrintAbortError when aborted while waiting between polls', async () => {
    const controller = new AbortController();
    const pending = makeJob({ status: 'PENDING', attemptCount: 1 });
    const start = vi.fn<() => Promise<RenderJob>>().mockResolvedValue(pending);
    const poll = vi.fn<(jobId: string) => Promise<RenderJob>>();

    const caught = runPrint(start, poll, {
      intervalMs: 2000,
      timeoutMs: 120_000,
      signal: controller.signal,
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();

    const err = await caught;
    expect(err).toBeInstanceOf(PrintAbortError);
    expect((err as PrintAbortError).name).toBe('AbortError');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).not.toHaveBeenCalled();
  });

  it('rejects immediately with PrintAbortError when aborted during an in-flight poll', async () => {
    const controller = new AbortController();
    const pending = makeJob({ status: 'PENDING', attemptCount: 1 });
    const completed = makeJob({ status: 'COMPLETED', attemptCount: 1 });

    let resolvePoll!: (job: RenderJob) => void;
    const pollPromise = new Promise<RenderJob>((resolve) => {
      resolvePoll = resolve;
    });

    const start = vi.fn<() => Promise<RenderJob>>().mockResolvedValue(pending);
    const poll = vi.fn<(jobId: string) => Promise<RenderJob>>().mockReturnValue(pollPromise);
    const updates: RenderJob[] = [];

    const caught = runPrint(start, poll, {
      intervalMs: 2000,
      timeoutMs: 120_000,
      signal: controller.signal,
      onUpdate: (job) => updates.push(job),
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(2000);
    expect(poll).toHaveBeenCalledTimes(1);

    controller.abort();
    const err = await caught;
    expect(err).toBeInstanceOf(PrintAbortError);

    resolvePoll(completed);
    await Promise.resolve();
    expect(updates).toEqual([pending]);
  });

  it('rejects immediately without calling start when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const start = vi.fn<() => Promise<RenderJob>>();
    const poll = vi.fn<(jobId: string) => Promise<RenderJob>>();

    await expect(
      runPrint(start, poll, {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(PrintAbortError);
    expect(start).not.toHaveBeenCalled();
    expect(poll).not.toHaveBeenCalled();
  });
});
