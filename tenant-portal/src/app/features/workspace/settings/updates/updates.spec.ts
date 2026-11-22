import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { applyUpdates, getOperation, listUpdates } from './updates.api';
import {
  FAKE_UPDATES_FAIL_NEXT,
  FAKE_UPDATES_OPERATION_OUTCOME,
  FAKE_UPDATES_STATE,
  fakeResetUpdates,
} from './updates.fake';
import { buildSnapshot, classifyApplyError, eligibilityOf, toApplySelections } from './updates.logic';
import { PAGE_SIZE, TenantAvailableUpdate, UpdateSelection, UpdatesQuery } from './updates.model';

/*
 * updates.api.ts over updates.fake.ts. GET updates is a Core PaginatedResult, so the envelope
 * gives { data, meta }; POST apply answers 202 { replayed, operation }; GET operation answers the
 * bare operation record. Apply checks key, selection shape, idempotency, tenant state, pins and
 * self-service rules in that order.
 */

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

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function query(overrides: Partial<UpdatesQuery> = {}): UpdatesQuery {
  return { page: 1, limit: PAGE_SIZE, sortBy: 'publishedAt', sortDir: 'DESC', ...overrides };
}

async function rowsFor(...keys: string[]): Promise<TenantAvailableUpdate[]> {
  const page = await settle(listUpdates(query({ limit: 100 })));
  return keys.map((key) => {
    const row = page.data.find((item) => item.componentKey === key);
    if (!row) throw new Error(`no row ${key}`);
    return row;
  });
}

async function selectionsFor(...keys: string[]): Promise<UpdateSelection[]> {
  return toApplySelections(buildSnapshot(await rowsFor(...keys)));
}

