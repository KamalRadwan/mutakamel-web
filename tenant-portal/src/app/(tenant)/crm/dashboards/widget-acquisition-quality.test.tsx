// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartesianChartProps } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { parseWidgetResult } from "./dashboard-run-contract";
import { LEAD_CURRENT_RATING_MIX, LEAD_MISSING_SOURCE_SHARE, readCurrentRatingMix, readMissingSourceShare } from "./widget-acquisition-quality";
import { widgetTableModel } from "./widget-view";
import { localizeWidgetResult } from "./widget-labels";
import { GaugeChartView } from "./[id]/components/WidgetGaugeChart";
import { WidgetAcquisitionQualitySummary, WidgetCurrentRatingChart } from "./[id]/components/WidgetAcquisitionQuality";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" } }));
vi.mock("@/design-system", async original => ({
  ...await original<typeof import("@/design-system")>(),
  BarChart: (props: CartesianChartProps) => <div data-testid="rating-chart" data-horizontal={props.horizontal} data-stacked={props.stacked}>
    {props.series.map(entry => <span key={entry.key}>{entry.label}: {props.data[0][entry.key]}</span>)}
  </div>,
}));

function shareReceipt(numerator = 62, denominator = 1240) {
  const value = denominator ? Number((100 * numerator / denominator).toFixed(2)) : null;
  return parseWidgetResult({ widgetId: "share", state: denominator ? "READY" : "EMPTY", shape: "SCALAR", value,
    series: [{ key: LEAD_MISSING_SOURCE_SHARE, label: "Missing source", unit: "PERCENT", axis: "LEFT", points: [{ key: "0", label: "Share", value }] }],
    details: { populationShare: { numerator, denominator, sharePercent: value, populationBasis: "CREATED_IN_PERIOD", attributionBasis: "CURRENT_SOURCE" } },
    meta: { generatedAt: "2026-11-11T10:00:00Z", unit: "PERCENT", warnings: denominator ? [] : ["NO_DATA"] } });
}
function ratingReceipt(empty = false) {
  return parseWidgetResult({ widgetId: "ratings", state: empty ? "EMPTY" : "READY", shape: "CATEGORY",
    series: [{ key: LEAD_CURRENT_RATING_MIX, label: "Current ratings", unit: "COUNT", axis: "LEFT",
      points: empty ? [] : [2, 0, 3, 5].map((value, index) => ({ key: String(index), label: ["Unrated", "1 star", "2 stars", "3 stars"][index], value,
        meta: { labelAr: ["غير مُقيّم", "نجمة واحدة", "نجمتان", "ثلاث نجوم"][index], numerator: value, denominator: 10, sharePercent: value * 10 } })) }],
    details: { currentRatingMix: { total: empty ? 0 : 10, populationBasis: "CREATED_IN_PERIOD", ratingBasis: "CURRENT_RATING", minRating: 0, maxRating: 3 } },
    meta: { generatedAt: "2026-11-11T10:00:00Z", unit: "COUNT", warnings: empty ? ["NO_DATA"] : [] } });
}
afterEach(() => { cleanup(); locale.lang = "en"; });

