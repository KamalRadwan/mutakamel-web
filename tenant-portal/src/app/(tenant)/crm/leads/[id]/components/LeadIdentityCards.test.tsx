// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadDetail } from "../../lead-contract";
import { LeadIdentityCards } from "./LeadIdentityCards";

const OWNER = "01900100-0000-7000-8000-000000000001";
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "01900100-0000-7000-8000-000000000001" } }) }));
vi.mock("../hooks/useLeadDetailsReferences", () => ({ useLeadDetailsReferences: () => ({
  knownUsers: new Map([["01900100-0000-7000-8000-000000000001", { id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan" }]]),
  ownerOptions: [{ id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan" }],
  tags: [{ id: "01900100-0000-7000-8000-000000000007", name: "Priority" }], tagsLoading: false, tagsUnavailable: false,
  canReadUsers: true, usersLoading: false, usersUnavailable: false,
}) }));

const lead = { id: "01900100-0000-7000-8000-000000000003", status: "OPEN", ownerUserId: OWNER, createdByUserId: OWNER, acquisitionSourceId: "01900100-0000-7000-8000-000000000004", acquisitionSourceNameEn: "Website", acquisitionSourceNameAr: "الموقع", createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T01:00:00.000Z", interestSummary: "Summary", expectedNeed: "Need", description: "Existing note" } as LeadDetail;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Lead details card", () => {
  it("keeps labels visible and fields accessible without unclaimed Field controls", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.getByText("Website")).toBeVisible();
    expect(screen.getByText("Priority")).toBeVisible();
    expect(screen.getAllByText("Kamal Radwan")).toHaveLength(2);
    expect(screen.getAllByText("KR")).toHaveLength(2);
    expect(screen.getAllByText(en.crmLeadDetail.createdBy).find((node) => node.tagName === "DT")).toBeVisible();
    const summary = screen.getByRole("textbox", { name: en.crmLeadDetail.interestSummary });
    expect(summary).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: en.crmLeads.source })).toHaveTextContent("Website");
    expect(screen.queryByRole("textbox", { name: en.crmLeadDetail.createdBy })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: en.crmLeadDetail.notes }), { target: { value: "Unsaved" } });
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.getByRole("textbox", { name: en.crmLeadDetail.notes })).toHaveValue("Existing note");
    expect(screen.getByRole("textbox", { name: en.crmLeadDetail.notes })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeDisabled();
    expect(consoleError).not.toHaveBeenCalled();
  });
  it("keeps the creator immutable and does not offer editing without capability", () => {
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit={false} allowedOwnerIds={[]} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.saveDetails })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: en.crmLeadDetail.salesPerson })).toBeDisabled();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    for (const field of screen.getAllByRole("textbox")) expect(field).toHaveAttribute("readonly");
  });
});
