export const REGISTRY_VERSION = '2026.11.1';

export const POLICY_KINDS = [
  'PRICING_GUARD',
  'ORDER_CONFIRMATION',
  'PURCHASE_APPROVAL',
  'CREDIT',
  'INVENTORY_NEGATIVE',
  'INVENTORY_RESERVATION',
  'INVENTORY_OVER_RECEIPT',
] as const;

export type PolicyKind = (typeof POLICY_KINDS)[number];

export const ACTIVE_POLICY_KINDS: readonly PolicyKind[] = [
  'PRICING_GUARD',
  'ORDER_CONFIRMATION',
  'PURCHASE_APPROVAL',
  'INVENTORY_NEGATIVE',
  'INVENTORY_RESERVATION',
  'INVENTORY_OVER_RECEIPT',
];

export const WORKFLOW_KINDS = [
  'PURCHASE_ORDER',
  'QUOTATION',
  'SALES_ORDER',
  'PRICE_CHANGE',
  'CREDIT_OVERRIDE',
] as const;

export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];

export const ACTIVE_WORKFLOW_KINDS: readonly WorkflowKind[] = ['PURCHASE_ORDER'];

export type FactType = 'string' | 'number' | 'boolean';

export interface PolicyFactDefinition {
  key: string;
  type: FactType;
}

export const FACTS: readonly PolicyFactDefinition[] = [
  { key: 'documentKind', type: 'string' },
  { key: 'totalAmount', type: 'number' },
  { key: 'subtotalAmount', type: 'number' },
  { key: 'currencyCode', type: 'string' },
  { key: 'accountStatus', type: 'string' },
  { key: 'accountRole', type: 'string' },
  { key: 'customerEligible', type: 'boolean' },
  { key: 'discountPercent', type: 'number' },
  { key: 'marginPercent', type: 'number' },
  { key: 'actorHasOverride', type: 'boolean' },
  { key: 'lineCount', type: 'number' },
  { key: 'hasPriceLock', type: 'boolean' },
  { key: 'channelType', type: 'string' },
  { key: 'branchId', type: 'string' },
  { key: 'creditExposureRatio', type: 'number' },
  { key: 'creditBlocked', type: 'boolean' },
  { key: 'availableQuantity', type: 'number' },
  { key: 'requestedQuantity', type: 'number' },
  { key: 'overReceiptPercent', type: 'number' },
  { key: 'allowNegativeStock', type: 'boolean' },
  { key: 'reservationPriority', type: 'number' },
];

/** Facts carrying money: sent and compared as decimal strings (backend S2, 8 decimals). */
export const MONEY_FACT_KEYS: readonly string[] = ['totalAmount', 'subtotalAmount'];

export function isMoneyFact(key: string): boolean {
  return MONEY_FACT_KEYS.includes(key);
}

const DECIMAL_STRING = /^-?\d{1,18}(\.\d{1,8})?$/;

export function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_STRING.test(value.trim());
}

function toScaled(value: string | number): bigint | null {
  const text = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim();
  if (!DECIMAL_STRING.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, frac = ''] = text.replace('-', '').split('.');
  const scaled = BigInt(whole + frac.padEnd(8, '0'));
  return negative ? -scaled : scaled;
}

/** Exact comparison of decimal strings (or legacy finite numbers); null when either is not a valid decimal. */
export function compareDecimal(a: string | number, b: string | number): number | null {
  const x = toScaled(a);
  const y = toScaled(b);
  return x === null || y === null ? null : x < y ? -1 : x > y ? 1 : 0;
}

export const OPERATORS = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS'] as const;
export type PolicyOperator = (typeof OPERATORS)[number];

const OPERATORS_BY_TYPE: Readonly<Record<FactType, readonly PolicyOperator[]>> = {
  number: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'],
  string: ['EQ', 'NEQ', 'IN', 'CONTAINS'],
  boolean: ['EQ', 'NEQ'],
};

export function operatorsFor(type: FactType): readonly PolicyOperator[] {
  return OPERATORS_BY_TYPE[type];
}

export const OUTCOMES = ['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'SELECT'] as const;
export type PolicyOutcome = (typeof OUTCOMES)[number];

export const WORKFLOW_ACTIONS = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'WITHDRAW',
  'CONFIRM',
  'CANCEL',
  'HOLD',
  'RELEASE',
  'RETRY',
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export const FACTS_BY_KIND: Readonly<Record<PolicyKind, readonly string[]>> = {
  PRICING_GUARD: [
    'documentKind',
    'totalAmount',
    'currencyCode',
    'accountStatus',
    'customerEligible',
    'discountPercent',
    'marginPercent',
    'actorHasOverride',
  ],
  ORDER_CONFIRMATION: [
    'documentKind',
    'totalAmount',
    'currencyCode',
    'accountStatus',
    'customerEligible',
    'lineCount',
    'hasPriceLock',
    'channelType',
    'creditBlocked',
    'actorHasOverride',
  ],
  PURCHASE_APPROVAL: [
    'documentKind',
    'totalAmount',
    'currencyCode',
    'accountStatus',
    'accountRole',
    'lineCount',
    'branchId',
    'actorHasOverride',
  ],
  CREDIT: [
    'accountStatus',
    'currencyCode',
    'totalAmount',
    'creditExposureRatio',
    'creditBlocked',
    'actorHasOverride',
  ],
  INVENTORY_NEGATIVE: [
    'branchId',
    'availableQuantity',
    'requestedQuantity',
    'allowNegativeStock',
    'actorHasOverride',
  ],
  INVENTORY_RESERVATION: [
    'branchId',
    'channelType',
    'availableQuantity',
    'requestedQuantity',
    'reservationPriority',
  ],
  INVENTORY_OVER_RECEIPT: [
    'branchId',
    'requestedQuantity',
    'overReceiptPercent',
    'actorHasOverride',
  ],
};

export const PURCHASE_ORDER_WORKFLOW_SHAPE = {
  states: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as readonly string[],
  initialState: 'PENDING',
  terminalStates: ['APPROVED', 'REJECTED', 'WITHDRAWN'] as readonly string[],
  transitions: [
    {
      code: 'APPROVE_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'APPROVED',
      action: 'APPROVE' as WorkflowAction,
      requiresApproval: true,
    },
    {
      code: 'REJECT_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'REJECTED',
      action: 'REJECT' as WorkflowAction,
      requiresApproval: true,
    },
    {
      code: 'WITHDRAW_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'WITHDRAWN',
      action: 'WITHDRAW' as WorkflowAction,
      requiresApproval: false,
    },
  ],
};

export const CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,99}$/;
export const RULE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const REASON_CODE = /^[A-Z][A-Z0-9_.-]{1,79}$/;
