import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { TRADE_FAKE_DB } from '../shared/trade-foundation.fake';
import type { FakeItem, ItemCompanyProfile, Page, Uom } from '../shared/trade-foundation.model';
import {
  CODE_PATTERN,
  FACTOR_PATTERN,
  INVENTORY_LIMITS,
  POSITIVE_DECIMAL_PATTERN,
  UUID_V7_PATTERN,
  type Availability,
  type AvailabilityQuery,
  type BalanceQuery,
  type CompanyNode,
  type CompanyNodeQuery,
  type CreateNodeBody,
  type CreatePeriodBody,
  type CreateUomConversionBody,
  type DecisionQuery,
  type FulfillmentNode,
  type InventoryDecision,
  type InventoryPeriod,
  type InventoryReasonKind,
  type InventoryTracking,
  type LedgerEntry,
  type LedgerEntryDetail,
  type LedgerEntryRecord,
  type MovementQuery,
  type MovementSource,
  type MovementSourceRecord,
  type NodeListQuery,
  type MovementType,
  type NodeBranch,
  type NodeStatus,
  type NodeType,
  type OpeningBalanceInput,
  type OpeningBalanceResult,
  type PeriodQuery,
  type ReverseMovementInput,
  type SerialDetail,
  type SerialEventType,
  type SerialLifecycleSourceType,
  type SerialLifecycleEntry,
  type SerialQuery,
  type SerialState,
  type SerialUnit,
  type SourceLine,
  type SourceLineRecord,
  type StockBalanceRecord,
  type StockBalanceRow,
  type UomConversionQuery,
  type UomConversionRevision,
  type UpdateNodePatch,
} from './inventory.model';
import { movementGroup } from './inventory.service';

const COMPANY_ID = 'c1';
const CURRENT_USER_ID = 'usr-1';
const TIMEZONE_DEFAULT = 'Africa/Cairo';
const SCALE = 100_000_000n;
const DAY_MS = 86_400_000;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NODE_TYPES: ReadonlySet<NodeType> = new Set(['WAREHOUSE', 'STORE', 'VIRTUAL']);
const NODE_STATUSES: ReadonlySet<NodeStatus> = new Set(['ACTIVE', 'INACTIVE']);

let pendingFailure: ApiError | null = null;

/** Configures the next inventory fake API call to reject with the provided ApiError. */
export function FAKE_INVENTORY_FAIL_NEXT(error: ApiError | null): void {
  pendingFailure = error;
}

async function enterCall(): Promise<void> {
  await fakeDelay();
  if (pendingFailure) {
    const err = pendingFailure;
    pendingFailure = null;
    throw err;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Fixed-point decimal helpers (BigInt, scale 10^8)
// ---------------------------------------------------------------------------

function toMicros(raw: string): bigint {
  const trimmed = raw.trim();
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return 0n;
  const neg = match[1] === '-';
  const intPart = BigInt(match[2]);
  const fracRaw = (match[3] ?? '').slice(0, 8).padEnd(8, '0');
  const abs = intPart * SCALE + BigInt(fracRaw);
  return neg ? -abs : abs;
}

function fromMicros(value: bigint): string {
  if (value === 0n) return '0';
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const intPart = abs / SCALE;
  const fracPart = (abs % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  const text = fracPart ? `${intPart}.${fracPart}` : intPart.toString();
  return neg ? `-${text}` : text;
}

/** numeric(24,8)::text as PostgreSQL prints it on read projections: always eight decimals. */
function dec8(value: bigint): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const text = `${abs / SCALE}.${(abs % SCALE).toString().padStart(8, '0')}`;
  return neg ? `-${text}` : text;
}

function text8(raw: string): string;
function text8(raw: string | null): string | null;
function text8(raw: string | null): string | null {
  return raw === null ? null : dec8(toMicros(raw));
}

function multiplyMicros(qtyMicros: bigint, numStr: string, denStr: string): bigint | null {
  const num = BigInt(numStr);
  const den = BigInt(denStr);
  const prod = qtyMicros * num;
  if (prod % den !== 0n) return null;
  return prod / den;
}

// ---------------------------------------------------------------------------
// Idempotency store
// ---------------------------------------------------------------------------

const idempotencyStore = new Map<string, { fingerprint: string; result: unknown }>();

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}

function replayIdempotent<T>(op: string, key: string, payload: unknown): T | null {
  const cleanKey = key.trim();
  if (!cleanKey) return null;
  const cacheKey = `${op}:${cleanKey}`;
  const entry = idempotencyStore.get(cacheKey);
  if (!entry) return null;
  const fp = stableJson(payload);
  if (entry.fingerprint !== fp) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(entry.result as T);
}

function saveIdempotent(op: string, key: string, payload: unknown, result: unknown): void {
  const cleanKey = key.trim();
  if (!cleanKey) return;
  idempotencyStore.set(`${op}:${cleanKey}`, {
    fingerprint: stableJson(payload),
    result: clone(result),
  });
}

// ---------------------------------------------------------------------------
// Scope & foundation lookup helpers
// ---------------------------------------------------------------------------

function currentBranchId(): string {
  const defaultBranch = FAKE_COMPANIES[0]?.branches[0]?.id ?? 'b1';
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('scope') : null) ??
      (typeof localStorage !== 'undefined' ? localStorage.getItem('scope') : null);
    if (!raw) return defaultBranch;
    const parsed = JSON.parse(raw) as {
      companyId?: string;
      branchByCompany?: Record<string, string>;
    };
    const companyId = parsed.companyId ?? COMPANY_ID;
    const branchId = parsed.branchByCompany?.[companyId];
    return branchId || defaultBranch;
  } catch {
    return defaultBranch;
  }
}

function companyBranchIds(companyId: string): Set<string> {
  const comp = FAKE_COMPANIES.find((c) => c.id === companyId);
  return new Set((comp?.branches ?? []).map((b) => b.id));
}

function findItemAndProfile(
  itemId: string,
): { item: FakeItem; profile: ItemCompanyProfile | null } | null {
  const item = TRADE_FAKE_DB.items.find((i) => i.id === itemId && i.deletedAt === null);
  if (!item) return null;
  const profile =
    TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === item.id && p.companyId === COMPANY_ID) ??
    TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === item.id) ??
    null;
  return { item, profile };
}

function findUom(uomId: string): Uom | undefined {
  return TRADE_FAKE_DB.uoms.find((u) => u.id === uomId);
}

interface SeedItemChoice {
  item: FakeItem;
  profile: ItemCompanyProfile;
  baseUom: Uom;
}

function pickSeedItem(
  preferredId: string,
  mode: 'NONE' | 'LOT' | 'SERIAL',
  excludeIds: ReadonlySet<string>,
): SeedItemChoice {
  const findChoice = (item: FakeItem | undefined): SeedItemChoice | null => {
    if (!item || item.deletedAt !== null || item.itemKind !== 'PRODUCT') return null;
    const profile = TRADE_FAKE_DB.companyProfiles.find(
      (p) => p.itemId === item.id && p.companyId === COMPANY_ID && p.trackInventory,
    );
    if (!profile) return null;
    const baseUom = findUom(item.baseUomId) ?? TRADE_FAKE_DB.uoms[0];
    if (!baseUom) return null;
    return { item, profile, baseUom };
  };

  const preferred = findChoice(TRADE_FAKE_DB.items.find((i) => i.id === preferredId));
  if (preferred && preferred.profile.trackingMode === mode) {
    return preferred;
  }

  for (const item of TRADE_FAKE_DB.items) {
    if (excludeIds.has(item.id)) continue;
    const choice = findChoice(item);
    if (choice && choice.profile.trackingMode === mode) {
      return choice;
    }
  }

  for (const item of TRADE_FAKE_DB.items) {
    if (excludeIds.has(item.id)) continue;
    const choice = findChoice(item);
    if (choice) return choice;
  }

  const fallbackItem = TRADE_FAKE_DB.items[0];
  const fallbackProfile =
    TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === fallbackItem.id) ??
    TRADE_FAKE_DB.companyProfiles[0];
  const fallbackUom = findUom(fallbackItem.baseUomId) ?? TRADE_FAKE_DB.uoms[0];
  return { item: fallbackItem, profile: fallbackProfile, baseUom: fallbackUom };
}

// ---------------------------------------------------------------------------
// Seeded state
// ---------------------------------------------------------------------------

const usedSeedIds = new Set<string>();
const seedNone = pickSeedItem('item-50', 'NONE', usedSeedIds);
usedSeedIds.add(seedNone.item.id);
const seedLot = pickSeedItem('item-17', 'LOT', usedSeedIds);
usedSeedIds.add(seedLot.item.id);
const seedSerial = pickSeedItem('item-01', 'SERIAL', usedSeedIds);
usedSeedIds.add(seedSerial.item.id);

const uomPcs = findUom('uom-pcs') ?? seedNone.baseUom;
const uomBox = findUom('uom-box') ?? uomPcs;
const uomCtn = findUom('uom-ctn') ?? uomPcs;

const nodes: FulfillmentNode[] = [
  {
    id: 'node-wh-main',
    companyId: COMPANY_ID,
    code: 'WH-MAIN',
    name: 'Main warehouse',
    nodeType: 'WAREHOUSE',
    status: 'ACTIVE',
    timezone: TIMEZONE_DEFAULT,
    version: 1,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
    branches: [
      {
        id: 'nb-wh-b1',
        fulfillmentNodeId: 'node-wh-main',
        companyId: COMPANY_ID,
        branchId: 'b1',
        isActive: true,
        version: 1,
      },
      {
        id: 'nb-wh-b2',
        fulfillmentNodeId: 'node-wh-main',
        companyId: COMPANY_ID,
        branchId: 'b2',
        isActive: true,
        version: 1,
      },
    ],
  },
  {
    id: 'node-st-dt',
    companyId: COMPANY_ID,
    code: 'ST-DT',
    name: 'Downtown store',
    nodeType: 'STORE',
    status: 'ACTIVE',
    timezone: TIMEZONE_DEFAULT,
    version: 1,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
    branches: [
      {
        id: 'nb-st-b1',
        fulfillmentNodeId: 'node-st-dt',
        companyId: COMPANY_ID,
        branchId: 'b1',
        isActive: true,
        version: 1,
      },
    ],
  },
  {
    id: 'node-vr-transit',
    companyId: COMPANY_ID,
    code: 'VR-TRANSIT',
    name: 'In transit',
    nodeType: 'VIRTUAL',
    status: 'INACTIVE',
    timezone: TIMEZONE_DEFAULT,
    version: 2,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
    branches: [
      {
        id: 'nb-vr-b1',
        fulfillmentNodeId: 'node-vr-transit',
        companyId: COMPANY_ID,
        branchId: 'b1',
        isActive: true,
        version: 1,
      },
    ],
  },
];

const periods: InventoryPeriod[] = [
  {
    id: 'per-2026-09',
    companyId: COMPANY_ID,
    code: 'P-2026-09',
    startsOn: '2026-09-01',
    endsOn: '2026-09-30',
    status: 'CLOSED',
    maxBackdateDays: 5,
    closedAt: '2026-10-02T09:00:00.000Z',
    closedBy: CURRENT_USER_ID,
    closeReason: 'MONTH_END_CLOSE',
    version: 2,
    createdAt: '2026-08-28T08:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    createdBy: CURRENT_USER_ID,
  },
  {
    id: 'per-2026-10',
    companyId: COMPANY_ID,
    code: 'P-2026-10',
    startsOn: '2026-10-01',
    endsOn: '2026-10-31',
    status: 'CLOSED',
    maxBackdateDays: 5,
    closedAt: '2026-11-02T09:00:00.000Z',
    closedBy: CURRENT_USER_ID,
    closeReason: 'MONTH_END_CLOSE',
    version: 2,
    createdAt: '2026-09-28T08:00:00.000Z',
    updatedAt: '2026-11-02T09:00:00.000Z',
    createdBy: CURRENT_USER_ID,
  },
  {
    id: 'per-2026-11',
    companyId: COMPANY_ID,
    code: 'P-2026-11',
    startsOn: '2026-11-01',
    endsOn: '2026-11-30',
    status: 'OPEN',
    maxBackdateDays: 5,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    version: 1,
    createdAt: '2026-10-28T08:00:00.000Z',
    updatedAt: '2026-10-28T08:00:00.000Z',
    createdBy: CURRENT_USER_ID,
  },
];

const uomConversions: UomConversionRevision[] = [
  {
    id: 'uomc-1',
    companyId: COMPANY_ID,
    itemCompanyProfileId: seedNone.profile.id,
    fromUomId: uomBox.id,
    toUomId: seedNone.baseUom.id,
    revisionNumber: 1,
    factorNumerator: '10',
    factorDenominator: '1',
    status: 'RETIRED',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    contentHash: 'hash-uomc-1-10-1',
    publishedAt: '2026-01-01T08:00:00.000Z',
    publishedBy: CURRENT_USER_ID,
    retiredAt: '2026-10-01T08:00:00.000Z',
    retiredBy: CURRENT_USER_ID,
    version: 3,
    createdAt: '2025-12-25T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    itemId: seedNone.item.id,
    itemCode: seedNone.item.canonicalCode,
    itemNames: { ...seedNone.item.localizedNames },
    fromUomCode: uomBox.code,
    toUomCode: seedNone.baseUom.code,
    publishReasonCode: 'NEW_PACKAGING',
    retireReasonCode: 'REPLACED',
  },
  {
    id: 'uomc-2',
    companyId: COMPANY_ID,
    itemCompanyProfileId: seedNone.profile.id,
    fromUomId: uomBox.id,
    toUomId: seedNone.baseUom.id,
    revisionNumber: 2,
    factorNumerator: '12',
    factorDenominator: '1',
    status: 'PUBLISHED',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    contentHash: 'hash-uomc-2-12-1',
    publishedAt: '2026-10-01T08:00:00.000Z',
    publishedBy: CURRENT_USER_ID,
    retiredAt: null,
    retiredBy: null,
    version: 2,
    createdAt: '2026-09-28T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    itemId: seedNone.item.id,
    itemCode: seedNone.item.canonicalCode,
    itemNames: { ...seedNone.item.localizedNames },
    fromUomCode: uomBox.code,
    toUomCode: seedNone.baseUom.code,
    publishReasonCode: 'NEW_PACKAGING',
    retireReasonCode: null,
  },
  {
    id: 'uomc-3',
    companyId: COMPANY_ID,
    itemCompanyProfileId: seedLot.profile.id,
    fromUomId: uomCtn.id,
    toUomId: seedLot.baseUom.id,
    revisionNumber: 1,
    factorNumerator: '2500',
    factorDenominator: '1',
    status: 'DRAFT',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    contentHash: 'hash-uomc-3-2500-1',
    publishedAt: null,
    publishedBy: null,
    retiredAt: null,
    retiredBy: null,
    version: 1,
    createdAt: '2026-11-15T08:00:00.000Z',
    updatedAt: '2026-11-15T08:00:00.000Z',
    itemId: seedLot.item.id,
    itemCode: seedLot.item.canonicalCode,
    itemNames: { ...seedLot.item.localizedNames },
    fromUomCode: uomCtn.code,
    toUomCode: seedLot.baseUom.code,
    publishReasonCode: null,
    retireReasonCode: null,
  },
];

// ---------------------------------------------------------------------------
// Decisions (8 across all 3 policy kinds)
// ---------------------------------------------------------------------------

