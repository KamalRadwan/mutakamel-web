// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoles } from "./useRoles";
import { rolesApi } from "../api";
import type { AdminRole, RolePage } from "../contract";

const authMock: { user: { isSuperAdmin: boolean; permissions: string[] } } = {
  user: { isSuperAdmin: false, permissions: [] },
};
const toastMock = { success: vi.fn(), error: vi.fn() };

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      roles: {
        deletedTitle: "Deleted",
        deletedDesc: "Role deleted successfully.",
        deleteFailedTitle: "Delete failed",
      },
    },
  }),
}));
vi.mock("../api", () => ({
  rolesApi: { list: vi.fn(), remove: vi.fn() },
}));

const ROLE_ID = "019f0000-0000-7000-8000-000000000021";
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

function pageResult(overrides: Partial<RolePage> = {}): RolePage {
  return {
    items: [role],
    page: 1,
    limit: 20,
    total: 21,
    totalPages: 2,
    hasNext: true,
    hasPrev: false,
    correlationId: "019f0000-0000-7000-8000-000000000029",
    timestamp: TIMESTAMP,
    ...overrides,
  };
}

describe("useRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = { isSuperAdmin: false, permissions: [] };
    vi.mocked(rolesApi.list).mockResolvedValue(pageResult());
    vi.mocked(rolesApi.remove).mockResolvedValue(undefined);
  });

  it("loads authoritative totals and changes the server page", async () => {
    vi.mocked(rolesApi.list)
      .mockResolvedValueOnce(pageResult())
      .mockResolvedValueOnce(
        pageResult({ page: 2, hasNext: false, hasPrev: true }),
      );
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalItems).toBe(21);
    expect(result.current.totalPages).toBe(2);
    expect(rolesApi.list).toHaveBeenCalledWith(
      { page: 1, limit: 20, sortBy: "createdAt", sortDir: "DESC" },
      expect.any(AbortSignal),
    );

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() =>
      expect(rolesApi.list).toHaveBeenLastCalledWith(
        { page: 2, limit: 20, sortBy: "createdAt", sortDir: "DESC" },
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.hasPrev).toBe(true);
  });

  it("keeps name search local to the current page and never sends a fake server query", async () => {
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBeforeSearch = vi.mocked(rolesApi.list).mock.calls.length;
    act(() => result.current.setSearch("missing"));

    expect(result.current.roles).toEqual([]);
    expect(result.current.totalItems).toBe(21);
    expect(rolesApi.list).toHaveBeenCalledTimes(callsBeforeSearch);
  });

  it("retains the last confirmed page while exposing a refresh error", async () => {
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.rolesOnPage).toHaveLength(1));
    vi.mocked(rolesApi.list).mockRejectedValueOnce({
      response: {
        status: 503,
        data: { code: "GW.UPSTREAM.UNAVAILABLE", title: "Unavailable", status: 503 },
      },
    });
    act(() => result.current.refreshRoles());

    await waitFor(() => expect(result.current.listError?.httpStatus).toBe(503));
    expect(result.current.rolesOnPage).toEqual([role]);
  });

  it.each([
    ["delete only", ["admin.roles.delete"]],
    ["critical only", ["admin.roles.critical"]],
    ["neither permission", []],
  ])("fails closed before delete with %s", async (_label, permissions) => {
    authMock.user.permissions = permissions;
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.rolesOnPage).toHaveLength(1));
    act(() => result.current.openDeleteModal(ROLE_ID));

    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.deleteError?.httpStatus).toBe(403);
    expect(rolesApi.remove).not.toHaveBeenCalled();
  });

  it("reuses the exact delete UUIDv7 after an ambiguous outcome", async () => {
    authMock.user.permissions = ["admin.roles.delete", "admin.roles.critical"];
    vi.mocked(rolesApi.remove)
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.rolesOnPage).toHaveLength(1));
    act(() => result.current.openDeleteModal(ROLE_ID));

    await act(async () => result.current.confirmDelete());
    expect(result.current.isDeleteAmbiguous).toBe(true);
    expect(result.current.isDeleteModalOpen).toBe(true);
    await act(async () => result.current.confirmDelete());

    const firstKey = vi.mocked(rolesApi.remove).mock.calls[0]?.[1];
    const secondKey = vi.mocked(rolesApi.remove).mock.calls[1]?.[1];
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/u);
    expect(secondKey).toBe(firstKey);
    expect(result.current.isDeleteModalOpen).toBe(false);
  });
});
