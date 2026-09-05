// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const language = { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl", t: en as typeof ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => language,
}));

/**
 * Recharts draws nothing under jsdom — a `ResponsiveContainer` measures 0×0
 * there, so the real module renders an empty wrapper and every SVG assertion
 * would pass vacuously. These doubles put the props the renderer chose into
 * the DOM instead, which is the actual thing under test: two overlaid lines
 * rather than a stack or a set of bars.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="line-chart" data-rows={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: (props: Record<string, unknown>) => (
    <div
      data-testid="line"
      data-datakey={String(props.dataKey)}
      data-name={String(props.name)}
      data-stroke={String(props.stroke)}
      data-stackid={props.stackId === undefined ? "" : String(props.stackId)}
      data-animated={String(props.isAnimationActive)}
    />
  ),
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: (props: Record<string, unknown>) => (
    <div data-testid="x-axis" data-datakey={String(props.dataKey)} data-reversed={String(Boolean(props.reversed))} />
  ),
  YAxis: (props: Record<string, unknown>) => (
    <div data-testid="y-axis" data-orientation={String(props.orientation)} />
  ),
}));

import { DashboardVisualCard } from "../DashboardVisualCard";
import { MultiSeriesVisual } from "./MultiSeriesVisual";

function speak(lang: "ar" | "en") {
  language.lang = lang;
  language.dir = lang === "ar" ? "rtl" : "ltr";
  language.t = lang === "ar" ? ar : en;
}

const health = {
  key: "domains.health",
  kind: "multi-series",
  title: "Verified vs Needing Attention",
  unit: "count",
  data: {
    series: [
      {
        key: "verified",
        label: "Verified",
        tone: "green",
        points: [
          { key: "2026-06", label: "Jun", value: 4 },
          { key: "2026-07", label: "Jul", value: 6 },
          { key: "2026-08", label: "Aug", value: 9 },
        ],
      },
      {
        key: "attention",
        label: "Needing Attention",
        tone: "red",
        points: [
          { key: "2026-07", label: "Jul", value: 2 },
          { key: "2026-08", label: "Aug", value: 3 },
        ],
      },
    ],
  },
} as DashboardVisual;

describe("MultiSeriesVisual", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    speak("en");
  });

  it("draws one line per series, overlaid rather than stacked or barred", () => {
    render(<MultiSeriesVisual visual={health as never} />);

    const lines = screen.getAllByTestId("line");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.dataset.name)).toEqual(["Verified", "Needing Attention"]);
    // No stack id anywhere: these two counts never sum to a meaningful total.
    expect(lines.every((line) => line.dataset.stackid === "")).toBe(true);
    expect(screen.queryByTestId("bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("area")).not.toBeInTheDocument();
  });

  it("colours each line from its own tone, through the chart tokens", () => {
    render(<MultiSeriesVisual visual={health as never} />);

    expect(screen.getAllByTestId("line").map((line) => line.dataset.stroke)).toEqual([
      "var(--chart-success)",
      "var(--chart-danger)",
    ]);
  });

  it("merges the series onto one time axis, leaving a gap where a series has no point", () => {
    render(<MultiSeriesVisual visual={health as never} />);

    const rows = JSON.parse(screen.getByTestId("line-chart").dataset.rows ?? "[]");
    // June predates the second series, so its field is absent rather than 0 —
    // an unrecorded month is not a month with nothing in it.
    expect(rows).toEqual([
      { label: "Jun", value0: 4 },
      { label: "Jul", value0: 6, value1: 2 },
      { label: "Aug", value0: 9, value1: 3 },
    ]);
  });

  it("keeps chronology in source order under RTL and moves only the value axis", () => {
    speak("ar");
    render(<MultiSeriesVisual visual={health as never} />);

    expect(screen.getByTestId("x-axis").dataset.reversed).toBe("false");
    expect(screen.getByTestId("y-axis").dataset.orientation).toBe("right");
  });

  it("stops animating when the reader asks for reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    render(<MultiSeriesVisual visual={health as never} />);

    expect(screen.getAllByTestId("line").every((line) => line.dataset.animated === "false")).toBe(true);
  });

  it("gives the exact-value table a column per series and a gap for a missing bucket", () => {
    render(<MultiSeriesVisual visual={health as never} />);

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Period", "Verified", "Needing Attention"]);

    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent)),
    ).toEqual([
      ["Jun", "4", "—"],
      ["Jul", "6", "2"],
      ["Aug", "9", "3"],
    ]);
  });

  it("summarises every series and its total for a screen reader", () => {
    render(<MultiSeriesVisual visual={health as never} />);

    expect(screen.getByRole("figure", { name: "Verified vs Needing Attention" })).toHaveAccessibleDescription(
      "Verified vs Needing Attention: 2 series across 3 periods from Jun to Aug. Totals: Verified 19, Needing Attention 5.",
    );
  });

  it("translates the series names for an Arabic reader but not the dated buckets", () => {
    speak("ar");
    render(<DashboardVisualCard visual={health} />);

    expect(
      screen.getByRole("heading", { name: "المُتحقَّق منها مقابل ما يحتاج متابعة" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("line").map((line) => line.dataset.name)).toEqual([
      "مُتحقَّق منه",
      "يحتاج متابعة",
    ]);
    expect(screen.queryByText("Needing Attention")).not.toBeInTheDocument();

    // Bucket labels are formatted dates, so they stay exactly as Core sent them.
    expect(within(screen.getByRole("table")).getByText("Jun")).toBeInTheDocument();
  });

  it("falls back to the empty state when no series carries a point", () => {
    render(
      <MultiSeriesVisual
        visual={
          {
            ...health,
            data: { series: [{ key: "verified", label: "Verified", points: [] }] },
          } as never
        }
      />,
    );

    expect(screen.getByRole("status", { name: "Verified vs Needing Attention" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
