// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { RoleGrantsPanel } from "./RoleGrantsPanel";

const io = vi.hoisted(() => ({ options: vi.fn() }));
const permissions = ["users.user.assign_roles", "roles.role.read", "org.branch.read", "org.company.read"];
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    isTenantOwner: true, permissions,
    permissionScopes: Object.fromEntries(permissions.map(key => [key, {
      tenantWide: true, companyIds: [], branchIds: [],
    }])),
  } }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => "en", useDirection: () => "ltr", useDictionary: () => en,
}));
vi.mock("../../../contracts/assignment-options-contract", async original => ({
  ...await original<typeof import("../../../contracts/assignment-options-contract")>(),
  fetchAssignmentOptions: io.options,
}));
vi.mock("../../../contracts/role-assignment-contract", async original => ({
  ...await original<typeof import("../../../contracts/role-assignment-contract")>(),
  fetchBranchRoleAssignments: async () => [],
  fetchScopeRoleAssignments: async () => [],
}));
const emptyPage = { items: [], page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
vi.mock("../../../contracts/role-contract", async original => ({
  ...await original<typeof import("../../../contracts/role-contract")>(),
  fetchTenantRoles: async () => emptyPage,
}));
vi.mock("../../../contracts/organization-contract", async original => ({
  ...await original<typeof import("../../../contracts/organization-contract")>(),
  fetchOrgNodes: async () => emptyPage,
}));

function failure(status: number) {
  return new TenantApiClientError("Private internal SQL failure", {
    status, statusText: "Server refusal", headers: new Headers(),
    data: { errorCode: "COMMON.GENERIC.INTERNAL_ERROR", correlationId: "grant-check-ref" },
  });
}
function mount() {
  return render(<RoleGrantsPanel
    userId="0199f2b0-1111-7222-8333-444455556601"
    canAssignRoles isTenantOwnerActor
  />);
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("lead verification of assignment-option failures", () => {
  it("keeps writes disabled, exposes a support reference, and retries a server failure", async () => {
    io.options.mockRejectedValue(failure(500));
    mount();
    expect((await screen.findAllByText(/grant-check-ref/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: en.coreIdentity.grants.addBranchRole })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.coreIdentity.grants.editScopeRoles })).toBeDisabled();
    expect(document.body).not.toHaveTextContent("Private internal SQL failure");
    fireEvent.click(screen.getAllByRole("button", { name: en.common.retry })[0]);
    await waitFor(() => expect(io.options).toHaveBeenCalledTimes(2));
  });

  it("honors an authoritative 403 even when cached session permissions allow assignment", async () => {
    io.options.mockRejectedValue(failure(403));
    mount();
    expect(await screen.findByText(en.permissionGate.title)).toBeVisible();
    expect(screen.queryByRole("button", { name: en.coreIdentity.grants.addBranchRole })).not.toBeInTheDocument();
    expect(screen.queryByText(en.coreIdentity.grants.branchEmpty)).not.toBeInTheDocument();
  });
});
