import { ApiError } from '../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../core/fake/fake-utils';
import {
  AcceptedPricing,
  AccessMode,
  ActiveInvoicePaymentIntent,
  AppliedPriceBracket,
  AppliedReceipt,
  BillingSummary,
  CatalogueQuery,
  CommercialChange,
  CommercialOperation,
  CommercialPreview,
  InvoiceLine,
  InvoicePaymentIntent,
  InvoicePaymentQuote,
  InvoiceRead,
  InvoiceReadHeader,
  LedgerReason,
  Money,
  OfferLadder,
  PAYABLE_INVOICE_STATUSES,
  PageMeta,
  PageQuery,
  Paged,
  PaymentInputCurrencies,
  PaymentStatusView,
  PrepareBody,
  PreviewChange,
  QuoteBody,
  RecoveryBody,
  SubscriptionAddonSelection,
  SubscriptionBaseItem,
  SubscriptionOffer,
  SubscriptionView,
  TenantInvoiceView,
  TopupBody,
  TopupResult,
  WalletLedgerEntry,
  WalletView,
} from './billing.model';
import {
  FAKE_ADDON_AI_ASSISTANT,
  FAKE_ADDON_HOMES,
  FAKE_ADDON_POWER_DIALER,
  FAKE_ADDON_WHATSAPP,
} from './shared/addon-catalogue.fake';
import { isZero } from './shared/money';

export let FAKE_BILLING_OWNER = true;
export let FAKE_ACCESS_MODE: AccessMode = 'FULL';
export let FAKE_BILLING_FAIL_NEXT = false;
export let FAKE_PAYMENT_OUTCOME: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED';

const BILLING_FAILURE_STATUSES = {
  PAYMENT_PROVIDER_UNCONFIGURED: 503,
  PAYMENT_INTENT_UNAVAILABLE: 409,
  WALLET_NOT_ACTIVE: 409,
  WALLET_FROZEN: 409,
  TOPUP_LIMITS_INVALID: 503,
  ACCESS_POLICY_BLOCKED: 403,
  ACCESS_POLICY_UNAVAILABLE: 503,
  SEAT_MODULE_HOLDERS_EXCEED_PURCHASE: 422,
} as const;
type BillingFailureCode = keyof typeof BILLING_FAILURE_STATUSES;
let nextBillingFailure: BillingFailureCode | null = null;

export function setFakeBillingErrorNext(code: BillingFailureCode | null): void {
  nextBillingFailure = code;
}

export function setFakeBillingOwner(value: boolean): void {
  FAKE_BILLING_OWNER = value;
}

export function setFakeAccessMode(value: AccessMode): void {
  FAKE_ACCESS_MODE = value;
}

export function setFakeBillingFailNext(value: boolean): void {
  FAKE_BILLING_FAIL_NEXT = value;
}

export function setFakePaymentOutcome(value: 'SUCCEEDED' | 'FAILED'): void {
  FAKE_PAYMENT_OUTCOME = value;
}

const SCALE = 10_000n;
const TOPUP_AMOUNT_RE = /^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
// Backend defaults billing.min_topup_usd / billing.max_topup_usd, checked on the USD value.
const MIN_TOPUP_USD_UNITS = 10_000n; // 1.0000
const MAX_TOPUP_USD_UNITS = 1_000_000_000n; // 100000.0000

const CURRENCY_RATES: Readonly<Record<string, string>> = {
  USD: '1.0000',
  EGP: '48.5000',
  SAR: '3.7500',
  AED: '3.6725',
};

const PAYMENT_CURRENCIES: PaymentInputCurrencies = {
  walletCurrencyCode: 'USD',
  items: [
    // Backend: USD first, then the managed codes sorted A-Z.
    { currencyCode: 'USD', isBaseCurrency: true },
    { currencyCode: 'AED', isBaseCurrency: false },
    { currencyCode: 'EGP', isBaseCurrency: false },
    { currencyCode: 'SAR', isBaseCurrency: false },
  ],
  total: 4,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function toUnits(raw: Money): bigint {
  let trimmed = raw.trim();
  let negative = false;
  if (trimmed.startsWith('-')) {
    negative = true;
    trimmed = trimmed.slice(1);
  }
  const dotIdx = trimmed.indexOf('.');
  const intPart = dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx);
  const fracPart = (dotIdx === -1 ? '' : trimmed.slice(dotIdx + 1)).padEnd(4, '0').slice(0, 4);
  const units = BigInt(intPart || '0') * SCALE + BigInt(fracPart || '0');
  return negative ? -units : units;
}

