import type {
  AdminCurrentCollectionInvoiceView,
  AdminTenantBillingSummaryView,
  BillingActorType,
  BillingCycle,
  InvoicePurpose,
  InvoiceStatus,
  LedgerDirection,
  LedgerReason,
  PageView,
  PaymentProvider,
  PaymentPurpose,
  PaymentReconciliationAction,
  PaymentReconciliationCaseView,
  PaymentReconciliationStatus,
  PaymentReconciliationView,
  PaymentStatus,
  PaymentStatusView,
  SubscriptionCancellationResult,
  SubscriptionItemView,
  SubscriptionPlanChangeApplyResult,
  SubscriptionPlanChangeOperation,
  SubscriptionPlanChangePreviewView,
  SubscriptionStatus,
  SubscriptionView,
  WalletAdjustmentPreviewView,
  WalletInputCurrenciesView,
  WalletLedgerView,
  WalletStatus,
  WalletView,
} from "../types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/u;
const SIGNED_MONEY_PATTERN = /^-?(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/u;
const FX_RATE_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const MODULE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const ENABLED_MODULE_PATTERN = /^module\.[a-z][a-z0-9_]{0,63}$/u;
const ZERO = BigInt(0);
const ONE_FX_UNIT = BigInt("1000000000000");

const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const satisfies readonly SubscriptionStatus[];
const BILLING_CYCLES = ["MONTHLY", "ANNUAL"] as const satisfies readonly BillingCycle[];
const WALLET_STATUSES = ["ACTIVE", "FROZEN", "CLOSED"] as const satisfies readonly WalletStatus[];
const LEDGER_DIRECTIONS = ["CREDIT", "DEBIT"] as const satisfies readonly LedgerDirection[];
const LEDGER_REASONS = [
  "TOP_UP",
  "SUBSCRIPTION_CHARGE",
  "PRORATION_CREDIT",
  "REFUND",
  "PROMO",
  "ADJUSTMENT",
] as const satisfies readonly LedgerReason[];
const ACTOR_TYPES = ["ADMIN", "TENANT", "SYSTEM"] as const satisfies readonly BillingActorType[];
const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "EXPIRED",
  "REQUIRES_REVIEW",
  "REFUND_PENDING",
  "REFUNDED",
] as const satisfies readonly PaymentStatus[];
const PAYMENT_PROVIDERS = ["PAYMOB", "INTERNAL", "OFFLINE"] as const satisfies readonly PaymentProvider[];
const PAYMENT_PURPOSES = ["WALLET_TOP_UP", "INVOICE_SETTLEMENT"] as const satisfies readonly PaymentPurpose[];
const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const satisfies readonly InvoiceStatus[];
const INVOICE_PURPOSES = [
  "TRIAL_ACTIVATION",
  "RENEWAL",
  "PRORATION",
  "MANUAL",
] as const satisfies readonly InvoicePurpose[];
const PLAN_OPERATIONS = ["ADD", "CHANGE", "REMOVE"] as const satisfies readonly SubscriptionPlanChangeOperation[];
const RECONCILIATION_ACTIONS = [
  "CONFIRM_SUCCEEDED",
  "CONFIRM_FAILED",
  "CONFIRM_REFUNDED",
  "CONFIRM_REFUND_FAILED",
] as const satisfies readonly PaymentReconciliationAction[];
const RECONCILIATION_STATUSES = [
  "PROPOSED",
  "APPLIED",
  "REJECTED",
] as const satisfies readonly PaymentReconciliationStatus[];

export interface BillingReadIdentity {
  tenantId?: string;
  subscriptionId?: string;
  paymentId?: string;
  walletId?: string;
  previewId?: string;
  paymentStatus?: PaymentStatus;
}

export class TenantBillingContractError extends Error {
  constructor(readonly errorCode: string) {
    super(errorCode);
    this.name = "TenantBillingContractError";
  }
}

export function readCoreData<T>(
  payload: unknown,
  reader: (value: unknown) => T,
): T {
  const envelope = coreEnvelope(payload, "INVALID_CORE_ENVELOPE");
  return reader(envelope.data);
}

export function readCorePage<T>(
  payload: unknown,
  itemReader: (value: unknown) => T,
): PageView<T> {
  const envelope = coreEnvelope(payload, "INVALID_CORE_ENVELOPE");
  const rawItems = boundedArray(envelope.data, 100, "INVALID_PAGE_DATA");
  const meta = object(envelope.meta, "INVALID_PAGE_META");
  const page = positiveInteger(meta.page, "INVALID_PAGE_META");
  const limit = positiveInteger(meta.limit, "INVALID_PAGE_META", 100);
  const total = nonNegativeInteger(meta.total, "INVALID_PAGE_META");
  const totalPages = nonNegativeInteger(meta.totalPages, "INVALID_PAGE_META");
  const hasNext = boolean(meta.hasNext, "INVALID_PAGE_META");
  const hasPrev = boolean(meta.hasPrev, "INVALID_PAGE_META");

  if (
    rawItems.length > limit ||
    total < rawItems.length ||
    totalPages !== Math.ceil(total / limit) ||
    hasNext !== (page < totalPages) ||
    hasPrev !== (page > 1)
  ) {
    fail("INVALID_PAGE_META");
  }

  return {
    items: rawItems.map((value) => itemReader(value)),
    meta: { page, limit, total, totalPages, hasNext, hasPrev },
  };
}

