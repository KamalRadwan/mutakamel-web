// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { DetailHeader } from "@/design-system";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import type { LeadDetail } from "../../lead-contract";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { LeadDetailWorkspace } from "./lead-detail-workspace";

const deletion = vi.hoisted(() => ({
  allowed: false,
  push: vi.fn(),
  warning: vi.fn(),
  describeError: vi.fn(),
  lang: "en" as "ar" | "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: deletion.push }) }));
vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: () => ({ idempotencyKey: "01900100-0000-7000-8000-000000000099" }),
  runIdempotentWrite: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { ar, en }[deletion.lang], lang: deletion.lang }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: deletion.allowed }) }));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({ useCrmErrorText: () => deletion.describeError }));
vi.mock("../hooks/useLeadDetail", () => ({ useLeadDetail: vi.fn() }));
vi.mock("../../hooks/useLeadCapabilities", () => ({ useLeadCapabilities: () => ({ capabilities: { delete: deletion.allowed ? { scope: "all", ownerUserIds: null } : null } }) }));
vi.mock("../../../shared/hooks/useCrmAcquisitionSources", () => ({ useCrmAcquisitionSources: () => ({ items: [] }) }));
vi.mock("../hooks/useLeadCardEdit", () => ({ useLeadCardEdit: () => ({ saving: false, save: vi.fn() }) }));
vi.mock("../hooks/useLeadCompanyEdit", () => ({ useLeadCompanyEdit: () => ({}) }));
vi.mock("../hooks/useLeadConvert", () => ({ useLeadConvert: () => ({}) }));
vi.mock("../hooks/useLeadStageMove", () => ({ useLeadStageMove: () => ({}) }));
vi.mock("@/design-system", async () => {
  const actual = await vi.importActual<typeof import("@/design-system")>("@/design-system");
  return {
    ...actual,
    DegradedBanner: () => null,
    useToast: () => ({ warning: deletion.warning }),
    DetailHeader: vi.fn(() => null), ErrorState: () => null,
    PageActions: () => null, Skeleton: () => null, StatusBadge: () => null,
  };
});
vi.mock("../../../shared/components/CrmScopeGate", () => ({ CrmScopeGate: () => null }));
vi.mock("../../../shared/components/CustomFieldsCard", () => ({ CustomFieldsCard: () => null }));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({ RecordAttachmentsSection: () => null }));
vi.mock("../../../shared/components/RecordNotesSection", () => ({ RecordNotesSection: () => <section aria-label="Standalone notes" /> }));
vi.mock("@/components/activities/RecordActivitiesPanel", () => ({ RecordActivitiesPanel: () => <section aria-label="Inline activities" /> }));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: () => <section aria-label="Inline audit history" /> }));
vi.mock("@/components/audit/hooks/useAuditAccess", () => ({ useAuditAccess: () => true }));
vi.mock("./LeadRelatedNav", () => ({ LeadRelatedNav: () => null }));
vi.mock("./LeadConvertModal", () => ({ LeadConvertModal: () => null }));
// Keep stateful children so reconciliation is exercised without their API hooks.
vi.mock("./LeadCompanyCard", () => ({
  LeadCompanyCard: ({ lead }: { lead: LeadDetail }) => <input aria-label="Company draft" defaultValue={lead.displayName} />,
}));
vi.mock("./LeadContactsCard", () => ({
  LeadContactsCard: ({ lead }: { lead: LeadDetail }) => <input aria-label="Contacts draft" defaultValue={lead.displayName} />,
}));
vi.mock("./LeadIdentityCards", () => ({
  LeadIdentityCards: ({ lead }: { lead: LeadDetail }) => <input aria-label="Details draft" defaultValue={lead.displayName} />,
}));

const lead: LeadDetail = {
  id: "01900100-0000-7000-8000-000000000001", displayName: "Acme", leadProfileType: "CORPORATE",
  partyId: "01900100-0000-7000-8000-000000000003", contacts: [],
  acquisitionSourceNameAr: null, acquisitionSourceNameEn: null, status: "OPEN",
  branchId: "01900100-0000-7000-8000-000000000004",
  stageId: "01900100-0000-7000-8000-000000000005", stageFlag: "NEW",
  firstName: null, lastName: null, honorificTitle: null, companyName: "Acme",
  primaryMobile: null, email: null, companyPhone: null, companyEmail: null,
  companyWebsite: null, taxNumber: null, commercialRegistrationNumber: null,
  phones: [], address: null, acquisitionSourceId: null, description: null,
  interestSummary: null, expectedNeed: null, ownerUserId: null, createdByUserId: null,
  convertedCustomerProfileId: null, convertedOpportunityId: null, convertedAt: null,
  createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
};

