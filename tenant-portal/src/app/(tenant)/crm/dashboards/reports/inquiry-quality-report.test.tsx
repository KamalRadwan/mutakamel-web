// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartesianChartProps } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { LEAD_CURRENT_RATING_MIX, LEAD_INQUIRY_CLASSIFICATION, LEAD_MISSING_SOURCE_SHARE } from "../widget-acquisition-quality";
import { parseWidgetResult } from "../dashboard-run-contract";
import { WidgetPreview } from "../../widgets/components/WidgetPreview";
import { InquiryQualityReport } from "./components/InquiryQualityReport";
import { INQUIRY_QUALITY_REPORT_PATH, parseInquiryQualityReport } from "./inquiry-quality-report-contract";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" },
  useLanguage: () => locale.lang,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/lib/api/axiosClient", async original => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post: vi.fn() },
}));
vi.mock("@/app/(tenant)/core/hooks/useCoreOptions", () => ({
  useOrgNodeOptions: (_type: string, options: { enabled: boolean }) => {
    expect(options.enabled).toBe(false);
    return { options: [], error: null, retry: vi.fn() };
  },
}));
vi.mock("@/design-system", async original => ({
  ...await original<typeof import("@/design-system")>(),
  BarChart: ({ label, summary, horizontal, data }: CartesianChartProps) => <div role="img" aria-label={label}
    data-horizontal={horizontal} data-labels={data.map(row => row.label).join("|")}>{summary}</div>,
}));

const branchId = "018f0000-0000-7000-8000-000000000001";
const companyId = "018f0000-0000-7000-8000-000000000011";
const selection = { branchId: null, datePreset: null, compare: null, currencyCode: null };
const generatedAt = "2026-12-18T12:00:00.000Z";
const period = { from: "2026-11-01", to: "2026-11-30", timeZone: "Africa/Cairo" };
const categories = [
  ["FIRST_OBSERVED", "First observed inquiry", "أول استفسار مرصود", 46],
  ["REPEAT_OBSERVED", "Repeat inquiry", "استفسار متكرر", 24],
  ["AWAITING_REVIEW", "Awaiting review", "بانتظار المراجعة", 6],
  ["BEFORE_COVERAGE", "Before observation began", "قبل بدء الرصد", 4],
] as const;
const point = ([key, label, labelAr, value]: readonly [string, string, string, number], total: number) => ({
  key, label, value, meta: { labelAr, numerator: value, denominator: total, sharePercent: Number((100 * value / total).toFixed(2)) },
});

