// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import type { UserContactProfile } from "@/lib/people/user-profile";

const { read, auth } = vi.hoisted(() => ({ read: vi.fn(), auth: {
  user: null as TenantUserProfile | null, realtimeAuthGeneration: "session-1",
} }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/lib/people/user-profile", async (original) => ({
  ...await original<typeof import("@/lib/people/user-profile")>(), readUserContactProfile: read,
}));
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useUserProfiles } from "./useUserProfiles";

const ME = "01900100-0000-7000-8000-000000000010";
const A = "01900100-0000-7000-8000-000000000011";
const B = "01900100-0000-7000-8000-000000000012";
const profile = (id: string, fullName = "Saly Essam"): UserContactProfile => ({ id, fullName, email: "saly@example.com", phone: null, imageUrl: null });
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: ME, firstName: "Kamal", lastName: "Radwan", email: "kamal@example.com", isTenantOwner: false,
    status: "ACTIVE", permissions: ["users.user.read"], accessibleBranches: [], accessibleCompanies: [], teamMemberships: [] };
  auth.realtimeAuthGeneration = "session-1";
  read.mockImplementation(async (id: string) => profile(id));
});
afterEach(cleanup);

describe("scoped reusable user lookups", () => {
  it("deduplicates old/new references and reuses completed reads across pages", async () => {
    const { result, rerender } = renderHook(({ ids }) => useUserProfiles(ids), { initialProps: { ids: [A, A] } });
    await waitFor(() => expect(result.current.profiles.get(A)?.status).toBe("ready"));
    expect(read).toHaveBeenCalledTimes(1);
    rerender({ ids: [B, A, A] });
    await waitFor(() => expect(result.current.profiles.get(B)?.status).toBe("ready"));
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("uses the authenticated actor's name without a directory read and refuses other reads without permission", async () => {
    auth.user!.permissions = [];
    const { result } = renderHook(() => useUserProfiles([ME, A, "not-a-uuid"]));
    await act(async () => {});
    expect(result.current.profiles.get(ME)?.profile?.fullName).toBe("Kamal Radwan");
    expect(result.current.profiles.get(A)?.status).toBe("forbidden");
    expect(result.current.profiles.has("not-a-uuid")).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it("aborts late responses and hides cached details immediately when the session changes", async () => {
    let resolveOld!: (value: UserContactProfile) => void;
    read.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(() => useUserProfiles([A]));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    const oldSignal = read.mock.calls[0][1] as AbortSignal;
    auth.realtimeAuthGeneration = "session-2";
    read.mockResolvedValue(profile(A, "Fresh name"));
    rerender();
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.profiles.get(A)?.profile).toBeNull();
    await waitFor(() => expect(result.current.profiles.get(A)?.profile?.fullName).toBe("Fresh name"));
    await act(async () => resolveOld(profile(A, "Stale name")));
    expect(result.current.profiles.get(A)?.profile?.fullName).toBe("Fresh name");
    auth.user!.permissions = [];
    rerender();
    expect(result.current.profiles.get(A)?.status).toBe("forbidden");
    expect(result.current.profiles.get(A)?.profile).toBeNull();
  });
  it.each([{ status: 403, expected: "forbidden" }, { status: 404, expected: "unavailable" }])("distinguishes HTTP $status without inventing a person", async ({ status, expected }) => {
    read.mockRejectedValue(new TenantApiClientError("Cannot read", { status, statusText: "Cannot read", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useUserProfiles([A]));
    await waitFor(() => expect(result.current.profiles.get(A)?.status).toBe(expected));
    expect(result.current.profiles.get(A)?.profile).toBeNull();
  });
  it("retries failed reads without losing already resolved people", async () => {
    read.mockImplementation(async (id: string) => { if (id === A) throw new Error("offline"); return profile(id); });
    const { result } = renderHook(() => useUserProfiles([A, B]));
    await waitFor(() => expect(result.current.profiles.get(A)?.status).toBe("error"));
    await waitFor(() => expect(result.current.profiles.get(B)?.status).toBe("ready"));
    read.mockResolvedValue(profile(A));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.profiles.get(A)?.status).toBe("ready"));
    expect(read.mock.calls.filter(([id]) => id === B)).toHaveLength(1);
  });
  it("refreshes current contact details after a committed save", async () => {
    const { result, rerender } = renderHook(({ token }) => useUserProfiles([A], true, token), { initialProps: { token: 1 } });
    await waitFor(() => expect(result.current.profiles.get(A)?.status).toBe("ready"));
    read.mockResolvedValue(profile(A, "Renamed person"));
    rerender({ token: 2 });
    expect(result.current.profiles.get(A)?.profile).toBeNull();
    await waitFor(() => expect(result.current.profiles.get(A)?.profile?.fullName).toBe("Renamed person"));
  });
});
