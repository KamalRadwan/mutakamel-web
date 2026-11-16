// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DonutChartProps } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseWidgetResult } from "../dashboard-run-contract";
import { widgetTableModel } from "../widget-view";
import { readSourceMix } from "../widget-source-mix";
import { LeadSourceMixReport } from "./components/LeadSourceMixReport";
import { LEAD_SOURCE_MIX_REPORT_PATH, parseLeadSourceMixReport } from "./lead-source-mix-contract";
import { WidgetPreview } from "../../widgets/components/WidgetPreview";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" },
  useLanguage: () => locale.lang,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/lib/api/axiosClient", async original => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post: vi.fn() },
}));
vi.mock("@/design-system", async original => ({
  ...await original<typeof import("@/design-system")>(),
  DonutChart: (props: DonutChartProps) => <div data-testid="mix-chart" data-variant={props.variant}>
    {props.slices.map(slice => <span key={slice.key}>{slice.label} {props.valueFormatter?.(slice.value)}</span>)}
  </div>,
}));
vi.mock("@/app/(tenant)/core/hooks/useCoreOptions", () => ({
  useOrgNodeOptions: (_type: string, options: { enabled: boolean }) => {
    expect(options.enabled).toBe(false);
    return { options: [], error: null, retry: vi.fn() };
  },
}));

const branchId = "018f0000-0000-7000-8000-000000000001";
const companyId = "018f0000-0000-7000-8000-000000000011";
const generatedAt = "2026-11-10T12:00:00.000Z";
const selection = { branchId: null, datePreset: null, compare: null, currencyCode: null };
const rows = [["website", "Website", "الموقع", 440, 35.48], ["paid", "Paid", "الإعلانات", 340, 27.42],
  ["referral", "Referral", "الإحالات", 310, 25], ["events", "Events", "الفعاليات", 150, 12.1]] as const;

function receipt(empty = false) {
  const widget = {
    widgetId: "source-mix", state: empty ? "EMPTY" : "READY", shape: "CATEGORY",
    series: [{ key: "crm.leads.by_source.count", label: "Leads by source", unit: "COUNT", axis: "LEFT",
      points: empty ? [] : rows.map(([key, label, labelAr, value, sharePercent]) => ({
        key, label, value, meta: { labelAr, numerator: value, denominator: 1240, sharePercent: Number(sharePercent) },
      })) }],
    details: { sourceMix: { total: empty ? 0 : 1240, unspecifiedCount: 0, foldedSourceCount: 0,
      attributionBasis: "CURRENT_SOURCE", populationBasis: "CREATED_IN_PERIOD" } },
    meta: { generatedAt, unit: "COUNT", warnings: [],
      effectivePeriod: { from: "2026-10-01", to: "2026-10-31", timeZone: "Africa/Cairo" } },
  };
  return {
    reportKey: "LEAD_SOURCE_MIX", generatedAt, filters: {},
    scope: [{ branchId, scope: "own" }],
    organizationScope: { branchId: null, companyId: null, partialAccess: false,
      branches: [{ id: branchId, name: "Cairo", companyId, companyName: "Northstar" }],
      companies: [{ id: companyId, name: "Northstar" }] },
    populationScope: { state: "READY", teamIds: [], ownerUserIds: [], teams: [], owners: [] },
    panels: [{ key: "source-mix", nameEn: "Lead Acquisition Sources", nameAr: "مصادر اكتساب العملاء المحتملين",
      visualizationType: "PIE", displaySpec: { options: { showValues: true } },
      querySpec: { series: [{ metricKey: "crm.leads.by_source.count" }], dimension: { key: "source" }, comparison: { type: "NONE" } } }],
    widgets: { "source-mix": widget },
  };
}

const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
afterEach(() => { cleanup(); vi.mocked(axiosClient.post).mockReset(); locale.lang = "en"; });

