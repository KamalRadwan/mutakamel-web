import { type CorePath } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { isUUIDv7 } from "@/lib/uuid";
import { corePost } from "../core-api";
import {
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  record,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import {
  currencyCode,
  invalidBillingResponse,
  requiredDecimal,
  wireEnum,
} from "../billing/billing-validation";
import { safeCount, SUBSCRIPTION_SEATS_MAX } from "./subscription-contract";

// The two-step plan change: a durable, owner-bound, price-frozen preview, then
// the one-time apply that consumes it.
//
// Both are `@IdempotencyRequired()`. `apply` revalidates subscription,
// collection, price and wallet before committing, so a stale preview fails at
// apply time — which is why the preview's expiry is shown as a countdown rather
// than discovered by pressing a button that no longer works.

const PLAN_CHANGE_PREVIEWS_PATH =
  "/api/tenant/core/v1/subscription/plan-change-previews" as const;

function applyPlanChangePath(previewId: string): CorePath {
  if (!isUUIDv7(previewId)) invalidBillingResponse();
  return `${PLAN_CHANGE_PREVIEWS_PATH}/${encodeURIComponent(previewId)}/apply`;
}

export interface PlanChangePreview {
  previewId: string;
  operation: string;
  currencyCode: string;
  billingCycle: string;
  pricedAt: string;
  /** Five minutes from `pricedAt`; `apply` revalidates and refuses a stale one. */
  expiresAt: string;
  itemId: string | null;
  fromSeats: number | null;
  toSeats: number | null;
  previousLineTotalUsd: string;
  nextLineTotalUsd: string;
  fullPeriodDeltaUsd: string;
  /** CREDIT, DEBIT or NONE — the direction of the prorated wallet movement. */
  direction: string;
  proratedAmountUsd: string;
  walletAvailableUsd: string;
  walletShortfallUsd: string;
  walletStatus: string;
  canApply: boolean;
}

function nullableSeats(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  return safeCount(source, key, SUBSCRIPTION_SEATS_MAX);
}

function parsePlanChangePreview(payload: unknown): PlanChangePreview {
  const preview = record(payload);
  if (!preview) invalidBillingResponse();
  const item = record(preview.item);
  const financial = record(preview.financial);
  if (!item || !financial) invalidBillingResponse();
  return {
    previewId: requiredUuidV7(preview, "previewId"),
    operation: wireEnum(preview, "operation"),
    currencyCode: currencyCode(preview, "currencyCode"),
    billingCycle: wireEnum(preview, "billingCycle"),
    pricedAt: requiredTimestamp(preview, "pricedAt"),
    expiresAt: requiredTimestamp(preview, "expiresAt"),
    itemId:
      item.itemId === undefined || item.itemId === null ? null : requiredUuidV7(item, "itemId"),
    fromSeats: nullableSeats(item, "fromSeats"),
    toSeats: nullableSeats(item, "toSeats"),
    previousLineTotalUsd: requiredDecimal(item, "previousLineTotalUsd"),
    nextLineTotalUsd: requiredDecimal(item, "nextLineTotalUsd"),
    fullPeriodDeltaUsd: requiredDecimal(financial, "fullPeriodDeltaUsd"),
    direction: wireEnum(financial, "direction"),
    proratedAmountUsd: requiredDecimal(financial, "proratedAmountUsd"),
    walletAvailableUsd: requiredDecimal(financial, "walletAvailableUsd"),
    walletShortfallUsd: requiredDecimal(financial, "walletShortfallUsd"),
    walletStatus: wireEnum(financial, "walletStatus"),
    canApply: financial.canApply === true,
  };
}

export interface PlanChangeApplied {
  previewId: string;
  operation: string;
  appliedAt: string;
  direction: string;
  amountUsd: string;
  subscriptionTotalUsd: string;
  /** True when the Gateway replayed the stored result — the change applied once. */
  replayed: boolean;
}

function parsePlanChangeApplied(payload: unknown, replayed: boolean): PlanChangeApplied {
  const result = record(payload);
  if (!result) invalidBillingResponse();
  const wallet = record(result.wallet);
  if (!wallet) invalidBillingResponse();
  return {
    previewId: requiredUuidV7(result, "previewId"),
    operation: wireEnum(result, "operation"),
    appliedAt: requiredTimestamp(result, "appliedAt"),
    direction: wireEnum(wallet, "direction"),
    amountUsd: requiredDecimal(wallet, "amountUsd"),
    subscriptionTotalUsd: requiredDecimal(result, "subscriptionTotalUsd"),
    replayed,
  };
}

/**
 * Creates the durable, price-frozen preview for a **seat increase** on one
 * existing item.
 *
 * `operation: "CHANGE"` with `itemId` and `seats` is the only plan change this
 * portal can express: `ADD` additionally requires a module and a tier, and no
 * tenant-facing catalogue route exists to enumerate either — see
 * docs/build/OPEN-QUESTIONS.md. `REMOVE` is refused outright for a tenant actor.
 */
export async function createSeatIncreasePreview(
  itemId: string,
  seats: number,
  idempotencyKey: string,
): Promise<PlanChangePreview> {
  const result = await corePost(
    PLAN_CHANGE_PREVIEWS_PATH,
    { operation: "CHANGE", itemId, seats },
    {
      headers: { "x-idempotency-key": idempotencyKey },
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    },
  );
  return parsePlanChangePreview(result.data);
}

export async function applyPlanChangePreview(
  previewId: string,
  idempotencyKey: string,
): Promise<PlanChangeApplied> {
  const result = await corePost(applyPlanChangePath(previewId), undefined, {
    headers: { "x-idempotency-key": idempotencyKey },
    maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
  });
  return parsePlanChangeApplied(result.data, isIdempotentReplay(result.headers));
}

/** The rejections `SubscriptionItemsService` raises for a tenant plan change. */
const PLAN_CHANGE_ERROR_CODES = [
  "DOWNGRADE_NOT_ALLOWED",
  "SUBSCRIPTION_PLAN_CHANGE_NOOP",
  "SUBSCRIPTION_PLAN_CHANGE_PAST_DUE",
  "SUBSCRIPTION_PLAN_CHANGE_CANCELLED",
  "SUBSCRIPTION_PLAN_CHANGE_PROVISIONING",
  "SUBSCRIPTION_PLAN_CHANGE_COLLECTION_IN_PROGRESS",
  "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED",
  "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED",
  "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE",
  "SUBSCRIPTION_PLAN_CHANGE_PRICING_CHANGED",
  "SUBSCRIPTION_PLAN_CHANGE_REQUEST_INVALID",
  "SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED",
  "WALLET_INSUFFICIENT",
  "WALLET_NOT_ACTIVE",
  "WEBPHONE_SEATS_IN_USE",
  "SUBSCRIPTION_ITEM_NOT_FOUND",
] as const;

export function planChangeErrorKey(code: string | undefined): string | undefined {
  return code && (PLAN_CHANGE_ERROR_CODES as readonly string[]).includes(code) ? code : undefined;
}