function fromUnits(units: bigint): Money {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(4, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

function addMoney(a: Money, b: Money): Money {
  return fromUnits(toUnits(a) + toUnits(b));
}

function subMoney(a: Money, b: Money): Money {
  return fromUnits(toUnits(a) - toUnits(b));
}

function cmpMoney(a: Money, b: Money): number {
  const ua = toUnits(a);
  const ub = toUnits(b);
  return ua < ub ? -1 : ua > ub ? 1 : 0;
}

function minMoney(a: Money, b: Money): Money {
  return cmpMoney(a, b) <= 0 ? a : b;
}

function mulUnitsByRate(usdUnits: bigint, rateStr: string): bigint {
  const rateUnits = toUnits(rateStr);
  return (usdUnits * rateUnits + SCALE / 2n) / SCALE;
}

function divUnitsByRate(sourceUnits: bigint, rateStr: string): bigint {
  const rateUnits = toUnits(rateStr);
  return (sourceUnits * SCALE + rateUnits / 2n) / rateUnits;
}

function assertPreconditions(): void {
  if (!FAKE_BILLING_OWNER) {
    throw new ApiError(403, 'TENANT_OWNER_REQUIRED');
  }
  if (nextBillingFailure) {
    const code = nextBillingFailure;
    nextBillingFailure = null;
    const details = code === 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE'
      ? { moduleKey: ['crm'], holders: ['4'], seats: ['2'] } : undefined;
    throw new ApiError(BILLING_FAILURE_STATUSES[code], code, details);
  }
  if (FAKE_BILLING_FAIL_NEXT) {
    FAKE_BILLING_FAIL_NEXT = false;
    // The backend sends no details on 5xx errors.
    throw new ApiError(503, 'COMMERCIAL_COMMAND_UNAVAILABLE');
  }
}

const idempotencyStore = new Map<string, { fingerprint: string; result: unknown }>();
const COMMERCIAL_ROUTES = new Set(['prepareChange', 'quoteChange', 'applyChange', 'recoverOperation']);

function routeOf(fingerprint: string): string {
  return (JSON.parse(fingerprint) as unknown[])[0] as string;
}

/**
 * Same key, different command. Commercial commands skip the HTTP idempotency
 * store and their SQL owner answers 409 SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED.
 * Payment commands hit the HTTP store first (422 IDEMPOTENCY_BODY_MISMATCH on the
 * same route); a key from another route reaches the payment row check (409).
 */
function replayIdempotent<T>(key: string, fingerprint: string): T | null {
  const existing = idempotencyStore.get(key);
  if (!existing) return null;
  if (existing.fingerprint !== fingerprint) {
    const route = routeOf(fingerprint);
    if (COMMERCIAL_ROUTES.has(route)) {
      throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED');
    }
    if (routeOf(existing.fingerprint) === route) {
      throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
    }
    throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED');
  }
  return clone(existing.result as T);
}

function saveIdempotent<T>(key: string, fingerprint: string, result: T): T {
  idempotencyStore.set(key, { fingerprint, result: clone(result) });
  return result;
}

function paginate<T>(all: readonly T[], q: PageQuery): Paged<T> {
  const limit = Math.min(100, Math.max(1, Math.trunc(q.limit || 20)));
  const total = all.length;
  // Backend: page is echoed as requested, totalPages is 0 for an empty list.
  const totalPages = Math.ceil(total / limit);
  const page = Math.max(1, Math.trunc(q.page || 1));
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);
  const meta: PageMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
  return { items: clone(items), meta };
}

// --- Seeded state
const WALLET_ID = 'wal-tenant-001';
const SUBSCRIPTION_ID = 'sub-tenant-001';
const TENANT_ID = 'ten-mutakamel-001';
const CRM_USED_SEATS = 22;

const wallet: WalletView = {
  currencyCode: 'USD',
  balanceUsd: '180.0000',
  reservedBalanceUsd: '0.0000',
  availableBalanceUsd: '180.0000',
  status: 'ACTIVE',
};

const crmAcceptedPricing: AcceptedPricing = {
  billingCycle: 'MONTHLY',
  currencyCode: 'USD',
  recurringAmountUsd: '450.0000',
  priceRevision: 'rev-crm-growth-v1',
  breakdown: [
    { minUsers: 1, maxUsers: 10, chargedUsers: 10, unitPriceUsd: '20.0000', amountUsd: '200.0000' },
    { minUsers: 11, maxUsers: 50, chargedUsers: 15, unitPriceUsd: '16.6667', amountUsd: '250.0000' },
  ],
};

const tradeAcceptedPricing: AcceptedPricing = {
  billingCycle: 'MONTHLY',
  currencyCode: 'USD',
  recurringAmountUsd: '150.0000',
  priceRevision: 'rev-trade-std-v1',
  breakdown: [
    { minUsers: 1, maxUsers: 10, chargedUsers: 10, unitPriceUsd: '15.0000', amountUsd: '150.0000' },
  ],
};

const accountingAcceptedPricing: AcceptedPricing = {
  billingCycle: 'MONTHLY',
  currencyCode: 'USD',
  recurringAmountUsd: '90.0000',
  priceRevision: 'rev-acc-std-v1',
  breakdown: [
    { minUsers: 1, maxUsers: 10, chargedUsers: 5, unitPriceUsd: '18.0000', amountUsd: '90.0000' },
  ],
};

const homesAcceptedPricing: AcceptedPricing = {
  billingCycle: 'MONTHLY',
  currencyCode: 'USD',
  recurringAmountUsd: '60.0000',
  priceRevision: 'rev-addon-homes-v2',
  breakdown: [
    { minUsers: 1, maxUsers: 25, chargedUsers: 10, unitPriceUsd: '6.0000', amountUsd: '60.0000' },
  ],
};

const whatsappAcceptedPricing: AcceptedPricing = {
  billingCycle: 'MONTHLY',
  currencyCode: 'USD',
  recurringAmountUsd: '50.0000',
  priceRevision: 'rev-addon-whatsapp-v1',
  breakdown: [
    { minUsers: 1, maxUsers: 50, chargedUsers: 25, unitPriceUsd: '2.0000', amountUsd: '50.0000' },
  ],
};

const subscription: SubscriptionView = {
  subscription: {
    id: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    allowedUsers: 40,
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    currencyCode: 'USD',
    startedAt: '2025-01-01T00:00:00.000Z',
    currentPeriodStart: '2026-11-01T00:00:00.000Z',
    currentPeriodEnd: '2026-12-01T00:00:00.000Z',
    pendingPeriodStart: null,
    pendingPeriodEnd: null,
    trialDays: 14,
    trialStartedAt: '2024-12-18T00:00:00.000Z',
    trialEndsAt: null,
    activationScheduledAt: null,
    activatedAt: '2025-01-01T00:00:00.000Z',
    cancelAt: null,
    totalPrice: '800.0000',
    createdAt: '2024-12-18T09:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    currentCollectionInvoiceId: null,
  },
  subscriptionRevision: '42',
  baseItems: [
    {
      id: 'base-crm',
      applicationId: 'app-crm',
      applicationKey: 'crm',
      applicationName: 'CRM',
      tierId: 'tier-crm-growth',
      tierKey: 'growth',
      tierName: 'Growth',
      tierRank: 2,
      seats: 25,
      acceptedPricing: clone(crmAcceptedPricing),
    },
    {
      id: 'base-trade',
      applicationId: 'app-trade',
      applicationKey: 'trade',
      applicationName: 'Trade',
      tierId: 'tier-trade-standard',
      tierKey: 'standard',
      tierName: 'Standard',
      tierRank: 1,
      seats: 10,
      acceptedPricing: clone(tradeAcceptedPricing),
    },
    {
      id: 'base-accounting',
      applicationId: 'app-accounting',
      applicationKey: 'accounting',
      applicationName: 'Accounting',
      tierId: 'tier-accounting-standard',
      tierKey: 'standard',
      tierName: 'Standard',
      tierRank: 1,
      seats: 5,
      acceptedPricing: clone(accountingAcceptedPricing),
    },
  ],
  addonSelections: [
    {
      id: 'sel-crm-homes',
      parentItemId: 'base-crm',
      addonId: FAKE_ADDON_HOMES.id,
      addonKey: FAKE_ADDON_HOMES.key,
      definitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      seats: 10,
      acceptedPricing: clone(homesAcceptedPricing),
      effectiveState: {
        applicationLifecycleStatus: 'ACTIVE',
        addonLifecycleStatus: 'ACTIVE',
        definitionState: 'PUBLISHED',
        operationalUse: 'NOT_EVALUATED',
      },
    },
    {
      id: 'sel-crm-whatsapp',
      parentItemId: 'base-crm',
      addonId: FAKE_ADDON_WHATSAPP.id,
      addonKey: FAKE_ADDON_WHATSAPP.key,
      definitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
      seats: 25,
      acceptedPricing: clone(whatsappAcceptedPricing),
      effectiveState: {
        applicationLifecycleStatus: 'ACTIVE',
        addonLifecycleStatus: 'DEPRECATED',
        definitionState: 'REVOKED',
        operationalUse: 'NOT_EVALUATED',
      },
    },
  ],
  baseAllowance: {
    allowedUsers: 40,
    effectiveAllowedUsers: 40,
    enabledApplications: ['crm', 'trade', 'accounting'],
  },
  totals: {
    baseRecurringUsd: '690.0000',
    addonRecurringUsd: '110.0000',
    combinedRecurringUsd: '800.0000',
  },
  projection: {
    observation: 'NOT_OBSERVED',
    state: null,
    safeReasonCode: 'TENANT_PROJECTION_NOT_OBSERVED',
  },
};

function buildPaidRenewalLines(invoiceId: string, includeAddons: boolean): InvoiceLine[] {
  const base: InvoiceLine[] = [
    {
      id: `${invoiceId}-l1`,
      invoiceId,
      description: 'CRM — Growth plan (25 seats)',
      quantity: '25',
      unitPrice: '18.0000',
      lineTotal: '450.0000',
      sourceKind: 'APPLICATION',
      baseItemId: 'base-crm',
      addonSelectionId: null,
      addonDefinitionVersionId: null,
      acceptedSeats: 25,
      acceptedPricingSnapshot: clone(crmAcceptedPricing),
    },
    {
      id: `${invoiceId}-l2`,
      invoiceId,
      description: 'Trade — Standard plan (10 seats)',
      quantity: '10',
      unitPrice: '15.0000',
      lineTotal: '150.0000',
      sourceKind: 'APPLICATION',
      baseItemId: 'base-trade',
      addonSelectionId: null,
      addonDefinitionVersionId: null,
      acceptedSeats: 10,
      acceptedPricingSnapshot: clone(tradeAcceptedPricing),
    },
    {
      id: `${invoiceId}-l3`,
      invoiceId,
      description: 'Accounting — Standard plan (5 seats)',
      quantity: '5',
      unitPrice: '18.0000',
      lineTotal: '90.0000',
      sourceKind: 'APPLICATION',
      baseItemId: 'base-accounting',
      addonSelectionId: null,
      addonDefinitionVersionId: null,
      acceptedSeats: 5,
      acceptedPricingSnapshot: clone(accountingAcceptedPricing),
    },
  ];
  if (!includeAddons) return base;
  return [
    ...base,
    {
      id: `${invoiceId}-l4`,
      invoiceId,
      description: `${FAKE_ADDON_HOMES.name} add-on (${FAKE_ADDON_HOMES.key}, 10 seats)`,
      quantity: '10',
      unitPrice: '6.0000',
      lineTotal: '60.0000',
      sourceKind: 'ADDON',
      baseItemId: 'base-crm',
      addonSelectionId: 'sel-crm-homes',
      addonDefinitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      acceptedSeats: 10,
      acceptedPricingSnapshot: clone(homesAcceptedPricing),
    },
    {
      id: `${invoiceId}-l5`,
      invoiceId,
      description: `${FAKE_ADDON_WHATSAPP.name} add-on (${FAKE_ADDON_WHATSAPP.key}, 25 seats)`,
      quantity: '25',
      unitPrice: '2.0000',
      lineTotal: '50.0000',
      sourceKind: 'ADDON',
      baseItemId: 'base-crm',
      addonSelectionId: 'sel-crm-whatsapp',
      addonDefinitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
      acceptedSeats: 25,
      acceptedPricingSnapshot: clone(whatsappAcceptedPricing),
    },
  ];
}

function makeInvoiceReadHeader(inv: TenantInvoiceView): InvoiceReadHeader {
  const subtotal = inv.canonicalUsd
    ? (inv.subtotalUsd ?? '0.0000')
    : (inv.legacyOriginalAmounts?.subtotal ?? '0.0000');
  const taxTotal = inv.canonicalUsd
    ? (inv.taxTotalUsd ?? '0.0000')
    : (inv.legacyOriginalAmounts?.taxTotal ?? '0.0000');
  const total = inv.canonicalUsd
    ? (inv.totalUsd ?? '0.0000')
    : (inv.legacyOriginalAmounts?.total ?? '0.0000');
  const ts = inv.issuedAt ?? '2026-10-08T09:00:00.000Z';

  return {
    id: inv.id,
    subscriptionId: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    number: inv.number,
    status: inv.status,
    purpose: inv.purpose,
    currencyCode: inv.currencyCode,
    subtotal,
    taxTotal,
    total,
    settlementCurrencyCode: 'USD',
    settlementSubtotalUsd: inv.subtotalUsd,
    settlementTaxTotalUsd: inv.taxTotalUsd,
    settlementTotalUsd: inv.totalUsd,
    amountPaidUsd: inv.canonicalUsd ? (inv.amountPaidUsd ?? '0.0000') : '352.5773',
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    paidAt: inv.paidAt,
    createdAt: ts,
    updatedAt: inv.paidAt ?? ts,
  };
}

function seedInvoices(): { list: TenantInvoiceView[]; reads: Map<string, InvoiceRead> } {
  const list: TenantInvoiceView[] = [];
  const reads = new Map<string, InvoiceRead>();

  const register = (inv: TenantInvoiceView, lines: InvoiceLine[]) => {
    list.push(inv);
    reads.set(inv.id, { invoice: makeInvoiceReadHeader(inv), lines });
  };

  register(
    {
      id: 'inv-2026-0023',
      number: 'INV-2026-0023',
      status: 'ISSUED',
      purpose: 'RENEWAL',
      currencyCode: 'USD',
      canonicalUsd: true,
      subtotalUsd: '800.0000',
      taxTotalUsd: '0.0000',
      totalUsd: '800.0000',
      amountPaidUsd: '0.0000',
      outstandingUsd: '800.0000',
      legacyOriginalAmounts: null,
      periodStart: '2026-11-01T00:00:00.000Z',
      periodEnd: '2026-12-01T00:00:00.000Z',
      issuedAt: '2026-11-01T08:00:00.000Z',
      dueAt: '2026-12-01T00:00:00.000Z',
      paidAt: null,
    },
    buildPaidRenewalLines('inv-2026-0023', true),
  );

  register(
    {
      id: 'inv-2026-0022',
      number: 'INV-2026-0022',
      status: 'OVERDUE',
      purpose: 'PRORATION',
      currencyCode: 'USD',
      canonicalUsd: true,
      subtotalUsd: '35.5000',
      taxTotalUsd: '0.0000',
      totalUsd: '35.5000',
      amountPaidUsd: '0.0000',
      outstandingUsd: '35.5000',
      legacyOriginalAmounts: null,
      periodStart: '2026-10-15T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
      issuedAt: '2026-10-15T10:00:00.000Z',
      dueAt: '2026-10-25T00:00:00.000Z',
      paidAt: null,
    },
    [
      {
        id: 'inv-2026-0022-l1',
        invoiceId: 'inv-2026-0022',
        description: 'CRM — Growth seat increase (+5 seats, prorated)',
        quantity: '5',
        unitPrice: '7.1000',
        lineTotal: '35.5000',
        sourceKind: 'APPLICATION',
        baseItemId: 'base-crm',
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: 25,
        acceptedPricingSnapshot: clone(crmAcceptedPricing),
      },
    ],
  );

  register(
    {
      id: 'inv-2026-0021',
      number: 'INV-2026-0021',
      status: 'PARTIALLY_PAID',
      purpose: 'MANUAL',
      currencyCode: 'USD',
      canonicalUsd: true,
      subtotalUsd: '250.0000',
      taxTotalUsd: '0.0000',
      totalUsd: '250.0000',
      amountPaidUsd: '100.0000',
      outstandingUsd: '150.0000',
      legacyOriginalAmounts: null,
      periodStart: null,
      periodEnd: null,
      issuedAt: '2026-10-10T09:00:00.000Z',
      dueAt: '2026-10-20T00:00:00.000Z',
      paidAt: null,
    },
    [
      {
        id: 'inv-2026-0021-l1',
        invoiceId: 'inv-2026-0021',
        description: 'Onboarding data migration support',
        quantity: '1',
        unitPrice: '150.0000',
        lineTotal: '150.0000',
        sourceKind: null,
        baseItemId: null,
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: null,
        acceptedPricingSnapshot: null,
      },
      {
        id: 'inv-2026-0021-l2',
        invoiceId: 'inv-2026-0021',
        description: 'Custom webhook integration setup',
        quantity: '1',
        unitPrice: '100.0000',
        lineTotal: '100.0000',
        sourceKind: null,
        baseItemId: null,
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: null,
        acceptedPricingSnapshot: null,
      },
    ],
  );

  register(
    {
      id: 'inv-2026-0020',
      number: 'INV-2026-0020',
      status: 'DRAFT',
      purpose: 'MANUAL',
      currencyCode: 'USD',
      canonicalUsd: true,
      subtotalUsd: '120.0000',
      taxTotalUsd: '0.0000',
      totalUsd: '120.0000',
      amountPaidUsd: '0.0000',
      outstandingUsd: '120.0000',
      legacyOriginalAmounts: null,
      periodStart: null,
      periodEnd: null,
      issuedAt: null,
      dueAt: null,
      paidAt: null,
    },
    [
      {
        id: 'inv-2026-0020-l1',
        invoiceId: 'inv-2026-0020',
        description: 'Dedicated team training session',
        quantity: '1',
        unitPrice: '120.0000',
        lineTotal: '120.0000',
        sourceKind: null,
        baseItemId: null,
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: null,
        acceptedPricingSnapshot: null,
      },
    ],
  );

  register(
    {
      id: 'inv-2026-0019',
      number: 'INV-2026-0019',
      status: 'VOID',
      purpose: 'PRORATION',
      currencyCode: 'USD',
      canonicalUsd: true,
      subtotalUsd: '45.0000',
      taxTotalUsd: '0.0000',
      totalUsd: '45.0000',
      amountPaidUsd: '0.0000',
      outstandingUsd: '0.0000',
      legacyOriginalAmounts: null,
      periodStart: '2026-10-03T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
      issuedAt: '2026-10-03T11:00:00.000Z',
      dueAt: '2026-10-10T00:00:00.000Z',
      paidAt: null,
    },
    [
      {
        id: 'inv-2026-0019-l1',
        invoiceId: 'inv-2026-0019',
        description: 'Voided proration adjustment',
        quantity: '1',
        unitPrice: '45.0000',
        lineTotal: '45.0000',
        sourceKind: null,
        baseItemId: null,
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: null,
        acceptedPricingSnapshot: null,
      },
    ],
  );

  // 17 PAID invoices (INV-2026-0018 down to INV-2025-0002)
  for (let seq = 18; seq >= 2; seq--) {
    const monthsBack = 19 - seq; // 1 = Oct 2026, ..., 17 = Jun 2025
    const start = new Date(Date.UTC(2026, 10 - monthsBack, 1));
    const end = new Date(Date.UTC(2026, 11 - monthsBack, 1));
    const paidDate = new Date(Date.UTC(2026, 10 - monthsBack, 2, 14, 15));
    const year = start.getUTCFullYear();
    const padded = String(seq).padStart(4, '0');
    const id = `inv-${year}-${padded}`;
    const num = `INV-${year}-${padded}`;
    const includeAddons = seq >= 10;
    const total = includeAddons ? '800.0000' : '690.0000';

    register(
      {
        id,
        number: num,
        status: 'PAID',
        purpose: seq === 2 ? 'TRIAL_ACTIVATION' : 'RENEWAL',
        currencyCode: 'USD',
        canonicalUsd: true,
        subtotalUsd: total,
        taxTotalUsd: '0.0000',
        totalUsd: total,
        amountPaidUsd: total,
        outstandingUsd: '0.0000',
        legacyOriginalAmounts: null,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        issuedAt: start.toISOString(),
        dueAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 7)).toISOString(),
        paidAt: paidDate.toISOString(),
      },
      buildPaidRenewalLines(id, includeAddons),
    );
  }

  // 1 legacy EGP invoice (INV-2025-0001)
  register(
    {
      id: 'inv-2025-0001',
      number: 'INV-2025-0001',
      status: 'PAID',
      purpose: 'RENEWAL',
      currencyCode: 'EGP',
      canonicalUsd: false,
      subtotalUsd: null,
      taxTotalUsd: null,
      totalUsd: null,
      amountPaidUsd: null,
      outstandingUsd: null,
      legacyOriginalAmounts: {
        currencyCode: 'EGP',
        subtotal: '15000.0000',
        taxTotal: '2100.0000',
        total: '17100.0000',
      },
      periodStart: '2025-05-01T00:00:00.000Z',
      periodEnd: '2025-06-01T00:00:00.000Z',
      issuedAt: '2025-05-01T08:00:00.000Z',
      dueAt: '2025-05-08T00:00:00.000Z',
      paidAt: '2025-05-02T11:30:00.000Z',
    },
    [
      {
        id: 'inv-2025-0001-l1',
        invoiceId: 'inv-2025-0001',
        description: 'Legacy workspace suite renewal (May 2025)',
        quantity: '1',
        unitPrice: '15000.0000',
        lineTotal: '15000.0000',
        sourceKind: null,
        baseItemId: null,
        addonSelectionId: null,
        addonDefinitionVersionId: null,
        acceptedSeats: null,
        acceptedPricingSnapshot: null,
      },
    ],
  );

  return { list, reads };
}

