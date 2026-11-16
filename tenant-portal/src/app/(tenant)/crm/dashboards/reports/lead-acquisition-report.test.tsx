// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { LeadAcquisitionReport } from "./components/LeadAcquisitionReport";
import { LEAD_ACQUISITION_REPORT_PATH, parseLeadAcquisitionReport } from "./lead-acquisition-report-contract";

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

const branchId = "018f0000-0000-7000-8000-000000000001";
const companyId = "018f0000-0000-7000-8000-000000000011";
const generatedAt = "2026-11-10T12:00:00.000Z";
const selection = { branchId: null, datePreset: null, compare: null, currencyCode: null };
const specs = [
  ["monthly-intake", "Monthly Lead Intake", "الاكتساب الشهري", "LINE", "crm.leads.created.trend", "time", "MONTH"],
  ["arrival-heatmap", "Lead Arrival Heatmap", "أوقات وصول العملاء المحتملين", "HEATMAP", "crm.leads.created.by_weekday_hour.count", "lead_arrival_slot"],
  ["source-growth", "Intake Growth by Source", "نمو الاكتساب حسب المصدر", "BAR", "crm.leads.created.by_source.growth_percent", "source"],
] as const;

function receipt() {
  return {
    reportKey: "LEAD_ACQUISITION", generatedAt, filters: {},
    scope: [{ branchId, scope: "own" }],
    organizationScope: { branchId: null, companyId: null, partialAccess: true,
      branches: [{ id: branchId, name: "Cairo", companyId, companyName: "Northstar" }],
      companies: [{ id: companyId, name: "Northstar" }] },
    populationScope: { state: "READY", teamIds: [], ownerUserIds: [], teams: [], owners: [] },
    panels: specs.map(([key, nameEn, nameAr, visualizationType, metricKey, dimension, grain]) => ({
      key, nameEn, nameAr, visualizationType, displaySpec: {},
      querySpec: { series: [{ metricKey }], dimension: { key: dimension, grain } },
    })),
    widgets: Object.fromEntries(specs.map(([widgetId]) => [widgetId, {
      widgetId, state: "EMPTY", series: [], meta: { generatedAt, warnings: [] },
    }])),
  };
}

const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
afterEach(() => { cleanup(); vi.mocked(axiosClient.post).mockReset(); locale.lang = "en"; });

describe("lead acquisition report", () => {
  it("binds each panel to its governed query, result and selected scope", () => {
    const reply = receipt();
    expect(parseLeadAcquisitionReport(reply, selection).panels.map(panel => panel.key)).toEqual(specs.map(([key]) => key));
    expect(() => parseLeadAcquisitionReport(reply, { ...selection, branchId })).toThrow();
    expect(() => parseLeadAcquisitionReport({ ...reply, panels: reply.panels.toReversed() }, selection)).toThrow();
    expect(() => parseLeadAcquisitionReport({ ...reply, scope: [] }, selection)).toThrow();
    expect(() => parseLeadAcquisitionReport({ ...reply, populationScope: undefined }, selection)).toThrow();
    reply.widgets["monthly-intake"].widgetId = "source-growth";
    expect(() => parseLeadAcquisitionReport(reply, selection)).toThrow();
  });

  it("opens the report in Arabic and replaces stale panels during an explicit rerun", async () => {
    locale.lang = "ar";
    const post = vi.mocked(axiosClient.post);
    let finish: (response: ReturnType<typeof ok>) => void = () => undefined;
    post.mockResolvedValueOnce(ok(receipt())).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<LeadAcquisitionReport />);
    expect(await screen.findByRole("heading", { name: "الاكتساب الشهري" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    const explain = screen.getByRole("button", { name: ar.crmDashboardReports.acquisition.explain });
    fireEvent.click(explain);
    expect(explain).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(ar.crmDashboardReports.acquisition.growthMethod)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: ar.crmDashboardReports.acquisition.runAgain }));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      finish(ok(receipt()));
    });
    expect(await screen.findByRole("heading", { name: "نمو الاكتساب حسب المصدر" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    for (const [path, body, config] of post.mock.calls) {
      expect(path).toBe(LEAD_ACQUISITION_REPORT_PATH);
      expect(body).toEqual({ includePopulationOptions: true });
      expect(config).toMatchObject({ skipAutoIdempotency: true, cache: "no-store" });
    }
  });

  it("clears the report and its scope choices when a rerun is forbidden", async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce(ok(receipt())).mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(),
        data: { code: "CRM_SCOPED_PERMISSION_DENIED" } }),
    );
    render(<LeadAcquisitionReport />);
    await screen.findByRole("heading", { name: "Monthly Lead Intake" });
    fireEvent.click(screen.getByRole("button", { name: en.crmDashboardReports.acquisition.runAgain }));
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmDashboards.filters.title })).not.toBeInTheDocument();
  });
});
