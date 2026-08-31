// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";

// The portal defaults to Arabic, so this is the language most operators
// actually see. Core authors every chart in English; this file proves the
// portal resolves that copy before it reaches a renderer.
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

import { DashboardVisualCard } from "./DashboardVisualCard";

describe("DashboardVisualCard for an Arabic reader", () => {
  it("titles a chart from the portal's copy, not Core's English fallback", () => {
    render(
      <DashboardVisualCard
        visual={
          {
            key: "storage.byStatus",
            kind: "donut",
            title: "Storage Servers by Status",
            unit: "count",
            data: {
              categories: [
                { key: "ACTIVE", label: "Active", value: 2, tone: "green" },
                { key: "OFFLINE", label: "Offline", value: 1, tone: "red" },
              ],
            },
          } as DashboardVisual
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "خوادم التخزين حسب الحالة" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Storage Servers by Status")).not.toBeInTheDocument();
  });

  it("translates category names in the legend and the exact-value table", () => {
    render(
      <DashboardVisualCard
        visual={
          {
            key: "storage.byStatus",
            kind: "donut",
            title: "Storage Servers by Status",
            unit: "count",
            data: {
              categories: [
                { key: "ACTIVE", label: "Active", value: 2, tone: "green" },
                { key: "OFFLINE", label: "Offline", value: 1, tone: "red" },
              ],
            },
          } as DashboardVisual
        }
      />,
    );

    // The name appears in the legend and again in the exact-value table.
    expect(screen.getAllByText("نشط")).toHaveLength(2);
    expect(screen.getAllByText("غير متصل")).toHaveLength(2);

    const table = screen.getByRole("table");
    expect(within(table).getByText("نشط")).toBeInTheDocument();
    expect(within(table).getByText("غير متصل")).toBeInTheDocument();
  });

  it("translates both series names of a two-metric comparison", () => {
    render(
      <DashboardVisualCard
        visual={
          {
            key: "billing.periodVsTotal",
            kind: "comparison",
            title: "Receivables: All Time vs Selected Period",
            unit: "usd",
            data: {
              primaryLabel: "All time",
              secondaryLabel: "Selected period",
              pairs: [
                { key: "collected", label: "Collected", primary: 900, secondary: 400 },
              ],
            },
          } as DashboardVisual
        }
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "المستحقات: الإجمالي مقابل الفترة المحددة",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("الإجمالي").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الفترة المحددة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مُحصَّل").length).toBeGreaterThan(0);
  });

  it("still renders a visual the portal has no copy for", () => {
    render(
      <DashboardVisualCard
        visual={
          {
            key: "future.unmapped",
            kind: "bar",
            title: "Something Core Added Later",
            unit: "count",
            data: { categories: [{ key: "a", label: "Alpha", value: 2 }, { key: "b", label: "Beta", value: 1 }] },
          } as DashboardVisual
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Something Core Added Later" }),
    ).toBeInTheDocument();
  });

  it("translates the fault-domain donut, whose labels come from the taxonomy", () => {
    render(
      <DashboardVisualCard
        visual={
          {
            key: "audit.byFaultDomain",
            kind: "donut",
            title: "Failures by Fault Domain",
            unit: "count",
            data: {
              categories: [
                { key: "DEPENDENCY", label: "Dependency Failure", value: 3803 },
                { key: "CLIENT", label: "Correctly Refused", value: 58 },
                { key: "INDETERMINATE", label: "Outcome Unknown", value: 58 },
                { key: "APPLICATION", label: "Platform Defect", value: 7, tone: "red" },
                { key: "UNCLASSIFIED", label: "Needs Triage", value: 4 },
                { key: "CAPACITY", label: "Capacity Guard", value: 1 },
              ],
            },
          } as DashboardVisual
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "الأعطال حسب جهة الخلل" }),
    ).toBeInTheDocument();
    for (const arabic of [
      "عطل في اعتمادية",
      "رُفض عن صواب",
      "نتيجة غير معروفة",
      "خلل في المنصة",
      "يحتاج فرزًا",
      "حماية السعة",
    ]) {
      expect(screen.getAllByText(arabic).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Dependency Failure")).not.toBeInTheDocument();
    expect(screen.queryByText("Platform Defect")).not.toBeInTheDocument();
  });
});