const seededInvoices = seedInvoices();
const invoices: TenantInvoiceView[] = seededInvoices.list;
const invoiceReads = seededInvoices.reads;

const payments: PaymentStatusView[] = [
  {
    paymentId: 'pay-0012',
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: 'ACTIVE',
    providerAmount: '9700.0000',
    providerCurrencyCode: 'EGP',
    settlementAmountUsd: '200.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '200.0000',
    createdAt: '2026-10-28T13:20:00.000Z',
    updatedAt: '2026-10-28T13:22:00.000Z',
  },
  {
    paymentId: 'pay-0011',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'INTERNAL',
    status: 'SUCCEEDED',
    invoiceId: 'inv-2026-0021',
    invoiceStatus: 'PARTIALLY_PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '100.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '0.0000',
    walletAppliedUsd: '100.0000',
    totalAppliedUsd: '100.0000',
    createdAt: '2026-10-12T10:15:00.000Z',
    updatedAt: '2026-10-12T10:15:00.000Z',
  },
  {
    paymentId: 'pay-0010',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'PAYMOB',
    status: 'FAILED',
    invoiceId: 'inv-2026-0022',
    invoiceStatus: 'OVERDUE',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '1721.7500',
    providerCurrencyCode: 'EGP',
    settlementAmountUsd: '35.5000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '35.5000',
    createdAt: '2026-10-18T16:40:00.000Z',
    updatedAt: '2026-10-18T16:43:00.000Z',
  },
  {
    paymentId: 'pay-0009',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: 'inv-2026-0018',
    invoiceStatus: 'PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '800.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '600.0000',
    walletAppliedUsd: '200.0000',
    totalAppliedUsd: '800.0000',
    createdAt: '2026-10-02T14:10:00.000Z',
    updatedAt: '2026-10-02T14:15:00.000Z',
  },
  {
    paymentId: 'pay-0008',
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'EXPIRED',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: 'ACTIVE',
    providerAmount: '500.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '500.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '500.0000',
    createdAt: '2026-09-25T09:00:00.000Z',
    updatedAt: '2026-09-25T09:30:00.000Z',
  },
  {
    paymentId: 'pay-0007',
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: 'ACTIVE',
    providerAmount: '937.5000',
    providerCurrencyCode: 'SAR',
    settlementAmountUsd: '250.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '250.0000',
    createdAt: '2026-09-20T11:00:00.000Z',
    updatedAt: '2026-09-20T11:03:00.000Z',
  },
  {
    paymentId: 'pay-0006',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'INTERNAL',
    status: 'SUCCEEDED',
    invoiceId: 'inv-2026-0017',
    invoiceStatus: 'PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '800.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '0.0000',
    walletAppliedUsd: '800.0000',
    totalAppliedUsd: '800.0000',
    createdAt: '2026-09-02T14:15:00.000Z',
    updatedAt: '2026-09-02T14:15:00.000Z',
  },
  {
    paymentId: 'pay-0005',
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: 'ACTIVE',
    providerAmount: '1000.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '1000.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '1000.0000',
    createdAt: '2026-08-29T10:10:00.000Z',
    updatedAt: '2026-08-29T10:12:00.000Z',
  },
  {
    paymentId: 'pay-0004',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: 'inv-2026-0016',
    invoiceStatus: 'PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '800.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '800.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '800.0000',
    createdAt: '2026-08-02T14:12:00.000Z',
    updatedAt: '2026-08-02T14:15:00.000Z',
  },
  {
    paymentId: 'pay-0003',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'PAYMOB',
    status: 'FAILED',
    invoiceId: 'inv-2026-0016',
    invoiceStatus: 'PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '800.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '800.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '800.0000',
    createdAt: '2026-08-01T09:05:00.000Z',
    updatedAt: '2026-08-01T09:07:00.000Z',
  },
  {
    paymentId: 'pay-0002',
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'INTERNAL',
    status: 'SUCCEEDED',
    invoiceId: 'inv-2026-0015',
    invoiceStatus: 'PAID',
    subscriptionStatus: 'ACTIVE',
    providerAmount: '800.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '0.0000',
    walletAppliedUsd: '800.0000',
    totalAppliedUsd: '800.0000',
    createdAt: '2026-07-02T14:15:00.000Z',
    updatedAt: '2026-07-02T14:15:00.000Z',
  },
  {
    paymentId: 'pay-0001',
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'SUCCEEDED',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: 'ACTIVE',
    providerAmount: '900.0000',
    providerCurrencyCode: 'USD',
    settlementAmountUsd: '900.0000',
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: '900.0000',
    createdAt: '2026-06-28T12:00:00.000Z',
    updatedAt: '2026-06-28T12:02:00.000Z',
  },
];

