import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBulkJob, listBulkJobItems, listBulkJobs } from '../../../shared/bulk-jobs/bulk-jobs.api';
import { ApiError, type TradeContext, newIdempotencyKey } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './automation-fake-actors';
import * as api from './tower.api';
import { getCounts, getException, listExceptions } from './tower.api';
import { fakeTowerExceptionVersion, towerBulkReportRoute } from './tower.fake';
import {
  type BulkResolveExceptionsInput,
  type ResolveExceptionInput,
  TOWER_CATEGORIES,
  TOWER_SEVERITIES,
  TOWER_STATUSES,
  type TowerCounts,
  type TowerFilterQuery,
  resolutionCodesFor,
  toTowerCardCounts,
} from './tower.model';
import { towerSourceRoute } from './tower.util';

// Write wrappers: each call is a new user action (fresh UUIDv7 key) and sends the stored version as If-Match,
// unless a test pins its own version.
const resolve = (id: string, input: ResolveExceptionInput, ifMatch = fakeTowerExceptionVersion(id)) =>
  api.resolve(id, input, ifMatch, newIdempotencyKey());
const bulkResolve = (ctx: TradeContext, input: BulkResolveExceptionsInput, key = newIdempotencyKey()) =>
  api.bulkResolve(ctx, input, key);

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

const TENANT: TradeContext = {};
const C1: TradeContext = { companyId: 'c1' };
const C2: TradeContext = { companyId: 'c2' };
const C1_B1: TradeContext = { companyId: 'c1', branchId: 'b1' };
const KEPT_ARTIFACT = '0193a000-0000-7000-8000-00000000abcd';

const SOURCE: ResolveExceptionInput = {
  resolutionCode: 'SOURCE_CORRECTED',
  reasonCode: 'SOURCE_FIXED',
  note: 'fixed upstream',
  evidence: { ticket: 'INC-1' },
};

const OWNER: ResolveExceptionInput = {
  resolutionCode: 'OWNER_RESULT_APPLIED',
  reasonCode: 'CONFIRMED_WITH_OWNER',
  note: 'owner confirmed',
  evidence: { ticket: 'INC-2' },
};

const ACCEPT: ResolveExceptionInput = {
  resolutionCode: 'RESULT_ACCEPTED',
  reasonCode: 'DUPLICATE_RESULT_IGNORED',
  evidence: { keptArtifactId: KEPT_ARTIFACT },
};

beforeEach(() => {
  vi.useFakeTimers();
  setFakeActor(FAKE_ME);
});

afterEach(() => {
  setFakeActor(FAKE_ME);
  vi.useRealTimers();
});

