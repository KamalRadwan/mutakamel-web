import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sharedErrorKeyOf } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  createNumbering,
  getNumberingAccess,
  listCompanyOptions,
  listNumbering,
  peekNumbering,
  updateNumbering,
} from './numbering.api';
import { FAKE_NUMBERING_ACCESS, FAKE_NUMBERING_FAIL_NEXT } from './numbering.fake';

/*
 * numbering.api.ts over numbering.fake.ts: Core envelope { data, meta } for the list, bare
 * NumberingSequence / NumberingPeek for single records, CORE_VALIDATION_FAILED keyed by field,
 * counters as decimal strings (bigint-safe), and the idempotency codes.
 */

const DELTA = '0193a100-0000-7000-8000-000000000001';
const NILE = '0193a100-0000-7000-8000-000000000002';
const OLD = '0193a100-0000-7000-8000-000000000003';
const DELTA_QUOTATION = '0193a200-0000-7000-8000-000000000001';

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

function expectCorePage(page: unknown): void {
  expect(Object.keys(page as object).sort()).toEqual(['data', 'meta']);
  const { data, meta } = page as { data: unknown[]; meta: Record<string, unknown> };
  expect(Array.isArray(data)).toBe(true);
  expect(Object.keys(meta).sort()).toEqual(['hasNext', 'hasPrev', 'limit', 'page', 'total', 'totalPages']);
}

