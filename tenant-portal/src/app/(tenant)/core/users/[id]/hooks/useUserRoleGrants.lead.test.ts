// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BranchRoleAssignment,
  ScopeRoleAssignment,
} from "../../../contracts/role-assignment-contract";
import { useUserRoleGrants } from "./useUserRoleGrants";

const io = vi.hoisted(() => ({
  branches: vi.fn(),
  scopes: vi.fn(),
  replaceBranches: vi.fn(),
  replaceScopes: vi.fn(),
}));

vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en" }));
vi.mock("../../../contracts/role-assignment-contract", async (original) => ({
  ...(await original<typeof import("../../../contracts/role-assignment-contract")>()),
  fetchBranchRoleAssignments: io.branches,
  fetchScopeRoleAssignments: io.scopes,
  replaceBranchRoleAssignments: io.replaceBranches,
  replaceScopeRoleAssignments: io.replaceScopes,
}));

const USER = "0199f2b0-1111-7222-8333-444455556601";
const ROLE = "0199f2b0-1111-7222-8333-444455556602";
const BRANCH = "0199f2b0-1111-7222-8333-444455556603";

beforeEach(() => {
  vi.resetAllMocks();
  io.branches.mockResolvedValue([]);
  io.scopes.mockResolvedValue([]);
  io.replaceBranches.mockResolvedValue([]);
  io.replaceScopes.mockResolvedValue([]);
});
afterEach(cleanup);

describe("lead verification of current authority before atomic grant writes", () => {
  it("refuses exact-scope replacement after owner authority is lost with a review open", async () => {
    const { result, rerender } = renderHook(
      ({ owner }) => useUserRoleGrants(USER, true, owner),
      { initialProps: { owner: true } },
    );
    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));
    act(() => {
      result.current.startScopeEdit();
      result.current.setDraft([{ scopeTarget: "TENANT", roleId: ROLE }]);
    });
    rerender({ owner: false });
    let accepted = true;
    await act(async () => { accepted = await result.current.commitScopeRoles(); });
    expect(accepted).toBe(false);
    expect(io.replaceScopes).not.toHaveBeenCalled();
  });

  it("cannot replace an unseen branch-role baseline while the initial read is pending", async () => {
    io.branches.mockReturnValue(new Promise<BranchRoleAssignment[]>(() => undefined));
    const { result } = renderHook(() => useUserRoleGrants(USER, true, false));
    await waitFor(() => expect(io.branches).toHaveBeenCalledOnce());
    expect(result.current.isBranchLoading).toBe(true);
    act(() => result.current.startBranchReplace());
    let accepted = true;
    await act(async () => { accepted = await result.current.commitBranchRoles(); });
    expect(accepted).toBe(false);
    expect(io.replaceBranches).not.toHaveBeenCalled();
  });

  it("refuses a prepared branch replacement after target management becomes disabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useUserRoleGrants(USER, enabled, false),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.isBranchLoading).toBe(false));
    act(() => {
      result.current.startBranchReplace();
      result.current.setBranchDraft([{ branchId: BRANCH, roleId: ROLE }]);
    });
    rerender({ enabled: false });
    let accepted = true;
    await act(async () => { accepted = await result.current.commitBranchRoles(); });
    expect(accepted).toBe(false);
    expect(io.replaceBranches).not.toHaveBeenCalled();
  });

  it("dispatches only one exact-scope replacement for rapid duplicate confirmations", async () => {
    let finishWrite: (value: ScopeRoleAssignment[]) => void = () => undefined;
    const write = new Promise<ScopeRoleAssignment[]>((resolve) => { finishWrite = resolve; });
    io.replaceScopes.mockReturnValue(write);
    const { result } = renderHook(() => useUserRoleGrants(USER, true, true));
    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));
    act(() => {
      result.current.startScopeEdit();
      result.current.setDraft([{ scopeTarget: "TENANT", roleId: ROLE }]);
    });
    await act(async () => {
      const first = result.current.commitScopeRoles();
      const second = result.current.commitScopeRoles();
      finishWrite([]);
      await Promise.all([first, second]);
    });
    expect(io.replaceScopes).toHaveBeenCalledOnce();
    expect(io.replaceScopes).toHaveBeenCalledWith(USER, [{ scopeTarget: "TENANT", roleId: ROLE }]);
  });

  it("never applies a previous user's scope draft to a newly loaded target", async () => {
    const otherUser = "0199f2b0-1111-7222-8333-444455556604";
    const { result, rerender } = renderHook(
      ({ userId }) => useUserRoleGrants(userId, true, true),
      { initialProps: { userId: USER } },
    );
    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));
    act(() => {
      result.current.startScopeEdit();
      result.current.setDraft([{ scopeTarget: "TENANT", roleId: ROLE }]);
    });
    rerender({ userId: otherUser });
    await waitFor(() => expect(io.scopes).toHaveBeenCalledWith(otherUser, expect.any(AbortSignal), expect.any(Object)));
    await waitFor(() => expect(result.current.isScopeLoading).toBe(false));
    let accepted = true;
    await act(async () => { accepted = await result.current.commitScopeRoles(); });
    expect(accepted).toBe(false);
    expect(io.replaceScopes).not.toHaveBeenCalled();
  });
});