const decisions: InventoryDecision[] = [
  {
    id: '019350f3-8637-7bf5-b64d-4983a36eb1ce',
    decisionType: 'INVENTORY_TOLERANCE',
    aggregateType: 'INVENTORY_RECEIPT',
    aggregateId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_OVER_RECEIPT', version: 2 }],
    matchedRules: ['OVER_RECEIPT_WITHIN_5_PCT'],
    result: { outcome: 'ALLOW', selectedValue: null, explanationCode: 'WITHIN_TOLERANCE' },
    explanation: 'Received quantity is within the configured 5% over-receipt tolerance.',
    evaluatedAt: '2026-11-02T10:14:55.000Z',
    correlationId: 'corr-rcpt-01',
  },
  {
    id: '01935068-2acd-7971-bfa0-6e350d8e1750',
    decisionType: 'INVENTORY_RESERVATION',
    aggregateType: 'INVENTORY_RESERVATION',
    aggregateId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_RESERVATION', version: 3 }],
    matchedRules: ['ALLOW_PARTIAL_RESERVATION'],
    result: { outcome: 'SELECT', selectedValue: 'PARTIAL', explanationCode: 'PARTIAL_STOCK_AVAILABLE' },
    explanation: 'Available balance covered part of the order; partial reservation selected.',
    evaluatedAt: '2026-11-05T11:29:50.000Z',
    correlationId: 'corr-dlv-01',
  },
  {
    id: '01935073-f404-7c2b-980a-6effc6a0d3a0',
    decisionType: 'INVENTORY_RESERVATION',
    aggregateType: 'INVENTORY_RESERVATION',
    aggregateId: '0193505f-016f-7112-be67-b9535de3afd4',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_RESERVATION', version: 3 }],
    matchedRules: ['BACKORDER_ON_SHORTAGE'],
    result: { outcome: 'SELECT', selectedValue: 'BACKORDER', explanationCode: 'INSUFFICIENT_AVAILABLE' },
    explanation: 'Insufficient available stock in Downtown store; remaining units placed on backorder.',
    evaluatedAt: '2026-11-08T13:19:45.000Z',
    correlationId: 'corr-dlv-03',
  },
  {
    id: '0193508d-9b1a-7397-9d3b-caef152790d2',
    decisionType: 'INVENTORY_NEGATIVE',
    aggregateType: 'INVENTORY_DELIVERY',
    aggregateId: '0193502e-ac85-7ecc-91b0-a02de523ed13',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_NEGATIVE', version: 1 }],
    matchedRules: ['STORE_ALLOW_NEGATIVE_BELOW_10'],
    result: { outcome: 'ALLOW', selectedValue: null, explanationCode: 'NEGATIVE_ALLOWED_FOR_STORE' },
    explanation: 'Store negative balance policy allowed posting 6 units below zero.',
    evaluatedAt: '2026-11-11T16:04:50.000Z',
    correlationId: 'corr-dlv-04',
  },
  {
    id: '01935045-cc95-7f08-9d3d-c0feb44d34ff',
    decisionType: 'INVENTORY_TOLERANCE',
    aggregateType: 'INVENTORY_RECEIPT_LINE',
    aggregateId: '01935041-34a5-7204-9f68-3c1d013c7d85',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_OVER_RECEIPT', version: 2 }],
    matchedRules: ['EXACT_SERIAL_COUNT_REQUIRED'],
    result: { outcome: 'ALLOW', selectedValue: null, explanationCode: 'SERIAL_COUNT_MATCHED' },
    explanation: 'All 4 serialized units matched the purchase order line tolerance.',
    evaluatedAt: '2026-11-06T13:59:40.000Z',
    correlationId: 'corr-rcpt-05',
  },
  {
    id: '01935093-0222-7e50-b356-f1b762526b41',
    decisionType: 'INVENTORY_NEGATIVE',
    aggregateType: 'INVENTORY_DELIVERY_LINE',
    aggregateId: '0193506c-85d8-7f46-986d-0c3b319f2408',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_NEGATIVE', version: 1 }],
    matchedRules: ['DENY_NEGATIVE_SERIALIZED_ITEM'],
    result: { outcome: 'REJECT', selectedValue: null, explanationCode: 'SERIALIZED_NEGATIVE_FORBIDDEN' },
    explanation: 'Serialized products cannot enter a negative stock balance.',
    evaluatedAt: '2026-11-14T15:28:10.000Z',
    correlationId: 'corr-dlv-05-check',
  },
  {
    id: '01935013-98eb-7c01-ae57-32b0774c0178',
    decisionType: 'INVENTORY_RESERVATION',
    aggregateType: 'INVENTORY_RESERVATION',
    aggregateId: '0193501a-1061-7653-bdf2-49bb3d8477ee',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_RESERVATION', version: 3 }],
    matchedRules: ['RESERVE_FEFO_LOT'],
    result: { outcome: 'ALLOW', selectedValue: null, explanationCode: 'FULL_RESERVATION_OK' },
    explanation: 'Full quantity reserved from earliest expiring lot LOT-2026-A.',
    evaluatedAt: '2026-11-17T09:44:50.000Z',
    correlationId: 'corr-dlv-07',
  },
  {
    id: '0193503d-dbd7-7629-9195-a66a6428ac2d',
    decisionType: 'INVENTORY_TOLERANCE',
    aggregateType: 'INVENTORY_RECEIPT',
    aggregateId: '01935066-b7af-753c-9d93-e43c086584bf',
    companyId: COMPANY_ID,
    branchId: 'b1',
    policyVersions: [{ policyKind: 'INVENTORY_OVER_RECEIPT', version: 2 }],
    matchedRules: ['REJECT_OVER_15_PCT_EXCESS'],
    result: { outcome: 'REJECT', selectedValue: null, explanationCode: 'OVER_RECEIPT_LIMIT_EXCEEDED' },
    explanation: 'Receipt line exceeded the 15% maximum over-receipt tolerance and was blocked.',
    evaluatedAt: '2026-11-18T11:10:00.000Z',
    correlationId: 'corr-rcpt-08-check',
  },
];

// ---------------------------------------------------------------------------
// Movement sources, 30 ledger entries, and 12 serial units
// ---------------------------------------------------------------------------

interface SeedSpec {
  id: string;
  nodeId: string;
  choice: SeedItemChoice;
  uom: Uom;
  qty: string;
  normQty: string;
  convId: string | null;
  movementType: MovementType;
  opKey: string;
  sourceType: 'RECEIPT' | 'RECEIPT_REVERSAL' | 'DELIVERY' | 'DELIVERY_REVERSAL' | null;
  sourceId: string | null;
  sourceLineId: string | null;
  sourceNumber: string | null;
  reversalOfId: string | null;
  decisionId: string | null;
  occurredAt: string;
  tracking: InventoryTracking & { reversalReasonCode?: string };
}

const nodeById = (id: string): FulfillmentNode => nodes.find((n) => n.id === id) ?? nodes[0];

const movementSources: MovementSource[] = [];
const ledgerEntries: LedgerEntry[] = [];

// Delivery id -> reservation id (UUIDv7-shaped, like every fake id).
const DELIVERY_RESERVATION_IDS: Record<string, string> = {
  '01935008-9827-71ac-8815-c0ac81c3e2dd': '019350f8-c4cc-73e7-bb20-3c2c7cc34733',
  '01935092-d5f5-779b-8653-26e8b448aa3f': '019350ff-9e98-761c-aab8-d6f6ee79bf36',
  '0193505f-016f-7112-be67-b9535de3afd4': '019350ea-3e45-7cbd-94d7-5155393528ce',
  '0193502e-ac85-7ecc-91b0-a02de523ed13': '019350ad-45df-7e99-8e6b-a7a4b4abac3b',
  '0193506c-85d8-7f46-986d-0c3b319f2408': '01935046-e079-788c-bff1-00b049694fc9',
  '019350c9-7a46-776c-ab19-898af0e80fd9': '019350e2-4529-73dd-87ff-95be84c73ce7',
  '0193501a-1061-7653-bdf2-49bb3d8477ee': '01935036-c6c2-7fcf-b79e-bd42cf92c746',
  '01935006-3b84-7df3-9793-fb80ffa40453': '019350c5-2aa8-74bc-aaa8-824dec113410',
  '01935036-dfbc-7b27-aa54-e720bc27c202': '01935099-f5b1-7d50-bf09-b3aea944ee28',
  '01935089-d5fc-7290-b015-22048bde7e5c': '0193501b-30b6-769c-9f7c-0b717b1f066e',
  '0193508f-eafb-7333-ae55-230e1cd4764a': '019350ab-67a6-7302-b171-f6e8756a7b17',
  '019350c6-b3be-7c06-b7a9-60519459f141': '019350a2-ee01-7637-9c15-a9f4ec67e5b3',
  '019350a2-887e-76d2-a8a2-aa97db1c9124': '0193500a-b984-7d25-ac29-491ddc24b5c7',
  '01935011-ceb9-7083-bcf8-f0b9fb647bde': '01935079-188c-7434-b4a5-4d397563764f',
  '01935097-18d0-7e99-a757-eee9aa5bc4cd': '019350ca-de23-7d07-94c3-2deca21ce70d',
  '01935031-a19b-7d6e-83d1-64a33fca68cf': '01935022-b6b6-7144-9aeb-732b02298990',
  '01935019-0f4b-7d8b-b165-7ceafff9abc6': '019350cf-695a-7637-a57d-d96c9fe3f869',
  '01935008-f2e1-7382-a8fd-623ab4885735': '01935072-d010-793e-a406-04c12f54c0fe',
  '01935032-4e8a-7e64-bd7e-41d67b42dac3': '019350e2-595c-7431-9bde-7ce30be8efda',
};

function registerSourceLine(params: {
  sourceId: string;
  kind: 'RECEIPT' | 'DELIVERY';
  documentNumber: string;
  nodeId: string;
  opKey: string;
  occurredAt: string;
  lineId: string;
  docLineId: string;
  choice: SeedItemChoice;
  uom: Uom;
  qty: string;
  normQty: string;
  reversedQty: string;
  normReversedQty: string;
  tracking: InventoryTracking;
  reversedSerialKeys: string[];
  ledgerEntryId: string;
  decisionId: string | null;
  status: MovementSource['status'];
}): void {
  const node = nodeById(params.nodeId);
  const line: SourceLine = {
    id: params.lineId,
    documentLineId: params.docLineId,
    reservationId: params.kind === 'DELIVERY' ? (DELIVERY_RESERVATION_IDS[params.sourceId] ?? fakeId()) : null,
    itemCompanyProfileId: params.choice.profile.id,
    itemId: params.choice.item.id,
    itemCode: params.choice.item.canonicalCode,
    itemNames: { ...params.choice.item.localizedNames },
    uomId: params.uom.id,
    uomCode: params.uom.code,
    quantity: params.qty,
    normalizedUomId: params.choice.baseUom.id,
    normalizedUomCode: params.choice.baseUom.code,
    normalizedQuantity: params.normQty,
    reversedQuantity: params.reversedQty,
    normalizedReversedQuantity: params.normReversedQty,
    descriptionSnapshot: params.choice.item.localizedNames['en'] ?? params.choice.item.canonicalCode,
    tracking: clone(params.tracking),
    reversedSerialKeys: [...params.reversedSerialKeys],
    ledgerEntryId: params.ledgerEntryId,
    policyDecisionReceiptId: params.decisionId,
    version: params.status === 'POSTED' ? 1 : 2,
  };

  const existing = movementSources.find((s) => s.id === params.sourceId);
  if (existing) {
    existing.lines.push(line);
    existing.lineCount = existing.lines.length;
    return;
  }

  movementSources.push({
    id: params.sourceId,
    kind: params.kind,
    status: params.status,
    branchId: 'b1',
    fulfillmentNodeId: node.id,
    nodeCode: node.code,
    nodeName: node.name,
    documentId: `doc-${params.sourceId}`,
    documentNumber: params.documentNumber,
    operationKey: params.opKey,
    businessEffectiveAt: params.occurredAt,
    postedAt: params.occurredAt,
    inventoryPeriodId: 'per-2026-11',
    policyDecisionReceiptId: params.decisionId,
    lineCount: 1,
    version: params.status === 'POSTED' ? 1 : 2,
    createdAt: params.occurredAt,
    createdBy: CURRENT_USER_ID,
    lines: [line],
  });
}

function pushLedgerSpec(spec: SeedSpec): void {
  const node = nodeById(spec.nodeId);
  ledgerEntries.push({
    id: spec.id,
    companyId: COMPANY_ID,
    fulfillmentNodeId: node.id,
    nodeCode: node.code,
    nodeName: node.name,
    itemCompanyProfileId: spec.choice.profile.id,
    itemId: spec.choice.item.id,
    itemCode: spec.choice.item.canonicalCode,
    itemNames: { ...spec.choice.item.localizedNames },
    uomId: spec.uom.id,
    uomCode: spec.uom.code,
    signedQuantity: spec.qty,
    normalizedUomId: spec.choice.baseUom.id,
    normalizedUomCode: spec.choice.baseUom.code,
    normalizedSignedQuantity: spec.normQty,
    uomConversionRevisionId: spec.convId,
    inventoryPeriodId: 'per-2026-11',
    policyDecisionReceiptId: spec.decisionId,
    movementType: spec.movementType,
    operationKey: spec.opKey,
    sourceType: spec.sourceType,
    sourceId: spec.sourceId,
    sourceLineId: spec.sourceLineId,
    sourceNumber: spec.sourceNumber,
    reversalOfId: spec.reversalOfId,
    occurredAt: spec.occurredAt,
    tracking: clone(spec.tracking),
    remainingReversibleQuantity: null,
    createdAt: spec.occurredAt,
    createdBy: CURRENT_USER_ID,
  });
}

// 4 OPENING_BALANCE entries (led-01..led-04)
pushLedgerSpec({
  id: 'led-01',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomPcs,
  qty: '60',
  normQty: '60',
  convId: null,
  movementType: 'OPENING_BALANCE',
  opKey: 'op-open-2026-11-01-wh-none',
  sourceType: null,
  sourceId: null,
  sourceLineId: null,
  sourceNumber: null,
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-01T08:00:00.000Z',
  tracking: {},
});
pushLedgerSpec({
  id: 'led-02',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '100',
  normQty: '100',
  convId: null,
  movementType: 'OPENING_BALANCE',
  opKey: 'op-open-2026-11-01-wh-lot-a',
  sourceType: null,
  sourceId: null,
  sourceLineId: null,
  sourceNumber: null,
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-01T08:30:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});
pushLedgerSpec({
  id: 'led-03',
  nodeId: 'node-wh-main',
  choice: seedSerial,
  uom: uomPcs,
  qty: '3',
  normQty: '3',
  convId: null,
  movementType: 'OPENING_BALANCE',
  opKey: 'op-open-2026-11-01-wh-serial',
  sourceType: null,
  sourceId: null,
  sourceLineId: null,
  sourceNumber: null,
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-01T09:00:00.000Z',
  tracking: { serialKeys: ['SN-A54-0001', 'SN-A54-0002', 'SN-A54-0003'] },
});
pushLedgerSpec({
  id: 'led-04',
  nodeId: 'node-st-dt',
  choice: seedLot,
  uom: uomPcs,
  qty: '40',
  normQty: '40',
  convId: null,
  movementType: 'OPENING_BALANCE',
  opKey: 'op-open-2026-11-01-st-lot-a',
  sourceType: null,
  sourceId: null,
  sourceLineId: null,
  sourceNumber: null,
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-01T09:30:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});

// 10 PURCHASE_RECEIPT entries (led-05..led-14 across rcpt-01..rcpt-08)
pushLedgerSpec({
  id: 'led-05',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomBox,
  qty: '5',
  normQty: '60',
  convId: 'uomc-2',
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0001-l1',
  sourceType: 'RECEIPT',
  sourceId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
  sourceLineId: '01935090-e89e-7c00-b5bb-12726ad67948',
  sourceNumber: 'RCV-2026-0001',
  reversalOfId: null,
  decisionId: '019350f3-8637-7bf5-b64d-4983a36eb1ce',
  occurredAt: '2026-11-02T10:15:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0001',
  nodeId: 'node-wh-main',
  opKey: 'op-rcpt-2026-0001',
  occurredAt: '2026-11-02T10:15:00.000Z',
  lineId: '01935090-e89e-7c00-b5bb-12726ad67948',
  docLineId: 'po-01-l1',
  choice: seedNone,
  uom: uomBox,
  qty: '5',
  normQty: '60',
  reversedQty: '1',
  normReversedQty: '12',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-05',
  decisionId: '019350f3-8637-7bf5-b64d-4983a36eb1ce',
  status: 'PARTIALLY_REVERSED',
});

pushLedgerSpec({
  id: 'led-06',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '50',
  normQty: '50',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0001-l2',
  sourceType: 'RECEIPT',
  sourceId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
  sourceLineId: '01935017-c6d9-70b7-8a27-fd2883dcbfad',
  sourceNumber: 'RCV-2026-0001',
  reversalOfId: null,
  decisionId: '019350f3-8637-7bf5-b64d-4983a36eb1ce',
  occurredAt: '2026-11-02T10:16:00.000Z',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
});
registerSourceLine({
  sourceId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0001',
  nodeId: 'node-wh-main',
  opKey: 'op-rcpt-2026-0001',
  occurredAt: '2026-11-02T10:15:00.000Z',
  lineId: '01935017-c6d9-70b7-8a27-fd2883dcbfad',
  docLineId: 'po-01-l2',
  choice: seedLot,
  uom: uomPcs,
  qty: '50',
  normQty: '50',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-06',
  decisionId: '019350f3-8637-7bf5-b64d-4983a36eb1ce',
  status: 'PARTIALLY_REVERSED',
});

pushLedgerSpec({
  id: 'led-07',
  nodeId: 'node-wh-main',
  choice: seedSerial,
  uom: uomPcs,
  qty: '5',
  normQty: '5',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0002-l1',
  sourceType: 'RECEIPT',
  sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
  sourceLineId: '019350c1-736a-7a5e-8977-eed38e35d6be',
  sourceNumber: 'RCV-2026-0002',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-03T11:00:00.000Z',
  tracking: { serialKeys: ['SN-A54-0004', 'SN-A54-0005', 'SN-A54-0006', 'SN-A54-0007', 'SN-A54-0008'] },
});
registerSourceLine({
  sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0002',
  nodeId: 'node-wh-main',
  opKey: 'op-rcpt-2026-0002',
  occurredAt: '2026-11-03T11:00:00.000Z',
  lineId: '019350c1-736a-7a5e-8977-eed38e35d6be',
  docLineId: 'po-02-l1',
  choice: seedSerial,
  uom: uomPcs,
  qty: '5',
  normQty: '5',
  reversedQty: '1',
  normReversedQty: '1',
  tracking: { serialKeys: ['SN-A54-0004', 'SN-A54-0005', 'SN-A54-0006', 'SN-A54-0007', 'SN-A54-0008'] },
  reversedSerialKeys: ['SN-A54-0008'],
  ledgerEntryId: 'led-07',
  decisionId: null,
  status: 'PARTIALLY_REVERSED',
});

