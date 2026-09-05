// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, toastMock, i18nMock } = vi.hoisted(() => ({
  apiMock: {
    countAdminUsers: vi.fn(),
    listAdminUsers: vi.fn(),
    listWebphoneExtensions: vi.fn(),
    getAdminUser: vi.fn(),
    isForbiddenError: vi.fn(() => false),
    listRoles: vi.fn(),
    suspendAdminUser: vi.fn(),
    activateAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    normalizeErrorCode: vi.fn(() => "UNKNOWN"),
  },
  authMock: { user: { isSuperAdmin: true, permissions: [] as string[] }, isLoading: false },
  toastMock: { error: vi.fn(), success: vi.fn() },
  i18nMock: {
    lang: "en" as const,
    dir: "ltr" as const,
    t: { users: { fetchLoadErrorTitle: "error" } } as never,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => i18nMock,
  useOptionalI18n: () => i18nMock,
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/adminUsersApi", () => apiMock);

import { useUsers } from "./useUsers";

const META = { total: 1, totalPages: 1, page: 1, limit: 20 };
const user = (id: string, status: string) => ({
  id,
  status,
  isSuperAdmin: false,
  email: `${id}@example.test`,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * UI-012. `fetchUsers` wrote users, metrics and loading on every completion,
 * with no generation and no abort. A slow response for one filter therefore
 * landed on top of a newer one: the operator changed the status filter, the
 * older request answered second, and the table showed rows that did not match
 * the filter displayed above it.
 */
describe("useUsers out-of-order responses", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => {
      if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
    });
    apiMock.isForbiddenError.mockReturnValue(false);
    apiMock.normalizeErrorCode.mockReturnValue("UNKNOWN");
    apiMock.listRoles.mockResolvedValue({ data: [] });
    apiMock.listWebphoneExtensions.mockResolvedValue([]);
    apiMock.countAdminUsers.mockResolvedValue(0);
  });

  it("ignores an older list response after a newer filter has been requested", async () => {
    const stale = deferred<unknown>();
    apiMock.listAdminUsers
      .mockImplementationOnce(() => stale.promise)
      .mockResolvedValue({ data: [user("fresh", "SUSPENDED")], meta: META });

    const { result } = renderHook(() => useUsers());

    // A newer request supersedes the outstanding one.
    act(() => result.current.setStatusFilter("SUSPENDED"));
    await waitFor(() =>
      expect(result.current.users.map((u) => u.id)).toEqual(["fresh"]),
    );

    // The first request answers late.
    await act(async () => {
      stale.resolve({ data: [user("stale", "ACTIVE")], meta: META });
      await Promise.resolve();
    });

    expect(result.current.users.map((u) => u.id)).toEqual(["fresh"]);
    expect(result.current.isLoading).toBe(false);
  });
});
