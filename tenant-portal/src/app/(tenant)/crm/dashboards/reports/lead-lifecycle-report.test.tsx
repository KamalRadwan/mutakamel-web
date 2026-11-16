// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { WidgetPreview } from "../../widgets/components/WidgetPreview";
import { parseWidgetResult } from "../dashboard-run-contract";
import { LIFECYCLE_METRICS } from "../widget-lead-lifecycle";
import { LeadLifecycleReport } from "./components/LeadLifecycleReport";
import { LEAD_LIFECYCLE_REPORT_PATH, parseLeadLifecycleReport } from "./lead-lifecycle-report-contract";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" },
  useLanguage: () => locale.lang,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/app/(tenant)/core/hooks/useCoreOptions", () => ({
  useOrgNodeOptions: () => ({ options: [], error: null, retry: vi.fn() }),
}));
vi.mock("@/lib/api/axiosClient", async original => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post: vi.fn() },
}));
vi.mock("@/design-system", async original => ({
  ...await original<typeof import("@/design-system")>(),
  DonutChart: ({ centerValue, label }: { centerValue: string; label: string }) => <div role="img" aria-label={label}>{centerValue}</div>,
}));

const branchId = "018f0000-0000-7000-8000-000000000001";
const companyId = "018f0000-0000-7000-8000-000000000011";
const selection = { branchId: null, datePreset: null, compare: null, currencyCode: null };
const generatedAt = "2026-11-04T07:01:00.000Z";
const asOf = "2026-11-04T07:00:00.000Z";
const period = { from: "2026-10-01", to: "2026-10-31", timeZone: "Africa/Cairo" };
const ok = <T,>(data: T): AxiosResponse<T> => ({ status: 200, statusText: "OK", headers: new Headers(), data });

function receipt(empty = false) {
  const metric = LIFECYCLE_METRICS;
  const evidence = { total: empty ? 0 : 1240, asOf, populationBasis: "CREATED_IN_PERIOD", classificationBasis: "CURRENT_STATE" };
  const meta = { generatedAt, effectivePeriod: period, warnings: empty ? ["NO_DATA"] : [], unit: "COUNT", timeBasis: "COHORT" };
  const status = [
    ["OPEN", "Open", "مفتوح", 620], ["ON_HOLD", "On hold", "قيد الانتظار", 120],
    ["CONVERTED", "Converted", "تم التحويل", 310], ["DISQUALIFIED", "Disqualified", "غير مؤهل", 190],
  ] as const;
  const stages = [
    ["new", "New", "جديد", 200, 160, 40], ["contacted", "Contacted", "تم التواصل", 220, 160, 60],
    ["qualified", "Qualified", "مؤهل", 320, 300, 20], ["converted", "Converted", "محوّل", 310, 0, 0],
    ["disqualified", "Disqualified", "غير مؤهل", 190, 0, 0],
  ] as const;
  const series = (key: string, points: unknown[]) => [{ key, label: key, unit: "COUNT", axis: "LEFT", points }];
  const state = empty ? "EMPTY" : "READY";
  const qualified = { total: empty ? 0 : 320, open: empty ? 0 : 300, onHold: empty ? 0 : 20, other: 0 };
  return {
    reportKey: "LEAD_LIFECYCLE_INVENTORY", generatedAt,
    filters: { datePreset: "LAST_MONTH", dateFrom: period.from, dateTo: period.to, timeZone: period.timeZone, asOf },
    scope: [{ branchId, scope: "all" }],
    organizationScope: { branchId: null, companyId: null, partialAccess: false,
      branches: [{ id: branchId, name: "Cairo", companyId, companyName: "Northstar" }], companies: [{ id: companyId, name: "Northstar" }] },
    populationScope: { state: "READY", teamIds: [], ownerUserIds: [], teams: [], owners: [] },
    panels: [
      ["current-status", "DONUT", metric.status, "lead_status", "Current lead status", "الحالات الحالية"],
      ["current-stage", "COLUMN", metric.stage, "lead_stage", "Current lead stage", "المراحل الحالية"],
      ["qualified-open", "METRIC_CARD", metric.qualified, "none", "Qualified open backlog", "المؤهلون المفتوحون"],
    ].map(([key, visualizationType, metricKey, dimension, nameEn, nameAr]) => ({ key, visualizationType, nameEn, nameAr, displaySpec: {},
      querySpec: { series: [{ metricKey }], dimension: { key: dimension }, comparison: { type: "NONE" } } })),
    widgets: {
      "current-status": { widgetId: "current-status", shape: "CATEGORY", state, meta, details: { leadLifecycle: { ...evidence } },
        series: series(metric.status, empty ? [] : status.map(([id, label, labelAr, value]) => ({ key: id, label, value, meta: { id, labelAr } }))) },
      "current-stage": { widgetId: "current-stage", shape: "CATEGORY", state, meta, details: { leadLifecycle: { ...evidence }, omittedStageGroups: 0 },
        series: series(metric.stage, empty ? [] : stages.map(([id, label, labelAr, total, open, onHold]) => ({
          key: id, label, value: total, meta: { id, labelAr, total, open, onHold },
        }))) },
      "qualified-open": { widgetId: "qualified-open", shape: "SCALAR", state, meta, value: qualified.open,
        details: { leadLifecycle: { ...evidence }, qualified },
        series: series(metric.qualified, [{ key: "0", label: "Value 1", value: qualified.open }]) },
    },
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); locale.lang = "en"; });

