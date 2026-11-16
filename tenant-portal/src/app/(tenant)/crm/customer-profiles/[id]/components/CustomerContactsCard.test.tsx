// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { CustomerContactsCard } from "./CustomerContactsCard";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: vi.fn(),
  runIdempotentWrite: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const profile: CustomerProfileDetail = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  displayName: "Al-Amal Hospital",
  firstName: null,
  lastName: null,
  honorificTitle: null,
  jobTitle: null,
  companyName: "Al-Amal Healthcare Co.",
  companyEmail: "company@alamal.med.sa",
  companyPhone: "+966112345678",
  companyWebsite: "https://alamal.med.sa",
  email: "info@alamal.med.sa",
  primaryMobile: null,
  phones: ["+966112345678"],
  address: { country: "Saudi Arabia", city: "Riyadh", area: null, street: null },
  contacts: [
    {
      partyId: "0192f3a0-0000-7000-8000-000000000004",
      relationshipId: "0192f3a0-0000-7000-8000-000000000005",
      displayName: "Mona Saleh",
      firstName: "Mona",
      lastName: "Saleh",
      honorificTitle: "Ms",
      jobTitle: "Procurement Manager",
      isPrimary: true,
      email: "mona@alamal.med.sa",
      phones: ["+966501234567"],
    },
  ],
  taxNumber: null,
  commercialRegistrationNumber: null,
  legalName: null,
  description: null,
  ownerUserId: null,
  sourceLeadId: null,
  acquisitionSourceId: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-10T12:00:00Z",
};

describe("CustomerContactsCard", () => {
  it("renders the corporate primary contact with public details and phone actions", () => {
    render(
      <CustomerContactsCard
        profile={profile}
        canEdit
        onAddContact={vi.fn()}
      />,
    );

    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("Procurement Manager")).toBeInTheDocument();
    expect(screen.getByText(en.crmLeadDetail.primaryContact)).toBeInTheDocument();
    expect(screen.getByText("mona@alamal.med.sa").closest("a")).toHaveAttribute(
      "href",
      "mailto:mona@alamal.med.sa",
    );
    expect(screen.getByText("+966501234567")).toBeInTheDocument();
    expect(screen.getByTitle(en.crmLeadDetail.callAction)).toHaveAttribute(
      "href",
      "tel:+966501234567",
    );
    expect(screen.getByTitle(en.crmLeadDetail.whatsappAction)).toHaveAttribute(
      "href",
      "https://wa.me/966501234567",
    );
    expect(screen.getByTitle(en.crmLeadDetail.telegramAction)).toHaveAttribute(
      "href",
      "https://t.me/+966501234567",
    );
  });

  it("offers Add contact only when the corporate profile is editable", () => {
    const onAddContact = vi.fn();
    render(
      <CustomerContactsCard
        profile={profile}
        canEdit
        onAddContact={onAddContact}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: en.crmCustomerProfileActions.addContact,
      }),
    );
    expect(onAddContact).toHaveBeenCalledOnce();
  });
});

