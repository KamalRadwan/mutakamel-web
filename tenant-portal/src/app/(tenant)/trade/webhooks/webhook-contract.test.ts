import { describe, expect, it } from "vitest";
import {
  RETRYABLE_RETRY_CLASSES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_MANAGE_PERMISSION,
  WEBHOOK_REPLAY_PERMISSION,
  WEBHOOK_SCOPE_TARGETS,
  WEBHOOK_SETTABLE_STATUSES,
  WEBHOOK_SUBSCRIPTIONS_PATH,
  WEBHOOK_SUBSCRIPTION_STATUSES,
  buildCreateWebhookSubscriptionRequest,
  buildRetryDeliveryRequest,
  buildRotateSecretRequest,
  buildUpdateWebhookStatusRequest,
  parseWebhookDeliveryDetail,
  parseWebhookEvents,
  parseWebhookSubscriptionDetail,
  parseWebhookSubscriptionsResponse,
  webhookDeliveryRetryPath,
  webhookSubscriptionActionPath,
  webhookSubscriptionsListPath,
} from "./webhook-contract";

const subscriptionId = "01902001-3000-7000-8000-000000000001";
const deliveryId = "01902001-3000-7000-8000-000000000002";

const catalogue = [
  { eventType: "trade.sales_order.confirmed", eventVersion: 1, fields: ["id", "total"] },
];

