// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseLeadCreateCapability, useLeadCreateCapabilities } from "./useLeadCapabilities";

const { auth, get } = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

const COMPANY = "01900100-0000-7000-8000-000000000001";
const BRANCH = "01900100-0000-7000-8000-000000000002";
const OTHER_BRANCH = "01900100-0000-7000-8000-000000000003";
const OTHER_COMPANY = "01900100-0000-7000-8000-000000000004";
const OWNER = "01900100-0000-7000-8000-000000000005";
const branches = [BRANCH, OTHER_BRANCH];
const own = { scope: "own", ownerUserIds: [OWNER] };
const user = {
  id: OWNER,
  accessibleBranches: branches,
  accessibleCompanies: [COMPANY, OTHER_COMPANY],
  accessibleBranchCompanies: [
    { branchId: BRANCH, companyId: COMPANY },
    { branchId: OTHER_BRANCH, companyId: OTHER_COMPANY },
  ],
  teamMemberships: [],
};
function response(branchId: string, create: unknown) {
  return { data: { branchId, leads: { create } }, status: 200, statusText: "OK", headers: new Headers() };
}
function failure(status: number) {
  return new TenantApiClientError("Failed", { status, statusText: "Failed", headers: new Headers(), data: {} });
}

beforeEach(() => { auth.mockReturnValue({ user }); });
afterEach(() => { cleanup(); get.mockReset(); auth.mockReset(); });

describe("lead create capabilities", () => {
  it("keeps only creatable branches and preserves their own owner boundary", async () => {
    get.mockImplementation((url: string) => Promise.resolve(
      url.endsWith(BRANCH) ? response(BRANCH, own) : response(OTHER_BRANCH, null),
    ));
    const { result, rerender } = renderHook(() => useLeadCreateCapabilities(branches, true));
    expect(result.current.branchIds).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.branchIds).toEqual([BRANCH]);
    expect(result.current.capabilities?.get(BRANCH)).toEqual(own);
    expect(result.current.degraded).toBe(false);
    expect(get).toHaveBeenCalledWith(expect.stringContaining(BRANCH), expect.objectContaining({
      headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH },
    }));
    expect(get).toHaveBeenCalledWith(expect.stringContaining(OTHER_BRANCH), expect.objectContaining({
      headers: { "x-mutakamel-company-id": OTHER_COMPANY, "x-mutakamel-branch-id": OTHER_BRANCH },
    }));
    rerender();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each([403, 500])("omits a refused branch (%s), distinguishing denial from degradation", async (status) => {
    get.mockImplementation((url: string) => url.endsWith(BRANCH)
      ? Promise.resolve(response(BRANCH, own)) : Promise.reject(failure(status)));
    const { result } = renderHook(() => useLeadCreateCapabilities(branches, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.branchIds).toEqual([BRANCH]);
    expect(result.current.degraded).toBe(status !== 403);
  });

  it("fails closed for mismatched and malformed capability payloads", async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith(BRANCH)
      ? response(OTHER_BRANCH, own) : response(OTHER_BRANCH, { scope: "own", ownerUserIds: null })));
    const { result } = renderHook(() => useLeadCreateCapabilities(branches, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.branchIds).toEqual([]);
    expect(result.current.degraded).toBe(true);
  });

  it("does not send requests without a resolved branch/company mapping", async () => {
    auth.mockReturnValue({ user: { ...user, accessibleBranchCompanies: [] } });
    const { result } = renderHook(() => useLeadCreateCapabilities(branches, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.branchIds).toEqual([]);
    expect(result.current.degraded).toBe(true);
  });

  it("drops old answers when closing, reopening or changing actor", async () => {
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined;
    get.mockImplementationOnce(() => new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; }));
    const oneBranch = [BRANCH];
    const { result, rerender } = renderHook(({ enabled }) => useLeadCreateCapabilities(oneBranch, enabled), {
      initialProps: { enabled: true },
    });
    const signal = get.mock.calls[0]?.[1]?.signal as AbortSignal;
    rerender({ enabled: false });
    expect(signal.aborted).toBe(true);
    expect(result.current.branchIds).toEqual([]);
    get.mockResolvedValue(response(BRANCH, null));
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { resolveOld?.(response(BRANCH, own)); });
    expect(result.current.branchIds).toEqual([]);
    auth.mockReturnValue({ user: { ...user, id: OTHER_COMPANY } });
    rerender({ enabled: true });
    expect(result.current.capabilities).toBeUndefined();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("makes no requests while closed", () => {
    const { result } = renderHook(() => useLeadCreateCapabilities(branches, false));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("discards cached create grants and refreshes on focus and scoped denial", async () => {
    get.mockResolvedValue(response(BRANCH, own));
    const oneBranch = [BRANCH];
    const { result } = renderHook(() => useLeadCreateCapabilities(oneBranch, true));
    await waitFor(() => expect(result.current.branchIds).toEqual([BRANCH]));
    get.mockResolvedValue(response(BRANCH, null));
    act(() => window.dispatchEvent(new CustomEvent("tenant-permission-denied", {
      detail: { code: "CRM_SCOPED_PERMISSION_DENIED", endpoint: "/api/tenant/crm/v1/leads",
        method: "POST", branchId: BRANCH, companyId: COMPANY },
    })));
    expect(result.current.branchIds).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.branchIds).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
    get.mockResolvedValue(response(BRANCH, own));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.branchIds).toEqual([BRANCH]));
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("rejects a missing create action while accepting all-scope owners", () => {
    expect(() => parseLeadCreateCapability({ branchId: BRANCH, leads: {} }, BRANCH)).toThrow();
    expect(parseLeadCreateCapability(response(BRANCH, { scope: "all", ownerUserIds: null }).data, BRANCH))
      .toEqual({ scope: "all", ownerUserIds: null });
  });
});
