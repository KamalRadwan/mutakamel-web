// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readAssignableLeadOwners } from "../[id]/hooks/readLeadOwnerOptions";
import { useLeadBulkControls, useLeadBulkOwnerOptions } from "./useLeadMutations";

const scope = vi.hoisted(() => ({ ready: true, headers: {} as Record<string, string> }));
vi.mock("@/hooks/useOrganizationScope", () => ({ useOrganizationScopeHeaders: () => scope }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get: vi.fn() },
}));
vi.mock("../[id]/hooks/readLeadOwnerOptions", () => ({ readAssignableLeadOwners: vi.fn() }));

const BRANCH = "01900100-0000-7000-8000-000000000001";
const OTHER_BRANCH = "01900100-0000-7000-8000-000000000002";
const OWNER = "01900100-0000-7000-8000-000000000003";
const OTHER_OWNER = "01900100-0000-7000-8000-000000000004";
const COMPANY = "01900100-0000-7000-8000-000000000005";
const owners = [
  { id: OWNER, firstName: "Allowed", lastName: "Salesperson" },
  { id: OTHER_OWNER, firstName: "Other", lastName: "Salesperson" },
];

beforeEach(() => {
  vi.resetAllMocks();
  scope.ready = true;
  scope.headers = { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH };
  vi.mocked(readAssignableLeadOwners).mockResolvedValue(owners);
  vi.mocked(axiosClient.get).mockResolvedValue({ data: {
    branchId: BRANCH, leads: { update: { scope: "own", ownerUserIds: [OWNER] } },
  } } as Awaited<ReturnType<typeof axiosClient.get>>);
});
afterEach(cleanup);

describe("bulk lead owner candidates", () => {
  it("intersects validated CRM candidates with update owner scope", async () => {
    const { result } = renderHook(() => useLeadBulkOwnerOptions(BRANCH, true));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.owners).toEqual([owners[0]]);
    expect(readAssignableLeadOwners).toHaveBeenCalledWith(BRANCH, "update", expect.any(AbortSignal), scope.headers);
  });

  it("fails closed on a malformed capability or failed owner read", async () => {
    vi.mocked(readAssignableLeadOwners).mockRejectedValue(new Error("Unavailable"));
    const { result } = renderHook(() => useLeadBulkOwnerOptions(BRANCH, true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.owners).toEqual([]);
  });

  it("discards old branch owners immediately and ignores an aborted response", async () => {
    let resolve!: (value: typeof owners) => void;
    vi.mocked(readAssignableLeadOwners).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ branch }) => useLeadBulkOwnerOptions(branch, true), {
      initialProps: { branch: BRANCH },
    });
    vi.mocked(axiosClient.get).mockResolvedValue({ data: {
      branchId: OTHER_BRANCH, leads: { update: null },
    } } as Awaited<ReturnType<typeof axiosClient.get>>);
    rerender({ branch: OTHER_BRANCH });
    expect(result.current.owners).toEqual([]);
    await act(async () => resolve(owners));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.owners).toEqual([]);
  });

  it("does not read owners without selection or resolved organization scope", () => {
    const { rerender } = renderHook(({ enabled }) => useLeadBulkOwnerOptions(BRANCH, enabled), {
      initialProps: { enabled: false },
    });
    scope.ready = false;
    rerender({ enabled: true });
    expect(readAssignableLeadOwners).not.toHaveBeenCalled();
    expect(axiosClient.get).not.toHaveBeenCalled();
  });
});

describe("bulk lead control writes", () => {
  it("sends only a listed owner and serializes repeat clicks and rating writes", async () => {
    let resolve!: () => void;
    const assign = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const rating = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLeadBulkControls({
      isDeleting: false, owners: [owners[0]], onBulkAssignOwner: assign,
      onBulkMoveStage: vi.fn(), onBulkSetRating: rating,
    }));
    await act(async () => { await result.current.handleOwner(OTHER_OWNER); });
    expect(assign).not.toHaveBeenCalled();
    let pending!: Promise<void>;
    act(() => { pending = result.current.handleOwner(OWNER); });
    expect(result.current.isBusy).toBe(true);
    await act(async () => {
      await result.current.handleOwner(OWNER);
      await result.current.handleRating("3");
    });
    expect(assign).toHaveBeenCalledExactlyOnceWith(OWNER);
    expect(rating).not.toHaveBeenCalled();
    await act(async () => { resolve(); await pending; });
    expect(result.current.isBusy).toBe(false);
  });
});