pushLedgerSpec({
  id: 'led-08',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '30',
  normQty: '30',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0003-l1',
  sourceType: 'RECEIPT',
  sourceId: '019350df-fa28-73ed-a8b3-c912adce0398',
  sourceLineId: '019350f8-9db3-790d-b0ab-c5de7769d359',
  sourceNumber: 'RCV-2026-0003',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-04T09:15:00.000Z',
  tracking: { lotKey: 'LOT-2026-C', expiryDate: '2027-12-31' },
});
registerSourceLine({
  sourceId: '019350df-fa28-73ed-a8b3-c912adce0398',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0003',
  nodeId: 'node-wh-main',
  opKey: 'op-rcpt-2026-0003',
  occurredAt: '2026-11-04T09:15:00.000Z',
  lineId: '019350f8-9db3-790d-b0ab-c5de7769d359',
  docLineId: 'po-03-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '30',
  normQty: '30',
  reversedQty: '30',
  normReversedQty: '30',
  tracking: { lotKey: 'LOT-2026-C', expiryDate: '2027-12-31' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-08',
  decisionId: null,
  status: 'REVERSED',
});

pushLedgerSpec({
  id: 'led-09',
  nodeId: 'node-st-dt',
  choice: seedNone,
  uom: uomBox,
  qty: '2',
  normQty: '24',
  convId: 'uomc-2',
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0004-l1',
  sourceType: 'RECEIPT',
  sourceId: '01935083-c5df-7e58-b058-ec7d01e7dd48',
  sourceLineId: '01935074-58ca-79bc-8fc0-9b5e3f0405d4',
  sourceNumber: 'RCV-2026-0004',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-04T15:00:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '01935083-c5df-7e58-b058-ec7d01e7dd48',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0004',
  nodeId: 'node-st-dt',
  opKey: 'op-rcpt-2026-0004',
  occurredAt: '2026-11-04T15:00:00.000Z',
  lineId: '01935074-58ca-79bc-8fc0-9b5e3f0405d4',
  docLineId: 'po-04-l1',
  choice: seedNone,
  uom: uomBox,
  qty: '2',
  normQty: '24',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-09',
  decisionId: null,
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-10',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomPcs,
  qty: '40',
  normQty: '40',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0004-l2',
  sourceType: 'RECEIPT',
  sourceId: '01935083-c5df-7e58-b058-ec7d01e7dd48',
  sourceLineId: '019350b3-3c6b-73cf-8bb7-b2318d7e5439',
  sourceNumber: 'RCV-2026-0004',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-04T15:05:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '01935083-c5df-7e58-b058-ec7d01e7dd48',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0004',
  nodeId: 'node-st-dt',
  opKey: 'op-rcpt-2026-0004',
  occurredAt: '2026-11-04T15:00:00.000Z',
  lineId: '019350b3-3c6b-73cf-8bb7-b2318d7e5439',
  docLineId: 'po-04-l2',
  choice: seedNone,
  uom: uomPcs,
  qty: '40',
  normQty: '40',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-10',
  decisionId: null,
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-11',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '45',
  normQty: '45',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0005-l1',
  sourceType: 'RECEIPT',
  sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
  sourceLineId: '01935041-7115-79ae-afd5-b99ba06a079a',
  sourceNumber: 'RCV-2026-0005',
  reversalOfId: null,
  decisionId: '01935045-cc95-7f08-9d3d-c0feb44d34ff',
  occurredAt: '2026-11-06T13:55:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});
registerSourceLine({
  sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0005',
  nodeId: 'node-st-dt',
  opKey: 'op-rcpt-2026-0005',
  occurredAt: '2026-11-06T14:00:00.000Z',
  lineId: '01935041-7115-79ae-afd5-b99ba06a079a',
  docLineId: 'po-05-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '45',
  normQty: '45',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-11',
  decisionId: '01935045-cc95-7f08-9d3d-c0feb44d34ff',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-12',
  nodeId: 'node-st-dt',
  choice: seedSerial,
  uom: uomPcs,
  qty: '4',
  normQty: '4',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0005-l2',
  sourceType: 'RECEIPT',
  sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
  sourceLineId: '0193504b-3783-72d4-b57c-2a79d52ceb24',
  sourceNumber: 'RCV-2026-0005',
  reversalOfId: null,
  decisionId: '01935045-cc95-7f08-9d3d-c0feb44d34ff',
  occurredAt: '2026-11-06T14:00:00.000Z',
  tracking: { serialKeys: ['SN-A54-0009', 'SN-A54-0010', 'SN-A54-0011', 'SN-A54-0012'] },
});
registerSourceLine({
  sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0005',
  nodeId: 'node-st-dt',
  opKey: 'op-rcpt-2026-0005',
  occurredAt: '2026-11-06T14:00:00.000Z',
  lineId: '0193504b-3783-72d4-b57c-2a79d52ceb24',
  docLineId: 'po-05-l2',
  choice: seedSerial,
  uom: uomPcs,
  qty: '4',
  normQty: '4',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { serialKeys: ['SN-A54-0009', 'SN-A54-0010', 'SN-A54-0011', 'SN-A54-0012'] },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-12',
  decisionId: '01935045-cc95-7f08-9d3d-c0feb44d34ff',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-13',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomBox,
  qty: '3',
  normQty: '36',
  convId: 'uomc-2',
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0006-l1',
  sourceType: 'RECEIPT',
  sourceId: '01935064-b182-7a16-9c3b-3bcbccd827c5',
  sourceLineId: '019350c8-c342-7a6d-92f6-c67957757e91',
  sourceNumber: 'RCV-2026-0006',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-07T10:00:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '01935064-b182-7a16-9c3b-3bcbccd827c5',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0006',
  nodeId: 'node-wh-main',
  opKey: 'op-rcpt-2026-0006',
  occurredAt: '2026-11-07T10:00:00.000Z',
  lineId: '019350c8-c342-7a6d-92f6-c67957757e91',
  docLineId: 'po-06-l1',
  choice: seedNone,
  uom: uomBox,
  qty: '3',
  normQty: '36',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-13',
  decisionId: null,
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-14',
  nodeId: 'node-st-dt',
  choice: seedLot,
  uom: uomPcs,
  qty: '25',
  normQty: '25',
  convId: null,
  movementType: 'PURCHASE_RECEIPT',
  opKey: 'op-rcpt-2026-0007-l1',
  sourceType: 'RECEIPT',
  sourceId: '0193508b-5d55-7531-9155-88565cfe0784',
  sourceLineId: '0193505b-2a19-7883-a7f4-c4d9f844e8df',
  sourceNumber: 'RCV-2026-0007',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-09T11:30:00.000Z',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
});
registerSourceLine({
  sourceId: '0193508b-5d55-7531-9155-88565cfe0784',
  kind: 'RECEIPT',
  documentNumber: 'RCV-2026-0007',
  nodeId: 'node-st-dt',
  opKey: 'op-rcpt-2026-0007',
  occurredAt: '2026-11-09T11:30:00.000Z',
  lineId: '0193505b-2a19-7883-a7f4-c4d9f844e8df',
  docLineId: 'po-07-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '25',
  normQty: '25',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-14',
  decisionId: null,
  status: 'POSTED',
});

// 10 SALES_DELIVERY entries (led-15..led-24 across dlv-01..dlv-08)
pushLedgerSpec({
  id: 'led-15',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomBox,
  qty: '-2',
  normQty: '-24',
  convId: 'uomc-2',
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0001-l1',
  sourceType: 'DELIVERY',
  sourceId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
  sourceLineId: '01935003-2336-708f-b386-5e885a96ea1b',
  sourceNumber: 'DLV-2026-0001',
  reversalOfId: null,
  decisionId: '01935068-2acd-7971-bfa0-6e350d8e1750',
  occurredAt: '2026-11-05T11:30:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0001',
  nodeId: 'node-wh-main',
  opKey: 'op-dlv-2026-0001',
  occurredAt: '2026-11-05T11:30:00.000Z',
  lineId: '01935003-2336-708f-b386-5e885a96ea1b',
  docLineId: 'so-01-l1',
  choice: seedNone,
  uom: uomBox,
  qty: '2',
  normQty: '24',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-15',
  decisionId: '01935068-2acd-7971-bfa0-6e350d8e1750',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-16',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '-30',
  normQty: '-30',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0001-l2',
  sourceType: 'DELIVERY',
  sourceId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
  sourceLineId: '01935098-fd89-7dc3-b3b0-b4ad10afabc6',
  sourceNumber: 'DLV-2026-0001',
  reversalOfId: null,
  decisionId: '01935068-2acd-7971-bfa0-6e350d8e1750',
  occurredAt: '2026-11-05T11:31:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});
registerSourceLine({
  sourceId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0001',
  nodeId: 'node-wh-main',
  opKey: 'op-dlv-2026-0001',
  occurredAt: '2026-11-05T11:30:00.000Z',
  lineId: '01935098-fd89-7dc3-b3b0-b4ad10afabc6',
  docLineId: 'so-01-l2',
  choice: seedLot,
  uom: uomPcs,
  qty: '30',
  normQty: '30',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-16',
  decisionId: '01935068-2acd-7971-bfa0-6e350d8e1750',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-17',
  nodeId: 'node-wh-main',
  choice: seedSerial,
  uom: uomPcs,
  qty: '-3',
  normQty: '-3',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0002-l1',
  sourceType: 'DELIVERY',
  sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
  sourceLineId: '019350a6-c9a1-702f-a4b2-5b9ac394cde7',
  sourceNumber: 'DLV-2026-0002',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-10T10:00:00.000Z',
  tracking: { serialKeys: ['SN-A54-0001', 'SN-A54-0002', 'SN-A54-0003'] },
});
registerSourceLine({
  sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0002',
  nodeId: 'node-wh-main',
  opKey: 'op-dlv-2026-0002',
  occurredAt: '2026-11-10T10:00:00.000Z',
  lineId: '019350a6-c9a1-702f-a4b2-5b9ac394cde7',
  docLineId: 'so-02-l1',
  choice: seedSerial,
  uom: uomPcs,
  qty: '3',
  normQty: '3',
  reversedQty: '1',
  normReversedQty: '1',
  tracking: { serialKeys: ['SN-A54-0001', 'SN-A54-0002', 'SN-A54-0003'] },
  reversedSerialKeys: ['SN-A54-0003'],
  ledgerEntryId: 'led-17',
  decisionId: null,
  status: 'PARTIALLY_REVERSED',
});

pushLedgerSpec({
  id: 'led-18',
  nodeId: 'node-st-dt',
  choice: seedLot,
  uom: uomPcs,
  qty: '-15',
  normQty: '-15',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0003-l1',
  sourceType: 'DELIVERY',
  sourceId: '0193505f-016f-7112-be67-b9535de3afd4',
  sourceLineId: '01935085-b5d9-7fce-81df-ed784c91aba3',
  sourceNumber: 'DLV-2026-0003',
  reversalOfId: null,
  decisionId: '01935073-f404-7c2b-980a-6effc6a0d3a0',
  occurredAt: '2026-11-08T13:20:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});
registerSourceLine({
  sourceId: '0193505f-016f-7112-be67-b9535de3afd4',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0003',
  nodeId: 'node-st-dt',
  opKey: 'op-dlv-2026-0003',
  occurredAt: '2026-11-08T13:20:00.000Z',
  lineId: '01935085-b5d9-7fce-81df-ed784c91aba3',
  docLineId: 'so-03-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '15',
  normQty: '15',
  reversedQty: '5',
  normReversedQty: '5',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-18',
  decisionId: '01935073-f404-7c2b-980a-6effc6a0d3a0',
  status: 'PARTIALLY_REVERSED',
});

pushLedgerSpec({
  id: 'led-19',
  nodeId: 'node-st-dt',
  choice: seedNone,
  uom: uomPcs,
  qty: '-30',
  normQty: '-30',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0004-l1',
  sourceType: 'DELIVERY',
  sourceId: '0193502e-ac85-7ecc-91b0-a02de523ed13',
  sourceLineId: '019350a3-eab2-7fb0-9863-8112939f5c78',
  sourceNumber: 'DLV-2026-0004',
  reversalOfId: null,
  decisionId: '0193508d-9b1a-7397-9d3b-caef152790d2',
  occurredAt: '2026-11-11T16:05:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '0193502e-ac85-7ecc-91b0-a02de523ed13',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0004',
  nodeId: 'node-st-dt',
  opKey: 'op-dlv-2026-0004',
  occurredAt: '2026-11-11T16:05:00.000Z',
  lineId: '019350a3-eab2-7fb0-9863-8112939f5c78',
  docLineId: 'so-04-l1',
  choice: seedNone,
  uom: uomPcs,
  qty: '30',
  normQty: '30',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-19',
  decisionId: '0193508d-9b1a-7397-9d3b-caef152790d2',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-20',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomPcs,
  qty: '-16',
  normQty: '-16',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0004-l2',
  sourceType: 'DELIVERY',
  sourceId: '0193502e-ac85-7ecc-91b0-a02de523ed13',
  sourceLineId: '01935060-b695-710a-b723-4544e2f162cd',
  sourceNumber: 'DLV-2026-0004',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-12T10:20:00.000Z',
  tracking: {},
});
registerSourceLine({
  sourceId: '0193502e-ac85-7ecc-91b0-a02de523ed13',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0004',
  nodeId: 'node-st-dt',
  opKey: 'op-dlv-2026-0004',
  occurredAt: '2026-11-11T16:05:00.000Z',
  lineId: '01935060-b695-710a-b723-4544e2f162cd',
  docLineId: 'so-04-l2',
  choice: seedNone,
  uom: uomPcs,
  qty: '16',
  normQty: '16',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: {},
  reversedSerialKeys: [],
  ledgerEntryId: 'led-20',
  decisionId: null,
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-21',
  nodeId: 'node-st-dt',
  choice: seedSerial,
  uom: uomPcs,
  qty: '-2',
  normQty: '-2',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0005-l1',
  sourceType: 'DELIVERY',
  sourceId: '0193506c-85d8-7f46-986d-0c3b319f2408',
  sourceLineId: '0193504e-6894-74eb-b4db-39a30d4aab74',
  sourceNumber: 'DLV-2026-0005',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-14T15:30:00.000Z',
  tracking: { serialKeys: ['SN-A54-0009', 'SN-A54-0010'] },
});
registerSourceLine({
  sourceId: '0193506c-85d8-7f46-986d-0c3b319f2408',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0005',
  nodeId: 'node-st-dt',
  opKey: 'op-dlv-2026-0005',
  occurredAt: '2026-11-14T15:30:00.000Z',
  lineId: '0193504e-6894-74eb-b4db-39a30d4aab74',
  docLineId: 'so-05-l1',
  choice: seedSerial,
  uom: uomPcs,
  qty: '2',
  normQty: '2',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { serialKeys: ['SN-A54-0009', 'SN-A54-0010'] },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-21',
  decisionId: null,
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-22',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '-20',
  normQty: '-20',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0006-l1',
  sourceType: 'DELIVERY',
  sourceId: '019350c9-7a46-776c-ab19-898af0e80fd9',
  sourceLineId: '0193500a-5704-7791-9845-63da8f176dfd',
  sourceNumber: 'DLV-2026-0006',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-15T12:00:00.000Z',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
});
registerSourceLine({
  sourceId: '019350c9-7a46-776c-ab19-898af0e80fd9',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0006',
  nodeId: 'node-wh-main',
  opKey: 'op-dlv-2026-0006',
  occurredAt: '2026-11-15T12:00:00.000Z',
  lineId: '0193500a-5704-7791-9845-63da8f176dfd',
  docLineId: 'so-06-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '20',
  normQty: '20',
  reversedQty: '20',
  normReversedQty: '20',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-22',
  decisionId: null,
  status: 'REVERSED',
});

pushLedgerSpec({
  id: 'led-23',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '-25',
  normQty: '-25',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0007-l1',
  sourceType: 'DELIVERY',
  sourceId: '0193501a-1061-7653-bdf2-49bb3d8477ee',
  sourceLineId: '01935050-f966-7c56-be7e-40ea8850ee4e',
  sourceNumber: 'DLV-2026-0007',
  reversalOfId: null,
  decisionId: '01935013-98eb-7c01-ae57-32b0774c0178',
  occurredAt: '2026-11-17T09:45:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
});
registerSourceLine({
  sourceId: '0193501a-1061-7653-bdf2-49bb3d8477ee',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0007',
  nodeId: 'node-wh-main',
  opKey: 'op-dlv-2026-0007',
  occurredAt: '2026-11-17T09:45:00.000Z',
  lineId: '01935050-f966-7c56-be7e-40ea8850ee4e',
  docLineId: 'so-07-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '25',
  normQty: '25',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-23',
  decisionId: '01935013-98eb-7c01-ae57-32b0774c0178',
  status: 'POSTED',
});

pushLedgerSpec({
  id: 'led-24',
  nodeId: 'node-st-dt',
  choice: seedLot,
  uom: uomPcs,
  qty: '-10',
  normQty: '-10',
  convId: null,
  movementType: 'SALES_DELIVERY',
  opKey: 'op-dlv-2026-0008-l1',
  sourceType: 'DELIVERY',
  sourceId: '01935006-3b84-7df3-9793-fb80ffa40453',
  sourceLineId: '019350bf-26b2-771e-be28-d7d214950d38',
  sourceNumber: 'DLV-2026-0008',
  reversalOfId: null,
  decisionId: null,
  occurredAt: '2026-11-18T14:15:00.000Z',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
});
registerSourceLine({
  sourceId: '01935006-3b84-7df3-9793-fb80ffa40453',
  kind: 'DELIVERY',
  documentNumber: 'DLV-2026-0008',
  nodeId: 'node-st-dt',
  opKey: 'op-dlv-2026-0008',
  occurredAt: '2026-11-18T14:15:00.000Z',
  lineId: '019350bf-26b2-771e-be28-d7d214950d38',
  docLineId: 'so-08-l1',
  choice: seedLot,
  uom: uomPcs,
  qty: '10',
  normQty: '10',
  reversedQty: '0',
  normReversedQty: '0',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30' },
  reversedSerialKeys: [],
  ledgerEntryId: 'led-24',
  decisionId: null,
  status: 'POSTED',
});

// 3 PURCHASE_RECEIPT_REVERSAL entries (led-25..led-27)
pushLedgerSpec({
  id: 'led-25',
  nodeId: 'node-wh-main',
  choice: seedNone,
  uom: uomBox,
  qty: '-1',
  normQty: '-12',
  convId: 'uomc-2',
  movementType: 'PURCHASE_RECEIPT_REVERSAL',
  opKey: 'op-rev-rcpt-01-l1',
  sourceType: 'RECEIPT_REVERSAL',
  sourceId: '01935059-abb9-7c6d-a8ef-11f2ca3b6225',
  sourceLineId: null,
  sourceNumber: 'RCV-2026-0001',
  reversalOfId: 'led-05',
  decisionId: null,
  occurredAt: '2026-11-05T16:00:00.000Z',
  tracking: { reversalReasonCode: 'DAMAGED' },
});
pushLedgerSpec({
  id: 'led-26',
  nodeId: 'node-wh-main',
  choice: seedSerial,
  uom: uomPcs,
  qty: '-1',
  normQty: '-1',
  convId: null,
  movementType: 'PURCHASE_RECEIPT_REVERSAL',
  opKey: 'op-rev-rcpt-02-l1',
  sourceType: 'RECEIPT_REVERSAL',
  sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
  sourceLineId: null,
  sourceNumber: 'RCV-2026-0002',
  reversalOfId: 'led-07',
  decisionId: null,
  occurredAt: '2026-11-07T14:20:00.000Z',
  tracking: { serialKeys: ['SN-A54-0008'], reversalReasonCode: 'WRONG_ITEM' },
});
pushLedgerSpec({
  id: 'led-27',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '-30',
  normQty: '-30',
  convId: null,
  movementType: 'PURCHASE_RECEIPT_REVERSAL',
  opKey: 'op-rev-rcpt-03-l1',
  sourceType: 'RECEIPT_REVERSAL',
  sourceId: '019350df-fa28-73ed-a8b3-c912adce0398',
  sourceLineId: null,
  sourceNumber: 'RCV-2026-0003',
  reversalOfId: 'led-08',
  decisionId: null,
  occurredAt: '2026-11-13T11:10:00.000Z',
  tracking: { lotKey: 'LOT-2026-C', expiryDate: '2027-12-31', reversalReasonCode: 'DUPLICATE_ENTRY' },
});

// 3 SALES_DELIVERY_REVERSAL entries (led-28..led-30)
pushLedgerSpec({
  id: 'led-28',
  nodeId: 'node-st-dt',
  choice: seedLot,
  uom: uomPcs,
  qty: '5',
  normQty: '5',
  convId: null,
  movementType: 'SALES_DELIVERY_REVERSAL',
  opKey: 'op-rev-dlv-03-l1',
  sourceType: 'DELIVERY_REVERSAL',
  sourceId: '0193505f-016f-7112-be67-b9535de3afd4',
  sourceLineId: null,
  sourceNumber: 'DLV-2026-0003',
  reversalOfId: 'led-18',
  decisionId: null,
  occurredAt: '2026-11-16T09:40:00.000Z',
  tracking: { lotKey: 'LOT-2026-A', expiryDate: '2027-06-30', reversalReasonCode: 'WRONG_QUANTITY' },
});
pushLedgerSpec({
  id: 'led-29',
  nodeId: 'node-wh-main',
  choice: seedSerial,
  uom: uomPcs,
  qty: '1',
  normQty: '1',
  convId: null,
  movementType: 'SALES_DELIVERY_REVERSAL',
  opKey: 'op-rev-dlv-02-l1',
  sourceType: 'DELIVERY_REVERSAL',
  sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
  sourceLineId: null,
  sourceNumber: 'DLV-2026-0002',
  reversalOfId: 'led-17',
  decisionId: null,
  occurredAt: '2026-11-19T12:15:00.000Z',
  tracking: { serialKeys: ['SN-A54-0003'], reversalReasonCode: 'DAMAGED' },
});
pushLedgerSpec({
  id: 'led-30',
  nodeId: 'node-wh-main',
  choice: seedLot,
  uom: uomPcs,
  qty: '20',
  normQty: '20',
  convId: null,
  movementType: 'SALES_DELIVERY_REVERSAL',
  opKey: 'op-rev-dlv-06-l1',
  sourceType: 'DELIVERY_REVERSAL',
  sourceId: '019350c9-7a46-776c-ab19-898af0e80fd9',
  sourceLineId: null,
  sourceNumber: 'DLV-2026-0006',
  reversalOfId: 'led-22',
  decisionId: null,
  occurredAt: '2026-11-20T10:30:00.000Z',
  tracking: { lotKey: 'LOT-2026-B', expiryDate: '2027-09-30', reversalReasonCode: 'OTHER' },
});

// Reserved quantities per (nodeId, itemId, uomId, lotKey ?? '')
const reservedQuantities = new Map<string, string>([
  [`node-wh-main::${seedNone.item.id}::${seedNone.baseUom.id}::`, '24'],
  [`node-wh-main::${seedLot.item.id}::${seedLot.baseUom.id}::LOT-2026-A`, '30'],
  [`node-wh-main::${seedLot.item.id}::${seedLot.baseUom.id}::LOT-2026-B`, '15'],
  [`node-wh-main::${seedSerial.item.id}::${seedSerial.baseUom.id}::`, '2'],
  [`node-st-dt::${seedLot.item.id}::${seedLot.baseUom.id}::LOT-2026-A`, '10'],
]);

// 12 Serial units with lifecycles matching ledger
interface SerialSeedSpec {
  num: number;
  state: SerialState;
  nodeId: string | null;
  firstLedgerEntryId: string;
  currentLedgerEntryId: string;
  lastTransitionAt: string;
  reservationId: string | null;
  events: {
    eventType: SerialEventType;
    opKey: string;
    sourceType: SerialLifecycleSourceType;
    sourceId: string;
    ledgerEntryId: string | null;
    reservationId: string | null;
    fromState: SerialState | null;
    toState: SerialState;
    nodeId: string | null;
    occurredAt: string;
  }[];
}

const serialSeedSpecs: SerialSeedSpec[] = [
  {
    num: 1,
    state: 'DELIVERED',
    nodeId: null,
    firstLedgerEntryId: 'led-03',
    currentLedgerEntryId: 'led-17',
    lastTransitionAt: '2026-11-10T10:00:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'OPENING',
        opKey: 'op-open-2026-11-01-wh-serial',
        sourceType: 'LEDGER',
        sourceId: 'led-03',
        ledgerEntryId: 'led-03',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-01T09:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-dlv-02-sn1',
        sourceType: 'RESERVATION',
        sourceId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        ledgerEntryId: null,
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-09T14:00:00.000Z',
      },
      {
        eventType: 'DELIVERY',
        opKey: 'op-dlv-2026-0002-l1',
        sourceType: 'DELIVERY',
        sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
        ledgerEntryId: 'led-17',
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'RESERVED',
        toState: 'DELIVERED',
        nodeId: null,
        occurredAt: '2026-11-10T10:00:00.000Z',
      },
    ],
  },
  {
    num: 2,
    state: 'DELIVERED',
    nodeId: null,
    firstLedgerEntryId: 'led-03',
    currentLedgerEntryId: 'led-17',
    lastTransitionAt: '2026-11-10T10:00:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'OPENING',
        opKey: 'op-open-2026-11-01-wh-serial',
        sourceType: 'LEDGER',
        sourceId: 'led-03',
        ledgerEntryId: 'led-03',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-01T09:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-dlv-02-sn2',
        sourceType: 'RESERVATION',
        sourceId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        ledgerEntryId: null,
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-09T14:00:00.000Z',
      },
      {
        eventType: 'DELIVERY',
        opKey: 'op-dlv-2026-0002-l1',
        sourceType: 'DELIVERY',
        sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
        ledgerEntryId: 'led-17',
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'RESERVED',
        toState: 'DELIVERED',
        nodeId: null,
        occurredAt: '2026-11-10T10:00:00.000Z',
      },
    ],
  },
  {
    num: 3,
    state: 'ON_HAND',
    nodeId: 'node-wh-main',
    firstLedgerEntryId: 'led-03',
    currentLedgerEntryId: 'led-29',
    lastTransitionAt: '2026-11-19T12:15:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'OPENING',
        opKey: 'op-open-2026-11-01-wh-serial',
        sourceType: 'LEDGER',
        sourceId: 'led-03',
        ledgerEntryId: 'led-03',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-01T09:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-dlv-02-sn3',
        sourceType: 'RESERVATION',
        sourceId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        ledgerEntryId: null,
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-09T14:00:00.000Z',
      },
      {
        eventType: 'DELIVERY',
        opKey: 'op-dlv-2026-0002-l1',
        sourceType: 'DELIVERY',
        sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
        ledgerEntryId: 'led-17',
        reservationId: '019350ff-9e98-761c-aab8-d6f6ee79bf36',
        fromState: 'RESERVED',
        toState: 'DELIVERED',
        nodeId: null,
        occurredAt: '2026-11-10T10:00:00.000Z',
      },
      {
        eventType: 'DELIVERY_REVERSAL',
        opKey: 'op-rev-dlv-02-l1',
        sourceType: 'DELIVERY_REVERSAL',
        sourceId: '01935092-d5f5-779b-8653-26e8b448aa3f',
        ledgerEntryId: 'led-29',
        reservationId: null,
        fromState: 'DELIVERED',
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-19T12:15:00.000Z',
      },
    ],
  },
  {
    num: 4,
    state: 'RESERVED',
    nodeId: 'node-wh-main',
    firstLedgerEntryId: 'led-07',
    currentLedgerEntryId: 'led-07',
    lastTransitionAt: '2026-11-18T11:00:00.000Z',
    reservationId: '01935003-b452-7561-a917-f20810a97543',
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0002-l1',
        sourceType: 'RECEIPT',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-07',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-03T11:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-open-04',
        sourceType: 'RESERVATION',
        sourceId: '01935003-b452-7561-a917-f20810a97543',
        ledgerEntryId: null,
        reservationId: '01935003-b452-7561-a917-f20810a97543',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-18T11:00:00.000Z',
      },
    ],
  },
  {
    num: 5,
    state: 'RESERVED',
    nodeId: 'node-wh-main',
    firstLedgerEntryId: 'led-07',
    currentLedgerEntryId: 'led-07',
    lastTransitionAt: '2026-11-18T11:00:00.000Z',
    reservationId: '01935028-2c20-7d74-90fb-d46f23b71cb1',
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0002-l1',
        sourceType: 'RECEIPT',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-07',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-03T11:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-open-05',
        sourceType: 'RESERVATION',
        sourceId: '01935028-2c20-7d74-90fb-d46f23b71cb1',
        ledgerEntryId: null,
        reservationId: '01935028-2c20-7d74-90fb-d46f23b71cb1',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-18T11:00:00.000Z',
      },
    ],
  },
  {
    num: 6,
    state: 'ON_HAND',
    nodeId: 'node-wh-main',
    firstLedgerEntryId: 'led-07',
    currentLedgerEntryId: 'led-07',
    lastTransitionAt: '2026-11-11T10:00:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0002-l1',
        sourceType: 'RECEIPT',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-07',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-03T11:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-temp-06',
        sourceType: 'RESERVATION',
        sourceId: '019350b3-06eb-747c-af6a-8ce9fd608904',
        ledgerEntryId: null,
        reservationId: '019350b3-06eb-747c-af6a-8ce9fd608904',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-08T10:00:00.000Z',
      },
      {
        eventType: 'RELEASE',
        opKey: 'op-rel-temp-06',
        sourceType: 'RESERVATION',
        sourceId: '019350b3-06eb-747c-af6a-8ce9fd608904',
        ledgerEntryId: null,
        reservationId: '019350b3-06eb-747c-af6a-8ce9fd608904',
        fromState: 'RESERVED',
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-11T10:00:00.000Z',
      },
    ],
  },
  {
    num: 7,
    state: 'ON_HAND',
    nodeId: 'node-wh-main',
    firstLedgerEntryId: 'led-07',
    currentLedgerEntryId: 'led-07',
    lastTransitionAt: '2026-11-12T00:05:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0002-l1',
        sourceType: 'RECEIPT',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-07',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-03T11:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-exp-07',
        sourceType: 'RESERVATION',
        sourceId: '0193505e-64a6-7daf-a7bb-cd49c8d9f527',
        ledgerEntryId: null,
        reservationId: '0193505e-64a6-7daf-a7bb-cd49c8d9f527',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-08T12:00:00.000Z',
      },
      {
        eventType: 'EXPIRY',
        opKey: 'op-exp-res-07',
        sourceType: 'RESERVATION',
        sourceId: '0193505e-64a6-7daf-a7bb-cd49c8d9f527',
        ledgerEntryId: null,
        reservationId: '0193505e-64a6-7daf-a7bb-cd49c8d9f527',
        fromState: 'RESERVED',
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-12T00:05:00.000Z',
      },
    ],
  },
  {
    num: 8,
    state: 'VOIDED',
    nodeId: null,
    firstLedgerEntryId: 'led-07',
    currentLedgerEntryId: 'led-26',
    lastTransitionAt: '2026-11-07T14:20:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0002-l1',
        sourceType: 'RECEIPT',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-07',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-wh-main',
        occurredAt: '2026-11-03T11:00:00.000Z',
      },
      {
        eventType: 'RECEIPT_REVERSAL',
        opKey: 'op-rev-rcpt-02-l1',
        sourceType: 'RECEIPT_REVERSAL',
        sourceId: '01935075-d4bf-7aca-801a-a11dc9a4f2e1',
        ledgerEntryId: 'led-26',
        reservationId: null,
        fromState: 'ON_HAND',
        toState: 'VOIDED',
        nodeId: null,
        occurredAt: '2026-11-07T14:20:00.000Z',
      },
    ],
  },
  {
    num: 9,
    state: 'DELIVERED',
    nodeId: null,
    firstLedgerEntryId: 'led-12',
    currentLedgerEntryId: 'led-21',
    lastTransitionAt: '2026-11-14T15:30:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0005-l2',
        sourceType: 'RECEIPT',
        sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
        ledgerEntryId: 'led-12',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-06T14:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-dlv-05-sn9',
        sourceType: 'RESERVATION',
        sourceId: '01935046-e079-788c-bff1-00b049694fc9',
        ledgerEntryId: null,
        reservationId: '01935046-e079-788c-bff1-00b049694fc9',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-13T16:00:00.000Z',
      },
      {
        eventType: 'DELIVERY',
        opKey: 'op-dlv-2026-0005-l1',
        sourceType: 'DELIVERY',
        sourceId: '0193506c-85d8-7f46-986d-0c3b319f2408',
        ledgerEntryId: 'led-21',
        reservationId: '01935046-e079-788c-bff1-00b049694fc9',
        fromState: 'RESERVED',
        toState: 'DELIVERED',
        nodeId: null,
        occurredAt: '2026-11-14T15:30:00.000Z',
      },
    ],
  },
  {
    num: 10,
    state: 'DELIVERED',
    nodeId: null,
    firstLedgerEntryId: 'led-12',
    currentLedgerEntryId: 'led-21',
    lastTransitionAt: '2026-11-14T15:30:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0005-l2',
        sourceType: 'RECEIPT',
        sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
        ledgerEntryId: 'led-12',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-06T14:00:00.000Z',
      },
      {
        eventType: 'RESERVATION',
        opKey: 'op-res-dlv-05-sn10',
        sourceType: 'RESERVATION',
        sourceId: '01935046-e079-788c-bff1-00b049694fc9',
        ledgerEntryId: null,
        reservationId: '01935046-e079-788c-bff1-00b049694fc9',
        fromState: 'ON_HAND',
        toState: 'RESERVED',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-13T16:00:00.000Z',
      },
      {
        eventType: 'DELIVERY',
        opKey: 'op-dlv-2026-0005-l1',
        sourceType: 'DELIVERY',
        sourceId: '0193506c-85d8-7f46-986d-0c3b319f2408',
        ledgerEntryId: 'led-21',
        reservationId: '01935046-e079-788c-bff1-00b049694fc9',
        fromState: 'RESERVED',
        toState: 'DELIVERED',
        nodeId: null,
        occurredAt: '2026-11-14T15:30:00.000Z',
      },
    ],
  },
  {
    num: 11,
    state: 'ON_HAND',
    nodeId: 'node-st-dt',
    firstLedgerEntryId: 'led-12',
    currentLedgerEntryId: 'led-12',
    lastTransitionAt: '2026-11-06T14:00:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0005-l2',
        sourceType: 'RECEIPT',
        sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
        ledgerEntryId: 'led-12',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-06T14:00:00.000Z',
      },
    ],
  },
  {
    num: 12,
    state: 'ON_HAND',
    nodeId: 'node-st-dt',
    firstLedgerEntryId: 'led-12',
    currentLedgerEntryId: 'led-12',
    lastTransitionAt: '2026-11-06T14:00:00.000Z',
    reservationId: null,
    events: [
      {
        eventType: 'RECEIPT',
        opKey: 'op-rcpt-2026-0005-l2',
        sourceType: 'RECEIPT',
        sourceId: '01935041-34a5-7204-9f68-3c1d013c7d85',
        ledgerEntryId: 'led-12',
        reservationId: null,
        fromState: null,
        toState: 'ON_HAND',
        nodeId: 'node-st-dt',
        occurredAt: '2026-11-06T14:00:00.000Z',
      },
    ],
  },
];

