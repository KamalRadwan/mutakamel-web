// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DASHBOARDS_PATH, dashboardFromTemplatePath } from "../../dashboard-contract";
import { DashboardWorkspace } from "./dashboard-workspace";

const DICT_BY_LANG = { en, ar } as const;
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar", permissions: ["crm.dashboards.read.own"],
  get: vi.fn(), put: vi.fn(), toastError: vi.fn(), navigate: vi.fn(),
}));
const ID = "01900300-0000-7000-8000-000000000001";
const NEXT_ID = "01900300-0000-7000-8000-000000000002";
const dashboard = {
  id: ID, ownerUserId: ID, name: "Current", revision: 1,
  updatedAt: "2026-10-18T00:00:00Z", accessLevel: "OWNER", sourceTemplateKey: null,
  placements: [], unavailablePlacements: [],
};
const names = { en: "Sales from catalogue", ar: "المبيعات من الكتالوج" };

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: state.permissions, accessibleBranches: [] } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: DICT_BY_LANG[state.lang], lang: state.lang }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.navigate }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get: state.get, put: state.put },
}));
vi.mock("@/design-system", async (importOriginal) => {
  const { hasPermission } = await importOriginal<typeof import("@/design-system")>();
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    hasPermission, useToast: () => ({ error: state.toastError }),
    Button: Slot, DetailHeader: () => null,
    ConflictDialog: () => null, DegradedBanner: () => null, EmptyState: () => null,
    ErrorState: ({ title, onRetry, retryLabel }: { title: string; onRetry: () => void; retryLabel: string }) =>
      <div role="alert">{title}<button onClick={onRetry}>{retryLabel}</button></div>,
    NotFoundState: () => null, PermissionGate: Slot, Skeleton: () => null,
    Select: Slot, SelectContent: Slot, SelectItem: Slot, SelectTrigger: Slot, SelectValue: () => null,
  };
});
vi.mock("../hooks/useDashboardDetail", () => ({
  useDashboardDetail: () => ({ detail: dashboard, run: null, selection: {}, availableCurrencies: [], isLoading: false }),
}));
vi.mock("../hooks/useDashboardLayout", () => ({ useDashboardLayout: () => ({ canEdit: false }) }));
vi.mock("../hooks/useDashboardShares", () => ({ useDashboardShares: () => ({}) }));
vi.mock("../hooks/useAvailableWidgets", () => ({ useAvailableWidgets: () => ({ widgets: [], error: null }) }));
vi.mock("../hooks/useWidgetDrilldown", () => ({ useWidgetDrilldown: () => ({}) }));
vi.mock("./DashboardFilterBar", () => ({
  DashboardFilterBar: ({ dashboardSwitcher }: { dashboardSwitcher: {
    value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void;
  } }) => <select aria-label="Dashboard" value={dashboardSwitcher.value}
    onChange={(event) => dashboardSwitcher.onChange(event.target.value)}>
    {dashboardSwitcher.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
  </select>,
}));
vi.mock("./DashboardLayoutEditor", () => ({ DashboardLayoutEditor: () => null }));
vi.mock("./AddWidgetDrawer", () => ({ AddWidgetDrawer: () => null }));
vi.mock("./DashboardEditDrawer", () => ({ DashboardEditDrawer: () => null }));
vi.mock("./ShareDrawer", () => ({ ShareDrawer: () => null }));
vi.mock("./DrilldownSheet", () => ({ DrilldownSheet: () => null }));
vi.mock("./WidgetTile", () => ({ WidgetTile: () => null }));

beforeEach(() => {
  state.lang = "en";
  state.permissions = ["crm.dashboards.read.own"];
  state.get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH ? { items: [dashboard], nextCursor: null } : {
    grid: { columns: 12, maxWidgets: 20 }, visualizations: [], metrics: [], dimensions: [],
    templates: [{ key: "SALES_PIPELINE", nameEn: names.en, nameAr: names.ar }],
  } }));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("dashboard template selection", () => {
  it("has no template option without create permission", async () => {
    render(<DashboardWorkspace dashboardId={ID} />);
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("option", { name: names.en })).toBeNull();
    expect(state.put).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)("shows catalogue copy and a translated toast for a template 500 in %s", async (lang) => {
    state.lang = lang;
    state.permissions.push("crm.dashboards.create");
    state.put.mockRejectedValue(new TenantApiClientError("Server error", {
      status: 500, statusText: "Internal Server Error", headers: new Headers(), data: {},
    }));
    render(<DashboardWorkspace dashboardId={ID} onSelectDashboard={state.navigate} />);
    expect(await screen.findByRole("option", { name: names[lang] })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "template:SALES_PIPELINE" } });
    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith(DICT_BY_LANG[lang].crmDashboards.actionFailed));
    expect(state.put).toHaveBeenCalledWith(dashboardFromTemplatePath("SALES_PIPELINE"), {}, expect.any(Object));
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("navigates to the provisioned dashboard on success", async () => {
    state.permissions.push("crm.dashboards.create");
    state.put.mockResolvedValue({ data: { ...dashboard, id: NEXT_ID, sourceTemplateKey: "SALES_PIPELINE" } });
    render(<DashboardWorkspace dashboardId={ID} onSelectDashboard={state.navigate} />);
    await screen.findByRole("option", { name: names.en });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "template:SALES_PIPELINE" } });
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith(NEXT_ID));
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)("shows a translated retry boundary for loading failures in %s", async (lang) => {
    state.lang = lang;
    state.get.mockRejectedValue(new Error("Load failed"));
    render(<DashboardWorkspace dashboardId={ID} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(DICT_BY_LANG[lang].crmDashboards.switcherLoadFailed);
    fireEvent.click(screen.getByRole("button", { name: DICT_BY_LANG[lang].common.retry }));
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(4));
  });
});
