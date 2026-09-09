// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { emptyCreateLeadForm } from "../lead-create-contract";
import { useLeadCapabilities } from "./useLeadCapabilities";
import { useLeads } from "./useLeads";

const { auth, get, post } = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), post: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      crmLeads: {
        messages: {
          tagUnknown: "Selected tags changed. Remove them or choose again.",
          createFailed: "Unable to create the lead.",
        },
      },
    },
  }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const STAGE = "0192f3a0-0000-7000-8000-000000000004";
const LEAD = "0192f3a0-0000-7000-8000-000000000005";
const TAG = "0192f3a0-0000-7000-8000-000000000006";
const SECOND_TAG = "0192f3a0-0000-7000-8000-000000000007";
const LEADS_PATH = "/api/tenant/crm/v1/leads";
const LEADS_SEARCH_PATH = "/api/tenant/crm/v1/leads/search";

function response(data: unknown, status = 200) {
  return { data, status, statusText: "OK", headers: new Headers() };
}

function allowCreateReads(url: string) {
  if (url.startsWith(`${LEADS_PATH}?`)) {
    return Promise.resolve(response({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    }));
  }
  if (url === "/api/tenant/crm/v1/lead-stages") {
    return Promise.resolve(response([]));
  }
  if (url.startsWith(`${LEADS_PATH}/capabilities?`)) {
    return Promise.resolve(response({
      branchId: BRANCH,
      leads: {
        create: { scope: "all", ownerUserIds: null },
        update: null,
        delete: null,
      },
    }));
  }
  return Promise.reject(serverError(500));
}

function createForm() {
  return {
    ...emptyCreateLeadForm("contact-1"),
    firstName: "Mona",
    lastName: "Hassan",
    stageId: STAGE,
    tagIds: [TAG, SECOND_TAG],
  };
}

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
  post.mockImplementation(() => Promise.reject(serverError(500)));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  auth.mockReset();
  get.mockReset();
  post.mockReset();
});

describe("leads request lifecycle", () => {
  it("creates a lead and all selected tags with exactly one write", async () => {
    get.mockImplementation(allowCreateReads);
    post.mockResolvedValue(response({
      id: LEAD,
      displayName: "Mona Hassan",
      branchId: BRANCH,
      stageId: STAGE,
      ownerUserId: null,
      tags: [
        { id: TAG, name: "Priority" },
        { id: SECOND_TAG, name: "New customer" },
      ],
    }, 201));
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.canCreate).toBe(true);

    let created = false;
    await act(async () => {
      created = await result.current.handleCreate(createForm());
    });

    expect(created).toBe(true);
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      LEADS_PATH,
      expect.objectContaining({ tagIds: [TAG, SECOND_TAG] }),
      expect.objectContaining({
        skipAutoIdempotency: true,
        headers: expect.objectContaining({ "x-idempotency-key": expect.any(String) }),
      }),
    );
    expect(post.mock.calls.some(([url]) => String(url).includes("/tags"))).toBe(false);
  });

  it("keeps the create flow open with actionable copy when a selected tag disappeared", async () => {
    get.mockImplementation(allowCreateReads);
    post.mockRejectedValue(new TenantApiClientError("Unknown tag", {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: new Headers(),
      data: {
        code: "CRM_TAG_UNKNOWN",
        message: "Tag not found",
        correlationId: "crm-request-reference",
      },
    }));
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    act(() => result.current.openCreate());

    let created = true;
    await act(async () => {
      created = await result.current.handleCreate(createForm());
    });

    expect(created).toBe(false);
    expect(result.current.isCreateOpen).toBe(true);
    expect(result.current.error).toBe(
      "Selected tags changed. Remove them or choose again.",
    );
    expect(post).toHaveBeenCalledOnce();
  });

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
      result.current.setSearch({
        ...result.current.search,
        basic: { field: "status", value: "OPEN" },
      }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}&status=OPEN`);

    act(() =>
      result.current.setSearch({
        ...result.current.search,
        basic: { field: "text", value: " acme " },
      }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(listUrl()).toBe(`${LEADS_PATH}?${unfiltered}&search=acme`);
  });

  // Requirement 4: advanced is BUTTON-DRIVEN. Editing a condition builds a
  // draft and nothing else — the tree's intermediate states are all different
  // questions, and most of them are the expensive ones.
  it("posts the filter tree only once Search is pressed", async () => {
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const listCalls = () =>
      get.mock.calls.filter(([url]) => (url as string).startsWith(`${LEADS_PATH}?`)).length;

    // Entering advanced applies once, so basic's filter stops answering the
    // moment its controls leave the screen.
    act(() => result.current.setSearch({ ...result.current.search, mode: "advanced" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(post).toHaveBeenCalledTimes(1);
    const listsAfterSwitch = listCalls();

    // Two ANDed conditions in one group, then a second group for the OR.
    act(() =>
      result.current.setSearch({
        ...result.current.search,
        groups: [
          {
            conditions: [
              { field: "status", operator: "eq", value: "OPEN", valueTo: "" },
              { field: "stageFlag", operator: "eq", value: "QUALIFIED", valueTo: "" },
            ],
          },
          {
            conditions: [
              { field: "createdAt", operator: "gte", value: "2026-01-01", valueTo: "" },
            ],
          },
        ],
      }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    // Not one more request, on either verb.
    expect(post).toHaveBeenCalledTimes(1);
    expect(listCalls()).toBe(listsAfterSwitch);

    act(() => result.current.submitSearch());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(
      LEADS_SEARCH_PATH,
      {
        branchId: BRANCH,
        filterTree: {
          op: "OR",
          children: [
            {
              op: "AND",
              children: [
                { field: "status", operator: "eq", value: "OPEN" },
                { field: "stageFlag", operator: "eq", value: "QUALIFIED" },
              ],
            },
            { field: "createdAt", operator: "gte", value: "2026-01-01" },
          ],
        },
        sort: "createdAt:DESC",
        page: 1,
        limit: 50,
      },
      // A POST that reads: no idempotency key, and replayable after a refresh.
      expect.objectContaining({ skipAutoIdempotency: true, replayAfterRefresh: true }),
    );
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
