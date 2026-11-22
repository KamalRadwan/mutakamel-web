import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  createTax,
  deactivateTax,
  getTaxPermissions,
  listCompanyOptions,
  listTaxes,
  updateTax,
} from './taxes.api';
import { FAKE_TAXES_FAIL_NEXT } from './taxes.fake';

/*
 * taxes.api.ts over taxes.fake.ts: Core envelope { data, meta } for the list, bare Tax for
 * single records, CORE_VALIDATION_FAILED details keyed by field, and the IDEM_* codes.
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

function expectCorePage(page: unknown): void {
  expect(Object.keys(page as object).sort()).toEqual(['data', 'meta']);
  const { data, meta } = page as { data: unknown[]; meta: Record<string, unknown> };
  expect(Array.isArray(data)).toBe(true);
  expect(Object.keys(meta).sort()).toEqual(['hasNext', 'hasPrev', 'limit', 'page', 'total', 'totalPages']);
}

describe('taxes api (fake)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    FAKE_TAXES_FAIL_NEXT.code = null;
    FAKE_TAXES_FAIL_NEXT.status = 0;
    vi.useRealTimers();
  });

  describe('listTaxes', () => {
    it('returns the Core paged envelope with default paging', async () => {
      const page = await settle(listTaxes());
      expectCorePage(page);
      expect(page.meta.page).toBe(1);
      expect(page.meta.limit).toBe(20);
      expect(page.meta.total).toBe(page.data.length);
      expect(page.meta.hasPrev).toBe(false);
      expect(page.data[0]).not.toHaveProperty('items');
    });

    it('sorts by code ascending by default and DESC on request', async () => {
      const asc = await settle(listTaxes());
      const codes = asc.data.map((tax) => tax.code);
      expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      const desc = await settle(listTaxes({ sortDir: 'DESC' }));
      expect(desc.data.map((tax) => tax.code)).toEqual([...codes].reverse());
    });

    it('filters by status, search and inclusive flag', async () => {
      const inactive = await settle(listTaxes({ status: 'INACTIVE' }));
      expect(inactive.data.length).toBeGreaterThan(0);
      expect(inactive.data.every((tax) => tax.status === 'INACTIVE')).toBe(true);

      const search = await settle(listTaxes({ search: 'excise' }));
      expect(search.data.map((tax) => tax.code)).toEqual(['EXC50']);

      const inclusive = await settle(listTaxes({ isInclusive: true }));
      expect(inclusive.data.every((tax) => tax.isInclusive)).toBe(true);
    });

    it('pages with meta counters and clamps limit to 1..100', async () => {
      const first = await settle(listTaxes({ limit: 2, page: 1 }));
      expect(first.data).toHaveLength(2);
      expect(first.meta.totalPages).toBe(Math.ceil(first.meta.total / 2));
      expect(first.meta.hasNext).toBe(true);
      expect(first.meta.hasPrev).toBe(false);

      const second = await settle(listTaxes({ limit: 2, page: 2 }));
      expect(second.meta.hasPrev).toBe(true);
      expect(second.data[0].id).not.toBe(first.data[0].id);

      const clamped = await settle(listTaxes({ limit: 500 }));
      expect(clamped.meta.limit).toBe(100);
    });

    it('returns an empty page when nothing matches', async () => {
      const page = await settle(listTaxes({ search: 'no-such-tax-zzz' }));
      expect(page.data).toEqual([]);
      expect(page.meta.total).toBe(0);
      expect(page.meta.hasNext).toBe(false);
    });

    it('rejects an unknown company filter with 422 COMPANY_INVALID', async () => {
      const error = await errorOf(listTaxes({ companyId: 'missing' }));
      expect(error.status).toBe(422);
      expect(error.code).toBe('COMPANY_INVALID');
    });

    it('filters by a known company', async () => {
      const companies = await settle(listCompanyOptions());
      const najd = companies.find((company) => company.name.startsWith('Najd'))!;
      const page = await settle(listTaxes({ companyId: najd.id }));
      expect(page.data.every((tax) => tax.companyId === najd.id)).toBe(true);
    });
  });

  describe('createTax', () => {
    it('creates a workspace-wide tax with a canonical rate string', async () => {
      const tax = await settle(createTax({ code: ' gst7 ', name: ' GST ', rate: 7.5 }, newIdempotencyKey()));
      expect(tax).toMatchObject({ code: 'GST7', name: 'GST', rate: '7.5000', isInclusive: false, companyId: null, status: 'ACTIVE' });
      const page = await settle(listTaxes({ search: 'GST7' }));
      expect(page.data.map((row) => row.id)).toEqual([tax.id]);
    });

    it('creates a company tax when the company is active and manageable', async () => {
      const companies = await settle(listCompanyOptions());
      const riyadh = companies.find((company) => company.name.startsWith('Riyadh'))!;
      const tax = await settle(createTax({ code: 'RYD1', name: 'Riyadh fee', rate: 1, companyId: riyadh.id }, newIdempotencyKey()));
      expect(tax.companyId).toBe(riyadh.id);
    });

    it('answers 400 CORE_VALIDATION_FAILED with messages keyed by field', async () => {
      const error = await errorOf(createTax({ code: '', name: '', rate: 101 }, newIdempotencyKey()));
      expect(error.status).toBe(400);
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(error.details).toEqual({
        code: ['code is not valid'],
        name: ['name is not valid'],
        rate: ['rate is not valid'],
      });
    });

    it('rejects a rate with more than four decimals', async () => {
      const error = await errorOf(createTax({ code: 'DEC5', name: 'Five decimals', rate: 1.23456 }, newIdempotencyKey()));
      expect(error.details?.['rate']).toEqual(['rate is not valid']);
    });

    it('answers 409 TAX_CODE_TAKEN for a duplicate code in the same scope', async () => {
      const error = await errorOf(createTax({ code: 'VAT15', name: 'Dup', rate: 15 }, newIdempotencyKey()));
      expect(error.status).toBe(409);
      expect(error.code).toBe('TAX_CODE_TAKEN');
    });

    it('answers 422 COMPANY_INVALID for an inactive company and 403 for an unmanaged one', async () => {
      const companies = await settle(listCompanyOptions());
      const eastern = companies.find((company) => company.status === 'INACTIVE')!;
      const gulf = companies.find((company) => !company.canManage)!;
      const invalid = await errorOf(createTax({ code: 'E1', name: 'E', rate: 1, companyId: eastern.id }, newIdempotencyKey()));
      expect([invalid.status, invalid.code]).toEqual([422, 'COMPANY_INVALID']);
      const denied = await errorOf(createTax({ code: 'G1', name: 'G', rate: 1, companyId: gulf.id }, newIdempotencyKey()));
      expect([denied.status, denied.code]).toEqual([403, 'COMPANY_PERMISSION_DENIED']);
    });

    it('replays the same key and body without creating twice', async () => {
      const key = newIdempotencyKey();
      const body = { code: 'RPL1', name: 'Replay', rate: 2 };
      const first = await settle(createTax(body, key));
      const second = await settle(createTax(body, key));
      expect(second).toEqual(first);
      const page = await settle(listTaxes({ search: 'RPL1' }));
      expect(page.meta.total).toBe(1);
    });

    it('answers the idempotency codes: IDEM_MISSING, IDEM_BAD_VALUE, IDEM_MISMATCH, IDEM_IN_FLIGHT', async () => {
      const missing = await errorOf(createTax({ code: 'K1', name: 'K', rate: 1 }, ''));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);

      const bad = await errorOf(createTax({ code: 'K1', name: 'K', rate: 1 }, 'not-a-uuid'));
      expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);

      const key = newIdempotencyKey();
      await settle(createTax({ code: 'K2', name: 'K', rate: 1 }, key));
      const mismatch = await errorOf(createTax({ code: 'K3', name: 'K', rate: 1 }, key));
      expect([mismatch.status, mismatch.code]).toEqual([422, 'GW.IDEM.MISMATCH']);

      const flightKey = newIdempotencyKey();
      const running = createTax({ code: 'K4', name: 'K', rate: 1 }, flightKey);
      const inFlight = await errorOf(createTax({ code: 'K4', name: 'K', rate: 1 }, flightKey));
      expect([inFlight.status, inFlight.code]).toEqual([409, 'GW.IDEM.IN_FLIGHT']);
      await settle(running);
    });

    it('throws the queued FAIL_NEXT code with its default status once', async () => {
      FAKE_TAXES_FAIL_NEXT.code = 'IDEM_UNAVAILABLE';
      const error = await errorOf(createTax({ code: 'F1', name: 'F', rate: 1 }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([503, 'IDEM_UNAVAILABLE']);
      expect(FAKE_TAXES_FAIL_NEXT.code).toBeNull();
    });
  });

  describe('updateTax and deactivateTax', () => {
    it('updates name, rate and status', async () => {
      const created = await settle(createTax({ code: 'UPD1', name: 'Before', rate: 3 }, newIdempotencyKey()));
      const updated = await settle(updateTax(created.id, { name: 'After', rate: 4.25, status: 'INACTIVE' }, newIdempotencyKey()));
      expect(updated).toMatchObject({ id: created.id, name: 'After', rate: '4.2500', status: 'INACTIVE' });
    });

    it('rejects code and companyId as non-whitelisted properties', async () => {
      const created = await settle(createTax({ code: 'UPD2', name: 'X', rate: 3 }, newIdempotencyKey()));
      const error = await errorOf(
        updateTax(created.id, { code: 'NEW', companyId: null } as unknown as Parameters<typeof updateTax>[1], newIdempotencyKey()),
      );
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(error.details).toEqual({
        code: ['property code should not exist'],
        companyId: ['property companyId should not exist'],
      });
    });

    it('answers 404 TAX_NOT_FOUND for an unknown id', async () => {
      const error = await errorOf(updateTax('missing', { name: 'X' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([404, 'TAX_NOT_FOUND']);
      const deactivate = await errorOf(deactivateTax('missing', newIdempotencyKey()));
      expect([deactivate.status, deactivate.code]).toEqual([404, 'TAX_NOT_FOUND']);
    });

    it('answers 403 COMPANY_PERMISSION_DENIED on a tax of an unmanaged company', async () => {
      const page = await settle(listTaxes({ search: 'GULF15' }));
      const error = await errorOf(updateTax(page.data[0].id, { name: 'X' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([403, 'COMPANY_PERMISSION_DENIED']);
    });

    it('answers 422 COMPANY_INVALID when re-activating a tax of an inactive company', async () => {
      const page = await settle(listTaxes({ search: 'EAST15' }));
      const error = await errorOf(updateTax(page.data[0].id, { status: 'ACTIVE' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([422, 'COMPANY_INVALID']);
    });

    it('deactivates a tax and resolves with no body', async () => {
      const created = await settle(createTax({ code: 'DEL1', name: 'Delete me', rate: 1 }, newIdempotencyKey()));
      await expect(settle(deactivateTax(created.id, newIdempotencyKey()))).resolves.toBeUndefined();
      const page = await settle(listTaxes({ search: 'DEL1' }));
      expect(page.data[0].status).toBe('INACTIVE');
    });
  });

  describe('lookups', () => {
    it('lists company options and permissions', async () => {
      const companies = await settle(listCompanyOptions());
      expect(companies.length).toBeGreaterThan(0);
      expect(Object.keys(companies[0]).sort()).toEqual(['canManage', 'id', 'name', 'status']);
      expect(await settle(getTaxPermissions())).toEqual({ tenantWideAllowed: true });
    });
  });
});
