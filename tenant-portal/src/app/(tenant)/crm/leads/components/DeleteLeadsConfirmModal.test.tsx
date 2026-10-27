// @vitest-environment jsdom

import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { parseLeadResponse } from "../lead-list-contract";
import { useLeadBulkDelete } from "../hooks/useLeadCardWrites";
import { useLeadMutations } from "../hooks/useLeadMutations";
import { DeleteLeadsConfirmModal } from "./DeleteLeadsConfirmModal";
import { LeadBulkActionsBar } from "./LeadBulkActionsBar";

const controls = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  post: vi.fn(),
  reconcile: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[controls.lang], lang: controls.lang }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, post: controls.post } };
});
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ success: controls.success, info: controls.info }),
}));

const BRANCH = "01900100-0000-7000-8000-000000000001";
const LEAD = "01900100-0000-7000-8000-000000000002";
const OTHER_LEAD = "01900100-0000-7000-8000-000000000003";
const OFF_PAGE = "01900100-0000-7000-8000-000000000004";
const OWNER = "01900100-0000-7000-8000-000000000005";
const OTHER_OWNER = "01900100-0000-7000-8000-000000000006";
const STAGE = "01900100-0000-7000-8000-000000000007";
const items = [LEAD, OTHER_LEAD].map((id) => parseLeadResponse({
  id, partyId: id, branchId: BRANCH, stageId: STAGE,
  displayName: "Lead", leadProfileType: "INDIVIDUAL",
  ownerUserId: id === LEAD ? OWNER : OTHER_OWNER,
}, BRANCH));
const initialSelection = [LEAD, OTHER_LEAD, OFF_PAGE];

function Harness({ branch = BRANCH, page = 1, search = "", allowDelete = true }) {
  const [selectedIds, onSelectionChange] = useState(new Set(initialSelection));
  const [error, setError] = useState<string | null>(null);
  const mutations = useLeadMutations({
    branchId: branch, items, stages: [],
    capabilities: { create: null, update: null, delete: allowDelete ? { scope: "own", ownerUserIds: [OWNER] } : null },
    setError, report: () => setError("Delete refused"), reconcile: controls.reconcile,
    currentPage: page, closeCreate: () => {}, resetSearch: () => {},
    selectedForDelete: null, setSelectedForDelete: () => {},
  });
  const bulk = useLeadBulkDelete({
    scopeKey: JSON.stringify([branch, page, search]), items, selectedIds, onSelectionChange,
    canDeleteLead: (lead) => allowDelete && lead.ownerUserId === OWNER,
    deleteLeads: mutations.bulkDeleteLeads, disabled: mutations.isDeleting,
  });
  return (
    <>
      <output data-testid="selection">{[...selectedIds].join(",")}</output>
      {createElement("button", { onClick: () => onSelectionChange(new Set([OTHER_LEAD])) }, "Select another lead")}
      <LeadBulkActionsBar
        selectedIds={selectedIds} stages={[]} canUpdateAny={false}
        owners={[]} ownersLoading={false} ownersFailed={false} onBulkAssignOwner={async () => {}}
        canDeleteAny={bulk.eligibleCount > 0} deleteEligibleCount={bulk.eligibleCount}
        isDeleting={mutations.isDeleting} onBulkMoveStage={async () => {}}
        onBulkSetRating={async () => {}} onBulkDelete={bulk.request}
        onClearSelection={() => onSelectionChange(new Set())}
      />
      <DeleteLeadsConfirmModal
        isOpen={bulk.isOpen} item={null}
        bulkCounts={{ eligible: bulk.eligibleCount, selected: bulk.selectedCount, skipped: bulk.skippedCount }}
        onClose={bulk.close} onConfirm={() => void bulk.confirm()}
        isDeleting={mutations.isDeleting || bulk.isPending} error={error}
      />
    </>
  );
}

