// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { CustomerContactsCard } from "./CustomerContactsCard";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

afterEach(cleanup);

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
