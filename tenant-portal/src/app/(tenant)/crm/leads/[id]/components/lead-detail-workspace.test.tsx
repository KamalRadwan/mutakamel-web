// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { DetailHeader } from "@/design-system";
import type { LeadDetail } from "../../lead-contract";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { LeadDetailWorkspace } from "./lead-detail-workspace";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: false }) }));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => null }));
vi.mock("../hooks/useLeadDetail", () => ({ useLeadDetail: vi.fn() }));
vi.mock("../../hooks/useLeadCapabilities", () => ({ useLeadCapabilities: () => ({ capabilities: {} }) }));
vi.mock("../../../shared/hooks/useCrmAcquisitionSources", () => ({ useCrmAcquisitionSources: () => ({ items: [] }) }));
vi.mock("../hooks/useLeadCompanyEdit", () => ({ useLeadCompanyEdit: () => ({}) }));
vi.mock("../hooks/useLeadConvert", () => ({ useLeadConvert: () => ({}) }));
vi.mock("../hooks/useLeadStageMove", () => ({ useLeadStageMove: () => ({}) }));
vi.mock("@/design-system", () => ({
  Button: () => null, ConfirmActionModal: () => null, DegradedBanner: () => null,
  DetailHeader: vi.fn(() => null), ErrorState: () => null, NotFoundState: () => null,
  PageActions: () => null, Skeleton: () => null, StageBar: () => null, StatusBadge: () => null,
}));
vi.mock("../../../shared/components/CrmScopeGate", () => ({ CrmScopeGate: () => null }));
vi.mock("../../../shared/components/CustomFieldsCard", () => ({ CustomFieldsCard: () => null }));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({ RecordAttachmentsSection: () => null }));
vi.mock("../../../shared/components/RecordNotesSection", () => ({ RecordNotesSection: () => <section aria-label="Standalone notes" /> }));
vi.mock("@/components/audit/EntityHistoryCard", () => ({ EntityHistoryCard: () => null }));
vi.mock("./LeadRelatedNav", () => ({ LeadRelatedNav: () => null }));
vi.mock("./LeadDetailSidePanel", () => ({ LeadDetailSidePanel: () => <section aria-label="Lead side panel" /> }));
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
    lead: value, stages: [], stageCatalogue: [], isLoading: false, isNotFound: false, isForbidden: false,
    error: null, stagesDegraded: false, setLead: vi.fn(), reload: vi.fn(),
  });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LeadDetailWorkspace card identity", () => {
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
});
