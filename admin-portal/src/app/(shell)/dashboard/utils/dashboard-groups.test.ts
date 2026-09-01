import { describe, expect, it } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { formatDashboardMetric } from "./formatters";
import {
  getDashboardFieldLabel,
  getAuthorizedDashboardGroupKeys,
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

  it("sends the chosen instants, not date-only strings", () => {
    // A bare YYYY-MM-DD is midnight UTC, which shifts the window for anyone
    // off UTC and discards the time of day the picker now offers.
    expect(
      buildDashboardQuery({
        from: new Date("2026-09-01T09:00:00.000Z"),
        to: new Date("2026-09-01T17:30:00.000Z"),
      }),
    ).toEqual({
      from: "2026-09-01T09:00:00.000Z",
      to: "2026-09-01T17:30:00.000Z",
    });
  });

  it("humanizes nested backend keys for report facts", () => {
    expect(humanizeDashboardField("highestTenantConcentration")).toBe(
      "Highest Tenant Concentration",
    );
  });

  it("formats dashboard counts with Arabic digits and separators", () => {
    expect(
      formatDashboardMetric({ kind: "integer", value: 1234 }, "USD", "ar"),
    ).toBe("١٬٢٣٤");
    expect(
      formatDashboardMetric({ kind: "integer", value: "5678" }, "USD", "ar"),
    ).toBe("٥٬٦٧٨");
  });

  it("uses authoritative Arabic labels and preserves unknown wire keys bidi-safely", () => {
    expect(getDashboardFieldLabel("totalTenants", "ar")).toEqual({
      label: "إجمالي المستأجرين",
    });
    expect(getDashboardFieldLabel("highestTenantConcentration", "ar")).toEqual({
      label: "highestTenantConcentration",
      dir: "ltr",
    });
  });

  /**
   * Every report used to count "failures" its own way, so the same word meant
   * a different thing on each tab. These labels are what make one vocabulary
   * visible to an Arabic reader; without them the domains fall through to raw
   * LTR enum names in the middle of an RTL table.
   */
  it("labels the failure taxonomy in Arabic on every report", () => {
    expect(getDashboardFieldLabel("unhandledApplicationErrors", "ar")).toEqual({
      label: "أخطاء تطبيق غير مُعالَجة",
    });
    expect(getDashboardFieldLabel("byFaultDomain", "ar")).toEqual({
      label: "حسب نطاق العطل",
    });
    expect(getDashboardFieldLabel("APPLICATION", "ar")).toEqual({
      label: "عطل في المنصة",
    });
    // A refused request is the platform working, and the label has to say so
    // rather than leaving a reader to assume every row here is a problem.
    expect(getDashboardFieldLabel("CLIENT", "ar")).toEqual({
      label: "رفض صحيح",
    });
    expect(getDashboardFieldLabel("UNCLASSIFIED", "ar")).toEqual({
      label: "بانتظار التصنيف",
    });
  });

  it("humanizes the same taxonomy fields in English", () => {
    expect(getDashboardFieldLabel("unresolvedFailures", "en")).toEqual({
      label: "Unresolved Failures",
    });
    expect(getDashboardFieldLabel("byFaultDomain", "en")).toEqual({
      label: "By Fault Domain",
    });
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

describe("tab list under a scoped response", () => {
  /**
   * A `?groups=` response carries only the groups it loaded. Deriving the
   * tabs from the present group objects hid every unloaded tab, which also
   * removed the only way to load it — the tab bar reads `authorizedGroups`.
   */
  const scoped = {
    authorizedGroups: ["tenants", "billing", "storage", "audit"],
    loadedGroups: ["storage"],
    storage: availableGroup("storage", "admin.reports.storage"),
  } as unknown as DashboardResponse;

  it("offers every authorized group, not just the loaded one", () => {
    expect(getAuthorizedDashboardGroupKeys(scoped)).toEqual([
      "tenants",
      "billing",
      "storage",
      "audit",
    ]);
  });

  it("still reports only the groups whose data actually arrived", () => {
    expect(getAuthorizedDashboardGroups(scoped).map(([key]) => key)).toEqual([
      "storage",
    ]);
  });

  it("never offers a tab the actor is not authorized for", () => {
    const forged = {
      authorizedGroups: ["tenants"],
      loadedGroups: ["tenants", "audit"],
      tenants: availableGroup("tenants", "admin.reports.tenants"),
      audit: availableGroup("audit", "admin.reports.audit"),
    } as unknown as DashboardResponse;

    expect(getAuthorizedDashboardGroupKeys(forged)).toEqual(["tenants"]);
  });
});
