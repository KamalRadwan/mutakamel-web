import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import * as api from './inventory.api';

const branch = { companyId: 'company-1', branchId: 'branch-1' };
const company = { companyId: 'company-1' };
const page = { page: 2, limit: 25 };
const id = 'record/1';
const key = newIdempotencyKey();
const at = '2026-11-23T10:00:00.000Z';
type Case = {
  name: string; method: 'GET' | 'POST' | 'PATCH'; path: string;
  scope: typeof company | typeof branch;
  query?: Record<string, string | number | boolean>; body?: unknown; version?: string;
  result: unknown; call: () => Promise<unknown>;
};
const rows: Case[] = [];
function read(name: string, path: string, scope: Case['scope'], query: Case['query'], result: unknown, call: Case['call']) {
  rows.push({ name, method: 'GET', path, scope, query, result, call });
}
function write(name: string, method: 'POST' | 'PATCH', path: string, scope: Case['scope'], body: unknown, version: string | undefined, call: Case['call']) {
  rows.push({ name, method, path, scope, body, version, result: { id, version: 4 }, call });
}
const paged = { items: [{ id }], total: 26, ...page };
const balances = { ...page, nodeId: 'n', itemId: 'i', itemCompanyProfileId: 'p', lotKey: 'lot', search: 'stock', onlyInStock: false };
read('listBalances', '/inventory/balances', branch, balances, paged, () => api.listBalances(balances, branch));
const availability = { nodeId: 'n', itemId: 'i', uomId: 'u', lotKey: 'lot', serialKey: 'serial' };
read('getAvailability', '/inventory/availability', branch, availability, { availableQuantity: '0.12345678' }, () => api.getAvailability(availability, branch));
const opening = { nodeId: 'n', itemId: 'i', uomId: 'u', quantity: '0.12345678', itemProfileVersion: 3, businessEffectiveAt: at, operationKey: newIdempotencyKey(), tracking: { serialKeys: ['S1'] } };
write('recordOpeningBalance', 'POST', '/inventory/opening-balances', branch, opening, undefined, () => api.recordOpeningBalance(opening, key, branch));
read('listNodes', '/inventory/nodes', branch, { status: 'ACTIVE' }, [{ id }], () => api.listNodes({ status: 'ACTIVE' }, branch));
const companyNodes = { ...page, status: 'ACTIVE' as const, nodeType: 'WAREHOUSE' as const, branchId: 'branch-1', search: 'WH' };
read('listCompanyNodes', '/inventory/company-nodes', company, companyNodes, paged, () => api.listCompanyNodes(companyNodes, branch));
read('getCompanyNode', '/inventory/company-nodes/record%2F1', company, undefined, { id }, () => api.getCompanyNode(id, branch));
read('getNode', '/inventory/nodes/record%2F1', branch, undefined, { id }, () => api.getNode(id, branch));
const node = { code: 'WH', name: 'Warehouse', nodeType: 'WAREHOUSE' as const, timezone: 'UTC', branchIds: ['branch-1'] };
write('createNode', 'POST', '/inventory/nodes', company, node, undefined, () => api.createNode(node, key, branch));
const patch = { name: 'Renamed', status: 'INACTIVE' as const, timezone: 'UTC', branchIds: ['branch-1'] };
write('updateNode', 'PATCH', '/inventory/nodes/record%2F1', company, patch, '"3"', () => api.updateNode(id, 3, patch, key, branch));
const periods = { ...page, status: 'CLOSED' as const, effectiveAt: at };
read('listPeriods', '/inventory/periods', company, periods, paged, () => api.listPeriods(periods, branch));
const period = { code: 'NOV', startsOn: '2026-11-01', endsOn: '2026-11-30', maxBackdateDays: 5 };
write('createPeriod', 'POST', '/inventory/periods', company, period, undefined, () => api.createPeriod(period, key, branch));
write('closePeriod', 'POST', '/inventory/periods/record%2F1/close', company, { reasonCode: 'OTHER' }, '"3"', () => api.closePeriod(id, 3, 'OTHER', key, branch));
write('reopenPeriod', 'POST', '/inventory/periods/record%2F1/reopen', company, { reasonCode: 'OTHER' }, '"3"', () => api.reopenPeriod(id, 3, 'OTHER', key, branch));
const conversions = { ...page, itemCompanyProfileId: 'p', fromUomId: 'box', toUomId: 'piece', status: 'DRAFT' as const };
read('listUomConversions', '/inventory/uom-conversions', company, conversions, paged, () => api.listUomConversions(conversions, branch));
const conversion = { itemCompanyProfileId: 'p', fromUomId: 'box', toUomId: 'piece', factorNumerator: '12', factorDenominator: '1', effectiveFrom: at };
write('createUomConversion', 'POST', '/inventory/uom-conversions', company, conversion, undefined, () => api.createUomConversion(conversion, key, branch));
write('publishUomConversion', 'POST', '/inventory/uom-conversions/record%2F1/publish', company, { reasonCode: 'OTHER' }, '"3"', () => api.publishUomConversion(id, 3, 'OTHER', key, branch));
write('retireUomConversion', 'POST', '/inventory/uom-conversions/record%2F1/retire', company, { reasonCode: 'OTHER' }, '"3"', () => api.retireUomConversion(id, 3, 'OTHER', key, branch));
const movements = { ...page, nodeId: 'n', itemId: 'i', itemCompanyProfileId: 'p', operationKey: 'op', movementType: 'PURCHASE_RECEIPT' as const, from: '2026-11-01', to: '2026-11-30', sourceType: 'RECEIPT' as const, sourceId: 'r', search: 'RC' };
read('listMovements', '/inventory/movements', branch, movements, paged, () => api.listMovements(movements, branch));
read('getMovement', '/inventory/movements/record%2F1', branch, undefined, { id, source: null }, () => api.getMovement(id, branch));
read('getMovementSource', '/inventory/receipts/record%2F1', branch, undefined, { id, lines: [] }, () => api.getMovementSource('RECEIPT', id, branch));
const reversal = { reasonCode: 'OTHER', businessEffectiveAt: at, lines: [{ lineId: 'line-1', quantity: '0.12345678', serialKeys: ['S1'] }] };
write('reverseMovementSource', 'POST', '/inventory/receipts/record%2F1/reverse', branch, reversal, '"3"', () => api.reverseMovementSource('RECEIPT', id, 3, reversal, key, branch));
const serials = { ...page, itemId: 'i', itemCompanyProfileId: 'p', serialKey: 'S1', state: 'ON_HAND' as const };
read('listSerials', '/inventory/serials', company, serials, paged, () => api.listSerials(serials, branch));
read('getSerial', '/inventory/serials/record%2F1', company, undefined, { id, lifecycle: [{ uomCode: null, sourceType: 'LEDGER' }] }, () => api.getSerial(id, branch));
const decisions = { ...page, aggregateId: 'agg', policyKind: 'INVENTORY_NEGATIVE' as const };
read('listDecisions', '/inventory/decisions', company, decisions, paged, () => api.listDecisions(decisions, branch));
read('getDecision', '/inventory/decisions/record%2F1', company, undefined, { id, result: {}, policyVersions: [] }, () => api.getDecision(id, branch));

describe('inventory linked transport contracts', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new TradeHttpStub(); dispose = bindTradeHttpForTest(stub); });
  afterEach(() => dispose());
  for (const row of rows) {
    it(row.name + ' sends the exact contract and returns unwrapped data', async () => {
      stub.register(row.method, row.path, row.result);
      expect(await row.call()).toEqual(row.result);
      if (row.method === 'GET') {
        expect(stub.recordedReads()).toEqual([{ path: row.path, query: row.query, scope: row.scope }]);
        expect(stub.recordedWrites()).toEqual([]);
      } else {
        expect(stub.recordedWrites()).toEqual([{ method: row.method, path: row.path, body: row.body, scope: row.scope, key, ifMatch: row.version, query: undefined }]);
        expect(stub.recordedReads()).toEqual([]);
      }
    });
    it(row.name + ' preserves server field errors and correlation id', async () => {
      const error = new ApiError(422, 'TRADE.VALIDATION_FAILED', { nodeId: ['invalid'] }, { correlationId: 'corr-1' });
      stub.register(row.method, row.path, error);
      await expect(row.call()).rejects.toBe(error);
    });
  }
});
