// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TooltipProvider } from "@/design-system";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import {
  assignUserModule,
  fetchTeamMemberships,
  fetchUserModules,
  replaceTeamMemberships,
  SEAT_LIMIT_REACHED_CODE,
  type TeamMembership,
} from "../../../contracts/user-subresource-contract";
import { useUserTeamMemberships } from "../hooks/useUserTeamMemberships";
import { ModuleSeatsPanel } from "./ModuleSeatsPanel";
import { TeamMembershipsPanel } from "./TeamMembershipsPanel";

const USER_ID = "019f3100-0000-7000-8000-000000000002";
const TEAM_PRIMARY = "019f3100-0000-7000-8000-000000000031";
const TEAM_SECOND = "019f3100-0000-7000-8000-000000000032";

const SUBRESOURCE_PERMISSIONS = [
  "users.user.read",
  "users.user.manage_memberships",
  "users.user.manage_modules",
  "org.company.read",
  "org.branch.read",
  "org.department.read",
  "org.team.read",
] as const;

const SUBRESOURCE_SCOPES: Record<string, PermissionScope> = Object.fromEntries(
  SUBRESOURCE_PERMISSIONS.map((key) => [
    key,
    { tenantWide: true, companyIds: [], branchIds: [] },
  ]),
);

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "019f3100-0000-7000-8000-000000000001",
      permissions: SUBRESOURCE_PERMISSIONS,
      permissionScopes: SUBRESOURCE_SCOPES,
    },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => "en",
  useDictionary: () => en,
  useDirection: () => "ltr",
}));
vi.mock("../../../hooks/useCoreOptions", () => ({
  useOrgNodeOptions: () => ({
    options: [
      { value: TEAM_PRIMARY, label: "Core Ops Team" },
      { value: TEAM_SECOND, label: "Field Sales Team" },
    ],
    isLoading: false,
    isReady: true,
    isUnsearchedReady: true,
    total: 2,
    hasNext: false,
    labelFor: (id?: string | null) =>
      id === TEAM_PRIMARY ? "Core Ops Team" : id === TEAM_SECOND ? "Field Sales Team" : undefined,
    search: vi.fn(),
  }),
}));
vi.mock("../../../contracts/user-subresource-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../contracts/user-subresource-contract")>()),
  fetchTeamMemberships: vi.fn(),
  replaceTeamMemberships: vi.fn(),
  fetchUserModules: vi.fn(),
  assignUserModule: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(fetchTeamMemberships).mockResolvedValue([
    {
      id: "019f3100-0000-7000-8000-000000000081",
      tenantUserId: USER_ID,
      teamId: TEAM_PRIMARY,
      role: "LEAD",
      isPrimary: true,
    },
    {
      id: "019f3100-0000-7000-8000-000000000082",
      tenantUserId: USER_ID,
      teamId: TEAM_SECOND,
      role: "MEMBER",
      isPrimary: false,
    },
  ]);
  vi.mocked(fetchUserModules).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamMembershipsPanel and single-primary atomic replacement", () => {
  it("protects the primary/home team membership from direct deletion while allowing secondary removal", async () => {
    render(
      <TooltipProvider>
        <TeamMembershipsPanel
          userId={USER_ID}
          canManage
          homeTeamId={TEAM_PRIMARY}
        />
      </TooltipProvider>,
    );

    expect(await screen.findByText("Core Ops Team")).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.memberships.primary)).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.users.protected)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${en.common.delete}: Core Ops Team` }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: `${en.common.delete}: Field Sales Team` }),
    ).toBeEnabled();
  });

  it("maintains a single primary membership in replacement drafts, fences unseen/revoked writes, and preserves draft on PUT failure", async () => {
    // Pending read cannot commit unseen baseline
    vi.mocked(fetchTeamMemberships).mockReturnValueOnce(
      new Promise<TeamMembership[]>(() => undefined),
    );
    const pendingHook = renderHook(() => useUserTeamMemberships(USER_ID, true, true));
    await waitFor(() => expect(fetchTeamMemberships).toHaveBeenCalledTimes(1));
    act(() => pendingHook.result.current.startReplace());
    let pendingCommit = true;
    await act(async () => {
      pendingCommit = await pendingHook.result.current.commitDraft();
    });
    expect(pendingCommit).toBe(false);
    expect(replaceTeamMemberships).not.toHaveBeenCalled();
    pendingHook.unmount();

    vi.mocked(replaceTeamMemberships).mockRejectedValueOnce(new Error("Conflict"));
    const { result, rerender } = renderHook(
      ({ canWrite }) => useUserTeamMemberships(USER_ID, true, canWrite),
      { initialProps: { canWrite: true } },
    );
    await waitFor(() => expect(result.current.memberships).toHaveLength(2));

    act(() => result.current.startReplace());
    act(() => result.current.setPrimaryTeam(TEAM_SECOND));

    expect(result.current.draft).toEqual([
      { teamId: TEAM_PRIMARY, role: "LEAD", isPrimary: false },
      { teamId: TEAM_SECOND, role: "MEMBER", isPrimary: true },
    ]);

    const diff = result.current.draftDiff((item) => ({ label: item.teamId }));
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(2);

    let ok = true;
    await act(async () => {
      ok = await result.current.commitDraft();
    });
    expect(ok).toBe(false);
    expect(result.current.draft?.filter((item) => item.isPrimary)).toHaveLength(1);

    // Revoking canWrite blocks commitDraft immediately
    rerender({ canWrite: false });
    let afterRevoke = true;
    await act(async () => {
      afterRevoke = await result.current.commitDraft();
    });
    expect(afterRevoke).toBe(false);
    expect(replaceTeamMemberships).toHaveBeenCalledTimes(1);
  });
});

describe("ModuleSeatsPanel", () => {
  it("normalises module keys, surfaces 422 SEAT_LIMIT_REACHED inside centered FormModal, and preserves draft", async () => {
    vi.mocked(assignUserModule).mockRejectedValueOnce(
      new TenantApiClientError("No seats remaining", {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: new Headers(),
        data: { errorCode: SEAT_LIMIT_REACHED_CODE, message: "No seats remaining" },
      }),
    );

    render(<ModuleSeatsPanel userId={USER_ID} canManage />);
    expect(await screen.findByText(en.coreIdentity.modules.empty)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.modules.assign }));
    const dialog = screen.getByRole("dialog", { name: en.coreIdentity.modules.title });
    expect(dialog.querySelector("aside")).toBeNull();
    expect(within(dialog).getByText(en.coreIdentity.modules.moduleKey)).toBeVisible();

    const input = within(dialog).getByLabelText(new RegExp(en.coreIdentity.modules.moduleKey));
    fireEvent.change(input, { target: { value: " INVALID KEY! " } });
    const submit = within(dialog).getByRole("button", { name: en.coreIdentity.modules.assign });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: " CRM_SALES " } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(await screen.findByText(en.coreIdentity.modules.seatLimit)).toBeInTheDocument();
    expect(assignUserModule).toHaveBeenCalledWith(USER_ID, "crm_sales");
    expect(within(dialog).getByRole("textbox")).toHaveValue(" CRM_SALES ");
  });
});
