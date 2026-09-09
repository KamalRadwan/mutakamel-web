// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { createAddonAssignmentOptionsFixture } from "../application-addon-assignment-options.fixture";
import type { ApplicationAddonAssignmentOptionsPage } from "../application-addon-assignment-options";
const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: false, permissions: ["applications.addon_seats.read"] }, isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const read = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("../application-addon-assignment-options", () => ({ readApplicationAddonAssignmentOptions: read }));
const { useAddonAssignmentOptions } = await import("./useAddonAssignmentOptions");
const body = createAddonAssignmentOptionsFixture(), userId = body.data[0].userId;
const page: ApplicationAddonAssignmentOptionsPage = { items: body.data, meta: body.meta };
beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: false, permissions: ["applications.addon_seats.read"] }; auth.isAuthenticated = true;
  auth.realtimeAuthGeneration = "session-1"; read.mockReset().mockResolvedValue(page);
});
afterEach(cleanup);

describe("read-only assignment precondition lifecycle", () => {
  it.each(["applications.addon_seats.read", "applications.addon_seats.manage"])("admits genuine %s without profile permission", async (permission) => {
    auth.user.permissions = [permission]; const { result } = renderHook(() => useAddonAssignmentOptions(userId));
    await waitFor(() => expect(result.current.data).toBe(page)); expect(result.current.denied).toBe(false);
  });
  it.each(["users.user.read", "applications.activation.manage", "applications.addon_seats.read.all"])("does not substitute %s", (permission) => {
    auth.user.permissions = [permission]; const { result } = renderHook(() => useAddonAssignmentOptions(userId));
    expect(result.current.denied).toBe(true); expect(read).not.toHaveBeenCalled();
  });
  it("admits current owner but retires its facts on authentication loss", async () => {
    auth.user.isTenantOwner = true; auth.user.permissions = [];
    const { result, rerender } = renderHook(() => useAddonAssignmentOptions(userId)); await waitFor(() => expect(result.current.data).toBe(page));
    auth.isAuthenticated = false; rerender(); expect(result.current.denied).toBe(true); expect(result.current.data).toBeNull();
    read.mockReturnValueOnce(new Promise(() => undefined)); auth.isAuthenticated = true; rerender(); expect(result.current.data).toBeNull();
  });
  it("honors actual403 without turning it into absent assignments", async () => {
    read.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useAddonAssignmentOptions(userId)); await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.data).toBeNull();
  });
  it("resets pagination and rejects late results after changing user", async () => {
    let resolveOld!: (value: ApplicationAddonAssignmentOptionsPage) => void;
    const { result, rerender } = renderHook(({ target }) => useAddonAssignmentOptions(target), { initialProps: { target: userId } });
    await waitFor(() => expect(result.current.data).toBe(page));
    read.mockReturnValueOnce(new Promise<ApplicationAddonAssignmentOptionsPage>((resolve) => { resolveOld = resolve; }));
    act(() => result.current.changePage(2)); expect(result.current.data).toBeNull();
    const signal = read.mock.calls[1][1] as AbortSignal; rerender({ target: body.data[0].applicationId });
    expect(signal.aborted).toBe(true); expect(read.mock.calls[2][0].page).toBe(1);
    await waitFor(() => expect(result.current.data).toBe(page));
    await act(async () => resolveOld({ ...page, items: [] })); expect(result.current.data).toBe(page);
  });
  it("fences session, refresh, actor and permissions then aborts on unmount", async () => {
    const { result, rerender, unmount } = renderHook(() => useAddonAssignmentOptions(userId)); await waitFor(() => expect(result.current.data).toBe(page));
    read.mockReturnValueOnce(new Promise(() => undefined)); auth.realtimeAuthGeneration = "session-2"; rerender(); expect(result.current.data).toBeNull();
    act(() => result.current.reload()); await waitFor(() => expect(result.current.data).toBe(page));
    read.mockReturnValueOnce(new Promise(() => undefined)); auth.user.id = "another-actor"; rerender(); expect(result.current.data).toBeNull();
    auth.user.permissions = []; rerender(); expect(result.current.denied).toBe(true); expect(result.current.data).toBeNull();
    unmount(); expect((read.mock.calls[3][1] as AbortSignal).aborted).toBe(true);
  });
});
