// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { LeadDetail } from "../../lead-contract";
import type { LeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import { LeadCompanyCard } from "./LeadCompanyCard";

const { locale } = vi.hoisted(() => ({ locale: { language: "en" as "en" | "ar" } }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" };

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: dictionaries[locale.language], lang: locale.language, dir: directions[locale.language] }),
}));

const lead = {
  id: "01900100-0000-7000-8000-0000000000a1",
  leadProfileType: "CORPORATE",
  companyName: "Acme LLC",
  companyEmail: "info@acme.test",
  companyWebsite: "https://acme.test",
  taxNumber: "TAX-100",
  commercialRegistrationNumber: "CR-200",
  phones: ["+20221001100", "+201050049899"],
  address: {
    addressType: "LEGAL", label: null, country: "Egypt", city: "Cairo",
    area: null, street: "Nile Street", buildingNo: "12", floor: null,
    apartment: "Suite 8", landmark: null, postalCode: "11511",
  },
  contacts: [{
    partyId: "01900100-0000-7000-8000-0000000000c1", relationshipId: null,
    displayName: "Dina Ali", firstName: "Dina", lastName: "Ali",
    honorificTitle: null, jobTitle: "Procurement Manager", isPrimary: true,
    email: "dina@acme.test", phones: ["+201112223334"],
  }],
} as unknown as LeadDetail;

function renderCard(options: { readOnly?: boolean; subject?: LeadDetail; saved?: boolean } = {}) {
  const save = vi.fn<LeadCompanyEdit["save"]>().mockResolvedValue(options.saved ?? true);
  const edit: LeadCompanyEdit = { savingKey: null, error: null, clearError: vi.fn(), save };
  render(
    <I18nProvider>
      <LeadCompanyCard lead={options.subject ?? lead} edit={edit} readOnly={options.readOnly ?? false} />
    </I18nProvider>,
  );
  return { save };
}

async function openEditor() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: en.crmLeadDetail.editCompany })));
  return within(screen.getByRole("dialog", { name: en.crmLeadDetail.editCompany }));
}
async function pressSave() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: en.crmLeadDetail.saveCompany })));
}

afterEach(() => { cleanup(); locale.language = "en"; });