describe('updates api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeResetUpdates();
  });
  afterEach(() => {
    fakeResetUpdates();
    vi.useRealTimers();
  });

  describe('listUpdates', () => {
    it('returns { data, meta } with the first page newest first', async () => {
      const page = await settle(listUpdates(query()));
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.data).toHaveLength(PAGE_SIZE);
      expect(page.meta).toMatchObject({ page: 1, limit: PAGE_SIZE, total: 32, totalPages: 2 });
      expect(page.data[0].componentKey).toBe('crm.core');
    });

    // core-page.ts: Core's ResponseEnvelopeInterceptor turns a PaginatedResult into { data, meta }
    // with meta = { page, limit, total, totalPages, hasNext, hasPrev } and drops every other key
    // (checkedAt included).
    it('the list follows the Core envelope (no checkedAt, meta has hasNext/hasPrev)', async () => {
      const page = await settle(listUpdates(query()));
      expect(Object.keys(page).sort()).toEqual(['data', 'meta']);
      expect(Object.keys(page.meta).sort()).toEqual(['hasNext', 'hasPrev', 'limit', 'page', 'total', 'totalPages']);
    });

    it('clamps the page and returns the second page', async () => {
      const page = await settle(listUpdates(query({ page: 9 })));
      expect(page.meta.page).toBe(2);
      expect(page.data).toHaveLength(7);
    });

    it('filters by search, risk, backup and maintenance and sorts by component key', async () => {
      const crm = await settle(listUpdates(query({ search: 'crm', sortBy: 'componentKey', sortDir: 'ASC', limit: 100 })));
      const keys = crm.data.map((row) => row.componentKey);
      expect(keys.every((key) => key.startsWith('crm.'))).toBe(true);
      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));

      const high = await settle(listUpdates(query({ riskLevel: 'HIGH', limit: 100 })));
      expect(high.data.every((row) => row.availableRelease.riskLevel === 'HIGH')).toBe(true);

      const backup = await settle(listUpdates(query({ requiresBackup: true, limit: 100 })));
      expect(backup.data.map((row) => row.componentKey).sort()).toEqual(['accounting.banking', 'accounting.ledger']);
    });

    it('returns an empty page while blocked', async () => {
      FAKE_UPDATES_STATE.blocked = true;
      const page = await settle(listUpdates(query()));
      expect(page.data).toEqual([]);
      expect(page.meta).toMatchObject({ page: 1, total: 0, totalPages: 0 });
    });

    it('throws a configured list failure once', async () => {
      Object.assign(FAKE_UPDATES_FAIL_NEXT, { code: 'FORBIDDEN', on: 'list' });
      const error = await errorOf(listUpdates(query()));
      expect([error.status, error.code]).toEqual([403, 'FORBIDDEN']);
      await expect(settle(listUpdates(query()))).resolves.toBeTruthy();
    });
  });

  describe('applyUpdates', () => {
    it('accepts eligible selections and answers 202 { replayed: false, operation }', async () => {
      const selections = await selectionsFor('crm.core', 'trade.quotes');
      const res = await settle(applyUpdates({ selections }, newIdempotencyKey()));
      expect(res.replayed).toBe(false);
      expect(res.operation).toMatchObject({ type: 'UPDATE', status: 'QUEUED', progress: { totalSteps: 2, percent: 0 } });
      expect(res.operation.steps.map((step) => step.componentKey)).toEqual(['crm.core', 'trade.quotes']);

      const [row] = await rowsFor('crm.core');
      expect(row).toMatchObject({ updateAlreadyPlanned: true, lastOperationId: res.operation.id });
      expect(eligibilityOf(row)).toBe('PLANNED');
    });

    it('adds the runtime-bridge dependency step for three or more components', async () => {
      const selections = await selectionsFor('crm.core', 'trade.quotes', 'crm.activities');
      const res = await settle(applyUpdates({ selections }, newIdempotencyKey()));
      expect(res.operation.steps.at(-1)!.componentKey).toBe('platform.runtime-bridge');
    });

    it('replays the same key and body with replayed: true and the same operation', async () => {
      const selections = await selectionsFor('crm.core');
      const key = newIdempotencyKey();
      const first = await settle(applyUpdates({ selections }, key));
      const replay = await settle(applyUpdates({ selections }, key));
      expect(replay.replayed).toBe(true);
      expect(replay.operation.id).toBe(first.operation.id);
    });

    it('answers the idempotency codes', async () => {
      const selections = await selectionsFor('crm.core');
      const missing = await errorOf(applyUpdates({ selections }, ''));
      expect([missing.status, missing.code]).toEqual([400, 'IDEMPOTENCY_KEY_REQUIRED']);
      const bad = await errorOf(applyUpdates({ selections }, 'not-a-uuid'));
      expect([bad.status, bad.code]).toEqual([400, 'INVALID_IDEMPOTENCY_KEY']);

      const key = newIdempotencyKey();
      await settle(applyUpdates({ selections }, key));
      const other = await selectionsFor('trade.quotes');
      const mismatch = await errorOf(applyUpdates({ selections: other }, key));
      expect([mismatch.status, mismatch.code]).toEqual([422, 'IDEMPOTENCY_BODY_MISMATCH']);
    });

    it('answers 400 TENANT_PROVISIONING_UPDATE_SELECTION_INVALID for empty, duplicate or malformed selections', async () => {
      const empty = await errorOf(applyUpdates({ selections: [] }, newIdempotencyKey()));
      expect([empty.status, empty.code]).toEqual([400, 'TENANT_PROVISIONING_UPDATE_SELECTION_INVALID']);

      const [selection] = await selectionsFor('crm.core');
      const dup = await errorOf(applyUpdates({ selections: [selection, selection] }, newIdempotencyKey()));
      expect(dup.code).toBe('TENANT_PROVISIONING_UPDATE_SELECTION_INVALID');

      const malformed = await errorOf(applyUpdates({ selections: [{ ...selection, targetManifestChecksum: 'abc' }] }, newIdempotencyKey()));
      expect(malformed.code).toBe('TENANT_PROVISIONING_UPDATE_SELECTION_INVALID');
    });

    it('answers 409 SELECTION_STALE when a pin no longer matches', async () => {
      const [selection] = await selectionsFor('crm.core');
      const stale = { ...selection, targetReleaseVersion: '9.9.9' };
      const error = await errorOf(applyUpdates({ selections: [stale] }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([409, 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE']);
      expect(classifyApplyError(error)).toBe('stale');
    });

    it('answers 409 OPERATION_STATE_INVALID while another operation runs or the tenant is inactive', async () => {
      await settle(applyUpdates({ selections: await selectionsFor('crm.core') }, newIdempotencyKey()));
      const busy = await errorOf(applyUpdates({ selections: await selectionsFor('trade.quotes') }, newIdempotencyKey()));
      expect([busy.status, busy.code]).toEqual([409, 'TENANT_PROVISIONING_OPERATION_STATE_INVALID']);
      expect(classifyApplyError(busy)).toBe('blocked');

      fakeResetUpdates();
      FAKE_UPDATES_STATE.tenantActive = false;
      const inactive = await errorOf(applyUpdates({ selections: await selectionsFor('trade.quotes') }, newIdempotencyKey()));
      expect(inactive.code).toBe('TENANT_PROVISIONING_OPERATION_STATE_INVALID');
    });

    it('answers 422 NO_SELF_SERVICE_UPDATES for an admin-managed row', async () => {
      const [row] = await rowsFor('trade.core');
      expect(eligibilityOf(row)).toBe('ADMIN_MANAGED');
      const selection: UpdateSelection = {
        componentKey: row.componentKey,
        targetReleaseId: row.availableRelease.id,
        targetReleaseVersion: row.availableRelease.releaseVersion,
        targetManifestChecksum: row.availableRelease.manifestChecksum,
        currentAppliedReleaseId: row.current.releaseId,
        currentAppliedManifestChecksum: row.current.manifestChecksum!,
      };
      const error = await errorOf(applyUpdates({ selections: [selection] }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([422, 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES']);
    });

    // Core (tenant-provisioning-plan.service.ts) refuses self-service updates that require a backup
    // or a maintenance window with 422 NO_SELF_SERVICE_UPDATES, so the client never offers them.
    it('a requiresBackup or requiresMaintenance row is NEEDS_BACKUP_OR_MAINTENANCE, not ELIGIBLE', async () => {
      const [row] = await rowsFor('accounting.ledger');
      expect(row.availableRelease.requiresBackup).toBe(true);
      expect(eligibilityOf(row)).toBe('NEEDS_BACKUP_OR_MAINTENANCE');
      const maintenance = { ...row, availableRelease: { ...row.availableRelease, requiresBackup: false, requiresMaintenance: true } };
      expect(eligibilityOf(maintenance)).toBe('NEEDS_BACKUP_OR_MAINTENANCE');
      expect(buildSnapshot([row, maintenance])).toEqual([]);
    });

    it('classifies 422 NO_SELF_SERVICE_UPDATES as refused (its own message), not stale', async () => {
      const error = new ApiError(422, 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES');
      expect(classifyApplyError(error)).toBe('refused');
      expect(classifyApplyError(new ApiError(409, 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE'))).toBe('stale');
    });

    it('maps post-commit failures: NETWORK_AFTER_COMMIT is ambiguous, RESPONSE_UNREADABLE is unreadable', async () => {
      const selections = await selectionsFor('crm.core');
      const key = newIdempotencyKey();
      Object.assign(FAKE_UPDATES_FAIL_NEXT, { code: 'NETWORK_AFTER_COMMIT', on: 'apply' });
      const network = await errorOf(applyUpdates({ selections }, key));
      expect([network.status, network.code]).toEqual([0, 'NETWORK']);
      expect(classifyApplyError(network)).toBe('ambiguous');

      // The operation was committed: the retry with the same key replays it.
      const retry = await settle(applyUpdates({ selections }, key));
      expect(retry.replayed).toBe(true);

      Object.assign(FAKE_UPDATES_FAIL_NEXT, { code: 'RESPONSE_UNREADABLE', on: 'apply' });
      const unreadable = await errorOf(applyUpdates({ selections }, key));
      expect([unreadable.status, unreadable.code]).toEqual([202, 'RESPONSE_UNREADABLE']);
      expect(classifyApplyError(unreadable)).toBe('unreadable');
    });
  });

  describe('getOperation', () => {
    it('walks QUEUED -> PLANNING -> RUNNING -> SUCCEEDED and clears the applied rows', async () => {
      const res = await settle(applyUpdates({ selections: await selectionsFor('crm.core', 'trade.quotes') }, newIdempotencyKey()));
      const id = res.operation.id;

      vi.advanceTimersByTime(3_500);
      expect((await settle(getOperation(id))).status).toBe('PLANNING');
      vi.advanceTimersByTime(5_000);
      const running = await settle(getOperation(id));
      expect(running.status).toBe('RUNNING');
      expect(running.progress.percent).toBeGreaterThanOrEqual(10);
      vi.advanceTimersByTime(20_000);
      const done = await settle(getOperation(id));
      expect(done).toMatchObject({ id, status: 'SUCCEEDED', progress: { completedSteps: 2, percent: 100 } });
      expect(done.completedAt).not.toBeNull();

      const page = await settle(listUpdates(query({ limit: 100 })));
      expect(page.data.some((row) => row.componentKey === 'crm.core')).toBe(false);
      expect(page.meta.total).toBe(30);
    });

    it('settles to the configured failure outcome and unplans the rows', async () => {
      FAKE_UPDATES_OPERATION_OUTCOME.status = 'FAILED_RETRYABLE';
      const res = await settle(applyUpdates({ selections: await selectionsFor('crm.core') }, newIdempotencyKey()));
      vi.advanceTimersByTime(20_000);
      const failed = await settle(getOperation(res.operation.id));
      expect(failed.status).toBe('FAILED_RETRYABLE');
      expect(failed.safeError?.code).toBe('STEP_FAILED');
      expect(failed.progress.failedSteps).toBe(1);
      const [row] = await rowsFor('crm.core');
      expect(row.updateAlreadyPlanned).toBe(false);
    });

    it('answers 404 TENANT_OPERATION_NOT_FOUND for an unknown id', async () => {
      const error = await errorOf(getOperation(newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([404, 'TENANT_OPERATION_NOT_FOUND']);
    });
  });
});