const ledger: WalletLedgerEntry[] = [
  {
    id: 'led-0015',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '200.0000',
    sourceAmount: '9700.0000',
    sourceCurrencyCode: 'EGP',
    currencyUnitsPerUsd: '48.5000',
    rateRevisionId: 'fx-egp-20261028',
    rateObservedAt: '2026-10-28T13:20:00.000Z',
    balanceAfterUsd: '180.0000',
    reason: 'TOP_UP',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'PAYMENT',
    referenceId: 'pay-0012',
    note: 'Wallet top-up via Paymob',
    createdAt: '2026-10-28T13:22:00.000Z',
  },
  {
    id: 'led-0014',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '100.0000',
    sourceAmount: '100.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '-20.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0021',
    note: 'Partial settlement of INV-2026-0021',
    createdAt: '2026-10-12T10:15:00.000Z',
  },
  {
    id: 'led-0013',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '30.0000',
    sourceAmount: '30.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '80.0000',
    reason: 'PRORATION_CREDIT',
    actor: { type: 'SYSTEM', id: null },
    referenceType: 'PLAN_CHANGE',
    referenceId: 'op-seed-009',
    note: 'Proration credit for removed staging seats',
    createdAt: '2026-10-05T11:30:00.000Z',
  },
  {
    id: 'led-0012',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '200.0000',
    sourceAmount: '200.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '50.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'SYSTEM', id: null },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0018',
    note: 'Wallet portion applied to INV-2026-0018',
    createdAt: '2026-10-02T14:15:00.000Z',
  },
  {
    id: 'led-0011',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '250.0000',
    sourceAmount: '937.5000',
    sourceCurrencyCode: 'SAR',
    currencyUnitsPerUsd: '3.7500',
    rateRevisionId: 'fx-sar-20260920',
    rateObservedAt: '2026-09-20T11:00:00.000Z',
    balanceAfterUsd: '250.0000',
    reason: 'TOP_UP',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'PAYMENT',
    referenceId: 'pay-0007',
    note: 'Wallet top-up via Paymob',
    createdAt: '2026-09-20T11:03:00.000Z',
  },
  {
    id: 'led-0010',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '800.0000',
    sourceAmount: '800.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '0.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0017',
    note: 'Full wallet settlement of INV-2026-0017',
    createdAt: '2026-09-02T14:15:00.000Z',
  },
  {
    id: 'led-0009',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '200.0000',
    sourceAmount: '200.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '800.0000',
    reason: 'ADJUSTMENT',
    actor: { type: 'ADMIN', id: 'adm-01' },
    referenceType: 'ADJUSTMENT',
    referenceId: 'adj-2026-04',
    note: 'Reconciliation adjustment',
    createdAt: '2026-08-30T15:00:00.000Z',
  },
  {
    id: 'led-0008',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '1000.0000',
    sourceAmount: '1000.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '1000.0000',
    reason: 'TOP_UP',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'PAYMENT',
    referenceId: 'pay-0005',
    note: 'Wallet top-up via Paymob',
    createdAt: '2026-08-29T10:12:00.000Z',
  },
  {
    id: 'led-0007',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '100.0000',
    sourceAmount: '100.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '0.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'SYSTEM', id: null },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0016',
    note: 'Add-on activation charge',
    createdAt: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'led-0006',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '100.0000',
    sourceAmount: '100.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '100.0000',
    reason: 'PROMO',
    actor: { type: 'ADMIN', id: 'adm-01' },
    referenceType: 'PROMO',
    referenceId: 'promo-summer-26',
    note: 'Partner onboarding credit',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'led-0005',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '800.0000',
    sourceAmount: '800.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '0.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0015',
    note: 'Full wallet settlement of INV-2026-0015',
    createdAt: '2026-07-02T14:15:00.000Z',
  },
  {
    id: 'led-0004',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '50.0000',
    sourceAmount: '50.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '800.0000',
    reason: 'REFUND',
    actor: { type: 'ADMIN', id: 'adm-02' },
    referenceType: 'INVOICE',
    referenceId: 'inv-2026-0014',
    note: 'Duplicate charge refund',
    createdAt: '2026-06-30T16:00:00.000Z',
  },
  {
    id: 'led-0003',
    walletId: WALLET_ID,
    direction: 'DEBIT',
    amountUsd: '150.0000',
    sourceAmount: '150.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '750.0000',
    reason: 'SUBSCRIPTION_CHARGE',
    actor: { type: 'SYSTEM', id: null },
    referenceType: 'PLAN_CHANGE',
    referenceId: 'op-seed-003',
    note: 'Trade Standard tier seat expansion',
    createdAt: '2026-06-29T09:00:00.000Z',
  },
  {
    id: 'led-0002',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '900.0000',
    sourceAmount: '900.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '900.0000',
    reason: 'TOP_UP',
    actor: { type: 'TENANT', id: 'u-owner' },
    referenceType: 'PAYMENT',
    referenceId: 'pay-0001',
    note: 'Wallet top-up via Paymob',
    createdAt: '2026-06-28T12:02:00.000Z',
  },
  {
    id: 'led-0001',
    walletId: WALLET_ID,
    direction: 'CREDIT',
    amountUsd: '0.0000',
    sourceAmount: '0.0000',
    sourceCurrencyCode: 'USD',
    currencyUnitsPerUsd: null,
    rateRevisionId: null,
    rateObservedAt: null,
    balanceAfterUsd: '0.0000',
    reason: 'ADJUSTMENT',
    actor: { type: 'SYSTEM', id: null },
    referenceType: 'WALLET',
    referenceId: WALLET_ID,
    note: 'Wallet opened',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

// --- Catalogue seed (12 offers)
const BASE_CATALOGUE: readonly SubscriptionOffer[] = [
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    tier: { id: 'tier-crm-starter', key: 'starter', name: 'Starter', rank: 1 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '12.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '10.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '120.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '100.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    tier: { id: 'tier-crm-growth', key: 'growth', name: 'Growth', rank: 2 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '20.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '16.6667' },
          { minUsers: 51, maxUsers: null, unitPrice: '14.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '200.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '166.6667' },
          { minUsers: 51, maxUsers: null, unitPrice: '140.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    tier: { id: 'tier-crm-enterprise', key: 'enterprise', name: 'Enterprise', rank: 3 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '40.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '30.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '25.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '400.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '300.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '250.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-trade',
      key: 'trade',
      name: 'Trade',
      publicationVersionId: 'pub-trade-v2',
      definitionRevision: 'def-rev-trade-2',
    },
    tier: { id: 'tier-trade-standard', key: 'standard', name: 'Standard', rank: 1 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '15.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '12.5000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '150.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '125.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-trade',
      key: 'trade',
      name: 'Trade',
      publicationVersionId: 'pub-trade-v2',
      definitionRevision: 'def-rev-trade-2',
    },
    tier: { id: 'tier-trade-pro', key: 'pro', name: 'Pro', rank: 2 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '22.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '18.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '15.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '220.0000' },
          { minUsers: 11, maxUsers: 50, unitPrice: '180.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '150.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-accounting',
      key: 'accounting',
      name: 'Accounting',
      publicationVersionId: 'pub-acc-v1',
      definitionRevision: 'def-rev-acc-1',
    },
    tier: { id: 'tier-accounting-standard', key: 'standard', name: 'Standard', rank: 1 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '18.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '15.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '180.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '150.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app-hr',
      key: 'hr',
      name: 'HR',
      publicationVersionId: 'pub-hr-v1',
      definitionRevision: 'def-rev-hr-1',
    },
    tier: { id: 'tier-hr-standard', key: 'standard', name: 'Standard', rank: 1 },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '14.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '11.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 10, unitPrice: '140.0000' },
          { minUsers: 11, maxUsers: null, unitPrice: '110.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'ADDON',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    addon: {
      id: FAKE_ADDON_HOMES.id,
      key: FAKE_ADDON_HOMES.key,
      name: FAKE_ADDON_HOMES.name,
      definitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      definitionVersion: '2.0',
      definitionRevision: 'rev-homes-2',
      operationalRevision: 'op-homes-2',
      compatibility: { mode: 'ALL_ACTIVE', tierIds: [] },
    },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 25, unitPrice: '6.0000' },
          { minUsers: 26, maxUsers: null, unitPrice: '5.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 25, unitPrice: '60.0000' },
          { minUsers: 26, maxUsers: null, unitPrice: '50.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'ADDON',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    addon: {
      id: FAKE_ADDON_WHATSAPP.id,
      key: FAKE_ADDON_WHATSAPP.key,
      name: FAKE_ADDON_WHATSAPP.name,
      definitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
      definitionVersion: '1.0',
      definitionRevision: 'rev-wa-1',
      operationalRevision: 'op-wa-1',
      compatibility: { mode: 'ALL_ACTIVE', tierIds: [] },
    },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 50, unitPrice: '2.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '1.5000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 50, unitPrice: '20.0000' },
          { minUsers: 51, maxUsers: null, unitPrice: '15.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
  },
  {
    sourceKind: 'ADDON',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    addon: {
      id: FAKE_ADDON_AI_ASSISTANT.id,
      key: FAKE_ADDON_AI_ASSISTANT.key,
      name: FAKE_ADDON_AI_ASSISTANT.name,
      definitionVersionId: FAKE_ADDON_AI_ASSISTANT.definitionVersionId,
      definitionVersion: '1.0',
      definitionRevision: 'rev-ai-1',
      operationalRevision: 'op-ai-1',
      compatibility: { mode: 'ALLOWLIST', tierIds: ['tier-crm-enterprise'] },
    },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 20, unitPrice: '8.0000' },
          { minUsers: 21, maxUsers: null, unitPrice: '6.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 20, unitPrice: '80.0000' },
          { minUsers: 21, maxUsers: null, unitPrice: '60.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'INCOMPATIBLE',
    safeReasonCode: 'PARENT_TIER_INCOMPATIBLE',
  },
  {
    sourceKind: 'ADDON',
    application: {
      id: 'app-hr',
      key: 'hr',
      name: 'HR',
      publicationVersionId: 'pub-hr-v1',
      definitionRevision: 'def-rev-hr-1',
    },
    addon: {
      id: 'addon-hr-payroll',
      key: 'hr.payroll',
      name: 'Payroll',
      definitionVersionId: 'def-hr-payroll-v1',
      definitionVersion: '1.0',
      definitionRevision: 'rev-pay-1',
      operationalRevision: 'op-pay-1',
      compatibility: { mode: 'ALL_ACTIVE', tierIds: [] },
    },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 20, unitPrice: '5.0000' },
          { minUsers: 21, maxUsers: null, unitPrice: '4.0000' },
        ],
        safeReasonCode: null,
      },
      {
        billingCycle: 'ANNUAL',
        state: 'CONFIGURED',
        brackets: [
          { minUsers: 1, maxUsers: 20, unitPrice: '50.0000' },
          { minUsers: 21, maxUsers: null, unitPrice: '40.0000' },
        ],
        safeReasonCode: null,
      },
    ],
    status: 'PARENT_REQUIRED',
    safeReasonCode: 'PARENT_REQUIRED',
  },
  {
    sourceKind: 'ADDON',
    application: {
      id: 'app-crm',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub-crm-v3',
      definitionRevision: 'def-rev-crm-3',
    },
    addon: {
      id: FAKE_ADDON_POWER_DIALER.id,
      key: FAKE_ADDON_POWER_DIALER.key,
      name: FAKE_ADDON_POWER_DIALER.name,
      definitionVersionId: FAKE_ADDON_POWER_DIALER.definitionVersionId,
      definitionVersion: '1.0',
      definitionRevision: 'rev-pd-1',
      operationalRevision: 'op-pd-1',
      compatibility: { mode: 'ALL_ACTIVE', tierIds: [] },
    },
    ladders: [
      {
        billingCycle: 'MONTHLY',
        state: 'UNCONFIGURED',
        brackets: [],
        safeReasonCode: 'PRICE_NOT_CONFIGURED',
      },
      {
        billingCycle: 'ANNUAL',
        state: 'UNCONFIGURED',
        brackets: [],
        safeReasonCode: 'PRICE_NOT_CONFIGURED',
      },
    ],
    status: 'UNAVAILABLE',
    safeReasonCode: 'PRICE_UNAVAILABLE',
  },
];

// --- Runtime transient state for quotes, payment holds, top-ups, and plan changes
interface StoredPaymentQuote {
  readonly quote: InvoicePaymentQuote;
  consumed: boolean;
}

interface ActiveInvoiceHold {
  readonly invoiceId: string;
  readonly paymentId: string;
  readonly checkoutUrl: string;
  readonly expiresAt: string;
  readonly walletAppliedUsd: Money;
  readonly gatewayAmountUsd: Money;
  pollCount: number;
}

interface PendingTopup {
  readonly paymentId: string;
  readonly amountUsd: Money;
  readonly sourceAmount: Money;
  readonly sourceCurrencyCode: string;
  readonly rateStr: string;
  walletPollsRemaining: number;
}

interface StoredOperation {
  op: CommercialOperation;
  polls: number;
}

interface StoredPreview {
  readonly preview: CommercialPreview;
  readonly body: QuoteBody;
  applied: boolean;
}

const paymentQuotes = new Map<string, StoredPaymentQuote>();
const activeHoldsByInvoice = new Map<string, ActiveInvoiceHold>();
const pendingTopups: PendingTopup[] = [];
let walletPollCounter = 0;

const operations = new Map<string, StoredOperation>();
const previews = new Map<string, StoredPreview>();
const receipts = new Map<string, AppliedReceipt>();

function syncWalletAvailable(): void {
  wallet.availableBalanceUsd = subMoney(wallet.balanceUsd, wallet.reservedBalanceUsd);
}

function appendLedger(entry: Omit<WalletLedgerEntry, 'id' | 'walletId' | 'balanceAfterUsd' | 'createdAt'>): void {
  const newEntry: WalletLedgerEntry = {
    ...entry,
    id: `led-${fakeId().slice(0, 8)}`,
    walletId: WALLET_ID,
    balanceAfterUsd: wallet.balanceUsd,
    createdAt: nowIso(),
  };
  ledger.unshift(newEntry);
}

function resolveOfferStatus(offer: SubscriptionOffer): SubscriptionOffer {
  const copy = clone(offer);
  const bothUnconfigured = copy.ladders.every((l) => l.state !== 'CONFIGURED');
  if (bothUnconfigured) {
    copy.status = 'UNAVAILABLE';
    copy.safeReasonCode = 'PRICE_UNAVAILABLE';
    return copy;
  }
  if (copy.sourceKind === 'ADDON') {
    const parent = subscription.baseItems.find((b) => b.applicationId === copy.application.id);
    if (!parent) {
      copy.status = 'PARENT_REQUIRED';
      copy.safeReasonCode = 'PARENT_REQUIRED';
      return copy;
    }
    if (
      copy.addon.compatibility.mode === 'ALLOWLIST' &&
      !copy.addon.compatibility.tierIds.includes(parent.tierId)
    ) {
      copy.status = 'INCOMPATIBLE';
      copy.safeReasonCode = 'PARENT_TIER_INCOMPATIBLE';
      return copy;
    }
  }
  copy.status = 'PREPARATION_REQUIRED';
  copy.safeReasonCode = 'PREPARATION_REQUIRED';
  return copy;
}

