// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";

vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", dir: "ltr", t: en }) };
});

import { DashboardOverviewCharts } from "./DashboardOverviewCharts";

// Minimal DashboardResponse["overview"]/["panels"] shape. Every array field
// below is intentionally omitted or null in at least one spot, mirroring a
// real production crash: the declared types in src/types/dashboard.ts mark
// these arrays as always-present, but a live response returned
// overview.domainHealth.regions as `undefined`, which crashed the page with
// "can't access property 'length', overview.domainHealth.regions is
// undefined". This test locks in that every array read in this component is
// defensive against the backend not matching its own declared contract.
function buildData(overrides: Record<string, unknown> = {}): DashboardResponse {
  const base = {
    asOf: "2026-08-26T00:00:00.000Z",
    authorizedGroups: [],
    range: { from: "2026-08-01", to: "2026-08-26", label: "August 2026", granularity: "day" },
    sections: [],
    panels: {
      tenantStatus: { title: "", subtitle: "", items: undefined },
      databaseCapacity: { title: "", subtitle: "", items: undefined },
    },
    overview: {
      kpis: undefined,
      tenantLifecycle: { total: 0, current: 0, deleted: 0, items: undefined, stats: [] },
      databaseHealth: { capacity: { current: 0, maximum: 0, utilization: 0 }, stats: [] },
      subscriptionStatus: { total: 0, items: undefined, stats: [] },
      billingSummary: { totalAmount: 0, collectedRatio: 0, items: undefined },
      domainHealth: {
        totalDomains: 0,
        verifiedDomains: 0,
        fullyVerified: 0,
        invalidDomains: 0,
        countries: 0,
        regions: undefined,
        actionRequired: false,
        message: "",
      },
      tenantBillingGrowth: { year: 2026, currencyCode: "USD", granularity: "day", points: undefined },
      recentTenants: { items: undefined },
    },
  };
  return { ...base, ...overrides } as unknown as DashboardResponse;
}

describe("DashboardOverviewCharts", () => {
  it("renders without crashing when overview/panels array fields are undefined", () => {
    expect(() => render(<DashboardOverviewCharts data={buildData()} />)).not.toThrow();
  });

  it("renders without crashing when analytics dataset arrays are undefined despite available: true", () => {
    const data = buildData({
      analytics: {
        subscriptions: {
          arrTarget: { available: true, data: { currencyCode: "USD", actual: 0, target: 0 } },
          averageCollectedRevenue: { available: true, data: { currencyCode: "USD", points: undefined } },
          paymentHealth: { available: true, data: undefined },
          churnAndAcquisition: { available: true, data: { points: undefined } },
          upcomingRenewals: { available: true, data: { windowDays: 90, points: undefined } },
          revenueFlow: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          lifetimeValue: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          promotionImpact: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          cohortRetention: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
        },
        billing: {
          aging: { available: true, data: { currencyCode: "USD", items: undefined } },
          daysSalesOutstanding: { available: true, data: { unit: "days", points: undefined } },
          cashFlow: { available: true, data: { currencyCode: "USD", points: undefined } },
          revenueByPurpose: { available: true, data: { currencyCode: "USD", items: undefined } },
          paymentProviders: { available: true, data: undefined },
          paymentFailureReasons: { available: true, data: undefined },
          refunds: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          taxByCountry: { available: true, data: { currencyCode: "USD", items: undefined } },
          renewalForecast: { available: true, data: { currencyCode: "USD", windowDays: 90, points: undefined } },
          usageOverage: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          costBreakdown: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          discountImpact: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          chargebacks: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
        },
        servers: {
          nodes: { available: true, data: [] },
          regions: { available: true, data: [] },
          latency: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
          capacityHistory: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
        },
        platformHealth: { available: false, reasonCode: "SOURCE_NOT_CONFIGURED", message: "" },
      },
    });

    expect(() => render(<DashboardOverviewCharts data={data} />)).not.toThrow();
  });
});
