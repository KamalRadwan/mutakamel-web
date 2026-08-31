// @vitest-environment jsdom

import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChartFigure,
  DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
  dashboardChartVisualItems,
  chartLocale,
  formatChartNumber,
  formatChartPercent,
  useReducedMotion,
} from "./ChartAccessibility";

describe("ChartAccessibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes Arabic chart meaning, a visible non-color legend, and an exact-values table", () => {
    render(
      <ChartFigure
        title="توزيع الحالات"
        summary="توزيع الحالات: نشط: ٨، معلّق: ٢."
        lang="ar"
        height={180}
        legend={[
          { key: "active", label: "نشط", value: "٨", color: "var(--chart-success)" },
          { key: "pending", label: "معلّق", value: "٢", color: "var(--chart-warning)" },
        ]}
        columns={["الفئة", "القيمة"]}
        rows={[
          { key: "active", cells: ["نشط", "٨"] },
          { key: "pending", cells: ["معلّق", "٢"] },
        ]}
      >
        <svg data-testid="decorative-chart" />
      </ChartFigure>,
    );

    const figure = screen.getByRole("figure", { name: "توزيع الحالات" });
    const legend = within(figure).getByRole("list", { name: "مفتاح الرسم البياني" });
    expect(within(legend).getByText("نشط")).toBeVisible();
    expect(within(legend).getByText("٨")).toBeVisible();

    const disclosure = within(figure).getByText("القيم الدقيقة");
    fireEvent.click(disclosure);

    expect(disclosure.closest("details")).toHaveAttribute("open");
    const table = within(figure).getByRole("table", { name: "توزيع الحالات" });
    expect(within(table).getByRole("columnheader", { name: "الفئة" })).toBeInTheDocument();
    expect(within(table).getByText("معلّق")).toBeInTheDocument();
  });

  it("uses explicit application locales for chart values", () => {
    expect(chartLocale("en")).toBe("en-US");
    expect(chartLocale("ar")).toBe("ar-EG");
    expect(formatChartNumber("en", 1234)).toBe("1,234");
    expect(formatChartPercent("en", 0.625)).toBe("62.5%");
    expect(formatChartPercent("en", 4)).toBe("100%");
  });

  it("bounds visual chart categories without removing exact source items", () => {
    const source = Array.from({ length: 50 }, (_, index) => `item-${index + 1}`);

    expect(dashboardChartVisualItems(source)).toEqual(
      source.slice(0, DASHBOARD_CHART_VISUAL_ITEM_LIMIT),
    );
    expect(source).toHaveLength(50);
  });

  it("reports the user's reduced-motion preference", () => {
    const mediaQuery = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } satisfies MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });
});
