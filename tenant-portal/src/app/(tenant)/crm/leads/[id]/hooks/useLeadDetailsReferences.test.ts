// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCoreData } from "@/lib/api/envelope";
import { axiosClient } from "@/lib/api/axiosClient";
import type { LeadDetail } from "../../lead-contract";
import { useLeadDetailsReferences } from "./useLeadDetailsReferences";

const auth = vi.hoisted(() => ({ user: { id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan", status: "ACTIVE", permissions: [] as string[], accessibleBranches: ["01900100-0000-7000-8000-000000000002", "01900100-0000-7000-8000-000000000004"], accessibleCompanies: [] as string[], accessibleBranchCompanies: [] as { branchId: string; companyId: string }[], teamMemberships: [] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/lib/api/envelope", () => ({ readCoreData: vi.fn(), readCorePage: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));
const lead = { id: "01900100-0000-7000-8000-000000000003", branchId: auth.user.accessibleBranches[0], ownerUserId: auth.user.id, createdByUserId: auth.user.id, updatedAt: "2026-09-07T00:00:00.000Z" } as LeadDetail;
const user2 = { id: "01900100-0000-7000-8000-000000000004", firstName: "Dina", lastName: "Ali" };
const user3 = { id: "01900100-0000-7000-8000-000000000005", firstName: "Ahmed", lastName: "Ali" };
const COMPANY = "01900100-0000-7000-8000-000000000006";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
  auth.user = {
    ...auth.user,
    accessibleCompanies: [COMPANY],
    accessibleBranchCompanies: auth.user.accessibleBranches.map((branchId) => ({ branchId, companyId: COMPANY })),
  };
  vi.mocked(axiosClient.get).mockImplementation(async (url) => ({
    data: url.includes("/assignable-owners?") ? { items: [], nextCursor: null } : [],
  }) as Awaited<ReturnType<typeof axiosClient.get>>);
});

describe("lead detail references", () => {
  it("does not call the user directory without permission, but uses the known current user", async () => {
    const { result } = renderHook(() => useLeadDetailsReferences(lead, true, null));
    await waitFor(() => expect(result.current.tagsLoading).toBe(false));
    expect(readCoreData).not.toHaveBeenCalled();
    expect(result.current.knownUsers.get(auth.user.id)?.firstName).toBe("Kamal");
    await waitFor(() => expect(result.current.usersLoading).toBe(false));
    expect(axiosClient.get).toHaveBeenCalledTimes(2);
    expect(result.current.ownerOptions).toEqual([]);
  });
  it("loads team owners without Core users permission and filters the capability boundary", async () => {
    const crmOwner = (user: typeof user2) => ({ id: user.id, displayName: `${user.firstName} ${user.lastName}`, avatarUrl: null });
    vi.mocked(axiosClient.get).mockImplementation(async (url) => ({ data: url.includes("/assignable-owners?")
      ? { items: [crmOwner(user2), crmOwner(user3)], nextCursor: null } : []
    }) as Awaited<ReturnType<typeof axiosClient.get>>);
    const { result } = renderHook(() => useLeadDetailsReferences(lead, true, [user3.id]));
    await waitFor(() => expect(result.current.ownerOptions).toEqual([{ id: user3.id, firstName: "Ahmed Ali", lastName: "" }]));
    expect(readCoreData).not.toHaveBeenCalled();
    expect(axiosClient.get).toHaveBeenCalledWith(expect.stringContaining(`branchId=${lead.branchId}&resource=leads&action=update`), expect.objectContaining({
      headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": lead.branchId },
    }));
    expect(result.current.usersUnavailable).toBe(false);
  });
  it("waits for branch ownership before requesting scoped owners", async () => {
    auth.user = { ...auth.user, accessibleCompanies: [], accessibleBranchCompanies: [] };
    const { rerender } = renderHook(() => useLeadDetailsReferences(lead, true, null));
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledWith(expect.stringContaining("/tags"), expect.any(Object)));
    expect(vi.mocked(axiosClient.get).mock.calls.some(([url]) => url.includes("/assignable-owners?"))).toBe(false);

    auth.user = {
      ...auth.user,
      accessibleCompanies: [COMPANY],
      accessibleBranchCompanies: [{ branchId: lead.branchId, companyId: COMPANY }],
    };
    rerender();
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledWith(expect.stringContaining("/assignable-owners?"), expect.objectContaining({
      headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": lead.branchId },
    })));
  });
  it("does not offer the actor as a fallback when CRM refuses the owner read", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (url) => {
      if (url.includes("/assignable-owners?")) throw new Error("Forbidden");
      return { data: [] } as Awaited<ReturnType<typeof axiosClient.get>>;
    });
    const { result } = renderHook(() => useLeadDetailsReferences(lead, true, null));
    await waitFor(() => expect(result.current.usersUnavailable).toBe(true));
    expect(result.current.ownerOptions).toEqual([]);
    expect(result.current.knownUsers.get(auth.user.id)?.firstName).toBe("Kamal");
  });
  it("ignores an aborted branch's late owner response", async () => {
    let finishOld: ((value: Awaited<ReturnType<typeof axiosClient.get>>) => void) | undefined;
    vi.mocked(axiosClient.get).mockImplementation(async (url) => {
      if (!url.includes("/assignable-owners?")) return { data: [] } as Awaited<ReturnType<typeof axiosClient.get>>;
      if (url.includes(`branchId=${lead.branchId}`)) return new Promise<Awaited<ReturnType<typeof axiosClient.get>>>((resolve) => { finishOld = resolve; });
      return { data: { items: [{ id: user3.id, displayName: "Ahmed Ali", avatarUrl: null }], nextCursor: null } } as Awaited<ReturnType<typeof axiosClient.get>>;
    });
    const { result, rerender } = renderHook(({ branchId }) => useLeadDetailsReferences({ ...lead, branchId }, true, null), { initialProps: { branchId: lead.branchId } });
    await waitFor(() => expect(finishOld).toBeDefined());
    rerender({ branchId: user2.id });
    await waitFor(() => expect(result.current.ownerOptions[0]?.id).toBe(user3.id));
    await act(async () => {
      finishOld?.({ data: { items: [{ id: user2.id, displayName: "Dina Ali", avatarUrl: null }], nextCursor: null } } as Awaited<ReturnType<typeof axiosClient.get>>);
    });
    await waitFor(() => expect(result.current.usersLoading).toBe(false));
    expect(result.current.ownerOptions.map(({ id }) => id)).toEqual([user3.id]);
  });
  it("does not substitute the actor for an unknown creator or call failed tags empty", async () => {
    vi.mocked(axiosClient.get).mockRejectedValue(new Error("Forbidden"));
    const { result } = renderHook(() => useLeadDetailsReferences({ ...lead, createdByUserId: user2.id }, false, null));
    await waitFor(() => expect(result.current.tagsUnavailable).toBe(true));
    expect(result.current.knownUsers.get(user2.id)).toBeUndefined();
  });
});
