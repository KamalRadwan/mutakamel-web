// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { DashboardBlueprintDrawer } from "../components/DashboardBlueprintDrawer";
import { useDashboardBlueprints } from "./useDashboardBlueprints";

const { get, put, auth, toast } = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), toast: { success: vi.fn(), info: vi.fn() },
  auth: { generation: 0, lang: "en" as "en" | "ar", id: "01900300-0000-7000-8000-000000000001", accessibleBranches: ["01900300-0000-7000-8000-000000000003"] },
}));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ realtimeAuthGeneration: auth.generation,
  user: { id: auth.id, isTenantOwner: true, permissions: [], accessibleBranches: auth.accessibleBranches } }) }));
vi.mock("@/lib/api/axiosClient", async original => ({ ...await original<object>(), axiosClient: { get, put } }));
vi.mock("@/design-system", async original => ({ ...await original<object>(), useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: auth.lang, dir: auth.lang === "ar" ? "rtl" : "ltr", t: auth.lang === "ar" ? ar : en }) }));

const catalogue = "/api/tenant/crm/v1/dashboards/blueprints";
const dashboardId = "01900300-0000-7000-8000-000000000002";
const detailPath = `/api/tenant/crm/v1/dashboards/${dashboardId}`;
const branchId = auth.accessibleBranches[0]!;
const blueprint = { key: "team", audience: "TEAM_LEADER", name: "Team dashboard", description: "Team pipeline",
  definitionRevision: 1, widgetCount: 1, branchSelectionRequired: false,
  targets: [{ widgetName: "Win rate", target: 35 }], adoption: { state: "AVAILABLE" } };
const receipt = { status: 200, data: { dashboardId, definitionRevision: 1, created: false } };
const detail = () => ({ status: 200, data: { id: dashboardId, ownerUserId: auth.id, name: blueprint.name, accessLevel: "OWNER",
  revision: 1, updatedAt: "2026-11-10T00:00:00Z", placements: [], unavailablePlacements: [] } });

function createdDetail() {
  const widgetId = "01900300-0000-7000-8000-000000000004";
  return { status: 200, data: { ...detail().data, name: "My branch", defaultFilters: { branchId }, placements: [{
    id: "01900300-0000-7000-8000-000000000005", dashboardId, widgetId, x: 0, y: 0, width: 4, height: 3, sortOrder: 0,
    widget: { id: widgetId, ownerUserId: auth.id, name: "Win rate", visualizationType: "METRIC_CARD", revision: 1,
      querySpec: { series: [{ metricKey: "crm.leads.converted.count" }] }, updatedAt: "2026-11-10T00:00:00Z" },
  }] } };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  auth.generation += 1;
  auth.lang = "en";
  get.mockReset().mockImplementation((path: string) => Promise.resolve(path === detailPath ? detail() : { data: { items: [blueprint] } }));
  put.mockReset().mockResolvedValue(receipt);
  toast.info.mockClear(); toast.success.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openBlueprints() {
  const navigate = vi.fn();
  const result = renderHook(() => useDashboardBlueprints(true, navigate));
  expect(get).not.toHaveBeenCalled();
  act(() => result.result.current.changeOpen(true));
  await waitFor(() => expect(result.result.current.items).toHaveLength(1));
  return { ...result, navigate };
}

it("sends the reviewed revision and explicit numeric target consent before opening a verified dashboard", async () => {
  const { result, navigate } = await openBlueprints();
  act(() => result.current.selectBranch(branchId));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(`${catalogue}?branchId=${branchId}`, expect.anything()));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  act(() => result.current.choose(result.current.items[0]!));
  await act(async () => result.current.adopt());
  expect(put).not.toHaveBeenCalled();
  put.mockResolvedValueOnce({ ...receipt, data: { ...receipt.data, created: true } });
  get.mockResolvedValueOnce(createdDetail());
  act(() => result.current.updateReview({ name: "My branch", confirmed: true }));
  await act(async () => result.current.adopt());
  expect(put).toHaveBeenCalledExactlyOnceWith(`${catalogue}/team/adoption`, { definitionRevision: 1, branchId, name: "My branch", confirmTargets: true }, expect.objectContaining({ nonReplayable: true }));
  expect(get).toHaveBeenLastCalledWith(detailPath, expect.anything());
  expect(navigate).toHaveBeenCalledExactlyOnceWith(dashboardId);
  expect(toast.success).toHaveBeenCalledTimes(1);
});