describe("source mix report", () => {
  it("rejects mismatched shares, totals, panel IDs and unauthorized scope receipts", () => {
    const reply = receipt();
    expect(parseLeadSourceMixReport(reply, selection).panel.result.series[0].points).toHaveLength(4);
    expect(() => parseLeadSourceMixReport(reply, { ...selection, branchId })).toThrow();
    expect(() => parseLeadSourceMixReport({ ...reply, scope: [] }, selection)).toThrow();
    reply.widgets["source-mix"].series[0].points[0].meta.sharePercent = 99;
    expect(() => parseLeadSourceMixReport(reply, selection)).toThrow();
    const wrongTotal = receipt();
    wrongTotal.widgets["source-mix"].details.sourceMix.total = 1241;
    expect(readSourceMix(parseWidgetResult(wrongTotal.widgets["source-mix"]))).toBeNull();
  });

  it.each(["en", "ar"])("shows one composition with exact counts and shares in %s without a rerun on view changes", async lang => {
    locale.lang = lang;
    const copy = lang === "ar" ? ar : en;
    vi.mocked(axiosClient.post).mockResolvedValue(ok(receipt()));
    render(<LeadSourceMixReport />);
    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("1,240");
    expect(table).toHaveTextContent("35.48");
    expect(screen.getByTestId("mix-chart").querySelectorAll("span")).toHaveLength(4);
    fireEvent.click(screen.getByText(copy.crmDashboardReports.sourceMix.views.DONUT, { exact: true }));
    expect(screen.getByTestId("mix-chart")).toHaveAttribute("data-variant", "donut");
    fireEvent.click(screen.getByText(copy.crmDashboardReports.sourceMix.views.TABLE, { exact: true }));
    expect(screen.queryByTestId("mix-chart")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText(copy.crmDashboards.sourceMix.total)).toBeInTheDocument();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axiosClient.post).mock.calls[0][0]).toBe(LEAD_SOURCE_MIX_REPORT_PATH);
  });

  it("retains the previous-value table for an existing saved comparison", () => {
    const result = parseWidgetResult(receipt().widgets["source-mix"]);
    result.series[0].points = result.series[0].points.map(point => ({ ...point, previousValue: 1, previousKey: point.key }));
    const model = widgetTableModel(result, { label: "Source", value: "Count", previousValue: "Previous", sourceMix: en.crmDashboards.sourceMix });
    expect(model.columns.map(column => column.label)).toContainEqual(expect.stringContaining("Previous"));
    expect(model.rows).toHaveLength(4);
  });

  it("keeps a zero-total report chart empty", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue(ok(receipt(true)));
    render(<LeadSourceMixReport />);
    expect(await screen.findByRole("table")).toHaveTextContent("0");
    expect(screen.queryByTestId("mix-chart")).not.toBeInTheDocument();
  });

  it("accepts the engine's empty population receipt when selected teams and owners have no intersection", () => {
    const reply = receipt(true);
    const empty = { ...reply, widgets: { "source-mix": {
      ...reply.widgets["source-mix"], details: undefined, series: [],
      meta: { generatedAt, unit: "COUNT", warnings: ["NO_DATA"] },
    } } };
    expect(parseLeadSourceMixReport(empty, selection).panel.result.state).toBe("EMPTY");
    expect(() => parseLeadSourceMixReport({ ...empty, widgets: { "source-mix": {
      ...empty.widgets["source-mix"], series: receipt().widgets["source-mix"].series,
    } } }, selection)).toThrow();
  });

  it("combines the stored and chart-folded tails into one Other slice while keeping the exact table", () => {
    const base = receipt().widgets["source-mix"];
    const pointRows = [...Array.from({ length: 7 }, (_, index) => ({ key: `source-${index}`, label: `Source ${index}`, value: 1 })),
      { key: "OTHER", label: "Other", value: 5 }];
    const result = parseWidgetResult({ ...base,
      details: { sourceMix: { ...base.details.sourceMix, total: 12, foldedSourceCount: 5 } },
      series: [{ ...base.series[0], points: pointRows.map(point => ({ ...point,
        meta: { numerator: point.value, denominator: 12, sharePercent: Number((100 * point.value / 12).toFixed(2)) } })) }],
    });
    render(<WidgetPreview result={result} visualizationType="PIE" />);
    const labels = within(screen.getByTestId("mix-chart")).getAllByText(/Other/);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent("6 · 50%");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(10);
  });
});
