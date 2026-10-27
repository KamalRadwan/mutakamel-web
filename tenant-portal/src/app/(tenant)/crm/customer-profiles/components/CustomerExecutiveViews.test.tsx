// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { parseCustomerProfileDetailResponse } from "../customer-profile-contract";
import {
  customerProfilePath,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";
import { emptyCreateCustomerProfileForm } from "../customer-profile-create-contract";
import { CreateCustomerProfileModal } from "./CreateCustomerProfileModal";
import { CustomerExecutiveBoardView } from "./CustomerExecutiveBoardView";
import { CustomerExecutiveCardView } from "./CustomerExecutiveCardView";
import { CustomerExecutiveTableView } from "./CustomerExecutiveTableView";
import { CustomerProfileBulkActionsBar } from "./CustomerProfileBulkActionsBar";
import { CustomerProfileStatusFunnelBar } from "./CustomerProfileStatusFunnelBar";
import { CustomerQuickEditModal } from "./CustomerQuickEditModal";
import { readOwnerOptions } from "../../leads/[id]/hooks/readLeadOwnerOptions";

vi.mock("../../leads/[id]/hooks/readLeadOwnerOptions", () => ({
  readOwnerOptions: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/api/idempotent-write", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/idempotent-write")>(),
  createWriteAttempt: vi.fn(() => ({})),
  runIdempotentWrite: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const relatedScopeHeaders = vi.hoisted(() => ({
  "X-Branch-Id": "0192f3a0-0000-7000-8000-000000000002",
}));

vi.mock("@/hooks/useOrganizationScope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useOrganizationScope")>();
  return {
    ...actual,
    useOrganizationScopeHeaders: () => ({
      branchId: "0192f3a0-0000-7000-8000-000000000002",
      companyId: "0192f3a0-0000-7000-8000-000000000090",
      headers: relatedScopeHeaders,
      ready: true,
      isReady: true,
    }),
  };
});

const locale = vi.hoisted(() => ({ lang: "en" }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () =>
    ({
      en: { t: en, lang: "en", dir: "ltr" },
      ar: { t: ar, lang: "ar", dir: "rtl" },
    })[locale.lang as "en" | "ar"],
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
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
      error: tagAccess.toastError,
      errorFromApi: vi.fn(),
    }),
  };
});

