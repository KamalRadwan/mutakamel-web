// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { ORG_LEVEL_CONFIG } from "../level-config";
import { OrganizationDeleteDialogs } from "./OrganizationDeleteDialogs";
import { OrganizationQuickViewDialog } from "./OrganizationQuickViewDialog";

const companyId = "01900100-0000-7000-8000-000000000010";
const branchId = "01900100-0000-7000-8000-000000000020";

const state = vi.hoisted(() => ({
  user: null as {
    id: string;
    isTenantOwner: boolean;
    permissions: string[];
    permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
  } | null,
  fetchNode: vi.fn(),
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

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
  readCorePage: vi.fn(),
  writeCoreData: vi.fn(),
}));

vi.mock("../../contracts/organization-contract", async (original) => ({
  ...(await original<typeof import("../../contracts/organization-contract")>()),
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

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions([]);
});

afterEach(cleanup);

describe("OrganizationQuickViewDialog and OrganizationDeleteDialogs", () => {
  it("preserves safe tree summary in QuickView while rendering PermissionGate when specific level read is absent or returns 403", async () => {
    setPermissions(["org.company.read"]);
    const summaryTarget = {
      kind: "summary" as const,
      level: "branches" as const,
      summary: {
        id: branchId,
        code: "RIY-HQ",
        name: "Riyadh Headquarters",
        status: "ACTIVE" as const,
      },
    };

    const { rerender } = render(
      <OrganizationQuickViewDialog target={summaryTarget} onClose={vi.fn()} />,
    );

    expect(state.fetchNode).not.toHaveBeenCalled();
    expect(screen.getAllByText("Riyadh Headquarters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RIY-HQ").length).toBeGreaterThan(0);
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
    expect(screen.queryByRole("link", { name: en.applicationAccess.viewDetails })).toBeNull();

    setPermissions(["org.company.read", "org.branch.read"]);
    state.fetchNode.mockRejectedValueOnce(
      new TenantApiClientError("forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { errorCode: "FORBIDDEN" },
      }),
    );

    rerender(
      <OrganizationQuickViewDialog
        target={{
          ...summaryTarget,
          summary: { ...summaryTarget.summary, id: "01900100-0000-7000-8000-000000000029" },
        }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText(en.permissionGate.title)).toBeTruthy());
    expect(screen.getAllByText("Riyadh Headquarters").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: en.applicationAccess.viewDetails })).toBeNull();
  });

  it("renders centered QuickView and Delete blocker / HQ-transfer dialogs with permission-gated links", async () => {
    setPermissions(["org.branch.read", "org.company.read"]);
    state.fetchNodes.mockResolvedValue({ items: [companyRecord], page: 1, limit: 100, total: 1 });

    const { rerender } = render(
      <OrganizationQuickViewDialog
        target={{ kind: "node", level: "branches", node: branchRecord }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Acme Holding")).toBeTruthy());
    const dialog = screen.getByRole("dialog");
    const hqMatches = within(dialog).getAllByText(en.coreIdentity.fields.headquarters);
    expect(hqMatches).toHaveLength(2);
    expect(hqMatches.some((element) => element.tagName === "SPAN")).toBe(true);
    const hqTerm = hqMatches.find((element) => element.tagName === "DT");
    expect(hqTerm?.nextElementSibling?.textContent).toBe(en.filters.yes);
    expect(
      screen.getByRole("link", { name: en.applicationAccess.viewDetails }).getAttribute("href"),
    ).toBe(`/core/organization/branches/${branchId}`);

    rerender(
      <OrganizationDeleteDialogs
        config={ORG_LEVEL_CONFIG.companies}
        pendingDelete={null}
        isSubmitting={false}
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        blockedNode={companyRecord}
        blockers={["company has branches"]}
        onDismissBlockers={vi.fn()}
        hqTransferBlockedNode={null}
        hqTransferError={null}
        onDismissHqTransfer={vi.fn()}
      />,
    );

    expect(screen.getByText("company has branches")).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: formatTemplate(en.deletionBlocker.view, { label: "company has branches" }),
        })
        .getAttribute("href"),
    ).toBe("/core/organization/branches");

    rerender(
      <OrganizationDeleteDialogs
        config={ORG_LEVEL_CONFIG.branches}
        pendingDelete={null}
        isSubmitting={false}
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        blockedNode={null}
        blockers={[]}
        onDismissBlockers={vi.fn()}
        hqTransferBlockedNode={branchRecord}
        hqTransferError={{ status: 409, code: "ORG_HQ_TRANSFER_REQUIRED" }}
        onDismissHqTransfer={vi.fn()}
      />,
    );

    expect(screen.getByText(en.coreIdentity.errors.ORG_HQ_TRANSFER_REQUIRED)).toBeTruthy();
  });
});