function setLead(value: LeadDetail) {
  vi.mocked(useLeadDetail).mockReturnValue({
    lead: value, card: null, setCard: vi.fn(), stages: [], stageCatalogue: [], isLoading: false, isNotFound: false, isForbidden: false,
    error: null, stagesDegraded: false, setLead: vi.fn(), reload: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
  deletion.allowed = false;
  deletion.lang = "en";
  deletion.push.mockReset();
  deletion.warning.mockReset();
  deletion.describeError.mockReset();
  vi.mocked(runIdempotentWrite).mockReset();
  vi.restoreAllMocks();
});

describe("LeadDetailWorkspace not found", () => {
  it.each(["ar", "en"] as const)("renders the neutral 404 state in %s with a link back and no retry", (lang) => {
    deletion.lang = lang;
    const copy = { ar, en }[lang];
    setLead(lead);
    const detail = vi.mocked(useLeadDetail).getMockImplementation()!(lead.id);
    vi.mocked(useLeadDetail).mockReturnValue({
      ...detail,
      lead: null,
      error: { status: 404, code: "LEAD_NOT_FOUND" },
      isNotFound: true,
    });
    render(<LeadDetailWorkspace leadId={lead.id} />);
    expect(screen.getByText(copy.crmLeadDetail.notFoundTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.crmLeadDetail.notFoundDescription)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.crmLeadDetail.backToLeads })).toHaveAttribute("href", "/crm/leads");
    expect(screen.queryByRole("button", { name: copy.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Company draft")).not.toBeInTheDocument();
  });
});

describe("LeadDetailWorkspace card identity", () => {
  it.each(["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"] as const)("localizes the %s dossier status instead of displaying its wire value", (status) => {
    setLead({ ...lead, status });
    render(<LeadDetailWorkspace leadId={lead.id} />);
    expect(screen.getByText(`● ${en.common.status}: ${en.statusValues[`LeadStatus.${status}`]}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`\\b${status}\\b`))).toBeNull();
  });

  it("does not pass a page-wide Edit action to the top header", () => {
    setLead(lead);
    render(<LeadDetailWorkspace leadId={lead.id} />);
    const header = vi.mocked(DetailHeader).mock.calls.at(-1)?.[0];
    expect(header).toBeDefined();
    expect(header?.secondaryActions).toBeUndefined();
  });
  it("keeps one of each sibling card on refresh and resets drafts only when the lead changes", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    setLead(lead);
    const view = render(<LeadDetailWorkspace leadId={lead.id} />);
    expect(screen.queryByRole("region", { name: "Standalone notes" })).not.toBeInTheDocument();
    const labels = ["Company draft", "Contacts draft", "Details draft"];
    for (const label of labels) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: `${label} edited` } });
    }

    setLead({ ...lead, displayName: "Refreshed Acme" });
    view.rerender(<LeadDetailWorkspace leadId={lead.id} />);
    for (const label of labels) {
      expect(screen.getAllByLabelText(label)).toHaveLength(1);
      expect(screen.getByLabelText(label)).toHaveValue(`${label} edited`);
    }

    const nextLead = { ...lead, id: "01900100-0000-7000-8000-000000000002", displayName: "Another company" };
    setLead(nextLead);
    view.rerender(<LeadDetailWorkspace leadId={nextLead.id} />);
    for (const label of labels) {
      expect(screen.getAllByLabelText(label)).toHaveLength(1);
      expect(screen.getByLabelText(label)).toHaveValue("Another company");
    }
    expect(errors).not.toHaveBeenCalled();
  });

  it("renders No Color as the first card color dot, omits Party ID and fake source from subtitle, and switches inline Dossier tabs", () => {
    setLead(lead);
    render(<LeadDetailWorkspace leadId={lead.id} />);
    const colorGroup = screen.getByRole("group", { name: en.crmLeads.card.cardColor });
    const colorButtons = colorGroup.querySelectorAll("button");
    expect(colorButtons).toHaveLength(6);
    expect(colorButtons[0]).toHaveAttribute("aria-label", en.crmLeads.card.colorNone);
    expect(screen.queryByText(/Party ID/i)).toBeNull();
    expect(screen.queryByText(/Website Inquiry/i)).toBeNull();

    // Default tab is Activities; clicking Notes mounts RecordNotesSection inline
    expect(screen.getByRole("region", { name: "Inline activities" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: en.crmLeadDetail.notes }));
    expect(screen.getByRole("region", { name: "Standalone notes" })).toBeInTheDocument();
  });
});

describe("LeadDetailWorkspace deletion", () => {
  function openDelete() {
    deletion.allowed = true;
    setLead(lead);
    render(<LeadDetailWorkspace leadId={lead.id} />);
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    return { reload: vi.mocked(useLeadDetail).mock.results.at(-1)?.value.reload };
  }

  it("shows a 409 in the confirmation and allows retry followed by client navigation", async () => {
    const error = { status: 409 };
    deletion.describeError.mockReturnValue(en.crmShared.errorConflict);
    vi.mocked(runIdempotentWrite)
      .mockResolvedValueOnce({ kind: "failed", error })
      .mockResolvedValueOnce({ kind: "success", value: true, replayed: false });
    openDelete();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent(en.crmShared.errorConflict));
    expect(deletion.describeError).toHaveBeenCalledWith(error);
    expect(deletion.push).not.toHaveBeenCalled();
    const retry = within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(deletion.push).toHaveBeenCalledWith("/crm/leads"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(runIdempotentWrite).toHaveBeenCalledTimes(2);
  });

  it("can cancel and reopen after a refusal without retaining the error", async () => {
    deletion.describeError.mockReturnValue(en.crmShared.errorConflict);
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "failed", error: { status: 409 } });
    openDelete();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    await screen.findByText(new RegExp(en.crmShared.errorConflict));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.cancel }));
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent(en.crmShared.errorConflict);
    expect(runIdempotentWrite).toHaveBeenCalledTimes(1);
  });

  it.each(["ambiguous", "applied_unreadable"] as const)("reloads and explains an %s outcome without retrying", async (kind) => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind, error: { status: 0 } });
    const { reload } = openDelete();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(deletion.warning).toHaveBeenCalledWith(en.crmLeadDetail.deleteUnconfirmed, undefined, 0);
    expect(deletion.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(runIdempotentWrite).toHaveBeenCalledTimes(1);
  });
});