describe("existing corporate contact edits", () => {
  it("keeps Core email and phone read-only and saves only relationship fields", async () => {
    const savedProfile = {
      ...profile,
      contacts: profile.contacts.map((contact) => ({
        ...contact,
        jobTitle: "Server-confirmed title",
      })),
    };
    vi.mocked(runIdempotentWrite).mockResolvedValue({
      kind: "success",
      value: savedProfile,
      replayed: false,
    });
    const onSaved = vi.fn();
    const { rerender } = render(
      <CustomerContactsCard profile={profile} canEdit onSaved={onSaved} />,
    );
    fireEvent.click(screen.getByRole("button", { name: en.crmLeadDetail.editContact + ": Mona Saleh" }));
    expect(screen.getByText(en.crmCustomerProfiles.existingContactReadOnly)).toBeInTheDocument();
    expect(screen.getByDisplayValue("mona@alamal.med.sa")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("+966501234567")).toHaveAttribute("readonly");
    const honorific = screen.getByLabelText(en.crmLeadDetail.honorificTitle);
    expect(honorific).toHaveAttribute("readonly");
    expect(screen.getByLabelText(en.crmLeadDetail.firstName)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(en.crmLeadDetail.lastName)).toHaveAttribute("readonly");
    expect(screen.queryByLabelText(en.crmLeadDetail.fullName)).toBeNull();
    const fields = honorific.closest(".grid");
    expect(fields).toHaveClass("sm:grid-cols-6");
    expect(Array.from(fields!.querySelectorAll("label"), (label) => label.textContent)).toEqual([
      en.crmLeads.phone, en.crmLeadDetail.honorificTitle, en.crmLeadDetail.firstName,
      en.crmLeadDetail.lastName, en.crmCustomerProfiles.email, en.crmLeads.create.contactJobTitle,
    ]);
    expect(fields?.children[1]).toHaveClass("sm:col-span-2");
    fireEvent.change(screen.getByDisplayValue("Procurement Manager"), { target: { value: "Draft title" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProfile));
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      method: "patch",
      body: { contacts: [{
        contactPartyId: profile.contacts[0].partyId,
        fullName: "Mona Saleh",
        jobTitle: "Draft title",
        isPrimary: true,
      }] },
    }));
    rerender(<CustomerContactsCard profile={savedProfile} canEdit onSaved={onSaved} />);
    expect(screen.getByText("Server-confirmed title")).toBeInTheDocument();
    expect(screen.queryByText("Draft title")).not.toBeInTheDocument();
    expect(screen.getByText("+966501234567")).toBeInTheDocument();
  });
});

