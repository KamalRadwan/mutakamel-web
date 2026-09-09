// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { createAddonAssignmentsFixture } from "../application-addon-assignments.fixture";
import type { ApplicationAddonAssignmentPage } from "../application-addon-assignments";
const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: false, permissions: ["applications.addon_seats.read"] }, isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const read = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../application-addon-assignments", () => ({ readApplicationAddonAssignments: read }));
const { useAddonAssignments } = await import("./useAddonAssignments");
const fixture = createAddonAssignmentsFixture(), userId = fixture.data[0].userId;
const page: ApplicationAddonAssignmentPage = { items: fixture.data, meta: fixture.meta };
beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: false, permissions: ["applications.addon_seats.read"] };
  auth.isAuthenticated = true; auth.realtimeAuthGeneration = "session-1"; read.mockReset().mockResolvedValue(page);
});
afterEach(cleanup);

describe("independent tenant-wide Addon allocation read", () => {
  it.each(["applications.addon_seats.read", "applications.addon_seats.manage"])("admits %s without requiring user profile access", async (permission) => {
    auth.user.permissions = [permission];
    const { result } = renderHook(() => useAddonAssignments(userId)); await waitFor(() => expect(result.current.data).toBe(page));
    expect(result.current.canBrowseUsers).toBe(false); expect(result.current.denied).toBe(false);
  });
  it.each(["users.user.read", "applications.activation.manage", "applications.addon_seats.read.all"])("does not substitute %s", (permission) => {
    auth.user.permissions = [permission]; const { result } = renderHook(() => useAddonAssignments(userId));
    expect(result.current.denied).toBe(true); expect(read).not.toHaveBeenCalled();
  });
  it("admits current owner administration but not an unauthenticated owner claim", async () => {
    auth.user.isTenantOwner = true; auth.user.permissions = [];
    const { result, rerender } = renderHook(() => useAddonAssignments(userId)); await waitFor(() => expect(result.current.data).toBe(page));
    auth.isAuthenticated = false; rerender(); expect(result.current.denied).toBe(true); expect(result.current.data).toBeNull();
  });
  it("does not turn exact-scope403 into an unassigned user", async () => {
    read.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useAddonAssignments(userId)); await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.data).toBeNull(); expect(result.current.error?.status).toBe(403);
  });
  it("discards old-user allocations and resets page on target change", async () => {
    let resolveOld: (value: ApplicationAddonAssignmentPage) => void = () => undefined;
    const { result, rerender } = renderHook(({ target }) => useAddonAssignments(target), { initialProps: { target: userId } });
    await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise<ApplicationAddonAssignmentPage>((resolve) => { resolveOld = resolve; }));
    act(() => result.current.changePage(2)); expect(result.current.data).toBeNull(); const signal = read.mock.calls[1][1] as AbortSignal;
    rerender({ target: "b4ce3816-3469-4039-9e3b-d020a24d3c9d" }); expect(signal.aborted).toBe(true);
    expect(read.mock.calls[2][0].page).toBe(1); await waitFor(() => expect(result.current.data).toBe(page));
    await act(async () => resolveOld({ ...page, items: [] })); expect(result.current.data).toBe(page);
  });
  it("hides allocations across session changes, refresh and permission removal", async () => {
    const { result, rerender, unmount } = renderHook(() => useAddonAssignments(userId)); await waitFor(() => expect(result.current.data).toBe(page));
    read.mockImplementationOnce(() => new Promise(() => undefined)); auth.realtimeAuthGeneration = "session-2"; rerender();
    expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true);
    act(() => result.current.reload()); await waitFor(() => expect(result.current.data).toBe(page));
    auth.user.permissions = []; rerender(); expect(result.current.data).toBeNull(); expect(result.current.denied).toBe(true);
    unmount(); expect((read.mock.calls[2][1] as AbortSignal).aborted).toBe(true);
  });
  it("does not revive an old A snapshot after A→B→A before the new read completes", async () => {
    const { result, rerender } = renderHook(({ target }) => useAddonAssignments(target), { initialProps: { target: userId } });
    await waitFor(() => expect(result.current.data).toBe(page));
    expect(result.current.requestedUserId).toBe(userId); expect(result.current.snapshotKey).not.toBeNull();
    read.mockImplementation(() => new Promise(() => undefined)); rerender({ target: "b4ce3816-3469-4039-9e3b-d020a24d3c9d" });
    expect(result.current.data).toBeNull(); expect(result.current.snapshotKey).toBeNull();
    rerender({ target: userId }); expect(result.current.data).toBeNull(); expect(result.current.snapshotKey).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
