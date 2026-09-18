// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadCardViewFooter } from "./LeadCardViewFooter";

const labels = {
  activity: "Activities — none",
  owner: "Owner: Kamal Radwan",
  group: "Rating",
  setStars: "Rate {count} of {max}",
  clear: "Clear",
  emailAction: "Email hello@acme.test",
  source: "Source: Referral",
  salesperson: "Salesperson: Kamal Radwan",
  country: "Company country: Egypt",
  primary: "Primary",
  position: "Position: Purchasing Manager",
  contactEmailAction: "Email dina@example.com",
  quotations: "Quotations: 2",
  salesOrders: "Sales orders: 3",
  invoices: "Invoices: 4",
};

const SOURCE_ICON_URL =
  "/api/tenant/crm/v1/acquisition-sources/01900100-0000-7000-8000-000000000030/icon?v=1789560000000";

const lead: LeadItem = {
  id: "01900100-0000-7000-8000-000000000001",
  partyId: "01900100-0000-7000-8000-000000000002",
  leadProfileType: "CORPORATE",
  leadName: "Acme Trading",
  company: "Acme Trading",
  email: "hello@acme.test",
  phone: "+201001112223",
  phones: ["+201001112223", "+201009998887"],
  country: "Egypt",
  primaryContact: {
    partyId: "01900100-0000-7000-8000-000000000003",
    displayName: "Dina Ali",
    jobTitle: "Purchasing Manager",
    email: "dina@example.com",
    phones: ["+201055566677"],
    isPrimary: true,
  },
  sourceNameAr: "إحالة",
  sourceNameEn: "Referral",
  sourceIconUrl: SOURCE_ICON_URL,
  stageId: "01900100-0000-7000-8000-000000000010",
  ownerUserId: "01900100-0000-7000-8000-000000000020",
  rating: 2,
  cardColor: null,
  owner: {
    userId: "01900100-0000-7000-8000-000000000020",
    firstName: "Kamal",
    lastName: "Radwan",
  },
  nextActivity: null,
  primaryContactName: "",
  tags: [],
};

afterEach(cleanup);
beforeEach(() => window.localStorage.setItem("tenant_lang", "en"));

describe("LeadCardViewFooter", () => {
  it("offers call, WhatsApp and Telegram for every stored international number", () => {
    render(
      <I18nProvider>
        <LeadCardViewFooter
          lead={lead}
          source="Referral"
          sourceIconUrl={SOURCE_ICON_URL}
          countryFlag="🇪🇬"
          onRatingChange={vi.fn()}
          onOpenActivities={vi.fn()}
          labels={labels}
        />
      </I18nProvider>,
    );

    expect(document.querySelectorAll('a[href^="tel:"]')).toHaveLength(3);
    expect(document.querySelectorAll('a[href^="https://wa.me/"]')).toHaveLength(3);
    expect(document.querySelectorAll('a[href^="https://t.me/"]')).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Email hello@acme.test" })).toHaveAttribute(
      "href",
      "mailto:hello@acme.test",
    );
    expect(screen.getByText("Dina Ali")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Position: Purchasing Manager")).toBeInTheDocument();
    expect(screen.getByText("🇪🇬")).toBeInTheDocument();
    expect(screen.getByText("Source: Referral").parentElement?.querySelector("img")).toHaveAttribute(
      "src",
      SOURCE_ICON_URL,
    );
    expect(screen.getByRole("link", { name: "Email dina@example.com" })).toHaveAttribute(
      "href",
      "mailto:dina@example.com",
    );
  });

  it("uses compact document abbreviations and places rating and activity below the salesperson", () => {
    const onRatingChange = vi.fn();
    const { container } = render(
      <I18nProvider>
        <LeadCardViewFooter
          lead={lead}
          source="Referral"
          sourceIconUrl={SOURCE_ICON_URL}
          countryFlag="🇪🇬"
          counts={{ quotations: 2, salesOrders: 3, invoices: 4 }}
          countVisibility={{ quotations: true, salesOrders: true, invoices: true }}
          onRatingChange={onRatingChange}
          onOpenActivities={vi.fn()}
          labels={labels}
        />
      </I18nProvider>,
    );

    const bottomSection = container.firstElementChild?.lastElementChild;
    expect(bottomSection).toHaveClass("mt-auto");
    expect(bottomSection).toContainElement(screen.getByText("PQ: 2"));
    expect(bottomSection).toContainElement(screen.getByText("SO: 3"));
    expect(bottomSection).toContainElement(screen.getByText("IN: 4"));
    expect(bottomSection).toContainElement(screen.getByText("Salesperson: Kamal Radwan"));
    expect(bottomSection).toContainElement(screen.getByRole("group", { name: "Rating" }));
    expect(bottomSection?.lastElementChild).toContainElement(
      screen.getByRole("button", { name: "Activities — none" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Rate 3 of 3" }));
    expect(onRatingChange).toHaveBeenCalledWith(3);
  });
});
