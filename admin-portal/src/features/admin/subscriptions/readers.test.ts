import { describe, expect, it } from "vitest";
import {
  CORRELATION_ID,
  ITEM_ID,
  TENANT_ID,
  validSubscriptionsEnvelope,
} from "./test-fixtures";
import {
  isUuidV7,
  readSubscriptionsPage,
  SubscriptionContractError,
} from "./readers";

describe("subscriptions response reader", () => {
  it("reads the exact canonical Core envelope without coercing money", () => {
    const result = readSubscriptionsPage(validSubscriptionsEnvelope());

    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      correlationId: CORRELATION_ID,
      items: [
        {
          effectiveAllowedUsers: 10,
          enabledModules: ["module.crm"],
          subscription: { totalPrice: "120.0000", tenantId: TENANT_ID },
          items: [{ id: ITEM_ID, lineTotal: "120.0000" }],
          tenant: { id: TENANT_ID, status: "ACTIVE" },
        },
      ],
    });
  });

  it("accepts a missing soft-deleted tenant relation without inventing data", () => {
    const payload = validSubscriptionsEnvelope();
    payload.data[0].tenant = null as never;

    expect(readSubscriptionsPage(payload).items[0].tenant).toBeNull();
  });

  it.each([
    [
      "legacy nested pagination",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        Object.assign(payload, { data: { items: payload.data } });
      },
    ],
    [
      "non-v7 correlation",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.correlationId = "00000000-0000-4000-8000-000000000000";
      },
    ],
    [
      "inconsistent pagination",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.meta.hasNext = true;
      },
    ],
    [
      "cross-subscription item",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.data[0].items[0].subscriptionId = TENANT_ID;
      },
    ],
    [
      "seat total mismatch",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.data[0].effectiveAllowedUsers = 9;
      },
    ],
    [
      "module projection mismatch",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.data[0].enabledModules = ["module.billing"];
      },
    ],
    [
      "price total mismatch",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.data[0].subscription.totalPrice = "119.9999";
      },
    ],
    [
      "tenant relation mismatch",
      (payload: ReturnType<typeof validSubscriptionsEnvelope>) => {
        payload.data[0].tenant.id = ITEM_ID;
      },
    ],
  ])("fails closed on %s", (_label, mutate) => {
    const payload = validSubscriptionsEnvelope();
    mutate(payload);

    expect(() => readSubscriptionsPage(payload)).toThrow(
      SubscriptionContractError,
    );
  });

  it("recognizes UUIDv7 and rejects other UUID versions", () => {
    expect(isUuidV7(TENANT_ID)).toBe(true);
    expect(isUuidV7("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
