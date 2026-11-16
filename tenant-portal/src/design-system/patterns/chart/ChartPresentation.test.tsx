// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n/useLanguage";
import { AreaChart, BarChart, ComposedChart, LineChart } from "./CartesianChart";
import { DonutChart } from "./DonutChart";
const chartState = vi.hoisted(() => ({ value: 1250 as number | null }));

// jsdom cannot lay out SVG. Exercise the renderer boundary with the same
// numeric value in the axis, tooltip and labels so formatting cannot diverge.
vi.mock("recharts", async () => {
  const { createElement } = await import("react");
  type Children = { children?: React.ReactNode };
  const container = ({ children }: Children) => createElement("div", null, children);
  const chart = ({ children, layout }: Children & { layout?: string }) => createElement("div", { "data-testid": "native-chart", "data-layout": layout }, children);
  const series = (kind: string) => ({ children, dot, connectNulls, yAxisId }: Children & { dot?: boolean; connectNulls?: boolean; yAxisId?: string }) =>
    createElement("div", { "data-testid": "series", "data-kind": kind, "data-axis": yAxisId, "data-points": String(dot), "data-connect-nulls": String(connectNulls) }, children);
  return {
    Area: series("area"),
    AreaChart: chart,
    ComposedChart: chart,
    Bar: series("bar"),
    BarChart: chart,
    Line: series("line"),
    LineChart: chart,
    PieChart: container,
    ResponsiveContainer: container,
    CartesianGrid: () => null,
    Cell: ({ fill }: { fill?: string }) => createElement("span", { "data-testid": "chart-cell", "data-fill": fill }),
    ReferenceLine: ({ x }: { x?: number }) => createElement("span", { "data-testid": "zero-line", "data-x": x }),
    XAxis: ({ type, reversed }: { type?: string; reversed?: boolean }) =>
      createElement("span", { "data-testid": "x-axis", "data-type": type, "data-reversed": String(reversed) }),
    Legend: () => createElement("span", null, "Legend"),
    YAxis: ({ tickFormatter, type }: { tickFormatter?: (value: number) => string; type?: string }) =>
      createElement("span", { "data-testid": "axis", "data-type": type }, tickFormatter?.(1250)),
    LabelList: ({ formatter, position }: { formatter: (value: unknown) => string; position?: string }) =>
      createElement("span", { "data-testid": "value-label", "data-position": position }, formatter(chartState.value)),
    Pie: ({ children, label, innerRadius }: Children & { label: false | ((props: { value: number }) => string); innerRadius: number | string }) =>
      createElement("div", { "data-testid": "pie", "data-inner-radius": String(innerRadius) }, children, label && createElement("span", { "data-testid": "value-label" }, label({ value: 1250 }))),
    Tooltip: ({ content }: { content: (props: {
      active: boolean;
      label: string;
      payload: Array<{ value: number | null; name: string; dataKey: string; color: string; payload: { fill: string } }>;
    }) => React.ReactNode }) => createElement("div", null, content({
      active: true,
      label: "January",
      payload: [{ value: chartState.value, name: "Revenue", dataKey: "amount", color: "var(--chart-1)", payload: { fill: "var(--chart-1)" } }],
    })),
  };
});

afterEach(async () => { cleanup(); chartState.value = 1250; await setLanguage("ar"); });

const common = {
  data: [{ month: "January", amount: 1250 }],
  xKey: "month",
  series: [{ key: "amount", label: "Revenue", role: "brand" as const }],
  label: "Revenue",
  summary: "Revenue was 1250.",
};