const serialUnits: SerialDetail[] = serialSeedSpecs.map((spec) => {
  const padded = String(spec.num).padStart(4, '0');
  const serialKey = `SN-A54-${padded}`;
  const serialUnitId = `ser-${padded}`;
  const currentNode = spec.nodeId ? nodeById(spec.nodeId) : null;
  const uom = seedSerial.baseUom;

  const lifecycle: SerialLifecycleEntry[] = spec.events.map((ev, idx) => {
    const evNode = ev.nodeId ? nodeById(ev.nodeId) : null;
    return {
      id: `ser-ev-${padded}-${idx + 1}`,
      serialUnitId,
      serialKey,
      eventType: ev.eventType,
      operationKey: ev.opKey,
      sourceType: ev.sourceType,
      sourceId: ev.sourceId,
      ledgerEntryId: ev.ledgerEntryId,
      reservationId: ev.reservationId,
      fromState: ev.fromState,
      toState: ev.toState,
      fulfillmentNodeId: evNode?.id ?? null,
      nodeCode: evNode?.code ?? null,
      nodeName: evNode?.name ?? null,
      uomId: uom.id,
      uomCode: uom.code,
      occurredAt: ev.occurredAt,
    };
  });

  return {
    id: serialUnitId,
    companyId: COMPANY_ID,
    itemId: seedSerial.item.id,
    itemCompanyProfileId: seedSerial.profile.id,
    serialKey,
    state: spec.state,
    currentFulfillmentNodeId: currentNode?.id ?? null,
    currentUomId: currentNode ? uom.id : null,
    currentReservationId: spec.reservationId,
    firstLedgerEntryId: spec.firstLedgerEntryId,
    currentLedgerEntryId: spec.currentLedgerEntryId,
    lastTransitionAt: spec.lastTransitionAt,
    version: spec.events.length,
    itemCode: seedSerial.item.canonicalCode,
    itemNames: { ...seedSerial.item.localizedNames },
    currentNodeCode: currentNode?.code ?? null,
    currentNodeName: currentNode?.name ?? null,
    currentUomCode: currentNode ? uom.code : null,
    lifecycle,
  };
});

