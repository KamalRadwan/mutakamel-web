// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { BRANCH_COHORT_DEFAULT_FILTERS } from "./branch-cohort-report-contract";
import { TeamCohortReport } from "./components/TeamCohortReport";
import { TeamCohortResults } from "./components/TeamCohortResults";
import { parseTeamCohortReport, teamCohortQuery } from "./team-cohort-report-contract";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" }
  : { t: en, lang: "en", dir: "ltr" }, useLanguage: () => locale.lang }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() },
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  BarChart: ({ label, series, stacked }: { label: string; series: Array<{ key: string }>; stacked?: boolean }) =>
    <div role="img" aria-label={label} data-series={series.map(({ key }) => key).join(",")} data-stacked={stacked ?? false} />,
}));

const id = (value: number) => `018f0000-0000-7000-8000-${String(value).padStart(12, "0")}`;
const north = id(1), coast = id(2), companyId = id(11), first = id(41), second = id(42), third = id(43);
const filters = { ...BRANCH_COHORT_DEFAULT_FILTERS, teamIds: [], branchIds: [] };
const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });

function response() {
  return { state: "READY", warnings: [], asOf: "2026-11-10T10:00:00.000Z",
    range: { preset: "CURRENT_MONTH", from: "2026-11-01", to: "2026-11-30", timeZone: "Africa/Cairo" },
    scope: { companyId: null, branchId: null, partialAccess: false, companies: [{ id: companyId, name: "North" }],
      branches: [{ id: north, name: "Central", companyId, companyName: "North" }, { id: coast, name: "Coast", companyId, companyName: "North" }] },
    membershipBasis: "CURRENT_COVERAGE", aggregation: "NON_ADDITIVE", selectedBranchIds: [] as string[], selectedTeamIds: [first, second],
    teamOptions: [{ id: first, label: "Company sales · Central · North", branchIds: [north, coast] },
      { id: second, label: "Distribution · Coast · North", branchIds: [north, coast] }],
    rows: [{ teamId: first, created: 380, converted: 95, rate: 25 }, { teamId: second, created: 320, converted: 80, rate: 25 }],
    totals: { created: 640, converted: 160, rate: 25, overlapCreated: 60, overlapConverted: 15,
      duplicateCreated: 60, duplicateConverted: 15, invalidIntervals: 0 },
  };
}

afterEach(() => { cleanup(); vi.mocked(axiosClient.get).mockReset(); });

