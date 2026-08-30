// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardGroup } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";

// The portal defaults to Arabic. Everything a group tab shows is authored in
// English by Core, so this file checks the whole panel, not just the charts.
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl", t: ar }),
}));

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 480, height: 240 }}>{children}</div>
    ),
  };
});

import { DashboardGroupPanel } from "./DashboardGroupPanel";

const storage = {
  key: "storage",
  permission: "admin.reports.storage",
  available: true,
  asOf: "2026-08-30T00:00:00.000Z",
  snapshot: {
    totalServers: 3,
    assignedTenants: 10,
    byteUsage: { maximumBytes: "1024", utilizedBytes: "512" },
  },
  period: {},
  breakdowns: { byStatus: { ACTIVE: 2, OFFLINE: 1 } },
  alerts: [
    {
      key: "storage-connection-test-failed",
      severity: "critical",
      count: 1,
      message: "Storage Servers have a failed connection test.",
    },
  ],
  cards: [
    {
      key: "storage-total",
      label: "Storage Servers",
      value: 3,
      kind: "integer",
      description: "Registered Storage Servers",
      tone: "cyan",
    },
  ],
  visuals: [],
} as unknown as DashboardGroup;

describe("a group tab for an Arabic reader", () => {
  it("translates the alert sentence", () => {
    render(
      <DashboardGroupPanel groupKey="storage" group={storage} rangeLabel="أغسطس ٢٠٢٦" />,
    );

    const alerts = screen.getByRole("region", {
      name: ar.dashboard.reportAlertsAriaLabel,
    });
    expect(
      within(alerts).getByText("خوادم تخزين عليها اختبار اتصال فاشل."),
    ).toBeInTheDocument();
    expect(
      within(alerts).queryByText(/failed connection test/i),
    ).not.toBeInTheDocument();
  });

  it("translates the headline metric and its caption", () => {
    render(
      <DashboardGroupPanel groupKey="storage" group={storage} rangeLabel="أغسطس ٢٠٢٦" />,
    );

    const headline = screen.getByLabelText(ar.dashboard.visuals.headlineAriaLabel);
    expect(within(headline).getByText("خوادم التخزين")).toBeInTheDocument();
    expect(within(headline).getByText("خوادم تخزين مسجَّلة")).toBeInTheDocument();
  });

  it("translates field names in the exact-value table, nested paths included", () => {
    render(
      <DashboardGroupPanel groupKey="storage" group={storage} rangeLabel="أغسطس ٢٠٢٦" />,
    );

    const exact = screen.getByRole("region", {
      name: ar.dashboard.visuals.allValuesTitle,
    });
    expect(within(exact).getByText("إجمالي الخوادم")).toBeInTheDocument();
    expect(
      within(exact).getByText("استخدام البايت · الحد الأقصى بالبايت"),
    ).toBeInTheDocument();
    // A breakdown leaf is a wire enum; it resolves through the shared terms.
    expect(within(exact).getByText("حسب الحالة · نشط")).toBeInTheDocument();
    expect(within(exact).queryByText(/Total Servers|ACTIVE/)).not.toBeInTheDocument();
  });
});
