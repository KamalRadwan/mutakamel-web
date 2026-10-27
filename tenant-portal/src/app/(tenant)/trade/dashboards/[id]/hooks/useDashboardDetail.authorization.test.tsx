// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { en } from "@/i18n/dictionaries/en";
import { useDashboardDetail } from "./useDashboardDetail";
import { useWidgetDetail } from "../../../widgets/[id]/hooks/useWidgetDetail";

const mock = vi.hoisted(() => ({
  user: null as TenantUserProfile | null,
  accessLevel: "OWNER",
  headers: {} as Record<string, string>,
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  toast: { outcomeFromApi: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mock.user }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mock.toast }));
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({ branchId: null }),
}));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeScope: () => ({ headers: mock.headers }),
  useTradeBranchSelection: () => ({ branchId: null }),
}));
vi.mock("../../../trade-api", () => ({
  tradeGet: mock.get,
  tradePost: mock.post,
  tradePatch: mock.patch,
  tradeDelete: mock.delete,
  tradeIfMatch: (revision: number) => `"${revision}"`,
}));

const id = "01902001-3000-7000-8000-000000000001";
const companyId = "01902001-3000-7000-8000-000000000002";
const otherCompanyId = "01902001-3000-7000-8000-000000000003";
const subjectId = "01902001-3000-7000-8000-000000000004";
const changes = [{ subjectId, subjectType: "USER", accessLevel: "VIEW" }] as const;

function grant(key: string, companyIds = [companyId], branchIds: string[] = []) {
  if (!mock.user) throw new Error("Missing test user");
  mock.user.permissions.push(key);
  mock.user.permissionScopes[key] = { tenantWide: false, companyIds, branchIds };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.user = {
    id, email: "owner@example.test", firstName: "Owner", lastName: "User",
    status: "ACTIVE", isTenantOwner: false, accessibleCompanies: [companyId],
    accessibleBranches: [], teamMemberships: [], permissions: [], permissionScopes: {},
    accessibleBranchCompanies: [],
    accessScope: { mode: "EXPLICIT", branchesTruncated: false, companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
  };
  mock.accessLevel = "OWNER";
  mock.headers = { "x-mutakamel-company-id": companyId };
  mock.get.mockImplementation(async (path: string) => ({
    data: path.endsWith(`/${id}`) ? {
      id, name: "Analytics", description: null, accessLevel: mock.accessLevel,
      scopeCoverage: "SINGLE_COMPANY", revision: 1,
      updatedAt: "2026-10-18T00:00:00.000Z", placements: [],
      visualizationType: "METRIC_CARD",
      querySpec: { series: [{ metricKey: "trade.orders.count" }] }, displaySpec: {},
    } : { items: [] },
  }));
  mock.post.mockResolvedValue({ data: {} });
  mock.patch.mockResolvedValue({ data: {} });
  mock.delete.mockResolvedValue({ data: {} });
});

afterEach(cleanup);

it("previews the saved query and display configuration through the detail hook", async () => {
  const querySpec = {
    series: [{ metricKey: "trade.orders.count", axis: "RIGHT", aggregation: "MAX" }],
    dimensionKey: "item", grain: "WEEK", comparison: { mode: "PREVIOUS_YEAR" },
    filters: [{ key: "item_id", values: [subjectId] }],
  };
  const displaySpec = { title: "Orders", precision: 3, legendPosition: "HIDDEN" };
  mock.get.mockImplementation(async (path: string) => ({
    data: path.endsWith(`/${id}`) ? {
      id, name: "Analytics", visualizationType: "METRIC_CARD", revision: 1,
      updatedAt: "2026-10-18T00:00:00.000Z", querySpec, displaySpec,
    } : { items: [] },
  }));
  mock.post.mockResolvedValue({ data: { result: {
    widgetId: id, status: "READY", shape: "SCALAR", completeness: "COMPLETE",
    partitions: [{ companyId, scalar: 7, series: [] }],
  } } });
  const { result } = renderHook(() => useWidgetDetail(id));
  await waitFor(() => expect(result.current.widget).not.toBeNull());
  await act(async () => { await result.current.runPreview(); });
  expect(mock.post).toHaveBeenCalledWith(
    "/api/tenant/trade/v1/widgets/preview",
    { name: "Analytics", visualizationType: "METRIC_CARD", querySpec, displaySpec,
      requestId: expect.any(String) },
    expect.objectContaining({ headers: mock.headers }),
  );
  expect(result.current.preview?.partitions[0].scalar).toEqual({ kind: "count", value: 7 });
});