// ---------------------------------------------------------------------------
// Derived balance & helper computations
// ---------------------------------------------------------------------------

function balanceKey(nodeId: string, itemId: string, uomId: string, lotKey: string | null): string {
  return `${nodeId}::${itemId}::${uomId}::${lotKey ?? ''}`;
}

interface BalanceAggregate {
  nodeId: string;
  nodeCode: string;
  nodeName: string;
  itemCompanyProfileId: string;
  itemId: string;
  itemCode: string;
  itemNames: Record<string, string>;
  trackingMode: 'NONE' | 'LOT' | 'SERIAL';
  lotKey: string | null;
  uomId: string;
  uomCode: string;
  onHandMicros: bigint;
  reservedMicros: bigint;
  updatedAt: string;
}

function computeAllBalances(): StockBalanceRow[] {
  const aggMap = new Map<string, BalanceAggregate>();

  for (const entry of ledgerEntries) {
    const lotKey = entry.tracking.lotKey?.trim() || null;
    const key = balanceKey(entry.fulfillmentNodeId, entry.itemId, entry.normalizedUomId, lotKey);
    const qtyMicros = toMicros(entry.normalizedSignedQuantity);
    const existing = aggMap.get(key);
    if (existing) {
      existing.onHandMicros += qtyMicros;
      if (entry.occurredAt > existing.updatedAt) {
        existing.updatedAt = entry.occurredAt;
      }
    } else {
      const info = findItemAndProfile(entry.itemId);
      const trackingMode = info?.profile?.trackingMode ?? 'NONE';
      const resStr = reservedQuantities.get(key) ?? '0';
      aggMap.set(key, {
        nodeId: entry.fulfillmentNodeId,
        nodeCode: entry.nodeCode,
        nodeName: entry.nodeName,
        itemCompanyProfileId: entry.itemCompanyProfileId,
        itemId: entry.itemId,
        itemCode: entry.itemCode,
        itemNames: { ...entry.itemNames },
        trackingMode,
        lotKey,
        uomId: entry.normalizedUomId,
        uomCode: entry.normalizedUomCode,
        onHandMicros: qtyMicros,
        reservedMicros: toMicros(resStr),
        updatedAt: entry.occurredAt,
      });
    }
  }

  const serialCountsByNodeItem = new Map<string, number>();
  for (const unit of serialUnits) {
    if (unit.currentFulfillmentNodeId && (unit.state === 'ON_HAND' || unit.state === 'RESERVED')) {
      const sKey = `${unit.currentFulfillmentNodeId}::${unit.itemId}`;
      serialCountsByNodeItem.set(sKey, (serialCountsByNodeItem.get(sKey) ?? 0) + 1);
    }
  }

  const rows: StockBalanceRow[] = [];
  for (const agg of aggMap.values()) {
    const availableMicros = agg.onHandMicros - agg.reservedMicros;
    const serialCount =
      agg.trackingMode === 'SERIAL'
        ? (serialCountsByNodeItem.get(`${agg.nodeId}::${agg.itemId}`) ?? 0)
        : 0;
    rows.push({
      nodeId: agg.nodeId,
      nodeCode: agg.nodeCode,
      nodeName: agg.nodeName,
      itemCompanyProfileId: agg.itemCompanyProfileId,
      itemId: agg.itemId,
      itemCode: agg.itemCode,
      itemNames: agg.itemNames,
      trackingMode: agg.trackingMode,
      lotKey: agg.lotKey,
      uomId: agg.uomId,
      uomCode: agg.uomCode,
      onHandQuantity: dec8(agg.onHandMicros),
      reservedQuantity: dec8(agg.reservedMicros),
      availableQuantity: dec8(availableMicros),
      serialCount,
      negative: agg.onHandMicros < 0n,
      updatedAt: agg.updatedAt,
    });
  }

  rows.sort((a, b) => {
    const byNode = a.nodeCode.localeCompare(b.nodeCode);
    if (byNode !== 0) return byNode;
    const byItem = a.itemCode.localeCompare(b.itemCode);
    if (byItem !== 0) return byItem;
    return (a.lotKey ?? '').localeCompare(b.lotKey ?? '');
  });

  return rows;
}

/** Backend assertNodeHasNoOpenWork: open reservations plus DRAFT receipts and deliveries at the node. */
function nodeHasOpenWork(nodeId: string): boolean {
  if (movementSources.some((s) => s.fulfillmentNodeId === nodeId && s.status === 'DRAFT')) {
    return true;
  }
  for (const row of computeAllBalances()) {
    if (row.nodeId === nodeId && toMicros(row.reservedQuantity) > 0n) {
      return true;
    }
  }
  return false;
}

function findSourceLineById(sourceLineId: string | null): SourceLine | null {
  if (!sourceLineId) return null;
  for (const src of movementSources) {
    const line = src.lines.find((l) => l.id === sourceLineId);
    if (line) return line;
  }
  return null;
}

/** Read projection of a ledger row: numeric columns come back as eight-decimal text. */
function decorateLedgerEntry(entry: LedgerEntry): LedgerEntry {
  const copy = clone(entry);
  copy.signedQuantity = text8(copy.signedQuantity);
  copy.normalizedSignedQuantity = text8(copy.normalizedSignedQuantity);
  if (copy.movementType !== 'PURCHASE_RECEIPT' && copy.movementType !== 'SALES_DELIVERY') {
    copy.remainingReversibleQuantity = null;
    return copy;
  }
  const line = findSourceLineById(copy.sourceLineId);
  if (!line) {
    copy.remainingReversibleQuantity = null;
    return copy;
  }
  copy.remainingReversibleQuantity = dec8(
    toMicros(line.normalizedQuantity) - toMicros(line.normalizedReversedQuantity),
  );
  return copy;
}

/** Read projection of a receipt/delivery: numeric line columns come back as eight-decimal text. */
function sourceProjection(src: MovementSource): MovementSource {
  const copy = clone(src);
  for (const line of copy.lines) {
    line.quantity = text8(line.quantity);
    line.normalizedQuantity = text8(line.normalizedQuantity);
    line.reversedQuantity = text8(line.reversedQuantity);
    line.normalizedReversedQuantity = text8(line.normalizedReversedQuantity);
  }
  return copy;
}

/** Backend findProfileByItem: an ACTIVE company profile with trackInventory, else 422. */
function requireStockProfile(itemId: string): { item: FakeItem; profile: ItemCompanyProfile } {
  const info = findItemAndProfile(itemId);
  if (!info?.profile || !info.profile.trackInventory || info.profile.status !== 'ACTIVE') {
    throw new ApiError(422, 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED');
  }
  return { item: info.item, profile: info.profile };
}

/** Backend validateSerialKeys: non-empty, trimmed, unique, not 'none', and as many as `quantity` when given. */
function assertSerialKeys(value: unknown, quantity?: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (key: unknown) =>
        typeof key !== 'string' ||
        key.length < 1 ||
        key.length > INVENTORY_LIMITS.serialKeyLength ||
        key !== key.trim() ||
        key === 'none',
    ) ||
    new Set(value).size !== value.length ||
    (quantity !== undefined && toMicros(quantity) !== BigInt(value.length) * SCALE)
  ) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED');
  }
}

/** Backend assertTracking(profile, quantity, tracking). */
function assertTracking(
  mode: 'NONE' | 'LOT' | 'SERIAL',
  quantity: string,
  tracking: Record<string, unknown>,
): void {
  const allowed = new Set(['lotKey', 'serialKeys', 'expiryDate']);
  if (Object.keys(tracking).some((k) => !allowed.has(k))) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_UNSUPPORTED');
  }
  for (const [k, v] of Object.entries(tracking)) {
    if (k === 'serialKeys' || v === undefined) continue;
    if (typeof v !== 'string' || v.length === 0 || v.length > 120 || v !== v.trim()) {
      throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED');
    }
  }
  const expiry = tracking['expiryDate'];
  if (typeof expiry === 'string' && !ISO_DAY_PATTERN.test(expiry)) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED');
  }
  const lot = tracking['lotKey'];
  const lotKey = typeof lot === 'string' ? lot : 'none';
  const serials = tracking['serialKeys'];
  const serialKey = Array.isArray(serials) && serials.length === 1 ? String(serials[0]) : 'none';
  if (mode === 'LOT' && lotKey === 'none') {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED');
  }
  if (mode === 'SERIAL') assertSerialKeys(serials, quantity);
  else if (serials !== undefined) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_UNSUPPORTED');
  }
  if (mode === 'NONE' && (lotKey !== 'none' || serialKey !== 'none')) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_UNSUPPORTED');
  }
}

/** Transport validation of InventoryTrackingDto (400). */
function assertTrackingShape(raw: unknown): void {
  if (raw === undefined) return;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { tracking: ['invalid'] });
  }
  const t = raw as Record<string, unknown>;
  const lot = t['lotKey'];
  if (lot !== undefined && (typeof lot !== 'string' || lot.length > INVENTORY_LIMITS.lotKey)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { lotKey: ['invalid'] });
  }
  const expiry = t['expiryDate'];
  if (expiry !== undefined && (typeof expiry !== 'string' || !ISO_DAY_PATTERN.test(expiry))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { expiryDate: ['invalid'] });
  }
  assertSerialKeysShape(t['serialKeys'], 'serialKeys');
}

function assertSerialKeysShape(value: unknown, field: string): void {
  if (value === undefined) return;
  if (
    !Array.isArray(value) ||
    value.length > INVENTORY_LIMITS.serialKeys ||
    value.some((k: unknown) => typeof k !== 'string' || k.length > INVENTORY_LIMITS.serialKeyLength)
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { [field]: ['invalid'] });
  }
}

/** Fake balance record version: one bump per ledger movement on that balance key. */
function balanceVersion(nodeId: string, itemId: string, uomId: string, lotKey: string | null): number {
  return ledgerEntries.filter(
    (e) =>
      e.fulfillmentNodeId === nodeId &&
      e.itemId === itemId &&
      e.normalizedUomId === uomId &&
      (e.tracking.lotKey?.trim() || null) === lotKey,
  ).length;
}


function paginate<T>(items: readonly T[], page: number, limit: number): Page<T> {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 200) : INVENTORY_LIMITS.pageSize;
  const start = (safePage - 1) * safeLimit;
  return {
    items: clone(items.slice(start, start + safeLimit)),
    total: items.length,
    page: safePage,
    limit: safeLimit,
  };
}

function toCompanyNode(node: FulfillmentNode): CompanyNode {
  const activeBranches = (node.branches ?? [])
    .filter((b) => b.isActive)
    .map((b) => ({ id: b.id, branchId: b.branchId, isActive: b.isActive, version: b.version }));
  const { branches: _ignored, ...rest } = node;
  return clone({
    ...rest,
    branches: activeBranches,
    branchCount: activeBranches.length,
  });
}