function receipt(classifiedTotal = 80, partialAccess = false) {
  const classification = "inquiry-classification";
  const missing = "missing-source-share";
  const rating = "current-rating-mix";
  const evidence = { total: classifiedTotal, classified: 70, coverageStartedAt: "2026-11-11T00:00:00.000Z",
    populationBasis: "CREATED_IN_PERIOD", identityBasis: "CURRENT_APPROVED_OBSERVED_HISTORY", tiePolicy: "FIRST_AT_SAME_INSTANT" };
  const categoryPoints = categories.map((row, index) => point(index === 3
    ? [row[0], row[1], row[2], row[3] + classifiedTotal - 80] : row, classifiedTotal));
  const ratingPoints = [10, 20, 30, 20].map((value, index) => point([
    String(index), ["Unrated", "1 star", "2 stars", "3 stars"][index],
    ["غير مُقيّم", "نجمة واحدة", "نجمتان", "ثلاث نجوم"][index], value,
  ], 80));
  const meta = { generatedAt, warnings: [], effectivePeriod: period };
  const series = (key: string, points: unknown[], unit = "COUNT") => [{ key, label: key, unit, axis: "LEFT", points }];
  return {
    reportKey: "LEAD_ACQUISITION_QUALITY", generatedAt,
    filters: { datePreset: "LAST_MONTH", dateFrom: period.from, dateTo: period.to, timeZone: period.timeZone },
    scope: [{ branchId, scope: "all" }],
    organizationScope: { branchId: null, companyId: null, partialAccess: false,
      branches: [{ id: branchId, name: "Cairo", companyId, companyName: "Northstar" }], companies: [{ id: companyId, name: "Northstar" }] },
    populationScope: { state: "READY", teamIds: [], ownerUserIds: [], teams: [], owners: [] },
    panels: [
      [missing, "PROGRESS_CARD", LEAD_MISSING_SOURCE_SHARE, "none", "Missing source", "استفسارات بلا مصدر"],
      [rating, "STACKED_BAR", LEAD_CURRENT_RATING_MIX, "lead_rating", "Current rating", "التقييم الحالي"],
      [classification, "COLUMN", LEAD_INQUIRY_CLASSIFICATION, "inquiry_classification", "First and repeat inquiries", "الاستفسار الأول والمتكرر"],
    ].map(([key, visualizationType, metricKey, dimension, nameEn, nameAr]) => ({ key, visualizationType, nameEn, nameAr,
      displaySpec: {}, querySpec: { series: [{ metricKey }], dimension: { key: dimension }, comparison: { type: "NONE" } } })),
    widgets: {
      [missing]: { widgetId: missing, state: "READY", shape: "SCALAR", value: 5, meta: { ...meta, unit: "PERCENT" },
        series: series(LEAD_MISSING_SOURCE_SHARE, [{ key: "0", label: "Share", value: 5 }], "PERCENT"),
        details: { populationShare: { numerator: 4, denominator: 80, sharePercent: 5, populationBasis: "CREATED_IN_PERIOD", attributionBasis: "CURRENT_SOURCE" } } },
      [rating]: { widgetId: rating, state: "READY", shape: "CATEGORY", meta: { ...meta, unit: "COUNT" }, series: series(LEAD_CURRENT_RATING_MIX, ratingPoints),
        details: { currentRatingMix: { total: 80, populationBasis: "CREATED_IN_PERIOD", ratingBasis: "CURRENT_RATING", minRating: 0, maxRating: 3 } } },
      [classification]: { widgetId: classification, state: "READY", shape: "CATEGORY", meta: { ...meta, unit: "COUNT", partialAccess },
        series: [{ key: LEAD_INQUIRY_CLASSIFICATION, label: "Classification", unit: "COUNT", axis: "LEFT", points: categoryPoints }],
        details: { inquiryClassification: evidence } },
    },
  };
}

const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.mocked(axiosClient.post).mockReset(); locale.lang = "en"; });

