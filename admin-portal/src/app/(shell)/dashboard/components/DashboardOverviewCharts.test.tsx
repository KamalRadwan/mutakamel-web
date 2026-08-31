// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

import { DashboardOverviewCharts } from "./DashboardOverviewCharts";

let intersectionObservers: ControlledIntersectionObserver[] = [];

class ControlledIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  private readonly callback: IntersectionObserverCallback;
  private target: Element | null = null;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? "0px";
    intersectionObservers.push(this);
  }

  observe(target: Element) {
    this.target = target;
  }

  unobserve() {
    this.target = null;
  }

  disconnect() {
    this.target = null;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(isIntersecting: boolean) {
    if (!this.target) throw new Error("Observer target is not connected");
    const bounds = this.target.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: bounds,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: bounds,
          isIntersecting,
          rootBounds: null,
          target: this.target,
          time: 0,
        },
      ],
      this,
    );
  }
}

beforeEach(() => {
  intersectionObservers = [];
  vi.stubGlobal("IntersectionObserver", ControlledIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
      tenantBillingGrowth: { year: 2026, currencyCode: "USD", granularity: "day", points: undefined },
      recentTenants: { items: undefined },
    },
  };
  return {
    ...base,
    ...overrides,
    overview: {
      ...base.overview,
      ...((overrides.overview ?? {}) as Record<string, unknown>),
    },
  } as unknown as DashboardResponse;
}

/** The overview reads tenant status from the group, not from `overview`. */
function tenantsGroup(byStatus: Record<string, number>, lifecycleTotal: number) {
  return {
    key: "tenants",
    permission: "admin.reports.tenants",
    available: true,
    asOf: "2026-08-26T00:00:00.000Z",
    snapshot: { lifecycleTotal },
    period: {},
    breakdowns: { byStatus },
    alerts: [],
    cards: [],
    visuals: [],
  };
}

