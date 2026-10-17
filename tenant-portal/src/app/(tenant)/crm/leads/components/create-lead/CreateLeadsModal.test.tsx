// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { emptyCreateLeadForm } from "../../lead-create-contract";
import { validateCreateLead } from "../../lead-create-validation";
import { LeadContactsSection } from "./LeadContactsSection";
import { LeadFieldGuide } from "./LeadFieldGuide";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

describe("LeadFieldGuide (! hover/focus tooltip)", () => {
  it("stays hidden by default and reveals DTO key, description, rule, and example on hover or focus", () => {
    render(
      <I18nProvider>
        <LeadFieldGuide field="firstName" />
      </I18nProvider>,
    );

    const badge = screen.getByRole("note");
    expect(badge).toHaveTextContent("!");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("First Name");
    expect(tooltip).toHaveTextContent("firstName (Required · Max 80 chars)");
    expect(tooltip).toHaveTextContent("Required on Individual leads");

    fireEvent.mouseLeave(badge);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(badge);
    expect(screen.getByRole("tooltip")).toHaveTextContent("First Name");
    fireEvent.blur(badge);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("LeadContactsSection & LeadContactRow", () => {
  it("renders contact cards with primary contact selection, add/remove contact, and field guides", () => {
    const onContactChange = vi.fn();
    const onPrimaryChange = vi.fn();
    const onAdd = vi.fn();
    const onRemove = vi.fn();

    const form = {
      ...emptyCreateLeadForm("contact-1"),
      leadProfileType: "CORPORATE" as const,
      contacts: [
        {
          key: "contact-1",
          contactPartyId: "",
          fullName: "",
          firstName: "Noura",
          lastName: "Al-Qahtani",
          honorificTitle: "Ms.",
          jobTitle: "Procurement Director",
          email: "noura@acme.sa",
          phones: ["+966501234567"],
          isPrimary: true,
        },
        {
          key: "contact-2",
          contactPartyId: "",
          fullName: "",
          firstName: "Fahad",
          lastName: "Saleh",
          honorificTitle: "Mr.",
          jobTitle: "IT Manager",
          email: "fahad@acme.sa",
          phones: ["+966559876543"],
          isPrimary: false,
        },
      ],
    };

    render(
      <I18nProvider>
        <LeadContactsSection
          form={form}
          directoryContacts={[]}
          isLoadingContacts={false}
          errors={{}}
          disabled={false}
          onContactChange={onContactChange}
          onPrimaryChange={onPrimaryChange}
          onAdd={onAdd}
          onRemove={onRemove}
          onPhoneChange={vi.fn()}
          onPhoneAdd={vi.fn()}
          onPhoneRemove={vi.fn()}
          onBlur={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("2 / 20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Noura")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fahad")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.create.addContact }));
    expect(onAdd).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Remove contact 2" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});

describe("Corporate companyEmail and companyWebsite validation", () => {
  const messages = {
    required: "Required.",
    email: "Invalid email.",
    url: "Invalid URL.",
    maxLength: "Max {max}.",
    duplicatePhone: "Duplicate phone.",
    contactRequired: "Contact required.",
    contactsLimit: "Too many contacts.",
    tagsLimit: "Too many tags.",
    tagsInvalid: "Invalid tags.",
  };

  it("validates companyEmail format and companyWebsite length on new corporate leads", () => {
    const form = {
      ...emptyCreateLeadForm("contact-1"),
      leadProfileType: "CORPORATE" as const,
      acquisitionSourceId: "01900100-0000-7000-8000-0000000000c1",
      companyName: "Al-Futtaim Logistics",
      companyEmail: "not-an-email",
      companyWebsite: `https://${"a".repeat(260)}.com`,
      contacts: [
        {
          key: "contact-1",
          contactPartyId: "",
          fullName: "",
          firstName: "Noura",
          lastName: "",
          honorificTitle: "",
          jobTitle: "",
          email: "",
          phones: ["+966501234567"],
          isPrimary: true,
        },
      ],
    };

    const errors = validateCreateLead(form, messages);
    expect(errors.companyEmail).toBe("Invalid email.");
    expect(errors.companyWebsite).toBe("Max 255.");

    const validErrors = validateCreateLead(
      {
        ...form,
        companyEmail: "info@alfuttaim.sa",
        companyWebsite: "https://alfuttaim.sa",
      },
      messages,
    );
    expect(validErrors.companyEmail).toBeUndefined();
    expect(validErrors.companyWebsite).toBeUndefined();
  });
});