const relatedAccess = vi.hoisted(() => ({ permissions: [] as string[] }));
const tagAccess = vi.hoisted(() => ({
  isTenantOwner: true,
  canRead: true,
  toastError: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "0192f3a0-0000-7000-8000-000000000010",
      firstName: "Kamal",
      lastName: "Radwan",
      isTenantOwner: tagAccess.isTenantOwner,
      accessibleBranches: ["0192f3a0-0000-7000-8000-000000000002"],
      accessibleCompanies: [],
      teamMemberships: [],
      permissions: [
        ...relatedAccess.permissions,
        "crm.customer_profiles.read",
        "crm.customer_profiles.create",
        "crm.customer_profiles.update",
        "crm.customer_profiles.delete",
        ...(tagAccess.canRead ? ["crm.tags.read"] : []),
        "crm.tags.manage",
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

if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
  cleanup();
  locale.lang = "en";
  relatedAccess.permissions = [];
  tagAccess.isTenantOwner = true;
  tagAccess.canRead = true;
  tagAccess.toastError.mockClear();
  vi.mocked(axiosClient.get).mockClear();
});

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

function customerDetailPayload(item: CustomerProfileItem) {
  return {
    ...item,
    companyEmail: item.email,
    companyPhone: item.phone,
    primaryMobile: item.phone,
    address: { country: item.country, city: item.city },
    contacts: item.primaryContact ? [item.primaryContact] : [],
    party: { taxNumber: "VAT-123", commercialRegistrationNumber: "CR-456" },
    description: "Server-only customer description",
    acquisitionSourceId: "0192f3a0-0000-7000-8000-000000000099",
    acquisitionSource: { nameAr: item.acquisitionSourceNameAr, nameEn: item.acquisitionSourceNameEn },
    createdAt: "2026-10-17T10:00:00Z",
    updatedAt: "2026-10-17T10:00:00Z",
  };
}

function customerResponse(data: unknown): AxiosResponse<unknown> {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

function mockCustomerDetail(item: CustomerProfileItem) {
  vi.mocked(axiosClient.get).mockImplementation(async (path) =>
    path === customerProfilePath(item.id)
      ? customerResponse(customerDetailPayload(item))
      : new Promise<AxiosResponse<unknown>>(() => {}),
  );
}

function quickEditProps(item = sampleCorporate) {
  return {
    item,
    canUpdate: () => true,
    canDelete: () => true,
    onClose: vi.fn(),
    onCardChange: vi.fn(),
    onMoveStatus: vi.fn(),
    onDelete: vi.fn(),
    onSaved: vi.fn(),
    onOpenActivities: vi.fn(),
  };
}

function expectQuickEditLocked(props: ReturnType<typeof quickEditProps>) {
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  for (const button of screen.getAllByRole("button")) {
    expect([en.common.retry, en.common.close]).toContain(button.textContent?.trim());
  }
  fireEvent.keyDown(window, { key: "s", ctrlKey: true });
  fireEvent.keyDown(window, { key: "s", metaKey: true });
  expect(runIdempotentWrite).not.toHaveBeenCalled();
  for (const callback of [props.onCardChange, props.onMoveStatus, props.onDelete,
    props.onSaved, props.onOpenActivities, props.onClose]) {
    expect(callback).not.toHaveBeenCalled();
  }
}

const statusTotalsMap = new Map<CustomerProfileStatus, number>([
  ["PROSPECT", 1],
  ["ACTIVE_CUSTOMER", 1],
  ["INACTIVE", 0],
  ["BLACKLISTED", 0],
]);

describe("CustomerProfiles Executive Suite Components", () => {

  it("renders CustomerProfileStatusFunnelBar 4 statuses and triggers onSelect", () => {
    const onSelect = vi.fn();
    render(
      <CustomerProfileStatusFunnelBar
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

  it("uses complete server totals for the funnel, including known zero counts", () => {
    render(
      <CustomerProfileStatusFunnelBar
        statusTotals={new Map<CustomerProfileStatus, number>([
          ["PROSPECT", 51],
          ["ACTIVE_CUSTOMER", 7],
          ["INACTIVE", 0],
          ["BLACKLISTED", 2],
        ])}
        activeStatus={null}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "All Customers 60" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: en.statusValues["CustomerStatus.INACTIVE"] + " 0",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: en.statusValues["CustomerStatus.PROSPECT"] + " 51",
      }),
    ).toBeInTheDocument();
  });

  it("keeps status filters usable without showing unknown counts as zero", () => {
    const onSelect = vi.fn();
    render(
      <CustomerProfileStatusFunnelBar
        statusTotals={new Map()}
        activeStatus={null}
        onSelect={onSelect}
      />,
    );
    expect(
      screen.getByRole("button", { name: "All Customers" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: en.statusValues["CustomerStatus.INACTIVE"],
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("INACTIVE");
  });

  it("renders CustomerProfileBulkActionsBar when rows are selected", () => {
    const onClear = vi.fn();
    render(
      <CustomerProfileBulkActionsBar
        allowedOwnerIds={null}
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

  it.each(["CORPORATE", "INDIVIDUAL"] as const)(
    "preserves all three %s customer phones when editing the displayed number",
    async (profileType) => {
      const original = profileType === "CORPORATE" ? sampleCorporate : sampleIndividual;
      const phones = ["+966501111111", "+966502222222", "+966503333333"];
      const item: CustomerProfileItem = {
        ...original,
        displayName: profileType === "INDIVIDUAL" ? "Dr Mona Saleh" : original.displayName,
        phone: phones[0],
        phones,
        primaryContact: original.primaryContact
          ? { ...original.primaryContact, phones: ["+966509999999"] }
          : null,
      };
      const onRefresh = vi.fn();
      vi.mocked(axiosClient.patch).mockReset();
      vi.mocked(axiosClient.patch).mockResolvedValue(customerResponse(undefined));
      render(
        <CustomerExecutiveTableView
          items={[item]}
          selectedIds={new Set()}
          onSelectionChange={vi.fn()}
          canUpdate={() => true}
          canDelete={() => false}
          onOpen={vi.fn()}
          onOpenActivities={vi.fn()}
          onMoveStatus={vi.fn()}
          onCardChange={vi.fn()}
          onRefresh={onRefresh}
        />,
      );

      expect(screen.getByText(phones[0])).toBeInTheDocument();
      expect(screen.queryByText("+966509999999")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTitle(en.crmTags.edit));
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue(phones[0]);
      fireEvent.change(input, { target: { value: " +966504444444 " } });
      const save = input.parentElement?.querySelector("button");
      if (!save) throw new Error("Inline phone save button missing");
      fireEvent.click(save);

      const updatedPhones = ["+966504444444", phones[1], phones[2]];
      await waitFor(() => expect(axiosClient.patch).toHaveBeenCalledWith(
        `/api/tenant/crm/v1/customer-profiles/${item.id}`,
        profileType === "CORPORATE"
          ? { companyPhones: updatedPhones }
          : { primaryContact: { phones: updatedPhones } },
        { nonReplayable: true, skipAutoIdempotency: true, cache: "no-store" },
      ));
      await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
      expect(phones).toEqual(["+966501111111", "+966502222222", "+966503333333"]);
      expect(item.primaryContact?.phones).toEqual(
        profileType === "CORPORATE" ? ["+966509999999"] : undefined,
      );
    },
  );

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

  describe("quick-edit detail safety", () => {
    it("offers only Close while detail is pending, including for keyboard saves", () => {
      vi.mocked(axiosClient.get).mockImplementation(() => new Promise(() => {}));
      vi.mocked(runIdempotentWrite).mockClear();
      const props = quickEditProps();
      render(<CustomerQuickEditModal {...props} />);
      expect(screen.getByRole("status")).toHaveTextContent(en.crmCustomerProfiles.loading);
      expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
      expectQuickEditLocked(props);
      fireEvent.click(screen.getByRole("button", { name: en.common.close }));
      expect(props.onClose).toHaveBeenCalledOnce();
    });

    it.each([
      { name: "HTTP 403", failure: 403 },
      { name: "HTTP 500", failure: 500 },
      { name: "network error", failure: 0 },
      { name: "malformed response", failure: "malformed" },
      { name: "another customer's response", failure: "mismatch" },
    ] as const)("keeps every write unavailable after $name", async ({ failure }) => {
      vi.mocked(runIdempotentWrite).mockClear();
      vi.mocked(axiosClient.get).mockImplementation(async (path) => {
        if (path !== customerProfilePath(sampleCorporate.id)) {
          return new Promise<AxiosResponse<unknown>>(() => {});
        }
        if (typeof failure === "number") {
          if (failure === 0) throw new Error("Offline");
          throw new TenantApiClientError("Read refused", {
            status: failure, statusText: "Read refused", headers: new Headers(), data: {},
          });
        }
        return customerResponse(failure === "malformed" ? {} : customerDetailPayload(sampleIndividual));
      });
      const props = quickEditProps();
      render(<CustomerQuickEditModal {...props} />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        failure === 403 ? en.crmShared.scopeDeniedDescription : en.crmCustomerProfiles.loadFailed,
      );
      if (failure === 403) expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: en.common.retry })).toBeEnabled();
      expectQuickEditLocked(props);
      fireEvent.click(screen.getByRole("button", { name: en.common.close }));
      expect(props.onClose).toHaveBeenCalledOnce();
    });

    it("unlocks after retry and preserves server registration, source and description values", async () => {
      vi.mocked(axiosClient.get).mockImplementation(async (path) => {
        if (path === customerProfilePath(sampleCorporate.id)) throw new Error("Offline");
        return new Promise<AxiosResponse<unknown>>(() => {});
      });
      vi.mocked(runIdempotentWrite).mockClear();
      const payload = customerDetailPayload(sampleCorporate);
      vi.mocked(runIdempotentWrite).mockResolvedValue({
        kind: "success", value: parseCustomerProfileDetailResponse(payload), replayed: false,
      });
      const props = quickEditProps();
      render(<CustomerQuickEditModal {...props} />);
      await screen.findByRole("alert");
      mockCustomerDetail(sampleCorporate);
      fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
      fireEvent.click(await screen.findByRole("button", { name: /Edit Company Details/i }));
      expect(screen.getByDisplayValue(payload.party.taxNumber)).toBeInTheDocument();
      expect(screen.getByDisplayValue(payload.party.commercialRegistrationNumber)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Save Company/i }));
      await waitFor(() => expect(props.onSaved).toHaveBeenCalledOnce());
      expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({
        body: expect.objectContaining({ taxNumber: "VAT-123", commercialRegistrationNumber: "CR-456" }),
      }));
      fireEvent.click(screen.getByRole("button", { name: /Edit Details/i }));
      expect(screen.getByDisplayValue(payload.description)).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
      await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(2));
      expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          description: payload.description, acquisitionSourceId: payload.acquisitionSourceId,
        }),
      }));
    });

    it.each([sampleIndividual])(
      "locks immediately when the selected row changes and its next GET fails ($displayName)",
      async (item) => {
        mockCustomerDetail(sampleCorporate);
        vi.mocked(runIdempotentWrite).mockClear();
        const props = quickEditProps();
        const view = render(<CustomerQuickEditModal {...props} />);
        await screen.findByRole("button", { name: /Edit Company Details/i });
        vi.mocked(axiosClient.get).mockRejectedValue(new Error("Offline"));
        view.rerender(<CustomerQuickEditModal {...props} item={item} />);
        expectQuickEditLocked(props);
        await screen.findByRole("alert");
        expectQuickEditLocked(props);
      },
    );

    it("ignores a late response from the previous customer", async () => {
      let resolvePrevious!: (value: AxiosResponse<unknown>) => void;
      const previous = new Promise<AxiosResponse<unknown>>((resolve) => { resolvePrevious = resolve; });
      vi.mocked(axiosClient.get).mockImplementation(async (path) => {
        if (path === customerProfilePath(sampleCorporate.id)) return previous;
        if (path === customerProfilePath(sampleIndividual.id)) return customerResponse(customerDetailPayload(sampleIndividual));
        return new Promise<AxiosResponse<unknown>>(() => {});
      });
      const props = quickEditProps();
      const view = render(<CustomerQuickEditModal {...props} />);
      view.rerender(<CustomerQuickEditModal {...props} item={sampleIndividual} />);
      await screen.findByRole("button", { name: /Edit Personal Info/i });
      await act(async () => { resolvePrevious(customerResponse(customerDetailPayload(sampleCorporate))); });
      expect(screen.getByRole("dialog", { name: /Quick Edit Mona Saleh/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Edit Company Details/i })).not.toBeInTheDocument();
    });
  });

  it.each([true, false])("preserves an open draft when a rating write succeeds=%s", async (ok) => {
    mockCustomerDetail(sampleCorporate);
    const props = quickEditProps({ ...sampleCorporate, rating: 2 });
    props.onCardChange.mockResolvedValue(ok
      ? { ok: true, patch: { rating: 3 } }
      : { ok: false, error: { status: 422, message: "Raw server failure" } });
    const view = render(<CustomerQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit Details/i }));
    fireEvent.change(screen.getByLabelText("Description / Internal Notes"), {
      target: { value: "Unsaved account draft" },
    });
    const star = screen.getByRole("button", { name: "Rate 3 of 3 stars" });
    fireEvent.click(star);
    await waitFor(() => expect(star).toHaveAttribute("aria-pressed", String(ok)));
    if (!ok) {
      expect(screen.getByRole("alert")).toHaveTextContent(en.crmShared.errorValidation);
      expect(screen.getByRole("alert")).not.toHaveTextContent("Raw server failure");
    }
    const detailReads = vi.mocked(axiosClient.get).mock.calls.filter(
      ([path]) => path === customerProfilePath(sampleCorporate.id),
    ).length;
    view.rerender(<CustomerQuickEditModal {...props} item={{ ...sampleCorporate, rating: ok ? 3 : 2 }} />);
    expect(screen.getByDisplayValue("Unsaved account draft")).toBeInTheDocument();
    expect(vi.mocked(axiosClient.get).mock.calls.filter(
      ([path]) => path === customerProfilePath(sampleCorporate.id),
    )).toHaveLength(detailReads);
  });

  it("restores card colour and keeps status after refused quick edits", async () => {
    mockCustomerDetail(sampleCorporate);
    const props = quickEditProps();
    props.onCardChange.mockResolvedValue({ ok: false, error: { status: 422 } });
    props.onMoveStatus.mockResolvedValue({ ok: false, error: { status: 422 } });
    render(<CustomerQuickEditModal {...props} />);
    const color = await screen.findByRole("button", { name: "Card color Blue" });
    const wasSelected = color.getAttribute("aria-pressed");
    fireEvent.click(color);
    await screen.findByRole("alert");
    expect(color.getAttribute("aria-pressed")).toBe(wasSelected);
    fireEvent.click(screen.getByRole("button", { name: "Inactive" }));
    await waitFor(() => expect(props.onMoveStatus).toHaveBeenCalledOnce());
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /Prospect.*Current/i })).toBeDisabled();
  });

  it("restores rejected stars with Arabic validation feedback", async () => {
    locale.lang = "ar";
    mockCustomerDetail(sampleCorporate);
    const props = quickEditProps({ ...sampleCorporate, rating: 2 });
    props.onCardChange.mockResolvedValue({
      ok: false, error: { status: 422, message: "Raw server failure" },
    });
    render(<CustomerQuickEditModal {...props} />);
    const star = await screen.findByRole("button", { name: "Rate 3 of 3 stars" });
    fireEvent.click(star);
    expect(await screen.findByRole("alert")).toHaveTextContent(ar.crmShared.errorValidation);
    expect(star).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Rate 2 of 3 stars" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps existing contact identity read-only and displays the saved server contact", async () => {
    mockCustomerDetail(sampleCorporate);
    const detail = parseCustomerProfileDetailResponse(customerDetailPayload(sampleCorporate));
    const saved = {
      ...detail,
      contacts: detail.contacts.map((contact) => ({ ...contact, jobTitle: "Confirmed relationship title" })),
    };
    vi.mocked(runIdempotentWrite).mockClear();
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", value: saved, replayed: false });
    const props = quickEditProps();
    render(<CustomerQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "\u270f\ufe0f Edit" }));
    expect(screen.getByText(en.crmCustomerProfiles.existingContactReadOnly)).toBeInTheDocument();
    expect(screen.getByLabelText("First Name *")).toBeDisabled();
    expect(screen.getByLabelText("Last Name")).toBeDisabled();
    expect(screen.getByLabelText("Honorific Title")).toBeDisabled();
    expect(screen.getByLabelText("Contact Email")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Contact Mobile 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Add Number/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove contact phone 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Save Contact/ }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledOnce());
    const request = vi.mocked(runIdempotentWrite).mock.calls[0][0];
    expect(request.body).toEqual({ contacts: [{
      contactPartyId: detail.contacts[0].partyId,
      fullName: detail.contacts[0].displayName,
      jobTitle: detail.contacts[0].jobTitle,
      isPrimary: detail.contacts[0].isPrimary,
    }] });
    expect(screen.getByText(/Confirmed relationship title/)).toBeInTheDocument();
  });

  it("shows scoped Opportunities in quick edit and hides Trade pills until granted", async () => {
    relatedAccess.permissions = ["crm.opportunities.read.team"];
    mockCustomerDetail(sampleCorporate);
    vi.mocked(axiosClient.post).mockResolvedValue(customerResponse({ items: [], total: 3 }));
    const props = quickEditProps();
    const view = render(<CustomerQuickEditModal {...props} />);
    const opportunityLink = await screen.findByRole("link", { name: /^Opportunities/ });
    await waitFor(() => expect(opportunityLink).toHaveTextContent("3"));
    expect(opportunityLink).toHaveAttribute("href", `/crm/opportunities?partyId=${sampleCorporate.partyId}`);
    for (const label of ["Quotations", "Sales orders", "Invoices"]) {
      expect(screen.queryByRole("link", { name: new RegExp(`^${label}`) })).not.toBeInTheDocument();
    }

    relatedAccess.permissions = ["trade.invoices.read"];
    view.rerender(<CustomerQuickEditModal {...props} />);
    expect(screen.queryByRole("link", { name: /^Opportunities/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Invoices/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Quotations/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Sales orders/ })).not.toBeInTheDocument();
  });

  it("renders CustomerQuickEditModal Dossier 360° layout after loading detail", async () => {
    mockCustomerDetail(sampleCorporate);
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

    await screen.findByText(/Corporate Customer/i);
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

  it.each([sampleCorporate, sampleIndividual])(
    "keeps $profileType quick-edit addresses read-only and out of PATCH",
    async (item) => {
      mockCustomerDetail(item);
      const saved = parseCustomerProfileDetailResponse({
        ...item,
        companyEmail: item.email,
        companyPhone: item.phone,
        primaryMobile: item.phone,
        address: {
          country: item.country,
          city: item.city,
          area: "Central",
          street: "Party Street",
        },
        contacts: [],
        taxNumber: null,
        commercialRegistrationNumber: null,
        legalName: null,
        description: null,
        sourceLeadId: null,
        acquisitionSourceId: null,
        createdAt: "2026-10-17T10:00:00Z",
        updatedAt: "2026-10-17T10:00:00Z",
      });
      vi.mocked(runIdempotentWrite).mockClear();
      vi.mocked(runIdempotentWrite).mockResolvedValue({
        kind: "success", value: saved, replayed: false,
      });
      const onSaved = vi.fn();
      await act(async () => {
        render(
          <CustomerQuickEditModal
            item={item}
            canUpdate={() => true}
            canDelete={() => false}
            onClose={vi.fn()}
            onCardChange={vi.fn()}
            onMoveStatus={vi.fn()}
            onSaved={onSaved}
          />,
        );
      });
      const corporate = item.profileType === "CORPORATE";
      fireEvent.click(screen.getByRole("button", {
        name: corporate ? /Edit Company Details/i : /Edit Personal Info/i,
      }));
      const address = screen.getByRole("textbox", { name: en.crmLeads.create.sections.address });
      expect(address).toHaveAttribute("readonly");
      expect(address).toHaveValue(`${item.city}, ${item.country}`);
      expect(screen.getByText(en.crmCustomerProfileActions.addressReadOnly)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", {
        name: corporate ? /Save Company/i : /Save Personal Info/i,
      }));
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(runIdempotentWrite).toHaveBeenCalledTimes(1);
      const request = vi.mocked(runIdempotentWrite).mock.calls[0][0];
      expect(request.method).toBe("patch");
      expect(request.body).not.toHaveProperty("address");
      expect(request.body).not.toHaveProperty("primaryContact.address");
      expect(
        screen.getAllByText(/Party Street, Central, Riyadh, Saudi Arabia/).length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([
    { allowed: ["0192f3a0-0000-7000-8000-000000000010"], otherVisible: false, pickerVisible: true },
    { allowed: null, otherVisible: true, pickerVisible: true },
    { allowed: [], otherVisible: false, pickerVisible: false },
  ])("renders create with owner boundary $allowed and one sidebar", async ({ allowed, otherVisible, pickerVisible }) => {
    vi.mocked(readOwnerOptions).mockResolvedValue([
      { id: "0192f3a0-0000-7000-8000-000000000010", firstName: "Kamal", lastName: "Radwan" },
      { id: "0192f3a0-0000-7000-8000-000000000011", firstName: "Other", lastName: "Owner" },
    ]);
    const initialForm = emptyCreateCustomerProfileForm("row-1");
    initialForm.branchId = "0192f3a0-0000-7000-8000-000000000002";
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

    await act(async () => {
      render(
        <CreateCustomerProfileModal
          allowedOwnerIds={allowed}
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
    });
    const ownerPicker = screen.queryByRole("combobox", { name: en.crmLeads.salesperson });
    expect(Boolean(ownerPicker)).toBe(pickerVisible);
    if (ownerPicker) {
      fireEvent.keyDown(ownerPicker, { key: "ArrowDown" });
      expect(screen.getAllByRole("option", { name: "Kamal Radwan" }).length).toBeGreaterThan(0);
      expect(Boolean(screen.queryByRole("option", { name: "Other Owner" }))).toBe(otherVisible);
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    }

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

    // Corporate identity and notes remain; address has no CRM write path.
    expect(screen.getByText(en.crmLeads.existingCompany)).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.create.legalName)).toBeInTheDocument();
    expect(screen.getByText("100+ Titles")).toBeInTheDocument();
    expect(screen.queryByText(en.crmLeads.create.sections.address)).not.toBeInTheDocument();
    expect(document.querySelector('[data-form-section="address"]')).toBeNull();
    expect(
      screen.getByText(en.crmLeads.create.interestSummary),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.crmLeads.create.expectedNeed),
    ).toBeInTheDocument();
  });
});

