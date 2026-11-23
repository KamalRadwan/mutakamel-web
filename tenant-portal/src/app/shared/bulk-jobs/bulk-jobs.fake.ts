import { ApiError } from '../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../core/fake/fake-utils';
import type { BulkJobsTransport } from './bulk-jobs.api';
import {
  BULK_JOB_LIMITS,
  BulkJob,
  BulkJobApp,
  BulkJobCounts,
  BulkJobItem,
  BulkJobItemStatus,
  BulkJobPage,
  BulkJobSubmit,
  BulkJobSubmitResult,
  ListBulkJobItemsQuery,
  ListBulkJobsQuery,
  isBulkJobActive,
} from './bulk-jobs.model';

export const fakeBulkJobsTransport: BulkJobsTransport = {
  submitBulkJob: fakeSubmitBulkJob,
  getBulkJob: fakeGetBulkJob,
  listBulkJobItems: fakeListBulkJobItems,
  listBulkJobs: fakeListBulkJobs,
  cancelBulkJob: fakeCancelBulkJob,
  retryBulkJob: fakeRetryBulkJob,
};

export interface FakeBulkModule {
  module: string;
  chunkSize?(action: string): number;
  resolve(
    body: BulkJobSubmit,
    actorUserId: string,
  ): Promise<
    {
      entityId: string;
      label: string;
      preStatus?: 'SKIPPED' | 'FAILED';
      code?: string;
      data?: Record<string, string | number | null>;
    }[]
  >;
  /**
   * Sync part of the handler's submit checks: params / query schema (400) and
   * access or rule checks that need no lookup (403 / 422). Runs before the
   * active-job conflict, as in the backend.
   */
  validate?(body: BulkJobSubmit): void;
  /**
   * Async part of the handler's authorizeSubmit (stage, reason, owner lookups).
   * Runs after validate() and before the active-job conflict, as in the
   * backend. Checks left in resolve() run after that conflict instead.
   */
  validateAsync?(body: BulkJobSubmit): Promise<void>;
  prepare?(body: BulkJobSubmit, items: unknown[]): { summary?: Record<string, string | number> };
  executeChunk(
    job: BulkJob,
    params: unknown,
    items: BulkJobItem[],
  ): Promise<{ ordinal: number; status: BulkJobItemStatus; code?: string; field?: string; refId?: string }[]>;
  current?(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>>;
  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null>;
}

/** getFailures: the next N job reads fail like a network error (tests the tracker's backoff). */
export const FAKE_BULK = { chunkMs: 700, stallAfterChunk: -1, getFailures: 0 };

const FAKE_ACTOR_USER_ID = 'u1';

interface StoredBulkJob {
  job: BulkJob;
  params: unknown;
  items: BulkJobItem[];
  chunkSize: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const modulesByKey = new Map<string, FakeBulkModule>();
const loadersByKey = new Map<string, () => Promise<unknown>>();
const jobsByApp = new Map<BulkJobApp, StoredBulkJob[]>();
/**
 * The gateway idempotency store in front of the bulk-jobs submit and retry
 * routes: key = app + route (+ jobId for retry) + client key. Only 2xx results
 * are stored; a failed request releases the key so the same key can be resent.
 */
interface StoredIdempotentResult {
  fingerprint: string;
  result: BulkJobSubmitResult;
}
const submitIdempotency = new Map<string, StoredIdempotentResult>();
const retryIdempotency = new Map<string, StoredIdempotentResult>();
const idempotencyInFlight = new Set<string>();

/** Test isolation keeps completed jobs and pending worker timers out of the next case. */
export function resetBulkJobsFake(): void {
  for (const jobs of jobsByApp.values()) {
    for (const stored of jobs) {
      if (stored.timer !== null) clearTimeout(stored.timer);
    }
  }
  jobsByApp.clear();
  submitIdempotency.clear();
  retryIdempotency.clear();
  idempotencyInFlight.clear();
}

/** Canonical JSON (sorted keys) so the same body always gives the same fingerprint. */
function fingerprintOf(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) {
        const entry = (input as Record<string, unknown>)[key];
        if (entry !== undefined) out[key] = canonical(entry);
      }
      return out;
    }
    return input;
  };
  return JSON.stringify(canonical(value) ?? null);
}