beforeEach(() => {
  controls.lang = "en";
  controls.post.mockResolvedValue({ data: { deletedIds: [LEAD] } });
  controls.reconcile.mockResolvedValue(true);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function requestDelete() {
  fireEvent.click(screen.getByRole("button", { name: en.crmLeads.bulkDeleteLabel(1, 3) }));
  return screen.getByRole("alertdialog");
}

describe("bulk lead control labels", () => {
  it.each(["en", "ar"] as const)("offers rating without a tag or campaign action in %s", async (lang) => {
    controls.lang = lang;
    const dictionary = { en, ar }[lang];
    const rate = vi.fn().mockResolvedValue(undefined);
    render(<LeadBulkActionsBar
      selectedIds={new Set([LEAD])} stages={[]} canUpdateAny canDeleteAny={false}
      deleteEligibleCount={0} isDeleting={false} owners={[]} ownersLoading ownersFailed={false}
      onBulkAssignOwner={async () => {}} onBulkMoveStage={async () => {}}
      onBulkSetRating={rate} onBulkDelete={() => {}} onClearSelection={() => {}}
    />);
    expect(screen.getByRole("combobox", { name: dictionary.crmLeads.bulkAssignOwner })).toBeDisabled();
    expect(screen.getByText(dictionary.crmLeads.bulkSetRating)).toBeTruthy();
    expect(screen.queryByText(/Tags|Campaign|الوسوم|حملة/u)).toBeNull();
    const ratingLabel = { en: "Bulk set rating", ar: "تعيين التقييم جماعياً" }[lang];
    fireEvent.change(screen.getByRole("combobox", { name: ratingLabel }), { target: { value: "3" } });
    await waitFor(() => expect(rate).toHaveBeenCalledWith(3));
  });
});

describe("bulk lead deletion confirmation", () => {
  it("shows eligible and skipped counts, and Cancel sends no request", () => {
    render(<Harness />);
    const dialog = requestDelete();
    expect(dialog).toHaveAccessibleDescription(en.crmLeads.bulkDeleteMessage(1, 3, 2));
    expect(controls.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(controls.post).not.toHaveBeenCalled();
    expect(screen.getByTestId("selection")).toHaveTextContent(initialSelection.join(","));
  });

  it("Escape cancels without deleting or clearing selection", () => {
    render(<Harness />);
    fireEvent.keyDown(requestDelete(), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(controls.post).not.toHaveBeenCalled();
    expect(screen.getByTestId("selection")).toHaveTextContent(initialSelection.join(","));
  });

  it("sends only confirmed eligible IDs and clears selection after success", async () => {
    render(<Harness />);
    fireEvent.click(within(requestDelete()).getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(screen.getByTestId("selection")).toBeEmptyDOMElement());
    expect(controls.post).toHaveBeenCalledOnce();
    expect(controls.post).toHaveBeenCalledWith(
      "/api/tenant/crm/v1/leads/bulk-delete", { branchId: BRANCH, leadIds: [LEAD] },
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }),
    );
    expect(controls.success).toHaveBeenCalledWith(en.crmLeads.bulkDeleteCompleted(1), en.crmLeads.bulkDeleteSkipped(2));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps selection and count context on a failed delete and reports skips", async () => {
    controls.post.mockRejectedValue(new Error("Delete refused"));
    render(<Harness />);
    const dialog = requestDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(dialog).toHaveTextContent("Delete refused"));
    expect(dialog).toHaveTextContent(en.crmLeads.bulkDeleteMessage(1, 3, 2));
    expect(screen.getByTestId("selection")).toHaveTextContent(initialSelection.join(","));
    expect(controls.reconcile).toHaveBeenCalledOnce();
    expect(controls.success).not.toHaveBeenCalled();
    expect(controls.info).toHaveBeenCalledWith(en.crmLeads.bulkDeleteSkipped(2));
  });

  it.each([{ branch: "other-branch" }, { page: 2 }, { search: "new search" }])(
    "clears selection and dismisses stale confirmation when scope changes: %j", (props) => {
      const { rerender } = render(<Harness />);
      requestDelete();
      rerender(<Harness {...props} />);
      expect(screen.getByTestId("selection")).toBeEmptyDOMElement();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(controls.post).not.toHaveBeenCalled();
    },
  );

  it("does not clear a new scope's selection when an earlier delete completes", async () => {
    let resolve!: (value: unknown) => void;
    controls.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { rerender } = render(<Harness />);
    const dialog = requestDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.delete }));
    expect(within(dialog).getByRole("button", { name: en.crmLeads.deleting })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: en.crmLeads.deleting }));
    rerender(<Harness page={2} />);
    rerender(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Select another lead" }));
    await act(async () => resolve({ data: { deletedIds: [LEAD] } }));
    await waitFor(() => expect(controls.success).toHaveBeenCalledOnce());
    expect(screen.getByTestId("selection")).toHaveTextContent(OTHER_LEAD);
    expect(controls.post).toHaveBeenCalledOnce();
  });

  it("allows closing when access disappears while confirmation is open", () => {
    const { rerender } = render(<Harness />);
    requestDelete();
    rerender(<Harness allowDelete={false} />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription(en.crmLeads.bulkDeleteMessage(0, 3, 3));
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.close }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(controls.post).not.toHaveBeenCalled();
  });

  it("renders Arabic counts with Western digits", () => {
    controls.lang = "ar";
    render(<div dir="rtl"><Harness /></div>);
    fireEvent.click(screen.getByRole("button", { name: ar.crmLeads.bulkDeleteLabel(1, 3) }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription(ar.crmLeads.bulkDeleteMessage(1, 3, 2));
    expect(dialog).toHaveTextContent("1 من 3");
    fireEvent.click(within(dialog).getByRole("button", { name: ar.common.cancel }));
    expect(controls.post).not.toHaveBeenCalled();
  });
});
