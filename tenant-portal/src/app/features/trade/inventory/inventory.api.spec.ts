import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { ApiError, newIdempotencyKey, type TradeContext } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import {
  closePeriod,
  createNode,
  createPeriod,
  createUomConversion,
  getAvailability,
  getCompanyNode,
  getDecision,
  getMovement,
  getMovementSource,
  getNode,
  getSerial,
  listBalances,
  listCompanyNodes,
  listDecisions,
  listMovements,
  listNodes,
  listPeriods,
  listSerials,
  listUomConversions,
  publishUomConversion,
  recordOpeningBalance,
  reopenPeriod,
  retireUomConversion,
  reverseMovementSource,
  updateNode,
} from './inventory.api';
import type {
  Availability,
  CompanyNode,
  FulfillmentNode,
  InventoryDecision,
  InventoryPeriod,
  LedgerEntry,
  LedgerEntryDetail,
  MovementSource,
  MovementSourceRecord,
  OpeningBalanceResult,
  Page,
  SerialDetail,
  SerialUnit,
  StockBalanceRow,
  UomConversionRevision,
} from './inventory.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPANY_CTX: TradeContext = { companyId: 'comp-1' };
const BRANCH_CTX: TradeContext = { companyId: 'comp-1', branchId: 'br-1' };

function makeNode(overrides: Partial<FulfillmentNode> = {}): FulfillmentNode {
  return {
    id: 'node-1',
    companyId: 'comp-1',
    code: 'WH-01',
    name: 'Main warehouse',
    nodeType: 'WAREHOUSE',
    status: 'ACTIVE',
    timezone: 'Africa/Cairo',
    version: 2,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T09:00:00.000Z',
    createdBy: 'usr-1',
    updatedBy: 'usr-1',
    ...overrides,
  };
}

function makeCompanyNode(overrides: Partial<CompanyNode> = {}): CompanyNode {
  return {
    ...makeNode(),
    branches: [{ id: 'nb-1', branchId: 'br-1', isActive: true, version: 1 }],
    branchCount: 1,
    ...overrides,
  };
}

function makePeriod(overrides: Partial<InventoryPeriod> = {}): InventoryPeriod {
  return {
    id: 'per-1',
    companyId: 'comp-1',
    code: 'P-2026-11',
    startsOn: '2026-11-01',
    endsOn: '2026-11-30',
    status: 'OPEN',
    maxBackdateDays: 5,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    version: 3,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdBy: 'usr-1',
    ...overrides,
  };
}

