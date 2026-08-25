import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock },
}));

import { reportsApi, serializeQuery } from "./reports-api";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const CORRELATION_ID = "019f0000-0000-7000-8000-000000000001";

function response(data: unknown) {
  return {
    data: {
      success: true,
      data,
      correlationId: CORRELATION_ID,
      timestamp: TIMESTAMP,
    },
  };
}

describe("reportsApi", () => {
  beforeEach(() => getMock.mockReset());

  it("serializes only supplied query values", () => {
    expect(
      serializeQuery({
        page: 2,
        limit: 20,
        status: "ACTIVE",
        serverId: "",
        omitted: undefined,
      }),
    ).toBe("?page=2&limit=20&status=ACTIVE");
  });

  it("calls the overview route with a UTC report window", async () => {
    getMock.mockResolvedValue(
      response({
        asOf: TIMESTAMP,
        tenantsByStatus: {},
        subscriptions: { count: 0, totalAllowedUsers: 0 },
        outstandingInvoices: { count: 0, total: "0" },
      }),
    );
    const signal = new AbortController().signal;

    await reportsApi.overview(
      {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-12T23:59:59.999Z",
      },
      signal,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/reports/overview?from=2026-08-01T00%3A00%3A00.000Z&to=2026-08-12T23%3A59%3A59.999Z",
      { cache: "no-store", signal },
    );
  });

  it("calls the tenant route with only service-supported filters", async () => {
    getMock.mockResolvedValue(
      response({
        items: [],
        total: 0,
        page: 3,
        limit: 25,
      }),
    );

    await reportsApi.tenants({
      page: 3,
      limit: 25,
      status: "SUSPENDED",
      serverId: "019f0000-0000-7000-8000-000000000002",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/reports/tenants?page=3&limit=25&status=SUSPENDED&serverId=019f0000-0000-7000-8000-000000000002",
      { cache: "no-store" },
    );
  });

  it("calls the remaining three exact Core Admin report routes", async () => {
    getMock
      .mockResolvedValueOnce(response({ asOf: TIMESTAMP, items: [] }))
      .mockResolvedValueOnce(response({ asOf: TIMESTAMP, buckets: [] }))
      .mockResolvedValueOnce(
        response({ asOf: TIMESTAMP, stuck: 0, items: [] }),
      );

    await reportsApi.servers();
    await reportsApi.billing({ from: "2026-08-01T00:00:00.000Z" });
    await reportsApi.provisioning({
      to: "2026-08-12T23:59:59.999Z",
      limit: 50,
    });

    expect(getMock.mock.calls).toEqual([
      ["/api/admin/core/v1/reports/servers", { cache: "no-store" }],
      [
        "/api/admin/core/v1/reports/billing?from=2026-08-01T00%3A00%3A00.000Z",
        { cache: "no-store" },
      ],
      [
        "/api/admin/core/v1/reports/provisioning?to=2026-08-12T23%3A59%3A59.999Z&limit=50",
        { cache: "no-store" },
      ],
    ]);
  });
});
