// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartesianChartProps, DonutChartProps } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { parseWidgetResult, type WidgetResult } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import { localizeWidgetResult } from "../../widget-labels";
import { LEAD_SOURCE_GROWTH_METRIC } from "../../widget-source-growth";
import { WidgetChart } from "./WidgetChart";
import { WidgetTile } from "./WidgetTile";
import { WidgetPreview } from "../../../widgets/components/WidgetPreview";
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: locale.lang === "ar" ? ar : en, lang: locale.lang, dir: locale.lang === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  const chart = (props: CartesianChartProps) => <div data-testid="plot" data-rows={JSON.stringify(props.data)} data-color={props.series[0]?.fill} data-points={String(props.showPoints)} data-values={String(props.showValues)} data-kinds={props.series.map((series) => series.kind).join(",")} data-axes={JSON.stringify(props.valueAxes)}>{props.valueFormatter?.(12500)}</div>;
  return { ...actual, LineChart: chart, AreaChart: chart, BarChart: chart, ComposedChart: chart,
    DonutChart: (props: DonutChartProps) => <div data-testid="donut" data-legend={String(props.showLegend)} data-values={String(props.showValues)}>{props.centerValue}</div> };
});
const result: WidgetResult = { widgetId: "01900300-0000-7000-8000-000000000001", shape: "CATEGORY", value: null, previousValue: null, target: null,
  unit: "COUNT", currency: null, rows: [], typedResult: null, generatedAt: "2026-11-03T00:00:00Z", warnings: [], errorCode: null,
  series: [{ key: "crm.count", label: "Created leads", unit: "COUNT", axis: "LEFT", currency: null,
    points: [{ key: "owner", label: "Owner A", value: 12500, secondaryValue: null, start: null, end: null, meta: {} }] }] };
const widget: WidgetDefinition = { id: result.widgetId, ownerUserId: "01900300-0000-7000-8000-000000000002", ownerName: null, name: "Definition name", visualizationType: "LINE",
  querySpec: { series: [{ metricKey: "crm.count", color: "#123456" }] }, displaySpec: { title: "Sales overview", subtitle: "This quarter", numberFormat: "compact", color: "#abcdef", legendPosition: "top", options: { showPoints: true, showValues: true } },
  schemaVersion: 1, revision: 1, createdAt: result.generatedAt, updatedAt: result.generatedAt, accessLevel: "OWNER", isShared: false };
function sourceGrowthResult(): WidgetResult {
  const definitions = [
    ["Events", "الفعاليات", 120, 150, 25], ["Paid", "الإعلانات المدفوعة", 300, 340, 13.33],
    ["Website", "الموقع", 400, 440, 10], ["Referral", "الإحالات", 300, 250, -16.67],
    ["Partner", "شريك", 0, 60, null],
  ] as const;
  return { ...result, state: "READY", unit: "PERCENT",
    details: { sourceGrowth: { timeZone: "Africa/Cairo", foldedSourceCount: 0,
      previous: { from: "2026-09-01", to: "2026-09-30" }, current: { from: "2026-10-01", to: "2026-10-31" },
      totals: { previousCount: 1120, currentCount: 1240, absoluteChange: 120, growthPercent: 10.71 } } },
    series: [{ ...result.series[0], key: LEAD_SOURCE_GROWTH_METRIC, unit: "PERCENT", label: "Intake growth by source",
      points: definitions.map(([label, labelAr, previousCount, currentCount, growthPercent]) => ({
        ...result.series[0].points[0], key: label.toLowerCase(), label, value: growthPercent,
        meta: { labelAr, previousCount, currentCount, growthPercent, absoluteChange: currentCount - previousCount },
      })) }] };
}