describe("team cohort report", () => {
  it("reconciles the union independently from duplicate occurrences and rejects unauthorized coverage", () => {
    expect(parseTeamCohortReport(response(), filters).totals?.converted).toBe(160);
    const extra = response();
    extra.teamOptions.push({ id: third, label: "Expansion", branchIds: [north] });
    extra.selectedTeamIds.push(third);
    extra.rows.push({ teamId: third, created: 60, converted: 15, rate: 25 });
    extra.totals.duplicateCreated = 120;
    extra.totals.duplicateConverted = 30;
    const selected = { ...filters, teamIds: [first, second, third] };
    expect(parseTeamCohortReport(extra, selected).totals).toMatchObject({ overlapCreated: 60, duplicateCreated: 120 });
    extra.totals.overlapCreated = 121;
    expect(() => parseTeamCohortReport(extra, selected)).toThrow("Invalid CRM lead team cohort report");
    const wrong = response(); wrong.teamOptions[0]!.branchIds = [id(999)];
    expect(() => parseTeamCohortReport(wrong, filters)).toThrow("Invalid CRM lead team cohort report");
    expect(teamCohortQuery({ ...filters, branchIds: [north, coast], teamIds: [first, second] }))
      .toContain(`branchIds=${north}%2C${coast}&teamIds=${first}%2C${second}`);
  });

  it("retains an empty authorized cohort when no teams are configured", () => {
    const empty = { ...response(), state: "EMPTY", warnings: ["NO_DATA"], teamOptions: [], selectedTeamIds: [], rows: [],
      totals: { created: 0, converted: 0, rate: null, overlapCreated: 0, overlapConverted: 0,
        duplicateCreated: 0, duplicateConverted: 0, invalidIntervals: 0 } };
    expect(parseTeamCohortReport(empty, filters)).toMatchObject({ state: "EMPTY", totals: { created: 0, rate: null } });
    expect(parseTeamCohortReport({ ...empty, state: "UNAVAILABLE", totals: null }, filters).totals).toBeNull();
  });

  it("shows exact two-team and three-team intersections in the design fixture", () => {
    locale.lang = "en";
    const base = response();
    const three = { ...base, selectedTeamIds: [first, second, third],
      teamOptions: [...base.teamOptions, { id: third, label: "Field Sales · Central · North", branchIds: [north] }],
      rows: [{ teamId: first, created: 100, converted: 30, rate: 30 }, { teamId: second, created: 80, converted: 24, rate: 30 },
        { teamId: third, created: 60, converted: 18, rate: 30 }],
      totals: { created: 200, converted: 60, rate: 30, overlapCreated: 30, overlapConverted: 9,
        duplicateCreated: 40, duplicateConverted: 12, invalidIntervals: 0 },
    };
    const selected = { ...filters, teamIds: [first, second, third] };
    const parsed = parseTeamCohortReport(three, selected);
    expect(parsed).toMatchObject({ overlapByTeamCount: {
      exactlyTwo: { created: 20, converted: 6 }, exactlyThree: { created: 10, converted: 3 },
    } });
    const impossible = { ...three, totals: { ...three.totals, overlapCreated: 40 } };
    expect(() => parseTeamCohortReport(impossible, selected)).toThrow("Invalid CRM lead team cohort report");

    if (!parsed.totals) throw new Error("Expected a ready team report");
    render(<TeamCohortResults result={parsed} showExact />);
    expect(screen.getByText("Exactly two teams · 20 created · 6 converted")).toBeInTheDocument();
    expect(screen.getByText("All three teams · 10 created · 3 converted")).toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("shows the deduplicated total, counts-only chart and unavailable staffing measures in %s", async (lang) => {
    locale.lang = lang;
    const labels = (lang === "ar" ? ar : en).crmDashboardReports.teamCohort;
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(response()));
    render(<TeamCohortReport />);
    const plot = await screen.findByRole("img", { name: labels.chart });
    expect(plot).toHaveAttribute("data-series", "created,converted");
    expect(plot).toHaveAttribute("data-stacked", "false");
    const table = screen.getByRole("table", { name: labels.exact });
    expect(within(table).getByRole("row", { name: new RegExp(labels.total) })).toHaveTextContent(/640.*160.*25/u);
    expect(screen.getByRole("switch", { name: labels.activeSellers })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: labels.compare }));
    expect(screen.getByRole("combobox", { name: labels.teamNumber.replace("{number}", "3") })).toBeInTheDocument();
  });

  it("sends explicit branch coverage and replaces data under the new scope", async () => {
    locale.lang = "en";
    const labels = en.crmDashboardReports.teamCohort;
    const next = response();
    next.selectedBranchIds = [north];
    next.teamOptions.forEach((team) => { team.branchIds = [north]; });
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(response())).mockResolvedValueOnce(ok(next));
    render(<TeamCohortReport />);
    await screen.findByRole("img", { name: labels.chart });
    const toggle = screen.getByRole("button", { name: labels.selectBranches });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("checkbox", { name: "Central · North" }));
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    fireEvent.click(within(panel).getByRole("button", { name: en.crmDashboards.filters.apply }));
    await screen.findByRole("img", { name: labels.chart });
    expect(vi.mocked(axiosClient.get).mock.calls.at(-1)?.[0]).toContain(`branchIds=${north}`);
    expect(screen.getByText("Teams 2 · Covered branches 1")).toBeInTheDocument();
  });
});