export function readSubscriptionView(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionView {
  const code = "INVALID_SUBSCRIPTION_RESPONSE";
  const root = object(value, code);
  const header = object(root.subscription, code);
  const id = uuidV7(header.id, code);
  const tenantId = nullableUuidV7(header.tenantId, code);
  assertIdentity(id, expected.subscriptionId, code);
  if (expected.tenantId !== undefined && tenantId !== expected.tenantId) fail(code);

  const pendingPeriodStart = nullableIsoTimestamp(header.pendingPeriodStart, code);
  const pendingPeriodEnd = nullableIsoTimestamp(header.pendingPeriodEnd, code);
  if (
    (pendingPeriodStart === null) !== (pendingPeriodEnd === null) ||
    (pendingPeriodStart !== null &&
      pendingPeriodEnd !== null &&
      timestampMs(pendingPeriodEnd) <= timestampMs(pendingPeriodStart))
  ) {
    fail(code);
  }

  const createdAt = isoTimestamp(header.createdAt, code);
  const updatedAt = isoTimestamp(header.updatedAt, code);
  if (timestampMs(updatedAt) < timestampMs(createdAt)) fail(code);

  const currentPeriodStart = nullableIsoTimestamp(header.currentPeriodStart, code);
  const currentPeriodEnd = isoTimestamp(header.currentPeriodEnd, code);
  if (
    currentPeriodStart !== null &&
    timestampMs(currentPeriodEnd) <= timestampMs(currentPeriodStart)
  ) {
    fail(code);
  }

  const items = readSubscriptionItems(root.items, { subscriptionId: id });
  const effectiveAllowedUsers = nonNegativeInteger(root.effectiveAllowedUsers, code);
  if (
    items.length > 0 &&
    effectiveAllowedUsers !== items.reduce((sum, item) => sum + item.seats, 0)
  ) {
    fail(code);
  }

  const enabledModules = boundedArray(root.enabledModules, 100, code).map((item) =>
    matchingString(item, ENABLED_MODULE_PATTERN, code),
  );
  assertUnique(enabledModules, code);
  if (items.length > 0) {
    const derivedModules = items.flatMap((item) =>
      item.moduleKey === undefined ? [] : ["module." + item.moduleKey],
    );
    assertUnique(derivedModules, code);
    if (!sameSet(enabledModules, derivedModules)) fail(code);
  }

  const totalPrice = nullableMoney(header.totalPrice, code);
  if (
    items.length > 0 &&
    totalPrice !== null &&
    moneyMinor(totalPrice, code) !==
      items.reduce((sum, item) => sum + moneyMinor(item.lineTotal, code), ZERO)
  ) {
    fail(code);
  }

  return {
    subscription: {
      id,
      tenantId,
      allowedUsers: nonNegativeInteger(header.allowedUsers, code),
      status: oneOf(header.status, SUBSCRIPTION_STATUSES, code),
      billingCycle: nullableOneOf(header.billingCycle, BILLING_CYCLES, code),
      currencyCode: nullableCurrencyCode(header.currencyCode, code),
      startedAt: isoTimestamp(header.startedAt, code),
      currentPeriodStart,
      currentPeriodEnd,
      pendingPeriodStart,
      pendingPeriodEnd,
      trialDays: positiveInteger(header.trialDays, code, 365),
      trialStartedAt: nullableIsoTimestamp(header.trialStartedAt, code),
      trialEndsAt: nullableIsoTimestamp(header.trialEndsAt, code),
      activationScheduledAt: nullableIsoTimestamp(header.activationScheduledAt, code),
      activatedAt: nullableIsoTimestamp(header.activatedAt, code),
      cancelAt: nullableIsoTimestamp(header.cancelAt, code),
      totalPrice,
      createdAt,
      updatedAt,
    },
    effectiveAllowedUsers,
    enabledModules,
    items,
  };
}

export function readSubscriptionItems(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionItemView[] {
  const code = "INVALID_SUBSCRIPTION_ITEMS_RESPONSE";
  const rawItems = boundedArray(value, 100, code);
  const items = rawItems.map((item) => readSubscriptionItem(item, expected));
  assertUnique(items.map((item) => item.id), code);
  assertUnique(items.map((item) => item.moduleId), code);
  const subscriptionId = expected.subscriptionId ?? items[0]?.subscriptionId;
  if (
    subscriptionId !== undefined &&
    items.some((item) => item.subscriptionId !== subscriptionId)
  ) {
    fail(code);
  }
  return items;
}

export function readSubscriptionItem(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionItemView {
  const code = "INVALID_SUBSCRIPTION_ITEM";
  const item = object(value, code);
  const subscriptionId = uuidV7(item.subscriptionId, code);
  assertIdentity(subscriptionId, expected.subscriptionId, code);

  const features =
    item.features === undefined || item.features === null
      ? null
      : boundedArray(item.features, 500, code).map((feature) =>
          boundedString(feature, 96, code),
        );
  if (features !== null) assertUnique(features, code);

  return {
    id: uuidV7(item.id, code),
    subscriptionId,
    moduleId: uuidV7(item.moduleId, code),
    tierId: uuidV7(item.tierId, code),
    seats: positiveInteger(item.seats, code),
    lineTotal: money(item.lineTotal, code),
    features,
    ...optionalMatchingStringProperty(item, "moduleKey", MODULE_KEY_PATTERN, code),
    ...optionalBoundedStringProperty(item, "moduleName", 128, code),
    ...optionalBoundedStringProperty(item, "tierKey", 64, code),
    ...optionalBoundedStringProperty(item, "tierName", 128, code),
    ...optionalNullableCurrencyProperty(item, "currencyCode", code),
    ...optionalIsoTimestampProperty(item, "createdAt", code),
    ...optionalIsoTimestampProperty(item, "updatedAt", code),
  };
}

export function readPlanChangePreview(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionPlanChangePreviewView {
  const code = "INVALID_PLAN_CHANGE_PREVIEW";
  const root = object(value, code);
  const item = object(root.item, code);
  const financial = object(root.financial, code);
  const previewId = uuidV7(root.previewId, code);
  const subscriptionId = uuidV7(root.subscriptionId, code);
  const tenantId = uuidV7(root.tenantId, code);
  assertIdentity(previewId, expected.previewId, code);
  assertIdentity(subscriptionId, expected.subscriptionId, code);
  assertIdentity(tenantId, expected.tenantId, code);

  const operation = oneOf(root.operation, PLAN_OPERATIONS, code);
  const itemId = nullableUuidV7(item.itemId, code);
  const fromTierId = nullableUuidV7(item.fromTierId, code);
  const toTierId = nullableUuidV7(item.toTierId, code);
  const fromSeats = nullablePositiveInteger(item.fromSeats, code);
  const toSeats = nullablePositiveInteger(item.toSeats, code);
  if (
    (operation === "ADD" &&
      (itemId !== null || fromTierId !== null || fromSeats !== null || toTierId === null || toSeats === null)) ||
    (operation === "CHANGE" &&
      (itemId === null || fromTierId === null || fromSeats === null || toTierId === null || toSeats === null)) ||
    (operation === "REMOVE" &&
      (itemId === null || fromTierId === null || fromSeats === null || toTierId !== null || toSeats !== null))
  ) {
    fail(code);
  }

  const previousLineTotalUsd = money(item.previousLineTotalUsd, code);
  const nextLineTotalUsd = money(item.nextLineTotalUsd, code);
  if (
    (operation === "ADD" && moneyMinor(previousLineTotalUsd, code) !== ZERO) ||
    (operation === "REMOVE" && moneyMinor(nextLineTotalUsd, code) !== ZERO)
  ) {
    fail(code);
  }

  const fullPeriodDeltaUsd = signedMoney(financial.fullPeriodDeltaUsd, code);
  const fullPeriodDeltaMinor = signedMoneyMinor(fullPeriodDeltaUsd, code);
  if (
    fullPeriodDeltaMinor !==
    moneyMinor(nextLineTotalUsd, code) - moneyMinor(previousLineTotalUsd, code)
  ) {
    fail(code);
  }

  const direction = oneOf(financial.direction, ["CREDIT", "DEBIT", "NONE"] as const, code);
  const proratedAmountUsd = money(financial.proratedAmountUsd, code);
  const proratedAmountMinor = moneyMinor(proratedAmountUsd, code);
  if (
    (direction === "NONE") !== (proratedAmountMinor === ZERO) ||
    (direction === "DEBIT" && fullPeriodDeltaMinor <= ZERO) ||
    (direction === "CREDIT" && fullPeriodDeltaMinor >= ZERO)
  ) {
    fail(code);
  }

  const walletAvailableUsd = money(financial.walletAvailableUsd, code);
  const walletShortfallUsd = money(financial.walletShortfallUsd, code);
  const expectedShortfall =
    direction === "DEBIT"
      ? maxBigInt(proratedAmountMinor - moneyMinor(walletAvailableUsd, code), ZERO)
      : ZERO;
  if (moneyMinor(walletShortfallUsd, code) !== expectedShortfall) fail(code);

  const walletStatus = oneOf(financial.walletStatus, WALLET_STATUSES, code);
  const canApply = boolean(financial.canApply, code);
  const expectedCanApply =
    expectedShortfall === ZERO && (direction === "NONE" || walletStatus === "ACTIVE");
  if (canApply !== expectedCanApply) fail(code);

  const pricedAt = isoTimestamp(root.pricedAt, code);
  const expiresAt = isoTimestamp(root.expiresAt, code);
  if (timestampMs(expiresAt) <= timestampMs(pricedAt)) fail(code);

  return {
    previewId,
    subscriptionId,
    tenantId,
    operation,
    currencyCode: exactString(root.currencyCode, "USD", code),
    billingCycle: oneOf(root.billingCycle, BILLING_CYCLES, code),
    itemSetFingerprint: matchingString(root.itemSetFingerprint, HASH_PATTERN, code),
    planFingerprint: matchingString(root.planFingerprint, HASH_PATTERN, code),
    pricingRevision: matchingString(root.pricingRevision, HASH_PATTERN, code),
    pricedAt,
    expiresAt,
    item: {
      itemId,
      moduleId: uuidV7(item.moduleId, code),
      fromTierId,
      toTierId,
      fromSeats,
      toSeats,
      previousLineTotalUsd,
      nextLineTotalUsd,
    },
    financial: {
      fullPeriodDeltaUsd,
      direction,
      proratedAmountUsd,
      walletAvailableUsd,
      walletShortfallUsd,
      walletStatus,
      canApply,
    },
  };
}

export function readPlanChangeApplyResult(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionPlanChangeApplyResult {
  const code = "INVALID_PLAN_CHANGE_RESULT";
  const root = object(value, code);
  const wallet = object(root.wallet, code);
  const previewId = uuidV7(root.previewId, code);
  const operation = oneOf(root.operation, PLAN_OPERATIONS, code);
  const removedItemId = nullableUuidV7(root.removedItemId, code);
  assertIdentity(previewId, expected.previewId, code);

  const item =
    root.item === null
      ? null
      : readAppliedSubscriptionItem(root.item, expected.subscriptionId, code);
  if (
    (operation === "REMOVE" && (item !== null || removedItemId === null)) ||
    (operation !== "REMOVE" && (item === null || removedItemId !== null))
  ) {
    fail(code);
  }

  const direction = oneOf(wallet.direction, ["CREDIT", "DEBIT", "NONE"] as const, code);
  const amountUsd = money(wallet.amountUsd, code);
  if ((direction === "NONE") !== (moneyMinor(amountUsd, code) === ZERO)) fail(code);

  return {
    previewId,
    operation,
    appliedAt: isoTimestamp(root.appliedAt, code),
    item,
    removedItemId,
    wallet: { direction, amountUsd },
    subscriptionTotalUsd: money(root.subscriptionTotalUsd, code),
  };
}

export function readCancellationResult(
  value: unknown,
  expected: BillingReadIdentity = {},
): SubscriptionCancellationResult {
  const code = "INVALID_SUBSCRIPTION_CANCELLATION";
  const root = object(value, code);
  const tenantId = uuidV7(root.tenantId, code);
  const subscriptionId = uuidV7(root.subscriptionId, code);
  const status = oneOf(root.status, SUBSCRIPTION_STATUSES, code);
  const cancelAt = isoTimestamp(root.cancelAt, code);
  const scheduled = boolean(root.scheduled, code);
  const appliedAt = nullableIsoTimestamp(root.appliedAt, code);
  assertIdentity(tenantId, expected.tenantId, code);
  assertIdentity(subscriptionId, expected.subscriptionId, code);
  if (
    (scheduled && (status === "CANCELLED" || appliedAt !== null)) ||
    (!scheduled && (status !== "CANCELLED" || appliedAt !== cancelAt))
  ) {
    fail(code);
  }
  return {
    tenantId,
    subscriptionId,
    status,
    cancelAt,
    scheduled,
    changed: boolean(root.changed, code),
    appliedAt,
  };
}

export function readWallet(value: unknown): WalletView {
  const code = "INVALID_WALLET_RESPONSE";
  const root = object(value, code);
  const balanceUsd = money(root.balanceUsd, code);
  const reservedBalanceUsd = money(root.reservedBalanceUsd, code);
  const availableBalanceUsd = money(root.availableBalanceUsd, code);
  const balance = moneyMinor(balanceUsd, code);
  const reserved = moneyMinor(reservedBalanceUsd, code);
  if (
    reserved > balance ||
    moneyMinor(availableBalanceUsd, code) !== balance - reserved
  ) {
    fail(code);
  }
  return {
    currencyCode: exactString(root.currencyCode, "USD", code),
    balanceUsd,
    reservedBalanceUsd,
    availableBalanceUsd,
    status: oneOf(root.status, WALLET_STATUSES, code),
  };
}

export function readWalletInputCurrencies(
  value: unknown,
): WalletInputCurrenciesView {
  const code = "INVALID_WALLET_CURRENCIES_RESPONSE";
  const root = object(value, code);
  const rawItems = boundedArray(root.items, 100, code);
  if (rawItems.length === 0) fail(code);
  const items = rawItems.map((value) => {
    const item = object(value, code);
    return {
      currencyCode: currencyCode(item.currencyCode, code),
      isBaseCurrency: boolean(item.isBaseCurrency, code),
    };
  });
  assertUnique(items.map((item) => item.currencyCode), code);
  if (
    items[0]?.currencyCode !== "USD" ||
    items[0]?.isBaseCurrency !== true ||
    items.slice(1).some((item) => item.isBaseCurrency)
  ) {
    fail(code);
  }
  const total = positiveInteger(root.total, code, 100);
  if (total !== items.length) fail(code);
  return {
    walletCurrencyCode: exactString(root.walletCurrencyCode, "USD", code),
    items,
    total,
  };
}

export function readWalletLedger(
  value: unknown,
  expected: BillingReadIdentity = {},
): WalletLedgerView {
  const code = "INVALID_WALLET_LEDGER_RESPONSE";
  const root = object(value, code);
  const actor = object(root.actor, code);
  const walletId = uuidV7(root.walletId, code);
  assertIdentity(walletId, expected.walletId, code);

  const actorType = oneOf(actor.type, ACTOR_TYPES, code);
  const actorId = nullableUuidV7(actor.id, code);
  if (actorType !== "SYSTEM" && actorId === null) fail(code);

  const sourceCurrencyCode = currencyCode(root.sourceCurrencyCode, code);
  const amountUsd = positiveMoney(root.amountUsd, code);
  const sourceAmount = positiveMoney(root.sourceAmount, code);
  const currencyUnitsPerUsd = nullableFxRate(root.currencyUnitsPerUsd, code);
  const rateRevisionId = nullableUuidV7(root.rateRevisionId, code);
  const rateObservedAt = nullableIsoTimestamp(root.rateObservedAt, code);
  if (
    (currencyUnitsPerUsd === null) !== (rateObservedAt === null) ||
    (sourceCurrencyCode === "USD" &&
      currencyUnitsPerUsd !== null &&
      fxUnits(currencyUnitsPerUsd, code) !== ONE_FX_UNIT) ||
    (currencyUnitsPerUsd === null && rateRevisionId !== null)
  ) {
    fail(code);
  }
  if (
    currencyUnitsPerUsd !== null &&
    sourceToUsdMinor(sourceAmount, currencyUnitsPerUsd, code) !==
      moneyMinor(amountUsd, code)
  ) {
    fail(code);
  }

  return {
    id: uuidV7(root.id, code),
    walletId,
    direction: oneOf(root.direction, LEDGER_DIRECTIONS, code),
    amountUsd,
    sourceAmount,
    sourceCurrencyCode,
    currencyUnitsPerUsd,
    rateRevisionId,
    rateObservedAt,
    balanceAfterUsd: money(root.balanceAfterUsd, code),
    reason: oneOf(root.reason, LEDGER_REASONS, code),
    actor: { type: actorType, id: actorId },
    referenceType: nullableBoundedString(root.referenceType, 32, code),
    referenceId: nullableUuidV7(root.referenceId, code),
    note: nullableBoundedString(root.note, 255, code),
    createdAt: isoTimestamp(root.createdAt, code),
  };
}

export function readWalletAdjustmentPreview(
  value: unknown,
  expected: BillingReadIdentity = {},
): WalletAdjustmentPreviewView {
  const code = "INVALID_WALLET_ADJUSTMENT_PREVIEW";
  const root = object(value, code);
  const quoteId = uuidV7(root.quoteId, code);
  assertIdentity(quoteId, expected.previewId, code);
  const direction = oneOf(root.direction, LEDGER_DIRECTIONS, code);
  const reasonCode = oneOf(root.reasonCode, ["MANUAL_CREDIT", "MANUAL_DEBIT"] as const, code);
  if (
    (direction === "CREDIT" && reasonCode !== "MANUAL_CREDIT") ||
    (direction === "DEBIT" && reasonCode !== "MANUAL_DEBIT")
  ) {
    fail(code);
  }

  const sourceCurrencyCode = currencyCode(root.sourceCurrencyCode, code);
  const currencyUnitsPerUsd = fxRate(root.currencyUnitsPerUsd, code);
  const rateRevisionId = nullableUuidV7(root.rateRevisionId, code);
  if (
    sourceCurrencyCode === "USD" &&
    (fxUnits(currencyUnitsPerUsd, code) !== ONE_FX_UNIT || rateRevisionId !== null)
  ) {
    fail(code);
  }

  const rateObservedAt = isoTimestamp(root.rateObservedAt, code);
  const expiresAt = isoTimestamp(root.expiresAt, code);
  if (timestampMs(expiresAt) <= timestampMs(rateObservedAt)) fail(code);

  const sourceAmount = positiveMoney(root.sourceAmount, code);
  const amountUsd = positiveMoney(root.amountUsd, code);
  if (
    sourceToUsdMinor(sourceAmount, currencyUnitsPerUsd, code) !==
    moneyMinor(amountUsd, code)
  ) {
    fail(code);
  }
  const balanceBeforeUsd = money(root.balanceBeforeUsd, code);
  const balanceAfterUsd = money(root.balanceAfterUsd, code);
  const before = moneyMinor(balanceBeforeUsd, code);
  const amount = moneyMinor(amountUsd, code);
  const expectedAfter = direction === "CREDIT" ? before + amount : before - amount;
  if (
    expectedAfter < ZERO ||
    moneyMinor(balanceAfterUsd, code) !== expectedAfter
  ) {
    fail(code);
  }

  return {
    quoteId,
    purpose: exactString(root.purpose, "ADMIN_WALLET_ADJUSTMENT", code),
    sourceAmount,
    sourceCurrencyCode,
    amountUsd,
    currencyUnitsPerUsd,
    rateRevisionId,
    rateObservedAt,
    expiresAt,
    direction,
    reasonCode,
    balanceBeforeUsd,
    balanceAfterUsd,
  };
}

export function readPayment(
  value: unknown,
  expected: BillingReadIdentity = {},
): PaymentStatusView {
  const code = "INVALID_PAYMENT_RESPONSE";
  const root = object(value, code);
  const paymentId = uuidV7(root.paymentId, code);
  assertIdentity(paymentId, expected.paymentId, code);
  const purpose = oneOf(root.purpose, PAYMENT_PURPOSES, code);
  const invoiceId = nullableUuidV7(root.invoiceId, code);
  if (
    (purpose === "INVOICE_SETTLEMENT" && invoiceId === null) ||
    (purpose === "WALLET_TOP_UP" && invoiceId !== null)
  ) {
    fail(code);
  }

  const settlementAmountUsd = money(root.settlementAmountUsd, code);
  const walletAppliedUsd = money(root.walletAppliedUsd, code);
  const totalAppliedUsd = money(root.totalAppliedUsd, code);
  if (
    moneyMinor(totalAppliedUsd, code) !==
    moneyMinor(settlementAmountUsd, code) + moneyMinor(walletAppliedUsd, code)
  ) {
    fail(code);
  }

  const createdAt = isoTimestamp(root.createdAt, code);
  const updatedAt = isoTimestamp(root.updatedAt, code);
  if (timestampMs(updatedAt) < timestampMs(createdAt)) fail(code);

  return {
    paymentId,
    purpose,
    provider: oneOf(root.provider, PAYMENT_PROVIDERS, code),
    status: oneOf(root.status, PAYMENT_STATUSES, code),
    invoiceId,
    invoiceStatus: nullableOneOf(root.invoiceStatus, INVOICE_STATUSES, code),
    subscriptionStatus: nullableOneOf(root.subscriptionStatus, SUBSCRIPTION_STATUSES, code),
    providerAmount: money(root.providerAmount, code),
    providerCurrencyCode: currencyCode(root.providerCurrencyCode, code),
    settlementAmountUsd,
    walletAppliedUsd,
    totalAppliedUsd,
    createdAt,
    updatedAt,
  };
}

export function readBillingSummary(
  value: unknown,
  expected: BillingReadIdentity = {},
): AdminTenantBillingSummaryView {
  const code = "INVALID_BILLING_SUMMARY_RESPONSE";
  const root = object(value, code);
  const tenantId = uuidV7(root.tenantId, code);
  const subscriptionId = uuidV7(root.subscriptionId, code);
  assertIdentity(tenantId, expected.tenantId, code);
  assertIdentity(subscriptionId, expected.subscriptionId, code);
  return {
    tenantId,
    subscriptionId,
    currentCollectionInvoice:
      root.currentCollectionInvoice === null
        ? null
        : readCurrentInvoice(root.currentCollectionInvoice),
  };
}

export function readReconciliationCase(
  value: unknown,
  expected: BillingReadIdentity = {},
): PaymentReconciliationCaseView {
  const code = "INVALID_RECONCILIATION_RESPONSE";
  const root = object(value, code);
  const payment = object(root.payment, code);
  const paymentId = uuidV7(payment.paymentId, code);
  const tenantId = uuidV7(payment.tenantId, code);
  const paymentStatus = oneOf(payment.status, PAYMENT_STATUSES, code);
  const purpose = oneOf(payment.purpose, PAYMENT_PURPOSES, code);
  const invoiceId = nullableUuidV7(payment.invoiceId, code);
  assertIdentity(paymentId, expected.paymentId, code);
  assertIdentity(tenantId, expected.tenantId, code);
  if (
    (purpose === "INVOICE_SETTLEMENT" && invoiceId === null) ||
    (purpose === "WALLET_TOP_UP" && invoiceId !== null)
  ) {
    fail(code);
  }

  const unexpectedRefundEventReference = nullableBoundedString(
    payment.unexpectedRefundEventReference,
    128,
    code,
  );
  const unexpectedRefundProviderOutcomeReference = nullableBoundedString(
    payment.unexpectedRefundProviderOutcomeReference,
    136,
    code,
  );
  const expectedOutcome =
    unexpectedRefundEventReference === null
      ? null
      : "webhook:" + unexpectedRefundEventReference;
  if (unexpectedRefundProviderOutcomeReference !== expectedOutcome) fail(code);

  const eligibleActions = boundedArray(root.eligibleActions, 4, code).map((action) =>
    oneOf(action, RECONCILIATION_ACTIONS, code),
  );
  assertUnique(eligibleActions, code);
  const reconciliations = boundedArray(root.reconciliations, 100, code).map((item) =>
    readReconciliation(item, {
      tenantId,
      paymentId,
      paymentStatus,
    }),
  );
  assertUnique(reconciliations.map((item) => item.id), code);

  return {
    payment: {
      paymentId,
      tenantId,
      status: paymentStatus,
      purpose,
      provider: oneOf(payment.provider, PAYMENT_PROVIDERS, code),
      invoiceId,
      failureCode: nullableBoundedString(payment.failureCode, 128, code),
      providerSucceededAt: nullableIsoTimestamp(payment.providerSucceededAt, code),
      providerSuccessEventReference: nullableBoundedString(
        payment.providerSuccessEventReference,
        128,
        code,
      ),
      unexpectedRefundEventReference,
      unexpectedRefundProviderOutcomeReference,
      refundAttemptedAt: nullableIsoTimestamp(payment.refundAttemptedAt, code),
      refundProviderReference: nullableBoundedString(payment.refundProviderReference, 128, code),
      refundReservedUsd: money(payment.refundReservedUsd, code),
    },
    eligibleActions,
    reconciliations,
  };
}

export function readReconciliation(
  value: unknown,
  expected: BillingReadIdentity = {},
): PaymentReconciliationView {
  const code = "INVALID_RECONCILIATION_RESPONSE";
  const root = object(value, code);
  const paymentId = uuidV7(root.paymentId, code);
  const tenantId = uuidV7(root.tenantId, code);
  const status = oneOf(root.status, RECONCILIATION_STATUSES, code);
  const action = oneOf(root.action, RECONCILIATION_ACTIONS, code);
  const providerOutcomeReference = nullableBoundedString(
    root.providerOutcomeReference,
    128,
    code,
  );
  const proposedByAdminId = uuidV7(root.proposedByAdminId, code);
  const decidedByAdminId = nullableUuidV7(root.decidedByAdminId, code);
  const decisionNote = nullableBoundedString(root.decisionNote, 500, code);
  const decidedAt = nullableIsoTimestamp(root.decidedAt, code);
  const paymentStatus = oneOf(root.paymentStatus, PAYMENT_STATUSES, code);
  assertIdentity(paymentId, expected.paymentId, code);
  assertIdentity(tenantId, expected.tenantId, code);
  if (expected.paymentStatus !== undefined && paymentStatus !== expected.paymentStatus) {
    fail(code);
  }
  if (
    (status === "PROPOSED" &&
      (decidedByAdminId !== null || decisionNote !== null || decidedAt !== null)) ||
    (status !== "PROPOSED" &&
      (decidedByAdminId === null || decisionNote === null || decidedAt === null)) ||
    (decidedByAdminId !== null && decidedByAdminId === proposedByAdminId)
  ) {
    fail(code);
  }
  if (
    (action === "CONFIRM_REFUNDED" && providerOutcomeReference === null) ||
    (action !== "CONFIRM_REFUNDED" && providerOutcomeReference !== null)
  ) {
    fail(code);
  }

  const createdAt = isoTimestamp(root.createdAt, code);
  if (decidedAt !== null && timestampMs(decidedAt) < timestampMs(createdAt)) fail(code);

  return {
    id: uuidV7(root.id, code),
    paymentId,
    tenantId,
    action,
    status,
    evidenceReference: boundedString(root.evidenceReference, 128, code),
    providerOutcomeReference,
    proposalNote: boundedString(root.proposalNote, 500, code),
    proposedByAdminId,
    decidedByAdminId,
    decisionNote,
    decidedAt,
    paymentStatus,
    createdAt,
  };
}

function readAppliedSubscriptionItem(
  value: unknown,
  expectedSubscriptionId: string | undefined,
  code: string,
): NonNullable<SubscriptionPlanChangeApplyResult["item"]> {
  const item = object(value, code);
  const subscriptionId = uuidV7(item.subscriptionId, code);
  assertIdentity(subscriptionId, expectedSubscriptionId, code);
  return {
    id: uuidV7(item.id, code),
    subscriptionId,
    moduleId: uuidV7(item.moduleId, code),
    tierId: uuidV7(item.tierId, code),
    seats: positiveInteger(item.seats, code),
    lineTotal: money(item.lineTotal, code),
  };
}

function readCurrentInvoice(value: unknown): AdminCurrentCollectionInvoiceView {
  const code = "INVALID_BILLING_SUMMARY_RESPONSE";
  const root = object(value, code);
  const canonicalUsd = boolean(root.canonicalUsd, code);
  const currency = currencyCode(root.currencyCode, code);
  const totalUsd = nullableMoney(root.totalUsd, code);
  const amountPaidUsd = nullableMoney(root.amountPaidUsd, code);
  const outstandingUsd = nullableMoney(root.outstandingUsd, code);
  const legacy =
    root.legacyOriginalAmounts === null
      ? null
      : object(root.legacyOriginalAmounts, code);

  let legacyOriginalAmounts: AdminCurrentCollectionInvoiceView["legacyOriginalAmounts"];
  if (canonicalUsd) {
    if (
      currency !== "USD" ||
      totalUsd === null ||
      amountPaidUsd === null ||
      outstandingUsd === null ||
      legacy !== null
    ) {
      fail(code);
    }
    const total = moneyMinor(totalUsd, code);
    const paid = moneyMinor(amountPaidUsd, code);
    if (paid > total || moneyMinor(outstandingUsd, code) !== total - paid) fail(code);
    legacyOriginalAmounts = null;
  } else {
    if (
      totalUsd !== null ||
      amountPaidUsd !== null ||
      outstandingUsd !== null ||
      legacy === null
    ) {
      fail(code);
    }
    legacyOriginalAmounts = {
      currencyCode: currencyCode(legacy.currencyCode, code),
      subtotal: money(legacy.subtotal, code),
      taxTotal: money(legacy.taxTotal, code),
      total: money(legacy.total, code),
    };
    if (legacyOriginalAmounts.currencyCode !== currency) fail(code);
  }

  const periodStart = nullableIsoTimestamp(root.periodStart, code);
  const periodEnd = nullableIsoTimestamp(root.periodEnd, code);
  if (
    periodStart !== null &&
    periodEnd !== null &&
    timestampMs(periodEnd) <= timestampMs(periodStart)
  ) {
    fail(code);
  }

  return {
    id: uuidV7(root.id, code),
    number: boundedString(root.number, 64, code),
    purpose: oneOf(root.purpose, INVOICE_PURPOSES, code),
    status: oneOf(root.status, INVOICE_STATUSES, code),
    currencyCode: currency,
    canonicalUsd,
    totalUsd,
    amountPaidUsd,
    outstandingUsd,
    legacyOriginalAmounts,
    periodStart,
    periodEnd,
    issuedAt: nullableIsoTimestamp(root.issuedAt, code),
    dueAt: nullableIsoTimestamp(root.dueAt, code),
    paidAt: nullableIsoTimestamp(root.paidAt, code),
  };
}

function coreEnvelope(payload: unknown, code: string): Record<string, unknown> {
  const envelope = object(payload, code);
  if (envelope.success !== true) fail(code);
  uuidV7(envelope.correlationId, code);
  isoTimestamp(envelope.timestamp, code);
  if (!("data" in envelope)) fail(code);
  return envelope;
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function boundedArray(value: unknown, maximum: number, code: string): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail(code);
  return value;
}

function boundedString(value: unknown, maximum: number, code: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length > maximum
  ) {
    fail(code);
  }
  return value;
}

function nullableBoundedString(
  value: unknown,
  maximum: number,
  code: string,
): string | null {
  if (value === null) return null;
  return boundedString(value, maximum, code);
}

function matchingString(value: unknown, pattern: RegExp, code: string): string {
  const result = boundedString(value, 256, code);
  if (!pattern.test(result)) fail(code);
  return result;
}

function exactString<T extends string>(value: unknown, expected: T, code: string): T {
  if (value !== expected) fail(code);
  return expected;
}

function oneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
  code: string,
): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) fail(code);
  return value as T;
}

function nullableOneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
  code: string,
): T | null {
  if (value === null) return null;
  return oneOf(value, values, code);
}

