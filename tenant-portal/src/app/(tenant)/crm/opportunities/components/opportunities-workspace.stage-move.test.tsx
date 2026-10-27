// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { OpportunitiesWorkspace } from "./opportunities-workspace";

const state = vi.hoisted(() => ({
  view: "table" as "table" | "card",
  allowedOwners: ["allowed"],
  deleteOpportunity: vi.fn<(id: string) => Promise<boolean>>(),
  write: vi.fn(),
  reload: vi.fn(async () => undefined),
  fetchPipelines: vi.fn(),
  items: [
    { id: "one", title: "One", ownerUserId: "allowed", stageId: "stage" },
    { id: "two", title: "Two", ownerUserId: "allowed", stageId: "stage" },
    { id: "three", title: "Three", ownerUserId: "denied", stageId: "stage" },
  ],
}));
vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: () => ({ idempotencyKey: "attempt" }),
  runIdempotentWrite: state.write,
}));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../opportunity-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../opportunity-contract")>()),
  opportunityPath: (id: string) => `/api/tenant/crm/v1/opportunities/${id}`,
}));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/patterns/confirm-action/ConfirmActionModal")),
  useWorkspaceState: () => ({ view: state.view, page: 1, setView: vi.fn() }),
  PageHeader: () => null, PageActions: () => null, Select: () => null,
  SelectContent: () => null, SelectItem: () => null, SelectTrigger: () => null,
  SelectValue: () => null, Skeleton: () => null, ViewSwitcher: () => null,
  DegradedBanner: () => null, EmptyState: () => null, ErrorState: () => null,
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
  }),
}));
vi.mock("../hooks/usePipelineWorkspace", () => ({
  buildStageMoveRequest: (stageId: string, _flag: string, reason?: string) => ({ stageId, ...(reason ? { reason } : {}) }),
  opportunityCapabilityAllowsOwner: (capability: { ownerUserIds: string[] } | null, owner: string) =>
    Boolean(capability?.ownerUserIds.includes(owner)),
  usePipelineWorkspace: () => ({
    capabilities: { update: { ownerUserIds: state.allowedOwners }, delete: { ownerUserIds: state.allowedOwners } },
    pipelines: [{ id: "pipeline", stages: [{ id: "open", nameEn: "Open", flag: "PROPOSAL" }, { id: "won", nameEn: "Won", flag: "WON" }] }], branchIds: ["branch"],
    branchId: "branch", selectedPipelineId: "pipeline",
    reopenMove: null, refreshCapabilities: state.fetchPipelines, cancelReopenMove: vi.fn(),
    terminalMove: null, fetchPipelines: state.fetchPipelines,
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
vi.mock("./TerminalMoveDialog", () => ({
  TerminalMoveDialog: ({ isOpen, onClose, onConfirm, opportunity }: {
    isOpen: boolean; onClose: () => void;
    onConfirm: (reason: string) => Promise<boolean>; opportunity: { title: string } | null;
  }) => isOpen ? <div role="dialog">
    {opportunity?.title}
    {createElement("button", { onClick: onClose }, "Cancel move")}
    {createElement("button", { onClick: () => void onConfirm("Closing notes") }, "Confirm move")}
  </div> : null,
}));

function SelectionView({ selectedIds, onSelectionChange, onMoveStage, onBulkMoveStage }: {
  onMoveStage: (item: typeof state.items[number], stageId: string) => void;
  onBulkMoveStage?: (stageId: string) => Promise<void>;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  return <>
    {createElement("button", { onClick: () => onMoveStage(state.items[0], "open") }, "Move one")}
    {onBulkMoveStage && createElement("button", { onClick: () => void onBulkMoveStage("won") }, "Toolbar Won")}
    {createElement("button", { onClick: () => onSelectionChange(new Set(state.items.map(({ id }) => id))) }, "Select all")}
    <output data-testid="selection">{[...selectedIds].join(",")}</output>
  </>;
}
vi.mock("./OpportunityExecutiveTableView", () => ({ OpportunityExecutiveTableView: SelectionView }));
vi.mock("./OpportunityExecutiveCardView", () => ({ OpportunityExecutiveCardView: SelectionView }));

beforeEach(() => {
  vi.clearAllMocks();
  state.allowedOwners = ["allowed"];
  state.write.mockReset().mockResolvedValue({ kind: "success", value: {}, replayed: false });
});
afterEach(cleanup);

describe.each(["table", "card"] as const)("%s stage moves", (view) => {
  beforeEach(() => { state.view = view; });

  it("shows a refused single move", async () => {
    state.write.mockResolvedValue({ kind: "failed", error: { status: 403 } });
    render(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Move one" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", en.crmOpportunities.moveFailed);
  });

  it("keeps refused and skipped rows selected after a partial bulk move", async () => {
    state.write.mockResolvedValueOnce({ kind: "success", value: {} })
      .mockResolvedValueOnce({ kind: "failed", error: { status: 403 } });
    render(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.change(screen.getByRole("combobox", { name: en.crmOpportunities.bulkMoveStage }), { target: { value: "open" } });
    await screen.findByText(en.crmOpportunities.moveFailed);
    expect(state.write).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("selection").textContent).toBe("two,three");
  });

  it("confirms bulk Won and sends closing notes only after confirmation", async () => {
    render(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.change(screen.getByRole("combobox", { name: en.crmOpportunities.bulkMoveStage }), { target: { value: "won" } });
    expect(screen.getByRole("dialog").textContent).toContain(en.crmOpportunities.bulkMoveSelection(2));
    expect(state.write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));
    await waitFor(() => expect(state.write).toHaveBeenCalledTimes(2));
    expect(state.write.mock.calls[0][0].body).toEqual({ stageId: "won", reason: "Closing notes" });
    await waitFor(() => expect(screen.getByTestId("selection").textContent).toBe("three"));
  });

  it("cancels Won without writing and rechecks scope before confirmation", async () => {
    const rendered = render(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    const select = screen.getByRole("combobox", { name: en.crmOpportunities.bulkMoveStage });
    fireEvent.change(select, { target: { value: "won" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel move" }));
    expect(state.write).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "won" } });
    state.allowedOwners = ["denied"];
    rendered.rerender(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.write).not.toHaveBeenCalled();
  });

  it("warns and refreshes an uncertain move", async () => {
    state.write.mockResolvedValue({ kind: "ambiguous", error: { status: 0 } });
    render(<OpportunitiesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Move one" }));
    await screen.findByText(en.crmOpportunities.stageMoveUncertain);
    expect(state.reload).toHaveBeenCalled();
  });
});

it("routes the card toolbar Won through the same confirmation", () => {
  state.view = "card";
  render(<OpportunitiesWorkspace />);
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  fireEvent.click(screen.getByRole("button", { name: "Toolbar Won" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(state.write).not.toHaveBeenCalled();
});