/**
 * Gateway reserve/commit around a write: same key + same body replays the
 * stored 2xx result; same key + different body is 422 GW.IDEM.MISMATCH; a key
 * still being processed is 409 GW.IDEM.IN_FLIGHT.
 */
async function withIdempotency(
  store: Map<string, StoredIdempotentResult>,
  idemKey: string,
  body: unknown,
  run: () => Promise<BulkJobSubmitResult>,
): Promise<BulkJobSubmitResult> {
  const fingerprint = fingerprintOf(body);
  if (idempotencyInFlight.has(idemKey)) {
    await fakeDelay(120);
    throw new ApiError(409, 'GW.IDEM.IN_FLIGHT');
  }
  const existing = store.get(idemKey);
  if (existing) {
    await fakeDelay(120);
    if (existing.fingerprint !== fingerprint) throw new ApiError(422, 'GW.IDEM.MISMATCH');
    return clone(existing.result);
  }
  idempotencyInFlight.add(idemKey);
  try {
    const result = await run();
    store.set(idemKey, { fingerprint, result: clone(result) });
    return clone(result);
  } finally {
    idempotencyInFlight.delete(idemKey);
  }
}

function validatePageParams(page: number, limit: number): void {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > BULK_JOB_LIMITS.maxPageSize
  ) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
}

function moduleKey(app: BulkJobApp, moduleName: string): string {
  return `${app}:${moduleName}`;
}

function appJobs(app: BulkJobApp): StoredBulkJob[] {
  let list = jobsByApp.get(app);
  if (!list) {
    list = [];
    jobsByApp.set(app, list);
  }
  return list;
}

