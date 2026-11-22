import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBulkJob } from '../../../shared/bulk-jobs/bulk-jobs.api';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { FAKE_ME, setFakeActor } from './automation-fake-actors';
import * as api from './imports.api';
import { getImportTargets, getMapping, getRun, getRunCounts, listMappings, listResults, listRuns } from './imports.api';
import { fakeImportVersion, setFakeImportContext } from './imports.fake';
import type {
  CreateImportMappingInput,
  ImportRun,
  MappingFieldInput,
  PreviewImportInput,
  UpdateImportMappingInput,
} from './imports.model';

// Write wrappers: each call is a new user action (fresh UUIDv7 key) and sends the stored version as If-Match,
// unless a test pins its own key or version.
const key = () => newIdempotencyKey();
const uploadSource = (f: File, onProgress?: (percent: number) => void, k = key()) => api.uploadSource(f, k, onProgress);
const releaseSource = (sourceId: string, k = key()) => api.releaseSource(sourceId, k);
const preview = (input: PreviewImportInput, k = key()) => api.preview(input, k);
const execute = (runId: string, ifMatch = fakeImportVersion(runId), k = key()) => api.execute(runId, ifMatch, k);
const cancelRun = (runId: string, ifMatch = fakeImportVersion(runId), k = key()) => api.cancelRun(runId, ifMatch, k);
const createMapping = (input: CreateImportMappingInput, k = key()) => api.createMapping(input, k);
const updateMapping = (id: string, input: UpdateImportMappingInput, ifMatch = fakeImportVersion(id), k = key()) =>
  api.updateMapping(id, input, ifMatch, k);
const publishMapping = (id: string, ifMatch = fakeImportVersion(id), k = key()) => api.publishMapping(id, ifMatch, k);
const discardMappingDraft = (id: string, ifMatch = fakeImportVersion(id), k = key()) =>
  api.discardMappingDraft(id, ifMatch, k);

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

/** Advances the fake clock by a fixed time (so background worker timers do not all run) and settles the call. */
async function settleFor<T>(promise: Promise<T>, ms: number): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const MAPPING_ID = 'map-item-settings';
const SEEDED_SOURCE = '0193b000-0000-7000-8000-000000000003';
const CSV = 'text/csv';

function file(name: string, content: BlobPart = 'ItemCode,CanSell\nA1,yes\n', type = CSV): File {
  return new File([content], name, { type });
}

function sizedFile(name: string, size: number, content: BlobPart = 'ItemCode\nA1\n'): File {
  const f = file(name, content);
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

const XLSX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

const COMPANY_FIELDS: MappingFieldInput[] = [
  { sourceColumnCode: 'ItemCode', sourceOrdinal: 0, targetFieldCode: 'ITEM_CODE', transformCode: 'NORMALIZE_CODE', isRequired: true },
  { sourceColumnCode: 'CanSell', sourceOrdinal: 1, targetFieldCode: 'CAN_SELL', transformCode: 'ENUM_MAP', lookupCode: 'BOOLEAN_V1', isRequired: true },
  { sourceColumnCode: 'CanPurchase', sourceOrdinal: 2, targetFieldCode: 'CAN_PURCHASE', transformCode: 'ENUM_MAP', lookupCode: 'BOOLEAN_V1', isRequired: true },
  { sourceColumnCode: 'TrackInventory', sourceOrdinal: 3, targetFieldCode: 'TRACK_INVENTORY', transformCode: 'ENUM_MAP', lookupCode: 'BOOLEAN_V1', isRequired: true },
  { sourceColumnCode: 'TrackingMode', sourceOrdinal: 4, targetFieldCode: 'TRACKING_MODE', transformCode: 'NORMALIZE_CODE', lookupCode: 'TRACKING_MODE_V1', isRequired: true },
];

/** Uploads a file and previews it, then lets the fake preview worker finish (PENDING -> PREVIEWING -> PREVIEWED/FAILED). */
async function previewedRun(name: string, predecessorRunId?: string): Promise<ImportRun> {
  const source = await settle(uploadSource(file(name)));
  const accepted = await settleFor(
    preview({ mappingId: MAPPING_ID, sourceId: source.fileId, ...(predecessorRunId ? { predecessorRunId } : {}) }),
    300,
  );
  await vi.advanceTimersByTimeAsync(3200);
  return settle(getRun(accepted.runId));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-21T12:00:00.000Z'));
  setFakeActor(FAKE_ME);
  setFakeImportContext({ companyId: 'c1', branchId: null });
});

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(60_000);
  setFakeActor(FAKE_ME);
  setFakeImportContext({ companyId: 'c1', branchId: null });
  vi.useRealTimers();
});

