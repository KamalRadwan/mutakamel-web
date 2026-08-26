import { describe, expect, it } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { formatDashboardMetric } from "./formatters";
import {
  getAuthorizedDashboardGroups,
  humanizeDashboardField,
  isUnavailableProjection,
} from "./dashboard-groups";
import { buildDashboardQuery } from "../hooks/useDashboardData";

describe("grouped admin dashboard contract", () => {
  it("returns only groups that are both authorized and present", () => {
    const response = {
      authorizedGroups: ["tenants", "storage", "security"],
      tenants: availableGroup("tenants", "admin.reports.tenants"),
      storage: unavailableGroup("storage", "admin.reports.storage"),
      audit: availableGroup("audit", "admin.reports.audit"),
    } as unknown as DashboardResponse;

    expect(getAuthorizedDashboardGroups(response).map(([key]) => key)).toEqual([
      "tenants",
      "storage",
    ]);
  });

  it("keeps an authorized unavailable group distinct from an omitted group", () => {
    const response = {
      authorizedGroups: ["usage"],
      usage: unavailableGroup("usage", "admin.reports.usage"),
    } as unknown as DashboardResponse;

    const groups = getAuthorizedDashboardGroups(response);
    expect(groups).toHaveLength(1);
    expect(groups[0][1]).toMatchObject({
      available: false,
      reasonCode: "SOURCE_NOT_CONFIGURED",
    });
    expect(response.security).toBeUndefined();
  });

  it("recognizes nested unavailable projections such as storage byte usage", () => {
    expect(
      isUnavailableProjection({
        available: false,
        reasonCode: "HISTORICAL_DATA_NOT_STORED",
        message: "No authoritative object-byte usage projection is active.",
      }),
    ).toBe(true);
  });

  it("formats money strings as locale-aware currency, rounded to 2 decimals", () => {
    expect(
      formatDashboardMetric({ kind: "money", value: "1000.2500" }),
    ).toBe("$1,000.25");
  });

  it("falls back to a raw currency-code prefix when the value cannot be parsed", () => {
    expect(
      formatDashboardMetric({ kind: "money", value: "not-a-number" }),
    ).toBe("USD not-a-number");
  });

  it("builds the previous UTC month without timestamp query values", () => {
    expect(
      buildDashboardQuery("lastMonth", {}, new Date("2026-08-02T12:00:00Z")),
    ).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("sends only supplied custom date boundaries", () => {
    expect(
      buildDashboardQuery(
        "custom",
        { from: "2026-08-01" },
        new Date("2026-08-02T12:00:00Z"),
      ),
    ).toEqual({ from: "2026-08-01" });
  });

  it("humanizes nested backend keys for report facts", () => {
    expect(humanizeDashboardField("highestTenantConcentration")).toBe(
      "Highest Tenant Concentration",
    );
  });
});

function availableGroup(key: string, permission: string) {
  return {
    key,
    permission,
    available: true,
    asOf: "2026-08-02T00:00:00.000Z",
    snapshot: {},
    period: {},
    breakdowns: {},
    alerts: [],
    cards: [],
  };
}

function unavailableGroup(key: string, permission: string) {
  return {
    key,
    permission,
    available: false,
    asOf: "2026-08-02T00:00:00.000Z",
    reasonCode: "SOURCE_NOT_CONFIGURED",
    message: "The authoritative source is not configured.",
    alerts: [],
    cards: [],
  };
}
