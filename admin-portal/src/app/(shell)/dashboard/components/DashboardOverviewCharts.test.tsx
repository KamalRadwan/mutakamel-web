// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

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

  it("renders the regional distribution chart from tenants.breakdowns.byCountry when available", () => {
    const data = buildData({
      tenants: {
        key: "tenants",
        permission: "admin.reports.tenants",
        available: true,
        asOf: "2026-08-26T00:00:00.000Z",
        snapshot: {},
        period: {},
        breakdowns: {
          byCountry: [
            { key: "eg", countryName: "Egypt", countryIsoCode: "EG", count: 12, ratio: 0.6, tone: "green" },
            { key: "sa", countryName: "Saudi Arabia", countryIsoCode: "SA", count: 8, ratio: 0.4, tone: "blue" },
          ],
        },
        alerts: [],
        cards: [],
      },
    });

    render(<DashboardOverviewCharts data={data} />);

    // recharts renders its labels into an SVG sized by real layout
    // measurements jsdom doesn't provide, so country names inside the chart
    // aren't queryable here — assert on the section label that only renders
    // when domainRegions.length > 0 instead, which is the actual branch
    // this test exercises.
    expect(screen.getByText(en.dashboard.tenantsTab.regionalDistributionTitle)).toBeInTheDocument();
  });

  it("does not crash when the tenants group is unavailable", () => {
    const data = buildData({
      tenants: {
        key: "tenants",
        permission: "admin.reports.tenants",
        available: false,
        asOf: "2026-08-26T00:00:00.000Z",
        reasonCode: "SOURCE_NOT_CONFIGURED",
        message: "",
        alerts: [],
        cards: [],
      },
    });

    expect(() => render(<DashboardOverviewCharts data={data} />)).not.toThrow();
  });
});
