// @vitest-environment jsdom

import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser, AdminWebphoneExtension } from "../types";

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
  deleteAdminUser: vi.fn(),
  isForbiddenError: () => false,
  normalizeErrorCode: () => null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../api/adminUsersApi", () => api);
vi.mock("@mutakamel/webphone", () => ({ notifyWebphoneChanged: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin", isSuperAdmin: true, permissions: [] },
    isLoading: false,
  }),
}));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return {
    useI18n: () => ({ lang: "en" as const, dir: "ltr", t: en }),
    useOptionalI18n: () => ({ lang: "en" as const, dir: "ltr", t: en }),
  };
});

import UserDetailPage from "./page";

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

describe("user detail WebPhone editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminUser.mockResolvedValue(adminUser());
    api.getUserWebphone.mockResolvedValue(extension());
    api.listWebphoneServers.mockResolvedValue([]);
    api.getExtensionServers.mockResolvedValue([]);
    api.listRoles.mockResolvedValue({
      data: [{ id: ROLE_ID, name: "Support" }],
    });
    api.updateUserWebphone.mockResolvedValue(extension());
  });

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
