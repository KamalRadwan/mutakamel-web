// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchBranchRoleAssignments, fetchScopeRoleAssignments } from "../../../contracts/role-assignment-contract";
import { useUserRoleGrants } from "./useUserRoleGrants";

vi.mock("../../../contracts/role-assignment-contract", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../contracts/role-assignment-contract")>(),
  fetchBranchRoleAssignments: vi.fn(),
  fetchScopeRoleAssignments: vi.fn(),
}));

const USER_ID = "0192f3a0-0000-7000-8000-000000000002";

beforeEach(() => {
  vi.mocked(fetchBranchRoleAssignments).mockResolvedValue([]);
  vi.mocked(fetchScopeRoleAssignments).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("loads and reloads branch grants without requesting scope grants for non-owners", async () => {
  const { result } = renderHook(() => useUserRoleGrants(USER_ID, true, false));
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(1));
  act(() => result.current.reload());
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(2));
  expect(fetchScopeRoleAssignments).not.toHaveBeenCalled();
  expect(result.current.scopeError).toBeNull();
  expect(result.current.isScopeLoading).toBe(false);
});

it("loads scope grants for owners and clears a previous failure when ownership is lost", async () => {
  vi.mocked(fetchScopeRoleAssignments).mockRejectedValue(new Error("Unavailable"));
  const { result, rerender } = renderHook(
    ({ isOwner }) => useUserRoleGrants(USER_ID, true, isOwner),
    { initialProps: { isOwner: true } },
  );
  await waitFor(() => expect(result.current.scopeError).not.toBeNull());
  rerender({ isOwner: false });
  await waitFor(() => expect(result.current.scopeError).toBeNull());
  act(() => result.current.reload());
  await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledTimes(3));
  expect(fetchScopeRoleAssignments).toHaveBeenCalledTimes(1);
  expect(result.current.isScopeLoading).toBe(false);
});