function uuidV7(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_V7_PATTERN.test(value)) fail(code);
  return value;
}

function nullableUuidV7(value: unknown, code: string): string | null {
  if (value === null) return null;
  return uuidV7(value, code);
}

function isoTimestamp(value: unknown, code: string): string {
  if (typeof value !== "string") fail(code);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail(code);
  return value;
}

function nullableIsoTimestamp(value: unknown, code: string): string | null {
  if (value === null) return null;
  return isoTimestamp(value, code);
}

function timestampMs(value: string): number {
  return new Date(value).getTime();
}

function positiveInteger(value: unknown, code: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    fail(code);
  }
  return value;
}

function nonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function nullablePositiveInteger(value: unknown, code: string): number | null {
  if (value === null) return null;
  return positiveInteger(value, code);
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") fail(code);
  return value;
}

function currencyCode(value: unknown, code: string): string {
  return matchingString(value, CURRENCY_PATTERN, code);
}

function nullableCurrencyCode(value: unknown, code: string): string | null {
  if (value === null) return null;
  return currencyCode(value, code);
}

function money(value: unknown, code: string): string {
  return matchingString(value, MONEY_PATTERN, code);
}

function nullableMoney(value: unknown, code: string): string | null {
  if (value === null) return null;
  return money(value, code);
}