function parseDayString(raw: string): string | null {
  const trimmed = raw.trim();
  const match = ISO_DAY_PATTERN.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

function utcDayDiff(fromDay: string, toDay: string): number {
  const fromMs = Date.parse(`${fromDay}T00:00:00.000Z`);
  const toMs = Date.parse(`${toDay}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / DAY_MS);
}

// Mirrors the backend: the DTO accepts only /^[A-Z][A-Z0-9_]{1,39}$/ (400,
// no details), then TradeReasonsService.assertUsableCode matches the code
// exactly and returns details { field: ['reasonCode'] }, plus
// reason: ['kind_mismatch'] when the code exists under another kind.
const INVENTORY_REASON_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

function assertActiveReason(kind: InventoryReasonKind, reasonCode: string): string {
  if (typeof reasonCode !== 'string' || !INVENTORY_REASON_CODE.test(reasonCode)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  const live = (TRADE_FAKE_DB.reasons ?? []).filter((r) => r.code === reasonCode);
  const row = live.find((r) => r.kind === kind) ?? live[0];
  if (!row) {
    throw new ApiError(422, 'TRADE.REASON.NOT_FOUND', { field: ['reasonCode'] });
  }
  if (!row.isActive) {
    throw new ApiError(422, 'TRADE.REASON.INACTIVE', { field: ['reasonCode'] });
  }
  if (row.kind !== kind) {
    throw new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['reasonCode'], reason: ['kind_mismatch'] });
  }
  return row.code;
}

function assertEffectiveDateInOpenPeriod(effectiveIso: string): {
  period: InventoryPeriod;
  effectiveMs: number;
} {
  const effectiveMs = Date.parse(effectiveIso);
  if (Number.isNaN(effectiveMs)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { businessEffectiveAt: ['invalid'] });
  }
  if (effectiveMs > Date.now() + 5_000) {
    throw new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['future_date'] });
  }

  const effectiveDay = new Date(effectiveMs).toISOString().slice(0, 10);
  const covering = periods.filter((p) => p.startsOn <= effectiveDay && p.endsOn >= effectiveDay);
  if (covering.length === 0) {
    throw new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['period_missing'] });
  }
  const openPeriod = covering.find((p) => p.status === 'OPEN');
  if (!openPeriod) {
    throw new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['period_closed'] });
  }

  const todayDay = new Date().toISOString().slice(0, 10);
  const backdateDays = utcDayDiff(effectiveDay, todayDay);
  if (backdateDays > openPeriod.maxBackdateDays) {
    throw new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['backdate_limit'] });
  }

  return { period: openPeriod, effectiveMs };
}

function validateBranchIds(companyId: string, branchIds: readonly string[]): string[] {
  if (!Array.isArray(branchIds) || branchIds.length === 0) {
    throw new ApiError(422, 'TRADE.INVENTORY.SCOPE_INVALID');
  }
  const validCompanyBranches = companyBranchIds(companyId);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const rawId of branchIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || seen.has(id) || !validCompanyBranches.has(id)) {
      throw new ApiError(422, 'TRADE.INVENTORY.SCOPE_INVALID');
    }
    seen.add(id);
    cleaned.push(id);
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Exported fake API functions
// ---------------------------------------------------------------------------

export async function fakeListBalances(q: BalanceQuery): Promise<Page<StockBalanceRow>> {
  await enterCall();

  let rows = computeAllBalances();
  if (q.nodeId) {
    rows = rows.filter((r) => r.nodeId === q.nodeId);
  }
  if (q.itemId) {
    rows = rows.filter((r) => r.itemId === q.itemId);
  }
  if (q.itemCompanyProfileId) {
    rows = rows.filter((r) => r.itemCompanyProfileId === q.itemCompanyProfileId);
  }
  if (q.lotKey) {
    rows = rows.filter((r) => r.lotKey === q.lotKey);
  }
  if (q.onlyInStock) {
    rows = rows.filter(
      (r) => !(toMicros(r.onHandQuantity) === 0n && toMicros(r.reservedQuantity) === 0n),
    );
  }
  const needle = q.search?.trim().toLowerCase() ?? '';
  if (needle) {
    rows = rows.filter((r) => {
      if (r.itemCode.toLowerCase().startsWith(needle)) return true;
      if (r.lotKey && r.lotKey.toLowerCase().startsWith(needle)) return true;
      return Object.values(r.itemNames).some((name) => name.toLowerCase().includes(needle));
    });
  }

  return paginate(rows, q.page, q.limit);
}

/**
 * Mirrors InventoryService.availability: the exact balance row for
 * (node, profile, uom?, lotKey ?? 'none', serialKey ?? 'none'), no unit conversion.
 * onHand/reserved are the stored numeric text, available is computed (trimmed).
 */
export async function fakeGetAvailability(q: AvailabilityQuery): Promise<Availability> {
  await enterCall();

  const node = nodes.find((n) => n.id === q.nodeId);
  if (!node || node.status !== 'ACTIVE') {
    throw new ApiError(404, 'TRADE.INVENTORY.NODE_NOT_FOUND');
  }
  const { item, profile } = requireStockProfile(q.itemId);
  assertTracking(profile.trackingMode, '1', {
    ...(q.lotKey ? { lotKey: q.lotKey } : {}),
    ...(q.serialKey ? { serialKeys: [q.serialKey] } : {}),
  });
  const lotKey = q.lotKey ?? null;

  interface BalanceHit {
    uomId: string;
    onHand: string;
    reserved: string;
    version: number;
  }
  let hits: BalanceHit[];
  if (q.serialKey) {
    const unit = serialUnits.find(
      (u) =>
        u.itemId === item.id &&
        u.serialKey === q.serialKey &&
        u.currentFulfillmentNodeId === node.id &&
        u.currentUomId !== null &&
        (q.uomId === undefined || u.currentUomId === q.uomId) &&
        (lotKey === null ||
          ledgerEntries.some((e) => e.id === u.firstLedgerEntryId && e.tracking.lotKey === lotKey)),
    );
    hits = unit?.currentUomId
      ? [
          {
            uomId: unit.currentUomId,
            onHand: dec8(unit.state === 'ON_HAND' || unit.state === 'RESERVED' ? SCALE : 0n),
            reserved: dec8(unit.state === 'RESERVED' ? SCALE : 0n),
            version: unit.version,
          },
        ]
      : [];
  } else {
    hits = computeAllBalances()
      .filter(
        (r) =>
          r.nodeId === node.id &&
          r.itemId === item.id &&
          r.lotKey === lotKey &&
          r.trackingMode !== 'SERIAL' &&
          (q.uomId === undefined || r.uomId === q.uomId),
      )
      .map((r) => ({
        uomId: r.uomId,
        onHand: r.onHandQuantity,
        reserved: r.reservedQuantity,
        version: balanceVersion(r.nodeId, r.itemId, r.uomId, r.lotKey),
      }));
  }

  if (hits.length > 1) {
    throw new ApiError(422, 'TRADE.INVENTORY.QUANTITY_INVALID', {
      reason: ['uom_required_for_ambiguous_balance'],
    });
  }
  const hit = hits[0];
  const onHand = hit?.onHand ?? '0';
  const reserved = hit?.reserved ?? '0';
  const uomId = hit?.uomId ?? q.uomId ?? null;
  const uom = uomId ? findUom(uomId) : undefined;
  return clone({
    nodeCode: node.code,
    nodeName: node.name,
    itemCode: item.canonicalCode,
    itemNames: { ...item.localizedNames },
    uomCode: uom?.code ?? null,
    nodeId: q.nodeId,
    itemId: q.itemId,
    uomId,
    onHandQuantity: onHand,
    reservedQuantity: reserved,
    availableQuantity: fromMicros(toMicros(onHand) - toMicros(reserved)),
    version: hit?.version ?? 0,
    asOf: nowIso(),
    advisory: true as const,
  });
}

/** Mirrors InventoryService.openingBalance; returns the raw balance and ledger records. */
export async function fakeRecordOpeningBalance(
  body: OpeningBalanceInput,
  key: string,
): Promise<OpeningBalanceResult> {
  await enterCall();
  // OpeningBalanceDto transport validation (400) runs before replay.
  if (typeof body.quantity !== 'string' || !POSITIVE_DECIMAL_PATTERN.test(body.quantity)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { quantity: ['invalid'] });
  }
  if (!Number.isInteger(body.itemProfileVersion) || body.itemProfileVersion < 1) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { itemProfileVersion: ['invalid'] });
  }
  if (typeof body.businessEffectiveAt !== 'string' || Number.isNaN(Date.parse(body.businessEffectiveAt))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { businessEffectiveAt: ['invalid'] });
  }
  if (typeof body.operationKey !== 'string' || !UUID_V7_PATTERN.test(body.operationKey)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { operationKey: ['invalid'] });
  }
  assertTrackingShape(body.tracking);
  const tracking: Record<string, unknown> = { ...(body.tracking ?? {}) };

  const replayed = replayIdempotent<OpeningBalanceResult>('openingBalance', key, body);
  if (replayed) return replayed;

  const node = nodes.find((n) => n.id === body.nodeId);
  if (!node || node.status !== 'ACTIVE') {
    throw new ApiError(404, 'TRADE.INVENTORY.NODE_NOT_FOUND');
  }
  const { item, profile } = requireStockProfile(body.itemId);
  if (body.itemProfileVersion !== profile.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  const { period, effectiveMs } = assertEffectiveDateInOpenPeriod(body.businessEffectiveAt);

  // governance.normalizeQuantity
  const baseUom = findUom(item.baseUomId);
  const inputUom = findUom(body.uomId);
  if (!baseUom || !inputUom) {
    throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
      reason: ['uom_not_registered_for_item'],
    });
  }
  let normalizedMicros = toMicros(body.quantity);
  let conversionRevisionId: string | null = null;
  if (inputUom.id !== baseUom.id) {
    const conv = uomConversions.find(
      (c) =>
        c.itemCompanyProfileId === profile.id &&
        c.fromUomId === inputUom.id &&
        c.toUomId === baseUom.id &&
        c.status === 'PUBLISHED' &&
        Date.parse(c.effectiveFrom) <= effectiveMs,
    );
    if (!conv) {
      throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE', {
        reason: ['no_published_revision'],
      });
    }
    const converted = multiplyMicros(normalizedMicros, conv.factorNumerator, conv.factorDenominator);
    if (converted === null || converted <= 0n) {
      throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', { reason: ['non_exact_result'] });
    }
    normalizedMicros = converted;
    conversionRevisionId = conv.id;
  }

  // assertTracking counts serials against the quantity as sent, then one base unit per serial.
  assertTracking(profile.trackingMode, body.quantity, tracking);
  if (profile.trackingMode === 'SERIAL' && normalizedMicros !== toMicros(body.quantity)) {
    throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED', {
      reason: ['serial_requires_one_base_unit'],
    });
  }

  const lotKey = typeof tracking['lotKey'] === 'string' ? tracking['lotKey'] : null;
  const serialKeys =
    profile.trackingMode === 'SERIAL' ? [...(tracking['serialKeys'] as string[])].sort() : [];
  const itemUnits = serialUnits.filter((u) => u.itemId === item.id);
  if (profile.trackingMode === 'SERIAL') {
    if (itemUnits.some((u) => serialKeys.includes(u.serialKey) && u.currentFulfillmentNodeId === node.id)) {
      throw new ApiError(409, 'TRADE.INVENTORY.QUANTITY_CONFLICT');
    }
  } else if (
    computeAllBalances().some(
      (b) => b.nodeId === node.id && b.itemId === item.id && b.uomId === baseUom.id && b.lotKey === lotKey,
    )
  ) {
    throw new ApiError(409, 'TRADE.INVENTORY.QUANTITY_CONFLICT');
  }
  // serialLedgerTracking(createUnits = true): any existing unit identity is a conflict.
  if (itemUnits.some((u) => serialKeys.includes(u.serialKey))) {
    throw new ApiError(409, 'TRADE.INVENTORY.SERIAL_CONFLICT');
  }

  const now = nowIso();
  const occurredAt = new Date(effectiveMs).toISOString();
  const entryId = fakeId();
  const normalizedText = fromMicros(normalizedMicros);
  const serialRefs = serialKeys.map((serialKey) => ({
    serialKey,
    serialUnitId: fakeId(),
    lifecycleEntryId: fakeId(),
  }));

  const balances: StockBalanceRecord[] = (serialKeys.length ? serialKeys : ['none']).map((serialKey) => ({
    id: fakeId(),
    companyId: COMPANY_ID,
    fulfillmentNodeId: node.id,
    itemCompanyProfileId: profile.id,
    uomId: baseUom.id,
    lotKey: lotKey ?? 'none',
    serialKey,
    onHandQuantity: profile.trackingMode === 'SERIAL' ? '1' : normalizedText,
    reservedQuantity: '0',
    negativeStockDecisionReceiptId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
  }));

  const ledgerTracking: InventoryTracking = {
    ...(lotKey !== null ? { lotKey } : {}),
    ...(typeof tracking['expiryDate'] === 'string' ? { expiryDate: tracking['expiryDate'] } : {}),
    ...(serialKeys.length ? { serialKeys: [...(tracking['serialKeys'] as string[])] } : {}),
  };
  const record: LedgerEntryRecord = {
    id: entryId,
    companyId: COMPANY_ID,
    fulfillmentNodeId: node.id,
    itemCompanyProfileId: profile.id,
    uomId: inputUom.id,
    signedQuantity: body.quantity,
    normalizedUomId: baseUom.id,
    normalizedSignedQuantity: normalizedText,
    uomConversionRevisionId: conversionRevisionId,
    inventoryPeriodId: period.id,
    policyDecisionReceiptId: null,
    movementType: 'OPENING_BALANCE',
    operationKey: body.operationKey,
    sourceType: null,
    sourceId: null,
    reversalOfId: null,
    occurredAt,
    tracking: { ...clone(tracking), ...(serialRefs.length ? { serialUnits: serialRefs } : {}) },
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
  };

  ledgerEntries.push({
    id: entryId,
    companyId: COMPANY_ID,
    fulfillmentNodeId: node.id,
    nodeCode: node.code,
    nodeName: node.name,
    itemCompanyProfileId: profile.id,
    itemId: item.id,
    itemCode: item.canonicalCode,
    itemNames: { ...item.localizedNames },
    uomId: inputUom.id,
    uomCode: inputUom.code,
    signedQuantity: body.quantity,
    normalizedUomId: baseUom.id,
    normalizedUomCode: baseUom.code,
    normalizedSignedQuantity: normalizedText,
    uomConversionRevisionId: conversionRevisionId,
    inventoryPeriodId: period.id,
    policyDecisionReceiptId: null,
    movementType: 'OPENING_BALANCE',
    operationKey: body.operationKey,
    sourceType: null,
    sourceId: null,
    sourceLineId: null,
    sourceNumber: null,
    reversalOfId: null,
    occurredAt,
    tracking: ledgerTracking,
    remainingReversibleQuantity: null,
    createdAt: now,
    createdBy: CURRENT_USER_ID,
  });

  for (const ref of serialRefs) {
    serialUnits.push({
      id: ref.serialUnitId,
      companyId: COMPANY_ID,
      itemId: item.id,
      itemCompanyProfileId: profile.id,
      serialKey: ref.serialKey,
      state: 'ON_HAND',
      currentFulfillmentNodeId: node.id,
      currentUomId: baseUom.id,
      currentReservationId: null,
      firstLedgerEntryId: entryId,
      currentLedgerEntryId: entryId,
      lastTransitionAt: occurredAt,
      version: 1,
      itemCode: item.canonicalCode,
      itemNames: { ...item.localizedNames },
      currentNodeCode: node.code,
      currentNodeName: node.name,
      currentUomCode: baseUom.code,
      lifecycle: [
        {
          id: ref.lifecycleEntryId,
          serialUnitId: ref.serialUnitId,
          serialKey: ref.serialKey,
          eventType: 'OPENING',
          operationKey: body.operationKey,
          // Backend trigger: COALESCE(ledger.source_type, 'LEDGER'), COALESCE(ledger.source_id, ledger.id).
          sourceType: 'LEDGER',
          sourceId: entryId,
          ledgerEntryId: entryId,
          reservationId: null,
          fromState: null,
          toState: 'ON_HAND',
          fulfillmentNodeId: node.id,
          nodeCode: node.code,
          nodeName: node.name,
          uomId: baseUom.id,
          uomCode: baseUom.code,
          occurredAt,
        },
      ],
    });
  }

  const result: OpeningBalanceResult = { balance: balances[0], balances, ledger: record };
  saveIdempotent('openingBalance', key, body, result);
  return clone(result);
}

export async function fakeListNodes(q: NodeListQuery = {}): Promise<FulfillmentNode[]> {
  await enterCall();
  const branchId = currentBranchId();
  const list = nodes
    .filter((n) => (n.branches ?? []).some((b) => b.branchId === branchId && b.isActive))
    .filter((n) => !q.status || n.status === q.status)
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code));
  return clone(list);
}

export async function fakeListCompanyNodes(q: CompanyNodeQuery): Promise<Page<CompanyNode>> {
  await enterCall();
  let matched = nodes.slice();

  if (q.status) {
    matched = matched.filter((n) => n.status === q.status);
  }
  if (q.nodeType) {
    matched = matched.filter((n) => n.nodeType === q.nodeType);
  }
  if (q.branchId) {
    matched = matched.filter((n) =>
      (n.branches ?? []).some((b) => b.branchId === q.branchId && b.isActive),
    );
  }
  const needle = q.search?.trim().toLowerCase() ?? '';
  if (needle) {
    matched = matched.filter(
      (n) =>
        n.code.toLowerCase().startsWith(needle) || n.name.toLowerCase().includes(needle),
    );
  }

  matched.sort((a, b) => a.code.localeCompare(b.code));
  const companyNodes = matched.map(toCompanyNode);
  return paginate(companyNodes, q.page, q.limit);
}

export async function fakeGetCompanyNode(id: string): Promise<CompanyNode> {
  await enterCall();
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    throw new ApiError(404, 'TRADE.INVENTORY.NODE_NOT_FOUND');
  }
  return toCompanyNode(node);
}

export async function fakeGetNode(id: string): Promise<FulfillmentNode> {
  await enterCall();
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    throw new ApiError(404, 'TRADE.INVENTORY.NODE_NOT_FOUND');
  }
  return clone(node);
}

export async function fakeCreateNode(body: CreateNodeBody, key: string): Promise<FulfillmentNode> {
  await enterCall();
  const replayed = replayIdempotent<FulfillmentNode>('createNode', key, body);
  if (replayed) return replayed;

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';

  if (
    !code ||
    code.length > INVENTORY_LIMITS.nodeCode ||
    !name ||
    name.length > INVENTORY_LIMITS.nodeName ||
    !timezone ||
    !NODE_TYPES.has(body.nodeType)
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  if (nodes.some((n) => n.companyId === COMPANY_ID && n.code.toUpperCase() === code)) {
    throw new ApiError(409, 'TRADE.INVENTORY.NODE_CONFLICT');
  }

  const branchIds = validateBranchIds(COMPANY_ID, body.branchIds);
  const now = nowIso();
  const id = fakeId();
  const nodeBranches: NodeBranch[] = branchIds.map((branchId) => ({
    id: fakeId(),
    fulfillmentNodeId: id,
    companyId: COMPANY_ID,
    branchId,
    isActive: true,
    version: 1,
  }));

  const created: FulfillmentNode = {
    id,
    companyId: COMPANY_ID,
    code,
    name,
    nodeType: body.nodeType,
    status: 'ACTIVE',
    timezone,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER_ID,
    updatedBy: CURRENT_USER_ID,
    branches: nodeBranches,
  };
  nodes.push(created);
  saveIdempotent('createNode', key, body, created);
  return clone(created);
}

export async function fakeUpdateNode(
  id: string,
  version: number,
  patch: UpdateNodePatch,
  key: string,
): Promise<FulfillmentNode> {
  await enterCall();
  const replayed = replayIdempotent<FulfillmentNode>('updateNode', key, { id, version, patch });
  if (replayed) return replayed;

  const raw = patch as Record<string, unknown>;
  if (raw['code'] !== undefined || raw['nodeType'] !== undefined) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const node = nodes.find((n) => n.id === id);
  if (!node) {
    throw new ApiError(404, 'TRADE.INVENTORY.NODE_NOT_FOUND');
  }
  if (node.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  let nextName = node.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed || trimmed.length > INVENTORY_LIMITS.nodeName) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { name: ['invalid'] });
    }
    nextName = trimmed;
  }

  let nextTimezone = node.timezone;
  if (patch.timezone !== undefined) {
    const trimmed = patch.timezone.trim();
    if (!trimmed) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { timezone: ['invalid'] });
    }
    nextTimezone = trimmed;
  }

  let nextStatus = node.status;
  if (patch.status !== undefined) {
    if (!NODE_STATUSES.has(patch.status)) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { status: ['invalid'] });
    }
    nextStatus = patch.status;
  }

  const nextBranchIds =
    patch.branchIds !== undefined ? validateBranchIds(node.companyId, patch.branchIds) : null;

  if (nodeHasOpenWork(node.id)) {
    if (nextStatus === 'INACTIVE') {
      throw new ApiError(409, 'TRADE.INVENTORY.NODE_IN_USE');
    }
    if (nextBranchIds !== null) {
      const nextSet = new Set(nextBranchIds);
      const removedActiveBranch = (node.branches ?? []).some(
        (b) => b.isActive && !nextSet.has(b.branchId),
      );
      if (removedActiveBranch) {
        throw new ApiError(409, 'TRADE.INVENTORY.NODE_IN_USE');
      }
    }
  }

  const now = nowIso();
  node.name = nextName;
  node.timezone = nextTimezone;
  node.status = nextStatus;

  if (nextBranchIds !== null) {
    const currentByBranch = new Map((node.branches ?? []).map((b) => [b.branchId, b]));
    const updatedBranches: NodeBranch[] = [];
    const nextSet = new Set(nextBranchIds);

    for (const branchId of nextBranchIds) {
      const existingLink = currentByBranch.get(branchId);
      if (existingLink) {
        if (!existingLink.isActive) {
          existingLink.isActive = true;
          existingLink.version += 1;
        }
        updatedBranches.push(existingLink);
      } else {
        updatedBranches.push({
          id: fakeId(),
          fulfillmentNodeId: node.id,
          companyId: node.companyId,
          branchId,
          isActive: true,
          version: 1,
        });
      }
    }
    for (const existingLink of node.branches ?? []) {
      if (!nextSet.has(existingLink.branchId)) {
        existingLink.isActive = false;
        existingLink.version += 1;
        updatedBranches.push(existingLink);
      }
    }
    node.branches = updatedBranches;
  }

  node.version += 1;
  node.updatedAt = now;
  node.updatedBy = CURRENT_USER_ID;

  saveIdempotent('updateNode', key, { id, version, patch }, node);
  return clone(node);
}

export async function fakeListPeriods(q: PeriodQuery): Promise<Page<InventoryPeriod>> {
  await enterCall();
  let matched = periods.slice();
  if (q.status) {
    matched = matched.filter((p) => p.status === q.status);
  }
  if (q.effectiveAt) {
    const day = q.effectiveAt.trim().slice(0, 10);
    matched = matched.filter((p) => p.startsOn <= day && p.endsOn >= day);
  }
  matched.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  return paginate(matched, q.page, q.limit);
}

export async function fakeCreatePeriod(
  body: CreatePeriodBody,
  key: string,
): Promise<InventoryPeriod> {
  await enterCall();
  const replayed = replayIdempotent<InventoryPeriod>('createPeriod', key, body);
  if (replayed) return replayed;

  // Backend stores dto.code exactly as sent; the DTO pattern already requires upper case.
  const code = typeof body.code === 'string' ? body.code : '';
  const startsOn = typeof body.startsOn === 'string' ? parseDayString(body.startsOn) : null;
  const endsOn = typeof body.endsOn === 'string' ? parseDayString(body.endsOn) : null;

  if (
    !CODE_PATTERN.test(code) ||
    code.length > INVENTORY_LIMITS.periodCode ||
    !startsOn ||
    !endsOn ||
    !Number.isInteger(body.maxBackdateDays) ||
    body.maxBackdateDays < 0 ||
    body.maxBackdateDays > INVENTORY_LIMITS.maxBackdateDays
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  if (endsOn < startsOn) {
    throw new ApiError(422, 'TRADE.INVENTORY.PERIOD_CLOSED', { reason: ['invalid_range'] });
  }

  if (periods.some((p) => p.startsOn <= endsOn && p.endsOn >= startsOn)) {
    throw new ApiError(422, 'TRADE.INVENTORY.PERIOD_CLOSED', { reason: ['overlapping_period'] });
  }

  // Unique (company_id, code): the backend fix maps the violation to this 409 (pending).
  if (periods.some((p) => p.code === code)) {
    throw new ApiError(409, 'TRADE.INVENTORY.PERIOD_CODE_TAKEN', { field: ['code'] });
  }

  const now = nowIso();
  const created: InventoryPeriod = {
    id: fakeId(),
    companyId: COMPANY_ID,
    code,
    startsOn,
    endsOn,
    status: 'OPEN',
    maxBackdateDays: body.maxBackdateDays,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER_ID,
  };
  periods.push(created);
  saveIdempotent('createPeriod', key, body, created);
  return clone(created);
}

export async function fakeClosePeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<InventoryPeriod> {
  await enterCall();
  const payload = { id, version, reasonCode };
  const replayed = replayIdempotent<InventoryPeriod>('closePeriod', key, payload);
  if (replayed) return replayed;

  const period = periods.find((p) => p.id === id);
  if (!period) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  if (period.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  if (period.status !== 'OPEN') {
    throw new ApiError(422, 'TRADE.INVENTORY.PERIOD_CLOSED', {
      reason: ['transition_not_allowed'],
    });
  }

  const validCode = assertActiveReason('INVENTORY_PERIOD_CLOSE', reasonCode);
  const now = nowIso();
  period.status = 'CLOSED';
  period.closedAt = now;
  period.closedBy = CURRENT_USER_ID;
  period.closeReason = validCode;
  period.version += 1;
  period.updatedAt = now;

  saveIdempotent('closePeriod', key, payload, period);
  return clone(period);
}

export async function fakeReopenPeriod(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<InventoryPeriod> {
  await enterCall();
  const payload = { id, version, reasonCode };
  const replayed = replayIdempotent<InventoryPeriod>('reopenPeriod', key, payload);
  if (replayed) return replayed;

  const period = periods.find((p) => p.id === id);
  if (!period) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  if (period.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  if (period.status !== 'CLOSED') {
    throw new ApiError(422, 'TRADE.INVENTORY.PERIOD_CLOSED', {
      reason: ['transition_not_allowed'],
    });
  }

  assertActiveReason('INVENTORY_PERIOD_REOPEN', reasonCode);

  const overlapsOpen = periods.some(
    (p) =>
      p.id !== period.id &&
      p.status === 'OPEN' &&
      p.startsOn <= period.endsOn &&
      p.endsOn >= period.startsOn,
  );
  if (overlapsOpen) {
    throw new ApiError(422, 'TRADE.INVENTORY.PERIOD_CLOSED', {
      reason: ['overlapping_open_period'],
    });
  }

  const now = nowIso();
  period.status = 'OPEN';
  period.closedAt = null;
  period.closedBy = null;
  period.closeReason = null;
  period.version += 1;
  period.updatedAt = now;

  saveIdempotent('reopenPeriod', key, payload, period);
  return clone(period);
}

export async function fakeListUomConversions(
  q: UomConversionQuery,
): Promise<Page<UomConversionRevision>> {
  await enterCall();
  let matched = uomConversions.slice();
  if (q.itemCompanyProfileId) {
    matched = matched.filter((c) => c.itemCompanyProfileId === q.itemCompanyProfileId);
  }
  if (q.fromUomId) {
    matched = matched.filter((c) => c.fromUomId === q.fromUomId);
  }
  if (q.toUomId) {
    matched = matched.filter((c) => c.toUomId === q.toUomId);
  }
  if (q.status) {
    matched = matched.filter((c) => c.status === q.status);
  }

  matched.sort((a, b) => {
    const byProfile = a.itemCompanyProfileId.localeCompare(b.itemCompanyProfileId);
    if (byProfile !== 0) return byProfile;
    return b.revisionNumber - a.revisionNumber;
  });

  return paginate(matched, q.page, q.limit);
}

export async function fakeCreateUomConversion(
  body: CreateUomConversionBody,
  key: string,
): Promise<UomConversionRevision> {
  await enterCall();
  const replayed = replayIdempotent<UomConversionRevision>('createUomConversion', key, body);
  if (replayed) return replayed;

  const num = typeof body.factorNumerator === 'string' ? body.factorNumerator.trim() : '';
  const den = typeof body.factorDenominator === 'string' ? body.factorDenominator.trim() : '';
  const effMs = Date.parse(body.effectiveFrom);
  if (!FACTOR_PATTERN.test(num) || !FACTOR_PATTERN.test(den) || Number.isNaN(effMs)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  if (body.fromUomId === body.toUomId) {
    throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
      reason: ['identity_not_required'],
    });
  }

  const profile = TRADE_FAKE_DB.companyProfiles.find(
    (p) => p.id === body.itemCompanyProfileId && p.companyId === COMPANY_ID,
  );
  const item = profile
    ? TRADE_FAKE_DB.items.find((i) => i.id === profile.itemId && i.deletedAt === null)
    : undefined;
  if (!profile || !item || !profile.trackInventory || profile.status !== 'ACTIVE') {
    throw new ApiError(422, 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED');
  }

  const registeredFromIds = new Set<string>([item.baseUomId]);
  if (profile.defaultSalesUomId) registeredFromIds.add(profile.defaultSalesUomId);
  if (profile.defaultPurchaseUomId) registeredFromIds.add(profile.defaultPurchaseUomId);

  const fromUom = findUom(body.fromUomId);
  const toUom = findUom(body.toUomId);
  if (
    !fromUom ||
    !toUom ||
    body.toUomId !== item.baseUomId ||
    !registeredFromIds.has(body.fromUomId)
  ) {
    throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
      reason: ['uom_not_registered_for_item'],
    });
  }

  const lastRev = uomConversions
    .filter(
      (c) =>
        c.itemCompanyProfileId === profile.id &&
        c.fromUomId === fromUom.id &&
        c.toUomId === toUom.id,
    )
    .reduce((max, c) => (c.revisionNumber > max ? c.revisionNumber : max), 0);

  const now = nowIso();
  const created: UomConversionRevision = {
    id: fakeId(),
    companyId: COMPANY_ID,
    itemCompanyProfileId: profile.id,
    fromUomId: fromUom.id,
    toUomId: toUom.id,
    revisionNumber: lastRev + 1,
    factorNumerator: num,
    factorDenominator: den,
    status: 'DRAFT',
    effectiveFrom: new Date(effMs).toISOString(),
    contentHash: `hash-${profile.id}-${fromUom.code}-${num}-${den}`,
    publishedAt: null,
    publishedBy: null,
    retiredAt: null,
    retiredBy: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    itemId: item.id,
    itemCode: item.canonicalCode,
    itemNames: { ...item.localizedNames },
    fromUomCode: fromUom.code,
    toUomCode: toUom.code,
    publishReasonCode: null,
    retireReasonCode: null,
  };

  uomConversions.push(created);
  saveIdempotent('createUomConversion', key, body, created);
  return clone(created);
}

export async function fakePublishUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<UomConversionRevision> {
  await enterCall();
  const payload = { id, version, reasonCode };
  const replayed = replayIdempotent<UomConversionRevision>('publishUomConversion', key, payload);
  if (replayed) return replayed;

  const conv = uomConversions.find((c) => c.id === id);
  if (!conv) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  if (conv.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  if (conv.status !== 'DRAFT') {
    throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
      reason: ['transition_not_allowed'],
    });
  }

  const validCode = assertActiveReason('INVENTORY_UOM_PUBLISH', reasonCode);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  const predecessor = uomConversions.find(
    (c) =>
      c.id !== conv.id &&
      c.itemCompanyProfileId === conv.itemCompanyProfileId &&
      c.fromUomId === conv.fromUomId &&
      c.toUomId === conv.toUomId &&
      c.status === 'PUBLISHED',
  );

  if (predecessor) {
    const draftEffMs = Date.parse(conv.effectiveFrom);
    if (draftEffMs > nowMs) {
      throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
        reason: ['future_replacement_unsupported'],
      });
    }
    if (draftEffMs <= Date.parse(predecessor.effectiveFrom)) {
      throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
        reason: ['effective_from_not_after_predecessor'],
      });
    }
    predecessor.status = 'RETIRED';
    predecessor.retiredAt = now;
    predecessor.retiredBy = CURRENT_USER_ID;
    predecessor.retireReasonCode = 'REPLACED';
    predecessor.version += 1;
    predecessor.updatedAt = now;
  }

  conv.status = 'PUBLISHED';
  conv.publishedAt = now;
  conv.publishedBy = CURRENT_USER_ID;
  conv.publishReasonCode = validCode;
  conv.version += 1;
  conv.updatedAt = now;

  saveIdempotent('publishUomConversion', key, payload, conv);
  return clone(conv);
}

export async function fakeRetireUomConversion(
  id: string,
  version: number,
  reasonCode: string,
  key: string,
): Promise<UomConversionRevision> {
  await enterCall();
  const payload = { id, version, reasonCode };
  const replayed = replayIdempotent<UomConversionRevision>('retireUomConversion', key, payload);
  if (replayed) return replayed;

  const conv = uomConversions.find((c) => c.id === id);
  if (!conv) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  if (conv.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  if (conv.status !== 'PUBLISHED') {
    throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
      reason: ['transition_not_allowed'],
    });
  }

  const validCode = assertActiveReason('INVENTORY_UOM_RETIRE', reasonCode);
  const now = nowIso();
  conv.status = 'RETIRED';
  conv.retiredAt = now;
  conv.retiredBy = CURRENT_USER_ID;
  conv.retireReasonCode = validCode;
  conv.version += 1;
  conv.updatedAt = now;

  saveIdempotent('retireUomConversion', key, payload, conv);
  return clone(conv);
}

function sourceKindOf(sourceType: LedgerEntry['sourceType']): 'RECEIPT' | 'DELIVERY' | null {
  if (sourceType === 'RECEIPT' || sourceType === 'RECEIPT_REVERSAL') return 'RECEIPT';
  if (sourceType === 'DELIVERY' || sourceType === 'DELIVERY_REVERSAL') return 'DELIVERY';
  return null;
}

export async function fakeListMovements(q: MovementQuery): Promise<Page<LedgerEntry>> {
  await enterCall();

  if (q.movementType && q.group) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { movementType: ['EXCLUSIVE_WITH_GROUP'] });
  }
  if (q.from && q.to && q.to < q.from) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { to: ['BEFORE_FROM'] });
  }

  let matched = ledgerEntries.slice();
  if (q.nodeId) {
    matched = matched.filter((e) => e.fulfillmentNodeId === q.nodeId);
  }
  if (q.itemId) {
    matched = matched.filter((e) => e.itemId === q.itemId);
  }
  if (q.itemCompanyProfileId) {
    matched = matched.filter((e) => e.itemCompanyProfileId === q.itemCompanyProfileId);
  }
  if (q.operationKey) {
    matched = matched.filter((e) => e.operationKey === q.operationKey);
  }
  if (q.movementType) {
    matched = matched.filter((e) => e.movementType === q.movementType);
  }
  if (q.group) {
    matched = matched.filter((e) => movementGroup(e.movementType) === q.group);
  }
  if (q.from) {
    const fromDay = q.from.trim().slice(0, 10);
    matched = matched.filter((e) => e.occurredAt.slice(0, 10) >= fromDay);
  }
  if (q.to) {
    const toDay = q.to.trim().slice(0, 10);
    matched = matched.filter((e) => e.occurredAt.slice(0, 10) <= toDay);
  }
  if (q.sourceType) {
    matched = matched.filter((e) => sourceKindOf(e.sourceType) === q.sourceType);
  }
  if (q.sourceId) {
    matched = matched.filter((e) => e.sourceId === q.sourceId);
  }

  const searchRaw = q.search?.trim() ?? '';
  if (searchRaw) {
    const searchLower = searchRaw.toLowerCase();
    matched = matched.filter(
      (e) =>
        e.operationKey === searchRaw ||
        (e.sourceNumber !== null && e.sourceNumber.toLowerCase().startsWith(searchLower)),
    );
  }

  matched.sort((a, b) => {
    const byDate = b.occurredAt.localeCompare(a.occurredAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const decorated = matched.map(decorateLedgerEntry);
  return paginate(decorated, q.page, q.limit);
}

export async function fakeGetMovement(id: string): Promise<LedgerEntryDetail> {
  await enterCall();

  const entry = ledgerEntries.find((e) => e.id === id);
  if (!entry) {
    throw new ApiError(404, 'TRADE.INVENTORY.MOVEMENT_NOT_FOUND');
  }

  const decorated = decorateLedgerEntry(entry);
  const period = entry.inventoryPeriodId
    ? periods.find((p) => p.id === entry.inventoryPeriodId) ?? null
    : null;
  const conv = entry.uomConversionRevisionId
    ? uomConversions.find((c) => c.id === entry.uomConversionRevisionId) ?? null
    : null;
  const reversals = ledgerEntries
    .filter((e) => e.reversalOfId === entry.id)
    .slice()
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
    .map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      normalizedSignedQuantity: text8(e.normalizedSignedQuantity),
      operationKey: e.operationKey,
    }));

  const sourceKind = sourceKindOf(entry.sourceType);
  const src =
    sourceKind !== null && entry.sourceId !== null
      ? movementSources.find((s) => s.kind === sourceKind && s.id === entry.sourceId) ?? null
      : null;

  return clone({
    ...decorated,
    // Ledger rows are immutable: their version column stays 1.
    version: 1,
    periodCode: period?.code ?? null,
    uomConversion: conv
      ? {
          revisionId: conv.id,
          revisionNumber: conv.revisionNumber,
          fromUomId: conv.fromUomId,
          fromUomCode: conv.fromUomCode,
          toUomId: conv.toUomId,
          toUomCode: conv.toUomCode,
          factorNumerator: conv.factorNumerator,
          factorDenominator: conv.factorDenominator,
        }
      : null,
    reversals,
    source:
      src && sourceKind
        ? {
            kind: sourceKind,
            id: src.id,
            status: src.status,
            version: src.version,
          }
        : null,
  });
}

export async function fakeGetMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
): Promise<MovementSource> {
  await enterCall();
  const src = movementSources.find((s) => s.kind === kind && s.id === id);
  if (!src) {
    throw new ApiError(
      404,
      kind === 'RECEIPT'
        ? 'TRADE.INVENTORY.RECEIPT_NOT_FOUND'
        : 'TRADE.INVENTORY.DELIVERY_NOT_FOUND',
    );
  }
  return sourceProjection(src);
}

interface PlannedLineReversal {
  line: SourceLine;
  mode: 'NONE' | 'LOT' | 'SERIAL';
  requested: string | undefined;
  serialKeys: string[];
}

/** Raw receipt/delivery record as the reverse endpoint returns it (`{ ...receipt, lines }`). */
function sourceRecord(src: MovementSource): MovementSourceRecord {
  const receipt = src.kind === 'RECEIPT';
  return clone({
    id: src.id,
    companyId: COMPANY_ID,
    branchId: src.branchId,
    fulfillmentNodeId: src.fulfillmentNodeId,
    ...(receipt ? { purchaseOrderId: src.documentId } : { salesOrderId: src.documentId }),
    operationKey: src.operationKey,
    status: src.status,
    businessEffectiveAt: src.businessEffectiveAt,
    inventoryPeriodId: src.inventoryPeriodId,
    policyDecisionReceiptId: src.policyDecisionReceiptId,
    postedAt: src.postedAt,
    version: src.version,
    createdAt: src.createdAt,
    updatedAt: nowIso(),
    createdBy: src.createdBy,
    updatedBy: CURRENT_USER_ID,
    lines: src.lines.map(
      (line): SourceLineRecord => ({
        id: line.id,
        ...(receipt
          ? { receiptId: src.id, purchaseOrderId: src.documentId, purchaseOrderLineId: line.documentLineId }
          : {
              deliveryId: src.id,
              salesOrderId: src.documentId,
              salesOrderLineId: line.documentLineId,
              reservationId: line.reservationId ?? null,
            }),
        companyId: COMPANY_ID,
        branchId: src.branchId,
        fulfillmentNodeId: src.fulfillmentNodeId,
        itemCompanyProfileId: line.itemCompanyProfileId,
        uomId: line.uomId,
        descriptionSnapshot: line.descriptionSnapshot,
        quantity: line.quantity,
        normalizedUomId: line.normalizedUomId,
        normalizedQuantity: line.normalizedQuantity,
        uomConversionRevisionId:
          ledgerEntries.find((e) => e.id === line.ledgerEntryId)?.uomConversionRevisionId ?? null,
        reversedQuantity: line.reversedQuantity,
        normalizedReversedQuantity: line.normalizedReversedQuantity,
        tracking: clone(line.tracking),
        ledgerEntryId: line.ledgerEntryId,
        policyDecisionReceiptId: line.policyDecisionReceiptId,
        version: line.version,
        createdAt: src.createdAt,
        updatedAt: nowIso(),
        createdBy: src.createdBy,
        updatedBy: CURRENT_USER_ID,
      }),
    ),
  });
}

/** Mirrors InventoryService.reverseReceipt / reverseDelivery and selectReversalSerials. */
export async function fakeReverseMovementSource(
  kind: 'RECEIPT' | 'DELIVERY',
  id: string,
  version: number,
  body: ReverseMovementInput,
  key: string,
): Promise<MovementSourceRecord> {
  await enterCall();
  // ReverseMovementDto transport validation (400).
  if (typeof body.reasonCode !== 'string' || !INVENTORY_REASON_CODE.test(body.reasonCode)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { reasonCode: ['invalid'] });
  }
  if (typeof body.businessEffectiveAt !== 'string' || Number.isNaN(Date.parse(body.businessEffectiveAt))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { businessEffectiveAt: ['invalid'] });
  }
  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 500) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { lines: ['invalid'] });
    }
    for (const reqLine of body.lines) {
      if (typeof reqLine.quantity !== 'string' || !POSITIVE_DECIMAL_PATTERN.test(reqLine.quantity)) {
        throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { quantity: ['invalid'] });
      }
      assertSerialKeysShape(reqLine.serialKeys, 'serialKeys');
    }
    // assertUnique(lineIds) runs before the idempotent work.
    if (new Set(body.lines.map((l) => l.lineId)).size !== body.lines.length) {
      throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
    }
  }

  const payload = { kind, id, version, body };
  const replayed = replayIdempotent<MovementSourceRecord>('reverseMovementSource', key, payload);
  if (replayed) return replayed;

  const src = movementSources.find((s) => s.kind === kind && s.id === id);
  if (!src) {
    throw new ApiError(
      404,
      kind === 'RECEIPT'
        ? 'TRADE.INVENTORY.RECEIPT_NOT_FOUND'
        : 'TRADE.INVENTORY.DELIVERY_NOT_FOUND',
    );
  }
  const effectiveMs = Date.parse(body.businessEffectiveAt);
  if (effectiveMs < Date.parse(src.businessEffectiveAt)) {
    throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED', {
      reason: ['reversal_before_original'],
    });
  }
  if (src.version !== version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  if (src.status !== 'POSTED' && src.status !== 'PARTIALLY_REVERSED') {
    throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
  }
  const validReason = assertActiveReason('INVENTORY_REVERSAL', body.reasonCode);
  const { period } = assertEffectiveDateInOpenPeriod(body.businessEffectiveAt);

  const requestedById = new Map((body.lines ?? []).map((l) => [l.lineId, l]));
  const selectedLines = body.lines
    ? src.lines.filter((l) => requestedById.has(l.id))
    : src.lines.filter((l) => toMicros(l.quantity) > toMicros(l.reversedQuantity));
  if (selectedLines.length === 0 || (body.lines && selectedLines.length !== body.lines.length)) {
    throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
  }

  // selectReversalSerials
  const plans: PlannedLineReversal[] = selectedLines.map((line) => {
    const request = requestedById.get(line.id);
    const mode = trackingModeOf(line);
    if (mode !== 'SERIAL') {
      if (request?.serialKeys) throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_UNSUPPORTED');
      return { line, mode, requested: request?.quantity, serialKeys: [] };
    }
    const reversed = new Set(line.reversedSerialKeys);
    const remaining = (line.tracking.serialKeys ?? []).filter((k) => !reversed.has(k));
    const keys = request?.serialKeys ?? remaining;
    assertSerialKeys(keys, request?.quantity);
    if (
      keys.some((k) => !remaining.includes(k)) ||
      (!request?.serialKeys &&
        request?.quantity !== undefined &&
        toMicros(request.quantity) !== BigInt(remaining.length) * SCALE)
    ) {
      throw new ApiError(422, 'TRADE.INVENTORY.TRACKING_REQUIRED');
    }
    return { line, mode, requested: request?.quantity, serialKeys: [...keys].sort() };
  });

  // Quantities are in the document's own unit; the normalized part is proportional and must be exact.
  const applied = plans
    .slice()
    .sort((a, b) => a.line.id.localeCompare(b.line.id))
    .map((plan) => {
      const { line } = plan;
      const total = toMicros(line.quantity);
      const reversible = total - toMicros(line.reversedQuantity);
      const quantity = plan.requested !== undefined ? toMicros(plan.requested) : reversible;
      if (total <= 0n || quantity <= 0n || quantity > total) {
        throw new ApiError(422, 'TRADE.INVENTORY.QUANTITY_INVALID');
      }
      const product = quantity * toMicros(line.normalizedQuantity);
      if (product % total !== 0n) {
        throw new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
          reason: ['non_exact_proportional_result'],
        });
      }
      const normalized = product / total;
      if (
        kind === 'RECEIPT' &&
        plan.mode === 'SERIAL' &&
        plan.serialKeys.some((k) => {
          const unit = serialUnits.find((u) => u.itemId === line.itemId && u.serialKey === k);
          return !unit || unit.state !== 'ON_HAND' || unit.currentFulfillmentNodeId !== src.fulfillmentNodeId;
        })
      ) {
        throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
      }
      if (reversible <= 0n || quantity > reversible || !line.ledgerEntryId) {
        throw new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED');
      }
      return { plan, quantity, normalized };
    });

  const now = nowIso();
  const occurredAt = new Date(effectiveMs).toISOString();
  const node = nodeById(src.fulfillmentNodeId);
  const signFactor = kind === 'RECEIPT' ? -1n : 1n;

  for (const { plan, quantity, normalized } of applied) {
    const { line } = plan;
    const origLedger = ledgerEntries.find((l) => l.id === line.ledgerEntryId) ?? null;

    line.reversedQuantity = fromMicros(toMicros(line.reversedQuantity) + quantity);
    line.normalizedReversedQuantity = fromMicros(toMicros(line.normalizedReversedQuantity) + normalized);
    if (plan.serialKeys.length > 0) {
      line.reversedSerialKeys = [...line.reversedSerialKeys, ...plan.serialKeys];
    }
    line.version += 1;

    const reversalId = fakeId();
    const revOpKey = fakeId();
    const reversalTracking: InventoryTracking & { reversalReasonCode?: string } = {
      ...(line.tracking.lotKey ? { lotKey: line.tracking.lotKey } : {}),
      ...(line.tracking.expiryDate ? { expiryDate: line.tracking.expiryDate } : {}),
      ...(plan.serialKeys.length > 0 ? { serialKeys: [...plan.serialKeys] } : {}),
      reversalReasonCode: validReason,
    };

    ledgerEntries.push({
      id: reversalId,
      companyId: COMPANY_ID,
      fulfillmentNodeId: node.id,
      nodeCode: node.code,
      nodeName: node.name,
      itemCompanyProfileId: line.itemCompanyProfileId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemNames: { ...line.itemNames },
      uomId: line.uomId,
      uomCode: line.uomCode,
      signedQuantity: fromMicros(quantity * signFactor),
      normalizedUomId: line.normalizedUomId,
      normalizedUomCode: line.normalizedUomCode,
      normalizedSignedQuantity: fromMicros(normalized * signFactor),
      uomConversionRevisionId: origLedger?.uomConversionRevisionId ?? null,
      inventoryPeriodId: period.id,
      policyDecisionReceiptId: null,
      movementType: kind === 'RECEIPT' ? 'PURCHASE_RECEIPT_REVERSAL' : 'SALES_DELIVERY_REVERSAL',
      operationKey: revOpKey,
      sourceType: kind === 'RECEIPT' ? 'RECEIPT_REVERSAL' : 'DELIVERY_REVERSAL',
      sourceId: src.id,
      sourceLineId: null,
      sourceNumber: src.documentNumber,
      reversalOfId: origLedger?.id ?? null,
      occurredAt,
      tracking: reversalTracking,
      remainingReversibleQuantity: null,
      createdAt: now,
      createdBy: CURRENT_USER_ID,
    });

    for (const sk of plan.serialKeys) {
      const unit = serialUnits.find((u) => u.itemId === line.itemId && u.serialKey === sk);
      if (!unit) continue;
      const prevState = unit.state;
      const nextState: SerialState = kind === 'RECEIPT' ? 'VOIDED' : 'ON_HAND';
      unit.state = nextState;
      unit.currentFulfillmentNodeId = kind === 'RECEIPT' ? null : node.id;
      unit.currentNodeCode = kind === 'RECEIPT' ? null : node.code;
      unit.currentNodeName = kind === 'RECEIPT' ? null : node.name;
      unit.currentUomId = kind === 'RECEIPT' ? null : line.normalizedUomId;
      unit.currentUomCode = kind === 'RECEIPT' ? null : line.normalizedUomCode;
      unit.currentReservationId = null;
      unit.currentLedgerEntryId = reversalId;
      unit.lastTransitionAt = occurredAt;
      unit.version += 1;
      unit.lifecycle.push({
        id: fakeId(),
        serialUnitId: unit.id,
        serialKey: unit.serialKey,
        eventType: kind === 'RECEIPT' ? 'RECEIPT_REVERSAL' : 'DELIVERY_REVERSAL',
        operationKey: revOpKey,
        sourceType: kind === 'RECEIPT' ? 'RECEIPT_REVERSAL' : 'DELIVERY_REVERSAL',
        sourceId: src.id,
        ledgerEntryId: reversalId,
        reservationId: null,
        fromState: prevState,
        toState: nextState,
        fulfillmentNodeId: kind === 'RECEIPT' ? null : node.id,
        nodeCode: kind === 'RECEIPT' ? null : node.code,
        nodeName: kind === 'RECEIPT' ? null : node.name,
        uomId: line.normalizedUomId,
        uomCode: line.normalizedUomCode,
        occurredAt,
      });
    }
  }

  const allReversed = src.lines.every((l) => toMicros(l.quantity) - toMicros(l.reversedQuantity) <= 0n);
  src.status = allReversed ? 'REVERSED' : 'PARTIALLY_REVERSED';
  src.version += 1;

  const result = sourceRecord(src);
  saveIdempotent('reverseMovementSource', key, payload, result);
  return clone(result);
}

function trackingModeOf(line: SourceLine): 'NONE' | 'LOT' | 'SERIAL' {
  const info = findItemAndProfile(line.itemId);
  if (info?.profile) return info.profile.trackingMode;
  if ((line.tracking.serialKeys ?? []).length > 0) return 'SERIAL';
  return line.tracking.lotKey ? 'LOT' : 'NONE';
}

export async function fakeListSerials(q: SerialQuery): Promise<Page<SerialUnit>> {
  await enterCall();
  let matched = serialUnits.slice();
  if (q.itemId) {
    matched = matched.filter((s) => s.itemId === q.itemId);
  }
  if (q.itemCompanyProfileId) {
    matched = matched.filter((s) => s.itemCompanyProfileId === q.itemCompanyProfileId);
  }
  if (q.serialKey !== undefined && q.serialKey.trim() !== '') {
    const exact = q.serialKey.trim();
    matched = matched.filter((s) => s.serialKey === exact);
  }
  if (q.state) {
    matched = matched.filter((s) => s.state === q.state);
  }

  matched.sort((a, b) => {
    const byDate = b.lastTransitionAt.localeCompare(a.lastTransitionAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const rows: SerialUnit[] = matched.map(({ lifecycle: _lifecycle, ...unit }) => unit);
  return paginate(rows, q.page, q.limit);
}

export async function fakeGetSerial(id: string): Promise<SerialDetail> {
  await enterCall();
  const unit = serialUnits.find((s) => s.id === id);
  if (!unit) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  return clone(unit);
}

export async function fakeListDecisions(q: DecisionQuery): Promise<Page<InventoryDecision>> {
  await enterCall();
  let matched = decisions.slice();
  if (q.aggregateId) {
    matched = matched.filter((d) => d.aggregateId === q.aggregateId);
  }
  if (q.policyKind) {
    const expectedType =
      q.policyKind === 'INVENTORY_OVER_RECEIPT' ? 'INVENTORY_TOLERANCE' : q.policyKind;
    matched = matched.filter(
      (d) =>
        d.decisionType === expectedType ||
        d.policyVersions.some((pv) => pv.policyKind === q.policyKind),
    );
  }
  matched.sort((a, b) => {
    const byDate = b.evaluatedAt.localeCompare(a.evaluatedAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
  return paginate(matched, q.page, q.limit);
}

export async function fakeGetDecision(id: string): Promise<InventoryDecision> {
  await enterCall();
  const decision = decisions.find((d) => d.id === id);
  if (!decision) {
    throw new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND');
  }
  return clone(decision);
}
