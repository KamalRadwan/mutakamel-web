import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  GOVERNED_CODE_PATTERN,
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeItemList,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Webhooks — 11 routes.
// docs/api/trade-advanced.md#webhooks--11-routes, verified against
// trade-app/src/modules/extensions-automation/{extensions-automation.controller.ts,
// webhook-subscriptions.service.ts,webhook-router.service.ts,
// dto/extensions-automation.dto.ts}.
//
// **Ten of the eleven routes share one grant, `trade.webhooks.manage` —
// including the delivery log.** There is no read-only webhook permission. Only
// `retry` is separate (`trade.webhooks.replay`).
//
// **The signing secret is never returned by any route.** `rotate-secret`
// answers 202 with nothing in it, and `projectSecret` sends only the
// reference's id, status, provider version and algorithm. If the caller needs
// the secret value, the API cannot supply it — so no screen offers to show it.

export const WEBHOOK_EVENTS_PATH = "/api/tenant/trade/v1/webhooks/events";
export const WEBHOOK_SUBSCRIPTIONS_PATH = "/api/tenant/trade/v1/webhooks/subscriptions";
const WEBHOOK_DELIVERIES_PATH = "/api/tenant/trade/v1/webhooks/deliveries";

export const WEBHOOK_MANAGE_PERMISSION = "trade.webhooks.manage";
export const WEBHOOK_REPLAY_PERMISSION = "trade.webhooks.replay";

export const WEBHOOK_PAGE_SIZE = 50;
const WEBHOOK_EVENTS_MIN = 1;
export const WEBHOOK_EVENTS_MAX = 30;
export const WEBHOOK_ENDPOINT_MAX_LENGTH = 2048;

/** `DRAFT` is the create-time state and cannot be returned to. */
export const WEBHOOK_SUBSCRIPTION_STATUSES = ["DRAFT", "ACTIVE", "DISABLED"] as const;
/** `UpdateWebhookSubscriptionDto` can only set these two. */
export const WEBHOOK_SETTABLE_STATUSES = ["ACTIVE", "DISABLED"] as const;

/**
 * `EXHAUSTED` (attempts spent) and `DISABLED` (subscription turned off) are
 * distinct terminal states and both render.
 */
export const WEBHOOK_DELIVERY_STATUSES = [
  "PENDING",
  "RETRY_PENDING",
  "DELIVERED",
  "FAILED",
  "EXHAUSTED",
  "DISABLED",
] as const;

export const WEBHOOK_RETRY_POLICIES = [
  "EXPONENTIAL_STANDARD",
  "EXPONENTIAL_CONSERVATIVE",
] as const;

/** `scopeTarget` on a subscription is TENANT or COMPANY — **never BRANCH**. */
export const WEBHOOK_SCOPE_TARGETS = ["TENANT", "COMPANY"] as const;

export type WebhookSubscriptionStatus = (typeof WEBHOOK_SUBSCRIPTION_STATUSES)[number];
export type WebhookSettableStatus = (typeof WEBHOOK_SETTABLE_STATUSES)[number];
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];
type WebhookRetryPolicy = (typeof WEBHOOK_RETRY_POLICIES)[number];
type WebhookScopeTarget = (typeof WEBHOOK_SCOPE_TARGETS)[number];

export interface WebhookEventDescriptor {
  eventType: string;
  eventVersion: number;
  fields: string[];
}

interface WebhookEndpoint {
  origin: string;
  pathname: string;
}

export interface WebhookSubscription {
  id: string;
  code: string;
  status: string;
  version: number;
  scopeTarget: string;
  endpoint: WebhookEndpoint;
  activeVersionNumber: number | null;
  secretStatus: string | null;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  subscriptionCode: string;
  status: string;
  sourceEventType: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  terminalAt: string | null;
  version: number;
  createdAt: string;
  endpoint: WebhookEndpoint;
}

interface WebhookDeliveryAttempt {
  attemptNumber: number;
  outcome: string;
  /**
   * An open value set. Four literals are written anywhere in trade-app and
   * three of them are absent from the `RetryClass` enum, and one path copies
   * the value straight from a worker payload — so this stays a string and
   * renders as itself.
   */
  retryClass: string | null;
  httpStatus: number | null;
  safeErrorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
  attempts: WebhookDeliveryAttempt[];
}

