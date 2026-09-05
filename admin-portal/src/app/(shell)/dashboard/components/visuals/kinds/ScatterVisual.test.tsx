// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardVisual, DashboardVisualScatterPoint } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { DASHBOARD_CHART_VISUAL_ITEM_LIMIT } from "../../charts/ChartAccessibility";

const language = { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl", t: en as typeof ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => language,
}));

/**
 * Recharts draws nothing under jsdom — a `ResponsiveContainer` measures 0×0
 * there, so the real module renders an empty wrapper and every SVG assertion
 * would pass vacuously. These doubles put the props the renderer chose into
 * the DOM instead.
 *
 * Anything the exact-value table can carry is asserted against the table, which
 * is built from the same points and is real DOM. Only the choices a table
 * cannot express — whether a third axis exists at all, which side the value
 * axis sits on — are read from these doubles.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScatterChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scatter-chart">{children}</div>
  ),
  Scatter: ({
    children,
    data,
    name,
    isAnimationActive,
  }: {
    children?: React.ReactNode;
    data?: unknown;
    name?: string;
    isAnimationActive?: boolean;
  }) => (
    <div
      data-testid="scatter"
      data-name={String(name)}
      data-marks={JSON.stringify(data)}
      data-animated={String(isAnimationActive)}
    >
      {children}
    </div>
  ),
  Cell: (props: Record<string, unknown>) => <div data-testid="cell" data-fill={String(props.fill)} />,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Label: (props: Record<string, unknown>) => (
    <div data-testid="axis-label" data-value={String(props.value)} />
  ),
  XAxis: ({
    children,
    dataKey,
    reversed,
  }: {
    children?: React.ReactNode;
    dataKey?: string;
    reversed?: boolean;
  }) => (
    <div data-testid="x-axis" data-datakey={String(dataKey)} data-reversed={String(Boolean(reversed))}>
      {children}
    </div>
  ),
  YAxis: (props: Record<string, unknown>) => (
    <div
      data-testid="y-axis"
      data-datakey={String(props.dataKey)}
      data-orientation={String(props.orientation)}
    />
  ),
  ZAxis: (props: Record<string, unknown>) => (
    <div
      data-testid="z-axis"
      data-datakey={String(props.dataKey)}
      data-range={JSON.stringify(props.range)}
    />
  ),
}));

import { DashboardVisualCard } from "../DashboardVisualCard";
import { ScatterVisual } from "./ScatterVisual";

function speak(lang: "ar" | "en") {
  language.lang = lang;
  language.dir = lang === "ar" ? "rtl" : "ltr";
  language.t = lang === "ar" ? ar : en;
}

/**
 * The case the shape exists for: the same 70% non-success rate on twelve
 * events and on twelve thousand. A ranking of rates puts them side by side as
 * equals; only the second axis separates the noise from the incident.
 */
const POINTS: DashboardVisualScatterPoint[] = [
  { key: "t-1", label: "Beta Logistics", x: 12, y: 0.7, size: 4 },
  { key: "t-2", label: "Acme Holdings", x: 12_000, y: 0.7, size: 40, tone: "red" },
  { key: "t-3", label: "Gamma Freight", x: 3_400, y: 0.12, size: 18 },
];

/** The same subjects with no third measure at all. */
const UNSIZED: DashboardVisualScatterPoint[] = [
  { key: "t-1", label: "Beta Logistics", x: 12, y: 0.7 },
  { key: "t-2", label: "Acme Holdings", x: 12_000, y: 0.7 },
  { key: "t-3", label: "Gamma Freight", x: 3_400, y: 0.12 },
];

function scatter(points: DashboardVisualScatterPoint[] = POINTS): DashboardVisual {
  return {
    key: "audit.evidenceQuality",
    kind: "scatter",
    title: "Evidence Gaps Against Event Volume",
    unit: "count",
    data: { xLabel: "Events", yLabel: "Non-success", points },
  } as DashboardVisual;
}

function tableRows(): string[][] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent ?? ""));
}