describe("Trade webhooks contract", () => {
  it("puts ten routes behind one grant and only retry behind another", () => {
    expect(WEBHOOK_MANAGE_PERMISSION).toBe("trade.webhooks.manage");
    expect(WEBHOOK_REPLAY_PERMISSION).toBe("trade.webhooks.replay");
  });

  it("builds canonical paths", () => {
    expect(webhookSubscriptionsListPath(1, "ACTIVE")).toBe(
      `${WEBHOOK_SUBSCRIPTIONS_PATH}?page=1&limit=50&status=ACTIVE`,
    );
    expect(webhookSubscriptionActionPath(subscriptionId, "rotate-secret")).toBe(
      `${WEBHOOK_SUBSCRIPTIONS_PATH}/${subscriptionId}/rotate-secret`,
    );
    expect(webhookDeliveryRetryPath(deliveryId)).toBe(
      `/api/tenant/trade/v1/webhooks/deliveries/${deliveryId}/retry`,
    );
  });

  it("cannot return a subscription to DRAFT", () => {
    expect(WEBHOOK_SUBSCRIPTION_STATUSES).toContain("DRAFT");
    expect(WEBHOOK_SETTABLE_STATUSES).not.toContain("DRAFT");
    expect(buildUpdateWebhookStatusRequest("DISABLED")).toEqual({ status: "DISABLED" });
  });

  it("cannot scope a subscription to a branch", () => {
    expect(WEBHOOK_SCOPE_TARGETS).toEqual(["TENANT", "COMPANY"]);
  });

  it("renders EXHAUSTED and DISABLED as distinct terminal states", () => {
    expect(WEBHOOK_DELIVERY_STATUSES).toContain("EXHAUSTED");
    expect(WEBHOOK_DELIVERY_STATUSES).toContain("DISABLED");
    expect(WEBHOOK_DELIVERY_STATUSES).toHaveLength(6);
  });

  it("carries the catalogue's field list on each subscribed event", () => {
    // WebhookEventDto needs eventType, eventVersion and fields — the field
    // list is the catalogue's, never invented.
    const request = buildCreateWebhookSubscriptionRequest(
      {
        code: "ORDERS",
        scopeTarget: "COMPANY",
        endpointUri: "https://example.test/hook",
        retryPolicyCode: "EXPONENTIAL_STANDARD",
        maxAttempts: "5",
        eventTypes: ["trade.sales_order.confirmed"],
      },
      catalogue,
    );
    expect(request.events).toEqual([
      { eventType: "trade.sales_order.confirmed", eventVersion: 1, fields: ["id", "total"] },
    ]);
    expect(request.maxAttempts).toBe(5);
  });

  it("refuses an event the catalogue does not describe", () => {
    expect(() =>
      buildCreateWebhookSubscriptionRequest(
        {
          code: "ORDERS",
          scopeTarget: "COMPANY",
          endpointUri: "https://example.test/hook",
          retryPolicyCode: "EXPONENTIAL_STANDARD",
          maxAttempts: "5",
          eventTypes: ["trade.unknown.event"],
        },
        catalogue,
      ),
    ).toThrow("WEBHOOK_FORM_EVENTS");
  });

  it("bounds maxAttempts and overlapHours the way the DTOs do", () => {
    expect(buildRotateSecretRequest("24")).toEqual({ overlapHours: 24 });
    expect(() => buildRotateSecretRequest("169")).toThrow("WEBHOOK_FORM_OVERLAP");
    expect(() =>
      buildCreateWebhookSubscriptionRequest(
        {
          code: "ORDERS",
          scopeTarget: "COMPANY",
          endpointUri: "https://example.test/hook",
          retryPolicyCode: "EXPONENTIAL_STANDARD",
          maxAttempts: "11",
          eventTypes: ["trade.sales_order.confirmed"],
        },
        catalogue,
      ),
    ).toThrow("WEBHOOK_FORM_ATTEMPTS");
  });

  it("requires a code-shaped reason on a retry", () => {
    expect(buildRetryDeliveryRequest("manual_replay")).toEqual({
      reasonCode: "MANUAL_REPLAY",
    });
    expect(() => buildRetryDeliveryRequest("please retry")).toThrow("WEBHOOK_FORM_REASON");
  });

  it("offers a retry only for the two retry classes known to be retryable", () => {
    // Three of the four literals written in trade-app are absent from the
    // RetryClass enum, and one path copies the value from a worker payload.
    expect(RETRYABLE_RETRY_CLASSES).toEqual(["TRANSIENT", "AFTER_REFRESH"]);
    expect(RETRYABLE_RETRY_CLASSES).not.toContain("NO_RETRY");
    expect(RETRYABLE_RETRY_CLASSES).not.toContain("PERMANENT_SOURCE_CORRECTION");
  });

  it("reads a subscription list row, whose endpoint arrives in two halves", () => {
    const page = parseWebhookSubscriptionsResponse({
      items: [
        {
          id: subscriptionId,
          code: "ORDERS",
          status: "ACTIVE",
          version: 2,
          scopeTarget: "COMPANY",
          endpoint: { origin: "https://example.test", pathname: "/hook" },
          activeVersionNumber: 1,
          secret: { status: "ACTIVE" },
          updatedAt: "2026-08-31T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
    expect(page.items[0].endpoint).toEqual({
      origin: "https://example.test",
      pathname: "/hook",
    });
    expect(page.items[0].secretStatus).toBe("ACTIVE");
  });

  it("reads a subscription detail, whose fields live under currentVersion", () => {
    const detail = parseWebhookSubscriptionDetail({
      id: subscriptionId,
      code: "ORDERS",
      status: "ACTIVE",
      version: 4,
      currentVersion: {
        id: subscriptionId,
        versionNumber: 2,
        scopeTarget: "TENANT",
        endpoint: { origin: "https://example.test", pathname: "/hook" },
        retryPolicyCode: "EXPONENTIAL_CONSERVATIVE",
        maxAttempts: 3,
        status: "ACTIVE",
        branches: [],
        events: [{ eventType: "trade.sales_order.confirmed" }],
      },
      secret: { status: "ACTIVE" },
      secretOperation: { type: "ROTATE", status: "PENDING", safeErrorCode: null },
    });
    expect(detail.maxAttempts).toBe(3);
    expect(detail.eventTypes).toEqual(["trade.sales_order.confirmed"]);
    // The secret value itself is never in any response.
    expect(detail).not.toHaveProperty("secretValue");
    expect(detail.secretOperation?.type).toBe("ROTATE");
  });

  it("keeps an attempt's retryClass as a raw string", () => {
    const delivery = parseWebhookDeliveryDetail({
      id: deliveryId,
      subscriptionId,
      subscriptionCode: "ORDERS",
      status: "RETRY_PENDING",
      sourceEventType: "trade.sales_order.confirmed",
      attemptCount: 2,
      nextAttemptAt: "2026-08-31T00:05:00.000Z",
      terminalAt: null,
      version: 1,
      createdAt: "2026-08-31T00:00:00.000Z",
      endpoint: { origin: "https://example.test", pathname: "/hook" },
      attempts: [
        {
          attemptNumber: 1,
          startedAt: "2026-08-31T00:00:00.000Z",
          completedAt: "2026-08-31T00:00:01.000Z",
          outcome: "FAILED",
          // Written by trade-app and absent from the RetryClass enum.
          retryClass: "TRANSIENT",
          httpStatus: 503,
          safeErrorCode: "UPSTREAM_UNAVAILABLE",
        },
      ],
    });
    expect(delivery.attempts[0].retryClass).toBe("TRANSIENT");
    expect(delivery.attempts[0].httpStatus).toBe(503);
  });

  it("reads the event catalogue as an { items } list with no total", () => {
    expect(parseWebhookEvents({ items: catalogue })).toEqual(catalogue);
  });
});