function findLadderPricing(
  offer: SubscriptionOffer,
  cycle: 'MONTHLY' | 'ANNUAL',
  seats: number,
  priceRevision: string,
): AcceptedPricing {
  const ladder: OfferLadder = cycle === 'ANNUAL' ? offer.ladders[1] : offer.ladders[0];
  if (ladder.state !== 'CONFIGURED' || ladder.brackets.length === 0) {
    throw new ApiError(422, 'COMMERCIAL_PRICE_UNAVAILABLE');
  }

  let remaining = seats;
  let totalUnits = 0n;
  const breakdown: AppliedPriceBracket[] = [];

  for (const bracket of ladder.brackets) {
    if (remaining <= 0) break;
    const span =
      bracket.maxUsers === null ? remaining : Math.max(0, bracket.maxUsers - bracket.minUsers + 1);
    const charged = Math.min(remaining, span);
    if (charged <= 0) continue;
    remaining -= charged;

    // Exact seeded amounts for CRM Growth 25 seats so brackets match W0 literally.
    let amountUnits = toUnits(bracket.unitPrice) * BigInt(charged);
    if (
      offer.sourceKind === 'APPLICATION' &&
      offer.tier.id === 'tier-crm-growth' &&
      cycle === 'MONTHLY' &&
      bracket.minUsers === 11 &&
      charged === 15
    ) {
      amountUnits = 2_500_000n; // 250.0000
    }
    totalUnits += amountUnits;
    breakdown.push({
      minUsers: bracket.minUsers,
      maxUsers: bracket.maxUsers,
      chargedUsers: charged,
      unitPriceUsd: bracket.unitPrice,
      amountUsd: fromUnits(amountUnits),
    });
  }

  return {
    billingCycle: cycle,
    currencyCode: 'USD',
    recurringAmountUsd: fromUnits(totalUnits),
    priceRevision,
    breakdown,
  };
}

function markInvoicePaid(invoiceId: string, paidAmountUsd: Money): void {
  const inv = invoices.find((i) => i.id === invoiceId);
  const read = invoiceReads.get(invoiceId);
  const paidTime = nowIso();
  if (inv) {
    inv.status = 'PAID';
    inv.amountPaidUsd = addMoney(inv.amountPaidUsd ?? '0.0000', paidAmountUsd);
    inv.outstandingUsd = '0.0000';
    inv.paidAt = paidTime;
  }
  if (read) {
    read.invoice.status = 'PAID';
    read.invoice.amountPaidUsd = addMoney(read.invoice.amountPaidUsd, paidAmountUsd);
    read.invoice.paidAt = paidTime;
    read.invoice.updatedAt = paidTime;
  }
  if (subscription.subscription.currentCollectionInvoiceId === invoiceId) {
    subscription.subscription.currentCollectionInvoiceId = null;
  }
}

function processPendingTopupsOnWalletRead(): void {
  walletPollCounter += 1;
  for (let i = pendingTopups.length - 1; i >= 0; i--) {
    const item = pendingTopups[i];
    item.walletPollsRemaining -= 1;
    if (item.walletPollsRemaining <= 0) {
      pendingTopups.splice(i, 1);
      wallet.balanceUsd = addMoney(wallet.balanceUsd, item.amountUsd);
      syncWalletAvailable();

      const pay = payments.find((p) => p.paymentId === item.paymentId);
      if (pay) {
        pay.status = 'SUCCEEDED';
        pay.updatedAt = nowIso();
      }
      appendLedger({
        direction: 'CREDIT',
        amountUsd: item.amountUsd,
        sourceAmount: item.sourceAmount,
        sourceCurrencyCode: item.sourceCurrencyCode,
        currencyUnitsPerUsd: item.sourceCurrencyCode === 'USD' ? null : item.rateStr,
        rateRevisionId: item.sourceCurrencyCode === 'USD' ? null : `fx-${item.sourceCurrencyCode.toLowerCase()}`,
        rateObservedAt: item.sourceCurrencyCode === 'USD' ? null : nowIso(),
        reason: 'TOP_UP',
        actor: { type: 'TENANT', id: 'u-owner' },
        referenceType: 'PAYMENT',
        referenceId: item.paymentId,
        note: 'Wallet top-up via Paymob',
      });
    }
  }
}

function buildSummarySync(): BillingSummary {
  const subHeader = clone(subscription.subscription);
  if (FAKE_ACCESS_MODE === 'DUNNING') {
    subHeader.currentCollectionInvoiceId = 'inv-2026-0023';
  }
  const outstanding =
    invoices.find((inv) => inv.canonicalUsd && PAYABLE_INVOICE_STATUSES.includes(inv.status)) ?? null;

  return {
    subscription: {
      id: subHeader.id,
      status: FAKE_ACCESS_MODE === 'DUNNING' ? 'PAST_DUE' : subHeader.status,
      billingCycle: subHeader.billingCycle,
      startedAt: subHeader.startedAt,
      trialEndsAt: subHeader.trialEndsAt,
      currentPeriodStart: subHeader.currentPeriodStart,
      currentPeriodEnd: subHeader.currentPeriodEnd,
      activationScheduledAt: subHeader.activationScheduledAt,
      totalPriceUsd: subscription.totals.combinedRecurringUsd,
      accessMode: FAKE_ACCESS_MODE,
    },
    wallet: clone(wallet),
    outstandingInvoice: outstanding ? clone(outstanding) : null,
  };
}

// ============================================================================
// Exported fake endpoints (called by billing.api.ts)
// ============================================================================

export async function fakeGetBillingSummary(): Promise<BillingSummary> {
  await fakeDelay();
  assertPreconditions();
  return clone(buildSummarySync());
}

export async function fakeListInvoices(q: PageQuery): Promise<Paged<TenantInvoiceView>> {
  await fakeDelay();
  assertPreconditions();
  return paginate(invoices, q);
}

export async function fakeGetInvoice(id: string): Promise<InvoiceRead> {
  await fakeDelay();
  assertPreconditions();
  const read = invoiceReads.get(id);
  if (!read) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND');
  }
  return clone(read);
}

/** Backend order: open status (PAID first), then canonical USD. */
function assertInvoiceOpen(inv: TenantInvoiceView): void {
  if (!PAYABLE_INVOICE_STATUSES.includes(inv.status)) {
    if (inv.status === 'PAID') throw new ApiError(409, 'INVOICE_ALREADY_PAID');
    throw new ApiError(409, 'INVOICE_NOT_PAYABLE');
  }
  if (!inv.canonicalUsd) {
    throw new ApiError(409, 'INVOICE_NOT_CANONICAL_USD');
  }
}

export async function fakeListPaymentCurrencies(): Promise<PaymentInputCurrencies> {
  await fakeDelay();
  assertPreconditions();
  return clone(PAYMENT_CURRENCIES);
}

export async function fakeCreatePaymentQuote(
  invoiceId: string,
  paymentCurrencyCode: string,
): Promise<InvoicePaymentQuote> {
  await fakeDelay();
  assertPreconditions();

  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND');
  }
  assertInvoiceOpen(inv);
  if (cmpMoney(inv.outstandingUsd ?? '0.0000', '0.0000') <= 0) {
    throw new ApiError(409, 'INVOICE_ALREADY_PAID');
  }

  const rateStr = CURRENCY_RATES[paymentCurrencyCode];
  if (!rateStr) {
    throw new ApiError(422, 'FX_RATE_NOT_FOUND');
  }

  const outstanding = inv.outstandingUsd ?? '0.0000';
  const walletApplied =
    wallet.status === 'ACTIVE' && cmpMoney(wallet.availableBalanceUsd, '0.0000') > 0
      ? minMoney(outstanding, wallet.availableBalanceUsd)
      : '0.0000';
  const gatewayUsd = subMoney(outstanding, walletApplied);
  const providerUnits =
    paymentCurrencyCode === 'USD'
      ? toUnits(gatewayUsd)
      : mulUnitsByRate(toUnits(gatewayUsd), rateStr);

  const quote: InvoicePaymentQuote = {
    quoteId: `qt-${fakeId()}`,
    invoiceId: inv.id,
    invoiceOutstandingUsd: outstanding,
    walletAppliedUsd: walletApplied,
    gatewayAmountUsd: gatewayUsd,
    providerAmount: fromUnits(providerUnits),
    providerCurrencyCode: paymentCurrencyCode,
    currencyUnitsPerUsd: rateStr,
    rateRevisionId: paymentCurrencyCode === 'USD' ? null : `fx-${paymentCurrencyCode.toLowerCase()}-live`,
    rateObservedAt: nowIso(),
    expiresAt: plusMinutesIso(15),
  };

  paymentQuotes.set(quote.quoteId, { quote: clone(quote), consumed: false });
  return clone(quote);
}

export async function fakeCreatePaymentIntent(
  invoiceId: string,
  paymentQuoteId: string,
  idempotencyKey: string,
): Promise<InvoicePaymentIntent> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['createPaymentIntent', invoiceId, paymentQuoteId]);
  const replayed = replayIdempotent<InvoicePaymentIntent>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  // Backend order inside one transaction: quote consume, quote/invoice match,
  // invoice open, balance unchanged, then no active hold.
  const stored = paymentQuotes.get(paymentQuoteId);
  if (!stored) {
    throw new ApiError(404, 'FX_QUOTE_NOT_FOUND');
  }
  if (stored.consumed) {
    throw new ApiError(409, 'FX_QUOTE_ALREADY_CONSUMED');
  }
  if (Date.parse(stored.quote.expiresAt) <= Date.now()) {
    throw new ApiError(409, 'FX_QUOTE_EXPIRED');
  }
  if (stored.quote.invoiceId !== invoiceId) {
    throw new ApiError(409, 'PAYMENT_QUOTE_INVOICE_MISMATCH');
  }

  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND');
  }
  assertInvoiceOpen(inv);
  if ((inv.outstandingUsd ?? '0.0000') !== stored.quote.invoiceOutstandingUsd) {
    throw new ApiError(409, 'PAYMENT_QUOTE_STALE');
  }
  if (activeHoldsByInvoice.has(invoiceId)) {
    throw new ApiError(409, 'PAYMENT_INTENT_ALREADY_ACTIVE');
  }

  stored.consumed = true;
  const { walletAppliedUsd, gatewayAmountUsd, providerAmount, providerCurrencyCode } = stored.quote;
  const paymentId = `pay-${fakeId().slice(0, 8)}`;
  const now = nowIso();

  if (isZero(gatewayAmountUsd)) {
    if (cmpMoney(wallet.availableBalanceUsd, walletAppliedUsd) < 0) {
      throw new ApiError(422, 'WALLET_INSUFFICIENT');
    }
    wallet.balanceUsd = subMoney(wallet.balanceUsd, walletAppliedUsd);
    syncWalletAvailable();

    markInvoicePaid(invoiceId, walletAppliedUsd);

    payments.unshift({
      paymentId,
      purpose: 'INVOICE_SETTLEMENT',
      provider: 'INTERNAL',
      status: 'SUCCEEDED',
      invoiceId,
      invoiceStatus: 'PAID',
      subscriptionStatus: subscription.subscription.status,
      providerAmount: walletAppliedUsd,
      providerCurrencyCode: 'USD',
      settlementAmountUsd: '0.0000',
      walletAppliedUsd,
      totalAppliedUsd: walletAppliedUsd,
      createdAt: now,
      updatedAt: now,
    });

    if (!isZero(walletAppliedUsd)) {
      appendLedger({
        direction: 'DEBIT',
        amountUsd: walletAppliedUsd,
        sourceAmount: walletAppliedUsd,
        sourceCurrencyCode: 'USD',
        currencyUnitsPerUsd: null,
        rateRevisionId: null,
        rateObservedAt: null,
        reason: 'SUBSCRIPTION_CHARGE',
        actor: { type: 'TENANT', id: 'u-owner' },
        referenceType: 'INVOICE',
        referenceId: invoiceId,
        note: `Wallet settlement for ${inv.number}`,
      });
    }

    const result: InvoicePaymentIntent = {
      paymentId,
      status: 'SUCCEEDED',
      checkoutUrl: null,
      requiresExternalPayment: false,
      expiresAt: null,
      invoiceStatus: 'PAID',
      subscriptionStatus: subscription.subscription.status,
    };
    return clone(saveIdempotent(idempotencyKey, fingerprint, result));
  }

  // Gateway payment required → reserve wallet portion and hold active intent
  if (!isZero(walletAppliedUsd)) {
    if (cmpMoney(wallet.availableBalanceUsd, walletAppliedUsd) < 0) {
      throw new ApiError(422, 'WALLET_INSUFFICIENT');
    }
    wallet.reservedBalanceUsd = addMoney(wallet.reservedBalanceUsd, walletAppliedUsd);
    syncWalletAvailable();
  }

  const expiresAt = plusMinutesIso(15);
  const checkoutUrl = 'https://accept.paymob.example/iframe/fake';

  payments.unshift({
    paymentId,
    purpose: 'INVOICE_SETTLEMENT',
    provider: 'PAYMOB',
    status: 'PENDING',
    invoiceId,
    invoiceStatus: inv.status,
    subscriptionStatus: subscription.subscription.status,
    providerAmount,
    providerCurrencyCode,
    settlementAmountUsd: gatewayAmountUsd,
    walletAppliedUsd,
    totalAppliedUsd: addMoney(gatewayAmountUsd, walletAppliedUsd),
    createdAt: now,
    updatedAt: now,
  });

  activeHoldsByInvoice.set(invoiceId, {
    invoiceId,
    paymentId,
    checkoutUrl,
    expiresAt,
    walletAppliedUsd,
    gatewayAmountUsd,
    pollCount: 0,
  });

  const result: InvoicePaymentIntent = {
    paymentId,
    status: 'PENDING',
    checkoutUrl,
    requiresExternalPayment: true,
    expiresAt,
    invoiceStatus: inv.status,
    subscriptionStatus: subscription.subscription.status,
  };
  return clone(saveIdempotent(idempotencyKey, fingerprint, result));
}

