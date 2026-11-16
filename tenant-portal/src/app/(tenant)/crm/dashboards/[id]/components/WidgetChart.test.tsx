// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { parseWidgetResult, type WidgetResult, type WidgetSeries } from "../../dashboard-run-contract";
import { WidgetChart } from "./WidgetChart";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", get: vi.fn() }));

const DICT_BY_LANG = { en, ar } as const;

vi.mock("recharts", () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    BarChart: ({ data, children }: { data: Array<{ label: string }>; children?: ReactNode }) =>
      <div>{data.map((bin, index) => <span key={index}>{bin.label}</span>)}{children}</div>,
    Bar: Slot, CartesianGrid: Slot, Cell: () => null, LabelList: () => null,
    ResponsiveContainer: Slot, Scatter: ({ data }: { data: unknown }) => <div data-testid="scatter-points">{JSON.stringify(data)}</div>, ScatterChart: Slot,
    Tooltip: () => null, XAxis: () => null, YAxis: () => null, ZAxis: () => null,
  };
});

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: DICT_BY_LANG[state.lang], lang: state.lang }),
}));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: state.get } }));
vi.mock("@/design-system", () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    AreaChart: Slot, ComposedChart: Slot, Badge: Slot, BarChart: ({ data }: { data: Array<{ label: string }> }) => <div>{data.map((row, index) => <span key={index}>{row.label}</span>)}</div>, Button: Slot,
    DonutChart: Slot, LineChart: Slot, Progress: Slot,
    TargetGaugeChart: ({ valueLabel }: { valueLabel: string }) => <span>{valueLabel}</span>,
    ScatterPlotChart: ({ points }: { points: unknown }) => <div data-testid="scatter-points">{JSON.stringify(points)}</div>,
    MatrixHeatmapChart: ({ rows, cells, rowEvidence }: { rows: string[]; cells: Array<Array<{ label: string; formatted: string } | null>>; rowEvidence?: { values: string[] } }) => <div>{rows.map((row, index) => <div key={index}>{row}{cells[index]?.map((cell, cellIndex) => cell && <span key={cellIndex} title={`${cell.label}: ${cell.formatted}`}>{cell.formatted}</span>)}{rowEvidence && <span>{rowEvidence.values[index]}</span>}</div>)}</div>,
    DateTime: ({ value }: { value: string }) => <time>{value}</time>,
    Money: ({ value, currency }: { value: string; currency: string }) => <span>{value} {currency}</span>,
    swatchSurfacePalette: () => ({
      accentBorder: "", iconBoxIdle: "", badge: "", dot: "",
    }),
    topNWithOther: vi.fn(),
  };
});

