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
  imageUrl: null,
  phone: "+966112345678",
  phones: ["+966112345678"],
  email: "info@alamal.med.sa",
  companyWebsite: "https://alamal.med.sa/about",
  country: "Saudi Arabia",
  city: "Riyadh",
  primaryContactName: "Mona Saleh",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000004",
    displayName: "Mona Saleh",
    jobTitle: "Procurement Manager",
    email: "mona@alamal.med.sa",
    phones: ["+966501234567"],
    isPrimary: true,
  },
  tags: [],
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  owner: {
    userId: "0192f3a0-0000-7000-8000-000000000010",
    firstName: "Kamal",
    lastName: "Radwan",
    avatarUrl: null,
  },
  nextActivity: null,
  acquisitionSourceNameAr: "موقع الكتروني",
  acquisitionSourceNameEn: "Website",
  sourceIconUrl: null,
  rating: 2,
  cardColor: "TEAL",
};

const labels: CustomerProfileCardViewFooterLabels = {
  activity: "Activities — None planned",
  owner: "Owner: Kamal Radwan",
  emailAction: "Email company",
  websiteAction: "Website: https://alamal.med.sa/about",
  contactEmailAction: "Email primary contact",
  source: "Source: Website",
  salesperson: "Salesperson: Kamal Radwan",
  country: "Company country: Saudi Arabia · Riyadh",
  primary: "Primary",
  position: "Position: Procurement Manager",
  group: "Rating",
  setStars: "Rate {count} of {max}",
  clear: "Clear rating",
  quotations: "Quotations: 2",
  salesOrders: "Sales orders: 1",
  invoices: "Invoices: 4",
};

describe("CustomerProfileCardViewFooter", () => {
  it("renders rich company and primary-contact data with phone actions", () => {
    render(
      <CustomerProfileCardViewFooter
        item={mockCustomer}
        sourceName="Website"
        counts={{ quotations: 2, salesOrders: 1, invoices: 4 }}
        countVisibility={{ quotations: true, salesOrders: true, invoices: true }}
        onRatingChange={vi.fn()}
        onOpenActivities={vi.fn()}
        labels={labels}
      />,
    );

    expect(
      screen.getByText("Company country: Saudi Arabia · Riyadh"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Position: Procurement Manager")).toBeInTheDocument();
    expect(screen.getByText(labels.source)).toBeInTheDocument();
    expect(screen.getByText("Salesperson: Kamal Radwan")).toBeInTheDocument();
    expect(screen.getByText("PQ: 2")).toBeInTheDocument();
    expect(screen.getByText("SO: 1")).toBeInTheDocument();
    expect(screen.getByText("IN: 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.websiteAction })).toHaveAttribute(
      "href",
      "https://alamal.med.sa/about",
    );
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
        onRatingChange={vi.fn()}
        onOpenActivities={onOpenActivities}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: labels.activity }));
    expect(onOpenActivities).toHaveBeenCalledOnce();
  });
});
