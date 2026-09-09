// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCoreData, readCorePage } from "@/lib/api/envelope";
import { axiosClient } from "@/lib/api/axiosClient";
import type { LeadDetail } from "../../lead-contract";
import { useLeadDetailsReferences } from "./useLeadDetailsReferences";

const auth = vi.hoisted(() => ({ user: { id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan", status: "ACTIVE", permissions: [] as string[], accessibleBranches: ["01900100-0000-7000-8000-000000000002"] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/lib/api/envelope", () => ({ readCoreData: vi.fn(), readCorePage: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));
const lead = { id: "01900100-0000-7000-8000-000000000003", branchId: auth.user.accessibleBranches[0], ownerUserId: auth.user.id, createdByUserId: auth.user.id, updatedAt: "2026-09-07T00:00:00.000Z" } as LeadDetail;
const user2 = { id: "01900100-0000-7000-8000-000000000004", firstName: "Dina", lastName: "Ali" };
const user3 = { id: "01900100-0000-7000-8000-000000000005", firstName: "Ahmed", lastName: "Ali" };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
  vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as Awaited<ReturnType<typeof axiosClient.get>>);
});

describe("lead detail references", () => {
  it("does not call the user directory without permission, but uses the known current user", async () => {
    const { result } = renderHook(() => useLeadDetailsReferences(lead, true, null));
    await waitFor(() => expect(result.current.tagsLoading).toBe(false));
    expect(readCoreData).not.toHaveBeenCalled();
    expect(readCorePage).not.toHaveBeenCalled();
    expect(result.current.knownUsers.get(auth.user.id)?.firstName).toBe("Kamal");
    expect(axiosClient.get).toHaveBeenCalledTimes(1);
  });
  it("loads every owner page and filters the capability boundary", async () => {
    auth.user.permissions = ["users.user.read"];
    vi.mocked(readCorePage).mockResolvedValueOnce({ data: [user2], meta: { page: 1, hasNext: true } }).mockResolvedValueOnce({ data: [user3], meta: { page: 2, hasNext: false } });
    const { result } = renderHook(() => useLeadDetailsReferences(lead, true, [user3.id]));
    await waitFor(() => expect(result.current.ownerOptions).toEqual([user3]));
    expect(readCorePage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(readCorePage).mock.calls[0][1]).toContain(`branchId=${lead.branchId}`);
    expect(vi.mocked(readCorePage).mock.calls[1][1]).toContain("page=2");
  });
  it("does not substitute the actor for an unknown creator or call failed tags empty", async () => {
    vi.mocked(axiosClient.get).mockRejectedValue(new Error("Forbidden"));
    const { result } = renderHook(() => useLeadDetailsReferences({ ...lead, createdByUserId: user2.id }, false, null));
    await waitFor(() => expect(result.current.tagsUnavailable).toBe(true));
    expect(result.current.knownUsers.get(user2.id)).toBeUndefined();
  });
});