describe("inquiry quality report", () => {
  it("reconciles panel counts, the authorized period and narrower classification coverage", () => {
    expect(parseInquiryQualityReport(receipt(), selection).panels).toHaveLength(3);
    expect(parseInquiryQualityReport(receipt(77, true), selection).panels[2].result.partialAccess).toBe(true);
    expect(() => parseInquiryQualityReport(receipt(77), selection)).toThrow();
    expect(() => parseInquiryQualityReport(receipt(81, true), selection)).toThrow();
    expect(() => parseInquiryQualityReport(receipt(), { ...selection, branchId })).toThrow();
    const wrongPeriod = receipt();
    wrongPeriod.widgets["current-rating-mix"].meta.effectivePeriod = { ...period, from: "2026-11-02" };
    expect(() => parseInquiryQualityReport(wrongPeriod, selection)).toThrow();
    const custom = { ...selection, datePreset: "CUSTOM" as const, dateFrom: period.from, dateTo: period.to };
    const customReply = receipt();
    customReply.filters.datePreset = "CUSTOM";
    expect(parseInquiryQualityReport(customReply, custom).panels).toHaveLength(3);
    expect(() => parseInquiryQualityReport(customReply, { ...custom, dateFrom: "2026-11-02" })).toThrow();
  });

  it("rejects reordered groups, inconsistent classification shares and future coverage", () => {
    const ordered = receipt();
    ordered.widgets["inquiry-classification"].series[0].points.reverse();
    expect(() => parseInquiryQualityReport(ordered, selection)).toThrow();
    const inconsistent = receipt();
    inconsistent.widgets["inquiry-classification"].series[0].points[0].meta.sharePercent = 58;
    expect(() => parseInquiryQualityReport(inconsistent, selection)).toThrow();
    const future = receipt();
    future.widgets["inquiry-classification"].details.inquiryClassification.coverageStartedAt = "2026-12-19T00:00:00Z";
    expect(() => parseInquiryQualityReport(future, selection)).toThrow();
  });

  it.each(["en", "ar"])("renders the exact classification table and count chart in %s", async lang => {
    locale.lang = lang;
    const copy = lang === "ar" ? ar : en;
    vi.mocked(axiosClient.post).mockResolvedValue(ok(receipt()));
    render(<InquiryQualityReport />);
    const label = lang === "ar" ? "الاستفسار الأول والمتكرر" : "First and repeat inquiries";
    const heading = await screen.findByRole("heading", { name: label });
    const panel = within(heading.closest("article")!);
    const table = panel.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByText(categories[0][lang === "ar" ? 2 : 1])).toBeInTheDocument();
    expect(table).toHaveTextContent("80");
    expect(panel.getByRole("img", { name: label })).toHaveTextContent("46");
    expect(panel.getByRole("img", { name: label })).toHaveAttribute("data-horizontal", "false");
    fireEvent.click(screen.getByRole("button", { name: copy.crmDashboardReports.acquisition.explain }));
    expect(screen.getByText(copy.crmDashboardReports.inquiryQuality.tie)).toBeVisible();
    expect(vi.mocked(axiosClient.post).mock.calls[0][0]).toBe(INQUIRY_QUALITY_REPORT_PATH);
  });

  it("shows the two available panels when the classification source is unavailable", async () => {
    const reply = receipt();
    vi.mocked(axiosClient.post).mockResolvedValue(ok({ ...reply, widgets: { ...reply.widgets, "inquiry-classification": {
      widgetId: "inquiry-classification", state: "UNAVAILABLE", shape: "CATEGORY", series: [],
      meta: { generatedAt, unit: "COUNT", warnings: [] }, error: { code: "CRM_INQUIRY_SOURCE_NOT_READY" },
    } } }));
    render(<InquiryQualityReport />);
    expect(await screen.findByText(en.crmDashboards.errors.CRM_INQUIRY_SOURCE_NOT_READY)).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Missing source" })).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByRole("img", { name: "Current rating" })).toBeVisible();
    expect(screen.queryByRole("img", { name: "First and repeat inquiries" })).toBeNull();
  });

  it.each(["BAR", "COLUMN", "TABLE"] as const)("uses the same classification evidence in a standalone %s widget", visualizationType => {
    const result = parseWidgetResult(receipt().widgets["inquiry-classification"]);
    render(<WidgetPreview result={result} visualizationType={visualizationType} name="Inquiry classification" />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(table).toHaveTextContent("46");
    expect(table).toHaveTextContent("80");
    if (visualizationType === "TABLE") expect(screen.queryByRole("img")).toBeNull();
    else expect(screen.getByRole("img", { name: "Inquiry classification" })).toHaveAttribute(
      "data-horizontal", String(visualizationType === "BAR"),
    );
  });

  it("keeps early empty population receipts empty", () => {
    const reply = receipt();
    const widgets = Object.fromEntries(Object.entries(reply.widgets).map(([key, widget]) => [key, {
      widgetId: key, state: "EMPTY", shape: widget.shape, series: [],
      meta: { generatedAt, unit: widget.meta.unit, warnings: ["NO_DATA"] },
    }]));
    expect(parseInquiryQualityReport({ ...reply, widgets }, selection).panels.every(panel => panel.result.state === "EMPTY")).toBe(true);
  });

  it("shortens axis labels on narrow tiles while keeping the full names and counts", () => {
    let resize: (width: number) => void = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) {
        resize = width => callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      observe() {}
      disconnect() {}
    });
    const result = parseWidgetResult(receipt().widgets["inquiry-classification"]);
    render(<WidgetPreview result={result} visualizationType="COLUMN" name="Inquiry classification" />);
    const chart = screen.getByRole("img", { name: "Inquiry classification" });
    expect(chart).toHaveAttribute("data-labels", "First observed inquiry|Repeat inquiry|Awaiting review|Before observation began");
    act(() => resize(330));
    expect(chart).toHaveAttribute("data-labels", "First|Repeat|Pending|Before");
    expect(chart).toHaveTextContent("First observed inquiry: 46");
    expect(within(screen.getByRole("table")).getByText("Before observation began")).toBeVisible();
  });
});