describe('control tower list', () => {
  it('returns the newest exception first with paging metadata', async () => {
    const page = await settle(listExceptions(C1, { includeBranches: true, page: 1, limit: 3 }));

    expect(page.items).toHaveLength(3);
    expect(page.limit).toBe(3);
    const created = page.items.map((e) => e.createdAt);
    expect([...created].sort().reverse()).toEqual(created);
  });

  it('returns disjoint consecutive pages', async () => {
    const one = await settle(listExceptions(C1, { includeBranches: true, page: 1, limit: 3 }));
    const two = await settle(listExceptions(C1, { includeBranches: true, page: 2, limit: 3 }));

    const ids = new Set(one.items.map((e) => e.id));
    expect(two.items.some((e) => ids.has(e.id))).toBe(false);
  });

  it('filters by a status list, severity and category together', async () => {
    const page = await settle(
      listExceptions(C1, {
        includeBranches: true,
        status: ['OPEN', 'ACKNOWLEDGED'],
        severity: 'CRITICAL',
        category: 'OWNER_TRANSPORT_EXHAUSTED',
      }),
    );

    expect(page.items.map((e) => e.id)).toEqual(['ct-003']);
  });

  it('matches every status of a comma list', async () => {
    const page = await settle(listExceptions(TENANT, { status: ['OPEN', 'ACKNOWLEDGED'] }));

    expect(page.items.map((e) => e.status)).toEqual(['ACKNOWLEDGED']);
  });

  it('orders by severity (critical first, then newest) when sort=severity', async () => {
    const page = await settle(listExceptions(C1, { includeBranches: true, sort: 'severity', limit: 100 }));
    const rank = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 } as const;

    const ranks = page.items.map((e) => rank[e.severity]);
    expect(page.items[0].severity).toBe('CRITICAL');
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('omits attempts and allowed codes in the list but includes them in the detail', async () => {
    const page = await settle(
      listExceptions(C1, { includeBranches: true, category: 'OWNER_TRANSPORT_EXHAUSTED', limit: 1 }),
    );

    const detail = await settle(getException(page.items[0].id));

    expect(page.items[0].attempts).toBeUndefined();
    expect(page.items[0].allowedResolutionCodes).toBeUndefined();
    expect(detail.attempts?.length).toBeGreaterThan(0);
    expect(detail.attempts?.[0]).toMatchObject({ ownerCode: expect.any(String), attemptCount: expect.any(Number) });
    expect(detail.attempts?.[0]).toHaveProperty('nextAttemptAt');
  });

  it('rejects page 0 and a limit above 100 with 400', async () => {
    const zero = await rejection(listExceptions(C1, { page: 0 }));
    const big = await rejection(listExceptions(C1, { limit: 101 }));

    expect(zero.status).toBe(400);
    expect(big.status).toBe(400);
  });

  it('returns 404 TRADE.CONTROL_TOWER.NOT_FOUND for an unknown exception', async () => {
    const error = await rejection(getException('ct-missing'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.NOT_FOUND');
  });

  it('offers the backend resolution codes, and none for resolved or quarantined rows', async () => {
    const profile = await settle(getException('ct-001'));
    const owner = await settle(getException('ct-003'));
    const conflict = await settle(getException('ct-002'));
    const resolved = await settle(getException('ct-007'));
    const quarantined = await settle(getException('ct-010'));

    expect(profile.allowedResolutionCodes).toEqual(['SOURCE_CORRECTED']);
    expect(owner.allowedResolutionCodes).toEqual(['OWNER_RESULT_APPLIED']);
    expect(conflict.allowedResolutionCodes).toEqual(['RESULT_ACCEPTED']);
    expect(resolved.allowedResolutionCodes).toEqual([]);
    expect(quarantined.allowedResolutionCodes).toEqual([]);
    expect(resolutionCodesFor('RESULT_CONFLICT')).toEqual(['RESULT_ACCEPTED']);
  });
});

describe('control tower source projection', () => {
  it('returns label, document fields and a typed link that maps to router commands', async () => {
    const profile = await settle(getException('ct-001'));
    const quotation = await settle(getException('ct-002'));
    const order = await settle(getException('ct-003'));
    const purchase = await settle(getException('ct-005'));

    expect(profile.source).toMatchObject({
      type: 'DOCUMENT_PROFILE_VERSION',
      label: 'DEFAULT · v3',
      link: { kind: 'DOCUMENT_PROFILE_VERSION', id: 'profv-qt-3', parentId: 'prof-quotation-default' },
    });
    expect(towerSourceRoute(profile.source)?.commands).toEqual([
      '/trade/governance/document-profiles',
      'prof-quotation-default',
      'versions',
      'profv-qt-3',
    ]);
    expect(towerSourceRoute(quotation.source)?.commands).toEqual(['/trade/documents/quotations', 'qt-2026-0142']);
    expect(towerSourceRoute(order.source)?.commands).toEqual(['/trade/documents/sales-orders', 'so-2026-0089']);
    expect(towerSourceRoute(purchase.source)?.commands).toEqual(['/trade/documents/purchase-orders', 'po-2026-0077']);
  });

  it('gives unsupported document types a number but no link, and missing sources a null label', async () => {
    const invoice = await settle(getException('ct-007'));
    const missing = await settle(getException('ct-009'));

    expect(invoice.source).toMatchObject({ documentType: 'INVOICE', documentNumber: 'INV-2026-0115' });
    expect(invoice.source?.link).toBeUndefined();
    expect(towerSourceRoute(invoice.source)).toBeNull();
    expect(missing.source?.label).toBeNull();
    expect(towerSourceRoute(missing.source)).toBeNull();
  });
});

describe('control tower resolution visibility', () => {
  it('shows the evidence and note to the resolver only; the reason code stays visible', async () => {
    const own = await settle(getException('ct-007'));
    setFakeActor(FAKE_COLLEAGUE);
    const other = await settle(getException('ct-007'));

    expect(own.resolutionEvidence?.resolvedBy).toBe(FAKE_ME);
    expect(own.resolutionEvidence?.resolutionCode).toBe('SOURCE_CORRECTED');
    expect(own.resolutionReasonNote).toBe('Updated commercial account reference.');
    expect(other.resolutionEvidence).toBeUndefined();
    expect(other.resolutionReasonNote).toBeUndefined();
    expect(other.resolutionReasonCode).toBe('SOURCE_FIXED');
  });
});

describe('control tower counts (backend shape)', () => {
  it('returns every status, severity and category bucket, zeros included', async () => {
    const counts = await settle(getCounts(C1, { includeBranches: true }));

    expect(Object.keys(counts.byStatus).sort()).toEqual([...TOWER_STATUSES].sort());
    expect(Object.keys(counts.bySeverity).sort()).toEqual([...TOWER_SEVERITIES].sort());
    expect(Object.keys(counts.byCategory).sort()).toEqual([...TOWER_CATEGORIES].sort());
    expect(counts.bySeverity.WARNING).toBe(0);
  });

  it('reports a total equal to the list total and status buckets equal to status filters', async () => {
    const counts = await settle(getCounts(C1, { includeBranches: true }));
    const all = await settle(listExceptions(C1, { includeBranches: true, limit: 100 }));

    expect(counts.total).toBe(all.total);
    for (const status of TOWER_STATUSES) {
      const page = await settle(listExceptions(C1, { includeBranches: true, status: [status], limit: 100 }));
      expect(counts.byStatus[status]).toBe(page.total);
    }
  });

  it('rejects status, page and limit (whitelist validation)', async () => {
    const error = await rejection(getCounts(C1, { status: ['OPEN'] } as never));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('adapts the backend counts to the page cards', () => {
    const counts: TowerCounts = {
      total: 20,
      byStatus: { OPEN: 3, ACKNOWLEDGED: 2, ACTION_PENDING: 4, RECONCILIATION_PENDING: 1, RESOLVED: 8, QUARANTINED: 2 },
      bySeverity: { INFO: 5, WARNING: 6, HIGH: 7, CRITICAL: 2 },
      byCategory: {
        PROFILE_ACTIVATION_CONFLICT: 5,
        RESULT_CONFLICT: 5,
        OWNER_TRANSPORT_EXHAUSTED: 5,
        DATA_CORRECTION_REQUIRED: 5,
      },
      resolvedToday: 3,
    };

    expect(toTowerCardCounts(counts)).toEqual({
      open: 5,
      actionPending: 5,
      quarantined: 2,
      resolved: 8,
      resolvedToday: 3,
      highOrCritical: 9,
      total: 20,
    });
  });

  it('moves an exception from action-pending to resolved-today when it is resolved', async () => {
    const before = await settle(getCounts(C2, { includeBranches: true }));

    await settle(resolve('ct-006', OWNER));
    const after = await settle(getCounts(C2, { includeBranches: true }));

    expect(after.byStatus.ACTION_PENDING).toBe(before.byStatus.ACTION_PENDING - 1);
    expect(after.byStatus.RESOLVED).toBe(before.byStatus.RESOLVED + 1);
    expect(after.resolvedToday).toBe(before.resolvedToday + 1);
    expect(after.total).toBe(before.total);
  });
});

describe('control tower scope context', () => {
  it('shows only unscoped rows in the tenant context', async () => {
    const page = await settle(listExceptions(TENANT, { limit: 100 }));

    expect(page.items.map((e) => e.id)).toEqual(['ct-009']);
    expect(page.items[0]).toMatchObject({ companyId: null, branchId: null });
  });

  it('shows only company-level rows in the company context without includeBranches', async () => {
    const page = await settle(listExceptions(C1, { limit: 100 }));

    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((e) => e.companyId === 'c1' && e.branchId === null)).toBe(true);
  });

  it('adds every branch of the company with includeBranches, and partitions all rows', async () => {
    const c1 = await settle(listExceptions(C1, { includeBranches: true, limit: 100 }));
    const c2 = await settle(listExceptions(C2, { includeBranches: true, limit: 100 }));
    const tenant = await settle(listExceptions(TENANT, { limit: 100 }));

    expect(c1.items.some((e) => e.branchId !== null)).toBe(true);
    expect(c1.items.every((e) => e.companyId === 'c1')).toBe(true);
    expect(c2.items.every((e) => e.companyId === 'c2')).toBe(true);
    expect(c1.total + c2.total + tenant.total).toBe(10);
  });

  it('shows only that branch in the branch context', async () => {
    const page = await settle(listExceptions(C1_B1, { limit: 100 }));

    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((e) => e.companyId === 'c1' && e.branchId === 'b1')).toBe(true);
  });

  it('narrows the company context to one of its branches with branchId, in list and counts', async () => {
    const page = await settle(listExceptions(C1, { branchId: 'b2', limit: 100 }));
    const counts = await settle(getCounts(C1, { branchId: 'b2' }));

    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((e) => e.companyId === 'c1' && e.branchId === 'b2')).toBe(true);
    expect(counts.total).toBe(page.total);
  });

  it('rejects a foreign, missing or unavailable branch with 403 branch_not_accessible', async () => {
    const foreign = await rejection(listExceptions(C1, { branchId: 'b4' }));
    const missing = await rejection(getCounts(C1, { branchId: 'b-gone' }));

    expect(foreign.status).toBe(403);
    expect(foreign.code).toBe('TRADE.CONTROL_TOWER.SCOPE_DENIED');
    expect(foreign.details?.['reason']).toEqual(['branch_not_accessible']);
    expect(missing.status).toBe(403);
    expect(missing.details?.['reason']).toEqual(['branch_not_accessible']);
  });

  it('rejects branchId in the tenant or branch context with 403 branch_filter_requires_company', async () => {
    const branchList = await rejection(listExceptions(C1_B1, { branchId: 'b1' }));
    const tenantList = await rejection(listExceptions(TENANT, { branchId: 'b1' }));
    const branchCounts = await rejection(getCounts(C1_B1, { branchId: 'b2' }));

    for (const error of [branchList, tenantList, branchCounts]) {
      expect(error.status).toBe(403);
      expect(error.code).toBe('TRADE.CONTROL_TOWER.SCOPE_DENIED');
      expect(error.details?.['reason']).toEqual(['branch_filter_requires_company']);
    }
  });

  it('checks the branch filter before includeBranches, as the backend does', async () => {
    const both = await rejection(listExceptions(C1_B1, { branchId: 'b1', includeBranches: true }));
    const include = await rejection(getCounts(C1_B1, { includeBranches: true }));

    expect(both.details?.['reason']).toEqual(['branch_filter_requires_company']);
    expect(include.status).toBe(403);
    expect(include.details?.['reason']).toEqual(['include_branches_requires_company']);
  });

  it('lets branchId override includeBranches in the company context', async () => {
    const page = await settle(listExceptions(C1, { branchId: 'b2', includeBranches: true, limit: 100 }));
    const only = await settle(listExceptions(C1, { branchId: 'b2', limit: 100 }));

    expect(page.total).toBe(only.total);
    expect(page.items.every((e) => e.branchId === 'b2')).toBe(true);
  });

  it('rejects a companyId query parameter with 400 TRADE.VALIDATION_FAILED', async () => {
    const withCompany = { companyId: 'c1' } as TowerFilterQuery;

    const list = await rejection(listExceptions(C1, withCompany));
    const counts = await rejection(getCounts(C1, withCompany));

    expect(list.status).toBe(400);
    expect(list.code).toBe('TRADE.VALIDATION_FAILED');
    expect(counts.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('returns nothing for a company with no exceptions', async () => {
    const counts = await settle(getCounts({ companyId: 'c-none' }, { includeBranches: true }));
    const list = await settle(listExceptions({ companyId: 'c-none' }, { includeBranches: true }));

    expect(counts.total).toBe(0);
    expect(list.total).toBe(0);
  });
});

describe('control tower single resolve', () => {
  it('records the resolution, the reason, the actor and bumps the version', async () => {
    const before = await settle(getException('ct-001'));

    const resolved = await settle(resolve('ct-001', SOURCE));

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionReasonCode).toBe('SOURCE_FIXED');
    expect(resolved.resolutionReasonNote).toBe('fixed upstream');
    expect(resolved.resolutionEvidence).toMatchObject({
      resolutionCode: 'SOURCE_CORRECTED',
      resolvedBy: FAKE_ME,
      evidence: { ticket: 'INC-1' },
    });
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.version).toBe(before.version + 1);
  });

  it('refuses to resolve an exception that is already resolved with 409', async () => {
    const error = await rejection(resolve('ct-007', SOURCE));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_CONFLICT');
  });

  it('refuses to resolve a quarantined exception with 409', async () => {
    const error = await rejection(resolve('ct-010', OWNER));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_CONFLICT');
  });

  it('refuses a resolution code that does not fit the category with 422 category_not_resolvable', async () => {
    const error = await rejection(resolve('ct-003', SOURCE));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
    expect(error.details?.['reason']).toEqual(['category_not_resolvable']);
  });

  it('requires a UUID keptArtifactId to accept a result', async () => {
    const error = await rejection(resolve('ct-002', { ...ACCEPT, evidence: { keptArtifactId: 'nope' } }));

    expect(error.status).toBe(422);
    expect(error.details?.['reason']).toEqual(['evidence_invalid']);
  });

  it('rejects the old reasonNote field (forbidNonWhitelisted) with 400', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, reasonNote: 'x' } as never));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects a stale If-Match with 409', async () => {
    const error = await rejection(resolve('ct-003', OWNER, 9));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });

  it('does not change an exception when the resolution is refused', async () => {
    await rejection(resolve('ct-003', SOURCE));

    const after = await settle(getException('ct-003'));

    expect(after.status).toBe('OPEN');
    expect(after.resolutionReasonCode).toBeNull();
  });
});