function findJob(app: BulkJobApp, id: string): StoredBulkJob | undefined {
  return appJobs(app).find((entry) => entry.job.id === id);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function recomputeStats(record: StoredBulkJob): void {
  const counts: BulkJobCounts = { succeeded: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 };
  let processed = 0;

  for (const item of record.items) {
    switch (item.status) {
      case 'SUCCEEDED':
        counts.succeeded++;
        processed++;
        break;
      case 'UNCHANGED':
        counts.unchanged++;
        processed++;
        break;
      case 'SKIPPED':
        counts.skipped++;
        processed++;
        break;
      case 'FAILED':
        counts.failed++;
        processed++;
        break;
      case 'CANCELLED':
        counts.cancelled++;
        processed++;
        break;
      default:
        break;
    }
  }

  record.job.counts = counts;
  record.job.processed = processed;
}

function clearTimer(record: StoredBulkJob): void {
  if (record.timer !== null) {
    clearTimeout(record.timer);
    record.timer = null;
  }
}

function scheduleNextChunk(app: BulkJobApp, record: StoredBulkJob, chunkIndex: number): void {
  clearTimer(record);
  const delay = Math.max(0, FAKE_BULK.chunkMs);
  record.timer = setTimeout(() => {
    record.timer = null;
    void processChunk(app, record, chunkIndex);
  }, delay);
}

async function processChunk(app: BulkJobApp, record: StoredBulkJob, chunkIndex: number): Promise<void> {
  if (!isBulkJobActive(record.job.status)) return;

  if (FAKE_BULK.stallAfterChunk >= 0 && chunkIndex >= FAKE_BULK.stallAfterChunk) {
    const now = new Date().toISOString();
    for (const item of record.items) {
      if (item.status === 'PENDING' || item.status === 'DISPATCHED') {
        item.status = 'FAILED';
        item.code = 'BULK_JOB_CHUNK_STALLED';
      }
    }
    record.job.status = 'FAILED';
    record.job.failureCode = 'BULK_JOB_CHUNK_STALLED';
    record.job.finishedAt = now;
    recomputeStats(record);
    record.job.revision++;
    return;
  }

  if (record.job.status === 'QUEUED') {
    record.job.status = 'RUNNING';
    record.job.startedAt ??= new Date().toISOString();
  }

  const chunk = record.items.filter((item) => item.status === 'PENDING').slice(0, record.chunkSize);
  if (chunk.length === 0) {
    finishJob(record);
    return;
  }

  const handler = await resolveFakeBulkModule(app, record.job.module);
  if (!handler) {
    failJob(record, 'BULK_JOB_MODULE_UNKNOWN');
    return;
  }

  try {
    const results = await handler.executeChunk(clone(record.job), clone(record.params), clone(chunk));
    const byOrdinal = new Map(record.items.map((item) => [item.ordinal, item]));
    const handled = new Set<number>();
    for (const res of results) {
      handled.add(res.ordinal);
      const target = byOrdinal.get(res.ordinal);
      if (!target) continue;
      target.status = res.status;
      if (res.code !== undefined) target.code = res.code;
      else delete target.code;
      if (res.field !== undefined) target.field = res.field;
      else delete target.field;
      if (res.refId !== undefined) target.refId = res.refId;
      else delete target.refId;
    }
    for (const item of chunk) {
      if (!handled.has(item.ordinal)) {
        const target = byOrdinal.get(item.ordinal);
        if (target && target.status === 'PENDING') {
          target.status = 'FAILED';
          target.code = 'generic';
        }
      }
    }
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'generic';
    for (const item of chunk) {
      item.status = 'FAILED';
      item.code = code;
    }
  }

  record.job.chunksDone++;

  if (record.job.status === 'CANCELLING') {
    for (const item of record.items) {
      if (item.status === 'PENDING' || item.status === 'DISPATCHED') {
        item.status = 'CANCELLED';
      }
    }
    record.job.status = 'CANCELLED';
    record.job.finishedAt = new Date().toISOString();
    recomputeStats(record);
    record.job.revision++;
    return;
  }

  recomputeStats(record);
  const hasPending = record.items.some((item) => item.status === 'PENDING');
  if (!hasPending) {
    finishJob(record);
    return;
  }

  record.job.revision++;
  scheduleNextChunk(app, record, chunkIndex + 1);
}

function finishJob(record: StoredBulkJob): void {
  recomputeStats(record);
  record.job.status = record.job.counts.failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  record.job.startedAt ??= new Date().toISOString();
  record.job.finishedAt = new Date().toISOString();
  record.job.revision++;
}

function failJob(record: StoredBulkJob, code: string): void {
  for (const item of record.items) {
    if (item.status === 'PENDING' || item.status === 'DISPATCHED') {
      item.status = 'FAILED';
      item.code = code;
    }
  }
  record.job.status = 'FAILED';
  record.job.failureCode = code;
  record.job.finishedAt = new Date().toISOString();
  recomputeStats(record);
  record.job.revision++;
}

function mergeRetryParams(original: unknown, overrides: unknown | null): unknown {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return clone(original);
  }
  if (!original || typeof original !== 'object' || Array.isArray(original)) {
    return clone(overrides);
  }
  const base = clone(original) as Record<string, unknown>;
  const patch = clone(overrides) as Record<string, unknown>;

  if (
    'startAt' in patch &&
    typeof base['schedule'] === 'object' &&
    base['schedule'] !== null &&
    !('schedule' in patch)
  ) {
    const { startAt, ...rest } = patch;
    return {
      ...base,
      ...rest,
      schedule: { ...(base['schedule'] as Record<string, unknown>), startAt },
    };
  }

  return { ...base, ...patch };
}

export function registerFakeBulkModule(app: BulkJobApp, module: FakeBulkModule): void {
  modulesByKey.set(moduleKey(app, module.module), module);
}

/** Registers a lazy loader; the imported file must call registerFakeBulkModule when evaluated. */
export function registerFakeBulkModuleLoader(app: BulkJobApp, moduleName: string, load: () => Promise<unknown>): void {
  loadersByKey.set(moduleKey(app, moduleName), load);
}

async function resolveFakeBulkModule(app: BulkJobApp, moduleName: string): Promise<FakeBulkModule | undefined> {
  const key = moduleKey(app, moduleName);
  let handler = modulesByKey.get(key);
  if (!handler) {
    const load = loadersByKey.get(key);
    if (load) {
      await load();
      handler = modulesByKey.get(key);
    }
  }
  return handler;
}

