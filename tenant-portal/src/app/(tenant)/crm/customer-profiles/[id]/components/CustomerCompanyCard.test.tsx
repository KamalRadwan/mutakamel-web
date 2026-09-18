// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { CustomerCompanyCard } from "./CustomerCompanyCard";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

afterEach(cleanup);

const mockProfile: CustomerProfileDetail = {
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
  primaryMobile: "+966501234567",
  phones: ["+966112345678", "+966501234567"],
  address: { country: "Saudi Arabia", city: "Riyadh", area: null, street: null },
  contacts: [],
  taxNumber: "300123456700003",
  commercialRegistrationNumber: "1010123456",
  legalName: "Al-Amal Medical Services LLC",
  description: "Specialized healthcare provider",
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  sourceLeadId: null,
  acquisitionSourceId: "0192f3a0-0000-7000-8000-000000000020",
  acquisitionSourceNameAr: "موقع الكتروني",
  acquisitionSourceNameEn: "Website",
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-10T12:00:00Z",
};

describe("CustomerCompanyCard", () => {
  it("renders company facts, phones, email, and website", () => {
    render(
      <CustomerCompanyCard
        profile={mockProfile}
        onEdit={vi.fn()}
        readOnly={false}
      />,
    );

    expect(screen.getByText("Al-Amal Healthcare Co.")).toBeInTheDocument();
    expect(
      screen.getByText("Al-Amal Medical Services LLC"),
    ).toBeInTheDocument();
    expect(screen.getByText("300123456700003")).toBeInTheDocument();
    expect(screen.getByText("1010123456")).toBeInTheDocument();
    expect(screen.getByText("https://alamal.med.sa")).toBeInTheDocument();
  });

  it("calls onEdit when pencil button is clicked", () => {
    const onEdit = vi.fn();
    render(
      <CustomerCompanyCard
        profile={mockProfile}
        onEdit={onEdit}
        readOnly={false}
      />,
    );

    const editBtn = screen.getByTitle(en.crmLeadDetail.editCompany);
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
