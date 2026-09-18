// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import {
  CustomerProfileCardViewFooter,
  type CustomerProfileCardViewFooterLabels,
} from "./CustomerProfileCardViewFooter";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

afterEach(cleanup);

const mockCustomer: CustomerProfileItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  displayName: "Al-Amal Hospital",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  companyName: "Al-Amal Healthcare Co.",
  phone: "+966112345678",
  phones: ["+966112345678"],
  email: "info@alamal.med.sa",
  country: "Saudi Arabia",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000004",
    displayName: "Mona Saleh",
    jobTitle: "Procurement Manager",
    email: "mona@alamal.med.sa",
    phones: ["+966501234567"],
    isPrimary: true,
  },
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  owner: {
    userId: "0192f3a0-0000-7000-8000-000000000010",
    firstName: "Kamal",
    lastName: "Radwan",
  },
  nextActivity: null,
  acquisitionSourceNameAr: "موقع الكتروني",
  acquisitionSourceNameEn: "Website",
  sourceIconUrl: null,
};

const labels: CustomerProfileCardViewFooterLabels = {
  activity: "Activities — None planned",
  owner: "Owner: Kamal Radwan",
  emailAction: "Email company",
  contactEmailAction: "Email primary contact",
  source: "Source: Website",
  salesperson: "Salesperson: Kamal Radwan",
  country: "Company country: Saudi Arabia",
  primary: "Primary",
  position: "Position: Procurement Manager",
};

describe("CustomerProfileCardViewFooter", () => {
  it("renders rich company and primary-contact data with phone actions", () => {
    render(
      <CustomerProfileCardViewFooter
        item={mockCustomer}
        sourceName="Website"
        onOpenActivities={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByText("Company country: Saudi Arabia")).toBeInTheDocument();
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Position: Procurement Manager")).toBeInTheDocument();
    expect(screen.getByText(labels.source)).toBeInTheDocument();
    expect(screen.getByText("Salesperson: Kamal Radwan")).toBeInTheDocument();
    expect(screen.getAllByTitle(en.crmLeadDetail.callAction)).toHaveLength(2);
    expect(screen.getAllByTitle(en.crmLeadDetail.whatsappAction)).toHaveLength(2);
    expect(screen.getAllByTitle(en.crmLeadDetail.telegramAction)).toHaveLength(2);
  });

  it("opens the activity dialog", () => {
    const onOpenActivities = vi.fn();
    render(
      <CustomerProfileCardViewFooter
        item={mockCustomer}
        sourceName="Website"
        onOpenActivities={onOpenActivities}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: labels.activity }));
    expect(onOpenActivities).toHaveBeenCalledOnce();
  });
});