describe("DashboardOverviewCharts", () => {
  it("does not report forced lazy chart groups ready from mount alone", async () => {
    const onOperationalChartsReady = vi.fn();
    const onBillingChartsReady = vi.fn();
    const frameQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    render(
      <DashboardOverviewCharts
        data={buildData()}
        forceRenderLazyCharts
        onOperationalChartsReady={onOperationalChartsReady}
        onBillingChartsReady={onBillingChartsReady}
      />,
    );

    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(screen.getAllByText(en.dashboard.billingTab.subscriptionLifecycleTitle)).not.toHaveLength(0);
    runQueuedFrames(frameQueue);
    expect(onOperationalChartsReady).not.toHaveBeenCalled();
    expect(onBillingChartsReady).not.toHaveBeenCalled();
    expect(intersectionObservers).toHaveLength(0);
  });

  it("renders without crashing when overview/panels array fields are undefined", async () => {
    expect(() => render(<DashboardOverviewCharts data={buildData()} />)).not.toThrow();

    expect(
      screen.getByRole("status", { name: en.dashboard.overviewTab.growthTitle }),
    ).toHaveTextContent("No data is available for this chart.");
    await revealLazyChartGroups();
    expect(
      screen.getByRole("status", { name: en.dashboard.tenantsTab.statusBreakdownTitle }),
    ).toHaveTextContent("No data is available for this chart.");
  });

  it("renders the regional distribution chart from tenants.breakdowns.byCountry when available", async () => {
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

    await revealLazyChartGroups();

    expect(
      screen.getByRole("figure", {
        name: en.dashboard.tenantsTab.regionalDistributionTitle,
      }),
    ).toBeInTheDocument();
  });

  it("provides a localized summary and a keyboard-reachable exact-values table", async () => {
    const data = buildData({
      tenants: tenantsGroup({ ACTIVE: 8, PROVISIONING: 2 }, 10),
      overview: {
        tenantBillingGrowth: {
          year: 2026,
          currencyCode: "USD",
          granularity: "month",
          points: [
            { month: "Jan", tenants: 10, collected: 1250 },
            { month: "Feb", tenants: 12, collected: 2400 },
          ],
        },
      },
    });

    render(<DashboardOverviewCharts data={data} />);

    await revealLazyChartGroups();

    const figure = screen.getByRole("figure", {
      name: en.dashboard.overviewTab.growthTitle,
    });
    expect(within(figure).getByText(/Final point:/)).toHaveTextContent("12");

    const disclosure = within(figure).getByText("Exact values");
    const details = disclosure.closest("details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(disclosure);

    expect(details).toHaveAttribute("open");
    const table = within(figure).getByRole("table", {
      name: en.dashboard.overviewTab.growthTitle,
    });
    expect(within(table).getByText("$2,400")).toBeInTheDocument();
    expect(within(table).getByText("Feb")).toBeInTheDocument();

    const statusFigure = screen.getByRole("figure", {
      name: en.dashboard.tenantsTab.statusBreakdownTitle,
    });
    fireEvent.click(within(statusFigure).getByText("Exact values"));
    const statusTable = within(statusFigure).getByRole("table", {
      name: en.dashboard.tenantsTab.statusBreakdownTitle,
    });
    expect(
      within(statusTable).getByText(en.dashboard.tenantsTab.totalTenantsLabel),
    ).toBeInTheDocument();
    expect(within(statusTable).getByText("10")).toBeInTheDocument();
  });

  it("keeps complete exact values printable while lazy chart groups are not ready", () => {
    const data = buildData({
      tenants: tenantsGroup({ ACTIVE: 8, PROVISIONING: 2 }, 10),
      overview: {
        tenantBillingGrowth: {
          year: 2026,
          currencyCode: "USD",
          granularity: "month",
          points: [{ month: "Jan", tenants: 10, collected: 1250 }],
        },
      },
    });

    const { container, rerender } = render(
      <DashboardOverviewCharts data={data} printChartsReady={false} />,
    );
    const fallback = container.querySelector<HTMLElement>(
      "[data-dashboard-print-fallback]",
    );
    expect(fallback).not.toBeNull();
    expect(fallback).toHaveClass("print:block");
    expect(within(fallback!).getByText("Active")).toBeInTheDocument();
    expect(within(fallback!).getByText(/\$1,250/)).toBeInTheDocument();
    expect(
      within(fallback!).getByText(en.dashboard.tenantsTab.totalTenantsLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Operational dashboard charts" }),
    ).toHaveClass("print:hidden");

    rerender(<DashboardOverviewCharts data={data} printChartsReady />);
    expect(fallback).not.toHaveClass("print:block");
    expect(
      screen.getByRole("region", { name: "Operational dashboard charts" }),
    ).not.toHaveClass("print:hidden");
  });

  it("does not crash when the tenants group is unavailable", async () => {
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

    await revealLazyChartGroups();
    expect(
      screen.getByRole("status", { name: en.dashboard.tenantsTab.statusBreakdownTitle }),
    ).toBeInTheDocument();
  });
});

async function revealLazyChartGroups(): Promise<void> {
  const operationalRegion = screen.getByRole("region", {
    name: "Operational dashboard charts",
  });
  const billingRegion = screen.getByRole("region", {
    name: "Billing dashboard charts",
  });

  expect(operationalRegion).toHaveAttribute("aria-busy", "true");
  expect(billingRegion).toHaveAttribute("aria-busy", "true");
  expect(within(operationalRegion).getByRole("status")).toHaveTextContent(
    "Loading operational dashboard charts…",
  );
  expect(within(billingRegion).getByRole("status")).toHaveTextContent(
    "Loading billing dashboard charts…",
  );
  expect(intersectionObservers).toHaveLength(2);

  act(() => {
    intersectionObservers.forEach((observer) => observer.emit(true));
  });
  await act(async () => {
    await vi.dynamicImportSettled();
  });

  expect(operationalRegion).not.toHaveAttribute("aria-busy");
  expect(billingRegion).not.toHaveAttribute("aria-busy");
}

function runQueuedFrames(queue: FrameRequestCallback[]): void {
  let safety = 0;
  while (queue.length > 0) {
    const callback = queue.shift();
    act(() => callback?.(performance.now()));
    safety += 1;
    if (safety > 20) throw new Error("Unexpected requestAnimationFrame loop");
  }
}
