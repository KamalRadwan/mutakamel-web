// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { OpportunitiesWorkspace } from "./opportunities-workspace";

const state = vi.hoisted(() => ({
  view: "table" as "table" | "card" | "board",
  loadStatus: 0,
  listStatus: 0,
  allowedOwners: ["allowed"],
  deleteOpportunity: vi.fn<(id: string) => Promise<boolean>>(),
  reload: vi.fn(async () => undefined),
  fetchPipelines: vi.fn(),
  items: [
    { id: "one", title: "One", ownerUserId: "allowed", stageId: "stage" },
    { id: "two", title: "Two", ownerUserId: "allowed", stageId: "stage" },
    { id: "three", title: "Three", ownerUserId: "denied", stageId: "stage" },
  ],
}));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/patterns/confirm-action/ConfirmActionModal")),
  useWorkspaceState: () => ({ view: state.view, page: 1, setView: vi.fn() }),
  PageHeader: () => null, PageActions: () => null, Select: () => null,
  SelectContent: () => null, SelectItem: () => null, SelectTrigger: () => null,
  SelectValue: () => null, Skeleton: () => null, ViewSwitcher: () => null,
  DegradedBanner: () => null, EmptyState: () => null,
  ErrorState: ({ onRetry }: { onRetry: () => void }) => createElement("button", { onClick: onRetry }, "Retry pipelines"),
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "), proseMeasure: "",
}));
vi.mock("../hooks/useDeleteOpportunity", () => ({
  useDeleteOpportunity: () => ({
    deleteOpportunity: state.deleteOpportunity, isDeleting: false,
    error: null, clearError: vi.fn(),
  }),
}));
vi.mock("../hooks/useOpportunitiesList", () => ({
  useOpportunitiesList: () => ({
    items: state.items, search: { mode: "basic", basic: { filters: [] } },
    pageInfo: { total: 3 }, reload: state.reload,
    error: state.listStatus ? { status: state.listStatus } : null,
  }),
}));
vi.mock("../hooks/usePipelineWorkspace", () => ({
  opportunityCapabilityAllowsOwner: (capability: { ownerUserIds: string[] } | null, owner: string) =>
    Boolean(capability?.ownerUserIds.includes(owner)),
  usePipelineWorkspace: () => ({
    capabilities: { delete: { ownerUserIds: state.allowedOwners } },
    pipelines: [{ id: "pipeline", stages: [] }], branchIds: ["branch"],
    branchId: "branch", selectedPipelineId: "pipeline",
    reopenMove: null, refreshCapabilities: state.fetchPipelines, cancelReopenMove: vi.fn(),
    terminalMove: null, fetchPipelines: state.fetchPipelines,
    loadError: state.loadStatus ? { status: state.loadStatus } : null,
    setBasicSearch: vi.fn(),
  }),
}));
vi.mock("../hooks/useCreateOpportunity", () => ({ useCreateOpportunity: () => ({}) }));
vi.mock("../hooks/useOpportunityDocumentCounts", () => ({ useOpportunityDocumentCounts: () => ({}) }));
vi.mock("../../shared/hooks/useCrmCreateCustomFields", () => ({ useCrmCreateCustomFields: () => ({}) }));
vi.mock("../../shared/hooks/useCrmFieldMessages", () => ({ useCrmFieldMessages: () => ({}) }));
vi.mock("@/components/activities/ActivitiesWorkspaceLink", () => ({ ActivitiesWorkspaceLink: () => null }));
vi.mock("@/components/activities/ActivityModal", () => ({ ActivityModal: () => null }));
vi.mock("@/components/tenant/TenantBranchSelect", () => ({ TenantBranchSelect: () => null }));
vi.mock("./CreateOpportunityModal", () => ({ CreateOpportunityModal: () => null }));
vi.mock("./DeleteOpportunityDialog", () => ({ DeleteOpportunityDialog: () => null }));
vi.mock("./OpportunityExecutiveBoardView", () => ({ OpportunityExecutiveBoardView: () => null }));
vi.mock("./OpportunityQuickEditModal", () => ({ OpportunityQuickEditModal: () => null }));
vi.mock("./OpportunitySearchBar", () => ({ OpportunitySearchBar: () => null }));
vi.mock("./OpportunityStageFunnelBar", () => ({ OpportunityStageFunnelBar: () => null }));
vi.mock("./TerminalMoveDialog", () => ({ TerminalMoveDialog: () => null }));

