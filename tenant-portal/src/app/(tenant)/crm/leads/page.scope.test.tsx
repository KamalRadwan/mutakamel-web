// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { DEFAULT_LEAD_SEARCH } from "./lead-search-contract";
import LeadsPage from "./page";

const { state, selectBranch } = vi.hoisted(() => ({
  state: { view: "card", denied: true, boardStatus: 403, canMutate: true },
  selectBranch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: state.canMutate }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  Button: ({ children }: { children: ReactNode }) => createElement("button", null, children),
  DegradedBanner: ({ message }: { message: string }) => <p>{message}</p>,
  EmptyState: () => <p>Empty</p>,
  PageHeader: ({ secondaryActions, primaryAction }: { secondaryActions: ReactNode; primaryAction?: { label: string } }) => <div>{secondaryActions}{primaryAction && <button>{primaryAction.label}</button>}</div>,
  PermissionGate: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewSwitcher: () => null,
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
  proseMeasure: "",
  useWorkspaceState: () => ({
    view: state.view, setView: vi.fn(), sort: { id: "createdAt", direction: "desc" },
    page: 1, selection: { selectedIds: new Set(["lead"]), onSelectionChange: vi.fn() },
  }),
}));
vi.mock("@/components/tenant/TenantBranchSelect", () => ({
  TenantBranchSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    createElement("button", { onClick: () => onChange("other-branch") }, "Choose another branch")
  ),
}));
vi.mock("./hooks/useLeads", () => ({
  DEFAULT_LEADS_SORT: { id: "createdAt", direction: "desc" },
  useLeads: () => ({
    board: {
      items: [], totals: new Map(), lanes: {}, loadingStageIds: new Set(),
      isLoading: false, error: { status: state.boardStatus, message: "Load failed" },
    },
    items: [], stages: [], branchIds: ["branch", "other-branch"], branchId: "branch",
    selectBranch, canCreate: true, canUpdateLead: () => true, canDeleteLead: () => true,
    isLoading: false, isDeleting: false, isMovePending: false, error: null,
    scopeDenied: state.denied,
    loadError: { status: state.denied ? 403 : 500, message: "Load failed" },
    degraded: { stages: true, capabilities: true },
    search: DEFAULT_LEAD_SEARCH, appliedSearch: DEFAULT_LEAD_SEARCH,
    pageInfo: { page: 1 }, sort: { id: "createdAt", direction: "desc" },
    activeView: "card", setActiveView: vi.fn(),
    isCreateOpen: false, selectedForDelete: null,
  }),
}));
vi.mock("./hooks/useLeadMutations", () => ({ useLeadBulkOwnerOptions: () => ({ owners: [], isLoading: false, failed: false }) }));
vi.mock("./hooks/useLeadDocumentCounts", () => ({ useLeadDocumentCounts: () => ({ countsByParty: new Map() }) }));
vi.mock("./hooks/useLeadKpis", () => ({ useLeadKpis: () => ({}) }));
vi.mock("./hooks/useLeadCardWrites", () => ({ useLeadBulkDelete: () => ({ eligibleCount: 0 }) }));
vi.mock("@/components/activities/ActivitiesWorkspaceLink", () => ({ ActivitiesWorkspaceLink: () => null }));
vi.mock("@/components/activities/ActivityModal", () => ({ ActivityModal: () => null }));
vi.mock("./components/CreateLeadsModal", () => ({ CreateLeadsModal: () => null }));
vi.mock("./components/DeleteLeadsConfirmModal", () => ({ DeleteLeadsConfirmModal: () => null }));
vi.mock("./components/LeadBulkActionsBar", () => ({ LeadBulkActionsBar: () => <p>Bulk writes</p> }));
vi.mock("./components/LeadKpiStrip", () => ({ LeadKpiStrip: () => null }));
vi.mock("./components/LeadQuickEditModal", () => ({ LeadQuickEditModal: () => null }));
vi.mock("./components/LeadStageFunnelBar", () => ({ LeadStageFunnelBar: () => null }));
vi.mock("./components/LeadSearchBar", () => ({ LeadSearchBar: () => null }));
vi.mock("./components/LeadExecutiveBoardView", () => ({ LeadExecutiveBoardView: () => createElement("button", null, "Retry board") }));
vi.mock("./components/LeadExecutiveCardView", () => ({ LeadExecutiveCardView: () => createElement("button", null, "Retry cards") }));
vi.mock("./components/LeadExecutiveTableView", () => ({ LeadExecutiveTableView: () => createElement("button", null, "Retry table") }));

afterEach(() => { cleanup(); vi.clearAllMocks(); state.canMutate = true; });

describe("Leads branch scope boundary", () => {
  it.each(["card", "table", "board"])("hides create and selected-row writes in read-only %s", (view) => {
    state.view = view;
    state.denied = false;
    state.boardStatus = 500;
    state.canMutate = false;
    render(<LeadsPage />);
    expect(screen.queryByRole("button", { name: en.crmLeads.addLead })).toBeNull();
    expect(screen.queryByText("Bulk writes")).toBeNull();
  });

  it.each(["card", "table", "board"])("shows scope copy without a retryable view in %s", (view) => {
    state.view = view;
    state.denied = true;
    state.boardStatus = 403;
    render(<LeadsPage />);
    expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeTruthy();
    expect(screen.getByText(en.crmShared.scopeDeniedDescription)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retry/u })).toBeNull();
    expect(screen.queryByText(en.crmLeads.capabilitiesUnavailable)).toBeNull();
    expect(screen.queryByText(en.crmLeads.stagesUnavailable)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose another branch" }));
    expect(selectBranch).toHaveBeenCalledWith("other-branch");
  });

  it.each(["card", "table", "board"])("keeps server errors retryable in %s", (view) => {
    state.view = view;
    state.denied = false;
    state.boardStatus = 500;
    render(<LeadsPage />);
    expect(screen.queryByText(en.crmShared.scopeDeniedTitle)).toBeNull();
    expect(screen.getByRole("button", { name: /Retry/u })).toBeTruthy();
    expect(screen.getByText(en.crmLeads.capabilitiesUnavailable)).toBeTruthy();
  });
});