describe("Acquisition quality evidence", () => {
  it.each([[62, 1240, 5], [0, 1240, 0], [1240, 1240, 100], [1, 3, 33.33], [0, 0, null]])("reconciles missing-source %s/%s", (numerator, denominator, sharePercent) => {
    expect(readMissingSourceShare(shareReceipt(numerator!, denominator!))).toEqual({ numerator, denominator, sharePercent });
  });
  it("rejects forged shares, counts, states, targets and unavailable receipts", () => {
    const source = shareReceipt();
    for (const broken of [
      { ...source, value: 6 }, { ...source, target: 100 }, { ...source, state: "UNAVAILABLE" as const },
      { ...source, state: "EMPTY" as const }, { ...source, previousValue: 5 }, { ...source, errorCode: "FAILED" },
      { ...source, details: { populationShare: { ...source.details!.populationShare as object, numerator: 1241 } } },
      { ...source, details: { populationShare: { ...source.details!.populationShare as object, attributionBasis: "AT_CREATION" } } },
    ]) expect(readMissingSourceShare(broken)).toBeNull();
  });
  it("reconciles all four current rating groups and exact table totals", () => {
    const source = ratingReceipt();
    expect(readCurrentRatingMix(source)?.rows.map(row => row.count)).toEqual([2, 0, 3, 5]);
    const model = widgetTableModel(source, { label: "Label", value: "Value", acquisitionQuality: en.crmDashboards.acquisitionQuality });
    expect(model.columns).toHaveLength(3);
    expect(model.rows).toHaveLength(5);
    expect(model.rows[0].cells[0]).toEqual({ kind: "text", text: "Unrated" });
    expect(model.rows[4]).toMatchObject({ total: true, cells: [{ text: "Created leads" }, { value: 10 }, { value: 100 }] });
    expect(readCurrentRatingMix(ratingReceipt(true))).toEqual({ total: 0, rows: [] });
  });
  it("rejects omitted/unbalanced categories and invented rating-at-creation semantics", () => {
    const source = ratingReceipt();
    expect(readCurrentRatingMix({ ...source, series: [{ ...source.series[0], points: source.series[0].points.slice(1) }] })).toBeNull();
    expect(readCurrentRatingMix({ ...source, details: { currentRatingMix: { ...source.details!.currentRatingMix as object, total: 11 } } })).toBeNull();
    expect(readCurrentRatingMix({ ...source, details: { currentRatingMix: { ...source.details!.currentRatingMix as object, ratingBasis: "AT_CREATION" } } })).toBeNull();
    expect(readCurrentRatingMix({ ...source, state: "UNAVAILABLE" })).toBeNull();
  });
  it.each(["en", "ar"])("renders a measured zero share without target attainment in %s", lang => {
    locale.lang = lang;
    const result = shareReceipt(0, 1240);
    render(<><WidgetAcquisitionQualitySummary result={result} /><GaugeChartView visualizationType="PROGRESS_CARD" result={result} label="Missing source" /></>);
    expect(screen.getByRole("progressbar", { name: "Missing source" }).getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("1,240");
    expect(screen.queryByText(en.crmDashboards.targetUnavailable)).toBeNull();
    const model = widgetTableModel(result, { label: "Label", value: "Value", acquisitionQuality: en.crmDashboards.acquisitionQuality });
    expect(model.rows.map(row => row.cells[1])).toEqual([{ kind: "number", value: 0 }, { kind: "number", value: 1240 }]);
  });
  it("does not turn a missing denominator into zero progress", () => {
    render(<GaugeChartView visualizationType="PROGRESS_CARD" result={shareReceipt(0, 0)} label="Missing source" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(en.crmDashboards.noData)).toBeTruthy();
  });
  it("retains target requirements for ordinary gauges", () => {
    const source = shareReceipt();
    render(<GaugeChartView visualizationType="BULLET" result={source} label="Target" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(en.crmDashboards.targetUnavailable)).toBeTruthy();
  });
  it.each(["en", "ar"])("renders one stacked cohort bar with unrated and zero-count groups in %s", lang => {
    locale.lang = lang;
    const result = localizeWidgetResult(ratingReceipt(), null, lang as "en" | "ar");
    render(<WidgetCurrentRatingChart result={result} label="Current ratings" displaySpec={{}} />);
    expect(screen.getByTestId("rating-chart").getAttribute("data-stacked")).toBe("true");
    expect(screen.getByTestId("rating-chart").getAttribute("data-horizontal")).toBe("true");
    expect(screen.getByText(lang === "ar" ? "غير مُقيّم: 2" : "Unrated: 2")).toBeTruthy();
    expect(screen.getByText(lang === "ar" ? "نجمة واحدة: 0" : "1 star: 0")).toBeTruthy();
  });
});
