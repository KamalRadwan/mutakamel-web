export type { Page } from '../shared/trade-foundation.model';

export type NodeType = 'WAREHOUSE' | 'STORE' | 'VIRTUAL';
export type NodeStatus = 'ACTIVE' | 'INACTIVE';

export interface NodeBranch {
  id: string;
  fulfillmentNodeId: string;
  companyId: string;
  branchId: string;
  isActive: boolean;
  version: number;
}

export interface FulfillmentNode {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nodeType: NodeType;
  status: NodeStatus;
  timezone: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  branches?: NodeBranch[];
}

export interface CompanyNode extends Omit<FulfillmentNode, 'branches'> {
  branches: { id: string; branchId: string; isActive: boolean; version: number }[];
  branchCount: number;
}

export interface NodeListQuery {
  status?: NodeStatus;
}

export interface CompanyNodeQuery {
  status?: NodeStatus;
  nodeType?: NodeType;
  branchId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateNodeBody {
  code: string;
  name: string;
  nodeType: NodeType;
  timezone: string;
  branchIds: string[];
}

export interface UpdateNodePatch {
  name?: string;
  status?: NodeStatus;
  timezone?: string;
  branchIds?: string[];
}

export type PeriodStatus = 'OPEN' | 'CLOSED';

export interface InventoryPeriod {
  id: string;
  companyId: string;
  code: string;
  startsOn: string;
  endsOn: string;
  status: PeriodStatus;
  maxBackdateDays: number;
  closedAt: string | null;
  closedBy: string | null;
  closeReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreatePeriodBody {
  code: string;
  startsOn: string;
  endsOn: string;
  maxBackdateDays: number;
}

export interface PeriodQuery {
  status?: PeriodStatus;
  effectiveAt?: string;
  page: number;
  limit: number;
}

export type UomConversionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface UomConversionRevision {
  id: string;
  companyId: string;
  itemCompanyProfileId: string;
  fromUomId: string;
  toUomId: string;
  revisionNumber: number;
  factorNumerator: string;
  factorDenominator: string;
  status: UomConversionStatus;
  effectiveFrom: string;
  contentHash: string;
  publishedAt: string | null;
  publishedBy: string | null;
  retiredAt: string | null;
  retiredBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  itemId: string | null;
  itemCode: string | null;
  itemNames: Record<string, string> | null;
  fromUomCode: string | null;
  toUomCode: string | null;
  publishReasonCode: string | null;
  retireReasonCode: string | null;
}

export interface CreateUomConversionBody {
  itemCompanyProfileId: string;
  fromUomId: string;
  toUomId: string;
  factorNumerator: string;
  factorDenominator: string;
  effectiveFrom: string;
}

export interface UomConversionQuery {
  itemCompanyProfileId?: string;
  fromUomId?: string;
  toUomId?: string;
  status?: UomConversionStatus;
  page: number;
  limit: number;
}

export type SerialState = 'ON_HAND' | 'RESERVED' | 'DELIVERED' | 'VOIDED';
export type SerialEventType =
  | 'OPENING'
  | 'RECEIPT'
  | 'RESERVATION'
  | 'RELEASE'
  | 'EXPIRY'
  | 'DELIVERY'
  | 'RECEIPT_REVERSAL'
  | 'DELIVERY_REVERSAL';

export interface SerialUnit {
  id: string;
  companyId: string;
  itemId: string;
  itemCompanyProfileId: string;
  serialKey: string;
  state: SerialState;
  currentFulfillmentNodeId: string | null;
  currentUomId: string | null;
  currentReservationId: string | null;
  firstLedgerEntryId: string;
  currentLedgerEntryId: string | null;
  lastTransitionAt: string;
  version: number;
  itemCode: string | null;
  itemNames: Record<string, string> | null;
  currentNodeCode: string | null;
  currentNodeName: string | null;
  currentUomCode: string | null;
}

// Backend inventory_serial_lifecycle_entries.source_type (NOT NULL): the ledger
// row source_type, 'LEDGER' when the ledger row has none (opening balances), or
// 'RESERVATION' for reservation events.
export type SerialLifecycleSourceType =
  | 'LEDGER'
  | 'RECEIPT'
  | 'RECEIPT_REVERSAL'
  | 'DELIVERY'
  | 'DELIVERY_REVERSAL'
  | 'RESERVATION';

export interface SerialLifecycleEntry {
  id: string;
  serialUnitId: string;
  serialKey: string;
  eventType: SerialEventType;
  operationKey: string;
  sourceType: SerialLifecycleSourceType;
  sourceId: string;
  ledgerEntryId: string | null;
  reservationId: string | null;
  fromState: SerialState | null;
  toState: SerialState;
  fulfillmentNodeId: string | null;
  nodeCode: string | null;
  nodeName: string | null;
  uomId: string;
  uomCode: string | null;
  occurredAt: string;
}

export interface SerialDetail extends SerialUnit {
  lifecycle: SerialLifecycleEntry[];
}

export interface SerialQuery {
  itemId?: string;
  itemCompanyProfileId?: string;
  serialKey?: string;
  state?: SerialState;
  page: number;
  limit: number;
}

export type PolicyKind = 'INVENTORY_RESERVATION' | 'INVENTORY_NEGATIVE' | 'INVENTORY_OVER_RECEIPT';
export type DecisionType = 'INVENTORY_RESERVATION' | 'INVENTORY_NEGATIVE' | 'INVENTORY_TOLERANCE';
export type DecisionAggregateType =
  | 'INVENTORY_RESERVATION'
  | 'INVENTORY_RECEIPT'
  | 'INVENTORY_RECEIPT_LINE'
  | 'INVENTORY_DELIVERY'
  | 'INVENTORY_DELIVERY_LINE';

export interface DecisionPolicyVersionRef {
  type: string;
  policyKind: string;
  definitionId: string;
  definitionCode: string;
  id: string;
  version: number;
  contentHash: string;
  registryVersion: string;
}

export interface InventoryDecision {
  id: string;
  decisionType: DecisionType;
  aggregateType: DecisionAggregateType;
  aggregateId: string;
  companyId: string;
  branchId: string | null;
  policyVersions: DecisionPolicyVersionRef[];
  matchedRules: string[];
  result: { outcome?: string; selectedValue: string | null; explanationCode?: string };
  explanation: string;
  evaluatedAt: string;
  correlationId: string;
}

export interface DecisionQuery {
  aggregateId?: string;
  policyKind?: PolicyKind;
  page: number;
  limit: number;
}

export interface Availability {
  nodeId: string;
  itemId: string;
  uomId: string | null;
  onHandQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  /** The stock balance record version; 0 when no balance row exists yet. */
  version: number;
  asOf: string;
  advisory: true;
  nodeCode: string | null;
  nodeName: string | null;
  itemCode: string | null;
  itemNames: Record<string, string> | null;
  uomCode: string | null;
}

export interface AvailabilityQuery {
  nodeId: string;
  itemId: string;
  uomId?: string;
  lotKey?: string;
  serialKey?: string;
}

export interface InventoryTracking {
  lotKey?: string;
  expiryDate?: string;
  serialKeys?: string[];
}

export interface OpeningBalanceInput {
  nodeId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  itemProfileVersion: number;
  businessEffectiveAt: string;
  operationKey: string;
  tracking?: InventoryTracking;
}

export type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_RECEIPT'
  | 'PURCHASE_RECEIPT_REVERSAL'
  | 'SALES_DELIVERY'
  | 'SALES_DELIVERY_REVERSAL';

export interface LedgerEntry {
  id: string;
  companyId: string;
  fulfillmentNodeId: string;
  nodeCode: string;
  nodeName: string;
  itemCompanyProfileId: string;
  itemId: string;
  itemCode: string;
  itemNames: Record<string, string>;
  uomId: string;
  uomCode: string;
  signedQuantity: string;
  normalizedUomId: string;
  normalizedUomCode: string;
  normalizedSignedQuantity: string;
  uomConversionRevisionId: string | null;
  inventoryPeriodId: string | null;
  policyDecisionReceiptId: string | null;
  movementType: MovementType;
  operationKey: string;
  sourceType: 'RECEIPT' | 'RECEIPT_REVERSAL' | 'DELIVERY' | 'DELIVERY_REVERSAL' | null;
  sourceId: string | null;
  sourceLineId: string | null;
  sourceNumber: string | null;
  reversalOfId: string | null;
  occurredAt: string;
  tracking: InventoryTracking & { reversalReasonCode?: string };
  remainingReversibleQuantity: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface LedgerEntryDetail extends LedgerEntry {
  periodCode: string | null;
  uomConversion: {
    revisionId: string;
    revisionNumber: number;
    fromUomId: string;
    fromUomCode: string;
    toUomId: string;
    toUomCode: string;
    factorNumerator: string;
    factorDenominator: string;
  } | null;
  version: number;
  reversals: { id: string; occurredAt: string; normalizedSignedQuantity: string; operationKey: string }[];
  source: { kind: 'RECEIPT' | 'DELIVERY'; id: string; status: SourceStatus; version: number } | null;
}

/** Raw inventory_stock_balances record (POST opening-balances returns entities, not read projections). */
export interface StockBalanceRecord {
  id: string;
  companyId: string;
  fulfillmentNodeId: string;
  itemCompanyProfileId: string;
  uomId: string;
  lotKey: string;
  serialKey: string;
  onHandQuantity: string;
  reservedQuantity: string;
  negativeStockDecisionReceiptId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

/** Raw inventory_stock_ledger_entries record: no node/item/uom display fields. */
export interface LedgerEntryRecord {
  id: string;
  companyId: string;
  fulfillmentNodeId: string;
  itemCompanyProfileId: string;
  uomId: string;
  signedQuantity: string;
  normalizedUomId: string;
  normalizedSignedQuantity: string;
  uomConversionRevisionId: string | null;
  inventoryPeriodId: string | null;
  policyDecisionReceiptId: string | null;
  movementType: MovementType;
  operationKey: string;
  sourceType: string | null;
  sourceId: string | null;
  reversalOfId: string | null;
  occurredAt: string;
  tracking: InventoryTracking & {
    serialUnits?: { serialKey: string; serialUnitId: string; lifecycleEntryId: string }[];
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

/** POST /opening-balances: `{ balance: balances[0], balances, ledger }` as raw records. */
export interface OpeningBalanceResult {
  balance: StockBalanceRecord;
  balances: StockBalanceRecord[];
  ledger: LedgerEntryRecord;
}

export interface MovementQuery {
  nodeId?: string;
  itemId?: string;
  itemCompanyProfileId?: string;
  operationKey?: string;
  movementType?: MovementType;
  group?: 'OPENING' | 'RECEIPT' | 'DELIVERY' | 'REVERSAL';
  from?: string;
  to?: string;
  sourceType?: 'RECEIPT' | 'DELIVERY';
  sourceId?: string;
  search?: string;
  page: number;
  limit: number;
}

export type SourceStatus = 'DRAFT' | 'POSTED' | 'PARTIALLY_REVERSED' | 'REVERSED';

export interface SourceLine {
  id: string;
  documentLineId: string;
  reservationId?: string | null;
  itemCompanyProfileId: string;
  itemId: string;
  itemCode: string;
  itemNames: Record<string, string>;
  uomId: string;
  uomCode: string;
  quantity: string;
  normalizedUomId: string;
  normalizedUomCode: string;
  normalizedQuantity: string;
  reversedQuantity: string;
  normalizedReversedQuantity: string;
  descriptionSnapshot: string | null;
  tracking: InventoryTracking;
  reversedSerialKeys: string[];
  ledgerEntryId: string | null;
  policyDecisionReceiptId: string | null;
  version: number;
}

export interface MovementSource {
  id: string;
  kind: 'RECEIPT' | 'DELIVERY';
  status: SourceStatus;
  branchId: string;
  fulfillmentNodeId: string;
  nodeCode: string;
  nodeName: string;
  documentId: string;
  documentNumber: string;
  operationKey: string;
  businessEffectiveAt: string;
  postedAt: string | null;
  inventoryPeriodId: string | null;
  policyDecisionReceiptId: string | null;
  lineCount: number;
  version: number;
  createdAt: string;
  createdBy: string | null;
  lines: SourceLine[];
}

/** Raw receipt/delivery line record returned by POST .../reverse (no display fields). */
export interface SourceLineRecord {
  id: string;
  receiptId?: string;
  deliveryId?: string;
  companyId: string;
  branchId: string;
  fulfillmentNodeId: string;
  purchaseOrderId?: string;
  purchaseOrderLineId?: string;
  salesOrderId?: string;
  salesOrderLineId?: string;
  reservationId?: string | null;
  itemCompanyProfileId: string;
  uomId: string;
  descriptionSnapshot: string | null;
  quantity: string;
  normalizedUomId: string;
  normalizedQuantity: string;
  uomConversionRevisionId: string | null;
  reversedQuantity: string;
  normalizedReversedQuantity: string;
  tracking: InventoryTracking;
  ledgerEntryId: string | null;
  policyDecisionReceiptId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

/** POST /receipts/:id/reverse | /deliveries/:id/reverse: `{ ...receipt, lines }` as raw records. */
export interface MovementSourceRecord {
  id: string;
  companyId: string;
  branchId: string;
  fulfillmentNodeId: string;
  purchaseOrderId?: string;
  salesOrderId?: string;
  operationKey: string;
  status: SourceStatus;
  businessEffectiveAt: string;
  inventoryPeriodId: string | null;
  policyDecisionReceiptId: string | null;
  postedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  lines: SourceLineRecord[];
}

export interface ReverseMovementInput {
  reasonCode: string;
  businessEffectiveAt: string;
  lines?: { lineId: string; quantity: string; serialKeys?: string[] }[];
}

export interface StockBalanceRow {
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
  onHandQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  serialCount: number;
  negative: boolean;
  updatedAt: string;
}

export interface BalanceQuery {
  nodeId?: string;
  itemId?: string;
  itemCompanyProfileId?: string;
  lotKey?: string;
  search?: string;
  onlyInStock?: boolean;
  page: number;
  limit: number;
}

export type InventoryReasonKind =
  | 'INVENTORY_PERIOD_CLOSE'
  | 'INVENTORY_PERIOD_REOPEN'
  | 'INVENTORY_UOM_PUBLISH'
  | 'INVENTORY_UOM_RETIRE'
  | 'INVENTORY_REVERSAL';

export const INVENTORY_LIMITS = {
  pageSize: 50,
  nodeName: 160,
  nodeCode: 80,
  periodCode: 40,
  maxBackdateDays: 366,
  serialKeys: 1000,
  serialKeyLength: 120,
  reasonLength: 80,
  lotKey: 120,
} as const;

/** Backend DECIMAL_16_8: numeric(24,8) text without exponent or leading zeros. */
export const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
/** Backend POSITIVE_DECIMAL_16_8: DECIMAL_PATTERN that is not zero. */
export const POSITIVE_DECIMAL_PATTERN = /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
/** Backend UUID_V7_PATTERN for operation keys. */
export const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FACTOR_PATTERN = /^[1-9]\d{0,17}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,39}$/;
export const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
