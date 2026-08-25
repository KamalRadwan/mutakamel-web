import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock },
}));

import {
  serializeSubscriptionQuery,
  subscriptionsApi,
  SUBSCRIPTIONS_URL,
} from "./api";
import { TENANT_ID, validSubscriptionsEnvelope } from "./test-fixtures";

describe("subscriptions API", () => {
  beforeEach(() => getMock.mockReset());

  it("uses the canonical Gateway path and exact supported Core query fields", async () => {
    getMock.mockResolvedValue({ data: validSubscriptionsEnvelope() });
    const controller = new AbortController();

    const result = await subscriptionsApi.list(
      {
        page: 2,
        limit: 50,
        sortBy: "currentPeriodEnd",
        sortDir: "ASC",
        status: "PAST_DUE",
        tenantId: TENANT_ID,
      },
      controller.signal,
    );

    expect(getMock).toHaveBeenCalledWith(
      `${SUBSCRIPTIONS_URL}?page=2&limit=50&sortBy=currentPeriodEnd&sortDir=ASC&status=PAST_DUE&tenantId=${TENANT_ID}`,
      { cache: "no-store", signal: controller.signal },
    );
    expect(result.correlationId).toBe("019f0000-0000-7000-8000-000000000006");
  });

  it("serializes the minimal bounded list query deterministically", () => {
    expect(
      serializeSubscriptionQuery({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortDir: "DESC",
      }),
    ).toBe("?page=1&limit=20&sortBy=createdAt&sortDir=DESC");
  });

  it.each([
    { page: 0, limit: 20, sortBy: "createdAt", sortDir: "DESC" },
    { page: 1, limit: 101, sortBy: "createdAt", sortDir: "DESC" },
    { page: 1, limit: 20, sortBy: "updatedAt", sortDir: "DESC" },
    { page: 1, limit: 20, sortBy: "createdAt", sortDir: "SIDEWAYS" },
    {
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortDir: "DESC",
      tenantId: "00000000-0000-4000-8000-000000000000",
    },
  ])("rejects an out-of-contract runtime query: %o", (query) => {
    expect(() =>
      serializeSubscriptionQuery(
        query as Parameters<typeof serializeSubscriptionQuery>[0],
      ),
    ).toThrow("INVALID_SUBSCRIPTIONS_QUERY");
  });

  it("fails closed when the upstream body is not the canonical envelope", async () => {
    getMock.mockResolvedValue({ data: { data: [], total: 0 } });

    await expect(
      subscriptionsApi.list({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortDir: "DESC",
      }),
    ).rejects.toThrow("INVALID_SUBSCRIPTIONS_RESPONSE");
  });
});
