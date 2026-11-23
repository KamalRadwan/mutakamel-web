import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import type { StatusCounts, Uom } from '../../shared/trade-foundation.model';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import {
  countUoms,
  createUom,
  getUom,
  listAllUoms,
  uomReferences,
  updateUom,
} from './units.api';
import {
  parseUomRefGroupsFromDetails,
  type UomListPage,
  type UomReferences,
} from './units.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeUom(overrides: Partial<Uom> = {}): Uom {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    code: 'KG',
    displayName: 'Kilogram',
    localizedNames: { en: 'Kilogram', ar: 'كيلوجرام' },
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('units.api', () => {
  it('listAllUoms calls GET /uoms with page/limit/query and OPTIONAL scope, unwraps pages, and merges all 119 seeded units', async () => {
    const page1Items = Array.from({ length: 100 }, (_, i) =>
      makeUom({
        id: `01900000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
        code: `U${String(119 - i).padStart(3, '0')}`,
      }),
    );
    const page2Items = Array.from({ length: 19 }, (_, i) =>
      makeUom({
        id: `01900000-0000-7000-8000-${String(101 + i).padStart(12, '0')}`,
        code: `U${String(19 - i).padStart(3, '0')}`,
      }),
    );

    const stub = new TradeHttpStub();
    let callCount = 0;
    const originalRead = stub.read.bind(stub);
    stub.read = (async <T>(path: string, query?: Record<string, unknown>, options?: { scope?: unknown }) => {
      callCount += 1;
      const pageData: UomListPage =
        callCount === 1
          ? { items: page1Items, total: 119, page: 1, limit: 100, source: 'AUTHORIZED_TRADE_UOM_MASTER' }
          : { items: page2Items, total: 119, page: 2, limit: 100, source: 'AUTHORIZED_TRADE_UOM_MASTER' };
      stub.register('GET', '/uoms', pageData);
      return originalRead<T>(path, query as never, options as never);
    }) as typeof stub.read;

    const dispose = bindTradeHttpForTest(stub);
    try {
      const merged = await listAllUoms(undefined, { companyId: 'comp-1', branchId: 'br-1' });
      expect(merged).toHaveLength(119);
      expect(merged[0].code).toBe('U001');
      expect(merged[118].code).toBe('U119');
      expect(stub.recordedReads()).toEqual([
        { path: '/uoms', query: { page: 1, limit: 100 }, scope: { companyId: 'comp-1', branchId: 'br-1' } },
        { path: '/uoms', query: { page: 2, limit: 100 }, scope: { companyId: 'comp-1', branchId: 'br-1' } },
      ]);

      stub.reset();
      callCount = 0;
      const searchMatch = makeUom({ code: 'KG' });
      const searchPage: UomListPage = {
        items: [searchMatch],
        total: 1,
        page: 1,
        limit: 100,
        source: 'AUTHORIZED_TRADE_UOM_MASTER',
      };
      stub.read = (async <T>(path: string, query?: Record<string, unknown>, options?: { scope?: unknown }) => {
        stub.register('GET', '/uoms', searchPage);
        return originalRead<T>(path, query as never, options as never);
      }) as typeof stub.read;

      const searched = await listAllUoms('  KG  ');
      expect(searched).toEqual([searchMatch]);
      expect(stub.recordedReads()).toEqual([
        { path: '/uoms', query: { page: 1, limit: 100, search: 'KG' }, scope: {} },
      ]);
    } finally {
      dispose();
    }
  });

  it('listAllUoms propagates validation errors with field details', async () => {
    const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
      search: ['search must be shorter than or equal to 80 characters'],
    });
    const stub = new TradeHttpStub({ 'GET /uoms': validationErr });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listAllUoms('x'.repeat(81))).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { search: ['search must be shorter than or equal to 80 characters'] },
      });
    } finally {
      dispose();
    }
  });

  it('countUoms sends one aggregated GET /uoms/status-counts request with OPTIONAL scope and unwraps counts', async () => {
    const counts: StatusCounts<'ACTIVE' | 'RETIRED'> = { ACTIVE: 115, RETIRED: 4, total: 119 };
    const stub = new TradeHttpStub({ 'GET /uoms/status-counts': counts });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await countUoms({ companyId: 'comp-1' });
      expect(result).toEqual(counts);
      expect(stub.recordedReads()).toEqual([
        { path: '/uoms/status-counts', query: undefined, scope: { companyId: 'comp-1' } },
      ]);

      await countUoms({}, '  PCS  ');
      expect(stub.recordedReads()[1]).toEqual({
        path: '/uoms/status-counts',
        query: { search: 'PCS' },
        scope: {},
      });
    } finally {
      dispose();
    }
  });

  it('uomReferences calls GET /uoms/:id/references with OPTIONAL scope and unwraps blocking/groups', async () => {
    const refs: UomReferences = {
      blocking: true,
      groups: [
        { key: 'ITEM_BASE', count: 3 },
        { key: 'STOCK', count: 1 },
      ],
    };
    const stub = new TradeHttpStub({ 'GET /uoms/:id/references': refs });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await uomReferences('uom-1', { companyId: 'comp-1', branchId: 'br-1' });
      expect(result).toEqual(refs);
      expect(stub.recordedReads()).toEqual([
        { path: '/uoms/uom-1/references', query: undefined, scope: { companyId: 'comp-1', branchId: 'br-1' } },
      ]);

      const invalid = new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
      stub.register('GET', '/uoms/:id/references', invalid);
      await expect(uomReferences('missing')).rejects.toBe(invalid);
    } finally {
      dispose();
    }
  });

  it('getUom calls GET /uoms/:id with OPTIONAL scope and unwraps Uom', async () => {
    const uom = makeUom({ id: 'uom-1', version: 4 });
    const stub = new TradeHttpStub({ 'GET /uoms/:id': uom });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await getUom('uom-1', { companyId: 'comp-1' });
      expect(result).toEqual(uom);
      expect(stub.recordedReads()).toEqual([
        { path: '/uoms/uom-1', query: undefined, scope: { companyId: 'comp-1' } },
      ]);
    } finally {
      dispose();
    }
  });

  it('createUom posts whitelisted CreateUomDto body with UUIDv7 key and NONE scope (no headers)', async () => {
    const created = makeUom({ code: 'BOX' });
    const stub = new TradeHttpStub({ 'POST /uoms': created });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const inputWithExtra = {
        code: 'BOX',
        displayName: 'Box',
        localizedNames: { en: 'Box', ar: 'صندوق' },
        uiOnly: 'must-be-stripped',
      };
      const result = await createUom(inputWithExtra as never, key);
      expect(result).toEqual(created);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toEqual({
        method: 'POST',
        path: '/uoms',
        body: {
          code: 'BOX',
          displayName: 'Box',
          localizedNames: { en: 'Box', ar: 'صندوق' },
        },
        key,
        ifMatch: undefined,
        scope: undefined,
        query: undefined,
      });
      expect(writes[0].key).toMatch(UUID_V7_REGEX);
    } finally {
      dispose();
    }
  });

  it('createUom rejects missing/bad keys locally and propagates validation and conflict errors', async () => {
    const stub = new TradeHttpStub();
    const dispose = bindTradeHttpForTest(stub);
    try {
      const validBody = {
        code: 'BOX',
        displayName: 'Box',
        localizedNames: { en: 'Box', ar: 'صندوق' },
      };

      await expect(createUom(validBody, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
      await expect(createUom(validBody, 'bad-key')).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
      });
      expect(stub.recordedWrites()).toHaveLength(0);

      const fieldErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        code: ['code must match /^[A-Za-z][A-Za-z0-9._-]*$/ regular expression'],
      });
      stub.register('POST', '/uoms', fieldErr);
      await expect(createUom(validBody, newIdempotencyKey())).rejects.toBe(fieldErr);

      const takenErr = new ApiError(409, 'TRADE.CATALOG.UOM_CODE_TAKEN');
      stub.register('POST', '/uoms', takenErr);
      await expect(createUom(validBody, newIdempotencyKey())).rejects.toBe(takenErr);
    } finally {
      dispose();
    }
  });

  it('updateUom sends PATCH /uoms/:id with key, If-Match, NONE scope, whitelisted body, and propagates 409 conflict & retire-referenced details', async () => {
    const updated = makeUom({ id: 'uom-1', version: 4, displayName: 'Kilogram updated' });
    const stub = new TradeHttpStub({ 'PATCH /uoms/:id': updated });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await updateUom(
        'uom-1',
        { displayName: 'Kilogram updated', extraField: 'strip-me' } as never,
        3,
        key,
      );
      expect(result).toEqual(updated);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PATCH',
          path: '/uoms/uom-1',
          body: { displayName: 'Kilogram updated' },
          key,
          ifMatch: '"3"',
          scope: undefined,
          query: undefined,
        },
      ]);

      const staleErr = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      stub.register('PATCH', '/uoms/:id', staleErr);
      await expect(updateUom('uom-1', { status: 'RETIRED' }, 3, newIdempotencyKey())).rejects.toBe(staleErr);
      expect(stub.recordedWrites()).toHaveLength(2);

      const referencedErr = new ApiError(409, 'TRADE.CATALOG.UOM_RETIRE_REFERENCED', {
        ITEM_BASE: ['2'],
        STOCK: ['1'],
      });
      stub.register('PATCH', '/uoms/:id', referencedErr);
      try {
        await updateUom('uom-1', { status: 'RETIRED' }, 3, newIdempotencyKey());
        expect.unreachable('Expected TRADE.CATALOG.UOM_RETIRE_REFERENCED');
      } catch (err) {
        expect(err).toBe(referencedErr);
        expect(parseUomRefGroupsFromDetails((err as ApiError).details)).toEqual([
          { key: 'ITEM_BASE', count: 2 },
          { key: 'STOCK', count: 1 },
        ]);
      }

      await expect(updateUom('uom-1', { status: 'RETIRED' }, 3, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
    } finally {
      dispose();
    }
  });
});
