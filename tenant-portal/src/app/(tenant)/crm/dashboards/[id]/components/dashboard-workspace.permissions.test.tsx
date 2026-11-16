// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { DashboardDetail } from "../../dashboard-contract";
import { DashboardWorkspace } from "./dashboard-workspace";

const DICT_BY_LANG = { en, ar } as const;

const state = vi.hoisted(() => ({
  permissions: ["crm.dashboards.read.own"],
  lang: "en" as "en" | "ar",
  get: vi.fn(),
}));

const dashboard: DashboardDetail = {
  id: "01900300-0000-7000-8000-000000000001",
  ownerUserId: "01900300-0000-7000-8000-000000000002",
  ownerName: null, name: "Sales", description: null, defaultFilters: {},
  sourceTemplateKey: null, revision: 1, createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z", accessLevel: "OWNER", isShared: false,
  isDefault: false, isFavorite: false, lastOpenedAt: null,
  placements: [], unavailablePlacements: [], duplication: null,
};

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: dashboard.ownerUserId, permissions: state.permissions, accessibleBranches: [] } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: DICT_BY_LANG[state.lang], lang: state.lang }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get: state.get } };
});
vi.mock("@/design-system", async (importOriginal) => {
  const { cn, hasPermission } = await importOriginal<typeof import("@/design-system")>();
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Badge: Slot, cn, hasPermission,
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
      createElement("button", { onClick }, children),
    DetailHeader: ({ secondaryActions, primaryAction }: { secondaryActions: ReactNode; primaryAction?: { label: string; onClick: () => void } }) => <>{primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}{secondaryActions}</>,
    EmptyState: () => null, ConfirmActionModal: () => null, ConflictDialog: () => null, DegradedBanner: () => null,
    ErrorState: () => null, NotFoundState: () => null, PermissionGate: Slot, Skeleton: () => null,
    Select: Slot, SelectContent: Slot, SelectItem: Slot, SelectTrigger: Slot, SelectValue: () => null,
    useToast: () => ({}),
  };
});
vi.mock("../hooks/useDashboardDetail", () => ({
  useDashboardDetail: () => ({
    detail: dashboard, run: null, selection: {},
    availableCurrencies: [], isLoading: false, isRunning: false, reload: vi.fn(),
  }),
  isRevisionConflict: () => false,
}));
vi.mock("../hooks/useAvailableWidgets", () => ({
  useAvailableWidgets: () => ({ widgets: [], error: null }),
}));
vi.mock("../hooks/useDashboardSwitcher", () => ({
  useDashboardSwitcher: () => ({ items: [], unprovisionedTemplates: [] }),
}));
vi.mock("../hooks/useWidgetDrilldown", () => ({ useWidgetDrilldown: () => ({}) }));
vi.mock("./DashboardFilterBar", () => ({ DashboardFilterBar: () => null }));
vi.mock("./DashboardLayoutEditor", () => ({ DashboardLayoutEditor: () => <div>Layout editor</div> }));
vi.mock("./AddWidgetDrawer", () => ({ AddWidgetDrawer: () => null }));
vi.mock("./DashboardEditDrawer", () => ({ DashboardEditDrawer: () => null }));
vi.mock("./ShareDrawer", () => ({ ShareDrawer: () => null }));
vi.mock("./DrilldownSheet", () => ({ DrilldownSheet: () => null }));
vi.mock("./WidgetTile", () => ({ WidgetTile: ({ widget, onArchive, onVersion }: {
  widget: { name: string }; onArchive?: (anchor: HTMLButtonElement) => boolean;
  onVersion?: (name: string, anchor: HTMLButtonElement) => boolean;
}) => <>
  {onArchive && <button onClick={(event) => onArchive(event.currentTarget)}>{`Archive ${widget.name}`}</button>}
  {onVersion && <button onClick={(event) => onVersion(widget.name, event.currentTarget)}>{`Version of ${widget.name}`}</button>}
</> }));
vi.mock("../../../widgets/components/WidgetGovernanceDialog", () => ({ WidgetGovernanceDialog: () => null }));
vi.mock("./PlacementVersionDialog", () => ({ PlacementVersionDialog: () => null }));