describe("LeadCompanyCard", () => {
  it.each(["en", "ar"] as const)("gives the registration label its full single-line width in %s without enlarging its font", (language) => {
    locale.language = language;
    renderCard();
    const copy = dictionaries[language];
    const label = screen.getByText(copy.crmLeads.create.commercialRegistrationNumber, { selector: "dt" });
    expect(label).toHaveClass("text-xs", "whitespace-nowrap");
    expect(label).not.toHaveClass("text-base", "font-medium", "whitespace-pre-line");
    expect(label.textContent).toBe(copy.crmLeads.create.commercialRegistrationNumber);
    expect(label.closest("dl")).toHaveClass(
      "grid-cols-[max-content_minmax(0,1fr)]",
      "sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]",
    );
    expect(within(label.parentElement!).getByText("CR-200")).toHaveAttribute("dir", "ltr");
  });

  it("opens a prefilled company-only modal and keeps the underlying card read-only", async () => {
    renderCard();
    expect(screen.queryByRole("textbox")).toBeNull();
    const modal = await openEditor();
    expect(modal.getByRole<HTMLInputElement>("textbox", { name: en.crmLeads.companyName }).value).toBe("Acme LLC");
    expect(modal.getByLabelText<HTMLInputElement>(en.crmLeads.create.taxNumber).value).toBe("TAX-100");
    expect(modal.getByLabelText<HTMLInputElement>(en.crmLeads.create.street1).value).toBe("Nile Street");
    expect(modal.getByLabelText<HTMLInputElement>(en.crmLeads.create.street2).value).toBe("Suite 8");
    expect(modal.queryByText("Dina Ali")).toBeNull();
    expect(modal.queryByText(en.crmLeads.create.sections.contacts)).toBeNull();
    expect(modal.queryByLabelText("Call +20221001100")).toBeNull();
  });

  it("sends one patch with changed fields only, then closes", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.change(modal.getByRole("textbox", { name: en.crmLeads.companyName }), { target: { value: "Acme Trading" } });
    await pressSave();
    expect(save).toHaveBeenCalledExactlyOnceWith("company", { companyName: "Acme Trading" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears nullable fields but blocks an empty company name with a field error", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.change(modal.getByLabelText(en.crmLeads.create.taxNumber), { target: { value: "" } });
    fireEvent.change(modal.getByRole("textbox", { name: en.crmLeads.companyName }), { target: { value: "  " } });
    await pressSave();
    expect(save).not.toHaveBeenCalled();
    expect(modal.getByText(en.crmShared.fieldRequired)).toBeTruthy();
    fireEvent.change(modal.getByRole("textbox", { name: en.crmLeads.companyName }), { target: { value: "Acme LLC" } });
    await pressSave();
    expect(save).toHaveBeenCalledWith("company", { taxNumber: null });
  });

  it("retains malformed email for correction instead of closing as a no-op", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.change(modal.getByLabelText(en.crmLeadDetail.companyEmail), { target: { value: "not-an-address" } });
    await pressSave();
    expect(save).not.toHaveBeenCalled();
    expect(modal.getByText(en.crmShared.fieldEmail)).toBeTruthy();
    expect(modal.getByLabelText<HTMLInputElement>(en.crmLeadDetail.companyEmail).value).toBe("not-an-address");
  });

  it("closes an unchanged form without a write, including a company with no numbers", async () => {
    const { save } = renderCard({ subject: { ...lead, phones: [] } });
    const modal = await openEditor();
    expect(modal.getAllByLabelText(en.crmLeadDetail.companyPhones)).toHaveLength(1);
    await pressSave();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("guards dirty cancel, then discards without a write", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.change(modal.getByLabelText(en.crmLeads.create.taxNumber), { target: { value: "TAX-999" } });
    fireEvent.click(modal.getByRole("button", { name: en.common.cancel }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.common.discardConfirm })));
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("TAX-100")).toBeTruthy();
  });

  it("retains a valid draft when the server rejects it", async () => {
    const { save } = renderCard({ saved: false });
    const modal = await openEditor();
    fireEvent.change(modal.getByRole("textbox", { name: en.crmLeads.companyName }), { target: { value: "Acme Draft" } });
    await pressSave();
    expect(save).toHaveBeenCalledOnce();
    expect(modal.getByRole<HTMLInputElement>("textbox", { name: en.crmLeads.companyName }).value).toBe("Acme Draft");
  });

  it("saves the entire phone list and retains its country code", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    const numbers = modal.getAllByLabelText<HTMLInputElement>(/Company phones|Phone \d/);
    expect(numbers[0].value).toBe("221001100");
    fireEvent.change(numbers[0], { target: { value: "1050049800" } });
    await pressSave();
    expect(save).toHaveBeenCalledWith("company", { companyPhones: ["+201050049800", "+201050049899"] });
  });

  it("adds and removes phone rows with the existing calling code", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.click(modal.getByText(en.crmShared.addPhone));
    const rows = modal.getAllByLabelText(/Company phones|Phone \d/);
    expect(rows).toHaveLength(3);
    fireEvent.change(rows[2], { target: { value: "1112223334" } });
    fireEvent.click(modal.getByLabelText("Remove phone 1"));
    await pressSave();
    expect(save).toHaveBeenCalledWith("company", { companyPhones: ["+201050049899", "+201112223334"] });
  });

  it("stops adding phones at the DTO limit", async () => {
    renderCard({ subject: { ...lead, phones: Array.from({ length: 10 }, (_, at) => `+2010500498${String(at).padStart(2, "0")}`) } });
    expect((await openEditor()).queryByText(en.crmShared.addPhone)).toBeNull();
  });

  it("sends a whole address without contacts when one address field changes", async () => {
    const { save } = renderCard();
    const modal = await openEditor();
    fireEvent.change(modal.getByLabelText(en.crmLeads.create.buildingNo), { target: { value: "15" } });
    await pressSave();
    expect(save).toHaveBeenCalledWith("company", { address: {
      country: "Egypt", city: "Cairo", state: "", street1: "Nile Street",
      street2: "Suite 8", buildingNo: "15", floor: "", landmark: "", postalCode: "11511",
    } });
  });

  it("keeps an unsupported non-LEGAL address read-only", async () => {
    renderCard({ subject: { ...lead, address: { ...lead.address!, addressType: "SHIPPING" } } });
    const modal = await openEditor();
    expect(modal.getByLabelText(en.crmLeads.create.buildingNo)).toBeDisabled();
    expect(modal.getByRole("textbox", { name: en.crmLeads.companyName })).not.toBeDisabled();
  });

  it("preserves call, messaging, email, and company location display without contacts", () => {
    renderCard();
    expect(screen.getByLabelText("Call +20221001100")).toHaveAttribute("href", "tel:+20221001100");
    expect(screen.getByLabelText("Message +20221001100 on WhatsApp")).toHaveAttribute("href", "https://wa.me/20221001100");
    expect(screen.getByLabelText("Message +201050049899 on Telegram")).toHaveAttribute("href", "https://t.me/+201050049899");
    expect(screen.getByLabelText(en.crmLeadDetail.sendEmail)).toHaveAttribute("href", "mailto:info@acme.test");
    expect(screen.getByText("Egypt / Cairo")).toBeTruthy();
    expect(screen.queryByText("Dina Ali")).toBeNull();
  });

  it("normalizes international presentation but withholds international links for local numbers", () => {
    renderCard({ subject: { ...lead, phones: ["00201050049899", "01050049899"] } });
    expect(screen.getByText("+201050049899")).toBeTruthy();
    expect(screen.getByLabelText("Call 01050049899")).toBeTruthy();
    expect(screen.queryByLabelText("Message 01050049899 on WhatsApp")).toBeNull();
    expect(screen.queryByLabelText("Message 01050049899 on Telegram")).toBeNull();
  });

  it("withholds editing without capability", () => {
    renderCard({ readOnly: true });
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.editCompany })).toBeNull();
    expect(screen.getByLabelText("Call +20221001100")).toBeTruthy();
  });
});