describe("ScatterVisual", () => {
  afterEach(() => speak("en"));

  /**
   * A cloud of marks says nothing to a screen reader, and colour is never the
   * only encoding here. The table is the whole accessible chart, so every
   * subject has to appear in it by name with both of its coordinates.
   */
  it("carries every point into the exact-value table by name with both coordinates", () => {
    render(<ScatterVisual visual={scatter() as never} />);

    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Category", "Events", "Non-success"]);

    expect(tableRows()).toEqual([
      ["Beta Logistics", "12", "70%"],
      ["Acme Holdings", "12,000", "70%"],
      ["Gamma Freight", "3,400", "12%"],
    ]);
  });

  it("keeps the subjects past the drawing limit in the table, though the cloud is bounded", () => {
    const many = Array.from({ length: DASHBOARD_CHART_VISUAL_ITEM_LIMIT + 4 }, (_, index) => ({
      key: `t-${index}`,
      label: `Tenant ${index}`,
      x: index * 100,
      y: index / 100,
    }));

    render(<ScatterVisual visual={scatter(many) as never} />);

    expect(screen.getAllByTestId("cell")).toHaveLength(DASHBOARD_CHART_VISUAL_ITEM_LIMIT);
    // The table is the complete record, so nothing Core sent is lost.
    expect(tableRows()).toHaveLength(DASHBOARD_CHART_VISUAL_ITEM_LIMIT + 4);
    expect(within(screen.getByRole("table")).getByText("Tenant 15")).toBeInTheDocument();
  });

  it("declares a bubble radius when a point carries a size, scaling area not radius", () => {
    render(<ScatterVisual visual={scatter() as never} />);

    const zAxis = screen.getByTestId("z-axis");
    expect(zAxis.dataset.datakey).toBe("z");
    // Recharts reads `range` as the symbol's area, so ten times the measure is
    // ten times the ink rather than a hundred.
    expect(zAxis.dataset.range).toBe("[40,400]");
  });

  it("declares no third axis at all when no point carries a size", () => {
    render(<ScatterVisual visual={scatter(UNSIZED) as never} />);

    expect(screen.queryByTestId("z-axis")).not.toBeInTheDocument();
    // Losing the third measure is not losing the chart: two axes still plot.
    expect(screen.getAllByTestId("cell")).toHaveLength(3);
    expect(tableRows()).toHaveLength(3);
  });

  /**
   * Reading `points[0]` would announce whichever subject Core happened to
   * serialise first, which is the one thing the summary must not do.
   */
  it("names the mark highest up the y axis, not the first one Core sent", () => {
    render(
      <ScatterVisual
        visual={
          scatter([
            { key: "t-3", label: "Gamma Freight", x: 3_400, y: 0.12, size: 18 },
            { key: "t-2", label: "Acme Holdings", x: 12_000, y: 0.7, size: 40, tone: "red" },
          ]) as never
        }
      />,
    );

    expect(screen.getByRole("figure")).toHaveAccessibleDescription(/Highest is Acme Holdings/);
  });

  it("breaks a tie at the top by size, so volume decides which rate is the incident", () => {
    render(<ScatterVisual visual={scatter() as never} />);

    // Beta is first in the payload and ties Acme's 70%, but on twelve events.
    expect(screen.getByRole("figure", { name: "Evidence Gaps Against Event Volume" })).toHaveAccessibleDescription(
      "Evidence Gaps Against Event Volume: 3 subjects, Events across and Non-success up. Highest is Acme Holdings at 70% on 12,000.",
    );
  });

  it("puts the value axis on the reading-start side for an English reader", () => {
    render(<ScatterVisual visual={scatter() as never} />);

    expect(screen.getByTestId("y-axis").dataset.orientation).toBe("left");
  });

  it("moves only the value axis under RTL, leaving the quantitative axis pointing up", () => {
    speak("ar");
    render(<ScatterVisual visual={scatter() as never} />);

    expect(screen.getByTestId("y-axis").dataset.orientation).toBe("right");
    // x is a magnitude, not a sequence. Reversing it would mirror the cloud and
    // leave an axis that still reads low to high pointing the other way.
    expect(screen.getByTestId("x-axis").dataset.reversed).toBe("false");
    expect(screen.getByTestId("x-axis").dataset.datakey).toBe("x");
  });

  it("translates the axis names for an Arabic reader but never the subjects", () => {
    speak("ar");
    render(<DashboardVisualCard visual={scatter()} />);

    expect(screen.getByRole("heading", { name: "فجوات الأدلة مقابل حجم الأحداث" })).toBeInTheDocument();
    expect(screen.getByTestId("axis-label").dataset.value).toBe("الأحداث");
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["الفئة", "الأحداث", "غير ناجح"]);

    // A mark stands for a tenant, and a tenant name is a record, not
    // vocabulary — translating it renames the thing the operator has to open.
    expect(within(screen.getByRole("table")).getByText("Acme Holdings")).toBeInTheDocument();
    expect(screen.queryByText("Events")).not.toBeInTheDocument();
  });

  it("falls back to the empty state when Core sends no points", () => {
    render(<ScatterVisual visual={scatter([]) as never} />);

    expect(screen.getByRole("status", { name: "Evidence Gaps Against Event Volume" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scatter-chart")).not.toBeInTheDocument();
  });
});