function makeConversion(overrides: Partial<UomConversionRevision> = {}): UomConversionRevision {
  return {
    id: 'conv-1',
    companyId: 'comp-1',
    itemCompanyProfileId: 'prof-1',
    fromUomId: 'uom-box',
    toUomId: 'uom-pcs',
    revisionNumber: 1,
    factorNumerator: '12',
    factorDenominator: '1',
    status: 'DRAFT',
    effectiveFrom: '2026-11-01T00:00:00.000Z',
    contentHash: 'hash-1',
    publishedAt: null,
    publishedBy: null,
    retiredAt: null,
    retiredBy: null,
    version: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    itemId: null,
    itemCode: null,
    itemNames: null,
    fromUomCode: null,
    toUomCode: null,
    publishReasonCode: null,
    retireReasonCode: null,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<InventoryDecision> = {}): InventoryDecision {
  return {
    id: 'dec-1',
    decisionType: 'INVENTORY_RESERVATION',
    aggregateType: 'INVENTORY_RESERVATION',
    aggregateId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
    companyId: 'comp-1',
    branchId: 'br-1',
    policyVersions: [
      {
        type: 'POLICY_VERSION',
        policyKind: 'INVENTORY_RESERVATION',
        definitionId: 'def-1',
        definitionCode: 'RES_POLICY',
        id: 'ver-1',
        version: 4,
        contentHash: 'abc123',
        registryVersion: '1',
      },
    ],
    matchedRules: ['PARTIAL_OK'],
    result: {
      selectedValue: null,
    },
    explanation: 'Partial stock available.',
    evaluatedAt: '2026-11-23T10:00:00.000Z',
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('inventory.api', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('requires BRANCH scope locally without sending HTTP requests on branch endpoints', async () => {
    const key = newIdempotencyKey();
    expect(() => listBalances({ page: 1, limit: 20 }, COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(() => getAvailability({ nodeId: 'n1', itemId: 'i1' }, COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    await expect(
      recordOpeningBalance(
        {
          nodeId: 'n1',
          itemId: 'i1',
          uomId: 'u1',
          quantity: '5',
          itemProfileVersion: 1,
          businessEffectiveAt: '2026-11-23T10:00:00.000Z',
          operationKey: newIdempotencyKey(),
        },
        key,
        COMPANY_CTX,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });
    expect(() => listNodes({}, COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(() => getNode('n1', COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(() => listMovements({ page: 1, limit: 20 }, COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(() => getMovement('m1', COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(() => getMovementSource('RECEIPT', 'r1', COMPANY_CTX)).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    await expect(
      reverseMovementSource(
        'RECEIPT',
        'r1',
        1,
        { reasonCode: 'DAMAGED', businessEffectiveAt: '2026-11-23T10:00:00.000Z' },
        key,
        COMPANY_CTX,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });

    expect(stub.recordedReads()).toHaveLength(0);
    expect(stub.recordedWrites()).toHaveLength(0);
  });

  it('requires COMPANY scope locally on company endpoints and omits branchId header', async () => {
    expect(() => listCompanyNodes({ page: 1, limit: 20 }, {})).toThrowError(expect.objectContaining({ status: 400, code: 'TRADE.SCOPE.REQUIRED' }));
    expect(stub.recordedReads()).toHaveLength(0);

    stub.register('GET', '/inventory/periods', { items: [], total: 0, page: 1, limit: 20 });
    await listPeriods({ page: 1, limit: 20 }, BRANCH_CTX);
    expect(stub.recordedReads()[0].scope).toEqual({ companyId: 'comp-1' });
  });

  it('listBalances and getAvailability send BRANCH scope and exact query params', async () => {
    const page: Page<StockBalanceRow> = { items: [], total: 0, page: 1, limit: 50 };
    const avail: Availability = {
      nodeId: 'n1',
      itemId: 'i1',
      uomId: 'u1',
      onHandQuantity: '10.00000000',
      reservedQuantity: '2.00000000',
      availableQuantity: '8',
      version: 1,
      asOf: '2026-11-23T10:00:00.000Z',
      advisory: true,
      nodeCode: 'WH-01',
      nodeName: 'Main',
      itemCode: 'ITM-1',
      itemNames: { en: 'Item' },
      uomCode: 'PCS',
    };
    stub.register('GET', '/inventory/balances', page);
    stub.register('GET', '/inventory/availability', avail);

    expect(
      await listBalances(
        {
          nodeId: 'n1',
          onlyInStock: true,
          search: '  ITM  ',
          page: 1,
          limit: 50,
        },
        BRANCH_CTX,
      ),
    ).toEqual(page);
    expect(
      await getAvailability({ nodeId: 'n1', itemId: 'i1', lotKey: 'L1' }, BRANCH_CTX),
    ).toEqual(avail);

    expect(stub.recordedReads()).toEqual([
      {
        path: '/inventory/balances',
        query: { nodeId: 'n1', onlyInStock: true, search: 'ITM', page: 1, limit: 50 },
        scope: BRANCH_CTX,
      },
      {
        path: '/inventory/availability',
        query: { nodeId: 'n1', itemId: 'i1', lotKey: 'L1' },
        scope: BRANCH_CTX,
      },
    ]);
  });

  it('recordOpeningBalance posts whitelisted OpeningBalanceDto with UUIDv7 key and BRANCH scope', async () => {
    const res = { balance: { id: 'b1' }, balances: [], ledger: { id: 'l1' } } as unknown as OpeningBalanceResult;
    stub.register('POST', '/inventory/opening-balances', res);
    const key = newIdempotencyKey();
    const opKey = newIdempotencyKey();

    const actual = await recordOpeningBalance(
      {
        nodeId: 'n1',
        itemId: 'i1',
        uomId: 'u1',
        quantity: '4',
        itemProfileVersion: 2,
        businessEffectiveAt: '2026-11-23T09:00:00.000Z',
        operationKey: opKey,
        tracking: { lotKey: 'L-1', extraTracking: 'strip' } as never,
        extraField: 'strip',
      } as never,
      key,
      BRANCH_CTX,
    );

    expect(actual).toEqual(res);
    const [write] = stub.recordedWrites();
    expect(write.method).toBe('POST');
    expect(write.path).toBe('/inventory/opening-balances');
    expect(write.key).toBe(key);
    expect(write.key).toMatch(UUID_V7_REGEX);
    expect(write.ifMatch).toBeUndefined();
    expect(write.scope).toEqual(BRANCH_CTX);
    expect(write.body).toEqual({
      nodeId: 'n1',
      itemId: 'i1',
      uomId: 'u1',
      quantity: '4',
      itemProfileVersion: 2,
      businessEffectiveAt: '2026-11-23T09:00:00.000Z',
      operationKey: opKey,
      tracking: { lotKey: 'L-1' },
    });
  });

  it('node endpoints cover listNodes bare array, getNode, listCompanyNodes, getCompanyNode, createNode, updateNode', async () => {
    const node = makeNode();
    const companyNode = makeCompanyNode();
    stub.register('GET', '/inventory/nodes', [node]);
    stub.register('GET', '/inventory/nodes/:id', node);
    stub.register('GET', '/inventory/company-nodes', { items: [companyNode], total: 1, page: 1, limit: 25 });
    stub.register('GET', '/inventory/company-nodes/:id', companyNode);
    stub.register('POST', '/inventory/nodes', node);
    stub.register('PATCH', '/inventory/nodes/:id', { ...node, version: 3 });

    const bare = await listNodes({ status: 'ACTIVE' }, BRANCH_CTX);
    expect(Array.isArray(bare)).toBe(true);
    expect(bare).toEqual([node]);
    expect(await getNode('node-1', BRANCH_CTX)).toEqual(node);
    expect((await listCompanyNodes({ status: 'ACTIVE', branchId: 'br-1', search: ' WH ', page: 1, limit: 25 }, BRANCH_CTX)).items).toEqual([companyNode]);
    expect(await getCompanyNode('node-1', BRANCH_CTX)).toEqual(companyNode);

    const k1 = newIdempotencyKey();
    await createNode(
      { code: 'WH-01', name: 'Main warehouse', nodeType: 'WAREHOUSE', timezone: 'Africa/Cairo', branchIds: ['br-1'], uiExtra: 1 } as never,
      k1,
      BRANCH_CTX,
    );
    const k2 = newIdempotencyKey();
    await updateNode('node-1', 2, { name: 'Renamed', ignored: true } as never, k2, BRANCH_CTX);

    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/nodes',
        body: { code: 'WH-01', name: 'Main warehouse', nodeType: 'WAREHOUSE', timezone: 'Africa/Cairo', branchIds: ['br-1'] },
        key: k1,
        ifMatch: undefined,
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'PATCH',
        path: '/inventory/nodes/node-1',
        body: { name: 'Renamed' },
        key: k2,
        ifMatch: '"2"',
        scope: COMPANY_CTX,
        query: undefined,
      },
    ]);
  });

  it('period endpoints cover listPeriods, createPeriod, closePeriod, reopenPeriod', async () => {
    const period = makePeriod();
    stub.register('GET', '/inventory/periods', { items: [period], total: 1, page: 1, limit: 50 });
    stub.register('POST', '/inventory/periods', period);
    stub.register('POST', '/inventory/periods/:id/close', { ...period, status: 'CLOSED', version: 4 });
    stub.register('POST', '/inventory/periods/:id/reopen', { ...period, status: 'OPEN', version: 5 });

    await listPeriods({ status: 'OPEN', effectiveAt: '2026-11-15T00:00:00.000Z', page: 1, limit: 50 }, BRANCH_CTX);
    const k1 = newIdempotencyKey();
    await createPeriod({ code: 'P-2026-11', startsOn: '2026-11-01', endsOn: '2026-11-30', maxBackdateDays: 5, junk: 'x' } as never, k1, COMPANY_CTX);
    const k2 = newIdempotencyKey();
    await closePeriod('per-1', 3, 'MONTH_END', k2, COMPANY_CTX);
    const k3 = newIdempotencyKey();
    await reopenPeriod('per-1', 4, 'CORRECTION', k3, COMPANY_CTX);

    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/periods',
        body: { code: 'P-2026-11', startsOn: '2026-11-01', endsOn: '2026-11-30', maxBackdateDays: 5 },
        key: k1,
        ifMatch: undefined,
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/periods/per-1/close',
        body: { reasonCode: 'MONTH_END' },
        key: k2,
        ifMatch: '"3"',
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/periods/per-1/reopen',
        body: { reasonCode: 'CORRECTION' },
        key: k3,
        ifMatch: '"4"',
        scope: COMPANY_CTX,
        query: undefined,
      },
    ]);
  });

  it('UoM conversion endpoints preserve nullable fields and send key + If-Match on publish/retire', async () => {
    const rev = makeConversion();
    stub.register('GET', '/inventory/uom-conversions', { items: [rev], total: 1, page: 1, limit: 50 });
    stub.register('POST', '/inventory/uom-conversions', rev);
    stub.register('POST', '/inventory/uom-conversions/:id/publish', { ...rev, status: 'PUBLISHED', version: 2 });
    stub.register('POST', '/inventory/uom-conversions/:id/retire', { ...rev, status: 'RETIRED', version: 3 });

    const page = await listUomConversions({ itemCompanyProfileId: 'prof-1', status: 'DRAFT', page: 1, limit: 50 }, COMPANY_CTX);
    expect(page.items[0].itemCode).toBeNull();
    expect(page.items[0].fromUomCode).toBeNull();

    const k1 = newIdempotencyKey();
    await createUomConversion(
      {
        itemCompanyProfileId: 'prof-1',
        fromUomId: 'uom-box',
        toUomId: 'uom-pcs',
        factorNumerator: '12',
        factorDenominator: '1',
        effectiveFrom: '2026-11-01T00:00:00.000Z',
        extra: true,
      } as never,
      k1,
      COMPANY_CTX,
    );
    const k2 = newIdempotencyKey();
    await publishUomConversion('conv-1', 1, 'PACKAGING_UPDATE', k2, COMPANY_CTX);
    const k3 = newIdempotencyKey();
    await retireUomConversion('conv-1', 2, 'REPLACED', k3, COMPANY_CTX);

    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/uom-conversions',
        body: {
          itemCompanyProfileId: 'prof-1',
          fromUomId: 'uom-box',
          toUomId: 'uom-pcs',
          factorNumerator: '12',
          factorDenominator: '1',
          effectiveFrom: '2026-11-01T00:00:00.000Z',
        },
        key: k1,
        ifMatch: undefined,
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/uom-conversions/conv-1/publish',
        body: { reasonCode: 'PACKAGING_UPDATE' },
        key: k2,
        ifMatch: '"1"',
        scope: COMPANY_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/uom-conversions/conv-1/retire',
        body: { reasonCode: 'REPLACED' },
        key: k3,
        ifMatch: '"2"',
        scope: COMPANY_CTX,
        query: undefined,
      },
    ]);
  });

  it('movement and source endpoints handle listMovements, getMovement, getMovementSource, and reverseMovementSource', async () => {
    const entry = { id: 'mov-1' } as LedgerEntry;
    const detail = { id: 'mov-1', version: 1 } as LedgerEntryDetail;
    const source = { id: 'src-1', kind: 'RECEIPT', version: 2, lines: [] } as unknown as MovementSource;
    const reversed = { id: 'src-1', status: 'REVERSED', version: 3, lines: [] } as unknown as MovementSourceRecord;

    stub.register('GET', '/inventory/movements', { items: [entry], total: 1, page: 1, limit: 50 });
    stub.register('GET', '/inventory/movements/:id', detail);
    stub.register('GET', '/inventory/receipts/:id', source);
    stub.register('GET', '/inventory/deliveries/:id', { ...source, kind: 'DELIVERY' });
    stub.register('POST', '/inventory/receipts/:id/reverse', reversed);
    stub.register('POST', '/inventory/deliveries/:id/reverse', reversed);

    await listMovements({ nodeId: 'n1', group: 'RECEIPT', from: '2026-11-01', to: '2026-11-30', page: 1, limit: 50 }, BRANCH_CTX);
    await getMovement('mov-1', BRANCH_CTX);
    await getMovementSource('RECEIPT', 'rcpt-1', BRANCH_CTX);
    await getMovementSource('DELIVERY', 'dlv-1', BRANCH_CTX);

    const k1 = newIdempotencyKey();
    await reverseMovementSource(
      'RECEIPT',
      'rcpt-1',
      2,
      {
        reasonCode: 'RETURN_TO_VENDOR',
        businessEffectiveAt: '2026-11-23T10:00:00.000Z',
        lines: [{ lineId: 'line-1', quantity: '2', serialKeys: ['S1', 'S2'], extra: 1 } as never],
        extraBody: true,
      } as never,
      k1,
      BRANCH_CTX,
    );
    const k2 = newIdempotencyKey();
    await reverseMovementSource(
      'DELIVERY',
      'dlv-1',
      4,
      { reasonCode: 'CUSTOMER_RETURN', businessEffectiveAt: '2026-11-23T11:00:00.000Z' },
      k2,
      BRANCH_CTX,
    );

    expect(stub.recordedReads().map((r) => r.path)).toEqual([
      '/inventory/movements',
      '/inventory/movements/mov-1',
      '/inventory/receipts/rcpt-1',
      '/inventory/deliveries/dlv-1',
    ]);
    expect(stub.recordedWrites()).toEqual([
      {
        method: 'POST',
        path: '/inventory/receipts/rcpt-1/reverse',
        body: {
          reasonCode: 'RETURN_TO_VENDOR',
          businessEffectiveAt: '2026-11-23T10:00:00.000Z',
          lines: [{ lineId: 'line-1', quantity: '2', serialKeys: ['S1', 'S2'] }],
        },
        key: k1,
        ifMatch: '"2"',
        scope: BRANCH_CTX,
        query: undefined,
      },
      {
        method: 'POST',
        path: '/inventory/deliveries/dlv-1/reverse',
        body: {
          reasonCode: 'CUSTOMER_RETURN',
          businessEffectiveAt: '2026-11-23T11:00:00.000Z',
        },
        key: k2,
        ifMatch: '"4"',
        scope: BRANCH_CTX,
        query: undefined,
      },
    ]);
  });

  it('serial and decision endpoints cover listSerials, getSerial, listDecisions, getDecision and propagate errors', async () => {
    const unit = { id: 'ser-1', itemCode: null, itemNames: null } as unknown as SerialUnit;
    const detail = { ...unit, lifecycle: [] } as unknown as SerialDetail;
    const dec = makeDecision();

    stub.register('GET', '/inventory/serials', { items: [unit], total: 1, page: 1, limit: 20 });
    stub.register('GET', '/inventory/serials/:id', detail);
    stub.register('GET', '/inventory/decisions', { items: [dec], total: 1, page: 1, limit: 20 });
    stub.register('GET', '/inventory/decisions/:id', dec);

    expect((await listSerials({ serialKey: 'S1', state: 'ON_HAND', page: 1, limit: 20 }, BRANCH_CTX)).items[0].itemCode).toBeNull();
    expect(await getSerial('ser-1', COMPANY_CTX)).toEqual(detail);

    const decPage = await listDecisions({ policyKind: 'INVENTORY_RESERVATION', page: 1, limit: 20 }, BRANCH_CTX);
    expect(Object.keys(decPage.items[0].policyVersions[0]).sort()).toEqual([
      'contentHash',
      'definitionCode',
      'definitionId',
      'id',
      'policyKind',
      'registryVersion',
      'type',
      'version',
    ]);
    expect(decPage.items[0].result.outcome).toBeUndefined();
    expect(await getDecision('dec-1', COMPANY_CTX)).toEqual(dec);

    const forbidden = new ApiError(403, 'TRADE.AUTH.TARGET_DENIED');
    stub.register('GET', '/inventory/decisions/:id', forbidden);
    await expect(getDecision('dec-1', COMPANY_CTX)).rejects.toBe(forbidden);

    const notFound = new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
    stub.register('POST', '/inventory/uom-conversions/:id/publish', notFound);
    await expect(
      publishUomConversion('missing', 1, 'PACKAGING_UPDATE', newIdempotencyKey(), COMPANY_CTX),
    ).rejects.toBe(notFound);
  });

  it('rejects missing or non-UUIDv7 idempotency keys before issuing writes', async () => {
    await expect(
      createNode(
        { code: 'WH-01', name: 'Main', nodeType: 'WAREHOUSE', timezone: 'UTC', branchIds: ['br-1'] },
        '',
        COMPANY_CTX,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

    await expect(
      closePeriod('per-1', 1, 'MONTH_END', 'not-a-uuid-v7', COMPANY_CTX),
    ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

    expect(stub.recordedWrites()).toHaveLength(0);
  });
});
