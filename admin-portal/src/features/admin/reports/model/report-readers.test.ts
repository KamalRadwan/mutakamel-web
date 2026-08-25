import { describe, expect, it } from "vitest";
import {
  readBillingReport,
  readOverviewReport,
  readProvisioningReport,
  readServersReport,
  readTenantReport,
} from "./report-readers";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const CORRELATION_ID = "019f0000-0000-7000-8000-000000000001";

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    correlationId: CORRELATION_ID,
    timestamp: TIMESTAMP,
  };
}

const TENANT_ROW = {
  id: "019f0000-0000-7000-8000-000000000002",
  name: "Cairo Operations",
  status: "ACTIVE",
  allowedUsers: 25,
  subscriptionStatus: "ACTIVE",
  createdAt: "2026-08-01T10:00:00.000Z",
};

describe("admin report wire readers", () => {
  it("reads overview fields without coercing exact decimal totals", () => {
    const result = readOverviewReport(
      envelope({
        asOf: TIMESTAMP,
        tenantsByStatus: { ACTIVE: 4, PROVISIONING: 1 },
        subscriptions: { count: 3, totalAllowedUsers: 75 },
        outstandingInvoices: { count: 2, total: "120.0000" },
        ignoredFutureField: "not exposed",
      }),
    );

    expect(result).toEqual({
      data: {
        asOf: TIMESTAMP,
        tenantsByStatus: { ACTIVE: 4, PROVISIONING: 1 },
        subscriptions: { count: 3, totalAllowedUsers: 75 },
        outstandingInvoices: { count: 2, total: "120.0000" },
      },
      correlationId: CORRELATION_ID,
      responseTimestamp: TIMESTAMP,
    });
  });

  it("derives pagination flags from Core's current nested tenant page", () => {
    const result = readTenantReport(
      envelope({
        items: [TENANT_ROW],
        total: 41,
        page: 2,
        limit: 20,
      }),
    );

    expect(result.data).toMatchObject({
      items: [TENANT_ROW],
      total: 41,
      page: 2,
      limit: 20,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("accepts the canonical top-level tenant pagination envelope", () => {
    const result = readTenantReport(
      envelope([TENANT_ROW], {
        total: 20,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    expect(result.data).toMatchObject({
      items: [TENANT_ROW],
      total: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it("reads every server capacity field", () => {
    const result = readServersReport(
      envelope({
        asOf: TIMESTAMP,
        items: [
          {
            id: "019f0000-0000-7000-8000-000000000003",
            name: "Postgres Cairo 1",
            databaseEngine: "PostgreSQL",
            countryName: "Egypt",
            countryIsoCode: "EG",
            region: "EG",
            status: "ONLINE",
            currentTenants: 7,
            maxTenants: 10,
            utilization: 0.7,
          },
        ],
      }),
    );

    expect(result.data.items[0]).toEqual(
      expect.objectContaining({
        databaseEngine: "PostgreSQL",
        countryName: "Egypt",
        currentTenants: 7,
        maxTenants: 10,
        utilization: 0.7,
      }),
    );
  });

  it("reads billing buckets and provisioning health", () => {
    const billing = readBillingReport(
      envelope({
        asOf: TIMESTAMP,
        buckets: [{ status: "OVERDUE", total: "89.7500", count: 3 }],
      }),
    );
    const provisioning = readProvisioningReport(
      envelope({
        asOf: TIMESTAMP,
        stuck: 2,
        items: [
          {
            id: "019f0000-0000-7000-8000-000000000004",
            name: "Pending tenant",
            status: "PROVISIONING",
            createdAt: "2026-08-10T11:00:00.000Z",
          },
        ],
      }),
    );

    expect(billing.data.buckets).toEqual([
      { status: "OVERDUE", total: "89.7500", count: 3 },
    ]);
    expect(provisioning.data).toMatchObject({ stuck: 2 });
  });

  it.each([
    ["missing success", { data: {} }],
    ["missing correlation", { success: true, data: {}, timestamp: TIMESTAMP }],
    [
      "invalid decimal total",
      envelope({
        asOf: TIMESTAMP,
        tenantsByStatus: {},
        subscriptions: { count: 0, totalAllowedUsers: 0 },
        outstandingInvoices: { count: 0, total: "NaN" },
      }),
    ],
  ])("fails closed for malformed %s payloads", (_label, payload) => {
    expect(() => readOverviewReport(payload)).toThrow(
      "INVALID_ADMIN_REPORT_RESPONSE",
    );
  });
});