/**
 * The two `retryClass` values a retry is known to be sensible for.
 *
 * Built as an allow-list rather than from `RetryClass`, because the enum and
 * the writers barely overlap: `TRANSIENT`, `NO_RETRY` and
 * `PERMANENT_SOURCE_CORRECTION` are written and not in the enum, and an
 * unknown sixth value is possible. Anything outside this list — `null`
 * included — hides the control rather than offering a retry the server will
 * refuse.
 */
export const RETRYABLE_RETRY_CLASSES: readonly string[] = ["TRANSIENT", "AFTER_REFRESH"];

export function webhookSubscriptionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidWebhookResponse();
  return `${WEBHOOK_SUBSCRIPTIONS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function webhookSubscriptionActionPath(
  id: string,
  action: "rotate-secret" | "revoke-secret" | "test",
): TradePath {
  return `${webhookSubscriptionPath(id)}/${action}` as TradePath;
}

export function webhookDeliveryPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidWebhookResponse();
  return `${WEBHOOK_DELIVERIES_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function webhookDeliveryRetryPath(id: string): TradePath {
  return `${webhookDeliveryPath(id)}/retry` as TradePath;
}

export function webhookSubscriptionsListPath(
  page: number,
  status?: WebhookSubscriptionStatus,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(WEBHOOK_PAGE_SIZE) });
  if (status) query.set("status", status);
  return `${WEBHOOK_SUBSCRIPTIONS_PATH}?${query.toString()}` as TradePath;
}

export function webhookDeliveriesListPath(
  page: number,
  status?: WebhookDeliveryStatus,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(WEBHOOK_PAGE_SIZE) });
  if (status) query.set("status", status);
  return `${WEBHOOK_DELIVERIES_PATH}?${query.toString()}` as TradePath;
}

export interface WebhookSubscriptionFormValues {
  code: string;
  scopeTarget: WebhookScopeTarget;
  endpointUri: string;
  retryPolicyCode: WebhookRetryPolicy;
  maxAttempts: string;
  eventTypes: string[];
}

export const EMPTY_WEBHOOK_SUBSCRIPTION_FORM: WebhookSubscriptionFormValues = {
  code: "",
  scopeTarget: "COMPANY",
  endpointUri: "",
  retryPolicyCode: "EXPONENTIAL_STANDARD",
  maxAttempts: "5",
  eventTypes: [],
};

export function buildCreateWebhookSubscriptionRequest(
  values: WebhookSubscriptionFormValues,
  catalogue: readonly WebhookEventDescriptor[],
) {
  const code = values.code.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(code)) throw new Error("WEBHOOK_FORM_CODE");
  const endpointUri = values.endpointUri.trim();
  if (endpointUri.length === 0 || endpointUri.length > WEBHOOK_ENDPOINT_MAX_LENGTH) {
    throw new Error("WEBHOOK_FORM_ENDPOINT");
  }
  const maxAttempts = Number(values.maxAttempts.trim());
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new Error("WEBHOOK_FORM_ATTEMPTS");
  }
  if (
    values.eventTypes.length < WEBHOOK_EVENTS_MIN ||
    values.eventTypes.length > WEBHOOK_EVENTS_MAX
  ) {
    throw new Error("WEBHOOK_FORM_EVENTS");
  }
  // `WebhookEventDto` carries the field list as well as the type, and the
  // catalogue is the only source for it — an invented field list would be a
  // guess about the payload contract.
  const events = values.eventTypes.map((eventType) => {
    const descriptor = catalogue.find((entry) => entry.eventType === eventType);
    if (!descriptor) throw new Error("WEBHOOK_FORM_EVENTS");
    return {
      eventType: descriptor.eventType,
      eventVersion: descriptor.eventVersion,
      fields: descriptor.fields,
    };
  });
  return {
    code,
    scopeTarget: values.scopeTarget,
    endpointUri,
    retryPolicyCode: values.retryPolicyCode,
    maxAttempts,
    events,
  };
}

/** `RotateWebhookSecretDto.overlapHours` — int 0–168, default 24. */
export function buildRotateSecretRequest(raw: string) {
  const overlapHours = Number(raw.trim());
  if (!Number.isSafeInteger(overlapHours) || overlapHours < 0 || overlapHours > 168) {
    throw new Error("WEBHOOK_FORM_OVERLAP");
  }
  return { overlapHours };
}