describe("individual customer contact edits", () => {
  const individual: CustomerProfileDetail = {
    ...profile,
    profileType: "INDIVIDUAL",
    displayName: "Dr Mona Nour Al Saleh",
    firstName: "Mona Nour",
    lastName: "Al Saleh",
    honorificTitle: "Dr",
    jobTitle: "Consultant",
    contacts: [],
  };

  function startEdit(displayName = individual.displayName) {
    fireEvent.click(screen.getByRole("button", {
      name: `${en.crmLeadDetail.editContact}: ${displayName}`,
    }));
  }

  it("orders honorific and structured names in thirds before email and job title", () => {
    render(<CustomerContactsCard profile={individual} canEdit onSaved={vi.fn()} />);
    expect(screen.getByText(individual.displayName)).toBeInTheDocument();
    expect(screen.getByText("Consultant")).toBeInTheDocument();
    expect(screen.queryByLabelText(en.crmLeadDetail.honorificTitle)).toBeNull();
    startEdit();

    const honorific = screen.getByLabelText(en.crmLeadDetail.honorificTitle);
    expect(honorific).toHaveValue("Dr");
    expect(screen.getByLabelText(`${en.crmLeads.create.firstName} *`)).toHaveValue("Mona Nour");
    expect(screen.getByLabelText(en.crmLeads.create.lastName)).toHaveValue("Al Saleh");
    expect(screen.queryByLabelText(en.crmLeadDetail.fullName)).toBeNull();
    expect(screen.getByLabelText(en.crmLeads.create.contactJobTitle)).toHaveValue("Consultant");
    expect(screen.getByLabelText(en.crmLeads.create.contactJobTitle)).toHaveAttribute("maxlength", "120");
    const fields = honorific.closest(".grid");
    expect(fields).toHaveClass("grid-cols-1", "sm:grid-cols-6");
    expect(Array.from(fields!.querySelectorAll("label"), (label) => label.textContent)).toEqual([
      en.crmLeadDetail.honorificTitle, `${en.crmLeads.create.firstName} *`,
      en.crmLeads.create.lastName, en.crmCustomerProfiles.email, en.crmLeads.create.contactJobTitle,
    ]);
    expect(Array.from(fields!.children).slice(0, 3).every((field) =>
      field.classList.contains("sm:col-span-2"),
    )).toBe(true);
    expect(fields!.children[3]).toHaveClass("sm:col-span-3");
    expect(fields!.children[4]).toHaveClass("sm:col-span-3");
    expect(fields!.parentElement!.firstElementChild).toHaveClass("dossier-phone-box-edit");
  });

  it.each([" Prof ", ""])("saves honorific %j separately from the derived display name", async (honorificTitle) => {
    const savedProfile = { ...individual, honorificTitle: honorificTitle.trim() || null };
    vi.mocked(runIdempotentWrite).mockResolvedValue({
      kind: "success", value: savedProfile, replayed: false,
    });
    const onSaved = vi.fn();
    render(<CustomerContactsCard profile={individual} canEdit onSaved={onSaved} />);
    startEdit();
    fireEvent.change(screen.getByLabelText(en.crmLeadDetail.honorificTitle), {
      target: { value: honorificTitle },
    });
    fireEvent.change(screen.getByLabelText(`${en.crmLeads.create.firstName} *`), {
      target: { value: " Noura Amal " },
    });
    fireEvent.change(screen.getByLabelText(en.crmLeads.create.lastName), {
      target: { value: " Hassan " },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProfile));
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      method: "patch",
      body: {
        displayName: "Noura Amal Hassan",
        primaryContact: {
          honorificTitle: honorificTitle.trim(),
          jobTitle: individual.jobTitle,
          firstName: "Noura Amal",
          lastName: "Hassan",
          email: individual.email,
          phones: individual.phones,
        },
      },
    }));
  });

  it("uses current server name parts on reopening and keeps a missing surname empty", () => {
    const { rerender } = render(
      <CustomerContactsCard profile={individual} canEdit onSaved={vi.fn()} />,
    );
    startEdit();
    fireEvent.change(screen.getByLabelText(en.crmLeadDetail.honorificTitle), {
      target: { value: "Unsaved" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    rerender(<CustomerContactsCard
      profile={{ ...individual, displayName: "Ms Noura Amal", honorificTitle: "Ms", firstName: "Noura Amal", lastName: null }}
      canEdit onSaved={vi.fn()}
    />);
    startEdit("Ms Noura Amal");
    expect(screen.getByLabelText(en.crmLeadDetail.honorificTitle)).toHaveValue("Ms");
    expect(screen.getByLabelText(`${en.crmLeads.create.firstName} *`)).toHaveValue("Noura Amal");
    expect(screen.getByLabelText(en.crmLeads.create.lastName)).toHaveValue("");
  });

  it.each([" Senior Consultant ", ""])("saves individual job title %j and renders the confirmed value", async (jobTitle) => {
    const savedProfile = { ...individual, jobTitle: jobTitle.trim() || null };
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", value: savedProfile, replayed: false });
    const onSaved = vi.fn();
    const { rerender } = render(<CustomerContactsCard profile={individual} canEdit onSaved={onSaved} />);
    startEdit();
    fireEvent.change(screen.getByLabelText(en.crmLeads.create.contactJobTitle), { target: { value: jobTitle } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProfile));
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ primaryContact: expect.objectContaining({ jobTitle: jobTitle.trim() }) }),
    }));
    rerender(<CustomerContactsCard profile={savedProfile} canEdit onSaved={onSaved} />);
    if (savedProfile.jobTitle) expect(screen.getByText(savedProfile.jobTitle)).toBeInTheDocument();
    expect(screen.queryByText("Consultant")).toBeNull();
    startEdit();
    expect(screen.getByLabelText(en.crmLeads.create.contactJobTitle)).toHaveValue(jobTitle.trim());
    fireEvent.change(screen.getByLabelText(en.crmLeads.create.contactJobTitle), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    startEdit();
    expect(screen.getByLabelText(en.crmLeads.create.contactJobTitle)).toHaveValue(jobTitle.trim());
  });
});
