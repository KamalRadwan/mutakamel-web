import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionItem,
  type SubscriptionListItem,
  type SubscriptionPage,
  type TenantStatus,
} from "./types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,4})?$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const ENABLED_MODULE_PATTERN = /^module\.[a-z][a-z0-9_]{0,63}$/u;
const MODULE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const TENANT_STATUSES = [
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
] as const satisfies readonly TenantStatus[];

export class SubscriptionContractError extends Error {
  constructor() {
    super("INVALID_SUBSCRIPTIONS_RESPONSE");
    this.name = "SubscriptionContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

export function readSubscriptionsPage(payload: unknown): SubscriptionPage {
  const envelope = object(payload);
  if (envelope.success !== true) fail();

  const correlationId = uuidV7(envelope.correlationId);
  const timestamp = isoTimestamp(envelope.timestamp);
  const rawItems = array(envelope.data, 100);
  const meta = object(envelope.meta);
  const page = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit, 100);
  const total = nonNegativeInteger(meta.total);
  const totalPages = nonNegativeInteger(meta.totalPages);
  const hasNext = boolean(meta.hasNext);
  const hasPrev = boolean(meta.hasPrev);

  if (
    rawItems.length > limit ||
    total < rawItems.length ||
    totalPages !== Math.ceil(total / limit) ||
    hasNext !== page < totalPages ||
    hasPrev !== page > 1
  ) {
    fail();
  }

  const items = rawItems.map(readSubscriptionListItem);
  unique(items.map((item) => item.subscription.id));
  unique(
    items.flatMap((item) =>
      item.subscription.tenantId ? [item.subscription.tenantId] : [],
    ),
  );

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    correlationId,
    timestamp,
  };
}

function readSubscriptionListItem(value: unknown): SubscriptionListItem {
  const root = object(value);
  const header = object(root.subscription);
  const id = uuidV7(header.id);
  const tenantId = nullableUuidV7(header.tenantId);
  const currentPeriodStart = nullableIsoTimestamp(header.currentPeriodStart);
  const currentPeriodEnd = isoTimestamp(header.currentPeriodEnd);
  const pendingPeriodStart = nullableIsoTimestamp(header.pendingPeriodStart);
  const pendingPeriodEnd = nullableIsoTimestamp(header.pendingPeriodEnd);
  const createdAt = isoTimestamp(header.createdAt);
  const updatedAt = isoTimestamp(header.updatedAt);

  if (
    (currentPeriodStart &&
      timestampMs(currentPeriodEnd) <= timestampMs(currentPeriodStart)) ||
    (pendingPeriodStart === null) !== (pendingPeriodEnd === null) ||
    (pendingPeriodStart &&
      pendingPeriodEnd &&
      timestampMs(pendingPeriodEnd) <= timestampMs(pendingPeriodStart)) ||
    timestampMs(updatedAt) < timestampMs(createdAt)
  ) {
    fail();
  }

  const items = array(root.items, 100).map((item) =>
    readSubscriptionItem(item, id),
  );
  unique(items.map((item) => item.id));
  unique(items.map((item) => item.moduleId));
  const effectiveAllowedUsers = nonNegativeInteger(root.effectiveAllowedUsers);
  if (
    items.length > 0 &&
    effectiveAllowedUsers !== items.reduce((sum, item) => sum + item.seats, 0)
  ) {
    fail();
  }

  const enabledModules = array(root.enabledModules, 100).map((module) =>
    matchingString(module, ENABLED_MODULE_PATTERN, 71),
  );
  unique(enabledModules);
  const derivedModules = items.flatMap((item) =>
    item.moduleKey ? [`module.${item.moduleKey}`] : [],
  );
  if (items.length > 0 && !sameSet(enabledModules, derivedModules)) {
    fail();
  }

  const totalPrice = nullableMoney(header.totalPrice);
  if (
    items.length > 0 &&
    totalPrice !== null &&
    decimalUnits(totalPrice) !==
      items.reduce((sum, item) => sum + decimalUnits(item.lineTotal), BigInt(0))
  ) {
    fail();
  }

  const tenant = root.tenant === null ? null : readTenant(root.tenant);
  if (tenant !== null && tenant.id !== tenantId) {
    fail();
  }

  return {
    subscription: {
      id,
      tenantId,
      allowedUsers: nonNegativeInteger(header.allowedUsers),
      status: oneOf(header.status, SUBSCRIPTION_STATUSES),
      billingCycle: nullableString(header.billingCycle, 16),
      currencyCode: nullableMatchingString(
        header.currencyCode,
        CURRENCY_PATTERN,
        3,
      ),
      startedAt: isoTimestamp(header.startedAt),
      currentPeriodStart,
      currentPeriodEnd,
      pendingPeriodStart,
      pendingPeriodEnd,
      trialDays: positiveInteger(header.trialDays, 365),
      trialStartedAt: nullableIsoTimestamp(header.trialStartedAt),
      trialEndsAt: nullableIsoTimestamp(header.trialEndsAt),
      activationScheduledAt: nullableIsoTimestamp(header.activationScheduledAt),
      activatedAt: nullableIsoTimestamp(header.activatedAt),
      cancelAt: nullableIsoTimestamp(header.cancelAt),
      totalPrice,
      createdAt,
      updatedAt,
    },
    effectiveAllowedUsers,
    enabledModules,
    items,
    tenant,
  };
}

