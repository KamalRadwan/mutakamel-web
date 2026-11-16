// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { WonTargetAttainmentReport } from "./components/WonTargetAttainmentReport";
import { alignedTargetPeriod, parseWonTargetReport, WON_TARGET_DEFAULT_FILTERS, wonTargetQuery } from "./won-target-report-contract";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en", managerBranch: null as string | null }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" }
  : { t: en, lang: "en", dir: "ltr" }, useLanguage: () => locale.lang }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: locale.managerBranch ? {
  id: "018f0000-0000-7000-8000-000000000061", isTenantOwner: true, accessibleBranches: [locale.managerBranch],
  accessibleCompanies: [], teamMemberships: [], permissions: [],
} : null }) }));

const id = (value: number) => `018f0000-0000-7000-8000-${String(value).padStart(12, "0")}`;
const [central, coast, companyId] = [1, 2, 3].map(id);
const filters = WON_TARGET_DEFAULT_FILTERS;
const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
const calendarUnavailable = { state: "CALENDAR_UNAVAILABLE", calendarRevision: null, remainingWorkdays: null, requiredPerWorkday: null };

function reply() {
  return { state: "READY", asOf: "2026-11-10T10:00:00.000Z", coverageStartedAt: "2026-11-01T00:00:00.000Z",
    basis: "RECORDED_WON_EVENT", subjectType: "BRANCH", subjectId: null, pace: "CALENDAR_UNAVAILABLE", trajectory: null,
    period: { grain: "MONTH", start: "2026-11-01", endExclusive: "2026-12-01", timeZone: "UTC", state: "OPEN" },
    scope: { companyId: null, branchId: null, partialAccess: false, companies: [{ id: companyId, name: "North" }],
      branches: [{ id: central, name: "Central", companyId, companyName: "North" }, { id: coast, name: "Coast", companyId, companyName: "North" }] },
    rows: [{ id: id(11), branchId: central, subjectId: central, subjectName: "Central", currencyCode: "EGP", revision: 3,
      state: "READY", targetValue: "5000000.00", actualValue: "5400000.000" as string | null,
      attainmentPercent: "108.00" as string | null, remainingValue: "0.000" as string | null, excludedCount: 0 as number | null,
      workingPace: { ...calendarUnavailable } },
    { id: id(12), branchId: coast, subjectId: coast, subjectName: "Coast", currencyCode: "SAR", revision: 4,
      state: "READY", targetValue: "800000.00", actualValue: "640000.000", attainmentPercent: "80.00", remainingValue: "160000.000", excludedCount: 0,
      workingPace: { ...calendarUnavailable } }],
    currencies: [{ currencyCode: "EGP", targetCount: 1, targetValue: "5000000.000", actualValue: "5400000.000" as string | null,
      attainmentPercent: "108.00" as string | null, remainingValue: "0.000" as string | null, excludedCount: 0 as number | null },
    { currencyCode: "SAR", targetCount: 1, targetValue: "800000.000", actualValue: "640000.000", attainmentPercent: "80.00", remainingValue: "160000.000", excludedCount: 0 }],
  };
}

function trajectoryReply() {
  const result = reply();
  result.asOf = "2026-11-10T22:15:00.000Z";
  result.period.timeZone = "Africa/Cairo";
  result.pace = "BRANCH_CALENDAR";
  Object.assign(result.rows[1]!.workingPace, { state: "READY", calendarRevision: 4, remainingWorkdays: 3, requiredPerWorkday: "53333.334" });
  return { ...result, trajectory: { targetId: id(12), points: Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    return {
      date: `2026-11-${String(day).padStart(2, "0")}`,
      wonValue: day === 11 ? "640000.000" : day < 11 ? "0.000" : null,
      observedCumulative: day === 11 ? "640000.000" : day < 11 ? "0.000" : null,
      plannedCumulative: day < 11 ? null : day === 11 ? "640000.000" : day < 17 ? "693333.334" : day < 30 ? "746666.668" : "800000.000",
      isPlannedWorkday: [12, 17, 30].includes(day),
    };
  }) } };
}

