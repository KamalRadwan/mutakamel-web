// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { LeadIntakeAllocationReport } from "./components/LeadIntakeAllocationReport";
import { LEAD_INTAKE_ALLOCATION_PATH, parseLeadIntakeAllocation, type IntakeRequest } from "./lead-intake-allocation-contract";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }), useLanguage: () => "en" }));
vi.mock("@/lib/api/axiosClient", async original => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post: vi.fn() },
}));
vi.mock("../[id]/components/DashboardFilterBar", () => ({ DashboardFilterBar: () => null }));
vi.mock("@/design-system", async original => ({
  ...await original<typeof import("@/design-system")>(),
  BarChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

const id = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const branchId = id(1);
const companyId = id(2);
const ownerId = id(3);
const rep = { ownerId, name: "Amal Hassan" };
const counts = { created: 120, converted: 30, remaining: 90, invalidIntervals: 0, missingConversionDates: 0 };
const request: IntakeRequest = { selection: { branchId: null, datePreset: null, compare: null, currencyCode: null }, cursors: [null] };
const ok = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });

function receipt(page = 1) {
  const range = { preset: "LAST_MONTH", from: "2026-10-01", to: "2026-10-31", timeZone: "Africa/Cairo" };
  return {
    reportKey: "LEAD_INTAKE_ALLOCATION", asOf: "2026-11-04T12:00:00.000Z", range,
    scope: { branchId: null, companyId: null, partialAccess: false, companies: [{ id: companyId, name: "Northstar" }],
      branches: [{ id: branchId, companyId, name: "Cairo", companyName: "Northstar" }] },
    intake: { total: 1240, unassigned: 0, other: 1120, ownerOptions: [rep], comparison: [{ ...rep, ...counts }], comparisonTotals: counts },
    queue: { range: { ...range, preset: "CUSTOM", from: "2026-09-01", to: "2026-09-30" },
      partialAccess: false, state: "READY", branchIds: [branchId], total: 6, nextCursor: page === 1 ? "page_2" : null,
      rows: Array.from({ length: page === 1 ? 5 : 1 }, (_, index) => ({
        id: id(10 * page + index), title: `Lead ${page}-${index + 1}`, branchId, createdAt: "2026-09-01T12:00:00.000123Z",
        sourceNameEn: "Website", sourceNameAr: "الموقع",
      })),
    },
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("R54 intake allocation", () => {
  it("rejects inconsistent totals, comparison owners and foreign-branch queue rows", () => {
    const original = receipt();
    expect(parseLeadIntakeAllocation(original, request).intake?.total).toBe(1240);
    expect(() => parseLeadIntakeAllocation({ ...original, intake: { ...original.intake, other: 1119 } }, request)).toThrow();
    expect(() => parseLeadIntakeAllocation(original, { ...request, comparisonOwnerIds: [id(8)] })).toThrow();
    original.queue.rows[0].branchId = id(8);
    expect(() => parseLeadIntakeAllocation(original, request)).toThrow();
  });

  it("renders the report and reuses the same cohort when moving between queue pages", async () => {
    vi.mocked(axiosClient.post).mockImplementation(async (_path, payload) =>
      ok(receipt((payload as { queueCursor?: string }).queueCursor ? 2 : 1)));
    render(<LeadIntakeAllocationReport />);
    await screen.findByRole("heading", { name: "Intake by current owner" });
    expect(screen.getByText("1,240")).toBeVisible();
    const comparison = screen.getByRole("table", { name: "Rep intake and conversion" });
    expect(within(comparison).getAllByText("90")).toHaveLength(2);
    const queue = () => within(screen.getByRole("table", { name: "Open unassigned intake" }));
    const narrowQueue = () => within(screen.getByRole("list", { name: "Open unassigned intake" }));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("table", { name: "Open unassigned intake" });
    expect(queue().getByRole("link", { name: "Lead 2-1" })).toHaveAttribute("href", `/crm/leads/${id(20)}`);
    expect(narrowQueue().getByRole("link", { name: "Lead 2-1" })).toHaveAttribute("href", `/crm/leads/${id(20)}`);
    expect(axiosClient.post).toHaveBeenLastCalledWith(LEAD_INTAKE_ALLOCATION_PATH, { queueCursor: "page_2" }, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(queue().getByRole("link", { name: "Lead 1-1" })).toBeVisible());
  });

  it("shows an unavailable queue under restricted grants while preserving assigned intake", async () => {
    const data = receipt();
    vi.mocked(axiosClient.post).mockResolvedValue(ok({ ...data, queue: {
      ...data.queue, state: "UNAVAILABLE", partialAccess: true, branchIds: [], total: null, nextCursor: null, rows: [],
    } }));
    render(<LeadIntakeAllocationReport />);
    expect(await screen.findByText("Full read access is required to view the queue.")).toBeVisible();
    expect(screen.getByText("1,240")).toBeVisible();
    expect(screen.queryByRole("table", { name: "Open unassigned intake" })).toBeNull();
  });
});
