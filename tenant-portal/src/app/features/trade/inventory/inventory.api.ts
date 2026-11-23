import type { CoreQuery } from '../../../core/api/core-http';
import {
  assertIdempotencyKey,
  ifMatch,
  scopeFor,
  type TradeContext,
} from '../shared/trade-api';
import { tradeHttp } from '../shared/trade-http';
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
  InventoryTracking,
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

function pickQuery(entries: Record<string, string | number | boolean | undefined>): CoreQuery | undefined {
  const query: CoreQuery = {};
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) continue;
      query[k] = trimmed;
      continue;
    }
    query[k] = v;
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

function sourcePath(kind: 'RECEIPT' | 'DELIVERY', id: string): string {
  const segment = kind === 'RECEIPT' ? 'receipts' : 'deliveries';
  return `/inventory/${segment}/${encodeURIComponent(id)}`;
}

/** GET /api/tenant/trade/v1/inventory/balances (BRANCH scope) */
export function listBalances(q: BalanceQuery, ctx: TradeContext = {}): Promise<Page<StockBalanceRow>> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<Page<StockBalanceRow>>(
    '/inventory/balances',
    pickQuery({
      nodeId: q.nodeId,
      itemId: q.itemId,
      itemCompanyProfileId: q.itemCompanyProfileId,
      lotKey: q.lotKey,
      search: q.search,
      onlyInStock: q.onlyInStock,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/availability (BRANCH scope) */
export function getAvailability(q: AvailabilityQuery, ctx: TradeContext = {}): Promise<Availability> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<Availability>(
    '/inventory/availability',
    pickQuery({
      nodeId: q.nodeId,
      itemId: q.itemId,
      uomId: q.uomId,
      lotKey: q.lotKey,
      serialKey: q.serialKey,
    }),
    { scope },
  );
}

/** POST /api/tenant/trade/v1/inventory/opening-balances (BRANCH scope, x-idempotency-key) */
export async function recordOpeningBalance(
  body: OpeningBalanceInput,
  key: string,
  ctx: TradeContext = {},
): Promise<OpeningBalanceResult> {
  const scope = scopeFor(ctx, 'BRANCH');
  const idempotencyKey = assertIdempotencyKey(key);
  let tracking: InventoryTracking | undefined;
  if (body.tracking !== undefined) {
    tracking = {
      ...(body.tracking.lotKey !== undefined ? { lotKey: body.tracking.lotKey } : {}),
      ...(body.tracking.expiryDate !== undefined ? { expiryDate: body.tracking.expiryDate } : {}),
      ...(body.tracking.serialKeys !== undefined ? { serialKeys: [...body.tracking.serialKeys] } : {}),
    };
  }
  const payload: OpeningBalanceInput = {
    nodeId: body.nodeId,
    itemId: body.itemId,
    uomId: body.uomId,
    quantity: body.quantity,
    itemProfileVersion: body.itemProfileVersion,
    businessEffectiveAt: body.businessEffectiveAt,
    operationKey: body.operationKey,
    ...(tracking !== undefined ? { tracking } : {}),
  };
  const { data } = await tradeHttp().write<OpeningBalanceResult>(
    'POST',
    '/inventory/opening-balances',
    payload,
    { key: idempotencyKey, scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/inventory/nodes?status= (BRANCH scope, bare array) */
export function listNodes(q: NodeListQuery = {}, ctx: TradeContext = {}): Promise<FulfillmentNode[]> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<FulfillmentNode[]>(
    '/inventory/nodes',
    pickQuery({ status: q.status }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/company-nodes (COMPANY scope) */
export function listCompanyNodes(q: CompanyNodeQuery, ctx: TradeContext = {}): Promise<Page<CompanyNode>> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<Page<CompanyNode>>(
    '/inventory/company-nodes',
    pickQuery({
      status: q.status,
      nodeType: q.nodeType,
      branchId: q.branchId,
      search: q.search,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/company-nodes/:id (COMPANY scope) */
export function getCompanyNode(id: string, ctx: TradeContext = {}): Promise<CompanyNode> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<CompanyNode>(
    `/inventory/company-nodes/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/nodes/:id (BRANCH scope) */
export function getNode(id: string, ctx: TradeContext = {}): Promise<FulfillmentNode> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<FulfillmentNode>(
    `/inventory/nodes/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
}

/** POST /api/tenant/trade/v1/inventory/nodes (COMPANY scope, x-idempotency-key) */
export async function createNode(
  body: CreateNodeBody,
  key: string,
  ctx: TradeContext = {},
): Promise<FulfillmentNode> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const payload: CreateNodeBody = {
    code: body.code,
    name: body.name,
    nodeType: body.nodeType,
    timezone: body.timezone,
    branchIds: [...body.branchIds],
  };
  const { data } = await tradeHttp().write<FulfillmentNode>(
    'POST',
    '/inventory/nodes',
    payload,
    { key: idempotencyKey, scope },
  );
  return data;
}

/** PATCH /api/tenant/trade/v1/inventory/nodes/:id (COMPANY scope, If-Match, x-idempotency-key) */
export async function updateNode(
  id: string,
  version: number,
  patch: UpdateNodePatch,
  key: string,
  ctx: TradeContext = {},
): Promise<FulfillmentNode> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const payload: UpdateNodePatch = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
    ...(patch.branchIds !== undefined ? { branchIds: [...patch.branchIds] } : {}),
  };
  const { data } = await tradeHttp().write<FulfillmentNode>(
    'PATCH',
    `/inventory/nodes/${encodeURIComponent(id)}`,
    payload,
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/inventory/periods (COMPANY scope) */
export function listPeriods(q: PeriodQuery, ctx: TradeContext = {}): Promise<Page<InventoryPeriod>> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<Page<InventoryPeriod>>(
    '/inventory/periods',
    pickQuery({
      status: q.status,
      effectiveAt: q.effectiveAt,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** POST /api/tenant/trade/v1/inventory/periods (COMPANY scope, x-idempotency-key) */
export async function createPeriod(
  body: CreatePeriodBody,
  key: string,
  ctx: TradeContext = {},
): Promise<InventoryPeriod> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const payload: CreatePeriodBody = {
    code: body.code,
    startsOn: body.startsOn,
    endsOn: body.endsOn,
    maxBackdateDays: body.maxBackdateDays,
  };
  const { data } = await tradeHttp().write<InventoryPeriod>(
    'POST',
    '/inventory/periods',
    payload,
    { key: idempotencyKey, scope },
  );
  return data;
}

/** POST /api/tenant/trade/v1/inventory/periods/:id/close (COMPANY scope, If-Match, x-idempotency-key) */
export async function closePeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
  ctx: TradeContext = {},
): Promise<InventoryPeriod> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const { data } = await tradeHttp().write<InventoryPeriod>(
    'POST',
    `/inventory/periods/${encodeURIComponent(id)}/close`,
    { reasonCode },
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** POST /api/tenant/trade/v1/inventory/periods/:id/reopen (COMPANY scope, If-Match, x-idempotency-key) */
export async function reopenPeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
  ctx: TradeContext = {},
): Promise<InventoryPeriod> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const { data } = await tradeHttp().write<InventoryPeriod>(
    'POST',
    `/inventory/periods/${encodeURIComponent(id)}/reopen`,
    { reasonCode },
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/inventory/uom-conversions (COMPANY scope) */
export function listUomConversions(
  q: UomConversionQuery,
  ctx: TradeContext = {},
): Promise<Page<UomConversionRevision>> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<Page<UomConversionRevision>>(
    '/inventory/uom-conversions',
    pickQuery({
      itemCompanyProfileId: q.itemCompanyProfileId,
      fromUomId: q.fromUomId,
      toUomId: q.toUomId,
      status: q.status,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** POST /api/tenant/trade/v1/inventory/uom-conversions (COMPANY scope, x-idempotency-key) */
export async function createUomConversion(
  body: CreateUomConversionBody,
  key: string,
  ctx: TradeContext = {},
): Promise<UomConversionRevision> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const payload: CreateUomConversionBody = {
    itemCompanyProfileId: body.itemCompanyProfileId,
    fromUomId: body.fromUomId,
    toUomId: body.toUomId,
    factorNumerator: body.factorNumerator,
    factorDenominator: body.factorDenominator,
    effectiveFrom: body.effectiveFrom,
  };
  const { data } = await tradeHttp().write<UomConversionRevision>(
    'POST',
    '/inventory/uom-conversions',
    payload,
    { key: idempotencyKey, scope },
  );
  return data;
}

/** POST /api/tenant/trade/v1/inventory/uom-conversions/:id/publish (COMPANY scope, If-Match, x-idempotency-key) */
export async function publishUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
  ctx: TradeContext = {},
): Promise<UomConversionRevision> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const { data } = await tradeHttp().write<UomConversionRevision>(
    'POST',
    `/inventory/uom-conversions/${encodeURIComponent(id)}/publish`,
    { reasonCode },
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** POST /api/tenant/trade/v1/inventory/uom-conversions/:id/retire (COMPANY scope, If-Match, x-idempotency-key) */
export async function retireUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
  ctx: TradeContext = {},
): Promise<UomConversionRevision> {
  const scope = scopeFor(ctx, 'COMPANY');
  const idempotencyKey = assertIdempotencyKey(key);
  const { data } = await tradeHttp().write<UomConversionRevision>(
    'POST',
    `/inventory/uom-conversions/${encodeURIComponent(id)}/retire`,
    { reasonCode },
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/inventory/movements (BRANCH scope) */
export function listMovements(q: MovementQuery, ctx: TradeContext = {}): Promise<Page<LedgerEntry>> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<Page<LedgerEntry>>(
    '/inventory/movements',
    pickQuery({
      nodeId: q.nodeId,
      itemId: q.itemId,
      itemCompanyProfileId: q.itemCompanyProfileId,
      operationKey: q.operationKey,
      movementType: q.movementType,
      group: q.group,
      from: q.from,
      to: q.to,
      sourceType: q.sourceType,
      sourceId: q.sourceId,
      search: q.search,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/movements/:id (BRANCH scope) */
export function getMovement(id: string, ctx: TradeContext = {}): Promise<LedgerEntryDetail> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<LedgerEntryDetail>(
    `/inventory/movements/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/receipts/:id | /deliveries/:id (BRANCH scope) */
export function getMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
  ctx: TradeContext = {},
): Promise<MovementSource> {
  const scope = scopeFor(ctx, 'BRANCH');
  return tradeHttp().read<MovementSource>(sourcePath(kind, id), undefined, { scope });
}

/** POST /api/tenant/trade/v1/inventory/receipts/:id/reverse | /deliveries/:id/reverse (BRANCH scope, If-Match, x-idempotency-key) */
export async function reverseMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
  version: number,
  body: ReverseMovementInput,
  key: string,
  ctx: TradeContext = {},
): Promise<MovementSourceRecord> {
  const scope = scopeFor(ctx, 'BRANCH');
  const idempotencyKey = assertIdempotencyKey(key);
  const payload: ReverseMovementInput = {
    reasonCode: body.reasonCode,
    businessEffectiveAt: body.businessEffectiveAt,
    ...(body.lines !== undefined
      ? {
          lines: body.lines.map((line) => ({
            lineId: line.lineId,
            quantity: line.quantity,
            ...(line.serialKeys !== undefined ? { serialKeys: [...line.serialKeys] } : {}),
          })),
        }
      : {}),
  };
  const { data } = await tradeHttp().write<MovementSourceRecord>(
    'POST',
    `${sourcePath(kind, id)}/reverse`,
    payload,
    { key: idempotencyKey, ifMatch: ifMatch(version), scope },
  );
  return data;
}

/** GET /api/tenant/trade/v1/inventory/serials (COMPANY scope) */
export function listSerials(q: SerialQuery, ctx: TradeContext = {}): Promise<Page<SerialUnit>> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<Page<SerialUnit>>(
    '/inventory/serials',
    pickQuery({
      itemId: q.itemId,
      itemCompanyProfileId: q.itemCompanyProfileId,
      serialKey: q.serialKey,
      state: q.state,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/serials/:id (COMPANY scope) */
export function getSerial(id: string, ctx: TradeContext = {}): Promise<SerialDetail> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<SerialDetail>(
    `/inventory/serials/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/decisions (COMPANY scope) */
export function listDecisions(q: DecisionQuery, ctx: TradeContext = {}): Promise<Page<InventoryDecision>> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<Page<InventoryDecision>>(
    '/inventory/decisions',
    pickQuery({
      aggregateId: q.aggregateId,
      policyKind: q.policyKind,
      page: q.page,
      limit: q.limit,
    }),
    { scope },
  );
}

/** GET /api/tenant/trade/v1/inventory/decisions/:id (COMPANY scope) */
export function getDecision(id: string, ctx: TradeContext = {}): Promise<InventoryDecision> {
  const scope = scopeFor(ctx, 'COMPANY');
  return tradeHttp().read<InventoryDecision>(
    `/inventory/decisions/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
}
