import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { ApiError, newIdempotencyKey, type TradeContext } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import {
  closePeriod,
  listBalances,
  listMovements,
  listNodes,
  publishUomConversion,
  reopenPeriod,
  retireUomConversion,
  reverseMovementSource,
} from './inventory.api';
import type {
  FulfillmentNode,
  InventoryPeriod,
  LedgerEntry,
  MovementSourceRecord,
  Page,
  StockBalanceRow,
  UomConversionRevision,
} from './inventory.model';

const BRANCH_CTX: TradeContext = { companyId: 'comp-1', branchId: 'br-1' };
const COMPANY_CTX: TradeContext = { companyId: 'comp-1' };

describe('inventory.api (IN-1 stub contracts)', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('unwraps Page responses and sends BRANCH scope headers for balances and movements', async () => {
    const balancePage: Page<StockBalanceRow> = {
      items: [
        {
          nodeId: 'n1',
          nodeCode: 'WH-1',
          nodeName: 'Main',
          itemCompanyProfileId: 'p1',
          itemId: 'i1',
          itemCode: 'ITM-1',
          itemNames: { en: 'Water' },
          trackingMode: 'NONE',
          lotKey: null,
          uomId: 'u1',
          uomCode: 'PCS',
          onHandQuantity: '10.00000000',
          reservedQuantity: '2.00000000',
          availableQuantity: '8',
          serialCount: 0,
          negative: false,
          updatedAt: '2026-11-23T08:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    };
    const movementPage: Page<LedgerEntry> = { items: [], total: 0, page: 1, limit: 50 };

    stub.register('GET', '/inventory/balances', balancePage);
    stub.register('GET', '/inventory/movements', movementPage);

    const bRes = await listBalances({ page: 1, limit: 50 }, BRANCH_CTX);
    const mRes = await listMovements({ page: 1, limit: 50 }, BRANCH_CTX);

    expect(bRes).toEqual(balancePage);
    expect(mRes).toEqual(movementPage);
    expect(stub.recordedReads().every((r) => r.scope?.companyId === 'comp-1' && r.scope?.branchId === 'br-1')).toBe(
      true,
    );

    expect(() => listBalances({ page: 1, limit: 50 }, COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
  });

  it('listNodes returns a bare array instead of a paginated wrapper', async () => {
    const nodes: FulfillmentNode[] = [
      {
        id: 'n1',
        companyId: 'comp-1',
        code: 'WH-1',
        name: 'Main',
        nodeType: 'WAREHOUSE',
        status: 'ACTIVE',
        timezone: 'Africa/Cairo',
        version: 1,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        createdBy: 'u1',
        updatedBy: 'u1',
      },
    ];
    stub.register('GET', '/inventory/nodes', nodes);

    const res = await listNodes({ status: 'ACTIVE' }, BRANCH_CTX);
    expect(Array.isArray(res)).toBe(true);
    expect(res).toEqual(nodes);
  });

  it('periods close and reopen send reasonCode, x-idempotency-key, and If-Match with COMPANY scope', async () => {
    const closed: InventoryPeriod = {
      id: 'per-1',
      companyId: 'comp-1',
      code: 'P-2026-11',
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
      status: 'CLOSED',
      maxBackdateDays: 5,
      closedAt: '2026-11-23T12:00:00.000Z',
      closedBy: 'u1',
      closeReason: 'MONTH_END',
      version: 2,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-23T12:00:00.000Z',
      createdBy: 'u1',
    };
    const reopened: InventoryPeriod = { ...closed, status: 'OPEN', closedAt: null, version: 3 };
    stub.register('POST', '/inventory/periods/:id/close', closed);
    stub.register('POST', '/inventory/periods/:id/reopen', reopened);

    const k1 = newIdempotencyKey();
    const k2 = newIdempotencyKey();
    expect(await closePeriod('per-1', 1, 'MONTH_END', k1, BRANCH_CTX)).toEqual(closed);
    expect(await reopenPeriod('per-1', 2, 'REOPEN_AUDIT', k2, BRANCH_CTX)).toEqual(reopened);

    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/periods/per-1/close',
        body: { reasonCode: 'MONTH_END' },
        key: k1,
        ifMatch: '"1"',
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/periods/per-1/reopen',
        body: { reasonCode: 'REOPEN_AUDIT' },
        key: k2,
        ifMatch: '"2"',
        scope: COMPANY_CTX,
        query: undefined,
      },
    ]);
  });

  it('uom conversion publish and retire send reasonCode, x-idempotency-key, If-Match, and propagate real UoM error codes', async () => {
    const base: UomConversionRevision = {
      id: 'conv-1',
      companyId: 'comp-1',
      itemCompanyProfileId: 'prof-1',
      fromUomId: 'u-box',
      toUomId: 'u-pcs',
      revisionNumber: 1,
      factorNumerator: '12',
      factorDenominator: '1',
      status: 'PUBLISHED',
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      contentHash: 'h1',
      publishedAt: '2026-11-23T09:00:00.000Z',
      publishedBy: 'u1',
      retiredAt: null,
      retiredBy: null,
      version: 2,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-23T09:00:00.000Z',
      itemId: null,
      itemCode: null,
      itemNames: null,
      fromUomCode: null,
      toUomCode: null,
      publishReasonCode: 'PACKAGING',
      retireReasonCode: null,
    };
    stub.register('POST', '/inventory/uom-conversions/:id/publish', base);
    stub.register('POST', '/inventory/uom-conversions/:id/retire', { ...base, status: 'RETIRED', version: 3 });

    const k1 = newIdempotencyKey();
    const k2 = newIdempotencyKey();
    await publishUomConversion('conv-1', 1, 'PACKAGING', k1, COMPANY_CTX);
    await retireUomConversion('conv-1', 2, 'OBSOLETE', k2, COMPANY_CTX);

    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/uom-conversions/conv-1/publish',
        body: { reasonCode: 'PACKAGING' },
        key: k1,
        ifMatch: '"1"',
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/uom-conversions/conv-1/retire',
        body: { reasonCode: 'OBSOLETE' },
        key: k2,
        ifMatch: '"2"',
        scope: COMPANY_CTX,
        query: undefined,
      },
    ]);

    stub.register(
      'POST',
      '/inventory/uom-conversions/:id/publish',
      new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND'),
    );
    await expect(
      publishUomConversion('missing', 1, 'PACKAGING', newIdempotencyKey(), COMPANY_CTX),
    ).rejects.toMatchObject({ status: 404, code: 'TRADE.INVENTORY.SCOPE_NOT_FOUND' });
  });

  it('reverseMovementSource sends reasonCode, key, If-Match, and BRANCH scope', async () => {
    const rec = { id: 'rcpt-1', status: 'REVERSED', version: 2, lines: [] } as unknown as MovementSourceRecord;
    stub.register('POST', '/inventory/receipts/:id/reverse', rec);

    const k = newIdempotencyKey();
    const res = await reverseMovementSource(
      'RECEIPT',
      'rcpt-1',
      1,
      {
        reasonCode: 'DAMAGED',
        businessEffectiveAt: '2026-11-23T10:00:00.000Z',
        lines: [{ lineId: 'l1', quantity: '3' }],
      },
      k,
      BRANCH_CTX,
    );

    expect(res).toEqual(rec);
    expect(stub.recordedWrites()[0]).toEqual({
      method: 'POST',
      path: '/inventory/receipts/rcpt-1/reverse',
      body: {
        reasonCode: 'DAMAGED',
        businessEffectiveAt: '2026-11-23T10:00:00.000Z',
        lines: [{ lineId: 'l1', quantity: '3' }],
      },
      key: k,
      ifMatch: '"1"',
      scope: BRANCH_CTX,
      query: undefined,
    });
  });
});