describe("current lead lifecycle", () => {
  it("binds all three receipts to one authorized population, period and observation", () => {
    expect(parseLeadLifecycleReport(receipt(), selection).asOf).toBe(asOf);
    expect(() => parseLeadLifecycleReport(receipt(), { ...selection, branchId })).toThrow();
    const wrong = receipt();
    wrong.widgets["current-stage"].details.leadLifecycle.asOf = "2026-11-04T06:59:00.000Z";
    expect(() => parseLeadLifecycleReport(wrong, selection)).toThrow(/panel evidence/i);
    const mismatch = receipt();
    const first = mismatch.widgets["current-stage"].series[0].points[0] as { meta: { open: number } };
    first.meta.open -= 1;
    expect(() => parseLeadLifecycleReport(mismatch, selection)).toThrow(/reconciliation/i);
  });

  it("rejects invalid subtotals even through the standalone Builder parser", () => {
    const invalid = receipt().widgets["qualified-open"];
    invalid.details.qualified.total = 319;
    expect(() => parseWidgetResult(invalid)).toThrow(/lead lifecycle/i);
  });

  it.each(["en", "ar"] as const)("renders exact evidence and dates in %s", async lang => {
    locale.lang = lang;
    const payload = receipt();
    const copy = (lang === "ar" ? ar : en).crmDashboardReports;
    vi.mocked(axiosClient.post).mockResolvedValue(ok(payload));
    render(<LeadLifecycleReport />);
    const stage = await screen.findByRole("region", { name: lang === "ar" ? "المراحل الحالية" : "Current lead stage" });
    expect(within(stage).getByRole("table")).toBeVisible();
    expect(within(stage).getByRole("row", { name: lang === "ar" ? /مؤهل 320 300 20/u : /Qualified 320 300 20/u })).toBeVisible();
    expect(screen.getByText(lang === "ar" ? "من أصل 320 مؤهل حاليًا" : "of 320 currently qualified")).toBeVisible();
    expect(axiosClient.post).toHaveBeenCalledWith(LEAD_LIFECYCLE_REPORT_PATH, { includePopulationOptions: true }, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: copy.acquisition.explain }));
    expect(screen.getByText(copy.leadLifecycle.method)).toBeVisible();
  });

  it("shows readable empty results without a zero-valued qualified chart", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue(ok(receipt(true)));
    render(<LeadLifecycleReport />);
    expect(await screen.findByText(en.crmDashboardReports.leadLifecycle.empty)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shares the qualified denominator and exact table with Builder previews", () => {
    const result = parseWidgetResult(receipt().widgets["qualified-open"]);
    render(<WidgetPreview result={result} visualizationType="METRIC_CARD" name="Qualified open backlog" />);
    expect(screen.getByText("of 320 currently qualified")).toBeVisible();
    expect(screen.getByRole("row", { name: /Total qualified 320/u })).toBeVisible();
  });
});