describe('control tower reason body {reasonCode, note}', () => {
  it('rejects a missing reason code with 400 VALIDATION_FAILED (DTO rule)', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, reasonCode: '' }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects a reason id sent as reasonCode with 400 VALIDATION_FAILED (codes only)', async () => {
    const error = await rejection(
      resolve('ct-003', { ...OWNER, reasonCode: 'rsn-control_tower_resolve-source_fixed' }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects an unknown reason code with 422 REASON.NOT_FOUND', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, reasonCode: 'NO_SUCH' }));

    expect(error.code).toBe('TRADE.REASON.NOT_FOUND');
  });

  it('rejects a reason code of another reason kind with 422 REASON.KIND_INVALID', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, reasonCode: 'OPERATOR_RETRY' }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.REASON.KIND_INVALID');
  });

  it('requires a note for the OTHER reason', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, reasonCode: 'OTHER', note: '   ' }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.REASON.NOTE_REQUIRED');
  });

  it('accepts a note of exactly 500 characters', async () => {
    const resolved = await settle(resolve('ct-005', { ...OWNER, note: 'x'.repeat(500) }));

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionReasonNote).toHaveLength(500);
  });

  it('rejects a note longer than 500 characters with 400', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, note: 'x'.repeat(501) }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});

describe('control tower evidence limits', () => {
  it('rejects empty evidence', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, evidence: {} }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });

  it('rejects evidence that is not an object', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, evidence: ['a'] as never }));

    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });

  it('rejects more than 50 evidence keys', async () => {
    const evidence = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, i]));

    const error = await rejection(resolve('ct-003', { ...OWNER, evidence }));

    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });

  it.each(['apiToken', 'password', 'clientSecret', 'rawPayload', 'Authorization'])(
    'rejects the forbidden evidence key %s, also when nested',
    async (key) => {
      const error = await rejection(resolve('ct-003', { ...OWNER, evidence: { outer: { [key]: 'x' } } }));

      expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
    },
  );

  it('rejects evidence nested deeper than four levels', async () => {
    const evidence = { a: { b: { c: { d: { e: 1 } } } } };

    const error = await rejection(resolve('ct-003', { ...OWNER, evidence }));

    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });

  it('rejects evidence larger than 8192 bytes', async () => {
    const error = await rejection(resolve('ct-003', { ...OWNER, evidence: { blob: 'x'.repeat(8300) } }));

    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });
});

