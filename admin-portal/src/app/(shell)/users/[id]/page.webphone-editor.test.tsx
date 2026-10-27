// @vitest-environment jsdom

import { Suspense } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser, AdminWebphoneExtension } from "../types";
import type { WebphoneServer } from "../../settings/webphone/webphone-contract";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const USER_ID = "019f0000-0000-7000-8000-0000000000c1";
const EXTENSION_ID = "019f0000-0000-7000-8000-0000000000c2";
const ROLE_ID = "019f0000-0000-7000-8000-0000000000c3";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";

const api = vi.hoisted(() => ({
  WEBPHONE_EXTENSIONS_PATH: "/api/admin/webphone/v1/extensions",
  userWebphonePath: (id: string) => `/api/admin/webphone/v1/extensions/${id}`,
  userWebphoneServersPath: (id: string) =>
    `/api/admin/webphone/v1/extensions/${id}/servers`,
  getAdminUser: vi.fn(),
  getUserWebphone: vi.fn(),
  listWebphoneServers: vi.fn(),
  getExtensionServers: vi.fn(),
  listRoles: vi.fn(),
  createUserWebphone: vi.fn(),
  updateUserWebphone: vi.fn(),
  putExtensionServers: vi.fn(),
  updateAdminUser: vi.fn(),
  assignUserRole: vi.fn(),
  suspendAdminUser: vi.fn(),
  activateAdminUser: vi.fn(),
  resendAdminInvite: vi.fn(),
  deleteAdminUser: vi.fn(),
  isForbiddenError: () => false,
  normalizeErrorCode: () => null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const auth = vi.hoisted(() => ({
  user: { id: "admin", isSuperAdmin: true, permissions: [] as string[] },
  isLoading: false,
}));

vi.mock("../api/adminUsersApi", () => ({
  ...api,
  listAssignableRoles: (purpose: string, params: unknown) => {
    expect(purpose).toBe("assignment");
    return api.listRoles(params);
  },
}));
vi.mock("@mutakamel/webphone-ui", () => ({ notifyWebphoneChanged: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => auth,
}));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  const { ar } = await import("@/i18n/dictionaries/ar");
  const value = () => ({ lang: locale.lang, dir: locale.lang === "ar" ? "rtl" : "ltr", t: locale.lang === "ar" ? ar : en });
  return {
    useI18n: value,
    useOptionalI18n: value,
  };
});

import UserDetailPage from "./page";
import { useUserDetail } from "../hooks/useUserDetail";

const SERVER_ID = "019f0000-0000-7000-8000-0000000000c4";
const storedChain = [{ serverId: SERVER_ID, priority: 1, timeoutSeconds: null, maxRetries: null }];
const server: WebphoneServer = {
  id: SERVER_ID,
  name: "Primary SIP server",
  sipDomain: "sip.example.invalid",
  websocketUrl: "wss://sip.example.invalid/ws",
  priority: 1,
  enabled: true,
  realm: null,
  outboundProxy: null,
  fromDomain: null,
  registrarServer: null,
  contactUri: null,
  registerExpires: 300,
  defaultCallerId: null,
  iceTransportPolicy: "all",
  iceEnabled: true,
  traceSip: false,
  sessionTimers: true,
  allowInvalidTlsCertificate: false,
  defaultTimeoutSeconds: 10,
  defaultMaxRetries: 2,
  iceServers: [],
};

async function renderDetail() {
  await act(async () => {
    render(<Suspense fallback={null}><UserDetailPage params={Promise.resolve({ id: USER_ID })} /></Suspense>);
  });
  await screen.findByText("Assigned Control Plane Role");
}

function adminUser(): AdminUser {
  return {
    id: USER_ID,
    email: "omar@example.com",
    firstName: "Omar",
    lastName: "Hassan",
    isSuperAdmin: false,
    status: "ACTIVE",
    roleId: ROLE_ID,
    role: { id: ROLE_ID, name: "Support" },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function extension(): AdminWebphoneExtension {
  return {
    id: EXTENSION_ID,
    ownerId: USER_ID,
    extension: "7001",
    sipUsername: "omar.hassan",
    passwordConfigured: true,
    displayName: "Omar Hassan",
    outboundCallerId: null,
    enabled: true,
  };
}

async function openEditor() {
  // The route component reads its params with `use()`, which suspends until
  // the promise settles — the App Router supplies the boundary in production.
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <UserDetailPage params={Promise.resolve({ id: USER_ID })} />
      </Suspense>,
    );
  });
  const edit = await screen.findByRole("button", {
    name: "Edit Phone Settings",
  });
  fireEvent.click(edit);
  return screen.findByLabelText("SIP Extension");
}

