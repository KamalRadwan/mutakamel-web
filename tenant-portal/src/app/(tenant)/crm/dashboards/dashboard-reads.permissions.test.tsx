// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import CrmDefaultDashboardPage from "../dashboard/page";
import DashboardsPage from "./page";
import PrebuiltReportsPage from "./reports/page";
import { useDashboards } from "./hooks/useDashboards";
import { usePrebuiltReport } from "./reports/hooks/usePrebuiltReport";
import { LEAD_ACQUISITION_REPORT_PATH } from "./reports/lead-acquisition-report-contract";
import { LEAD_SOURCE_MIX_REPORT_PATH } from "./reports/lead-source-mix-contract";

const { auth, get, post, navigation } = vi.hoisted(() => ({
  auth: {
    user: null as {
      permissions: string[];
      isTenantOwner: boolean;
      accessibleBranches: string[];
      teamMemberships: [];
    } | null,
  },
  get: vi.fn(),
  post: vi.fn(),
  navigation: { search: "" },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get, post },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({}),
  NAV_SECTIONS: [],
  Button: () => null,
  ConfirmActionModal: () => null,
  DataTable: () => null,
  DegradedBanner: () => null,
  ErrorState: () => null,
  FilterBar: () => null,
  PageHeader: () => null,
  Skeleton: () => null,
  SubNav: () => null,
  ToggleGroup: () => null,
}));
vi.mock("./components/useDashboardColumns", () => ({ useDashboardColumns: () => [] }));
vi.mock("./components/DashboardFormDrawer", () => ({ DashboardFormDrawer: () => null }));
vi.mock("./[id]/components/dashboard-workspace", () => ({ DashboardWorkspace: () => null }));
vi.mock("./reports/components/PrebuiltWidgetCard", () => ({ PrebuiltWidgetCard: () => null }));
vi.mock("@/components/tenant/TenantBranchSelect", () => ({ TenantBranchSelect: () => null }));

beforeEach(() => {
  auth.user = {
    permissions: [],
    isTenantOwner: false,
    accessibleBranches: [],
    teamMemberships: [],
  };
  get.mockRejectedValue(new Error("Read failed"));
  post.mockRejectedValue(new Error("Read failed"));
  navigation.search = "";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe.each([
  { name: "default dashboard", Page: CrmDefaultDashboardPage, reads: 1 },
  { name: "dashboard list", Page: DashboardsPage, reads: 2 },
  { name: "prebuilt reports", Page: PrebuiltReportsPage, reads: 1 },
])("$name read admission", ({ Page, reads }) => {
  it("renders the permission boundary without any API call for a denied user", async () => {
    auth.user!.permissions = ["crm.dashboards.create", "crm.widgets.read"];
    await act(async () => { render(<Page />); });
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["own", "team", "all"])("loads for the scoped %s read grant", async (scope) => {
    auth.user!.permissions = [`crm.dashboards.read.${scope}`];
    render(<Page />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(reads));
    expect(screen.queryByText(en.permissionGate.title)).toBeNull();
  });

  it("admits a tenant owner without explicit permission keys", async () => {
    auth.user!.isTenantOwner = true;
    render(<Page />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(reads));
    expect(screen.queryByText(en.permissionGate.title)).toBeNull();
  });

  it("waits for the session and starts loading when read access arrives", async () => {
    const user = auth.user!;
    auth.user = null;
    const view = render(<Page />);
    await act(async () => { await Promise.resolve(); });
    expect(get).not.toHaveBeenCalled();

    auth.user = { ...user, permissions: ["crm.dashboards.read.own"] };
    view.rerender(<Page />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(reads));
  });
});

it.each([
  { report: "lead-acquisition", path: LEAD_ACQUISITION_REPORT_PATH, enabled: false },
  { report: "lead-acquisition", path: LEAD_ACQUISITION_REPORT_PATH, enabled: true },
  { report: "lead-sources", path: LEAD_SOURCE_MIX_REPORT_PATH, enabled: false },
  { report: "lead-sources", path: LEAD_SOURCE_MIX_REPORT_PATH, enabled: true },
])("admits $report only with dashboard read access $enabled", async ({ report, path, enabled }) => {
  navigation.search = `report=${report}`;
  if (enabled) auth.user!.permissions = ["crm.dashboards.read.own"];
  await act(async () => { render(<PrebuiltReportsPage />); });
  expect(get).not.toHaveBeenCalled();
  if (enabled) {
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe(path);
  } else {
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
  }
});

it("skips manual reloads and default reads while the hooks are disabled", async () => {
  const { result } = renderHook(() => ({
    dashboards: useDashboards(false),
    report: usePrebuiltReport("overview", null, false),
  }));
  await act(async () => {
    await result.current.dashboards.reload();
    await result.current.dashboards.loadMore();
    await result.current.report.reload();
    expect(await result.current.dashboards.openDefault()).toMatchObject({
      ok: false, error: { status: 403 },
    });
  });
  expect(get).not.toHaveBeenCalled();
});