describe("dashboard editing admission", () => {
  it("blocks every layout mutation for an EDIT sharee without update permission", async () => {
    mock.accessLevel = "EDIT";
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
    await act(async () => {
      await result.current.saveLayout([]);
      await result.current.addPlacement(subjectId);
      await result.current.removePlacement(subjectId);
    });
    expect(mock.patch).not.toHaveBeenCalled();
    expect(mock.post).not.toHaveBeenCalled();
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "EDIT"])("allows %s layout saves with a matching update grant", async (access) => {
    mock.accessLevel = access;
    grant("trade.dashboards.update");
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    await act(async () => { await result.current.saveLayout([]); });
    expect(mock.patch).toHaveBeenCalledTimes(1);
  });

  it("does not turn VIEW access into edit access when the update grant exists", async () => {
    mock.accessLevel = "VIEW";
    grant("trade.dashboards.update");
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
  });

  it.each(["other-company", "branch-only"])("blocks layout saves with a %s update grant", async (kind) => {
    grant("trade.dashboards.update", kind === "other-company" ? [otherCompanyId] : [], [subjectId]);
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
    await act(async () => { await result.current.saveLayout([]); });
    expect(mock.patch).not.toHaveBeenCalled();
  });
});

describe.each([
  { resource: "dashboard", permission: "trade.dashboards.share", useDetail: useDashboardDetail },
  { resource: "widget", permission: "trade.widgets.share", useDetail: useWidgetDetail },
])("$resource sharing admission", ({ permission, useDetail }) => {
  it.each(["VIEW", "EDIT"])("blocks %s sharees even with the share grant", async (access) => {
    mock.accessLevel = access;
    grant(permission);
    const { result } = renderHook(() => useDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queryError).toBeNull();
    expect(result.current.canShare).toBe(false);
    await act(async () => {
      await result.current.upsertShares(changes);
      await result.current.removeShare(subjectId);
    });
    expect(mock.post).not.toHaveBeenCalled();
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it.each(["missing", "other-company", "branch-only"])("blocks an owner with a %s grant", async (kind) => {
    if (kind === "other-company") grant(permission, [otherCompanyId]);
    if (kind === "branch-only") grant(permission, [], [subjectId]);
    const { result } = renderHook(() => useDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queryError).toBeNull();
    expect(result.current.canShare).toBe(false);
    await act(async () => {
      await result.current.upsertShares(changes);
      await result.current.removeShare(subjectId);
    });
    expect(mock.post).not.toHaveBeenCalled();
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it("allows an authorized owner to add and revoke shares", async () => {
    grant(permission);
    const { result } = renderHook(() => useDetail(id));
    await waitFor(() => expect(result.current.canShare).toBe(true));
    await act(async () => { await result.current.upsertShares(changes); });
    await act(async () => { await result.current.removeShare(subjectId); });
    expect(mock.post).toHaveBeenCalledTimes(1);
    expect(mock.delete).toHaveBeenCalledTimes(1);
  });

  it("accepts an accessible branch grant when no company header is supplied", async () => {
    mock.headers = {};
    grant(permission, [], [subjectId]);
    const { result } = renderHook(() => useDetail(id));
    await waitFor(() => expect(result.current.canShare).toBe(true));
  });

  it("keeps resource ownership mandatory for tenant owners", async () => {
    if (mock.user) mock.user.isTenantOwner = true;
    mock.accessLevel = "EDIT";
    const { result, rerender } = renderHook(() => useDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canShare).toBe(false);
    mock.accessLevel = "OWNER";
    await act(async () => { await result.current.reload(); });
    rerender();
    expect(result.current.canShare).toBe(true);
  });
});
