import { readCoreData } from "@/lib/api/envelope";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  record,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import {
  currencyCode,
  invalidBillingResponse,
  nullableDecimal,
  nullableTimestamp,
  nullableWireEnum,
  requiredDecimal,
  wireEnum,
} from "../billing/billing-validation";

// `SubscriptionSelfServeController` — owner-only, no permission strings, and
// **add-or-increase only**. `SubscriptionItemsService.preparePlanChange` throws
// `DOWNGRADE_NOT_ALLOWED` for a TENANT actor on REMOVE, on a seat count below
// the current one, and on a tier of lower rank. A UI that offered any of those
// would be building a rejection.

const SUBSCRIPTION_PATH = "/api/tenant/core/v1/subscription" as const;
const SUBSCRIPTION_ITEMS_PATH = "/api/tenant/core/v1/subscription/items" as const;
/** `@Max(100000)` on `CreateSubscriptionPlanChangePreviewDto.seats`. */
export const SUBSCRIPTION_SEATS_MAX = 100_000;
const MAX_SUBSCRIPTION_ITEMS = 100;

interface SubscriptionHeader {
  id: string;
  allowedUsers: number;
  status: string;
  billingCycle: string | null;
  currencyCode: string | null;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string;
  pendingPeriodStart: string | null;
  pendingPeriodEnd: string | null;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activationScheduledAt: string | null;
  activatedAt: string | null;
  cancelAt: string | null;
  totalPriceUsd: string | null;
}

export interface SubscriptionItem {
  id: string;
  moduleId: string;
  tierId: string;
  seats: number;
  lineTotalUsd: string;
  moduleKey: string | null;
  moduleName: string | null;
  tierKey: string | null;
  tierName: string | null;
  /** Null means catalogue enrichment was unavailable, not an empty grant set. */
  features: string[] | null;
}

export interface TenantSubscription {
  header: SubscriptionHeader;
  effectiveAllowedUsers: number;
  enabledModules: string[];
  items: SubscriptionItem[];
}

export function safeCount(
  source: Record<string, unknown>,
  key: string,
  maximum: number,
): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    invalidBillingResponse();
  }
  return value as number;
}

function optionalText(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 128) invalidBillingResponse();
  return value;
}

function parseSubscriptionItem(value: unknown): SubscriptionItem {
  const item = record(value);
  if (!item) invalidBillingResponse();
  const features = item.features;
  if (features !== undefined && features !== null && !Array.isArray(features)) {
    invalidBillingResponse();
  }
  return {
    id: requiredUuidV7(item, "id"),
    moduleId: requiredUuidV7(item, "moduleId"),
    tierId: requiredUuidV7(item, "tierId"),
    seats: safeCount(item, "seats", SUBSCRIPTION_SEATS_MAX),
    lineTotalUsd: requiredDecimal(item, "lineTotal"),
    moduleKey: optionalText(item, "moduleKey"),
    moduleName: optionalText(item, "moduleName"),
    tierKey: optionalText(item, "tierKey"),
    tierName: optionalText(item, "tierName"),
    features: Array.isArray(features)
      ? features.map((feature) =>
          typeof feature === "string" && feature.length <= 128 ? feature : invalidBillingResponse(),
        )
      : null,
  };
}

function parseTenantSubscription(payload: unknown): TenantSubscription {
  const view = record(payload);
  if (!view) invalidBillingResponse();
  const header = record(view.subscription);
  if (!header || !Array.isArray(view.items) || !Array.isArray(view.enabledModules)) {
    invalidBillingResponse();
  }
  if (view.items.length > MAX_SUBSCRIPTION_ITEMS) invalidBillingResponse();
  return {
    header: {
      id: requiredUuidV7(header, "id"),
      allowedUsers: safeCount(header, "allowedUsers", SUBSCRIPTION_SEATS_MAX),
      status: wireEnum(header, "status"),
      billingCycle: nullableWireEnum(header, "billingCycle"),
      currencyCode:
        header.currencyCode === undefined || header.currencyCode === null
          ? null
          : currencyCode(header, "currencyCode"),
      startedAt: requiredTimestamp(header, "startedAt"),
      currentPeriodStart: nullableTimestamp(header, "currentPeriodStart"),
      currentPeriodEnd: requiredTimestamp(header, "currentPeriodEnd"),
      pendingPeriodStart: nullableTimestamp(header, "pendingPeriodStart"),
      pendingPeriodEnd: nullableTimestamp(header, "pendingPeriodEnd"),
      trialDays: safeCount(header, "trialDays", 3650),
      trialStartedAt: nullableTimestamp(header, "trialStartedAt"),
      trialEndsAt: nullableTimestamp(header, "trialEndsAt"),
      activationScheduledAt: nullableTimestamp(header, "activationScheduledAt"),
      activatedAt: nullableTimestamp(header, "activatedAt"),
      cancelAt: nullableTimestamp(header, "cancelAt"),
      totalPriceUsd: nullableDecimal(header, "totalPrice"),
    },
    effectiveAllowedUsers: safeCount(view, "effectiveAllowedUsers", SUBSCRIPTION_SEATS_MAX),
    enabledModules: view.enabledModules.map((moduleKey) =>
      typeof moduleKey === "string" && moduleKey.length <= 64
        ? moduleKey
        : invalidBillingResponse(),
    ),
    items: view.items.map(parseSubscriptionItem),
  };
}

/** `GET /subscription/items` returns the raw item rows, without catalogue names. */
function parseSubscriptionItems(payload: unknown): SubscriptionItem[] {
  if (!Array.isArray(payload) || payload.length > MAX_SUBSCRIPTION_ITEMS) {
    invalidBillingResponse();
  }
  return payload.map(parseSubscriptionItem);
}

export async function fetchSubscription(signal?: AbortSignal): Promise<TenantSubscription> {
  return parseTenantSubscription(
    await readCoreData(SUBSCRIPTION_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function fetchSubscriptionItems(signal?: AbortSignal): Promise<SubscriptionItem[]> {
  return parseSubscriptionItems(
    await readCoreData(SUBSCRIPTION_ITEMS_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}
