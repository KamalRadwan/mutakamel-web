import { date, object, oneOf, page, record, text, uuid, uuid7 } from "@/shared/api/commercial-contract";
import { adaptSubscriptionCommercial, readSubscriptionCommercial } from "../tenant-workspace/billing/model/subscription-commercial";
import type { SubscriptionListItem, SubscriptionPage, TenantStatus } from "./types";

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const tenantStatuses = ["PROVISIONING", "PROVISIONING_FAILED", "ACTIVE", "SUSPENDED", "DELETED"] as const satisfies readonly TenantStatus[];
const tenantReader = object({ id: uuid, name: text(160, /\S/u), companyName: text(160, /\S/u), status: oneOf(tenantStatuses) });

export class SubscriptionContractError extends Error {
  readonly isNormalized = true as const;
  readonly httpStatus = 503;
  readonly errorCode = "COMMERCIAL_RESPONSE_UNAVAILABLE";
  readonly errorCategory = "SERVER_ERROR" as const;
  constructor(readonly correlationId?: string) { super("INVALID_SUBSCRIPTIONS_RESPONSE"); this.name = "SubscriptionContractError"; }
}
export function isUuidV7(value: string): boolean { return UUID_V7_PATTERN.test(value); }

function readDirectoryItem(value: unknown): SubscriptionListItem {
  const { tenant: rawTenant, ...payload } = record(value);
  const commercial = readSubscriptionCommercial(payload);
  const tenant = tenantReader(rawTenant);
  if (tenant.id !== commercial.subscription.tenantId) throw new SubscriptionContractError();
  return { ...adaptSubscriptionCommercial(commercial), commercial, tenant };
}

/** Every directory row retains child charges; base-only capacity remains separate. */
export function readSubscriptionsPage(payload: unknown): SubscriptionPage {
  let correlationId: string | undefined;
  try {
    const raw = record(payload);
    if (typeof raw.correlationId === "string" && raw.correlationId.length <= 128) correlationId = raw.correlationId;
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 4 * 1024 * 1024) throw new SubscriptionContractError();
    const envelope = object({ success: oneOf([true]), data: (value: unknown) => value,
      meta: (value: unknown) => value, correlationId: uuid7, timestamp: date })(payload);
    const result = page(readDirectoryItem)({ items: envelope.data, meta: envelope.meta });
    const ids = result.items.map(item => item.subscription.id);
    const tenantIds = result.items.map(item => item.subscription.tenantId);
    if (new Set(ids).size !== ids.length || new Set(tenantIds).size !== tenantIds.length) throw new SubscriptionContractError();
    return { items: result.items, ...result.meta, correlationId: envelope.correlationId, timestamp: envelope.timestamp };
  } catch { throw new SubscriptionContractError(correlationId); }
}
