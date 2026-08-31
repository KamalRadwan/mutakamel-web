// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardGroup, DashboardVisual } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

import { DashboardGroupPanel } from "./DashboardGroupPanel";

// Recharts measures its container, which jsdom reports as 0×0; the SVG is
// aria-hidden anyway, so the assertions below read the accessible layer that
// ChartFigure renders around it.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 480, height: 240 }}>{children}</div>
    ),
  };
});

function storageGroup(overrides: Partial<DashboardGroup> = {}): DashboardGroup {
  return {
    key: "storage",
    permission: "admin.reports.storage",
    available: true,
    asOf: "2026-06-30T09:00:00.000Z",
    snapshot: {
      totalServers: 3,
      assignedTenants: 10,
      availableSlots: 140,
      highestTenantConcentration: 0.42,
    },
    period: {},
    breakdowns: {
      byStatus: { ACTIVE: 2, OFFLINE: 1 },
      byConnectionTest: { PASSED: 2, FAILED: 1 },
    },
    alerts: [
      {
        key: "storage-connection-test-failed",
        severity: "critical",
        count: 1,
        message: "Storage Servers have a failed connection test.",
      },
    ],
    cards: [
      { key: "storage-total", label: "Storage Servers", value: 3, kind: "integer", description: "Registered Storage Servers", tone: "cyan" },
      { key: "storage-active", label: "Active Storage", value: 2, kind: "integer", description: "Active Storage Servers", tone: "green" },
      { key: "storage-offline", label: "Offline Storage", value: 1, kind: "integer", description: "Offline Storage Servers", tone: "red" },
      { key: "storage-assigned", label: "Assigned Tenants", value: 10, kind: "integer", description: "Current tenant placements", tone: "blue" },
      { key: "storage-slots", label: "Available Slots", value: 140, kind: "integer", description: "Remaining limited placement slots", tone: "green" },
      { key: "storage-near", label: "Near Capacity", value: 0, kind: "integer", description: "At or above 80% utilization", tone: "amber" },
    ],
    ...overrides,
  } as DashboardGroup;
}

describe("DashboardGroupPanel", () => {
  it("charts a group instead of printing every field as a tile", () => {
    render(
      <DashboardGroupPanel
        groupKey="storage"
        group={storageGroup()}
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    const charts = screen.getByRole("region", { name: en.dashboard.visuals.chartsAriaLabel });
    expect(within(charts).getAllByRole("figure").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps at most three headline numbers out of six reported cards", () => {
    render(
      <DashboardGroupPanel
        groupKey="storage"
        group={storageGroup()}
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    const headline = screen.getByLabelText(en.dashboard.visuals.headlineAriaLabel);
    expect(within(headline).getAllByRole("term")).toHaveLength(3);
    expect(screen.queryByText("Near Capacity")).not.toBeInTheDocument();
  });

  it("collapses every reported field into one exact-values table", () => {
    render(
      <DashboardGroupPanel
        groupKey="storage"
        group={storageGroup()}
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    const exact = screen.getByRole("region", { name: en.dashboard.visuals.allValuesTitle });
    // 4 snapshot fields + 4 breakdown leaves, each exactly once.
    expect(within(exact).getAllByRole("row")).toHaveLength(9); // 8 values + header
    expect(within(exact).getByText("Highest Tenant Concentration")).toBeInTheDocument();
  });

  it("still surfaces alerts above the charts", () => {
    render(
      <DashboardGroupPanel
        groupKey="storage"
        group={storageGroup()}
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    const alerts = screen.getByRole("region", { name: en.dashboard.reportAlertsAriaLabel });
    expect(
      within(alerts).getByText("Storage Servers have a failed connection test."),
    ).toBeInTheDocument();
  });

  it("prefers Core-authored visuals over the client-side inference", () => {
    const authored: DashboardVisual = {
      key: "storage.byteUsage",
      kind: "gauge",
      title: "Byte utilization",
      unit: "bytes",
      reference: { bands: [{ upTo: 0.8, tone: "green" }, { upTo: 1, tone: "red" }] },
      data: { value: 640, maximum: 1000 },
    };

    render(
      <DashboardGroupPanel
        groupKey="storage"
        group={storageGroup({ visuals: [authored] } as Partial<DashboardGroup>)}
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    const charts = screen.getByRole("region", { name: en.dashboard.visuals.chartsAriaLabel });
    expect(within(charts).getAllByRole("figure")).toHaveLength(1);
    // The card heading is the visible name; ChartFigure repeats it sr-only.
    expect(
      screen.getByRole("heading", { name: "Byte utilization" }),
    ).toBeInTheDocument();
  });

  it("shows the permission-safe unavailable panel without inventing charts", () => {
    render(
      <DashboardGroupPanel
        groupKey="usage"
        group={
          {
            key: "usage",
            permission: "admin.reports.usage",
            available: false,
            asOf: "2026-06-30T09:00:00.000Z",
            reasonCode: "SOURCE_NOT_CONFIGURED",
            message: "No active authoritative producer is configured.",
            alerts: [],
            cards: [],
          } as unknown as DashboardGroup
        }
        rangeLabel="Jun 01, 2026 - Jun 30, 2026"
      />,
    );

    expect(
      screen.queryByRole("region", { name: en.dashboard.visuals.chartsAriaLabel }),
    ).not.toBeInTheDocument();
  });
});
