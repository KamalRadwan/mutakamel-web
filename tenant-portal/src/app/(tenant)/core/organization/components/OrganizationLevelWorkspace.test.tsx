// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { OrganizationLevelWorkspace } from "./OrganizationLevelWorkspace";

const companyId = "01900100-0000-7000-8000-000000000010";

const state = vi.hoisted(() => ({
  user: null as {
    id: string;
    isTenantOwner: boolean;
    permissions: string[];
    permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
  } | null,
  fetchNodes: vi.fn(),
}));

function setPermissions(permissions: string[]) {
  state.user = {
    id: "01900100-0000-7000-8000-000000000099",
    isTenantOwner: false,
    permissions,
    permissionScopes: Object.fromEntries(
      permissions.map((key) => [key, { tenantWide: true, companyIds: [], branchIds: [] }]),
    ),
  };
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/organization/companies",
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => "en",
  useDictionary: () => en,
  useDirection: () => "ltr",
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: state.user,
    isAuthenticated: Boolean(state.user),
    realtimeAuthGeneration: 0,
  }),
}));

vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return {
    ...actual,
    useRealtimeResync: () => undefined,
  };
});

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgNodes: state.fetchNodes,
}));

const companyRow = {
  id: companyId,
  code: "ACME",
  name: "Acme Holding",
  legalName: "Acme Holding LLC",
  taxNumber: "3000000001",
  currencyCode: "SAR",
  status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const firstPageCompanies = [
  companyRow,
  ...Array.from({ length: 24 }, (_, index) => ({
    id: `01900100-0000-7000-8000-${String(100 + index).padStart(12, "0")}`,
    code: `SUB-${index + 2}`,
    name: `Subsidiary ${index + 2}`,
    legalName: `Subsidiary ${index + 2} LLC`,
    taxNumber: null,
    currencyCode: "USD",
    status: "ACTIVE" as const,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  })),
];

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions([]);
});

afterEach(cleanup);

describe("OrganizationLevelWorkspace", () => {
  it("renders server-paginated rows, gates manage actions, and opens centered quick-view and create modals", async () => {
    setPermissions(["org.company.read", "org.company.manage"]);
    state.fetchNodes.mockResolvedValue({
      items: firstPageCompanies,
      page: 1,
      limit: 25,
      total: 42,
    });

    render(<OrganizationLevelWorkspace level="companies" />);

    await waitFor(() => expect(screen.getByText("Acme Holding")).toBeTruthy());
    expect(screen.getByText("Acme Holding LLC")).toBeTruthy();
    expect(screen.getByText("SAR")).toBeTruthy();
    expect(
      screen.getByText(
        formatTemplate(en.common.showingOf, { from: "1", to: "25", total: "42" }),
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreIdentity.actions.view}: Acme Holding` }),
    );
    const quickViewDialog = screen.getByRole("dialog");
    const closeButtons = within(quickViewDialog).getAllByRole("button", {
      name: en.common.close,
    });
    expect(closeButtons).toHaveLength(2);
    const footerCloseButton = closeButtons.find((button) => !button.querySelector("svg"));
    if (!footerCloseButton) throw new Error("Missing quick-view footer close button");
    fireEvent.click(footerCloseButton);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.levels.companies.add }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: en.crmShared.formSectionsNav })).toBeNull();
  });

  it("hides add/edit/delete controls when the user holds read permission without manage permission", async () => {
    setPermissions(["org.company.read"]);
    state.fetchNodes.mockResolvedValue({
      items: [companyRow],
      page: 1,
      limit: 25,
      total: 1,
    });

    render(<OrganizationLevelWorkspace level="companies" />);

    await waitFor(() => expect(screen.getByText("Acme Holding")).toBeTruthy());
    expect(screen.queryByRole("button", { name: en.coreIdentity.levels.companies.add })).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.actions.edit}: Acme Holding` }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.actions.delete}: Acme Holding` }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: `${en.coreIdentity.actions.view}: Acme Holding` }),
    ).toBeTruthy();
  });

  it("shows edit/delete only on Branch A when user manages Branch A and only reads Branch B, and renders PermissionGate on 403", async () => {
    const branchIdA = "01900100-0000-7000-8000-000000000021";
    const branchIdB = "01900100-0000-7000-8000-000000000022";
    state.user = {
      id: "01900100-0000-7000-8000-000000000099",
      isTenantOwner: false,
      permissions: ["org.branch.read", "org.branch.manage"],
      permissionScopes: {
        "org.branch.read": {
          tenantWide: false,
          companyIds: [],
          branchIds: [branchIdA, branchIdB],
        },
        "org.branch.manage": {
          tenantWide: false,
          companyIds: [companyId],
          branchIds: [branchIdA],
        },
      },
    };
    state.fetchNodes.mockResolvedValue({
      items: [
        {
          id: branchIdA,
          companyId,
          code: "BR-A",
          name: "Branch A",
          address: null,
          phone: null,
          isHeadquarters: false,
          status: "ACTIVE" as const,
          createdAt: "2026-10-17T00:00:00.000Z",
          updatedAt: "2026-10-17T00:00:00.000Z",
        },
        {
          id: branchIdB,
          companyId: "01900100-0000-7000-8000-000000000012",
          code: "BR-B",
          name: "Branch B",
          address: null,
          phone: null,
          isHeadquarters: false,
          status: "ACTIVE" as const,
          createdAt: "2026-10-17T00:00:00.000Z",
          updatedAt: "2026-10-17T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 25,
      total: 2,
    });

    render(<OrganizationLevelWorkspace level="branches" />);

    await waitFor(() => expect(screen.getByText("Branch A")).toBeTruthy());
    expect(screen.getByText("Branch B")).toBeTruthy();
    expect(screen.getByRole("button", { name: en.coreIdentity.levels.branches.add })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: `${en.coreIdentity.actions.edit}: Branch A` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: `${en.coreIdentity.actions.delete}: Branch A` }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.actions.edit}: Branch B` }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreIdentity.actions.delete}: Branch B` }),
    ).toBeNull();

    cleanup();
    state.fetchNodes.mockRejectedValueOnce(
      new TenantApiClientError("forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { errorCode: "FORBIDDEN" },
      }),
    );
    render(<OrganizationLevelWorkspace level="branches" />);
    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeTruthy());
    expect(screen.queryByText(en.coreIdentity.levels.branches.empty)).toBeNull();
  });
});