function historicalReply() {
  const ready = reply();
  const unavailable = { actualValue: null, attainmentPercent: null, remainingValue: null, excludedCount: null };
  return { ...ready, state: "UNAVAILABLE", pace: "PERIOD_CLOSED", period: { ...ready.period, start: "2026-10-01", endExclusive: "2026-11-01", state: "CLOSED" },
    rows: ready.rows.map(row => ({ ...row, ...unavailable, state: "HISTORY_INCOMPLETE",
      workingPace: { ...calendarUnavailable, state: "PERIOD_CLOSED", remainingWorkdays: 0 } })),
    currencies: ready.currencies.map(row => ({ ...row, ...unavailable })) };
}

afterEach(() => { cleanup(); vi.mocked(axiosClient.get).mockReset(); vi.mocked(axiosClient.post).mockReset(); locale.lang = "en"; locale.managerBranch = null; });

describe("won target attainment report", () => {
  it("validates the scoped daily trajectory, exact cap and civil-date anchor", () => {
    const query = { ...filters, trajectoryTargetId: id(12) };
    const result = trajectoryReply();
    expect(parseWonTargetReport(result, query).trajectory?.points[10]).toMatchObject({
      date: "2026-11-11", observedCumulative: "640000.000", plannedCumulative: "640000.000", isPlannedWorkday: false,
    });
    expect(() => parseWonTargetReport(result, { ...query, trajectoryTargetId: id(11) })).toThrow();
    expect(() => parseWonTargetReport(result, filters)).toThrow();
    const earlyPlan = structuredClone(result);
    earlyPlan.trajectory.points[9]!.plannedCumulative = "640000.000";
    expect(() => parseWonTargetReport(earlyPlan, query)).toThrow();
    const futureActual = structuredClone(result);
    futureActual.trajectory.points[11]!.wonValue = "0.000";
    expect(() => parseWonTargetReport(futureActual, query)).toThrow();
    const overshoot = structuredClone(result);
    overshoot.trajectory.points[29]!.plannedCumulative = "800000.002";
    expect(() => parseWonTargetReport(overshoot, query)).toThrow();
  });

  it.each(["en", "ar"] as const)("loads only the selected target and reveals exact daily evidence in %s", async lang => {
    locale.lang = lang;
    const labels = (lang === "ar" ? ar : en).crmDashboardReports.wonTarget.trajectory;
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(reply())).mockResolvedValueOnce(ok(trajectoryReply()));
    render(<div dir={lang === "ar" ? "rtl" : "ltr"}><WonTargetAttainmentReport /></div>);
    const picker = await screen.findByRole("combobox", { name: labels.target });
    expect(axiosClient.get).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(picker, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "North · Coast · SAR" }));
    fireEvent.click(await screen.findByRole("button", { name: labels.exact }));
    expect(vi.mocked(axiosClient.get).mock.calls[1]?.[0]).toBe(
      wonTargetQuery({ ...filters, periodStart: "2026-11-01", subjectType: "BRANCH", trajectoryTargetId: id(12) }));
    const table = screen.getByRole("table", { name: labels.exact });
    expect(within(table).getByRole("row", { name: /2026-11-12/u })).toHaveTextContent(/693,333\.334/u);
    expect(within(table).getByRole("row", { name: /2026-11-30/u })).toHaveTextContent(/800,000\.00/u);
  });

  it("binds the request, validates exact rates and rejects wrong-currency or unauthorized row summaries", () => {
    expect(parseWonTargetReport(reply(), filters).currencies[0]).toMatchObject({ actualValue: "5400000.000", attainmentPercent: "108.00" });
    const invalid = reply();
    invalid.currencies[0]!.actualValue = "640000.000";
    invalid.currencies[0]!.attainmentPercent = "12.80";
    invalid.currencies[0]!.remainingValue = "4360000.000";
    expect(() => parseWonTargetReport(invalid, filters)).toThrow("Invalid CRM won target attainment report");
    const hidden = reply();
    hidden.rows[0]!.branchId = id(99);
    expect(() => parseWonTargetReport(hidden, filters)).toThrow("Invalid CRM won target attainment report");
    expect(wonTargetQuery({ ...filters, periodGrain: "QUARTER", periodStart: "2026-10-01", subjectType: "USER", subjectId: id(21) }))
      .toContain(`periodGrain=QUARTER&periodStart=2026-10-01&subjectType=USER&subjectId=${id(21)}`);
    expect(alignedTargetPeriod("2026-11-01", "QUARTER")).toBe(false);
  });

  it("keeps an incomplete currency distinct from a real zero and retains team rows without aggregates", () => {
    const partial = reply();
    partial.state = "PARTIAL";
    Object.assign(partial.rows[0]!, { state: "MONEY_DATA_INCOMPLETE", actualValue: null, remainingValue: null, attainmentPercent: null, excludedCount: 1 });
    Object.assign(partial.currencies[0]!, { actualValue: null, remainingValue: null, attainmentPercent: null, excludedCount: null });
    expect(parseWonTargetReport(partial, filters).currencies[0]?.actualValue).toBeNull();
    const zero = reply();
    Object.assign(zero.rows[0]!, { actualValue: "0.000", attainmentPercent: "0.00", remainingValue: "5000000.000" });
    Object.assign(zero.currencies[0]!, { actualValue: "0.000", attainmentPercent: "0.00", remainingValue: "5000000.000" });
    expect(parseWonTargetReport(zero, filters).rows[0]?.actualValue).toBe("0.000");
    const team = historicalReply();
    const teamResult = { ...team, subjectType: "TEAM", period: reply().period, pace: "CALENDAR_UNAVAILABLE", currencies: [],
      rows: team.rows.map(row => ({ ...row, subjectId: id(50), subjectName: "Team A", state: "TEAM_HISTORY_UNAVAILABLE", workingPace: calendarUnavailable })) };
    expect(parseWonTargetReport(teamResult, { ...filters, subjectType: "TEAM" })).toMatchObject({ subjectType: "TEAM", currencies: [] });
  });

  it("shows separate native-currency pace and rejects rates rounded below the required amount", async () => {
    const labels = en.crmDashboardReports.wonTarget;
    const published = reply();
    published.pace = "BRANCH_CALENDAR";
    Object.assign(published.rows[0]!.workingPace, { state: "READY", calendarRevision: 3, remainingWorkdays: 8, requiredPerWorkday: "0.000" });
    Object.assign(published.rows[1]!.workingPace, { state: "READY", calendarRevision: 4, remainingWorkdays: 7, requiredPerWorkday: "22857.143" });
    const roundedDown = structuredClone(published);
    Object.assign(roundedDown.rows[1]!.workingPace, { requiredPerWorkday: "22857.142" });
    expect(() => parseWonTargetReport(roundedDown, filters)).toThrow();
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(published));
    render(<WonTargetAttainmentReport />);
    expect(await screen.findByText(labels.paceStates.BRANCH_CALENDAR)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: labels.exact });
    expect(within(table).getByRole("row", { name: /Coast/u })).toHaveTextContent(/SAR\s*22,857\.143/u);
    expect(within(table).getByRole("row", { name: /Central/u })).toHaveTextContent(/EGP\s*0\.00/u);
    expect(screen.queryByRole("button", { name: labels.calendar.manage })).not.toBeInTheDocument();
  });

  it("publishes a complete scoped schedule with an individual date override and refreshes the report", async () => {
    locale.managerBranch = central;
    const labels = en.crmDashboardReports.wonTarget.calendar;
    const path = `/api/tenant/crm/v1/targets/working-calendars/${central}/2026`;
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(reply())).mockResolvedValueOnce(ok({ branchId: central, calendarYear: 2026,
      revision: 0, workingDays: null, publishedAt: null })).mockResolvedValueOnce(ok(reply()));
    vi.mocked(axiosClient.post).mockImplementationOnce(async (_path, data) => ({ ...ok({ branchId: central, calendarYear: 2026,
      revision: 1, workingDays: (data as { workingDays: string }).workingDays, publishedAt: "2026-11-10T10:00:00Z" }), status: 201 }));
    render(<WonTargetAttainmentReport />);
    fireEvent.click(await screen.findByRole("button", { name: labels.manage }));
    fireEvent.click(screen.getByRole("button", { name: labels.load }));
    expect(await screen.findByText(labels.unpublished)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sun" }));
    fireEvent.click(screen.getByRole("button", { name: labels.generate }));
    const sunday = screen.getByRole("button", { name: "Sunday, January 4, 2026" });
    expect(sunday).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(sunday);
    expect(sunday).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: labels.publish }));
    expect(await screen.findByText(labels.published)).toBeInTheDocument();
    const [actualPath, data, config] = vi.mocked(axiosClient.post).mock.calls[0]!;
    expect(actualPath).toBe(path);
    expect(config).toMatchObject({ nonReplayable: true, skipAutoIdempotency: true });
    expect(data).toMatchObject({ expectedRevision: 0, workingDays: expect.stringMatching(/^[01]{365}$/u) });
    expect((data as { workingDays: string }).workingDays.slice(0, 11)).toBe("00000000001");
    expect(axiosClient.get).toHaveBeenCalledTimes(3);
  });

  it("renders independent currency bullets and keeps the exact table when a chart is deselected", async () => {
    const labels = en.crmDashboardReports.wonTarget;
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(reply()));
    render(<WonTargetAttainmentReport />);
    const first = await screen.findByRole("meter", { name: `${labels.comparison} EGP` });
    const second = screen.getByRole("meter", { name: `${labels.comparison} SAR` });
    expect(first).toHaveAttribute("data-gauge-variant", "bullet");
    expect(first).toHaveAttribute("aria-valuenow", "5400000");
    expect(second).toHaveAttribute("aria-valuenow", "640000");
    const table = screen.getByRole("table", { name: labels.exact });
    expect(within(table).getByRole("row", { name: /Central/u })).toHaveTextContent(/108%/u);
    fireEvent.click(screen.getByRole("button", { name: labels.compare }));
    expect(screen.getByText(labels.currencyLimit)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SAR" }));
    expect(screen.queryByRole("meter", { name: `${labels.comparison} SAR` })).not.toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Coast/u })).toHaveTextContent(/640,000/u);
  });

  it("shows three currencies at a time and lets the viewer replace a plotted currency", async () => {
    const labels = en.crmDashboardReports.wonTarget;
    const data = reply();
    for (const [index, currencyCode] of ["KWD", "OMR"].entries()) {
      const branchId = id(21 + index);
      data.scope.branches.push({ id: branchId, name: currencyCode, companyId, companyName: "North" });
      const amounts = { targetValue: "100.000", actualValue: "100.000", attainmentPercent: "100.00", remainingValue: "0.000", excludedCount: 0 };
      data.rows.push({ id: id(31 + index), branchId, subjectId: branchId, subjectName: currencyCode, currencyCode, revision: 1, state: "READY", ...amounts,
        workingPace: { ...calendarUnavailable } });
      data.currencies.push({ currencyCode, targetCount: 1, ...amounts });
    }
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(data));
    render(<WonTargetAttainmentReport />);
    await screen.findByRole("meter", { name: `${labels.comparison} EGP` });
    expect(screen.getAllByRole("meter")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: labels.compare }));
    expect(screen.getByRole("button", { name: "OMR" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "SAR" }));
    fireEvent.click(screen.getByRole("button", { name: "OMR" }));
    expect(screen.getAllByRole("meter")).toHaveLength(3);
    expect(screen.getByRole("meter", { name: `${labels.comparison} OMR` })).toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: `${labels.comparison} SAR` })).not.toBeInTheDocument();
  });

  it("applies a historic date in Arabic and keeps authorized targets visible without a fabricated chart", async () => {
    locale.lang = "ar";
    const labels = ar.crmDashboardReports.wonTarget;
    vi.mocked(axiosClient.get).mockResolvedValueOnce(ok(reply())).mockResolvedValueOnce(ok(historicalReply()));
    render(<div dir="rtl"><WonTargetAttainmentReport /></div>);
    await screen.findByRole("meter", { name: `${labels.comparison} EGP` });
    fireEvent.change(screen.getByLabelText(labels.periodStart), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: ar.crmDashboards.filters.apply }));
    expect(await screen.findByText(labels.historyNotice)).toBeInTheDocument();
    expect(vi.mocked(axiosClient.get).mock.calls.at(-1)?.[0]).toContain("periodStart=2026-10-01");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText(labels.paceStates.PERIOD_CLOSED)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: labels.exact })).toHaveTextContent(/5,000,000/u);
  });
});