function hasDuplicates(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

/**
 * POST /bulk-jobs. Follows BulkJobsSubmitService.submit / submitInTransaction
 * (shared-libs/packages/bulk-jobs/src/kit/submit.service.ts) step by step.
 */
export async function fakeSubmitBulkJob(app: BulkJobApp, body: BulkJobSubmit, key: string): Promise<BulkJobSubmitResult> {
  return withIdempotency(submitIdempotency, `${app}:submit:${key}`, body, async () => {
    await fakeDelay();
    return submitBulkJobNow(app, body);
  });
}

async function submitBulkJobNow(app: BulkJobApp, body: BulkJobSubmit): Promise<BulkJobSubmitResult> {
  const maxItems = BULK_JOB_LIMITS.maxItems;
  // 1. An oversized IDS envelope is a 422 before any schema check.
  if (body.selection.kind === 'IDS' && body.selection.ids.length > maxItems) {
    throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(maxItems)] });
  }

  // 2. Envelope schema (400): IDS non-empty and unique, excludedIds unique.
  if (body.selection.kind === 'IDS') {
    if (body.selection.ids.length === 0 || hasDuplicates(body.selection.ids)) {
      throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  } else if (body.selection.excludedIds && hasDuplicates(body.selection.excludedIds)) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }

  // 3. Unknown module (400).
  const handler = await resolveFakeBulkModule(app, body.module);
  if (!handler) {
    throw new ApiError(400, 'BULK_JOB_MODULE_UNKNOWN');
  }

  // 4. Params / query schema, then the handler's authorizeSubmit (stage, reason, access).
  handler.validate?.(body);
  await handler.validateAsync?.(body);

  // 5. One active job per user (409).
  const active = appJobs(app).find((entry) => isBulkJobActive(entry.job.status));
  if (active) {
    // The kit sends { activeJobId: '<id>' }; the shared exception filter keeps only
    // string-array details, so the fake keeps the array shape. The tracker reads both.
    throw new ApiError(409, 'BULK_JOB_ACTIVE', { activeJobId: [active.job.id] });
  }

  // 6. Resolve the selection, then the item limit (422) on the resolved rows.
  let resolved = await handler.resolve(body, FAKE_ACTOR_USER_ID);
  if (resolved.length > maxItems) {
    throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(maxItems)] });
  }
  if (body.selection.kind === 'QUERY' && body.selection.excludedIds?.length) {
    const excluded = new Set(body.selection.excludedIds);
    resolved = resolved.filter((entry) => !excluded.has(entry.entityId));
  }

  const prepared = handler.prepare?.(body, resolved);
  const items: BulkJobItem[] = resolved.map((entry, index) => ({
    ordinal: index + 1,
    entityId: entry.entityId,
    label: entry.label.slice(0, 200),
    status: entry.preStatus ?? 'PENDING',
    ...(entry.code ? { code: entry.code } : {}),
    ...(entry.data ? { data: { ...entry.data } } : {}),
  }));

  let skippedAtSubmit = 0;
  let failedAtSubmit = 0;
  let pendingCount = 0;
  for (const item of items) {
    if (item.status === 'SKIPPED') skippedAtSubmit++;
    else if (item.status === 'FAILED') failedAtSubmit++;
    else pendingCount++;
  }

  const rawChunkSize = handler.chunkSize?.(body.action) ?? BULK_JOB_LIMITS.chunkSize;
  const chunkSize = Math.max(1, Math.min(BULK_JOB_LIMITS.chunkSize, Math.trunc(rawChunkSize)));
  const chunkCount = Math.ceil(pendingCount / chunkSize);
  const now = new Date().toISOString();
  const jobId = fakeId();
  const summary = prepared?.summary ? { ...prepared.summary } : undefined;

  const job: BulkJob = {
    id: jobId,
    app,
    module: body.module,
    action: body.action,
    scope: { ...body.scope },
    status: pendingCount === 0 ? (failedAtSubmit > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED') : 'QUEUED',
    total: items.length,
    processed: skippedAtSubmit + failedAtSubmit,
    counts: {
      succeeded: 0,
      unchanged: 0,
      skipped: skippedAtSubmit,
      failed: failedAtSubmit,
      cancelled: 0,
    },
    chunkCount,
    chunksDone: 0,
    paramsSummary: handler.paramsSummary(body),
    ...(summary ? { summary } : {}),
    createdAt: now,
    ...(pendingCount === 0 ? { startedAt: now, finishedAt: now } : {}),
    revision: 1,
  };

  const stored: StoredBulkJob = { job, params: clone(body.params), items, chunkSize, timer: null };
  appJobs(app).unshift(stored);

  if (pendingCount > 0) {
    scheduleNextChunk(app, stored, 0);
  }

  return {
    jobId,
    status: job.status,
    total: items.length,
    skippedAtSubmit,
    failedAtSubmit,
    chunkCount,
    ...(summary ? { summary: { ...summary } } : {}),
  };
}

