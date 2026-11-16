// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useCustomerProfileOptions } from "./useCustomerProfileOptions";

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useAuthScopeKey", () => ({ useAuthScopeKey: () => "actor" }));
vi.mock("../../customer-profiles/hooks/useCustomerProfiles", () => ({
  buildCustomerProfilesListPath: ({ page, search }: { page: number; search: { search?: string } }) => `/customers?page=${page}&search=${search.search ?? ""}`,
  parseCustomerProfilesPageResponse: (payload: unknown) => payload,
}));
vi.mock("../../customer-profiles/customer-profile-search-contract", () => ({ customerProfileTextSearch: (search: string) => ({ search }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() } }));

const branchId = "01900100-0000-7000-8000-000000000001";
const customer = { id: "01900100-0000-7000-8000-000000000002", displayName: "Nile Engineering", status: "PROSPECT" };
const response = (items: unknown[], page = 1, hasNext = false) => ({ status: 200, statusText: "OK", headers: new Headers(), data: { items, page, hasNext } });
beforeEach(() => vi.mocked(axiosClient.get).mockReset());
afterEach(cleanup);

describe("opportunity customer options", () => {
  it("keeps later pages reachable when the first page contains only blacklisted records", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response([{ ...customer, status: "BLACKLISTED" }], 1, true)).mockResolvedValueOnce(response([customer], 2));
    const { result } = renderHook(() => useCustomerProfileOptions(branchId, true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toEqual([customer]));
    expect(result.current.hasMore).toBe(false);
    expect(vi.mocked(axiosClient.get).mock.calls[1][0]).toContain("page=2");
  });

  it("keeps a forbidden lookup distinct from a successful empty result and retries", async () => {
    vi.mocked(axiosClient.get).mockRejectedValueOnce(new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} })).mockResolvedValueOnce(response([]));
    const { result } = renderHook(() => useCustomerProfileOptions(branchId, true));
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toEqual([]);
  });

  it("discards an old search response when the user changes the query", async () => {
    let finish: (value: ReturnType<typeof response>) => void = () => undefined;
    vi.mocked(axiosClient.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(response([customer]));
    const { result } = renderHook(() => useCustomerProfileOptions(branchId, true));
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledOnce());
    act(() => result.current.search("Nile"));
    await waitFor(() => expect(result.current.items).toEqual([customer]));
    await act(async () => { finish(response([{ ...customer, id: branchId, displayName: "Old query" }])); });
    expect(result.current.items).toEqual([customer]);
  });
});


