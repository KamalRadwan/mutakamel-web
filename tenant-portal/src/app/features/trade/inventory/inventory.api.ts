import {
  fakeClosePeriod,
  fakeCreateNode,
  fakeCreatePeriod,
  fakeCreateUomConversion,
  fakeGetAvailability,
  fakeGetCompanyNode,
  fakeGetDecision,
  fakeGetMovement,
  fakeGetMovementSource,
  fakeGetNode,
  fakeGetSerial,
  fakeListBalances,
  fakeListCompanyNodes,
  fakeListDecisions,
  fakeListMovements,
  fakeListNodes,
  fakeListPeriods,
  fakeListSerials,
  fakeListUomConversions,
  fakePublishUomConversion,
  fakeRecordOpeningBalance,
  fakeReopenPeriod,
  fakeRetireUomConversion,
  fakeReverseMovementSource,
  fakeUpdateNode,
} from './inventory.fake';
import type {
  Availability,
  AvailabilityQuery,
  BalanceQuery,
  CompanyNode,
  CompanyNodeQuery,
  CreateNodeBody,
  CreatePeriodBody,
  CreateUomConversionBody,
  DecisionQuery,
  FulfillmentNode,
  InventoryDecision,
  InventoryPeriod,
  LedgerEntry,
  LedgerEntryDetail,
  MovementQuery,
  MovementSource,
  MovementSourceRecord,
  NodeListQuery,
  OpeningBalanceInput,
  OpeningBalanceResult,
  Page,
  PeriodQuery,
  ReverseMovementInput,
  SerialDetail,
  SerialQuery,
  SerialUnit,
  StockBalanceRow,
  UomConversionQuery,
  UomConversionRevision,
  UpdateNodePatch,
} from './inventory.model';

export const INVENTORY_API_LIVE = {
  companyNodes: false,
  balances: false,
  movements: false,
  reasons: false,
} as const;

export { FAKE_INVENTORY_FAIL_NEXT } from './inventory.fake';

/** GET /api/v1/trade/inventory/balances (codex-1) */
export function listBalances(q: BalanceQuery): Promise<Page<StockBalanceRow>> {
  return fakeListBalances(q);
}

/** GET /api/v1/trade/inventory/availability */
export function getAvailability(q: AvailabilityQuery): Promise<Availability> {
  return fakeGetAvailability(q);
}

/** POST /api/v1/trade/inventory/opening-balances (header x-idempotency-key); returns raw records, re-fetch balances/movements for display */
export function recordOpeningBalance(
  body: OpeningBalanceInput,
  key: string,
): Promise<OpeningBalanceResult> {
  return fakeRecordOpeningBalance(body, key);
}

/** GET /api/v1/trade/inventory/nodes?status= (bare array, ordered by code; nodes of the current branch) */
export function listNodes(q: NodeListQuery = {}): Promise<FulfillmentNode[]> {
  return fakeListNodes(q);
}

/** GET /api/v1/trade/inventory/company-nodes (codex-2) */
export function listCompanyNodes(q: CompanyNodeQuery): Promise<Page<CompanyNode>> {
  return fakeListCompanyNodes(q);
}

/** GET /api/v1/trade/inventory/company-nodes/:id (codex-2) */
export function getCompanyNode(id: string): Promise<CompanyNode> {
  return fakeGetCompanyNode(id);
}

/** GET /api/v1/trade/inventory/nodes/:id */
export function getNode(id: string): Promise<FulfillmentNode> {
  return fakeGetNode(id);
}

/** POST /api/v1/trade/inventory/nodes (header x-idempotency-key) */
export function createNode(body: CreateNodeBody, key: string): Promise<FulfillmentNode> {
  return fakeCreateNode(body, key);
}

/** PATCH /api/v1/trade/inventory/nodes/:id (headers If-Match, x-idempotency-key) */
export function updateNode(
  id: string,
  version: number,
  patch: UpdateNodePatch,
  key: string,
): Promise<FulfillmentNode> {
  return fakeUpdateNode(id, version, patch, key);
}

/** GET /api/v1/trade/inventory/periods */
export function listPeriods(q: PeriodQuery): Promise<Page<InventoryPeriod>> {
  return fakeListPeriods(q);
}

/** POST /api/v1/trade/inventory/periods (header x-idempotency-key) */
export function createPeriod(body: CreatePeriodBody, key: string): Promise<InventoryPeriod> {
  return fakeCreatePeriod(body, key);
}

/** POST /api/v1/trade/inventory/periods/:id/close (headers If-Match, x-idempotency-key) */
export function closePeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<InventoryPeriod> {
  return fakeClosePeriod(id, version, reasonCode, key);
}

/** POST /api/v1/trade/inventory/periods/:id/reopen (headers If-Match, x-idempotency-key) */
export function reopenPeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<InventoryPeriod> {
  return fakeReopenPeriod(id, version, reasonCode, key);
}

/** GET /api/v1/trade/inventory/uom-conversions */
export function listUomConversions(q: UomConversionQuery): Promise<Page<UomConversionRevision>> {
  return fakeListUomConversions(q);
}

/** POST /api/v1/trade/inventory/uom-conversions (header x-idempotency-key) */
export function createUomConversion(
  body: CreateUomConversionBody,
  key: string,
): Promise<UomConversionRevision> {
  return fakeCreateUomConversion(body, key);
}

/** POST /api/v1/trade/inventory/uom-conversions/:id/publish (headers If-Match, x-idempotency-key) */
export function publishUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<UomConversionRevision> {
  return fakePublishUomConversion(id, version, reasonCode, key);
}

/** POST /api/v1/trade/inventory/uom-conversions/:id/retire (headers If-Match, x-idempotency-key) */
export function retireUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<UomConversionRevision> {
  return fakeRetireUomConversion(id, version, reasonCode, key);
}

/** GET /api/v1/trade/inventory/movements (codex-1) */
export function listMovements(q: MovementQuery): Promise<Page<LedgerEntry>> {
  return fakeListMovements(q);
}

/** GET /api/v1/trade/inventory/movements/:id (codex-1) */
export function getMovement(id: string): Promise<LedgerEntryDetail> {
  return fakeGetMovement(id);
}

/** GET /api/v1/trade/inventory/receipts/:id | /api/v1/trade/inventory/deliveries/:id (codex-1; ETag = version) */
export function getMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
): Promise<MovementSource> {
  return fakeGetMovementSource(kind, id);
}

/** POST /api/v1/trade/inventory/receipts/:id/reverse | /api/v1/trade/inventory/deliveries/:id/reverse (headers If-Match, x-idempotency-key); returns the raw records, re-fetch read projections for display */
export function reverseMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
  version: number,
  body: ReverseMovementInput,
  key: string,
): Promise<MovementSourceRecord> {
  return fakeReverseMovementSource(kind, id, version, body, key);
}

/** GET /api/v1/trade/inventory/serials */
export function listSerials(q: SerialQuery): Promise<Page<SerialUnit>> {
  return fakeListSerials(q);
}

/** GET /api/v1/trade/inventory/serials/:id */
export function getSerial(id: string): Promise<SerialDetail> {
  return fakeGetSerial(id);
}

/** GET /api/v1/trade/inventory/decisions */
export function listDecisions(q: DecisionQuery): Promise<Page<InventoryDecision>> {
  return fakeListDecisions(q);
}

/** GET /api/v1/trade/inventory/decisions/:id */
export function getDecision(id: string): Promise<InventoryDecision> {
  return fakeGetDecision(id);
}
