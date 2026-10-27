// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listRoles: vi.fn(),
  listAssignableRoles: vi.fn(),
  isForbiddenError: (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 403,
}));
vi.mock("../api/adminUsersApi", () => api);

import { loadAdminRoleCatalogue, useAdminRoleCatalogue } from "./useAdminRoleCatalogue";

function rolePage(total: number, page: number) {
  return {
    data: Array.from({ length: Math.min(100, Math.max(0, total - (page - 1) * 100)) }, (_, index) => {
      const id = (page - 1) * 100 + index;
      return { id: `role-${id}`, name: `Role ${id}` };
    }),
    meta: { page, limit: 100, total, totalPages: Math.ceil(total / 100), hasNext: page < Math.ceil(total / 100), hasPrev: page > 1 },
  };
}

describe("complete bounded administrator role catalogue", () => {
  beforeEach(() => { api.listRoles.mockReset(); api.listAssignableRoles.mockReset(); });

  it.each(["invite", "assignment"] as const)("uses only the narrow %s projection", async (purpose) => {
    api.listAssignableRoles.mockImplementation(async (_purpose, { page }) => rolePage(101, page));
    expect(await loadAdminRoleCatalogue(purpose)).toHaveLength(101);
    expect(api.listAssignableRoles).toHaveBeenNthCalledWith(1, purpose, { page: 1, limit: 100, sortBy: "name", sortDir: "ASC" });
    expect(api.listRoles).not.toHaveBeenCalled();
  });

  it("does not read unavailable prerequisites and discards a late response after access changes", async () => {
    let resolve!: (value: ReturnType<typeof rolePage>) => void;
    api.listAssignableRoles.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ enabled, authority }) => useAdminRoleCatalogue("assignment", enabled, authority), {
      initialProps: { enabled: false, authority: "actor-1" },
    });
    expect(result.current.rolesStatus).toBe("unavailable");
    act(() => result.current.reloadRoles());
    expect(api.listAssignableRoles).not.toHaveBeenCalled();
    rerender({ enabled: true, authority: "actor-1" });
    expect(result.current.rolesStatus).toBe("loading");
    rerender({ enabled: false, authority: "actor-1" });
    await act(async () => resolve(rolePage(1, 1)));
    expect(result.current.roles).toEqual([]);
    expect(result.current.rolesStatus).toBe("unavailable");
    api.listAssignableRoles.mockResolvedValue(rolePage(0, 1));
    rerender({ enabled: true, authority: "actor-2" });
    expect(result.current.rolesStatus).toBe("loading");
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    expect(result.current.roles).toEqual([]);
  });

  it("loads every page and retains the roles after page one", async () => {
    api.listRoles.mockImplementation(async ({ page }: { page: number }) => rolePage(201, page));
    const roles = await loadAdminRoleCatalogue();
    expect(roles).toHaveLength(201);
    expect(roles[200]).toEqual({ id: "role-200", name: "Role 200" });
    expect(api.listRoles.mock.calls.map(([params]) => params)).toEqual([1, 2, 3].map((page) => ({ page, limit: 100, sortBy: "name", sortDir: "ASC" })));
  });

  it("publishes no partial options after a later-page failure and retries from page one", async () => {
    api.listRoles.mockResolvedValueOnce(rolePage(101, 1)).mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(() => useAdminRoleCatalogue());
    await waitFor(() => expect(result.current.rolesStatus).toBe("error"));
    expect(result.current.roles).toEqual([]);
    api.listRoles.mockImplementation(async ({ page }: { page: number }) => rolePage(101, page));
    act(() => result.current.reloadRoles());
    expect(result.current.rolesStatus).toBe("loading");
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    expect(result.current.roles).toHaveLength(101);
    expect(api.listRoles.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1, 2]);
  });

  it("distinguishes a forbidden catalogue from a successful empty catalogue", async () => {
    api.listRoles.mockRejectedValue({ response: { status: 403 } });
    const { result } = renderHook(() => useAdminRoleCatalogue());
    await waitFor(() => expect(result.current.rolesStatus).toBe("forbidden"));
    api.listRoles.mockResolvedValue(rolePage(0, 1));
    act(() => result.current.reloadRoles());
    await waitFor(() => expect(result.current.rolesStatus).toBe("success"));
    expect(result.current.roles).toEqual([]);
  });

  it("accepts exactly 5,000 roles within fifty requests", async () => {
    api.listRoles.mockImplementation(async ({ page }: { page: number }) => rolePage(5000, page));
    expect(await loadAdminRoleCatalogue()).toHaveLength(5000);
    expect(api.listRoles).toHaveBeenCalledTimes(50);
  });

  it("rejects a catalogue exceeding the safe bound without publishing page one", async () => {
    api.listRoles.mockResolvedValue(rolePage(5001, 1));
    const { result } = renderHook(() => useAdminRoleCatalogue());
    await waitFor(() => expect(result.current.rolesStatus).toBe("error"));
    expect(result.current.roles).toEqual([]);
    expect(api.listRoles).toHaveBeenCalledOnce();
  });

  it("rejects overlapping pages instead of silently omitting roles", async () => {
    const second = rolePage(101, 2);
    second.data[0] = { id: "role-0", name: "Role 0" };
    api.listRoles.mockResolvedValueOnce(rolePage(101, 1)).mockResolvedValueOnce(second);
    await expect(loadAdminRoleCatalogue()).rejects.toThrow("Invalid role catalogue entry");
  });

  it("rejects a page without pagination evidence", async () => {
    api.listRoles.mockResolvedValue({ data: [] });
    await expect(loadAdminRoleCatalogue()).rejects.toThrow("Incomplete role catalogue");
  });

  it("stops paging after its consumer unmounts", async () => {
    let resolve!: (value: ReturnType<typeof rolePage>) => void;
    api.listRoles.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => useAdminRoleCatalogue());
    unmount();
    await act(async () => { resolve(rolePage(101, 1)); });
    expect(api.listRoles).toHaveBeenCalledOnce();
  });
});