describe("user detail role assignment and WebPhone editor", () => {
  it('resends a pending invitation with loading feedback and preserves its key after an ambiguous failure', async () => {
    const invited = { ...adminUser(), status: 'INVITED' as const };
    api.getAdminUser.mockResolvedValue(invited);
    let rejectRequest!: (reason: unknown) => void;
    api.resendAdminInvite.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    await act(async () => {
      render(<Suspense fallback={null}><UserDetailPage params={Promise.resolve({ id: USER_ID })} /></Suspense>);
    });
    const button = await screen.findByRole('button', { name: 'Resend invitation' });
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Sending invitation...' })).toBeDisabled();
    await act(async () => rejectRequest(new Error('network unavailable')));
    await screen.findByRole('button', { name: 'Resend invitation' });
    const firstKey = api.resendAdminInvite.mock.calls[0][1];
    api.resendAdminInvite.mockResolvedValueOnce(invited);
    fireEvent.click(screen.getByRole('button', { name: 'Resend invitation' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      'Invitation queued', 'A new invitation was queued. Previous invitation links are no longer valid.',
    ));
    expect(api.resendAdminInvite.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey]);
    expect(firstKey).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]+$/i);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    locale.lang = "en";
    auth.user.isSuperAdmin = true;
    auth.user.permissions = [];
    api.getAdminUser.mockResolvedValue(adminUser());
    api.getUserWebphone.mockResolvedValue(extension());
    api.listWebphoneServers.mockResolvedValue([]);
    api.getExtensionServers.mockResolvedValue([]);
    api.listRoles.mockResolvedValue({
      data: [{ id: ROLE_ID, name: "Support" }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    api.updateUserWebphone.mockResolvedValue(extension());
  });

  it.each([
    { lang: "en", failure: "503" },
    { lang: "ar", failure: "503" },
    { lang: "en", failure: "network" },
    { lang: "ar", failure: "network" },
  ] as const)("shows a retryable initial $failure error in $lang without an editable form", async ({ lang, failure }) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    api.getAdminUser.mockRejectedValueOnce(failure === "503"
      ? { response: { status: 503, data: { success: false, errorCode: "SERVICE_UNAVAILABLE", message: "Unavailable", correlationId: "user-load-107" } } }
      : new Error("network unavailable"));

    await act(async () => {
      render(<Suspense fallback={null}><UserDetailPage params={Promise.resolve({ id: USER_ID })} /></Suspense>);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(t.users.loadError);
    if (failure === "503") expect(screen.getByRole("alert")).toHaveTextContent("user-load-107");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.users.suspendAccount })).not.toBeInTheDocument();
    expect(api.updateAdminUser).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.users.retryLoad }));
    });
    expect(await screen.findByDisplayValue("Omar")).toBeInTheDocument();
    expect(api.getAdminUser).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(t.users.loadError)).not.toBeInTheDocument();
    expect(screen.queryByText(t.users.detailRefreshFailed)).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("identifies stale fields after a failed refresh in %s and clears the warning on retry", async (lang) => {
    // Changing locale triggers the hook's existing full detail reload.
    locale.lang = lang === "en" ? "ar" : "en";
    const params = Promise.resolve({ id: USER_ID });
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Suspense fallback={null}><UserDetailPage params={params} /></Suspense>);
    });
    await screen.findByDisplayValue("Omar");

    api.getAdminUser.mockRejectedValueOnce(new Error("refresh unavailable"));
    locale.lang = lang;
    await act(async () => {
      view.rerender(<Suspense fallback={null}><UserDetailPage params={params} /></Suspense>);
    });
    const t = lang === "ar" ? ar : en;
    expect(await screen.findByText(t.users.detailRefreshFailed)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Omar")).toBeInTheDocument();

    api.getAdminUser.mockResolvedValueOnce({ ...adminUser(), firstName: "Updated" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.users.retryLoad }));
    });
    expect(await screen.findByDisplayValue("Updated")).toBeInTheDocument();
    expect(screen.queryByText(t.users.detailRefreshFailed)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Omar")).not.toBeInTheDocument();
  });

  it("does not classify a different user's failed initial load as stale data", async () => {
    const { result, rerender } = renderHook(({ id }) => useUserDetail(id), { initialProps: { id: USER_ID } });
    await waitFor(() => expect(result.current.detailLoadState).toBe("ready"));
    api.getAdminUser.mockRejectedValueOnce(new Error("new user unavailable"));
    rerender({ id: "019f0000-0000-7000-8000-0000000000d1" });
    await waitFor(() => expect(result.current.detailLoadState).toBe("error"));
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores an older reload failure after a newer reload succeeds", async () => {
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.detailLoadState).toBe("ready"));
    let rejectRead!: (reason: unknown) => void;
    api.getAdminUser.mockImplementationOnce(() => new Promise<AdminUser>((_resolve, reject) => { rejectRead = reject; }));
    let olderReload!: Promise<void>;
    act(() => { olderReload = result.current.reload(); });
    expect(result.current.detailLoadState).toBe("loading");
    api.getAdminUser.mockResolvedValueOnce({ ...adminUser(), firstName: "Latest" });
    await act(async () => { await result.current.reload(); });
    expect(result.current.detailLoadState).toBe("ready");

    await act(async () => { rejectRead(new Error("old failure")); await olderReload; });
    expect(result.current.detailLoadState).toBe("ready");
    expect(result.current.firstName).toBe("Latest");
    expect(result.current.loadError).toBeNull();
  });

  it("does not read a role catalogue for a read-only user-detail actor", async () => {
    auth.user = { id: "admin", isSuperAdmin: false, permissions: ["admin.users.read", "admin.roles.read"] };
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rolesStatus).toBe("unavailable");
    expect(result.current.availableRoles).toEqual([adminUser().role]);
    expect(api.listRoles).not.toHaveBeenCalled();
    act(() => result.current.setAssignedRoleId("unavailable-role"));
    await act(async () => { await result.current.saveRole(); });
    expect(api.assignUserRole).not.toHaveBeenCalled();
  });

  it("rejects direct selection of a role outside the assignable projection", async () => {
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    act(() => result.current.setAssignedRoleId("unavailable-role"));
    await act(async () => { await result.current.saveRole(); });
    expect(api.assignUserRole).not.toHaveBeenCalled();
  });

  it("loads and assigns a role beyond the first catalogue page", async () => {
    auth.user = { id: "admin", isSuperAdmin: false, permissions: ["admin.users.read", "admin.users.assign_roles", "admin.users.critical"] };
    const laterRole = { id: "019f0000-0000-7000-8000-0000000000d9", name: "Later role" };
    api.listRoles.mockImplementation(async ({ page }: { page: number }) => ({
      data: page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ id: `role-${index}`, name: `Role ${index}` }))
        : [laterRole],
      meta: { page, limit: 100, total: 101, totalPages: 2, hasNext: page === 1, hasPrev: page > 1 },
    }));
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    expect(result.current.availableRoles).toContainEqual(adminUser().role);
    expect(result.current.availableRoles).toContainEqual(laterRole);
    act(() => result.current.setAssignedRoleId(laterRole.id));
    api.getAdminUser.mockResolvedValue({ ...adminUser(), roleId: laterRole.id, role: laterRole });
    await act(async () => { await result.current.saveRole(); });
    expect(api.assignUserRole).toHaveBeenCalledWith(USER_ID, { roleId: laterRole.id }, expect.any(String));
    expect(result.current.assignedRoleId).toBe(laterRole.id);
  });

  it.each(["en", "ar"] as const)("displays an assigned role beyond page one in %s", async (lang) => {
    locale.lang = lang;
    const assigned = { id: ROLE_ID, name: "Support", nameI18n: { en: "Later support", ar: "دعم إضافي" } };
    api.getAdminUser.mockResolvedValue({ ...adminUser(), role: assigned });
    api.listRoles.mockImplementation(async ({ page }: { page: number }) => ({
      data: page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ id: `role-${index}`, name: `Role ${index}` }))
        : [assigned],
      meta: { page, limit: 100, total: 101, totalPages: 2, hasNext: page === 1, hasPrev: page > 1 },
    }));
    await act(async () => {
      render(<Suspense fallback={null}><UserDetailPage params={Promise.resolve({ id: USER_ID })} /></Suspense>);
    });
    const rolePicker = await screen.findByRole("combobox", { name: (lang === "ar" ? ar : en).users.roleLabel });
    await waitFor(() => expect(rolePicker).toBeEnabled());
    expect(rolePicker).toHaveTextContent(assigned.nameI18n[lang]);
  });

  it("keeps the assigned role and unsaved identity when retrying a failed catalogue", async () => {
    api.listRoles.mockRejectedValue(new Error("Unavailable"));
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.rolesStatus).toBe("error"));
    expect(result.current.assignedRoleId).toBe(ROLE_ID);
    expect(result.current.availableRoles).toEqual([adminUser().role]);
    act(() => result.current.setFirstName("Unsaved"));
    api.getAdminUser.mockClear();
    api.listRoles.mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
    act(() => result.current.reloadRoles());
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    expect(result.current.firstName).toBe("Unsaved");
    expect(result.current.availableRoles).toEqual([adminUser().role]);
    expect(api.getAdminUser).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)("makes protected targets read-only with a %s explanation", async (lang) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    auth.user.isSuperAdmin = false;
    auth.user.permissions = [
      "admin.users.read", "admin.users.update", "admin.users.assign_roles",
      "admin.users.suspend", "admin.users.delete", "admin.users.critical",
    ];
    api.getAdminUser.mockResolvedValue({ ...adminUser(), isSuperAdmin: true });
    await act(async () => {
      render(<Suspense fallback={null}><UserDetailPage params={Promise.resolve({ id: USER_ID })} /></Suspense>);
    });

    expect(await screen.findByText(t.users.protectedSuperAdminReason)).toBeInTheDocument();
    expect(screen.getByLabelText(t.users.firstNameLabel)).toBeDisabled();
    expect(screen.getByLabelText(t.users.lastNameLabel)).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: t.users.roleLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.users.suspendAccount })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.users.delete })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.users.saveChanges })).not.toBeInTheDocument();
    expect(api.updateAdminUser).not.toHaveBeenCalled();
    expect(api.assignUserRole).not.toHaveBeenCalled();
    expect(api.suspendAdminUser).not.toHaveBeenCalled();
    expect(api.deleteAdminUser).not.toHaveBeenCalled();
  });

  it("keeps ordinary targets editable by a delegated manager", async () => {
    auth.user.isSuperAdmin = false;
    auth.user.permissions = [
      "admin.users.read", "admin.users.update", "admin.users.assign_roles",
      "admin.users.suspend", "admin.users.delete", "admin.users.critical",
    ];
    await renderDetail();
    expect(screen.queryByText(en.users.protectedSuperAdminReason)).not.toBeInTheDocument();
    expect(screen.getByLabelText(en.users.firstNameLabel)).toBeEnabled();
    expect(screen.getByRole("combobox", { name: en.users.roleLabel })).toBeEnabled();
    expect(screen.getByRole("button", { name: en.users.suspendAccount })).toBeEnabled();
    expect(screen.getByRole("button", { name: en.users.delete })).toBeEnabled();
  });

  it.each([403, 503])("blocks replacement after a chain read returns %s and recovers the actual assignments on retry", async (status) => {
    api.listWebphoneServers.mockResolvedValue([server]);
    api.getExtensionServers.mockResolvedValue(storedChain).mockRejectedValueOnce({
      response: { status, data: { message: "Chain unavailable", correlationId: "chain-read-109" } },
    });
    await renderDetail();

    expect(await screen.findByText("Could not load the current server order. Retry before replacing existing assignments."))
      .toBeInTheDocument();
    expect(screen.queryByText("This user has no server in their failover chain yet."))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Server Order" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add a server")).not.toBeInTheDocument();
    expect(api.putExtensionServers).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry WebPhone reads" }));
    expect(await screen.findByText("Primary SIP server")).toBeInTheDocument();
    const timeout = screen.getByLabelText("Timeout (seconds)");
    expect(timeout).toBeEnabled();
    fireEvent.change(timeout, { target: { value: "9" } });
    expect(timeout).toHaveValue("9");
    const savedChain = [{ serverId: SERVER_ID, priority: 0, timeoutSeconds: 9, maxRetries: null }];
    api.putExtensionServers.mockResolvedValueOnce(undefined);
    api.getExtensionServers.mockResolvedValueOnce(savedChain);
    fireEvent.click(screen.getByRole("button", { name: "Save Server Order" }));
    await waitFor(() => expect(api.putExtensionServers).toHaveBeenCalledWith(
      EXTENSION_ID, savedChain, expect.any(String),
    ));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.users.serverChainSavedTitle, en.users.serverChainSavedDesc));
    expect(screen.getByLabelText("Timeout (seconds)")).toHaveValue("9");
    expect(screen.queryByRole("button", { name: "Save Server Order" })).not.toBeInTheDocument();
  });

  it("shows an extension read error instead of offering to create an unconfigured phone", async () => {
    api.getUserWebphone.mockRejectedValueOnce(new Error("lookup unavailable"));
    await renderDetail();
    expect(await screen.findByText("Could not load the WebPhone identity. Retry before editing phone settings."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Phone Settings" })).not.toBeInTheDocument();
    expect(api.getExtensionServers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry WebPhone reads" }));
    expect(await screen.findByRole("button", { name: "Edit Phone Settings" })).toBeInTheDocument();
  });

  it("blocks chain editing while the server catalogue is unavailable", async () => {
    api.listWebphoneServers.mockResolvedValue([server]).mockRejectedValueOnce(new Error("catalogue unavailable"));
    api.getExtensionServers.mockResolvedValue(storedChain);
    await renderDetail();
    expect(await screen.findByText("Could not load the server catalogue. Retry before replacing the server order."))
      .toBeInTheDocument();
    expect(screen.queryByLabelText("Timeout (seconds)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry WebPhone reads" }));
    expect(await screen.findByLabelText("Timeout (seconds)")).toBeEnabled();
  });

  it.each(["chain", "catalogue"])("refuses a direct replacement from a failed %s baseline", async (resource) => {
    if (resource === "chain") api.getExtensionServers.mockRejectedValueOnce(new Error("unavailable"));
    else api.listWebphoneServers.mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.addServerToChain(SERVER_ID));
    expect(result.current.serverChainHasChanges).toBe(true);
    expect(result.current.canEditServerChain).toBe(false);
    await act(async () => { await result.current.saveServerChain(); });
    expect(api.putExtensionServers).not.toHaveBeenCalled();
  });

  it("keeps replacement blocked during a retry until the authoritative chain succeeds", async () => {
    api.getExtensionServers.mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.chainRead.status).toBe("error"));
    let resolveChain!: (value: typeof storedChain) => void;
    api.getExtensionServers.mockImplementationOnce(() => new Promise((resolve) => { resolveChain = resolve; }));
    let retry!: Promise<void>;
    act(() => { retry = result.current.reloadWebphone(); });
    await waitFor(() => expect(result.current.chainRead.status).toBe("loading"));
    act(() => result.current.addServerToChain(SERVER_ID));
    await act(async () => { await result.current.saveServerChain(); });
    expect(api.putExtensionServers).not.toHaveBeenCalled();
    await act(async () => { resolveChain(storedChain); await retry; });
    expect(result.current.serverChainRows.map((row) => row.serverId)).toEqual([SERVER_ID]);
    expect(result.current.canEditServerChain).toBe(true);
  });

  it("requires update permission even after all reads succeed", async () => {
    auth.user.isSuperAdmin = false;
    auth.user.permissions = ["admin.users.read", "admin.webphone.read"];
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chainRead.status).toBe("success");
    act(() => result.current.addServerToChain(SERVER_ID));
    await act(async () => { await result.current.saveServerChain(); });
    expect(result.current.canEditServerChain).toBe(false);
    expect(api.putExtensionServers).not.toHaveBeenCalled();
  });

  it("does not read or mutate WebPhone without read permission", async () => {
    auth.user.isSuperAdmin = false;
    auth.user.permissions = ["admin.users.read", "admin.webphone.update"];
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setSipExtension("7001");
      result.current.setSipUsername("omar.hassan");
      result.current.addServerToChain(SERVER_ID);
    });
    await act(async () => {
      await result.current.saveWebphone();
      await result.current.saveServerChain();
    });
    expect(api.getUserWebphone).not.toHaveBeenCalled();
    expect(api.listWebphoneServers).not.toHaveBeenCalled();
    expect(api.getExtensionServers).not.toHaveBeenCalled();
    expect(api.createUserWebphone).not.toHaveBeenCalled();
    expect(api.putExtensionServers).not.toHaveBeenCalled();
  });

  it("accepts an authoritative empty chain but blocks further saves after its post-write refresh fails", async () => {
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEditServerChain).toBe(true);
    act(() => result.current.addServerToChain(SERVER_ID));
    api.putExtensionServers.mockResolvedValueOnce(undefined);
    api.getExtensionServers.mockRejectedValueOnce(new Error("refresh unavailable"));
    await act(async () => { await result.current.saveServerChain(); });
    expect(result.current.chainRead.status).toBe("error");
    expect(result.current.canEditServerChain).toBe(false);
    await act(async () => { await result.current.saveServerChain(); });
    expect(api.putExtensionServers).toHaveBeenCalledOnce();
    api.getExtensionServers.mockResolvedValueOnce(storedChain);
    await act(async () => { await result.current.reloadWebphone(); });
    expect(result.current.canEditServerChain).toBe(true);
    expect(result.current.serverChainHasChanges).toBe(false);
  });

  it("does not turn a failed initial chain read after creation into an editable empty chain", async () => {
    api.getUserWebphone.mockResolvedValue(undefined);
    api.createUserWebphone.mockResolvedValue(extension());
    api.getExtensionServers.mockRejectedValueOnce(new Error("new chain unavailable"));
    const { result } = renderHook(() => useUserDetail(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.webphoneRead.status).toBe("success");
    act(() => {
      result.current.setSipExtension("7001");
      result.current.setSipUsername("omar.hassan");
    });
    await act(async () => { await result.current.saveWebphone(); });
    expect(api.createUserWebphone).toHaveBeenCalledOnce();
    expect(result.current.chainRead.status).toBe("error");
    expect(result.current.canEditServerChain).toBe(false);
    act(() => result.current.addServerToChain(SERVER_ID));
    await act(async () => { await result.current.saveServerChain(); });
    expect(api.putExtensionServers).not.toHaveBeenCalled();
  });

  it.each(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"] as const)(
    "shows role selection only for an active target (status %s)",
    async (status) => {
      api.getAdminUser.mockResolvedValue({ ...adminUser(), status });
      await act(async () => {
        render(
          <Suspense fallback={null}>
            <UserDetailPage params={Promise.resolve({ id: USER_ID })} />
          </Suspense>,
        );
      });
      await screen.findByText("Assigned Control Plane Role");

      const selector = screen.queryByRole("combobox", { name: "Assigned Role" });
      if (status === "ACTIVE") {
        expect(selector).toBeEnabled();
      } else {
        expect(selector).not.toBeInTheDocument();
        expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: "Apply Role Assignment" }))
          .not.toBeInTheDocument();
      }
      expect(api.assignUserRole).not.toHaveBeenCalled();
    },
  );

  // The operator clears the extension to whitespace and saves. The hook is
  // right to refuse, but the editor used to collapse to the summary anyway,
  // which reads exactly like a save that landed — over a stored extension that
  // was never touched.
  it("stays open when the form is rejected before any request", async () => {
    const extensionInput = await openEditor();
    fireEvent.change(extensionInput, { target: { value: "   " } });

    const save = screen.getByRole("button", { name: "Save Phone Settings" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(api.updateUserWebphone).not.toHaveBeenCalled();
    expect(screen.getByLabelText("SIP Extension")).toBeInTheDocument();
    expect(screen.getByLabelText("SIP Extension")).toHaveFocus();
    expect(
      screen.getByText(
        "Enabled WebPhone settings require an extension and SIP username.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Phone Settings" }),
    ).not.toBeInTheDocument();
  });

  // A request that reached the server and was refused is no more a save than a
  // form that never left the browser.
  it("stays open when the request fails", async () => {
    api.updateUserWebphone.mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          errorCode: "WEBPHONE_EXTENSION_TAKEN",
          message: "That extension is already assigned.",
          statusCode: 409,
        },
      },
    });
    const extensionInput = await openEditor();
    fireEvent.change(extensionInput, { target: { value: "7002" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Phone Settings" }));

    await waitFor(() => expect(api.updateUserWebphone).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByLabelText("SIP Extension")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Edit Phone Settings" }),
    ).not.toBeInTheDocument();
  });

  it("closes to the summary only after a confirmed save", async () => {
    const saved = { ...extension(), extension: "7002" };
    api.updateUserWebphone.mockResolvedValue(saved);
    api.getUserWebphone.mockResolvedValue(extension());
    const extensionInput = await openEditor();
    fireEvent.change(extensionInput, { target: { value: "7002" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Phone Settings" }));

    expect(
      await screen.findByRole("button", { name: "Edit Phone Settings" }),
    ).toBeInTheDocument();
    expect(api.updateUserWebphone).toHaveBeenCalledOnce();
  });
});
