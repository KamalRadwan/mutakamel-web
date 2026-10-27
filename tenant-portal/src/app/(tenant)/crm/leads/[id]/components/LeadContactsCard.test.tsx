// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { readCrmBody } from "@/lib/api/envelope";
import type { LeadDetail } from "../../lead-contract";
import { LeadContactsCard } from "./LeadContactsCard";
import { fetchLeadDetail } from "../../lead-requests";

vi.mock("../../lead-requests", () => ({ fetchLeadDetail: vi.fn() }));

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/lib/api/idempotent-write", () => ({
  runIdempotentWrite: vi.fn(),
  createWriteAttempt: () => ({ idempotencyKey: "01900100-0000-7000-8000-000000000001" }),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/lib/api/envelope", async (original) => ({ ...(await original<typeof import("@/lib/api/envelope")>()), readCrmBody: vi.fn() }));
vi.mock("../../lead-contract", async (original) => ({ ...(await original<typeof import("../../lead-contract")>()), parseLeadDetailResponse: (payload: unknown) => payload }));

const corporate = {
  id: "01900100-0000-7000-8000-000000000001", status: "OPEN", leadProfileType: "CORPORATE",
  updatedAt: "2026-10-26T10:00:00.123Z",
  displayName: "Company display name", companyName: "Acme LLC", companyEmail: "company@acme.test",
  firstName: null, lastName: null, honorificTitle: null, email: "company@acme.test",
  primaryMobile: null, phones: ["+20221001100"],
  contacts: [
    { partyId: "01900100-0000-7000-8000-000000000011", relationshipId: null,
      displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms",
      jobTitle: "Procurement Manager", isPrimary: true, email: "dina@acme.test", phones: ["+201112223334"] },
    { partyId: "01900100-0000-7000-8000-000000000012", relationshipId: null,
      displayName: "Omar Adel", firstName: "Omar", lastName: "Adel", honorificTitle: "Mr",
      jobTitle: "Director", isPrimary: false, email: "omar@acme.test", phones: [] },
  ],
} as unknown as LeadDetail;

const individual = {
  ...corporate, leadProfileType: "INDIVIDUAL", displayName: "Mona Hassan", firstName: "Mona", lastName: "Hassan",
  honorificTitle: "Dr", email: "mona@example.test", phones: ["+20105551234"], primaryMobile: "+20105551234", contacts: [],
} as LeadDetail;

