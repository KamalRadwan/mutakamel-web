// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "../types";

const api = vi.hoisted(() => ({
  inviteAdminUser: vi.fn(),
  listAdminUsers: vi.fn(),
  listRoles: vi.fn(),
  isForbiddenError: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status === 403,
  normalizeErrorCode: (error: unknown) => {
    const data = (error as { response?: { data?: Record<string, unknown> } })
      ?.response?.data;
    return (data?.errorCode as string) ?? (data?.code as string) ?? null;
  },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../api/adminUsersApi", () => api);
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin", isSuperAdmin: true } }),
}));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en" as const, t: en }) };
});

import { useInviteUserModal } from "./useInviteUserModal";

const ROLE_ID = "019f0000-0000-7000-8000-0000000000a1";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";

// The invitation this operator is trying to send, and an account that already
// held every one of its fields long before today.
const command = {
  email: "omar@example.com",
  firstName: "Omar",
  lastName: "Hassan",
};

function activeLookalike(): AdminUser {
  return {
    id: "019f0000-0000-7000-8000-0000000000b2",
    email: command.email,
    firstName: command.firstName,
    lastName: command.lastName,
    isSuperAdmin: false,
    status: "ACTIVE",
    roleId: ROLE_ID,
    role: { id: ROLE_ID, name: "Support" },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function unavailable() {
  return {
    response: {
      status: 503,
      data: {
        success: false,
        errorCode: "UPSTREAM_UNAVAILABLE",
        message: "The service is temporarily unavailable.",
        statusCode: 503,
      },
    },
  };
}

async function fillAndSubmit(hook: {
  current: ReturnType<typeof useInviteUserModal>;
}) {
  act(() => {
    hook.current.setEmail(command.email);
    hook.current.setFirstName(command.firstName);
    hook.current.setLastName(command.lastName);
    hook.current.setRoleId(ROLE_ID);
  });
  await act(async () => {
    await hook.current.handleSubmit();
  });
}

describe("useInviteUserModal ambiguous invitation", () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    api.listRoles.mockResolvedValue({
      data: [{ id: ROLE_ID, name: "Support" }],
    });
    api.listAdminUsers.mockResolvedValue({ data: [activeLookalike()] });
  });

  const render = () =>
    renderHook(() => useInviteUserModal({ onClose, onSuccess }));

  // A directory row that matches every submitted field proves an account like
  // this exists — never that this command created it. The account below was
  // already ACTIVE, so no invitation email can have been sent for it today.
  it("does not confirm an ambiguous invitation from a matching existing account", async () => {
    api.inviteAdminUser.mockRejectedValue(unavailable());
    const { result: hook } = render();
    await waitFor(() => expect(hook.current.isLoadingRoles).toBe(false));

    await fillAndSubmit(hook);

    expect(hook.current.isAmbiguous).toBe(true);
    expect(hook.current.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the unresolved intent so an exact retry reuses the same key", async () => {
    api.inviteAdminUser
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValueOnce(activeLookalike());
    const { result: hook } = render();
    await waitFor(() => expect(hook.current.isLoadingRoles).toBe(false));

    await fillAndSubmit(hook);
    expect(hook.current.isAmbiguous).toBe(true);
    const pendingKey = hook.current.idempotencyKey;

    await act(async () => {
      await hook.current.handleSubmit();
    });

    expect(api.inviteAdminUser).toHaveBeenCalledTimes(2);
    expect(api.inviteAdminUser.mock.calls[1]?.[1]).toBe(pendingKey);
    expect(hook.current.isAmbiguous).toBe(false);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("still closes on a plainly successful invitation", async () => {
    api.inviteAdminUser.mockResolvedValue(activeLookalike());
    const { result: hook } = render();
    await waitFor(() => expect(hook.current.isLoadingRoles).toBe(false));

    await fillAndSubmit(hook);

    expect(hook.current.isAmbiguous).toBe(false);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
