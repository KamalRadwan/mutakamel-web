// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { LeadDetail } from "../../lead-contract";
import { LeadDetailSidePanel } from "./LeadDetailSidePanel";

const mocks = vi.hoisted(() => ({ history: vi.fn(), activities: vi.fn(), attachments: vi.fn(), arabic: false }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({
  t: mocks.arabic ? ar : en, lang: mocks.arabic ? "ar" : "en", dir: mocks.arabic ? "rtl" : "ltr",
}) }));
vi.mock("@/components/audit/EntityHistoryCard", () => ({ EntityHistoryCard: (props: unknown) => {
  mocks.history(props); return <p>History content</p>;
} }));
vi.mock("./LeadActivitiesPanel", () => ({ LeadActivitiesPanel: (props: unknown) => {
  mocks.activities(props); return <p>Activities content</p>;
} }));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({ RecordAttachmentsSection: (props: unknown) => {
  mocks.attachments(props); return <input aria-label="Upload queue state" defaultValue="" />;
} }));

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
const capabilities = { attachmentsCreate: null, attachmentsDelete: null };
function select(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.arabic = false; });

describe("Lead detail side panel", () => {
  it("defaults to History with three named icons and loads other panels only on demand", () => {
    render(<LeadDetailSidePanel lead={lead} capabilities={capabilities} readOnly={false} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("History content");
    expect(mocks.activities).not.toHaveBeenCalled();
    expect(mocks.attachments).not.toHaveBeenCalled();
    expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({
      entityType: "Lead", entityId: lead.id, relatedPartyIds: [lead.partyId], refreshToken: lead,
    }));
    select("Activities");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Activities content");
    expect(screen.queryByText("History content")).toBeNull();
    expect(mocks.attachments).not.toHaveBeenCalled();
  });
  it("keeps an attachment upload mounted but hidden while switching panels", () => {
    render(<LeadDetailSidePanel lead={lead} capabilities={capabilities} readOnly />);
    select("Attachments");
    const input = screen.getByRole("textbox", { name: "Upload queue state" });
    fireEvent.change(input, { target: { value: "Uploading file.pdf" } });
    select("Activities");
    expect(input).not.toBeVisible();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    select("Attachments");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("Uploading file.pdf");
    expect(mocks.attachments).toHaveBeenLastCalledWith(expect.objectContaining({
      branchId: lead.branchId, sourceType: "LEAD", sourceId: lead.id,
      readOnly: true, uploadVariant: "button",
    }));
    select("History");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("History content");
  });
  it("uses translated icon labels and RTL direction", () => {
    mocks.arabic = true;
    const { container } = render(<LeadDetailSidePanel lead={lead} capabilities={capabilities} readOnly />);
    expect(screen.getByRole("tab", { name: ar.audit.historyTitle })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: ar.crmLeads.activities.title })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: ar.attachments.title })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
  });
  it("supports switching tabs with the keyboard", async () => {
    render(<LeadDetailSidePanel lead={lead} capabilities={capabilities} readOnly />);
    const history = screen.getByRole("tab", { name: "History" });
    history.focus();
    fireEvent.keyDown(history, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Activities" })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Activities content");
  });
});