describe("chart presentation", () => {
  it("uses category y and numeric x for a horizontal bar rather than relabelling columns", () => {
    render(<BarChart {...common} horizontal />);
    expect(screen.getByTestId("native-chart")).toHaveAttribute("data-layout", "vertical");
    expect(screen.getByTestId("axis")).toHaveAttribute("data-type", "category");
    expect(screen.getByTestId("x-axis")).toHaveAttribute("data-type", "number");
  });

  it.each(["en", "ar"] as const)("uses the signed bar endpoint and a zero line in %s", async (lang) => {
    await setLanguage(lang);
    chartState.value = -16.67;
    render(<BarChart {...common} horizontal showValues
      data={[{ month: "Events", amount: 25 }, { month: "Referral", amount: -16.67 }]}
      series={[{ ...common.series[0], role: "positive", diverging: true }]} />);
    expect(screen.getByTestId("zero-line")).toHaveAttribute("data-x", "0");
    expect(screen.getAllByTestId("chart-cell").map(cell => cell.getAttribute("data-fill")))
      .toEqual(["var(--color-positive-600)", "var(--color-negative-600)"]);
    expect(screen.getByTestId("x-axis")).toHaveAttribute("data-reversed", String(lang === "ar"));
    expect(screen.getByTestId("value-label")).toHaveAttribute("data-position", "right");
    expect(screen.getByTestId("value-label")).toHaveTextContent(/16\.67/);
  });

  it("renders distinct composed geometries with separately formatted numeric axes", () => {
    render(<ComposedChart {...common} series={[
      { key: "count", label: "Count", role: "brand", kind: "bar", axis: "LEFT", valueFormatter: (value) => `${value} records` },
      { key: "money", label: "Amount", role: "brand", kind: "line", axis: "RIGHT", valueFormatter: (value) => `${value} EGP` },
    ]} />);
    expect(screen.getAllByTestId("series").map((entry) => [entry.getAttribute("data-kind"), entry.getAttribute("data-axis")])).toEqual([["bar", "LEFT"], ["line", "RIGHT"]]);
    expect(screen.getAllByTestId("axis").map((entry) => entry.textContent)).toEqual(["1250 records", "1250 EGP"]);
  });

  it("draws a real pie without a donut hole or hidden center total", () => {
    render(<DonutChart variant="pie" label="Source share" summary="12 records" centerValue="12" slices={[{ key: "one", label: "One", value: 12, role: "brand" }]} />);
    expect(screen.getByTestId("pie")).toHaveAttribute("data-inner-radius", "0");
    expect(screen.queryByText("12")).toBeNull();
  });
  it.each([LineChart, AreaChart])("leaves null gaps disconnected and never formats them as zero", (Chart) => {
    chartState.value = null;
    const formatter = vi.fn((value: number) => `${value} units`);
    render(<Chart {...common} data={[{ month: "January", amount: null }]} valueFormatter={formatter} showValues />);
    expect(screen.getByTestId("series")).toHaveAttribute("data-connect-nulls", "false");
    expect(screen.getByTestId("value-label")).toBeEmptyDOMElement();
    expect(screen.queryByText("0 units")).toBeNull();
    expect(formatter).not.toHaveBeenCalledWith(0);
    expect(formatter).not.toHaveBeenCalledWith(null);
  });
  it("keeps points and value labels off unless requested", () => {
    render(<LineChart {...common} />);
    expect(screen.getByTestId("series")).toHaveAttribute("data-points", "false");
    expect(screen.queryByTestId("value-label")).not.toBeInTheDocument();
    expect(screen.getByText("Legend")).toBeInTheDocument();
  });

  it.each([LineChart, AreaChart, BarChart])("formats axes, tooltip and values consistently", (Chart) => {
    render(<Chart {...common} valueFormatter={(value) => `${value} units`} showPoints showValues showLegend={false} />);
    expect(screen.getByTestId("axis")).toHaveTextContent("1250 units");
    expect(screen.getByTestId("value-label")).toHaveTextContent("1250 units");
    expect(screen.getAllByText("1250 units")).toHaveLength(3);
    if (Chart !== BarChart) expect(screen.getByTestId("series")).toHaveAttribute("data-points", "true");
    expect(screen.queryByText("Legend")).not.toBeInTheDocument();
  });

  it("uses the chosen formatter for donut tooltip and optional value labels", () => {
    render(<DonutChart label="Revenue" summary="1250 units." showValues showLegend={false}
      valueFormatter={(value) => `${value} units`}
      slices={[{ key: "revenue", label: "Revenue", value: 1250, role: "brand" }]} />);
    expect(screen.getByTestId("value-label")).toHaveTextContent("1250 units");
    expect(screen.getAllByText("1250 units")).toHaveLength(2);
    expect(screen.queryByText("Legend")).not.toBeInTheDocument();
  });
});
