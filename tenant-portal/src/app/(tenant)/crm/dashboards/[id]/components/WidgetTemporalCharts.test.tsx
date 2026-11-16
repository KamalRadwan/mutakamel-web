// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { parseWidgetResult } from "../../dashboard-run-contract";
import { WidgetTemporalCharts } from "./WidgetTemporalCharts";
import { HeatmapChartView } from "./WidgetHeatmapChart";
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ DateTime: ({ value }: { value: string }) => <time>{value}</time>, MatrixHeatmapChart: (props: unknown) => <div data-testid="matrix">{JSON.stringify(props)}</div>, IntervalChart: (props: unknown) => <div>{JSON.stringify(props)}</div>, DirectedGraphChart: (props: unknown) => <div>{JSON.stringify(props)}</div> }));
afterEach(cleanup);
const result = (shape: string, points: unknown[]) => parseWidgetResult({ widgetId: "preview", shape, series: [{ key: "s", unit: "COUNT", points }], meta: {} });
it("places an interval on its two actual UTC civil days and marks the zone explicitly", () => {
  render(<WidgetTemporalCharts mode="CALENDAR" label="Calendar" result={result("INTERVAL", [{ key: "night", label: "Night", value: 7200000, start: "2026-10-02T00:00:00+02:00", end: "2026-10-02T02:00:00+02:00" }])} />);
  // Ends exactly at midnight UTC: exclusive end belongs only to October1.
  expect(screen.getAllByText("Night")).toHaveLength(1);
  expect(screen.getByText(en.crmDashboards.intervalUtcNotice)).toBeInTheDocument();
});
it("uses daily civil keys and keeps a missing day distinct from a real zero", () => {
  const source = result("TIME_SERIES", [{ key: "2026-10-01", value: null }, { key: "2026-10-02", value: 0 }]);
  render(<WidgetTemporalCharts mode="CALENDAR_HEATMAP" label="Daily" result={source} />);
  const matrix = JSON.parse(screen.getByTestId("matrix").textContent!);
  expect(matrix.cells[4][0].value).toBeNull(); expect(matrix.cells[5][0].value).toBe(0);
  expect(matrix.cells[6][0]).toBeNull();
});
it("retains zero weekends, every loaded category beyond16, and paired values in the heatmap", () => {
  const source = result("CATEGORY", [{ key: "Fri", label: "Fri", value: 0, previousValue: 2, previousKey: "PreviousFri" }, { key: "Sat", label: "Sat", value: 0, previousValue: null }, ...Array.from({ length: 20 }, (_, index) => ({ key: `c${index}`, label: `Category${index}`, value: index, previousValue: index + 1 }))]);
  render(<HeatmapChartView allSeries={source.series} label="Cells" summary="Exact" />);
  const matrices = screen.getAllByTestId("matrix").map((item) => JSON.parse(item.textContent!));
  expect(matrices).toHaveLength(2); expect(matrices[0].rows).toContain("Fri"); expect(matrices[0].rows).toContain("Sat"); expect(matrices[0].rows).toContain("Category19");
  expect(matrices[0].cells[0][0].value).toBe(0); expect(matrices[1].cells[0][0].value).toBe(2);
});