describe('numbering api (fake)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    FAKE_NUMBERING_FAIL_NEXT.code = null;
    FAKE_NUMBERING_FAIL_NEXT.status = 500;
    FAKE_NUMBERING_ACCESS.tenantWideManage = true;
    vi.useRealTimers();
  });

  describe('listNumbering', () => {
    it('returns the Core paged envelope sorted by code', async () => {
      const page = await settle(listNumbering({}));
      expectCorePage(page);
      expect(page.meta).toMatchObject({ page: 1, limit: 20, hasPrev: false });
      const codes = page.data.map((row) => row.code);
      expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
    });

    it('filters by company and searches code or prefix', async () => {
      const nile = await settle(listNumbering({ companyId: NILE }));
      expect(nile.data).toHaveLength(6);
      expect(nile.data.every((row) => row.companyId === NILE)).toBe(true);
      const byPrefix = await settle(listNumbering({ search: 'ltr/' }));
      expect(byPrefix.data.map((row) => row.code)).toEqual(['BUSINESS_LETTER']);
    });

    it('sorts by nextValue as a big counter, not as text', async () => {
      const page = await settle(listNumbering({ sortBy: 'nextValue', sortDir: 'DESC', limit: 3 }));
      expect(page.data[0].nextValue).toBe('9007199254740990');
      expect(page.data[1].nextValue).toBe('2409');
    });

    it('pages with meta counters', async () => {
      const page = await settle(listNumbering({ limit: 5, page: 2 }));
      expect(page.data).toHaveLength(5);
      expect(page.meta).toMatchObject({ page: 2, limit: 5, totalPages: Math.ceil(page.meta.total / 5), hasPrev: true, hasNext: true });
    });

    it('returns an empty page with zero pages', async () => {
      const page = await settle(listNumbering({ search: 'zz-none' }));
      expect(page).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
    });
  });

  describe('createNumbering', () => {
    it('creates a company sequence with defaults (padding 5, start 1)', async () => {
      const created = await settle(createNumbering({ code: 'crm_lead', companyId: DELTA }, newIdempotencyKey()));
      expect(created).toMatchObject({ code: 'CRM_LEAD', prefix: null, padding: 5, nextValue: '1', companyId: DELTA });
    });

    it('creates a workspace-wide sequence when companyId is empty', async () => {
      const created = await settle(createNumbering({ code: 'WS_ONE', prefix: 'W-', padding: 3, startValue: 10, companyId: '' }, newIdempotencyKey()));
      expect(created).toMatchObject({ companyId: null, prefix: 'W-', nextValue: '10' });
    });

    it('answers 400 CORE_VALIDATION_FAILED keyed by field', async () => {
      const code = await errorOf(createNumbering({ code: 'bad code!' }, newIdempotencyKey()));
      expect([code.status, code.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(code.details).toEqual({ code: ['code is not valid'] });

      const padding = await errorOf(createNumbering({ code: 'PAD', padding: 13 }, newIdempotencyKey()));
      expect(padding.details).toEqual({ padding: ['padding is not valid'] });

      const prefix = await errorOf(createNumbering({ code: 'PFX', prefix: 'has space' }, newIdempotencyKey()));
      expect(prefix.details).toEqual({ prefix: ['prefix is not valid'] });

      const start = await errorOf(createNumbering({ code: 'STR', startValue: 0 }, newIdempotencyKey()));
      expect(start.details).toEqual({ startValue: ['startValue is not valid'] });
    });

    it('answers the scope and duplicate codes', async () => {
      const taken = await errorOf(createNumbering({ code: 'TRADE_QUOTATION', companyId: DELTA }, newIdempotencyKey()));
      expect([taken.status, taken.code]).toEqual([409, 'SEQUENCE_CODE_TAKEN']);

      const inactive = await errorOf(createNumbering({ code: 'X1', companyId: OLD }, newIdempotencyKey()));
      expect([inactive.status, inactive.code]).toEqual([422, 'COMPANY_INVALID']);

      FAKE_NUMBERING_ACCESS.tenantWideManage = false;
      const tenantWide = await errorOf(createNumbering({ code: 'X2' }, newIdempotencyKey()));
      expect([tenantWide.status, tenantWide.code]).toEqual([403, 'TENANT_WIDE_PERMISSION_REQUIRED']);
    });

    it('replays a key with the same body and answers GW.IDEM.MISSING without one', async () => {
      const key = newIdempotencyKey();
      const body = { code: 'REPLAY_ONE', companyId: NILE };
      const first = await settle(createNumbering(body, key));
      expect(await settle(createNumbering(body, key))).toEqual(first);
      expect((await settle(listNumbering({ search: 'REPLAY_ONE' }))).meta.total).toBe(1);

      const missing = await errorOf(createNumbering(body, ' '));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
    });

    it('rejects a reused key with another body with 422 GW.IDEM.MISMATCH (gateway-error.catalog.ts)', async () => {
      const key = newIdempotencyKey();
      await settle(createNumbering({ code: 'MISMATCH_A' }, key));
      const error = await errorOf(createNumbering({ code: 'MISMATCH_B' }, key));
      expect([error.status, error.code]).toEqual([422, 'GW.IDEM.MISMATCH']);
    });

    // Core numbering-sequences has no idempotency code of its own; the gateway's mismatch code maps to
    // the shared "idempotencyMismatch" message, not the "still running" one.
    it('a reused key with another body maps to the shared idempotencyMismatch message', async () => {
      const key = newIdempotencyKey();
      await settle(createNumbering({ code: 'MISMATCH_C' }, key));
      const error = await errorOf(createNumbering({ code: 'MISMATCH_D' }, key));
      expect(sharedErrorKeyOf(error.code)).toBe('idempotencyMismatch');
    });

    it('throws the queued FAIL_NEXT code once', async () => {
      FAKE_NUMBERING_FAIL_NEXT.code = 'IDEM_IN_FLIGHT';
      FAKE_NUMBERING_FAIL_NEXT.status = 409;
      const error = await errorOf(createNumbering({ code: 'FAIL_ONE' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([409, 'IDEM_IN_FLIGHT']);
      expect(FAKE_NUMBERING_FAIL_NEXT.code).toBeNull();
    });
  });

  describe('updateNumbering', () => {
    it('updates prefix, padding and moves the counter forward', async () => {
      const updated = await settle(updateNumbering(DELTA_QUOTATION, { prefix: 'Q-', padding: 6, nextValue: 100 }, newIdempotencyKey()));
      expect(updated).toMatchObject({ id: DELTA_QUOTATION, prefix: 'Q-', padding: 6, nextValue: '100' });
    });

    it('clears the prefix with an empty string', async () => {
      const created = await settle(createNumbering({ code: 'CLEAR_PFX', prefix: 'C-' }, newIdempotencyKey()));
      const updated = await settle(updateNumbering(created.id, { prefix: '' }, newIdempotencyKey()));
      expect(updated.prefix).toBeNull();
    });

    it('answers 422 SEQUENCE_VALUE_INVALID when moving the counter backwards', async () => {
      const created = await settle(createNumbering({ code: 'BACKWARDS', startValue: 50 }, newIdempotencyKey()));
      const error = await errorOf(updateNumbering(created.id, { nextValue: 49 }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([422, 'SEQUENCE_VALUE_INVALID']);
    });

    it('answers 404 SEQUENCE_NOT_FOUND and CORE_VALIDATION_FAILED', async () => {
      const missing = await errorOf(updateNumbering('missing', { padding: 3 }, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'SEQUENCE_NOT_FOUND']);
      const bad = await errorOf(updateNumbering(DELTA_QUOTATION, { padding: 0 }, newIdempotencyKey()));
      expect(bad.details).toEqual({ padding: ['padding is not valid'] });
    });
  });

  describe('peekNumbering and lookups', () => {
    it('peeks the formatted next number without consuming it', async () => {
      const first = await settle(peekNumbering('business_letter', null));
      expect(first).toEqual({ code: 'BUSINESS_LETTER', companyId: null, nextValue: '12', formatted: 'LTR/00012' });
      expect(await settle(peekNumbering('BUSINESS_LETTER', null))).toEqual(first);
    });

    it('answers 404 SEQUENCE_NOT_FOUND for an unknown scope and 422 for an inactive company', async () => {
      const missing = await errorOf(peekNumbering('BUSINESS_LETTER', NILE));
      expect([missing.status, missing.code]).toEqual([404, 'SEQUENCE_NOT_FOUND']);
      const inactive = await errorOf(peekNumbering('TRADE_QUOTATION', OLD));
      expect([inactive.status, inactive.code]).toEqual([422, 'COMPANY_INVALID']);
    });

    it('lists companies and access', async () => {
      const companies = await settle(listCompanyOptions());
      expect(companies.map((company) => company.id)).toEqual([DELTA, NILE, OLD]);
      expect(await settle(getNumberingAccess())).toEqual({ tenantWideManage: true, manageCompanyIds: [DELTA, NILE] });
    });
  });
});