function renderCard(lead = corporate, canEdit = true) {
  vi.mocked(fetchLeadDetail).mockResolvedValue({ lead, card: null });
  return render(<I18nProvider><LeadContactsCard lead={lead} canEdit={canEdit} onSaved={vi.fn()} onReconcile={vi.fn()} /></I18nProvider>);
}
const openEditor = (name = "Dina Ali") => fireEvent.click(screen.getByRole("button", { name: en.crmLeadDetail.editContact + ": " + name }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCrmBody).mockResolvedValue(corporate);
  vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", value: corporate, replayed: false });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LeadContactsCard", () => {
  it("places contact cards in one shared two-column grid from the small viewport breakpoint", () => {
    renderCard();
    const section = screen.getByRole("region", { name: en.crmLeads.create.sections.contacts });
    expect(section).toHaveClass("w-full");
    const grid = section.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    expect(grid).not.toHaveClass("@2xl:grid-cols-2");
    expect(grid?.children).toHaveLength(2);
    expect(grid?.children[0]).toContainElement(screen.getByText("Dina Ali"));
    expect(grid?.children[1]).toContainElement(screen.getByText("Omar Adel"));
  });

  it("shows the lead's contact people and their details without duplicating company data", () => {
    renderCard();
    expect(screen.getAllByRole("heading", { name: en.crmLeads.create.sections.contacts })).toHaveLength(1);
    expect(screen.getByText("Dina Ali")).toBeTruthy();
    expect(screen.getByText("Omar Adel")).toBeTruthy();
    expect(screen.getByText("Procurement Manager")).toBeTruthy();
    expect(screen.queryByText("Dina")).toBeNull();
    expect(screen.queryByText("Ali")).toBeNull();
    expect(screen.queryByText("Ms")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Edit contact:/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "dina@acme.test" }).getAttribute("href")).toBe("mailto:dina@acme.test");
    expect(screen.getByText("+201112223334")).toBeTruthy();
    expect(screen.queryByText("Company display name")).toBeNull();
    expect(screen.queryByText("company@acme.test")).toBeNull();
    expect(screen.queryByText("+20221001100")).toBeNull();
    expect(screen.queryByText("Acme LLC")).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it.each([
    { name: "corporate contacts", lead: corporate, names: ["Dina Ali", "Omar Adel"] },
    { name: "individual contact", lead: individual, names: ["Mona Hassan"] },
  ])("shares one full-width Contacts header above the full-name data rows for $name", ({ lead, names }) => {
    renderCard(lead);
    expect(screen.getByRole("region", { name: en.crmLeads.create.sections.contacts })).toHaveClass("w-full");
    expect(screen.getAllByRole("heading", { name: en.crmLeads.create.sections.contacts })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: en.crmLeads.create.sections.contacts, level: 2 })).not.toHaveClass("sr-only");
    for (const name of names) {
      expect(screen.queryByRole("heading", { name })).toBeNull();
      const value = screen.getByText(name).closest("dd");
      expect(value).not.toBeNull();
      expect(value?.previousElementSibling).toHaveTextContent(en.crmLeadDetail.fullName);
      expect(within(value!).getByRole("button", { name: en.crmLeadDetail.editContact + ": " + name })).toBeTruthy();
      expect(Array.from(value!.closest("dl")!.querySelectorAll("dt"), (label) => label.textContent)).toEqual([
        en.crmLeadDetail.fullName, en.crmLeadConvert.contactJobTitle, en.crmLeads.phone, en.crmLeads.email,
      ]);
    }
    if (lead.leadProfileType === "CORPORATE") {
      expect(screen.getByText(en.crmLeadDetail.primaryContact).closest("dd"))
        .toBe(screen.getByText("Dina Ali").closest("dd"));
    }
  });

  it("opens only the selected contact in a modal, hides the original read card while editing, and gates identity by Directory permissions", () => {
    renderCard();
    openEditor();
    // Original card for Dina Ali is hidden while editing; Omar Adel remains in the card list
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.editContact + ": Dina Ali", hidden: true })).toBeNull();
    expect(screen.getByRole("button", { name: en.crmLeadDetail.editContact + ": Omar Adel", hidden: true })).toBeTruthy();
    const modal = within(screen.getByRole("dialog"));
    expect(modal.getByText(en.crmLeadDetail.contactIdentityPermission)).toBeTruthy();
    expect(modal.getByRole("button", { name: en.crmLeadConvert.contactJobTitle })).toBeTruthy();
    expect(modal.getByLabelText<HTMLSelectElement>(en.crmLeadDetail.honorificTitle).tagName).toBe("SELECT");
    expect(modal.getByLabelText<HTMLInputElement>(en.crmLeadDetail.fullName).value).toBe("Dina Ali");
    expect(modal.getByLabelText(en.crmLeadDetail.fullName)).toHaveAttribute("readonly");
    expect(modal.queryByDisplayValue("Omar Adel")).toBeNull();
    expect(modal.queryByText("company@acme.test")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Edit contact:/ })).toHaveLength(2);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it("opens supported individual fields together and restores persisted values on cancel", () => {
    renderCard(individual);
    expect(screen.getByText("Mona Hassan")).toBeTruthy();
    openEditor("Mona Hassan");
    expect(screen.getByLabelText<HTMLInputElement>(en.crmLeads.name).value).toBe("Mona Hassan");
    expect(screen.getByLabelText<HTMLInputElement>(en.crmLeadDetail.firstName).value).toBe("Mona");
    expect(screen.getByLabelText<HTMLInputElement>(en.crmLeadDetail.lastName).value).toBe("Hassan");
    expect(screen.getByLabelText<HTMLInputElement>(en.crmLeadDetail.honorificTitle).value).toBe("Dr");
    expect(screen.getByLabelText<HTMLInputElement>(en.crmLeads.email).value).toBe("mona@example.test");
    expect(screen.getByLabelText(en.crmLeads.phone)).toBeTruthy();
    expect(screen.queryByText(en.crmLeadDetail.contactIdentityPermission)).toBeNull();
    fireEvent.change(screen.getByLabelText(en.crmLeadDetail.firstName), { target: { value: "Mena" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    fireEvent.click(screen.getByRole("button", { name: en.common.discardConfirm }));
    expect(screen.getByText("Mona Hassan")).toBeTruthy();
    expect(screen.queryByText("Mena")).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it.each([
    { name: "no update capability", lead: corporate, canEdit: false },
    { name: "converted lead", lead: { ...corporate, status: "CONVERTED" } as LeadDetail, canEdit: true },
    { name: "empty corporate contacts", lead: { ...corporate, contacts: [] }, canEdit: true },
  ])("withholds the editor for $name", ({ lead, canEdit }) => {
    renderCard(lead, canEdit);
    expect(screen.queryAllByRole("button", { name: /^Edit contact:/ })).toHaveLength(0);
    if (lead.contacts.length === 0) expect(screen.getByText(en.crmLeadDetail.contactsEmpty)).toBeTruthy();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it("supports inline Add Contact form with Honorific dropdown, Job Title picker, and validation", () => {
    renderCard(corporate, true);
    expect(screen.getByRole("button", { name: /Set Primary/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.create.addContact }));
    expect(screen.getByLabelText<HTMLSelectElement>(en.crmLeadDetail.honorificTitle).tagName).toBe("SELECT");
    expect(screen.getByRole("button", { name: en.crmLeadConvert.contactJobTitle })).toBeTruthy();
    // Saving with empty name shows required validation error without calling API
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    expect(screen.getByText(en.crmLeads.create.errors.required)).toBeTruthy();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    // Cancel closes the inline Add Contact form
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.queryByText(en.crmLeads.create.errors.required)).toBeNull();
  });

  it("sends only relationship DTO keys when Set Primary is activated", async () => {
    renderCard();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Set Primary/i })); });
    expect(fetchLeadDetail).toHaveBeenCalledExactlyOnceWith(corporate.id, undefined);
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ method: "patch", body: { expectedUpdatedAt: corporate.updatedAt, contacts: [
      { contactPartyId: corporate.contacts[0].partyId, jobTitle: "Procurement Manager", isPrimary: false },
      { contactPartyId: corporate.contacts[1].partyId, jobTitle: "Director", isPrimary: true },
    ] } }));
  });

  it("adds a contact using fullName while retaining the linked people", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.create.addContact }));
    fireEvent.change(screen.getByLabelText(en.crmLeadDetail.fullName), { target: { value: "Mona Hassan" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: en.common.save })); });
    const body = vi.mocked(runIdempotentWrite).mock.calls[0][0].body as { contacts: Record<string, unknown>[] };
    expect(Object.keys(body).sort()).toEqual(["contacts", "expectedUpdatedAt"]);
    expect(body.contacts.map((row) => Object.keys(row).sort())).toEqual([
      ["contactPartyId", "isPrimary", "jobTitle"], ["contactPartyId", "isPrimary", "jobTitle"],
      ["email", "firstName", "fullName", "honorificTitle", "isPrimary", "jobTitle", "lastName", "phones"],
    ]);
    expect(body.contacts[2]).toMatchObject({ fullName: "Mona Hassan", isPrimary: false });
    expect(screen.queryByRole("button", { name: en.common.save })).toBeNull();
  });

  it("requires Retry after an uncertain add and clears the submitted draft", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.create.addContact }));
    fireEvent.change(screen.getByLabelText(en.crmLeadDetail.fullName), { target: { value: "Mona" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: en.common.save })); });
    expect(screen.getByText(en.crmLeadDetail.contactReloadRequired)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.crmLeads.create.addContact })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Set Primary/i })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: en.common.retry })); });
    expect(screen.getByRole("button", { name: en.crmLeads.create.addContact })).not.toBeDisabled();
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
  });
});