function positiveMoney(value: unknown, code: string): string {
  const result = money(value, code);
  if (moneyMinor(result, code) <= ZERO) fail(code);
  return result;
}

function signedMoney(value: unknown, code: string): string {
  return matchingString(value, SIGNED_MONEY_PATTERN, code);
}

function moneyMinor(value: string, code: string): bigint {
  return decimalUnits(value, 4, false, code);
}

function signedMoneyMinor(value: string, code: string): bigint {
  return decimalUnits(value, 4, true, code);
}

function fxRate(value: unknown, code: string): string {
  const result = matchingString(value, FX_RATE_PATTERN, code);
  if (fxUnits(result, code) <= ZERO) fail(code);
  return result;
}

function nullableFxRate(value: unknown, code: string): string | null {
  if (value === null) return null;
  return fxRate(value, code);
}

function fxUnits(value: string, code: string): bigint {
  return decimalUnits(value, 12, false, code);
}

function sourceToUsdMinor(sourceAmount: string, rate: string, code: string): bigint {
  return roundHalfUp(
    moneyMinor(sourceAmount, code) * ONE_FX_UNIT,
    fxUnits(rate, code),
  );
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
}

function decimalUnits(
  value: string,
  scale: number,
  signed: boolean,
  code: string,
): bigint {
  const negative = value.startsWith("-");
  if (negative && !signed) fail(code);
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  try {
    const units =
      BigInt(whole) * BigInt(10) ** BigInt(scale) +
      BigInt(fraction.padEnd(scale, "0"));
    return negative ? -units : units;
  } catch {
    fail(code);
  }
}

function assertIdentity(actual: string, expected: string | undefined, code: string): void {
  if (expected !== undefined && actual !== expected) fail(code);
}

function assertUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) fail(code);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function optionalBoundedStringProperty<K extends string>(
  source: Record<string, unknown>,
  key: K,
  maximum: number,
  code: string,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : { [key]: boundedString(source[key], maximum, code) } as Record<K, string>;
}

function optionalMatchingStringProperty<K extends string>(
  source: Record<string, unknown>,
  key: K,
  pattern: RegExp,
  code: string,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : { [key]: matchingString(source[key], pattern, code) } as Record<K, string>;
}

function optionalNullableCurrencyProperty<K extends string>(
  source: Record<string, unknown>,
  key: K,
  code: string,
): Partial<Record<K, string | null>> {
  return source[key] === undefined
    ? {}
    : { [key]: nullableCurrencyCode(source[key], code) } as Record<K, string | null>;
}

function optionalIsoTimestampProperty<K extends string>(
  source: Record<string, unknown>,
  key: K,
  code: string,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : { [key]: isoTimestamp(source[key], code) } as Record<K, string>;
}

function fail(code: string): never {
  throw new TenantBillingContractError(code);
}
