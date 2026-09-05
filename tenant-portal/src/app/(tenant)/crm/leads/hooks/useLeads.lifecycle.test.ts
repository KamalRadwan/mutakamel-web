// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useLeadCapabilities } from "./useLeadCapabilities";
import { useLeads } from "./useLeads";

const { auth, get } = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { crmLeads: { messages: {} } } }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const LEADS_PATH = "/api/tenant/crm/v1/leads";

function serverError(status: number): TenantApiClientError {
  return new TenantApiClientError("Request failed", {
    status,
    statusText: "Request failed",
    headers: new Headers(),
    data: { message: "Request failed", correlationId: "crm-request-reference" },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  auth.mockReturnValue({
    user: {
      accessibleBranches: [BRANCH, OTHER_BRANCH],
      accessibleCompanies: [COMPANY],
      teamMemberships: [
        { branchId: BRANCH, companyId: COMPANY, isPrimary: true },
        { branchId: OTHER_BRANCH, companyId: COMPANY, isPrimary: false },
      ],
    },
  });
  get.mockImplementation((url: string) => Promise.reject(serverError(url.includes("capabilities") ? 400 : 500)));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  auth.mockReset();
  get.mockReset();
});

describe("leads request lifecycle", () => {
  it("settles a failed load without refetching on error or unrelated state renders", async () => {
    const { result, rerender } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadError).toMatchObject({ status: 500, correlationId: "crm-request-reference" });
    expect(result.current.canCreate).toBe(false);

    rerender();
    act(() => result.current.setIsCreateOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.current.loadError?.status).toBe(500);
    expect(get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/leads/capabilities?branchId=${BRANCH}`,
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH },
      }),
    );
  });

  it("allows one explicit retry and one load when the selected branch changes", async () => {
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await act(async () => { await result.current.fetchLeads(); });
    expect(get).toHaveBeenCalledTimes(6);

    act(() => result.current.selectBranch(OTHER_BRANCH));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(get).toHaveBeenCalledTimes(9);
    expect(get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/leads/capabilities?branchId=${OTHER_BRANCH}`,
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": OTHER_BRANCH },
      }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(get).toHaveBeenCalledTimes(9);
  });

  it("does not request a list or capabilities until an accessible branch is selected", async () => {
    auth.mockReturnValue({ user: { accessibleBranches: [], accessibleCompanies: [], teamMemberships: [] } });
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(get).not.toHaveBeenCalled();
    expect(result.current.branchId).toBeNull();
    expect(result.current.loadError).toBeNull();
  });

  // The list request's shape, pinned at the hook rather than at the builder:
  // this is what proves the screen goes THROUGH `lead-search-contract` instead
  // of hand-assembling a query of its own. An extra or misspelled key is a 400
  // the user reads as an empty list.
  it("sends the unfiltered window, then one filter key, resetting to page 1", async () => {
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const listUrl = () =>
      get.mock.calls
        .map(([url]) => url as string)
        .filter((url) => url.startsWith(`${LEADS_PATH}?`))
        .at(-1);
    const unfiltered = `branchId=${BRANCH}&page=1&limit=50&sortBy=createdAt&sortDir=DESC`;

    // A blank value sends no filter key at all — `search=` is not "no filter".
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}`);

    act(() => result.current.setPage(2));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered.replace("page=1", "page=2")}`);

    // Changing the filter starts the result set over, exactly as the old
    // free-text search did.
    act(() =>
      result.current.setSearch({ mode: "basic", rows: [{ field: "status", value: "OPEN" }] }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}&status=OPEN`);

    act(() =>
      result.current.setSearch({ mode: "basic", rows: [{ field: "text", value: " acme " }] }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}&search=acme`);

    // Advanced mode sends one key per condition, AND-ed by the server.
    act(() =>
      result.current.setSearch({
        mode: "advanced",
        rows: [
          { field: "text", value: "acme" },
          { field: "status", value: "OPEN" },
        ],
      }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}&search=acme&status=OPEN`);
  });

  it("does not retry failed detail capabilities on state renders", async () => {
    const { result, rerender } = renderHook(
      ({ branchId }) => useLeadCapabilities(branchId),
      { initialProps: { branchId: BRANCH } },
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(get).toHaveBeenCalledOnce();
    expect(result.current.error).toMatchObject({ status: 400, correlationId: "crm-request-reference" });
    expect(result.current.capabilities.update).toBeNull();
    expect(result.current.isLoading).toBe(false);

    rerender({ branchId: BRANCH });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(get).toHaveBeenCalledOnce();

    rerender({ branchId: OTHER_BRANCH });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(
      `/api/tenant/crm/v1/leads/capabilities?branchId=${OTHER_BRANCH}`,
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": OTHER_BRANCH },
      }),
    );
  });
});