it("fences a malformed receipt and requires readback and review before another write", async () => {
  const { result, navigate } = await openBlueprints();
  act(() => result.current.choose(result.current.items[0]!));
  act(() => result.current.updateReview({ confirmed: true }));
  put.mockResolvedValueOnce({ ...receipt, data: { ...receipt.data, definitionRevision: 2 } });
  await act(async () => result.current.adopt());
  expect(navigate).not.toHaveBeenCalled();
  expect(result.current.blocked).toBe(true);
  await act(async () => result.current.adopt());
  expect(put).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.reload(); });
  expect(result.current.reviewReady).toBe(true);
  act(() => result.current.acknowledge());
  expect(result.current.blocked).toBe(false);
});

it("keeps a provisioning failure distinct from an empty catalogue and rereads on retry", async () => {
  get.mockRejectedValueOnce(new TenantApiClientError("Not ready", { status: 503, statusText: "Service Unavailable",
    headers: new Headers(), data: { code: "CRM_DASHBOARD_BLUEPRINTS_NOT_READY" } }));
  const { result } = renderHook(() => useDashboardBlueprints(true, vi.fn()));
  act(() => result.current.changeOpen(true));
  await waitFor(() => expect(result.current.queryError).toMatchObject({ status: 503 }));
  expect(result.current.items).toEqual([]);
  await act(async () => { await result.current.reload(); });
  expect(result.current.queryError).toBeNull();
  expect(result.current.items).toHaveLength(1);
});

it("discards old branch results and target acknowledgement when selecting another scope", async () => {
  const { result } = await openBlueprints();
  act(() => result.current.choose(result.current.items[0]!));
  act(() => result.current.updateReview({ confirmed: true }));
  get.mockResolvedValueOnce({ data: { items: [{ ...blueprint, definitionRevision: 2 }] } });
  act(() => result.current.selectBranch(branchId));
  expect(result.current.activeReview).toBeNull();
  await waitFor(() => expect(result.current.items[0]?.definitionRevision).toBe(2));
  act(() => result.current.choose(result.current.items[0]!));
  expect(result.current.activeReview?.confirmed).toBe(false);
});

it.each(["en", "ar"] as const)("renders an accessible %s review before enabling creation", async lang => {
  auth.lang = lang;
  const copy = (lang === "ar" ? ar : en).crmDashboards.blueprints;
  const navigate = vi.fn();
  function Harness() {
    const state = useDashboardBlueprints(true, navigate);
    return <>
      <button type="button" onClick={() => state.changeOpen(true)}>{copy.browse}</button>
      <DashboardBlueprintDrawer state={state} onRecovery={() => void state.reload()} />
    </>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: copy.browse }));
  const dialog = within(await screen.findByRole("dialog", { name: copy.title }));
  fireEvent.click(await dialog.findByRole("button", { name: /Team dashboard/ }));
  const heading = await dialog.findByRole("heading", { name: blueprint.name });
  await waitFor(() => expect(document.activeElement).toBe(heading));
  expect(dialog.getByRole("button", { name: copy.adopt })).toHaveProperty("disabled", true);
  fireEvent.click(dialog.getByRole("checkbox", { name: copy.confirmTargets }));
  const submit = dialog.getByRole("button", { name: copy.adopt });
  expect(submit).toHaveProperty("disabled", false);
  fireEvent.click(submit);
  await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(dashboardId));
});

it("shows an explicit branch choice for partial coverage and blocks a link to an adoption from a different scope", async () => {
  const copy = en.crmDashboards.blueprints;
  const navigate = vi.fn();
  get.mockImplementation((path: string) => Promise.resolve({ data: { items: path.includes("?branchId=")
    ? [{ ...blueprint, adoption: { state: "ADOPTED_ELSEWHERE" } }]
    : [{ ...blueprint, branchSelectionRequired: true }] } }));
  function Harness() {
    const state = useDashboardBlueprints(true, navigate);
    return <>
      <button type="button" onClick={() => state.changeOpen(true)}>{copy.browse}</button>
      <DashboardBlueprintDrawer state={state} onRecovery={() => void state.reload()} />
    </>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: copy.browse }));
  const dialog = within(await screen.findByRole("dialog", { name: copy.title }));
  await dialog.findByText(copy.branchRequired);
  expect(dialog.queryByRole("button", { name: /Team dashboard/ })).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: en.common.selectBranch }));
  await dialog.findByText(copy.adoptedElsewhere);
  expect(get).toHaveBeenLastCalledWith(`${catalogue}?branchId=${branchId}`, expect.anything());
  expect(dialog.queryByRole("button", { name: /Team dashboard/ })).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});