describe('import targets', () => {
  it('returns the registry object with uppercase field codes, transforms and lookups', async () => {
    const res = await settle(getImportTargets());

    expect(res.registryVersion).toBe(1);
    expect(Object.keys(res.lookups)).toEqual(['BOOLEAN_V1', 'TRACKING_MODE_V1']);
    const company = res.targets.find((t) => t.code === 'CATALOG_COMPANY_PROFILE')!;
    expect(company.dtoCode).toBe('trade.catalog.company-profile.import-row');
    expect(company.fields.filter((f) => f.required).map((f) => f.code)).toEqual([
      'ITEM_CODE',
      'CAN_SELL',
      'CAN_PURCHASE',
      'TRACK_INVENTORY',
      'TRACKING_MODE',
    ]);
    expect(company.fields.find((f) => f.code === 'TAX_CLASSIFICATION_KEY')?.allowedTransforms).toEqual(['TRIM']);
  });
});

describe('import source upload and release', () => {
  it('stores a csv source and returns the backend projection', async () => {
    const source = await settle(uploadSource(file('items.csv')));

    expect(source.fileName).toBe('items.csv');
    expect(source.mediaType).toBe(CSV);
    expect(source.sha256).toHaveLength(64);
    expect(source.sourceObjectRef).toBeTruthy();
    expect(source.storedSize).toBeGreaterThan(0);
  });

  it('detects xlsx from the bytes, not from the name', async () => {
    const source = await settle(uploadSource(file('named.csv', XLSX_BYTES)));

    expect(source.mediaType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('replays the same idempotency key to the same source', async () => {
    const key = newIdempotencyKey();
    const first = await settle(uploadSource(file('again.csv'), undefined, key));
    const again = await settle(uploadSource(file('again.csv'), undefined, key));

    expect(again.fileId).toBe(first.fileId);
  });

  it('requires a UUIDv7 idempotency key', async () => {
    const error = await rejection(uploadSource(file('key.csv'), undefined, 'not-a-key'));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.IDEMPOTENCY.KEY_REQUIRED');
    expect(error.details?.['reason']).toEqual(['import_source_idempotencykey_invalid']);
  });

  it('rejects an empty file with 400 FILE_UNSAFE and binary non-zip bytes with 415', async () => {
    const empty = await rejection(uploadSource(sizedFile('empty.csv', 0)));
    const binary = await rejection(uploadSource(file('bin.csv', new Uint8Array([1, 0, 2, 0]))));

    expect([empty.status, empty.code]).toEqual([400, 'TRADE.IMPORT.FILE_UNSAFE']);
    expect([binary.status, binary.code]).toEqual([415, 'TRADE.IMPORT.FILE_TYPE_UNSUPPORTED']);
  });

  it('rejects a csv above sixteen megabytes and an xlsx above eight megabytes with 413', async () => {
    const csv = await rejection(uploadSource(sizedFile('big.csv', 16 * 1024 * 1024 + 1)));
    const xlsx = await rejection(uploadSource(sizedFile('big.xlsx', 8 * 1024 * 1024 + 1, XLSX_BYTES)));

    expect([csv.status, csv.code]).toEqual([413, 'TRADE.IMPORT.FILE_TOO_LARGE']);
    expect(csv.details).toBeUndefined();
    expect(xlsx.details?.['reason']).toEqual(['xlsx_over_8_mib']);
  });

  it('releases an unused source, replays a repeated release and then rejects previews of it', async () => {
    const source = await settle(uploadSource(file('release.csv')));

    const released = await settle(releaseSource(source.fileId));
    const again = await settle(releaseSource(source.fileId));
    const previewError = await rejection(preview({ mappingId: MAPPING_ID, sourceId: source.fileId }));

    expect(released).toMatchObject({ sourceId: source.fileId, storageState: 'PURGED', idempotentReplay: false });
    expect(again.idempotentReplay).toBe(true);
    expect([previewError.status, previewError.code]).toEqual([422, 'TRADE.IMPORT.FILE_REJECTED']);
  });

  it('answers 403 SOURCE_RELEASE_FORBIDDEN for an unknown source', async () => {
    const error = await rejection(releaseSource(newIdempotencyKey()));

    expect([error.status, error.code]).toEqual([403, 'TRADE.IMPORT.SOURCE_RELEASE_FORBIDDEN']);
  });

  it('refuses to release a source that a previewed run still holds', async () => {
    const run = await previewedRun('release-in-use.csv');

    const error = await rejection(releaseSource(run.sourceId));

    expect([error.status, error.code]).toEqual([409, 'TRADE.IMPORT.SOURCE_IN_USE']);
  });
});

describe('import preview', () => {
  it('answers 202 with the queued run id, then the run moves to PREVIEWED with row counts', async () => {
    const source = await settle(uploadSource(file('preview.csv')));

    const accepted = await settleFor(preview({ mappingId: MAPPING_ID, sourceId: source.fileId }), 300);
    const pending = await settleFor(getRun(accepted.runId), 200);
    await vi.advanceTimersByTimeAsync(3200);
    const done = await settle(getRun(accepted.runId));

    expect(accepted).toMatchObject({ status: 'PENDING', dispatchStatus: 'QUEUED', sourceId: source.fileId, mappingVersionId: 'mapv-item-1' });
    expect(pending.progress.phase).toBe('PREVIEW');
    expect(done.status).toBe('PREVIEWED');
    expect(done.totalCount).toBe('660');
    expect(done.targetDtoCode).toBe('trade.catalog.company-profile.import-row');
    expect(done.fileName).toBe('preview.csv');
  });

  it('reports invalid rows with uppercase field codes', async () => {
    const run = await previewedRun('rows-error.csv');
    const invalid = await settle(listResults(run.id, { status: 'INVALID' }));

    expect(run.invalidCount).toBe('6');
    expect(invalid.items[0]).toMatchObject({ errorFieldCode: 'CAN_SELL', ownerAggregateType: null });
  });

  it('fails the run with a PREVIEW failure code for a file whose header does not match', async () => {
    const run = await previewedRun('header-fail.csv');

    expect(run.status).toBe('FAILED');
    expect(run.failure).toEqual({ phase: 'PREVIEW', code: 'WORKER.TRADE_IMPORT.MAPPING_HEADER_MISMATCH' });
  });

  it('marks the rows that a predecessor run already imported as SKIPPED', async () => {
    const run = await previewedRun('again.csv', 'run-completed-3');
    const skipped = await settle(listResults(run.id, { status: 'SKIPPED', limit: 1 }));

    expect(run.validCount).toBe('0');
    expect(skipped.total).toBe(660);
  });

  it('refuses a predecessor that is still active with 422 MAPPING_INVALID', async () => {
    const error = await rejection(preview({ mappingId: MAPPING_ID, sourceId: SEEDED_SOURCE, predecessorRunId: 'run-previewed-2' }));

    expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.MAPPING_INVALID']);
  });

  it('refuses an unknown source with 422 FILE_REJECTED', async () => {
    const error = await rejection(preview({ mappingId: MAPPING_ID, sourceId: newIdempotencyKey() }));

    expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.FILE_REJECTED']);
  });

  it('refuses a tenant context with 422 SCOPE_MISMATCH', async () => {
    setFakeImportContext({ companyId: null, branchId: null });

    const error = await rejection(preview({ mappingId: MAPPING_ID, sourceId: SEEDED_SOURCE }));

    expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.SCOPE_MISMATCH']);
  });

  it('replays the same idempotency key without creating a second run', async () => {
    const source = await settle(uploadSource(file('idem.csv')));
    const input = { mappingId: MAPPING_ID, sourceId: source.fileId };

    const k = key();
    const first = await settleFor(preview(input, k), 300);
    const again = await settleFor(preview(input, k), 300);

    expect(again.runId).toBe(first.runId);
  });
});

describe('import execute as a worker job', () => {
  it('answers 202 with run id, status and job id, then completes through the worker', async () => {
    const run = await previewedRun('exec-clean.csv');

    const started = await settleFor(execute(run.id, run.version), 650);
    const executing = await settleFor(getRun(run.id), 400);
    await vi.advanceTimersByTimeAsync(10_000);
    const done = await settle(getRun(run.id));
    const job = await settle(getBulkJob('trading', started.jobId!));

    expect(Object.keys(started).sort()).toEqual(['jobId', 'runId', 'status']);
    expect(started.status).toBe('EXECUTING');
    expect(executing.bulkJobId).toBe(started.jobId);
    expect(executing.progress.phase).toBe('EXECUTE');
    expect(done.status).toBe('COMPLETED');
    expect(done.succeededCount).toBe('660');
    expect(job.status).toBe('COMPLETED');
  });

  it('records SUCCEEDED rows with the owner aggregate', async () => {
    const run = await previewedRun('exec-rows.csv');
    await settleFor(execute(run.id), 650);
    await vi.advanceTimersByTimeAsync(10_000);

    const results = await settle(listResults(run.id, { status: 'SUCCEEDED', limit: 100 }));

    expect(results.total).toBe(660);
    expect(results.items.every((r) => r.ownerAggregateId && r.ownerAggregateType && r.completedAt)).toBe(true);
  });

  it('refuses a second execute while a worker job is active with 409 BULK_JOB_ACTIVE', async () => {
    const first = await previewedRun('exec-first.csv');
    const second = await previewedRun('exec-second.csv');
    await settleFor(execute(first.id), 650);

    const error = await rejection(execute(second.id));
    const after = await settle(getRun(second.id));

    expect([error.status, error.code]).toEqual([409, 'BULK_JOB_ACTIVE']);
    expect(error.details).toEqual({ reason: ['active_job_exists'] });
    expect(after.status).toBe('PREVIEWED');
    expect(after.bulkJobId).toBeNull();
  });

  it('refuses a run that is not previewed, has invalid rows, or has no valid rows', async () => {
    const notPreviewed = await rejection(execute('run-completed-3'));
    const invalid = await rejection(execute((await previewedRun('exec-error.csv')).id));
    const noValid = await rejection(execute((await previewedRun('exec-skip.csv', 'run-completed-3')).id));

    expect([notPreviewed.status, notPreviewed.code]).toEqual([409, 'TRADE.IMPORT.RUN_NOT_EXECUTABLE']);
    expect(notPreviewed.details?.['reason']).toEqual(['run_not_previewed']);
    expect(invalid.details?.['reason']).toEqual(['has_invalid_rows']);
    expect(noValid.details?.['reason']).toEqual(['no_valid_rows']);
  });

  it('rejects a stale If-Match on execute with 409 STALE_VERSION', async () => {
    const run = await previewedRun('exec-stale.csv');

    const error = await rejection(execute(run.id, run.version + 7));

    expect([error.status, error.code]).toEqual([409, 'TRADE.CONCURRENCY.STALE_VERSION']);
  });

  it('replays the same idempotency key to the same job id', async () => {
    const run = await previewedRun('exec-idem.csv');

    const k = key();
    const first = await settleFor(execute(run.id, run.version, k), 650);
    const again = await settleFor(execute(run.id, run.version, k), 350);

    expect(again.jobId).toBe(first.jobId);
  });
});

describe('import cancel', () => {
  it('cancels a pending run at once', async () => {
    const source = await settle(uploadSource(file('cancel-pending.csv')));
    const accepted = await settleFor(preview({ mappingId: MAPPING_ID, sourceId: source.fileId }), 300);

    const cancelled = await settleFor(cancelRun(accepted.runId), 200);
    await vi.advanceTimersByTimeAsync(4000);
    const after = await settle(getRun(accepted.runId));

    expect(cancelled).toEqual({ runId: accepted.runId, status: 'CANCELLED', jobId: null });
    expect(after.status).toBe('CANCELLED');
  });

  it('requests cancellation of an executing job; the run stays EXECUTING until the job reports back', async () => {
    const run = await previewedRun('cancel-queued.csv');
    await settleFor(execute(run.id), 650);

    const requested = await settleFor(cancelRun(run.id), 400);
    const repeated = await settleFor(cancelRun(run.id), 400);
    const after = await settle(getRun(run.id));

    expect(requested.status).toBe('EXECUTING');
    expect(requested.jobId).toBeTruthy();
    expect(repeated).toEqual(requested);
    expect(after.status).toBe('CANCELLED');
    expect(Number(after.succeededCount) + Number(after.cancelledCount)).toBe(660);
  });

  it('frees the worker slot after a cancellation', async () => {
    const first = await previewedRun('cancel-free-a.csv');
    const second = await previewedRun('cancel-free-b.csv');
    await settleFor(execute(first.id), 650);
    await settleFor(cancelRun(first.id), 400);

    const started = await settleFor(execute(second.id), 650);

    expect(started.status).toBe('EXECUTING');
  });

  it('refuses an executing run without a job with reason bulk_job_missing', async () => {
    const error = await rejection(cancelRun('run-executing-1'));

    expect([error.status, error.code]).toEqual([409, 'TRADE.IMPORT.RUN_NOT_EXECUTABLE']);
    expect(error.details?.['reason']).toEqual(['bulk_job_missing']);
  });

  it('refuses to cancel a finished run with 409 RUN_FINISHED', async () => {
    const error = await rejection(cancelRun('run-completed-3'));

    expect([error.status, error.code]).toEqual([409, 'TRADE.IMPORT.RUN_FINISHED']);
  });
});

describe('import run lists and counts', () => {
  it('reports total and byStatus that add up', async () => {
    const counts = await settle(getRunCounts());

    expect(Object.keys(counts.byStatus)).toHaveLength(8);
    expect(Object.values(counts.byStatus).reduce((a, b) => a + b, 0)).toBe(counts.total);
    expect(counts.byStatus.COMPLETED_WITH_ERRORS).toBeGreaterThanOrEqual(1);
  });

  it('accepts a comma separated status filter and rejects an unknown status', async () => {
    const page = await settle(listRuns({ status: 'COMPLETED,FAILED' }));
    const error = await rejection(listRuns({ status: 'DONE' }));

    expect(page.items.every((r) => r.status === 'COMPLETED' || r.status === 'FAILED')).toBe(true);
    expect([error.status, error.code]).toEqual([400, 'TRADE.VALIDATION_FAILED']);
  });

  it('searches runs by file name with q and returns the run projection', async () => {
    const page = await settle(listRuns({ q: 'PARTIAL' }));
    const run = page.items[0];

    expect(page.items).toHaveLength(1);
    expect(run).not.toHaveProperty('mappingCode');
    expect(run).not.toHaveProperty('skippedCount');
    expect(run).toMatchObject({ mode: 'PER_ROW', companyId: 'c1', branchId: null, bulkJobId: null });
  });

  it('defaults to fifty per page and rejects page 0 and a limit above 100', async () => {
    const page = await settle(listRuns());
    const zero = await rejection(listRuns({ page: 0 }));
    const big = await rejection(listResults('run-completed-3', { limit: 101 }));

    expect(page.limit).toBe(50);
    expect(zero.code).toBe('TRADE.VALIDATION_FAILED');
    expect(big.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('hides company runs from a branch context', async () => {
    setFakeImportContext({ companyId: 'c1', branchId: 'b1' });

    const page = await settle(listRuns());
    const error = await rejection(getRun('run-completed-3'));

    expect(page.total).toBe(0);
    expect([error.status, error.code]).toEqual([404, 'TRADE.IMPORT.RUN_NOT_FOUND']);
  });
});

describe('import mappings', () => {
  it('lists projected mappings without versions, newest first', async () => {
    const page = await settle(listMappings());

    expect(page.limit).toBe(50);
    expect(page.items[0].id).toBe('map-branch-assortment');
    expect(page.items[0]).not.toHaveProperty('versions');
  });

  it('returns the detail with versions and backend field codes', async () => {
    const detail = await settle(getMapping(MAPPING_ID));

    expect(detail.versions[0]).toMatchObject({ targetDtoCode: 'trade.catalog.company-profile.import-row', executionMode: 'PER_ROW' });
    expect(detail.versions[0].fields[0]).toMatchObject({ targetFieldCode: 'ITEM_CODE', lookupCode: null });
  });

  it('creates a DRAFT mapping and answers the entity with its draft version and fields', async () => {
    const created = await settle(createMapping({ code: 'NEW_ITEMS', targetCode: 'CATALOG_COMPANY_PROFILE', scopeTarget: 'COMPANY', fields: COMPANY_FIELDS }));

    expect(created.status).toBe('DRAFT');
    expect(created.draftVersion).toMatchObject({ versionNumber: 1, status: 'DRAFT', mappingId: created.id });
    expect(created.fields).toHaveLength(5);
    expect(created.fields[0].lookupCode).toBeNull();
  });

  it('rejects a branch mapping outside a branch context with 422 SCOPE_MISMATCH', async () => {
    const error = await rejection(
      createMapping({ code: 'BRANCH_X', targetCode: 'CATALOG_BRANCH_ASSIGNMENT', scopeTarget: 'BRANCH', branchId: 'b1', fields: COMPANY_FIELDS }),
    );

    expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.SCOPE_MISMATCH']);
  });

  it('answers a duplicate code with 422 MAPPING_INVALID (no conflict code in the backend)', async () => {
    const error = await rejection(
      createMapping({ code: 'ITEM_SETTINGS', targetCode: 'CATALOG_COMPANY_PROFILE', scopeTarget: 'COMPANY', fields: COMPANY_FIELDS }),
    );

    expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.MAPPING_INVALID']);
  });

  it('rejects a missing required field, a transform the field does not allow and a duplicate column', async () => {
    const make = (fields: MappingFieldInput[]) =>
      rejection(updateMapping(MAPPING_ID, { fields: fields as MappingFieldInput[] }));
    const missing = await make(COMPANY_FIELDS.slice(0, 4));
    const badTransform = await make(COMPANY_FIELDS.map((f, i) => (i === 1 ? { ...f, transformCode: 'TRIM' as const } : f)));
    const dupColumn = await make(COMPANY_FIELDS.map((f, i) => (i === 1 ? { ...f, sourceColumnCode: 'itemcode' } : f)));

    for (const error of [missing, badTransform, dupColumn]) {
      expect([error.status, error.code]).toEqual([422, 'TRADE.IMPORT.MAPPING_INVALID']);
    }
  });

  it('opens a new draft when a published mapping is edited, publishes it and discards a draft', async () => {
    const before = await settle(getMapping(MAPPING_ID));

    const updated = await settle(updateMapping(MAPPING_ID, { fields: COMPANY_FIELDS }, before.version));
    const published = await settle(publishMapping(MAPPING_ID, updated.version));
    const reopened = await settle(updateMapping(MAPPING_ID, { fields: COMPANY_FIELDS }, published.version));
    const discarded = await settle(discardMappingDraft(MAPPING_ID, reopened.version));
    const missingDraft = await rejection(publishMapping(MAPPING_ID, discarded.version));

    expect(updated.createdDraftVersion).toBe(true);
    expect(updated.draftVersion.versionNumber).toBe(2);
    expect(published.currentPublishedVersionId).toBe(updated.draftVersion.id);
    expect(published.publishedVersion.status).toBe('PUBLISHED');
    expect(discarded).toEqual({ id: MAPPING_ID, version: reopened.version + 1, discardedVersionId: reopened.draftVersion.id });
    expect([missingDraft.status, missingDraft.code]).toEqual([422, 'TRADE.IMPORT.MAPPING_INVALID']);
  });

  it('rejects a stale If-Match on update with 409', async () => {
    const error = await rejection(updateMapping('map-branch-assortment', { fields: COMPANY_FIELDS }, 999));

    expect([error.status, error.code]).toEqual([409, 'TRADE.CONCURRENCY.STALE_VERSION']);
  });

  it('returns 404 MAPPING_NOT_FOUND for an unknown mapping', async () => {
    const error = await rejection(getMapping('nope'));

    expect([error.status, error.code]).toEqual([404, 'TRADE.IMPORT.MAPPING_NOT_FOUND']);
  });
});
