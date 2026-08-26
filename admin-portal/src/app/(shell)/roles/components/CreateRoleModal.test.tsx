// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateRoleModal } from "./CreateRoleModal";
import { rolesApi } from "../api";
import type { AdminRole } from "../contract";

const pushMock = vi.fn();
const toastMock = { success: vi.fn(), error: vi.fn() };
const authMock: { user: { isSuperAdmin: boolean; permissions: string[] } } = {
  user: { isSuperAdmin: false, permissions: [] },
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("../api", () => ({ rolesApi: { create: vi.fn() } }));

const ROLE_ID = "019f0000-0000-7000-8000-000000000031";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";
const role: AdminRole = {
  id: ROLE_ID,
  name: "Billing Manager",
  description: null,
  isSystem: false,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  permissionIds: [],
};

describe("CreateRoleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.roles.create", "admin.roles.critical"],
    };
    vi.mocked(rolesApi.create).mockResolvedValue({
      data: role,
      correlationId: "019f0000-0000-7000-8000-000000000039",
      timestamp: TIMESTAMP,
    });
  });

  it.each([
    ["create only", ["admin.roles.create"]],
    ["critical only", ["admin.roles.critical"]],
    ["neither permission", []],
  ])("fails closed with %s", async (_label, permissions) => {
    authMock.user.permissions = permissions;
    render(<CreateRoleModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Role Name/u), {
      target: { value: "Billing Manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create & Continue" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("admin.roles.critical"),
      ),
    );
    expect(rolesApi.create).not.toHaveBeenCalled();
  });

  it("rejects a trimmed-empty or one-character role name", () => {
    render(<CreateRoleModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Create & Continue" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Role Name/u), {
      target: { value: " x " },
    });
    expect(submit).toBeDisabled();
  });

  it("reuses a caller-owned UUIDv7 for an exact ambiguous create retry", async () => {
    vi.mocked(rolesApi.create)
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce({
        data: role,
        correlationId: "019f0000-0000-7000-8000-000000000039",
        timestamp: TIMESTAMP,
      });
    const onClose = vi.fn();
    render(<CreateRoleModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Role Name/u), {
      target: { value: "  Billing Manager  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create & Continue" }));

    expect(await screen.findByText(/outcome unconfirmed/iu)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry exact operation" }));
    await waitFor(() => expect(rolesApi.create).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(rolesApi.create).mock.calls[0]?.[1];
    const secondKey = vi.mocked(rolesApi.create).mock.calls[1]?.[1];
    expect(vi.mocked(rolesApi.create).mock.calls[0]?.[0]).toEqual({
      name: "Billing Manager",
    });
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
    expect(secondKey).toBe(firstKey);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(pushMock).toHaveBeenCalledWith(`/roles/${ROLE_ID}`);
  });
});
