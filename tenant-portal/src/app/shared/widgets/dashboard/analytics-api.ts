import { ApiError } from '../../../core/api/api-errors';

/**
 * The core ApiError, re-exported for the analytics callers so `instanceof` and `correlationIdOf` work across
 * the app. The real API only ever sends `details` as `{ field: string[] }` (see `wireDetails`); the fakes in
 * this folder send nothing else.
 */
export { ApiError };

/** Current instant; date-range providers can wrap it in a Date. */
export function analyticsNow(): string {
  return new Date().toISOString();
}

/** @deprecated Compatibility snapshot for still-fake callers; live reads use analyticsNow(). */
export const FAKE_NOW = analyticsNow();

export const FAKE_FAIL = { nextCall: false };

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InfoPage<T> {
  items: T[];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export interface FlatPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

let runStaggerCounter = 0;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function fakeDelay(ms = 300): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (FAKE_FAIL.nextCall) {
    FAKE_FAIL.nextCall = false;
    throw new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE');
  }
}

/** Max runs, widget previews and drill-downs per user at once. The 4th gets 429. */
export const RUN_CONCURRENCY_LIMIT = 3;
let runsInFlight = 0;

/**
 * Fake of the backend concurrency guard (per user, runs + previews + drill-downs together).
 * The 4th call in flight is refused with 429 CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED.
 */
export async function withRunSlot<T>(work: () => Promise<T>): Promise<T> {
  if (runsInFlight >= RUN_CONCURRENCY_LIMIT) {
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    throw new ApiError(429, 'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED');
  }
  runsInFlight += 1;
  try {
    return await work();
  } finally {
    runsInFlight -= 1;
  }
}

export function isConcurrencyError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429 && error.code === 'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED';
}

export interface RetryWhenBusyOptions {
  attempts?: number;
  baseDelayMs?: number;
  /** Aborted when a newer run starts or the page is destroyed: no further attempt or wait happens. */
  signal?: AbortSignal;
  /** Called before each wait after a 429, so the caller can show "retrying...". */
  onRetry?: (attempt: number) => void;
}

function abortError(): DOMException {
  return new DOMException('The run was superseded.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Settles like `work`, but rejects with an AbortError as soon as `signal` aborts (the request is dropped). */
export function raceAbort<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work();
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    work().then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Retries a call refused with 429 CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED after a short, growing delay.
 * The caller keeps showing its loading (retrying) state meanwhile; only when the attempts run out does the error
 * surface. An aborted signal stops it at once with an AbortError.
 */
export async function retryWhenBusy<T>(
  call: () => Promise<T>,
  options: number | RetryWhenBusyOptions = {},
  baseDelayMsArg = 700,
): Promise<T> {
  const opts: RetryWhenBusyOptions = typeof options === 'number' ? { attempts: options, baseDelayMs: baseDelayMsArg } : options;
  const attempts = opts.attempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 700;
  for (let attempt = 1; ; attempt += 1) {
    if (opts.signal?.aborted) throw abortError();
    try {
      return await call();
    } catch (error) {
      if (!isConcurrencyError(error) || attempt >= attempts || opts.signal?.aborted) throw error;
      opts.onRetry?.(attempt);
      await waitFor(baseDelayMs * attempt + Math.random() * 300, opts.signal);
    }
  }
}

/** One shared client queue in front of the 3 run slots: callers wait their turn instead of each retrying. */
let queuedRunsActive = 0;
const runQueue: { start: () => void; signal?: AbortSignal; onAbort: () => void }[] = [];

function releaseQueuedRun(): void {
  queuedRunsActive -= 1;
  while (queuedRunsActive < RUN_CONCURRENCY_LIMIT && runQueue.length > 0) {
    const next = runQueue.shift()!;
    next.signal?.removeEventListener('abort', next.onAbort);
    if (next.signal?.aborted) continue;
    queuedRunsActive += 1;
    next.start();
  }
}

export function queueRun<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  const run = async (): Promise<T> => {
    try {
      return await work();
    } finally {
      releaseQueuedRun();
    }
  };
  if (queuedRunsActive < RUN_CONCURRENCY_LIMIT) {
    queuedRunsActive += 1;
    return run();
  }
  return new Promise<T>((resolve, reject) => {
    const entry = {
      signal,
      start: () => run().then(resolve, reject),
      onAbort: () => {
        const idx = runQueue.indexOf(entry);
        if (idx >= 0) runQueue.splice(idx, 1);
        reject(abortError());
      },
    };
    signal?.addEventListener('abort', entry.onAbort, { once: true });
    runQueue.push(entry);
  });
}

export function fakeDelayFor(kind: 'run' | 'normal', seedKey?: string): Promise<void> {
  if (kind === 'normal') {
    return fakeDelay(300);
  }
  const offset = seedKey ? hashSeed(seedKey) % 1801 : ((++runStaggerCounter * 523) % 1801);
  return fakeDelay(600 + offset);
}

function uuidv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newIdempotencyKey(): string {
  return uuidv7();
}

export function fakeId(): string {
  return uuidv7();
}

export function errorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

// Backend rules every analytics fake shares: crm-app main.ts ValidationPipe, the shared AllExceptionsFilter and
// crm/dashboards/common/request-idempotency.service.ts.

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `@IsUUID('7')`: every analytics id (path, body and query) is a UUID version 7. */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7.test(value);
}