export async function fakeGetBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  await fakeDelay(120);
  if (FAKE_BULK.getFailures > 0) {
    FAKE_BULK.getFailures--;
    throw new TypeError('Failed to fetch');
  }
  const found = findJob(app, id);
  if (!found) {
    throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
  }
  return clone(found.job);
}

export async function fakeListBulkJobItems(
  app: BulkJobApp,
  id: string,
  q: ListBulkJobItemsQuery,
): Promise<BulkJobPage<BulkJobItem>> {
  await fakeDelay(150);
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  validatePageParams(page, limit);

  const found = findJob(app, id);
  if (!found) {
    throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
  }

  const filtered = q.status ? found.items.filter((item) => item.status === q.status) : found.items;
  const slice = filtered.slice((page - 1) * limit, page * limit).map((item) => clone(item));

  const handler = await resolveFakeBulkModule(app, found.job.module);
  if (handler?.current && slice.length > 0) {
    const currentMap = await handler.current(slice.map((item) => item.entityId));
    for (const item of slice) {
      item.current = currentMap.get(item.entityId) ?? null;
    }
  }

  return { items: slice, total: filtered.length, page, limit };
}

export async function fakeListBulkJobs(app: BulkJobApp, q: ListBulkJobsQuery): Promise<BulkJobPage<BulkJob>> {
  await fakeDelay(120);
  const scope = q.scope ?? 'recent';
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  validatePageParams(page, limit);

  const filtered = appJobs(app)
    .filter((entry) => !q.module || entry.job.module === q.module)
    .filter((entry) => (scope === 'active' ? isBulkJobActive(entry.job.status) : true))
    .slice()
    .sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt));

  const items = filtered.slice((page - 1) * limit, page * limit).map((entry) => clone(entry.job));
  return { items, total: filtered.length, page, limit };
}

export async function fakeCancelBulkJob(app: BulkJobApp, id: string): Promise<BulkJob> {
  await fakeDelay(150);
  const found = findJob(app, id);
  if (!found) {
    throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
  }

  const status = found.job.status;
  if (status === 'QUEUED') {
    clearTimer(found);
    const now = new Date().toISOString();
    found.job.cancelRequestedAt = now;
    found.job.finishedAt = now;
    found.job.status = 'CANCELLED';
    for (const item of found.items) {
      if (item.status === 'PENDING' || item.status === 'DISPATCHED') {
        item.status = 'CANCELLED';
      }
    }
    recomputeStats(found);
    found.job.revision++;
    return clone(found.job);
  }

  if (status === 'RUNNING') {
    found.job.cancelRequestedAt ??= new Date().toISOString();
    found.job.status = 'CANCELLING';
    found.job.revision++;
    return clone(found.job);
  }

  if (status === 'CANCELLING' || status === 'CANCELLED') {
    return clone(found.job);
  }

  throw new ApiError(409, 'BULK_JOB_FINISHED');
}

export async function fakeRetryBulkJob(
  app: BulkJobApp,
  id: string,
  overrides: unknown | null,
  key: string,
): Promise<BulkJobSubmitResult> {
  const retryBody = overrides === null || overrides === undefined ? {} : { overrides };
  return withIdempotency(retryIdempotency, `${app}:retry:${id}:${key}`, retryBody, async () => {
    await fakeDelay(150);
    // BulkJobsCommandService.retry: own job (404), finished job (409), failed items (422), then submit.
    const found = findJob(app, id);
    if (!found) {
      throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
    }
    if (isBulkJobActive(found.job.status)) {
      throw new ApiError(409, 'BULK_JOB_ACTIVE', { activeJobId: [found.job.id] });
    }

    const failedIds = found.items.filter((item) => item.status === 'FAILED').map((item) => item.entityId);
    if (failedIds.length === 0) {
      throw new ApiError(422, 'BULK_JOB_NOTHING_TO_RETRY');
    }

    return submitBulkJobNow(app, {
      module: found.job.module,
      action: found.job.action,
      scope: { ...found.job.scope },
      selection: { kind: 'IDS', ids: failedIds },
      params: mergeRetryParams(found.params, overrides),
    });
  });
}
