// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { BRANCH_COHORT_DEFAULT_FILTERS } from "./branch-cohort-report-contract";
import { CONVERSION_JOURNEY_REPORT_PATH, parseConversionJourneyReport } from "./conversion-journey-report-contract";
import { LeadConversionJourneyReport } from "./components/LeadConversionJourneyReport";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" }
  : { t: en, lang: "en", dir: "ltr" }, useLanguage: () => locale.lang }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() },
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), BarChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

const asOf = "2026-11-10T10:00:00.000Z";
const companyId = "018f0000-0000-7000-8000-000000000011";
const branchId = "018f0000-0000-7000-8000-000000000001";
function response() {
  const days = [0, 1, 3, 7, 14, 30, 60, 90];
  return { asOf, range: { preset: "CURRENT_MONTH", from: "2026-11-01", to: "2026-11-30", timeZone: "Africa/Cairo" },
    scope: { companyId: null, branchId: null, partialAccess: false,
      companies: [{ id: companyId, name: "North" }], branches: [{ id: branchId, name: "Central", companyId, companyName: "North" }] },
    duration: { state: "READY", warnings: ["INVALID_CONVERSION_INTERVALS"], data: { median: 1440, p90: 129600,
      conversionSample: { validCount: 5, excludedCount: 1 }, bins: days.map((day, order) => ({
        key: `duration-${day}d`, label: `${day} d`, order, kind: order === 7 ? "OVERFLOW" : "STANDARD",
        lowerBound: day * 1440, upperBound: order === 7 ? undefined : days[order + 1]! * 1440,
        count: [1, 2, 0, 0, 0, 0, 0, 2][order]!,
      })),
    } },
    cohort: { state: "READY", partialAccess: false, warnings: [], data: { created: 9, converted: 3, won: 1,
      withoutReadableWin: 2, rate: 33.33, invalidIntervals: 0, asOf, outcomeBasis: "CURRENT_WON" } },
  };
}

afterEach(() => { cleanup(); vi.mocked(axiosClient.get).mockReset(); });

describe("lead conversion journey report", () => {
  it("reconciles event buckets and cohort counts independently and rejects inconsistent wire evidence", () => {
    const filters = BRANCH_COHORT_DEFAULT_FILTERS;
    const valid = parseConversionJourneyReport(response(), filters);
    expect(valid.duration.data?.validCount).toBe(5);
    expect(valid.cohort.data?.converted).toBe(3);
    const badBins = response(); badBins.duration.data.bins[0]!.count = 0;
    expect(() => parseConversionJourneyReport(badBins, filters)).toThrow("Invalid CRM lead conversion journey report");
    const badRate = response(); badRate.cohort.data.rate = 50;
    expect(() => parseConversionJourneyReport(badRate, filters)).toThrow("Invalid CRM lead conversion journey report");
    const badCutoff = response(); badCutoff.cohort.data.asOf = "2026-11-11T10:00:00.000Z";
    expect(() => parseConversionJourneyReport(badCutoff, filters)).toThrow("Invalid CRM lead conversion journey report");
  });

  it.each(["en", "ar"] as const)("renders separate bases and exact duration bands in %s", async (lang) => {
    locale.lang = lang;
    const labels = (lang === "ar" ? ar : en).crmDashboardReports.conversionJourney;
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: response(), status: 200, statusText: "OK", headers: new Headers() });
    render(<LeadConversionJourneyReport />);
    expect(await screen.findByRole("img", { name: labels.durationTitle })).toBeInTheDocument();
    expect(screen.getByText(labels.eventBasis)).toBeInTheDocument();
    expect(screen.getByText(labels.creationBasis)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: labels.funnel })).toHaveTextContent(/9.*3.*1/u);
    expect(screen.getByRole("table", { name: labels.cohortExact })).toHaveTextContent("33.33");
    const exact = screen.getByRole("button", { name: labels.exactValues });
    expect(exact).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(exact);
    const table = screen.getByRole("table", { name: labels.durationExact });
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    expect(within(table).getByRole("rowheader", { name: /≥\s*90/u })).toBeInTheDocument();
    expect(axiosClient.get).toHaveBeenCalledWith(`${CONVERSION_JOURNEY_REPORT_PATH}?datePreset=CURRENT_MONTH`, expect.anything());
  });

  it("retains duration data and withholds the current-win panel without opportunity authority", async () => {
    locale.lang = "en";
    const data = { ...response(), cohort: { state: "UNAVAILABLE", partialAccess: false, warnings: ["SOURCE_PERMISSION_REQUIRED"], data: null } };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data, status: 200, statusText: "OK", headers: new Headers() });
    render(<LeadConversionJourneyReport />);
    const labels = en.crmDashboardReports.conversionJourney;
    expect(await screen.findByRole("img", { name: labels.durationTitle })).toBeInTheDocument();
    expect(screen.getByText(labels.cohortUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: labels.funnel })).toBeNull();
  });
});