function readSubscriptionItem(
  value: unknown,
  expectedSubscriptionId: string,
): SubscriptionItem {
  const item = object(value);
  const subscriptionId = uuidV7(item.subscriptionId);
  if (subscriptionId !== expectedSubscriptionId) fail();
  const features =
    item.features === null
      ? null
      : array(item.features, 500).map((feature) => boundedString(feature, 96));
  if (features) unique(features);

  return {
    id: uuidV7(item.id),
    subscriptionId,
    moduleId: uuidV7(item.moduleId),
    tierId: uuidV7(item.tierId),
    seats: positiveInteger(item.seats),
    lineTotal: money(item.lineTotal),
    features,
    ...optionalMatchingString(item, "moduleKey", MODULE_KEY_PATTERN, 64),
    ...optionalString(item, "moduleName", 128),
    ...optionalString(item, "tierKey", 64),
    ...optionalString(item, "tierName", 128),
    ...optionalNullableCurrency(item, "currencyCode"),
    ...optionalTimestamp(item, "createdAt"),
    ...optionalTimestamp(item, "updatedAt"),
  };
}

function readTenant(value: unknown) {
  const tenant = object(value);
  return {
    id: uuidV7(tenant.id),
    name: boundedString(tenant.name, 160),
    companyName: boundedString(tenant.companyName, 160),
    status: oneOf(tenant.status, TENANT_STATUSES),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail();
  return value as Record<string, unknown>;
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function boundedString(value: unknown, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length > maximum
  ) {
    fail();
  }
  return value;
}

function matchingString(
  value: unknown,
  pattern: RegExp,
  maximum: number,
): string {
  const result = boundedString(value, maximum);
  if (!pattern.test(result)) fail();
  return result;
}

function nullableString(value: unknown, maximum: number): string | null {
  return value === null ? null : boundedString(value, maximum);
}

function nullableMatchingString(
  value: unknown,
  pattern: RegExp,
  maximum: number,
): string | null {
  return value === null ? null : matchingString(value, pattern, maximum);
}

function uuidV7(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) fail();
  return value;
}

function nullableUuidV7(value: unknown): string | null {
  return value === null ? null : uuidV7(value);
}

function isoTimestamp(value: unknown): string {
  if (typeof value !== "string") fail();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value)
    fail();
  return value;
}

function nullableIsoTimestamp(value: unknown): string | null {
  return value === null ? null : isoTimestamp(value);
}

function timestampMs(value: string): number {
  return new Date(value).getTime();
}

function positiveInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    fail();
  }
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail();
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function oneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail();
  return value as T;
}

function money(value: unknown): string {
  return matchingString(value, MONEY_PATTERN, 23);
}

function nullableMoney(value: unknown): string | null {
  return value === null ? null : money(value);
}

function decimalUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(10_000) + BigInt(fraction.padEnd(4, "0"));
}

function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}

function optionalString<K extends string>(
  source: Record<string, unknown>,
  key: K,
  maximum: number,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : ({ [key]: boundedString(source[key], maximum) } as Record<K, string>);
}

function optionalMatchingString<K extends string>(
  source: Record<string, unknown>,
  key: K,
  pattern: RegExp,
  maximum: number,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : ({ [key]: matchingString(source[key], pattern, maximum) } as Record<
        K,
        string
      >);
}

function optionalNullableCurrency<K extends string>(
  source: Record<string, unknown>,
  key: K,
): Partial<Record<K, string | null>> {
  return source[key] === undefined
    ? {}
    : ({
        [key]: nullableMatchingString(source[key], CURRENCY_PATTERN, 3),
      } as Record<K, string | null>);
}

function optionalTimestamp<K extends string>(
  source: Record<string, unknown>,
  key: K,
): Partial<Record<K, string>> {
  return source[key] === undefined
    ? {}
    : ({ [key]: isoTimestamp(source[key]) } as Record<K, string>);
}

function fail(): never {
  throw new SubscriptionContractError();
}