afterEach(() => { cleanup(); locale.lang = "en"; });
describe("saved presentation in actual preview and dashboard components", () => {
  it.each(["en", "ar"] as const)("shows the effective tile period and opens a saved exact table in %s", (lang) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    const metricKey = "crm.leads.created.trend";
    const query = { series: [{ metricKey }], dimension: { key: "time", grain: "MONTH" as const }, filters: { datePreset: "LAST_3_COMPLETE_MONTHS" } };
    const dated = parseWidgetResult({
      widgetId: widget.id, state: "READY", shape: "TIME_SERIES",
      meta: { unit: "COUNT", effectivePeriod: { from: "2026-08-01", to: "2026-10-31", timeZone: "Africa/Cairo" } },
      details: { monthlyIntake: { total: 3360, absoluteChange: 120, growthPercent: 10.71 } },
      series: [{ ...result.series[0], key: metricKey, points: [1000, 1120, 1240].map((value, index) => ({
        ...result.series[0].points[0], key: `2026-${String(index + 8).padStart(2, "0")}-01`,
        label: `2026-${String(index + 8).padStart(2, "0")}-01`, value,
      })) }],
    });
    expect(dated.effectivePeriod).toEqual({ from: "2026-08-01", to: "2026-10-31", timeZone: "Africa/Cairo" });
    render(<WidgetTile widget={{ ...widget, querySpec: query, displaySpec: { options: { showTable: true } } }}
      result={dated} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText("Africa/Cairo")).toBeInTheDocument();
    expect(screen.getByTestId("plot")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("3,360");
    expect(screen.getByText(/10\.71/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.crmDashboards.hideDataTable }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByTestId("plot")).toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("renders signed source growth and exact reconciled evidence in %s", (lang) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    const growth = sourceGrowthResult();
    const preview = render(<WidgetPreview result={growth} visualizationType="BAR" name="Growth" />);
    const plot = screen.getByTestId("plot");
    const [min, max] = JSON.parse(plot.getAttribute("data-axes") ?? "{}").LEFT.domain;
    expect(min).toBeLessThan(-16.67);
    expect(max).toBeGreaterThan(25);
    expect(JSON.parse(plot.getAttribute("data-rows") ?? "[]").map((row: Record<string, unknown>) => row[LEAD_SOURCE_GROWTH_METRIC]))
      .toEqual([25, 13.33, 10, -16.67, null]);
    expect(screen.getByText(t.crmDashboards.sourceGrowth.zeroBaseline)).toBeInTheDocument();
    expect(screen.getByText("Africa/Cairo")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: t.crmDashboards.sourceGrowth.previous })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: lang === "ar" ? /شريك/ : /Partner/ })).toHaveTextContent(t.common.noData);
    expect(within(table).getByRole("row", { name: new RegExp(t.crmDashboards.sourceGrowth.total) })).toHaveTextContent("10.71");
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, name: "Growth", visualizationType: "BAR", displaySpec: {},
      querySpec: { series: [{ metricKey: LEAD_SOURCE_GROWTH_METRIC }], dimension: { key: "source" } } }}
      result={growth} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: t.crmDashboards.showDataTable }));
    expect(screen.getByRole("table")).toHaveTextContent("1,240");
  });

  it("rejects mismatched source growth receipts rather than displaying unreconciled data", () => {
    const growth = sourceGrowthResult();
    growth.series[0].points[0].meta.currentCount = 151;
    render(<WidgetPreview result={growth} visualizationType="BAR" name="Growth" />);
    expect(screen.getByText(en.crmDashboards.sourceGrowth.unavailable)).toBeInTheDocument();
    expect(screen.queryByTestId("plot")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps current intake evidence when the entire matched baseline is zero", () => {
    const growth = sourceGrowthResult();
    growth.series[0].points = [growth.series[0].points[4]];
    growth.details!.sourceGrowth = {
      ...(growth.details!.sourceGrowth as object),
      totals: { currentCount: 60, previousCount: 0, absoluteChange: 60, growthPercent: null },
    };
    render(<WidgetPreview result={growth} visualizationType="BAR" name="Growth" />);
    expect(screen.queryByTestId("plot")).toBeNull();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /Partner/ })).toHaveTextContent("+60");
    expect(within(table).getByRole("row", { name: /Total/ })).toHaveTextContent(en.common.noData);
  });
  it("makes every loaded preview row available instead of silently stopping at twelve", () => {
    const long: WidgetResult = { ...result, series: [{ ...result.series[0], points: Array.from({ length: 75 }, (_, index) => ({
      ...result.series[0].points[0], key: String(index), label: `Record ${index}`, value: index,
    })) }] };
    render(<WidgetPreview result={long} visualizationType="LINE" name="Loaded rows" />);
    expect(screen.queryByText("Record 74")).toBeNull();
    expect(screen.getByText("Showing 50 of 75 loaded rows")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.crmDashboards.showMoreTableRows }));
    expect(screen.getByText("Record 74")).toBeInTheDocument();
    expect(screen.getByText("Showing 75 of 75 loaded rows")).toBeInTheDocument();
  });
  it("passes a null gap to the chart and exposes paired values in the actual preview table", () => {
    const compared: WidgetResult = { ...result, shape: "TIME_SERIES", series: [{ ...result.series[0], points: [
      { ...result.series[0].points[0], key: "2026-10-01", value: null, previousValue: 42, previousKey: "2026-09-01" },
      { ...result.series[0].points[0], key: "2026-10-02", label: "Second day", value: 0, previousValue: null, previousKey: null },
    ] }] };
    render(<WidgetPreview result={compared} visualizationType="LINE" name="Compared" />);
    expect(JSON.parse(screen.getByTestId("plot").getAttribute("data-rows") ?? "[]")).toEqual([
      { label: "Owner A", "crm.count": null, "crm.count:matched": 42 }, { label: "Second day", "crm.count": 0, "crm.count:matched": null },
    ]);
    expect(screen.getByRole("table")).toHaveTextContent("42");
    expect(screen.getByRole("table")).toHaveTextContent("2026-09-01");
    expect(screen.getByRole("table")).toHaveTextContent(en.common.noData);
    expect(screen.queryByText(en.crmWidgets.review.comparisonTable)).toBeNull();
  });
  it("renders both duration statistics with sample evidence in the preview and saved tile", () => {
    const duration: WidgetResult = { ...result, shape: "SCALAR", state: "READY", unit: "DURATION", value: 25,
      series: [["Median", 25], ["P90", 37]].map(([label, value]) => ({
        ...result.series[0], key: String(label), label: String(label), unit: "DURATION",
        points: [{ ...result.series[0].points[0], value: Number(value), meta: {
          conversionSample: { validCount: 4, excludedCount: 1 },
        } }],
      })),
    };
    const caption = "Valid conversion intervals 4 · excluded 1";
    const preview = render(<WidgetPreview result={duration} visualizationType="MULTI_KPI" />);
    expect(screen.getAllByText(caption)).toHaveLength(2);
    expect(screen.getAllByText("P90").length).toBeGreaterThan(0);
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, visualizationType: "MULTI_KPI", displaySpec: {} }}
      result={duration} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getAllByText(caption)).toHaveLength(2);
    expect(screen.getByText("P90")).toBeInTheDocument();
  });
  it("labels cohort observation time and shows exact count and denominator beside the combined chart", () => {
    const point = { ...result.series[0].points[0], value: 2, meta: { numerator: 2, denominator: 3 } };
    const cohort: WidgetResult = { ...result,
      details: { sourceCohort: { asOf: "2026-11-03T00:00:00Z" } },
      series: [
        { ...result.series[0], label: "Cohort conversions", points: [point] },
        { ...result.series[0], key: "crm.rate", label: "Conversion rate", unit: "PERCENT", axis: "RIGHT",
          points: [{ ...point, value: 66.67 }] },
      ],
    };
    render(<WidgetPreview result={cohort} visualizationType="COMBO" />);
    expect(screen.getByText(en.crmDashboards.cohortObservedAt)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: en.crmDashboards.cohortEligible })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("66.67");
  });
  it("shows reconciled cohort columns and the observation time in preview and saved tiles", () => {
    const base = result.series[0];
    const asOf = "2026-11-03T10:00:00Z";
    const cohort: WidgetResult = { ...result, shape: "TIME_SERIES", state: "READY",
      details: { cohortProgress: { eligible: 12, converted: 7, remaining: 5, invalidIntervals: 0, asOf } },
      series: [
        { key: "eligible", label: "Created", value: 12 },
        { key: "converted", label: "Converted", value: 7 },
        { key: "remaining", label: "Remaining", value: 5 },
      ].map(({ key, label, value }) => ({ ...base, key, label, points: [
        { ...base.points[0], key: "2026-10-01", label: "2026-10-01", value },
      ] })),
    };
    const preview = render(<WidgetPreview result={cohort} visualizationType="COLUMN" />);
    expect(screen.getByTestId("plot")).toHaveAttribute("data-kinds", "bar,bar,bar");
    expect(screen.getByRole("cell", { name: "12" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "7" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(screen.getByText(en.crmDashboards.cohortObservedAt).parentElement?.querySelector("time")).toHaveAttribute("datetime", asOf);
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, visualizationType: "COLUMN", displaySpec: {} }}
      result={cohort} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText(en.crmDashboards.cohortObservedAt).parentElement?.querySelector("time")).toHaveAttribute("datetime", asOf);
  });
  it("labels current readable wins and their exact denominator in preview and saved tiles", () => {
    const asOf = "2026-11-03T10:00:00Z";
    const metricKey = "crm.leads.cohort.won_link.current_won.rate";
    const cohort: WidgetResult = { ...result, shape: "SCALAR", state: "READY", value: 40, unit: "PERCENT",
      details: { leadWonCohort: { created: 12, converted: 5, won: 2, withoutReadableWin: 3, rate: 40, asOf, outcomeBasis: "CURRENT_WON" } },
      series: [{ ...result.series[0], key: metricKey, unit: "PERCENT", points: [
        { ...result.series[0].points[0], value: 40 },
      ] }],
    };
    const preview = render(<WidgetPreview result={cohort} visualizationType="METRIC_CARD" />);
    expect(screen.getByText(en.crmDashboards.cohortCurrentWin)).toBeInTheDocument();
    expect(screen.getByText("2 of 5 converted leads have a readable win")).toBeInTheDocument();
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, visualizationType: "METRIC_CARD", displaySpec: {} }}
      result={cohort} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText(en.crmDashboards.cohortCurrentWin)).toBeInTheDocument();
    expect(screen.getByText("2 of 5 converted leads have a readable win")).toBeInTheDocument();
    expect(screen.getByText(en.crmDashboards.cohortObservedAt).parentElement?.querySelector("time")).toHaveAttribute("datetime", asOf);
  });
  it("draws observed box-plot bounds and keeps excluded-only groups in the preview and saved exact table", () => {
    const chart: WidgetResult = { ...result, shape: "DURATION_DISTRIBUTION", state: "READY", unit: "DURATION", series: [],
      typedResult: { shape: "DURATION_DISTRIBUTION", unit: "DURATION", whiskerMethod: "MIN_MAX", totalCount: 1, excludedCount: 2,
        groups: [
          { key: "north", label: "Central · North", sampleCount: 1, excludedCount: 0, min: 0, q1: 0, median: 0, q3: 0, p90: 0, max: 0 },
          { key: "south", label: "Central · South", sampleCount: 0, excludedCount: 2, min: null, q1: null, median: null, q3: null, p90: null, max: null },
        ],
      },
    };
    const preview = render(<WidgetPreview name="Observed cycle" result={chart} visualizationType="BOX_PLOT" />);
    expect(screen.getByRole("figure", { name: "Observed cycle" })).toHaveTextContent(en.crmDashboards.boxPlot.whiskers);
    expect(screen.getByRole("figure")).toHaveTextContent("One observation · median 0");
    expect(screen.getByRole("figure").querySelector("svg line[stroke-width='6']")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("Central · South");
    expect(screen.getByRole("columnheader", { name: en.crmDashboards.typedTable.q3 })).toBeInTheDocument();
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, visualizationType: "BOX_PLOT", displaySpec: {} }}
      result={chart} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByRole("figure")).toHaveTextContent("Central · North");
    const table = screen.queryByRole("table");
    if (!table) fireEvent.click(screen.getByRole("button", { name: en.crmDashboards.showDataTable }));
    expect(screen.getByRole("table")).toHaveTextContent("Central · South");
  });
  it("shows the weighted branch rate and exact denominator beside bounded percentage bars", () => {
    const base = result.series[0];
    const branch: WidgetResult = { ...result, state: "READY",
      details: { cohortProgress: { groupBy: "branch", rate: 9, eligible: 100, converted: 9, remaining: 91, asOf: result.generatedAt } },
      series: [{ ...base, key: "crm.leads.cohort.by_branch.conversion.rate", label: "Cohort conversion rate by branch", unit: "PERCENT",
        points: [
          { ...base.points[0], key: "alex", label: "Alexandria · North", value: 1.11, meta: { numerator: 1, denominator: 90 } },
          { ...base.points[0], key: "cairo", label: "Cairo · South", value: 80, meta: { numerator: 8, denominator: 10 } },
        ] }],
    };
    const preview = render(<WidgetPreview visualizationType="BAR" result={branch} />);
    expect(screen.getByTestId("plot")).toHaveAttribute("data-axes", JSON.stringify({ LEFT: { integers: false, domain: [0, 100] } }));
    expect(screen.getByRole("columnheader", { name: en.crmDashboards.cohortEligible })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "90" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "8" })).toBeInTheDocument();
    expect(screen.getByText(en.crmDashboards.cohortOverallRate)).toHaveTextContent("9%");
    preview.unmount();
    render(<WidgetTile widget={{ ...widget, visualizationType: "BAR", displaySpec: {} }}
      result={branch} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText(en.crmDashboards.cohortOverallRate)).toHaveTextContent("9%");
  });
  it("shows both cohort count bars and one percentage line without duplicate evidence columns", () => {
    const base = result.series[0];
    const point = { ...base.points[0], meta: { numerator: 2, denominator: 3 } };
    render(<WidgetPreview visualizationType="COMBO" result={{ ...result,
      details: { sourceCohort: { asOf: "2026-11-03T00:00:00Z" } },
      series: [
        { ...base, key: "crm.leads.cohort.by_source.eligible.count", label: "Eligible", points: [{ ...point, value: 3 }] },
        { ...base, key: "crm.leads.cohort.by_source.converted.count", label: "Converted", points: [{ ...point, value: 2 }] },
        { ...base, key: "crm.leads.cohort.by_source.conversion.rate", label: "Rate", unit: "PERCENT", axis: "RIGHT", points: [{ ...point, value: 66.67 }] },
      ],
    }} />);
    expect(screen.getByTestId("plot")).toHaveAttribute("data-kinds", "bar,bar,line");
    expect(JSON.parse(screen.getByTestId("plot").getAttribute("data-axes") ?? "{}")).toEqual({
      LEFT: { integers: true }, RIGHT: { integers: false, domain: [0, 100] },
    });
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getByRole("cell", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
  });
  it("localizes monthly display while preserving the canonical bucket key", () => {
    const base = result.series[0];
    const key = "2026-07-01";
    const monthly = localizeWidgetResult({ ...result, shape: "TIME_SERIES", series: [
      { ...base, points: [{ ...base.points[0], key, label: key }] },
    ] }, null, "en", { dimension: { key: "time", grain: "MONTH" }, series: [{ metricKey: base.key }] });
    expect(monthly.series[0].points[0]).toMatchObject({ key, label: "Jul 2026" });
  });
  it("shows selected period dates and signed differences without filling unmatched dataset buckets", () => {
    const base = result.series[0];
    const aligned = { ...result, shape: "TIME_SERIES" as const, series: [
      { ...base, key: "dataset-1", points: [{ ...base.points[0], key: "P1", value: 5, meta: { datasetPoint: { sourceKey: "2026-07-01", complete: true } } },
        { ...base.points[0], key: "P2", value: null, meta: { datasetPoint: { reason: "UNMATCHED_TAIL" } } }] },
      { ...base, key: "dataset-2", points: [{ ...base.points[0], key: "P1", value: 0, meta: { datasetPoint: { sourceKey: "2026-08-01", complete: true, absoluteChange: -5 } } },
        { ...base.points[0], key: "P2", value: 1, meta: { datasetPoint: { sourceKey: "2026-09-01", complete: false } } }] },
    ], details: { datasetComparison: { basis: "PERIOD", grain: "MONTH", timeZone: "Africa/Cairo", asOf: "2026-11-03T00:00:00Z", entries: [
      { key: "dataset-1", label: "Baseline", state: "READY", total: 5, window: { from: "2026-07-01", to: "2026-07-31" } },
      { key: "dataset-2", label: "Second period", state: "READY", total: 1, window: { from: "2026-08-01", to: "2026-09-30" } },
    ] } } };
    render(<WidgetPreview result={aligned} visualizationType="COLUMN" querySpec={{ series: [{ metricKey: "crm.leads.converted.trend" }], comparison: { type: "DATASETS" } }} />);
    expect(screen.getByText(en.crmDashboards.datasets.observedAt)).toBeInTheDocument();
    expect(screen.getByTestId("plot")).toHaveAttribute("data-rows", JSON.stringify([
      { label: "Month 1", "dataset-1": 5, "dataset-2": 0 }, { label: "Month 2", "dataset-1": null, "dataset-2": 1 },
    ]));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("2026-07-01");
    expect(table).toHaveTextContent(/[-−]5/);
    expect(table).toHaveTextContent(en.crmDashboards.datasets.unmatched);
    expect(table).toHaveTextContent(en.crmDashboards.datasets.partial);
  });

  it("renders maturity counts, true zero, and reasons for missing age horizons in preview and the exact table", () => {
    const base = result.series[0];
    const month = "2026-10-01";
    const series = [7, 14, 30].map((days) => ({ ...base, key: `maturity:D${days}`, label: `D${days}`, unit: "PERCENT" as const,
      points: [{ ...base.points[0], key: month, label: month, value: days === 7 ? 0 : null, meta: { cohortMaturity: {
        days, numerator: days === 7 ? 0 : null, denominator: 3, reason: days === 7 ? null : "AGE_NOT_REACHED", matureAt: "2026-11-15T00:00:00Z",
      } } }, { ...base.points[0], key: "2026-09-01", label: "2026-09-01", value: 100, meta: { cohortMaturity: {
        days, numerator: 2, denominator: 2, reason: null, matureAt: "2026-10-31T00:00:00Z",
      } } }],
    }));
    const maturity: WidgetResult = { ...result, state: "READY", series, details: { cohortMaturity: {
      populationBasis: "LIVE_CURRENT_SCOPE", asOf: "2026-11-09T00:00:00Z", timeZone: "Africa/Cairo",
      d30: { cohorts: 0, numerator: 0, denominator: 0, rate: null },
    } } };
    render(<WidgetPreview result={maturity} visualizationType="HEATMAP" querySpec={{ dimension: { key: "cohort_month" }, series: [{ metricKey: "maturity" }] }} />);
    expect(screen.getByText(en.crmDashboards.maturity.cohorts)).toBeInTheDocument();
    expect(screen.getByTitle(/Oct 2026 · D7: 0% · 0 \/ 3/)).toBeInTheDocument();
    expect(screen.getByTitle(/Oct 2026 · D30: — · Cohort age has not been reached/)).toBeInTheDocument();
    expect(screen.getByTitle(/Sep 2026 · D30: 100%/).querySelector(".text-primary-foreground")).toHaveTextContent("100%");
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent(en.crmDashboards.maturity.eligible);
    expect(table).toHaveTextContent(en.crmDashboards.maturity.reasons.AGE_NOT_REACHED);
    expect(table).toHaveTextContent("0%");
    expect(table.querySelector('td [aria-hidden="true"]')).toHaveTextContent("—");
  });
  it("passes format, explicit series color, points and value labels and positions a real legend", () => {
    const { container } = render(<WidgetChart mode="LINE" visualizationType="LINE" result={result} label="Chart" querySpec={widget.querySpec} displaySpec={widget.displaySpec} />);
    expect(screen.getByTestId("plot")).toHaveAttribute("data-color", "#123456");
    expect(screen.getByTestId("plot")).toHaveAttribute("data-points", "true");
    expect(screen.getByTestId("plot")).toHaveAttribute("data-values", "true");
    expect(screen.getByTestId("plot")).toHaveTextContent("12.5K");
    expect(screen.getByRole("list")).toHaveTextContent("Created leads");
    expect(container.querySelector('[data-legend-position="top"]')).not.toBeNull();
  });
  it("hides the legend when requested and keeps full formatting", () => {
    render(<WidgetChart mode="LINE" result={result} label="Chart" displaySpec={{ numberFormat: "full", legendPosition: "none" }} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByTestId("plot")).toHaveTextContent("12,500");
  });
  it("formats a donut total, honors value labels and uses the requested legend placement", () => {
    const { container } = render(<WidgetChart mode="DONUT" visualizationType="DONUT" result={result} label="Chart" querySpec={widget.querySpec} displaySpec={{ ...widget.displaySpec, legendPosition: "end" }} />);
    expect(screen.getByTestId("donut")).toHaveTextContent("12.5K");
    expect(screen.getByTestId("donut")).toHaveAttribute("data-values", "true");
    expect(screen.getByTestId("donut")).toHaveAttribute("data-legend", "false");
    expect(container.querySelector('[data-legend-position="end"]')).not.toBeNull();
  });
  it("formats gauge values and target and suppresses the change badge", () => {
    const { container } = render(<WidgetChart mode="GAUGE" visualizationType="CIRCULAR_PROGRESS_GAUGE" result={{ ...result, value: 12500, target: 25000 }} label="Target" displaySpec={{ numberFormat: "compact", color: "#123456", targetColor: "#abcdef", options: { showDelta: false } }} />);
    expect(screen.getByText("12.5K")).toBeInTheDocument();
    expect(screen.getByText(en.crmDashboards.targetOf.replace("{target}", "25K"))).toHaveStyle({ color: "#abcdef" });
    expect(container.querySelector('circle[stroke="#123456"]')).not.toBeNull();
    expect(screen.queryByText("50%")).toBeNull();
  });
  it("shows title/subtitle in tiles and preview while keeping full table values", () => {
    const first = render(<WidgetTile widget={widget} result={result} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Sales overview" })).toBeInTheDocument();
    expect(screen.getByText("This quarter")).toBeInTheDocument();
    expect(first.container.querySelector('[aria-hidden="true"][style]')).toHaveStyle({ backgroundColor: "#abcdef" });
    first.unmount();
    render(<WidgetPreview result={result} visualizationType="LINE" displaySpec={widget.displaySpec} querySpec={widget.querySpec} name={widget.name} />);
    expect(screen.getByRole("heading", { name: "Sales overview" })).toBeInTheDocument();
    expect(screen.getByText("This quarter")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("12,500");
  });
  it("honors scalar hide-change and target color", () => {
    render(<WidgetTile widget={{ ...widget, visualizationType: "METRIC_CARD", displaySpec: { targetColor: "#123456", numberFormat: "compact", options: { showDelta: false } } }} result={{ ...result, shape: "SCALAR", value: 12500, previousValue: 100, target: 25000, series: [] }} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText("12.5K")).toBeInTheDocument();
    expect(screen.queryByText(/\(100\)/)).toBeNull();
    expect(screen.getByText(en.crmDashboards.targetOf.replace("{target}", "25K"))).toHaveStyle({ color: "#123456" });
  });
  it("explains unavailable saved styles on a real mixed-axis table fallback", () => {
    render(<WidgetTile widget={widget} result={{ ...result, series: [result.series[0],
      { ...result.series[0], key: "money", unit: "MONEY", axis: "RIGHT" },
      { ...result.series[0], key: "score", unit: "SCORE", axis: "RIGHT" },
    ] }} placementId="placement" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.queryByTestId("plot")).toBeNull();
    expect(screen.getByText(en.crmWidgets.review.tableFallback)).toBeInTheDocument();
    expect(screen.getByText(/Saved settings unavailable/)).toHaveTextContent("Legend position");
    expect(screen.getByRole("table")).toHaveTextContent("12,500");
  });
});