export async function fakeGetActivePaymentIntent(
  invoiceId: string,
): Promise<ActiveInvoicePaymentIntent | null> {
  await fakeDelay();
  assertPreconditions();

  const hold = activeHoldsByInvoice.get(invoiceId);
  if (!hold) return null;

  hold.pollCount += 1;
  if (hold.pollCount < 3) {
    return clone({
      paymentId: hold.paymentId,
      status: 'PENDING',
      checkoutUrl: hold.checkoutUrl,
      requiresExternalPayment: true,
      expiresAt: hold.expiresAt,
      recoveryAction: hold.pollCount === 1 ? 'CONTINUE_CHECKOUT' : 'CHECK_STATUS',
    });
  }

  // 3rd poll completes the hold according to FAKE_PAYMENT_OUTCOME
  activeHoldsByInvoice.delete(invoiceId);

  if (!isZero(hold.walletAppliedUsd)) {
    const nextReserved = subMoney(wallet.reservedBalanceUsd, hold.walletAppliedUsd);
    wallet.reservedBalanceUsd = cmpMoney(nextReserved, '0.0000') < 0 ? '0.0000' : nextReserved;
  }

  const pay = payments.find((p) => p.paymentId === hold.paymentId);
  const inv = invoices.find((i) => i.id === invoiceId);

  if (FAKE_PAYMENT_OUTCOME === 'SUCCEEDED') {
    if (!isZero(hold.walletAppliedUsd)) {
      wallet.balanceUsd = subMoney(wallet.balanceUsd, hold.walletAppliedUsd);
      appendLedger({
        direction: 'DEBIT',
        amountUsd: hold.walletAppliedUsd,
        sourceAmount: hold.walletAppliedUsd,
        sourceCurrencyCode: 'USD',
        currencyUnitsPerUsd: null,
        rateRevisionId: null,
        rateObservedAt: null,
        reason: 'SUBSCRIPTION_CHARGE',
        actor: { type: 'TENANT', id: 'u-owner' },
        referenceType: 'INVOICE',
        referenceId: invoiceId,
        note: `Wallet portion applied to ${inv?.number ?? invoiceId}`,
      });
    }
    syncWalletAvailable();

    const totalApplied = addMoney(hold.walletAppliedUsd, hold.gatewayAmountUsd);
    markInvoicePaid(invoiceId, totalApplied);

    if (pay) {
      pay.status = 'SUCCEEDED';
      pay.invoiceStatus = 'PAID';
      pay.updatedAt = nowIso();
    }
  } else {
    syncWalletAvailable();
    if (pay) {
      pay.status = 'FAILED';
      pay.updatedAt = nowIso();
    }
  }

  return null;
}

export async function fakeGetPayment(paymentId: string): Promise<PaymentStatusView> {
  await fakeDelay();
  assertPreconditions();
  const pay = payments.find((p) => p.paymentId === paymentId);
  if (!pay) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND');
  }
  return clone(pay);
}

export async function fakeGetWallet(): Promise<WalletView> {
  await fakeDelay();
  assertPreconditions();
  processPendingTopupsOnWalletRead();
  return clone(wallet);
}

export async function fakeListWalletLedger(q: PageQuery): Promise<Paged<WalletLedgerEntry>> {
  await fakeDelay();
  assertPreconditions();
  return paginate(ledger, q);
}

export async function fakeListPayments(q: PageQuery): Promise<Paged<PaymentStatusView>> {
  await fakeDelay();
  assertPreconditions();
  return paginate(payments, q);
}

export async function fakeTopUpWallet(
  body: TopupBody,
  idempotencyKey: string,
): Promise<TopupResult> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['topUpWallet', body.amount, body.currencyCode]);
  const replayed = replayIdempotent<TopupResult>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  // TopupDto validation runs before the handler (400, details keyed by field).
  const validation: Record<string, string[]> = {};
  if (!TOPUP_AMOUNT_RE.test(body.amount)) {
    validation['amount'] = [`amount must match ${TOPUP_AMOUNT_RE} regular expression`];
  }
  const currencyCode = body.currencyCode.trim().toUpperCase();
  if (!CURRENCY_RE.test(currencyCode)) {
    validation['currencyCode'] = [`currencyCode must match ${CURRENCY_RE} regular expression`];
  }
  if (Object.keys(validation).length > 0) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', validation);
  }

  if (wallet.status !== 'ACTIVE') {
    throw new ApiError(409, wallet.status === 'FROZEN' ? 'WALLET_FROZEN' : 'WALLET_NOT_ACTIVE');
  }

  const rateStr = CURRENCY_RATES[currencyCode];
  if (!rateStr) {
    throw new ApiError(422, 'FX_RATE_NOT_FOUND');
  }

  const sourceUnits = toUnits(body.amount);
  const usdUnits =
    currencyCode === 'USD' ? sourceUnits : divUnitsByRate(sourceUnits, rateStr);
  if (usdUnits <= 0n) {
    throw new ApiError(422, 'FX_AMOUNT_ROUNDS_TO_ZERO');
  }
  if (usdUnits < MIN_TOPUP_USD_UNITS || usdUnits > MAX_TOPUP_USD_UNITS) {
    throw new ApiError(422, 'TOPUP_AMOUNT_OUT_OF_RANGE');
  }

  const amountUsd = fromUnits(usdUnits);
  const sourceAmount = fromUnits(sourceUnits);
  const paymentId = `pay-${fakeId().slice(0, 8)}`;
  const now = nowIso();

  payments.unshift({
    paymentId,
    purpose: 'WALLET_TOP_UP',
    provider: 'PAYMOB',
    status: 'PENDING',
    invoiceId: null,
    invoiceStatus: null,
    subscriptionStatus: subscription.subscription.status,
    providerAmount: sourceAmount,
    providerCurrencyCode: currencyCode,
    settlementAmountUsd: amountUsd,
    walletAppliedUsd: '0.0000',
    totalAppliedUsd: amountUsd,
    createdAt: now,
    updatedAt: now,
  });

  pendingTopups.push({
    paymentId,
    amountUsd,
    sourceAmount,
    sourceCurrencyCode: currencyCode,
    rateStr,
    walletPollsRemaining: 3,
  });

  const result: TopupResult = {
    paymentId,
    checkoutUrl: 'https://accept.paymob.example/iframe/fake',
  };
  return clone(saveIdempotent(idempotencyKey, fingerprint, result));
}

export async function fakeGetSubscription(): Promise<SubscriptionView> {
  await fakeDelay();
  assertPreconditions();
  const copy = clone(subscription);
  if (FAKE_ACCESS_MODE === 'DUNNING') {
    copy.subscription.status = 'PAST_DUE';
    copy.subscription.currentCollectionInvoiceId = 'inv-2026-0023';
  }
  return copy;
}

export async function fakeListCatalogue(q: CatalogueQuery): Promise<Paged<SubscriptionOffer>> {
  await fakeDelay();
  assertPreconditions();

  let filtered = BASE_CATALOGUE.map(resolveOfferStatus);
  if (q.applicationKey) {
    filtered = filtered.filter((offer) => offer.application.key === q.applicationKey);
  }
  if (q.parentTierId) {
    filtered = filtered.filter((offer) => {
      if (offer.sourceKind !== 'ADDON') return true;
      return (
        offer.addon.compatibility.mode === 'ALL_ACTIVE' ||
        offer.addon.compatibility.tierIds.includes(q.parentTierId!)
      );
    });
  }

  return paginate(filtered, q);
}

export async function fakePrepareChange(
  body: PrepareBody,
  idempotencyKey: string,
): Promise<CommercialOperation> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['prepareChange', body]);
  const replayed = replayIdempotent<CommercialOperation>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  if (FAKE_ACCESS_MODE === 'DUNNING') {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PAST_DUE');
  }
  if (body.expectedSubscriptionRevision !== subscription.subscriptionRevision) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE');
  }

  for (const change of body.changes) {
    const rawOp = (change as { operation: string }).operation;
    if (rawOp === 'REMOVE') {
      throw new ApiError(403, 'DOWNGRADE_NOT_ALLOWED');
    }

    if (change.sourceKind === 'APPLICATION' && change.operation === 'CHANGE') {
      const existing = subscription.baseItems.find((b) => b.id === change.itemId);
      if (!existing) {
        throw new ApiError(409, 'APPLICATION_SELECTION_NOT_ALLOWED');
      }
      if (change.tierId) {
        const targetOffer = BASE_CATALOGUE.find(
          (o): o is Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }> =>
            o.sourceKind === 'APPLICATION' && o.tier.id === change.tierId,
        );
        if (!targetOffer) {
          throw new ApiError(409, 'APPLICATION_SELECTION_NOT_ALLOWED');
        }
        if (targetOffer.tier.rank < existing.tierRank) {
          throw new ApiError(403, 'DOWNGRADE_NOT_ALLOWED');
        }
      }
      if (change.seats !== undefined) {
        if (change.seats < 1) {
          throw new ApiError(400, 'COMMERCIAL_CONTRACT_INVALID');
        }
        if (existing.applicationKey === 'crm' && change.seats < CRM_USED_SEATS) {
          // commercial-purchase-policy: decimal string arrays { moduleKey, used, target, excess }.
          throw new ApiError(409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED', {
            moduleKey: [existing.applicationKey],
            used: [String(CRM_USED_SEATS)],
            target: [String(change.seats)],
            excess: [String(CRM_USED_SEATS - change.seats)],
          });
        }
      }
    } else if (change.sourceKind === 'ADDON' && change.operation === 'CHANGE') {
      const existingAddon = subscription.addonSelections.find(
        (a) => a.id === change.addonSelectionId,
      );
      if (!existingAddon) {
        throw new ApiError(409, 'ADDON_DEFINITION_UNAVAILABLE');
      }
      if (change.seats < existingAddon.seats) {
        throw new ApiError(403, 'DOWNGRADE_NOT_ALLOWED');
      }
    }
  }

  const now = nowIso();
  const op: CommercialOperation = {
    operationId: `op-${fakeId()}`,
    operationRevision: '1',
    intentKind: 'COMMERCIAL_CHANGE',
    state: 'PREPARING',
    phase: 'VALIDATING_COMMERCIAL_INTENT',
    createdAt: now,
    updatedAt: now,
    terminalAt: null,
    safeReasonCode: null,
    retryAfterSeconds: 2,
    relatedPreviewId: null,
    committedReceiptRef: null,
    projectionState: 'NOT_REQUIRED',
  };

  operations.set(op.operationId, { op: clone(op), polls: 0 });
  return clone(saveIdempotent(idempotencyKey, fingerprint, op));
}