function SelectionView({ selectedIds, onSelectionChange }: {
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  return <>
    {createElement("button", { onClick: () => onSelectionChange(new Set(state.items.map(({ id }) => id))) }, "Select all")}
    <output data-testid="selection">{[...selectedIds].join(",")}</output>
  </>;
}
vi.mock("./OpportunityExecutiveTableView", () => ({ OpportunityExecutiveTableView: SelectionView }));
vi.mock("./OpportunityExecutiveCardView", () => ({ OpportunityExecutiveCardView: SelectionView }));

beforeEach(() => {
  vi.clearAllMocks();
  state.loadStatus = 0;
  state.listStatus = 0;
  state.allowedOwners = ["allowed"];
  state.deleteOpportunity.mockReset().mockResolvedValue(true);
});
afterEach(cleanup);

function requestDeletion() {
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  fireEvent.click(screen.getByRole("button", { name: en.crmOpportunities.bulkDeleteAction(2) }));
  return screen.getByRole("alertdialog");
}

describe.each(["table", "card"] as const)("%s opportunity bulk deletion", (view) => {
  beforeEach(() => { state.view = view; });

  it("confirms the eligible count and allows cancel without deleting", () => {
    render(<OpportunitiesWorkspace />);
    const dialog = requestDeletion();
    expect(within(dialog).getByText(en.crmOpportunities.bulkDeleteMessage(2))).toBeTruthy();
    expect(state.deleteOpportunity).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(state.deleteOpportunity).not.toHaveBeenCalled();
    expect(screen.getByTestId("selection").textContent).toBe("one,two,three");
  });

  it("reports partial failure, skips out-of-scope rows and retains their selection", async () => {
    state.deleteOpportunity.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<OpportunitiesWorkspace />);
    fireEvent.click(within(requestDeletion()).getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(state.deleteOpportunity.mock.calls).toEqual([["one"], ["two"]]);
    expect(screen.getByRole("alert").textContent).toBe(en.crmOpportunities.bulkDeleteSummary(1, 1, 1));
    expect(screen.getByTestId("selection").textContent).toBe("two,three");
    expect(state.reload).toHaveBeenCalledOnce();
  });

  it("reports success without counting skipped rows as deleted", async () => {
    render(<OpportunitiesWorkspace />);
    fireEvent.click(within(requestDeletion()).getByRole("button", { name: en.common.delete }));
    await screen.findByText(en.crmOpportunities.bulkDeleteSummary(2, 0, 1));
    expect(screen.getByTestId("selection").textContent).toBe("three");
  });

  it("reports a fully refused batch and retains every selected row", async () => {
    state.deleteOpportunity.mockResolvedValue(false);
    render(<OpportunitiesWorkspace />);
    fireEvent.click(within(requestDeletion()).getByRole("button", { name: en.common.delete }));
    await screen.findByText(en.crmOpportunities.bulkDeleteSummary(0, 2, 1));
    expect(screen.getByTestId("selection").textContent).toBe("one,two,three");
  });

  it("rechecks scope and never adds newly eligible rows to the confirmed set", async () => {
    const rendered = render(<OpportunitiesWorkspace />);
    requestDeletion();
    state.allowedOwners = ["denied"];
    rendered.rerender(<OpportunitiesWorkspace />);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    await screen.findByText(en.crmOpportunities.bulkDeleteSummary(0, 0, 3));
    expect(state.deleteOpportunity).not.toHaveBeenCalled();
  });

  it("blocks duplicate confirmation and keeps loading through the entire batch", async () => {
    let resolveDelete!: (result: boolean) => void;
    state.deleteOpportunity.mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveDelete = resolve; }));
    render(<OpportunitiesWorkspace />);
    const dialog = requestDeletion();
    const confirm = within(dialog).getByRole("button", { name: en.common.delete });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(state.deleteOpportunity).toHaveBeenCalledTimes(1);
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect((within(dialog).getByRole("button", { name: en.common.cancel }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolveDelete(true); });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(state.deleteOpportunity.mock.calls).toEqual([["one"], ["two"]]);
  });
});

describe.each(["table", "card", "board"] as const)("%s pipeline access boundary", (view) => {
  it("renders a scope gate for a server 403", () => {
    state.view = view;
    state.loadStatus = 403;
    render(<OpportunitiesWorkspace />);
    expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry pipelines" })).toBeNull();
    expect(screen.queryByText(en.crmOpportunities.noPipelineTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();
  });

  it("keeps a server outage retryable", () => {
    state.view = view;
    state.loadStatus = 500;
    render(<OpportunitiesWorkspace />);
    expect(screen.queryByText(en.crmShared.scopeDeniedTitle)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry pipelines" }));
    expect(state.fetchPipelines).toHaveBeenCalledOnce();
  });
});

it.each(["table", "card"] as const)("renders a list scope denial in %s", (view) => {
  state.view = view;
  state.listStatus = 403;
  render(<OpportunitiesWorkspace />);
  expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();
});