function result(overrides: Partial<WidgetResult> = {}): WidgetResult {
  return {
    widgetId: "01900300-0000-7000-8000-000000000001",
    shape: "ROWS", value: null, previousValue: null, target: null,
    series: [], rows: [], typedResult: null, unit: null, currency: null,
    generatedAt: "2026-10-17T09:00:00Z", warnings: [], errorCode: null,
    ...overrides,
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("dashboard widget result boundary", () => {
  it("renders executor XY probability/amount/age without swapping axes or inventing bubble size", () => {
    const xy = parseWidgetResult({ widgetId: "preview", state: "READY", shape: "XY",
      series: [{ key: "crm.opportunities.value_probability", unit: "MONEY", currency: "EGP", points: [
        { key: "o1", label: "Deal 1", value: 75, secondaryValue: 50000, size: 30 },
        { key: "o2", label: "Missing coordinate", value: null, secondaryValue: 100, size: 12 },
      ] }], meta: { unit: "MONEY", generatedAt: "2026-11-05T09:00:00Z", warnings: [] } });
    render(<WidgetChart mode="SCATTER" visualizationType="BUBBLE" result={xy} label="Deals" />);
    expect(JSON.parse(screen.getByTestId("scatter-points").textContent ?? "[]")).toEqual([
      expect.objectContaining({ key: "o1", x: 75, y: 50000, z: 30 }),
    ]);
    expect(screen.queryByText("Missing coordinate")).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders scoped alert rows without enrichment requests in %s", async (lang) => {
    state.lang = lang;
    render(<WidgetChart mode="ALERT_LIST" label="Alerts" result={result({
      rows: [{ id: "other-alert", title: "Unselected fallback row" }],
      typedResult: { rows: [{
        id: "alert-1", title: "Scoped alert title", severity: "critical".toUpperCase(),
        entityRef: { type: "OPPORTUNITY", id: "opportunity-1" },
        occurredAt: "2026-10-17T08:00:00Z",
      }] },
    })} />);
    await act(async () => {});

    expect(screen.getByText("Scoped alert title")).toBeTruthy();
    expect(screen.getByText("2026-10-17T08:00:00Z")).toBeTruthy();
    expect(screen.queryByText("Unselected fallback row")).toBeNull();
    expect(screen.getByText(DICT_BY_LANG[lang].crmDashboards.severityCritical)).toBeTruthy();
    expect(screen.getByText(DICT_BY_LANG[lang].crmDashboards.unknownEntityType)).toBeTruthy();
    expect(screen.queryByText("critical".toUpperCase())).toBeNull();
    expect(screen.queryByText("OPPORTUNITY")).toBeNull();
    expect(state.get).not.toHaveBeenCalled();
  });

  it("uses result rows when a typed alert result is absent", async () => {
    render(<WidgetChart mode="ALERT_LIST" label="Alerts" result={result({
      rows: [{ id: "alert-1", title: "Fallback result title", severity: "WARNING" }],
    })} />);
    await act(async () => {});

    expect(screen.getByText("Fallback result title")).toBeTruthy();
    expect(state.get).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)("uses the current activity title and description without enrichment in %s", async (lang) => {
    state.lang = lang;
    const { rerender } = render(<WidgetChart mode="ACTIVITY_FEED" label="Activity" result={result({
      shape: "EVENT_STREAM",
      typedResult: { events: [{
        id: "activity:activity-1", kind: "CALL", title: "First scoped activity",
        description: "Scoped description", severity: "INFO", occurredAt: "2026-10-17T08:00:00Z",
        entityRef: { type: "ACTIVITY", id: "activity-1" },
      }] },
    })} />);
    await act(async () => {});
    expect(screen.getByText("First scoped activity")).toBeTruthy();
    expect(screen.getByText("Scoped description")).toBeTruthy();

    rerender(<WidgetChart mode="ACTIVITY_FEED" label="Activity" result={result({
      shape: "EVENT_STREAM",
      typedResult: { events: [{
        id: "activity:activity-1", kind: "CALL", title: "Next scoped activity",
        severity: "SUCCESS", entityRef: { type: "ACTIVITY", id: "activity-1" },
      }] },
    })} />);
    await act(async () => {});

    expect(screen.getByText("Next scoped activity")).toBeTruthy();
    expect(screen.queryByText("First scoped activity")).toBeNull();
    expect(screen.queryByText("Scoped description")).toBeNull();
    expect(state.get).not.toHaveBeenCalled();
  });
});

describe("dashboard chart label localization", () => {
  it.each(["en", "ar"] as const)("translates warning severity and hides unknown alert codes in %s", (lang) => {
    state.lang = lang;
    const t = DICT_BY_LANG[lang].crmDashboards;
    render(<WidgetChart mode="ALERT_LIST" label="Alerts" result={result({
      rows: [{ title: "Alert", severity: "WARNING", reasonCode: "UNRECOGNIZED_REASON",
        entityRef: { type: "UNRECOGNIZED_ENTITY" } }],
    })} />);
    expect(screen.getByText(t.severityWarning)).toBeTruthy();
    expect(screen.getByText(t.unknownAlertReason)).toBeTruthy();
    expect(screen.getByText(t.unknownEntityType)).toBeTruthy();
    expect(screen.queryByText(/WARNING|UNRECOGNIZED_/)).toBeNull();
  });

  it.each(["en", "ar"] as const)("translates known alert reasons in %s", (lang) => {
    state.lang = lang;
    render(<WidgetChart mode="ALERT_LIST" label="Alerts" result={result({
      rows: [{ title: "Alert", reasonCode: "MISSING_AMOUNT" }],
    })} />);
    expect(screen.getByText(DICT_BY_LANG[lang].crmDashboardReports.statusValues.MISSING_AMOUNT)).toBeTruthy();
    expect(screen.queryByText("MISSING_AMOUNT")).toBeNull();
  });

  it.each(["en", "ar"] as const)("translates activity types and presents the last run without a live badge in %s", (lang) => {
    state.lang = lang;
    render(<WidgetChart mode="ACTIVITY_FEED" label="Activity" result={result({
      typedResult: { events: [{ id: "known", kind: "CALL", title: "Known event" },
        { id: "unknown", kind: "UNRECOGNIZED_EVENT", title: "Unknown event" }] },
    })} />);
    expect(screen.getByText(DICT_BY_LANG[lang].crmDashboardReports.statusValues.CALL)).toBeTruthy();
    expect(screen.getByText(DICT_BY_LANG[lang].crmDashboards.unknownActivityType)).toBeTruthy();
    expect(screen.queryByText(/CALL|UNRECOGNIZED_EVENT/)).toBeNull();
    expect(screen.queryByText(/real.time/i)).toBeNull();
  });

  it.each(["en", "ar"] as const)("keeps actual histogram bin labels and refuses malformed numeric bins in %s", (lang) => {
    state.lang = lang;
    render(<WidgetChart mode="HISTOGRAM" label="Distribution" result={result({
      typedResult: { totalCount: 8, bins: [{ key: "b1", label: "Low range", order: 0, kind: "STANDARD", count: 3 }, { key: "b2", label: "Supplied range", order: 1, kind: "OVERFLOW", count: 5 }] },
    })} />);
    expect(screen.getByText("Low range")).toBeTruthy();
    expect(screen.getByText("Supplied range")).toBeTruthy();
  });

  it.each(["en", "ar"] as const)("translates unclamped target attainment in %s", (lang) => {
    state.lang = lang;
    const { container } = render(<WidgetChart mode="GAUGE" visualizationType="PROGRESS_CARD"
      label="Target" result={result({ value: 125, target: 100, unit: "PERCENT" })} />);
    const template = DICT_BY_LANG[lang].crmDashboards.targetAttainment;
    const [prefix, suffix] = template.split("{value}");
    expect(container.textContent).toContain(prefix);
    expect(container.textContent).toContain(suffix);
    expect(container.textContent).toContain("125");
  });

  it.each(["en", "ar"] as const)("translates heatmap weekday labels and tooltips in %s", (lang) => {
    state.lang = lang;
    const { container } = render(<WidgetChart mode="HEATMAP" label="Activity heatmap" result={result({
      series: ["one", "two"].map<WidgetSeries>((key) => ({ key, label: key, unit: "COUNT", axis: "LEFT",
        currency: null, points: [{ key: "sun", label: "Sun", value: 5,
          secondaryValue: null, start: null, end: null, meta: {} }] })),
    })} />);
    const day = DICT_BY_LANG[lang].crmDashboards.weekdays.Sun;
    expect(screen.getByText(day)).toBeTruthy();
    expect(container.querySelector('[title]')?.getAttribute("title")).toBe(`${day} · one: 5`);
  });

  it.each(["en", "ar"] as const)("renders lead arrival bands and exact totals in %s", (lang) => {
    state.lang = lang;
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const metricKey = "crm.leads.created.by_weekday_hour.count";
    const series = ["00–05", "06–11", "12–17", "18–23"].map<WidgetSeries>((band, index) => ({
      key: `${metricKey}:${band}`, label: band, unit: "COUNT", axis: "LEFT", currency: null,
      points: days.map((day, dayIndex) => ({ key: `weekday-${dayIndex + 1}`, label: day,
        value: day === "Sat" ? index + 1 : 0, secondaryValue: null, start: null, end: null, meta: {} })),
    }));
    const copy = DICT_BY_LANG[lang].crmDashboards;
    const { container } = render(<WidgetChart mode="HEATMAP" label="Lead arrivals"
      result={result({ shape: "CATEGORY", series })}
      querySpec={{ dimension: { key: "lead_arrival_slot" }, series: [{ metricKey }] }} />);
    expect(container.querySelector("[title]")?.getAttribute("title")).toBe(`${copy.weekdays.Sat} · 00–05: 1`);
    expect(screen.getAllByText("10")).toHaveLength(2);
    expect(screen.getByText(copy.leadArrivalTotals.all).textContent).toBe(`${copy.leadArrivalTotals.all}10`);
  });
});
