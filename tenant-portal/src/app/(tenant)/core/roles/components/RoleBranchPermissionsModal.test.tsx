// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/uuid";
import type { Branch, Company } from "../../contracts/organization-contract";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import { RoleBranchPermissionsModal } from "./RoleBranchPermissionsModal";

const mockFetchRoleBranchPermissions = vi.fn();
const mockSaveRoleBranchPermissions = vi.fn();
const mockFetchOrgNodes = vi.fn();
const mockRetryBootstrap = vi.fn();

vi.mock("../contracts/role-branch-contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../contracts/role-branch-contract")>();
  return {
    ...actual,
    fetchRoleBranchPermissions: (...args: unknown[]) => mockFetchRoleBranchPermissions(...args),
    saveRoleBranchPermissions: (...args: unknown[]) => mockSaveRoleBranchPermissions(...args),
  };
});

vi.mock("../../contracts/organization-contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../contracts/organization-contract")>();
  return {
    ...actual,
    fetchOrgNodes: (...args: unknown[]) => mockFetchOrgNodes(...args),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ retryBootstrap: mockRetryBootstrap }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const roleId = generateUUIDv7();
const companyId = generateUUIDv7();
const branchRiyadhId = generateUUIDv7();
const branchJeddahId = generateUUIDv7();
const permViewAllId = generateUUIDv7();
const permViewOwnId = generateUUIDv7();
const permTenantRoleId = generateUUIDv7();

function buildFixtureDocument(
  overrides: Partial<RoleBranchPermissionsDocument> = {},
): RoleBranchPermissionsDocument {
  return {
    roleId,
    roleName: "Sales Supervisor",
    isSystem: false,
    permissionMode: "BRANCH",
    revision: "3",
    catalogueRevision: "a".repeat(64),
    globalPermissionIds: [],
    profiles: [
      {
        branchId: branchRiyadhId,
        companyId,
        branchName: "Riyadh Main",
        companyName: "Mutakamel Trading",
        isActive: true,
        permissionIds: [permViewOwnId],
      },
    ],
    catalogue: [
      {
        id: permViewOwnId,
        key: "crm.leads.read_own",
        nameAr: "عرض العملاء",
        nameEn: "View leads",
        module: { id: "crm", nameAr: "المبيعات", nameEn: "CRM" },
        groups: [{ id: "leads", nameAr: "العملاء", nameEn: "Leads" }],
        scope: "BRANCH",
        recordScope: "OWN",
      },
      {
        id: permViewAllId,
        key: "crm.leads.read_all",
        nameAr: "عرض العملاء",
        nameEn: "View leads",
        module: { id: "crm", nameAr: "المبيعات", nameEn: "CRM" },
        groups: [{ id: "leads", nameAr: "العملاء", nameEn: "Leads" }],
        scope: "BRANCH",
        recordScope: "ALL",
      },
      {
        id: permTenantRoleId,
        key: "roles.role.delete",
        nameAr: "حذف الأدوار",
        nameEn: "Delete roles",
        module: { id: "core", nameAr: "الهوية", nameEn: "Identity" },
        groups: [{ id: "roles", nameAr: "الأدوار", nameEn: "Roles" }],
        scope: "TENANT",
        recordScope: null,
      },
    ],
    limits: { branches: 100, permissionsPerBranch: 200 },
    ...overrides,
  };
}

