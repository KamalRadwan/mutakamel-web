// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 480, height: 320 }}>{children}</div>
    ),
  };
});

import { TenantGrowthRevenueChart } from "./TenantGrowthRevenueChart";

/**
 * FE-B14. `formatChartCurrency` pins maximumFractionDigits to zero so an axis
 * tick stays narrow. The exact-value table under the chart reused it, so a
 * month that collected 10.49 was reported as $10 — a rounding an operator
 * reconciling the figure against billing had no way to see.
 */
describe("TenantGrowthRevenueChart exact values", () => {
  it("keeps the minor unit of the collected revenue in the table", () => {
    render(
      <TenantGrowthRevenueChart
        points={[{ month: "2026-08", tenants: 3, collected: 10.49 }]}
      />,
    );

    const table = screen.getByRole("region", { name: /Exact values/ });
    expect(within(table).getByText("$10.49")).toBeInTheDocument();
  });

  it("leaves the axis and the summary free to round", () => {
    render(
      <TenantGrowthRevenueChart
        points={[{ month: "2026-08", tenants: 3, collected: 10.49 }]}
      />,
    );

    // The figure's spoken summary is a reading, not evidence.
    expect(screen.getByText(/Final point:.*\$10\b/)).toBeInTheDocument();
  });
});