/** `RetryWebhookDeliveryDto.reasonCode` is required and code-shaped. */
export function buildRetryDeliveryRequest(raw: string) {
  const reasonCode = raw.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(reasonCode)) throw new Error("WEBHOOK_FORM_REASON");
  return { reasonCode };
}

export function parseWebhookEvents(payload: unknown): WebhookEventDescriptor[] {
  return parseTradeItemList(
    payload,
    (entry) => {
      const row = record(entry);
      if (
        !row ||
        !isNonEmptyString(row.eventType, 160) ||
        !isBoundedInteger(row.eventVersion, 1, 10) ||
        !Array.isArray(row.fields)
      ) {
        invalidWebhookResponse();
      }
      return {
        eventType: row.eventType,
        eventVersion: row.eventVersion,
        fields: row.fields.filter((field): field is string => typeof field === "string"),
      };
    },
    invalidWebhookResponse,
  );
}

function parseEndpoint(payload: unknown): WebhookEndpoint {
  const row = record(payload);
  if (!row || typeof row.origin !== "string" || typeof row.pathname !== "string") {
    invalidWebhookResponse();
  }
  return { origin: row.origin, pathname: row.pathname };
}

export function parseWebhookSubscriptionsResponse(
  payload: unknown,
): TradeOffsetPage<WebhookSubscription> {
  return parseTradeOffsetPage(payload, parseWebhookSubscription, invalidWebhookResponse);
}

function parseWebhookSubscription(payload: unknown): WebhookSubscription {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 100) ||
    !isNonEmptyString(row.status, 24) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.scopeTarget, 16) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidWebhookResponse();
  }
  const secret = record(row.secret);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    version: row.version,
    scopeTarget: row.scopeTarget,
    endpoint: parseEndpoint(row.endpoint),
    activeVersionNumber: isBoundedInteger(row.activeVersionNumber, 0, Number.MAX_SAFE_INTEGER)
      ? row.activeVersionNumber
      : null,
    secretStatus: secret && typeof secret.status === "string" ? secret.status : null,
    updatedAt: row.updatedAt,
  };
}

export interface WebhookSubscriptionDetail {
  id: string;
  code: string;
  status: string;
  version: number;
  scopeTarget: string;
  endpoint: WebhookEndpoint;
  retryPolicyCode: string;
  maxAttempts: number;
  versionNumber: number;
  eventTypes: string[];
  secretStatus: string | null;
  /** The last rotate/revoke attempt, or null — never the secret itself. */
  secretOperation: { type: string; status: string; safeErrorCode: string | null } | null;
}

/**
 * `GET /webhooks/subscriptions/:id` is shaped differently from the list row:
 * the endpoint, retry policy, attempt cap and event list live under
 * `currentVersion`, not at the top level.
 */
export function parseWebhookSubscriptionDetail(payload: unknown): WebhookSubscriptionDetail {
  const row = record(payload);
  const current = row ? record(row.currentVersion) : null;
  if (
    !row ||
    !current ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 100) ||
    !isNonEmptyString(row.status, 24) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(current.scopeTarget, 16) ||
    !isNonEmptyString(current.retryPolicyCode, 40) ||
    !isBoundedInteger(current.maxAttempts, 1, 10) ||
    !isBoundedInteger(current.versionNumber, 1, Number.MAX_SAFE_INTEGER)
  ) {
    invalidWebhookResponse();
  }
  const secret = record(row.secret);
  const operation = record(row.secretOperation);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    version: row.version,
    scopeTarget: current.scopeTarget,
    endpoint: parseEndpoint(current.endpoint),
    retryPolicyCode: current.retryPolicyCode,
    maxAttempts: current.maxAttempts,
    versionNumber: current.versionNumber,
    eventTypes: Array.isArray(current.events)
      ? current.events.flatMap((entry) => {
          const event = record(entry);
          return event && typeof event.eventType === "string" ? [event.eventType] : [];
        })
      : [],
    secretStatus: secret && typeof secret.status === "string" ? secret.status : null,
    secretOperation:
      operation && typeof operation.type === "string" && typeof operation.status === "string"
        ? {
            type: operation.type,
            status: operation.status,
            safeErrorCode:
              typeof operation.safeErrorCode === "string" ? operation.safeErrorCode : null,
          }
        : null,
  };
}