beforeEach(() => {
  state.permissions = ["crm.dashboards.read.own"];
  dashboard.accessLevel = "OWNER";
  dashboard.placements = [];
  state.lang = "en";
  state.get.mockResolvedValue({ data: [] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("dashboard workspace action permissions", () => {
  it("allows a dashboard editor to review a shared widget placement without standalone widget permissions", async () => {
    const widgetId = "01900300-0000-7000-8000-000000000025";
    const placementId = "01900300-0000-7000-8000-000000000026";
    dashboard.placements = [{
      id: placementId, dashboardId: dashboard.id, widgetId, x: 0, y: 0, width: 4, height: 2, sortOrder: 0,
      widget: { id: widgetId, ownerUserId: widgetId, ownerName: null, name: "Shared",
        visualizationType: "METRIC_CARD", querySpec: { series: [{ metricKey: "crm.leads.created.count" }] },
        displaySpec: {}, schemaVersion: 1, revision: 1, createdAt: dashboard.createdAt, updatedAt: dashboard.updatedAt,
        accessLevel: "VIEW", isShared: true },
    }];
    state.permissions = ["crm.dashboards.read", "crm.dashboards.update"];
    dashboard.accessLevel = "VIEW";
    const { rerender } = render(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.queryByRole("button", { name: "Version of Shared" })).not.toBeInTheDocument();
    dashboard.accessLevel = "EDIT";
    rerender(<DashboardWorkspace dashboardId={dashboard.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Version of Shared" }));
    await waitFor(() => expect(state.get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/dashboards/${dashboard.id}/placements/${placementId}/version-policy`, expect.anything(),
    ));
    expect(screen.queryByRole("button", { name: "Archive Shared" })).not.toBeInTheDocument();
  });

  it("opens governance only for an owned widget and reads its definition ID instead of its placement ID", async () => {
    const widgetId = "01900300-0000-7000-8000-000000000010";
    const placementId = "01900300-0000-7000-8000-000000000011";
    const foreignWidgetId = "01900300-0000-7000-8000-000000000012";
    const ownedWidget = { id: widgetId, ownerUserId: dashboard.ownerUserId, ownerName: null, name: "Owned",
      visualizationType: "METRIC_CARD" as const, querySpec: { series: [{ metricKey: "crm.leads.created.count" }] },
      displaySpec: {}, schemaVersion: 1, revision: 1, createdAt: dashboard.createdAt, updatedAt: dashboard.updatedAt,
      accessLevel: "VIEW" as const, isShared: false };
    dashboard.placements = [
      { id: placementId, dashboardId: dashboard.id, widgetId, x: 0, y: 0, width: 4, height: 2, sortOrder: 0, widget: ownedWidget },
      { id: "01900300-0000-7000-8000-000000000013", dashboardId: dashboard.id, widgetId: foreignWidgetId,
        x: 4, y: 0, width: 4, height: 2, sortOrder: 1, widget: { ...ownedWidget, id: foreignWidgetId,
          ownerUserId: "01900300-0000-7000-8000-000000000014", name: "Shared" } },
    ];
    const { rerender } = render(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.queryByRole("button", { name: "Archive Owned" })).not.toBeInTheDocument();
    state.permissions = [...state.permissions, "crm.widgets.read", "crm.widgets.delete"];
    rerender(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.queryByRole("button", { name: "Archive Shared" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive Owned" }));
    await waitFor(() => expect(state.get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/widgets/${widgetId}`, expect.anything(),
    ));
  });

  it.each(["en", "ar"] as const)("keeps a read-only owner read-only in %s without loading shares", async (lang) => {
    state.lang = lang;
    const t = DICT_BY_LANG[lang];
    render(<DashboardWorkspace dashboardId={dashboard.id} />);
    await act(async () => {});
    for (const label of [t.crmDashboards.edit, t.crmDashboards.addWidget, t.crmDashboards.editLayout, t.crmDashboards.share]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    expect(screen.getByText(t.crmDashboards.editPermissionRequired)).toBeTruthy();
    expect(screen.getByText(t.crmDashboards.sharePermissionRequired)).toBeTruthy();
    expect(state.get).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "EDIT"] as const)("enables editing for %s only with update permission", async (accessLevel) => {
    dashboard.accessLevel = accessLevel;
    state.permissions.push("crm.dashboards.update");
    const { rerender } = render(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.getByRole("button", { name: en.crmDashboards.edit })).toBeTruthy();
    expect(screen.getByRole("button", { name: en.crmDashboards.addWidget })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.crmDashboards.editLayout }));
    expect(screen.getByText("Layout editor")).toBeTruthy();
    state.permissions = ["crm.dashboards.read.own"];
    rerender(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.queryByText("Layout editor")).toBeNull();
    expect(screen.queryByRole("button", { name: en.crmDashboards.edit })).toBeNull();
    await act(async () => {});
    expect(state.get).not.toHaveBeenCalled();
  });

  it("enables sharing independently of editing and loads shares for an owner", async () => {
    state.permissions.push("crm.dashboards.share");
    render(<DashboardWorkspace dashboardId={dashboard.id} />);
    expect(screen.getByRole("button", { name: en.crmDashboards.share })).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.crmDashboards.edit })).toBeNull();
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(1));
    expect(state.get.mock.calls[0][0]).toBe(`/api/tenant/crm/v1/dashboards/${dashboard.id}/shares`);
  });

  it.each(["EDIT", "VIEW"] as const)("does not grant sharing to %s access despite share permission", async (accessLevel) => {
    dashboard.accessLevel = accessLevel;
    state.permissions.push("crm.dashboards.share", "crm.dashboards.update");
    render(<DashboardWorkspace dashboardId={dashboard.id} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: en.crmDashboards.share })).toBeNull();
    expect(state.get).not.toHaveBeenCalled();
    if (accessLevel === "VIEW") {
      expect(screen.queryByRole("button", { name: en.crmDashboards.edit })).toBeNull();
      expect(screen.queryByText(en.crmDashboards.editPermissionRequired)).toBeNull();
    }
  });
});


