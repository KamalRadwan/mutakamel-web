import type { RenderJob } from '../shared/document.model';

export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_POLL_TIMEOUT_MS = 120_000;

export interface RunPrintOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onUpdate?: (job: RenderJob) => void;
}

export class PrintTimeoutError extends Error {
  constructor(readonly lastJob?: RenderJob) {
    super('Print job polling timed out');
    this.name = 'PrintTimeoutError';
  }
}

export class PrintAbortError extends Error {
  constructor() {
    super('Print job polling aborted');
    this.name = 'AbortError';
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new PrintAbortError());
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PrintAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    // Prevent an unhandled rejection if the underlying promise rejects after abort.
    promise.catch(() => {});
    return Promise.reject(new PrintAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(new PrintAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export async function runPrint(
  start: () => Promise<RenderJob>,
  poll: (jobId: string) => Promise<RenderJob>,
  opts: RunPrintOptions = {},
): Promise<RenderJob> {
  const {
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
    signal,
    onUpdate,
  } = opts;

  if (signal?.aborted) {
    throw new PrintAbortError();
  }

  const deadline = Date.now() + timeoutMs;
  let job = await withAbort(start(), signal);
  if (signal?.aborted) {
    throw new PrintAbortError();
  }
  onUpdate?.(job);

  while (job.status === 'PENDING' || job.status === 'RETRYING') {
    if (signal?.aborted) {
      throw new PrintAbortError();
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new PrintTimeoutError(job);
    }

    await wait(Math.min(intervalMs, remaining), signal);
    if (signal?.aborted) {
      throw new PrintAbortError();
    }
    if (Date.now() >= deadline) {
      throw new PrintTimeoutError(job);
    }

    job = await withAbort(poll(job.renderJobId), signal);
    if (signal?.aborted) {
      throw new PrintAbortError();
    }
    onUpdate?.(job);
  }

  return job;
}
