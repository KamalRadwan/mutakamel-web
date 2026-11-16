// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { en } from "@/i18n/dictionaries/en";
import { EMPTY_OPPORTUNITY_FORM } from "../../opportunity-write-contract";
import { OpportunityDetailWorkspace } from "./opportunity-detail-workspace";

const mocks = vi.hoisted(() => ({ setField: vi.fn(), submit: vi.fn(), requestStage: vi.fn(), openTransfer: vi.fn(), canUpdate: true, pipelineAvailable: true, targetActive: true }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => "Request failed" }));
vi.mock("./OpportunitySavedFeedback", () => ({ OpportunitySavedFeedback: () => null }));
vi.mock("./OpportunitySavedPanels", () => ({ OpportunitySavedPanels: () => null }));
vi.mock("./OpportunitySavedDialogs", () => ({ OpportunitySavedDialogs: () => null }));
vi.mock("./OpportunitySavedTags", () => ({ OpportunitySavedTags: () => null }));
vi.mock("./OpportunityRelatedNav", () => ({ OpportunityRelatedNav: () => <nav aria-label="Customer business" /> }));
vi.mock("@/design-system", async (original) => ({ ...(await original<typeof import("@/design-system")>()), PageActions: ({ children }: { children: ReactNode }) => children }));
vi.mock("../hooks/useOpportunitySavedWorkspace", () => ({ useOpportunitySavedWorkspace: () => {
  const item = {
    id: "01900100-0000-7000-8000-000000000001", branchId: "01900100-0000-7000-8000-000000000002", customerProfileId: "01900100-0000-7000-8000-000000000003",
    title: "Renew service contract", status: "IN_PROGRESS", importance: 2, customerDisplayName: "Nile Engineering", customerCompanyName: "Nile Engineering", primaryContact: null, tags: [], leadId: null,
    pipelineId: "01900100-0000-7000-8000-000000000006", stageId: "01900100-0000-7000-8000-000000000004", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z",
  };
  const lookups = { owners: { items: [], isLoading: false, error: null, reload: vi.fn() }, customer: { item: { profileType: "CORPORATE" }, contacts: [], sourceLeads: [], isLoading: false, error: null, reload: vi.fn() } };
  const stages = [{ id: item.stageId, nameEn: "New", nameAr: "جديد", flag: "NEW" }, { id: "01900100-0000-7000-8000-000000000005", nameEn: "Proposal", nameAr: "عرض", flag: "PROPOSAL" }];
  return { detail: { isLoading: false, item, pipelines: [{ id: "01900100-0000-7000-8000-000000000007", isActive: mocks.targetActive }], degraded: {}, reload: vi.fn() }, item, canUpdate: mocks.canUpdate, canDelete: false, locked: false,
    edit: { form: { ...EMPTY_OPPORTUNITY_FORM, ...item, importance: "2", amount: "", currencyCode: "", description: "", probabilityPercent: "50", expectedCloseDate: "", customFields: {} },
      isDirty: true, errors: {}, definitions: [], requiredFieldKeys: [], setField: mocks.setField, touch: vi.fn(), submit: mocks.submit, revert: vi.fn() },
    commands: {}, requestCommand: (action: () => void) => action(), requestStage: mocks.requestStage, lookups, formLookups: lookups, branchLabel: "Cairo HQ", currencyOptions: ["EGP"],
    pipeline: mocks.pipelineAvailable ? { nameEn: "Enterprise Sales", nameAr: "مبيعات", stages } : null, currentStage: mocks.pipelineAvailable ? stages[0] : null, transfer: { openDialog: mocks.openTransfer },
  };
} }));

beforeEach(() => { vi.clearAllMocks(); mocks.canUpdate = true; mocks.pipelineAvailable = true; mocks.targetActive = true; });
afterEach(cleanup);
describe("Saved opportunity full form", () => {
  it("keeps the existing record crumb and provides the same labeled editable form directly", () => {
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    const crumb = screen.getByTitle("Renew service contract");
    expect(crumb).toHaveAttribute("aria-current", "page");
    expect(crumb.previousElementSibling).toHaveClass("rtl:-scale-x-100");
    expect(screen.getByRole("textbox", { name: en.crmOpportunities.title })).toHaveValue("Renew service contract");
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.edit })).not.toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Customer business" })).toHaveLength(1);
    const customer = within(screen.getByRole("link", { name: /Nile Engineering/u }));
    expect(customer.getAllByText("Nile Engineering")).toHaveLength(1);
    expect(customer.getByText(en.crmCustomerProfiles.profileTypes.CORPORATE)).toBeInTheDocument();
  });
  it("collects zero importance in the body and waits for an explicit Save", () => {
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    const stars = within(screen.getByRole("radiogroup", { name: en.crmOpportunities.importance }));
    fireEvent.click(stars.getByRole("radio", { checked: true }));
    expect(mocks.setField).toHaveBeenCalledWith("importance", "0");
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.crmOpportunityDetail.form.saveChanges }));
    expect(mocks.submit).toHaveBeenCalledOnce();
  });
  it("keeps customer and source lead read-only and routes stage changes through a separate command", () => {
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    expect(screen.getByRole("link", { name: /Nile Engineering/u })).toHaveAttribute("href", "/crm/customer-profiles/01900100-0000-7000-8000-000000000003");
    expect(screen.getByRole("textbox", { name: en.crmOpportunityDetail.form.sourceLead })).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Proposal" }));
    expect(mocks.requestStage).toHaveBeenCalledWith("01900100-0000-7000-8000-000000000005");
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("renders the record without ordinary write controls when update is denied", () => {
    mocks.canUpdate = false;
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    expect(screen.queryByRole("button", { name: en.crmOpportunityDetail.form.saveChanges })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: en.crmOpportunities.title })).toBeDisabled();
    expect(within(screen.getByRole("radiogroup", { name: en.crmOpportunities.importance })).getAllByRole("radio").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
  it("keeps ordinary edits available when the current pipeline is unavailable and permits the sole active transfer target", () => {
    mocks.pipelineAvailable = false;
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    expect(screen.getByRole("textbox", { name: en.crmOpportunityDetail.form.currentPipeline })).toHaveValue(en.crmOpportunityDetail.form.pipelineUnavailable);
    expect(screen.getByRole("textbox", { name: en.crmOpportunityDetail.form.currentStage })).toHaveValue(en.crmOpportunityDetail.form.stageUnavailable);
    expect(screen.queryByRole("button", { name: "Proposal" })).not.toBeInTheDocument();
    expect(mocks.requestStage).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: en.crmOpportunities.title })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: en.crmOpportunityDetail.form.saveChanges }));
    expect(mocks.submit).toHaveBeenCalledOnce();
    const transfer = screen.getByRole("button", { name: en.crmOpportunityDetail.transferAction });
    expect(transfer).toBeEnabled();
    fireEvent.click(transfer);
    expect(mocks.openTransfer).toHaveBeenCalledOnce();
  });
  it("does not offer transfer to an inactive pipeline", () => {
    mocks.pipelineAvailable = false; mocks.targetActive = false;
    render(<OpportunityDetailWorkspace opportunityId="01900100-0000-7000-8000-000000000001" />);
    expect(screen.getByRole("button", { name: en.crmOpportunityDetail.transferAction })).toBeDisabled();
  });
});
