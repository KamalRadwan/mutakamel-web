// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTenantRoleCatalogues, type TenantAccessController } from "./use-tenant-access";
import type { PageResult, RoleOption } from "./types";
import { TENANT_ID, branchFixture, pageFixture, roleFixture, userFixture } from "./__tests__/fixtures";

const mocks = vi.hoisted(() => ({ listRoles: vi.fn(), listBranches: vi.fn() }));
vi.mock("./api", () => ({ tenantAccessApi: mocks }));

function controller(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID, enabled: true, ready: true, isAuthLoading: false,
    permissions: { canRead: true, canReadRoles: true, canAssignRoles: true },
    ...overrides,
  } as unknown as TenantAccessController;
}

beforeEach(() => {
  mocks.listRoles.mockReset().mockResolvedValue(pageFixture([roleFixture]));
  mocks.listBranches.mockReset().mockResolvedValue(pageFixture([branchFixture]));
});
afterEach(cleanup);

describe("tenant role dialog queries", () => {
  it("resolves off-page assigned branch names without changing selector pages", async () => {
    const assignedBranch = { ...branchFixture, id: "assigned-branch", name: "Alexandria" };
    const user = userFixture({ roleAssignments: [{ ...userFixture().roleAssignments[0], branchId: assignedBranch.id }] });
    mocks.listBranches.mockImplementation(async (_tenant, query) => query.limit === 50
      ? pageFixture([branchFixture], { total: 101, totalPages: 3, hasNext: true })
      : query.page === 1
        ? pageFixture(Array.from({ length: 100 }, (_, index) => ({ ...branchFixture, id: `branch-${index}` })), { total: 101, totalPages: 2, hasNext: true })
        : pageFixture([assignedBranch], { page: 2, total: 101, totalPages: 2, hasPrev: true }));
    const { result } = renderHook(() => useTenantRoleCatalogues(controller(), user));
    await waitFor(() => expect(result.current.assignmentBranches.data?.[assignedBranch.id]).toBe("Acme · Alexandria"));
    expect(result.current.branches.resource.data?.page).toBe(1);
    expect(result.current.branches.resource.data?.items).toEqual([branchFixture]);
    expect(mocks.listBranches).toHaveBeenCalledWith(TENANT_ID, { page: 2, limit: 100 }, expect.any(AbortSignal));
    act(() => result.current.branches.setSearch("Cairo"));
    await waitFor(() => expect(result.current.branches.resource.status).toBe("ready"));
    expect(result.current.assignmentBranches.data?.[assignedBranch.id]).toBe("Acme · Alexandria");
    expect(mocks.listBranches.mock.calls.filter(([, query]) => query.limit === 100)).toHaveLength(2);
  });

  it("ignores superseded responses and aborts outstanding reads on close", async () => {
    let resolveOld!: (page: PageResult<RoleOption>) => void;
    mocks.listRoles.mockReturnValueOnce(new Promise<PageResult<RoleOption>>((resolve) => { resolveOld = resolve; }));
    const user = userFixture();
    const { result, unmount } = renderHook(() => useTenantRoleCatalogues(controller(), user));
    await waitFor(() => expect(mocks.listRoles).toHaveBeenCalledTimes(1));
    const signal = mocks.listRoles.mock.calls[0][2] as AbortSignal;
    act(() => result.current.roles.setSearch("Finance"));
    await waitFor(() => expect(result.current.roles.resource.status).toBe("ready"));
    await act(async () => resolveOld(pageFixture([{ ...roleFixture, id: "stale", name: "Stale" }])));
    expect(signal.aborted).toBe(true);
    expect(result.current.roles.known.stale).toBeUndefined();
    expect(result.current.roles.resource.data?.items).toEqual([roleFixture]);
    const latestSignal = mocks.listRoles.mock.calls[1][2] as AbortSignal;
    unmount();
    expect(latestSignal.aborted).toBe(true);
  });

  it("retries failures and omits q when search is cleared", async () => {
    mocks.listRoles.mockRejectedValueOnce(new Error("offline"));
    const user = userFixture();
    const { result } = renderHook(() => useTenantRoleCatalogues(controller(), user));
    await waitFor(() => expect(result.current.roles.resource.status).toBe("error"));
    act(() => result.current.roles.retry());
    await waitFor(() => expect(result.current.roles.resource.status).toBe("ready"));
    act(() => result.current.roles.setSearch("  Finance  "));
    await waitFor(() => expect(mocks.listRoles).toHaveBeenLastCalledWith(TENANT_ID, { q: "Finance", page: 1, limit: 50 }, expect.any(AbortSignal)));
    act(() => result.current.roles.setSearch(""));
    await waitFor(() => expect(mocks.listRoles).toHaveBeenLastCalledWith(TENANT_ID, { page: 1, limit: 50 }, expect.any(AbortSignal)));
  });

  it.each([
    { ready: false }, { enabled: false }, { isAuthLoading: true },
    { permissions: { canRead: false, canReadRoles: true, canAssignRoles: true } },
    { permissions: { canRead: true, canReadRoles: false, canAssignRoles: true } },
    { permissions: { canRead: true, canReadRoles: true, canAssignRoles: false } },
  ])("does not read while readiness or authorization is missing: %j", async (overrides) => {
    const user = userFixture();
    const { unmount } = renderHook(() => useTenantRoleCatalogues(controller(overrides), user));
    await act(async () => {});
    expect(mocks.listRoles).not.toHaveBeenCalled();
    expect(mocks.listBranches).not.toHaveBeenCalled();
    unmount();
  });
});
