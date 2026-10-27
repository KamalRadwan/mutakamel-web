// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadCompanyOptions } from "./useLeadCompanyOptions";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { message: "No scope" },
  useOrganizationScopeHeaders: () => ({ ready: true, headers: {} }),
}));

const BRANCH = "018f0000-0000-7000-8000-000000000001";
const COMPANY = { id: "018f0000-0000-7000-8000-000000000002", displayName: "Acme", branchId: BRANCH };
const response = (data: unknown) => ({ data });

beforeEach(() => { get.mockResolvedValue(response([])); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("useLeadCompanyOptions remote search", () => {
  it("debounces typing and sends the final search with limit 50", async () => {
    const { result } = renderHook(() => useLeadCompanyOptions(BRANCH, true));
    act(() => result.current.searchCompanies("Ac"));
    act(() => result.current.searchCompanies("Acme"));
    expect(get).not.toHaveBeenCalled();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const query = new URL(get.mock.calls[0][0], "https://example.test").searchParams;
    expect(query.get("search")).toBe("Acme");
    expect(query.get("limit")).toBe("50");
  });

  it("ignores an older response even if the transport resolves after abort", async () => {
    let resolveOld!: (value: { data: unknown }) => void;
    get.mockImplementationOnce(() => new Promise<{ data: unknown }>((resolve) => { resolveOld = resolve; }));
    const { result } = renderHook(() => useLeadCompanyOptions(BRANCH, true));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    act(() => result.current.searchCompanies("Acme"));
    expect(signal.aborted).toBe(true);
    get.mockResolvedValue(response([COMPANY]));
    await waitFor(() => expect(result.current.companies).toHaveLength(1));
    await act(async () => resolveOld(response([])));
    expect(result.current.companies[0].displayName).toBe("Acme");
  });

  it("retains the selected company when a new search has no matches", async () => {
    get.mockResolvedValueOnce(response([COMPANY]));
    const { result } = renderHook(() => useLeadCompanyOptions(BRANCH, true));
    await waitFor(() => expect(result.current.companies).toHaveLength(1));
    await act(async () => result.current.selectCompany(COMPANY.id));
    act(() => result.current.searchCompanies("No matches"));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isLoadingCompanies).toBe(false));
    expect(result.current.companies).toEqual([]);
    expect(result.current.selectedCompany?.displayName).toBe("Acme");
    act(() => result.current.reset());
    expect(result.current.selectedCompany).toBeNull();
  });

  it("does not search while disabled or without a valid branch", async () => {
    const { rerender, unmount } = renderHook(
      ({ branchId, enabled }) => useLeadCompanyOptions(branchId, enabled),
      { initialProps: { branchId: BRANCH, enabled: false } },
    );
    await act(async () => { await Promise.resolve(); });
    rerender({ branchId: "invalid", enabled: true });
    await act(async () => { await Promise.resolve(); });
    unmount();
    expect(get).not.toHaveBeenCalled();
  });
});