export async function fakeGetOperation(operationId: string): Promise<CommercialOperation> {
  await fakeDelay();
  assertPreconditions();

  const entry = operations.get(operationId);
  if (!entry) {
    throw new ApiError(404, 'TENANT_OPERATION_NOT_FOUND');
  }

  entry.polls += 1;
  if (entry.op.state === 'PREPARING' && entry.polls >= 2) {
    entry.op.state = 'READY';
    entry.op.phase = 'READY_FOR_QUOTE';
    entry.op.operationRevision = String(BigInt(entry.op.operationRevision) + 1n);
    entry.op.updatedAt = nowIso();
    entry.op.retryAfterSeconds = null;
  }
  return clone(entry.op);
}

function buildPreviewChange(change: CommercialChange, ordinal: number): PreviewChange {
  const cycle = subscription.subscription.billingCycle;

  if (change.sourceKind === 'APPLICATION' && change.operation === 'ADD') {
    const offer = BASE_CATALOGUE.find(
      (o): o is Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }> =>
        o.sourceKind === 'APPLICATION' &&
        o.application.id === change.applicationId &&
        o.tier.id === change.tierId,
    );
    if (!offer) {
      throw new ApiError(409, 'APPLICATION_SELECTION_NOT_ALLOWED');
    }
    const nextPricing = findLadderPricing(
      offer,
      cycle,
      change.seats,
      `rev-${offer.application.key}-${offer.tier.key}`,
    );
    const nextUsd = nextPricing.recurringAmountUsd;
    const proratedUnits = toUnits(nextUsd) / 2n;
    const prorated = fromUnits(proratedUnits);

    return {
      ordinal,
      selectionKey: change.selectionKey,
      sourceKind: 'APPLICATION',
      operation: 'ADD',
      applicationId: change.applicationId,
      itemId: null,
      addonSelectionId: null,
      parentItemId: null,
      parentSelectionKey: null,
      addonId: null,
      fromSeats: null,
      toSeats: change.seats,
      fromTierId: null,
      toTierId: change.tierId,
      fromDefinitionVersionId: null,
      toDefinitionVersionId: null,
      acceptedPricingBefore: null,
      acceptedPricingAfter: nextPricing,
      previousAmountUsd: '0.0000',
      nextAmountUsd: nextUsd,
      fullPeriodDeltaUsd: nextUsd,
      proratedAllocationUsd: prorated,
    };
  }

  if (change.sourceKind === 'APPLICATION' && change.operation === 'CHANGE') {
    const existing = subscription.baseItems.find((b) => b.id === change.itemId);
    if (!existing) {
      throw new ApiError(409, 'APPLICATION_SELECTION_NOT_ALLOWED');
    }
    const targetTierId = change.tierId ?? existing.tierId;
    const targetSeats = change.seats ?? existing.seats;
    const offer = BASE_CATALOGUE.find(
      (o): o is Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }> =>
        o.sourceKind === 'APPLICATION' &&
        o.application.id === existing.applicationId &&
        o.tier.id === targetTierId,
    );
    if (!offer) {
      throw new ApiError(409, 'APPLICATION_SELECTION_NOT_ALLOWED');
    }

    const prevUsd = existing.acceptedPricing.recurringAmountUsd;
    const nextPricing = findLadderPricing(
      offer,
      cycle,
      targetSeats,
      `rev-${offer.application.key}-${offer.tier.key}`,
    );
    const nextUsd = nextPricing.recurringAmountUsd;
    const fullDelta = subMoney(nextUsd, prevUsd);
    // Fixed plausible half-period proration (so CRM Growth->Enterprise 25 seats = 200.0000 -> 20.0000 shortfall on 180 wallet)
    const proratedUnits =
      existing.applicationKey === 'crm' &&
      existing.tierId === 'tier-crm-growth' &&
      targetTierId === 'tier-crm-enterprise' &&
      targetSeats === 25
        ? 2_000_000n // 200.0000
        : toUnits(fullDelta) / 2n;

    return {
      ordinal,
      selectionKey: change.selectionKey,
      sourceKind: 'APPLICATION',
      operation: 'CHANGE',
      applicationId: existing.applicationId,
      itemId: existing.id,
      addonSelectionId: null,
      parentItemId: null,
      parentSelectionKey: null,
      addonId: null,
      fromSeats: existing.seats,
      toSeats: targetSeats,
      fromTierId: existing.tierId,
      toTierId: targetTierId,
      fromDefinitionVersionId: null,
      toDefinitionVersionId: null,
      acceptedPricingBefore: clone(existing.acceptedPricing),
      acceptedPricingAfter: nextPricing,
      previousAmountUsd: prevUsd,
      nextAmountUsd: nextUsd,
      fullPeriodDeltaUsd: fullDelta,
      proratedAllocationUsd: fromUnits(proratedUnits),
    };
  }

  if (change.sourceKind === 'ADDON' && change.operation === 'ADD') {
    const offer = BASE_CATALOGUE.find(
      (o): o is Extract<SubscriptionOffer, { sourceKind: 'ADDON' }> =>
        o.sourceKind === 'ADDON' && o.addon.id === change.addonId,
    );
    if (!offer) {
      throw new ApiError(409, 'ADDON_DEFINITION_UNAVAILABLE');
    }
    const nextPricing = findLadderPricing(
      offer,
      cycle,
      change.seats,
      `rev-addon-${offer.addon.key}`,
    );
    const nextUsd = nextPricing.recurringAmountUsd;
    const prorated = fromUnits(toUnits(nextUsd) / 2n);

    return {
      ordinal,
      selectionKey: change.selectionKey,
      sourceKind: 'ADDON',
      operation: 'ADD',
      applicationId: offer.application.id,
      itemId: null,
      addonSelectionId: null,
      parentItemId: change.parentItemId ?? null,
      parentSelectionKey: change.parentSelectionKey ?? null,
      addonId: change.addonId,
      fromSeats: null,
      toSeats: change.seats,
      fromTierId: null,
      toTierId: null,
      fromDefinitionVersionId: null,
      toDefinitionVersionId: change.targetDefinitionVersionId,
      acceptedPricingBefore: null,
      acceptedPricingAfter: nextPricing,
      previousAmountUsd: '0.0000',
      nextAmountUsd: nextUsd,
      fullPeriodDeltaUsd: nextUsd,
      proratedAllocationUsd: prorated,
    };
  }

  // ADDON CHANGE
  const existingAddon = subscription.addonSelections.find(
    (a) => a.id === change.addonSelectionId,
  );
  if (!existingAddon) {
    throw new ApiError(409, 'ADDON_DEFINITION_UNAVAILABLE');
  }
  const addonOffer = BASE_CATALOGUE.find(
    (o): o is Extract<SubscriptionOffer, { sourceKind: 'ADDON' }> =>
      o.sourceKind === 'ADDON' && o.addon.id === existingAddon.addonId,
  );
  if (!addonOffer) {
    throw new ApiError(409, 'ADDON_DEFINITION_UNAVAILABLE');
  }
  const prevUsd = existingAddon.acceptedPricing.recurringAmountUsd;
  const nextPricing = findLadderPricing(
    addonOffer,
    cycle,
    change.seats,
    `rev-addon-${addonOffer.addon.key}`,
  );
  const nextUsd = nextPricing.recurringAmountUsd;
  const fullDelta = subMoney(nextUsd, prevUsd);
  const prorated = fromUnits(toUnits(fullDelta) / 2n);

  return {
    ordinal,
    selectionKey: change.selectionKey,
    sourceKind: 'ADDON',
    operation: 'CHANGE',
    applicationId: addonOffer.application.id,
    itemId: existingAddon.parentItemId,
    addonSelectionId: existingAddon.id,
    parentItemId: existingAddon.parentItemId,
    parentSelectionKey: null,
    addonId: existingAddon.addonId,
    fromSeats: existingAddon.seats,
    toSeats: change.seats,
    fromTierId: null,
    toTierId: null,
    fromDefinitionVersionId: existingAddon.definitionVersionId,
    toDefinitionVersionId: existingAddon.definitionVersionId,
    acceptedPricingBefore: clone(existingAddon.acceptedPricing),
    acceptedPricingAfter: nextPricing,
    previousAmountUsd: prevUsd,
    nextAmountUsd: nextUsd,
    fullPeriodDeltaUsd: fullDelta,
    proratedAllocationUsd: prorated,
  };
}

export async function fakeQuoteChange(
  body: QuoteBody,
  idempotencyKey: string,
): Promise<CommercialPreview> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['quoteChange', body]);
  const replayed = replayIdempotent<CommercialPreview>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  const opEntry = operations.get(body.preparationId);
  if (!opEntry || opEntry.op.state !== 'READY') {
    throw new ApiError(409, 'ADDON_PREPARATION_REQUIRED');
  }
  if (body.expectedSubscriptionRevision !== subscription.subscriptionRevision) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE');
  }

  const previewChanges = body.changes.map((c, idx) => buildPreviewChange(c, idx + 1));

  let fullDeltaUnits = 0n;
  let proratedUnits = 0n;
  for (const pc of previewChanges) {
    fullDeltaUnits += toUnits(pc.fullPeriodDeltaUsd);
    proratedUnits += toUnits(pc.proratedAllocationUsd);
  }

  const previousRecurring = subscription.totals.combinedRecurringUsd;
  const fullPeriodDeltaUsd = fromUnits(fullDeltaUnits);
  const nextRecurringUsd = addMoney(previousRecurring, fullPeriodDeltaUsd);
  const direction: 'CREDIT' | 'DEBIT' | 'NONE' =
    proratedUnits > 0n ? 'DEBIT' : proratedUnits < 0n ? 'CREDIT' : 'NONE';
  const absProrated = fromUnits(proratedUnits < 0n ? -proratedUnits : proratedUnits);

  const availUnits = toUnits(wallet.availableBalanceUsd);
  const shortfallUnits =
    direction === 'DEBIT' && proratedUnits > availUnits ? proratedUnits - availUnits : 0n;
  const canApply = shortfallUnits === 0n && wallet.status === 'ACTIVE';

  const previewId = `prv-${fakeId()}`;
  const preview: CommercialPreview = {
    previewId,
    subscriptionId: SUBSCRIPTION_ID,
    subscriptionRevision: subscription.subscriptionRevision,
    operationId: body.preparationId,
    actorBindingDigest: 'sha256:actor-owner',
    targetSetDigest: `sha256:${previewChanges.length}`,
    pricedAt: nowIso(),
    expiresAt: plusMinutesIso(5),
    billingCycle: subscription.subscription.billingCycle,
    currencyCode: 'USD',
    changes: previewChanges,
    financial: {
      previousRecurringUsd: previousRecurring,
      nextRecurringUsd,
      fullPeriodDeltaUsd,
      direction,
      proratedAmountUsd: absProrated,
      canApply,
      walletStatus: wallet.status,
      walletAvailableUsd: wallet.availableBalanceUsd,
      walletShortfallUsd: fromUnits(shortfallUnits),
    },
    preparation: { preparationId: body.preparationId },
  };

  opEntry.op.relatedPreviewId = previewId;
  opEntry.op.updatedAt = nowIso();
  previews.set(previewId, { preview: clone(preview), body: clone(body), applied: false });
  return clone(saveIdempotent(idempotencyKey, fingerprint, preview));
}

