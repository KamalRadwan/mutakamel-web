// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { CustomerProfileCard } from "./CustomerProfileCard";
import {
  CustomerProfileCardFooter,
  type CustomerProfileCardFooterLabels,
} from "./CustomerProfileCardFooter";
import {
  CustomerProfileCardMenu,
  type CustomerProfileCardMenuLabels,
} from "./CustomerProfileCardMenu";

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
  companyName: "Al-Amal Healthcare Services",
  phone: "+966112345678",
  phones: ["+966112345678"],
  email: "info@alamal.com",
  country: "Saudi Arabia",
  primaryContact: null,
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

const footerLabels: CustomerProfileCardFooterLabels = {
  activity: "Activities — None planned",
  owner: "Owner: Kamal Radwan",
};

const menuLabels: CustomerProfileCardMenuLabels = {
  trigger: "More options for Al-Amal Hospital",
  open: "Open",
  delete: "Delete",
  moveTo: "Move to…",
};

describe("CustomerProfileCard", () => {
  it("renders the compact identity, type, company, and source", () => {
    render(<CustomerProfileCard item={mockCustomer} />);
    expect(screen.getByText("Al-Amal Hospital")).toBeInTheDocument();
    expect(screen.getByText("Corporate")).toBeInTheDocument();
    expect(screen.getByText("Al-Amal Healthcare Services")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
  });
});

describe("CustomerProfileCardFooter", () => {
  it("opens activities and shows the salesperson name without fake rating controls", () => {
    const onOpenActivities = vi.fn();
    render(
      <CustomerProfileCardFooter
        nextActivity={null}
        onOpenActivities={onOpenActivities}
        owner={mockCustomer.owner}
        labels={footerLabels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: footerLabels.activity }));
    expect(onOpenActivities).toHaveBeenCalledOnce();
    expect(screen.getByText("Kamal Radwan")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});

describe("CustomerProfileCardMenu", () => {
  it("opens the customer from the menu", () => {
    const onOpen = vi.fn();
    render(<CustomerProfileCardMenu onOpen={onOpen} labels={menuLabels} />);

    const trigger = screen.getByRole("button", { name: menuLabels.trigger });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
