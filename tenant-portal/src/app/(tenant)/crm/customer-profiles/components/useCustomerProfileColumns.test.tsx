// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { useCustomerProfileColumns } from "./useCustomerProfileColumns";

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
  companyWebsite: "https://alamal.med.sa",
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
  tags: [
    { id: "0192f3a0-0000-7000-8000-000000000020", name: "Healthcare" },
  ],
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

describe("useCustomerProfileColumns", () => {
  it("defines the compact operational columns", () => {
    const { result } = renderHook(() => useCustomerProfileColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      "name",
      "contact",
      "phone",
      "country",
      "status",
      "rating",
      "source",
      "salesperson",
      "activity",
      "actions",
    ]);
  });

  it("keeps a corporate primary contact and phone visible across unrelated rerenders", () => {
    const { result } = renderHook(() => useCustomerProfileColumns());
    const contact = result.current.find((column) => column.id === "contact")!;
    const phone = result.current.find((column) => column.id === "phone")!;
    const href = "/crm/customer-profiles/" + mockCustomer.id;

    const view = render(
      <div>
        {contact.cell(mockCustomer)}
        {phone.cell(mockCustomer)}
      </div>,
    );

    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("Procurement Manager")).toBeInTheDocument();
    expect(screen.getByText("mona@alamal.med.sa")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("+966501234567")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").filter((link) => link.getAttribute("href") === href),
    ).toHaveLength(2);
    expect(screen.getByTitle(en.crmLeadDetail.callAction)).toHaveAttribute(
      "href",
      "tel:+966501234567",
    );

    const afterStatusChange = { ...mockCustomer, status: "INACTIVE" as const };
    view.rerender(
      <div>
        {contact.cell(afterStatusChange)}
        {phone.cell(afterStatusChange)}
      </div>,
    );

    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("+966501234567")).toBeInTheDocument();
  });

  it("shows customer tags, city, and salesperson in their compact cells", () => {
    const { result } = renderHook(() => useCustomerProfileColumns());
    const name = result.current.find((column) => column.id === "name")!;
    const country = result.current.find((column) => column.id === "country")!;
    const salesperson = result.current.find(
      (column) => column.id === "salesperson",
    )!;

    render(
      <div>
        {name.cell(mockCustomer)}
        {country.cell(mockCustomer)}
        {salesperson.cell(mockCustomer)}
      </div>,
    );

    expect(screen.getByText("Healthcare")).toBeInTheDocument();
    expect(screen.getByText("Saudi Arabia")).toBeInTheDocument();
    expect(screen.getByText("Riyadh")).toBeInTheDocument();
    expect(screen.getByText("Kamal Radwan")).toBeInTheDocument();
  });

  it("opens activities from the activity column", () => {
    const onOpenActivities = vi.fn();
    const { result } = renderHook(() =>
      useCustomerProfileColumns({ onOpenActivities }),
    );
    const activity = result.current.find((column) => column.id === "activity")!;

    render(<div>{activity.cell(mockCustomer)}</div>);
    fireEvent.click(screen.getByRole("button", { name: /Activities/i }));
    expect(onOpenActivities).toHaveBeenCalledWith(mockCustomer);
  });

  it("changes rating from the table when the profile is editable", () => {
    const onRatingChange = vi.fn();
    const { result } = renderHook(() =>
      useCustomerProfileColumns({
        canUpdate: () => true,
        onRatingChange,
      }),
    );
    const rating = result.current.find((column) => column.id === "rating")!;

    render(<div>{rating.cell(mockCustomer)}</div>);
    fireEvent.click(screen.getByRole("button", { name: "Rate 3 of 3" }));
    expect(onRatingChange).toHaveBeenCalledWith(mockCustomer, 3);
  });
});