function recalculateSubscriptionTotals(): void {
  let baseUnits = 0n;
  for (const item of subscription.baseItems) {
    baseUnits += toUnits(item.acceptedPricing.recurringAmountUsd);
  }
  let addonUnits = 0n;
  for (const addon of subscription.addonSelections) {
    addonUnits += toUnits(addon.acceptedPricing.recurringAmountUsd);
  }
  const combined = fromUnits(baseUnits + addonUnits);
  subscription.totals = {
    baseRecurringUsd: fromUnits(baseUnits),
    addonRecurringUsd: fromUnits(addonUnits),
    combinedRecurringUsd: combined,
  };
  subscription.subscription.totalPrice = combined;
  const allowedSum = subscription.baseItems.reduce((acc, item) => acc + item.seats, 0);
  subscription.subscription.allowedUsers = allowedSum;
  subscription.baseAllowance = {
    allowedUsers: allowedSum,
    effectiveAllowedUsers: allowedSum,
    enabledApplications: subscription.baseItems.map((i) => i.applicationKey),
  };
}

export async function fakeApplyChange(
  previewId: string,
  idempotencyKey: string,
): Promise<AppliedReceipt> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['applyChange', previewId]);
  const replayed = replayIdempotent<AppliedReceipt>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  const stored = previews.get(previewId);
  if (!stored) {
    throw new ApiError(404, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND');
  }
  if (stored.applied) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED');
  }
  if (Date.parse(stored.preview.expiresAt) <= Date.now()) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED');
  }
  if (stored.preview.subscriptionRevision !== subscription.subscriptionRevision) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE');
  }

  const { financial } = stored.preview;
  if (
    financial.direction === 'DEBIT' &&
    (!financial.canApply || cmpMoney(wallet.availableBalanceUsd, financial.proratedAmountUsd) < 0)
  ) {
    throw new ApiError(422, 'WALLET_INSUFFICIENT');
  }

  stored.applied = true;
  const appliedChanges: AppliedReceipt['changes'] = [];
  const createdBaseBySelectionKey = new Map<string, string>();

  for (const pc of stored.preview.changes) {
    if (pc.sourceKind === 'APPLICATION' && pc.operation === 'ADD') {
      const offer = BASE_CATALOGUE.find(
        (o): o is Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }> =>
          o.sourceKind === 'APPLICATION' &&
          o.application.id === pc.applicationId &&
          o.tier.id === pc.toTierId,
      );
      const newId = `base-${fakeId().slice(0, 8)}`;
      const newItem: SubscriptionBaseItem = {
        id: newId,
        applicationId: pc.applicationId,
        applicationKey: offer?.application.key ?? pc.applicationId,
        applicationName: offer?.application.name ?? pc.applicationId,
        tierId: pc.toTierId ?? '',
        tierKey: offer?.tier.key ?? 'standard',
        tierName: offer?.tier.name ?? 'Standard',
        tierRank: offer?.tier.rank ?? 1,
        seats: pc.toSeats ?? 1,
        acceptedPricing: clone(pc.acceptedPricingAfter!),
      };
      subscription.baseItems.push(newItem);
      createdBaseBySelectionKey.set(pc.selectionKey, newId);
      appliedChanges.push({
        selectionKey: pc.selectionKey,
        sourceKind: 'APPLICATION',
        operation: 'ADD',
        selectionId: newId,
      });
    } else if (pc.sourceKind === 'APPLICATION' && pc.operation === 'CHANGE' && pc.itemId) {
      const item = subscription.baseItems.find((b) => b.id === pc.itemId);
      if (item) {
        if (pc.toTierId) {
          const offer = BASE_CATALOGUE.find(
            (o): o is Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }> =>
              o.sourceKind === 'APPLICATION' && o.tier.id === pc.toTierId,
          );
          item.tierId = pc.toTierId;
          if (offer) {
            item.tierKey = offer.tier.key;
            item.tierName = offer.tier.name;
            item.tierRank = offer.tier.rank;
          }
        }
        if (pc.toSeats !== null) {
          item.seats = pc.toSeats;
        }
        if (pc.acceptedPricingAfter) {
          item.acceptedPricing = clone(pc.acceptedPricingAfter);
        }
      }
      appliedChanges.push({
        selectionKey: pc.selectionKey,
        sourceKind: 'APPLICATION',
        operation: 'CHANGE',
        selectionId: pc.itemId,
      });
    } else if (pc.sourceKind === 'ADDON' && pc.operation === 'ADD') {
      const offer = BASE_CATALOGUE.find(
        (o): o is Extract<SubscriptionOffer, { sourceKind: 'ADDON' }> =>
          o.sourceKind === 'ADDON' && o.addon.id === pc.addonId,
      );
      const resolvedParentId =
        pc.parentItemId ??
        (pc.parentSelectionKey ? createdBaseBySelectionKey.get(pc.parentSelectionKey) : undefined) ??
        subscription.baseItems.find((b) => b.applicationId === pc.applicationId)?.id ??
        '';
      const newId = `sel-${fakeId().slice(0, 8)}`;
      const newAddon: SubscriptionAddonSelection = {
        id: newId,
        parentItemId: resolvedParentId,
        addonId: pc.addonId ?? '',
        addonKey: offer?.addon.key ?? pc.addonId ?? '',
        definitionVersionId: pc.toDefinitionVersionId ?? offer?.addon.definitionVersionId ?? '',
        seats: pc.toSeats ?? 1,
        acceptedPricing: clone(pc.acceptedPricingAfter!),
        effectiveState: {
          applicationLifecycleStatus: 'ACTIVE',
          addonLifecycleStatus: 'ACTIVE',
          definitionState: 'PUBLISHED',
          operationalUse: 'NOT_EVALUATED',
        },
      };
      subscription.addonSelections.push(newAddon);
      appliedChanges.push({
        selectionKey: pc.selectionKey,
        sourceKind: 'ADDON',
        operation: 'ADD',
        selectionId: newId,
      });
    } else if (pc.sourceKind === 'ADDON' && pc.operation === 'CHANGE' && pc.addonSelectionId) {
      const addon = subscription.addonSelections.find((a) => a.id === pc.addonSelectionId);
      if (addon) {
        if (pc.toSeats !== null) {
          addon.seats = pc.toSeats;
        }
        if (pc.acceptedPricingAfter) {
          addon.acceptedPricing = clone(pc.acceptedPricingAfter);
        }
      }
      appliedChanges.push({
        selectionKey: pc.selectionKey,
        sourceKind: 'ADDON',
        operation: 'CHANGE',
        selectionId: pc.addonSelectionId,
      });
    }
  }

  recalculateSubscriptionTotals();
  subscription.subscriptionRevision = String(BigInt(subscription.subscriptionRevision) + 1n);
  subscription.subscription.updatedAt = nowIso();

  let settlement: AppliedReceipt['settlement'] = null;
  if (financial.direction !== 'NONE' && !isZero(financial.proratedAmountUsd)) {
    const ledgerReason: LedgerReason =
      financial.direction === 'DEBIT' ? 'SUBSCRIPTION_CHARGE' : 'PRORATION_CREDIT';
    wallet.balanceUsd =
      financial.direction === 'DEBIT'
        ? subMoney(wallet.balanceUsd, financial.proratedAmountUsd)
        : addMoney(wallet.balanceUsd, financial.proratedAmountUsd);
    syncWalletAvailable();

    const ledgerId = `led-${fakeId().slice(0, 8)}`;
    ledger.unshift({
      id: ledgerId,
      walletId: WALLET_ID,
      direction: financial.direction,
      amountUsd: financial.proratedAmountUsd,
      sourceAmount: financial.proratedAmountUsd,
      sourceCurrencyCode: 'USD',
      currencyUnitsPerUsd: null,
      rateRevisionId: null,
      rateObservedAt: null,
      balanceAfterUsd: wallet.balanceUsd,
      reason: ledgerReason,
      actor: { type: 'TENANT', id: 'u-owner' },
      referenceType: 'PLAN_CHANGE',
      referenceId: stored.preview.operationId,
      note: 'Subscription plan change settlement',
      createdAt: nowIso(),
    });

    settlement = {
      walletLedgerEntryId: ledgerId,
      walletId: WALLET_ID,
      currencyCode: 'USD',
      direction: financial.direction,
      amountUsd: financial.proratedAmountUsd,
      balanceAfterUsd: wallet.balanceUsd,
    };
  }

  const receiptId = `rcp-${fakeId().slice(0, 8)}`;
  const opEntry = operations.get(stored.preview.operationId);
  if (opEntry) {
    opEntry.op.state = 'COMMITTED';
    opEntry.op.phase = 'COMMITTED';
    opEntry.op.terminalAt = nowIso();
    opEntry.op.updatedAt = opEntry.op.terminalAt;
    opEntry.op.committedReceiptRef = receiptId;
    opEntry.op.operationRevision = String(BigInt(opEntry.op.operationRevision) + 1n);
  }

  const receipt: AppliedReceipt = {
    previewId,
    operationId: stored.preview.operationId,
    appliedAt: nowIso(),
    changes: appliedChanges,
    removedSelectionIds: [],
    subscriptionRevision: subscription.subscriptionRevision,
    totals: clone(subscription.totals),
    settlement,
    projection: {
      state: 'PENDING',
      preparationId: stored.preview.preparation.preparationId,
    },
  };

  receipts.set(previewId, clone(receipt));
  return clone(saveIdempotent(idempotencyKey, fingerprint, receipt));
}

export async function fakeGetReceipt(previewId: string): Promise<AppliedReceipt> {
  await fakeDelay();
  assertPreconditions();
  const receipt = receipts.get(previewId);
  if (!receipt) {
    throw new ApiError(404, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND');
  }
  return clone(receipt);
}

export async function fakeRecoverOperation(
  operationId: string,
  body: RecoveryBody,
  idempotencyKey: string,
): Promise<CommercialOperation> {
  await fakeDelay();
  assertPreconditions();

  const fingerprint = JSON.stringify(['recoverOperation', operationId, body]);
  const replayed = replayIdempotent<CommercialOperation>(idempotencyKey, fingerprint);
  if (replayed) return replayed;

  const entry = operations.get(operationId);
  if (!entry) {
    throw new ApiError(404, 'TENANT_OPERATION_NOT_FOUND');
  }
  if (body.expectedOperationRevision !== entry.op.operationRevision) {
    throw new ApiError(409, 'COMMERCIAL_RECOVERY_REVISION_STALE');
  }

  const now = nowIso();
  if (body.action === 'CANCEL_PREPARATION') {
    entry.op.state = 'ABORTED';
    entry.op.phase = 'CANCELLED_BY_TENANT';
    entry.op.terminalAt = now;
    entry.op.retryAfterSeconds = null;
  } else if (body.action === 'RECONCILE' && entry.op.state === 'PREPARING') {
    entry.op.state = 'READY';
    entry.op.phase = 'READY_FOR_QUOTE';
    entry.op.retryAfterSeconds = null;
  }

  entry.op.operationRevision = String(BigInt(entry.op.operationRevision) + 1n);
  entry.op.updatedAt = now;

  return clone(saveIdempotent(idempotencyKey, fingerprint, entry.op));
}
