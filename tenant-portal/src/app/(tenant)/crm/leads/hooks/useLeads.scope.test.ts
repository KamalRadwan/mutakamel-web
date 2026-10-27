// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { useLeads } from "./useLeads";

const { get, post, branch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  branch: { id: "0192f3a0-0000-7000-8000-000000000002" },
}));
const BRANCH = branch.id;
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const ACTOR = "0192f3a0-0000-7000-8000-000000000099";
const HEADERS = { "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001" };
const SCOPE = { ready: true, headers: HEADERS };

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: ACTOR } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({
    branchId: branch.id,
    branchIds: [BRANCH, OTHER_BRANCH],
    selectBranch: (id: string) => { branch.id = id; },
  }),
}));
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { code: "scope-unresolved" },
  useOrganizationScopeHeaders: () => SCOPE,
}));
vi.mock("./useLeadMutations", () => ({ useLeadMutations: () => ({}) }));
vi.mock("./useLeadCardWrites", () => ({ useLeadCardWrites: () => ({}) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});

function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}
function failure(status: number) {
  return new TenantApiClientError("Request failed", {
    status, statusText: "Request failed", headers: new Headers(),
    data: { message: "Request failed", correlationId: "scope-reference" },
  });
}
const EMPTY_PAGE = { items: [], total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrev: false };
function reads(url: string) {
  if (url.includes("capabilities?")) return Promise.resolve(response({
    branchId: branch.id, leads: { create: null, update: null, delete: null, convert: null },
  }));
  return Promise.resolve(response(url.includes("lead-stages") ? [] : EMPTY_PAGE));
}

beforeEach(() => {
  vi.useFakeTimers();
  branch.id = BRANCH;
  get.mockImplementation(reads);
  post.mockRejectedValue(failure(403));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("branch lead read denial", () => {
  it("exposes GET and search 403s as scope denial and clears it on an allowed branch", async () => {
    get.mockImplementation((url: string) => url.includes("/leads?") && url.includes(BRANCH)
      ? Promise.reject(failure(403)) : reads(url));
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.scopeDenied).toBe(true);
    expect(result.current.loadError).toMatchObject({ status: 403, correlationId: "scope-reference" });
    expect(result.current.items).toEqual([]);
    const calls = get.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(get).toHaveBeenCalledTimes(calls);

    act(() => result.current.setSearch({ ...result.current.search, mode: "advanced" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(post).toHaveBeenCalledOnce();
    expect(result.current.scopeDenied).toBe(true);

    act(() => result.current.selectBranch(OTHER_BRANCH));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.branchId).toBe(OTHER_BRANCH);
    expect(result.current.scopeDenied).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it("keeps a list server failure distinct from permission denial", async () => {
    get.mockImplementation((url: string) => url.includes("/leads?")
      ? Promise.reject(failure(500)) : reads(url));
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.scopeDenied).toBe(false);
    expect(result.current.loadError?.status).toBe(500);
  });

  it.each([403, 500, 200])("handles capabilities status %s without granting actions", async (status) => {
    get.mockImplementation((url: string) => url.includes("capabilities?")
      ? status === 200 ? Promise.resolve(response({ invalid: true })) : Promise.reject(failure(status))
      : reads(url));
    const { result } = renderHook(() => useLeads());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.degraded.capabilities).toBe(status !== 403);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canUpdateLead({ ownerUserId: ACTOR } as Parameters<typeof result.current.canUpdateLead>[0])).toBe(false);
    expect(result.current.canDeleteLead({ ownerUserId: ACTOR } as Parameters<typeof result.current.canDeleteLead>[0])).toBe(false);
    expect(result.current.loadError).toBeNull();
    expect(result.current.scopeDenied).toBe(false);
  });
});