/** `UpdateWebhookSubscriptionDto` — every field optional; status ACTIVE/DISABLED. */
export function buildUpdateWebhookStatusRequest(status: WebhookSettableStatus) {
  return { status };
}

export function parseWebhookDeliveriesResponse(
  payload: unknown,
): TradeOffsetPage<WebhookDelivery> {
  return parseTradeOffsetPage(payload, parseWebhookDelivery, invalidWebhookResponse);
}

function parseWebhookDelivery(payload: unknown): WebhookDelivery {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.subscriptionId) ||
    !isNonEmptyString(row.subscriptionCode, 100) ||
    !isNonEmptyString(row.status, 24) ||
    !isNonEmptyString(row.sourceEventType, 160) ||
    !isBoundedInteger(row.attemptCount, 0, 1000) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.createdAt)
  ) {
    invalidWebhookResponse();
  }
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    subscriptionCode: row.subscriptionCode,
    status: row.status,
    sourceEventType: row.sourceEventType,
    attemptCount: row.attemptCount,
    nextAttemptAt: isTimestamp(row.nextAttemptAt) ? row.nextAttemptAt : null,
    terminalAt: isTimestamp(row.terminalAt) ? row.terminalAt : null,
    version: row.version,
    createdAt: row.createdAt,
    endpoint: parseEndpoint(row.endpoint),
  };
}

export function parseWebhookDeliveryDetail(payload: unknown): WebhookDeliveryDetail {
  const row = record(payload);
  if (!row || !Array.isArray(row.attempts)) invalidWebhookResponse();
  return {
    ...parseWebhookDelivery(payload),
    attempts: row.attempts.map((entry) => {
      const attempt = record(entry);
      if (!attempt || !isBoundedInteger(attempt.attemptNumber, 0, 1000)) {
        invalidWebhookResponse();
      }
      return {
        attemptNumber: attempt.attemptNumber,
        outcome: typeof attempt.outcome === "string" ? attempt.outcome : "",
        retryClass: typeof attempt.retryClass === "string" ? attempt.retryClass : null,
        httpStatus: isBoundedInteger(attempt.httpStatus, 100, 599) ? attempt.httpStatus : null,
        safeErrorCode: typeof attempt.safeErrorCode === "string" ? attempt.safeErrorCode : null,
        startedAt: isTimestamp(attempt.startedAt) ? attempt.startedAt : null,
        completedAt: isTimestamp(attempt.completedAt) ? attempt.completedAt : null,
      };
    }),
  };
}

export function webhookMessage(error: NormalizedApiError, t: Dictionary): string | undefined {
  switch (error.code) {
    case "TRADE.WEBHOOK.ENDPOINT_FORBIDDEN":
      return t.tradeAutomation.errorEndpointForbidden;
    case "TRADE.WEBHOOK.PAYLOAD_FORBIDDEN":
      return t.tradeAutomation.errorPayloadForbidden;
    case "TRADE.WEBHOOK.SECRET_VERSION_INVALID":
      return t.tradeAutomation.errorSecretVersionInvalid;
    case "TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE":
      return t.tradeAutomation.errorDeliveryNotRetryable;
    case "TRADE.DEPENDENCY.TIMEOUT":
      return t.tradeAutomation.errorDependencyTimeout;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function webhookFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "WEBHOOK_FORM_CODE":
      return t.tradeAutomation.formCodeInvalid;
    case "WEBHOOK_FORM_ENDPOINT":
      return t.tradeAutomation.formEndpointInvalid;
    case "WEBHOOK_FORM_ATTEMPTS":
      return t.tradeAutomation.formAttemptsInvalid;
    case "WEBHOOK_FORM_EVENTS":
      return t.tradeAutomation.formEventsInvalid;
    case "WEBHOOK_FORM_OVERLAP":
      return t.tradeAutomation.formOverlapInvalid;
    case "WEBHOOK_FORM_REASON":
      return t.tradeAutomation.formReasonInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}

export function isWebhookSubscriptionStatus(value: unknown): value is WebhookSubscriptionStatus {
  return isMemberOf(value, WEBHOOK_SUBSCRIPTION_STATUSES);
}

export function isWebhookDeliveryStatus(value: unknown): value is WebhookDeliveryStatus {
  return isMemberOf(value, WEBHOOK_DELIVERY_STATUSES);
}

function invalidWebhookResponse(): never {
  throw new Error("Invalid Trade webhook response.");
}
