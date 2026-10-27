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
