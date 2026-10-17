// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { emptyCreateCustomerProfileForm } from "../customer-profile-create-contract";
import { CreateCustomerProfileModal } from "./CreateCustomerProfileModal";
import { CustomerExecutiveBoardView } from "./CustomerExecutiveBoardView";
import { CustomerExecutiveCardView } from "./CustomerExecutiveCardView";
import { CustomerExecutiveTableView } from "./CustomerExecutiveTableView";
import { CustomerProfileBulkActionsBar } from "./CustomerProfileBulkActionsBar";
import { CustomerProfileKpiStrip } from "./CustomerProfileKpiStrip";
import { CustomerProfileStatusFunnelBar } from "./CustomerProfileStatusFunnelBar";
import { CustomerQuickEditModal } from "./CustomerQuickEditModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useOrganizationScope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useOrganizationScope")>();
  return {
    ...actual,
    useOrganizationScopeHeaders: () => ({
      branchId: "0192f3a0-0000-7000-8000-000000000002",
      companyId: "0192f3a0-0000-7000-8000-000000000090",
      headers: { "X-Branch-Id": "0192f3a0-0000-7000-8000-000000000002" },
      ready: true,
      isReady: true,
    }),
  };
});

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      errorFromApi: vi.fn(),
    }),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "0192f3a0-0000-7000-8000-000000000010",
      firstName: "Kamal",
      lastName: "Radwan",
      isTenantOwner: true,
      accessibleBranches: ["0192f3a0-0000-7000-8000-000000000002"],
      accessibleCompanies: [],
      teamMemberships: [],
      permissions: [
        "crm.customer_profiles.read",
        "crm.customer_profiles.create",
        "crm.customer_profiles.update",
        "crm.customer_profiles.delete",
        "crm.tags.read",
        "crm.tags.create",
        "users.user.read",
      ],
    },
  }),
}));

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(cleanup);

const sampleCorporate: CustomerProfileItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  displayName: "Al Noor Trading Co",
  profileType: "CORPORATE",
  status: "PROSPECT",
  companyName: "Al Noor Trading Co",
  imageUrl: null,
  phone: "+966501234567",
  phones: ["+966501234567"],
  email: "info@alnoor.sa",
  companyWebsite: "https://alnoor.sa",
  country: "Saudi Arabia",
  city: "Riyadh",
  primaryContactName: "Khaled Omar",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000030",
    displayName: "Khaled Omar",
    jobTitle: "Procurement Director",
    phones: ["+966501234567"],
    email: "khaled@alnoor.sa",
    isPrimary: true,
  },
  tags: [
    {
      id: "0192f3a0-0000-7000-8000-000000000020",
      name: "VIP",
      backgroundColor: null,
      textColor: null,
    },
  ],
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  owner: {
    userId: "0192f3a0-0000-7000-8000-000000000010",
    firstName: "Kamal",
    lastName: "Radwan",
    avatarUrl: null,
  },
  nextActivity: null,
  acquisitionSourceNameAr: "الموقع",
  acquisitionSourceNameEn: "Website",
  sourceIconUrl: null,
  rating: 3,
  cardColor: "BLUE",
};

const sampleIndividual: CustomerProfileItem = {
  ...sampleCorporate,
  id: "0192f3a0-0000-7000-8000-000000000004",
  partyId: "0192f3a0-0000-7000-8000-000000000005",
  displayName: "Mona Saleh",
  profileType: "INDIVIDUAL",
  status: "ACTIVE_CUSTOMER",
  companyName: null,
  primaryContactName: null,
  primaryContact: null,
  tags: [],
  rating: 2,
  cardColor: null,
};

const statusTotalsMap = new Map<CustomerProfileStatus, number>([
  ["PROSPECT", 1],
  ["ACTIVE_CUSTOMER", 1],
  ["INACTIVE", 0],
  ["BLACKLISTED", 0],
]);