/**
 * Error details as the shared error filter sends them: only `{ key: string[] }` entries survive; numbers, strings,
 * objects and arrays of objects are dropped, and an empty result means no `details` at all.
 */
export function wireDetails(details: Record<string, unknown> | undefined): Record<string, string[]> | undefined {
  if (!details) return undefined;
  const kept = Object.entries(details).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'),
  );
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** The global ValidationPipe: 400 `CRM_VALIDATION_FAILED`, details keyed by the DTO field path. */
export function validationFailed(field: string, constraint: string): ApiError {
  return new ApiError(400, 'CRM_VALIDATION_FAILED', { [field]: [constraint] });
}

/**
 * `normalizeIdempotencyKey`: the `x-idempotency-key` must be a UUID v7 (400 `CRM_IDEMPOTENCY_KEY_INVALID`);
 * returns it trimmed and lowercased, as the backend stores it. Through the Gateway a missing key is
 * 400 `GW.IDEM.MISSING` and a malformed one 400 `GW.IDEM.BAD_VALUE` before CRM is reached.
 */
export function idempotencyKeyOf(key: string | undefined): string {
  const value = key?.trim() ?? '';
  if (!isUuidV7(value)) throw new ApiError(400, 'CRM_IDEMPOTENCY_KEY_INVALID');
  return value.toLowerCase();
}

/** Deterministic JSON (keys sorted, `undefined` dropped), as `fingerprintRequest` hashes it. */
export function requestFingerprint(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(requestFingerprint).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${requestFingerprint(v)}`).join(',')}}`;
}

/** The same key with the same request returns the stored result; with a different request it is 422 `CRM_IDEMPOTENCY_KEY_REUSED`. */
export function replayOf<T>(
  store: ReadonlyMap<string, { fingerprint: string; response: T }>,
  key: string,
  fingerprint: string,
): T | undefined {
  const existing = store.get(key);
  if (!existing) return undefined;
  if (existing.fingerprint !== fingerprint) throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
  return existing.response;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function encodeCursor(index: number): string {
  return btoa(String(index)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string): number {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID');
  }
  const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  let decoded = '';
  try {
    decoded = atob(padded);
  } catch {
    throw new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID');
  }
  if (!/^(0|[1-9]\d*)$/.test(decoded)) {
    throw new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID');
  }
  const index = Number.parseInt(decoded, 10);
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new ApiError(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID');
  }
  return index;
}

export function pageOf<T>(all: readonly T[], cursor: string | null = null, limit = 20): InfoPage<T> {
  const safeLimit = clampLimit(limit);
  const start = cursor ? decodeCursor(cursor) : 0;
  const items = all.slice(start, start + safeLimit);
  const nextIndex = start + items.length;
  const hasMore = nextIndex < all.length;
  return {
    items,
    pageInfo: {
      limit: safeLimit,
      hasMore,
      nextCursor: hasMore ? encodeCursor(nextIndex) : null,
    },
  };
}

export function cursorPageOf<T extends { id: string }>(
  all: readonly T[],
  cursor: string | null = null,
  limit = 20,
): CursorPage<T> {
  const safeLimit = clampLimit(limit);
  let start = 0;
  if (cursor) {
    // Definition lists take the last id as `@IsUUID('7') cursor`: a malformed one fails the ValidationPipe.
    if (!isUuidV7(cursor)) throw validationFailed('cursor', 'is_uuid');
    const idx = all.findIndex((item) => item.id === cursor);
    // A well-formed id that is no longer in the list resumes nowhere: the keyset finds no later rows.
    if (idx === -1) return { items: [], nextCursor: null };
    start = idx + 1;
  }
  const items = all.slice(start, start + safeLimit);
  const hasMore = start + items.length < all.length;
  return {
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
  };
}
