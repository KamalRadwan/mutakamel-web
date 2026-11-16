// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { ORG_TREE_TOO_LARGE_CODE } from "../../contracts/organization-contract";
import OrganizationTreePage from "../page";
import { OrganizationNodeDetail } from "./OrganizationNodeDetail";

const companyId = "01900100-0000-7000-8000-000000000010";
const branchId = "01900100-0000-7000-8000-000000000020";
const departmentId = "01900100-0000-7000-8000-000000000030";
const teamId = "01900100-0000-7000-8000-000000000040";
const leadUserId = "01900100-0000-7000-8000-000000000050";

const state = vi.hoisted(() => ({
  user: null as {
    id: string;
    isTenantOwner: boolean;
    permissions: string[];
    permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
  } | null,
  fetchTree: vi.fn(),
  fetchNode: vi.fn(),
  fetchNodes: vi.fn(),
  readCoreData: vi.fn(),
}));

function setPermissions(permissions: string[], isTenantOwner = false) {
  state.user = {
    id: "01900100-0000-7000-8000-000000000099",
    isTenantOwner,
    permissions,
    permissionScopes: Object.fromEntries(
      permissions.map((key) => [key, { tenantWide: true, companyIds: [], branchIds: [] }]),
    ),
  };
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/organization",
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

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: state.readCoreData,
  readCorePage: vi.fn(),
  writeCoreData: vi.fn(),
}));

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
  fetchOrgTree: state.fetchTree,
  fetchOrgNode: state.fetchNode,
  fetchOrgNodes: state.fetchNodes,
}));

const companyRecord = {
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

const branchRecord = {
  id: branchId,
  companyId,
  code: "RIY-HQ",
  name: "Riyadh Headquarters",
  address: "King Fahd Rd",
  phone: "+966110000000",
  isHeadquarters: true,
  status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const departmentRecord = {
  id: departmentId,
  branchId,
  code: "OPS",
  name: "Operations",
  status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

const teamRecord = {
  id: teamId,
  departmentId,
  leadUserId,
  code: "SALES",
  name: "Enterprise Sales",
  status: "ACTIVE" as const,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions([]);
});

afterEach(cleanup);

describe("OrganizationNodeDetail and OrganizationTreePage", () => {
  it("renders PermissionGate instead of EmptyState when level read permission is missing or server returns 403", async () => {
    setPermissions([]);
    const { rerender } = render(<OrganizationNodeDetail level="teams" id={teamId} />);
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();

    setPermissions(["org.team.read", "org.company.read"]);
    const forbidden = new TenantApiClientError("forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      data: { errorCode: "FORBIDDEN" },
    });
    state.fetchNode.mockRejectedValueOnce(forbidden);
    rerender(<OrganizationNodeDetail level="teams" id={teamId} />);
    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeTruthy());
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();

    cleanup();
    state.fetchTree.mockRejectedValueOnce(forbidden);
    render(<OrganizationTreePage />);
    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeTruthy());
    expect(screen.queryByText(en.coreIdentity.tree.emptyTitle)).toBeNull();
  });

  it("resolves authorized parent hierarchy and team lead names on the retained detail route", async () => {
    setPermissions([
      "org.team.read",
      "org.department.read",
      "org.branch.read",
      "org.company.read",
      "users.user.read",
    ]);
    state.fetchNode.mockResolvedValue(teamRecord);
    state.fetchNodes.mockImplementation(async (level: string) => {
      if (level === "departments") return { items: [departmentRecord], page: 1, limit: 100, total: 1 };
      if (level === "branches") return { items: [branchRecord], page: 1, limit: 100, total: 1 };
      return { items: [companyRecord], page: 1, limit: 100, total: 1 };
    });
    state.readCoreData.mockResolvedValue({
      id: leadUserId,
      firstName: "Sara",
      lastName: "Al-Mansoor",
      email: "sara@acme.example",
    });

    render(<OrganizationNodeDetail level="teams" id={teamId} />);

    expect(await screen.findByText("Sara Al-Mansoor")).toBeTruthy();
    expect(await screen.findByText("Operations")).toBeTruthy();
    expect(await screen.findByText("Riyadh Headquarters")).toBeTruthy();
    expect(await screen.findByText("Acme Holding")).toBeTruthy();
    expect(screen.getByText("sara@acme.example")).toBeTruthy();
    expect(screen.queryByText(en.coreIdentity.detail.placementDescription)).toBeNull();
  });

  it("falls back to explicit unavailable labels and never leaks raw UUIDs when upstream permissions are absent", async () => {
    setPermissions(["org.team.read"]);
    state.fetchNode.mockResolvedValue(teamRecord);

    const { container } = render(<OrganizationNodeDetail level="teams" id={teamId} />);

    await waitFor(() => expect(screen.getAllByText("Enterprise Sales").length).toBeGreaterThan(0));
    expect(state.fetchNodes).not.toHaveBeenCalled();
    expect(state.readCoreData).not.toHaveBeenCalled();
    expect(screen.getAllByText(en.coreIdentity.grants.nameUnavailable).length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain(departmentId);
    expect(container.textContent).not.toContain(leadUserId);
  });

  it("renders NotFoundState without a retry button when given an invalid UUIDv7", async () => {
    setPermissions(["org.branch.read"]);
    render(<OrganizationNodeDetail level="branches" id="invalid-id" />);

    await waitFor(() =>
      expect(screen.getByText(en.coreIdentity.levels.branches.notFoundTitle)).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
  });

  it("renders the 422 ORG_TREE_TOO_LARGE guidance card with links to all four level workspaces", async () => {
    setPermissions(["org.company.read"]);
    state.fetchTree.mockRejectedValue(
      new TenantApiClientError("too large", {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: new Headers(),
        data: { errorCode: ORG_TREE_TOO_LARGE_CODE },
      }),
    );

    render(<OrganizationTreePage />);

    const guidanceTitle = await screen.findByText(en.coreIdentity.tree.tooLargeTitle);
    const guidanceCard = guidanceTitle.parentElement?.parentElement;
    if (!guidanceCard) throw new Error("Missing oversized-tree guidance card");
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
    expect(
      within(guidanceCard)
        .getByRole("link", { name: en.coreIdentity.levels.companies.title })
        .getAttribute("href"),
    ).toBe("/core/organization/companies");
    expect(
      within(guidanceCard)
        .getByRole("link", { name: en.coreIdentity.levels.branches.title })
        .getAttribute("href"),
    ).toBe("/core/organization/branches");
    expect(
      within(guidanceCard)
        .getByRole("link", { name: en.coreIdentity.levels.departments.title })
        .getAttribute("href"),
    ).toBe("/core/organization/departments");
    expect(
      within(guidanceCard)
        .getByRole("link", { name: en.coreIdentity.levels.teams.title })
        .getAttribute("href"),
    ).toBe("/core/organization/teams");
  });
});