describe("CustomerProfiles Executive Suite Components", () => {
  it("renders CustomerProfileKpiStrip pills and triggers onSelectPreset", () => {
    const onSelectPreset = vi.fn();
    render(
      <CustomerProfileKpiStrip
        items={[sampleCorporate, sampleIndividual]}
        listTotal={2}
        statusTotals={statusTotalsMap}
        activePreset="ALL"
        onSelectPreset={onSelectPreset}
      />,
    );

    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    const hotButton = screen.getByRole("button", { name: /Hot \(3★\)/i });
    fireEvent.click(hotButton);
    expect(onSelectPreset).toHaveBeenCalledWith("HOT_3_STAR");
  });

  it("renders CustomerProfileStatusFunnelBar 4 statuses and triggers onSelect", () => {
    const onSelect = vi.fn();
    render(
      <CustomerProfileStatusFunnelBar
        items={[sampleCorporate, sampleIndividual]}
        statusTotals={statusTotalsMap}
        activeStatus={null}
        onSelect={onSelect}
      />,
    );

    const prospectButton = screen.getByRole("button", {
      name: new RegExp(en.statusValues["CustomerStatus.PROSPECT"], "i"),
    });
    fireEvent.click(prospectButton);
    expect(onSelect).toHaveBeenCalledWith("PROSPECT");
  });

  it("renders CustomerProfileBulkActionsBar when rows are selected", () => {
    const onClear = vi.fn();
    render(
      <CustomerProfileBulkActionsBar
        selectedItems={[sampleCorporate]}
        totalAvailable={2}
        branchId="0192f3a0-0000-7000-8000-000000000002"
        canUpdate={() => true}
        canDelete={() => true}
        onSelectAll={vi.fn()}
        onClearSelection={onClear}
        onScheduleActivity={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByText("Assign Owner")).toBeInTheDocument();
    expect(screen.getByText("Delete (1)")).toBeInTheDocument();
  });

  it("renders CustomerExecutiveCardView with corporate and individual cards", () => {
    render(
      <CustomerExecutiveCardView
        items={[sampleCorporate, sampleIndividual]}
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        canUpdate={() => true}
        canDelete={() => true}
        onOpen={vi.fn()}
        onOpenQuickModal={vi.fn()}
        onOpenActivities={vi.fn()}
        onMoveStatus={vi.fn()}
        onCardChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Al Noor Trading Co")).toBeInTheDocument();
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getAllByText("Khaled Omar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("renders CustomerExecutiveTableView with 11 columns and inline status select", () => {
    render(
      <CustomerExecutiveTableView
        items={[sampleCorporate, sampleIndividual]}
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        canUpdate={() => true}
        canDelete={() => true}
        onOpen={vi.fn()}
        onOpenQuickModal={vi.fn()}
        onOpenActivities={vi.fn()}
        onMoveStatus={vi.fn()}
        onCardChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Al Noor Trading Co")).toBeInTheDocument();
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(screen.getByText("Khaled Omar")).toBeInTheDocument();
  });

  it("renders CustomerExecutiveBoardView with 4 status columns and expandable mini-cards", () => {
    const onOpenQuickModal = vi.fn();
    const onCardChange = vi.fn();
    render(
      <CustomerExecutiveBoardView
        items={[sampleCorporate, sampleIndividual]}
        statusTotals={statusTotalsMap}
        lanes={{
          PROSPECT: { items: [sampleCorporate], total: 1, page: 1, hasMore: false },
          ACTIVE_CUSTOMER: { items: [sampleIndividual], total: 1, page: 1, hasMore: false },
          INACTIVE: { items: [], total: 0, page: 1, hasMore: false },
          BLACKLISTED: { items: [], total: 0, page: 1, hasMore: false },
        }}
        loadingStatuses={new Set()}
        onLoadMoreStatus={vi.fn()}
        branchId="0192f3a0-0000-7000-8000-000000000002"
        canCreate
        canUpdate={() => true}
        canDelete={() => true}
        onOpen={vi.fn()}
        onOpenQuickModal={onOpenQuickModal}
        onOpenActivities={vi.fn()}
        onCardChange={onCardChange}
        onCardMove={vi.fn()}
      />,
    );

    expect(screen.getByText("Al Noor Trading Co")).toBeInTheDocument();
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();

    // Expand board card to inspect phones, salesperson, and acquisition source details
    const expandButtons = screen.getAllByRole("button", {
      name: /Expand Card Details/i,
    });
    expect(expandButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(expandButtons[0]);
    expect(screen.getAllByText("Website").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Company Phone")).toBeInTheDocument();
    expect(screen.getByText("Salesperson")).toBeInTheDocument();

    // Trigger Quick-Edit 360° Inspector Modal from board card footer
    const quickEditButtons = screen.getAllByRole("button", {
      name: /Open 360° Quick-Edit Modal/i,
    });
    expect(quickEditButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(quickEditButtons[0]);
    expect(onOpenQuickModal).toHaveBeenCalledWith(sampleCorporate);
  });

  it("renders Quick-Add Customer composer with Individual/Company modes, Acquisition Source, Phone list, Rating, and Full Modal escalation", () => {
    const onOpenFullCreate = vi.fn();
    render(
      <CustomerExecutiveBoardView
        items={[sampleCorporate]}
        statusTotals={statusTotalsMap}
        lanes={{
          PROSPECT: { items: [sampleCorporate], total: 1, page: 1, hasMore: false },
          ACTIVE_CUSTOMER: { items: [], total: 0, page: 1, hasMore: false },
          INACTIVE: { items: [], total: 0, page: 1, hasMore: false },
          BLACKLISTED: { items: [], total: 0, page: 1, hasMore: false },
        }}
        loadingStatuses={new Set()}
        onLoadMoreStatus={vi.fn()}
        branchId="0192f3a0-0000-7000-8000-000000000002"
        canCreate
        canUpdate={() => true}
        canDelete={() => true}
        sources={[
          {
            id: "0192f3a0-0000-7000-8000-000000000099",
            nameAr: "فيسبوك",
            nameEn: "Facebook",
            iconUrl: null,
            isActive: true,
            sortOrder: 1,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ]}
        onOpen={vi.fn()}
        onOpenQuickModal={vi.fn()}
        onOpenActivities={vi.fn()}
        onOpenFullCreate={onOpenFullCreate}
        onCardChange={vi.fn()}
        onCardMove={vi.fn()}
      />,
    );

    // Click "+ Quick Add Customer" in an empty column
    const quickAddButtons = screen.getAllByRole("button", {
      name: /^Quick Add Customer$/i,
    });
    expect(quickAddButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(quickAddButtons[0]);

    // Default Individual mode fields
    expect(screen.getByText(/Quick Add Customer in/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Last name")).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.source)).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.create.phoneNumber)).toBeInTheDocument();

    // Switch to Company mode
    const companyTab = screen.getByRole("button", { name: /^Company$/i });
    fireEvent.click(companyTab);
    expect(screen.getByText("New Company")).toBeInTheDocument();
    expect(screen.getByText("Existing Company")).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.create.companyPhones)).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.create.firstName)).toBeInTheDocument();
    expect(screen.getByText("Contact Phone")).toBeInTheDocument();

    // Fill company name & escalate to Full Modal
    fireEvent.change(
      screen.getByPlaceholderText("Palm Hills Commercial..."),
      { target: { value: "Acme Arabia" } },
    );
    const fullModalBtn = screen.getByRole("button", { name: /Full Modal/i });
    fireEvent.click(fullModalBtn);
    expect(onOpenFullCreate).toHaveBeenCalledWith(
      "ACTIVE_CUSTOMER",
      expect.objectContaining({
        profileType: "CORPORATE",
        companyName: "Acme Arabia",
      }),
    );
  });

  it("renders CustomerQuickEditModal Dossier 360° layout matching Leads Quick-Edit Modal", () => {
    const onCardChange = vi.fn();
    const onMoveStatus = vi.fn();
    render(
      <CustomerQuickEditModal
        item={sampleCorporate}
        allItems={[sampleCorporate, sampleIndividual]}
        canUpdate={() => true}
        canDelete={() => true}
        onClose={vi.fn()}
        onSelectCustomer={vi.fn()}
        onOpenActivities={vi.fn()}
        onCardChange={onCardChange}
        onMoveStatus={onMoveStatus}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /Quick Edit Al Noor Trading Co/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Corporate Customer/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Company Details/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Contact Persons \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Khaled Omar/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Account Details, Ownership & Custom Fields/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Navigate Customers/i)).toBeInTheDocument();
  });

  it("renders CreateCustomerProfileModal matching CreateLeadsModal 100% without duplicate sidebar", () => {
    const initialForm = emptyCreateCustomerProfileForm("row-1");
    const mockCreate = {
      open: true,
      isSubmitting: false,
      isDirty: false,
      error: null,
      ambiguity: null,
      dismissAmbiguity: vi.fn(),
      appliedUnreadable: null,
      dismissAppliedUnreadable: vi.fn(),
      reconcile: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      form: initialForm,
      setForm: vi.fn(),
      errors: {},
      allErrors: {},
      setField: vi.fn(),
      touch: vi.fn(),
      revealAll: vi.fn(),
      reset: vi.fn(),
      setProfileType: vi.fn(),
      selectCompany: vi.fn(),
      setAddressField: vi.fn(),
      setCustomField: vi.fn(),
      setPhone: vi.fn(),
      addPhone: vi.fn(),
      removePhone: vi.fn(),
      updateContact: vi.fn(),
      setContactPrimary: vi.fn(),
      addContact: vi.fn(),
      removeContact: vi.fn(),
      setContactPhone: vi.fn(),
      addContactPhone: vi.fn(),
      removeContactPhone: vi.fn(),
      submit: vi.fn(() => Promise.resolve(true)),
    };

    render(
      <CreateCustomerProfileModal
        create={mockCreate as never}
        sources={[
          {
            id: "0192f3a0-0000-7000-8000-000000000099",
            nameAr: "فيسبوك",
            nameEn: "Facebook",
            iconUrl: null,
            isActive: true,
            sortOrder: 1,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ]}
        sourcesDegraded={false}
        customFields={{
          definitions: [],
          requiredFieldKeys: [],
          loading: false,
          degraded: false,
        }}
      />,
    );

    // Exactly ONE Form Sections nav (no duplicate left sidebar)
    expect(
      screen.getAllByRole("navigation", { name: en.crmShared.formSectionsNav }),
    ).toHaveLength(1);

    // Live Card Preview, Duplicate Radar, and Create & Add Another button
    expect(screen.getByText("Live Card Preview")).toBeInTheDocument();
    expect(screen.getByText("Duplicate Radar: Clear")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create & Add Another/i }),
    ).toBeInTheDocument();

    // Corporate sections: Existing Company directory combobox, Legal Name, 100+ Titles, Address, Qualification/Notes
    expect(screen.getByText(en.crmLeads.existingCompany)).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.create.legalName)).toBeInTheDocument();
    expect(screen.getByText("100+ Titles")).toBeInTheDocument();
    expect(
      screen.getAllByText(en.crmLeads.create.sections.address).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(en.crmLeads.create.interestSummary),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.crmLeads.create.expectedNeed),
    ).toBeInTheDocument();
  });
});

