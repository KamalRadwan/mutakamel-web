import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, TradeContext } from '../../shared/trade-api';

type FakeModule = typeof import('./configuration.fake');

const BRANCH_CTX: TradeContext = { companyId: 'c1', branchId: 'b1' };
const COMPANY_CTX: TradeContext = { companyId: 'c1' };

let fake: FakeModule;
let keySeq = 0;
const nextKey = () => `config-spec-${++keySeq}`;

async function settle<T>(promise: Promise<T>): Promise<T> {
  const caught = promise.catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  if (result instanceof Error) throw result;
  return result as T;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  const caught = promise.then(
    () => null,
    (e: unknown) => e,
  );
  await vi.advanceTimersByTimeAsync(1000);
  const result = await caught;
  // resetModules gives the fake its own ApiError class, so match by name.
  expect((result as Error | null)?.name).toBe('ApiError');
  return result as ApiError;
}

async function rowVersion(defId: string, verId: string): Promise<number> {
  const def = await settle(fake.fakeGetDefinition(defId));
  const ver = def.versions.find((v) => v.id === verId);
  if (!ver) throw new Error(`missing ${verId}`);
  return ver.version;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-21T10:00:00.000Z'));
  vi.resetModules();
  fake = await import('./configuration.fake');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('configuration fake: test diagnostics', () => {
  it('returns a flat short code when a branch weakens a MIN company value', async () => {
    const v = await rowVersion('cfg-def-1', 'cfg-ver-1-4');
    const result = await settle(fake.fakeTestVersion(BRANCH_CTX, 'cfg-ver-1-4', v, nextKey()));
    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(['BRANCH_WEAKENS_MIN']);
  });

  it('returns BRANCH_WEAKENS_DENY when a branch allows what the company denies', async () => {
    const v = await rowVersion('cfg-def-2', 'cfg-ver-2-3');
    const result = await settle(fake.fakeTestVersion(BRANCH_CTX, 'cfg-ver-2-3', v, nextKey()));
    expect(result.diagnostics).toEqual(['BRANCH_WEAKENS_DENY']);
  });

  it('returns COMPANY_BASELINE_REQUIRED when no company value covers the branch start', async () => {
    const created = await settle(
      fake.fakeCreateVersion(
        { companyId: 'c1', branchId: 'b2' },
        'cfg-def-1',
        1,
        { scopeTarget: 'BRANCH', value: 10, effectiveFrom: '2026-02-01T00:00:00.000Z', effectiveTo: null },
        nextKey(),
      ),
    );
    const result = await settle(
      fake.fakeTestVersion({ companyId: 'c1', branchId: 'b2' }, created.id, created.version, nextKey()),
    );
    expect(result.diagnostics).toEqual(['COMPANY_BASELINE_REQUIRED']);
  });

  it('passes with an empty flat list', async () => {
    const v = await rowVersion('cfg-def-1', 'cfg-ver-1-3');
    const result = await settle(fake.fakeTestVersion(BRANCH_CTX, 'cfg-ver-1-3', v, nextKey()));
    expect(result.passed).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('configuration fake: publish', () => {
  it('publishes a tested branch version while the company baseline holds', async () => {
    const v = await rowVersion('cfg-def-1', 'cfg-ver-1-3');
    const published = await settle(fake.fakePublishVersion(BRANCH_CTX, 'cfg-ver-1-3', v, {}, nextKey()));
    expect(published.status).toBe('SCHEDULED');
  });

  it('re-runs the company lock check and returns 409 TEST_FAILED', async () => {
    const companyVer = await rowVersion('cfg-def-1', 'cfg-ver-1-2');
    await settle(fake.fakeRetireVersion(COMPANY_CTX, 'cfg-ver-1-2', companyVer, nextKey()));

    const v = await rowVersion('cfg-def-1', 'cfg-ver-1-3');
    const error = await settleError(fake.fakePublishVersion(BRANCH_CTX, 'cfg-ver-1-3', v, {}, nextKey()));
    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONFIGURATION.TEST_FAILED');
  });
});

describe('configuration fake: supersede boundary', () => {
  const from = Date.parse('2026-12-01T00:00:00.000Z');
  const base = {
    status: 'PUBLISHED' as const,
    supersededAt: null,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a predecessor that ends exactly when the new version starts', () => {
    expect(fake.isSupersedable({ ...base, effectiveTo: '2026-12-01T00:00:00.000Z' }, from)).toBe(true);
  });

  it('accepts an open-ended predecessor', () => {
    expect(fake.isSupersedable({ ...base, effectiveTo: null }, from)).toBe(true);
  });

  it('rejects only a predecessor that ends before the new version starts', () => {
    expect(fake.isSupersedable({ ...base, effectiveTo: '2026-11-30T23:59:59.000Z' }, from)).toBe(false);
  });
});
