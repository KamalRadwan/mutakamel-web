// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_COHORT_DEFAULT_FILTERS, branchCohortQuery, parseBranchCohortReport } from "./branch-cohort-report-contract";
import { LeadBranchCohortReport } from "./components/LeadBranchCohortReport";
import { useBranchCohortReport } from "./hooks/useBranchCohortReport";

vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }), useLanguage: () => "en" }));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return { ...actual, BarChart: ({ label, valueAxes }: { label: string; valueAxes: unknown }) =>
    <div role="img" aria-label={label} data-axes={JSON.stringify(valueAxes)} /> };
});

const companyId = "018f0000-0000-7000-8000-000000000011";
const branchId = "018f0000-0000-7000-8000-000000000001";
const filters = BRANCH_COHORT_DEFAULT_FILTERS;
const apiResponse = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });

function response(selectedCompany: string | null = null, selectedBranch: string | null = null) {
  return { state: "READY", asOf: "2026-11-10T10:00:00.000Z",
    range: { preset: "CURRENT_MONTH", from: "2026-11-01", to: "2026-11-30", timeZone: "Africa/Cairo" },
    scope: { companyId: selectedCompany, branchId: selectedBranch, partialAccess: true,
      companies: [{ id: companyId, name: "North" }], branches: [{ id: branchId, name: "Central", companyId, companyName: "North" }] },
    rows: [{ branchId, branchName: "Central", companyId, companyName: "North", eligible: 4, converted: 1, remaining: 3, rate: 25 }],
    totals: { eligible: 4, converted: 1, remaining: 3, rate: 25, invalidIntervals: 0 }, warnings: [],
  };
}

beforeEach(() => vi.mocked(axiosClient.get).mockReset());
afterEach(cleanup);

describe("dedicated branch cohort report", () => {
  it("binds query scope, dates and weighted totals to the result", () => {
    expect(branchCohortQuery({ ...filters, datePreset: "CUSTOM", dateFrom: "2026-10-01", dateTo: "2026-10-31", companyId, branchId }))
      .toContain(`datePreset=CUSTOM&dateFrom=2026-10-01&dateTo=2026-10-31&companyId=${companyId}&branchId=${branchId}`);
    expect(parseBranchCohortReport(response(), filters).totals?.rate).toBe(25);
    expect(parseBranchCohortReport(response(companyId, branchId), {
      ...filters, companyId: companyId.toUpperCase(), branchId: branchId.toUpperCase(),
    }).totals?.rate).toBe(25);
    const mismatched = response();
    mismatched.totals.rate = 40;
    expect(() => parseBranchCohortReport(mismatched, filters)).toThrow("Invalid CRM lead branch cohort report");
    expect(() => parseBranchCohortReport(response(), { ...filters, companyId })).toThrow("Invalid CRM lead branch cohort report");
    const outside = response();
    outside.rows[0].branchId = "018f0000-0000-7000-8000-000000000002";
    expect(() => parseBranchCohortReport(outside, filters)).toThrow("Invalid CRM lead branch cohort report");
  });

  it("clears cached organization choices after a rejected scope refresh", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(apiResponse(response())).mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(),
        data: { code: "CRM_SCOPED_PERMISSION_DENIED" } }, "http"),
    );
    const { result } = renderHook(() => useBranchCohortReport(filters));
    await waitFor(() => expect(result.current.options?.companies).toHaveLength(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(result.current.options).toBeUndefined();
    expect(result.current.result).toBeUndefined();
  });

  it("clears previous results during scope changes and ignores a late abandoned response", async () => {
    let resolve: (value: ReturnType<typeof apiResponse>) => void = () => {};
    vi.mocked(axiosClient.get).mockResolvedValueOnce(apiResponse(response()))
      .mockImplementationOnce(() => new Promise((accept) => { resolve = accept; }))
      .mockResolvedValueOnce(apiResponse(response(companyId, branchId)));
    const { result, rerender } = renderHook((selection) => useBranchCohortReport(selection), { initialProps: filters });
    await waitFor(() => expect(result.current.result?.state).toBe("READY"));
    rerender({ ...filters, companyId });
    expect(result.current.result).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    rerender({ ...filters, companyId, branchId });
    await waitFor(() => expect(result.current.result?.totals?.rate).toBe(25));
    expect(vi.mocked(axiosClient.get).mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => resolve(apiResponse(response(companyId))));
    expect(result.current.result?.totals?.rate).toBe(25);
  });

  it("renders both charts, the exact table and a visible partial-access notice", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(apiResponse(response()));
    render(<LeadBranchCohortReport />);
    const labels = en.crmDashboardReports.branchCohort;
    expect(await screen.findByRole("img", { name: labels.countsChart })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: labels.ratesChart })).toHaveAttribute("data-axes", '{"LEFT":{"domain":[0,100]}}');
    expect(screen.getByRole("table", { name: labels.exactTable })).toHaveTextContent("CentralNorth41325%");
    expect(screen.getByText(labels.partialScope)).toBeInTheDocument();
  });
});