describe('control tower bulk resolve as a worker job', () => {
  const ids = (list: string[]) => ({ kind: 'IDS' as const, ids: list });

  it('submits a queued job, does not resolve inline and finishes through the worker', async () => {
    const submitted = await settleFor(bulkResolve(C1, { selection: ids(['ct-004']), ...SOURCE }), 300);

    expect(submitted.status).toBe('QUEUED');
    expect(submitted.total).toBe(1);
    expect(submitted.chunkCount).toBe(1);
    const stillOpen = await settleFor(getException('ct-004'), 350);
    expect(stillOpen.status).toBe('OPEN');

    await vi.advanceTimersByTimeAsync(2000);
    const job = await settle(getBulkJob('trading', submitted.jobId));
    const done = await settle(getException('ct-004'));
    expect(job.status).toBe('COMPLETED');
    expect(job.scope).toEqual({ companyId: 'c1' });
    expect(job.counts.succeeded).toBe(1);
    expect(done.status).toBe('RESOLVED');
    expect(done.resolutionReasonCode).toBe('SOURCE_FIXED');
  });

  it('refuses a second job while one is active with 409 BULK_JOB.ACTIVE and the active job id', async () => {
    const first = await settleFor(bulkResolve(C1, { selection: ids(['ct-003']), ...OWNER }), 300);

    const error = await rejection(bulkResolve(C2, { selection: ids(['ct-005']), ...OWNER }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.BULK_JOB.ACTIVE');
    expect(error.details?.['activeJobId']).toEqual([first.jobId]);
    await vi.advanceTimersByTimeAsync(2000);
  });

  it('leaves no active job once the previous one has finished', async () => {
    await vi.advanceTimersByTimeAsync(5000);

    const active = await settle(listBulkJobs('trading', { scope: 'active' }));

    expect(active.items).toEqual([]);
    const resolved = await settle(getException('ct-003'));
    expect(resolved.status).toBe('RESOLVED');
  });

  it('skips already-resolved and not-resolvable rows at submit and finalises synchronously', async () => {
    const timersBefore = vi.getTimerCount();

    const submitted = await settleFor(bulkResolve(C1, { selection: ids(['ct-007', 'ct-010']), ...SOURCE }), 300);

    expect(submitted.status).toBe('COMPLETED');
    expect(submitted.total).toBe(2);
    expect(submitted.skippedAtSubmit).toBe(2);
    expect(submitted.chunkCount).toBe(0);
    expect(vi.getTimerCount()).toBe(timersBefore);
    const job = await settle(getBulkJob('trading', submitted.jobId));
    expect(job.status).toBe('COMPLETED');
    expect(job.finishedAt).toBeDefined();
    expect(job.counts.skipped).toBe(2);
  });

  it('skips a category that the resolution code does not fit (CATEGORY_NOT_RESOLVABLE)', async () => {
    const next = await settleFor(bulkResolve(C1, { selection: ids(['ct-002']), ...SOURCE }), 300);

    expect(next.status).toBe('COMPLETED');
    expect(next.skippedAtSubmit).toBe(1);
  });

  it('rejects a missing or out-of-scope id with 400 BULK_JOB_PARAMS_INVALID', async () => {
    const missing = await rejection(bulkResolve(C1, { selection: ids(['ct-missing']), ...SOURCE }));
    const otherCompany = await rejection(bulkResolve(C1, { selection: ids(['ct-008']), ...SOURCE }));

    expect(missing.status).toBe(400);
    expect(missing.code).toBe('BULK_JOB_PARAMS_INVALID');
    expect(otherCompany.code).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('requires a company context (scopeRule COMPANY)', async () => {
    const error = await rejection(bulkResolve(TENANT, { selection: ids(['ct-009']), ...SOURCE }));

    expect(error.status).toBe(403);
    expect(error.code).toBe('TRADE.CONTROL_TOWER.SCOPE_DENIED');
  });

  it('marks an item resolved after submit as UNCHANGED (ALREADY_RESOLVED) during execution', async () => {
    const submitted = await settleFor(bulkResolve(C1, { selection: ids(['ct-002']), ...ACCEPT }), 300);
    expect(submitted.status).toBe('QUEUED');

    await settleFor(resolve('ct-002', ACCEPT), 300);
    await vi.advanceTimersByTimeAsync(3000);
    const job = await settle(getBulkJob('trading', submitted.jobId));

    expect(job.counts.unchanged).toBe(1);
    expect(job.counts.succeeded).toBe(0);
  });

  it('expands a QUERY selection with the list filters and honours the excluded ids', async () => {
    const resolved = await settle(
      listExceptions(C1, { includeBranches: true, status: ['RESOLVED'], limit: 100 }),
    );
    expect(resolved.total).toBeGreaterThan(1);

    const submitted = await settleFor(
      bulkResolve(C1, {
        selection: {
          kind: 'QUERY',
          query: { status: ['RESOLVED'], includeBranches: true },
          excludedIds: [resolved.items[0].id],
        },
        ...SOURCE,
      }),
      300,
    );

    expect(submitted.total).toBe(resolved.total - 1);
    expect(submitted.skippedAtSubmit).toBe(resolved.total - 1);
    expect(submitted.status).toBe('COMPLETED');
  });

  it('narrows a QUERY selection by branchId and keeps it in the job selection snapshot', async () => {
    const b2 = await settle(listExceptions(C1, { branchId: 'b2', limit: 100 }));

    const submitted = await settleFor(
      bulkResolve(C1, { selection: { kind: 'QUERY', query: { branchId: 'b2' } }, ...SOURCE }),
      300,
    );
    const items = await settleFor(listBulkJobItems('trading', submitted.jobId, { page: 1, limit: 100 }), 300);

    expect(submitted.total).toBe(b2.total);
    expect(items.items.map((i) => i.entityId).sort()).toEqual(b2.items.map((e) => e.id).sort());
    expect(items.items.every((i) => i.data?.['branchId'] === 'b2' && i.data?.['includeBranches'] === 1)).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
  });

  it('keeps no branchId in the snapshot when the selection has none', async () => {
    const submitted = await settleFor(
      bulkResolve(C1, { selection: { kind: 'QUERY', query: { status: ['RESOLVED'], includeBranches: true } }, ...SOURCE }),
      300,
    );
    const items = await settleFor(listBulkJobItems('trading', submitted.jobId, { page: 1, limit: 100 }), 300);

    expect(items.items.length).toBeGreaterThan(0);
    expect(items.items.every((i) => i.data?.['branchId'] === undefined && i.data?.['includeBranches'] === 1)).toBe(true);
  });

  it('rejects a QUERY selection with an unavailable branch or outside the company context with 403', async () => {
    const foreign = await rejection(
      bulkResolve(C1, { selection: { kind: 'QUERY', query: { branchId: 'b4' } }, ...SOURCE }),
    );
    const inBranch = await rejection(
      bulkResolve(C1_B1, { selection: { kind: 'QUERY', query: { branchId: 'b1' } }, ...SOURCE }),
    );

    expect(foreign.status).toBe(403);
    expect(foreign.code).toBe('TRADE.CONTROL_TOWER.SCOPE_DENIED');
    expect(foreign.details?.['reason']).toEqual(['branch_not_accessible']);
    expect(inBranch.status).toBe(403);
    expect(inBranch.details?.['reason']).toEqual(['branch_filter_requires_company']);
  });

  it('rejects an empty id selection with 400 BULK_JOB_PARAMS_INVALID', async () => {
    const error = await rejection(bulkResolve(C1, { selection: ids([]), ...SOURCE }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('BULK_JOB_PARAMS_INVALID');
  });

  it('validates the reason body before submitting the job', async () => {
    const unknown = await rejection(bulkResolve(C1, { selection: ids(['ct-003']), ...OWNER, reasonCode: 'NO_SUCH' }));
    const longNote = await rejection(bulkResolve(C1, { selection: ids(['ct-003']), ...OWNER, note: 'x'.repeat(501) }));

    expect(unknown.code).toBe('TRADE.REASON.NOT_FOUND');
    expect(longNote.status).toBe(400);
  });

  it('validates the evidence before submitting the job', async () => {
    const error = await rejection(
      bulkResolve(C1, { selection: ids(['ct-003']), ...OWNER, evidence: { password: 'x' } }),
    );

    expect(error.code).toBe('TRADE.CONTROL_TOWER.RESOLUTION_INVALID');
  });

  it('returns the same job for a replayed idempotency key and rejects a changed payload', async () => {
    const key = newIdempotencyKey();
    const first = await settleFor(bulkResolve(C1, { selection: ids(['ct-007']), ...SOURCE }, key), 300);
    const again = await settleFor(bulkResolve(C1, { selection: ids(['ct-007']), ...SOURCE }, key), 300);
    const changed = await rejection(bulkResolve(C1, { selection: ids(['ct-001']), ...SOURCE }, key));

    expect(again).toEqual(first);
    expect(changed.status).toBe(422);
    expect(changed.code).toBe('TRADE.IDEMPOTENCY.MISMATCH');
  });

  it('uses the backend report route for a bulk job', () => {
    expect(towerBulkReportRoute('job-1')).toBe('/trade/automation/control-tower?job=job-1');
  });
});
