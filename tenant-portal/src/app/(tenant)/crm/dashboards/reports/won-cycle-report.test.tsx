// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { BRANCH_COHORT_DEFAULT_FILTERS } from "./branch-cohort-report-contract";
import { WonCycleReport } from "./components/WonCycleReport";
import { parseWonCycleReport, wonCycleQuery } from "./won-cycle-report-contract";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" }
  : { t: en, lang: "en", dir: "ltr" }, useLanguage: () => locale.lang }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() },
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  BarChart: ({ label, data, stacked }: { label: string; data: unknown; stacked: boolean }) =>
    <div role="img" aria-label={label} data-chart={JSON.stringify(data)} data-stacked={stacked} />,
}));

const north = "018f0000-0000-7000-8000-000000000001";
const south = "018f0000-0000-7000-8000-000000000002";
const companyId = "018f0000-0000-7000-8000-000000000011";
const otherCompany = "018f0000-0000-7000-8000-000000000012";
const filters = { ...BRANCH_COHORT_DEFAULT_FILTERS, afterMinutes: null };

function response() {
  return { state: "READY", warnings: [], asOf: "2026-11-10T10:00:00.000Z",
    range: { preset: "CURRENT_MONTH", from: "2026-11-01", to: "2026-11-30", timeZone: "Africa/Cairo" },
    scope: { companyId: null, branchId: null, partialAccess: false,
      companies: [{ id: companyId, name: "North" }, { id: otherCompany, name: "South" }],
      branches: [{ id: north, name: "Central", companyId, companyName: "North" },
        { id: south, name: "Central", companyId: otherCompany, companyName: "South" }] },
    totals: { min: 5760, q1: 10080, median: 11520, q3: 15120, p90: 21600, max: 25920, sampleCount: 4, excludedCount: 0 },
    distribution: { shape: "DURATION_DISTRIBUTION", unit: "DURATION", whiskerMethod: "MIN_MAX", totalCount: 4, excludedCount: 0,
      groups: [{ key: north, label: "Central · North", min: 5760, q1: 8640, median: 11520, q3: 11520, p90: 11520, max: 11520, sampleCount: 3, excludedCount: 0 },
        { key: south, label: "Central · South", min: 25920, q1: 25920, median: 25920, q3: 25920, p90: 25920, max: 25920, sampleCount: 1, excludedCount: 0 }] },
    frequency: { afterMinutes: null, nextAfterMinutes: null, values: [
      { minutes: 5760, counts: [{ branchId: north, count: 1 }] },
      { minutes: 11520, counts: [{ branchId: north, count: 2 }] },
      { minutes: 25920, counts: [{ branchId: south, count: 1 }] },
    ] },
  };
}

afterEach(() => { cleanup(); vi.mocked(axiosClient.get).mockReset(); });

describe("won sales cycle report", () => {
  it("validates branch authority, exact frequency reconciliation and exclusive paging", () => {
    expect(parseWonCycleReport(response(), filters).totals?.median).toBe(11520);
    const legacyName = response(); legacyName.scope.branches[0]!.name = " Central";
    expect(parseWonCycleReport(legacyName, filters).distribution?.groups[0]?.label).toBe("Central · North");
    const wrong = response(); wrong.frequency.values[1]!.counts[0]!.count = 1;
    expect(() => parseWonCycleReport(wrong, filters)).toThrow("Invalid CRM won sales cycle report");
    const outOfScope = response(); outOfScope.frequency.values[0]!.counts[0]!.branchId = "018f0000-0000-7000-8000-000000000999";
    expect(() => parseWonCycleReport(outOfScope, filters)).toThrow("Invalid CRM won sales cycle report");
    const afterMinutes = 11520;
    const paged = response();
    expect(parseWonCycleReport({ ...paged, frequency: { afterMinutes, nextAfterMinutes: null, values: paged.frequency.values.slice(-1) } },
      { ...filters, afterMinutes }).values).toHaveLength(1);
    expect(wonCycleQuery({ ...filters, afterMinutes })).toContain("afterMinutes=11520");
  });

  it.each(["en", "ar"] as const)("renders stacked exact durations, branch boxes and branch comparison in %s", async (lang) => {
    locale.lang = lang;
    const labels = (lang === "ar" ? ar : en).crmDashboardReports.wonCycle;
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: response(), status: 200, statusText: "OK", headers: new Headers() });
    render(<WonCycleReport />);
    const plot = await screen.findByRole("img", { name: labels.frequency });
    expect(plot).toHaveAttribute("data-stacked", "true");
    const chart = JSON.parse(plot.getAttribute("data-chart")!);
    expect(chart.map((row: Record<string, number>) => row[north])).toEqual([1, 2, 0]);
    expect(screen.getByRole("figure", { name: labels.quartiles })).toHaveTextContent("Central · South");
    fireEvent.click(screen.getByRole("button", { name: labels.viewData }));
    expect(screen.getByRole("table", { name: labels.exact })).toHaveTextContent("Central · North");
    fireEvent.click(screen.getByRole("button", { name: labels.compare }));
    expect(screen.getByRole("table", { name: labels.compare })).toHaveTextContent("Central · South");
    fireEvent.click(screen.getByRole("button", { name: labels.explain }));
    expect(screen.getByText(labels.method)).toBeVisible();
  });
});