function setupOrgMocks() {
  const companies: Company[] = [
    {
      id: companyId,
      code: "MTK",
      name: "Mutakamel Trading",
      status: "ACTIVE",
      legalName: null,
      taxNumber: null,
      currencyCode: "SAR",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    },
  ];
  const branches: Branch[] = [
    {
      id: branchRiyadhId,
      companyId,
      code: "RUH",
      name: "Riyadh Main",
      status: "ACTIVE",
      address: null,
      phone: null,
      isHeadquarters: true,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    },
    {
      id: branchJeddahId,
      companyId,
      code: "JED",
      name: "Jeddah West",
      status: "ACTIVE",
      address: null,
      phone: null,
      isHeadquarters: false,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    },
  ];

  mockFetchOrgNodes.mockImplementation((level: string) =>
    Promise.resolve({
      items: level === "companies" ? companies : branches,
      page: 1,
      limit: 100,
      total: level === "companies" ? companies.length : branches.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  document.cookie = "tenant_lang=en; Path=/";
  mockRetryBootstrap.mockResolvedValue(undefined);
  setupOrgMocks();
});

function renderBranchModal(onSaved: () => void) {
  return render(
    <I18nProvider initialLanguage="en">
      <RoleBranchPermissionsModal
        open
        roleId={roleId}
        roleDisplayName="Sales Supervisor"
        initialMode="edit"
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </I18nProvider>,
  );
}

describe("RoleBranchPermissionsModal three-step flow & failure recovery", () => {
  it("keeps inactive saved profiles removable and blocks continuing until they are removed", async () => {
    const initialDoc = buildFixtureDocument();
    mockFetchRoleBranchPermissions.mockResolvedValue({
      ...initialDoc, profiles: [{ ...initialDoc.profiles[0]!, isActive: false }],
    });
    renderBranchModal(vi.fn());
    const savedBranch = await screen.findByRole("checkbox", { name: "Riyadh Main" });
    await waitFor(() => expect(savedBranch).toBeChecked());
    expect(savedBranch).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.roleBranch.footer.nextPermissions }));
    expect(screen.getByText(en.coreIdentity.roleBranch.scope.inactiveSelectionError)).toBeVisible();
    expect(mockSaveRoleBranchPermissions).not.toHaveBeenCalled();
    fireEvent.click(savedBranch);
    expect(await screen.findByText(en.coreIdentity.roleBranch.dialogs.removeProfile.title)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.roleBranch.dialogs.removeProfile.confirm }));
    await waitFor(() => expect(savedBranch).not.toBeChecked());
    expect(savedBranch).toBeDisabled();
    expect(mockSaveRoleBranchPermissions).not.toHaveBeenCalled();
  });

  it("walks Scope -> Permissions -> Review, locks workspace-only items, and saves exact profiles", async () => {
    const initialDoc = buildFixtureDocument();
    mockFetchRoleBranchPermissions.mockResolvedValue(initialDoc);
    mockSaveRoleBranchPermissions.mockResolvedValue({
      ...initialDoc,
      revision: "4",
      profiles: [
        { ...initialDoc.profiles[0]!, permissionIds: [permViewOwnId] },
        {
          branchId: branchJeddahId,
          companyId,
          branchName: "Jeddah West",
          companyName: "Mutakamel Trading",
          isActive: true,
          permissionIds: [],
        },
      ],
    });

    const onSaved = vi.fn();
    renderBranchModal(onSaved);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Jeddah West" }));
    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roleBranch.footer.nextPermissions }),
    );
    expect(
      await screen.findByText(en.coreIdentity.roleBranch.permissions.workspaceLockedNotice),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roleBranch.footer.reviewChanges }),
    );
    expect(await screen.findByText("Jeddah West")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roleBranch.footer.saveChanges }),
    );

    await waitFor(() => expect(mockSaveRoleBranchPermissions).toHaveBeenCalledTimes(1));
    expect(mockSaveRoleBranchPermissions.mock.calls[0]?.[0]).toBe(roleId);
    expect(mockSaveRoleBranchPermissions.mock.calls[0]?.[1]).toEqual({
      expectedRevision: "3",
      catalogueRevision: "a".repeat(64),
      profiles: [
        { branchId: branchRiyadhId, permissionIds: [permViewOwnId] },
        { branchId: branchJeddahId, permissionIds: [] },
      ],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("handles uncertain save outcomes by re-reading GET state rather than blindly re-PUTting", async () => {
    const initialDoc = buildFixtureDocument();
    const appliedDoc: RoleBranchPermissionsDocument = {
      ...initialDoc,
      revision: "4",
      profiles: [
        ...initialDoc.profiles,
        {
          branchId: branchJeddahId,
          companyId,
          branchName: "Jeddah West",
          companyName: "Mutakamel Trading",
          isActive: true,
          permissionIds: [],
        },
      ],
    };

    mockFetchRoleBranchPermissions
      .mockResolvedValueOnce(initialDoc)
      .mockResolvedValueOnce(appliedDoc);
    mockSaveRoleBranchPermissions.mockRejectedValueOnce(
      new TenantApiClientError("Gateway timeout", {
        status: 504,
        statusText: "Gateway Timeout",
        headers: new Headers(),
        data: {
          errorCode: "GW.UPSTREAM.UNAVAILABLE",
          correlationId: "019a4000-0000-7000-8000-000000000099",
        },
      }),
    );

    const onSaved = vi.fn();
    renderBranchModal(onSaved);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Jeddah West" }));
    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roleBranch.footer.nextPermissions }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: en.coreIdentity.roleBranch.footer.reviewChanges }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: en.coreIdentity.roleBranch.footer.saveChanges }),
    );

    expect(
      await screen.findByText(en.coreIdentity.roleBranch.dialogs.saveUncertain.title),
    ).toBeInTheDocument();
    expect(screen.getByText("019a4000-0000-7000-8000-000000000099")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: en.coreIdentity.roleBranch.dialogs.saveUncertain.checkState }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockSaveRoleBranchPermissions).toHaveBeenCalledTimes(1);
    expect(mockFetchRoleBranchPermissions).toHaveBeenCalledTimes(2);
  });
});