describe("customer quick-edit tag catalogue", () => {
  it("hides the picker without tag-read permission while keeping attached tags", async () => {
    tagAccess.isTenantOwner = false;
    tagAccess.canRead = false;
    mockCustomerDetail(sampleCorporate);
    render(<CustomerQuickEditModal {...quickEditProps()} />);
    await screen.findByRole("dialog", { name: `Quick Edit ${sampleCorporate.displayName}` });
    expect(screen.getByRole("button", { name: "Remove tag VIP" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Attach Tag/ })).toBeNull();
    expect(axiosClient.get).not.toHaveBeenCalledWith("/api/tenant/crm/v1/tags", expect.anything());
  });

  it("allows a tenant owner to open the picker without an explicit tag-read grant", async () => {
    tagAccess.canRead = false;
    mockCustomerDetail(sampleCorporate);
    render(<CustomerQuickEditModal {...quickEditProps()} />);
    expect(await screen.findByRole("button", { name: /Attach Tag/ })).toBeTruthy();
  });

  it.each([new Error("HTTP 503"), { items: [] }])(
    "reports a failed or malformed catalogue and allows retry (%s)", async (result) => {
      tagAccess.isTenantOwner = false;
      mockCustomerDetail(sampleCorporate);
      const get = vi.mocked(axiosClient.get);
      const readOther = get.getMockImplementation()!;
      get.mockImplementation(async (path, config) => {
        if (path !== "/api/tenant/crm/v1/tags") return readOther(path, config);
        if (result instanceof Error) throw result;
        return customerResponse(result);
      });
      render(<CustomerQuickEditModal {...quickEditProps()} />);
      fireEvent.click(await screen.findByRole("button", { name: /Attach Tag/ }));
      await waitFor(() => expect(tagAccess.toastError).toHaveBeenCalledWith(en.crmTags.loadFailed));
      get.mockImplementation(async (path, config) => path === "/api/tenant/crm/v1/tags"
        ? customerResponse([{
          id: "0192f3a0-0000-7000-8000-000000000080",
          name: "New tag",
          backgroundColor: null,
          textColor: null,
          createdAt: "2026-10-17T10:00:00Z",
          updatedAt: "2026-10-17T10:00:00Z",
        }])
        : readOther(path, config));
      fireEvent.click(screen.getByRole("button", { name: /Attach Tag/ }));
      expect(await screen.findByRole("button", { name: "+ New tag" })).toBeTruthy();
    },
  );
});
